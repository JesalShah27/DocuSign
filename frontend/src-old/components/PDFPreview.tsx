import React, { useState, useCallback } from 'react';
import { Document, Page } from 'react-pdf';
import { 
  ChevronLeftIcon, 
  ChevronRightIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  XMarkIcon 
} from '@heroicons/react/24/outline';
import '../styles/pdf-viewer.css';

interface PDFFileUrl {
  url: string;
  httpHeaders?: Record<string, string>;
  withCredentials?: boolean;
}

interface PDFPreviewProps {
  file: File | string | PDFFileUrl;
  onClose?: () => void;
  onPageLoad?: (pageHeight: number) => void;
  onPageChange?: (pageNumber: number) => void;
  fullScreen?: boolean;
}

const PDFPreview: React.FC<PDFPreviewProps> = ({ file, onClose, onPageChange, onPageLoad, fullScreen = false }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);

  // Handle window resize
  React.useEffect(() => {
    const handleResize = () => {
      if (pageSize) {
        const containerWidth = Math.min(window.innerWidth - 48, 800);
        const aspectRatio = pageSize.height / pageSize.width;
        setPageSize({
          width: containerWidth,
          height: containerWidth * aspectRatio
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pageSize]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    // Only call onPageChange if pageNumber has changed
    onPageChange?.(pageNumber);
  };

  const onDocumentLoadError = (err: Error) => {
    console.error('Error loading PDF:', err);
    setError('Failed to load PDF document');
    setLoading(false);
  };

  const previousPage = useCallback(() => {
    setPageNumber((prevPage) => {
      const newPage = Math.max(prevPage - 1, 1);
      onPageChange?.(newPage);
      return newPage;
    });
  }, [onPageChange]);

  const nextPage = useCallback(() => {
    setPageNumber((prevPage) => {
      const newPage = Math.min(prevPage + 1, numPages || 1);
      onPageChange?.(newPage);
      return newPage;
    });
  }, [onPageChange, numPages]);

  const handleZoomIn = () => {
    setScale(prevScale => Math.min(prevScale + 0.2, 3));
  };

  const handleZoomOut = () => {
    setScale(prevScale => Math.max(prevScale - 0.2, 0.4));
  };

  // Handle keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        previousPage();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        nextPage();
      } else if (e.key === '+' || (e.metaKey && e.key === '=')) {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-' || (e.metaKey && e.key === '-')) {
        e.preventDefault();
        handleZoomOut();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pageNumber, numPages, nextPage, previousPage]);

  return (
    <div 
      className={`bg-white rounded-lg shadow-lg overflow-hidden ${fullScreen ? 'fixed inset-0 z-50' : ''}`}
      role="region"
      aria-label="PDF viewer"
    >
      <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={previousPage}
            disabled={pageNumber <= 1}
            className="p-1 rounded-md hover:bg-gray-200 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
            title="Previous page"
            aria-label="Previous page"
          >
            <ChevronLeftIcon className="h-5 w-5 text-gray-600" aria-hidden="true" />
          </button>
          <div className="text-sm text-gray-600" role="status" aria-live="polite">
            Page {pageNumber} of {numPages || '...'}
          </div>
          <button
            onClick={nextPage}
            disabled={pageNumber >= (numPages || 1)}
            className="p-1 rounded-md hover:bg-gray-200 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
            title="Next page"
            aria-label="Next page"
          >
            <ChevronRightIcon className="h-5 w-5 text-gray-600" aria-hidden="true" />
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleZoomOut}
            className="p-1 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            title="Zoom out (Shortcut: -)"
            aria-label="Zoom out"
          >
            <MagnifyingGlassMinusIcon className="h-5 w-5 text-gray-600" aria-hidden="true" />
          </button>
          <div 
            className="text-sm text-gray-600 w-16 text-center" 
            role="status" 
            aria-label="Zoom level"
          >
            {Math.round(scale * 100)}%
          </div>
          <button
            onClick={handleZoomIn}
            className="p-1 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            title="Zoom in (Shortcut: +)"
            aria-label="Zoom in"
          >
            <MagnifyingGlassPlusIcon className="h-5 w-5 text-gray-600" aria-hidden="true" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-gray-200 ml-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              title="Close viewer"
              aria-label="Close viewer"
            >
              <XMarkIcon className="h-5 w-5 text-gray-600" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="relative p-4">
        {loading && (
          <div 
            className="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-75"
            role="status"
            aria-label="Loading PDF document"
          >
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200 border-t-primary-600"></div>
            <div className="mt-4 text-sm text-gray-600">Loading document...</div>
          </div>
        )}

        {error ? (
          <div 
            className="text-center py-8 max-w-lg mx-auto"
            role="alert"
            aria-live="assertive"
          >
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-red-800 font-medium mb-2">Error loading PDF</h3>
              <p className="text-red-600 text-sm">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  // Force document reload
                  const docElement = document.querySelector('.react-pdf__Document');
                  if (docElement) {
                    docElement.innerHTML = '';
                  }
                }}
                className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Try again
              </button>
            </div>
          </div>
        ) : (
          <div 
            className="relative"
            role="main"
            aria-label={`PDF document viewer - Page ${pageNumber} of ${numPages || '...'}`}
          >
            <Document
              file={file}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div 
                  className="flex flex-col items-center justify-center py-8"
                  role="status"
                  aria-label="Loading page"
                >
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-200 border-t-primary-600"></div>
                  <div className="mt-4 text-sm text-gray-600">Loading page...</div>
                </div>
              }
            >
              <div className="mx-auto rounded-lg shadow-lg overflow-hidden bg-gray-50">
                <Page
                  pageNumber={pageNumber}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="mx-auto"
                  onLoadSuccess={page => {
                    const containerWidth = Math.min(window.innerWidth - 48, 800);
                    const aspectRatio = page.height / page.width;
                    const newHeight = containerWidth * aspectRatio;
                    
                    setPageSize({
                      width: containerWidth,
                      height: newHeight
                    });
                    onPageLoad?.(newHeight);
                  }}
                  onRenderError={() => {
                    setError('Failed to render page. Please try again.');
                  }}
                  scale={scale}
                  width={pageSize?.width || Math.min(window.innerWidth - 48, 800)}
                  error={
                    <div className="p-4 text-center">
                      <p className="text-red-600 text-sm">Error loading page {pageNumber}</p>
                    </div>
                  }
                />
              </div>
            </Document>
            
            {/* Page thumbnails for quick navigation (optional) */}
            {numPages && numPages > 1 && (
              <div 
                className="fixed right-4 top-1/2 transform -translate-y-1/2 bg-white rounded-lg shadow-lg p-2 space-y-2"
                role="navigation"
                aria-label="Page thumbnails"
              >
                {Array.from(new Array(numPages), (el, index) => (
                  <button
                    key={`thumb-${index + 1}`}
                    onClick={() => {
                      setPageNumber(index + 1);
                      onPageChange?.(index + 1);
                    }}
                    className={`w-8 h-8 flex items-center justify-center text-sm rounded-md 
                      ${pageNumber === index + 1 
                        ? 'bg-primary-100 text-primary-700' 
                        : 'text-gray-600 hover:bg-gray-100'
                      }
                      focus:outline-none focus:ring-2 focus:ring-primary-500
                    `}
                    aria-label={`Go to page ${index + 1}`}
                    aria-current={pageNumber === index + 1 ? 'page' : undefined}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFPreview;