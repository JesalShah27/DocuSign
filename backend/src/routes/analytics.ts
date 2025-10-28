import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { PrismaClient } from '../generated/prisma/client.js';

const prisma = new PrismaClient();
const router = Router();

router.get('/overview', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const ownerId = req.user!.id;

    // Fetch base data
    const [documents, envelopes, signers, recentAudit] = await Promise.all([
      prisma.document.findMany({ where: { ownerId } }),
      prisma.envelope.findMany({ where: { ownerId } }),
      prisma.envelopeSigner.findMany({
        where: { envelope: { ownerId } },
        orderBy: [
          { signedAt: 'desc' }
        ],
        include: {
          envelope: { include: { document: true } },
          signature: true,
        },
      }),
      prisma.auditLog.findMany({
        where: { envelope: { ownerId } },
        orderBy: { timestamp: 'desc' },
        take: 25,
      }),
    ]);

    // Aggregate envelope status counts
    const statusCounts: Record<string, number> = {};
    for (const env of envelopes) {
      statusCounts[env.status] = (statusCounts[env.status] || 0) + 1;
    }

    // Signer stats
    const totalSigners = signers.length;
    const completedSigners = signers.filter(s => !!s.signedAt).length;
    const declinedSigners = signers.filter(s => !!s.declinedAt).length;
    const pendingSigners = totalSigners - completedSigners - declinedSigners;

    // Flattened signer details for analytics table
    const signerDetails = signers
      .map((s) => {
        let geo: any = null;
        try { geo = s.geo ? JSON.parse(s.geo) : null; } catch {}
        return {
          signerId: s.id,
          envelopeId: s.envelopeId,
          documentId: s.envelope.documentId,
          documentName: s.envelope.document?.originalName || null,
          signerName: s.name,
          signerEmail: s.email,
          signedAt: s.signedAt?.toISOString() ?? null,
          ipAddress: s.ipAddress ?? null,
          userAgent: s.userAgent ?? null,
          location: geo,
          completeSignedPdfHash: s.envelope.document?.completeSignedPdfHash ?? null,
        };
      })
      .sort((a, b) => {
        const ta = a.signedAt ? Date.parse(a.signedAt) : 0;
        const tb = b.signedAt ? Date.parse(b.signedAt) : 0;
        return tb - ta; // newest first
      });

    return res.json({
      totals: {
        documents: documents.length,
        envelopes: envelopes.length,
        signers: totalSigners,
      },
      envelopesByStatus: statusCounts,
      signerStats: {
        completed: completedSigners,
        pending: pendingSigners,
        declined: declinedSigners,
      },
      recentAudit,
      signerDetails,
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Failed to load analytics', detail: error.message });
  }
});

export default router;