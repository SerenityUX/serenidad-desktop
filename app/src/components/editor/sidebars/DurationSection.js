import React from 'react';
import SectionHeader from '../shared/SectionHeader';
import Divider from '../shared/Divider';
import FieldLabel from '../shared/FieldLabel';

const DurationSection = ({ sceneDuration, videoMode, videoDuration, onVideoDurationChange }) => {
  if (videoMode) {
    return (
      <>
        <Divider />
        <SectionHeader icon="icons/clipDuration.svg" label="Video Duration" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
          <FieldLabel>SECONDS</FieldLabel>
          <input
            type="number"
            min={1}
            max={30}
            value={videoDuration ?? 4}
            onChange={onVideoDurationChange}
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
  }
  if (sceneDuration === null || sceneDuration === undefined) return null;
  return (
    <>
      <Divider />
      <SectionHeader icon="icons/clipDuration.svg" label="Duration" />
      <p style={{ fontSize: 14, color: '#404040', marginTop: 0, marginLeft: 12, marginBottom: 12 }}>
        {sceneDuration.toFixed(2)} seconds
      </p>
    </>
  );
};

export default DurationSection;
