/**
 * Main App component for the DocUsign application
 * 
 * Sets up routing, authentication, and core application structure.
 */

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './shared/contexts';
import { Login, Register } from './features/auth';
import { initPdfWorker } from './shared/utils/pdf';
import { Layout } from './components';
import { ROUTES } from './shared/constants';

// TODO: Move these pages to their respective feature folders
import Dashboard from './temp-pages/Dashboard';
import Documents from './temp-pages/Documents';
import Envelopes from './temp-pages/Envelopes';
import EnvelopeDetails from './temp-pages/EnvelopeDetails';
import Signing from './temp-pages/Signing';
import Analytics from './temp-pages/Analytics';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }
  
  return user ? <>{children}</> : <Navigate to={ROUTES.LOGIN} />;
}

function App() {
  useEffect(() => {
    // Initialize PDF.js worker on app startup
    initPdfWorker();
  }, []);

  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Public routes */}
            <Route path={ROUTES.LOGIN} element={<Login />} />
            <Route path={ROUTES.REGISTER} element={<Register />} />
            <Route path={ROUTES.SIGNING} element={<Signing />} />
            
            {/* Protected routes */}
            <Route path={ROUTES.HOME} element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path={ROUTES.DOCUMENTS} element={
              <ProtectedRoute>
                <Layout>
                  <Documents />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path={ROUTES.ENVELOPES} element={
              <ProtectedRoute>
                <Layout>
                  <Envelopes />
                </Layout>
              </ProtectedRoute>
            } />
            
            <Route path={ROUTES.ENVELOPE_DETAILS} element={
              <ProtectedRoute>
                <Layout>
                  <EnvelopeDetails />
                </Layout>
              </ProtectedRoute>
            } />

            <Route path={ROUTES.ANALYTICS} element={
              <ProtectedRoute>
                <Layout>
                  <Analytics />
                </Layout>
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;