import React, { useMemo, useState } from 'react';

const PAGE_SIZE = 6;
const VOICELINE_RESERVED_HEIGHT = 60;

const isVideoUrl = (url) =>
  /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(String(url || ''));

/**
 * One storyboard cell: a bordered frame with the prompt text inside (or the
 * generated image/video, or a progress bar while loading), references along
 * the bottom edge of the frame, and the voiceline beneath it. The voiceline
 * area always reserves vertical space so a row of cards stays aligned even
 * when some scenes have voicelines and others don't.
 */
const StoryboardCard = ({ scene, aspectRatio, isLoading, progress }) => {
  const thumbnail = String(scene.thumbnail || '').trim();
  const hasOutput = thumbnail !== '' && !isLoading;
  const looksLikeVideo = scene.kind === 'video' || isVideoUrl(thumbnail);
  const refs = Array.isArray(scene.references) ? scene.references : [];
  const voiceline = (scene.voiceline || '').trim();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio,
          border: '1px solid #000',
          borderRadius: 4,
          overflow: 'hidden',
          backgroundColor: '#fff',
          boxSizing: 'border-box',
        }}
      >
        {isLoading ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <progress max="100" value={progress || 0} style={{ width: '60%' }} />
          </div>
        ) : hasOutput ? (
          looksLikeVideo ? (
            <video
              src={thumbnail}
              muted
              playsInline
              preload="metadata"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <img
              src={thumbnail}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )
        ) : (
          <p
            style={{
              margin: 0,
              padding: 16,
              fontSize: 14,
              lineHeight: 1.35,
              color: '#404040',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {scene.positivePrompt || ''}
          </p>
        )}

        {refs.length > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: 6,
              left: 6,
              display: 'flex',
              gap: 4,
              maxWidth: 'calc(100% - 12px)',
              flexWrap: 'wrap',
            }}
          >
            {refs.map((url) => (
              <RefThumb key={url} url={url} />
            ))}
          </div>
        )}
      </div>

      {/*
        Voiceline beneath the frame. minHeight reserves the space so cards in
        a row align even when some scenes have a voiceline and others don't.
      */}
      <p
        style={{
          margin: '8px 0 0 0',
          fontSize: 13,
          lineHeight: 1.35,
          color: '#404040',
          minHeight: VOICELINE_RESERVED_HEIGHT,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {voiceline}
      </p>
    </div>
  );
};

const RefThumb = ({ url }) => {
  const isVid = isVideoUrl(url);
  const common = {
    width: 28,
    height: 28,
    objectFit: 'cover',
    borderRadius: 3,
    border: '1px solid #D9D9D9',
    backgroundColor: '#F2F2F2',
    display: 'block',
  };
  return isVid ? (
    <video src={url} muted playsInline preload="metadata" style={common} />
  ) : (
    <img src={url} alt="" style={common} />
  );
};

const StoryboardView = ({
  scenes = [],
  aspectRatio = 16 / 9,
  loadingFrameIds = new Set(),
  progressMap = {},
  creatingVideoFrameIds = new Set(),
  onClose,
}) => {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(scenes.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visible = useMemo(
    () => scenes.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
    [scenes, safePage],
  );

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#fff',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: 24,
          overflowY: 'auto',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            columnGap: 24,
            rowGap: 24,
          }}
        >
          {visible.map((scene, idxInPage) => {
            const sceneNumber = safePage * PAGE_SIZE + idxInPage + 1;
            const sceneFrameId = scene?.frameId;
            const isLoading = sceneFrameId
              ? (loadingFrameIds.has(sceneFrameId) ||
                 creatingVideoFrameIds.has(sceneFrameId))
              : false;
            return (
              <StoryboardCard
                key={scene.id || sceneNumber}
                scene={scene}
                aspectRatio={aspectRatio}
                isLoading={isLoading}
                progress={progressMap[sceneNumber]}
              />
            );
          })}
        </div>
      </div>

      <div
        style={{
          height: 48,
          flex: '0 0 auto',
          borderTop: '1px solid #E5E5E5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          fontSize: 13,
          color: '#404040',
          backgroundColor: '#fff',
        }}
      >
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={safePage === 0}
          style={navBtnStyle(safePage === 0)}
        >
          Prev
        </button>
        <span
          style={{
            border: '1px solid #D9D9D9',
            borderRadius: 4,
            padding: '4px 10px',
            minWidth: 56,
            textAlign: 'center',
          }}
        >
          {safePage + 1}/{totalPages}
        </span>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={safePage >= totalPages - 1}
          style={navBtnStyle(safePage >= totalPages - 1)}
        >
          Next
        </button>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          style={{
            height: 44,
            flex: '0 0 auto',
            border: 0,
            backgroundColor: '#404040',
            color: '#fff',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            letterSpacing: 0.2,
          }}
        >
          Return to timeline
        </button>
      )}
    </div>
  );
};

const navBtnStyle = (disabled) => ({
  background: 'transparent',
  border: 0,
  color: disabled ? '#BFBFBF' : '#404040',
  textDecoration: 'underline',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: 13,
  padding: 4,
});

export default StoryboardView;
