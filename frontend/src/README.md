# DocUsign Frontend

A React TypeScript application for electronic document signing, similar to DocuSign.

## Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── ui/              # Basic UI components (buttons, modals, etc.)
│   ├── forms/           # Form components
│   └── layout/          # Layout components
├── features/            # Feature-specific code
│   ├── auth/           # Authentication feature
│   ├── documents/      # Document management
│   ├── envelopes/      # Envelope management
│   └── signing/        # Document signing process
├── shared/             # Shared utilities and types
│   ├── hooks/          # Custom hooks
│   ├── utils/          # Utility functions
│   ├── types/          # TypeScript type definitions
│   ├── contexts/       # React contexts
│   └── constants/      # Application constants
├── App.tsx             # Main application component
└── index.tsx           # Application entry point
```

## Features

- **Authentication**: User login, registration, and protected routes
- **Document Management**: Upload, preview, and manage PDF documents
- **Envelope Management**: Create and manage signing envelopes
- **Electronic Signing**: Secure document signing with OTP verification
- **Location Tracking**: GPS-based location verification for signatures
- **PDF Preview**: Built-in PDF viewer with signature placement

## Key Components

### UI Components
- **SignatureCanvas**: Digital signature drawing component
- **PDFPreview**: PDF document viewer and editor
- **LocationMap**: Interactive map for location display

### Feature Components
- **Documents**: Document upload and management
- **Envelopes**: Envelope creation and management
- **Signing**: Document signing interface with OTP verification

### Shared Utilities
- **API Client**: Centralized API communication
- **Location Utilities**: GPS and location-related functions
- **PDF Configuration**: PDF.js setup and configuration

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## Environment Variables

- `REACT_APP_API_BASE_URL`: Backend API base URL
- Additional environment variables should be defined in `.env` files

## Tech Stack

- **React 19** with TypeScript
- **React Router** for navigation
- **Tailwind CSS** for styling
- **PDF.js** for PDF handling
- **Axios** for API calls
- **Heroicons** for icons
- **Craco** for build customization

## Code Organization Principles

1. **Feature-based organization**: Related code is grouped by feature
2. **Shared utilities**: Common code is extracted to shared modules
3. **Type safety**: Comprehensive TypeScript types for all data structures
4. **Component reusability**: UI components are designed for reuse
5. **Clean imports**: Clear and organized import structure