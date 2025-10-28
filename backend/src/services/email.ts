import nodemailer from 'nodemailer';

// Email service interface types
export interface SigningInvitation {
  signerName: string;
  signerEmail: string;
  documentName: string;
  envelopeSubject?: string;
  envelopeMessage?: string;
  signingLink: string;
  otpCode: string;
  senderName?: string;
  senderEmail?: string;
}

export interface CompletionNotification {
  signerName: string;
  signerEmail: string;
  documentName: string;
  envelopeSubject?: string;
  signedAt: Date;
  allSigners: Array<{
    name: string;
    email: string;
    signedAt?: Date;
    declinedAt?: Date;
  }>;
  downloadLink?: string;
  certificateLink?: string;
}

export interface EmailVerification {
  email: string;
  name: string;
  verificationLink: string;
}

export interface PasswordReset {
  email: string;
  name: string;
  resetLink: string;
}

// Initialize Gmail transporter with better error handling and logging
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env['EMAIL_USER'],
    pass: process.env['EMAIL_PASS']
  },
  debug: true, // Enable debugging
  logger: true // Enable logging
});

// Enhanced helper function to check email configuration
async function verifyEmailConfig(): Promise<boolean> {
  if (!process.env['EMAIL_USER'] || !process.env['EMAIL_PASS']) {
    console.error('Gmail configuration error: EMAIL_USER or EMAIL_PASS environment variables are missing');
    return false;
  }

  try {
    await transporter.verify();
    console.log('Email configuration verified successfully');
    console.log('Using email account:', process.env['EMAIL_USER']);
    return true;
  } catch (error) {
    console.error('Email verification failed:', error);
    return false;
  }
}

// Initialize email configuration
let isEmailVerified = false;
verifyEmailConfig().then(verified => {
  isEmailVerified = verified;
});

// Helper function to handle email sending with retries
async function sendMailWithRetry(mailOptions: nodemailer.SendMailOptions, retries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (!isEmailVerified) {
        isEmailVerified = await verifyEmailConfig();
        if (!isEmailVerified) {
          console.error('Email configuration is invalid');
          return false;
        }
      }

      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', {
        messageId: info.messageId,
        response: info.response,
        to: mailOptions.to,
        subject: mailOptions.subject
      });
      return true;
    } catch (error) {
      console.error(`Email sending attempt ${attempt} failed:`, error);
      if (attempt === retries) {
        return false;
      }
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  return false;
}

export async function sendSigningInvitation(invitation: SigningInvitation): Promise<boolean> {
  if (!isEmailVerified && !(await verifyEmailConfig())) {
    console.log('Signing invitation details (not sent):', invitation);
    return false;
  }

  const mailOptions = {
    from: `"${process.env['FROM_NAME']}" <${process.env['EMAIL_USER']}>`,
    to: invitation.signerEmail,
    subject: `Signing Request: ${invitation.documentName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Document Signing Request</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
          .otp-box { background: #fef3c7; border: 2px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; text-align: center; }
          .otp-code { font-size: 24px; font-weight: bold; color: #92400e; font-family: monospace; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📄 Document Signing Request</h1>
          </div>
          <div class="content">
            <h2>Hello ${invitation.signerName},</h2>
            
            <p>You have been requested to sign a document:</p>
            <p><strong>Document:</strong> ${invitation.documentName}</p>
            ${invitation.envelopeSubject ? `<p><strong>Subject:</strong> ${invitation.envelopeSubject}</p>` : ''}
            ${invitation.envelopeMessage ? `<p><strong>Message:</strong> ${invitation.envelopeMessage}</p>` : ''}
            
            <div class="otp-box">
              <p><strong>Your OTP Code:</strong></p>
              <div class="otp-code">${invitation.otpCode}</div>
              <p style="margin: 10px 0 0 0; font-size: 14px;">Use this code to verify your identity when signing</p>
            </div>
            
            <p>Click the button below to access the document and sign it:</p>
            <a href="${invitation.signingLink}" class="button" style="color: white;">Sign Document</a>
            
            <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
              <strong>Important:</strong> This link is unique to you and should not be shared. 
              The OTP code is required to verify your identity before signing.
            </p>
            
            <p style="font-size: 14px; color: #6b7280;">
              If you did not expect this request, please ignore this email.
            </p>
          </div>
          <div class="footer">
            <p>This email was sent by DocUsign - Secure Electronic Signatures</p>
            <p>© ${new Date().getFullYear()} DocUsign. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Document Signing Request
      
      Hello ${invitation.signerName},
      
      You have been requested to sign a document: ${invitation.documentName}
      ${invitation.envelopeSubject ? `Subject: ${invitation.envelopeSubject}` : ''}
      ${invitation.envelopeMessage ? `Message: ${invitation.envelopeMessage}` : ''}
      
      Your OTP Code: ${invitation.otpCode}
      Use this code to verify your identity when signing.
      
      Signing Link: ${invitation.signingLink}
      
      Important: This link is unique to you and should not be shared. 
      The OTP code is required to verify your identity before signing.
      
      If you did not expect this request, please ignore this email.
      
      --
      DocUsign - Secure Electronic Signatures
    `
  };

  return sendMailWithRetry(mailOptions);
}

export async function sendCompletionNotification(notification: CompletionNotification): Promise<boolean> {
  if (!isEmailVerified && !(await verifyEmailConfig())) {
    console.log('Completion notification details (not sent):', notification);
    return false;
  }

  const signedSigners = notification.allSigners.filter(s => s.signedAt);
  const declinedSigners = notification.allSigners.filter(s => s.declinedAt);

  const mailOptions = {
    from: `"${process.env['FROM_NAME']}" <${process.env['EMAIL_USER']}>`,
    to: notification.signerEmail,
    subject: `Document Signed: ${notification.documentName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Document Signing Complete</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .status-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
          .status-box { background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #10b981; }
          .signer-list { background: white; padding: 15px; border-radius: 6px; margin: 20px 0; }
          .signer-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
          .signer-item:last-child { border-bottom: none; }
          .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
          .status-signed { background: #d1fae5; color: #065f46; }
          .status-declined { background: #fee2e2; color: #991b1b; }
          .status-pending { background: #fef3c7; color: #92400e; }
          .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Document Signing Complete</h1>
          </div>
          <div class="content">
            <h2>Hello ${notification.signerName},</h2>
            
            <p>The document <strong>${notification.documentName}</strong> has been successfully signed!</p>
            ${notification.envelopeSubject ? `<p><strong>Subject:</strong> ${notification.envelopeSubject}</p>` : ''}
            
            <div class="status-grid">
              <div class="status-box">
                <h3>Signed</h3>
                <p style="font-size: 24px; font-weight: bold; color: #10b981; margin: 0;">${signedSigners.length}</p>
              </div>
              <div class="status-box">
                <h3>Declined</h3>
                <p style="font-size: 24px; font-weight: bold; color: #ef4444; margin: 0;">${declinedSigners.length}</p>
              </div>
            </div>
            
            <div class="signer-list">
              <h3>Signing Status</h3>
              ${notification.allSigners.map(signer => `
                <div class="signer-item">
                  <span>${signer.name} (${signer.email})</span>
                  <span class="status-badge ${
                    signer.signedAt ? 'status-signed' : 
                    signer.declinedAt ? 'status-declined' : 
                    'status-pending'
                  }">
                    ${signer.signedAt ? 'Signed' : 
                      signer.declinedAt ? 'Declined' : 
                      'Pending'}
                  </span>
                </div>
              `).join('')}
            </div>
            
            <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
              <strong>Signed on:</strong> ${notification.signedAt.toLocaleString()}
            </p>
            
            ${notification.downloadLink || notification.certificateLink ? `
              <div style="text-align: center; margin: 30px 0;">
                ${notification.downloadLink ? `
                  <a href="${notification.downloadLink}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 0 10px;">
                    Download Signed Document
                  </a>
                ` : ''}
                ${notification.certificateLink ? `
                  <a href="${notification.certificateLink}" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 0 10px;">
                    View Completion Certificate
                  </a>
                ` : ''}
              </div>
            ` : ''}
            
            <p style="font-size: 14px; color: #6b7280;">
              This document has been electronically signed and is legally binding. 
              All signatures have been verified and recorded in our audit trail.
            </p>
          </div>
          <div class="footer">
            <p>This email was sent by DocUsign - Secure Electronic Signatures</p>
            <p>© ${new Date().getFullYear()} DocUsign. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Document Signing Complete
      
      Hello ${notification.signerName},
      
      The document "${notification.documentName}" has been successfully signed!
      ${notification.envelopeSubject ? `Subject: ${notification.envelopeSubject}` : ''}
      
      Signing Status:
      - Signed: ${signedSigners.length}
      - Declined: ${declinedSigners.length}
      
      Signers:
      ${notification.allSigners.map(s => 
        `- ${s.name} (${s.email}): ${
          s.signedAt ? 'Signed' : 
          s.declinedAt ? 'Declined' : 
          'Pending'
        }`
      ).join('\n')}
      
      Signed on: ${notification.signedAt.toLocaleString()}
      
      ${notification.downloadLink ? `Download Document: ${notification.downloadLink}` : ''}
      ${notification.certificateLink ? `View Certificate: ${notification.certificateLink}` : ''}
      
      This document has been electronically signed and is legally binding. 
      All signatures have been verified and recorded in our audit trail.
      
      --
      DocUsign - Secure Electronic Signatures
    `
  };

  return sendMailWithRetry(mailOptions);
}

export async function sendSignerVerificationEmail(email: string, name: string, otpCode: string): Promise<boolean> {
  if (!isEmailVerified && !(await verifyEmailConfig())) {
    console.log('Verification details (not sent):', { email, name, otpCode });
    return false;
  }

  const mailOptions = {
    from: `"${process.env['FROM_NAME']}" <${process.env['EMAIL_USER']}>`,
    to: email,
    subject: 'Verify Your Identity',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Verify Your Identity</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .otp-code { font-size: 24px; font-weight: bold; color: #3b82f6; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Hello ${name},</h2>
          <p>Your verification code is:</p>
          <p class="otp-code">${otpCode}</p>
          <p>This code will expire in 10 minutes.</p>
        </div>
      </body>
      </html>
    `,
    text: `
      Verify Your Identity
      
      Hello ${name},
      
      Your verification code is: ${otpCode}
      
      This code will expire in 10 minutes.
    `
  };

  return sendMailWithRetry(mailOptions);
}