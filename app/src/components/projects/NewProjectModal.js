import React, { useEffect, useRef, useState } from 'react';
import { useOnboarding, STEPS } from '../../context/OnboardingContext';
import { color, font, radius, space } from '../../lib/tokens';
import { apiUrl } from '../../config';
import { useAuth } from '../../context/AuthContext';

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
const labelStyle = {
  margin: 0,
  color: color.textMuted,
  fontSize: font.size.xs,
  fontWeight: font.weight.medium,
  letterSpacing: 0.2,
  textTransform: 'uppercase',
};

const fieldStyle = { display: 'flex', flexDirection: 'column', gap: space[1] };

const NewProjectModal = ({ open, onClose, onSubmit, pendingError }) => {
  const onboarding = useOnboarding();
  const { token } = useAuth();
  const [projectName, setProjectName] = useState('');
  const [projectFolder, setProjectFolder] = useState('');
  const [width, setWidth] = useState('1280px');
  const [height, setHeight] = useState('720px');
  const [style, setStyle] = useState('Ghibli/Miyazaki');
  const [styleOptions, setStyleOptions] = useState([{ id: 'ghibli', label: 'Ghibli/Miyazaki' }]);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState(null);
  const nameRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    fetch(apiUrl('/projects/styles'), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.styles) && d.styles.length) {
          setStyleOptions(d.styles);
        }
        if (d?.defaultLabel) setStyle(d.defaultLabel);
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!open) {
      setProjectName('');
      setProjectFolder('');
      setWidth('1280px');
      setHeight('720px');
      setBusy(false);
      setLocalError(null);
    } else {
      const t = setTimeout(() => nameRef.current?.focus(), 0);
      onboarding.advanceFrom(STEPS.CLICK_CREATE);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open]);

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
    onboarding.advanceFrom(STEPS.FILL_NAME);
    onSubmit({
      projectName: trimmed,
      projectFolder,
      width,
      height,
      style,
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
        backgroundColor: color.overlay,
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
            New project
          </p>
          <p style={{
            margin: `${space[1]}px 0 0 0`,
            fontSize: font.size.md,
            color: color.textMuted,
          }}>
            Set up your story canvas. You can change anything later.
          </p>
        </div>

        <div style={fieldStyle}>
          <p style={labelStyle}>Project name</p>
          <input
            ref={nameRef}
            type="text"
            spellCheck={false}
            placeholder="Untitled story"
            value={projectName}
            onChange={(e) => handleNameChange(e.target.value)}
            data-onboard="project-name-input"
          />
        </div>
        <div style={{ display: 'flex', gap: space[3] }}>
          <div style={{ ...fieldStyle, flex: 1 }}>
            <p style={labelStyle}>Width</p>
            <input
              type="text"
              spellCheck={false}
              placeholder="1280px"
              value={width}
              onChange={(e) => handleDimensionInput(e.target.value, setWidth)}
            />
          </div>
          <div style={{ ...fieldStyle, flex: 1 }}>
            <p style={labelStyle}>Height</p>
            <input
              type="text"
              spellCheck={false}
              placeholder="720px"
              value={height}
              onChange={(e) => handleDimensionInput(e.target.value, setHeight)}
            />
          </div>
        </div>
        <div style={fieldStyle}>
          <p style={labelStyle}>Visual style</p>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            style={{ width: '100%' }}
          >
            {styleOptions.map((s) => (
              <option key={s.id} value={s.label}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {localError ? (
          <p style={{
            margin: 0,
            color: color.textDanger,
            fontSize: font.size.sm,
            lineHeight: 1.4,
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
          }}>
            {localError}
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
            disabled={busy}
          >
            {busy ? 'Creating…' : 'Create project'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewProjectModal;
