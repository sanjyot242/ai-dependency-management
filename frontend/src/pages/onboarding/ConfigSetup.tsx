// web/src/pages/onboarding/ConfigSetup.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { FaClock, FaShieldAlt, FaRobot, FaGithub } from 'react-icons/fa';
import apiClient from '../../api';
import OnboardingLayout from '../../components/onboarding/OnboardingLayout';
import FeatureCard from '../../components/onboarding/FeatureCard';
import NavigationFooter from '../../components/onboarding/NavigationFooter';

// This matches our MongoDB schema structure
interface ConfigOptions {
  scanFrequency: 'daily' | 'weekly' | 'monthly';
  notificationPreferences: {
    email: {
      enabled: boolean;
      vulnerabilities: boolean;
      outdatedDependencies: boolean;
    };
    slack: {
      enabled: boolean;
      webhookUrl: string;
      vulnerabilities: boolean;
      outdatedDependencies: boolean;
    };
  };
  autoScanOnPush: boolean;
}

const ConfigSetup: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [config, setConfig] = useState<ConfigOptions>({
    scanFrequency: 'weekly',
    notificationPreferences: {
      email: {
        enabled: true,
        vulnerabilities: true,
        outdatedDependencies: true,
      },
      slack: {
        enabled: false,
        webhookUrl: '',
        vulnerabilities: true,
        outdatedDependencies: true,
      },
    },
    autoScanOnPush: true,
  });

  // Helper function to update nested state
  const updateConfig = (path: string[], value: any) => {
    setConfig((prevConfig) => {
      const newConfig = { ...prevConfig };
      let current: any = newConfig;

      // Navigate to the nested property
      for (let i = 0; i < path.length - 1; i++) {
        current = current[path[i]];
      }

      // Set the value
      current[path[path.length - 1]] = value;
      return newConfig;
    });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

    if (name === 'scanFrequency') {
      updateConfig(['scanFrequency'], value);
    } else if (name === 'autoScanOnPush') {
      const checkbox = e.target as HTMLInputElement;
      updateConfig(['autoScanOnPush'], checkbox.checked);
    } else if (name === 'emailEnabled') {
      const checkbox = e.target as HTMLInputElement;
      updateConfig(
        ['notificationPreferences', 'email', 'enabled'],
        checkbox.checked
      );
    } else if (name === 'emailVulnerabilities') {
      const checkbox = e.target as HTMLInputElement;
      updateConfig(
        ['notificationPreferences', 'email', 'vulnerabilities'],
        checkbox.checked
      );
    } else if (name === 'emailOutdated') {
      const checkbox = e.target as HTMLInputElement;
      updateConfig(
        ['notificationPreferences', 'email', 'outdatedDependencies'],
        checkbox.checked
      );
    } else if (name === 'slackEnabled') {
      const checkbox = e.target as HTMLInputElement;
      updateConfig(
        ['notificationPreferences', 'slack', 'enabled'],
        checkbox.checked
      );
    } else if (name === 'slackWebhook') {
      updateConfig(['notificationPreferences', 'slack', 'webhookUrl'], value);
    } else if (name === 'slackVulnerabilities') {
      const checkbox = e.target as HTMLInputElement;
      updateConfig(
        ['notificationPreferences', 'slack', 'vulnerabilities'],
        checkbox.checked
      );
    } else if (name === 'slackOutdated') {
      const checkbox = e.target as HTMLInputElement;
      updateConfig(
        ['notificationPreferences', 'slack', 'outdatedDependencies'],
        checkbox.checked
      );
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!isAuthenticated) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      // Save configuration to backend
      await apiClient.saveConfiguration(config);

      // Navigate to the final step
      navigate('/onboarding/complete');
    } catch (error) {
      console.error('Error saving configuration:', error);
      setError('Failed to save your configuration');
    } finally {
      setLoading(false);
    }
  };

  const footer = (
    <NavigationFooter
      onBack={() => navigate('/onboarding/repository-select')}
      onNext={handleSubmit}
      loading={loading}
      nextText='Continue'
    />
  );

  return (
    <OnboardingLayout
      title='Configure Dependency Management'
      description='Customize how you want to manage dependencies across your repositories.'
      currentStep={3}
      footer={footer}>
      <div className='space-y-6'>
        {/* Update Schedule */}
        <FeatureCard
          icon={<FaClock className='text-blue-500 text-xl' />}
          title='Scheduled Updates'
          description='Automatically check for dependency updates on a schedule.'
          toggled={true}
          delay={0.1}>
          <div>
            <label
              htmlFor='scanFrequency'
              className='block text-sm font-medium text-gray-700'>
              Update Frequency
            </label>
            <select
              id='scanFrequency'
              name='scanFrequency'
              value={config.scanFrequency}
              onChange={handleChange}
              className='mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md'>
              <option value='daily'>Daily</option>
              <option value='weekly'>Weekly</option>
              <option value='monthly'>Monthly</option>
            </select>
          </div>
        </FeatureCard>

        {/* Auto Scan on Push */}
        <FeatureCard
          icon={<FaGithub className='text-blue-500 text-xl' />}
          title='Auto-scan on Push'
          description='Automatically scan repositories when new code is pushed.'
          toggled={config.autoScanOnPush}
          onToggle={() =>
            updateConfig(['autoScanOnPush'], !config.autoScanOnPush)
          }
          delay={0.2}
        />

        {/* Email Notifications */}
        <FeatureCard
          title='Email Notifications'
          description='Configure email notifications for dependency updates and security vulnerabilities.'
          toggled={config.notificationPreferences.email.enabled}
          onToggle={() =>
            updateConfig(
              ['notificationPreferences', 'email', 'enabled'],
              !config.notificationPreferences.email.enabled
            )
          }
          delay={0.3}>
          {config.notificationPreferences.email.enabled && (
            <div className='space-y-3 mt-3'>
              <div className='flex items-center'>
                <input
                  type='checkbox'
                  id='emailVulnerabilities'
                  name='emailVulnerabilities'
                  checked={config.notificationPreferences.email.vulnerabilities}
                  onChange={handleChange}
                  className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
                />
                <label
                  htmlFor='emailVulnerabilities'
                  className='ml-2 block text-sm text-gray-700'>
                  Security vulnerabilities
                </label>
              </div>
              <div className='flex items-center'>
                <input
                  type='checkbox'
                  id='emailOutdated'
                  name='emailOutdated'
                  checked={
                    config.notificationPreferences.email.outdatedDependencies
                  }
                  onChange={handleChange}
                  className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
                />
                <label
                  htmlFor='emailOutdated'
                  className='ml-2 block text-sm text-gray-700'>
                  Outdated dependencies
                </label>
              </div>
            </div>
          )}
        </FeatureCard>

        {/* Slack Notifications */}
        <FeatureCard
          title='Slack Notifications'
          description='Configure Slack notifications for dependency updates and security vulnerabilities.'
          toggled={config.notificationPreferences.slack.enabled}
          onToggle={() =>
            updateConfig(
              ['notificationPreferences', 'slack', 'enabled'],
              !config.notificationPreferences.slack.enabled
            )
          }
          delay={0.4}>
          {config.notificationPreferences.slack.enabled && (
            <div className='space-y-3 mt-3'>
              <div>
                <label
                  htmlFor='slackWebhook'
                  className='block text-sm font-medium text-gray-700'>
                  Slack Webhook URL
                </label>
                <input
                  type='text'
                  id='slackWebhook'
                  name='slackWebhook'
                  value={config.notificationPreferences.slack.webhookUrl}
                  onChange={handleChange}
                  className='mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm'
                  placeholder='https://hooks.slack.com/services/...'
                />
              </div>
              <div className='flex items-center'>
                <input
                  type='checkbox'
                  id='slackVulnerabilities'
                  name='slackVulnerabilities'
                  checked={config.notificationPreferences.slack.vulnerabilities}
                  onChange={handleChange}
                  className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
                />
                <label
                  htmlFor='slackVulnerabilities'
                  className='ml-2 block text-sm text-gray-700'>
                  Security vulnerabilities
                </label>
              </div>
              <div className='flex items-center'>
                <input
                  type='checkbox'
                  id='slackOutdated'
                  name='slackOutdated'
                  checked={
                    config.notificationPreferences.slack.outdatedDependencies
                  }
                  onChange={handleChange}
                  className='h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
                />
                <label
                  htmlFor='slackOutdated'
                  className='ml-2 block text-sm text-gray-700'>
                  Outdated dependencies
                </label>
              </div>
            </div>
          )}
        </FeatureCard>
      </div>

      {error && (
        <div className='mt-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md'>
          {error}
        </div>
      )}
    </OnboardingLayout>
  );
};

export default ConfigSetup;
