import React, { useState } from 'react';
import ProfileAvatarMenu from '../ProfileAvatarMenu';
import TokensPill from '../TokensPill';
import TokensModal from '../TokensModal';
import { useAuth } from '../../context/AuthContext';

const HEADER_RAIL_WIDTH_PX = 140;

const LauncherLoadingSkeleton = () => {
  const { user } = useAuth();
  const [tokensOpen, setTokensOpen] = useState(false);

  return (
    <div style={{ minHeight: 'calc(100vh - var(--app-top-offset, 0px))', background: '#FFFFFF' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `${HEADER_RAIL_WIDTH_PX}px 1fr ${HEADER_RAIL_WIDTH_PX}px`,
          alignItems: 'center',
          columnGap: 12,
          padding: 16,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: HEADER_RAIL_WIDTH_PX,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: 8,
          }}
        >
          {user ? <ProfileAvatarMenu user={user} size={24} /> : null}
          {user ? (
            <TokensPill tokens={user.tokens ?? 0} onClick={() => setTokensOpen(true)} />
          ) : null}
        </div>
        <p
          style={{
            fontSize: 24,
            margin: 0,
            textAlign: 'center',
            justifySelf: 'stretch',
          }}
        >
          Kōdan Anime Studio
        </p>
        <div style={{ width: HEADER_RAIL_WIDTH_PX }} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          columnGap: 16,
          rowGap: 16,
          paddingLeft: 16,
          paddingRight: 16,
          boxSizing: 'border-box',
        }}
      >
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <div
              style={{
                width: '100%',
                aspectRatio: '16 / 9',
                backgroundColor: '#F2F2F2',
              }}
            />
          </div>
        ))}
      </div>

      <TokensModal open={tokensOpen} onClose={() => setTokensOpen(false)} />
    </div>
  );
};

export default LauncherLoadingSkeleton;
