import React, { useRef } from 'react';
import { color, font, radius } from '../../../lib/tokens';

const ColorPickerField = ({ color: value, onChange }) => {
  const inputRef = useRef(null);
  return (
    <div
      onClick={() => inputRef.current && inputRef.current.click()}
      style={{
        width: '50%',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        borderRadius: radius.md,
        border: `1px solid ${color.border}`,
        backgroundColor: color.bg,
        padding: '5px 8px',
        fontSize: font.size.md,
        color: color.text,
        cursor: 'pointer',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          backgroundColor: value,
          border: `1px solid ${color.border}`,
          borderRadius: radius.sm,
          flex: '0 0 auto',
        }}
      />
      <input
        ref={inputRef}
        type="color"
        value={value}
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
      <span style={{
        flexGrow: 1,
        textAlign: 'center',
        color: color.textMuted,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </span>
    </div>
  );
};

export default ColorPickerField;
