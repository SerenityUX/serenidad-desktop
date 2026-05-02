import React from 'react';
import { Img } from 'react-image';
import ScenePlaceholder from './ScenePlaceholder';

const fillStyle = {
  width: '100%',
  height: '100%',
  borderRadius: 16,
  overflow: 'hidden',
  display: 'block',
  objectFit: 'cover',
};

const selectionWrapStyle = (selected) => ({
  display: 'flex',
  width: '100%',
  height: '100%',
  borderRadius: 18,
  padding: 2,
  boxSizing: 'border-box',
  outline: selected ? '3px solid #007AFF' : '3px solid transparent',
  outlineOffset: 0,
  boxShadow: selected ? '0 0 0 1px #fff inset' : 'none',
  transition: 'outline-color 80ms linear',
  cursor: 'pointer',
  position: 'relative',
});

/**
 * Caption overlay. The same captionSettings drives the editor preview and the
 * mp4 export (see lib/composeScene.js), so what you see is what you get.
 */
const CaptionOverlay = ({ caption, captionSettings }) => {
  const text = (caption || '').trim();
  if (!text) return null;
  const cs = captionSettings || {};
  const strokeSize = Number(cs.strokeSize || 0);
  const strokeColor = cs.strokeColor || '#000';
  // Mimic the canvas stroke by stacking text-shadow offsets.
  const shadow = strokeSize > 0
    ? [
        `${strokeSize}px ${strokeSize}px 0 ${strokeColor}`,
        `-${strokeSize}px ${strokeSize}px 0 ${strokeColor}`,
        `${strokeSize}px -${strokeSize}px 0 ${strokeColor}`,
        `-${strokeSize}px -${strokeSize}px 0 ${strokeColor}`,
        `0 ${strokeSize}px 0 ${strokeColor}`,
        `0 -${strokeSize}px 0 ${strokeColor}`,
        `${strokeSize}px 0 0 ${strokeColor}`,
        `-${strokeSize}px 0 0 ${strokeColor}`,
      ].join(', ')
    : 'none';
  return (
    <div
      style={{
        position: 'absolute',
        left: '5%',
        right: '5%',
        bottom: '6%',
        textAlign: 'center',
        pointerEvents: 'none',
        fontFamily: `"${cs.selectedFont || 'Arial'}", Arial, sans-serif`,
        fontWeight: cs.selectedWeight || '700',
        fontSize: `${cs.fontSize || 16}px`,
        color: cs.captionColor || '#FFE600',
        textShadow: shadow,
        whiteSpace: 'pre-wrap',
        lineHeight: 1.2,
      }}
    >
      {text}
    </div>
  );
};

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
  caption,
  captionSettings,
  isVideoFrame,
}) => {
  const mediaSrc =
    thumbnail != null && String(thumbnail).trim() !== ''
      ? String(thumbnail).trim()
      : '';

  // Detect video by frame kind first (fal URLs may have query strings or odd
  // extensions); fall back to URL sniffing for legacy local mp4s.
  const looksLikeVideo =
    isVideoFrame ||
    /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(mediaSrc);

  if (mediaSrc) {
    const handleClick = (e) => {
      e.stopPropagation();
      onSelectImage?.(true);
    };
    if (looksLikeVideo) {
      return (
        <div style={selectionWrapStyle(selected)} onClick={handleClick}>
          <video
            key={videoKey}
            src={mediaSrc}
            controls
            style={{ ...fillStyle, backgroundColor: '#F2F2F2' }}
          />
          <CaptionOverlay caption={caption} captionSettings={captionSettings} />
        </div>
      );
    }
    return (
      <div style={selectionWrapStyle(selected)} onClick={handleClick}>
        <Img
          src={mediaSrc}
          alt=""
          loader={<div style={{ ...fillStyle, backgroundColor: '#F2F2F2' }} />}
          unloader={<div style={{ ...fillStyle, backgroundColor: '#F2F2F2' }} />}
          style={{ ...fillStyle, backgroundColor: '#F2F2F2' }}
        />
        <CaptionOverlay caption={caption} captionSettings={captionSettings} />
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
      generateLabel={isVideoFrame ? 'Create Video' : undefined}
    />
  );
};

export default ScenePreview;
