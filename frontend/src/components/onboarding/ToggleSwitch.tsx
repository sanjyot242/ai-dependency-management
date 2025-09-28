import React from 'react';

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  name: string;
  disabled?: boolean;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ 
  checked, 
  onChange, 
  name,
  disabled = false 
}) => {
  return (
    <label className={`switch ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="sr-only"
      />
      <div className={`w-11 h-6 rounded-full transition ${checked ? 'bg-blue-500' : 'bg-gray-300'}`}>
        <div className={`w-5 h-5 rounded-full bg-white transform transition shadow ${checked ? 'translate-x-5' : 'translate-x-1'}`}></div>
      </div>
    </label>
  );
};

export default ToggleSwitch;