# DocUsign - Electronic Signature Platform

A comprehensive electronic signature platform built with React, Node.js, and Prisma. This application provides secure document signing with audit trails, compliance features, and email notifications.

## Features

### Phase 1: Setup and Authentication ✅
- User registration and login with JWT
- Multi-factor authentication (MFA) support
- Role-based access control (owner, admin)
- Secure password hashing with bcrypt
- Clean, minimal dashboard UI

### Phase 2: PDF Upload & SHA-256 Hash ✅
- PDF file upload with validation
- SHA-256 hash computation and storage
- File metadata tracking
- PDF preview capability
- Hash display and verification

### Phase 3: Document Preparation & Multi-Signer ✅
- PDF preview with signature fields
- Multi-signer support with routing order
- Signing session management
- Unique signing links per recipient
- Invitation status tracking

### Phase 4: Email OTP Signing ✅
- Email invitation system with SendGrid
- OTP verification for signers
- Signature capture (text-based)
- IP and device tracking
- Email notifications for completion

### Phase 5: Audit Log & Completion Certificate ✅
- Complete audit trail for all actions
- IP address and device logging
- Hash verification (before/after signing)
- PDF completion certificate generation
- Download options for signed documents

### Phase 6: Notifications, Security & Compliance ✅
- HTTPS support with SSL certificates
- Rate limiting and security headers
- Compliance with eIDAS, ESIGN, IT Act
- Legal consent statements
- Data protection and privacy features

### Phase 7: Final Polishing & Launch ✅
- Comprehensive documentation
- Environment configuration
- Deployment instructions
- Security best practices

## Technology Stack

### Backend
- **Node.js** with Express.js
- **TypeScript** for type safety
- **Prisma** ORM with SQLite database
- **JWT** for authentication
- **bcrypt** for password hashing
- **SendGrid** for email notifications
- **pdf-lib** for PDF manipulation
- **Helmet** for security headers
- **Multer** for file uploads

### Frontend
- **React** with TypeScript
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Axios** for API calls
- **Heroicons** for icons

## Installation

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- SendGrid account (for email functionality)

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:
```env
# Database
DATABASE_URL="file:./dev.db"

# JWT
JWT_SECRET="your-super-secret-jwt-key"

# Email (SendGrid)
SENDGRID_API_KEY="your-sendgrid-api-key"
FROM_EMAIL="noreply@yourdomain.com"
FROM_NAME="DocUsign"

# Frontend URL
FRONTEND_URL="http://localhost:3000"

# SSL (optional)
SSL_KEY_PATH="path/to/private-key.pem"
SSL_CERT_PATH="path/to/certificate.pem"
HTTPS_PORT=4443

# Security
BLOCKED_IPS=""
```

5. Run database migrations:
```bash
npx prisma migrate dev
```

6. Generate Prisma client:
```bash
npx prisma generate
```

7. Start the development server:
```bash
npm run dev
```

The backend will be available at `http://localhost:4000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The frontend will be available at `http://localhost:3000`

## Usage

### 1. User Registration and Login
- Register a new account with email and password
- Login to access the dashboard
- Optional: Enable MFA for enhanced security

### 2. Document Upload
- Navigate to the Documents page
- Upload a PDF file
- View the SHA-256 hash of the uploaded document
- Preview the document

### 3. Create Signing Envelope
- Go to the Envelopes page
- Create a new envelope for a document
- Add signers with their email addresses
- Set signing order (if needed)
- Add subject and message

### 4. Send for Signing
- Send the envelope to signers
- Signers receive email invitations with OTP codes
- Signers can access the document via unique signing links

### 5. Signing Process
- Signers verify their identity with OTP
- Review the document and legal notices
- Provide consent for electronic signing
- Enter their signature (text-based)
- Complete the signing process

### 6. Completion and Audit
- View signing status and audit trail
- Download signed documents
- Generate completion certificates
- Verify document integrity with hashes

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/mfa/setup` - Setup MFA
- `POST /api/auth/mfa/verify` - Verify MFA

### Documents
- `GET /api/documents` - List user documents
- `POST /api/documents` - Upload document
- `GET /api/documents/:id` - Get document details

### Envelopes
- `GET /api/envelopes` - List user envelopes
- `POST /api/envelopes` - Create envelope
- `GET /api/envelopes/:id` - Get envelope details
- `POST /api/envelopes/:id/signers` - Add signer
- `POST /api/envelopes/:id/send` - Send envelope

### Signing
- `GET /sign/:link` - Get signing page data
- `POST /sign/:link/verify` - Verify OTP
- `POST /sign/:link/sign` - Sign document
- `POST /sign/:link/decline` - Decline signing

### Downloads
- `GET /api/download/:id` - Download signed document
- `GET /api/download/envelopes/:id/pdf` - Download signed PDF
- `GET /api/download/envelopes/:id/certificate` - Download certificate
- `GET /api/download/envelopes/:id/audit` - Get audit logs

## Security Features

### Authentication & Authorization
- JWT-based authentication
- Password hashing with bcrypt
- Multi-factor authentication support
- Role-based access control

### Rate Limiting
- General rate limiting (100 requests per 15 minutes)
- Strict rate limiting for auth endpoints (5 attempts per 15 minutes)
- IP-based blocking for suspicious activity

### Security Headers
- Helmet.js for security headers
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options, X-Content-Type-Options

### File Upload Security
- PDF-only file validation
- File size limits (20MB)
- Filename sanitization
- Malicious content detection

### Audit & Compliance
- Complete audit trail
- IP address and device tracking
- Legal compliance notices
- Data retention policies

## Compliance

The platform supports compliance with various electronic signature laws:

### United States
- Electronic Signatures in Global and National Commerce Act (ESIGN)
- Uniform Electronic Transactions Act (UETA)

### European Union
- eIDAS Regulation (EU) 910/2014
- General Data Protection Regulation (GDPR)

### India
- Information Technology Act, 2000
- Information Technology (Certifying Authorities) Rules, 2000

## Deployment

### Production Environment Variables
```env
NODE_ENV=production
DATABASE_URL="your-production-database-url"
JWT_SECRET="your-production-jwt-secret"
SENDGRID_API_KEY="your-sendgrid-api-key"
FROM_EMAIL="noreply@yourdomain.com"
FROM_NAME="DocUsign"
FRONTEND_URL="https://yourdomain.com"
SSL_KEY_PATH="/path/to/ssl/private-key.pem"
SSL_CERT_PATH="/path/to/ssl/certificate.pem"
HTTPS_PORT=443
```

### Database Migration
```bash
npx prisma migrate deploy
```

### Build and Start
```bash
# Backend
npm run build
npm start

# Frontend
npm run build
# Serve the build folder with a web server
```

## Development

### Running Tests
```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

### Code Quality
```bash
# Linting
npm run lint

# Type checking
npm run type-check
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation
- Review the audit logs for debugging

## Roadmap

### Future Enhancements
- [ ] Advanced PDF annotation tools
- [ ] Digital signature certificates
- [ ] Mobile app support
- [ ] Advanced analytics and reporting
- [ ] Integration with cloud storage providers
- [ ] Advanced workflow automation
- [ ] Multi-language support
- [ ] Advanced security features (biometric authentication)

## Acknowledgments

- Built with modern web technologies
- Follows security best practices
- Compliant with electronic signature laws
- Designed for scalability and reliability