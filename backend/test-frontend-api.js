#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { PrismaClient } from './src/generated/prisma/client.js';
import { serializeDocument } from './src/utils/serializers.js';

const app = express();
const prisma = new PrismaClient();

// Enable CORS for testing
app.use(cors());
app.use(express.json());

// Test endpoint that mimics the frontend API call
app.get('/test-documents', async (req, res) => {
  try {
    console.log('📡 Test API endpoint called');
    
    const documents = await prisma.document.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3
    });
    
    console.log('📊 Found', documents.length, 'documents in DB');
    
    const serializedDocs = documents.map(serializeDocument);
    
    console.log('✅ Serialized documents:');
    serializedDocs.forEach((doc, index) => {
      console.log(`  ${index + 1}. ${doc.originalName}`);
      console.log(`     - originalHash: ${doc.originalHash}`);
      console.log(`     - type: ${typeof doc.originalHash}`);
      console.log(`     - length: ${doc.originalHash?.length || 'N/A'}`);
    });
    
    res.json(serializedDocs);
  } catch (error) {
    console.error('❌ Test API error:', error);
    res.status(500).json({ error: error.message });
  }
});

const port = 4001;
const server = app.listen(port, () => {
  console.log(`🧪 Test API server running on http://localhost:${port}`);
  console.log(`📡 Test endpoint: http://localhost:${port}/test-documents`);
  console.log('');
  console.log('Test this with:');
  console.log(`curl http://localhost:${port}/test-documents`);
  console.log('');
  console.log('Press Ctrl+C to stop');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down test server...');
  server.close();
  await prisma.$disconnect();
  process.exit(0);
});