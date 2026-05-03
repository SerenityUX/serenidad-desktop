import React, { useEffect, useRef, useState } from 'react';

const FIELD_HEIGHT = 64;

const fieldColumnStyle = {
  display: 'flex',
  width: 'calc(100% - 16px)',
  alignItems: 'start',
  flexDirection: 'column',
};

const labelGapStyle = { marginTop: 6 };

const promptStyle = {
  width: 'calc(100% - 16px)',
  fontSize: 14,
  maxWidth: 250,
  height: FIELD_HEIGHT,
  boxSizing: 'border-box',
  ...labelGapStyle,
};

const dropZoneStyle = (active, disabled, hasItems) => ({
  width: 'calc(100% - 16px)',
  maxWidth: 250,
  minHeight: FIELD_HEIGHT,
  border: `1px ${hasItems ? 'solid' : 'dashed'} ${active ? '#404040' : '#D9D9D9'}`,
  borderRadius: 8,
  backgroundColor: active ? '#F5F5F5' : '#fff',
  fontSize: 14,
  color: '#808080',
  padding: hasItems ? 6 : '6px 8px',
  textAlign: 'center',
  display: 'flex',
  alignItems: hasItems ? 'flex-start' : 'center',
  justifyContent: hasItems ? 'flex-start' : 'center',
  flexWrap: 'wrap',
  gap: 6,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
  boxSizing: 'border-box',
  ...labelGapStyle,
});

const thumbStyle = {
  position: 'relative',
  width: FIELD_HEIGHT - 16,
  height: FIELD_HEIGHT - 16,
  flex: '0 0 auto',
  borderRadius: 4,
  overflow: 'hidden',
  border: '1px solid #D9D9D9',
  backgroundColor: '#F2F2F2',
};

const removeBtnStyle = {
  position: 'absolute',
  top: 1,
  right: 1,
  width: 14,
  height: 14,
  borderRadius: '50%',
  border: 'none',
  background: 'rgba(0,0,0,0.6)',
  color: '#fff',
  fontSize: 10,
  lineHeight: '14px',
  padding: 0,
  cursor: 'pointer',
};

const addMoreStyle = {
  flex: '0 0 auto',
  width: FIELD_HEIGHT - 16,
  height: FIELD_HEIGHT - 16,
  borderRadius: 4,
  border: '1px dashed #D9D9D9',
  background: '#fff',
  color: '#808080',
  fontSize: 18,
  lineHeight: 1,
  padding: 0,
  cursor: 'pointer',
};

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
}) => {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);
  const promptRef = useRef(null);

  useEffect(() => {
    if (promptFocusToken == null || promptFocusToken === 0) return;
    const el = promptRef.current;
    if (!el) return;
    el.focus();
    try { el.select(); } catch { /* ignore */ }
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

  const hasItems = references.length > 0;

  return (
    <div
      style={{
        aspectRatio,
        maxWidth: '100%',
        height: '100%',
        borderRadius: '16px',
        overflow: 'hidden',
        objectFit: 'contain',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {!isLoading ? (
        <div style={{
          width: '100%',
          maxWidth: '518px',
          padding: '24px',
          border: '1px solid #000',
          borderRadius: '16px',
          display: 'flex',
          alignItems: 'start',
          flexDirection: 'column',
        }}>
          <p style={{ fontSize: 24, marginTop: 0, marginBottom: 20 }}>Scene Visual</p>
          <div style={{ display: 'flex', width: '100%', gap: 12, flexDirection: 'row' }}>
            <div style={fieldColumnStyle}>
              <p className="labelTop">PROMPT</p>
              <textarea
                ref={promptRef}
                value={prompt}
                style={promptStyle}
                onChange={onPromptChange}
                placeholder="Prompt..."
              />
            </div>
            <div style={fieldColumnStyle}>
              <p className="labelTop">REFERENCES</p>
              <div
                style={dropZoneStyle(dragActive, referencesUploading, hasItems)}
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
                onClick={hasItems ? undefined : openPicker}
              >
                {referencesUploading && !hasItems ? (
                  'Uploading…'
                ) : !hasItems ? (
                  'Drop images or upload'
                ) : (
                  <>
                    {references.map((url) => (
                      <div key={url} style={thumbStyle}>
                        <img
                          src={url}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <button
                          type="button"
                          style={removeBtnStyle}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveReference?.(url);
                          }}
                          title="Remove reference"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      style={addMoreStyle}
                      onClick={(e) => {
                        e.stopPropagation();
                        openPicker();
                      }}
                      title="Add reference"
                    >
                      +
                    </button>
                  </>
                )}
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
          </div>
          <button
            disabled={generateDisabled}
            onClick={onGenerate}
            style={{
              marginTop: 24,
              cursor: 'pointer',
              border: '1px solid #D9D9D9',
              paddingTop: 8,
              paddingBottom: 8,
              backgroundColor: '#fff',
              color: '#404040',
              fontSize: 16,
              width: '100%',
              borderRadius: '6px',
            }}
          >
            {generateLabel || 'Generate Visuals'}
          </button>
        </div>
      ) : (
        <div>
          <progress id="progress-bar" max="100" value={progress || null}></progress>
          <p style={{ fontSize: '12px', color: '#404040', marginTop: '8px', textAlign: 'center', margin: '8px auto 0' }}>
            {fact}
          </p>
        </div>
      )}
    </div>
  );
};

export default ScenePlaceholder;
