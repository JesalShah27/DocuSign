import { GlobalWorkerOptions } from 'pdfjs-dist';

// Initialize PDF.js worker
export function initPdfWorker() {
  GlobalWorkerOptions.workerSrc = '//cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
}