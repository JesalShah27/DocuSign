/**
 * API client for the DocUsign application
 * 
 * Centralized API communication with request/response interceptors,
 * error handling, and type-safe endpoints.
 */

import axios from 'axios';
import { 
  Document, 
  Envelope, 
  AuthResponse, 
  User, 
  LoginRequest, 
  RegisterRequest,
  CreateEnvelopeRequest,
  APIResponse,
  PaginatedResponse 
} from '../types';

// Using any types for broader axios version compatibility
type AxiosInstance = any;
type AxiosResponse = any;
type InternalAxiosRequestConfig = any;
type AxiosProgressEvent = any;

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config: any) => {
        const token = localStorage.getItem('token');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error: any) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      (error: any) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Authentication endpoints
  auth = {
    login: async (credentials: LoginRequest): Promise<AuthResponse> => {
      const { data } = await this.client.post('/auth/login', credentials);
      return data;
    },

    register: async (userData: RegisterRequest): Promise<AuthResponse> => {
      const { data } = await this.client.post('/auth/register', userData);
      return data;
    },

    logout: async (): Promise<void> => {
      await this.client.post('/auth/logout');
    },

    refreshToken: async (): Promise<AuthResponse> => {
      const { data } = await this.client.post('/auth/refresh');
      return data;
    },

    getCurrentUser: async (): Promise<User> => {
      const { data } = await this.client.get('/auth/me');
      return data;
    },
  };

  // Document endpoints
  documents = {
    upload: async (
      file: File, 
      onProgress?: (progress: number) => void
    ): Promise<Document> => {
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await this.client.post('/documents', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent: any) => {
          if (progressEvent.total && onProgress) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onProgress(percentCompleted);
          }
        },
      });

      return data;
    },

    list: async (): Promise<Document[]> => {
      const { data } = await this.client.get('/documents');
      return data;
    },

    get: async (id: string): Promise<Document> => {
      const { data } = await this.client.get(`/documents/${id}`);
      return data;
    },

    delete: async (id: string): Promise<void> => {
      await this.client.delete(`/documents/${id}`);
    },

    getPreviewUrl: (id: string): string => {
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';
      return `${API_BASE_URL}/documents/${id}/preview`;
    },
  };

  // Envelope endpoints
  envelopes = {
    create: async (envelope: CreateEnvelopeRequest): Promise<Envelope> => {
      const { data } = await this.client.post('/envelopes', envelope);
      return data;
    },

    list: async (): Promise<Envelope[]> => {
      const { data } = await this.client.get('/envelopes');
      return data;
    },

    get: async (id: string): Promise<Envelope> => {
      const { data } = await this.client.get(`/envelopes/${id}`);
      return data;
    },

    send: async (id: string): Promise<Envelope> => {
      const { data } = await this.client.post(`/envelopes/${id}/send`);
      return data;
    },

    void: async (id: string, reason?: string): Promise<Envelope> => {
      const { data } = await this.client.post(`/envelopes/${id}/void`, { reason });
      return data;
    },

    download: async (id: string): Promise<Blob> => {
      const { data } = await this.client.get(`/envelopes/${id}/download`, {
        responseType: 'blob',
      });
      return data;
    },
  };
}

// Create and export a singleton instance
export const apiClient = new ApiClient();

// Export the default api object for backward compatibility
export default apiClient;