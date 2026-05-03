import React from 'react';

const DOT_COUNT = 3;
const PILL_HEIGHT = 24;
const PILL_WIDTH = 44;
const VIZ_HEIGHT = 16;
const BAR_WIDTH = 3;
const MIN_BAR = 3;
const MAX_BAR = VIZ_HEIGHT;

/**
 * Inline voice pill with expand/collapse animation.
 * Renders a 24×24 circle that expands horizontally into a pill while bars
 * fade in. When `expanded` flips back to false, it contracts to a circle so
 * the parent can unmount it after the transition.
 */
const VoiceIndicator = ({ mode = 'listening', levels, expanded = true }) => {
  const isLoading = mode === 'loading';
  const safeLevels =
    Array.isArray(levels) && levels.length === DOT_COUNT
      ? levels
      : new Array(DOT_COUNT).fill(0);

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: PILL_HEIGHT,
        width: expanded ? PILL_WIDTH : PILL_HEIGHT,
        borderRadius: PILL_HEIGHT / 2,
        background: '#404040',
        overflow: 'hidden',
        WebkitAppRegion: 'no-drag',
        flexShrink: 0,
        transition:
          'width 260ms cubic-bezier(0.22, 1, 0.36, 1), transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
        transform: expanded ? 'scale(1)' : 'scale(0.92)',
      }}
    >
      <style>{`
        @keyframes voiceDotPulse {
          0%, 70%, 100% { opacity: 0.25; }
          30% { opacity: 1; }
        }
      `}</style>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          height: VIZ_HEIGHT,
          width: DOT_COUNT * BAR_WIDTH + (DOT_COUNT - 1) * 4,
          opacity: expanded ? 1 : 0,
          transition: 'opacity 180ms ease',
        }}
      >
        {[0, 1, 2].map((i) => {
          const lvl = safeLevels[i] || 0;
          const h = isLoading
            ? MIN_BAR
            : Math.max(MIN_BAR, Math.min(MAX_BAR, MIN_BAR + lvl * MAX_BAR));
          return (
            <div
              key={i}
              style={{
                width: BAR_WIDTH,
                height: h,
                borderRadius: BAR_WIDTH / 2,
                background: '#FFFFFF',
                opacity: isLoading ? 0.25 : 1,
                animation: isLoading
                  ? `voiceDotPulse 0.9s ease-in-out ${i * 0.18}s infinite`
                  : 'none',
                transition: isLoading ? 'none' : 'height 70ms ease-out',
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

export default VoiceIndicator;
