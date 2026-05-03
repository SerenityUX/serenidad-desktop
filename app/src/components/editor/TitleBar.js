import React, { useEffect, useState } from 'react';
import ProfileAvatarMenu from '../ProfileAvatarMenu';
import VoiceIndicator from '../voice/VoiceIndicator';
import { useAuth } from '../../context/AuthContext';

const TrafficLight = ({ color, action }) => (
  <div
    onClick={() => window.electron.ipcRenderer.invoke(action)}
    style={{
      backgroundColor: color,
      width: 14,
      height: 14,
      borderRadius: 7,
      cursor: 'pointer',
      WebkitAppRegion: 'no-drag',
    }}
  />
);

const EXIT_ANIM_MS = 280;

const CenterSlot = ({ voice, projectName }) => {
  const active = !!voice?.active;
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (active) {
      setMounted(true);
      // Two RAFs so the initial circle paints before transitioning to pill.
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setExpanded(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        if (raf2) cancelAnimationFrame(raf2);
      };
    }
    if (mounted) {
      setExpanded(false);
      const t = setTimeout(() => setMounted(false), EXIT_ANIM_MS);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [active, mounted]);

  if (mounted) {
    return (
      <VoiceIndicator
        mode={voice?.mode}
        levels={voice?.levels}
        expanded={expanded}
      />
    );
  }
  return (
    <p
      style={{
        fontWeight: 500,
        margin: 0,
        WebkitAppRegion: 'drag',
        maxWidth: '50vw',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {projectName && projectName.trim() ? projectName : 'Kōdan'}
    </p>
  );
};

const TitleBar = ({ onExport, onShare, showExport = true, showShare = false, voice, projectName }) => {
  const { user } = useAuth();
  return (
  <div style={{
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 45,
    backgroundColor: '#fff',
    borderBottom: '1px solid #D9D9D9',
    WebkitAppRegion: 'drag',
  }}>
    <div style={{ marginLeft: 12, display: 'flex', flexDirection: 'row', gap: 9 }}>
      <TrafficLight color="#FE5F58" action="close-app" />
      <TrafficLight color="#FEBC2F" action="minimize-app" />
      <TrafficLight color="#28C840" action="maximize-app" />
    </div>

    <CenterSlot voice={voice} projectName={projectName} />

    <div style={{ display: 'flex', gap: 8, marginRight: 12, alignItems: 'center', WebkitAppRegion: 'no-drag' }}>
      {showShare && (
        <button
          onClick={onShare}
          style={{
            backgroundColor: '#fff',
            color: '#1F93FF',
            paddingLeft: 8,
            paddingRight: 8,
            border: '1px solid #1F93FF',
            borderRadius: 4,
            paddingTop: 4,
            paddingBottom: 4,
            cursor: 'pointer',
            WebkitAppRegion: 'no-drag',
          }}
        >
          Share
        </button>
      )}
      {showExport && (
        <button
          onClick={onExport}
          style={{
            backgroundColor: '#1F93FF',
            color: '#fff',
            paddingLeft: 8,
            paddingRight: 8,
            border: '0px',
            borderRadius: 4,
            paddingTop: 4,
            paddingBottom: 4,
            WebkitAppRegion: 'no-drag',
          }}
        >
          Export
        </button>
      )}
      {user ? <ProfileAvatarMenu user={user} size={24} align="right" /> : null}
    </div>
  </div>
  );
};

export default TitleBar;
