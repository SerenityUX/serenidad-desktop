import React from 'react';
import { color as tokenColor } from '../../lib/tokens';

/**
 * Recolorable icon. Uses CSS mask-image so the source asset (SVG or PNG)
 * acts as a stencil over a colored block — the icon takes on whatever
 * `color` you pass (defaults to `currentColor`), regardless of the fill
 * baked into the source SVG. Works equally well for our own
 * /public/icons SVGs and PNG sheets like SF Symbols.
 *
 * Usage:
 *   <Icon src={asset('icons/Picture.svg')} size={14} color={tokenColor.textMuted} />
 *   <Icon src="/icons/chevron-down.svg" /> // inherits currentColor
 */
const Icon = ({
  src,
  size = 14,
  color = 'currentColor',
  style,
  title,
  ...rest
}) => (
  <span
    role={title ? 'img' : 'presentation'}
    aria-label={title}
    aria-hidden={title ? undefined : true}
    style={{
      display: 'inline-block',
      flex: '0 0 auto',
      width: size,
      height: size,
      backgroundColor: color === 'currentColor' ? 'currentColor' : color,
      WebkitMaskImage: `url(${src})`,
      maskImage: `url(${src})`,
      WebkitMaskSize: 'contain',
      maskSize: 'contain',
      WebkitMaskRepeat: 'no-repeat',
      maskRepeat: 'no-repeat',
      WebkitMaskPosition: 'center',
      maskPosition: 'center',
      ...style,
    }}
    {...rest}
  />
);

// Re-export the token bag in case callers want to tint to a token without
// importing tokens.js separately.
Icon.color = tokenColor;

export default Icon;
