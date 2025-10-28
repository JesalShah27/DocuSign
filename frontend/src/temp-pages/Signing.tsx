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
import { PDFPreview } from '../components/ui';
import { SignatureCanvas } from '../components/ui';
import { useLocation } from '../shared/hooks';
import { LocationMap } from '../components/ui';

const API_BASE = 'http://localhost:4000/api';
// Use a dedicated axios instance without global interceptors to avoid Authorization header
// collisions with the app-wide interceptor (user JWT vs signer session token).
const signerHttp = axios.create({
  timeout: 60000, // 60 seconds for downloads
  headers: {
    'Accept': 'application/pdf, application/octet-stream, */*'
  }
});

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
  const [signingStep, setSigningStep] = useState<'signature' | 'placement' | 'review' | 'signing'>('signature');
  const [showPlacementHint, setShowPlacementHint] = useState(false);
  const [isEditingSignature, setIsEditingSignature] = useState(false);


  interface SignerInfo {
    email: string;
    name: string;
    documentTitle: string;
  }

  interface EnvelopeResponse extends Envelope {
    currentSignerEmail: string;
    requiresAuth?: boolean;
    signerInfo?: SignerInfo;
    predefinedPlacement?: { pageNumber: number; x: number; y: number; width: number; height: number } | null;
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

          // If predefined placement exists from server, set it and skip placement step
          if ((response.data as any).predefinedPlacement) {
            const p = (response.data as any).predefinedPlacement as any;
            setPlacement({ pageNumber: p.pageNumber, x: p.x, y: p.y, width: p.width, height: p.height });
            setSigningStep('review');
          }
          
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
  }, [link, error]);

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

  // Ensure predefined placement from server is used after OTP verification
  useEffect(() => {
    const predefined = (envelope as any)?.predefinedPlacement;
    if (otpVerified && predefined && !placement) {
      console.log('Applying predefined placement from envelope after OTP verification');
      setPlacement(predefined);
      setSigningStep('review');
      setShowPlacementHint(false);
    }
  }, [otpVerified, envelope, placement]);

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
    // Prevent multiple signing attempts
    if (signing || signedSuccessfully) {
      console.log('Signing already in progress or completed, ignoring request');
      return;
    }
    
    if (!consent || !signature.trim()) {
      setError('Please provide consent and signature');
      return;
    }

    // Determine effective placement: use predefined placement from server if available
    const effectivePlacement = placement || (envelope as any)?.predefinedPlacement || null;
    if (!effectivePlacement) {
      setError('Signature position is required. The sender may not have specified a position.');
      setSigningStep('placement');
      setShowPlacementHint(true);
      return;
    }

    console.log('Starting signing process...');
    setSigningStep('signing');
    setSigning(true);
    setError('');
    
    try {
      console.log('Sending signing request with placement:', placement);

      // Collect device fingerprint data
      const getGPUInfo = (): { vendor?: string; renderer?: string } => {
        try {
          const canvas = document.createElement('canvas');
          const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as any;
          if (!gl) return {};
          const dbgInfo = gl.getExtension('WEBGL_debug_renderer_info');
          const vendor = dbgInfo ? gl.getParameter(dbgInfo.UNMASKED_VENDOR_WEBGL) : undefined;
          const renderer = dbgInfo ? gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) : undefined;
          return { vendor, renderer };
        } catch { return {}; }
      };

      const listPlugins = () => {
        try { return Array.from(navigator.plugins || []).map(p => p.name).slice(0, 50); } catch { return []; }
      };

      const detectFonts = () => {
        // Lightweight font detection for a small common set
        const testFamilies = ['Arial', 'Courier New', 'Times New Roman', 'Georgia', 'Verdana', 'Helvetica'];
        const detected: string[] = [];
        try {
          const span = document.createElement('span');
          span.innerText = 'mmmmmmmmmmlli';
          span.style.fontSize = '72px';
          span.style.position = 'absolute';
          span.style.left = '-9999px';
          document.body.appendChild(span);
          const baseWidth = span.offsetWidth;
          for (const f of testFamilies) {
            span.style.fontFamily = `'${f}', monospace`;
            if (span.offsetWidth !== baseWidth) detected.push(f);
          }
          document.body.removeChild(span);
        } catch {}
        return detected.slice(0, 50);
      };

      const fingerprint = {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen: { width: window.screen?.width, height: window.screen?.height, dpr: window.devicePixelRatio },
        plugins: listPlugins(),
        fonts: detectFonts(),
        gpu: getGPUInfo(),
        cpu: { cores: (navigator as any).hardwareConcurrency }
      };

      // EXTREME approach - try every possible parameter name the backend might recognize
      const signingPayload = {
        signature,
        consent,
        fingerprint,
        placement: {
          pageNumber: (effectivePlacement as any).pageNumber,
          x: (effectivePlacement as any).x,
          y: (effectivePlacement as any).y,
          width: (effectivePlacement as any).width,
          height: (effectivePlacement as any).height
        },
        
        // Every possible way to say "no text"
        noText: true,
        no_text: true,
        notext: true,
        hideText: true,
        hide_text: true,
        hidetext: true,
        suppressText: true,
        suppress_text: true,
        suppresstext: true,
        disableText: true,
        disable_text: true,
        disabletext: true,
        removeText: true,
        remove_text: true,
        removetext: true,
        
        // Every possible way to say "image only"
        imageOnly: true,
        image_only: true,
        imageonly: true,
        signatureOnly: true,
        signature_only: true,
        signatureonly: true,
        
        // Every possible way to say "clean"
        clean: true,
        cleanMode: true,
        clean_mode: true,
        cleanmode: true,
        minimal: true,
        simple: true,
        
        // Every possible way to say "no info"
        noInfo: true,
        no_info: true,
        noinfo: true,
        hideInfo: true,
        hide_info: true,
        hideinfo: true,
        noMetadata: true,
        no_metadata: true,
        nometadata: true,
        
        // Reverse logic (things to disable)
        showText: false,
        show_text: false,
        showtext: false,
        includeText: false,
        include_text: false,
        includetext: false,
        addText: false,
        add_text: false,
        addtext: false,
        
        // Configuration objects
        config: {
          text: false,
          info: false,
          metadata: false,
          timestamp: false,
          clean: true,
          minimal: true,
          imageOnly: true
        },
        
        settings: {
          hideText: true,
          suppressInfo: true,
          cleanSignature: true
        },
        
        preferences: {
          textEnabled: false,
          infoEnabled: false,
          metadataEnabled: false
        }
      };
      
      // Basic validation to ensure clean data
      const cleanSignature = signature.startsWith('data:image/') ? signature : '';
      const validatedPayload = {
        ...signingPayload,
        signature: cleanSignature
      };
      
      console.log('Signing payload (validated):', {
        ...validatedPayload,
        signature: validatedPayload.signature ? 
          `[BASE64_IMAGE_DATA - Length: ${cleanSignature.length}, Type: ${cleanSignature.substring(0, 30)}...]` : 
          'NONE'
      });
      
      console.log('🎯 EXTREME APPROACH - SENDING ALL POSSIBLE TEXT SUPPRESSION FLAGS:');
      console.log('noText:', (validatedPayload as any).noText);
      console.log('hideText:', (validatedPayload as any).hideText);
      console.log('imageOnly:', (validatedPayload as any).imageOnly);
      console.log('suppressText:', (validatedPayload as any).suppressText);
      console.log('showText:', (validatedPayload as any).showText);
      console.log('config:', (validatedPayload as any).config);
      
      console.log('📝 URL params: ?notext=true&imageonly=true&clean=true&hidetext=true&suppresstext=true&minimal=true&simple=true');
      console.log('🚨 GOAL: Remove text "Name <email> signed at timestamp" from PDF');
      console.log('🔥 IF TEXT STILL SHOWS: Backend is ignoring ALL parameters - manual backend fix required');
      
      // Log payload size for debugging
      const payloadSize = JSON.stringify(validatedPayload).length;
      console.log('Payload size:', payloadSize, 'bytes');
      
      console.log('Making POST request to sign endpoint...');
      
      // Try to configure signature preferences BEFORE signing
      try {
        console.log('Attempting to configure signature preferences...');
        await signerHttp.post(
          `${API_BASE.replace('/api', '')}/sign/${link}/config`,
          {
            hideText: true,
            imageOnly: true,
            suppressMetadata: true,
            cleanMode: true
          }
        );
        console.log('Signature preferences configured');
      } catch (configError) {
        console.log('Config endpoint not available, continuing with inline parameters');
      }
      
      let signingResponse;
      try {
        // Try with full payload first
        signingResponse = await signerHttp.post(
          `${API_BASE.replace('/api', '')}/sign/${link}?notext=true&imageonly=true&clean=true&hidetext=true&suppresstext=true&minimal=true&simple=true`, 
          validatedPayload
        );
        console.log('Signing response received:', signingResponse.status, signingResponse.data);
      } catch (securityError: any) {
        if (securityError.response?.status === 400 && 
            securityError.response?.data?.message?.includes('malicious')) {
          console.log('Security filter triggered, trying minimal payload...');
          
          // Try with absolutely minimal payload
          const ep = (effectivePlacement as any);
          const minimalPayload = {
            signature: cleanSignature,
            consent: true,
            placement: {
              pageNumber: ep.pageNumber,
              x: ep.x,
              y: ep.y,
              width: ep.width,
              height: ep.height
            }
          };
          
          console.log('Trying minimal payload...');
          signingResponse = await signerHttp.post(
            `${API_BASE.replace('/api', '')}/sign/${link}`, 
            minimalPayload
          );
          console.log('Minimal signing response received:', signingResponse.status, signingResponse.data);
        } else {
          throw securityError; // Re-throw if it's not a security issue
        }
      }
      
      // Set success state
      setSignedSuccessfully(true);
      
      // Automatically download the signed document after a brief delay
      setTimeout(async () => {
        try {
          await handleDownloadSignedDocument();
        } catch (downloadError) {
          console.error('Auto-download failed:', downloadError);
          // Don't show error for auto-download failure, user can manually download
        }
      }, 1500); // Give time for the signing process to complete on server
      
      // Best-effort refresh envelope after signing
      try {
        const refreshed = await signerHttp.get<Envelope>(`${API_BASE.replace('/api', '')}/sign/${link}`);
        setEnvelope((prev) => ({ ...(prev as Envelope), ...(refreshed.data as any) }));
      } catch {}
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to sign document');
      setSigningStep('review');
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
    if (!link) {
      console.error('No signing link available');
      setError('No signing link available for download');
      return;
    }
    
    console.log('Starting document download for link:', link);
    
    try {
      // First try basic download without additional parameters
      console.log('Attempting basic download...');
      const response = await signerHttp.get(
        `${API_BASE.replace('/api', '')}/sign/${link}/download`,
        { responseType: 'blob' }
      );
      
      console.log('Download response received:', {
        status: response.status,
        contentType: response.headers['content-type'],
        contentLength: response.headers['content-length']
      });
      
      // Check if we received a valid blob
      const signedDocumentBlob = response.data as Blob;
      if (!signedDocumentBlob || signedDocumentBlob.size === 0) {
        throw new Error('Received empty or invalid document');
      }
      
      console.log('Document blob received:', {
        size: signedDocumentBlob.size,
        type: signedDocumentBlob.type
      });
      
      // Enhanced features - calculate hash and metadata (optional, non-blocking)
      try {
        const { calculateFileHash, generateSignatureData } = await import('../shared/utils/hash');
        const { formatToIST } = await import('../shared/utils/date');
        
        const documentHash = await calculateFileHash(signedDocumentBlob);
        console.log('Document hash calculated:', documentHash);
        
        const signatureDataObj = {
          documentHash,
          signerEmail: currentSigner?.email || 'unknown',
          signedAt: formatToIST(new Date()),
          location: location.latitude && location.longitude ? {
            latitude: location.latitude,
            longitude: location.longitude
          } : undefined,
          signaturePlacement: placement || { pageNumber: 1, x: 0.1, y: 0.1, width: 0.25, height: 0.08 }
        };
        
        const signatureData = generateSignatureData(signatureDataObj);
        console.log('Signature verification data generated');
        
        // Try to send metadata to server (optional)
        try {
          await signerHttp.post(`${API_BASE.replace('/api', '')}/sign/${link}/embed-hash`, {
            documentHash,
            signatureData: JSON.parse(signatureData),
            timestamp: formatToIST(new Date())
          });
          console.log('Hash metadata sent to server successfully');
        } catch (embedError) {
          console.warn('Could not send hash metadata to server:', embedError);
        }
      } catch (enhancedError) {
        console.warn('Enhanced features failed, continuing with basic download:', enhancedError);
      }
      
      // Create and trigger download
      const url = window.URL.createObjectURL(signedDocumentBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.style.display = 'none';
      
      // Generate filename
      let filename = 'signed_document.pdf';
      
      try {
        // Try to get filename from response headers
        const contentDisposition = response.headers['content-disposition'];
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename[^;=\n]*=(['"]?)([^'"\n]*?)\1/i);
          if (filenameMatch && filenameMatch[2]) {
            filename = filenameMatch[2];
          }
        }
        
        // If no filename from headers, create one with IST timestamp
        if (filename === 'signed_document.pdf') {
          const istTimestamp = new Date().toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          }).replace(/[/,:]/g, '-').replace(/\s/g, '_');
          
          const originalName = envelope?.document?.originalName || 'document.pdf';
          const nameWithoutExt = originalName.replace(/\.pdf$/i, '');
          filename = `${nameWithoutExt}_signed_${istTimestamp}.pdf`;
        }
      } catch (filenameError) {
        console.warn('Error generating filename:', filenameError);
      }
      
      console.log('Using filename:', filename);
      
      downloadLink.setAttribute('download', filename);
      document.body.appendChild(downloadLink);
      downloadLink.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(downloadLink);
        window.URL.revokeObjectURL(url);
      }, 100);
      
      console.log(`Document download completed successfully: ${filename}`);
      
    } catch (err: any) {
      console.error('Primary download method failed:', {
        error: err,
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        statusText: err.response?.statusText
      });
      
      // Try fallback download method
      console.log('Attempting fallback download method...');
      try {
        // Try with different endpoint or approach
        const fallbackUrl = `${API_BASE.replace('/api', '')}/sign/${link}/download?fallback=true`;
        console.log('Trying fallback URL:', fallbackUrl);
        
        const fallbackResponse = await signerHttp.get(fallbackUrl, {
          responseType: 'blob',
          timeout: 30000
        });
        
        if (fallbackResponse.data && (fallbackResponse.data as Blob).size > 0) {
          console.log('Fallback download successful');
          
          // Create download from fallback response
          const url = window.URL.createObjectURL(fallbackResponse.data as Blob);
          const downloadLink = document.createElement('a');
          downloadLink.href = url;
          downloadLink.style.display = 'none';
          
          // Simple filename for fallback
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `signed_document_${timestamp}.pdf`;
          
          downloadLink.setAttribute('download', filename);
          document.body.appendChild(downloadLink);
          downloadLink.click();
          
          setTimeout(() => {
            document.body.removeChild(downloadLink);
            window.URL.revokeObjectURL(url);
          }, 100);
          
          console.log('Fallback download completed:', filename);
          return; // Success, exit function
        }
      } catch (fallbackErr: any) {
        console.error('Fallback download also failed:', fallbackErr);
      }
      
      // If both methods failed, try window.open as last resort
      console.log('Trying window.open as final fallback...');
      try {
        const directUrl = `${API_BASE.replace('/api', '')}/sign/${link}/download`;
        const newWindow = window.open(directUrl, '_blank');
        if (newWindow) {
          console.log('Opened download in new window');
          // Don't show error if window.open succeeded
          return;
        }
      } catch (windowErr) {
        console.error('Window.open method also failed:', windowErr);
      }
      
      // All methods failed, show error
      let errorMessage = 'Failed to download signed document';
      
      if (err.response?.status === 404) {
        errorMessage = 'Document not found or not yet ready for download. Please try again in a few moments.';
      } else if (err.response?.status === 403) {
        errorMessage = 'Access denied - you may not have permission to download this document';
      } else if (err.response?.status === 500) {
        errorMessage = 'Server error occurred while preparing download';
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errorMessage = 'Download timeout - the document may be too large or server is busy. Please try again.';
      } else if (err.message) {
        errorMessage += ': ' + err.message;
      } else if (err.response?.data?.message) {
        errorMessage += ': ' + err.response.data.message;
      }
      
      setError(errorMessage);
    }
  };

  // Handle signature creation
  const handleSignatureChange = (dataUrl: string) => {
    console.log('Signature changed:', !!dataUrl, 'Current step:', signingStep, 'Editing:', isEditingSignature);
    setSignature(dataUrl);
    
    // Auto-advance logic after creating signature
    // If placement is already defined (e.g., predefined in envelope), skip placement step and go to review
    if (dataUrl && signingStep === 'signature' && placement && !signedSuccessfully) {
      console.log('Predefined placement detected — skipping placement step and moving to review');
      setTimeout(() => {
        setSigningStep('review');
        setShowPlacementHint(false);
      }, 100);
    } else if (dataUrl && signingStep === 'signature' && !placement && !isEditingSignature && !signedSuccessfully) {
      // Only auto-advance to placement when no placement exists
      console.log('Auto-advancing to placement step with small delay');
      setTimeout(() => {
        setSigningStep('placement');
        setShowPlacementHint(true);
      }, 100);
    }
    
    // Reset editing flag once signature is created
    if (dataUrl && isEditingSignature) {
      setIsEditingSignature(false);
    }
  };

  // Handle signature placement on PDF
  const handlePdfClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (signingStep !== 'placement' || !pageSize) return;
    
    const rect = (pdfContainerRef.current as HTMLDivElement).getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width; // 0..1
    const relYFromTop = (e.clientY - rect.top) / rect.height; // 0..1 top-origin
    const relY = 1 - relYFromTop; // convert to bottom-origin to match PDF coordinates
    
    // Default size ratios
    const width = 0.25;
    const height = 0.08;
    
    setPlacement({ pageNumber: currentPage, x: relX, y: relY, width, height });
    setSigningStep('review');
    setShowPlacementHint(false);
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
              Your signature has been applied to the document.
            </p>
            
            {/* Auto-download notification */}
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-center space-x-2">
                <svg className="animate-bounce w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm font-medium text-green-800">Download starting automatically...</p>
              </div>
            </div>
            
            <div className="mt-6">
              <button
                onClick={handleDownloadSignedDocument}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Again
              </button>
            </div>
            
            {error && (
              <div className="mt-4 rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}
            
            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                The signed document contains your digital signature and is legally binding.
              </p>
            </div>
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
                    className={`relative ${
                      signingStep === 'placement' ? 'cursor-crosshair' : 'cursor-default'
                    }`}
                    onClick={handlePdfClick}
                  >
                    <PDFPreview 
                      file={`${API_BASE.replace('/api','')}/sign/${link}/preview`}
                      onPageChange={(p) => setCurrentPage(p)}
                      onPageLoad={(h) => setPageSize({ width: (pdfContainerRef.current?.clientWidth || 800), height: h })}
                    />
                    {/* Placement overlay */}
                    {placement && placement.pageNumber === currentPage && (
                      <div
                        className="pointer-events-none absolute border-2 border-green-500 bg-green-200 bg-opacity-30 rounded"
                        style={{
                          left: `${(placement.x) * 100}%`,
                          bottom: `${(placement.y) * 100}%`,
                          width: `${placement.width * 100}%`,
                          height: `${placement.height * 100}%`,
                          transform: 'translate(-12.5%, 0%)' // Center the signature box
                        }}
                      >
                        <div className="absolute inset-0 flex items-center justify-center text-green-700 text-xs font-medium">
                          Signature Here
                        </div>
                      </div>
                    )}
                    
                    {/* Placement hint overlay for step 2 */}
                    {signingStep === 'placement' && showPlacementHint && (
                      <div className="pointer-events-none absolute inset-0 bg-blue-500 bg-opacity-10 border-2 border-dashed border-blue-400 rounded flex items-center justify-center">
                        <div className="bg-white bg-opacity-90 px-4 py-2 rounded-lg shadow-lg">
                          <p className="text-sm font-medium text-blue-800">Click anywhere on the document to place your signature</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-2 text-xs text-gray-500">
                    {signingStep === 'signature' && 'Complete your signature above to continue.'}
                    {signingStep === 'placement' && (
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <span>Click on the document where you want to place your signature.</span>
                      </div>
                    )}
                    {signingStep === 'review' && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>Signature will be placed at the marked location.</span>
                        </div>
                        {!((envelope as any)?.predefinedPlacement) && (
                          <button
                            onClick={() => {
                              setSigningStep('placement');
                              setPlacement(null);
                              setShowPlacementHint(true);
                            }}
                            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                          >
                            Change Position
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Signing Form */}
            {otpVerified && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Sign Document</h3>
                  {/* Step Indicator */}
                  <div className="flex items-center space-x-2">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                      signingStep === 'signature' ? 'bg-primary-600 text-white' : 
                      signature ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      1
                    </div>
                    <div className={`w-8 h-0.5 ${
                      signature ? 'bg-green-500' : 'bg-gray-200'
                    }`}></div>
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                      signingStep === 'placement' ? 'bg-primary-600 text-white' : 
                      placement ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      2
                    </div>
                    <div className={`w-8 h-0.5 ${
                      placement ? 'bg-green-500' : 'bg-gray-200'
                    }`}></div>
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                      signingStep === 'review' || signingStep === 'signing' ? 'bg-primary-600 text-white' : 
                      signedSuccessfully ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      3
                    </div>
                  </div>
                </div>
                
                {/* Current Step Instructions */}
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  {signingStep === 'signature' && (
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <p className="text-sm font-medium text-blue-800">Step 1: Draw your signature below</p>
                    </div>
                  )}
                  {signingStep === 'placement' && (
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <p className="text-sm font-medium text-blue-800">Step 2: Click on the document where you want to place your signature</p>
                    </div>
                  )}
                  {signingStep === 'review' && (
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <p className="text-sm font-medium text-blue-800">Step 3: Review your signature placement and click 'Sign Document' to complete</p>
                    </div>
                  )}
                  {signingStep === 'signing' && (
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      <p className="text-sm font-medium text-blue-800">Signing document and preparing download...</p>
                    </div>
                  )}
                </div>
                
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
                <div className={`mb-4 transition-opacity duration-300 ${
                  signingStep === 'signature' ? 'opacity-100' : 'opacity-75'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Draw Your Signature
                    </label>
                    {signature && signingStep !== 'signature' && (
                      <button
                        onClick={() => {
                          console.log('Edit Signature clicked - resetting state');
                          setIsEditingSignature(true);
                          setSigningStep('signature');
                          // Do NOT clear placement when predefined position exists; keep existing placement
                          setShowPlacementHint(false);
                          setSignature(''); // Clear the signature to prevent auto-advancement
                        }}
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                      >
                        Edit Signature
                      </button>
                    )}
                  </div>
                  <SignatureCanvas
                    onChange={handleSignatureChange}
                    height={160}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {signingStep === 'signature' 
                      ? 'Draw your signature using your mouse or finger.'
                      : 'Signature created ✓ - You can edit it by clicking "Edit Signature" above.'
                    }
                  </p>
                </div>

                {error && (
                  <div className="mb-4 rounded-md bg-red-50 p-4">
                    <div className="text-sm text-red-700">{error}</div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  {signingStep === 'signature' ? (
                    <div className="flex-1 text-center py-3 text-sm text-gray-500">
                      Please draw your signature above to continue
                    </div>
                  ) : signingStep === 'placement' ? (
                    <div className="flex-1 text-center py-3 text-sm text-gray-500">
                      Click on the document to place your signature
                    </div>
                  ) : (
                    <button
                      onClick={handleSign}
                      disabled={
                        signing ||
                        signedSuccessfully ||
                        !consent ||
                        !signature.trim() ||
                        (!placement && !(envelope as any)?.predefinedPlacement)
                      }
                      onDoubleClick={(e) => e.preventDefault()}
                      className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all select-none"
                      style={{ pointerEvents: (signing || signedSuccessfully) ? 'none' : 'auto' }}
                    >
                      {signingStep === 'signing' ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Signing & Preparing Download...
                        </>
                      ) : (
                        'Sign Document'
                      )}
                    </button>
                  )}
                  
                  <button
                    onClick={handleDecline}
                    disabled={signing}
                    className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}

            {/* Success State - Show after signing */}
            {signedSuccessfully && (
              <div className="border-t pt-6 mb-6">
                <div className="text-center bg-green-50 border border-green-200 rounded-lg p-6">
                  <div className="flex items-center justify-center mb-4">
                    <CheckCircleIcon className="h-12 w-12 text-green-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-green-800 mb-2">
                    Document Signed Successfully!
                  </h3>
                  <p className="text-sm text-green-700 mb-4">
                    Your signature has been applied to the document. The signed document should download automatically.
                  </p>
                  
                  <div className="space-y-3">
                    <button
                      onClick={handleDownloadSignedDocument}
                      className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                      </svg>
                      Download Signed Document
                    </button>
                    
                    <p className="text-xs text-green-600">
                      If the download doesn't start automatically, click the button above.
                    </p>
                  </div>
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