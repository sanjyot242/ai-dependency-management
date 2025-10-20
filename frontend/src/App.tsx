// web/src/App.tsx

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthContextProvider, useAuth } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';

// Pages
import Login from './pages/auth/Login';
import Welcome from './pages/onboarding/Welcome';
import RepositorySelect from './pages/onboarding/RepositorySelect';
import ConfigSetup from './pages/onboarding/ConfigSetup';
import Complete from './pages/onboarding/Complete';
import Dashboard from './pages/dashboard/Dashboard';
import DependencyDetails from './components/DependencyDetails';
import NotFound from './pages/NotFound';

// Protected route component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <div className='animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500'></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to='/login' replace />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path='/login' element={<Login />} />

      {/* Protected Routes */}
      <Route
        path='/'
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* Onboarding Routes */}
      <Route
        path='/onboarding/welcome'
        element={
          <ProtectedRoute>
            <Welcome />
          </ProtectedRoute>
        }
      />
      <Route
        path='/onboarding/repository-select'
        element={
          <ProtectedRoute>
            <RepositorySelect />
          </ProtectedRoute>
        }
      />
      <Route
        path='/onboarding/config-setup'
        element={
          <ProtectedRoute>
            <ConfigSetup />
          </ProtectedRoute>
        }
      />
      <Route
        path='/onboarding/complete'
        element={
          <ProtectedRoute>
            <Complete />
          </ProtectedRoute>
        }
      />

      {/* Dashboard Routes */}
      <Route
        path='/dashboard'
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* Dependency Details Route */}
      <Route
        path='/repository/:repositoryId/dependencies'
        element={
          <ProtectedRoute>
            <DependencyDetails />
          </ProtectedRoute>
        }
      />

      {/* 404 Route */}
      <Route path='*' element={<NotFound />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthContextProvider>
      <WebSocketProvider>
        <AppRoutes />
      </WebSocketProvider>
    </AuthContextProvider>
  );
};

export default App;
