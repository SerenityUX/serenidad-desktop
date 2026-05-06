import React from 'react';
import { useOnboarding, STEPS } from '../../../context/OnboardingContext';

const GenerateVisualsButton = ({ label, disabled, onClick, primary = false }) => {
  const onboarding = useOnboarding();
  const handleClick = (e) => {
    onboarding.advanceFrom(STEPS.EDITOR_GENERATE);
    onClick?.(e);
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      data-onboard="generate-button"
      className={`btn ${primary ? 'btn-primary' : ''}`}
      style={{ width: '100%', height: 32 }}
    >
      {label || 'Generate visuals'}
    </button>
  );
};

export default GenerateVisualsButton;
