import React, { useEffect, useState } from 'react';
import { apiUrl } from '../../../config';
import { useAuth } from '../../../context/AuthContext';
import { APP_FONT_STACK } from '../../../lib/fonts';

const NewCharacterModal = ({ projectId, onClose, onCreated }) => {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [models, setModels] = useState([]);
  const [model, setModel] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(apiUrl('/projects/models'), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data?.models) ? data.models : [];
        setModels(list);
        setModel(data?.defaultId || list[0]?.id || '');
      })
      .catch(() => {});
  }, [token]);

  const generateImage = async () => {
    if (!name.trim() && !description.trim()) {
      setError('Add a name or description first');
      return;
    }
    setError(null);
    setGenerating(true);
    try {
      const r = await fetch(
        apiUrl(`/characters/projects/${encodeURIComponent(projectId)}/characters/generate-image`),
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description, model }),
        },
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || `Failed (${r.status})`);
      setImageUrl(data.imageUrl);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const r = await fetch(
        apiUrl(`/characters/projects/${encodeURIComponent(projectId)}/characters`),
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description, imageUrl }),
        },
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || `Failed (${r.status})`);
      onCreated?.(data.character);
      onClose?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 24,
          width: 480,
          maxWidth: '92vw',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          fontFamily: APP_FONT_STACK,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 14 }}>New Character</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>NAME</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Aiko"
              style={{
                border: '1px solid #D9D9D9',
                borderRadius: 6,
                padding: '8px 10px',
                fontSize: 14,
                fontFamily: 'inherit',
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>DESCRIPTION</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Quiet swordfighter with silver hair and a cracked mask…"
              rows={4}
              style={{
                border: '1px solid #D9D9D9',
                borderRadius: 6,
                padding: '8px 10px',
                fontSize: 14,
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 120,
                height: 160,
                borderRadius: 8,
                background: '#F2F2F2',
                border: '1px solid #E0E0E0',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#888',
                fontSize: 11,
                textAlign: 'center',
                padding: 8,
              }}
            >
              {generating ? (
                'Generating…'
              ) : imageUrl ? (
                <img
                  src={imageUrl}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                'No portrait yet'
              )}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>MODEL</span>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={generating || models.length === 0}
                  style={{
                    border: '1px solid #D9D9D9',
                    borderRadius: 6,
                    padding: '6px 8px',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    background: '#fff',
                  }}
                >
                  {models.length === 0 ? (
                    <option value="">Loading models…</option>
                  ) : (
                    models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label} · {m.costCents} {m.costCents === 1 ? 'token' : 'tokens'}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <button
                type="button"
                onClick={generateImage}
                disabled={generating}
                style={{
                  border: '1px solid #1F93FF',
                  background: '#fff',
                  color: '#1F93FF',
                  borderRadius: 6,
                  padding: '6px 10px',
                  fontSize: 13,
                  cursor: generating ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {generating ? 'Generating…' : imageUrl ? 'Regenerate Portrait' : 'Generate Portrait'}
              </button>
              <div style={{ fontSize: 11, color: '#888', lineHeight: 1.4 }}>
                You can save without a portrait and add one later.
              </div>
            </div>
          </div>
          {error ? <div style={{ color: '#C0392B', fontSize: 12 }}>{error}</div> : null}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                background: 'transparent',
                border: '1px solid #D9D9D9',
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || !name.trim()}
              style={{
                background: name.trim() && !saving ? '#1F93FF' : '#BFD7F2',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: 13,
                cursor: name.trim() && !saving ? 'pointer' : 'default',
                fontFamily: 'inherit',
              }}
            >
              {saving ? 'Saving…' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewCharacterModal;
