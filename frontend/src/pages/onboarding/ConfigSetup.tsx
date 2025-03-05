// web/src/pages/onboarding/ConfigSetup.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { FaClock, FaShieldAlt, FaRobot, FaGithub } from 'react-icons/fa';
import apiClient from '../../api';
import OnboardingLayout from '../../components/onboarding/OnboardingLayout';
import FeatureCard from '../../components/onboarding/FeatureCard';
import NavigationFooter from '../../components/onboarding/NavigationFooter';

interface ConfigOptions {
  scheduledUpdates: boolean;
  updateFrequency: string;
  vulnerabilityScanning: boolean;
  aiRiskAnalysis: boolean;
  automaticPRs: boolean;
  prLabels: string[];
  notificationEmails: string;
}

const ConfigSetup: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [config, setConfig] = useState<ConfigOptions>({
    scheduledUpdates: true,
    updateFrequency: 'weekly',
    vulnerabilityScanning: true,
    aiRiskAnalysis: true,
    automaticPRs: true,
    prLabels: ['dependencies', 'automated'],
    notificationEmails: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checkbox = e.target as HTMLInputElement;
      setConfig(prev => ({
        ...prev,
        [name]: checkbox.checked
      }));
    } else if (name === 'prLabels') {
      // Split by comma and trim whitespace
      const labels = value.split(',').map(label => label.trim()).filter(label => label);
      setConfig(prev => ({
        ...prev,
        prLabels: labels
      }));
    } else {
      setConfig(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleToggleFeature = (feature: keyof ConfigOptions) => {
    setConfig(prev => ({
      ...prev,
      [feature]: !prev[feature]
    }));
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
      nextText="Continue"
    />
  );

  return (
    <OnboardingLayout
      title="Configure Dependency Management"
      description="Customize how you want to manage dependencies across your repositories."
      currentStep={3}
      footer={footer}
    >
      <div className="space-y-6">
        {/* Update Schedule */}
        <FeatureCard
          icon={<FaClock className="text-blue-500 text-xl" />}
          title="Scheduled Updates"
          description="Automatically check for dependency updates on a schedule."
          toggled={config.scheduledUpdates}
          onToggle={() => handleToggleFeature('scheduledUpdates')}
          delay={0.1}
        >
          {config.scheduledUpdates && (
            <div>
              <label htmlFor="updateFrequency" className="block text-sm font-medium text-gray-700">
                Update Frequency
              </label>
              <select
                id="updateFrequency"
                name="updateFrequency"
                value={config.updateFrequency}
                onChange={handleChange}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          )}
        </FeatureCard>

        {/* Security Scanning */}
        <FeatureCard
          icon={<FaShieldAlt className="text-blue-500 text-xl" />}
          title="Vulnerability Scanning"
          description="Scan dependencies for known security vulnerabilities and get prioritized updates."
          toggled={config.vulnerabilityScanning}
          onToggle={() => handleToggleFeature('vulnerabilityScanning')}
          delay={0.2}
        />

        {/* AI Risk Analysis */}
        <FeatureCard
          icon={<FaRobot className="text-blue-500 text-xl" />}
          title="AI Risk Analysis"
          description="Use AI to analyze the risk of dependency updates and provide recommendations."
          toggled={config.aiRiskAnalysis}
          onToggle={() => handleToggleFeature('aiRiskAnalysis')}
          delay={0.3}
        />

        {/* Pull Request Settings */}
        <FeatureCard
          icon={<FaGithub className="text-blue-500 text-xl" />}
          title="Automatic Pull Requests"
          description="Automatically create pull requests for dependency updates."
          toggled={config.automaticPRs}
          onToggle={() => handleToggleFeature('automaticPRs')}
          delay={0.4}
        >
          {config.automaticPRs && (
            <div>
              <label htmlFor="prLabels" className="block text-sm font-medium text-gray-700">
                PR Labels (comma separated)
              </label>
              <input
                type="text"
                id="prLabels"
                name="prLabels"
                value={config.prLabels.join(', ')}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="dependencies, automated"
              />
            </div>
          )}
        </FeatureCard>

        {/* Notification Settings */}
        <FeatureCard
          title="Notification Settings"
          description="Enter email addresses to receive notifications (optional, comma separated)"
          delay={0.5}
        >
          <div className="mt-2">
            <input
              type="text"
              id="notificationEmails"
              name="notificationEmails"
              value={config.notificationEmails}
              onChange={handleChange}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="email@example.com, another@example.com"
            />
          </div>
        </FeatureCard>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md">
          {error}
        </div>
      )}

    </OnboardingLayout>
  );
}

export default ConfigSetup;