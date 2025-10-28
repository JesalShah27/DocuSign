/**
 * PDF utilities for the DocUsign application
 * 
 * Provides PDF.js configuration and PDF-related helper functions.
 */

import { GlobalWorkerOptions } from 'pdfjs-dist';

/**
 * Initialize PDF.js worker
 * This should be called once when the application starts
 */
export function initPdfWorker(): void {
  // Use CDN version for reliability
  GlobalWorkerOptions.workerSrc = '//cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
}

/**
 * Convert file size to human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Check if a file is a valid PDF
 */
export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/**
 * Validate PDF file for upload
 */
export function validatePdfFile(file: File, maxSizeBytes: number = 10 * 1024 * 1024): string | null {
  if (!isPdfFile(file)) {
    return 'Please select a valid PDF file';
  }
  
  if (file.size > maxSizeBytes) {
    return `File size must be less than ${formatFileSize(maxSizeBytes)}`;
  }
  
  return null; // Valid
}

/**
 * Create a download link for a blob
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = filename;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  window.URL.revokeObjectURL(url);
}