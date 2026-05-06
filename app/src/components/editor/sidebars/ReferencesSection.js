import React, { useRef, useState } from 'react';
import SectionHeader from '../shared/SectionHeader';
import { asset } from '../../../lib/asset';
import { color, font, radius, space } from '../../../lib/tokens';

const THUMB = 48;
const MIN_HEIGHT = 64;

const dropZoneStyle = (active, disabled, hasItems) => ({
  width: '100%',
  boxSizing: 'border-box',
  border: `1px ${hasItems ? 'solid' : 'dashed'} ${active ? color.borderFocus : color.border}`,
  borderRadius: radius.md,
  backgroundColor: active ? color.bgAccentSubtle : color.bg,
  fontSize: font.size.md,
  color: color.textMuted,
  padding: hasItems ? space[2] : space[3],
  minHeight: MIN_HEIGHT,
  display: 'flex',
  alignItems: hasItems ? 'flex-start' : 'center',
  justifyContent: hasItems ? 'flex-start' : 'center',
  flexWrap: 'wrap',
  gap: space[1],
  textAlign: 'center',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
  transition: 'border-color 120ms ease, background-color 120ms ease',
});

const thumbStyle = {
  position: 'relative',
  width: THUMB,
  height: THUMB,
  flex: '0 0 auto',
  borderRadius: radius.sm,
  overflow: 'hidden',
  border: `1px solid ${color.border}`,
  backgroundColor: color.bgSubtle,
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

const addMoreStyle = {
  flex: '0 0 auto',
  width: THUMB,
  height: THUMB,
  borderRadius: radius.sm,
  border: `1px dashed ${color.border}`,
  background: color.bg,
  color: color.textMuted,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
      <SectionHeader icon={asset('icons/Picture.svg')} label="References" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}>
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
            acceptVideos ? 'Drop images or videos' : 'Drop images or click to upload'
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
    </div>
  );
};

export default ReferencesSection;
