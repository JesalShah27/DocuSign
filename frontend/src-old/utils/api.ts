import { Document, DocumentWithSigners } from '../types/document';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

// Add authorization header to requests if token exists
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  console.log('🔐 API Request:', config.url, '| Token exists:', !!token, '| Token preview:', token?.slice(0, 20) + '...');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor to log responses
axios.interceptors.response.use(
  response => {
    console.log('✅ API Response:', response.config.url, '| Status:', response.status, '| Data preview:', Array.isArray(response.data) ? `Array(${response.data.length})` : typeof response.data);
    if (Array.isArray(response.data) && response.data.length > 0) {
      console.log('📄 First item preview:', response.data[0]);
    }
    return response;
  },
  error => {
    console.error('❌ API Error:', error.config?.url, '| Status:', error.response?.status, '| Message:', error.response?.data?.message || error.message);
    return Promise.reject(error);
  }
);

interface UploadProgressCallback {
  (progress: number): void;
}

export const api = {
  // Document Management
  documents: {
    upload: async (file: File, onProgress?: UploadProgressCallback): Promise<Document> => {
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await axios.post<Document>(
        `${API_BASE_URL}/documents`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          // @ts-ignore - onUploadProgress is valid but type definitions are incomplete
          onUploadProgress: (progressEvent: { loaded: number; total?: number }) => {
            if (progressEvent.total && onProgress) {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              onProgress(percentCompleted);
            }
          }
        });

      return data;
    },

    list: async (): Promise<Document[]> => {
      const { data } = await axios.get<Document[]>(`${API_BASE_URL}/documents`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      return data;
    },

    get: async (id: string): Promise<Document> => {
      const { data } = await axios.get<Document>(`${API_BASE_URL}/documents/${id}`);
      return data;
    },

    getWithSigners: async (id: string): Promise<DocumentWithSigners> => {
      const { data } = await axios.get<DocumentWithSigners>(`${API_BASE_URL}/documents/${id}/signers`);
      return data;
    },

    getPreviewUrl: (id: string): string => {
      return `${API_BASE_URL}/documents/${id}/preview`;
    },
  },
};

export default api;