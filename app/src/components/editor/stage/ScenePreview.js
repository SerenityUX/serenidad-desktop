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
  if (thumbnail != null) {
    if (thumbnail.endsWith('.mp4')) {
      return <video key={videoKey} src={thumbnail} controls style={mediaStyle(aspectRatio)} />;
    }
    return <Img src={thumbnail} alt="Thumbnail" style={mediaStyle(aspectRatio)} />;
  }

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
