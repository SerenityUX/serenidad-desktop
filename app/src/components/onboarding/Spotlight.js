import React, { useEffect, useLayoutEffect, useState } from 'react';

/**
 * Highlights a target element with a soft cutout, anchors a callout
 * bubble next to it, and dims the rest of the screen. Pure UI: callers
 * decide when to show, what text, and how to advance.
 *
 * Targets are looked up by `[data-onboard="..."]` attribute so we don't
 * have to thread refs through every component.
 */
const PADDING = 8;
const RADIUS = 10;

const useTargetRect = (selector, active) => {
  const [rect, setRect] = useState(null);

  useLayoutEffect(() => {
    if (!active || !selector) {
      setRect(null);
      return undefined;
    }

    let cancelled = false;
    let lastKey = '';
    const measure = () => {
      if (cancelled) return;
      const el = document.querySelector(selector);
      if (!el) {
        if (lastKey !== '') {
          lastKey = '';
          setRect(null);
        }
      } else {
        const r = el.getBoundingClientRect();
        // Only push state when the rect actually changes — otherwise we
        // burn the page on a perpetual re-render loop.
        const key = `${r.top}|${r.left}|${r.width}|${r.height}`;
        if (key !== lastKey) {
          lastKey = key;
          setRect({
            top: r.top,
            left: r.left,
            width: r.width,
            height: r.height,
          });
        }
      }
    };
    measure();

    const onScrollOrResize = () => measure();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);

    // Catch transitions / DOM mutations that don't trigger scroll/resize
    // (modal opening, sidebar mounts, etc.) without polling every frame.
    const mo = new MutationObserver(() => measure());
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    return () => {
      cancelled = true;
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      mo.disconnect();
    };
  }, [selector, active]);

  return rect;
};

const palette = {
  bubble: '#1F93FF',
  bubbleText: '#fff',
  ring: 'rgba(31, 147, 255, 0.95)',
};

const Spotlight = ({
  active,
  selector,
  title,
  body,
  placement = 'right',
  ctaLabel,
  onCta,
  step,
  total,
  // When no target is provided, render a centered hero card (welcome screen).
  centered = false,
}) => {
  const rect = useTargetRect(selector, active && !centered);
  const [mounted, setMounted] = useState(active);

  useEffect(() => {
    if (active) setMounted(true);
  }, [active]);

  if (!mounted || !active) return null;

  // Centered hero card (no target).
  if (centered) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99998,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <div
          style={{
            width: 380,
            maxWidth: 'calc(100vw - 32px)',
            background: '#fff',
            borderRadius: 14,
            padding: 24,
            boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div
            aria-hidden
            style={{
              alignSelf: 'flex-start',
              fontSize: 28,
              color: '#4736C1',
              lineHeight: 1,
            }}
          >
            ✻
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111' }}>
            {title}
          </div>
          <div
            style={{
              fontSize: 14,
              color: '#4B5563',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}
          >
            {body}
          </div>
          {onCta ? (
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 8,
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={onCta}
                style={{
                  border: 'none',
                  background: palette.bubble,
                  color: palette.bubbleText,
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 8,
                  padding: '8px 16px',
                  cursor: 'pointer',
                }}
              >
                {ctaLabel || 'Start'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (!rect) return null;

  // Compute hole + bubble placement.
  const hole = {
    top: rect.top - PADDING,
    left: rect.left - PADDING,
    width: rect.width + PADDING * 2,
    height: rect.height + PADDING * 2,
  };

  const BUBBLE_W = 280;
  const GAP = 14;
  let bubbleStyle = {};
  if (placement === 'right') {
    bubbleStyle = {
      top: hole.top + hole.height / 2,
      left: hole.left + hole.width + GAP,
      transform: 'translateY(-50%)',
    };
  } else if (placement === 'left') {
    bubbleStyle = {
      top: hole.top + hole.height / 2,
      left: hole.left - GAP - BUBBLE_W,
      transform: 'translateY(-50%)',
    };
  } else if (placement === 'bottom') {
    bubbleStyle = {
      top: hole.top + hole.height + GAP,
      left: hole.left + hole.width / 2 - BUBBLE_W / 2,
    };
  } else if (placement === 'top') {
    bubbleStyle = {
      top: hole.top - GAP,
      left: hole.left + hole.width / 2 - BUBBLE_W / 2,
      transform: 'translateY(-100%)',
    };
  }

  // Keep bubble inside viewport.
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 720;
  const left = Math.max(
    12,
    Math.min(
      (typeof bubbleStyle.left === 'number' ? bubbleStyle.left : 12),
      vw - BUBBLE_W - 12,
    ),
  );
  bubbleStyle.left = left;
  if (typeof bubbleStyle.top === 'number') {
    bubbleStyle.top = Math.max(12, Math.min(bubbleStyle.top, vh - 12));
  }

  return (
    <>
      {/* Dim overlay with a transparent hole. SVG mask gives us a soft, rounded cutout. */}
      <svg
        width="100%"
        height="100%"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99997,
          pointerEvents: 'none',
        }}
      >
        <defs>
          <mask id="onboard-hole-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={hole.left}
              y={hole.top}
              width={hole.width}
              height={hole.height}
              rx={RADIUS}
              ry={RADIUS}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.55)"
          mask="url(#onboard-hole-mask)"
        />
        {/* Animated ring around the target */}
        <rect
          x={hole.left}
          y={hole.top}
          width={hole.width}
          height={hole.height}
          rx={RADIUS}
          ry={RADIUS}
          fill="none"
          stroke={palette.ring}
          strokeWidth="2.5"
        >
          <animate
            attributeName="stroke-opacity"
            values="0.95;0.4;0.95"
            dur="1.6s"
            repeatCount="indefinite"
          />
        </rect>
      </svg>

      {/* Callout bubble */}
      <div
        style={{
          position: 'fixed',
          width: BUBBLE_W,
          background: '#fff',
          borderRadius: 12,
          padding: 14,
          boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
          zIndex: 99999,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          ...bubbleStyle,
        }}
      >
        {typeof step === 'number' && typeof total === 'number' ? (
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.5,
              color: '#9CA3AF',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Step {step} of {total}
          </div>
        ) : null}
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: '#111',
            marginBottom: 6,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 13,
            color: '#4B5563',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
          }}
        >
          {body}
        </div>
        {onCta ? (
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 12,
              justifyContent: 'flex-end',
            }}
          >
            <button
              type="button"
              onClick={onCta}
              style={{
                border: 'none',
                background: palette.bubble,
                color: palette.bubbleText,
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 6,
                padding: '6px 12px',
                cursor: 'pointer',
              }}
            >
              {ctaLabel || 'Got it'}
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
};

export default Spotlight;
