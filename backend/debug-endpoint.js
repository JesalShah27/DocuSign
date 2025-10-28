import express from 'express';
import { PrismaClient } from './src/generated/prisma/client.js';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const prisma = new PrismaClient();

app.get('/debug/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`🔍 Debug endpoint called with ID: ${id}`);
  
  try {
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

    if (!env) {
      console.log('❌ Envelope not found');
      return res.status(404).json({ message: 'Envelope not found' });
    }

    console.log('✅ Envelope found');
    console.log(`   Status: ${env.status}`);
    console.log(`   Document: ${env.document.originalName}`);
    console.log(`   Signed PDF Path: ${env.document.signedPdfPath || 'None'}`);

    if (!env.document.signedPdfPath) {
      console.log('❌ No signed PDF path');
      return res.status(400).json({ message: 'No signed PDF path' });
    }

    // Test path resolution
    let signedFilePath;
    if (env.document.signedPdfPath.startsWith('signed/')) {
      signedFilePath = path.join(process.cwd(), env.document.signedPdfPath);
    } else {
      signedFilePath = path.join(process.cwd(), 'uploads', env.document.signedPdfPath);
    }

    console.log(`📁 Trying path: ${signedFilePath}`);
    console.log(`📁 File exists: ${fs.existsSync(signedFilePath)}`);

    if (!fs.existsSync(signedFilePath)) {
      console.log('❌ Primary path failed, trying fallbacks...');
      
      const fallbackPaths = [
        path.join(process.cwd(), 'signed', path.basename(env.document.signedPdfPath)),
        path.join(process.cwd(), env.document.signedPdfPath)
      ];

      let found = false;
      for (const fallbackPath of fallbackPaths) {
        console.log(`🔄 Trying fallback: ${fallbackPath}`);
        if (fs.existsSync(fallbackPath)) {
          console.log(`✅ Found at fallback!`);
          signedFilePath = fallbackPath;
          found = true;
          break;
        }
      }

      if (!found) {
        console.log('❌ No file found at any location');
        return res.status(500).json({ message: 'File not found' });
      }
    }

    console.log(`📄 Final path: ${signedFilePath}`);
    const stats = fs.statSync(signedFilePath);
    console.log(`📊 File size: ${stats.size} bytes`);

    // Try to download the file
    console.log('🚀 Attempting download...');
    const filename = `signed_${env.document.originalName}`;
    return res.download(signedFilePath, filename);

  } catch (error) {
    console.error('❌ Debug error:', error);
    return res.status(500).json({ message: 'Debug error', error: error.message });
  }
});

const port = 4001;
app.listen(port, () => {
  console.log(`🔍 Debug server running on http://localhost:${port}`);
  console.log(`🧪 Test with: curl http://localhost:${port}/debug/cmgxmzuoh0003ry1gwupyl6ph`);
});