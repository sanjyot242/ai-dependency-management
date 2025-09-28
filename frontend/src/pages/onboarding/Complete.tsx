// web/src/pages/onboarding/Complete.tsx

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { FaCheckCircle, FaArrowRight } from 'react-icons/fa';
import apiClient from '../../api';
import OnboardingLayout from '../../components/onboarding/OnboardingLayout';
import StatusPanel from '../../components/onboarding/StatusPanel';
import LoadingButton from '../../components/onboarding/LoadingButton';

interface InitializationStatus {
  isOnboarded: boolean;
  hasSelectedRepositories: boolean;
  hasConfig: boolean;
  scanStarted: boolean;
}

const Complete: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState<InitializationStatus>({
    isOnboarded: false,
    hasSelectedRepositories: false,
    hasConfig: false,
    scanStarted: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkInitializationStatus = async () => {
      try {
        if (!isAuthenticated) {
          setError('Not authenticated');
          setLoading(false);
          return;
        }

        const response = await apiClient.getOnboardingStatus();

        if (response.status === 200) {
          setStatus(response.data);

          // If everything is initialized, stop loading
          if (
            response.data.hasSelectedRepositories &&
            response.data.hasConfig
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
  }, [isAuthenticated]);

  const handleContinue = () => {
    navigate('/dashboard');
  };

  const renderContent = () => {
    if (loading) {
      return (
        <StatusPanel
          type='loading'
          title='Setting up your repositories'
          message="We're initializing your configuration and starting the first dependency scan. This may take a few moments."
        />
      );
    }

    if (error) {
      return (
        <StatusPanel
          type='error'
          title='We encountered an issue'
          message={error}>
          <LoadingButton
            onClick={handleContinue}
            text='Continue Anyway'
            className='px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm'
          />
        </StatusPanel>
      );
    }

    return (
      <StatusPanel
        type='success'
        title='Your setup is complete!'
        message='Your repositories have been initialized and your first dependency scan has started. You can now access your dashboard to view your dependencies.'>
        <div className='w-full bg-gray-50 rounded-lg p-6 border border-gray-200 mb-8'>
          <h3 className='text-lg font-medium text-gray-800 mb-3'>
            Setup Status
          </h3>
          <ul className='space-y-3'>
            <li className='flex items-center'>
              <div className='mr-3 text-green-500'>
                <FaCheckCircle />
              </div>
              <span className='text-gray-700'>
                {status.hasSelectedRepositories
                  ? 'Repositories initialized'
                  : 'Waiting for repository initialization...'}
              </span>
            </li>
            <li className='flex items-center'>
              <div className='mr-3 text-green-500'>
                <FaCheckCircle />
              </div>
              <span className='text-gray-700'>
                {status.hasConfig
                  ? 'Configuration saved'
                  : 'Waiting for configuration...'}
              </span>
            </li>
            <li className='flex items-center'>
              <div className='mr-3 text-green-500'>
                <FaCheckCircle />
              </div>
              <span className='text-gray-700'>
                {status.scanStarted
                  ? 'Initial dependency scan started'
                  : 'Dependency scan pending...'}
              </span>
            </li>
          </ul>
        </div>

        <LoadingButton
          onClick={handleContinue}
          text='Go to Dashboard'
          icon={<FaArrowRight className='ml-2' />}
          className='px-8 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-md flex items-center font-medium'
        />
      </StatusPanel>
    );
  };

  return (
    <OnboardingLayout
      title='Setup Complete!'
      description='Your dependency management system is being initialized.'
      currentStep={4}>
      <div className='max-w-md mx-auto'>{renderContent()}</div>
    </OnboardingLayout>
  );
};

export default Complete;
