import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  DocumentTextIcon, 
  EyeIcon,
  ClipboardDocumentIcon
} from '@heroicons/react/24/outline';
import { DocumentUpload } from '../components/forms';
import { PDFPreview } from '../components/ui';
import { apiClient as api } from '../shared/utils/api';

interface Document {
  id: string;
  originalName: string;
  sizeBytes: number;
  // backend may return the hash under different names depending on workflow
  // keep them optional and prefer sha256Hash when available
  sha256Hash?: string;
  originalHash?: string;
  completeSignedPdfHash?: string;
  createdAt: string;
  mimeType: string;
}

const Documents: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showHash, setShowHash] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const documents = await api.documents.list();
      setDocuments(documents);
    } catch (err: any) {
      setError('Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (files: File[]) => {
    if (files.length === 0) return;
    
    setError('');
    setLoading(true);
    
    try {
      const uploadPromises = files.map(async file => {
        console.log('Starting file upload:', {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        });
        
        const response = await api.documents.upload(file, (progress) => {
          console.log(`Upload progress for ${file.name}: ${progress}%`);
        });

        console.log('Upload successful:', response);
        return response;
      });

      await Promise.all(uploadPromises);
      fetchDocuments();
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.response?.data?.message || err.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
      {/* Preview Modal */}
{previewDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="w-full max-w-4xl">
            <PDFPreview 
              file={{
                url: api.documents.getPreviewUrl(previewDocument.id),
                httpHeaders: (() => {
                  const t = localStorage.getItem('token');
                  return t ? { Authorization: `Bearer ${t}` } : undefined;
                })(),
                withCredentials: false
              }}
              onClose={() => setPreviewDocument(null)}
            />
          </div>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Documents</h1>
        <p className="mt-2 text-gray-600">Upload and manage your PDF documents</p>
      </div>

      {/* Upload Section */}
      <div className="bg-white shadow rounded-lg mb-8">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Upload New Document
          </h3>
          
          <DocumentUpload 
            onUpload={handleUpload} 
            maxSize={10 * 1024 * 1024} // 10MB
            multiple={false}
          />

          {error && (
            <div className="mt-4 rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Your Documents ({documents.length})
          </h3>
          
          {documents.length === 0 ? (
            <div className="text-center py-12">
              <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No documents</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by uploading a PDF document.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {documents.map((doc) => (
                <div key={doc.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <DocumentTextIcon className="h-8 w-8 text-red-500" />
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">{doc.originalName}</h4>
                        <p className="text-sm text-gray-500">
                          {formatFileSize(doc.sizeBytes)} • {formatDate(doc.createdAt)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setPreviewDocument(doc)}
                        className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <EyeIcon className="h-4 w-4 mr-1" />
                        Preview
                      </button>
                      <button
                        onClick={() => setShowHash(showHash === doc.id ? null : doc.id)}
                        className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <ClipboardDocumentIcon className="h-4 w-4 mr-1" />
                        View Hash
                      </button>
                      
                      <Link
                        to={`/envelopes?document=${doc.id}`}
                        className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-primary-600 hover:bg-primary-700"
                      >
                        Create Envelope
                      </Link>
                    </div>
                  </div>
                  
                  {showHash === doc.id && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-md">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-gray-700 mb-1">SHA-256 Hash:</p>
                          {/* Prefer canonical client-side field, fallback to other backend names */}
                          <p className="text-xs font-mono text-gray-600 break-all">{doc.sha256Hash ?? doc.originalHash ?? doc.completeSignedPdfHash ?? '—'}</p>
                        </div>
                        <button
                          onClick={() => copyToClipboard(doc.sha256Hash ?? doc.originalHash ?? doc.completeSignedPdfHash ?? '')}
                          disabled={!(doc.sha256Hash || doc.originalHash || doc.completeSignedPdfHash)}
                          className="ml-2 p-1 text-gray-400 hover:text-gray-600"
                          title="Copy hash"
                        >
                          <ClipboardDocumentIcon className="h-4 w-4" />
                        </button>
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

export default Documents;
