import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import SceneThumbnail from './SceneThumbnail';
import AddSceneButton from './AddSceneButton';

const dropIndicatorStyle = {
  width: 3,
  alignSelf: 'stretch',
  marginTop: 12,
  marginBottom: 12,
  borderRadius: 2,
  backgroundColor: '#1F93FF',
  flex: '0 0 auto',
  pointerEvents: 'none',
};

/**
 * Storyboard toggle. Mirrors PlayPauseButton's flush-corner styling so the
 * two cap the strip on opposite sides — same #404040 fill, same #fff border
 * pair on bottom + the strip-facing edge.
 */
const StoryboardButton = ({ active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={active ? 'Close storyboard' : 'Open storyboard'}
    aria-pressed={!!active}
    style={{
      position: 'absolute',
      top: 0,
      right: 0,
      width: 28,
      height: 28,
      borderRadius: 0,
      borderTop: 0,
      borderRight: 0,
      borderLeft: '1px solid #fff',
      borderBottom: '1px solid #fff',
      backgroundColor: active ? '#1F1F1F' : '#404040',
      color: '#fff',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
      zIndex: 10,
    }}
  >
    {/* 2×2 grid of small squares — a storyboard sheet at a glance. */}
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="5" height="4" stroke="#fff" strokeWidth="1.2" />
      <rect x="8" y="1" width="5" height="4" stroke="#fff" strokeWidth="1.2" />
      <rect x="1" y="8" width="5" height="4" stroke="#fff" strokeWidth="1.2" />
      <rect x="8" y="8" width="5" height="4" stroke="#fff" strokeWidth="1.2" />
    </svg>
  </button>
);

const PlayPauseButton = ({ isPlaying, onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={isPlaying ? 'Pause' : 'Play'}
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: 28,
      height: 28,
      borderRadius: 0,
      borderTop: 0,
      borderLeft: 0,
      borderRight: '1px solid #fff',
      borderBottom: '1px solid #fff',
      backgroundColor: '#404040',
      color: '#fff',
      cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
      zIndex: 10,
      opacity: disabled ? 0.4 : 1,
    }}
  >
    {isPlaying ? (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="#fff">
        <rect x="2" y="1.5" width="3" height="9" rx="0.5" />
        <rect x="7" y="1.5" width="3" height="9" rx="0.5" />
      </svg>
    ) : (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="#fff">
        <path d="M3 1.8 L3 10.2 L10 6 Z" />
      </svg>
    )}
  </button>
);

const ScenesStrip = ({
  projectData,
  selectedScene,
  isPlaying,
  onTogglePlay,
  canPlay,
  pressedScene,
  isMouseDown,
  deletingScenes,
  loadingFrameIds,
  creatingVideoFrameIds,
  thumbnail,
  aspectRatio,
  canExportClip,
  sceneRefs,
  onSceneMouseDown,
  onSceneMouseUp,
  onSceneMouseLeave,
  onDeleteScene,
  onOpenFolder,
  onReorderFrames,
  pressedAddScene,
  onAddSceneMouseDown,
  onAddSceneMouseUp,
  onAddSceneMouseLeave,
  multiSelectedScenes,
  onMakeVideoFrame,
  showStoryboard,
  onToggleStoryboard,
}) => {
  const [dragIndex, setDragIndex] = useState(null);
  const [dropTarget, setDropTarget] = useState(null); // index of slot (0..n)
  const wrapperRef = useRef(null);
  const stripRef = useRef(null);
  const [buttonLeft, setButtonLeft] = useState(null);

  const scenes = projectData?.scenes || [];

  // Treat the primary `selectedScene` as part of the multi-set so it gets the
  // same blue ring + full opacity as shift-clicked frames.
  const allSelected = Array.from(
    new Set([selectedScene, ...(multiSelectedScenes || [])]),
  ).sort((a, b) => a - b);
  const showMakeVideo =
    Array.isArray(multiSelectedScenes) && multiSelectedScenes.length >= 1;

  const computeDropSlot = (e, index, el) => {
    if (!el) return index;
    const rect = el.getBoundingClientRect();
    return e.clientX < rect.left + rect.width / 2 ? index : index + 1;
  };

  const handleDragStart = (e, index) => {
    setDragIndex(index);
    try {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/x-frame-index', String(index));
    } catch {
      /* ignore */
    }
  };

  const handleDragOverTile = (e, index, el) => {
    if (dragIndex == null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const slot = computeDropSlot(e, index, el);
    if (slot !== dropTarget) setDropTarget(slot);
  };

  const handleDropEnd = () => {
    if (
      dragIndex == null ||
      dropTarget == null ||
      dropTarget === dragIndex ||
      dropTarget === dragIndex + 1
    ) {
      setDragIndex(null);
      setDropTarget(null);
      return;
    }
    const ids = scenes.map((s) => s.frameId);
    const [moved] = ids.splice(dragIndex, 1);
    const insertAt = dropTarget > dragIndex ? dropTarget - 1 : dropTarget;
    ids.splice(insertAt, 0, moved);
    onReorderFrames?.(ids);
    setDragIndex(null);
    setDropTarget(null);
  };

  // Position the "Make Video Frame" button at the horizontal center of the
  // bounding box of all currently-selected thumbnails, in wrapper-local
  // coords. Recomputes on selection change and on horizontal scroll.
  useLayoutEffect(() => {
    if (!showMakeVideo) {
      setButtonLeft(null);
      return undefined;
    }
    const recompute = () => {
      const wrap = wrapperRef.current;
      if (!wrap) return;
      const wrapRect = wrap.getBoundingClientRect();
      let minLeft = Infinity;
      let maxRight = -Infinity;
      for (const n of allSelected) {
        const el = sceneRefs?.current?.[n];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.left < minLeft) minLeft = r.left;
        if (r.right > maxRight) maxRight = r.right;
      }
      if (!isFinite(minLeft) || !isFinite(maxRight)) return;
      setButtonLeft(((minLeft + maxRight) / 2) - wrapRect.left);
    };
    recompute();
    const strip = stripRef.current;
    strip?.addEventListener('scroll', recompute, { passive: true });
    window.addEventListener('resize', recompute);
    return () => {
      strip?.removeEventListener('scroll', recompute);
      window.removeEventListener('resize', recompute);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMakeVideo, selectedScene, multiSelectedScenes, scenes.length]);

  // Recompute once thumbnails settle into place after a layout change.
  useEffect(() => {
    if (!showMakeVideo) return undefined;
    const id = window.requestAnimationFrame(() => {
      const wrap = wrapperRef.current;
      if (!wrap) return;
      const wrapRect = wrap.getBoundingClientRect();
      let minLeft = Infinity;
      let maxRight = -Infinity;
      for (const n of allSelected) {
        const el = sceneRefs?.current?.[n];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.left < minLeft) minLeft = r.left;
        if (r.right > maxRight) maxRight = r.right;
      }
      if (isFinite(minLeft) && isFinite(maxRight)) {
        setButtonLeft(((minLeft + maxRight) / 2) - wrapRect.left);
      }
    });
    return () => window.cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMakeVideo, selectedScene, multiSelectedScenes]);

  // Keep the selected scene in view as it changes (drives the playback
  // auto-scroll: as advancePlayback bumps selectedScene, the strip follows).
  useEffect(() => {
    const el = sceneRefs?.current?.[selectedScene];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selectedScene, sceneRefs]);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      {onTogglePlay && (
        <PlayPauseButton
          isPlaying={isPlaying}
          onClick={onTogglePlay}
          disabled={!canPlay && !isPlaying}
        />
      )}
      {onToggleStoryboard && (
        <StoryboardButton active={showStoryboard} onClick={onToggleStoryboard} />
      )}
      {showMakeVideo && buttonLeft != null && (
        <button
          type="button"
          onClick={onMakeVideoFrame}
          style={{
            position: 'absolute',
            top: -18,
            left: buttonLeft,
            transform: 'translateX(-50%)',
            backgroundColor: '#0A84FF',
            color: '#fff',
            border: 0,
            borderRadius: 999,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            zIndex: 5,
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            whiteSpace: 'nowrap',
          }}
        >
          Make Video Frame
        </button>
      )}
      <div
        id="bottom-bar"
        ref={stripRef}
        style={{
          height: '175px',
          display: 'flex',
          width: 'calc(100% - 24px)',
          paddingLeft: '0px',
          paddingRight: '24px',
          overflowX: 'scroll',
          backgroundColor: '#404040',
        }}
        onDragOver={(e) => {
          if (dragIndex != null) e.preventDefault();
        }}
        onDrop={handleDropEnd}
      >
        {scenes.map((scene, index) => {
          const sceneNumber = index + 1;
          const isSelected = selectedScene === sceneNumber;
          // Only show multi-select styling when there's an actual multi-selection
          // (otherwise a plain single click would always paint the blue ring).
          const isMultiSelected =
            allSelected.length > 1 && allSelected.includes(sceneNumber);
          const inMultiSelectMode = allSelected.length > 1;
          const selectedFrameId = scenes[selectedScene - 1]?.frameId;
          const selectedIsLoading =
            (loadingFrameIds && selectedFrameId && loadingFrameIds.has(selectedFrameId)) ||
            (creatingVideoFrameIds && selectedFrameId && creatingVideoFrameIds.has(selectedFrameId));
          const showActionIcons =
            (!deletingScenes.has(selectedScene) && !selectedIsLoading) || thumbnail != null;

          return (
            <React.Fragment key={scene.id}>
              {dropTarget === index && dragIndex !== index && dragIndex !== index - 1 && (
                <div style={dropIndicatorStyle} />
              )}
              <SceneThumbnail
                scene={scene}
                index={index}
                innerRef={(el) => (sceneRefs.current[sceneNumber] = el)}
                isHidden={false}
                isSelected={isSelected}
                isMultiSelected={isMultiSelected}
                hideDeleteBubble={inMultiSelectMode}
                isVideoFrame={scene.kind === 'video'}
                isPressed={pressedScene === sceneNumber}
                isMouseDown={isMouseDown}
                isDeleting={deletingScenes.has(sceneNumber)}
                isDragging={dragIndex === index}
                aspectRatio={aspectRatio}
                showActionIcons={showActionIcons}
                canExportClip={canExportClip}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e, el) => handleDragOverTile(e, index, el)}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDropTarget(null);
                }}
                onMouseDown={() => onSceneMouseDown(sceneNumber)}
                onMouseUp={(event) => onSceneMouseUp(sceneNumber, event)}
                onMouseLeave={onSceneMouseLeave}
                onDelete={(skipConfirm) => onDeleteScene(index, skipConfirm)}
                onOpenFolder={() => onOpenFolder(sceneNumber)}
              />
            </React.Fragment>
          );
        })}
        {dropTarget === scenes.length && dragIndex != null && dragIndex !== scenes.length - 1 && (
          <div style={dropIndicatorStyle} />
        )}

        <AddSceneButton
          aspectRatio={aspectRatio}
          isPressed={pressedAddScene}
          onMouseDown={onAddSceneMouseDown}
          onMouseUp={onAddSceneMouseUp}
          onMouseLeave={onAddSceneMouseLeave}
        />
      </div>
    </div>
  );
};

export default ScenesStrip;
