// web/src/contexts/AuthContext.tsx

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import apiClient from '../api';

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);



export const AuthContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Check if the user has the is_authenticated cookie
  const checkAuthCookie = (): boolean => {
    // This cookie is not HTTP-only so JavaScript can read it
    return document.cookie.includes('is_authenticated=true');
  };

  // Initialize auth state on component mount and when URL changes
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        setIsLoading(true);
        
        // Check if the user has the authentication cookie
        const hasAuthCookie = checkAuthCookie();
        
        if (!hasAuthCookie) {
          setIsAuthenticated(false);
          setUser(null);
          setIsLoading(false);
          return;
        }
        
        // Verify token by making a request to /auth/me
        // The HTTP-only cookie will be sent automatically
        const response = await apiClient.getCurrentUser();
        
        if (response.status === 200) {
          setUser(response.data);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
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
      const response = await apiClient.getAuthUrl(redirectUri);
      
      // Redirect to the GitHub OAuth page
      window.location.href = response.data.authUrl;
    } catch (error) {
      console.error('Failed to initiate GitHub login:', error);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      // The HTTP-only cookie will be sent automatically
      await apiClient.logout();
      
      setIsAuthenticated(false);
      setUser(null);
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <AuthContext.Provider 
      value={{ 
        isAuthenticated, 
        isLoading, 
        user, 
        login, 
        logout
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