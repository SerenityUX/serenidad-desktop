import React, { useState } from 'react';
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
}) => {
  const [dragIndex, setDragIndex] = useState(null);
  const [dropTarget, setDropTarget] = useState(null); // index of slot (0..n)

  const scenes = projectData?.scenes || [];

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

  return (
    <div
      id="bottom-bar"
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
              onMouseUp={() => onSceneMouseUp(sceneNumber)}
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
  );
};

export default ScenesStrip;
