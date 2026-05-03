import React from 'react';
import TitleBar from './TitleBar';
import LeftSidebar from './sidebars/LeftSidebar';
import RightSidebar from './sidebars/RightSidebar';
import CenterStage from './stage/CenterStage';
import ScenesStrip from './bottomBar/ScenesStrip';

const EditorLayout = ({
  onExport,
  onShare,
  showShare = false,
  voice,
  projectName,
  leftSidebarProps,
  centerStageProps,
  rightSidebarProps,
  scenesStripProps,
}) => (
  <div style={{
    height: '100%',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'Arial, sans-serif',
    margin: 0,
    padding: 0,
    alignItems: 'center',
    justifyContent: 'space-between',
  }}>
    <TitleBar onExport={onExport} onShare={onShare} showShare={showShare} voice={voice} projectName={projectName} />

    <div style={{ display: 'flex', width: '100%', height: 'calc(100% - 175px)' }}>
      <LeftSidebar {...leftSidebarProps} />
      <CenterStage {...centerStageProps} />
      <RightSidebar {...rightSidebarProps} />
    </div>

    <ScenesStrip {...scenesStripProps} />
  </div>
);

export default EditorLayout;
