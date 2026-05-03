import React from 'react';

const DOT_COUNT = 3;
/** Container is sized to never change with bar height. */
const PILL_HEIGHT = 24;
const PILL_WIDTH = 44;
const VIZ_HEIGHT = 16;
const BAR_WIDTH = 3;
const MIN_BAR = 3;
const MAX_BAR = VIZ_HEIGHT;

/**
 * Inline voice pill: 3 vertical white bars on dark grey, traditional EQ style.
 * Bars grow vertically from center inside a fixed-size container so the pill
 * never resizes.
 *
 * - mode "listening": bar heights track rolling mic levels
 * - mode "loading": bars stay short, opacity cycles sequentially
 */
const VoiceIndicator = ({ mode = 'listening', levels }) => {
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
        width: PILL_WIDTH,
        borderRadius: 12,
        background: '#404040',
        WebkitAppRegion: 'no-drag',
        flexShrink: 0,
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
