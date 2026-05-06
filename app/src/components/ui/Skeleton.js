import React from 'react';
import { radius as radiusToken } from '../../lib/tokens';

/**
 * Neutral loading placeholder. The `.skeleton` class lives in index.html so the
 * shimmer animation is part of the design system and any element can opt in.
 * This component is the React entry point: use it directly for blocks, or use
 * SkeletonText / SkeletonCircle for the common variants.
 */
const Skeleton = ({
  width = '100%',
  height = 12,
  radius = radiusToken.md,
  style,
  className,
  ...rest
}) => (
  <div
    className={['skeleton', className].filter(Boolean).join(' ')}
    style={{
      width,
      height,
      borderRadius: radius,
      ...style,
    }}
    {...rest}
  />
);

export const SkeletonText = ({ width = '100%', size = 13, style, ...rest }) => (
  <Skeleton
    width={width}
    height={Math.round(size * 0.95)}
    radius={radiusToken.sm}
    style={{ display: 'inline-block', ...style }}
    {...rest}
  />
);

export const SkeletonCircle = ({ size = 28, style, ...rest }) => (
  <Skeleton
    width={size}
    height={size}
    radius={radiusToken.pill}
    style={{ flexShrink: 0, ...style }}
    {...rest}
  />
);

export default Skeleton;
