import React from 'react';
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
  aspectRatio,
  thumbnailTimestamp,
  showActionIcons,
  canExportClip,
  onMouseDown,
  onMouseUp,
  onMouseLeave,
  onDelete,
  onOpenFolder,
}) => {
  const pressed = (isPressed && isMouseDown) || (isSelected && isPressed);
  return (
    <div
      ref={innerRef}
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
        cursor: 'pointer',
        opacity: isDeleting ? 0 : (isSelected ? 1 : 0.3),
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
          <Img
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            style={{
              width: 18,
              height: 18,
              position: 'absolute',
              top: 32,
              right: 12,
              opacity: isSelected ? 1 : 0,
              transform: `scale(${isSelected ? 1 : 0})`,
              transition: 'opacity 0.25s ease-out, transform 0.25s ease-out',
              zIndex: 10,
            }}
            src="./icons/Minus.svg"
          />
          {canExportClip && (
            <Img
              onClick={(e) => { e.stopPropagation(); onOpenFolder(); }}
              style={{
                width: 18,
                height: 18,
                position: 'absolute',
                top: 32,
                right: 36,
                opacity: isSelected ? 1 : 0,
                transform: `scale(${isSelected ? 1 : 0})`,
                transition: 'opacity 0.25s ease-out, transform 0.25s ease-out',
                zIndex: 10,
              }}
              src="./icons/Folder.svg"
            />
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
