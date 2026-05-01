import React from 'react';

const ProjectLoadingSkeleton = () => (
  <div
    style={{
      height: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#FFFFFF',
    }}
  >
    <div style={{ height: 45, borderBottom: '1px solid #EFEFEF' }} />

    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <div style={{ width: 274, background: '#FAFAFA' }} />

      <div style={{ flex: 1, background: '#F2F2F2' }} />

      <div style={{ width: 274, background: '#FAFAFA' }} />
    </div>

    <div style={{ height: 175, background: '#404040' }} />
  </div>
);

export default ProjectLoadingSkeleton;
