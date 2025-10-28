#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { PrismaClient } from './src/generated/prisma/client.js';

const prisma = new PrismaClient();

async function addTestDocument() {
  console.log('🧪 Adding test document with known hash...');
  
  try {
    // Create a simple test PDF content (just for testing)
    const testContent = "Test PDF content for hash display";
    const testHash = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"; // 64-char test hash
    
    // Get first user (or create a test user)
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          password: 'hashedpassword'
        }
      });
      console.log('✅ Created test user');
    }
    
    // Create test document
    const testDoc = await prisma.document.create({
      data: {
        ownerId: user.id,
        originalName: 'TEST_HASH_DISPLAY.pdf',
        storagePath: 'test/test-document.pdf',
        mimeType: 'application/pdf',
        sizeBytes: testContent.length,
        originalHash: testHash
      }
    });
    
    console.log('✅ Created test document:');
    console.log('  - Name:', testDoc.originalName);
    console.log('  - ID:', testDoc.id);
    console.log('  - Original Hash:', testDoc.originalHash);
    console.log('  - Hash Length:', testDoc.originalHash?.length);
    
    console.log('\n🎯 Now check the frontend - this document should show the hash!');
    
  } catch (error) {
    console.error('❌ Error creating test document:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addTestDocument();