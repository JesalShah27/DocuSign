import { Request, Response, NextFunction, RequestHandler } from 'express';

interface RequestWithId extends Request {
  requestId?: string;
}

// Request validation middleware
export const validateRequest: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  // Check for common attack patterns
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /union\s+select/i,
    /drop\s+table/i,
    /insert\s+into/i,
    /delete\s+from/i,
    /update\s+set/i,
    /exec\s*\(/i,
    /eval\s*\(/i
  ];

  const checkString = (str: string) => {
    return suspiciousPatterns.some(pattern => pattern.test(str));
  };

  // Check URL parameters
  const url = req.url.toLowerCase();
  if (checkString(url)) {
    res.status(400).json({
      error: 'Invalid Request',
      message: 'Request contains potentially malicious content.'
    });
    return;
  }

  // Check request body
  if (req.body && typeof req.body === 'object') {
    const bodyStr = JSON.stringify(req.body).toLowerCase();
    if (checkString(bodyStr)) {
      res.status(400).json({
        error: 'Invalid Request',
        message: 'Request body contains potentially malicious content.'
      });
      return;
    }
  }

  next();
};

// Security headers middleware
export const securityHeaders: RequestHandler = (_req: RequestWithId, res: Response, next: NextFunction): void => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Add custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Set CSP headers based on environment
  if (process.env['NODE_ENV'] === 'production') {
    res.setHeader('Content-Security-Policy', `
      default-src 'self';
      script-src 'self';
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: blob:;
      font-src 'self';
      object-src 'none';
      media-src 'self';
      frame-src 'self';
      connect-src 'self'
    `.replace(/\s+/g, ' ').trim());
  } else {
    res.setHeader('Content-Security-Policy', `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline';
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: blob:;
      font-src 'self';
      object-src 'none';
      media-src 'self';
      frame-src 'self';
      connect-src 'self' http://localhost:4000 http://localhost:3000
    `.replace(/\s+/g, ' ').trim());
  }

  // Set CORS headers
  const allowedOrigin = process.env['NODE_ENV'] === 'production' 
    ? (process.env['ALLOWED_ORIGIN'] || 'https://yourdomain.com')
    : 'http://localhost:3000';

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Add request ID for tracking
  const requestId = Math.random().toString(36).substring(2, 15);
  res.setHeader('X-Request-ID', requestId);
  (_req as RequestWithId).requestId = requestId;

  next();
};

// File upload security
export const fileUploadSecurity: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  if (req.file) {
    // Check file type
    const allowedTypes = ['application/pdf'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      res.status(400).json({
        error: 'Invalid File Type',
        message: 'Only PDF files are allowed.'
      });
      return;
    }

    // Check file size (20MB limit)
    const maxSize = 20 * 1024 * 1024;
    if (req.file.size > maxSize) {
      res.status(400).json({
        error: 'File Too Large',
        message: 'File size must be less than 20MB.'
      });
      return;
    }

    // Check for malicious content in filename
    const suspiciousChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (suspiciousChars.test(req.file.originalname)) {
      res.status(400).json({
        error: 'Invalid Filename',
        message: 'Filename contains invalid characters.'
      });
      return;
    }
  }

  next();
};

// Audit logging for security events
export const securityAudit: RequestHandler = (req: RequestWithId, res: Response, next: NextFunction): void => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log security-relevant events
    if (res.statusCode >= 400) {
      const securityEvent = {
        timestamp: new Date(),
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        requestId: req.requestId
      };

      // In production, log to a security monitoring system
      console.warn('Security Event:', securityEvent);
    }

    return originalSend.call(this, data);
  };

  next();
};