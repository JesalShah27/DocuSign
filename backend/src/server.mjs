import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';
import { PrismaClient } from './generated/prisma/client.js';
import { body, validationResult } from 'express-validator';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const prisma = new PrismaClient();

// Environment variables (use defaults for development)
const JWT_SECRET = process.env.JWT_SECRET || 'development-secret';
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
const SIGNED_DIR = process.env.SIGNED_DIR || path.join(__dirname, '..', 'signed');

// Ensure upload directories exist
await fs.mkdir(UPLOADS_DIR, { recursive: true });
await fs.mkdir(SIGNED_DIR, { recursive: true });

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());
app.use(morgan('dev'));

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, role: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Auth Routes
app.post('/api/auth/register',
  body('email').isEmail(),
  body('password').isLength({ min: 8 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email, password } = req.body;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(409).json({ message: 'Email already exists' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          role: 'USER'
        }
      });

      const token = jwt.sign(
        { sub: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      res.status(201).json({
        user: { id: user.id, email: user.email },
        token
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Registration failed' });
    }
  }
);

app.post('/api/auth/login',
  body('email').isEmail(),
  body('password').isLength({ min: 8 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email, password } = req.body;
      const user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { sub: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      res.json({
        user: { id: user.id, email: user.email },
        token
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Login failed' });
    }
  }
);

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json(req.user);
});

// Document Routes
app.post('/api/documents/upload', 
  authenticateToken,
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const fileBuffer = await fs.readFile(req.file.path);
      const sha256Hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      const document = await prisma.document.create({
        data: {
          ownerId: req.user.id,
          originalName: req.file.originalname,
          storagePath: req.file.path,
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
          sha256Hash
        }
      });

      res.status(201).json(document);
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ message: 'Upload failed' });
    }
  }
);

app.get('/api/documents', authenticateToken, async (req, res) => {
  try {
    const documents = await prisma.document.findMany({
      where: { ownerId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(documents);
  } catch (error) {
    console.error('List documents error:', error);
    res.status(500).json({ message: 'Failed to list documents' });
  }
});

// Envelope Routes
app.post('/api/envelopes', authenticateToken, async (req, res) => {
  try {
    const { documentId, subject, message, signers, fields } = req.body;

    const envelope = await prisma.envelope.create({
      data: {
        ownerId: req.user.id,
        documentId,
        subject,
        message,
        status: 'DRAFT',
        signers: {
          create: signers.map((signer, index) => ({
            email: signer.email,
            name: signer.name,
            role: signer.role || 'SIGNER',
            routingOrder: signer.routingOrder || index + 1,
            signingLink: crypto.randomBytes(32).toString('hex')
          }))
        },
        fields: {
          create: fields
        }
      },
      include: {
        signers: true,
        fields: true
      }
    });

    res.status(201).json(envelope);
  } catch (error) {
    console.error('Create envelope error:', error);
    res.status(500).json({ message: 'Failed to create envelope' });
  }
});

app.get('/api/envelopes', authenticateToken, async (req, res) => {
  try {
    const envelopes = await prisma.envelope.findMany({
      where: { ownerId: req.user.id },
      include: {
        document: true,
        signers: true,
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(envelopes);
  } catch (error) {
    console.error('List envelopes error:', error);
    res.status(500).json({ message: 'Failed to list envelopes' });
  }
});

app.post('/api/envelopes/:id/send', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const envelope = await prisma.envelope.findUnique({
      where: { id },
      include: { signers: true, document: true }
    });

    if (!envelope) {
      return res.status(404).json({ message: 'Envelope not found' });
    }

    if (envelope.ownerId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Update status
    await prisma.envelope.update({
      where: { id },
      data: { status: 'SENT' }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        envelopeId: id,
        actorEmail: req.user.email,
        actorRole: 'SENDER',
        event: 'SENT',
        details: { message: 'Envelope sent for signing' }
      }
    });

    // Send emails to signers
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    for (const signer of envelope.signers) {
      const signingUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/signing/${signer.signingLink}`;
      
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'docusign@example.com',
        to: signer.email,
        subject: envelope.subject || 'Please sign this document',
        text: `${envelope.message || 'You have a document to sign.'}\n\nClick here to sign: ${signingUrl}`,
        html: `
          <h2>${envelope.subject || 'Please sign this document'}</h2>
          <p>${envelope.message || 'You have a document to sign.'}</p>
          <p><a href="${signingUrl}">Click here to sign</a></p>
        `
      });
    }

    res.json({ message: 'Envelope sent successfully' });
  } catch (error) {
    console.error('Send envelope error:', error);
    res.status(500).json({ message: 'Failed to send envelope' });
  }
});

// Signing Routes
app.get('/api/signing/:link', async (req, res) => {
  try {
    const { link } = req.params;
    const signer = await prisma.envelopeSigner.findUnique({
      where: { signingLink: link },
      include: {
        envelope: {
          include: {
            document: true,
            fields: {
              where: {
                signerId: { equals: '' } // Will be filled with actual signer ID
              }
            }
          }
        }
      }
    });

    if (!signer) {
      return res.status(404).json({ message: 'Invalid signing link' });
    }

    if (signer.signedAt) {
      return res.status(400).json({ message: 'Document already signed' });
    }

    // Generate OTP if not already generated or expired
    if (!signer.otpCode || !signer.otpExpiry || new Date(signer.otpExpiry) < new Date()) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await prisma.envelopeSigner.update({
        where: { id: signer.id },
        data: { otpCode: otp, otpExpiry }
      });

      // Send OTP email
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'docusign@example.com',
        to: signer.email,
        subject: 'Your signing verification code',
        text: `Your verification code is: ${otp}\nThis code will expire in 10 minutes.`,
        html: `
          <h2>Your signing verification code</h2>
          <p>Your verification code is: <strong>${otp}</strong></p>
          <p>This code will expire in 10 minutes.</p>
        `
      });
    }

    res.json({
      signer: {
        id: signer.id,
        name: signer.name,
        email: signer.email,
        otpVerified: signer.otpVerified
      },
      envelope: {
        id: signer.envelope.id,
        subject: signer.envelope.subject,
        document: {
          id: signer.envelope.document.id,
          name: signer.envelope.document.originalName
        }
      }
    });
  } catch (error) {
    console.error('Get signing session error:', error);
    res.status(500).json({ message: 'Failed to get signing session' });
  }
});

app.post('/api/signing/:link/verify', async (req, res) => {
  try {
    const { link } = req.params;
    const { otp } = req.body;

    const signer = await prisma.envelopeSigner.findUnique({
      where: { signingLink: link }
    });

    if (!signer) {
      return res.status(404).json({ message: 'Invalid signing link' });
    }

    if (signer.signedAt) {
      return res.status(400).json({ message: 'Document already signed' });
    }

    if (!signer.otpCode || !signer.otpExpiry || new Date(signer.otpExpiry) < new Date()) {
      return res.status(400).json({ message: 'OTP expired' });
    }

    if (signer.otpCode !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // Generate session token
    const sessionToken = jwt.sign(
      { sub: signer.id, email: signer.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    await prisma.envelopeSigner.update({
      where: { id: signer.id },
      data: {
        otpVerified: true,
        sessionToken,
        sessionExpiry: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      }
    });

    res.json({ sessionToken });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'Failed to verify OTP' });
  }
});

app.post('/api/signing/:link/sign',
  async (req, res) => {
    try {
      const { link } = req.params;
      const { signature, fields } = req.body;

      const signer = await prisma.envelopeSigner.findUnique({
        where: { signingLink: link },
        include: { envelope: true }
      });

      if (!signer) {
        return res.status(404).json({ message: 'Invalid signing link' });
      }

      if (signer.signedAt) {
        return res.status(400).json({ message: 'Document already signed' });
      }

      if (!signer.otpVerified) {
        return res.status(400).json({ message: 'OTP verification required' });
      }

      // Save signature
      await prisma.signature.create({
        data: {
          signerId: signer.id,
          consentGiven: true,
          imagePath: signature.imagePath,
          drawnPoints: signature.drawnPoints
        }
      });

      // Update fields
      for (const field of fields) {
        await prisma.documentField.update({
          where: { id: field.id },
          data: { value: field.value }
        });
      }

      // Update signer status
      await prisma.envelopeSigner.update({
        where: { id: signer.id },
        data: {
          signedAt: new Date(),
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        }
      });

      // Check if all signers have signed
      const allSigners = await prisma.envelopeSigner.findMany({
        where: { envelopeId: signer.envelope.id }
      });

      const allSigned = allSigners.every(s => s.signedAt);
      if (allSigned) {
        await prisma.envelope.update({
          where: { id: signer.envelope.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date()
          }
        });
      } else {
        await prisma.envelope.update({
          where: { id: signer.envelope.id },
          data: { status: 'PARTIALLY_SIGNED' }
        });
      }

      // Create audit log
      await prisma.auditLog.create({
        data: {
          envelopeId: signer.envelope.id,
          actorEmail: signer.email,
          actorRole: 'SIGNER',
          event: 'SIGNED',
          details: {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
          }
        }
      });

      res.json({ message: 'Document signed successfully' });
    } catch (error) {
      console.error('Sign document error:', error);
      res.status(500).json({ message: 'Failed to sign document' });
    }
  }
);

// Start server
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});