/**
 * Design tokens. Inspired by Obsidian and GitHub Primer:
 * subtle borders + background contrast + typographic hierarchy
 * instead of dropshadows. Mirror values live as CSS variables in
 * `app/index.html` for use in stylesheets and pseudo-classes.
 */

import { APP_FONT_STACK } from './fonts';

export const color = {
  // Surfaces
  bg: '#ffffff',
  bgSubtle: '#f6f8fa',          // sidebars, page chrome
  bgMuted: '#eef1f4',           // hover background
  bgHover: 'rgba(0, 0, 0, 0.04)',
  bgActive: 'rgba(0, 0, 0, 0.06)',
  bgAccentSubtle: 'rgba(31, 147, 255, 0.10)',

  // Text
  text: '#1f2328',
  textMuted: '#656d76',
  textFaint: '#8b949e',
  textInverse: '#ffffff',
  textAccent: '#1F93FF',
  textDanger: '#cf222e',

  // Borders (no shadows — borders carry the structure)
  border: 'rgba(0, 0, 0, 0.08)',
  borderStrong: 'rgba(0, 0, 0, 0.14)',
  borderFocus: '#1F93FF',

  // Accent
  accent: '#1F93FF',
  accentHover: '#1880e0',
  accentActive: '#1370c9',

  // Modal / overlay
  overlay: 'rgba(15, 17, 21, 0.45)',

  // Dark surfaces (scenes strip etc.)
  surfaceDark: '#1f1f1f',
  surfaceDarker: '#141414',
  onDark: '#ffffff',
  onDarkMuted: 'rgba(255, 255, 255, 0.6)',
};

export const space = {
  0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40, 9: 48,
};

export const radius = {
  sm: 4, md: 6, lg: 8, xl: 12, pill: 999,
};

export const font = {
  family: APP_FONT_STACK,
  size: {
    xs: 11, sm: 12, md: 13, base: 14, lg: 16, xl: 20, '2xl': 24,
  },
  weight: { regular: 400, medium: 500, semibold: 600 },
  lineHeight: { tight: 1.25, base: 1.45 },
};

export const transition = {
  fast: '120ms ease',
  base: '180ms ease',
};
