import React from 'react';
import { Tooltip } from 'react-tooltip';
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
  baseModel,
  baseModels,
  onBaseModelChange,
  onBaseModelOpen,
  selectedLora,
  loraModules,
  onLoraChange,
  onLoraOpen,
  falModels,
  selectedFalModel,
  onFalModelChange,
}) => {
  const showFal = Array.isArray(falModels) && falModels.length > 0;
  const showLocal = Array.isArray(baseModels) && baseModels.length > 0;
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

      {showLocal && (
        <div
          data-tooltip-id="base-model-tooltip"
          data-tooltip-content="A base model is a pre-trained AI model that serves as the foundation for generating images."
          style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}
        >
          <FieldLabel>BASE MODEL</FieldLabel>
          <select value={baseModel} onChange={onBaseModelChange} onClick={onBaseModelOpen} style={selectStyle}>
            {baseModels.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
            <option value="manage">Manage Base Models</option>
          </select>
        </div>
      )}

      {showLocal && (
        <div
          data-tooltip-id="lora-model-tooltip"
          data-tooltip-content="A LoRA module fine-tunes a base model for specific styles or subjects."
          style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}
        >
          <FieldLabel>LORA MODULE</FieldLabel>
          <select value={selectedLora} onChange={onLoraChange} onClick={onLoraOpen} style={selectStyle}>
            {loraModules.length === 0 && <option>Select LoRa</option>}
            {loraModules.map((module) => (
              <option key={module} value={module}>{module}</option>
            ))}
            <option value="manage">Manage LoRa Modules</option>
          </select>
          {loraModules.length === 0 && (
            <Tooltip id="lora-model-tooltip" place="top" type="dark" effect="solid" style={{ maxWidth: '300px' }} />
          )}
        </div>
      )}
    </div>
  );
};

export default StyleSection;
