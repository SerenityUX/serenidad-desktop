import React from 'react';
import ScenePreview from './ScenePreview';
import VoiceLineBar from './VoiceLineBar';

const CenterStage = ({ aspectRatio, scenePreviewProps, voiceLineProps, compact = false }) => (
  <div
    id="content"
    style={{
      display: 'flex',
      width: '100%',
      // Narrow viewports can't spare the 42px gutters and still keep the
      // prompt card / voice bar inside the screen. Compact mode collapses
      // them and drops the aspect-ratio cap so the placeholder grows to
      // its natural height instead of clipping.
      padding: compact ? '12px' : '42px',
      backgroundColor: '#f6f8fa',
      borderRadius: '0px',
      textAlign: 'center',
      alignItems: compact ? 'flex-start' : 'center',
      boxSizing: 'border-box',
      minWidth: 0,
    }}
  >
    <div
      id="thumbnail-container"
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        aspectRatio: compact ? undefined : aspectRatio,
        width: '100%',
        maxHeight: '100%',
        flexDirection: 'column',
        height: 'fit-content',
        minWidth: 0,
      }}
    >
      <ScenePreview {...scenePreviewProps} aspectRatio={aspectRatio} compact={compact} />
      <VoiceLineBar {...voiceLineProps} compact={compact} />
    </div>
  </div>
);

export default CenterStage;
