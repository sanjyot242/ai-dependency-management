// contexts/AuthContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

interface User {
  id: string;
  username: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  isOnboarded: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (redirectPath?: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthContextProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Create an axios instance with credentials enabled
  const api = axios.create({
    baseURL: API_URL,
    withCredentials: true, // Important for cookies
  });

  const fetchUser = async (): Promise<User | null> => {
    try {
      const response = await api.get('/auth/me');

      if (response.status === 200) {
        setUser(response.data);
        return response.data;
      }

      return null;
    } catch (error) {
      console.error('Error fetching user:', error);
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (redirectPath = '/dashboard'): Promise<void> => {
    try {
      // Store the redirect path for after login
      localStorage.setItem('auth_redirect', redirectPath);

      // Get the GitHub OAuth URL from the backend
      const response = await api.get('/auth/github/login');

      if (response.status === 200 && response.data.authUrl) {
        // Redirect to the GitHub OAuth URL
        window.location.href = response.data.authUrl;
      } else {
        console.error('Invalid response from auth server:', response);
        throw new Error('Failed to initiate GitHub login');
      }
    } catch (error) {
      console.error('Error initiating GitHub login:', error);
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
      setUser(null);
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        fetchUser,
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};
