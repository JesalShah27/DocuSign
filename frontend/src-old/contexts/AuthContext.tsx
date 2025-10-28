import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import type { User, AuthResponse } from '../types/api';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

// Create an axios instance with default config
const axiosInstance = axios.create({
  baseURL: API_BASE,
  // Credentials are not needed for token-based auth; disabling avoids stricter CORS requirements
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      // Verify token and get user info
      (async () => {
        try {
          const response = await axiosInstance.get<User>('/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUser(response.data);
          console.log('User session restored');
        } catch (error) {
          console.error('Session verification failed:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          setToken(null);
        } finally {
          setLoading(false);
        }
      })();
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    try {
      console.log('Attempting login with email:', email);
      const response = await axiosInstance.post<AuthResponse>('/auth/login', { email, password });
      
      if (!response.data.accessToken) {
        throw new Error('Invalid response: missing token');
      }
      
      const newToken = response.data.accessToken;
      setToken(newToken);
      localStorage.setItem('token', newToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
      
      // Set user data from login response
      setUser(response.data.user);
      console.log('Login successful');
    } catch (error: any) {
      console.error('Login error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      throw error;
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      console.log('Attempting registration with payload:', { name, email, password: '***' });
      const response = await axiosInstance.post<{ id: string; email: string; name: string; message: string }>('/auth/register', { name, email, password });
      console.log('Registration response:', response.data);
      
      console.log('Attempting automatic login after registration');
      await login(email, password);
    } catch (error: any) {
      console.error('Registration error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        details: error.response?.data?.error || error.response?.data?.fieldErrors
      });
      
      // Transform validation errors into a more user-friendly message
      if (error.response?.status === 400) {
        const validationErrors = error.response.data?.fieldErrors || {};
        const errorMessages = [];
        
        if (validationErrors.name) {
          errorMessages.push('Name: ' + validationErrors.name.join(', '));
        }
        if (validationErrors.email) {
          errorMessages.push('Email: ' + validationErrors.email.join(', '));
        }
        if (validationErrors.password) {
          errorMessages.push('Password: ' + validationErrors.password.join(', '));
        }
        
        if (errorMessages.length > 0) {
          error.message = errorMessages.join('\n');
        }
      }
      
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}