import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PrismaClient, EnvelopeStatus } from '../generated/prisma/client.js';

const prisma = new PrismaClient();

export async function generateSignedPdf(envelopeId: string): Promise<string> {
  console.log('DEBUG: Starting PDF generation for envelope:', envelopeId);
  
  const envelope = await prisma.envelope.findUnique({
    where: { id: envelopeId },
    include: {
      document: true,
      signers: { include: { signature: true } },
      auditLogs: true,
    },
  });
  
  console.log('DEBUG: Envelope found:', {
    id: envelope?.id,
    status: envelope?.status,
    hasDocument: !!envelope?.document,
    documentStoragePath: envelope?.document?.storagePath
  });
  
  if (!envelope) throw new Error('Envelope not found');
  if (!envelope.document) throw new Error('Document not found');
  // Allow PDF generation for PARTIALLY_SIGNED and COMPLETED envelopes
  if (envelope.status !== EnvelopeStatus.COMPLETED && envelope.status !== EnvelopeStatus.PARTIALLY_SIGNED) {
    console.log('DEBUG: Envelope status does not allow PDF generation:', envelope.status);
    throw new Error(`Envelope not ready for PDF generation. Current status: ${envelope.status}`);
  }

  const inputPath = path.join(process.cwd(), 'uploads', envelope.document.storagePath);
  console.log('DEBUG: Input path:', inputPath);
  console.log('DEBUG: File exists:', fs.existsSync(inputPath));
  
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Document file not found at path: ${inputPath}`);
  }
  
  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(inputPath);
    console.log('DEBUG: File read successfully, size:', bytes.length);
  } catch (error) {
    console.error('DEBUG: Error reading file:', error);
    throw new Error(`Failed to read document file: ${error}`);
  }
  
  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(bytes);
    console.log('DEBUG: PDF loaded successfully');
  } catch (pdfError) {
    console.log('DEBUG: PDF load failed, creating fallback:', pdfError);
    pdfDoc = await PDFDocument.create();
    const p = pdfDoc.addPage();
    const fontInfo = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    p.drawText('Original PDF could not be parsed. Generated summary PDF instead.', { x: 50, y: p.getHeight() - 60, size: 12, font: fontInfo });
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  // Brush Script MT is not a standard PDF font; approximate with Helvetica Oblique
  const scriptLikeFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // If signers provided placement, render signatures on their chosen pages
  try {
    for (const signer of envelope.signers) {
      const sig = signer.signature;
      if (!sig) continue;
      const placement = (sig.drawnPoints as any) as { pageNumber?: number; x?: number; y?: number; width?: number; height?: number } | null;
      if (!placement || placement.pageNumber == null) continue;

      const pages = pdfDoc.getPages();
      const pageIndex = Math.max(0, Math.min(pages.length - 1, (placement.pageNumber || 1) - 1));
      const page = pages[pageIndex];
      if (!page) continue;
      const { width: pw, height: ph } = page.getSize();

      if (sig.imagePath) {
        const isDataUrl = /^data:image\/png;base64,/.test(sig.imagePath);
        const leftX = (placement.x ?? 0.1) * pw;
        const baseY = (placement.y ?? 0.1) * ph;
        if (isDataUrl) {
          try {
            const b64 = sig.imagePath.replace(/^data:image\/png;base64,/, '');
            const png = Buffer.from(b64, 'base64');
            const pngImage = await pdfDoc.embedPng(png);
            // Increased signature size (80% * 1.5 = 120% for better visibility)
            const drawWidth = Math.max(10, ((placement.width ?? 0.25) * pw) * 1.2);
            const drawHeight = Math.max(10, ((placement.height ?? 0.08) * ph) * 1.2);
            page.drawImage(pngImage, {
              x: leftX,
              y: baseY,
              width: drawWidth,
              height: drawHeight
            });
            // "e-Signature" label below the signature - bold and increased size
            const labelSize = Math.min(9, Math.max(7, drawHeight * 0.2 + 1)); // Increased size by 1
            const labelY = Math.max(8, baseY - (labelSize + 2));
            page.drawText('e-Signature', {
              x: leftX,
              y: labelY,
              size: labelSize,
              font: fontBold, // Now using bold font
              color: rgb(0.5, 0.5, 0.5) // Slightly darker for better visibility
            });
          } catch {
            // ignore invalid image
          }
        } else if (sig.imagePath.startsWith('text:')) {
          const typedText = sig.imagePath.slice('text:'.length);
          // Increased typed signature size (80% * 1.5 = 120% for better visibility)
          const textSize = Math.min(36, Math.max(15, ((placement.height ?? 0.08) * ph) * 1.2));
          page.drawText(typedText, {
            x: leftX,
            y: baseY,
            size: textSize,
            font: scriptLikeFont,
            color: rgb(0, 0, 0)
          });
          // "e-Signature" label below typed signature - bold and increased size
          const labelSize = Math.min(9, Math.max(7, textSize * 0.25 + 1)); // Increased size by 1
          const labelY = Math.max(8, baseY - (labelSize + 2));
          page.drawText('e-Signature', {
            x: leftX,
            y: labelY,
            size: labelSize,
            font: fontBold, // Now using bold font
            color: rgb(0.5, 0.5, 0.5) // Slightly darker for better visibility
          });
        }
      }
    }
  } catch (e) {
    // continue with summary stamping even if placement rendering fails
  }

  // Check if any signer requested text suppression
  const anySignerSuppressesText = envelope.signers.some(signer => {
    const drawnPoints = signer.signature?.drawnPoints as any;
    return drawnPoints?.suppressText === true;
  });
  
  console.log('🚫 PDF GENERATION - Text suppression check:', {
    anySignerSuppressesText,
    signersWithData: envelope.signers.map(s => ({
      name: s.name,
      email: s.email,
      hasDrawnPoints: !!s.signature?.drawnPoints,
      suppressText: (s.signature?.drawnPoints as any)?.suppressText
    }))
  });
  
  // Only add signature summary section if explicitly enabled via env AND not suppressed by signer
  const INCLUDE_SIGNATURE_SUMMARY = process.env['INCLUDE_SIGNATURE_SUMMARY'] === 'true';
  if (INCLUDE_SIGNATURE_SUMMARY && !anySignerSuppressesText) {
    console.log('✅ Adding signature summary section (explicitly enabled)');

    // Helper to format time in IST
    const toIST = (d?: Date | null) => d ? new Date(d).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }) : 'N/A';

    // Stamp signature info on the last page
    let lastPage;
    try {
      const pages = pdfDoc.getPages();
      lastPage = pages.length > 0 ? pages[pages.length - 1] : pdfDoc.addPage();
    } catch {
      lastPage = pdfDoc.addPage();
    }
    let y = 40;
    lastPage!.drawText('Electronic Signatures', { x: 50, y: y + 20, size: 12, font: fontBold, color: rgb(0, 0, 0) });
    for (const signer of envelope.signers) {
      const signedAtIST = toIST(signer.signedAt);
      lastPage!.drawText(`${signer.name} <${signer.email}> signed at ${signedAtIST} IST`, { x: 50, y, size: 10, font });
      y += 14;
      if (signer.signature?.imagePath) {
        // Support both drawn (base64 png) and typed (text:...) signatures
        const imgMatch = signer.signature.imagePath.match(/^data:image\/png;base64,/);
        if (imgMatch) {
          try {
            const b64 = signer.signature.imagePath.replace(/^data:image\/png;base64,/, '');
            const png = Buffer.from(b64, 'base64');
            const pngImage = await pdfDoc.embedPng(png);
            // Increased signature size in summary (20% * 1.5 = 30% for summary section)
            const pngDims = pngImage.scale(0.3);
            lastPage!.drawImage(pngImage, { x: 50, y: y + 4, width: pngDims.width, height: pngDims.height });
            y += pngDims.height + 10;
          } catch {
            // ignore invalid image
          }
        } else if (signer.signature.imagePath.startsWith('text:')) {
          const typedText = signer.signature.imagePath.slice('text:'.length);
          // Render typed signature with increased size for summary (18 * 1.5 = 27)
          lastPage!.drawText(typedText, { x: 50, y: y + 4, size: 27, font: scriptLikeFont, color: rgb(0, 0, 0) });
          y += 27 + 10;
        }
      }
    }
  } else {
    console.log('🛑 Skipping signature summary section (disabled or suppressed)');
  }

  // Removed audit trail page per requirements

  // Stage 1: save the signed document bytes (before final footer)
  const signedBytesStage1 = await pdfDoc.save();
  const contentHash = crypto.createHash('sha256').update(signedBytesStage1).digest('hex');

  // Compute a deterministic digital fingerprint for the envelope + content
  const signerKey = envelope.signers.map(s => s.email).sort().join('|');
  const fingerprint = crypto.createHash('sha256').update(`${envelope.id}|${contentHash}|${signerKey}`).digest('hex');

  // Try to find the latest device fingerprint captured in audit logs (currently unused but kept for future use)
  try {
    const logs = (envelope.auditLogs || []).slice().reverse();
    for (const log of logs) {
      const details = (log.details as any) || {};
      if (details.deviceFingerprintId) { break; }
    }
  } catch {}

  // Stage 2: reload and stamp hash + fingerprint footer in IST
  const pdfWithFooter = await PDFDocument.load(signedBytesStage1);
  const footerFont = await pdfWithFooter.embedFont(StandardFonts.Helvetica);
  const footerFontBold = await pdfWithFooter.embedFont(StandardFonts.HelveticaBold);
  const pages2 = pdfWithFooter.getPages();
  const lastPage2 = pages2.length > 0 ? pages2[pages2.length - 1] : pdfWithFooter.addPage();
  
  if (!lastPage2) {
    throw new Error('Unable to get or create last page for PDF footer');
  }
  
  const { width: lw } = lastPage2.getSize();

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
  
  // Generate digital fingerprint for Indian compliance
  const latestSignedAt = envelope.signers.map(s => s.signedAt).filter(Boolean).sort((a: any,b: any)=>new Date(b).getTime()-new Date(a).getTime())[0] || envelope.completedAt || new Date();
  const documentFingerprint = crypto.createHash('sha256')
    .update(`${envelope.id}${envelope.document.id}${latestSignedAt}`)
    .digest('hex')
    .substring(0, 16).toUpperCase(); // 16-char fingerprint
  
  const metaY = 30; // bottom margin block
  // Separator line
  lastPage2.drawRectangle({ x: 40, y: metaY + 24, width: lw - 80, height: 1, color: rgb(0.2, 0.2, 0.2) });
  
  // Header - Indian Digital Signature Compliance
  lastPage2.drawText('Digital Signature Certificate - India Compliance', { x: 40, y: metaY + 30, size: 10, font: footerFontBold, color: rgb(0, 0, 0) });
  
  // Digital Fingerprint (instead of hash)
  lastPage2.drawText(`Digital Fingerprint: ${documentFingerprint}`, { x: 40, y: metaY + 12, size: 8, font: footerFont, color: rgb(0, 0, 0) });
  
  // Indian format timestamp
  lastPage2.drawText(`Digitally Signed: ${fmtIndianIST(new Date(latestSignedAt as Date))}`, { x: lw - 320, y: metaY + 12, size: 8, font: footerFont, color: rgb(0, 0, 0) });
  
  // Compliance statement
  lastPage2.drawText('Verified under Information Technology Act, 2000', { x: 40, y: metaY, size: 7, font: footerFont, color: rgb(0.5, 0.5, 0.5) });

  const outBytes = await pdfWithFooter.save();
  
  // Calculate the COMPLETE signed PDF hash (including all content and footer)
  const completeSignedPdfHash = crypto.createHash('sha256').update(outBytes).digest('hex');

  const outDir = path.join(process.cwd(), 'signed');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${envelope.id}.pdf`);
  fs.writeFileSync(outPath, outBytes);

  // Update the document with the COMPLETE signed PDF hash (includes everything)
  await prisma.document.update({
    where: { id: envelope.document.id },
    data: { 
      completeSignedPdfHash: completeSignedPdfHash,
      signedPdfPath: path.relative(process.cwd(), outPath)
    }
  });

  // Log the complete signed PDF hash + metadata
  await prisma.auditLog.create({
    data: {
      envelopeId: envelope.id,
      event: 'COMPLETE_SIGNED_PDF_GENERATED',
      details: { 
        originalHash: envelope.document.originalHash,
        contentHash,
        completeSignedPdfHash,
        fingerprint,
        filePath: outPath,
        note: 'Complete signed PDF hash includes all content, signatures, and metadata footer'
      }
    }
  });

  return outPath;
}


