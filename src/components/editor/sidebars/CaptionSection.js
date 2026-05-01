import React from 'react';
import SectionHeader from '../shared/SectionHeader';
import ColorPickerField from './ColorPickerField';

const rowStyle = { display: 'flex', flexDirection: 'row', gap: 8, marginLeft: 12, marginRight: 12 };

const selectStyle = {
  width: '50%',
  borderRadius: '4px',
  appearance: 'none',
  border: '1px solid #D9D9D9',
  padding: '4px',
  fontSize: 14,
};

const numberInputStyle = {
  width: '50%',
  borderRadius: '4px',
  border: '1px solid #D9D9D9',
  padding: '4px',
  fontSize: 14,
};

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
  <>
    <SectionHeader icon="icons/caption.svg" label="Caption" />

    <div style={rowStyle}>
      <select
        value={captionSettings.selectedFont}
        onChange={onFontChange}
        onClick={() => window.electron.ipcRenderer.invoke('get-system-fonts')}
        style={selectStyle}
      >
        {availableFonts.map((font) => (
          <option key={font.name} value={font.name}>{font.name}</option>
        ))}
      </select>
      <select value={captionSettings.selectedWeight} onChange={onWeightChange} style={selectStyle}>
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
        style={numberInputStyle}
      />
      <ColorPickerField color={captionSettings.captionColor} onChange={onColorChange} />
    </div>

    <textarea
      value={localCaption}
      onChange={onCaptionChange}
      onBlur={onCaptionBlur}
      placeholder="Caption for this scene..."
      style={{
        width: 'calc(100% - 32px)',
        marginLeft: 12,
        marginRight: 12,
        fontFamily: captionSettings.selectedFont,
        resize: 'none',
        padding: '4px 4px',
        border: '1px solid #D9D9D9',
        borderRadius: '4px',
        backgroundColor: '#fff',
        fontSize: '14px',
        color: '#404040',
        height: '60px',
        overflowY: 'auto',
      }}
    />
  </>
);

export default CaptionSection;
