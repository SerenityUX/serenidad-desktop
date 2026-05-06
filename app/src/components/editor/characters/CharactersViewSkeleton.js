import React from 'react';
import Skeleton, { SkeletonText } from '../../ui/Skeleton';
import { APP_FONT_STACK } from '../../../lib/fonts';

/**
 * Loading skeleton for CharactersView. Mirrors the real layout: scrollable
 * surface with a header (title + action button) and a responsive grid of
 * card placeholders matching CharacterCard's 63/88 aspect ratio.
 */
const SkeletonCharacterCard = () => (
  <div
    style={{
      aspectRatio: '63/88',
      borderRadius: 10,
      background: '#fff',
      border: '1px solid #E5E5E5',
      padding: 8,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    }}
  >
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 2px',
      }}
    >
      <SkeletonText width="60%" size={13} />
    </div>
    <Skeleton width="100%" height="auto" radius={6} style={{ aspectRatio: '1/1' }} />
    <div style={{ flex: 1, padding: '2px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <SkeletonText width="100%" size={11} />
      <SkeletonText width="85%" size={11} />
      <SkeletonText width="55%" size={11} />
    </div>
  </div>
);

const CharactersViewSkeleton = ({ count = 6 }) => (
  <div
    style={{
      width: '100%',
      height: '100%',
      overflowY: 'auto',
      background: '#FAFAFA',
      fontFamily: APP_FONT_STACK,
    }}
    aria-busy="true"
    aria-label="Loading characters"
  >
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 600 }}>Characters</div>
        <Skeleton width={130} height={32} radius={6} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 16,
        }}
      >
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCharacterCard key={i} />
        ))}
      </div>
    </div>
  </div>
);

export default CharactersViewSkeleton;
