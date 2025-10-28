/**
 * Application constants for the DocUsign application
 * 
 * Centralized location for all application constants.
 */

// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_URL || 'http://localhost:4000/api',
  TIMEOUT: 30000,
} as const;

// File Upload Limits
export const FILE_LIMITS = {
  MAX_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ['application/pdf'],
  ALLOWED_EXTENSIONS: ['.pdf'],
} as const;

// Document Status Values
export const DOCUMENT_STATUS = {
  PENDING: 'pending',
  SIGNED: 'signed',
  REJECTED: 'rejected',
} as const;

// Envelope Status Values
export const ENVELOPE_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  DECLINED: 'declined',
  VOIDED: 'voided',
} as const;

// Signer Status Values
export const SIGNER_STATUS = {
  PENDING: 'pending',
  SIGNED: 'signed',
  DECLINED: 'declined',
} as const;

// Location Permission States
export const LOCATION_PERMISSION = {
  GRANTED: 'granted',
  DENIED: 'denied',
  PROMPT: 'prompt',
} as const;

// Default Signature Placement
export const SIGNATURE_DEFAULTS = {
  WIDTH: 0.25,
  HEIGHT: 0.08,
  DEFAULT_X: 0.1,
  DEFAULT_Y: 0.1,
} as const;

// UI Messages
export const UI_MESSAGES = {
  ERRORS: {
    NETWORK: 'Network error. Please check your connection and try again.',
    UNAUTHORIZED: 'Your session has expired. Please log in again.',
    FORBIDDEN: 'You do not have permission to perform this action.',
    NOT_FOUND: 'The requested resource was not found.',
    VALIDATION: 'Please check your input and try again.',
    UNKNOWN: 'An unexpected error occurred. Please try again.',
  },
  SUCCESS: {
    LOGIN: 'Successfully logged in!',
    REGISTER: 'Account created successfully!',
    DOCUMENT_UPLOADED: 'Document uploaded successfully!',
    ENVELOPE_CREATED: 'Envelope created successfully!',
    DOCUMENT_SIGNED: 'Document signed successfully!',
  },
  LOADING: {
    SIGNING_IN: 'Signing you in...',
    UPLOADING: 'Uploading document...',
    CREATING_ENVELOPE: 'Creating envelope...',
    SIGNING_DOCUMENT: 'Signing document...',
  },
} as const;

// PDF.js Configuration
export const PDF_CONFIG = {
  WORKER_SRC: '//cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
} as const;

// Route Paths
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DOCUMENTS: '/documents',
  ENVELOPES: '/envelopes',
  ENVELOPE_DETAILS: '/envelopes/:id',
  SIGNING: '/sign/:link',
  ANALYTICS: '/analytics',
} as const;
