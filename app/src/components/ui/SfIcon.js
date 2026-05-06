import React from 'react';

/**
 * SF Symbols-styled monoline icon set. Paths inspired by the open mirror at
 * github.com/andrewtavis/sf-symbols-online — re-drawn at 24×24 with a single
 * stroke weight so they read clearly at small sizes (12–18px) inside chat
 * pills. Stroke uses currentColor so callers can recolor by setting `color`.
 *
 * Usage: <SfIcon name="pencil" size={14} />
 */

const VIEW = 24;

const PATHS = {
  // list.bullet
  list: (
    <>
      <circle cx="4.5" cy="6.5" r="1" />
      <circle cx="4.5" cy="12" r="1" />
      <circle cx="4.5" cy="17.5" r="1" />
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
    </>
  ),
  // person.crop.circle
  person: (
    <>
      <circle cx="12" cy="9.5" r="3.2" />
      <path d="M5 19.5c1.5-3 4-4.5 7-4.5s5.5 1.5 7 4.5" />
    </>
  ),
  // photo
  photo: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.4" />
      <path d="M4 17l4.5-4.5 3.5 3.5 3.5-4 4.5 5" />
    </>
  ),
  // pencil
  pencil: (
    <>
      <path d="M4 20l1-4 11-11 3 3-11 11-4 1z" />
      <path d="M14 7l3 3" />
    </>
  ),
  // link (chain)
  link: (
    <>
      <path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 1 0-5-5l-1 1" />
      <path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 1 0 5 5l1-1" />
    </>
  ),
  // plus.rectangle
  plusRectangle: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="M12 9v6M9 12h6" />
    </>
  ),
  // trash
  trash: (
    <>
      <path d="M5 7h14" />
      <path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2" />
      <path d="M6.5 7l1 12a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-12" />
      <path d="M10.5 11v6M13.5 11v6" />
    </>
  ),
  // tag
  tag: (
    <>
      <path d="M12.5 3.5h6a2 2 0 0 1 2 2v6L11 21l-9-9 10.5-8.5z" />
      <circle cx="16" cy="8" r="1.2" />
    </>
  ),
  // sparkles
  sparkles: (
    <>
      <path d="M12 4l1.4 3.6L17 9l-3.6 1.4L12 14l-1.4-3.6L7 9l3.6-1.4L12 4z" />
      <path d="M18.5 14l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" />
      <path d="M5.5 14l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8L3 16.5l1.8-.7L5.5 14z" />
    </>
  ),
  // arrow.up.right (used for "tap to open" affordance)
  arrowUpRight: (
    <>
      <path d="M7 17L17 7" />
      <path d="M9 7h8v8" />
    </>
  ),
  // checkmark
  checkmark: <path d="M5 12.5l4 4 10-10" />,
  // xmark
  xmark: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  // exclamationmark.triangle
  warning: (
    <>
      <path d="M12 4L2.5 20h19L12 4z" />
      <path d="M12 10v4M12 17v.5" />
    </>
  ),
};

const SfIcon = ({ name, size = 14, strokeWidth = 1.6, style, ...rest }) => {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, display: 'block', ...style }}
      aria-hidden="true"
      {...rest}
    >
      {path}
    </svg>
  );
};

export default SfIcon;
