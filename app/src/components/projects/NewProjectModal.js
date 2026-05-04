import React, { useEffect, useRef, useState } from 'react';

/**
 * In-app new-project dialog. Used by both the web build and the Electron
 * launcher; replaced the old `public/modal.html` BrowserWindow flow so the
 * UI is identical across targets.
 *
 * The parent owns the create-project network call. We just collect inputs,
 * validate the obvious things, and hand the values back via `onSubmit`. The
 * parent reports success/failure by calling `setError(null)` / `setError(msg)`
 * via the imperative `pendingError` prop, which we surface inline.
 */
const inputStyle = {
  color: '#404040',
  border: '1px solid #D9D9D9',
  borderRadius: 8,
  padding: '6px 8px',
  fontSize: 13,
  outline: 'none',
};

const labelStyle = {
  margin: 0,
  color: '#404040',
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: 0.5,
};

const NewProjectModal = ({ open, onClose, onSubmit, pendingError }) => {
  const [projectName, setProjectName] = useState('');
  const [projectFolder, setProjectFolder] = useState('');
  const [width, setWidth] = useState('1280px');
  const [height, setHeight] = useState('720px');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState(null);
  const nameRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setProjectName('');
      setProjectFolder('');
      setWidth('1280px');
      setHeight('720px');
      setBusy(false);
      setLocalError(null);
    } else {
      // Focus the first field after the modal mounts.
      const t = setTimeout(() => nameRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);

  // Reset busy state when the parent reports a result (error string or null).
  useEffect(() => {
    if (pendingError !== undefined) {
      setBusy(false);
      setLocalError(pendingError || null);
    }
  }, [pendingError]);

  const handleNameChange = (v) => {
    setProjectName(v);
    setProjectFolder(
      v.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, ''),
    );
  };

  const handleDimensionInput = (raw, setter) => {
    const digits = String(raw || '').replace(/\D/g, '');
    setter(digits ? `${digits}px` : '');
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (busy) return;
    setLocalError(null);
    const trimmed = projectName.trim();
    if (!trimmed) {
      setLocalError('Project name is required.');
      return;
    }
    setBusy(true);
    onSubmit({
      projectName: trimmed,
      projectFolder,
      width,
      height,
    });
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={() => {
        if (!busy) onClose?.();
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          width: 320,
          padding: 20,
          borderRadius: 12,
          backgroundColor: '#fff',
          boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', gap: 4, flexDirection: 'column' }}>
          <p style={labelStyle}>PROJECT NAME</p>
          <input
            ref={nameRef}
            type="text"
            spellCheck={false}
            placeholder="Project name..."
            value={projectName}
            onChange={(e) => handleNameChange(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ display: 'flex', gap: 4, flexDirection: 'column' }}>
          <p style={labelStyle}>PROJECT FOLDER</p>
          <input
            type="text"
            spellCheck={false}
            placeholder="project-name..."
            value={projectFolder}
            onChange={(e) => setProjectFolder(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 12,
            flexDirection: 'row',
          }}
        >
          <div
            style={{
              flex: 1,
              display: 'flex',
              gap: 4,
              flexDirection: 'column',
            }}
          >
            <p style={labelStyle}>WIDTH</p>
            <input
              type="text"
              spellCheck={false}
              placeholder="1280px"
              value={width}
              onChange={(e) => handleDimensionInput(e.target.value, setWidth)}
              style={inputStyle}
            />
          </div>
          <div
            style={{
              flex: 1,
              display: 'flex',
              gap: 4,
              flexDirection: 'column',
            }}
          >
            <p style={labelStyle}>HEIGHT</p>
            <input
              type="text"
              spellCheck={false}
              placeholder="720px"
              value={height}
              onChange={(e) => handleDimensionInput(e.target.value, setHeight)}
              style={inputStyle}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          style={{
            marginTop: 4,
            padding: '6px 12px',
            border: 0,
            borderRadius: 4,
            backgroundColor: '#1F93FF',
            color: '#fff',
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.6 : 1,
            height: 32,
            fontSize: 14,
          }}
        >
          {busy ? 'Creating…' : 'Create Project'}
        </button>

        {localError ? (
          <p
            style={{
              margin: 0,
              color: '#C0392B',
              fontSize: 11,
              lineHeight: 1.3,
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              fontWeight: 500,
            }}
          >
            {localError}
          </p>
        ) : null}
      </form>
    </div>
  );
};

export default NewProjectModal;
