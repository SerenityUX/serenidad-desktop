import React, { useRef, useState } from 'react';
import SectionHeader from '../shared/SectionHeader';
import FieldLabel from '../shared/FieldLabel';

const THUMB = 48;
const MIN_HEIGHT = 64;

const dropZoneStyle = (active, disabled, hasItems) => ({
  width: 'calc(100% - 32px)',
  marginLeft: 12,
  marginRight: 12,
  boxSizing: 'border-box',
  border: `1px ${hasItems ? 'solid' : 'dashed'} ${active ? '#404040' : '#D9D9D9'}`,
  borderRadius: 4,
  backgroundColor: active ? '#F5F5F5' : '#fff',
  fontSize: 14,
  color: '#808080',
  padding: hasItems ? 6 : '4px 4px',
  minHeight: MIN_HEIGHT,
  display: 'flex',
  alignItems: hasItems ? 'flex-start' : 'center',
  justifyContent: hasItems ? 'flex-start' : 'center',
  flexWrap: 'wrap',
  gap: 6,
  textAlign: 'center',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
});

const thumbStyle = {
  position: 'relative',
  width: THUMB,
  height: THUMB,
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

const addMoreStyle = {
  flex: '0 0 auto',
  width: THUMB,
  height: THUMB,
  borderRadius: 4,
  border: '1px dashed #D9D9D9',
  background: '#fff',
  color: '#808080',
  fontSize: 20,
  lineHeight: 1,
  padding: 0,
  cursor: 'pointer',
};

const isVideoUrl = (url) => /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(String(url || ''));

const ReferencesSection = ({
  references = [],
  onAddFiles,
  onAddUrl,
  onRemove,
  uploading,
  acceptVideos = false,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const openPicker = () => {
    if (uploading) return;
    inputRef.current?.click();
  };

  const matcher = acceptVideos
    ? (f) => /^image\/|^video\//.test(f.type)
    : (f) => /^image\//.test(f.type);

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (uploading) return;
    const files = Array.from(e.dataTransfer.files || []).filter(matcher);
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
    const files = Array.from(e.target.files || []).filter(matcher);
    if (files.length) onAddFiles?.(files);
    e.target.value = '';
  };

  const hasItems = references.length > 0;

  return (
    <>
      <SectionHeader icon="icons/Picture.svg" label="References" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
        <FieldLabel>{acceptVideos ? 'REFERENCE FRAMES' : 'REFERENCE IMAGES'}</FieldLabel>
        <div
          style={dropZoneStyle(dragActive, uploading, hasItems)}
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
          onClick={hasItems ? undefined : openPicker}
        >
          {uploading && !hasItems ? (
            'Uploading…'
          ) : !hasItems ? (
            acceptVideos ? 'Drop images or videos' : 'Drop images or upload'
          ) : (
            <>
              {references.map((url) => (
                <div key={url} style={thumbStyle}>
                  {isVideoUrl(url) ? (
                    <video
                      src={url}
                      muted
                      playsInline
                      preload="metadata"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <img
                      src={url}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )}
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
            accept={acceptVideos ? 'image/*,video/*' : 'image/*'}
            multiple
            style={{ display: 'none' }}
            onChange={handlePick}
          />
        </div>
      </div>
    </>
  );
};

export default ReferencesSection;
