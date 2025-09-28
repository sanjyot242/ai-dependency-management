import React, { ReactNode } from 'react';
import { FaCheckCircle, FaSpinner, FaExclamationTriangle } from 'react-icons/fa';

export type StatusType = 'loading' | 'success' | 'error';

export interface StatusPanelProps {
  type: StatusType;
  title: string;
  message: string;
  children?: ReactNode;
}

export  const StatusPanel: React.FC<StatusPanelProps> = ({ 
  type, 
  title, 
  message, 
  children 
}) => {
  const icons = {
    loading: <FaSpinner className="text-5xl text-blue-500 animate-spin mb-4" />,
    success: <FaCheckCircle className="text-5xl text-green-500 mb-4" />,
    error: <FaExclamationTriangle className="text-5xl text-yellow-500 mb-4" />
  };

  return (
    <div className="flex flex-col items-center justify-center py-6">
      {icons[type]}
      <h2 className="text-xl font-semibold text-gray-800 mb-2">
        {title}
      </h2>
      <p className="text-gray-600 text-center mb-4">
        {message}
      </p>
      {children}
    </div>
  );
};

export default StatusPanel;