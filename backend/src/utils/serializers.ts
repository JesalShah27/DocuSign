import { type Document, type Envelope, type EnvelopeSigner, type Signature } from '../generated/prisma/client.js';
import { type SerializedDocument, type SerializedSignature, type SerializedSigner, type SerializedEnvelope } from '../types/responses.js';

export function serializeDocument(doc: Document): SerializedDocument {
    return {
        id: doc.id,
        ownerId: doc.ownerId,
        originalName: doc.originalName,
        storagePath: doc.storagePath,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        originalHash: doc.originalHash ?? null,
        completeSignedPdfHash: doc.completeSignedPdfHash ?? null,
        signedPdfPath: doc.signedPdfPath ?? null,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString()
    };
}

export function serializeSignature(sig: Signature | null): SerializedSignature | null {
    if (!sig) return null;
    
    return {
        id: sig.id,
        signerId: sig.signerId,
        consentGiven: sig.consentGiven,
        consentText: sig.consentText,
        imagePath: sig.imagePath,
        drawnPoints: sig.drawnPoints,
        createdAt: sig.createdAt.toISOString()
    };
}

export function serializeSigner(signer: EnvelopeSigner & { signature?: Signature | null }): SerializedSigner {
    const {
        signedAt, otpExpiry, sessionExpiry, declinedAt,
        signature: rawSignature,
        ...rest
    } = signer;

    return {
        ...rest,
        signedAt: signedAt?.toISOString() ?? null,
        otpExpiry: otpExpiry?.toISOString() ?? null,
        sessionExpiry: sessionExpiry?.toISOString() ?? null,
        declinedAt: declinedAt?.toISOString() ?? null,
        signature: rawSignature ? serializeSignature(rawSignature) : null
    };
}

export function serializeEnvelope(envelope: Envelope & {
    document?: Document;
    signers?: (EnvelopeSigner & { signature?: Signature | null })[];
    owner?: { email: string };
}): SerializedEnvelope {
    const serialized: SerializedEnvelope = {
        id: envelope.id,
        ownerId: envelope.ownerId,
        documentId: envelope.documentId,
        status: envelope.status,
        subject: envelope.subject,
        message: envelope.message,
        createdAt: envelope.createdAt.toISOString(),
        updatedAt: envelope.updatedAt.toISOString(),
        completedAt: envelope.completedAt?.toISOString() ?? null
    };

    if (envelope.document) {
        serialized.document = serializeDocument(envelope.document);
    }

    if (envelope.signers) {
        serialized.signers = envelope.signers.map(serializeSigner);
    }

    if (envelope.owner) {
        serialized.owner = envelope.owner;
    }

    return serialized;
}