/**
 * Document-related types for the DocUsign application
 */

export interface Document {
  id: string;
  ownerId: string;
  originalName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  // Hash fields may be present under different names depending on backend workflow
  sha256Hash?: string;
  originalHash?: string;
  signedHash?: string;
  completeSignedPdfHash?: string;
  status: 'pending' | 'signed' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

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

export interface SignaturePlacement {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DocumentPreview {
  url: string;
  httpHeaders?: Record<string, string>;
  withCredentials?: boolean;
}