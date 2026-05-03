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

const ScenesStrip = ({
  projectData,
  selectedScene,
  pressedScene,
  isMouseDown,
  deletingScenes,
  currentlyLoading,
  thumbnail,
  thumbnailTimestamps,
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

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
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
          const showActionIcons =
            (!deletingScenes.has(selectedScene) && !currentlyLoading.includes(selectedScene)) || thumbnail != null;

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
                thumbnailTimestamp={thumbnailTimestamps[sceneNumber]}
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
