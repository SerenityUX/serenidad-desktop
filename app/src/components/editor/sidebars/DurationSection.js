import React from 'react';
import SectionHeader from '../shared/SectionHeader';
import Divider from '../shared/Divider';
import FieldLabel from '../shared/FieldLabel';

const DurationSection = ({ videoMode, sceneDuration, onSceneDurationChange }) => (
  <>
    <Divider />
    <SectionHeader
      icon="icons/clipDuration.svg"
      label={videoMode ? 'Video Duration' : 'Frame Duration'}
    />
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
      <FieldLabel>SECONDS</FieldLabel>
      <input
        type="number"
        min={1}
        max={30}
        value={sceneDuration ?? (videoMode ? 4 : 2)}
        onChange={onSceneDurationChange}
        style={{
          width: 'calc(100% - 32px)',
          marginLeft: 12,
          marginRight: 12,
          padding: '4px 4px',
          border: '1px solid #D9D9D9',
          borderRadius: '4px',
          backgroundColor: '#fff',
          fontSize: '14px',
          color: '#404040',
        }}
      />
    </div>
  </>
);

export default DurationSection;
