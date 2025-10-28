import React, { createContext, useContext, useState, useCallback } from 'react';
import { Document } from '../types/document';

interface UploadProgress {
  fileName: string;
  progress: number;
}

interface UploadContextType {
  uploadProgress: Record<string, UploadProgress>;
  addUploadProgress: (fileName: string) => void;
  updateProgress: (fileName: string, progress: number) => void;
  removeUploadProgress: (fileName: string) => void;
  isUploading: boolean;
  lastUploadedDocument: Document | null;
  setLastUploadedDocument: (doc: Document | null) => void;
}

const UploadContext = createContext<UploadContextType | null>(null);

export const useUpload = () => {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error('useUpload must be used within an UploadProvider');
  }
  return context;
};

export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});
  const [lastUploadedDocument, setLastUploadedDocument] = useState<Document | null>(null);

  const addUploadProgress = useCallback((fileName: string) => {
    setUploadProgress(prev => ({
      ...prev,
      [fileName]: { fileName, progress: 0 }
    }));
  }, []);

  const updateProgress = useCallback((fileName: string, progress: number) => {
    setUploadProgress(prev => ({
      ...prev,
      [fileName]: { fileName, progress }
    }));
  }, []);

  const removeUploadProgress = useCallback((fileName: string) => {
    setUploadProgress(prev => {
      const { [fileName]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const isUploading = Object.values(uploadProgress).length > 0;

  return (
    <UploadContext.Provider
      value={{
        uploadProgress,
        addUploadProgress,
        updateProgress,
        removeUploadProgress,
        isUploading,
        lastUploadedDocument,
        setLastUploadedDocument,
      }}
    >
      {children}
    </UploadContext.Provider>
  );
};