import { Response } from 'express';
import { type Envelope, type Document, type EnvelopeSigner } from '../generated/prisma/client.js';

export type JsonResponse<T = any> = Response<T, Record<string, any>>;

export interface ErrorResponse {
  message: string;
  [key: string]: any;
}

export interface SerializedSignature {
  id: string;
  signerId: string;
  consentGiven: boolean;
  consentText: string | null;
  imagePath: string | null;
  drawnPoints: any;
  createdAt: string;
}

export interface SerializedSigner extends Omit<EnvelopeSigner, 'signedAt' | 'signature' | 'otpExpiry' | 'sessionExpiry' | 'declinedAt'> {
  signedAt: string | null;
  otpExpiry: string | null;
  sessionExpiry: string | null;
  declinedAt: string | null;
  signature: SerializedSignature | null;
}

export interface SerializedDocument extends Omit<Document, 'createdAt' | 'updatedAt'> {
  createdAt: string;
  updatedAt: string;
}

export interface SerializedEnvelope extends Omit<Envelope, 'createdAt' | 'updatedAt' | 'completedAt'> {
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  document?: SerializedDocument;
  signers?: SerializedSigner[];
  owner?: {
    email: string;
  };
}

