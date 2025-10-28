#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from './src/generated/prisma/client.js';
import { serializeDocument } from './src/utils/serializers.js';

const prisma = new PrismaClient();

async function debugSingleDocument() {
  console.log('🔍 Debugging Single Document Data\n');
  
  try {
    // Get the most recent document
    const document = await prisma.document.findFirst({
      orderBy: { createdAt: 'desc' }
    });
    
    if (!document) {
      console.log('❌ No documents found in database');
      return;
    }
    
    console.log('📄 RAW DOCUMENT FROM DATABASE:');
    console.log('ID:', document.id);
    console.log('Name:', document.originalName);
    console.log('originalHash type:', typeof document.originalHash);
    console.log('originalHash value:', document.originalHash);
    console.log('originalHash === null:', document.originalHash === null);
    console.log('originalHash === undefined:', document.originalHash === undefined);
    console.log('originalHash length:', document.originalHash?.length || 'N/A');
    
    console.log('\n📤 SERIALIZED DOCUMENT (what API returns):');
    const serialized = serializeDocument(document);
    console.log('originalHash type:', typeof serialized.originalHash);
    console.log('originalHash value:', serialized.originalHash);
    console.log('originalHash === null:', serialized.originalHash === null);
    console.log('originalHash === undefined:', serialized.originalHash === undefined);
    
    console.log('\n🧪 JSON SERIALIZATION TEST:');
    const jsonString = JSON.stringify(serialized);
    console.log('JSON string contains originalHash:', jsonString.includes('originalHash'));
    const parsed = JSON.parse(jsonString);
    console.log('After JSON parse - originalHash type:', typeof parsed.originalHash);
    console.log('After JSON parse - originalHash value:', parsed.originalHash);
    
    console.log('\n✅ Debug completed successfully!');
    
  } catch (error) {
    console.error('❌ Error debugging document:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugSingleDocument();