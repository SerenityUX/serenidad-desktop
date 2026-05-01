import React from 'react';
import ScenePreview from './ScenePreview';
import VoiceLineBar from './VoiceLineBar';

const CenterStage = ({ aspectRatio, scenePreviewProps, voiceLineProps }) => (
  <div
    id="content"
    style={{
      display: 'flex',
      width: '100%',
      padding: '42px',
      backgroundColor: '#F2F2F2',
      borderRadius: '0px',
      textAlign: 'center',
      alignItems: 'center',
    }}
  >
    <div
      id="thumbnail-container"
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        aspectRatio,
        width: '100%',
        maxHeight: '100%',
        flexDirection: 'column',
        height: 'fit-content',
      }}
    >
      <ScenePreview {...scenePreviewProps} aspectRatio={aspectRatio} />
      <VoiceLineBar {...voiceLineProps} />
    </div>
  </div>
);

export default CenterStage;
