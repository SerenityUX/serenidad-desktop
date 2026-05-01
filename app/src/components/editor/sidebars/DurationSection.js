import React from 'react';
import SectionHeader from '../shared/SectionHeader';
import Divider from '../shared/Divider';

const DurationSection = ({ sceneDuration }) => {
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
