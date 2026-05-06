import React from 'react';
import SectionHeader from '../shared/SectionHeader';
import ColorPickerField from './ColorPickerField';
import { asset } from '../../../lib/asset';
import { space } from '../../../lib/tokens';

const rowStyle = { display: 'flex', flexDirection: 'row', gap: space[2] };

const CaptionSection = ({
  captionSettings,
  availableFonts,
  availableWeights,
  onFontChange,
  onWeightChange,
  onFontSizeChange,
  onColorChange,
  localCaption,
  onCaptionChange,
  onCaptionBlur,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
    <SectionHeader icon={asset('icons/caption.svg')} label="Caption" />

    <div style={rowStyle}>
      <select
        value={captionSettings.selectedFont}
        onChange={onFontChange}
        style={{ width: '50%' }}
      >
        {availableFonts.map((f) => (
          <option key={f.name} value={f.name}>{f.name}</option>
        ))}
      </select>
      <select
        value={captionSettings.selectedWeight}
        onChange={onWeightChange}
        style={{ width: '50%' }}
      >
        {availableWeights.map((w) => (
          <option key={w.value} value={w.value}>{w.label}</option>
        ))}
      </select>
    </div>

    <div style={rowStyle}>
      <input
        type="number"
        value={captionSettings.fontSize}
        onChange={onFontSizeChange}
        min="1"
        max="99"
        style={{ width: '50%' }}
      />
      <ColorPickerField color={captionSettings.captionColor} onChange={onColorChange} />
    </div>

    <textarea
      value={localCaption}
      onChange={onCaptionChange}
      onBlur={onCaptionBlur}
      placeholder="Caption for this scene…"
      style={{
        width: '100%',
        fontFamily: captionSettings.selectedFont,
        height: 64,
      }}
    />
  </div>
);

export default CaptionSection;
