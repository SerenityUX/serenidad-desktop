import React, { useEffect, useState, useCallback } from 'react';
import { apiUrl } from '../../../config';
import { useAuth } from '../../../context/AuthContext';
import CharacterCard from './CharacterCard';
import NewCharacterModal from './NewCharacterModal';
import EditCharacterModal from './EditCharacterModal';
import CharactersViewSkeleton from './CharactersViewSkeleton';
import { APP_FONT_STACK } from '../../../lib/fonts';

const CharactersView = ({ projectId, onChange, openCharacterId, onOpenHandled }) => {
  const { token } = useAuth();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null); // character row or null

  const load = useCallback(async () => {
    if (!token || !projectId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        apiUrl(`/characters/projects/${encodeURIComponent(projectId)}/characters`),
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || `Failed (${r.status})`);
      setCharacters(Array.isArray(data.characters) ? data.characters : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, token]);

  useEffect(() => {
    load();
  }, [load]);

  // External open: chat character cards navigate here with the id of a
  // character to edit. Wait until the roster has loaded before opening so
  // the modal has the latest description / portrait.
  useEffect(() => {
    if (!openCharacterId) return;
    const found = characters.find((c) => c.id === openCharacterId);
    if (found) {
      setEditing(found);
      onOpenHandled?.();
    }
  }, [openCharacterId, characters, onOpenHandled]);

  const handleDelete = async (character) => {
    if (!window.confirm(`Delete ${character.name}?`)) return;
    try {
      const r = await fetch(
        apiUrl(
          `/characters/projects/${encodeURIComponent(projectId)}/characters/${encodeURIComponent(
            character.id,
          )}`,
        ),
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
      );
      if (!r.ok) throw new Error(`Failed (${r.status})`);
      setCharacters((prev) => prev.filter((c) => c.id !== character.id));
      onChange?.();
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading && characters.length === 0) {
    return <CharactersViewSkeleton />;
  }

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: '#FAFAFA', fontFamily: APP_FONT_STACK }}>
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: 24,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 600 }}>Characters</div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            style={{
              background: '#1F93FF',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 14px',
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            + New Character
          </button>
        </div>

        {error ? (
          <div style={{ color: '#C0392B', fontSize: 13 }}>{error}</div>
        ) : characters.length === 0 ? (
          <div
            style={{
              padding: '80px 20px',
              textAlign: 'center',
              color: '#666',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 500, color: '#222', marginBottom: 6 }}>
              No characters yet
            </div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 18 }}>
              Build the cast for your story — name, portrait, and a short description.
            </div>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              style={{
                background: '#1F93FF',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Create your first character
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 16,
            }}
          >
            {characters.map((c) => (
              <CharacterCard
                key={c.id}
                character={c}
                onDelete={handleDelete}
                onOpen={() => setEditing(c)}
              />
            ))}
          </div>
        )}
      </div>
      {showModal ? (
        <NewCharacterModal
          projectId={projectId}
          onClose={() => setShowModal(false)}
          onCreated={(c) => {
            setCharacters((prev) => [...prev, c]);
            onChange?.();
          }}
        />
      ) : null}
      {editing ? (
        <EditCharacterModal
          projectId={projectId}
          character={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setCharacters((prev) =>
              prev.map((c) => (c.id === updated.id ? updated : c)),
            );
            onChange?.();
          }}
          onDeleted={(deleted) => {
            setCharacters((prev) => prev.filter((c) => c.id !== deleted.id));
            onChange?.();
          }}
        />
      ) : null}
    </div>
  );
};

export default CharactersView;
