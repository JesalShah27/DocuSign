import 'dotenv/config';
import { PrismaClient } from './src/generated/prisma/client.ts';

const prisma = new PrismaClient();

async function checkEnvelope() {
  try {
    const signer = await prisma.envelopeSigner.findFirst({
      where: { signingLink: '0760dbfc-e6b4-47bf-a2b5-f32bf4436f0a' },
      include: { 
        envelope: { 
          include: { document: true } 
        } 
      },
    });
    
    console.log('Signer found:', !!signer);
    if (signer) {
      console.log('Envelope ID:', signer.envelopeId);
      console.log('Envelope status:', signer.envelope?.status);
      console.log('Signer signed at:', signer.signedAt);
      console.log('Document storage path:', signer.envelope?.document?.storagePath);
      console.log('Document original name:', signer.envelope?.document?.originalName);
      
      // Check all signers in this envelope
      const allSigners = await prisma.envelopeSigner.findMany({
        where: { envelopeId: signer.envelopeId, role: 'SIGNER' },
        select: { id: true, email: true, signedAt: true, role: true }
      });
      
      console.log('\nAll signers in envelope:');
      allSigners.forEach((s, i) => {
        console.log(`  ${i+1}. ${s.email} - ${s.signedAt ? 'SIGNED' : 'PENDING'}`);
      });
      
      const allSigned = allSigners.length > 0 && allSigners.every(s => s.signedAt);
      console.log('\nAll required signers signed:', allSigned);
      console.log('Expected envelope status should be:', allSigned ? 'COMPLETED' : 'PARTIALLY_SIGNED');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkEnvelope();