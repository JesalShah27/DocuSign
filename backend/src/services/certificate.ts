import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PrismaClient } from '../generated/prisma/client.js';
import fs from 'node:fs';
import path from 'node:path';

const prisma = new PrismaClient();

export interface CertificateData {
  envelopeId: string;
  documentName: string;
  envelopeSubject?: string;
  completedAt: Date;
  signers: Array<{
    name: string;
    email: string;
    signedAt?: Date | null;
    declinedAt?: Date | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  }>;
  auditLogs: Array<{
    timestamp: Date;
    event: string;
    actorEmail?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    details?: any;
  }>;
  originalHash?: string;
  signedHash?: string;
  ownerEmail: string;
}

export async function generateCompletionCertificate(envelopeId: string): Promise<string> {
  const envelope = await prisma.envelope.findUnique({
    where: { id: envelopeId },
    include: {
      document: true,
      signers: {
        include: { signature: true },
        orderBy: { routingOrder: 'asc' }
      },
      auditLogs: {
        orderBy: { timestamp: 'asc' }
      },
      owner: true
    }
  });

  if (!envelope) {
    throw new Error('Envelope not found');
  }

  if (envelope.status !== 'COMPLETED') {
    throw new Error('Envelope not completed');
  }

  const certificateData: CertificateData = {
    envelopeId: envelope.id,
    documentName: envelope.document.originalName,
    completedAt: envelope.completedAt || new Date(),
    signers: envelope.signers.map(signer => ({
      name: signer.name,
      email: signer.email,
      signedAt: signer.signedAt,
      declinedAt: signer.declinedAt,
      ipAddress: signer.ipAddress,
      userAgent: signer.userAgent
    })),
    auditLogs: envelope.auditLogs.map(log => ({
      timestamp: log.timestamp,
      event: log.event,
      actorEmail: log.actorEmail,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      details: log.details
    })),
    ownerEmail: envelope.owner.email
  };
  if (envelope.subject) {
    certificateData.envelopeSubject = envelope.subject;
  }
  if (envelope.document.originalHash) {
    certificateData.originalHash = envelope.document.originalHash;
  }
  if (envelope.document.completeSignedPdfHash) {
    certificateData.signedHash = envelope.document.completeSignedPdfHash;
  }

  return await createCertificatePDF(certificateData);
}

async function createCertificatePDF(data: CertificateData): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([612, 792]); // Letter size
  const { height } = page.getSize();

  // Load fonts
  const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const headerFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const monoFont = await pdfDoc.embedFont(StandardFonts.Courier);

  let y = height - 50;

  // Title
  page.drawText('DOCUMENT SIGNING COMPLETION CERTIFICATE', {
    x: 50,
    y,
    size: 18,
    font: titleFont,
    color: rgb(0, 0, 0)
  });
  y -= 30;

  // Certificate ID and Date
  page.drawText(`Certificate ID: ${data.envelopeId}`, {
    x: 50,
    y,
    size: 10,
    font: bodyFont,
    color: rgb(0.3, 0.3, 0.3)
  });
  const toIST = (d: Date) => d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  page.drawText(`Generated: ${toIST(new Date())} IST`, {
    x: 400,
    y,
    size: 10,
    font: bodyFont,
    color: rgb(0.3, 0.3, 0.3)
  });
  y -= 40;

  // Document Information
  page.drawText('DOCUMENT INFORMATION', {
    x: 50,
    y,
    size: 14,
    font: headerFont,
    color: rgb(0, 0, 0)
  });
  y -= 25;

  page.drawText(`Document Name: ${data.documentName}`, {
    x: 50,
    y,
    size: 12,
    font: bodyFont,
    color: rgb(0, 0, 0)
  });
  y -= 20;

  if (data.envelopeSubject) {
    page.drawText(`Subject: ${data.envelopeSubject}`, {
      x: 50,
      y,
      size: 12,
      font: bodyFont,
      color: rgb(0, 0, 0)
    });
    y -= 20;
  }

  page.drawText(`Completed: ${toIST(data.completedAt)} IST`, {
    x: 50,
    y,
    size: 12,
    font: bodyFont,
    color: rgb(0, 0, 0)
  });
  y -= 20;

  page.drawText(`Owner: ${data.ownerEmail}`, {
    x: 50,
    y,
    size: 12,
    font: bodyFont,
    color: rgb(0, 0, 0)
  });
  y -= 40;

  // Hash Information
  page.drawText('INTEGRITY VERIFICATION', {
    x: 50,
    y,
    size: 14,
    font: headerFont,
    color: rgb(0, 0, 0)
  });
  y -= 25;

  if (data.originalHash) {
    page.drawText('Original Document Hash (SHA-256):', {
      x: 50,
      y,
      size: 10,
      font: bodyFont,
      color: rgb(0, 0, 0)
    });
    y -= 15;
    page.drawText(data.originalHash, {
      x: 50,
      y,
      size: 8,
      font: monoFont,
      color: rgb(0.3, 0.3, 0.3)
    });
    y -= 20;
  }

  if (data.signedHash) {
    page.drawText('Signed Document Hash (SHA-256):', {
      x: 50,
      y,
      size: 10,
      font: bodyFont,
      color: rgb(0, 0, 0)
    });
    y -= 15;
    page.drawText(data.signedHash, {
      x: 50,
      y,
      size: 8,
      font: monoFont,
      color: rgb(0.3, 0.3, 0.3)
    });
    y -= 30;
  }

  // Signers Information
  page.drawText('SIGNERS INFORMATION', {
    x: 50,
    y,
    size: 14,
    font: headerFont,
    color: rgb(0, 0, 0)
  });
  y -= 25;

  data.signers.forEach((signer, index) => {
    if (y < 120) {
      // Add new page if needed
      page = pdfDoc.addPage([612, 792]);
      y = page.getSize().height - 50;
    }

    page.drawText(`${index + 1}. ${signer.name} (${signer.email})`, {
      x: 50,
      y,
      size: 12,
      font: bodyFont,
      color: rgb(0, 0, 0)
    });
    y -= 18; // Increased spacing

    if (signer.signedAt) {
      page.drawText(`   Signed: ${toIST(signer.signedAt)} IST`, {
        x: 70,
        y,
        size: 10,
        font: bodyFont,
        color: rgb(0, 0.6, 0)
      });
      y -= 16; // Increased spacing
    }

    if (signer.declinedAt) {
      page.drawText(`   Declined: ${toIST(signer.declinedAt)} IST`, {
        x: 70,
        y,
        size: 10,
        font: bodyFont,
        color: rgb(0.8, 0, 0)
      });
      y -= 15;
    }

    if (signer.ipAddress) {
      page.drawText(`   IP Address: ${signer.ipAddress}`, {
        x: 70,
        y,
        size: 9,
        font: bodyFont,
        color: rgb(0.3, 0.3, 0.3)
      });
      y -= 12;
    }

    y -= 15; // Better section separation
  });

  y -= 20;

  // Audit Trail
  page.drawText('AUDIT TRAIL', {
    x: 50,
    y,
    size: 14,
    font: headerFont,
    color: rgb(0, 0, 0)
  });
  y -= 25;

  data.auditLogs.forEach((log) => {
    if (y < 100) {
      // Add new page if needed
      page = pdfDoc.addPage([612, 792]);
      y = page.getSize().height - 50;
    }

    const timestamp = toIST(log.timestamp) + ' IST';
    const event = log.event.replace(/_/g, ' ');
    const actor = log.actorEmail || 'System';
    
    page.drawText(`${timestamp} - ${event}`, {
      x: 50,
      y,
      size: 10,
      font: bodyFont,
      color: rgb(0, 0, 0)
    });
    y -= 12;

    page.drawText(`   Actor: ${actor}`, {
      x: 70,
      y,
      size: 9,
      font: bodyFont,
      color: rgb(0.3, 0.3, 0.3)
    });
    y -= 10;

    if (log.ipAddress) {
      page.drawText(`   IP: ${log.ipAddress}`, {
        x: 70,
        y,
        size: 9,
        font: bodyFont,
        color: rgb(0.3, 0.3, 0.3)
      });
      y -= 10;
    }

    y -= 5;
  });

  // Legal Notice
  y -= 30;
  page.drawText('LEGAL NOTICE', {
    x: 50,
    y,
    size: 14,
    font: headerFont,
    color: rgb(0, 0, 0)
  });
  y -= 25;

  const legalText = [
    'This certificate provides a complete audit trail of the electronic signing process.',
    'All signatures have been captured with proper consent and verification.',
    'The document has been electronically signed in accordance with applicable laws',
    'including the Electronic Signatures in Global and National Commerce Act (ESIGN)',
    'and the Uniform Electronic Transactions Act (UETA).',
    '',
    'The hash values provided above can be used to verify the integrity of the',
    'original and signed documents. Any modification to the documents will result',
    'in different hash values.',
    '',
    'This certificate is digitally generated and serves as proof of the signing',
    'process and document integrity.'
  ];

  legalText.forEach((line) => {
    if (y < 100) {
      page = pdfDoc.addPage([612, 792]);
      y = page.getSize().height - 50;
    }

    page.drawText(line, {
      x: 50,
      y,
      size: 10,
      font: bodyFont,
      color: rgb(0.3, 0.3, 0.3)
    });
    y -= 12;
  });

  // Save the certificate
  const pdfBytes = await pdfDoc.save();
  const outDir = path.join(process.cwd(), 'certificates');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `certificate_${data.envelopeId}.pdf`);
  fs.writeFileSync(outPath, pdfBytes);

  return outPath;
}
