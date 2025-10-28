import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { PrismaClient } from '../generated/prisma/client.js';
import type { DocumentField } from '../generated/prisma/client.js';
import type { JsonResponse, ErrorResponse } from '../types/responses.js';
import { z } from 'zod';
import { ValidationService } from '../services/validation.js';

const prisma = new PrismaClient();
const DRAFT = 'DRAFT';
const router = Router();

// Get all fields for an envelope
router.get('/:id/fields', requireAuth, async (req: AuthenticatedRequest, res: JsonResponse<DocumentField[] | ErrorResponse>): Promise<void> => {
  const id = req.params['id'];
  if (!id) {
    res.status(400).json({ message: 'Envelope ID is required' });
    return;
  }

  const env = await prisma.envelope.findUnique({ 
    where: { 
      id: id
    },
    include: { 
      fields: true,
      owner: true
    }
  });

  // Check if the envelope belongs to the user
  if (!env || env.owner.id !== req.user!.id) {
    res.status(404).json({ message: 'Envelope not found' });
    return;
  }
  res.json(env.fields);
});

// Add a field to an envelope
router.post('/:id/fields', requireAuth, async (req: AuthenticatedRequest, res: JsonResponse<DocumentField | ErrorResponse>): Promise<void> => {
  if (!req.params['id']) {
    res.status(400).json({ message: 'Envelope ID is required' });
    return;
  }

  const Schema = z.object({
    signerId: z.string(),
    type: z.enum(['SIGNATURE', 'DATE', 'TEXT', 'CHECKBOX', 'INITIAL']),
    page: z.number().int().min(1),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    required: z.boolean().default(true),
    label: z.string().optional(),
    fontFamily: z.string().optional(),
    fontSize: z.number().int().optional(),
  });

  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: 'Invalid request data',
      errors: parsed.error.flatten()
    });
    return;
  }

  const env = await prisma.envelope.findFirst({ 
    where: { 
      id: req.params['id'],
      ownerId: req.user!.id 
    } 
  });
  if (!env) {
    res.status(404).json({ message: 'Envelope not found' });
    return;
  }
  if (env.status !== DRAFT) {
    res.status(400).json({ message: 'Cannot modify non-draft envelope' });
    return;
  }

  // Verify signer belongs to envelope
  const signer = await prisma.envelopeSigner.findFirst({
    where: { id: parsed.data.signerId, envelopeId: env.id }
  });
  if (!signer) {
    res.status(400).json({ message: 'Invalid signer' });
    return;
  }

  // Get document details for page dimensions
  const document = await prisma.document.findUnique({
    where: { id: env.documentId }
  });

  if (!document) {
    res.status(404).json({ message: 'Document not found' });
    return;
  }

  // Get all existing fields for validation
  const existingFields = await prisma.documentField.findMany({
    where: { envelopeId: env.id }
  });

  // Create field instance but don't save yet
  const newField: DocumentField = {
    id: crypto.randomUUID(),
    envelopeId: env.id,
    signerId: signer.id,
    type: parsed.data.type,
    page: parsed.data.page,
    x: parsed.data.x,
    y: parsed.data.y,
    width: parsed.data.width,
    height: parsed.data.height,
    required: parsed.data.required,
    label: parsed.data.label ?? null,
    fontFamily: parsed.data.fontFamily ?? null,
    fontSize: parsed.data.fontSize ?? null,
    value: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // Validate field placement
  const validationService = new ValidationService();
  const validationResult = validationService.validateFields(
    [...existingFields, newField],
    612, // Standard US Letter width in points
    792  // Standard US Letter height in points
  );

  if (!validationResult.valid) {
    res.status(400).json({
      message: 'Invalid field placement',
      errors: validationResult.errors
    });
    return;
  }

  // Save the field if validation passes
  const field = await prisma.documentField.create({
    data: {
      envelopeId: env.id,
      signerId: signer.id,
      type: parsed.data.type,
      page: parsed.data.page,
      x: parsed.data.x,
      y: parsed.data.y,
      width: parsed.data.width,
      height: parsed.data.height,
      required: parsed.data.required,
      label: parsed.data.label ?? null,
      fontFamily: parsed.data.fontFamily ?? null,
      fontSize: parsed.data.fontSize ?? null,
    },
  });

  await prisma.auditLog.create({
    data: {
      envelopeId: env.id,
      event: 'FIELD_ADDED',
      actorEmail: req.user!.email,
      details: {
        fieldId: field.id,
        type: field.type,
        signerId: field.signerId,
        page: field.page,
        position: { x: field.x, y: field.y }
      }
    }
  });

  res.status(201).json(field);
});

// Update a field
router.patch('/:envelopeId/fields/:fieldId', requireAuth, async (req: AuthenticatedRequest, res: JsonResponse<DocumentField | ErrorResponse>): Promise<void> => {
  if (!req.params['envelopeId'] || !req.params['fieldId']) {
    res.status(400).json({ message: 'Envelope ID and Field ID are required' });
    return;
  }

  const Schema = z.object({
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    required: z.boolean().optional(),
    label: z.string().optional(),
    fontFamily: z.string().optional(),
    fontSize: z.number().int().optional(),
  });

  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: 'Invalid request data',
      errors: parsed.error.flatten()
    });
    return;
  }

  const env = await prisma.envelope.findFirst({ 
    where: { 
      id: req.params['envelopeId'],
      ownerId: req.user!.id 
    } 
  });
  if (!env) {
    res.status(404).json({ message: 'Envelope not found' });
    return;
  }
  if (env.status !== DRAFT) {
    res.status(400).json({ message: 'Cannot modify non-draft envelope' });
    return;
  }

  const field = await prisma.documentField.findFirst({
    where: { 
      id: req.params['fieldId'],
      envelopeId: env.id 
    }
  });
  if (!field) {
    res.status(404).json({ message: 'Field not found' });
    return;
  }

  const updated = await prisma.documentField.update({
    where: { id: field.id },
    data: {
      x: parsed.data.x ?? field.x,
      y: parsed.data.y ?? field.y,
      width: parsed.data.width ?? field.width,
      height: parsed.data.height ?? field.height,
      required: parsed.data.required ?? field.required,
      label: parsed.data.label ?? null,
      fontFamily: parsed.data.fontFamily ?? null,
      fontSize: parsed.data.fontSize ?? null,
    },
  });

  await prisma.auditLog.create({
    data: {
      envelopeId: env.id,
      event: 'FIELD_UPDATED',
      actorEmail: req.user!.email,
      details: {
        fieldId: field.id,
        changes: parsed.data
      }
    }
  });

  res.json(updated);
});

// Delete a field
router.delete('/:envelopeId/fields/:fieldId', requireAuth, async (req: AuthenticatedRequest, res: JsonResponse<ErrorResponse | void>): Promise<void> => {
  if (!req.params['envelopeId'] || !req.params['fieldId']) {
    res.status(400).json({ message: 'Envelope ID and Field ID are required' });
    return;
  }

  const env = await prisma.envelope.findFirst({ 
    where: { 
      id: req.params['envelopeId'],
      ownerId: req.user!.id 
    } 
  });
  if (!env) {
    res.status(404).json({ message: 'Envelope not found' });
    return;
  }
  if (env.status !== DRAFT) {
    res.status(400).json({ message: 'Cannot modify non-draft envelope' });
    return;
  }

  const field = await prisma.documentField.findFirst({
    where: { 
      id: req.params['fieldId'],
      envelopeId: env.id 
    }
  });
  if (!field) {
    res.status(404).json({ message: 'Field not found' });
    return;
  }

  await prisma.documentField.delete({ where: { id: field.id } });

  await prisma.auditLog.create({
    data: {
      envelopeId: env.id,
      event: 'FIELD_DELETED',
      actorEmail: req.user!.email,
      details: {
        fieldId: field.id,
        type: field.type,
        signerId: field.signerId
      }
    }
  });

  res.status(204).send();
});

export default router;