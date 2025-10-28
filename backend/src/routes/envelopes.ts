import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { PrismaClient, EnvelopeStatus, SignerRole } from '../generated/prisma/client.js';
import { 
  type JsonResponse, 
  type ErrorResponse, 
  type SerializedEnvelope,
  type SerializedSigner
} from '../types/responses.js';
import { FieldType } from '../generated/prisma/client.js';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { sendSigningInvitation } from '../services/email.js';
import { serializeEnvelope, serializeSigner } from '../utils/serializers.js';

const prisma = new PrismaClient();
const router = Router();

// Get all envelopes for user
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: JsonResponse<SerializedEnvelope[] | ErrorResponse>): Promise<void> => {
  try {
    const envelopes = await prisma.envelope.findMany({
      where: { ownerId: req.user!.id },
      include: {
        document: true,
        signers: true,
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(envelopes.map(serializeEnvelope));
  } catch (error) {
    res.status(500).json({ 
      message: error instanceof Error ? error.message : 'Failed to fetch envelopes'
    });
  }
});

// Create envelope
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: JsonResponse<SerializedEnvelope | ErrorResponse>): Promise<void> => {
  const Schema = z.object({ documentId: z.string(), subject: z.string().optional(), message: z.string().optional() });
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: 'Invalid request data',
      errors: parsed.error.flatten()
    });
    return;
  }
  const { documentId, subject, message } = parsed.data;
  const document = await prisma.document.findFirst({ 
    where: { id: documentId, ownerId: req.user!.id },
    include: { owner: true }
  });

  if (!document) {
    res.status(404).json({ message: 'Document not found' });
    return;
  }

  const env = await prisma.envelope.create({
    data: {
      ownerId: req.user!.id,
      documentId: document.id,
      subject: subject ?? null,
      message: message ?? null,
      status: EnvelopeStatus.DRAFT,
    },
    include: {
      document: true,
      owner: true,
      signers: true
    }
  });

  await prisma.auditLog.create({ 
    data: { 
      envelopeId: env.id, 
      event: 'ENVELOPE_CREATED', 
      actorEmail: req.user!.email 
    } 
  });

  res.status(201).json(serializeEnvelope(env));
});

// Add signer
router.post('/:id/signers', requireAuth, async (req: AuthenticatedRequest, res: JsonResponse<{ signer: SerializedSigner; link: string; otp: string } | ErrorResponse>): Promise<void> => {
  const Schema = z.object({ 
    email: z.string().email(), 
    name: z.string().min(1), 
    role: z.enum(['SIGNER', 'CC']).default('SIGNER'), 
    routingOrder: z.number().int().min(1).default(1),
    placement: z.object({
      pageNumber: z.number().int().min(1),
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      width: z.number().min(0).max(1),
      height: z.number().min(0).max(1)
    }).optional()
  });

  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ 
      message: 'Invalid request data',
      errors: parsed.error.flatten()
    });
    return;
  }

  if (!req.params['id']) {
    res.status(400).json({ message: 'Envelope ID is required' });
    return;
  }
  
  const env = await prisma.envelope.findFirst({
    where: { 
      id: req.params['id'],
      ownerId: req.user!.id
    },
    include: {
      document: true,
      owner: true,
      signers: true
    }
  });

  if (!env) {
    res.status(404).json({ message: 'Envelope not found' });
    return;
  }

  if (env.status !== EnvelopeStatus.DRAFT) {
    res.status(400).json({ message: 'Cannot modify non-draft envelope' });
    return;
  }
  
  // Generate unique signing link and OTP
  const link = uuidv4();
  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
  
  const signer = await prisma.envelopeSigner.create({
    data: {
      envelopeId: env.id,
      email: parsed.data.email,
      name: parsed.data.name,
      role: parsed.data.role as SignerRole,
      routingOrder: parsed.data.routingOrder,
      signingLink: link,
      otpCode: otp,
      otpExpiry: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
    },
    include: {
      signature: true
    }
  });
  
  // If placement provided, create a SIGNATURE field for this signer
  if (parsed.data.placement) {
    const p = parsed.data.placement;
    try {
      await prisma.documentField.create({
        data: {
          envelopeId: env.id,
          signerId: signer.id,
          type: FieldType.SIGNATURE,
          page: p.pageNumber,
          x: p.x,
          y: p.y,
          width: p.width,
          height: p.height,
          required: true
        }
      });
      await prisma.auditLog.create({
        data: {
          envelopeId: env.id,
          event: 'SIGNATURE_FIELD_ADDED',
          actorEmail: req.user!.email,
          details: { signerId: signer.id, placement: p }
        }
      });
    } catch (e) {
      // ignore field creation errors to not block signer creation
    }
  }
  
  await prisma.auditLog.create({ 
    data: { 
      envelopeId: env.id, 
      event: 'SIGNER_ADDED', 
      actorEmail: req.user!.email, 
      details: { email: signer.email, name: signer.name, otp: otp } 
    } 
  });
  
  res.status(201).json({ 
    signer: serializeSigner(signer), 
    link, 
    otp 
  });
});

// Send envelope
router.post('/:id/send', requireAuth, async (req: AuthenticatedRequest, res: JsonResponse<SerializedEnvelope | ErrorResponse>): Promise<void> => {
  if (!req.params['id']) {
    res.status(400).json({ message: 'Envelope ID is required' });
    return;
  }

  const env = await prisma.envelope.findFirst({ 
    where: { 
      id: req.params['id'],
      ownerId: req.user!.id
    }, 
    include: { 
      signers: {
        select: {
          id: true,
          name: true,
          email: true,
          signingLink: true,
          otpCode: true,
          role: true
        }
      },
      document: {
        select: {
          id: true,
          originalName: true
        }
      },
      owner: {
        select: {
          email: true
        }
      }
    } 
  });

  if (!env) {
    res.status(404).json({ message: 'Envelope not found' });
    return;
  }
  
  if (env.signers.length === 0) {
    res.status(400).json({ message: 'Add at least one signer' });
    return;
  }
  
  const updated = await prisma.envelope.update({ 
    where: { id: env.id }, 
    data: { status: EnvelopeStatus.SENT } 
  });

  await prisma.auditLog.create({ 
    data: { 
      envelopeId: env.id, 
      event: 'ENVELOPE_SENT', 
      actorEmail: req.user!.email 
    } 
  });
  
  // Send email invitations to all signers
  const baseUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:3000';
  const emailPromises = env.signers.map(async (signer) => {
    if (signer.otpCode) {
      const signingLink = `${baseUrl}/sign/${signer.signingLink}`;
      
      try {
        await sendSigningInvitation({
          signerName: signer.name,
          signerEmail: signer.email,
          documentName: env.document.originalName,
          envelopeSubject: env.subject ?? '',
          envelopeMessage: env.message ?? '',
          signingLink,
          otpCode: signer.otpCode,
          senderName: env.owner.email,
          senderEmail: env.owner.email
        });
        
        // Log email sent
        await prisma.auditLog.create({
          data: {
            envelopeId: env.id,
            event: 'INVITATION_EMAIL_SENT',
            actorEmail: req.user!.email,
            details: { recipientEmail: signer.email, recipientName: signer.name }
          }
        });
      } catch (error) {
        console.error(`Failed to send email to ${signer.email}:`, error);
        // Log email failure
        await prisma.auditLog.create({
          data: {
            envelopeId: env.id,
            event: 'INVITATION_EMAIL_FAILED',
            actorEmail: req.user!.email,
            details: { recipientEmail: signer.email, error: error instanceof Error ? error.message : 'Unknown error' }
          }
        });
      }
    }
  });
  
  // Wait for all emails to be sent (or fail)
  await Promise.allSettled(emailPromises);
  
  res.json(serializeEnvelope(updated));
});

// Get envelope with signers
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: JsonResponse<SerializedEnvelope | ErrorResponse>): Promise<void> => {
  if (!req.params['id']) {
    res.status(400).json({ message: 'Envelope ID is required' });
    return;
  }

  const env = await prisma.envelope.findFirst({ 
    where: { 
      id: req.params['id'], 
      ownerId: req.user!.id 
    }, 
    include: { 
      signers: {
        include: {
          signature: true
        }
      }, 
      document: true, 
      owner: {
        select: {
          email: true
        }
      }
    } 
  });  
  if (!env) {
    res.status(404).json({ message: 'Envelope not found' });
    return;
  }

  res.json(serializeEnvelope(env));
});

export default router;