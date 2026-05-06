import React, { useRef, useState } from 'react';
import { APP_FONT_STACK } from '../../../lib/fonts';

/**
 * Trading-card style with a subtle holographic shimmer. Tilts on hover and
 * runs a moving rainbow gradient over the portrait via mix-blend-mode. The
 * card itself stays clean — single thin border, soft shadow, no chunky frames.
 */
const CharacterCard = ({ character, onDelete, onOpen }) => {
  const ref = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, mx: 50, my: 50, active: false });

  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    setTilt({
      rx: (0.5 - py) * 4,
      ry: (px - 0.5) * 4,
      mx: px * 100,
      my: py * 100,
      active: true,
    });
  };
  const onLeave = () =>
    setTilt({ rx: 0, ry: 0, mx: 50, my: 50, active: false });

  return (
    <div
      ref={ref}
      role={onOpen ? 'button' : undefined}
      onClick={onOpen}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{
        position: 'relative',
        aspectRatio: '63/88',
        borderRadius: 10,
        background: '#fff',
        border: '1px solid #E5E5E5',
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
        transition: tilt.active ? 'transform 80ms ease-out' : 'transform 320ms ease, box-shadow 240ms ease',
        boxShadow: tilt.active
          ? '0 12px 28px rgba(0,0,0,0.14)'
          : '0 2px 8px rgba(0,0,0,0.06)',
        cursor: 'pointer',
        userSelect: 'none',
        fontFamily: APP_FONT_STACK,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 6,
          padding: '0 2px',
        }}
      >
        <div
          style={{
            fontWeight: 600,
            fontSize: 13,
            color: '#222',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {character.name}
        </div>
        {onDelete ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(character);
            }}
            title="Delete character"
            style={{
              border: 'none',
              background: 'transparent',
              padding: 2,
              cursor: 'pointer',
              fontSize: 12,
              color: '#AAA',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        ) : null}
      </div>

      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1/1',
          borderRadius: 6,
          overflow: 'hidden',
          background: '#F4F4F4',
        }}
      >
        {character.image_url ? (
          <img
            src={character.image_url}
            alt={character.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#AAA',
              fontSize: 11,
            }}
          >
            No portrait
          </div>
        )}
        {/* Holographic shimmer over the portrait only */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            mixBlendMode: 'color-dodge',
            opacity: tilt.active ? 0.16 : 0.05,
            transition: 'opacity 240ms ease',
            background: `conic-gradient(from ${tilt.mx * 3.6}deg at ${tilt.mx}% ${tilt.my}%, #ff6b6b, #ffe066, #6bff95, #6bd9ff, #c56bff, #ff6b6b)`,
            WebkitMaskImage: `radial-gradient(circle at ${tilt.mx}% ${tilt.my}%, #000 0%, transparent 55%)`,
            maskImage: `radial-gradient(circle at ${tilt.mx}% ${tilt.my}%, #000 0%, transparent 55%)`,
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            opacity: tilt.active ? 0.12 : 0,
            transition: 'opacity 240ms ease',
            background: `linear-gradient(${tilt.mx * 1.8}deg, transparent 40%, rgba(255,255,255,0.7) 50%, transparent 60%)`,
            mixBlendMode: 'overlay',
          }}
        />
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          fontSize: 11,
          color: '#444',
          lineHeight: 1.4,
          overflow: 'hidden',
          padding: '2px 2px',
        }}
      >
        {character.description || (
          <span style={{ color: '#AAA', fontStyle: 'italic' }}>No description.</span>
        )}
      </div>
    </div>
  );
};

export default CharacterCard;
