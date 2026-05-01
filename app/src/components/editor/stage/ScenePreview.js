import React from 'react';
import { Img } from 'react-image';
import ScenePlaceholder from './ScenePlaceholder';

const mediaStyle = (aspectRatio) => ({
  aspectRatio,
  maxWidth: '100%',
  height: '100%',
  borderRadius: '16px',
  overflow: 'hidden',
  objectFit: 'contain',
  display: 'flex',
});

const ScenePreview = ({
  thumbnail,
  videoKey,
  aspectRatio,
  isLoading,
  progress,
  fact,
  prompt,
  negativePrompt,
  onPromptChange,
  onNegativePromptChange,
  generateDisabled,
  onGenerate,
}) => {
  const mediaSrc =
    thumbnail != null && String(thumbnail).trim() !== ''
      ? String(thumbnail).trim()
      : '';

  if (mediaSrc) {
    if (mediaSrc.endsWith('.mp4')) {
      return <video key={videoKey} src={mediaSrc} controls style={mediaStyle(aspectRatio)} />;
    }
    return (
      <Img
        src={mediaSrc}
        alt=""
        loader={
          <div
            style={{
              ...mediaStyle(aspectRatio),
              backgroundColor: '#F2F2F2',
            }}
          />
        }
        unloader={
          <div
            style={{
              ...mediaStyle(aspectRatio),
              backgroundColor: '#F2F2F2',
            }}
          />
        }
        style={{ ...mediaStyle(aspectRatio), objectFit: 'cover', backgroundColor: '#F2F2F2' }}
      />
    );
  }

  /* No frame asset yet: original compose UI (positive / negative / Generate), plus loading UI when generating. */
  return (
    <ScenePlaceholder
      aspectRatio={aspectRatio}
      prompt={prompt}
      negativePrompt={negativePrompt}
      onPromptChange={onPromptChange}
      onNegativePromptChange={onNegativePromptChange}
      generateDisabled={generateDisabled}
      onGenerate={onGenerate}
      isLoading={isLoading}
      progress={progress}
      fact={fact}
    />
  );
};

export default ScenePreview;
