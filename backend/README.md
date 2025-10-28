# DocUsign Backend API

Electronic signature platform backend with comprehensive audit trails and legal compliance features.

## Quick Start

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

## Environment Variables

```bash
PORT=4000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
DATABASE_URL="file:./dev.db"
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/mfa/setup` - Setup MFA (requires auth)
- `POST /api/auth/mfa/enable` - Enable MFA with TOTP
- `POST /api/auth/mfa/verify` - Verify TOTP during login

### Documents
- `GET /api/documents` - List user documents (requires auth)
- `POST /api/documents` - Upload PDF (requires auth)

### Envelopes
- `POST /api/envelopes` - Create envelope (requires auth)
- `POST /api/envelopes/:id/signers` - Add signer (requires auth)
- `POST /api/envelopes/:id/send` - Send envelope (requires auth)
- `GET /api/envelopes/:id` - Get envelope details (requires auth)

### Public Signing
- `GET /sign/:link` - Resolve signing link (public)
- `POST /sign/:link` - Capture signature (public)

### Download & Audit
- `GET /api/download/envelopes/:id/pdf` - Download signed PDF (requires auth)
- `GET /api/download/envelopes/:id/audit` - Get audit trail (requires auth)

## Legal Compliance

This platform implements:
- Comprehensive audit trails with IP, device, and timestamp logging
- Explicit consent capture for electronic signatures
- MFA support for enhanced signer verification
- PDF generation with embedded audit information

**⚠️ Legal Disclaimer**: This is a prototype for educational purposes. Professional legal review required before production use.

## Security Features

- JWT authentication with bcrypt password hashing
- TOTP-based multi-factor authentication
- Request metadata capture (IP, User-Agent)
- Input validation with Zod schemas
- Secure file upload handling

## Development

```bash
npm run dev     # Start dev server
npm run build   # Build TypeScript
npm run start   # Start production server
```

## Database

Uses SQLite with Prisma ORM. Schema includes:
- Users with MFA support
- Documents with metadata
- Envelopes and signers
- Signatures with consent tracking
- Comprehensive audit logs

Run `npx prisma studio` to browse the database.
