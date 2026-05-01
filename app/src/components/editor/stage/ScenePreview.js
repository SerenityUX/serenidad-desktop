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

const selectionWrapStyle = (selected) => ({
  display: 'inline-flex',
  borderRadius: 18,
  padding: 2,
  outline: selected ? '3px solid #007AFF' : '3px solid transparent',
  outlineOffset: 0,
  boxShadow: selected ? '0 0 0 1px #fff inset' : 'none',
  transition: 'outline-color 80ms linear',
  cursor: 'pointer',
});

const ScenePreview = ({
  thumbnail,
  videoKey,
  aspectRatio,
  isLoading,
  progress,
  fact,
  prompt,
  onPromptChange,
  generateDisabled,
  onGenerate,
  references,
  onAddReferenceFiles,
  onAddReferenceUrl,
  onRemoveReference,
  referencesUploading,
  selected,
  onSelectImage,
}) => {
  const mediaSrc =
    thumbnail != null && String(thumbnail).trim() !== ''
      ? String(thumbnail).trim()
      : '';

  if (mediaSrc) {
    const handleClick = (e) => {
      e.stopPropagation();
      onSelectImage?.(true);
    };
    if (mediaSrc.endsWith('.mp4')) {
      return (
        <div style={selectionWrapStyle(selected)} onClick={handleClick}>
          <video key={videoKey} src={mediaSrc} controls style={mediaStyle(aspectRatio)} />
        </div>
      );
    }
    return (
      <div style={selectionWrapStyle(selected)} onClick={handleClick}>
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
      </div>
    );
  }

  return (
    <ScenePlaceholder
      aspectRatio={aspectRatio}
      prompt={prompt}
      onPromptChange={onPromptChange}
      generateDisabled={generateDisabled}
      onGenerate={onGenerate}
      isLoading={isLoading}
      progress={progress}
      fact={fact}
      references={references}
      onAddReferenceFiles={onAddReferenceFiles}
      onAddReferenceUrl={onAddReferenceUrl}
      onRemoveReference={onRemoveReference}
      referencesUploading={referencesUploading}
    />
  );
};

export default ScenePreview;
