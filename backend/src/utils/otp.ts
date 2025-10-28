import * as crypto from 'crypto';

/**
 * Generates a 6-digit OTP code
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Verifies if the provided OTP matches
 */
export function verifyOTP(providedOTP: string, storedOTP: string): boolean {
  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(providedOTP),
    Buffer.from(storedOTP)
  );
}