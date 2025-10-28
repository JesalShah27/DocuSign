import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { PrismaClient, Role } from '../generated/prisma/client.js';
import speakeasy from 'speakeasy';
import { requireAuth } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { createUserTokens, verifyRefreshToken } from '../utils/jwt.js';
const prisma = new PrismaClient();
const router = Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(parseInt(process.env['PASSWORD_MIN_LENGTH'] || '12')),
  name: z.string().min(2)
});

router.post('/register', async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const { email, password, name } = parsed.data;

  // Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ 
      message: `A user is already registered with this email address: ${email}`,
      error: 'USER_ALREADY_EXISTS',
      suggestion: 'Please try logging in instead, or use a different email address.'
    });
  }

  // Hash password and create user
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: Role.USER,
      lastLoginAt: new Date(),
      lastLoginIp: req.ip || null
    }
  });

  // Generate tokens for automatic login after registration
  const tokens = createUserTokens({
    id: user.id,
    email: user.email,
    role: user.role
  });

  return res.status(201).json({
    ...tokens,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    },
    message: 'Account created successfully! Welcome to DocUsign.'
  });
});

// Import moved to top of file

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(parseInt(process.env['PASSWORD_MIN_LENGTH'] || '12'))
});

router.post('/login', async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const { email, password } = parsed.data;

  // Find user and verify credentials
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  if (!user.isActive) {
    return res.status(403).json({ message: 'Account is inactive' });
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // Check if MFA is required
  if (user.mfaSecret) {
    return res.json({ mfaRequired: true });
  }

  // Generate tokens
  const tokens = createUserTokens({
    id: user.id,
    email: user.email,
    role: user.role
  });

  // Update last login info
  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      lastLoginIp: req.ip || null
    }
  });

  return res.json({
    ...tokens,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    },
    mfaRequired: false
  });
});

// Generate TOTP secret and otpauth URL for QR
router.post('/mfa/setup', requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (user.mfaSecret) return res.status(400).json({ message: 'MFA already enabled' });
  const secret = speakeasy.generateSecret({ name: `DocUsign (${user.email})`, length: 20 });
  // Store temp secret in DB or return to client for immediate verify; for simplicity, return to client
  return res.json({ base32: secret.base32, otpauth_url: secret.otpauth_url });
});

// Enable MFA: verify provided TOTP and persist secret
router.post('/mfa/enable', requireAuth, async (req: AuthenticatedRequest, res) => {
  const Schema = z.object({ base32: z.string(), token: z.string().min(6).max(6) });
  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const { base32, token } = parsed.data;
  const ok = speakeasy.totp.verify({ secret: base32, encoding: 'base32', token, window: 1 });
  if (!ok) return res.status(400).json({ message: 'Invalid TOTP' });
  const user = await prisma.user.update({ where: { id: req.user!.id }, data: { mfaSecret: base32 } });
  return res.json({ enabled: true, email: user.email });
});

// Verify TOTP during login flow
router.post('/mfa/verify', async (req, res) => {
  const Schema = z.object({
    email: z.string().email(),
    token: z.string().min(6).max(6)
  });

  const parsed = Schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(parsed.error.flatten());
  }

  const { email, token } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.mfaSecret) {
    return res.status(400).json({ message: 'MFA not enabled' });
  }

  if (!user.isActive) {
    return res.status(403).json({ message: 'Account is inactive' });
  }

  const isValid = speakeasy.totp.verify({
    secret: user.mfaSecret,
    encoding: 'base32',
    token,
    window: 1
  });

  if (!isValid) {
    return res.status(401).json({ message: 'Invalid TOTP code' });
  }

  // Generate tokens
  const tokens = createUserTokens({
    id: user.id,
    email: user.email,
    role: user.role
  });

  // Update last login info
  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      lastLoginIp: req.ip || null
    }
  });

  return res.json({
    ...tokens,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  });
});

// Get current user info
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      emailVerified: true,
      createdAt: true,
      lastLoginAt: true
    }
  });

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  return res.json(user);
});

// Handle refresh token
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token required' });
  }

  const userId = verifyRefreshToken(refreshToken);
  if (!userId) {
    return res.status(401).json({ message: 'Invalid refresh token' });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true
    }
  });

  if (!user || !user.isActive) {
    return res.status(401).json({ message: 'Invalid refresh token' });
  }

  const tokens = createUserTokens({
    id: user.id,
    email: user.email,
    role: user.role
  });

  return res.json(tokens);
});

export default router;


