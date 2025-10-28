import express from 'express';
import { validateRequest } from '../middleware/validation.js';
import { SignerVerificationService } from '../services/verification.js';
import type { Schema } from 'express-validator';

const signerIdSchema: Schema = {
  signerId: {
    in: ['params'],
    isString: true,
    notEmpty: true,
    errorMessage: 'Valid signer ID is required'
  }
};

const otpSchema: Schema = {
  signerId: {
    in: ['params'],
    isString: true,
    notEmpty: true,
    errorMessage: 'Valid signer ID is required'
  },
  otpCode: {
    in: ['body'],
    isString: true,
    isLength: {
      options: { min: 6, max: 6 }
    },
    errorMessage: 'OTP must be exactly 6 characters'
  }
};

const router = express.Router();
const verificationService = new SignerVerificationService();

// Initiate verification by sending OTP
router.post(
  '/signers/:signerId/verify',
  validateRequest(signerIdSchema),
  async (req, res) => {
    try {
      const { signerId } = req.params;
      
      if (!signerId) {
        return res.status(400).json({
          success: false,
          message: 'Signer ID is required'
        });
      }

      const success = await verificationService.initiateVerification(signerId);

      if (!success) {
        return res.status(400).json({
          success: false,
          message: 'Failed to initiate verification'
        });
      }

      return res.json({
        success: true,
        message: 'Verification code sent'
      });
    } catch (error) {
      console.error('Error initiating verification:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Verify OTP and create session
router.post(
  '/signers/:signerId/verify/otp',
  validateRequest(otpSchema),
  async (req, res) => {
    try {
      const { signerId } = req.params;
      const { otpCode } = req.body;

      if (!signerId || !otpCode) {
        return res.status(400).json({
          success: false,
          message: 'Signer ID and OTP code are required'
        });
      }

      const result = await verificationService.verifyOTP(signerId, otpCode);

      if (!result.success) {
        return res.status(400).json(result);
      }

      // Set session cookie if verification successful
      if (result.session) {
        res.cookie('signer_session', result.session.token, {
          httpOnly: true,
          secure: process.env['NODE_ENV'] === 'production',
          sameSite: 'strict',
          maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });
      }

      return res.json(result);
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// Validate session
router.get(
  '/signers/:signerId/session',
  validateRequest(signerIdSchema),
  async (req, res) => {
    try {
      const { signerId } = req.params;
      const sessionToken = req.cookies.signer_session;

      if (!signerId || !sessionToken) {
        return res.status(401).json({
          success: false,
          message: !signerId ? 'Signer ID is required' : 'No session found'
        });
      }

      const isValid = await verificationService.validateSession(signerId, sessionToken);

      return res.json({
        success: isValid,
        message: isValid ? 'Session is valid' : 'Session is invalid'
      });
    } catch (error) {
      console.error('Error validating session:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

// End session
router.post(
  '/signers/:signerId/session/end',
  validateRequest(signerIdSchema),
  async (req, res) => {
    try {
      const { signerId } = req.params;
      
      if (!signerId) {
        return res.status(400).json({
          success: false,
          message: 'Signer ID is required'
        });
      }

      const success = await verificationService.endSession(signerId);

      if (success) {
        res.clearCookie('signer_session');
      }

      return res.json({
        success,
        message: success ? 'Session ended' : 'Failed to end session'
      });
    } catch (error) {
      console.error('Error ending session:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
);

export default router;