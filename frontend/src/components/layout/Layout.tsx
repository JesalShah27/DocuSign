/**
 * Layout component for the DocUsign application
 * 
 * Provides the main application layout with navigation, header, and content area.
 */

import React from 'react';
import { useAuth } from '../../shared/contexts';
import { Link } from 'react-router-dom';
import { 
  DocumentTextIcon, 
  UserIcon, 
  ArrowRightOnRectangleIcon 
} from '@heroicons/react/24/outline';
import { ROUTES } from '../../shared/constants';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to={ROUTES.HOME} className="flex items-center">
                <DocumentTextIcon className="h-8 w-8 text-primary-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">DocUsign</span>
              </Link>
            </div>
            
            <div className="flex items-center space-x-4">
              <Link
                to={ROUTES.DOCUMENTS}
                className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Documents
              </Link>
              <Link
                to={ROUTES.ENVELOPES}
                className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Envelopes
              </Link>
              <Link
                to={ROUTES.ANALYTICS}
                className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Analytics
              </Link>
              
              <div className="flex items-center space-x-2">
                <UserIcon className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-700">{user?.email}</span>
              </div>
              
              <button
                onClick={logout}
                className="text-gray-700 hover:text-primary-600 p-2 rounded-md transition-colors"
                title="Sign out"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;