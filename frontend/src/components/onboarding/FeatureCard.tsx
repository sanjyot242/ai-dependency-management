import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ToggleSwitch } from './ToggleSwitch';

export interface FeatureCardProps {
  icon?: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
  delay?: number;
  toggled?: boolean | null;
  onToggle?: (() => void) | null;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({ 
  icon, 
  title, 
  description, 
  children,
  delay = 0,
  toggled = null,
  onToggle = null
}) => {
  const handleToggleChange = () => {
    if (onToggle) {
      onToggle();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-gray-50 p-4 rounded-lg border border-gray-200"
    >
      <div className="flex items-start">
        {icon && (
          <div className="mt-1 mr-4">
            {icon}
          </div>
        )}
        <div className="flex-1">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-800">{title}</h3>
            {toggled !== null && onToggle && (
              <ToggleSwitch 
                checked={toggled} 
                onChange={handleToggleChange} 
                name={title.toLowerCase().replace(/\s+/g, '-')}
              />
            )}
          </div>
          <p className="mt-1 text-sm text-gray-600">
            {description}
          </p>
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </motion.div>
  );
};

export default FeatureCard;