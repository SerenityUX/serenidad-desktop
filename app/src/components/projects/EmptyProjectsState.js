import React from 'react';
import { color, font, radius, space } from '../../lib/tokens';
import { asset } from '../../lib/asset';

/**
 * Friendly placeholder shown when the user has no projects yet. Doubles
 * as the visual anchor for the onboarding tour's "click Create" step:
 * the dashed card on the left points the eye at the Create button.
 */
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
        <div
          key={n}
          style={{
            aspectRatio: '16 / 9',
            borderRadius: radius.lg,
            overflow: 'hidden',
            backgroundColor: color.bgSubtle,
          }}
        >
          <img
            src={asset(`${n}.png`)}
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
            }}
          />
        </div>
      ))}
    </div>
  </div>
);

export default EmptyProjectsState;
