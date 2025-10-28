import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  AiOutlineCloudUpload as CloudUploadIconBase, 
  AiOutlineFile as FileIconBase, 
  AiOutlineWarning as WarningIconBase 
} from 'react-icons/ai';

// Create wrapper components that apply type annotations
const CloudUploadIcon = CloudUploadIconBase as React.ComponentType<React.SVGAttributes<SVGElement>>;
const FileIcon = FileIconBase as React.ComponentType<React.SVGAttributes<SVGElement>>;
const WarningIcon = WarningIconBase as React.ComponentType<React.SVGAttributes<SVGElement>>;

interface DocumentUploadProps {
  onUpload: (files: File[]) => Promise<void>;
  maxSize?: number; // Maximum file size in bytes
  multiple?: boolean;
  className?: string;
}

interface FileWithPreview extends File {
  preview?: string;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({
  onUpload,
  maxSize = 10 * 1024 * 1024, // 10MB default
  multiple = false,
  className = ''
}) => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles.map(file => {
        const error = file.errors[0];
        return `${file.file.name}: ${error.message}`;
      });
      setError(errors.join('\n'));
      return;
    }

    setError(null);
    const newFiles = acceptedFiles.map(file => 
      Object.assign(file, {
        preview: URL.createObjectURL(file)
      })
    );
    setFiles(prevFiles => multiple ? [...prevFiles, ...newFiles] : newFiles);
  }, [multiple]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxSize,
    multiple,
  });

  const handleUpload = async () => {
    if (files.length === 0) return;
    
    setUploading(true);
    setError(null);
    
    try {
      await onUpload(files);
      setFiles([]);
      setUploadProgress(100);
      setTimeout(() => {
        setUploadProgress(0);
        setUploading(false);
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
      setUploading(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prevFiles => {
      const newFiles = [...prevFiles];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  React.useEffect(() => {
    return () => {
      // Cleanup previews on unmount
      files.forEach(file => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, [files]);

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div 
        {...getRootProps()} 
        className={`
          border-2 border-dashed rounded-lg p-6 cursor-pointer text-center transition-colors
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${error ? 'border-red-500 bg-red-50' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          <CloudUploadIcon className="w-12 h-12 text-gray-400" />
          {isDragActive ? (
            <p className="text-blue-500">Drop your PDF files here</p>
          ) : (
            <>
              <p className="text-gray-600">Drag &amp; drop PDF files here, or click to select</p>
              <p className="text-sm text-gray-500">
                Maximum file size: {(maxSize / (1024 * 1024)).toFixed(0)}MB
              </p>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded">
          <WarningIcon className="flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {files.length > 0 && (
        <div className="flex flex-col gap-2">
          {files.map((file, index) => (
            <div 
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded border border-gray-200"
            >
              <FileIcon className="flex-shrink-0 w-5 h-5 text-gray-400" />
              <div className="flex-grow min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">
                  {file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                onClick={() => removeFile(index)}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ))}

          <button
            onClick={handleUpload}
            disabled={uploading}
            className={`
              mt-2 px-4 py-2 rounded text-white font-medium
              ${uploading
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700'
              }
            `}
          >
            {uploading ? 'Uploading...' : 'Upload Files'}
          </button>

          {uploading && (
            <div className="w-full h-2 bg-gray-200 rounded overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-300"
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