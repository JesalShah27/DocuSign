import React from 'react';
import { Link } from 'react-router-dom';
import { 
  DocumentTextIcon, 
  EnvelopeIcon, 
  PlusIcon,
  ChartBarIcon 
} from '@heroicons/react/24/outline';

const Dashboard: React.FC = () => {
  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">Welcome to DocUsign - Your electronic signature platform</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Link
          to="/documents"
          className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
        >
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <DocumentTextIcon className="h-6 w-6 text-primary-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Documents
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    Manage Files
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </Link>

        <Link
          to="/envelopes"
          className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
        >
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <EnvelopeIcon className="h-6 w-6 text-primary-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Envelopes
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    Send for Signing
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </Link>

        <Link
          to="/analytics"
          className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
        >
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-6 w-6 text-primary-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Analytics
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    View Insights
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </Link>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <PlusIcon className="h-6 w-6 text-primary-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Templates
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    Coming Soon
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Getting Started */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Getting Started
          </h3>
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary-100 text-primary-600 text-sm font-medium">
                  1
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-700">
                  <Link to="/documents" className="font-medium text-primary-600 hover:text-primary-500">
                    Upload a document
                  </Link>{' '}
                  that you need to have signed
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary-100 text-primary-600 text-sm font-medium">
                  2
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-700">
                  <Link to="/envelopes" className="font-medium text-primary-600 hover:text-primary-500">
                    Create an envelope
                  </Link>{' '}
                  and add signers
                </p>
              </div>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary-100 text-primary-600 text-sm font-medium">
                  3
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-700">
                  Send the envelope and track signing progress
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
