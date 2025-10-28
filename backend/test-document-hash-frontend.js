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

console.log('🧪 Testing Document Hash Display Issue');
console.log('=====================================');

async function main() {
  try {
    // Check if any users exist
    console.log('\n1. Checking users in database...');
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true }
    });
    
    if (users.length === 0) {
      console.log('❌ No users found in database');
      console.log('💡 Please register a user first via the frontend');
      return;
    }
    
    console.log(`✅ Found ${users.length} user(s):`);
    users.forEach(user => {
      console.log(`   - ${user.name} (${user.email}) [ID: ${user.id}]`);
    });

    // Check documents for each user
    console.log('\n2. Checking documents for each user...');
    for (const user of users) {
      console.log(`\n📄 Documents for user ${user.email}:`);
      
      const documents = await prisma.document.findMany({
        where: { ownerId: user.id },
        select: {
          id: true,
          originalName: true,
          originalHash: true,
          completeSignedPdfHash: true,
          signedPdfPath: true,
          createdAt: true,
          sizeBytes: true
        }
      });
      
      if (documents.length === 0) {
        console.log('   ❌ No documents found for this user');
      } else {
        documents.forEach((doc, index) => {
          console.log(`   ${index + 1}. ${doc.originalName}`);
          console.log(`      - ID: ${doc.id}`);
          console.log(`      - Original Hash: ${doc.originalHash ? '✅ Present' : '❌ Missing'}`);
          if (doc.originalHash) {
            console.log(`        └─ Value: ${doc.originalHash.slice(0, 16)}...`);
          }
          console.log(`      - Complete Signed PDF Hash: ${doc.completeSignedPdfHash ? '✅ Present' : '❌ Missing'}`);
          console.log(`      - Size: ${Math.round(doc.sizeBytes / 1024)} KB`);
          console.log(`      - Created: ${doc.createdAt.toISOString()}`);
        });
      }
    }

    // Test API endpoint by simulating what the frontend does
    console.log('\n3. Testing API serialization...');
    
    // Import the serializer directly
    const { serializeDocument } = await import('./src/utils/serializers.js');
    
    const allDocuments = await prisma.document.findMany();
    
    if (allDocuments.length > 0) {
      console.log('✅ Testing document serialization:');
      
      allDocuments.slice(0, 2).forEach((doc, index) => {
        const serialized = serializeDocument(doc);
        console.log(`\n   Document ${index + 1}: ${doc.originalName}`);
        console.log(`   Raw DB originalHash: ${typeof doc.originalHash} = ${doc.originalHash}`);
        console.log(`   Serialized originalHash: ${typeof serialized.originalHash} = ${serialized.originalHash}`);
        console.log(`   Serialized keys: ${Object.keys(serialized).join(', ')}`);
      });
    }

    // Test what the documents route actually returns
    console.log('\n4. Testing document service...');
    const { DocumentService } = await import('./src/services/document.js');
    const docService = new DocumentService();
    
    if (users.length > 0) {
      const userDocuments = await docService.listDocuments(users[0].id);
      console.log(`✅ DocumentService.listDocuments() returned ${userDocuments.length} documents`);
      
      if (userDocuments.length > 0) {
        const firstDoc = userDocuments[0];
        console.log(`   First document originalHash type: ${typeof firstDoc.originalHash}`);
        console.log(`   First document originalHash value: ${firstDoc.originalHash}`);
        console.log(`   First document all keys: ${Object.keys(firstDoc).join(', ')}`);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);