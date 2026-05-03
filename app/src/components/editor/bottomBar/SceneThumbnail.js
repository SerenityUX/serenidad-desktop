import React, { useRef } from 'react';
import { Img } from 'react-image';

// iOS dark-mode system blue / accent pink for video frames.
const IOS_BLUE = '#0A84FF';
const VIDEO_PINK = '#FF7AB6';

const SceneThumbnail = ({
  scene,
  index,
  innerRef,
  isSelected,
  isMultiSelected,
  hideDeleteBubble,
  isVideoFrame,
  isPressed,
  isMouseDown,
  isDeleting,
  isHidden,
  isDragging,
  aspectRatio,
  thumbnailTimestamp,
  showActionIcons,
  canExportClip,
  draggable,
  onDragStart,
  onDragOver,
  onDragEnd,
  onMouseDown,
  onMouseUp,
  onMouseLeave,
  onDelete,
  onOpenFolder,
}) => {
  const localRef = useRef(null);
  const setRefs = (el) => {
    localRef.current = el;
    if (typeof innerRef === 'function') innerRef(el);
  };
  const pressed = (isPressed && isMouseDown) || (isSelected && isPressed);

  // Pick the selection color: video frames pink, multi-select / primary blue.
  // Outline goes on the *image-shaped* wrapper so it follows aspect ratio and
  // border-radius, just like Finder's file selection.
  const ringColor =
    (isSelected && isVideoFrame) || (isMultiSelected && isVideoFrame)
      ? VIDEO_PINK
      : IOS_BLUE;
  const showRing = isMultiSelected || (isSelected && isVideoFrame);

  const shapeStyle = {
    position: 'relative',
    aspectRatio,
    borderRadius: '12px',
    maxHeight: '100%',
    width: '100%',
    backgroundColor: '#F2F2F2',
    overflow: 'hidden',
    transition: 'opacity 0.12s ease-out, transform 0.1s ease-out, box-shadow 0.15s ease-out',
    opacity: pressed ? 0.7 : 1,
    transform: `scale(${pressed ? 0.95 : 1})`,
    // Outline-style ring that respects the rounded shape and aspect ratio.
    boxShadow: showRing
      ? `0 0 0 2px #1C1C1E, 0 0 0 5px ${ringColor}`
      : 'none',
  };

  return (
    <div
      ref={setRefs}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={(e) => onDragOver?.(e, localRef.current)}
      onDragEnd={onDragEnd}
      style={{
        display: isHidden ? 'none' : 'flex',
        width: isDeleting ? '0px' : 'fit-content',
        maxHeight: isDeleting ? '0px' : '100%',
        padding: isDeleting ? '0px' : '24px',
        marginLeft: isDeleting ? '0px' : '24px',
        paddingLeft: '0px',
        paddingRight: '0px',
        marginRight: '0px',
        position: 'relative',
        cursor: isDragging ? 'grabbing' : 'pointer',
        opacity: isDeleting ? 0 : isDragging ? 0.4 : (isSelected || isMultiSelected ? 1 : 0.3),
        transition:
          'opacity 0.25s ease-out, width 0.3s ease-out, height 0.3s ease-out, margin 0.3s ease-out, padding 0.3s ease-out',
      }}
      onMouseDown={onMouseDown}
      onMouseUp={(e) => onMouseUp?.(e)}
      onMouseLeave={onMouseLeave}
    >
      {showActionIcons && !hideDeleteBubble && (
        <button
          type="button"
          aria-label="Delete scene"
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onDelete(e.shiftKey); }}
          style={{
            position: 'absolute',
            top: 21,
            right: 1,
            padding: 11,
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
            opacity: isSelected ? 1 : 0,
            pointerEvents: isSelected ? 'auto' : 'none',
            transform: `scale(${isSelected ? 1 : 0})`,
            transition: 'opacity 0.25s ease-out, transform 0.25s ease-out',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Img
            src="./icons/Minus.svg"
            style={{ width: 18, height: 18, pointerEvents: 'none' }}
          />
        </button>
      )}
      <div style={shapeStyle}>
        {(() => {
          const raw = String(scene.thumbnail || '').trim();
          if (!raw) return null;
          const isVideoUrl =
            isVideoFrame || /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(raw);
          if (isVideoUrl) {
            // First-frame poster for the strip — muted, never plays, just
            // shows the start of the clip so the user sees what frame this is.
            return (
              <video
                src={raw}
                muted
                playsInline
                preload="metadata"
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  objectFit: 'cover',
                  backgroundColor: '#F2F2F2',
                  pointerEvents: 'none',
                }}
              />
            );
          }
          return (
            <Img
              src={`${raw}?t=${thumbnailTimestamp || ''}`}
              loader={<div style={{ width: '100%', height: '100%', backgroundColor: '#F2F2F2' }} />}
              unloader={<div style={{ width: '100%', height: '100%', backgroundColor: '#F2F2F2' }} />}
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                objectFit: 'cover',
                backgroundColor: '#F2F2F2',
                pointerEvents: 'none',
              }}
            />
          );
        })()}
      </div>
    </div>
  );
};

export default SceneThumbnail;
