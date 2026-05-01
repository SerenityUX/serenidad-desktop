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

const StyleSection = ({
  baseModel,
  baseModels,
  onBaseModelChange,
  onBaseModelOpen,
  selectedLora,
  loraModules,
  onLoraChange,
  onLoraOpen,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <SectionHeader icon="icons/Picture.svg" label="Style" />

    <div
      data-tooltip-id="base-model-tooltip"
      data-tooltip-content="A base model is a pre-trained AI model that serves as the foundation for generating images. It contains general knowledge about visual concepts and styles."
      style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}
    >
      <FieldLabel>BASE MODEL</FieldLabel>
      <select value={baseModel} onChange={onBaseModelChange} onClick={onBaseModelOpen} style={selectStyle}>
        {baseModels.length === 0 && <option>Select Base Model</option>}
        {baseModels.map((model) => (
          <option key={model} value={model}>{model}</option>
        ))}
        <option value="manage">Manage Base Models</option>
      </select>
    </div>
    {baseModels.length === 0 && (
      <Tooltip id="base-model-tooltip" place="top" type="dark" effect="solid" style={{ maxWidth: '300px' }} />
    )}

    <div
      data-tooltip-id="lora-model-tooltip"
      data-tooltip-content="A LoRA (Low-Rank Adaptation) module is a fine-tuning technique that allows for efficient adaptation of large language models. It can be used to specialize a base model for specific styles or subjects."
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
  </div>
);

export default StyleSection;
