import React, { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../ui/Icon';
import { asset } from '../../../lib/asset';
import { color, font, radius, space } from '../../../lib/tokens';
import MentionEditor from '../shared/MentionEditor';

/**
 * Empty-scene state. Borrows from Claude / generative-input UIs: a single
 * focused prompt card with attach + send affordances inline, no harsh
 * black borders, no shadows. Reference thumbnails (if any) live inside
 * the card above the textarea so the surface still doubles as a drop
 * target — the same way Claude shows attachments above its message input.
 */

const THUMB = 56;

const ScenePlaceholder = ({
  aspectRatio,
  prompt,
  onPromptChange,
  generateDisabled,
  onGenerate,
  isLoading,
  progress,
  fact,
  references = [],
  onAddReferenceFiles,
  onAddReferenceUrl,
  onRemoveReference,
  referencesUploading,
  generateLabel,
  promptFocusToken,
  characters = [],
}) => {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);
  const editorRef = useRef(null);
  const characterNames = useMemo(() => characters.map((c) => c.name), [characters]);

  useEffect(() => {
    if (promptFocusToken == null || promptFocusToken === 0) return;
    editorRef.current?.focus();
  }, [promptFocusToken]);

  const openPicker = () => {
    if (referencesUploading) return;
    inputRef.current?.click();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (referencesUploading) return;
    const files = Array.from(e.dataTransfer.files || []).filter((f) =>
      /^image\//.test(f.type),
    );
    if (files.length) {
      onAddReferenceFiles?.(files);
      return;
    }
    const url = (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain') || '').trim();
    if (url && /^https?:\/\//i.test(url)) {
      onAddReferenceUrl?.(url);
    }
  };

  const handlePick = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) onAddReferenceFiles?.(files);
    e.target.value = '';
  };

  const handleKeyDown = (e) => {
    // Cmd/Ctrl-Enter submits — same affordance as Claude / ChatGPT, lets
    // users type multi-line prompts without losing the keyboard shortcut.
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!generateDisabled) onGenerate?.();
    }
  };

  const hasItems = references.length > 0;

  return (
    <div
      style={{
        aspectRatio,
        maxWidth: '100%',
        width: '100%',
        height: '100%',
        borderRadius: radius.xl,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: color.bg,
        padding: space[5],
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {hasItems ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 0,
            overflow: 'hidden',
          }}
        >
          {references.map((url) => (
            <img
              key={`bg-${url}`}
              src={url}
              alt=""
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: 0.18,
                filter: 'blur(40px) saturate(1.1)',
                transform: 'scale(1.1)',
              }}
            />
          ))}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.7) 100%)',
            }}
          />
        </div>
      ) : null}
      {isLoading ? (
        <LoadingState progress={progress} fact={fact} />
      ) : (
        <div
          style={{
            width: '100%',
            maxWidth: 540,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!referencesUploading) setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(false);
            }}
            onDrop={handleDrop}
            style={{
              width: '100%',
              borderRadius: radius.xl,
              backgroundColor: dragActive ? color.bgAccentSubtle : color.bg,
              border: `1px solid ${dragActive ? color.borderFocus : color.border}`,
              transition: 'border-color 120ms ease, background-color 120ms ease',
              padding: space[3],
              display: 'flex',
              flexDirection: 'column',
              gap: space[2],
            }}
          >
            <MentionEditor
              ref={editorRef}
              value={prompt || ''}
              characterNames={characterNames}
              onChange={(text) => onPromptChange?.({ target: { value: text } })}
              onKeyDown={handleKeyDown}
              placeholder={dragActive ? 'Drop to attach…' : 'Describe this scene…'}
              minHeight={84}
              maxHeight={220}
              style={{
                padding: `${space[2]}px ${space[2]}px`,
                fontFamily: 'inherit',
                fontSize: font.size.lg,
                lineHeight: 1.5,
                color: color.text,
              }}
            />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: space[2],
              }}
            >
              <button
                type="button"
                onClick={openPicker}
                disabled={referencesUploading}
                aria-label="Add references"
                title="Add references"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 30,
                  padding: '0 10px',
                  background: 'transparent',
                  border: `1px solid ${color.border}`,
                  borderRadius: radius.pill,
                  color: color.textMuted,
                  fontFamily: 'inherit',
                  fontSize: font.size.sm,
                  cursor: referencesUploading ? 'not-allowed' : 'pointer',
                  transition: 'background-color 120ms ease, color 120ms ease, border-color 120ms ease',
                }}
                onMouseEnter={(e) => {
                  if (referencesUploading) return;
                  e.currentTarget.style.backgroundColor = color.bgHover;
                  e.currentTarget.style.color = color.text;
                  e.currentTarget.style.borderColor = color.borderStrong;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = color.textMuted;
                  e.currentTarget.style.borderColor = color.border;
                }}
              >
                <Icon src={asset('icons/paperclip.svg')} size={13} />
                <span>{referencesUploading ? 'Uploading…' : 'References'}</span>
              </button>

              <button
                type="button"
                onClick={onGenerate}
                disabled={generateDisabled}
                aria-label={generateLabel || 'Generate visuals'}
                title={generateLabel || 'Generate visuals'}
                style={{
                  width: 32,
                  height: 32,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  borderRadius: '50%',
                  border: 'none',
                  background: generateDisabled ? color.bgMuted : color.accent,
                  color: generateDisabled ? color.textFaint : '#fff',
                  cursor: generateDisabled ? 'not-allowed' : 'pointer',
                  transition: 'background-color 120ms ease',
                }}
                onMouseEnter={(e) => {
                  if (generateDisabled) return;
                  e.currentTarget.style.backgroundColor = color.accentHover;
                }}
                onMouseLeave={(e) => {
                  if (generateDisabled) return;
                  e.currentTarget.style.backgroundColor = color.accent;
                }}
              >
                <Icon src={asset('icons/arrow-up.svg')} size={14} />
              </button>
            </div>

            {hasItems ? (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: space[2],
                  paddingTop: space[1],
                }}
              >
                {references.map((url) => (
                  <div
                    key={url}
                    style={{
                      position: 'relative',
                      width: THUMB,
                      height: THUMB,
                      borderRadius: radius.md,
                      overflow: 'hidden',
                      border: `1px solid ${color.border}`,
                      backgroundColor: color.bgSubtle,
                      flex: '0 0 auto',
                    }}
                  >
                    <img
                      src={url}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveReference?.(url);
                      }}
                      title="Remove reference"
                      style={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        border: 'none',
                        background: 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        fontSize: 11,
                        lineHeight: '16px',
                        padding: 0,
                        cursor: 'pointer',
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handlePick}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const LoadingState = ({ progress, fact }) => {
  const pct = Number.isFinite(Number(progress))
    ? Math.max(0, Math.min(100, Number(progress)))
    : null;
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 420,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: space[4],
      }}
    >
      <div
        style={{
          width: '100%',
          height: 4,
          borderRadius: radius.pill,
          backgroundColor: color.bgMuted,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: pct != null ? `${pct}%` : '40%',
            backgroundColor: color.accent,
            borderRadius: 'inherit',
            transition: 'width 240ms ease',
            opacity: pct != null ? 1 : 0.7,
          }}
        />
      </div>
      <p
        style={{
          margin: 0,
          fontSize: font.size.sm,
          color: color.textMuted,
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        {fact || 'Generating…'}
      </p>
    </div>
  );
};

export default ScenePlaceholder;
