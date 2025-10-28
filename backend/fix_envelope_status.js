import 'dotenv/config';
import { PrismaClient } from './src/generated/prisma/client.ts';

const prisma = new PrismaClient();

async function fixEnvelopeStatus() {
  try {
    const envelopeId = 'cmgq3x0ej0001ryncdwv9b4rq';
    
    // Check current status
    const envelope = await prisma.envelope.findUnique({
      where: { id: envelopeId },
      select: { id: true, status: true }
    });
    
    console.log('Current envelope status:', envelope?.status);
    
    // Check signers
    const allSigners = await prisma.envelopeSigner.findMany({
      where: { envelopeId: envelopeId, role: 'SIGNER' },
      select: { id: true, email: true, signedAt: true, role: true }
    });
    
    const signedCount = allSigners.filter(s => s.signedAt).length;
    const allSigned = allSigners.length > 0 && allSigners.every(s => s.signedAt);
    
    console.log(`Signers: ${signedCount}/${allSigners.length} signed`);
    console.log('All signed:', allSigned);
    
    let newStatus;
    if (allSigned) {
      newStatus = 'COMPLETED';
    } else if (signedCount > 0) {
      newStatus = 'PARTIALLY_SIGNED';
    } else {
      newStatus = 'SENT';
    }
    
    console.log('Should be status:', newStatus);
    
    if (envelope?.status !== newStatus) {
      console.log(`Updating status from ${envelope.status} to ${newStatus}...`);
      await prisma.envelope.update({
        where: { id: envelopeId },
        data: { status: newStatus }
      });
      console.log('Status updated successfully!');
    } else {
      console.log('Status is already correct.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixEnvelopeStatus();