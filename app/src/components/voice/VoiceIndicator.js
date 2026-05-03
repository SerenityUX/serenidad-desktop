import React from 'react';

const BAR_COUNT = 5;

/**
 * Centered overlay showing live mic level as 5 bouncing bars + status text.
 * `levels` is a length-BAR_COUNT array of 0..1 values (most-recent last).
 */
const VoiceIndicator = ({ status, levels }) => {
  const safeLevels =
    Array.isArray(levels) && levels.length === BAR_COUNT
      ? levels
      : new Array(BAR_COUNT).fill(0);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: 'rgba(20, 20, 20, 0.92)',
          borderRadius: 16,
          padding: '20px 28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          minWidth: 220,
          boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            height: 56,
          }}
        >
          {safeLevels.map((lvl, i) => {
            const h = Math.max(6, Math.round(lvl * 56));
            return (
              <div
                key={i}
                style={{
                  width: 8,
                  height: h,
                  borderRadius: 4,
                  background: '#1F93FF',
                  transition: 'height 80ms ease-out',
                }}
              />
            );
          })}
        </div>
        <div
          style={{
            color: '#F2F2F2',
            fontSize: 13,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
            letterSpacing: 0.2,
          }}
        >
          {status}
        </div>
      </div>
    </div>
  );
};

export default VoiceIndicator;
