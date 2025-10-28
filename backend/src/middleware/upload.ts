import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';

// Configure upload directory
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Allowed MIME types
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf'
]);

// File size limits
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Configure multer storage
const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    // Generate a secure random filename while preserving the extension
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).readUIntLE(0, 6);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter function
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(new Error('Invalid file type. Only PDF files are allowed.'));
    return;
  }

  // Additional PDF validation could be done here
  cb(null, true);
};

// Create multer instance with configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});

// Error handler middleware for multer errors
export const handleUploadError = (err: Error, _req: Request, res: Response, next: NextFunction): Response | void => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`
      });
    }
    return res.status(400).json({ message: err.message });
  }
  
  if (err.message.includes('Only PDF files are allowed')) {
    return res.status(400).json({ message: err.message });
  }
  
  next(err);
};

// Clean up function to remove uploaded files in case of error
export const cleanupOnError = (file: Express.Multer.File) => {
  if (file && file.path) {
    fs.unlink(file.path, (err) => {
      if (err) {
        console.error('Error cleaning up file:', err);
      }
    });
  }
};

// Export configured multer middleware
export const uploadPDF = upload.single('file');

// Type for uploaded file information
export interface UploadedFile {
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
}

// Utility function to get file information
export const getFileInfo = (file: Express.Multer.File): UploadedFile => ({
  filename: file.filename,
  originalname: file.originalname,
  mimetype: file.mimetype,
  size: file.size,
  path: file.path
});

// Export constants for use in other modules
export const UPLOAD_CONSTANTS = {
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES: Array.from(ALLOWED_MIME_TYPES),
  UPLOAD_DIR
};