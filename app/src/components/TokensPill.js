import React from 'react';
import { color, font, radius } from '../lib/tokens';

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
      className="row-hover"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: heightPx,
        padding: '0 10px',
        border: `1px solid ${color.border}`,
        borderRadius: radius.pill,
        background: color.bg,
        color: color.text,
        fontSize: font.size.sm,
        fontWeight: font.weight.medium,
        cursor: 'pointer',
        fontFamily: 'inherit',
        WebkitAppRegion: 'no-drag',
        lineHeight: 1,
      }}
    >
      <span aria-hidden style={{ color: color.textAccent, fontSize: font.size.md, lineHeight: 1 }}>
        ✻
      </span>
      <span>{formatTokens(tokens)}</span>
    </button>
  );
};

export default TokensPill;
