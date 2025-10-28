import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import { initPdfWorker } from './utils/pdfjs-config';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import Envelopes from './pages/Envelopes';
import EnvelopeDetails from './pages/EnvelopeDetails';
import Signing from './pages/Signing';
import Layout from './components/Layout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }
  
  return user ? <>{children}</> : <Navigate to="/login" />;
}

function App() {
  useEffect(() => {
    // Initialize PDF.js worker
    initPdfWorker();
  }, []);

  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/sign/:link" element={<Signing />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/documents" element={
              <ProtectedRoute>
                <Layout>
                  <Documents />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/envelopes" element={
              <ProtectedRoute>
                <Layout>
                  <Envelopes />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/envelopes/:id" element={
              <ProtectedRoute>
                <Layout>
                  <EnvelopeDetails />
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