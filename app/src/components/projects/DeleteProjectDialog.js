import React, { useEffect, useState } from 'react';
import { color, font, radius, space } from '../../lib/tokens';

/**
 * Confirmation dialog for delete/remove. The label flips based on
 * `mode`: `owner` deletes the whole project; `invite` only removes the
 * caller's own invite. The copy makes the difference obvious so an
 * invitee can't accidentally believe they wiped a friend's project.
 */
const DeleteProjectDialog = ({ open, project, mode, onClose, onConfirm }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) {
      setBusy(false);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const isOwner = mode === 'owner';
  const title = isOwner ? 'Delete project' : 'Remove project';
  const ctaLabel = isOwner ? 'Delete' : 'Remove';
  const description = isOwner
    ? `Permanently delete "${project?.name ?? 'this project'}"? Scenes, chats, and characters will be deleted for everyone with access. This can't be undone.`
    : `Remove "${project?.name ?? 'this project'}" from your launcher? You'll lose access, but the project itself stays — the owner can re-share it later.`;

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setBusy(false);
      setError(err?.message || `Could not ${ctaLabel.toLowerCase()}.`);
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
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 380,
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
            {title}
          </p>
          <p style={{
            margin: `${space[2]}px 0 0 0`,
            fontSize: font.size.md,
            color: color.textMuted,
            lineHeight: 1.5,
          }}>
            {description}
          </p>
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
            type="button"
            className="btn"
            onClick={handleConfirm}
            disabled={busy}
            style={{
              backgroundColor: color.textDanger,
              borderColor: color.textDanger,
              color: '#fff',
            }}
            onMouseEnter={(e) => {
              if (!busy) {
                e.currentTarget.style.backgroundColor = '#a40e1c';
                e.currentTarget.style.borderColor = '#a40e1c';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = color.textDanger;
              e.currentTarget.style.borderColor = color.textDanger;
            }}
          >
            {busy ? `${ctaLabel}…` : ctaLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteProjectDialog;
