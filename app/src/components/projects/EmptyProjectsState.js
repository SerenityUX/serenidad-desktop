import React, { useRef, useState } from 'react';
import { color, font, radius, space } from '../../lib/tokens';
import { asset } from '../../lib/asset';

/**
 * Hover-to-magnify tile. Cursor position drives the image's
 * transform-origin so scaling makes the spot under the cursor expand —
 * effectively a movable magnifying glass that stays within the frame.
 *
 * Disabled on touch / coarse pointers: there's no hover signal there,
 * so leave the image at 1×.
 */
const ZoomTile = ({ src, zoom = 2.4 }) => {
  const ref = useRef(null);
  const [origin, setOrigin] = useState('50% 50%');
  const [zoomed, setZoomed] = useState(false);

  const handleMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setOrigin(`${Math.max(0, Math.min(100, x))}% ${Math.max(0, Math.min(100, y))}%`);
  };

  return (
    <div
      ref={ref}
      onMouseEnter={() => setZoomed(true)}
      onMouseLeave={() => {
        setZoomed(false);
        setOrigin('50% 50%');
      }}
      onMouseMove={handleMove}
      style={{
        aspectRatio: '16 / 9',
        borderRadius: radius.lg,
        overflow: 'hidden',
        backgroundColor: color.bgSubtle,
        cursor: 'zoom-in',
      }}
    >
      <img
        src={src}
        alt=""
        decoding="async"
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          imageRendering: 'auto',
          WebkitImageSmoothing: 'high',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitUserDrag: 'none',
          pointerEvents: 'none',
          transform: `scale(${zoomed ? zoom : 1})`,
          transformOrigin: origin,
          // Slow re-origin transition would lag behind the cursor —
          // origin updates need to feel instant; only ease the zoom
          // in/out so it doesn't pop.
          transition: zoomed
            ? 'transform 180ms ease-out'
            : 'transform 220ms ease-out, transform-origin 220ms ease-out',
        }}
      />
    </div>
  );
};

const EmptyProjectsState = ({ onCreate }) => (
  <div
    style={{
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: 64,
      paddingBottom: 80,
      paddingLeft: space[4],
      paddingRight: space[4],
      boxSizing: 'border-box',
    }}
  >
    <div
      style={{
        width: '100%',
        maxWidth: 560,
        backgroundColor: color.bgSubtle,
        border: `1px solid ${color.border}`,
        borderRadius: radius.xl,
        padding: `${space[7]}px ${space[6]}px`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: space[3],
      }}
    >
      <div
        aria-hidden
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: color.bg,
          border: `1px solid ${color.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: color.textAccent,
          fontSize: 22,
          lineHeight: 1,
        }}
      >
        ✻
      </div>
      <div
        style={{
          fontSize: font.size.xl,
          fontWeight: font.weight.semibold,
          color: color.text,
          letterSpacing: '-0.01em',
        }}
      >
        No projects yet
      </div>
      <button
        type="button"
        className="btn btn-primary btn-lg"
        onClick={onCreate}
        style={{ marginTop: space[2] }}
      >
        Create your first story
      </button>
      <div
        style={{
          fontSize: font.size.sm,
          color: color.textFaint,
          marginTop: space[1],
        }}
      >
        ✻100 already in your account — about $1 worth, on the house.
      </div>
    </div>

    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: space[3],
        width: '100%',
        maxWidth: 520,
        marginTop: space[6],
      }}
    >
      {[3, 2, 1, 4, 5, 6, 7, 8].map((n) => (
        <ZoomTile key={n} src={asset(`${n}.png`)} />
      ))}
    </div>
  </div>
);

export default EmptyProjectsState;
