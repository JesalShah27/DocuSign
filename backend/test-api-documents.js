#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { PrismaClient } from './src/generated/prisma/client.js';
import { serializeDocument } from './src/utils/serializers.js';

const prisma = new PrismaClient();

async function testDocumentsAPI() {
  console.log('🧪 Testing Documents API Response Format\n');
  
  try {
    // Get some documents from database
    const documents = await prisma.document.findMany({
      take: 2,
      orderBy: { createdAt: 'desc' }
    });
    
    if (documents.length === 0) {
      console.log('❌ No documents found in database');
      console.log('💡 Please upload a document first to test this functionality');
      return;
    }
    
    console.log(`📄 Testing with ${documents.length} document(s):\n`);
    
    for (const doc of documents) {
      console.log(`📋 Raw Document from DB:`);
      console.log(`  - Name: ${doc.originalName}`);
      console.log(`  - ID: ${doc.id}`);
      console.log(`  - Original Hash: ${doc.originalHash}`);
      console.log(`  - Complete Signed PDF Hash: ${doc.completeSignedPdfHash || 'N/A'}`);
      
      console.log(`\n📤 Serialized Document (API Response):`);
      const serialized = serializeDocument(doc);
      console.log(`  - Name: ${serialized.originalName}`);
      console.log(`  - ID: ${serialized.id}`);
      console.log(`  - Original Hash: ${serialized.originalHash}`);
      console.log(`  - Complete Signed PDF Hash: ${serialized.completeSignedPdfHash || 'N/A'}`);
      console.log(`  - Signed PDF Path: ${serialized.signedPdfPath || 'N/A'}`);
      
      // Verify fields match what frontend expects
      const frontendCheck = {
        hasRequiredFields: !!(serialized.id && serialized.originalName && serialized.originalHash),
        fieldTypes: {
          originalHash: typeof serialized.originalHash,
          completeSignedPdfHash: typeof serialized.completeSignedPdfHash
        }
      };
      
      console.log(`\n✅ Frontend Compatibility Check:`, frontendCheck);
      console.log('─'.repeat(60));
    }
    
    console.log('\n✅ Documents API test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing documents API:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDocumentsAPI();