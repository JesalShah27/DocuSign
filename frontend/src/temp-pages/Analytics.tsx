import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../shared/contexts';
import { API_CONFIG } from '../shared/constants';

interface Overview {
  totals: { documents: number; envelopes: number; signers: number };
  envelopesByStatus: Record<string, number>;
  signerStats: { completed: number; pending: number; declined: number };
  signerDetails: Array<{
    signerId: string;
    envelopeId: string;
    documentId: string;
    documentName: string | null;
    signerName: string;
    signerEmail: string;
    signedAt: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    location: any;
    signedHash: string | null;
  }>;
}

const Analytics: React.FC = () => {
  const { token } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const run = async () => {
      try {
        const effectiveToken = token || localStorage.getItem('token');
        if (!effectiveToken) {
          setError('Please log in to view analytics');
          return;
        }
        const res = await axios.get<Overview>(`${API_CONFIG.BASE_URL}/analytics/overview`, {
          headers: { Authorization: `Bearer ${effectiveToken}` },
        });
        setData(res.data);
      } catch (e: any) {
        setError(e.response?.data?.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-[200px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  if (!data) return null;

  const fmt = (s?: string | null) => (s ? new Date(s).toLocaleString() : '—');

  // Group by document (for sections without charts)
  const byDoc: Record<string, { name: string; rows: Overview['signerDetails'] }> = {};
  for (const s of data.signerDetails) {
    const key = s.documentId;
    if (!byDoc[key]) byDoc[key] = { name: s.documentName || s.documentId, rows: [] };
    byDoc[key].rows.push(s);
  }
  const perDocSections = Object.values(byDoc).map(doc => ({ name: doc.name, rows: doc.rows }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white shadow rounded p-4">
          <div className="text-sm text-gray-500">Documents</div>
          <div className="text-2xl font-semibold">{data.totals.documents}</div>
        </div>
        <div className="bg-white shadow rounded p-4">
          <div className="text-sm text-gray-500">Envelopes</div>
          <div className="text-2xl font-semibold">{data.totals.envelopes}</div>
        </div>
        <div className="bg-white shadow rounded p-4">
          <div className="text-sm text-gray-500">Signers</div>
          <div className="text-2xl font-semibold">{data.totals.signers}</div>
        </div>
      </div>

      {/* Status & signer stats (no charts) */}
      <div className="bg-white shadow rounded p-4">
        <h3 className="text-lg font-medium mb-3">Envelope Status</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(data.envelopesByStatus).map(([k, v]) => (
            <span key={k} className="px-3 py-1 bg-gray-100 rounded text-sm">{k}: {v}</span>
          ))}
        </div>
      </div>
      <div className="bg-white shadow rounded p-4">
        <h3 className="text-lg font-medium mb-3">Signer Stats</h3>
        <div className="flex gap-4">
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded text-sm">Completed: {data.signerStats.completed}</span>
          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">Pending: {data.signerStats.pending}</span>
          <span className="px-3 py-1 bg-red-100 text-red-800 rounded text-sm">Declined: {data.signerStats.declined}</span>
        </div>
      </div>

      {/* Per-document sections (no charts) */}
      <div className="space-y-6">
        {perDocSections.map((doc) => (
          <div key={doc.name} className="bg-white shadow rounded p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium">{doc.name}</h3>
              <div className="text-sm text-gray-500">{doc.rows.length} signers</div>
            </div>
            <div className="mt-1 text-sm text-gray-600 flex gap-3">
              <span className="px-2 py-0.5 rounded bg-green-100 text-green-800">Completed: {doc.rows.filter(r => !!r.signedAt).length}</span>
              <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-800">Pending: {doc.rows.filter(r => !r.signedAt).length}</span>
            </div>
            <div className="mt-4 overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600">
                    <th className="py-2 pr-4">Signer</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Signed At</th>
                    <th className="py-2 pr-4">IP</th>
                    <th className="py-2 pr-4">Signed Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.rows.map(r => (
                    <tr key={r.signerId} className="border-t">
                      <td className="py-2 pr-4">{r.signerName}</td>
                      <td className="py-2 pr-4">{r.signerEmail}</td>
                      <td className="py-2 pr-4">{fmt(r.signedAt)}</td>
                      <td className="py-2 pr-4">{r.ipAddress || '—'}</td>
                      <td className="py-2 pr-4 font-mono text-xs break-all">{r.signedHash || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Analytics;