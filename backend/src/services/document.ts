import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { writeFile } from 'fs/promises';
import { PrismaClient, Document } from '../generated/prisma/client.js';
import { computeStreamHash } from '../utils/hash.js';

const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);
const copyFile = promisify(fs.copyFile);

interface StorageProvider {
  storeFile(source: string | Buffer, targetPath: string, isPath?: boolean): Promise<void>;
  deleteFile(filePath: string): Promise<void>;
  moveFile(sourcePath: string, targetPath: string): Promise<void>;
}

class LocalStorageProvider implements StorageProvider {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  async storeFile(source: string | Buffer, targetPath: string, isPath: boolean = true): Promise<void> {
    const fullPath = path.join(this.basePath, targetPath);
    const directory = path.dirname(fullPath);
    await mkdir(directory, { recursive: true });

    if (isPath && typeof source === 'string') {
      await copyFile(source, fullPath);
    } else if (!isPath && source instanceof Buffer) {
      await writeFile(fullPath, source);
    } else {
      throw new Error('Invalid source type for storage operation');
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    const fullPath = path.join(this.basePath, filePath);
    try {
      await unlink(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async moveFile(sourcePath: string, targetPath: string): Promise<void> {
    await this.storeFile(sourcePath, targetPath, true);
    await unlink(sourcePath);
  }
}

export class DocumentService {
  private prisma: PrismaClient;
  private storage: StorageProvider;
  private uploadPath: string;

  constructor() {
    this.prisma = new PrismaClient();
    // Resolve uploads directory robustly regardless of current working directory
    const cwd = process.cwd();
    const candidates = [
      path.join(cwd, 'uploads'),
      path.join(cwd, 'backend', 'uploads')
    ];
    const resolved = candidates.find(p => fs.existsSync(p)) || path.join(cwd, 'uploads');
    this.uploadPath = resolved;
    this.storage = new LocalStorageProvider(this.uploadPath);
  }

  /**
   * Stores a document and creates its record in the database
   */
  async createDocument(params: {
    originalPath: string;
    originalName: string;
    mimeType: string;
    size: number;
    ownerId: string;
  }): Promise<Document> {
    console.log('🔄 Starting document creation:', params.originalName);
    
    // Compute hash before moving the file
    console.log('🔐 Computing hash for:', params.originalPath);
    const hash = await computeStreamHash(params.originalPath);
    console.log('✅ Hash computed:', hash);

    // Generate a storage path based on the hash and original name
    const ext = path.extname(params.originalName);
    const storagePath = path.join(
      params.ownerId,
      `${hash.slice(0, 8)}-${path.basename(params.originalName, ext)}${ext}`
    );

    // Store file in its final location
    await this.storage.storeFile(params.originalPath, storagePath);
    console.log('💾 File stored at:', storagePath);

    // Create document record
    const doc = await this.prisma.document.create({
      data: {
        ownerId: params.ownerId,
        originalName: params.originalName,
        storagePath,
        mimeType: params.mimeType,
        sizeBytes: params.size,
        originalHash: hash,
      },
    });
    
    console.log('📄 Document created in database with hash:', doc.originalHash);
    return doc;
  }

  /**
   * Retrieves the absolute path to a document file
   */
  getDocumentPath(doc: Document): string {
    return path.join(this.uploadPath, doc.storagePath);
  }

  /**
   * Deletes a document and its file
   */
  async deleteDocument(documentId: string): Promise<void> {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId }
    });

    if (!doc) {
      throw new Error('Document not found');
    }

    // Delete file first
    await this.storage.deleteFile(doc.storagePath);

    // Then delete database record
    await this.prisma.document.delete({
      where: { id: documentId }
    });
  }

  /**
   * Verifies a document's integrity by checking its hash
   */
  async verifyDocument(documentId: string): Promise<boolean> {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId }
    });

    if (!doc || !doc.originalHash) {
      return false;
    }

    const currentHash = await computeStreamHash(this.getDocumentPath(doc));
    return currentHash === doc.originalHash;
  }

  /**
   * Lists all documents owned by a user
   */
  async listDocuments(ownerId: string): Promise<Document[]> {
    return await this.prisma.document.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Gets a specific document, checking ownership
   */
  async getDocument(documentId: string, ownerId: string): Promise<Document | null> {
    const doc = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        ownerId
      }
    });

    return doc;
  }

  /**
   * Store a signed document
   */
  async storeSignedDocument(targetPath: string, content: Uint8Array | Buffer): Promise<void> {
    await this.storage.storeFile(content instanceof Buffer ? content : Buffer.from(content), targetPath);
  }

  /**
   * Get the absolute path to a signed document
   */
  getSignedDocumentPath(storagePath: string): string {
    return path.join(this.uploadPath, storagePath);
  }

  /**
   * Creates a copy of a document for signing
   */
  async createSigningCopy(documentId: string): Promise<Document> {
    const original = await this.prisma.document.findUnique({
      where: { id: documentId }
    });

    if (!original) {
      throw new Error('Document not found');
    }

    // Generate a new path for the signing copy
    const ext = path.extname(original.originalName);
    const newPath = path.join(
      'signing',
      original.ownerId,
      `${Date.now()}-${path.basename(original.originalName, ext)}${ext}`
    );

    // Copy the file
    await this.storage.storeFile(this.getDocumentPath(original), newPath);

    // Create a new document record
    return await this.prisma.document.create({
      data: {
        ownerId: original.ownerId,
        originalName: `Signing copy of ${original.originalName}`,
        storagePath: newPath,
        mimeType: original.mimeType,
        sizeBytes: original.sizeBytes,
        originalHash: original.originalHash,
      },
    });
  }
}