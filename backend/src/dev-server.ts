import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import https from 'https';
import helmet from 'helmet';
import authRouter from './routes/auth.js';
import documentsRouter from './routes/documents.js';
import envelopesRouter from './routes/envelopes.js';
import signingRouter from './routes/signing.js';

// Create Express app
const app = express();

// Configure CORS
const corsOptions = {
  origin: process.env['FRONTEND_URL'] || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Configure security middleware
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Configure routes
app.use('/uploads', express.static('uploads'));
app.use('/api/auth', authRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/envelopes', envelopesRouter);
app.use('/sign', signingRouter);

const PORT = process.env['PORT'] || 4000;
const HTTPS_PORT = process.env['HTTPS_PORT'] || 4443;

// Start HTTP server (for development)
app.listen(PORT, () => {
  console.log(`HTTP server running on http://localhost:${PORT}`);
});

// Start HTTPS server
const httpsOptions = {
  key: fs.readFileSync(path.resolve(__dirname, '../certs/key.pem')),
  cert: fs.readFileSync(path.resolve(__dirname, '../certs/cert.pem'))
};

https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
  console.log(`HTTPS server running on https://localhost:${HTTPS_PORT}`);
});