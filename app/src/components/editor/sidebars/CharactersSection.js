import React, { useMemo, useRef, useState } from 'react';
import SectionHeader from '../shared/SectionHeader';
import FieldLabel from '../shared/FieldLabel';
import { asset } from '../../../lib/asset';
import { color, font, radius, space } from '../../../lib/tokens';

// Compact roster chip showing portrait + name + slot index. The slot is
// visible because it maps directly to the Character{N} label that the
// rewritten generation prompt uses — letting the user reorder mentally.
const chipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: space[1],
  padding: `2px 6px 2px 2px`,
  borderRadius: radius.pill,
  border: `1px solid ${color.border}`,
  background: color.bg,
  fontSize: font.size.xs,
  color: color.text,
  maxWidth: '100%',
};

const portraitStyle = {
  width: 22,
  height: 22,
  borderRadius: '50%',
  objectFit: 'cover',
  background: color.bgSubtle,
  flex: '0 0 auto',
};

const slotStyle = {
  fontSize: 9,
  fontWeight: font.weight.semibold,
  color: color.textMuted,
  letterSpacing: 0.2,
};

const removeBtnStyle = {
  border: 'none',
  background: 'transparent',
  color: color.textMuted,
  cursor: 'pointer',
  fontSize: 12,
  lineHeight: 1,
  padding: '0 2px',
};

const addBtnStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: space[1],
  padding: `4px 8px`,
  borderRadius: radius.pill,
  border: `1px dashed ${color.border}`,
  background: 'transparent',
  color: color.textMuted,
  fontSize: font.size.xs,
  cursor: 'pointer',
};

const popoverStyle = {
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: 4,
  width: '100%',
  maxHeight: 220,
  overflowY: 'auto',
  background: color.bg,
  border: `1px solid ${color.borderStrong}`,
  borderRadius: radius.md,
  boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
  zIndex: 50,
  padding: space[1],
};

const optionStyle = (active) => ({
  display: 'flex',
  alignItems: 'center',
  gap: space[2],
  padding: `${space[1]}px ${space[2]}px`,
  borderRadius: radius.sm,
  cursor: 'pointer',
  background: active ? color.bgMuted : 'transparent',
});

const CharactersSection = ({
  projectCharacters = [],
  boundCharacterIds = [],
  onBind,
  onUnbind,
}) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const bound = useMemo(() => {
    const byId = new Map(projectCharacters.map((c) => [c.id, c]));
    return boundCharacterIds.map((id) => byId.get(id)).filter(Boolean);
  }, [projectCharacters, boundCharacterIds]);

  const available = useMemo(() => {
    const set = new Set(boundCharacterIds);
    return projectCharacters.filter((c) => !set.has(c.id));
  }, [projectCharacters, boundCharacterIds]);

  // Close popover on outside click.
  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
      <SectionHeader icon={asset('icons/Picture.svg')} label="Characters" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}>
        <FieldLabel>In this scene</FieldLabel>
        <div
          ref={wrapRef}
          style={{
            position: 'relative',
            display: 'flex',
            flexWrap: 'wrap',
            gap: space[1],
            padding: space[1],
            border: `1px solid ${color.border}`,
            borderRadius: radius.md,
            background: color.bg,
            minHeight: 38,
            alignItems: 'center',
          }}
        >
          {bound.length === 0 && (
            <span
              style={{
                fontSize: font.size.xs,
                color: color.textMuted,
                padding: '0 4px',
              }}
            >
              No characters bound. Add one or @mention in the prompt.
            </span>
          )}
          {bound.map((c, i) => (
            <span key={c.id} style={chipStyle} title={c.description || c.name}>
              {c.image_url ? (
                <img src={c.image_url} alt="" style={portraitStyle} />
              ) : (
                <span style={{ ...portraitStyle, display: 'inline-block' }} />
              )}
              <span style={slotStyle}>C{i + 1}</span>
              <span
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 90,
                }}
              >
                {c.name}
              </span>
              {onUnbind ? (
                <button
                  type="button"
                  style={removeBtnStyle}
                  onClick={() => onUnbind(c)}
                  title="Remove from scene"
                >
                  ×
                </button>
              ) : null}
            </span>
          ))}
          {available.length > 0 ? (
            <button
              type="button"
              style={addBtnStyle}
              onClick={() => setOpen((v) => !v)}
            >
              + Character
            </button>
          ) : projectCharacters.length === 0 ? (
            <span
              style={{
                fontSize: font.size.xs,
                color: color.textFaint,
                padding: '0 4px',
              }}
            >
              Create a character in the Characters tab to use here.
            </span>
          ) : null}

          {open && available.length > 0 ? (
            <div style={popoverStyle}>
              {available.map((c) => (
                <CharacterOption
                  key={c.id}
                  character={c}
                  onPick={() => {
                    onBind?.(c);
                    setOpen(false);
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const CharacterOption = ({ character, onPick }) => {
  const [hover, setHover] = useState(false);
  return (
    <div
      role="button"
      onClick={onPick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={optionStyle(hover)}
    >
      {character.image_url ? (
        <img src={character.image_url} alt="" style={portraitStyle} />
      ) : (
        <span style={{ ...portraitStyle, display: 'inline-block' }} />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span
          style={{
            fontSize: font.size.sm,
            color: color.text,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {character.name}
        </span>
        {character.description ? (
          <span
            style={{
              fontSize: 10,
              color: color.textFaint,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {character.description}
          </span>
        ) : null}
      </div>
    </div>
  );
};

export default CharactersSection;
