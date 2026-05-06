import React, { useEffect } from 'react';
import StyleSection from '../sidebars/StyleSection';
import ReferencesSection from '../sidebars/ReferencesSection';
import DurationSection from '../sidebars/DurationSection';
import CaptionSection from '../sidebars/CaptionSection';
import CaptionStrokeSection from '../sidebars/CaptionStrokeSection';
import ExportClipSection from '../sidebars/ExportClipSection';
import Divider from '../shared/Divider';
import { color, font, radius, space } from '../../../lib/tokens';

/**
 * Bottom-sheet drawer that holds everything that lived in the desktop
 * sidebars. Reuses the same section components verbatim — they're just
 * stacked vertically in a swipe-to-close sheet.
 */
const MobileSettingsSheet = ({
  open,
  onClose,
  styleProps,
  referencesProps,
  durationProps,
  captionProps,
  strokeProps,
  exportProps,
  isVideoFrame,
  hasScene,
}) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: color.overlay,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxHeight: '85vh',
          background: color.bg,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: font.family,
          animation: 'mobileSheetSlideUp 220ms ease-out',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: `${space[2]}px 0`,
            position: 'relative',
            borderBottom: `1px solid ${color.border}`,
          }}
        >
          <div
            aria-hidden
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: color.borderStrong,
              position: 'absolute',
              top: 6,
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          />
          <div
            style={{
              fontSize: font.size.md,
              fontWeight: font.weight.medium,
              color: color.text,
              padding: `${space[2]}px 0 ${space[1]}px`,
            }}
          >
            Scene settings
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute',
              right: space[3],
              top: '50%',
              transform: 'translateY(-50%)',
              border: 'none',
              background: 'transparent',
              fontSize: 18,
              color: color.textMuted,
              cursor: 'pointer',
              padding: 6,
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            overflowY: 'auto',
            padding: `${space[4]}px 0 calc(${space[6]}px + var(--safe-bottom, 0px))`,
            display: 'flex',
            flexDirection: 'column',
            gap: space[4],
          }}
        >
          {styleProps ? (
            <>
              <StyleSection {...styleProps} />
              <Divider />
            </>
          ) : null}
          {referencesProps ? (
            <>
              <ReferencesSection {...referencesProps} />
              <Divider />
            </>
          ) : null}
          {durationProps && hasScene ? (
            <>
              <DurationSection {...durationProps} />
              <Divider />
            </>
          ) : null}
          {captionProps && !isVideoFrame ? (
            <>
              <CaptionSection {...captionProps} />
            </>
          ) : null}
          {strokeProps && !isVideoFrame ? (
            <>
              <CaptionStrokeSection {...strokeProps} />
              <Divider />
            </>
          ) : null}
          {exportProps && hasScene ? (
            <ExportClipSection {...exportProps} />
          ) : null}
        </div>
      </div>
      <style>
        {`@keyframes mobileSheetSlideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }`}
      </style>
    </div>
  );
};

export default MobileSettingsSheet;
