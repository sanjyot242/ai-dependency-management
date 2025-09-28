import React, { ReactNode } from 'react';
import { LoadingButton } from './LoadingButton';

export interface NavigationFooterProps {
  onBack: () => void;
  onNext: () => void;
  backText?: string;
  nextText?: string;
  loading?: boolean;
  nextDisabled?: boolean;
  nextIcon?: ReactNode;
  showSkip?: boolean;
  onSkip?: (() => void) | null;
  skipText?: string;
}

export const NavigationFooter: React.FC<NavigationFooterProps> = ({ 
  onBack, 
  onNext, 
  backText = "Back", 
  nextText = "Continue", 
  loading = false,
  nextDisabled = false,
  nextIcon = null,
  showSkip = false,
  onSkip = null,
  skipText = "Skip"
}) => {
  return (
    <div className="flex justify-between items-center">
      <button
        onClick={onBack}
        className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        disabled={loading}
      >
        {backText}
      </button>
      <div className="flex items-center">
        {showSkip && onSkip && (
          <button
            onClick={onSkip}
            className="mr-3 px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors"
          >
            {skipText}
          </button>
        )}
        <LoadingButton
          onClick={onNext}
          loading={loading}
          disabled={nextDisabled}
          text={nextText}
          icon={nextIcon}
          className={`px-6 py-2 rounded-md shadow-sm text-white ${
            nextDisabled
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        />
      </div>
    </div>
  );
};

export default NavigationFooter;