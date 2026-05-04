import React from 'react';

const formatTokens = (n) => {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  if (v >= 10000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return v.toLocaleString();
};

const TokensPill = ({ tokens, onClick, size = 'md' }) => {
  const heightPx = size === 'sm' ? 22 : 24;
  return (
    <button
      type="button"
      onClick={onClick}
      title="Tokens"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: heightPx,
        padding: '0 10px',
        border: '1px solid #E2E2E2',
        borderRadius: heightPx / 2,
        background: '#FAFAFA',
        color: '#1F2937',
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        WebkitAppRegion: 'no-drag',
        lineHeight: 1,
      }}
    >
      <span
        aria-hidden
        style={{
          color: '#1F93FF',
          fontSize: 13,
          lineHeight: 1,
        }}
      >
        ✦
      </span>
      <span>{formatTokens(tokens)}</span>
    </button>
  );
};

export default TokensPill;
