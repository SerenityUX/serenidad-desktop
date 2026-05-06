import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProfileAvatarMenu from '../ProfileAvatarMenu';
import TokensPill from '../TokensPill';
import TokensModal from '../TokensModal';
import VoiceIndicator from '../voice/VoiceIndicator';
import { useAuth } from '../../context/AuthContext';
import platform from '../../platform';
import { asset } from '../../lib/asset';
import { color, font, radius, space } from '../../lib/tokens';
import Icon from '../ui/Icon';

const BackButton = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Back to home"
    className="btn-ghost"
    style={{
      width: 24,
      height: 24,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
      borderRadius: radius.md,
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      color: color.textMuted,
      WebkitAppRegion: 'no-drag',
    }}
  >
    <Icon src={asset('icons/home.svg')} size={24} title="Home" />
  </button>
);

const TrafficLight = ({ color: dotColor, onClick }) => (
  <div
    onClick={onClick}
    style={{
      backgroundColor: dotColor,
      width: 12,
      height: 12,
      borderRadius: '50%',
      cursor: 'pointer',
      WebkitAppRegion: 'no-drag',
    }}
  />
);

const EXIT_ANIM_MS = 280;

const VIEW_LABELS = {
  storyboard: 'Storyboard',
  chat: 'Chat',
  characters: 'Characters',
};

const ViewSwitcher = ({ projectName, view, onViewChange }) => {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const label = VIEW_LABELS[view] || 'Storyboard';
  const name = projectName && projectName.trim() ? projectName : 'CoCreate';

  return (
    <div ref={ref} style={{ position: 'relative', WebkitAppRegion: 'no-drag' }}>
      <button
        type="button"
        className="btn-ghost"
        onClick={() => (onViewChange ? setOpen((o) => !o) : null)}
        style={{
          background: 'transparent',
          border: 'none',
          padding: `${space[1]}px ${space[2]}px`,
          borderRadius: radius.md,
          fontWeight: font.weight.medium,
          fontFamily: 'inherit',
          fontSize: font.size.md,
          cursor: onViewChange ? 'pointer' : 'default',
          color: color.text,
          maxWidth: '50vw',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          transition: 'background-color 120ms ease',
        }}
        onMouseEnter={(e) => { if (onViewChange) e.currentTarget.style.backgroundColor = color.bgHover; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <span>{name}</span>
        <span style={{ color: color.textFaint, margin: '0 6px' }}>/</span>
        <span style={{ color: color.textMuted }}>{label}</span>
        {onViewChange ? (
          <Icon
            src={asset('icons/chevron-down.svg')}
            size={11}
            color={color.textFaint}
            style={{ marginLeft: 6 }}
          />
        ) : null}
      </button>
      {open ? (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: color.bg,
            border: `1px solid ${color.border}`,
            borderRadius: radius.lg,
            minWidth: 160,
            zIndex: 100,
            overflow: 'hidden',
            padding: 4,
          }}
        >
          {Object.entries(VIEW_LABELS).map(([key, lbl]) => {
            const selected = view === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onViewChange?.(key);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: `${space[2]}px ${space[3]}px`,
                  background: selected ? color.bgAccentSubtle : 'transparent',
                  color: selected ? color.textAccent : color.text,
                  border: 'none',
                  borderRadius: radius.md,
                  fontFamily: 'inherit',
                  fontSize: font.size.md,
                  fontWeight: selected ? font.weight.medium : font.weight.regular,
                  cursor: 'pointer',
                  transition: 'background-color 120ms ease',
                }}
                onMouseEnter={(e) => { if (!selected) e.currentTarget.style.backgroundColor = color.bgHover; }}
                onMouseLeave={(e) => { if (!selected) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {lbl}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

const CenterSlot = ({ voice, projectName, view, onViewChange }) => {
  const active = !!voice?.active;
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (active) {
      setMounted(true);
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
    <ViewSwitcher
      projectName={projectName}
      view={view}
      onViewChange={onViewChange}
    />
  );
};

const TitleBar = ({ onExport, onShare, showExport = true, showShare = false, voice, projectName, view, onViewChange }) => {
  const { user } = useAuth();
  const [tokensOpen, setTokensOpen] = useState(false);
  const navigate = useNavigate();
  return (
  <>
  <div style={{
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    backgroundColor: color.bg,
    borderBottom: `1px solid ${color.border}`,
    fontFamily: font.family,
    WebkitAppRegion: 'drag',
  }}>
    {platform.capabilities.hasNativeChrome ? (
      <div style={{ marginLeft: 12, display: 'flex', flexDirection: 'row', gap: 8 }}>
        <TrafficLight color="#FE5F58" onClick={() => platform.window.close()} />
        <TrafficLight color="#FEBC2F" onClick={() => platform.window.minimize()} />
        <TrafficLight color="#28C840" onClick={() => platform.window.maximize()} />
      </div>
    ) : (
      <div style={{ marginLeft: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <BackButton onClick={() => navigate('/home')} />
        {user ? <ProfileAvatarMenu user={user} size={24} /> : null}
        {user ? (
          <TokensPill tokens={user.tokens ?? 0} onClick={() => setTokensOpen(true)} />
        ) : null}
      </div>
    )}

    <CenterSlot voice={voice} projectName={projectName} view={view} onViewChange={onViewChange} />

    <div style={{ display: 'flex', gap: 8, marginRight: 12, alignItems: 'center', WebkitAppRegion: 'no-drag' }}>
      {showShare && (
        <button
          type="button"
          className="btn btn-sm"
          onClick={onShare}
          style={{ WebkitAppRegion: 'no-drag' }}
        >
          Share
        </button>
      )}
      {showExport && (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={onExport}
          style={{ WebkitAppRegion: 'no-drag' }}
        >
          Export
        </button>
      )}
      {platform.capabilities.hasNativeChrome && user ? (
        <TokensPill tokens={user.tokens ?? 0} onClick={() => setTokensOpen(true)} />
      ) : null}
      {platform.capabilities.hasNativeChrome && user ? (
        <ProfileAvatarMenu user={user} size={24} align="right" />
      ) : null}
    </div>
  </div>
  <TokensModal open={tokensOpen} onClose={() => setTokensOpen(false)} />
  </>
  );
};

export default TitleBar;
