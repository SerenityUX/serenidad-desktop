import React, { useEffect, useRef, useState } from 'react';
import Icon from '../ui/Icon';
import { asset } from '../../lib/asset';
import { color, font, radius, space } from '../../lib/tokens';

const itemBase = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  padding: `${space[2]}px ${space[3]}px`,
  background: 'transparent',
  border: 'none',
  borderRadius: radius.sm,
  color: color.text,
  fontFamily: 'inherit',
  fontSize: font.size.md,
  fontWeight: font.weight.regular,
  textAlign: 'left',
  cursor: 'pointer',
  transition: 'background-color 120ms ease, color 120ms ease',
};

const MenuItem = ({ label, onClick, danger }) => {
  const [hover, setHover] = useState(false);
  const tint = danger ? color.textDanger : color.text;
  return (
    <button
      type="button"
      role="menuitem"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        ...itemBase,
        color: tint,
        backgroundColor: hover
          ? (danger ? 'rgba(207, 34, 46, 0.08)' : color.bgHover)
          : 'transparent',
      }}
    >
      {label}
    </button>
  );
};

/**
 * 3-dot menu attached to a project card. The trigger is a 28px white pill
 * meant to float on top of the thumbnail — strong enough to read on any
 * image without leaning on a dropshadow.
 */
const ProjectMenu = ({ isOwner, onRename, onShare, onDelete }) => {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocMouseDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const stop = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const fire = (handler) => (e) => {
    stop(e);
    setOpen(false);
    handler?.();
  };

  // Background flips between white (default), subtle wash on hover, and a
  // slightly heavier wash while the menu is open — matches Obsidian's idle /
  // hover / active treatment without a shadow.
  const bg = open
    ? color.bgMuted
    : hover
      ? color.bgSubtle
      : color.bg;

  return (
    <div
      ref={wrapperRef}
      onClick={stop}
      onMouseDown={stop}
      style={{ position: 'relative', display: 'inline-flex' }}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Project options"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={(e) => {
          stop(e);
          setOpen((o) => !o);
        }}
        style={{
          width: 28,
          height: 28,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          borderRadius: '50%',
          background: bg,
          border: `1px solid ${color.border}`,
          color: color.textMuted,
          cursor: 'pointer',
          transition: 'background-color 120ms ease, color 120ms ease',
        }}
      >
        <Icon src={asset('icons/ellipsis.svg')} size={14} />
      </button>
      {open ? (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            background: color.bg,
            border: `1px solid ${color.border}`,
            borderRadius: radius.lg,
            minWidth: 160,
            padding: 4,
            zIndex: 50,
          }}
        >
          {isOwner ? (
            <MenuItem label="Rename" onClick={fire(onRename)} />
          ) : null}
          <MenuItem label="Share" onClick={fire(onShare)} />
          <MenuItem
            label={isOwner ? 'Delete' : 'Remove'}
            onClick={fire(onDelete)}
            danger
          />
        </div>
      ) : null}
    </div>
  );
};

export default ProjectMenu;
