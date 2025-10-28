/**
 * Hash utilities for the DocUsign application
 * 
 * Provides functions for calculating document hashes and managing PDF metadata.
 */

/**
 * Calculate SHA-256 hash of a file or blob
 */
export async function calculateFileHash(file: Blob): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Calculate hash of a string
 */
export async function calculateStringHash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Generate signature verification data
 */
export function generateSignatureData(signatureInfo: {
  documentHash: string;
  signerEmail: string;
  signedAt: string;
  location?: { latitude: number; longitude: number };
  signaturePlacement: { pageNumber: number; x: number; y: number; width: number; height: number };
}): string {
  return JSON.stringify({
    documentHash: signatureInfo.documentHash,
    signerEmail: signatureInfo.signerEmail,
    signedAt: signatureInfo.signedAt,
    location: signatureInfo.location,
    signaturePlacement: signatureInfo.signaturePlacement,
    timestamp: new Date().toISOString(),
    version: '1.0'
  }, null, 2);
}

/**
 * Validate document integrity by comparing hashes
 */
export async function validateDocumentIntegrity(
  originalHash: string, 
  currentDocument: Blob
): Promise<boolean> {
  try {
    const currentHash = await calculateFileHash(currentDocument);
    return originalHash === currentHash;
  } catch (error) {
    console.error('Error validating document integrity:', error);
    return false;
  }
}