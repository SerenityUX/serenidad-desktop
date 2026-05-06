import React from 'react';
import TitleBar from './TitleBar';
import Skeleton from '../ui/Skeleton';

const ProjectLoadingSkeleton = () => (
  <div
    style={{
      height: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#FFFFFF',
    }}
    aria-busy="true"
    aria-label="Loading project"
  >
    <TitleBar showExport={false} showShare={false} />

    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <Skeleton width={274} height="100%" radius={0} style={{ flexShrink: 0 }} />
      <Skeleton width="auto" height="100%" radius={0} style={{ flex: 1 }} />
      <Skeleton width={274} height="100%" radius={0} style={{ flexShrink: 0 }} />
    </div>

    <Skeleton width="100%" height={175} radius={0} />
  </div>
);

export default ProjectLoadingSkeleton;
