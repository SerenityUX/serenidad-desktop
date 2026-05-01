import React, { useRef } from 'react';

const ColorPickerField = ({ color, onChange }) => {
  const inputRef = useRef(null);
  return (
    <div
      onClick={() => inputRef.current && inputRef.current.click()}
      style={{
        width: '50%',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        borderRadius: '4px',
        border: '1px solid #D9D9D9',
        padding: '4px',
        fontSize: 14,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          backgroundColor: color,
          border: '1px solid #D9D9D9',
          borderRadius: '2px',
        }}
      />
      <input
        ref={inputRef}
        type="color"
        value={color}
        onChange={onChange}
        style={{
          position: 'absolute',
          width: 0,
          height: 0,
          padding: 0,
          border: 'none',
          visibility: 'hidden',
        }}
      />
      <span style={{ flexGrow: 1, textAlign: 'center' }}>{color}</span>
    </div>
  );
};

export default ColorPickerField;
