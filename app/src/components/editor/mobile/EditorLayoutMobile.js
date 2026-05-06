import React, { useState } from 'react';
import MobileTitleBar from './MobileTitleBar';
import MobileSettingsSheet from './MobileSettingsSheet';
import CenterStage from '../stage/CenterStage';
import ScenesStrip from '../bottomBar/ScenesStrip';
import GenerateVisualsButton from '../sidebars/GenerateVisualsButton';
import { color, space } from '../../../lib/tokens';

/**
 * Mobile counterpart to EditorLayout. Same prop shape so ProjectComponent
 * can flip between the two without restructuring its render tree:
 *
 *   isMobile
 *     ? <EditorLayoutMobile {...sameProps} />
 *     : <EditorLayout       {...sameProps} />
 *
 * Differences:
 *   - No fixed left/right sidebars; their sections live in a bottom sheet.
 *   - Center stage and scenes strip stack vertically and fill the screen.
 *   - Generate-related buttons surface as a sticky bar above the strip
 *     so the primary action is always reachable with the thumb.
 */
const EditorLayoutMobile = ({
  onExport,
  onShare,
  showShare = false,
  voice,
  projectName,
  view,
  onViewChange,
  leftSidebarProps = {},
  centerStageProps,
  rightSidebarProps = {},
  scenesStripProps,
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Pull out the props the bottom sheet uses; they came pre-shaped for
  // the desktop sidebars.
  const styleProps = leftSidebarProps.falModels
    ? {
        falModels: leftSidebarProps.falModels,
        selectedFalModel: leftSidebarProps.selectedFalModel,
        onFalModelChange: leftSidebarProps.onFalModelChange,
      }
    : null;

  const referencesProps = leftSidebarProps.references !== undefined
    ? {
        references: leftSidebarProps.references,
        onAddFiles: leftSidebarProps.onAddReferenceFiles,
        onAddUrl: leftSidebarProps.onAddReferenceUrl,
        onRemove: leftSidebarProps.onRemoveReference,
        uploading: leftSidebarProps.referencesUploading,
        modelSupportsReferences: leftSidebarProps.modelSupportsReferences,
        acceptVideos: leftSidebarProps.videoMode,
      }
    : null;

  const durationProps = leftSidebarProps.sceneDuration !== undefined
    ? {
        videoMode: leftSidebarProps.videoMode,
        sceneDuration: leftSidebarProps.sceneDuration,
        onSceneDurationChange: leftSidebarProps.onSceneDurationChange,
      }
    : null;

  const hasScene = !!centerStageProps?.scenePreviewProps?.thumbnail;
  const isVideoFrame = !!leftSidebarProps.videoMode;

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
        backgroundColor: color.bg,
      }}
    >
      <MobileTitleBar
        projectName={projectName}
        view={view}
        onViewChange={onViewChange}
        voice={voice}
        onOpenSettings={() => setSettingsOpen(true)}
        onShare={onShare}
        showShare={showShare}
        onExport={onExport}
      />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            WebkitOverflowScrolling: 'touch',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: color.bgSubtle,
          }}
        >
          <CenterStage {...centerStageProps} compact />
        </div>

        {/* Sticky generate bar — only shown once a scene is generated, so
            users can re-run the prompt without opening the bottom sheet.
            Pre-generation, the center placeholder card already has its
            own inline generate button. */}
        {hasScene && leftSidebarProps.onGenerate ? (
          <div
            style={{
              padding: `${space[2]}px ${space[3]}px`,
              borderTop: `1px solid ${color.border}`,
              backgroundColor: color.bg,
            }}
          >
            <GenerateVisualsButton
              label={leftSidebarProps.generateLabel}
              disabled={leftSidebarProps.generateDisabled}
              onClick={leftSidebarProps.onGenerate}
              primary
            />
          </div>
        ) : null}

        <div
          style={{
            borderTop: `1px solid ${color.border}`,
            backgroundColor: color.surfaceDark,
            paddingBottom: 'var(--safe-bottom, 0px)',
            paddingLeft: 'var(--safe-left, 0px)',
            paddingRight: 'var(--safe-right, 0px)',
          }}
        >
          <ScenesStrip {...scenesStripProps} />
        </div>
      </div>

      <MobileSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        styleProps={styleProps}
        referencesProps={referencesProps}
        durationProps={durationProps}
        captionProps={rightSidebarProps.captionProps}
        strokeProps={rightSidebarProps.strokeProps}
        exportProps={rightSidebarProps.exportProps}
        isVideoFrame={isVideoFrame}
        hasScene={hasScene}
      />
    </div>
  );
};

export default EditorLayoutMobile;
