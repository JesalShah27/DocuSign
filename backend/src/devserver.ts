import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { PrismaClient } from './generated/prisma/client.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import documentsRouter from './routes/documents.js';

type ErrorResponse = {
  message: string;
  field?: string;
  details?: unknown;
};

interface RequestWithBody<T> extends Request {
  body: T;
}

interface RegisterBody {
  name: string;
  email: string;
  password: string;
}

interface LoginBody {
  email: string;
  password: string;
}

interface AuthResponse {
  user: {
    id: string;
    email: string;
  };
  token: string;
}

const app = express();
const prisma = new PrismaClient();
const JWT_SECRET: string = process.env['JWT_SECRET'] || 'development-secret';

// Middleware
app.use(cors({
  origin: function(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      process.env['FRONTEND_URL']
    ].filter(Boolean);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add request logging
app.use((req: Request, _res: Response, next) => {
  console.log(`${req.method} ${req.path}`, {
    body: req.body,
    query: req.query,
    headers: req.headers
  });
  next();
});

app.use(express.json());
app.use(morgan('dev'));

// Mount document routes
app.use('/api/documents', documentsRouter);

// Routes
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' as const });
});

app.post('/api/auth/register', async (req: RequestWithBody<RegisterBody>, res: Response<AuthResponse | ErrorResponse>): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    if (!name) {
      res.status(400).json({
        message: 'Name is required',
        field: 'name'
      });
      return;
    }

    if (!email) {
      res.status(400).json({
        message: 'Email is required',
        field: 'email'
      });
      return;
    }

    if (!password) {
      res.status(400).json({
        message: 'Password is required',
        field: 'password'
      });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({
        message: 'Password must be at least 8 characters',
        field: 'password'
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        message: 'Invalid email format',
        field: 'email'
      });
      return;
    }

    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ message: 'Email already exists' });
      return;
    }

    // Create new user
    console.log('Starting user registration for:', email);
    const passwordHash = await bcrypt.hash(password, 12);
    console.log('Password hashed successfully');
    
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: 'USER'
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true
      }
    });
    
    console.log('User created successfully:', { id: user.id, email: user.email });

    // Generate token
    const token = jwt.sign(
      { sub: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(201).json({
      user: { id: user.id, email: user.email },
      token
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    
    // Check for specific Prisma errors
    if (error?.code === 'P2002') {
      res.status(409).json({ 
        message: 'Email already exists',
        field: 'email'
      });
      return;
    }
    
    // Database connection errors
    if (error?.code === 'P1001' || error?.code === 'P1002') {
      res.status(503).json({ 
        message: 'Database connection error, please try again later'
      });
      return;
    }

    res.status(500).json({ 
      message: 'Registration failed',
      details: process.env['NODE_ENV'] === 'development' ? error?.message : undefined
    });
  }
});

app.post('/api/auth/login', async (req: RequestWithBody<LoginBody>, res: Response<AuthResponse | ErrorResponse>): Promise<void> => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
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
});

// Protected route example
app.get('/api/auth/me', async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'No token provided' });
    return;
  }

  try {
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || !parts[1]) {
      res.status(401).json({ message: 'Invalid token format' });
      return;
    }
    const token: string = parts[1];
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    if (!decoded.sub) {
      res.status(401).json({ message: 'Invalid token payload' });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub as string },
      select: { id: true, email: true, role: true }
    });

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

const PORT = process.env['PORT'] || 4000;

app.listen(PORT, () => {
  console.log(`Development server running on http://localhost:${PORT}`);
});