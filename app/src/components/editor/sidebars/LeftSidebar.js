import React from 'react';
import StyleSection from './StyleSection';
import PromptSection from './PromptSection';
import ReferencesSection from './ReferencesSection';
import DurationSection from './DurationSection';
import GenerateVisualsButton from './GenerateVisualsButton';
import Divider from '../shared/Divider';

const LeftSidebar = ({
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
  prompt,
  onPromptChange,
  isTransitioning,
  references,
  onAddReferenceFiles,
  onAddReferenceUrl,
  onRemoveReference,
  referencesUploading,
  modelSupportsReferences,
  sceneDuration,
  generateLabel,
  generateDisabled,
  onGenerate,
}) => (
  <div
    id="left-bar"
    style={{
      width: '274px',
      justifyContent: 'space-between',
      display: 'flex',
      gap: '12px',
      paddingTop: '0px',
      paddingBottom: '9px',
      flexDirection: 'column',
    }}
  >
    <div style={{ display: 'flex', gap: 12, overflowY: 'scroll', flexDirection: 'column', paddingTop: '12px' }}>
      <StyleSection
        baseModel={baseModel}
        baseModels={baseModels}
        onBaseModelChange={onBaseModelChange}
        onBaseModelOpen={onBaseModelOpen}
        selectedLora={selectedLora}
        loraModules={loraModules}
        onLoraChange={onLoraChange}
        onLoraOpen={onLoraOpen}
        falModels={falModels}
        selectedFalModel={selectedFalModel}
        onFalModelChange={onFalModelChange}
      />

      <Divider />

      <PromptSection
        prompt={prompt}
        onPromptChange={onPromptChange}
        isTransitioning={isTransitioning}
      />

      <Divider />

      <ReferencesSection
        references={references}
        onAddFiles={onAddReferenceFiles}
        onAddUrl={onAddReferenceUrl}
        onRemove={onRemoveReference}
        uploading={referencesUploading}
        modelSupportsReferences={modelSupportsReferences}
      />

      <DurationSection sceneDuration={sceneDuration} />
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
      <Divider />
      <GenerateVisualsButton label={generateLabel} disabled={generateDisabled} onClick={onGenerate} />
    </div>
  </div>
);

export default LeftSidebar;
