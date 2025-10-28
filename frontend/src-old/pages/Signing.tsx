import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { 
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  MapPinIcon
} from '@heroicons/react/24/outline';
import PDFPreview from '../components/PDFPreview';
import SignatureCanvas from '../components/SignatureCanvas';
import { useLocation } from '../hooks/useLocation';
import { LocationMap } from '../components/LocationMap';

const API_BASE = 'http://localhost:4000/api';
// Use a dedicated axios instance without global interceptors to avoid Authorization header
// collisions with the app-wide interceptor (user JWT vs signer session token).
const signerHttp = axios.create({});

interface Signer {
  id: string;
  email: string;
  name: string;
  role: string;
  signedAt?: string;
  declinedAt?: string;
}

interface Document {
  id: string;
  originalName: string;
  sha256Hash?: string;
}

interface Envelope {
  id: string;
  status: string;
  subject?: string;
  message?: string;
  document: Document;
  signers: Signer[];
  compliance?: {
    consentText: string;
    legalNotice: string;
  };
}

const Signing: React.FC = () => {
  console.log('Signing component rendered');
  const { link } = useParams<{ link: string }>();
  const [envelope, setEnvelope] = useState<Envelope | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [otp, setOtp] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [signing, setSigning] = useState(false);
  const location = useLocation();
  const [consent, setConsent] = useState(false);
const [signature, setSignature] = useState('');
  const [placement, setPlacement] = useState<{ pageNumber: number; x: number; y: number; width: number; height: number } | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);
  const pdfContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [currentSigner, setCurrentSigner] = useState<Signer | null>(null);
  const [signedSuccessfully, setSignedSuccessfully] = useState(false);


  interface SignerInfo {
    email: string;
    name: string;
    documentTitle: string;
  }

  interface EnvelopeResponse extends Envelope {
    currentSignerEmail: string;
    requiresAuth?: boolean;
    signerInfo?: SignerInfo;
  }

  const fetchEnvelope = useCallback(async (): Promise<void> => {
    console.log('fetchEnvelope called');
    setError(''); // Clear any previous errors
    try {
      console.log('Fetching envelope for link:', link);
      // Remove sessionToken and Authorization header logic
      try {
        const response = await signerHttp.get<EnvelopeResponse>(
          `${API_BASE.replace('/api', '')}/sign/${link}`
        );
        console.log('API call successful, response:', response);
        
        setEnvelope(response.data);
        console.log('Envelope data:', response.data);
        
        // Find the current signer
        const currentSignerEmail = response.data.currentSignerEmail;
        console.log('Current signer email:', currentSignerEmail);
        const signer = response.data.signers?.find((s: Signer) => s.email === currentSignerEmail);
        console.log('Found signer:', signer);
        
        if (signer) {
          setCurrentSigner(signer);
          
          // Check if already signed or declined
          if (signer.signedAt) {
            setOtpVerified(true);
          }
        }
      } catch (err: any) {
        console.error('Inner catch block error:', err);
        if (err.response?.status === 401 && err.response.data?.requiresAuth && err.response.data?.signerInfo) {
          console.log('Authentication required, storing signer info:', err.response.data.signerInfo);
          
          // Store signer info for authentication
          setCurrentSigner({
            id: '',
            email: err.response.data.signerInfo.email,
            name: err.response.data.signerInfo.name,
            role: 'GUEST'
          });
          
          try {
            // Trigger authentication
            const authResponse = await signerHttp.post<{ sessionToken: string; success: boolean }>(
              `${API_BASE.replace('/api', '')}/sign/${link}/authenticate`,
              { email: err.response.data.signerInfo.email }
            );

            console.log('Authentication response:', authResponse.data);

            if (authResponse.data?.success && authResponse.data?.sessionToken) {
              console.log('Authentication successful, storing token');
              const newSessionToken = authResponse.data.sessionToken;

              // Immediately refetch using the freshly issued session token
              const authed = await signerHttp.get<EnvelopeResponse>(
                `${API_BASE.replace('/api', '')}/sign/${link}`,
                { headers: { Authorization: `Bearer ${newSessionToken}` } }
              );
              setEnvelope(authed.data);
              console.log('Authed envelope data:', authed.data);
              const currentSignerEmail = authed.data.currentSignerEmail;
              console.log('Authed current signer email:', currentSignerEmail);
              const signer = authed.data.signers?.find((s: Signer) => s.email === currentSignerEmail);
              console.log('Authed found signer:', signer);
              if (signer) {
                setCurrentSigner(signer);
                if (signer.signedAt) {
                  setOtpVerified(true);
                }
              }
              return;
            }
          } catch (authError: any) {
            console.error('Authentication error:', authError);
            setError(authError.response?.data?.message || 'Authentication failed');
          }
        } else {
          throw err; // Re-throw if not a 401 with auth info
        }
      }
    } catch (err: any) {
      console.error('Outer catch block error:', err);
      console.error('Envelope fetch error:', err.response?.data || err);
      if (err.response?.status === 404) {
        setError('Invalid or expired signing link');
      } else if (err.response?.status === 401 && !err.response.data?.requiresAuth) {
        setError('Authentication required. Please check your email for instructions.');
      } else if (err.response?.status === 403) {
        setError('Access denied. Please verify your email and try again.');
      } else if (!err.response?.data?.requiresAuth) {
        // Only set error if we're not in the auth flow
        setError(err.response?.data?.message || 'Failed to load signing request');
      }
    } finally {
      console.log('Finally block reached. Error state is:', error);
      if (error !== 'Authentication required. Please check your email for instructions.') {
        console.log('Setting loading to false');
        setLoading(false);
      }
    }
  }, [link]);

  useEffect(() => {
    console.log('useEffect for fetchEnvelope triggered');
    if (link) {
      fetchEnvelope();
    }
  }, [link, fetchEnvelope]);

  // After signing, poll for envelope completion so the download button enables when ready
  React.useEffect(() => {
    if (!signedSuccessfully || !link) return;
    let attempts = 0;
    const maxAttempts = 30; // ~60s if 2s interval
    const interval = setInterval(async () => {
      attempts++;
      try {
        const resp = await signerHttp.get<Envelope>(`${API_BASE.replace('/api', '')}/sign/${link}`);
        setEnvelope((prev) => ({ ...(prev as Envelope), ...(resp.data as any) }));
        if ((resp.data as any)?.status === 'COMPLETED') {
          clearInterval(interval);
        }
      } catch {}
      if (attempts >= maxAttempts) clearInterval(interval);
    }, 2000);
    return () => clearInterval(interval);
  }, [signedSuccessfully, link]);

  const verifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      setOtpError('Please enter a valid 6-digit OTP');
      return;
    }

    try {
      // Remove sessionToken and Authorization header logic
      await signerHttp.post(`${API_BASE.replace('/api', '')}/sign/${link}/verify`, { otp });
      setOtpVerified(true);
      setOtpError('');
        } catch (err: any) {
      setOtpError('Invalid OTP code');
    }
  };

  const handleSign = async () => {
    if (!consent || !signature.trim()) {
      setError('Please provide consent and signature');
      return;
    }


    setSigning(true);
    try {
      // Remove sessionToken and Authorization header logic
      await signerHttp.post(`${API_BASE.replace('/api', '')}/sign/${link}`, {
        signature,
        consent,
        // Pass location best-effort only if available
        ...(location.latitude && location.longitude ? { location: { latitude: location.latitude, longitude: location.longitude } } : {}),
        placement: placement || { pageNumber: currentPage || 1, x: 0.1, y: 0.1, width: 0.25, height: 0.08 }
      });
      // Set success state
      setSignedSuccessfully(true);
      // Best-effort refresh envelope after signing
      try {
        const refreshed = await signerHttp.get<Envelope>(`${API_BASE.replace('/api', '')}/sign/${link}`);
        setEnvelope((prev) => ({ ...(prev as Envelope), ...(refreshed.data as any) }));
      } catch {}
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to sign document');
    } finally {
      setSigning(false);
    }
  };

  const handleDecline = async () => {
    if (!window.confirm('Are you sure you want to decline signing this document?')) {
      return;
    }

    try {
      // Remove sessionToken and Authorization header logic
      await signerHttp.post(`${API_BASE.replace('/api', '')}/sign/${link}/decline`, {});
      alert('Document signing declined.');
    } catch (err: any) {
      setError('Failed to decline document');
    }
  };

  const handleDownloadSignedDocument = async () => {
    if (!link) return;
    
    try {
      // Use the signing link download endpoint
      const response = await signerHttp.get(
        `${API_BASE.replace('/api', '')}/sign/${link}/download`,
        { responseType: 'blob' }
      );
      
      // Create download link
      const url = window.URL.createObjectURL(response.data as Blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      const filename = response.headers['content-disposition']?.split('filename=')[1] || 'signed_document.pdf';
      downloadLink.setAttribute('download', filename);
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError('Failed to download signed document: ' + (err.response?.data?.message || err.message));
    }
  };

  console.log('Rendering component. Loading:', loading, 'Error:', error);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <XCircleIcon className="mx-auto h-12 w-12 text-red-500" />
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              {error === 'Authentication required. Please check your email for instructions.' 
                ? 'Authentication Required'
                : 'Signing Link Invalid'}
            </h2>
            <p className="mt-2 text-sm text-gray-600">{error}</p>
            {error === 'Authentication required. Please check your email for instructions.' && (
              <p className="mt-4 text-xs text-gray-500">
                Please check your email for verification instructions. You may need to refresh this page after verifying.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!envelope || !currentSigner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-yellow-500" />
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Loading Signing Request</h2>
            <p className="mt-2 text-sm text-gray-600">Please wait while we verify your access...</p>
          </div>
        </div>
      </div>
    );
  }

  // Check if already signed
  if (currentSigner.signedAt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500" />
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Already Signed</h2>
            <p className="mt-2 text-sm text-gray-600">
              You have already signed this document on {new Date(currentSigner.signedAt).toLocaleDateString()}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Check if declined
  if (currentSigner.declinedAt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <XCircleIcon className="mx-auto h-12 w-12 text-red-500" />
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Document Declined</h2>
            <p className="mt-2 text-sm text-gray-600">
              You declined to sign this document on {new Date(currentSigner.declinedAt).toLocaleDateString()}.
            </p>
          </div>
        </div>
      </div>
    );
  }


  // Show success screen after signing
  if (signedSuccessfully) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500" />
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Document Signed Successfully!</h2>
            <p className="mt-2 text-sm text-gray-600">
              Your signature has been applied to the document. You can now download the signed document.
            </p>
            <div className="mt-6">
<button
                onClick={handleDownloadSignedDocument}
                disabled={envelope?.status !== 'COMPLETED'}
                className={`inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${envelope?.status === 'COMPLETED' ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'} focus:outline-none focus:ring-2 focus:ring-offset-2 ${envelope?.status === 'COMPLETED' ? 'focus:ring-green-500' : ''}`}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Signed Document
              </button>
            </div>
{envelope?.status !== 'COMPLETED' && (
              <div className="mt-4 rounded-md bg-yellow-50 p-4">
                <div className="text-sm text-yellow-800">The final signed document will be available once all signers have signed.</div>
              </div>
            )}
            {error && (
              <div className="mt-4 rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">
                {envelope?.subject || 'Document Signing Request'}
              </h1>
              {envelope?.document && (
                <p className="mt-2 text-gray-600">
                  You have been requested to sign: <strong>{envelope.document.originalName}</strong>
                </p>
              )}
              {envelope?.message && (
                <div className="mt-4 p-4 bg-blue-50 rounded-md">
                  <p className="text-sm text-blue-800">{envelope.message}</p>
                </div>
              )}
            </div>

            {/* OTP Verification */}
            {!otpVerified && (
              <div className="mb-6 p-4 border border-gray-200 rounded-md">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Verify Your Identity</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Please enter the 6-digit OTP code sent to your email address.
                </p>
                <div className="flex space-x-3">
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-center text-lg tracking-widest"
                    maxLength={6}
                  />
                  <button
                    onClick={verifyOtp}
                    className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
                  >
                    Verify
                  </button>
                </div>
                {otpError && (
                  <p className="mt-2 text-sm text-red-600">{otpError}</p>
                )}
              </div>
            )}

            {/* Document Preview */}
{otpVerified && envelope?.document && (
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Document Preview</h3>
                <div className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center space-x-3 mb-4">
                    <DocumentTextIcon className="h-8 w-8 text-red-500" />
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">{envelope.document.originalName}</h4>
                      {envelope.document.sha256Hash && (
                        <p className="text-xs text-gray-500 font-mono">
                          Hash: {envelope.document.sha256Hash}
                        </p>
                      )}
                    </div>
                  </div>
                  <div 
                    ref={pdfContainerRef}
                    className="relative"
                    onClick={(e) => {
                      if (!pageSize) return;
                      const rect = (pdfContainerRef.current as HTMLDivElement).getBoundingClientRect();
                      const relX = (e.clientX - rect.left) / rect.width; // 0..1
                      const relYFromTop = (e.clientY - rect.top) / rect.height; // 0..1 top-origin
                      const relY = 1 - relYFromTop; // convert to bottom-origin to match PDF coordinates
                      // Default size ratios
                      const width = 0.25;
                      const height = 0.08;
                      setPlacement({ pageNumber: currentPage, x: relX, y: relY, width, height });
                    }}
                  >
                    <PDFPreview 
                      file={`${API_BASE.replace('/api','')}/sign/${link}/preview`}
                      onPageChange={(p) => setCurrentPage(p)}
                      onPageLoad={(h) => setPageSize({ width: (pdfContainerRef.current?.clientWidth || 800), height: h })}
                    />
                    {/* Placement overlay */}
                    {placement && placement.pageNumber === currentPage && (
                      <div
                        className="pointer-events-none absolute border-2 border-green-500 bg-green-200 bg-opacity-20"
                        style={{
                          left: `${(placement.x) * 100}%`,
                          bottom: `${(placement.y) * 100}%`,
                          width: `${placement.width * 100}%`,
                          height: `${placement.height * 100}%`,
                          transform: 'translate(-0%, -0%)'
                        }}
                      />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Click on the page to place your signature. A green box will show the placement.</p>
                </div>
              </div>
            )}

            {/* Signing Form */}
            {otpVerified && (
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Sign Document</h3>
                
                {/* Location Status */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                    <MapPinIcon className="h-5 w-5 mr-2 text-gray-500" />
                    Location Verification
                  </h4>
                  
                  {location.error ? (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-700">{location.error}</p>
                      <p className="text-xs text-red-600 mt-1">Please enable location access to continue signing.</p>
                    </div>
                  ) : location.loading ? (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
                      <p className="text-sm text-gray-700">Requesting location access...</p>
                    </div>
                  ) : location.latitude && location.longitude ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-md overflow-hidden">
                      <LocationMap 
                        latitude={location.latitude} 
                        longitude={location.longitude}
                        cityName={undefined}
                        height={200}
                      />
                    </div>
                  ) : null}
                </div>

                {/* Consent Checkbox */}
                <div className="mb-4">
                  <label className="flex items-start">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span className="ml-3 text-sm text-gray-700">
                      {envelope.compliance?.consentText || 'I consent to electronically sign this document and understand that my electronic signature has the same legal effect as a handwritten signature. I understand that my location will be recorded for verification purposes.'}
                    </span>
                  </label>
                </div>

                {/* Legal Notice */}
                {envelope.compliance?.legalNotice && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">Legal Notice</h4>
                    <p className="text-sm text-blue-800">{envelope.compliance.legalNotice}</p>
                  </div>
                )}

{/* Signature Input */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Draw Your Signature
                  </label>
                  <SignatureCanvas
                    onChange={(dataUrl) => setSignature(dataUrl)}
                    height={160}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Use your mouse or finger to draw your signature. Then click on the PDF to choose where to place it.
                  </p>
                </div>

                {error && (
                  <div className="mb-4 rounded-md bg-red-50 p-4">
                    <div className="text-sm text-red-700">{error}</div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <button
onClick={handleSign}
                    disabled={signing || !consent || !signature.trim()}
                    className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                  >
                    {signing ? 'Signing...' : 'Sign Document'}
                  </button>
                  <button
                    onClick={handleDecline}
                    className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}

            {/* Signers Status */}
            {envelope?.signers && envelope.signers.length > 0 && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Signing Status</h3>
                <div className="space-y-2">
                  {envelope.signers.map((signer) => (
                    <div key={signer.id || signer.email} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{signer.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">{signer.email}</p>
                      </div>
                      <div className="flex items-center space-x-2">
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
                            Pending
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signing;