import nodemailer from 'nodemailer';
import type { SigningInvitation } from './email.js';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env['EMAIL_USER'],
    pass: process.env['EMAIL_PASS']
  }
});

export async function sendSigningInvitation(invitation: SigningInvitation): Promise<boolean> {
  try {
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
        
        If you did not expect this request, please contact the sender or ignore this email.
        
        --
        DocUsign - Secure Electronic Signatures
      `
    };

    console.log('Attempting to send email to:', invitation.signerEmail);
    console.log('Using email configuration:', {
      user: process.env['EMAIL_USER'],
      fromName: process.env['FROM_NAME']
    });
    
    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', {
      messageId: result.messageId,
      to: invitation.signerEmail
    });
    return true;
  } catch (err: any) {
    console.error('Error sending signing invitation:', {
      error: err.message,
      stack: err.stack,
      code: err.code
    });
    return false;
  }
}

export async function sendSignerVerificationEmail(email: string, name: string, otpCode: string): Promise<boolean> {
  try {
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

    await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    return false;
  }
}