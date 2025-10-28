import { Router } from 'express';
import type { Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import type { JsonResponse, ErrorResponse, SerializedDocument } from '../types/responses.js';
import { uploadPDF, handleUploadError, cleanupOnError } from '../middleware/upload.js';
import { serializeDocument } from '../utils/serializers.js';


interface AuthenticatedFileRequest extends AuthenticatedRequest {
  file?: Express.Multer.File;
}

const router = Router();

import { DocumentService } from '../services/document.js';
const documentService = new DocumentService();

// Upload configuration moved to upload middleware

router.get('/', requireAuth, async (req: AuthenticatedRequest, res: JsonResponse<SerializedDocument[]>): Promise<void> => {
  const docs = await documentService.listDocuments(req.user!.id);
  const serializedDocs = docs.map(serializeDocument);
  res.json(serializedDocs);
});

// GET /documents/:id - Get a specific document
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res: JsonResponse<SerializedDocument | ErrorResponse>): Promise<void> => {
  try {
    const id = req.params['id'];
    if (!id) {
      res.status(400).json({ message: 'Missing document ID' });
      return;
    }
    const doc = await documentService.getDocument(id, req.user!.id);
    
    if (!doc) {
      res.status(404).json({ message: 'Document not found' });
      return;
    }

    res.json(serializeDocument(doc));
  } catch (error: any) {
    console.error('Error retrieving document:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve document',
      details: process.env['NODE_ENV'] === 'development' ? error.message : undefined
    });
  }
});

// Preview endpoint for authenticated users
router.get('/:id/preview', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const id = req.params['id'];
  if (!id) {
    res.status(400).json({ message: 'Missing document ID' });
    return;
  }

  const doc = await documentService.getDocument(id, req.user!.id);
  if (!doc) {
    res.status(404).json({ message: 'Document not found' });
    return;
  }

  const filePath = documentService.getDocumentPath(doc);
  res.sendFile(filePath, { headers: { 'Content-Type': 'application/pdf' } });
});

router.post('/', requireAuth, uploadPDF, async (req: AuthenticatedRequest, res: JsonResponse<SerializedDocument | ErrorResponse>): Promise<void> => {
  try {
    console.log('Received file upload request');

    const file = (req as AuthenticatedFileRequest).file;
    if (!file) {
      console.error('No file received in request');
      res.status(400).json({ message: 'Missing file' });
      return;
    }

    console.log('Creating document...');
    const doc = await documentService.createDocument({
      originalPath: file.path,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      ownerId: req.user!.id
    });

    console.log('Document created successfully:', doc.id);
    res.status(201).json(serializeDocument(doc));
  } catch (error: any) {
    // Clean up uploaded file if document creation fails
    if ((req as AuthenticatedFileRequest).file) {
      cleanupOnError((req as AuthenticatedFileRequest).file!);
    }

    console.error('Document upload error:', error);
    res.status(500).json({ 
      message: 'Failed to upload document',
      details: process.env['NODE_ENV'] === 'development' ? error.message : undefined
    });
  }
}, handleUploadError);

export default router;


