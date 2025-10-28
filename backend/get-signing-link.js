import { PrismaClient } from './src/generated/prisma/client.js';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function getSigningLink() {
  try {
    const envelope = await prisma.envelope.findFirst({
      where: { id: 'cmgxmzuoh0003ry1gwupyl6ph' },
      include: {
        signers: true
      }
    });

    if (!envelope) {
      console.log('❌ Envelope not found');
      return;
    }

    console.log('✅ Envelope found:');
    console.log(`   ID: ${envelope.id}`);
    console.log(`   Status: ${envelope.status}`);
    console.log('   Signers:');
    
    envelope.signers.forEach((signer, idx) => {
      console.log(`     ${idx + 1}. ${signer.name} (${signer.email})`);
      console.log(`        Signing Link: ${signer.signingLink || 'None'}`);
      console.log(`        Signed At: ${signer.signedAt?.toISOString() || 'Not signed'}`);
    });

    if (envelope.signers.length > 0 && envelope.signers[0].signingLink) {
      console.log('');
      console.log('🔗 Test signing download URL:');
      console.log(`   http://localhost:4000/api/signing/${envelope.signers[0].signingLink}/download`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

getSigningLink();