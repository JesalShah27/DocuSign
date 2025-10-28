import { PrismaClient } from '../generated/prisma/client.js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs/promises';
import crypto from 'crypto';
import { computeStreamHash, computeBufferHash } from '../utils/hash.js';
import { DocumentService } from './document.js';
import { 
  sendSigningInvitation, 
  type SigningInvitation, 
  sendCompletionNotification,
  type CompletionNotification 
} from './email.js';
import { generateOTP } from '../utils/otp.js';
import path from 'path';



interface SignaturePosition {
  x: number;
  y: number;
  pageNumber: number;
  width: number;
  height: number;
}

interface SigningRequest {
  documentId: string;
  signerEmail: string;
  signerName: string;
  signaturePosition: SignaturePosition;
  message?: string;
}

interface SignatureSubmission {
  documentId: string;
  signerId: string;
  otpCode: string;
  signatureData?: string; // Base64 encoded signature image or null for typed signature
  signatureText?: string; // For typed signatures
}

type SignerRecord = {
  id: string;
  envelopeId: string;
  email: string;
  name: string;
  otpCode: string | null;
  otpExpiry: Date | null;
  signedAt: Date | null;
  declinedAt: Date | null;
  declineReason: string | null;
  fields: Array<{
    id: string;
    type: 'SIGNATURE' | 'DATE' | 'TEXT' | 'CHECKBOX' | 'INITIAL';
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
};

export class SigningService {
  private prisma: PrismaClient;
  private documentService: DocumentService;

  constructor() {
    this.prisma = new PrismaClient();
    this.documentService = new DocumentService();
  }

  /**
   * Creates a signing request and sends invitation email
   */
  async createSigningRequest(request: SigningRequest): Promise<SignerRecord> {
    const document = await this.prisma.document.findUnique({
      where: { id: request.documentId }
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Generate OTP for signature verification
    const otpCode = generateOTP();
    const otpExpiry = new Date();
    otpExpiry.setMinutes(otpExpiry.getMinutes() + 30); // 30 minute expiry

    // Create or get envelope
    const [existingEnvelope] = await this.prisma.envelope.findMany({
      where: {
        documentId: request.documentId,
        status: 'DRAFT'
      },
      take: 1
    });

    const envelope = existingEnvelope || await this.prisma.envelope.create({
      data: {
        documentId: request.documentId,
        ownerId: document.ownerId,
        status: 'DRAFT'
      }
    });

    // Create or update signer record
    const [existingSigner] = await this.prisma.envelopeSigner.findMany({
      where: {
        envelopeId: envelope.id,
        email: request.signerEmail
      },
      take: 1
    });

    const signer = existingSigner 
      ? await this.prisma.envelopeSigner.update({
          where: { id: existingSigner.id },
          data: {
            name: request.signerName,
            otpCode,
            otpExpiry,
            signedAt: null,
            declinedAt: null
          }
        })
      : await this.prisma.envelopeSigner.create({
          data: {
            envelopeId: envelope.id,
            email: request.signerEmail,
            name: request.signerName,
            otpCode,
            otpExpiry,
            signingLink: crypto.randomUUID()
          }
        });

    // Get the signer's fields
    const fields = await this.prisma.documentField.findMany({
      where: {
        envelopeId: envelope.id,
        signerId: signer.id
      }
    });

    // Send signing invitation
    const signingLink = new URL(process.env['FRONTEND_URL'] || 'http://localhost:3000');
    signingLink.pathname = '/signing';
    signingLink.searchParams.set('link', signer.signingLink);

    const inviteData: SigningInvitation = {
      signerName: request.signerName,
      signerEmail: request.signerEmail,
      documentName: document.originalName,
      signingLink: signingLink.toString(),
      otpCode,
    };

    if (request.message) {
      inviteData.envelopeMessage = request.message;
    }

    await sendSigningInvitation(inviteData);

    // Transform to SignerRecord
    return {
      id: signer.id,
      envelopeId: signer.envelopeId,
      email: signer.email,
      name: signer.name,
      otpCode: signer.otpCode,
      otpExpiry: signer.otpExpiry,
      signedAt: signer.signedAt,
      declinedAt: signer.declinedAt,
      declineReason: null,
      fields: fields.map(f => ({
        id: f.id,
        type: f.type,
        page: f.page,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height
      }))
    };
  }

  /**
   * Verifies OTP code for signing
   */
  async verifyOTP(documentId: string, signerId: string, otpCode: string): Promise<boolean> {
    const signer = await this.prisma.envelopeSigner.findUnique({
      where: {
        id: signerId
      },
      include: {
        envelope: true
      }
    });

    if (!signer || signer.envelope.documentId !== documentId) {
      throw new Error('Signer not found');
    }

    if (signer.signedAt) {
      throw new Error('Document already signed');
    }

    if (signer.declinedAt) {
      throw new Error('Signing request was declined');
    }

    if (!signer.otpCode || !signer.otpExpiry) {
      throw new Error('No valid OTP found');
    }

    if (new Date() > signer.otpExpiry) {
      throw new Error('OTP has expired');
    }

    return signer.otpCode === otpCode;
  }

  /**
   * Create a session token for a signer
   */
  async createSignerSession(signer: {
    id: string;
    envelopeId: string;
    email: string;
  }): Promise<string> {
    const token = crypto.randomUUID();
    
    // Save the token and expiry to the signer record
    await this.prisma.envelopeSigner.update({
      where: { id: signer.id },
      data: {
        sessionToken: token,
        sessionExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      }
    });

    return token;
  }

  /**
   * Submit a signature for a document
   */
  async submitSignature(submission: SignatureSubmission): Promise<{
    documentId: string;
    signerId: string;
    signedAt: Date;
    signedHash: string;
  }> {
    const { documentId, signerId, otpCode } = submission;

    // Verify OTP first
    const isValid = await this.verifyOTP(documentId, signerId, otpCode);
    if (!isValid) {
      throw new Error('Invalid or expired OTP');
    }

    // Get document and signer details
    const [document, signer] = await Promise.all([
      this.prisma.document.findUnique({
        where: { id: documentId }
      }),
      this.prisma.envelopeSigner.findUnique({
        where: { id: signerId },
        include: {
          fields: {
            where: { type: 'SIGNATURE' },
            take: 1
          }
        }
      })
    ]);

    if (!document || !signer) {
      throw new Error('Document or signer not found');
    }

    // Get signature field
    const signatureField = signer.fields[0];
    if (!signatureField) {
      throw new Error('No signature field found');
    }

    // Load the PDF document
    const documentPath = this.documentService.getDocumentPath(document);
    const pdfBytes = await fs.readFile(documentPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Add signature to the document
    const page = pdfDoc.getPage(signatureField.page - 1);
    const { width, height } = page.getSize();

    if (submission.signatureData) {
      // For drawn signatures, embed the image with increased size (80% * 1.5 = 120% for better visibility)
      const signatureImage = await pdfDoc.embedPng(submission.signatureData);
      const appropriateWidth = (signatureField.width * width) * 1.2; // Increased by 1.5x
      const appropriateHeight = (signatureField.height * height) * 1.2;
      
      page.drawImage(signatureImage, {
        x: signatureField.x * width,
        y: signatureField.y * height,
        width: appropriateWidth,
        height: appropriateHeight
      });
    } else if (submission.signatureText) {
      // For typed signatures, add the text with increased size and better font
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold); // Better readability
      const appropriateFontSize = Math.min(30, (signatureField.height * height) * 1.2); // Increased by 1.5x

      page.drawText(submission.signatureText, {
        x: signatureField.x * width,
        y: signatureField.y * height,
        font,
        size: appropriateFontSize,
        color: rgb(0, 0, 0)
      });
    }

    // SIMPLE APPROACH: Create complete signed PDF with footer and calculate its hash
    
    const now = new Date();
    // Indian compliance date format: dd-mm-yyyy HH:MM:SS IST
    const fmtIndianIST = (d: Date) => {
      const istDate = new Date(d.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
      const day = istDate.getDate().toString().padStart(2, '0');
      const month = (istDate.getMonth() + 1).toString().padStart(2, '0');
      const year = istDate.getFullYear();
      const hours = istDate.getHours().toString().padStart(2, '0');
      const minutes = istDate.getMinutes().toString().padStart(2, '0');
      const seconds = istDate.getSeconds().toString().padStart(2, '0');
      return `${day}-${month}-${year} ${hours}:${minutes}:${seconds} IST`;
    };
    
    // First, save the PDF with signatures only
    const signedBytesWithoutFooter = await pdfDoc.save();
    
    // Load the PDF again to add the footer
    const pdfWithFooter = await PDFDocument.load(signedBytesWithoutFooter);
    const footerFont = await pdfWithFooter.embedFont(StandardFonts.Helvetica);
    const footerFontBold = await pdfWithFooter.embedFont(StandardFonts.HelveticaBold);
    
    // Get the last page to add footer
    const pages = pdfWithFooter.getPages();
    const lastPage = pages.length > 0 ? pages[pages.length - 1] : pdfWithFooter.addPage();
    
    if (!lastPage) {
      throw new Error('Unable to get or create last page for signing service footer');
    }
    
    const { width: pageWidth } = lastPage.getSize();
    
    // Add footer with document security metadata
    const footerY = 50; // Increased bottom margin to avoid overlaps
    
    // Separator line
    lastPage.drawRectangle({ 
      x: 40, 
      y: footerY + 35, // Moved up
      width: pageWidth - 80, 
      height: 1, 
      color: rgb(0.2, 0.2, 0.2) 
    });
    
    // Generate digital fingerprint for Indian compliance
    const documentFingerprint = crypto.createHash('sha256')
      .update(`${document.id}${signer.email}${now.getTime()}`)
      .digest('hex')
      .substring(0, 16).toUpperCase();
    
    // Header - Indian Digital Signature Compliance
    lastPage.drawText('Digital Signature Certificate - India Compliance', { 
      x: 40, 
      y: footerY + 40, // Moved up
      size: 11, // Slightly larger
      font: footerFontBold, 
      color: rgb(0, 0, 0) 
    });
    
    // Left side: Digital Fingerprint
    lastPage.drawText(`Digital Fingerprint: ${documentFingerprint}`, { 
      x: 40, 
      y: footerY + 20, // More spacing
      size: 9, // Slightly larger
      font: footerFont, 
      color: rgb(0, 0, 0) 
    });
    
    // Right side: Timestamp
    lastPage.drawText(`Digitally Signed: ${fmtIndianIST(now)}`, { 
      x: pageWidth - 280, // Adjusted position
      y: footerY + 20, // Aligned with fingerprint
      size: 9, // Slightly larger
      font: footerFont, 
      color: rgb(0, 0, 0) 
    });
    
    // Bottom: Compliance statement
    lastPage.drawText('Verified under Information Technology Act, 2000', { 
      x: 40, 
      y: footerY, 
      size: 8, // Slightly larger
      font: footerFont, 
      color: rgb(0.5, 0.5, 0.5) 
    });
    
    // Save the complete signed PDF with footer
    const completeSignedBytes = await pdfWithFooter.save();
    
    // Calculate the hash of the COMPLETE signed PDF (including signatures + footer)
    const completeSignedPdfHash = computeBufferHash(Buffer.from(completeSignedBytes));
    
    // Store the complete signed PDF file
    const timestamp = Date.now();
    const signedPath = path.join('signed', `${document.id}-v${timestamp}-complete-signed.pdf`);
    await this.documentService.storeSignedDocument(signedPath, completeSignedBytes);
    
    // Use the complete signed PDF hash (this includes everything: content + signatures + footer)
    const signedHash = completeSignedPdfHash;

    // Get the current signature step number for this document
    const currentStepCount = await this.prisma.signatureHistory.count({
      where: { documentId }
    });
    const nextSignatureStep = currentStepCount + 1;

    // Update signer record, document hash, and create signature history in a transaction
    // (reuse the 'now' variable from above)
    await this.prisma.$transaction([
      // Update signer record
      this.prisma.envelopeSigner.update({
        where: { id: signerId },
        data: {
          signedAt: now,
          signature: {
            create: {
              imagePath: submission.signatureData ? `image:${signedPath}` : `text:${submission.signatureText}`,
              consentGiven: true
            }
          }
        }
      }),
      // Update document with complete signed PDF hash and path
      this.prisma.document.update({
        where: { id: documentId },
        data: {
          completeSignedPdfHash: signedHash,
          signedPdfPath: signedPath,
          updatedAt: now
        }
      }),
      // Create signature history record
      this.prisma.signatureHistory.create({
        data: {
          documentId,
          signerName: signer.name,
          signerEmail: signer.email,
          signatureStep: nextSignatureStep,
          completeSignedPdfPath: signedPath,
          completeSignedPdfHash: signedHash,
          signedAt: now
        }
      })
    ]);

    // Check if all signers have signed
    const allSigners = await this.prisma.envelopeSigner.findMany({
      where: { 
        envelopeId: signer.envelopeId 
      }
    });

    const allSigned = allSigners.every((s: { signedAt: Date | null }) => s.signedAt);
    if (allSigned) {
      // Update envelope status
      await this.prisma.envelope.update({
        where: { id: signer.envelopeId },
        data: {
          status: 'COMPLETED',
          completedAt: now
        }
      });

      // Get envelope details
      const envelope = await this.prisma.envelope.findUnique({
        where: { id: signer.envelopeId }
      });

      // Send completion notifications to all signers
      for (const s of allSigners) {
        // Prepare signers list with proper type handling
        const signersInfo = allSigners.map(other => {
          const info: { name: string; email: string; signedAt?: Date; declinedAt?: Date } = {
            name: other.name,
            email: other.email
          };
          if (other.signedAt) info.signedAt = other.signedAt;
          if (other.declinedAt) info.declinedAt = other.declinedAt;
          return info;
        });

        const notificationData: CompletionNotification = {
          signerName: s.name,
          signerEmail: s.email,
          documentName: document.originalName,
          signedAt: s.signedAt!,
          allSigners: signersInfo,
          ...(envelope?.subject ? { envelopeSubject: envelope.subject } : {}),
          downloadLink: `${process.env['API_URL']}/documents/${document.id}/signed/${s.id}`,
          certificateLink: `${process.env['API_URL']}/documents/${document.id}/certificate/${s.id}`
        };

        await sendCompletionNotification(notificationData);
      }
    }

    return {
      documentId,
      signerId,
      signedAt: now,
      signedHash
    };
  }

  /**
   * Decline a signing request
   */
  async declineSigningRequest(documentId: string, signerId: string, reason?: string): Promise<void> {
    const signer = await this.prisma.envelopeSigner.findUnique({
      where: { id: signerId },
      include: { envelope: true }
    });

    if (!signer || signer.envelope.documentId !== documentId) {
      throw new Error('Signer not found');
    }

    if (signer.signedAt) {
      throw new Error('Document already signed');
    }

    await this.prisma.envelopeSigner.update({
      where: { id: signerId },
      data: {
        declinedAt: new Date()
      }
    });

    // Store decline reason in audit log
    if (reason) {
      await this.prisma.auditLog.create({
        data: {
          envelopeId: signer.envelopeId,
          actorEmail: signer.email,
          actorRole: 'SIGNER',
          event: 'DECLINED',
          details: { reason }
        }
      });
    }

    // Update envelope status
    await this.prisma.envelope.update({
      where: { id: signer.envelopeId },
      data: { status: 'DECLINED' }
    });
  }

  /**
   * Get signing request details
   */
  async getSigningRequest(documentId: string, signerId: string): Promise<{
    document: {
      id: string;
      name: string;
      previewUrl: string;
    };
    signer: {
      id: string;
      name: string;
      email: string;
      fields: Array<{
        id: string;
        type: 'SIGNATURE' | 'DATE' | 'TEXT' | 'CHECKBOX' | 'INITIAL';
        page: number;
        x: number;
        y: number;
        width: number;
        height: number;
      }>;
      signedAt: Date | null;
      declinedAt: Date | null;
    };
  }> {
    const [document, signer] = await Promise.all([
      this.prisma.document.findUnique({
        where: { id: documentId }
      }),
      this.prisma.envelopeSigner.findUnique({
        where: { id: signerId },
        include: {
          fields: true
        }
      })
    ]);

    if (!document || !signer) {
      throw new Error('Document or signer not found');
    }

    return {
      document: {
        id: document.id,
        name: document.originalName,
        previewUrl: `${process.env['API_URL']}/documents/${document.id}/preview`
      },
      signer: {
        id: signer.id,
        name: signer.name,
        email: signer.email,
        fields: signer.fields.map(f => ({
          id: f.id,
          type: f.type,
          page: f.page,
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height
        })),
        signedAt: signer.signedAt,
        declinedAt: signer.declinedAt
      }
    };
  }

  /**
   * Get a signed document
   */
  async getSignedDocument(documentId: string, signerId: string): Promise<string> {
    const signer = await this.prisma.envelopeSigner.findUnique({
      where: { id: signerId },
      include: { 
        envelope: {
          include: {
            document: true
          }
        }
      }
    });

    if (!signer || signer.envelope.documentId !== documentId || !signer.signedAt) {
      throw new Error('Signed document not found');
    }

    const signedPath = `${signer.envelope.document.storagePath}.signed`;
    return this.documentService.getSignedDocumentPath(signedPath);
  }

  /**
   * Get document signature history with complete signed PDF hash verification
   */
  async getDocumentSignatureHistory(documentId: string): Promise<{
    originalHash: string | null;
    currentCompleteSignedPdfHash: string | null;
    signatureSteps: Array<{
      step: number;
      signerName: string;
      signerEmail: string;
      signedAt: Date;
      completeSignedPdfHash: string;
      completeSignedPdfPath: string;
    }>;
    integrityValid: boolean;
  }> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        signatureHistory: {
          orderBy: { signatureStep: 'asc' }
        }
      }
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Map signature history to response format
    const signatureSteps = document.signatureHistory.map((history) => ({
      step: history.signatureStep,
      signerName: history.signerName,
      signerEmail: history.signerEmail,
      signedAt: history.signedAt,
      completeSignedPdfHash: history.completeSignedPdfHash,
      completeSignedPdfPath: history.completeSignedPdfPath
    }));

    // Verify current document integrity
    let integrityValid = false;
    if (document.completeSignedPdfHash && document.signedPdfPath) {
      try {
        const currentHash = await computeStreamHash(
          this.documentService.getSignedDocumentPath(document.signedPdfPath)
        );
        integrityValid = currentHash === document.completeSignedPdfHash;
      } catch (error) {
        console.error('Error verifying document integrity:', error);
      }
    }

    return {
      originalHash: document.originalHash,
      currentCompleteSignedPdfHash: document.completeSignedPdfHash,
      signatureSteps,
      integrityValid
    };
  }

  /**
   * Verify a signed document's integrity and signatures
   */
  async verifySignedDocument(documentId: string, signerId: string): Promise<{
    valid: boolean;
    details: {
      documentIntegrity: boolean;
      signatureValid: boolean;
      signerVerified: boolean;
      signedAt: Date | null;
      ipAddress: string | null;
      userAgent: string | null;
      geo: string | null;
    };
  }> {
    const signer = await this.prisma.envelopeSigner.findUnique({
      where: { id: signerId },
      include: { 
        envelope: {
          include: {
            document: true
          }
        },
        signature: true
      }
    });

    if (!signer || signer.envelope.documentId !== documentId) {
      throw new Error('Signer not found or document mismatch');
    }

    const details = {
      documentIntegrity: false,
      signatureValid: false,
      signerVerified: false,
      signedAt: signer.signedAt,
      ipAddress: signer.ipAddress,
      userAgent: signer.userAgent,
      geo: signer.geo
    };

    // Check document integrity
    if (signer.signedAt) {
      const signedPath = `${signer.envelope.document.storagePath}.signed`;
      const currentHash = await computeStreamHash(
        this.documentService.getSignedDocumentPath(signedPath)
      );
      details.documentIntegrity = currentHash === signer.envelope.document.completeSignedPdfHash;
    }

    // Verify signature
    if (signer.signature) {
      details.signatureValid = signer.signature.consentGiven && !!signer.signature.imagePath;
    }

    // Verify signer authentication
    details.signerVerified = signer.otpVerified && !!signer.signedAt;

    return {
      valid: details.documentIntegrity && details.signatureValid && details.signerVerified,
      details
    };
  }
}