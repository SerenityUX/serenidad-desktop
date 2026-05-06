import React from 'react';
import ColorPickerField from './ColorPickerField';
import { color, font, space } from '../../../lib/tokens';

const CaptionStrokeSection = ({
  captionSettings,
  onStrokeSizeChange,
  onStrokeColorChange,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
    <p style={{
      fontSize: font.size.md,
      fontWeight: font.weight.semibold,
      color: color.text,
      margin: 0,
    }}>
      Caption stroke
    </p>
    <div style={{ display: 'flex', flexDirection: 'row', gap: space[2] }}>
      <input
        type="number"
        value={captionSettings.strokeSize}
        onChange={onStrokeSizeChange}
        min="1"
        max="99"
        style={{ width: '50%' }}
      />
      <ColorPickerField color={captionSettings.strokeColor} onChange={onStrokeColorChange} />
    </div>
  </div>
);

export default CaptionStrokeSection;
