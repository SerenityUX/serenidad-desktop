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
    minHeight: 0,
    overflow: 'hidden',
  }}>
    <TitleBar onExport={onExport} onShare={onShare} showShare={showShare} voice={voice} projectName={projectName} />

    {/* Middle row fills whatever's left between the (fixed) title bar and
        scenes strip. The previous `calc(100% - 175px)` only subtracted the
        strip and overflowed by the title bar's height — fine in a frameless
        full-screen Electron window, broken in a smaller browser viewport. */}
    <div style={{ display: 'flex', width: '100%', flex: 1, minHeight: 0 }}>
      <LeftSidebar {...leftSidebarProps} />
      <CenterStage {...centerStageProps} />
      <RightSidebar {...rightSidebarProps} />
    </div>

    <ScenesStrip {...scenesStripProps} />
  </div>
);

export default EditorLayout;
