#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { PrismaClient } from './src/generated/prisma/client.js';
import { serializeDocument } from './src/utils/serializers.js';
import jwt from 'jsonwebtoken';

const app = express();
const prisma = new PrismaClient();

// Enable CORS for frontend
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());

// Log all requests
app.use((req, res, next) => {
  console.log(`🌍 ${req.method} ${req.url}`);
  console.log('📋 Headers:', {
    authorization: req.headers.authorization ? '✅ Present' : '❌ Missing',
    'user-agent': req.headers['user-agent']?.slice(0, 50) + '...'
  });
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📦 Body:', req.body);
  }
  next();
});

// Auth middleware
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No authorization header or invalid format');
      return res.status(401).json({ message: 'No authorization header' });
    }

    const token = authHeader.substring(7);
    console.log('🔑 Token received:', token.slice(0, 20) + '...');
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    console.log('✅ Token decoded:', { userId: decoded.userId, email: decoded.email });
    
    req.user = { id: decoded.userId, email: decoded.email, name: decoded.name };
    next();
  } catch (error) {
    console.log('❌ Token verification failed:', error.message);
    return res.status(401).json({ message: 'Invalid token', error: error.message });
  }
};

// Debug documents endpoint
app.get('/api/documents', requireAuth, async (req, res) => {
  try {
    console.log('📄 Fetching documents for user:', req.user.id);
    
    // Get raw documents from database
    const rawDocs = await prisma.document.findMany({
      where: { ownerId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`📊 Found ${rawDocs.length} raw documents`);
    
    // Debug first document in detail
    if (rawDocs.length > 0) {
      const firstDoc = rawDocs[0];
      console.log('🔍 First document analysis:');
      console.log('  - Name:', firstDoc.originalName);
      console.log('  - originalHash type:', typeof firstDoc.originalHash);
      console.log('  - originalHash value:', firstDoc.originalHash);
      console.log('  - originalHash length:', firstDoc.originalHash?.length);
      console.log('  - All keys:', Object.keys(firstDoc));
    }
    
    // Serialize documents
    const serializedDocs = rawDocs.map(doc => {
      const serialized = serializeDocument(doc);
      console.log(`📝 Serialized ${doc.originalName}:`, {
        originalHash: serialized.originalHash,
        type: typeof serialized.originalHash,
        length: serialized.originalHash?.length
      });
      return serialized;
    });
    
    console.log('✅ Sending response with', serializedDocs.length, 'documents');
    console.log('📤 Response preview:', {
      count: serializedDocs.length,
      firstDocHash: serializedDocs[0]?.originalHash?.slice(0, 16) + '...'
    });
    
    res.json(serializedDocs);
    
  } catch (error) {
    console.error('❌ Error in documents endpoint:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// Test endpoint to verify everything is working
app.get('/api/test', (req, res) => {
  console.log('🧪 Test endpoint hit');
  res.json({ 
    message: 'Debug API server is working',
    timestamp: new Date().toISOString(),
    hasDocuments: true
  });
});

const PORT = 4001;
app.listen(PORT, () => {
  console.log('🚀 Debug API Server running on http://localhost:' + PORT);
  console.log('📝 This server will intercept frontend API calls and provide detailed debugging');
  console.log('🔧 To use: Change REACT_APP_API_URL to http://localhost:4001/api in frontend');
  console.log('📊 Watch this console for detailed request/response logging');
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});