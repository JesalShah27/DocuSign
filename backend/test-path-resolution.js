import { PrismaClient } from './src/generated/prisma/client.js';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function testPathResolution() {
  console.log('🔍 Testing Path Resolution for Downloads');
  console.log('========================================');

  try {
    const envelope = await prisma.envelope.findFirst({
      where: { id: 'cmgxmzuoh0003ry1gwupyl6ph' },
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

    if (!envelope) {
      console.log('❌ Envelope not found');
      return;
    }

    console.log('✅ Envelope found:');
    console.log(`   ID: ${envelope.id}`);
    console.log(`   Status: ${envelope.status}`);
    console.log(`   Document: ${envelope.document.originalName}`);
    console.log(`   Signed PDF Path: ${envelope.document.signedPdfPath}`);
    console.log('');

    // Test the path resolution logic from the download route
    let signedFilePath;

    // Try direct path first (relative to project root)
    if (envelope.document.signedPdfPath.startsWith('signed/')) {
      signedFilePath = path.join(process.cwd(), envelope.document.signedPdfPath);
    } else {
      // Legacy fallback for old paths
      signedFilePath = path.join(process.cwd(), 'uploads', envelope.document.signedPdfPath);
    }

    console.log(`🔍 Primary path resolution:`);
    console.log(`   Input: ${envelope.document.signedPdfPath}`);
    console.log(`   Starts with 'signed/': ${envelope.document.signedPdfPath.startsWith('signed/')}`);
    console.log(`   Resolved path: ${signedFilePath}`);
    console.log(`   File exists: ${fs.existsSync(signedFilePath)}`);
    console.log('');

    // Additional fallback paths in case of path issues
    if (!fs.existsSync(signedFilePath)) {
      console.log('⚠️ Primary path not found, trying fallbacks:');
      
      const fallbackPaths = [
        path.join(process.cwd(), 'signed', path.basename(envelope.document.signedPdfPath)),
        path.join(process.cwd(), envelope.document.signedPdfPath)
      ];

      for (const [index, fallbackPath] of fallbackPaths.entries()) {
        console.log(`   Fallback ${index + 1}: ${fallbackPath}`);
        console.log(`   Exists: ${fs.existsSync(fallbackPath)}`);
        if (fs.existsSync(fallbackPath)) {
          console.log(`   ✅ Found file at fallback ${index + 1}`);
          signedFilePath = fallbackPath;
          break;
        }
      }
    } else {
      console.log('✅ Primary path works!');
    }

    if (fs.existsSync(signedFilePath)) {
      const stats = fs.statSync(signedFilePath);
      console.log('');
      console.log('📁 Final File Info:');
      console.log(`   Path: ${signedFilePath}`);
      console.log(`   Size: ${stats.size} bytes`);
      console.log(`   Modified: ${stats.mtime.toISOString()}`);
    } else {
      console.log('');
      console.log('❌ No file found at any location');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPathResolution();