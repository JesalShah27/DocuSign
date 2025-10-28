/**
 * Envelope-related types for the DocUsign application
 */

import { Document } from './document';

export interface Envelope {
  id: string;
  subject?: string | null;
  message?: string | null;
  status: 'DRAFT' | 'SENT' | 'VIEWED' | 'PARTIALLY_SIGNED' | 'COMPLETED' | 'DECLINED' | 'VOIDED';
  createdAt: string;
  completedAt?: string | null;
  document: Document;
  signers: EnvelopeSigner[];
  compliance?: {
    consentText: string;
    legalNotice: string;
  };
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

export interface CreateEnvelopeRequest {
  documentId: string;
  subject?: string;
  message?: string;
  signers: Array<{
    email: string;
    name: string;
    role: string;
    routingOrder: number;
  }>;
}

export interface SigningRequest {
  signature: string;
  consent: boolean;
  location?: {
    latitude: number;
    longitude: number;
  };
  placement: {
    pageNumber: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };
}