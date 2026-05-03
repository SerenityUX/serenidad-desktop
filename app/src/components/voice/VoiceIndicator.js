import React from 'react';

const BAR_COUNT = 5;

/**
 * Inline mic-level pill: 5 bouncing bars, no text. Slot it into the title bar.
 * `levels` is a length-BAR_COUNT array of 0..1 values (most-recent last).
 */
const VoiceIndicator = ({ levels }) => {
  const safeLevels =
    Array.isArray(levels) && levels.length === BAR_COUNT
      ? levels
      : new Array(BAR_COUNT).fill(0);

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        height: 24,
        padding: '0 8px',
        borderRadius: 12,
        background: '#F2F2F2',
        WebkitAppRegion: 'no-drag',
      }}
    >
      {safeLevels.map((lvl, i) => {
        const h = Math.max(3, Math.round(lvl * 16));
        return (
          <div
            key={i}
            style={{
              width: 3,
              height: h,
              borderRadius: 2,
              background: '#1F93FF',
              transition: 'height 80ms ease-out',
            }}
          />
        );
      })}
    </div>
  );
};

export default VoiceIndicator;
