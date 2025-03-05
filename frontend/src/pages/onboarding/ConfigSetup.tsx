// web/src/pages/onboarding/ConfigSetup.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { motion } from 'framer-motion';
import { FaCheck, FaSpinner, FaShieldAlt, FaRobot, FaClock, FaGithub } from 'react-icons/fa';

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
  const { getToken } = useAuth();
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

  const API_URL =  'http://localhost:3001/api';

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

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = getToken();
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }
      
      // Save configuration to backend
      await axios.post(
        `${API_URL}/onboarding/config`,
        { config },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      // Navigate to the final step
      navigate('/onboarding/complete');
    } catch (error) {
      console.error('Error saving configuration:', error);
      setError('Failed to save your configuration');
    } finally {
      setLoading(false);
    }
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
                Configure Dependency Management
              </h1>
              <div className="flex items-center">
                <span className="text-sm text-gray-500 mr-2">Step 3 of 4</span>
                <div className="w-24 h-2 bg-gray-200 rounded-full">
                  <div className="w-3/4 h-full bg-blue-500 rounded-full"></div>
                </div>
              </div>
            </div>
            <p className="mt-2 text-gray-600">
              Customize how you want to manage dependencies across your repositories.
            </p>
          </div>

          <div className="px-6 py-6 sm:px-10">
            <div className="space-y-6">
              {/* Update Schedule */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gray-50 p-4 rounded-lg border border-gray-200"
              >
                <div className="flex items-start">
                  <div className="mt-1 mr-4">
                    <FaClock className="text-blue-500 text-xl" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium text-gray-800">Scheduled Updates</h3>
                      <label className="switch">
                        <input
                          type="checkbox"
                          name="scheduledUpdates"
                          checked={config.scheduledUpdates}
                          onChange={handleChange}
                          className="sr-only"
                        />
                        <div className={`w-11 h-6 rounded-full transition ${config.scheduledUpdates ? 'bg-blue-500' : 'bg-gray-300'}`}>
                          <div className={`w-5 h-5 rounded-full bg-white transform transition shadow ${config.scheduledUpdates ? 'translate-x-5' : 'translate-x-1'}`}></div>
                        </div>
                      </label>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      Automatically check for dependency updates on a schedule.
                    </p>
                    
                    {config.scheduledUpdates && (
                      <div className="mt-3">
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
                  </div>
                </div>
              </motion.div>

              {/* Security Scanning */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gray-50 p-4 rounded-lg border border-gray-200"
              >
                <div className="flex items-start">
                  <div className="mt-1 mr-4">
                    <FaShieldAlt className="text-blue-500 text-xl" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium text-gray-800">Vulnerability Scanning</h3>
                      <label className="switch">
                        <input
                          type="checkbox"
                          name="vulnerabilityScanning"
                          checked={config.vulnerabilityScanning}
                          onChange={handleChange}
                          className="sr-only"
                        />
                        <div className={`w-11 h-6 rounded-full transition ${config.vulnerabilityScanning ? 'bg-blue-500' : 'bg-gray-300'}`}>
                          <div className={`w-5 h-5 rounded-full bg-white transform transition shadow ${config.vulnerabilityScanning ? 'translate-x-5' : 'translate-x-1'}`}></div>
                        </div>
                      </label>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      Scan dependencies for known security vulnerabilities and get prioritized updates.
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* AI Risk Analysis */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gray-50 p-4 rounded-lg border border-gray-200"
              >
                <div className="flex items-start">
                  <div className="mt-1 mr-4">
                    <FaRobot className="text-blue-500 text-xl" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium text-gray-800">AI Risk Analysis</h3>
                      <label className="switch">
                        <input
                          type="checkbox"
                          name="aiRiskAnalysis"
                          checked={config.aiRiskAnalysis}
                          onChange={handleChange}
                          className="sr-only"
                        />
                        <div className={`w-11 h-6 rounded-full transition ${config.aiRiskAnalysis ? 'bg-blue-500' : 'bg-gray-300'}`}>
                          <div className={`w-5 h-5 rounded-full bg-white transform transition shadow ${config.aiRiskAnalysis ? 'translate-x-5' : 'translate-x-1'}`}></div>
                        </div>
                      </label>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      Use AI to analyze the risk of dependency updates and provide recommendations.
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Pull Request Settings */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-gray-50 p-4 rounded-lg border border-gray-200"
              >
                <div className="flex items-start">
                  <div className="mt-1 mr-4">
                    <FaGithub className="text-blue-500 text-xl" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium text-gray-800">Automatic Pull Requests</h3>
                      <label className="switch">
                        <input
                          type="checkbox"
                          name="automaticPRs"
                          checked={config.automaticPRs}
                          onChange={handleChange}
                          className="sr-only"
                        />
                        <div className={`w-11 h-6 rounded-full transition ${config.automaticPRs ? 'bg-blue-500' : 'bg-gray-300'}`}>
                          <div className={`w-5 h-5 rounded-full bg-white transform transition shadow ${config.automaticPRs ? 'translate-x-5' : 'translate-x-1'}`}></div>
                        </div>
                      </label>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      Automatically create pull requests for dependency updates.
                    </p>
                    
                    {config.automaticPRs && (
                      <div className="mt-3">
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
                  </div>
                </div>
              </motion.div>

              {/* Notification Settings */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-gray-50 p-4 rounded-lg border border-gray-200"
              >
                <h3 className="text-lg font-medium text-gray-800">Notification Settings</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Enter email addresses to receive notifications (optional, comma separated)
                </p>
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
              </motion.div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md">
                {error}
              </div>
            )}

            <div className="mt-8 border-t border-gray-200 pt-6 flex justify-between items-center">
              <button
                onClick={() => navigate('/onboarding/repository-select')}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                disabled={loading}
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center"
              >
                {loading ? (
                  <>
                    <FaSpinner className="animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    Continue
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ConfigSetup;