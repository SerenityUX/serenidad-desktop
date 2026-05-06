import React from 'react';
import Skeleton, { SkeletonCircle, SkeletonText } from '../../ui/Skeleton';
import { APP_FONT_STACK } from '../../../lib/fonts';

const MAX_W = 760;

/**
 * Loading skeleton for ChatView. Matches the real layout: scrollable message
 * list with avatar + name + body rows, plus a fixed composer at the bottom.
 */
const SkeletonMessageRow = ({ widths, showDivider }) => (
  <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
    <div
      style={{
        width: '100%',
        maxWidth: MAX_W,
        display: 'flex',
        gap: 12,
        padding: '18px 20px',
        alignItems: 'flex-start',
        borderBottom: showDivider ? '1px solid #EEE' : 'none',
      }}
    >
      <div style={{ marginTop: 2 }}>
        <SkeletonCircle size={28} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SkeletonText width={84} size={13} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {widths.map((w, i) => (
            <SkeletonText key={i} width={w} size={14} />
          ))}
        </div>
      </div>
    </div>
  </div>
);

const ChatViewSkeleton = () => (
  <div
    style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#fff',
      fontFamily: APP_FONT_STACK,
    }}
    aria-busy="true"
    aria-label="Loading chat"
  >
    <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: MAX_W, borderBottom: '1px solid #EEE' }} />
      </div>
      <SkeletonMessageRow widths={['92%', '78%']} showDivider />
      <SkeletonMessageRow widths={['68%']} showDivider />
      <SkeletonMessageRow widths={['88%', '94%', '54%']} showDivider />
      <SkeletonMessageRow widths={['72%']} showDivider={false} />
    </div>

    <div
      style={{
        padding: '12px 20px 16px',
        background: '#fff',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: MAX_W,
          display: 'flex',
          alignItems: 'flex-end',
          gap: 6,
          background: '#fff',
          border: '1px solid #D9D9D9',
          borderRadius: 12,
          padding: 8,
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        <Skeleton width={30} height={30} radius={8} />
        <div style={{ flex: 1, padding: '6px 6px' }}>
          <SkeletonText width="40%" size={14} />
        </div>
        <Skeleton width={68} height={30} radius={8} />
      </div>
    </div>
  </div>
);

export default ChatViewSkeleton;
