import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import platform from '../../../platform';
import ProfileAvatarMenu from '../../ProfileAvatarMenu';
import TokensPill from '../../TokensPill';
import TokensModal from '../../TokensModal';
import VoiceIndicator from '../../voice/VoiceIndicator';
import Icon from '../../ui/Icon';
import { asset } from '../../../lib/asset';
import { color, font, radius, space } from '../../../lib/tokens';

const VIEW_LABELS = {
  storyboard: 'Storyboard',
  chat: 'Chat',
  characters: 'Characters',
};

/**
 * Compact top bar for the mobile editor. No traffic lights (PWA / web
 * only on phones), no oversized "Export" button — just the essentials
 * stacked into a single 44px row.
 */
const MobileTitleBar = ({
  projectName,
  view,
  onViewChange,
  voice,
  onOpenSettings,
  onShare,
  showShare,
  onExport,
}) => {
  const { user } = useAuth();
  const [tokensOpen, setTokensOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const navigate = useNavigate();
  const voiceActive = !!voice?.active;

  return (
    <>
      <div
        style={{
          width: '100%',
          height: 'calc(44px + var(--safe-top, 0px))',
          paddingTop: 'var(--safe-top, 0px)',
          paddingLeft: `calc(${space[2]}px + var(--safe-left, 0px))`,
          paddingRight: `calc(${space[2]}px + var(--safe-right, 0px))`,
          backgroundColor: color.bg,
          borderBottom: `1px solid ${color.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
          fontFamily: font.family,
          flexShrink: 0,
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/home')}
          aria-label="Back to home"
          style={{
            width: 32,
            height: 32,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            borderRadius: radius.md,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: color.textMuted,
            flexShrink: 0,
          }}
        >
          <Icon src={asset('icons/home.svg')} size={20} />
        </button>

        <button
          type="button"
          onClick={() => setViewOpen((v) => !v)}
          style={{
            background: 'transparent',
            border: 'none',
            padding: `0 ${space[2]}px`,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            color: color.text,
            fontFamily: 'inherit',
            fontSize: font.size.md,
            fontWeight: font.weight.medium,
            cursor: 'pointer',
            maxWidth: '50vw',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            flex: 1,
            justifyContent: 'center',
          }}
        >
          {voiceActive ? (
            <VoiceIndicator
              mode={voice?.mode}
              levels={voice?.levels}
              expanded
            />
          ) : (
            <>
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {projectName || 'CoCreate'}
              </span>
              <span style={{ color: color.textFaint }}>/</span>
              <span style={{ color: color.textMuted }}>
                {VIEW_LABELS[view] || 'Storyboard'}
              </span>
              <Icon
                src={asset('icons/chevron-down.svg')}
                size={11}
                color={color.textFaint}
              />
            </>
          )}
        </button>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}
        >
          {user ? (
            <TokensPill
              tokens={user.tokens ?? 0}
              size="sm"
              onClick={() => setTokensOpen(true)}
            />
          ) : null}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-label="More"
            style={{
              width: 32,
              height: 32,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              borderRadius: radius.md,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: color.textMuted,
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1, fontWeight: 700 }}>
              ⋯
            </span>
          </button>
        </div>

        {viewOpen ? (
          <div
            onClick={() => setViewOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 70,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: 'calc(48px + var(--safe-top, 0px))',
                left: '50%',
                transform: 'translateX(-50%)',
                background: color.bg,
                border: `1px solid ${color.border}`,
                borderRadius: radius.lg,
                minWidth: 180,
                padding: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                boxShadow: '0 12px 30px rgba(0,0,0,0.12)',
              }}
            >
              {Object.entries(VIEW_LABELS).map(([key, lbl]) => {
                const selected = view === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setViewOpen(false);
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
                      fontWeight: selected
                        ? font.weight.medium
                        : font.weight.regular,
                      cursor: 'pointer',
                    }}
                  >
                    {lbl}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {moreOpen ? (
          <div
            onClick={() => setMoreOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 70,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: 'calc(48px + var(--safe-top, 0px))',
                right: 8,
                background: color.bg,
                border: `1px solid ${color.border}`,
                borderRadius: radius.lg,
                minWidth: 180,
                padding: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                boxShadow: '0 12px 30px rgba(0,0,0,0.12)',
              }}
            >
              <div
                style={{
                  padding: `${space[2]}px ${space[3]}px`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderBottom: `1px solid ${color.border}`,
                  marginBottom: 2,
                }}
              >
                <ProfileAvatarMenu user={user} size={24} />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: font.size.sm,
                      fontWeight: font.weight.medium,
                      color: color.text,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {user?.name || 'You'}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: color.textMuted,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {user?.email || ''}
                  </div>
                </div>
              </div>
              {onOpenSettings ? (
                <MobileMenuItem
                  label="Scene settings"
                  onClick={() => {
                    setMoreOpen(false);
                    onOpenSettings();
                  }}
                />
              ) : null}
              {showShare ? (
                <MobileMenuItem
                  label="Share"
                  onClick={() => {
                    setMoreOpen(false);
                    onShare?.();
                  }}
                />
              ) : null}
              {onExport ? (
                <MobileMenuItem
                  label="Export"
                  onClick={() => {
                    setMoreOpen(false);
                    onExport();
                  }}
                />
              ) : null}
              <MobileMenuItem
                label="Tokens & billing"
                onClick={() => {
                  setMoreOpen(false);
                  setTokensOpen(true);
                }}
              />
              <MobileMenuItem
                label="Sign out"
                onClick={() => {
                  setMoreOpen(false);
                  // ProfileAvatarMenu owns its own dropdown — re-using
                  // its sign-out path via a ghost click would be brittle,
                  // so route through platform-window-close on Electron
                  // and a hard reload on web.
                  try {
                    localStorage.removeItem('serenidad_auth_token');
                    localStorage.removeItem('serenidad_auth_user');
                  } catch {
                    /* ignore */
                  }
                  if (platform.isElectron) {
                    navigate('/home');
                    window.location.reload();
                  } else {
                    window.location.assign('/');
                  }
                }}
                danger
              />
            </div>
          </div>
        ) : null}
      </div>

      <TokensModal open={tokensOpen} onClose={() => setTokensOpen(false)} />
    </>
  );
};

const MobileMenuItem = ({ label, onClick, danger }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'block',
      width: '100%',
      textAlign: 'left',
      padding: `${space[2]}px ${space[3]}px`,
      background: 'transparent',
      color: danger ? color.textDanger : color.text,
      border: 'none',
      borderRadius: radius.md,
      fontFamily: 'inherit',
      fontSize: font.size.md,
      fontWeight: font.weight.regular,
      cursor: 'pointer',
    }}
  >
    {label}
  </button>
);

export default MobileTitleBar;
