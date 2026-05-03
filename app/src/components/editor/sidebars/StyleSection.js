import React from 'react';
import SectionHeader from '../shared/SectionHeader';
import FieldLabel from '../shared/FieldLabel';

const selectStyle = {
  width: 'calc(100% - 24px)',
  marginLeft: 12,
  appearance: 'none',
  marginRight: 12,
  padding: '4px 4px',
  border: '1px solid #D9D9D9',
  borderRadius: '4px',
  backgroundColor: '#fff',
  fontSize: '14px',
  color: '#404040',
};

const helperStyle = {
  marginLeft: 12,
  marginRight: 12,
  marginTop: 4,
  fontSize: 11,
  color: '#808080',
};

const StyleSection = ({
  falModels,
  selectedFalModel,
  onFalModelChange,
}) => {
  const showFal = Array.isArray(falModels) && falModels.length > 0;
  const activeFalModel =
    showFal && falModels.find((m) => m.id === selectedFalModel);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SectionHeader icon="icons/Picture.svg" label="Style" />

      {showFal && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
          <FieldLabel>MODEL</FieldLabel>
          <select
            value={selectedFalModel || ''}
            onChange={onFalModelChange}
            style={selectStyle}
          >
            {falModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          {(() => {
            if (!activeFalModel) return null;
            const isVideoModel = Object.prototype.hasOwnProperty.call(
              activeFalModel,
              'supportsEndFrame',
            );
            let msg = null;
            if (isVideoModel) {
              if (activeFalModel.supportsEndFrame) {
                msg = 'Start + end frame — prompt guides the motion between them';
              } else if (!activeFalModel.acceptsMultipleReferences) {
                msg = 'Start frame only — extra refs will be ignored';
              }
            } else {
              msg = activeFalModel.supportsReferences
                ? 'Supports references'
                : 'Ignores references';
            }
            return msg ? <div style={helperStyle}>{msg}</div> : null;
          })()}
        </div>
      )}
    </div>
  );
};

export default StyleSection;
