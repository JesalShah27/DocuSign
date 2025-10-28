import crypto from 'crypto';
import fs from 'fs';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);

/**
 * Computes the SHA-256 hash of a file
 * @param filePath Path to the file
 * @returns Promise resolving to the hex-encoded SHA-256 hash
 */
export async function computeFileHash(filePath: string): Promise<string> {
  const fileBuffer = await readFile(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

/**
 * Computes the SHA-256 hash of a buffer
 * @param buffer Data buffer to hash
 * @returns The hex-encoded SHA-256 hash
 */
export function computeBufferHash(buffer: Buffer): string {
  const hashSum = crypto.createHash('sha256');
  hashSum.update(buffer);
  return hashSum.digest('hex');
}

/**
 * Computes the SHA-256 hash of a file using a readable stream
 * Useful for large files to avoid loading entire file into memory
 * @param filePath Path to the file
 * @returns Promise resolving to the hex-encoded SHA-256 hash
 */
export function computeStreamHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hashSum = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (data) => {
      hashSum.update(data);
    });

    stream.on('end', () => {
      resolve(hashSum.digest('hex'));
    });

    stream.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Verifies that a file matches a given SHA-256 hash
 * @param filePath Path to the file
 * @param expectedHash Expected SHA-256 hash (hex-encoded)
 * @returns Promise resolving to boolean indicating if hashes match
 */
export async function verifyFileHash(filePath: string, expectedHash: string): Promise<boolean> {
  try {
    const actualHash = await computeStreamHash(filePath);
    return actualHash.toLowerCase() === expectedHash.toLowerCase();
  } catch (error) {
    console.error('Error verifying file hash:', error);
    return false;
  }
}