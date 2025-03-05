

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const API_URL =  'http://localhost:3001/api';

interface CallbackProps {}

const Callback: React.FC<CallbackProps> = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the authorization code from the URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        if (!code) {
          setError('No authorization code received from GitHub');
          setIsProcessing(false);
          return;
        }
        
        // Exchange the code for an access token via our API
        const response = await axios.post(`${API_URL}/auth/github`, { code });
        
        if (response.status === 200 && response.data.token) {
          // Store the token
          localStorage.setItem('auth_token', response.data.token);
          
          // Get the redirect path (if any) or default to dashboard
          const redirectPath = localStorage.getItem('auth_redirect') || '/dashboard';
          localStorage.removeItem('auth_redirect');
          
          // Check if this is a new user
          const isNewUser = response.data.isNewUser;
          
          // Redirect to onboarding for new users or to the requested page for existing users
          navigate(isNewUser ? '/onboarding/welcome' : redirectPath);
        } else {
          setError('Failed to authenticate with GitHub');
        }
      } catch (error) {
        console.error('GitHub authentication error:', error);
        setError('An error occurred during authentication');
      } finally {
        setIsProcessing(false);
      }
    };
    
    // If the user is already authenticated, redirect to the dashboard
    if (isAuthenticated) {
      navigate('/dashboard');
      return;
    }
    
    handleCallback();
  }, [navigate, isAuthenticated]);

  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-2">Authenticating...</h2>
            <p className="text-gray-600 mb-4">
              We're connecting to GitHub and setting up your account.
            </p>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-2 text-red-600">Authentication Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Return to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default Callback;