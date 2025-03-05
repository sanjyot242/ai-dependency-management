// web/src/contexts/AuthContext.tsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  githubUsername?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  login: (redirectUri?: string) => void;
  logout: () => void;
  getToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API base URL - should come from environment variables
const API_URL = 'http://localhost:3001/api';

export const AuthContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize auth state on component mount and when URL changes
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        // Check for token in URL params (from OAuth redirect)
        const queryParams = new URLSearchParams(window.location.search);
        const tokenFromUrl = queryParams.get('token');
        
        if (tokenFromUrl) {
          // Store the token
          localStorage.setItem('auth_token', tokenFromUrl);
          
          // Clean up the URL by removing the token parameter
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
          
          // Don't need to fetch user info again as we'll do it below
        }
        
        // Check for existing token in storage
        const token = localStorage.getItem('auth_token');
        
        if (!token) {
          setIsAuthenticated(false);
          setUser(null);
          setIsLoading(false);
          return;
        }
        
        // Verify token and get user data
        const response = await axios.get(`${API_URL}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (response.status === 200) {
          setUser(response.data);
          setIsAuthenticated(true);
        } else {
          // Token is invalid
          localStorage.removeItem('auth_token');
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('auth_token');
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuthStatus();
  }, [location]);

  // Login function - redirects to server-side GitHub OAuth
  const login = async (redirectUri: string = window.location.pathname) => {
    try {
      // Get the OAuth URL from our backend
      const response = await axios.get(`${API_URL}/auth/github/login`, {
        params: { redirectUri }
      });
      
      // Redirect to the GitHub OAuth page
      window.location.href = response.data.authUrl;
    } catch (error) {
      console.error('Failed to initiate GitHub login:', error);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await axios.post(`${API_URL}/auth/logout`);
      localStorage.removeItem('auth_token');
      setIsAuthenticated(false);
      setUser(null);
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Get auth token
  const getToken = (): string | null => {
    return localStorage.getItem('auth_token');
  };

  return (
    <AuthContext.Provider 
      value={{ 
        isAuthenticated, 
        isLoading, 
        user, 
        login, 
        logout,
        getToken
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for using the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};