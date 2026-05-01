import React, { useRef, useState } from 'react';
import SectionHeader from '../shared/SectionHeader';
import FieldLabel from '../shared/FieldLabel';

const dropZoneStyle = (active, disabled) => ({
  width: 'calc(100% - 32px)',
  marginLeft: 12,
  marginRight: 12,
  border: `1px dashed ${active ? '#404040' : '#D9D9D9'}`,
  borderRadius: '4px',
  backgroundColor: active ? '#F5F5F5' : '#fff',
  fontSize: '12px',
  color: '#808080',
  padding: '12px 8px',
  textAlign: 'center',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
});

const thumbRowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  width: 'calc(100% - 32px)',
  marginLeft: 12,
  marginRight: 12,
  marginTop: 6,
};

const thumbStyle = {
  position: 'relative',
  width: 56,
  height: 56,
  borderRadius: 4,
  overflow: 'hidden',
  border: '1px solid #D9D9D9',
  backgroundColor: '#F2F2F2',
};

const removeBtnStyle = {
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
};

const ReferencesSection = ({
  references = [],
  onAddFiles,
  onAddUrl,
  onRemove,
  uploading,
  modelSupportsReferences,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (uploading) return;
    const files = Array.from(e.dataTransfer.files || []).filter((f) =>
      /^image\//.test(f.type),
    );
    if (files.length) {
      onAddFiles?.(files);
      return;
    }
    const url = (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain') || '').trim();
    if (url && /^https?:\/\//i.test(url)) {
      onAddUrl?.(url);
    }
  };

  const handlePick = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) onAddFiles?.(files);
    e.target.value = '';
  };

  return (
    <>
      <SectionHeader icon="icons/Picture.svg" label="References" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
        <FieldLabel>REFERENCE IMAGES</FieldLabel>
        <div
          style={dropZoneStyle(dragActive, uploading)}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!uploading) setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragActive(false);
          }}
          onDrop={handleDrop}
          onClick={() => !uploading && inputRef.current?.click()}
        >
          {uploading
            ? 'Uploading…'
            : modelSupportsReferences === false
              ? 'Drop images or click to upload (current model ignores refs)'
              : 'Drop images or click to upload'}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handlePick}
          />
        </div>

        {references.length > 0 && (
          <div style={thumbRowStyle}>
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
                    onRemove?.(url);
                  }}
                  title="Remove reference"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default ReferencesSection;
