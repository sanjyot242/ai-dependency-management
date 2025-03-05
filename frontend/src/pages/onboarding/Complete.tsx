// web/src/pages/onboarding/Complete.tsx

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { motion } from 'framer-motion';
import { FaCheckCircle, FaSpinner, FaExclamationTriangle, FaArrowRight } from 'react-icons/fa';

interface InitializationStatus {
  repositoriesInitialized: boolean;
  configInitialized: boolean;
  scanStarted: boolean;
}

const Complete: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState<InitializationStatus>({
    repositoriesInitialized: false,
    configInitialized: false,
    scanStarted: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const API_URL =   'http://localhost:3001/api';

  useEffect(() => {
    const checkInitializationStatus = async () => {
      try {
        // const token = getToken();
        if (!isAuthenticated) {
          setError('Not authenticated');
          setLoading(false);
          return;
        }
        
        const response = await axios.get(`${API_URL}/onboarding/status`, {
          withCredentials: true
        });
        
        if (response.status === 200) {
          setStatus(response.data);
          
          // If everything is initialized, stop loading
          if (
            response.data.repositoriesInitialized &&
            response.data.configInitialized &&
            response.data.scanStarted
          ) {
            setLoading(false);
          } else {
            // Poll again in 2 seconds
            setTimeout(checkInitializationStatus, 2000);
          }
        }
      } catch (error) {
        console.error('Error checking initialization status:', error);
        setError('Failed to check initialization status');
        setLoading(false);
      }
    };
    
    checkInitializationStatus();
  }, [API_URL, isAuthenticated]);

  const handleContinue = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-3xl mx-auto"
      >
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-8 sm:px-10 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-800">
                Setup Complete!
              </h1>
              <div className="flex items-center">
                <span className="text-sm text-gray-500 mr-2">Step 4 of 4</span>
                <div className="w-24 h-2 bg-gray-200 rounded-full">
                  <div className="w-full h-full bg-blue-500 rounded-full"></div>
                </div>
              </div>
            </div>
            <p className="mt-2 text-gray-600">
              Your dependency management system is being initialized.
            </p>
          </div>

          <div className="px-6 py-8 sm:px-10">
            <div className="max-w-md mx-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-6">
                  <FaSpinner className="text-5xl text-blue-500 animate-spin mb-4" />
                  <h2 className="text-xl font-semibold text-gray-800 mb-2">
                    Setting up your repositories
                  </h2>
                  <p className="text-gray-600 text-center">
                    We're initializing your configuration and starting the first dependency scan.
                    This may take a few moments.
                  </p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-6">
                  <FaExclamationTriangle className="text-5xl text-yellow-500 mb-4" />
                  <h2 className="text-xl font-semibold text-gray-800 mb-2">
                    We encountered an issue
                  </h2>
                  <p className="text-gray-600 text-center mb-4">
                    {error}
                  </p>
                  <button
                    onClick={handleContinue}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    Continue Anyway
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6">
                  <FaCheckCircle className="text-5xl text-green-500 mb-4" />
                  <h2 className="text-xl font-semibold text-gray-800 mb-2">
                    Your setup is complete!
                  </h2>
                  <p className="text-gray-600 text-center mb-8">
                    Your repositories have been initialized and your first dependency scan has started.
                    You can now access your dashboard to view your dependencies.
                  </p>
                  
                  <div className="w-full bg-gray-50 rounded-lg p-6 border border-gray-200 mb-8">
                    <h3 className="text-lg font-medium text-gray-800 mb-3">Setup Status</h3>
                    <ul className="space-y-3">
                      <li className="flex items-center">
                        <div className="mr-3 text-green-500">
                          <FaCheckCircle />
                        </div>
                        <span className="text-gray-700">Repositories initialized</span>
                      </li>
                      <li className="flex items-center">
                        <div className="mr-3 text-green-500">
                          <FaCheckCircle />
                        </div>
                        <span className="text-gray-700">Configuration saved</span>
                      </li>
                      <li className="flex items-center">
                        <div className="mr-3 text-green-500">
                          <FaCheckCircle />
                        </div>
                        <span className="text-gray-700">Initial dependency scan started</span>
                      </li>
                    </ul>
                  </div>
                  
                  <button
                    onClick={handleContinue}
                    className="px-8 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-md flex items-center font-medium"
                  >
                    Go to Dashboard
                    <FaArrowRight className="ml-2" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Complete;