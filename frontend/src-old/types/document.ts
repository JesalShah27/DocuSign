export interface Document {
  id: string;
  ownerId: string;
  originalName: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  originalHash: string;
  completeSignedPdfHash?: string;
  signedPdfPath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentWithSigners extends Document {
  signers: Array<{
    id: string;
    name: string;
    email: string;
    signedAt?: string;
    declinedAt?: string;
  }>;
}