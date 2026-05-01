import React from 'react';
import SceneThumbnail from './SceneThumbnail';
import AddSceneButton from './AddSceneButton';

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
  pressedAddScene,
  onAddSceneMouseDown,
  onAddSceneMouseUp,
  onAddSceneMouseLeave,
}) => (
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
  >
    {projectData && projectData.scenes && projectData.scenes.map((scene, index) => {
      const sceneNumber = index + 1;
      const isSelected = selectedScene === sceneNumber;
      const showActionIcons =
        (!deletingScenes.has(selectedScene) && !currentlyLoading.includes(selectedScene)) || thumbnail != null;

      return (
        <SceneThumbnail
          key={scene.id}
          scene={scene}
          index={index}
          innerRef={(el) => (sceneRefs.current[sceneNumber] = el)}
          isHidden={index === 0}
          isSelected={isSelected}
          isPressed={pressedScene === sceneNumber}
          isMouseDown={isMouseDown}
          isDeleting={deletingScenes.has(sceneNumber)}
          aspectRatio={aspectRatio}
          thumbnailTimestamp={thumbnailTimestamps[sceneNumber]}
          showActionIcons={showActionIcons}
          canExportClip={canExportClip}
          onMouseDown={() => onSceneMouseDown(sceneNumber)}
          onMouseUp={() => onSceneMouseUp(sceneNumber)}
          onMouseLeave={onSceneMouseLeave}
          onDelete={() => onDeleteScene(index)}
          onOpenFolder={() => onOpenFolder(sceneNumber)}
        />
      );
    })}

    <AddSceneButton
      aspectRatio={aspectRatio}
      isPressed={pressedAddScene}
      onMouseDown={onAddSceneMouseDown}
      onMouseUp={onAddSceneMouseUp}
      onMouseLeave={onAddSceneMouseLeave}
    />
  </div>
);

export default ScenesStrip;
