import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { PrismaClient, EnvelopeStatus } from '../generated/prisma/client.js';
import { generateSignedPdf } from '../services/pdf.js';
import { generateCompletionCertificate } from '../services/certificate.js';
import fs from 'node:fs';
import path from 'node:path';

const prisma = new PrismaClient();
const router = Router();

// Get audit logs for an envelope
router.get('/envelopes/:id/audit', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ message: 'Envelope ID is required' });
  }
  const env = await prisma.envelope.findFirst({ 
    where: { id, ownerId: req.user!.id }, 
    include: { 
      auditLogs: {
        orderBy: { timestamp: 'desc' }
      }
    } 
  });
  if (!env) return res.status(404).json({ message: 'Envelope not found' });
  return res.json(env.auditLogs);
});

// Download completion certificate
router.get('/envelopes/:id/certificate', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ message: 'Envelope ID is required' });
  }
  const env = await prisma.envelope.findFirst({ where: { id, ownerId: req.user!.id } });
  if (!env) return res.status(404).json({ message: 'Envelope not found' });
  if (env.status !== EnvelopeStatus.COMPLETED && env.status !== EnvelopeStatus.PARTIALLY_SIGNED) {
    return res.status(400).json({ message: 'Envelope not ready for download' });
  }
  
  try {
    const certificatePath = await generateCompletionCertificate(env.id);
    if (!fs.existsSync(certificatePath)) return res.status(500).json({ message: 'Failed to generate certificate' });
    
    const filename = `completion_certificate_${env.id}.pdf`;
    return res.download(certificatePath, filename);
  } catch (error) {
    console.error('Error generating completion certificate:', error);
    return res.status(500).json({ message: 'Failed to generate completion certificate' });
  }
});

// Public download for completed envelopes (for signers)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ message: 'Envelope ID is required' });
  }
    const env = await prisma.envelope.findFirst({ 
    where: { id },
    include: { 
      document: {
        include: {
          signatureHistory: {
            orderBy: { signatureStep: 'desc' },
            take: 1
          }
        }
      }
    }
  });
  if (!env) return res.status(404).json({ message: 'Envelope not found' });
  if (env.status !== EnvelopeStatus.COMPLETED && env.status !== EnvelopeStatus.PARTIALLY_SIGNED) {
    return res.status(400).json({ message: 'Envelope not ready for download' });
  }
  
  try {
    // Get the actual complete signed PDF file
    if (!env.document.signedPdfPath) {
      // Fallback to PDF generation if no signed PDF exists
      const out = await generateSignedPdf(env.id);
      if (!fs.existsSync(out)) return res.status(500).json({ message: 'Failed to generate PDF' });
      const filename = `signed_${env.document.originalName}`;
      return res.download(out, filename);
    }

    // Use the actual complete signed PDF file that was stored during signing
    // Handle the path correctly - signed PDFs are stored in signed/ directory
    let signedFilePath;
    
    // Try direct path first (relative to project root)
    if (env.document.signedPdfPath.startsWith('signed/')) {
      signedFilePath = path.join(process.cwd(), env.document.signedPdfPath);
    } else {
      // Legacy fallback for old paths
      signedFilePath = path.join(process.cwd(), 'uploads', env.document.signedPdfPath);
    }
    
    console.log(`🔍 Looking for signed PDF at: ${signedFilePath}`);
    
    // Additional fallback paths in case of path issues
    if (!fs.existsSync(signedFilePath)) {
      const fallbackPaths = [
        path.join(process.cwd(), 'signed', path.basename(env.document.signedPdfPath)),
        path.join(process.cwd(), env.document.signedPdfPath)
      ];
      
      let found = false;
      for (const fallbackPath of fallbackPaths) {
        console.log(`🔄 Trying fallback path: ${fallbackPath}`);
        if (fs.existsSync(fallbackPath)) {
          signedFilePath = fallbackPath;
          found = true;
          console.log(`✅ Found signed PDF at fallback location`);
          break;
        }
      }
      
      if (!found) {
        console.error(`❌ Complete signed PDF not found at any location:`);
        console.error(`   - Primary: ${signedFilePath}`);
        fallbackPaths.forEach(fp => console.error(`   - Fallback: ${fp}`));
        return res.status(500).json({ message: 'Complete signed PDF file not found' });
      }
    }
    
    const filename = `signed_${env.document.originalName}`;
    const latestStep = env.document.signatureHistory[0];
    
    // Add complete signed PDF hash to response headers
    res.setHeader('X-Document-Hash', env.document.completeSignedPdfHash || 'unknown');
    res.setHeader('X-Document-Hash-Algorithm', 'SHA-256');
    res.setHeader('X-Document-Hash-Type', 'Complete-Signed-PDF');
    res.setHeader('X-Signature-Step', latestStep?.signatureStep || '0');
    res.setHeader('X-Document-ID', env.document.id);
    
    console.log(`📄 Serving complete signed PDF: ${filename}`);
    console.log(`🔐 Complete Signed PDF Hash: ${env.document.completeSignedPdfHash}`);
    console.log(`📊 Signature Steps: ${env.document.signatureHistory.length}`);
    
    return res.download(signedFilePath, filename);
  } catch (error) {
    console.error('Error serving signed document:', error);
    return res.status(500).json({ message: 'Failed to serve signed document' });
  }
});

// Authenticated download for envelope owners
router.get('/envelopes/:id/pdf', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ message: 'Envelope ID is required' });
  }
  const env = await prisma.envelope.findFirst({
    where: { id, ownerId: req.user!.id },
    include: { 
      document: {
        include: {
          signatureHistory: {
            orderBy: { signatureStep: 'desc' },
            take: 1
          }
        }
      }
    }
  });
  if (!env) return res.status(404).json({ message: 'Envelope not found' });
  if (env.status !== EnvelopeStatus.COMPLETED && env.status !== EnvelopeStatus.PARTIALLY_SIGNED) {
    return res.status(400).json({ message: 'Envelope not ready for download' });
  }
  
  try {
    // Get the actual complete signed PDF file
    if (!env.document.signedPdfPath) {
      // Fallback to PDF generation if no signed PDF exists
      const out = await generateSignedPdf(env.id);
      if (!fs.existsSync(out)) return res.status(500).json({ message: 'Failed to generate PDF' });
      const filename = `signed_${env.document.originalName}`;
      return res.download(out, filename);
    }

    // Use the actual complete signed PDF file
    // Handle the path correctly - signed PDFs are stored in signed/ directory
    let signedFilePath;
    
    // Try direct path first (relative to project root)
    if (env.document.signedPdfPath.startsWith('signed/')) {
      signedFilePath = path.join(process.cwd(), env.document.signedPdfPath);
    } else {
      // Legacy fallback for old paths
      signedFilePath = path.join(process.cwd(), 'uploads', env.document.signedPdfPath);
    }
    
    console.log(`🔍 Looking for envelope PDF at: ${signedFilePath}`);
    
    // Additional fallback paths in case of path issues
    if (!fs.existsSync(signedFilePath)) {
      const fallbackPaths = [
        path.join(process.cwd(), 'signed', path.basename(env.document.signedPdfPath)),
        path.join(process.cwd(), env.document.signedPdfPath)
      ];
      
      let found = false;
      for (const fallbackPath of fallbackPaths) {
        console.log(`🔄 Trying fallback path: ${fallbackPath}`);
        if (fs.existsSync(fallbackPath)) {
          signedFilePath = fallbackPath;
          found = true;
          console.log(`✅ Found envelope PDF at fallback location`);
          break;
        }
      }
      
      if (!found) {
        console.error(`❌ Envelope PDF not found at any location:`);
        console.error(`   - Primary: ${signedFilePath}`);
        fallbackPaths.forEach(fp => console.error(`   - Fallback: ${fp}`));
        return res.status(404).json({ message: 'Signed PDF not found' });
      }
    }
    
    const filename = `signed_${env.document.originalName}`;
    const latestStep = env.document.signatureHistory[0];
    
    // Add complete signed PDF hash to response headers  
    res.setHeader('X-Document-Hash', env.document.completeSignedPdfHash || 'unknown');
    res.setHeader('X-Document-Hash-Algorithm', 'SHA-256');
    res.setHeader('X-Document-Hash-Type', 'Complete-Signed-PDF');
    res.setHeader('X-Signature-Step', latestStep?.signatureStep || '0');
    res.setHeader('X-Document-ID', env.document.id);
    
    console.log(`📄 Serving complete signed PDF (authenticated): ${filename}`);
    console.log(`🔐 Complete Signed PDF Hash: ${env.document.completeSignedPdfHash}`);
    console.log(`📊 Signature Steps: ${env.document.signatureHistory.length}`);
    
    return res.download(signedFilePath, filename);
  } catch (error) {
    console.error('Error serving signed document:', error);
    return res.status(500).json({ message: 'Failed to serve signed document' });
  }
});

// Get document hash and metadata information
router.get('/envelopes/:id/info', async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ message: 'Envelope ID is required' });
  }
  
  const env = await prisma.envelope.findFirst({
    where: { id },
    include: {
      document: {
        include: {
          signatureHistory: {
            orderBy: { signatureStep: 'asc' }
          }
        }
      },
      signers: {
        where: { signedAt: { not: null } },
        orderBy: { signedAt: 'asc' }
      }
    }
  });
  
  if (!env) return res.status(404).json({ message: 'Envelope not found' });
  
  // Verify current hash of the complete signed PDF file
  let currentFileHash = null;
  let fileExists = false;
  if (env.document.signedPdfPath) {
    try {
      const { DocumentService } = await import('../services/document.js');
      const { computeStreamHash } = await import('../utils/hash.js');
      const documentService = new DocumentService();
      const signedFilePath = documentService.getSignedDocumentPath(env.document.signedPdfPath);
      
      if (fs.existsSync(signedFilePath)) {
        fileExists = true;
        currentFileHash = await computeStreamHash(signedFilePath);
      }
    } catch (error) {
      console.error('Error computing current file hash:', error);
    }
  }
  
  return res.json({
    success: true,
    data: {
      envelopeId: env.id,
      documentId: env.document.id,
      documentName: env.document.originalName,
      status: env.status,
      hashes: {
        original: env.document.originalHash,
        completeSignedPdf: env.document.completeSignedPdfHash,
        currentFile: currentFileHash,
        algorithm: 'SHA-256',
        type: 'Complete-Signed-PDF'
      },
      verification: {
        fileExists,
        hashMatches: currentFileHash === env.document.completeSignedPdfHash,
        integrityValid: fileExists && (currentFileHash === env.document.completeSignedPdfHash)
      },
      signatures: {
        total: env.signers.length,
        steps: env.document.signatureHistory.length,
        history: env.document.signatureHistory.map((step) => ({
          step: step.signatureStep,
          signerName: step.signerName,
          signerEmail: step.signerEmail,
          signedAt: step.signedAt,
          completeSignedPdfHash: step.completeSignedPdfHash
        }))
      },
      timestamps: {
        created: env.createdAt,
        completed: env.completedAt
      }
    }
  });
});

export default router;


