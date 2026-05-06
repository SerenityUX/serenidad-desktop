import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiUrl } from '../../../config';
import { useAuth } from '../../../context/AuthContext';
import { APP_FONT_STACK } from '../../../lib/fonts';

/**
 * Cursor-style file/symbol picker. Opens above the chat composer and lists
 * the project's scenes and characters. Clicking attaches a context ref the
 * agent can see (for "frame", we send sceneIndex; for "character", id).
 */
const AttachPicker = ({ projectId, onPick, onClose, anchorRect }) => {
  const { token } = useAuth();
  const [tab, setTab] = useState('frames');
  const [frames, setFrames] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!token || !projectId) return;
    fetch(apiUrl(`/projects/${encodeURIComponent(projectId)}`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setFrames(Array.isArray(d?.frames) ? d.frames : []))
      .catch(() => {});
    fetch(apiUrl(`/characters/projects/${encodeURIComponent(projectId)}/characters`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setCharacters(Array.isArray(d?.characters) ? d.characters : []))
      .catch(() => {});
  }, [projectId, token]);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const filteredFrames = useMemo(() => {
    const q = query.trim().toLowerCase();
    return frames
      .map((f, i) => ({ ...f, sceneIndex: i + 1 }))
      .filter((f) => !!f.result) // skip scenes that haven't been generated yet
      .filter((f) =>
        !q
          ? true
          : `scene ${f.sceneIndex} ${f.prompt || ''}`.toLowerCase().includes(q),
      );
  }, [frames, query]);

  const isVideoUrl = (url) => /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(String(url || ''));

  const filteredChars = useMemo(() => {
    const q = query.trim().toLowerCase();
    return characters.filter((c) =>
      !q ? true : `${c.name} ${c.description || ''}`.toLowerCase().includes(q),
    );
  }, [characters, query]);

  const style = {
    position: 'fixed',
    left: anchorRect ? anchorRect.left : 24,
    bottom: anchorRect ? Math.max(8, window.innerHeight - anchorRect.top + 6) : 80,
    width: 360,
    maxHeight: 360,
    background: '#fff',
    border: '1px solid #E5E5E5',
    borderRadius: 12,
    boxShadow: '0 12px 32px rgba(0,0,0,0.16)',
    fontFamily: APP_FONT_STACK,
    display: 'flex',
    flexDirection: 'column',
    zIndex: 200,
    overflow: 'hidden',
  };

  return (
    <div ref={ref} style={style}>
      <div style={{ display: 'flex', borderBottom: '1px solid #EEE' }}>
        {[
          ['frames', 'Frames'],
          ['characters', 'Characters'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            style={{
              flex: 1,
              padding: '10px 12px',
              border: 'none',
              background: 'transparent',
              fontSize: 13,
              fontFamily: 'inherit',
              fontWeight: tab === key ? 600 : 500,
              color: tab === key ? '#1F93FF' : '#666',
              borderBottom: tab === key ? '2px solid #1F93FF' : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={tab === 'frames' ? 'Search scenes…' : 'Search characters…'}
        style={{
          padding: '8px 12px',
          border: 'none',
          borderBottom: '1px solid #EEE',
          outline: 'none',
          fontSize: 13,
          fontFamily: 'inherit',
        }}
      />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'frames' ? (
          filteredFrames.length === 0 ? (
            <div style={{ padding: 16, color: '#999', fontSize: 12 }}>No scenes yet.</div>
          ) : (
            filteredFrames.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() =>
                  onPick({
                    type: 'frame',
                    sceneIndex: f.sceneIndex,
                    label: `Scene ${f.sceneIndex}`,
                    thumbnail: f.result || null,
                  })
                }
                style={pickRow}
              >
                <div style={pickThumb}>
                  {isVideoUrl(f.result) ? (
                    <video
                      src={f.result}
                      muted
                      playsInline
                      preload="metadata"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <img
                      src={f.result}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={pickTitle}>Scene {f.sceneIndex}</div>
                  <div style={pickSubtitle}>
                    {f.prompt ? f.prompt.slice(0, 80) : '(no prompt)'}
                  </div>
                </div>
              </button>
            ))
          )
        ) : filteredChars.length === 0 ? (
          <div style={{ padding: 16, color: '#999', fontSize: 12 }}>No characters yet.</div>
        ) : (
          filteredChars.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() =>
                onPick({
                  type: 'character',
                  id: c.id,
                  label: c.name,
                  thumbnail: c.image_url || null,
                })
              }
              style={pickRow}
            >
              <div style={pickThumb}>
                {c.image_url ? (
                  <img
                    src={c.image_url}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={pickEmpty}>{c.name.charAt(0)}</div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={pickTitle}>{c.name}</div>
                <div style={pickSubtitle}>{c.description || '(no description)'}</div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

const pickRow = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  padding: '8px 12px',
  border: 'none',
  background: 'transparent',
  width: '100%',
  textAlign: 'left',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const pickThumb = {
  width: 36,
  height: 36,
  borderRadius: 6,
  background: '#F2F2F2',
  overflow: 'hidden',
  flexShrink: 0,
};
const pickEmpty = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#AAA',
  fontSize: 12,
  fontWeight: 600,
};
const pickTitle = {
  fontSize: 13,
  fontWeight: 600,
  color: '#222',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
const pickSubtitle = {
  fontSize: 11,
  color: '#888',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

export default AttachPicker;
