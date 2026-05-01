import React from 'react';

const GenerateVisualsButton = ({ label, disabled, onClick }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      backgroundColor: '#fff',
      color: '#404040',
      border: '1px solid #D9D9D9',
      borderRadius: '6px',
      padding: '8px 12px',
      marginLeft: 12,
      marginRight: 12,
      fontSize: 13.3,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
    }}
  >
    {label || 'Generate Visuals'}
  </button>
);

export default GenerateVisualsButton;
