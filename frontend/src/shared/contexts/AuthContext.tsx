/**
 * Authentication context for the DocUsign application
 * 
 * Provides authentication state management, login, register, and logout functionality.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthContextType, LoginRequest, RegisterRequest } from '../types/auth';
import { apiClient } from '../utils/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('token');
      
      if (token) {
        try {
          // Verify token and get user info
          const userData = await apiClient.auth.getCurrentUser();
          setUser(userData);
          console.log('User session restored');
        } catch (error) {
          console.error('Session verification failed:', error);
          // Clear invalid token
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
        }
      }
      
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      console.log('Attempting login with email:', email);
      const credentials: LoginRequest = { email, password };
      const response = await apiClient.auth.login(credentials);
      
      if (!response.accessToken) {
        throw new Error('Invalid response: missing token');
      }
      
      // Store tokens
      localStorage.setItem('token', response.accessToken);
      if (response.refreshToken) {
        localStorage.setItem('refreshToken', response.refreshToken);
      }
      
      // Set token and user data
      setToken(response.accessToken);
      setUser(response.user);
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

  const register = async (email: string, password: string, name: string): Promise<void> => {
    try {
      console.log('Attempting registration with email:', email);
      const userData: RegisterRequest = { email, password, name };
      const response = await apiClient.auth.register(userData);
      
      if (!response.accessToken) {
        throw new Error('Registration failed: Invalid server response');
      }
      
      // Store tokens
      localStorage.setItem('token', response.accessToken);
      if (response.refreshToken) {
        localStorage.setItem('refreshToken', response.refreshToken);
      }
      
      // Set token and user data
      setToken(response.accessToken);
      setUser(response.user);
      console.log('Registration and automatic login successful');
      
      // Show success message if provided
      if (response.message) {
        console.log('Registration success:', response.message);
      }
    } catch (error: any) {
      console.error('Registration error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      // Debug: log the full error object structure
      console.log('DEBUG: Full error object:', JSON.stringify(error, null, 2));
      console.log('DEBUG: Response data:', error.response?.data);
      console.log('DEBUG: Response status:', error.response?.status);
      console.log('DEBUG: Response data message:', error.response?.data?.message);
      
      // Handle specific error cases with user-friendly messages
      if (error.response?.status === 409 && error.response?.data?.message) {
        // User already exists error
        error.message = error.response.data.message;
      } else if (error.response?.status === 400 && error.response?.data?.fieldErrors) {
        // Transform validation errors into user-friendly messages
        const validationErrors = error.response.data.fieldErrors;
        const errorMessages: string[] = [];
        
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

  const logout = (): void => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    console.log('User logged out');
  };

  const contextValue: AuthContextType = {
    user,
    loading,
    token,
    login,
    register,
    logout
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}