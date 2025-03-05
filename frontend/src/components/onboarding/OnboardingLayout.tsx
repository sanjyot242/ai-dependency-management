import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';

export interface OnboardingLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
  currentStep?: number;
  totalSteps?: number;
  footer?: ReactNode;
}

/**
 * Shared layout component for all onboarding pages
 */
export const OnboardingLayout: React.FC<OnboardingLayoutProps> = ({ 
  children, 
  title, 
  description, 
  currentStep, 
  totalSteps = 4,
  footer
}) => {
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
                {title}
              </h1>
              {currentStep && (
                <div className="flex items-center">
                  <span className="text-sm text-gray-500 mr-2">Step {currentStep} of {totalSteps}</span>
                  <div className="w-24 h-2 bg-gray-200 rounded-full">
                    <div 
                      className="h-full bg-blue-500 rounded-full" 
                      style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
            {description && (
              <p className="mt-2 text-gray-600">{description}</p>
            )}
          </div>

          <div className="px-6 py-6 sm:px-10">
            {children}
          </div>

          {footer && (
            <div className="px-6 py-4 border-t border-gray-200">
              {footer}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};


export default OnboardingLayout;