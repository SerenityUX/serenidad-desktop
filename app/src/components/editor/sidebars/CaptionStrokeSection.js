import React from 'react';
import ColorPickerField from './ColorPickerField';

const CaptionStrokeSection = ({
  captionSettings,
  onStrokeSizeChange,
  onStrokeColorChange,
}) => (
  <>
    <p style={{ fontSize: 14, color: '#404040', marginTop: 0, marginLeft: 12, marginBottom: 0 }}>
      Caption Stroke
    </p>
    <div style={{ display: 'flex', flexDirection: 'row', gap: 8, marginLeft: 12, marginRight: 12 }}>
      <input
        type="number"
        value={captionSettings.strokeSize}
        onChange={onStrokeSizeChange}
        min="1"
        max="99"
        style={{
          width: '50%',
          borderRadius: '4px',
          border: '1px solid #D9D9D9',
          padding: '4px',
          fontSize: 14,
        }}
      />
      <ColorPickerField color={captionSettings.strokeColor} onChange={onStrokeColorChange} />
    </div>
  </>
);

export default CaptionStrokeSection;
