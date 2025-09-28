// web/src/pages/auth/Login.tsx

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';
import { FaGithub, FaExclamationCircle } from 'react-icons/fa';
import { motion } from 'framer-motion';

const Login: React.FC = () => {
  const { login, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Check for error in URL params (from OAuth redirect)
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const errorParam = queryParams.get('error');

    if (errorParam) {
      switch (errorParam) {
        case 'oauth_error':
          setError('OAuth authorization failed. Please try again.');
          break;
        case 'invalid_state':
          setError(
            'Invalid OAuth state. This could be due to an expired session or a security issue.'
          );
          break;
        case 'token_error':
          setError('Failed to obtain authorization token from GitHub.');
          break;
        case 'authentication_failed':
          setError('Authentication failed. Please try again later.');
          break;
        default:
          setError('An error occurred during login. Please try again.');
      }

      // Clean up the URL
      window.history.replaceState({}, document.title, '/login');
    }
  }, [location]);

  // If already authenticated, redirect to dashboard
  if (isAuthenticated && !isLoading) {
    return <Navigate to='/dashboard' replace />;
  }

  const handleLogin = async () => {
    try {
      setIsProcessing(true);
      setError(null);

      // Use dashboard as the redirect path
      await login('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      setError('Failed to initiate GitHub login. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <div className='min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900'>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className='w-full max-w-md'>
        <div className='text-center mb-10'>
          <h1 className='text-4xl font-bold text-white mb-2'>
            AI Dependency Manager
          </h1>
          <p className='text-gray-300'>
            Intelligent dependency management with AI risk analysis
          </p>
        </div>

        <div className='bg-white rounded-lg shadow-xl overflow-hidden'>
          <div className='p-8'>
            <h2 className='text-2xl font-bold text-gray-800 mb-6 text-center'>
              Welcome Back
            </h2>
            <p className='text-gray-600 mb-8 text-center'>
              Sign in to manage your repositories and dependencies
            </p>

            {error && (
              <div className='mb-6 p-4 bg-red-50 text-red-700 rounded-md flex items-start'>
                <FaExclamationCircle className='text-red-500 mt-1 mr-2 flex-shrink-0' />
                <p>{error}</p>
              </div>
            )}

            <div className='space-y-4'>
              <button
                onClick={handleLogin}
                className='w-full flex items-center justify-center gap-3 py-3 px-4 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors duration-300 shadow-md'
                disabled={isLoading || isProcessing}>
                <FaGithub className='text-xl' />
                {isProcessing ? (
                  <span>Connecting to GitHub...</span>
                ) : (
                  <span>Continue with GitHub</span>
                )}
              </button>

              <div className='text-center text-sm text-gray-500'>
                By logging in, you agree to our
                <a href='/terms' className='text-blue-500 hover:underline mx-1'>
                  Terms of Service
                </a>
                and
                <a
                  href='/privacy'
                  className='text-blue-500 hover:underline mx-1'>
                  Privacy Policy
                </a>
              </div>
            </div>
          </div>

          <div className='bg-gray-50 p-6 border-t border-gray-200'>
            <div className='text-center text-sm text-gray-600'>
              <p className='mb-4'>Our AI-powered system helps you:</p>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                <div className='bg-white p-3 rounded shadow-sm border border-gray-100'>
                  ✅ Stay on top of security vulnerabilities
                </div>
                <div className='bg-white p-3 rounded shadow-sm border border-gray-100'>
                  ✅ Assess update risks with AI
                </div>
                <div className='bg-white p-3 rounded shadow-sm border border-gray-100'>
                  ✅ Automate dependency updates
                </div>
                <div className='bg-white p-3 rounded shadow-sm border border-gray-100'>
                  ✅ Get intelligent recommendations
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className='mt-8 text-center text-gray-400 text-sm'>
        <p>
          © {new Date().getFullYear()} AI Dependency Manager. All rights
          reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;
