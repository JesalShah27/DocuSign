import { PrismaClient } from './src/generated/prisma/client.js';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function debugEnvelopeDownload() {
  console.log('🔍 Debug: Envelope Download Issues');
  console.log('=====================================');

  try {
    // 1. Check all envelopes
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
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📊 Total Envelopes: ${envelopes.length}\n`);

    if (envelopes.length === 0) {
      console.log('❌ No envelopes found in database');
      return;
    }

    // 2. Show envelope details
    for (const env of envelopes) {
      console.log(`📋 Envelope ID: ${env.id}`);
      console.log(`   Status: ${env.status}`);
      console.log(`   Subject: ${env.subject || 'No subject'}`);
      console.log(`   Document: ${env.document.originalName}`);
      console.log(`   Created: ${env.createdAt.toISOString()}`);
      console.log(`   Completed: ${env.completedAt?.toISOString() || 'Not completed'}`);
      
      // Check signers
      console.log(`   Signers (${env.signers.length}):`);
      env.signers.forEach((signer, idx) => {
        console.log(`     ${idx + 1}. ${signer.name} (${signer.email})`);
        console.log(`        Signed: ${signer.signedAt?.toISOString() || 'Not signed'}`);
        console.log(`        Has signature: ${!!signer.signature}`);
      });

      // Check document file paths
      console.log(`   Document Info:`);
      console.log(`     Original Hash: ${env.document.originalHash || 'None'}`);
      console.log(`     Signed Hash: ${env.document.completeSignedPdfHash || 'None'}`);
      console.log(`     Signed PDF Path: ${env.document.signedPdfPath || 'None'}`);

      // Check if signed PDF file exists
      if (env.document.signedPdfPath) {
        const primaryPath = path.join(process.cwd(), 'uploads', env.document.signedPdfPath);
        const fallbackPath = path.join(process.cwd(), 'signed', path.basename(env.document.signedPdfPath));
        const directPath = path.join(process.cwd(), env.document.signedPdfPath);

        console.log(`   File Check:`);
        console.log(`     Primary path: ${primaryPath}`);
        console.log(`       Exists: ${fs.existsSync(primaryPath)}`);
        console.log(`     Fallback path: ${fallbackPath}`);
        console.log(`       Exists: ${fs.existsSync(fallbackPath)}`);
        console.log(`     Direct path: ${directPath}`);
        console.log(`       Exists: ${fs.existsSync(directPath)}`);
      }

      // Check signature history
      console.log(`   Signature History (${env.document.signatureHistory.length}):`);
      env.document.signatureHistory.forEach((step, idx) => {
        console.log(`     Step ${step.signatureStep}: ${step.signerName} (${step.signerEmail})`);
        console.log(`       Signed: ${step.signedAt.toISOString()}`);
        console.log(`       Hash: ${step.completeSignedPdfHash}`);
        console.log(`       Path: ${step.completeSignedPdfPath}`);
        
        // Check if step file exists
        if (step.completeSignedPdfPath) {
          const stepPath = path.join(process.cwd(), step.completeSignedPdfPath);
          console.log(`       File exists: ${fs.existsSync(stepPath)}`);
        }
      });

      console.log('');
    }

    // 3. Test download endpoints for each envelope
    console.log('🚀 Testing Download Endpoints:');
    console.log('==============================');
    
    for (const env of envelopes) {
      console.log(`\n📋 Testing Envelope: ${env.id} (${env.status})`);
      
      // Test public download
      console.log(`   Public Download URL: /api/download/${env.id}`);
      
      // Test authenticated download  
      console.log(`   Auth Download URL: /api/download/envelopes/${env.id}/pdf`);
      
      // Test info endpoint
      console.log(`   Info URL: /api/download/envelopes/${env.id}/info`);

      // Check if envelope is downloadable
      const isDownloadable = (env.status === 'COMPLETED' || env.status === 'PARTIALLY_SIGNED');
      console.log(`   Downloadable: ${isDownloadable}`);

      if (!isDownloadable) {
        console.log(`   ❌ Not ready for download (status: ${env.status})`);
        continue;
      }

      // Check for actual files
      let fileFound = false;
      let filePath = null;

      if (env.document.signedPdfPath) {
        const paths = [
          path.join(process.cwd(), 'uploads', env.document.signedPdfPath),
          path.join(process.cwd(), 'signed', path.basename(env.document.signedPdfPath)),
          path.join(process.cwd(), env.document.signedPdfPath)
        ];

        for (const testPath of paths) {
          if (fs.existsSync(testPath)) {
            fileFound = true;
            filePath = testPath;
            break;
          }
        }
      }

      console.log(`   File found: ${fileFound}`);
      if (fileFound) {
        console.log(`   File path: ${filePath}`);
        const stats = fs.statSync(filePath);
        console.log(`   File size: ${stats.size} bytes`);
      } else {
        console.log(`   ❌ No signed PDF file found`);
      }
    }

  } catch (error) {
    console.error('❌ Debug Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugEnvelopeDownload();