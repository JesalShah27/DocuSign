import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../shared/contexts';
import axios from 'axios';
import type { Envelope, AuditLog } from '../shared/types';
import { 
  ArrowLeftIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
  ClipboardDocumentIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const API_BASE = 'http://localhost:4000/api';




const EnvelopeDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [envelope, setEnvelope] = useState<Envelope | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { token } = useAuth();

  const fetchEnvelope = useCallback(async () => {
    try {
      const response = await axios.get<Envelope>(`${API_BASE}/envelopes/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEnvelope(response.data);
    } catch (err: any) {
      setError('Failed to fetch envelope details');
    }
  }, [id, token]);

  const fetchAuditLogs = useCallback(async () => {
    try {
      const response = await axios.get<AuditLog[]>(`${API_BASE}/download/envelopes/${id}/audit`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAuditLogs(response.data);
    } catch (err: any) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  const downloadSignedDocument = async () => {
    setDownloading(true);
    try {
      const response = await axios.get<Blob>(`${API_BASE}/download/envelopes/${id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `signed_${envelope?.document.originalName}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError('Failed to download signed document');
    } finally {
      setDownloading(false);
    }
  };

  const downloadCertificate = async () => {
    setDownloading(true);
    try {
      const response = await axios.get<Blob>(`${API_BASE}/download/envelopes/${id}/certificate`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `completion_certificate_${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError('Failed to download completion certificate');
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchEnvelope();
      fetchAuditLogs();
    }
  }, [id, fetchEnvelope, fetchAuditLogs]);

  // Fetch preview blob when eligible
  useEffect(() => {
    const loadPreview = async () => {
      if (!id || !token) return;
      if (!envelope) return;
      if (!(envelope.status === 'COMPLETED' || envelope.status === 'PARTIALLY_SIGNED')) return;
      try {
        const response = await axios.get<Blob>(`${API_BASE}/download/envelopes/${id}/pdf`, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob' as 'blob',
        });
        const url = window.URL.createObjectURL(response.data);
        setPreviewUrl(url);
      } catch (e) {
        // ignore preview errors
      }
    };
    loadPreview();
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [id, token, envelope]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'SENT': return 'bg-blue-100 text-blue-800';
      case 'VIEWED': return 'bg-yellow-100 text-yellow-800';
      case 'PARTIALLY_SIGNED': return 'bg-orange-100 text-orange-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'DECLINED': return 'bg-red-100 text-red-800';
      case 'VOIDED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'DECLINED': return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'SENT': return <ClockIcon className="h-5 w-5 text-blue-500" />;
      case 'VOIDED': return <XCircleIcon className="h-5 w-5 text-gray-500" />;
      case 'PARTIALLY_SIGNED': return <ClockIcon className="h-5 w-5 text-orange-500" />;
      default: return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !envelope) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <XCircleIcon className="mx-auto h-12 w-12 text-red-500" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Envelope Not Found</h2>
          <p className="mt-2 text-sm text-gray-600">{error}</p>
          <Link to="/envelopes" className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700">
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Envelopes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/envelopes" className="text-gray-400 hover:text-gray-600">
              <ArrowLeftIcon className="h-6 w-6" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {envelope.subject || 'Envelope Details'}
              </h1>
              <p className="mt-2 text-gray-600">Document: {envelope.document.originalName}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {getStatusIcon(envelope.status)}
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(envelope.status)}`}>
              {envelope.status.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </div>

      {/* Document Information */}
      <div className="bg-white shadow rounded-lg mb-8">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Document Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <DocumentTextIcon className="h-8 w-8 text-red-500" />
                <div>
                  <h4 className="text-sm font-medium text-gray-900">{envelope.document.originalName}</h4>
                  <p className="text-sm text-gray-500">Created: {formatDate(envelope.createdAt)}</p>
                </div>
              </div>
              
              {/* Show any available hash field (original, sha256, signed, complete signed) */}
              {(envelope.document.sha256Hash || envelope.document.originalHash || envelope.document.signedHash || envelope.document.completeSignedPdfHash) && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Document Hash (SHA-256)</label>
                  <div className="flex items-center space-x-2">
                    <code className="flex-1 text-xs bg-gray-100 p-2 rounded break-all">
                      {envelope.document.sha256Hash ?? envelope.document.originalHash ?? envelope.document.signedHash ?? envelope.document.completeSignedPdfHash}
                    </code>
                    <button
                      onClick={() => copyToClipboard(envelope.document.sha256Hash ?? envelope.document.originalHash ?? envelope.document.signedHash ?? envelope.document.completeSignedPdfHash ?? '')}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Copy hash"
                    >
                      <ClipboardDocumentIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              {envelope.message && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">{envelope.message}</p>
                </div>
              )}

              {envelope.completedAt && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Completed</label>
                  <p className="text-sm text-gray-600">{formatDate(envelope.completedAt)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Signers */}
      <div className="bg-white shadow rounded-lg mb-8">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Signers ({envelope.signers.length})</h3>
          <div className="space-y-4">
            {envelope.signers.map((signer, index) => (
              <div key={signer.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">
                      {index + 1}. {signer.name}
                    </h4>
                    <p className="text-sm text-gray-500">{signer.email}</p>
                  </div>
                  <div className="text-right">
                    {signer.signedAt ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircleIcon className="h-3 w-3 mr-1" />
                        Signed
                      </span>
                    ) : signer.declinedAt ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <XCircleIcon className="h-3 w-3 mr-1" />
                        Declined
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <ClockIcon className="h-3 w-3 mr-1" />
                        Pending
                      </span>
                    )}
                  </div>
                </div>
                
                {signer.signedAt && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      Signed: {formatDate(signer.signedAt)}
                    </p>
                    {signer.ipAddress && (
                      <p className="text-xs text-gray-500">
                        IP: {signer.ipAddress}
                      </p>
                    )}
                  </div>
                )}

                {signer.declinedAt && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      Declined: {formatDate(signer.declinedAt)}
                    </p>
                    {signer.ipAddress && (
                      <p className="text-xs text-gray-500">
                        IP: {signer.ipAddress}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Preview & Actions */}
      {(envelope.status === 'COMPLETED' || envelope.status === 'PARTIALLY_SIGNED') && (
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Signed Document</h3>
            {previewUrl ? (
              <div className="mb-4">
                <object data={previewUrl} type="application/pdf" className="w-full h-[600px] border rounded">
                  <p className="text-sm text-gray-500 p-4">Preview not available. Use the download button below.</p>
                </object>
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-4">Generating preview…</p>
            )}
            <div className="flex space-x-4">
              <button
                onClick={downloadSignedDocument}
                disabled={downloading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                {downloading ? 'Downloading…' : 'Download Signed Document'}
              </button>
              <button
                onClick={downloadCertificate}
                disabled={downloading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                {downloading ? 'Downloading…' : 'Download Certificate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Trail */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Audit Trail ({auditLogs.length} events)</h3>
          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div key={log.id} className="border-l-4 border-blue-500 pl-4 py-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {log.event.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(log.timestamp)}
                    </p>
                  </div>
                  {log.actorEmail && (
                    <span className="text-xs text-gray-500">
                      {log.actorEmail}
                    </span>
                  )}
                </div>
                {log.ipAddress && (
                  <p className="text-xs text-gray-400 mt-1">
                    IP: {log.ipAddress}
                  </p>
                )}
                {log.details && (
                  <div className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                    <pre className="whitespace-pre-wrap">{JSON.stringify(log.details, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnvelopeDetails;
