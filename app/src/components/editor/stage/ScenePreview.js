import React from 'react';
import { Img } from 'react-image';
import ScenePlaceholder from './ScenePlaceholder';

if (typeof document !== 'undefined' && !document.getElementById('kodan-spin-keyframes')) {
  const style = document.createElement('style');
  style.id = 'kodan-spin-keyframes';
  style.textContent = '@keyframes kodanSpin { to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
}

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
  videoStatusMessage,
  videoError,
  onClearVideoError,
  promptFocusToken,
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
            key={videoKey || mediaSrc}
            src={mediaSrc}
            controls
            playsInline
            preload="metadata"
            onError={(e) => {
              const code = e?.currentTarget?.error?.code;
              const msg = e?.currentTarget?.error?.message;
              console.error('Video element failed to load', { code, msg, src: mediaSrc });
            }}
            style={{ ...fillStyle, backgroundColor: '#F2F2F2' }}
          />
          <CaptionOverlay caption={caption} captionSettings={captionSettings} />
          <VideoStatusOverlay status={videoStatusMessage} error={videoError} onDismiss={onClearVideoError} />
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
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
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
        promptFocusToken={promptFocusToken}
        generateLabel={isVideoFrame ? 'Create Video' : undefined}
      />
      <VideoStatusOverlay status={videoStatusMessage} error={videoError} onDismiss={onClearVideoError} />
    </div>
  );
};

const VideoStatusOverlay = ({ status, error, onDismiss }) => {
  if (!status && !error) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 12,
        padding: '10px 14px',
        borderRadius: 10,
        backgroundColor: error ? 'rgba(255, 69, 58, 0.95)' : 'rgba(0, 0, 0, 0.78)',
        color: '#fff',
        fontSize: 13,
        lineHeight: 1.35,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        zIndex: 20,
        boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
        {!error && (
          <Spinner />
        )}
        <span>{error ? `Video generation failed: ${error}` : status}</span>
      </div>
      {error && onDismiss && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.6)',
            color: '#fff',
            borderRadius: 6,
            padding: '2px 8px',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Dismiss
        </button>
      )}
    </div>
  );
};

const Spinner = () => (
  <div
    style={{
      width: 14,
      height: 14,
      border: '2px solid rgba(255,255,255,0.4)',
      borderTopColor: '#fff',
      borderRadius: '50%',
      animation: 'kodanSpin 0.9s linear infinite',
    }}
  />
);

export default ScenePreview;
