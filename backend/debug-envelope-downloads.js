#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { PrismaClient } from './src/generated/prisma/client.js';
import fs from 'fs';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '.env') });

const prisma = new PrismaClient();

console.log('🔍 Debugging Envelope Download Issues');
console.log('====================================');

async function main() {
  try {
    // Import services at the top
    const documentModule = await import('./src/services/document.js');
    const DocumentService = documentModule.DocumentService;
    const pdfModule = await import('./src/services/pdf.js');
    const generateSignedPdf = pdfModule.generateSignedPdf;
    const certModule = await import('./src/services/certificate.js');
    const generateCompletionCertificate = certModule.generateCompletionCertificate;
    
    // Check for envelopes
    console.log('\n1. Checking envelopes in database...');
    const envelopes = await prisma.envelope.findMany({
      include: {
        document: {
          include: {
            signatureHistory: true
          }
        },
        signers: {
          include: {
            signature: true
          }
        }
      }
    });
    
    if (envelopes.length === 0) {
      console.log('❌ No envelopes found in database');
      console.log('💡 You need to create and send an envelope first');
      return;
    }
    
    console.log(`✅ Found ${envelopes.length} envelope(s):`);
    
    envelopes.forEach((env, index) => {
      console.log(`\n📄 Envelope ${index + 1}:`);
      console.log(`  - ID: ${env.id}`);
      console.log(`  - Status: ${env.status}`);
      console.log(`  - Document: ${env.document?.originalName || 'N/A'}`);
      console.log(`  - Signed PDF Path: ${env.document?.signedPdfPath || 'Not set'}`);
      console.log(`  - Complete Signed PDF Hash: ${env.document?.completeSignedPdfHash ? 'Present' : 'Missing'}`);
      console.log(`  - Signers: ${env.signers.length}`);
      console.log(`  - Signature Steps: ${env.document?.signatureHistory.length || 0}`);
      
      // Check if signed PDF file exists
      if (env.document?.signedPdfPath) {
        try {
          const documentService = new DocumentService();
          const signedFilePath = documentService.getSignedDocumentPath(env.document.signedPdfPath);
          const fileExists = fs.existsSync(signedFilePath);
          console.log(`  - Signed PDF File Exists: ${fileExists ? '✅ Yes' : '❌ No'}`);
          if (!fileExists) {
            console.log(`    └─ Expected path: ${signedFilePath}`);
          }
        } catch (error) {
          console.log(`  - Error checking signed PDF file: ${error.message}`);
        }
      }
      
      // Check signers
      env.signers.forEach((signer, signerIndex) => {
        console.log(`    Signer ${signerIndex + 1}: ${signer.name} (${signer.email})`);
        console.log(`      - Signed: ${signer.signedAt ? '✅ Yes' : '❌ No'}`);
        console.log(`      - Has Signature: ${signer.signature ? '✅ Yes' : '❌ No'}`);
      });
    });
    
    // Test download endpoints for each envelope
    console.log('\n2. Testing download endpoint logic...');
    
    for (const env of envelopes) {
      console.log(`\n🧪 Testing envelope ${env.id}:`);
      
      try {
        // Test PDF generation
        console.log('  - Testing PDF generation...');
        const pdfPath = await generateSignedPdf(env.id);
        console.log(`    ✅ PDF generation successful: ${pdfPath}`);
        console.log(`    ✅ File exists: ${fs.existsSync(pdfPath)}`);
        
        // Test certificate generation
        console.log('  - Testing certificate generation...');
        const certPath = await generateCompletionCertificate(env.id);
        console.log(`    ✅ Certificate generation successful: ${certPath}`);
        console.log(`    ✅ File exists: ${fs.existsSync(certPath)}`);
        
      } catch (error) {
        console.error(`    ❌ Error testing envelope ${env.id}:`, error.message);
      }
    }
    
    // Show proper download URLs
    console.log('\n3. Correct Download URLs:');
    envelopes.forEach(env => {
      console.log(`\n📄 Envelope: ${env.id}`);
      console.log(`  - Public Signed PDF: GET /api/download/${env.id}`);
      console.log(`  - Authenticated Signed PDF: GET /api/download/envelopes/${env.id}/pdf`);
      console.log(`  - Certificate: GET /api/download/envelopes/${env.id}/certificate`);
      console.log(`  - Info: GET /api/download/envelopes/${env.id}/info`);
    });
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);