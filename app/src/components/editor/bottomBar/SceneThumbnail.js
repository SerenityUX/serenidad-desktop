import React, { useRef } from 'react';
import { Img } from 'react-image';

const SceneThumbnail = ({
  scene,
  index,
  innerRef,
  isSelected,
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
        opacity: isDeleting ? 0 : isDragging ? 0.4 : (isSelected ? 1 : 0.3),
        transform: `scale(${pressed ? 0.9 : 1})`,
        transition:
          'opacity 0.25s ease-out, transform 0.1s ease-out, width 0.3s ease-out, height 0.3s ease-out, margin 0.3s ease-out, padding 0.3s ease-out',
      }}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      {showActionIcons && (
        <>
          <button
            type="button"
            aria-label="Delete scene"
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
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
          {canExportClip && (
            <button
              type="button"
              aria-label="Open scene folder"
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onOpenFolder(); }}
              style={{
                position: 'absolute',
                top: 21,
                right: 25,
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
                src="./icons/Folder.svg"
                style={{ width: 18, height: 18, pointerEvents: 'none' }}
              />
            </button>
          )}
        </>
      )}
      {scene.thumbnail != null && String(scene.thumbnail).trim() !== '' ? (
        <Img
          src={`${String(scene.thumbnail).trim()}?t=${thumbnailTimestamp || ''}`}
          loader={
            <div style={{
              aspectRatio,
              borderRadius: '12px',
              maxHeight: '100%',
              width: '100%',
              backgroundColor: '#F2F2F2',
            }} />
          }
          unloader={
            <div style={{
              aspectRatio,
              borderRadius: '12px',
              maxHeight: '100%',
              transition: 'opacity 0.1s ease-out, width 0.3s ease-out, transform 0.1s ease-out',
              width: '100%',
              backgroundColor: '#F2F2F2',
            }} />
          }
          style={{
            aspectRatio,
            borderRadius: '12px',
            maxHeight: '100%',
            display: 'flex',
            backgroundColor: '#F2F2F2',
            objectFit: 'cover',
            transition: 'opacity 0.1s ease-out, width 0.3s ease-out, transform 0.1s ease-out',
            opacity: pressed ? 0.7 : 1,
            transform: `scale(${pressed ? 0.95 : 1})`,
            pointerEvents: 'none',
          }}
        />
      ) : (
        <div
          style={{
            aspectRatio,
            borderRadius: '12px',
            maxHeight: '100%',
            width: '100%',
            backgroundColor: '#F2F2F2',
            transition: 'opacity 0.1s ease-out, width 0.3s ease-out, transform 0.1s ease-out',
            opacity: pressed ? 0.7 : 1,
            transform: `scale(${pressed ? 0.95 : 1})`,
          }}
        />
      )}
    </div>
  );
};

export default SceneThumbnail;
