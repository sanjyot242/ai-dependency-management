// web/src/pages/onboarding/Welcome.tsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import { FaGithub, FaShieldAlt, FaRobot, FaChartLine } from 'react-icons/fa';

const Welcome: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const steps = [
    {
      title: "Connect Repositories",
      description: "Select the GitHub repositories you want to monitor for dependency updates.",
      icon: <FaGithub className="text-3xl text-gray-700" />,
    },
    {
      title: "Scan Dependencies",
      description: "We'll scan your repositories for dependencies and identify outdated packages.",
      icon: <FaShieldAlt className="text-3xl text-gray-700" />,
    },
    {
      title: "AI Risk Analysis",
      description: "Our AI will analyze the risk of each dependency update to help you make informed decisions.",
      icon: <FaRobot className="text-3xl text-gray-700" />,
    },
    {
      title: "Automate Updates",
      description: "Set up automated workflows to keep your dependencies up to date and secure.",
      icon: <FaChartLine className="text-3xl text-gray-700" />,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl mx-auto"
      >
        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          <div className="px-6 py-8 sm:px-10 sm:py-12 bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Welcome to AI Dependency Manager
            </h1>
            <p className="mt-3 text-lg">
              Hello{user?.name ? `, ${user.name}` : ''}! We're excited to help you keep your dependencies up to date and secure.
            </p>
          </div>

          <div className="px-6 py-8 sm:px-10">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">
              Let's get you set up in just a few steps
            </h2>

            <div className="grid gap-8 sm:grid-cols-2 mb-10">
              {steps.map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 * (index + 1) }}
                  className="bg-gray-50 p-6 rounded-lg border border-gray-200 shadow-sm"
                >
                  <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                    {step.icon}
                  </div>
                  <h3 className="text-lg font-medium text-gray-800 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-gray-600">
                    {step.description}
                  </p>
                </motion.div>
              ))}
            </div>

            <div className="border-t border-gray-200 pt-6 flex justify-between items-center">
              <p className="text-gray-600">
                This will only take a few minutes to complete.
              </p>
              <button
                onClick={() => navigate('/onboarding/repository-select')}
                className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Get Started →
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Welcome;