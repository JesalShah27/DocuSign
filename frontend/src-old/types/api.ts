// API Response Types
export interface APIResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// Audit Types
export interface AuditLog {
  id: string;
  timestamp: string;
  event: string;
  actorEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: any;
}

// Document Types
export interface Document {
  id: string;
  originalName: string;
  sha256Hash?: string;
  signedHash?: string;
  status: 'pending' | 'signed' | 'rejected';
}

// Envelope Types
export interface Envelope {
  id: string;
  subject?: string;
  message?: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  document: Document;
  signers: EnvelopeSigner[];
}

export interface EnvelopeSigner {
  id: string;
  email: string;
  name: string;
  role: string;
  routingOrder: number;
  status: 'pending' | 'signed' | 'declined';
  signedAt?: string;
  declinedAt?: string;
  ipAddress?: string;
  userAgent?: string;
}

// Field Types
export interface DocumentField {
  id: string;
  type: 'signature' | 'text' | 'date' | 'checkbox';
  required: boolean;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value?: string;
  label?: string;
}

// Auth Types
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  mfaRequired?: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
}

// Error Types
export interface APIError {
  message: string;
  code?: string;
  details?: Record<string, any>;
}