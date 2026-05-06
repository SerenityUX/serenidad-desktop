import React, { useEffect, useRef, useState } from 'react';
import { color, font, radius, space } from '../../lib/tokens';

const labelStyle = {
  margin: 0,
  color: color.textMuted,
  fontSize: font.size.xs,
  fontWeight: font.weight.medium,
  letterSpacing: 0.2,
  textTransform: 'uppercase',
};

const RenameProjectModal = ({ open, project, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setBusy(false);
      setError(null);
      return undefined;
    }
    setName(project?.name ?? '');
    setError(null);
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => clearTimeout(t);
  }, [open, project]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required.');
      return;
    }
    if (trimmed === project?.name) {
      onClose?.();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(trimmed);
    } catch (err) {
      setBusy(false);
      setError(err?.message || 'Could not rename project.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: color.overlay,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={() => !busy && onClose?.()}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          width: 360,
          padding: space[6],
          borderRadius: radius.xl,
          backgroundColor: color.bg,
          border: `1px solid ${color.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: space[4],
          fontFamily: font.family,
          color: color.text,
        }}
      >
        <div>
          <p style={{
            margin: 0,
            fontSize: font.size.lg,
            fontWeight: font.weight.semibold,
            letterSpacing: '-0.01em',
          }}>
            Rename project
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}>
          <p style={labelStyle}>Project name</p>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            spellCheck={false}
            disabled={busy}
          />
        </div>

        {error ? (
          <p style={{
            margin: 0,
            color: color.textDanger,
            fontSize: font.size.sm,
            lineHeight: 1.4,
          }}>
            {error}
          </p>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: space[2] }}>
          <button
            type="button"
            className="btn"
            onClick={() => !busy && onClose?.()}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || !name.trim()}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RenameProjectModal;
