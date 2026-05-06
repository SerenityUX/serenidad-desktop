import React from 'react';
import StyleSection from './StyleSection';
import PromptSection from './PromptSection';
import ReferencesSection from './ReferencesSection';
import CharactersSection from './CharactersSection';
import GenerateVisualsButton from './GenerateVisualsButton';
import Divider from '../shared/Divider';
import { color, space } from '../../../lib/tokens';

const SIDEBAR_PADDING_X = space[3];

/**
 * Left sidebar contents are kept minimal pre-generation: only the project's
 * style + model picker. Prompt + references + the regenerate button move in
 * once a frame has been generated, so the empty-state center stage is the
 * sole place to compose the first prompt.
 */
const LeftSidebar = ({
  falModels,
  selectedFalModel,
  onFalModelChange,
  prompt,
  onPromptChange,
  promptLabel,
  isTransitioning,
  references,
  onAddReferenceFiles,
  onAddReferenceUrl,
  onRemoveReference,
  referencesUploading,
  modelSupportsReferences,
  videoMode,
  generateLabel,
  generateDisabled,
  onGenerate,
  showMakeVideoFromCurrent,
  onMakeVideoFromCurrent,
  makeVideoFromCurrentDisabled,
  projectId,
  projectStyle,
  onProjectStyleChange,
  hasGenerated,
  projectCharacters = [],
  boundCharacterIds = [],
  onBindCharacter,
  onUnbindCharacter,
  onMentionCharacter,
}) => (
  <div
    id="left-bar"
    style={{
      width: 274,
      justifyContent: 'space-between',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: color.bgSubtle,
      borderRight: `1px solid ${color.border}`,
      paddingTop: space[4],
      paddingBottom: space[3],
      gap: space[3],
    }}
  >
    <div
      style={{
        display: 'flex',
        gap: space[4],
        overflowY: 'auto',
        flexDirection: 'column',
        paddingLeft: SIDEBAR_PADDING_X,
        paddingRight: SIDEBAR_PADDING_X,
      }}
    >
      <StyleSection
        falModels={falModels}
        selectedFalModel={selectedFalModel}
        onFalModelChange={onFalModelChange}
        projectId={projectId}
        projectStyle={projectStyle}
        onProjectStyleChange={onProjectStyleChange}
      />

      {hasGenerated ? (
        <>
          <Divider />
          <PromptSection
            prompt={prompt}
            onPromptChange={onPromptChange}
            isTransitioning={isTransitioning}
            promptLabel={promptLabel}
            characters={projectCharacters}
            onMentionCharacter={onMentionCharacter}
          />

          <Divider />

          <ReferencesSection
            references={references}
            onAddFiles={onAddReferenceFiles}
            onAddUrl={onAddReferenceUrl}
            onRemove={onRemoveReference}
            uploading={referencesUploading}
            modelSupportsReferences={modelSupportsReferences}
            acceptVideos={videoMode}
          />
        </>
      ) : null}
    </div>

    {hasGenerated ? (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: space[2],
          paddingLeft: SIDEBAR_PADDING_X,
          paddingRight: SIDEBAR_PADDING_X,
          paddingTop: space[3],
          borderTop: `1px solid ${color.border}`,
        }}
      >
        <GenerateVisualsButton
          label={generateLabel}
          disabled={generateDisabled}
          onClick={onGenerate}
          primary
        />
        {showMakeVideoFromCurrent && (
          <GenerateVisualsButton
            label="Convert to Video"
            disabled={makeVideoFromCurrentDisabled}
            onClick={onMakeVideoFromCurrent}
          />
        )}
      </div>
    ) : null}
  </div>
);

export default LeftSidebar;
