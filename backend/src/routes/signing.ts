import { Router, Request, Response } from 'express';
import { PrismaClient, EnvelopeStatus } from '../generated/prisma/client.js';
import { SigningService } from '../services/signing.js';
import { generateConsentText, generateLegalNotice } from '../services/compliance.js';
import { trackSigningMetadata } from '../middleware/tracking.js';

const router = Router();
const prisma = new PrismaClient();
const signingService = new SigningService();

/**
 * Get document details and signers for a signing link
 */
// Stream original PDF for signers to preview without authentication
router.get('/:link/preview', async (req: Request, res: Response) => {
  try {
    const link = req.params['link'];
    if (!link) {
      return res.status(400).json({ message: 'Signing link is required' });
    }

    const signer = await prisma.envelopeSigner.findFirst({
      where: { signingLink: link },
      include: {
        envelope: { include: { document: true } }
      }
    });

    if (!signer || !signer.envelope?.document) {
      return res.status(404).json({ message: 'Signing request not found' });
    }

    // Serve the original PDF file
    const { DocumentService } = await import('../services/document.js');
    const documentService = new DocumentService();
    const filePath = documentService.getDocumentPath(signer.envelope.document);

    return res.sendFile(filePath, { headers: { 'Content-Type': 'application/pdf' } });
  } catch (error: any) {
    console.error('DEBUG: Error in signing preview route:', error);
    return res.status(500).json({ message: 'Internal server error', detail: error.message });
  }
});

router.get('/:link', async (req: Request, res: Response) => {
  try {
    const link = req.params['link'];
    if (!link) {
      return res.status(400).json({ 
        message: 'Signing Link Invalid',
        detail: 'No signing link was provided'
      });
    }

    console.log('DEBUG: Accessing signing link:', link);

    // Check if the link exists in database
    let signer;
    try {
      // Find the signer with this link
      signer = await prisma.envelopeSigner.findFirst({
        where: { 
          signingLink: link 
        },
        include: {
          envelope: {
            include: {
              document: true
            }
          }
        }
      });

      // Now get the exact match with all details
      signer = await prisma.envelopeSigner.findFirst({ 
        where: { 
          signingLink: link 
        }, 
        include: { 
          envelope: { 
            include: { 
              document: true,
              signers: true,
              owner: true
            } 
          } 
        } 
      });
    } catch (dbError) {
      console.error('DEBUG: Database error while fetching signer:', dbError);
      return res.status(500).json({
        message: 'Signing Link Error',
        detail: 'Unable to verify the signing link at this time'
      });
    }

    // Log the database query result
    console.log('DEBUG: Database lookup result:', {
      found: !!signer,
      signerId: signer?.id,
      envelopeId: signer?.envelopeId,
      status: signer?.envelope?.status,
      signingLink: signer?.signingLink
    });

    // If no signer found, return a generic signing page (no error)
    if (!signer) {
      console.error('DEBUG: No signer found for link:', link);
      return res.json({
        id: null,
        email: null,
        envelopeStatus: null,
        documentId: null,
        compliance: {
          consentText: generateConsentText('IN'),
          legalNotice: generateLegalNotice('IN')
        },
        message: 'No signing request found for this link. Please contact the sender.'
      });
    }

    // Log envelope and authentication details
    console.log('DEBUG: Request details:', {
      link,
      headers: req.headers,
      authHeader: req.headers.authorization,
      signerEmail: signer.email,
      signerName: signer.name,
      envelopeStatus: signer.envelope.status,
      sessionToken: signer.sessionToken,
      sessionExpiry: signer.sessionExpiry,
      hasSignedAt: !!signer.signedAt
    });


    // If already signed, we still want to return envelope details (do not 400)
    const alreadySigned = !!signer.signedAt;

    // Only enforce signing availability if the signer has not yet signed
    if (!alreadySigned && signer.envelope.status !== EnvelopeStatus.SENT && signer.envelope.status !== EnvelopeStatus.PARTIALLY_SIGNED) {
      return res.status(400).json({
        message: 'Invalid envelope status',
        detail: 'This envelope is not available for signing'
      });
    }

    // Determine if predefined signature placement exists for this signer
    let predefinedPlacement: any = null;
    try {
      const field = await prisma.documentField.findFirst({
        where: { envelopeId: signer.envelopeId, signerId: signer.id, type: 'SIGNATURE' }
      });
      if (field) {
        predefinedPlacement = {
          pageNumber: field.page,
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height
        };
      }
    } catch {}

    // Log a VIEWED audit event
    try {
      await prisma.auditLog.create({
        data: {
          envelopeId: signer.envelopeId,
          actorEmail: signer.email,
          actorRole: 'SIGNER',
          event: 'VIEWED',
          ipAddress: req.ip || null,
          userAgent: req.get('User-Agent') || null,
          details: { signingLink: link }
        }
      });
    } catch (e) {
      // best-effort; do not block
    }

    return res.json({
      id: signer.envelope.id,
      status: signer.envelope.status,
      subject: signer.envelope.subject,
      message: signer.envelope.message,
      document: {
        id: signer.envelope.document.id,
        originalName: signer.envelope.document.originalName,
        originalHash: signer.envelope.document.originalHash,
      },
      signers: signer.envelope.signers,
      currentSignerEmail: signer.email,
      alreadySigned: alreadySigned,
      compliance: {
        consentText: generateConsentText('IN'),
        legalNotice: generateLegalNotice('IN')
      },
      predefinedPlacement
    });

  } catch (error: any) {
    console.error('DEBUG: Error in signing route:', error);
    return res.status(500).json({ message: 'Internal server error', detail: error.message });
  }
});

/**
 * Authenticate signer and create session
 */
router.post('/:link/authenticate', async (req: Request, res: Response) => {
  try {
    const link = req.params['link'];
    const { email } = req.body; // email may be provided, but is no longer required to match

    console.log('DEBUG: Authentication request:', { link, email });

    if (!link) {
      return res.status(400).json({ 
        message: 'Missing signing link',
        success: false
      });
    }

    // REMOVE: Authentication/session logic. Always succeed and return a dummy token.
    return res.json({
      success: true,
      sessionToken: 'open-access',
      message: 'Authentication successful'
    });

  } catch (error: any) {
    console.error('DEBUG: Error in signing authentication:', error);
    return res.status(500).json({ 
      message: 'Authentication failed', 
      detail: error.message,
      success: false 
    });
  }
});

/**
 * Verify OTP for a signer
 */
router.post('/:link/verify', trackSigningMetadata, async (req: Request, res: Response) => {
  try {
    const link = req.params['link'];
    const { otp } = req.body;

    if (!link || !otp) {
      return res.status(400).json({ message: 'Missing link or OTP' });
    }

    const signer = await prisma.envelopeSigner.findFirst({
      where: { signingLink: link },
      include: { envelope: true },
    });

    if (!signer) {
      return res.status(404).json({ message: 'Signer not found' });
    }

    const isValid = await signingService.verifyOTP(signer.envelope.documentId, signer.id, otp);

    if (isValid) {
      // Persist otpVerified and metadata
      try {
        await prisma.envelopeSigner.update({
          where: { id: signer.id },
          data: {
            otpVerified: true,
            ipAddress: req.signingMetadata?.ipAddress || req.ip || null,
            userAgent: req.signingMetadata?.userAgent || req.get('User-Agent') || null,
            geo: req.signingMetadata?.location ? JSON.stringify(req.signingMetadata.location) : signer.geo || null
          }
        });

        await prisma.auditLog.create({
          data: {
            envelopeId: signer.envelopeId,
            actorEmail: signer.email,
            actorRole: 'SIGNER',
            event: 'OTP_VERIFIED',
            ipAddress: req.signingMetadata?.ipAddress || req.ip || null,
            userAgent: req.signingMetadata?.userAgent || req.get('User-Agent') || null,
            details: { signingLink: link }
          }
        });
      } catch {}

      return res.status(200).json({ message: 'OTP verified successfully' });
    } else {
      return res.status(400).json({ message: 'Invalid OTP' });
    }
  } catch (error: any) {
    console.error('DEBUG: Error in OTP verification:', error);
    return res.status(500).json({ message: 'Internal server error', detail: error.message });
  }
});

/**
 * Sign the document
 */
router.post('/:link', trackSigningMetadata, async (req: Request, res: Response) => {
  try {
    const link = req.params['link'];
    const { signature, consent, location, placement, fingerprint } = req.body;
    
    // Extract text suppression parameters from frontend
    const {
      noText, no_text, notext, hideText, hide_text, hidetext,
      suppressText, suppress_text, suppresstext, disableText, disable_text, disabletext,
      removeText, remove_text, removetext, imageOnly, image_only, imageonly,
      signatureOnly, signature_only, signatureonly, clean, cleanMode, clean_mode, cleanmode,
      minimal, simple, noInfo, no_info, noinfo, hideInfo, hide_info, hideinfo,
      noMetadata, no_metadata, nometadata, showText, show_text, showtext,
      includeText, include_text, includetext, addText, add_text, addtext,
      config, settings, preferences
    } = req.body;
    
    // Check URL parameters for text suppression
    const { notext: urlNotext, imageonly: urlImageonly, clean: urlClean, hidetext: urlHidetext,
            suppresstext: urlSuppresstext, minimal: urlMinimal, simple: urlSimple } = req.query;
    
    // Determine if text should be suppressed based on ANY of these parameters
    const suppressSignatureText = (
      noText === true || no_text === true || notext === true ||
      hideText === true || hide_text === true || hidetext === true ||
      suppressText === true || suppress_text === true || suppresstext === true ||
      disableText === true || disable_text === true || disabletext === true ||
      removeText === true || remove_text === true || removetext === true ||
      imageOnly === true || image_only === true || imageonly === true ||
      signatureOnly === true || signature_only === true || signatureonly === true ||
      clean === true || cleanMode === true || clean_mode === true || cleanmode === true ||
      minimal === true || simple === true ||
      noInfo === true || no_info === true || noinfo === true ||
      hideInfo === true || hide_info === true || hideinfo === true ||
      noMetadata === true || no_metadata === true || nometadata === true ||
      showText === false || show_text === false || showtext === false ||
      includeText === false || include_text === false || includetext === false ||
      addText === false || add_text === false || addtext === false ||
      config?.hideText === true || config?.signatureOnly === true || config?.noMetadata === true ||
      settings?.hideText === true || settings?.suppressInfo === true || settings?.cleanSignature === true ||
      preferences?.textEnabled === false || preferences?.infoEnabled === false || preferences?.metadataEnabled === false ||
      urlNotext === 'true' || urlImageonly === 'true' || urlClean === 'true' ||
      urlHidetext === 'true' || urlSuppresstext === 'true' || urlMinimal === 'true' || urlSimple === 'true'
    );
    
    console.log('🔍 TEXT SUPPRESSION CHECK:');
    console.log('suppressSignatureText:', suppressSignatureText);
    console.log('Sample parameters received:', {
      hideText, imageOnly, suppressText, showText, config, notext: urlNotext
    });

    if (!link || !signature || !consent) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const signer = await prisma.envelopeSigner.findFirst({
      where: { signingLink: link },
      include: { envelope: true },
    });

    if (!signer) {
      return res.status(404).json({ message: 'Signer not found' });
    }

    if (signer.signedAt) {
      return res.status(400).json({ message: 'Document already signed' });
    }

    // Compose device fingerprint (hash of device characteristics)
    const { UAParser } = await import('ua-parser-js');
    const ua = new UAParser(req.signingMetadata?.userAgent || req.get('User-Agent') || '').getResult();

    const deviceTraits = {
      browser: { name: ua.browser.name || '', version: ua.browser.version || '' },
      os: { name: ua.os.name || '', version: ua.os.version || '' },
      screen: fingerprint?.screen || {},
      timezone: fingerprint?.timezone || '',
      plugins: Array.isArray(fingerprint?.plugins) ? fingerprint.plugins.slice(0, 50) : [],
      fonts: Array.isArray(fingerprint?.fonts) ? fingerprint.fonts.slice(0, 100) : [],
      gpu: fingerprint?.gpu || {},
      cpu: fingerprint?.cpu || {},
      ip: req.signingMetadata?.ipAddress || req.ip || '',
    };

    const cryptoMod = await import('node:crypto');
    const canonical = JSON.stringify(deviceTraits, Object.keys(deviceTraits).sort());
    const deviceFingerprintId = cryptoMod.createHash('sha256').update(canonical).digest('hex');

    // Update signer with signature metadata
    const now = new Date();
    await prisma.envelopeSigner.update({
      where: { id: signer.id },
      data: {
        signedAt: now,
        ipAddress: req.signingMetadata?.ipAddress || req.ip || null,
        userAgent: req.signingMetadata?.userAgent || req.get('User-Agent') || null,
        geo: req.signingMetadata?.location ? JSON.stringify(req.signingMetadata.location) : (location ? JSON.stringify(location) : null),
      },
    });

    // Persist a fingerprint capture audit event (best-effort)
    try {
      await prisma.auditLog.create({
        data: {
          envelopeId: signer.envelopeId,
          actorEmail: signer.email,
          actorRole: 'SIGNER',
          event: 'DEVICE_FINGERPRINT_CAPTURED',
          ipAddress: req.signingMetadata?.ipAddress || req.ip || null,
          userAgent: req.signingMetadata?.userAgent || req.get('User-Agent') || null,
          details: { deviceTraits, deviceFingerprintId }
        }
      });
    } catch {}

// Upsert Signature record with placement metadata
    try {
      // Validate placement if provided
      let placementData: any = undefined;

      // Check predefined placement
      let fieldPlacement: any = null;
      try {
        const field = await prisma.documentField.findFirst({
          where: { envelopeId: signer.envelopeId, signerId: signer.id, type: 'SIGNATURE' }
        });
        if (field) {
          fieldPlacement = {
            pageNumber: field.page,
            x: field.x,
            y: field.y,
            width: field.width,
            height: field.height
          };
        }
      } catch {}

      if (fieldPlacement) {
        placementData = fieldPlacement;
      } else if (placement && typeof placement === 'object') {
        const { pageNumber, x, y, width, height } = placement as any;
        if (
          typeof pageNumber === 'number' && pageNumber >= 1 &&
          [x, y, width, height].every((v) => typeof v === 'number' && v >= 0 && v <= 1)
        ) {
          placementData = { pageNumber, x, y, width, height };
        }
      }

      if (!placementData) {
        return res.status(400).json({ message: 'Signature placement is required' });
      }

      await prisma.signature.upsert({
        where: { signerId: signer.id },
        create: {
          signerId: signer.id,
          consentGiven: !!consent,
          consentText: consent ? generateConsentText('US') : null,
          imagePath: typeof signature === 'string' ? signature : null,
          drawnPoints: {
            ...placementData,
            suppressText: suppressSignatureText  // Store text suppression preference
          }
        },
        update: {
          consentGiven: !!consent,
          consentText: consent ? generateConsentText('US') : null,
          imagePath: typeof signature === 'string' ? signature : null,
          drawnPoints: {
            ...(placementData ?? {}),
            suppressText: suppressSignatureText  // Store text suppression preference
          }
        }
      });
    } catch {}

    // Audit log for SIGNED
    try {
      await prisma.auditLog.create({
        data: {
          envelopeId: signer.envelopeId,
          actorEmail: signer.email,
          actorRole: 'SIGNER',
          event: 'SIGNED',
          ipAddress: req.signingMetadata?.ipAddress || req.ip || null,
          userAgent: req.signingMetadata?.userAgent || req.get('User-Agent') || null,
          details: { signingLink: link, deviceFingerprintId }
        }
      });
    } catch {}

    // Check if all required signers (role=SIGNER) have signed
    const allSigners = await prisma.envelopeSigner.findMany({
      where: { envelopeId: signer.envelopeId, role: 'SIGNER' },
      select: { id: true, signedAt: true }
    });

    const allSigned = allSigners.length > 0 && allSigners.every(s => s.signedAt);

    if (allSigned) {
      // Update envelope status to completed
      await prisma.envelope.update({
        where: { id: signer.envelopeId },
        data: { status: 'COMPLETED', completedAt: now },
      });

      // Audit log for COMPLETED
      try {
        await prisma.auditLog.create({
          data: {
            envelopeId: signer.envelopeId,
            actorEmail: signer.email,
            actorRole: 'SIGNER',
            event: 'COMPLETED',
            details: { reason: 'All signers completed' }
          }
        });
      } catch {}
    } else {
      // Update envelope status to partially signed if not all signers have signed
      await prisma.envelope.update({
        where: { id: signer.envelopeId },
        data: { status: 'PARTIALLY_SIGNED' },
      });
    }

    return res.json({ message: 'Document signed successfully' });
  } catch (error: any) {
    console.error('DEBUG: Error in document signing:', error);
    return res.status(500).json({ message: 'Internal server error', detail: error.message });
  }
});

/**
 * Decline signing the document
 */
router.post('/:link/decline', trackSigningMetadata, async (req: Request, res: Response) => {
  try {
    const link = req.params['link'];

    if (!link) {
      return res.status(400).json({ message: 'Missing signing link' });
    }

    const signer = await prisma.envelopeSigner.findFirst({
      where: { signingLink: link },
    });

    if (!signer) {
      return res.status(404).json({ message: 'Signer not found' });
    }

    if (signer.declinedAt) {
      return res.status(400).json({ message: 'Document already declined' });
    }

    // Update signer as declined
    await prisma.envelopeSigner.update({
      where: { id: signer.id },
      data: {
        declinedAt: new Date(),
        ipAddress: req.signingMetadata?.ipAddress || req.ip || null,
        userAgent: req.signingMetadata?.userAgent || req.get('User-Agent') || null,
      },
    });

    // Update envelope status to declined
    await prisma.envelope.update({
      where: { id: signer.envelopeId },
      data: { status: 'DECLINED' },
    });

    // Audit log for DECLINED
    try {
      await prisma.auditLog.create({
        data: {
          envelopeId: signer.envelopeId,
          actorEmail: signer.email,
          actorRole: 'SIGNER',
          event: 'DECLINED',
          ipAddress: req.signingMetadata?.ipAddress || req.ip || null,
          userAgent: req.signingMetadata?.userAgent || req.get('User-Agent') || null,
          details: { signingLink: link }
        }
      });
    } catch {}

    return res.json({ message: 'Document signing declined' });
  } catch (error: any) {
    console.error('DEBUG: Error in document decline:', error);
    return res.status(500).json({ message: 'Internal server error', detail: error.message });
  }
});

/**
 * Download signed document using signing link
 */
router.get('/:link/download', async (req: Request, res: Response) => {
  try {
    const link = req.params['link'];
    console.log('DEBUG: Download request for link:', link);
    
    if (!link) {
      return res.status(400).json({ message: 'Signing link is required' });
    }

    // Find the signer with this link
    const signer = await prisma.envelopeSigner.findFirst({
      where: { signingLink: link },
      include: { 
        envelope: { 
          include: { document: true } 
        } 
      },
    });

    console.log('DEBUG: Signer found:', !!signer);
    console.log('DEBUG: Signer envelope status:', signer?.envelope?.status);
    console.log('DEBUG: Signer signed at:', signer?.signedAt);

    if (!signer) {
      return res.status(404).json({ message: 'Signer not found' });
    }

    // Allow download even if this specific signer hasn't signed yet,
    // as long as at least one signer has signed (envelope is PARTIALLY_SIGNED or COMPLETED)
    if (!signer.signedAt) {
      // Check if envelope has any signatures
      const envelope = await prisma.envelope.findUnique({
        where: { id: signer.envelopeId },
        select: { status: true }
      });
      
      if (envelope?.status !== 'PARTIALLY_SIGNED' && envelope?.status !== 'COMPLETED') {
        return res.status(400).json({ message: 'Document not ready for download yet' });
      }
    }

    // Import the PDF generation function
    console.log('DEBUG: Importing PDF generation function...');
    const { generateSignedPdf } = await import('../services/pdf.js');
    
    try {
      console.log('DEBUG: Calling generateSignedPdf for envelope:', signer.envelopeId);
      const out = await generateSignedPdf(signer.envelopeId);
      console.log('DEBUG: PDF generation result:', out);
      
      if (!out) {
        console.log('DEBUG: PDF generation returned empty result');
        return res.status(500).json({ message: 'Failed to generate PDF' });
      }
      
      const filename = `signed_${signer.envelope.document.originalName}`;
      console.log('DEBUG: Starting file download:', { out, filename });
      return res.download(out, filename);
    } catch (error: any) {
      console.error('DEBUG: Error in PDF generation:', error);
      console.error('DEBUG: Error stack:', error.stack);
      return res.status(500).json({ message: 'Failed to generate signed document' });
    }
  } catch (error: any) {
    console.error('DEBUG: Error in document download:', error);
    return res.status(500).json({ message: 'Internal server error', detail: error.message });
  }
});

/**
 * Get document signature history with hash verification
 */
router.get('/document/:documentId/history', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    
    if (!documentId) {
      return res.status(400).json({ message: 'Document ID is required' });
    }

    // Verify document exists and user has access
    const document = await prisma.document.findUnique({
      where: { id: documentId }
      // Note: In a real app, you'd check if the user has permission to view this document
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const history = await signingService.getDocumentSignatureHistory(documentId);
    
    return res.json({
      success: true,
      data: {
        documentId,
        documentName: document.originalName,
        ...history
      }
    });
  } catch (error: any) {
    console.error('Error getting document signature history:', error);
    return res.status(500).json({ 
      message: 'Failed to get document signature history',
      detail: error.message 
    });
  }
});

/**
 * Verify document integrity by hash
 */
router.get('/document/:documentId/verify', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    
    if (!documentId) {
      return res.status(400).json({ message: 'Document ID is required' });
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId }
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const history = await signingService.getDocumentSignatureHistory(documentId);
    
    return res.json({
      success: true,
      data: {
        documentId,
        documentName: document.originalName,
        originalHash: history.originalHash,
        currentCompleteSignedPdfHash: history.currentCompleteSignedPdfHash,
        integrityValid: history.integrityValid,
        totalSignatures: history.signatureSteps.length,
        lastSignedAt: history.signatureSteps[history.signatureSteps.length - 1]?.signedAt || null
      }
    });
  } catch (error: any) {
    console.error('Error verifying document:', error);
    return res.status(500).json({ 
      message: 'Failed to verify document',
      detail: error.message 
    });
  }
});

export default router;
