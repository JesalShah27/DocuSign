import nodemailer from 'nodemailer';

// Initialize Gmail transporter with debug logging
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env['EMAIL_USER'],
    pass: process.env['EMAIL_PASS']
  },
  debug: true, // Enable debug logging
  logger: true // Log to console
});

// Test email configuration on startup
async function verifyEmailConfig() {
  try {
    await transporter.verify();
    console.log('Email configuration is valid');
    console.log('Using email account:', process.env['EMAIL_USER']);
  } catch (error) {
    console.error('Email configuration error:', error);
  }
}

// Call verification
verifyEmailConfig();

export { transporter };