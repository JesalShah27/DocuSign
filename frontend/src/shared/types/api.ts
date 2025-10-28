/**
 * API-related types for the DocUsign application
 */

export interface APIResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface APIError {
  message: string;
  code?: string;
  details?: Record<string, any>;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  event: string;
  actorEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: any;
}

export interface UploadProgress {
  fileName: string;
  progress: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}