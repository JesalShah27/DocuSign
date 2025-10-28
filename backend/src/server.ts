import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import https from 'https';
import fs from 'node:fs';
import authRouter from './routes/auth.js';
import healthRouter from './routes/health.js';
import documentsRouter from './routes/documents.js';
import envelopesRouter from './routes/envelopes.js';
import signingRouter from './routes/signing.js';
import downloadRouter from './routes/download.js';
import fieldsRouter from './routes/fields.js';
import verificationRouter from './routes/verification.js';
import analyticsRouter from './routes/analytics.js';

import { attachRequestMeta } from './middleware/audit.js';
import { 
  validateRequest, 
  securityHeaders, 
  fileUploadSecurity,
  securityAudit 
} from './middleware/security.js';

const app = express();

// Enhanced security headers and CSP
if (process.env['NODE_ENV'] === 'production') {
  app.use(helmet());
} else {
  // Development-specific security configuration
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", "http://localhost:4000", "http://localhost:3000"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false
  }));
}

// CORS middleware
app.use((req, res, next) => {
  // Handle CORS
  const allowedOrigin = process.env['NODE_ENV'] === 'production'
    ? process.env['ALLOWED_ORIGIN']
    : 'http://localhost:3000';

  // Log origin for debugging
  console.log('DEBUG: Request origin:', req.headers.origin);
  console.log('DEBUG: Allowed origin:', allowedOrigin);

  res.header('Access-Control-Allow-Origin', allowedOrigin || 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

// Apply security middleware
app.use(securityHeaders);
app.use(validateRequest);
app.use(securityAudit);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(attachRequestMeta);

app.use('/uploads', express.static('uploads'));

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter); // No rate limiting
app.use('/api/documents', fileUploadSecurity, documentsRouter);
app.use('/api/envelopes', envelopesRouter);
app.use('/sign', signingRouter);
app.use('/api/download', downloadRouter);
app.use('/api/fields', fieldsRouter);
app.use('/api/verify', verificationRouter);
app.use('/api/analytics', analyticsRouter);


const PORT = process.env['PORT'] || 4000;
const HTTPS_PORT = process.env['HTTPS_PORT'] || 4443;

// Start HTTP server
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`HTTP API listening on port ${PORT}`);
});

// Start HTTPS server if certificates are available
let httpsOptions: { key?: Buffer; cert?: Buffer } | null = null;
try {
  const keyPath = process.env['SSL_KEY_PATH'];
  const certPath = process.env['SSL_CERT_PATH'];
  if (keyPath && certPath && fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
  }
} catch (err) {
  // eslint-disable-next-line no-console
  console.warn('HTTPS certificate load failed, continuing without HTTPS:', err);
}

if (httpsOptions?.key && httpsOptions?.cert) {
  https.createServer(httpsOptions, app).listen(HTTPS_PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`HTTPS API listening on port ${HTTPS_PORT}`);
  });
} else {
  // eslint-disable-next-line no-console
  console.log('HTTPS not configured - set SSL_KEY_PATH and SSL_CERT_PATH environment variables');
}


