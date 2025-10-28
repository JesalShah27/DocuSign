import { PrismaClient } from '../generated/prisma/client.js';
import { generateOTP, verifyOTP } from '../utils/otp.js';
import { sendSignerVerificationEmail } from './email.js';
import { createSignerSession } from '../utils/jwt.js';
import type { SignerSession } from '../utils/jwt.js';

const prisma = new PrismaClient();

export interface SignerVerificationResult {
  success: boolean;
  message: string;
  session?: SignerSession;
}

export class SignerVerificationService {
  private static readonly OTP_EXPIRY_MINUTES = 10;
  private static readonly SESSION_EXPIRY_HOURS = 24;

  /**
   * Initiates the signer verification process by generating and sending an OTP
   */
  async initiateVerification(signerId: string): Promise<boolean> {
    try {
      const signer = await prisma.envelopeSigner.findUnique({
        where: { id: signerId },
        include: { envelope: true }
      });

      if (!signer) {
        throw new Error('Signer not found');
      }

      // Generate new OTP
      const otpCode = generateOTP();
      const otpExpiry = new Date();
      otpExpiry.setMinutes(otpExpiry.getMinutes() + SignerVerificationService.OTP_EXPIRY_MINUTES);

      // Update signer with new OTP
      await prisma.envelopeSigner.update({
        where: { id: signerId },
        data: {
          otpCode,
          otpExpiry,
          otpVerified: false,
          sessionToken: null,
          sessionExpiry: null
        }
      });

      // Send verification email
      await sendSignerVerificationEmail(signer.email, signer.name, otpCode);

      return true;
    } catch (error) {
      console.error('Error initiating verification:', error);
      return false;
    }
  }

  /**
   * Verifies the OTP and creates a session if valid
   */
  async verifyOTP(signerId: string, otpCode: string): Promise<SignerVerificationResult> {
    try {
      const signer = await prisma.envelopeSigner.findUnique({
        where: { id: signerId },
        include: { envelope: true }
      });

      if (!signer) {
        return {
          success: false,
          message: 'Invalid signer ID'
        };
      }

      // Check if OTP is expired
      if (!signer.otpExpiry || signer.otpExpiry < new Date()) {
        return {
          success: false,
          message: 'OTP has expired'
        };
      }

      // Verify OTP
      if (!signer.otpCode || !verifyOTP(otpCode, signer.otpCode)) {
        return {
          success: false,
          message: 'Invalid OTP'
        };
      }

      // Create session
      const sessionExpiry = new Date();
      sessionExpiry.setHours(sessionExpiry.getHours() + SignerVerificationService.SESSION_EXPIRY_HOURS);

      const session = createSignerSession(signer);
      
      // Update signer with session info
      await prisma.envelopeSigner.update({
        where: { id: signerId },
        data: {
          otpVerified: true,
          sessionToken: session.token,
          sessionExpiry
        }
      });

      return {
        success: true,
        message: 'Verification successful',
        session
      };
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return {
        success: false,
        message: 'Internal server error'
      };
    }
  }

  /**
   * Validates a signer's session
   */
  async validateSession(signerId: string, sessionToken: string): Promise<boolean> {
    try {
      const signer = await prisma.envelopeSigner.findUnique({
        where: { id: signerId }
      });

      if (!signer) {
        return false;
      }

      return (
        signer.sessionToken === sessionToken &&
        signer.sessionExpiry !== null &&
        signer.sessionExpiry > new Date() &&
        signer.otpVerified
      );
    } catch (error) {
      console.error('Error validating session:', error);
      return false;
    }
  }

  /**
   * Ends a signer's session
   */
  async endSession(signerId: string): Promise<boolean> {
    try {
      await prisma.envelopeSigner.update({
        where: { id: signerId },
        data: {
          sessionToken: null,
          sessionExpiry: null
        }
      });
      return true;
    } catch (error) {
      console.error('Error ending session:', error);
      return false;
    }
  }
}