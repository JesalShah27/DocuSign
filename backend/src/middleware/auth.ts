import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, verifySignerSession } from '../utils/jwt.js';

type Role = 'OWNER' | 'ADMIN' | 'USER' | 'GUEST';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

// General authentication middleware
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void | Response {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  
  if (!token) {
    return res.status(401).json({ message: 'Missing authorization token' });
  }

  const user = verifyAccessToken(token);
  if (!user) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  req.user = user;
  return next();
}

// Role-based authorization middleware
export function requireRole(roles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void | Response => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role as Role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    return next();
  };
}

// Signer session middleware for document signing
export function requireSignerSession(req: AuthenticatedRequest, res: Response, next: NextFunction): void | Response {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  
  if (!token) {
    return res.status(401).json({ message: 'Missing signer session token' });
  }

  const session = verifySignerSession(token);
  if (!session) {
    return res.status(401).json({ message: 'Invalid or expired signer session' });
  }

  req.user = {
    id: session.signerId,
    email: session.email,
    role: 'GUEST'
  };
  return next();
}

// Active user check middleware
export function requireActiveUser(req: AuthenticatedRequest, res: Response, next: NextFunction): void | Response {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // TODO: Check if user is active in database
  return next();
}
