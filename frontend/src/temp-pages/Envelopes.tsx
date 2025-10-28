import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../shared/contexts';
import axios from 'axios';
import type { APIResponse } from '../shared/types';
import { 
  EnvelopeIcon, 
  PlusIcon,
  EyeIcon,
  PaperAirplaneIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import { PDFPreview } from '../components';

const API_BASE = 'http://localhost:4000/api';

interface Document {
  id: string;
  originalName: string;
  sha256Hash: string;
}

interface Signer {
  id: string;
  email: string;
  name: string;
  role: string;
  routingOrder: number;
  signedAt?: string;
  declinedAt?: string;
  accessCode?: string;
  signingLink?: string;
}

interface Envelope {
  id: string;
  status: string;
  subject: string | null;
  message: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  document?: Document;
  signers?: Signer[];
  owner?: {
    email: string;
  };
}

const Envelopes: React.FC = () => {
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [signers, setSigners] = useState<Array<{email: string, name: string, role: string, routingOrder: number}>>([]);
  const [newSignerEmail, setNewSignerEmail] = useState('');
  const [newSignerName, setNewSignerName] = useState('');
  const [specifyPlacement, setSpecifyPlacement] = useState(false);
  const [newSignerPage, setNewSignerPage] = useState<number>(1);
  const [newSignerX, setNewSignerX] = useState<string>('');
  const [newSignerY, setNewSignerY] = useState<string>('');
  const [newSignerW, setNewSignerW] = useState<string>('');
  const [newSignerH, setNewSignerH] = useState<string>('');
  const previewRef = React.useRef<HTMLDivElement | null>(null);
  const [currentPreviewPage, setCurrentPreviewPage] = useState<number>(1);
  const [previewHeight, setPreviewHeight] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewError, setPreviewError] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const { token } = useAuth();
  const [searchParams] = useSearchParams();

  const fetchEnvelopes = useCallback(async () => {
    try {
      console.log('Fetching envelopes...');
      const response = await axios.get<Envelope[]>(`${API_BASE}/envelopes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Fetched envelopes:', response.data);
      setEnvelopes(response.data || []);
    } catch (err: any) {
      console.error('Failed to fetch envelopes:', err);
      setError(err.response?.data?.message || 'Failed to fetch envelopes');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchDocuments = useCallback(async () => {
    if (!token) {
      console.error('No token from useAuth()');
      setError('Please log in to view documents');
      return;
    }

    try {
      console.log('Fetching documents with token:', token.substring(0, 10) + '...');
      const response = await axios.get<APIResponse<Document[]>>(`${API_BASE}/documents`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('Documents API response status:', response.status);
      console.log('Documents API response:', response.data);
      
      if (Array.isArray(response.data)) {
        console.log(`Found ${response.data.length} documents`);
        setDocuments(response.data);
      } else {
        console.warn('Response data is not an array:', response.data);
        setDocuments([]);
      }
    } catch (err: any) {
      console.error('Failed to fetch documents:', {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        error: err.message
      });
      if (err.response?.status === 401) {
        setError('Session expired. Please log in again.');
        window.location.href = '/login';
      } else {
        setError('Failed to fetch documents: ' + (err.response?.data?.message || err.message));
      }
    }
  }, [token]);

  useEffect(() => {
    fetchEnvelopes();
    fetchDocuments();
    
    // Check if we should show create form for a specific document
    const documentId = searchParams.get('document');
    if (documentId) {
      setSelectedDocument(documentId);
      setShowCreateForm(true);
    }
  }, [searchParams, fetchEnvelopes, fetchDocuments]);

  // Load authenticated PDF preview as blob URL when specifying placement
  useEffect(() => {
    let revoked = false;
    const loadPreview = async () => {
      if (!specifyPlacement || !selectedDocument || !token) {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl('');
        setPreviewError('');
        return;
      }
      try {
        setPreviewError('');
        const resp = await axios.get<Blob>(`${API_BASE}/documents/${selectedDocument}/preview`, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob' as 'blob'
        });
        if (revoked) return;
        const url = URL.createObjectURL(resp.data);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(url);
      } catch (e: any) {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl('');
        setPreviewError(e?.response?.data?.message || 'Failed to load PDF preview');
      }
    };
    loadPreview();
    return () => {
      revoked = true;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [specifyPlacement, selectedDocument, token]);

  const addSigner = () => {
    if (newSignerEmail && newSignerName) {
      setSigners([...signers, {
        email: newSignerEmail,
        name: newSignerName,
        role: 'SIGNER',
        routingOrder: signers.length + 1
      }]);
      setNewSignerEmail('');
      setNewSignerName('');
      setSpecifyPlacement(false);
      setNewSignerPage(1);
      setNewSignerX('');
      setNewSignerY('');
      setNewSignerW('');
      setNewSignerH('');
      setCurrentPreviewPage(1);
      setPreviewHeight(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl('');
      }
      setPreviewError('');
    }
  };

  const removeSigner = (index: number) => {
    setSigners(signers.filter((_, i) => i !== index));
  };

  const createEnvelope = async () => {
    if (!selectedDocument || signers.length === 0) {
      setError('Please select a document and add at least one signer');
      return;
    }

    setCreating(true);
    setError('');

    try {
      console.log('Creating envelope with document:', selectedDocument);
      console.log('Auth token present:', !!token);
      
      // Create envelope
      console.log('Sending envelope creation request:', {
        documentId: selectedDocument,
        subject: subject || undefined,
        message: message || undefined
      });

      const envelopeResponse = await axios.post<Envelope>(`${API_BASE}/envelopes`, {
        documentId: selectedDocument,
        subject: subject || undefined,
        message: message || undefined
      }, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Envelope creation response:', envelopeResponse.data);

      const envelope = envelopeResponse.data;
      if (!envelope?.id) {
        throw new Error('Invalid response: missing envelope ID');
      }

      console.log('Successfully created envelope:', envelope.id);
      const envelopeId = envelope.id;

      // Add signers
      console.log('Adding signers:', signers.length);
      for (const signer of signers) {
        console.log('Adding signer:', signer.email);
        const payload: any = { ...signer };
        if (specifyPlacement && newSignerX && newSignerY && newSignerW && newSignerH) {
          payload.placement = {
            pageNumber: Number(newSignerPage || 1),
            x: Number(newSignerX),
            y: Number(newSignerY),
            width: Number(newSignerW),
            height: Number(newSignerH)
          };
        }
        const signerResponse = await axios.post(`${API_BASE}/envelopes/${envelopeId}/signers`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Successfully added signer:', signerResponse.data);
      }

      // Reset form
      setSelectedDocument('');
      setSubject('');
      setMessage('');
      setSigners([]);
      setShowCreateForm(false);
      
      // Refresh envelopes and show success message
      await fetchEnvelopes();
      setError(''); // Clear any previous errors
      
      // Scroll to the newly created envelope
      setTimeout(() => {
        const envelopeElement = document.getElementById(`envelope-${envelopeId}`);
        if (envelopeElement) {
          envelopeElement.scrollIntoView({ behavior: 'smooth' });
          envelopeElement.classList.add('bg-green-50');
          setTimeout(() => {
            envelopeElement.classList.remove('bg-green-50');
          }, 2000);
        }
      }, 100);
    } catch (err: any) {
      console.error('Envelope creation error:', {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        message: err.response?.data?.message,
        error: err.message,
        request: {
          documentId: selectedDocument,
          subject,
          message
        }
      });
      setError(err.response?.data?.message || err.message || 'Failed to create envelope');
    } finally {
      setCreating(false);
    }
  };

  const sendEnvelope = async (envelopeId: string) => {
    try {
      await axios.post(`${API_BASE}/envelopes/${envelopeId}/send`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchEnvelopes();
    } catch (err: any) {
      setError('Failed to send envelope');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'SENT': return 'bg-blue-100 text-blue-800';
      case 'VIEWED': return 'bg-yellow-100 text-yellow-800';
      case 'PARTIALLY_SIGNED': return 'bg-orange-100 text-orange-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'DECLINED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
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

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Envelopes</h1>
            <p className="mt-2 text-gray-600">Create and manage signing envelopes</p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            New Envelope
          </button>
        </div>
      </div>

      {/* Create Envelope Form */}
      {showCreateForm && (
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Create New Envelope
            </h3>
            
            <div className="space-y-4">
              {/* Document Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Document
                </label>
                <select
                  value={selectedDocument}
                  onChange={(e) => setSelectedDocument(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Choose a document...</option>
                  {documents.map((doc) => (
                    <option key={doc.id} value={doc.id}>{doc.originalName}</option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject (Optional)
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Document signing request"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message (Optional)
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Please review and sign this document..."
                />
              </div>

              {/* Signers */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add Signers
                </label>
                <div className="flex space-x-2 mb-2">
                  <input
                    type="email"
                    value={newSignerEmail}
                    onChange={(e) => setNewSignerEmail(e.target.value)}
                    placeholder="Email address"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                  <input
                    type="text"
                    value={newSignerName}
                    onChange={(e) => setNewSignerName(e.target.value)}
                    placeholder="Full name"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                  <button
                    onClick={addSigner}
                    className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
                  >
                    Add
                  </button>
                </div>

                {/* Optional placement for this signer */}
                <div className="mt-2 p-2 bg-gray-50 rounded">
                  <label className="inline-flex items-center text-xs text-gray-700">
                    <input type="checkbox" className="mr-2" checked={specifyPlacement} onChange={(e) => setSpecifyPlacement(e.target.checked)} />
                    Specify signature position (interactive preview)
                  </label>
                  {specifyPlacement && (
                    <>
                      <div className="mt-2 text-xs text-gray-600">
                        Click on the document preview to place the signature. Adjust size or coordinates as needed.
                      </div>
                      {selectedDocument ? (
                        <div className="mt-2 grid grid-cols-1 lg:grid-cols-3 gap-3">
                          <div className="lg:col-span-2">
                            <div 
                              ref={previewRef}
                              className="relative border rounded bg-white overflow-hidden"
                              onClick={(e) => {
                                if (!previewRef.current) return;
                                const rect = previewRef.current.getBoundingClientRect();
                                const relX = (e.clientX - rect.left) / rect.width; // 0..1
                                const relYFromTop = (e.clientY - rect.top) / rect.height; // 0..1
                                const relY = 1 - relYFromTop; // bottom-origin
                                const defW = newSignerW ? Number(newSignerW) : 0.25;
                                const defH = newSignerH ? Number(newSignerH) : 0.08;
                                setNewSignerPage(currentPreviewPage);
                                setNewSignerX(relX.toFixed(3));
                                setNewSignerY(relY.toFixed(3));
                                setNewSignerW(defW.toString());
                                setNewSignerH(defH.toString());
                              }}
                            >
                              {/* Authenticated PDF preview via blob URL */}
                              {previewError ? (
                                <div className="p-4 text-sm text-red-600">{previewError}</div>
                              ) : (
                                <PDFPreview 
                                  file={previewUrl || ''}
                                  onPageChange={(p) => setCurrentPreviewPage(p)}
                                  onPageLoad={(h) => setPreviewHeight(h)}
                                />
                              )}
                              {(newSignerX && newSignerY && newSignerW && newSignerH && newSignerPage === currentPreviewPage) && (
                                <div
                                  className="pointer-events-none absolute border-2 border-green-500 bg-green-200 bg-opacity-30 rounded"
                                  style={{
                                    left: `${Number(newSignerX) * 100}%`,
                                    bottom: `${Number(newSignerY) * 100}%`,
                                    width: `${Number(newSignerW) * 100}%`,
                                    height: `${Number(newSignerH) * 100}%`,
                                    transform: 'translate(-12.5%, 0%)'
                                  }}
                                >
                                  <div className="absolute inset-0 flex items-center justify-center text-green-700 text-[10px] font-medium">
                                    Signature Here
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <label className="col-span-2 font-medium text-gray-700">Coordinates (0-1) & size</label>
                              <div className="col-span-1">
                                <div className="text-[10px] text-gray-500 mb-1">Page</div>
                                <input type="number" min={1} value={newSignerPage} onChange={e => setNewSignerPage(parseInt(e.target.value || '1', 10))} className="w-full px-2 py-1 border rounded text-xs" />
                              </div>
                              <div className="col-span-1"></div>
                              <div>
                                <div className="text-[10px] text-gray-500 mb-1">x</div>
                                <input type="number" step="0.001" min={0} max={1} value={newSignerX} onChange={e => setNewSignerX(e.target.value)} className="w-full px-2 py-1 border rounded text-xs" />
                              </div>
                              <div>
                                <div className="text-[10px] text-gray-500 mb-1">y</div>
                                <input type="number" step="0.001" min={0} max={1} value={newSignerY} onChange={e => setNewSignerY(e.target.value)} className="w-full px-2 py-1 border rounded text-xs" />
                              </div>
                              <div>
                                <div className="text-[10px] text-gray-500 mb-1">width</div>
                                <input type="number" step="0.001" min={0} max={1} value={newSignerW} onChange={e => setNewSignerW(e.target.value)} className="w-full px-2 py-1 border rounded text-xs" />
                              </div>
                              <div>
                                <div className="text-[10px] text-gray-500 mb-1">height</div>
                                <input type="number" step="0.001" min={0} max={1} value={newSignerH} onChange={e => setNewSignerH(e.target.value)} className="w-full px-2 py-1 border rounded text-xs" />
                              </div>
                              <div className="col-span-2 mt-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNewSignerW('0.25');
                                    setNewSignerH('0.08');
                                  }}
                                  className="px-2 py-1 border border-gray-300 rounded text-xs bg-white hover:bg-gray-50"
                                >
                                  Reset to default size
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-red-600">Select a document first to preview and set the signature position.</div>
                      )}
                    </>
                  )}
                </div>
                
                {signers.length > 0 && (
                  <div className="space-y-2">
                    {signers.map((signer, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm">{signer.name} ({signer.email})</span>
                        <button
                          onClick={() => removeSigner(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="text-sm text-red-700">{error}</div>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={createEnvelope}
                  disabled={creating || !selectedDocument || signers.length === 0}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Envelope'}
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Envelopes List */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Your Envelopes ({envelopes.length})
          </h3>
          
          {envelopes.length === 0 ? (
            <div className="text-center py-12">
              <EnvelopeIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No envelopes</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating a new envelope.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {envelopes.map((envelope) => (
                <div 
                  key={envelope.id} 
                  id={`envelope-${envelope.id}`}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors duration-300"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <EnvelopeIcon className="h-8 w-8 text-blue-500" />
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">
                          {envelope.subject || 'Untitled Envelope'}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {envelope.document?.originalName ?? 'Untitled'} • {formatDate(envelope.createdAt)}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(envelope.status)}`}>
                            {envelope.status.replace('_', ' ')}
                          </span>
                          <span className="text-xs text-gray-500">
                            <UserGroupIcon className="h-3 w-3 inline mr-1" />
                            {envelope.signers?.length ?? 0} signer{(envelope.signers?.length ?? 0) !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {envelope.status === 'DRAFT' && (
                        <button
                          onClick={() => sendEnvelope(envelope.id)}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-primary-600 hover:bg-primary-700"
                        >
                          <PaperAirplaneIcon className="h-3 w-3 mr-1" />
                          Send
                        </button>
                      )}
                      
                      <Link
                        to={`/envelopes/${envelope.id}`}
                        className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <EyeIcon className="h-3 w-3 mr-1" />
                        View
                      </Link>
                    </div>
                  </div>
                  
                  {/* Signers Status */}
                  {envelope.signers && envelope.signers.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="text-xs text-gray-500 mb-2">Signers:</div>
                      <div className="space-y-2">
                        {envelope.signers.map((signer) => (
                          <div key={signer.id} className="text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-700">{signer.name} ({signer.email})</span>
                              <span className={`px-2 py-1 rounded ${
                                signer.signedAt ? 'bg-green-100 text-green-800' :
                                signer.declinedAt ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {signer.signedAt ? 'Signed' : signer.declinedAt ? 'Declined' : 'Pending'}
                              </span>
                            </div>
                            {envelope.status === 'SENT' && !signer.signedAt && !signer.declinedAt && signer.accessCode && (
                              <div className="mt-1 p-2 bg-blue-50 rounded text-xs">
                                <div className="font-medium text-blue-800">Signing Link & OTP:</div>
                                <div className="text-blue-700 mt-1">
                                  <div>Link: <code className="bg-blue-100 px-1 rounded">{window.location.origin}/sign/{signer.signingLink}</code></div>
                                  <div>OTP: <code className="bg-blue-100 px-1 rounded font-mono">{signer.accessCode}</code></div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Envelopes;
