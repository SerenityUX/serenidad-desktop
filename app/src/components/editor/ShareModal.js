import React, { useState, useEffect, useCallback } from 'react';
import { apiUrl } from '../../config';
import { color, font, radius, space } from '../../lib/tokens';

const labelStyle = {
  margin: 0,
  color: color.textMuted,
  fontSize: font.size.xs,
  fontWeight: font.weight.medium,
  letterSpacing: 0.2,
  textTransform: 'uppercase',
};

const removeBtnStyle = {
  width: 22,
  height: 22,
  borderRadius: radius.sm,
  border: 'none',
  backgroundColor: 'transparent',
  color: color.textMuted,
  cursor: 'pointer',
  fontSize: 14,
  lineHeight: 1,
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background-color 120ms ease, color 120ms ease',
};

const ShareModal = ({ projectId, authToken, onClose }) => {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [shares, setShares] = useState([]);
  const [isOwner, setIsOwner] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const loadShares = useCallback(async () => {
    if (!projectId || !authToken) return;
    try {
      const res = await fetch(
        apiUrl(`/projects/${encodeURIComponent(projectId)}/shares`),
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            Accept: 'application/json',
          },
        },
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setShares(data.shares || []);
        setIsOwner(data.membership === 'owner');
      }
    } catch (e) {
      console.error(e);
    }
  }, [projectId, authToken]);

  useEffect(() => {
    loadShares();
  }, [loadShares]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch(
        apiUrl(`/projects/${encodeURIComponent(projectId)}/share`),
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ email: value }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: body.error || 'Could not share' });
      } else {
        const baseText = body.pending
          ? `Sent ${value} an invite to CoCreate.`
          : body.alreadyShared
            ? `${value} already had access — re-sent the email.`
            : `Shared with ${value} and sent a notification email.`;
        setMessage({
          type: 'success',
          text: body.emailed === false ? body.warning || baseText : baseText,
        });
        setEmail('');
        loadShares();
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'Network error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (userId) => {
    if (!isOwner || !userId) return;
    setRemovingId(userId);
    setMessage(null);
    try {
      const res = await fetch(
        apiUrl(
          `/projects/${encodeURIComponent(projectId)}/shares/${encodeURIComponent(userId)}`,
        ),
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${authToken}`,
            Accept: 'application/json',
          },
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: 'error', text: body.error || 'Could not remove' });
        return;
      }
      setShares((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'Network error' });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        backgroundColor: color.overlay,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseDown={onClose}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 400,
          maxWidth: '90%',
          padding: space[6],
          borderRadius: radius.xl,
          backgroundColor: color.bg,
          border: `1px solid ${color.border}`,
          fontFamily: font.family,
          color: color.text,
          display: 'flex',
          flexDirection: 'column',
          gap: space[4],
        }}
      >
        <div>
          <p style={{
            margin: 0,
            fontSize: font.size.lg,
            fontWeight: font.weight.semibold,
            letterSpacing: '-0.01em',
          }}>
            Share project
          </p>
          <p style={{
            margin: `${space[1]}px 0 0 0`,
            fontSize: font.size.md,
            color: color.textMuted,
          }}>
            Anyone you add can open and edit this project.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}>
          <p style={labelStyle}>Email</p>
          <div style={{ display: 'flex', gap: space[2] }}>
            <input
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              disabled={submitting}
              style={{ flex: 1 }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !email.trim()}
            >
              {submitting ? 'Sharing…' : 'Share'}
            </button>
          </div>
        </form>

        {message ? (
          <div
            style={{
              fontSize: font.size.sm,
              lineHeight: 1.4,
              color: message.type === 'error' ? color.textDanger : color.text,
              backgroundColor: message.type === 'error'
                ? 'rgba(207, 34, 46, 0.06)'
                : color.bgAccentSubtle,
              padding: `${space[2]}px ${space[3]}px`,
              borderRadius: radius.md,
              border: `1px solid ${message.type === 'error' ? 'rgba(207, 34, 46, 0.2)' : 'rgba(31, 147, 255, 0.2)'}`,
            }}
          >
            {message.text}
          </div>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
          <p style={labelStyle}>Shared with</p>
          <div style={{
            maxHeight: 220,
            overflowY: 'auto',
            border: `1px solid ${color.border}`,
            borderRadius: radius.md,
          }}>
            {shares.length === 0 ? (
              <div style={{
                fontSize: font.size.sm,
                color: color.textMuted,
                padding: `${space[3]}px ${space[3]}px`,
              }}>
                No collaborators yet.
              </div>
            ) : (
              shares.map((u, i) => (
                <div
                  key={u.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: space[2],
                    padding: `${space[2]}px ${space[3]}px`,
                    fontSize: font.size.md,
                    borderTop: i === 0 ? 'none' : `1px solid ${color.border}`,
                  }}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      backgroundColor: color.bgMuted,
                      backgroundImage: u.profile_picture ? `url(${u.profile_picture})` : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: color.text,
                    }}>
                      {u.pending_signup ? u.email : u.name}
                      {u.pending_signup ? (
                        <span style={{
                          color: color.textFaint,
                          fontSize: font.size.xs,
                          marginLeft: space[2],
                        }}>
                          invited
                        </span>
                      ) : null}
                    </span>
                    {!u.pending_signup ? (
                      <span style={{ fontSize: font.size.xs, color: color.textMuted }}>{u.email}</span>
                    ) : null}
                  </div>
                  {isOwner ? (
                    <button
                      type="button"
                      title="Remove"
                      onClick={() => handleRemove(u.id)}
                      disabled={removingId === u.id}
                      style={removeBtnStyle}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = color.bgHover;
                        e.currentTarget.style.color = color.text;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = color.textMuted;
                      }}
                    >
                      {removingId === u.id ? '…' : '×'}
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
