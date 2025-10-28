import { PrismaClient } from '../generated/prisma/client.js';

const prisma = new PrismaClient();

// Global test setup
beforeAll(async () => {
  // Clean up test database
  await prisma.auditLog.deleteMany();
  await prisma.signature.deleteMany();
  await prisma.envelopeSigner.deleteMany();
  await prisma.envelope.deleteMany();
  await prisma.document.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  // Clean up after all tests
  await prisma.auditLog.deleteMany();
  await prisma.signature.deleteMany();
  await prisma.envelopeSigner.deleteMany();
  await prisma.envelope.deleteMany();
  await prisma.document.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
});

afterEach(async () => {
  // Clean up after each test
  await prisma.auditLog.deleteMany();
  await prisma.signature.deleteMany();
  await prisma.envelopeSigner.deleteMany();
  await prisma.envelope.deleteMany();
  await prisma.document.deleteMany();
  await prisma.user.deleteMany();
});
