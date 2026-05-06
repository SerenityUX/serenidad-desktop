import React from 'react';
import SectionHeader from '../shared/SectionHeader';
import Divider from '../shared/Divider';
import FieldLabel from '../shared/FieldLabel';
import { asset } from '../../../lib/asset';
import { space } from '../../../lib/tokens';

const DurationSection = ({ videoMode, sceneDuration, onSceneDurationChange }) => (
  <>
    <Divider />
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
      <SectionHeader
        icon={asset('icons/clipDuration.svg')}
        label={videoMode ? 'Video duration' : 'Frame duration'}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}>
        <FieldLabel>Seconds</FieldLabel>
        <input
          type="number"
          min={1}
          max={30}
          value={sceneDuration ?? (videoMode ? 4 : 2)}
          onChange={onSceneDurationChange}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  </>
);

export default DurationSection;
