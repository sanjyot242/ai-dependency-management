import React, { ReactNode } from 'react';
import { FaSpinner } from 'react-icons/fa';

export interface LoadingButtonProps {
  onClick: () => void;
  loading?: boolean;
  loadingText?: string;
  text: string;
  disabled?: boolean;
  className?: string;
  icon?: ReactNode;
  type?: 'button' | 'submit' | 'reset';
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({ 
  onClick, 
  loading = false, 
  loadingText = "Loading...",
  text, 
  disabled = false,
  className = "px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
  icon = null,
  type = 'button'
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading || disabled}
      className={`flex items-center ${className} ${(loading || disabled) ? 'opacity-70 cursor-not-allowed' : ''}`}
    >
      {loading ? (
        <>
          <FaSpinner className="animate-spin mr-2" />
          {loadingText}
        </>
      ) : (
        <>
          {icon && <span className="mr-2">{icon}</span>}
          {text}
        </>
      )}
    </button>
  );
};

export default LoadingButton;