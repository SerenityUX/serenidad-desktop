import React, { useState, useEffect, useCallback } from 'react';
import { apiUrl } from '../../config';

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10000,
};

const cardStyle = {
  backgroundColor: '#fff',
  borderRadius: 8,
  padding: 20,
  width: 380,
  maxWidth: '90%',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
};

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 10px',
  fontSize: 14,
  border: '1px solid #D9D9D9',
  borderRadius: 4,
  outline: 'none',
};

const primaryBtn = {
  backgroundColor: '#1F93FF',
  color: '#fff',
  border: '0',
  borderRadius: 4,
  padding: '6px 12px',
  fontSize: 14,
  cursor: 'pointer',
};

const secondaryBtn = {
  backgroundColor: '#fff',
  color: '#333',
  border: '1px solid #D9D9D9',
  borderRadius: 4,
  padding: '6px 12px',
  fontSize: 14,
  cursor: 'pointer',
};

const ShareModal = ({ projectId, authToken, onClose }) => {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [shares, setShares] = useState([]);

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
      if (res.ok) setShares(data.shares || []);
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
        const text = body.alreadyShared
          ? `${value} already had access — re-sent the email.`
          : `Shared with ${value} and sent a notification email.`;
        setMessage({
          type: 'success',
          text: body.emailed === false ? body.warning || text : text,
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

  return (
    <div style={overlayStyle} onMouseDown={onClose}>
      <div style={cardStyle} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
          Share project
        </div>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 14 }}>
          Enter the email of someone who already has a Kōdan account. They'll
          get an email and the project will appear in their list.
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              style={inputStyle}
              disabled={submitting}
            />
            <button type="submit" style={primaryBtn} disabled={submitting || !email.trim()}>
              {submitting ? 'Sharing…' : 'Share'}
            </button>
          </div>
        </form>

        {message ? (
          <div
            style={{
              marginTop: 10,
              fontSize: 13,
              color: message.type === 'error' ? '#B00020' : '#1B7F3A',
            }}
          >
            {message.text}
          </div>
        ) : null}

        <div style={{ marginTop: 18, fontSize: 13, fontWeight: 600 }}>
          Shared with
        </div>
        <div style={{ marginTop: 6, maxHeight: 160, overflowY: 'auto' }}>
          {shares.length === 0 ? (
            <div style={{ fontSize: 12, color: '#888' }}>No collaborators yet.</div>
          ) : (
            shares.map((u) => (
              <div
                key={u.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 0',
                  fontSize: 13,
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: '#E5E5E5',
                    backgroundImage: u.profile_picture ? `url(${u.profile_picture})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span>{u.name}</span>
                  <span style={{ fontSize: 11, color: '#666' }}>{u.email}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" style={secondaryBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
