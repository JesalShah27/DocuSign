/**
 * DocumentUpload component for the DocUsign application
 * 
 * A drag-and-drop file upload component specifically designed for PDF documents.
 */

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  CloudArrowUpIcon,
  DocumentIcon,
  ExclamationTriangleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { validatePdfFile, formatFileSize } from '../../shared/utils/pdf';
import { FILE_LIMITS } from '../../shared/constants';

interface DocumentUploadProps {
  onUpload: (files: File[]) => Promise<void>;
  maxSize?: number;
  multiple?: boolean;
  className?: string;
  disabled?: boolean;
}

interface FileWithPreview extends File {
  preview?: string;
  error?: string;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({
  onUpload,
  maxSize = FILE_LIMITS.MAX_SIZE_BYTES,
  multiple = false,
  className = '',
  disabled = false
}) => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setError(null);

    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles.map(fileRejection => {
        const error = fileRejection.errors[0];
        if (error.code === 'file-too-large') {
          return `${fileRejection.file.name}: File is too large (max ${formatFileSize(maxSize)})`;
        } else if (error.code === 'file-invalid-type') {
          return `${fileRejection.file.name}: Only PDF files are allowed`;
        }
        return `${fileRejection.file.name}: ${error.message}`;
      });
      setError(errors.join('\n'));
      return;
    }

    // Validate files
    const validFiles: FileWithPreview[] = [];
    const invalidFiles: string[] = [];

    acceptedFiles.forEach(file => {
      const validationError = validatePdfFile(file, maxSize);
      if (validationError) {
        invalidFiles.push(`${file.name}: ${validationError}`);
      } else {
        validFiles.push(Object.assign(file, {
          preview: URL.createObjectURL(file)
        }));
      }
    });

    if (invalidFiles.length > 0) {
      setError(invalidFiles.join('\n'));
    }

    if (validFiles.length > 0) {
      setFiles(prevFiles => multiple ? [...prevFiles, ...validFiles] : validFiles);
    }
  }, [maxSize, multiple]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': FILE_LIMITS.ALLOWED_EXTENSIONS
    },
    maxSize,
    multiple,
    disabled: disabled || uploading,
  });

  const handleUpload = async () => {
    if (files.length === 0 || disabled) return;
    
    setUploading(true);
    setError(null);
    setUploadProgress(0);
    
    try {
      await onUpload(files);
      setFiles([]);
      setUploadProgress(100);
      
      // Reset after success
      setTimeout(() => {
        setUploadProgress(0);
        setUploading(false);
      }, 1500);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Upload failed. Please try again.');
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const removeFile = useCallback((index: number) => {
    setFiles(prevFiles => {
      const newFiles = [...prevFiles];
      const fileToRemove = newFiles[index];
      
      // Clean up object URL
      if (fileToRemove.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      
      newFiles.splice(index, 1);
      return newFiles;
    });
    
    // Clear any errors when files are removed
    if (error) {
      setError(null);
    }
  }, [error]);

  const clearAllFiles = useCallback(() => {
    files.forEach(file => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
    setFiles([]);
    setError(null);
  }, [files]);

  // Cleanup object URLs on unmount
  React.useEffect(() => {
    return () => {
      files.forEach(file => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, [files]);

  const dropzoneClassName = `
    border-2 border-dashed rounded-lg p-8 cursor-pointer text-center transition-all duration-200
    ${isDragActive 
      ? 'border-primary-500 bg-primary-50 scale-105' 
      : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
    }
    ${error ? 'border-red-500 bg-red-50' : ''}
    ${disabled || uploading ? 'cursor-not-allowed opacity-60' : ''}
  `;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Drop Zone */}
      <div 
        {...getRootProps()} 
        className={dropzoneClassName}
        role="button"
        tabIndex={disabled || uploading ? -1 : 0}
        aria-disabled={disabled || uploading}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center space-y-3">
          <CloudArrowUpIcon 
            className={`w-12 h-12 ${
              isDragActive ? 'text-primary-500' : 'text-gray-400'
            }`} 
          />
          {isDragActive ? (
            <div>
              <p className="text-primary-600 font-medium">Drop your PDF files here</p>
              <p className="text-sm text-primary-500">Release to upload</p>
            </div>
          ) : (
            <div>
              <p className="text-gray-700 font-medium">
                {disabled ? 'Upload disabled' : 'Drag & drop PDF files here, or click to select'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Maximum file size: {formatFileSize(maxSize)}
              </p>
              {multiple && (
                <p className="text-xs text-gray-400 mt-1">
                  You can upload multiple files at once
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-start space-x-2 text-red-700 bg-red-50 border border-red-200 p-4 rounded-lg">
          <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium">Upload Error</p>
            <p className="text-sm whitespace-pre-line mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-900">
              Selected Files ({files.length})
            </h4>
            {files.length > 1 && !uploading && (
              <button
                onClick={clearAllFiles}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="space-y-2">
            {files.map((file, index) => (
              <div 
                key={`${file.name}-${index}`}
                className="flex items-center space-x-3 p-3 bg-gray-50 border border-gray-200 rounded-lg"
              >
                <DocumentIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                {!uploading && (
                  <button
                    onClick={() => removeFile(index)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    title={`Remove ${file.name}`}
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={uploading || disabled || files.length === 0}
            className={`
              w-full px-4 py-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
              ${uploading || disabled
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800'
              }
            `}
          >
            {uploading 
              ? `Uploading... (${Math.round(uploadProgress)}%)` 
              : `Upload ${files.length} ${files.length === 1 ? 'File' : 'Files'}`
            }
          </button>

          {/* Progress Bar */}
          {uploading && (
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-primary-600 transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;