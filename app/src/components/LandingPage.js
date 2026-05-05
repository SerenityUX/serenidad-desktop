import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

const DISK_BOTTOM_OFFSET = 24;
const WHEEL_DISTANCE = 800;
const INTAKE_RATIO = 1.0;
const INTAKE_SPEED_PX_PER_MS = 0.225;
const INTAKE_HOLD_MS = 500;

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

const LandingPage = () => {
  const containerRef = useRef(null);
  const diskRef = useRef(null);
  const readerRef = useRef(null);
  const progressRef = useRef(0);
  const intakeRef = useRef(0);
  const phaseRef = useRef('scroll');
  const rafRef = useRef(0);
  const [expanded, setExpanded] = useState(false);
  const noiseRef = useRef(null);
  const cursorRef = useRef({ x: 0, y: 0, active: false });
  const tellRectRef = useRef(null);

  useEffect(() => {
    if (!expanded) return;
    const canvas = noiseRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    const mask = document.createElement('canvas');
    mask.width = W;
    mask.height = H;
    const mctx = mask.getContext('2d');
    mctx.fillStyle = '#fff';
    mctx.textAlign = 'center';
    mctx.textBaseline = 'middle';

    const titleFontPx = Math.round(H * 0.11);
    const ctaFontPx = Math.round(H * 0.07);
    const titleY = H / 2 - H * 0.08;
    const ctaY = H / 2 + H * 0.10;

    mctx.font = `700 ${titleFontPx}px -apple-system, system-ui, sans-serif`;
    mctx.fillText('FIGHT THROUGH THE NOISE', W / 2, titleY);
    mctx.font = `600 ${ctaFontPx}px -apple-system, system-ui, sans-serif`;
    const ctaText = 'TELL YOUR STORY';
    mctx.fillText(ctaText, W / 2, ctaY);

    const ctaWidth = mctx.measureText(ctaText).width;
    tellRectRef.current = {
      x0: (W - ctaWidth) / 2 - 8,
      x1: (W + ctaWidth) / 2 + 8,
      y0: ctaY - ctaFontPx * 0.7,
      y1: ctaY + ctaFontPx * 0.7,
    };

    const maskRGBA = mctx.getImageData(0, 0, W, H).data;
    const maskAlpha = new Uint8Array(W * H);
    for (let i = 0; i < maskAlpha.length; i++) {
      maskAlpha[i] = maskRGBA[i * 4 + 3];
    }

    const radius = Math.round(Math.min(W, H) * 0.18);
    const r2 = radius * radius;

    let frame = 0;
    const draw = () => {
      const img = ctx.createImageData(W, H);
      const data = img.data;
      const cursor = cursorRef.current;
      const cx = cursor.x;
      const cy = cursor.y;
      const active = cursor.active;

      let i = 0;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const n = (Math.random() * 255) | 0;
          const a = maskAlpha[y * W + x];

          let reveal = 0;
          if (active) {
            const dx = x - cx;
            const dy = y - cy;
            const d2 = dx * dx + dy * dy;
            if (d2 < r2) {
              const t = 1 - d2 / r2;
              reveal = t * t;
            }
          }

          let r;
          let g;
          let b;
          if (a > 0) {
            const aNorm = a / 255;
            const biased = Math.min(255, n + 28 * aNorm);
            r = biased * (1 - reveal) + 255 * reveal;
            g = biased * (1 - reveal) + 224 * reveal;
            b = biased * (1 - reveal) + 0 * reveal;
          } else {
            const v = n * (1 - reveal * 0.85);
            r = v;
            g = v;
            b = v;
          }

          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = 255;
          i += 4;
        }
      }
      ctx.putImageData(img, 0, 0);
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [expanded]);

  const updateCursor = (clientX, clientY) => {
    const canvas = noiseRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    cursorRef.current = {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
      active: true,
    };
  };
  const clearCursor = () => {
    cursorRef.current = { x: 0, y: 0, active: false };
  };
  const goHome = () => {
    window.location.href = '/home';
  };

  useLayoutEffect(() => {
    const containerEl = containerRef.current;
    const diskEl = diskRef.current;
    const readerEl = readerRef.current;
    if (!containerEl || !diskEl || !readerEl) return;

    const apply = () => {
      const p1 = progressRef.current;
      const p2 = intakeRef.current;

      const travel = Math.max(
        0,
        containerEl.clientHeight - diskEl.clientHeight - DISK_BOTTOM_OFFSET,
      );
      const intake = containerEl.clientHeight * INTAKE_RATIO * p2;

      const y = travel * p1 + intake;
      const scale = 0.35 + (1 - 0.35) * p1;
      const rotate = -180 * (1 - p1);

      diskEl.style.transform =
        `translate(-50%, ${y}px) rotate(${rotate}deg) scale(${scale})`;
      readerEl.style.transform = `translateY(${intake}px)`;
    };

    const startIntake = () => {
      if (phaseRef.current !== 'scroll') return;
      phaseRef.current = 'intake';
      const start = performance.now();
      const distance = containerEl.clientHeight * INTAKE_RATIO;
      const duration = Math.max(400, distance / INTAKE_SPEED_PX_PER_MS);
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        intakeRef.current = easeInOut(t);
        apply();
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          phaseRef.current = 'hold';
          setTimeout(() => {
            phaseRef.current = 'done';
            setExpanded(true);
          }, INTAKE_HOLD_MS);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    const advance = (deltaPx) => {
      if (phaseRef.current !== 'scroll') return;
      const next = Math.max(
        0,
        Math.min(1, progressRef.current + deltaPx / WHEEL_DISTANCE),
      );
      if (next === progressRef.current) return;
      progressRef.current = next;
      apply();
      if (next >= 1) startIntake();
    };

    const onWheel = (e) => {
      e.preventDefault();
      advance(e.deltaY);
    };

    let touchY = null;
    const onTouchStart = (e) => {
      touchY = e.touches[0].clientY;
    };
    const onTouchMove = (e) => {
      if (touchY == null) return;
      const y = e.touches[0].clientY;
      const dy = touchY - y;
      touchY = y;
      e.preventDefault();
      advance(dy);
    };
    const onTouchEnd = () => {
      touchY = null;
    };

    apply();
    const prevOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('resize', apply);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      document.body.style.overflow = prevOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('resize', apply);
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#000',
        color: '#fff',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          width: '100%',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            maxWidth: 1422,
            margin: '0 auto',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 600 }}>Co-Create</div>
          <div style={{ display: 'flex', gap: 20, fontSize: 16 }}>
            <span
              style={{ cursor: 'pointer' }}
              onClick={() => {
                window.location.href = '/signup';
              }}
            >
              Signup
            </span>
            <span
              style={{ cursor: 'pointer' }}
              onClick={() => {
                window.location.href = '/login';
              }}
            >
              Login
            </span>
          </div>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          boxSizing: 'border-box',
          minHeight: 0,
        }}
      >
        <div
          ref={containerRef}
          style={{
            position: 'relative',
            width: expanded ? 'min(1422px, 100%)' : 'min(400px, 100%)',
            height: 'min(800px, 100%)',
            backgroundColor: '#fff',
            overflow: 'hidden',
            transition: 'width 600ms ease',
          }}
        >
          <div
            ref={diskRef}
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              width: '78%',
              aspectRatio: '1 / 1',
              transform: 'translate(-50%, 0)',
              willChange: 'transform',
              zIndex: 2,
            }}
          >
            <img
              src="/diskCoCreate.png"
              alt="Co-Create disk"
              draggable={false}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block',
                pointerEvents: 'none',
              }}
            />
          </div>

          <div
            onMouseMove={(e) => updateCursor(e.clientX, e.clientY)}
            onMouseLeave={clearCursor}
            onTouchMove={(e) => {
              const t = e.touches[0];
              if (t) updateCursor(t.clientX, t.clientY);
            }}
            onTouchEnd={clearCursor}
            onClick={goHome}
            style={{
              position: 'absolute',
              inset: 0,
              opacity: expanded ? 1 : 0,
              transition: 'opacity 2200ms ease',
              pointerEvents: expanded ? 'auto' : 'none',
              zIndex: 3,
              cursor: 'pointer',
            }}
          >
            <canvas
              ref={noiseRef}
              width={480}
              height={270}
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                imageRendering: 'pixelated',
              }}
            />
          </div>

          <div
            ref={readerRef}
            style={{
              position: 'absolute',
              left: 0,
              bottom: 0,
              width: '100%',
              height: '50%',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              willChange: 'transform',
            }}
          >
            <img
              src="/diskReader.svg"
              alt="Disk reader"
              draggable={false}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                transform: 'scaleY(-1)',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default LandingPage;
