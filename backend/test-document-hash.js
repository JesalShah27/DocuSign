#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from './src/generated/prisma/client.js';
import { serializeDocument } from './src/utils/serializers.js';

const prisma = new PrismaClient();

async function testDocumentHashes() {
  console.log('🧪 Testing Document Hash Display\n');
  
  try {
    // Get all documents
    const documents = await prisma.document.findMany({
      take: 3, // Just test the first 3
      orderBy: { createdAt: 'desc' }
    });
    
    if (documents.length === 0) {
      console.log('❌ No documents found in database');
      console.log('💡 Please upload a document first to test this functionality');
      return;
    }
    
    console.log(`📄 Found ${documents.length} document(s) in database:\n`);
    
    for (const doc of documents) {
      console.log(`📋 Document: ${doc.originalName}`);
      console.log(`🆔 ID: ${doc.id}`);
      console.log(`🔐 Original Hash: ${doc.originalHash || 'N/A'}`);
      console.log(`📝 Complete Signed PDF Hash: ${doc.completeSignedPdfHash || 'N/A'}`);
      console.log(`📁 Signed PDF Path: ${doc.signedPdfPath || 'N/A'}`);
      
      // Test serialization
      const serialized = serializeDocument(doc);
      console.log(`✅ Serialized correctly: originalHash=${!!serialized.originalHash}, completeSignedPdfHash=${!!serialized.completeSignedPdfHash}`);
      console.log('─'.repeat(60));
    }
    
    console.log('\n✅ Document hash test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing document hashes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDocumentHashes();