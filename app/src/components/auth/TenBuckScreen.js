import React, { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { asset } from "../../lib/asset";

const TEXT = "#1A1A1A";
const TEXT_MUTED = "#5C5C5C";
const BORDER = "#E2E2E2";
const ACCENT = "#111";
const SLIDE_MS = 2600;

const inputStyle = {
  color: TEXT,
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  padding: "12px 14px",
  fontSize: 15,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  backgroundColor: "#fff",
  fontFamily: "inherit",
};

const buttonStyle = (disabled) => ({
  width: "100%",
  padding: "13px 16px",
  border: 0,
  borderRadius: 10,
  backgroundColor: disabled ? "#9F9F9F" : ACCENT,
  color: "#fff",
  cursor: disabled ? "not-allowed" : "pointer",
  fontSize: 15,
  fontWeight: 600,
  boxSizing: "border-box",
  transition: "background-color 120ms ease, transform 120ms ease",
  fontFamily: "inherit",
});

const linkButtonStyle = {
  background: "none",
  border: 0,
  padding: 0,
  color: TEXT_MUTED,
  fontSize: 13,
  cursor: "pointer",
  textDecoration: "underline",
  fontFamily: "inherit",
};

const OTP_LENGTH = 6;

const useIsNarrow = (px = 880) => {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < px : false,
  );
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onResize = () => setNarrow(window.innerWidth < px);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [px]);
  return narrow;
};

/**
 * Auto-advancing crossfade carousel through 1.png … 8.png. Pauses on
 * hover so users can linger on a frame they like. Pure CSS opacity
 * stacking — no animation libs.
 */
const AnimeCarousel = () => {
  const FRAMES = [1, 2, 3, 4, 5, 6, 7, 8];
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  // Touch-swipe state. We track the starting X + a "swiped" flag so a
  // gesture that crosses the threshold doesn't double-trigger and so a
  // tap (no movement) doesn't accidentally advance.
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const swipeFiredRef = useRef(false);

  const advance = (delta) => {
    setActive((i) => (i + delta + FRAMES.length) % FRAMES.length);
  };

  useEffect(() => {
    if (paused) return undefined;
    const id = setInterval(() => {
      setActive((i) => (i + 1) % FRAMES.length);
    }, SLIDE_MS);
    return () => clearInterval(id);
    // FRAMES is constant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  const handleTouchStart = (e) => {
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
    swipeFiredRef.current = false;
    setPaused(true);
  };

  const handleTouchMove = (e) => {
    if (touchStartX.current == null || swipeFiredRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartX.current;
    const dy = t.clientY - touchStartY.current;
    // Only act on mostly-horizontal gestures so vertical scrolling isn't
    // hijacked. Threshold matches what most native carousels use.
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      advance(dx < 0 ? 1 : -1);
      swipeFiredRef.current = true;
    }
  };

  const handleTouchEnd = () => {
    touchStartX.current = null;
    touchStartY.current = null;
    // Resume auto-advance on a small delay so the user can take a beat
    // after a swipe before the next slide arrives.
    setTimeout(() => setPaused(false), 600);
  };

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      role="region"
      aria-roledescription="carousel"
      aria-label="Anime frame samples"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 360,
        borderRadius: 18,
        overflow: "hidden",
        backgroundColor: "#0E0E10",
        boxShadow:
          "0 30px 80px rgba(0,0,0,0.18), inset 0 0 0 1px rgba(255,255,255,0.06)",
        touchAction: "pan-y",
      }}
    >
      {FRAMES.map((n, i) => (
        <img
          key={n}
          src={asset(`${n}.png`)}
          alt=""
          draggable={false}
          decoding="async"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: i === active ? 1 : 0,
            transform: i === active ? "scale(1)" : "scale(1.04)",
            transition:
              "opacity 900ms ease-in-out, transform 4500ms linear",
            userSelect: "none",
            WebkitUserSelect: "none",
            pointerEvents: "none",
          }}
        />
      ))}

      {/* Subtle bottom gradient + dot indicators for "this is a real reel" feel. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 80,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 100%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 14,
          display: "flex",
          gap: 6,
          justifyContent: "center",
        }}
      >
        {FRAMES.map((n, i) => (
          <button
            key={n}
            type="button"
            onClick={() => setActive(i)}
            aria-label={`Show frame ${i + 1}`}
            style={{
              width: i === active ? 18 : 6,
              height: 6,
              borderRadius: 999,
              border: "none",
              padding: 0,
              backgroundColor:
                i === active ? "#fff" : "rgba(255,255,255,0.5)",
              cursor: "pointer",
              transition: "width 220ms ease, background-color 220ms ease",
            }}
          />
        ))}
      </div>
    </div>
  );
};

const OtpInput = ({ value, onChange, disabled, onComplete }) => {
  const inputsRef = useRef([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const setDigit = (i, d) => {
    const chars = value.split("");
    while (chars.length < OTP_LENGTH) chars.push("");
    chars[i] = d;
    const next = chars.join("").slice(0, OTP_LENGTH);
    onChange(next);
    return next;
  };

  const handleChange = (i, raw) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return setDigit(i, "");
    if (digits.length === 1) {
      const next = setDigit(i, digits);
      if (i < OTP_LENGTH - 1) inputsRef.current[i + 1]?.focus();
      if (next.length === OTP_LENGTH && !next.includes("")) onComplete?.(next);
      return next;
    }
    const chars = value.split("");
    while (chars.length < OTP_LENGTH) chars.push("");
    let cursor = i;
    for (const ch of digits) {
      if (cursor >= OTP_LENGTH) break;
      chars[cursor] = ch;
      cursor += 1;
    }
    const next = chars.join("").slice(0, OTP_LENGTH);
    onChange(next);
    inputsRef.current[Math.min(cursor, OTP_LENGTH - 1)]?.focus();
    if (next.length === OTP_LENGTH && !next.includes("")) onComplete?.(next);
    return next;
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      if (value[i]) setDigit(i, "");
      else if (i > 0) {
        setDigit(i - 1, "");
        inputsRef.current[i - 1]?.focus();
      }
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && i > 0) {
      inputsRef.current[i - 1]?.focus();
      e.preventDefault();
    } else if (e.key === "ArrowRight" && i < OTP_LENGTH - 1) {
      inputsRef.current[i + 1]?.focus();
      e.preventDefault();
    }
  };

  return (
    <div style={{ display: "flex", gap: 8 }}>
      {Array.from({ length: OTP_LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          value={value[i] || ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          style={{
            flex: 1,
            minWidth: 0,
            height: 52,
            textAlign: "center",
            fontSize: 22,
            fontWeight: 600,
            color: TEXT,
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            outline: "none",
            backgroundColor: "#fff",
          }}
        />
      ))}
    </div>
  );
};

const TenBuckScreen = () => {
  const { user, ready, requestSignup, verifyOtp } = useAuth();
  const [stepName, setStepName] = useState("form"); // form | otp
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const otpAttemptingRef = useRef(false);

  useEffect(() => {
    if (stepName !== "otp") return;
    if (otp.length !== OTP_LENGTH) return;
    if (otp.includes("")) return;
    submitOtp(otp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, stepName]);

  if (ready && user) {
    return <Navigate to="/home" replace />;
  }

  const submitForm = async (e) => {
    e.preventDefault();
    setError("");
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    if (!trimmedEmail || !trimmedName) return;
    setBusy(true);
    try {
      await requestSignup(trimmedEmail, trimmedName, "tenbuck");
      setStepName("otp");
      setOtp("");
    } catch (err) {
      const msg = err?.message || "";
      if (/already registered/i.test(msg)) {
        setError(
          "An account already exists for this email. The bonus is for new accounts only — sign in normally instead.",
        );
      } else {
        setError(msg || "Could not send code");
      }
    } finally {
      setBusy(false);
    }
  };

  const submitOtp = async (code) => {
    if (otpAttemptingRef.current) return;
    if (!code || code.length !== OTP_LENGTH) return;
    otpAttemptingRef.current = true;
    setError("");
    setBusy(true);
    try {
      await verifyOtp(email.trim(), code);
    } catch (err) {
      setError(err?.message || "Verification failed");
    } finally {
      setBusy(false);
      otpAttemptingRef.current = false;
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#FAFAFA",
        color: TEXT,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <style>
        {`@keyframes tenbuckSlideIn {
            from { opacity: 0; transform: translateY(-6px); }
            to { opacity: 1; transform: translateY(0); }
          }`}
      </style>
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          display: "flex",
          flexDirection: "column",
          gap: 28,
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            width: "100%",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 36,
              lineHeight: 1.15,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: ACCENT,
            }}
          >
            <span style={{ whiteSpace: "nowrap" }}>
              $10
              <img
                src={asset("ShibaBuck.png")}
                alt=""
                draggable={false}
                style={{
                  height: "0.95em",
                  width: "auto",
                  verticalAlign: "-0.18em",
                  margin: "0 0.18em 0 0.18em",
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  pointerEvents: "none",
                  display: "inline-block",
                }}
              />
              bucks
            </span>{" "}
            to start making your own anime.
          </h1>

          <p
            style={{
              margin: 0,
              fontSize: 15,
              color: TEXT_MUTED,
              lineHeight: 1.55,
            }}
          >
            Sign up and we&apos;ll drop ✻1,000 into your account — write a
            scene, generate a frame, edit with your voice, export a clip.
            No credit card.
          </p>

          {stepName === "form" ? (
            <form
              onSubmit={submitForm}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginTop: 4,
              }}
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
                autoComplete="email"
                autoFocus
                style={inputStyle}
              />
              {/^\S+@\S+\.\S+$/.test(email.trim()) ? (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name"
                  required
                  autoComplete="name"
                  style={{
                    ...inputStyle,
                    animation: "tenbuckSlideIn 220ms ease-out",
                  }}
                />
              ) : null}
              <button
                type="submit"
                disabled={busy || !email.trim() || !name.trim()}
                style={buttonStyle(busy || !email.trim() || !name.trim())}
              >
                {busy ? "Sending code…" : "Claim $10 in tokens"}
              </button>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: 12,
                  color: TEXT_MUTED,
                  lineHeight: 1.4,
                }}
              >
                New accounts only · One bonus per email
              </p>
              {error ? (
                <p
                  role="alert"
                  style={{
                    margin: 0,
                    color: "#B12525",
                    fontSize: 13,
                    lineHeight: 1.4,
                  }}
                >
                  {error}
                </p>
              ) : null}
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitOtp(otp);
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                marginTop: 4,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: TEXT_MUTED,
                  lineHeight: 1.5,
                }}
              >
                Check {email.trim()} for a {OTP_LENGTH}-digit code.
              </p>
              <OtpInput
                value={otp}
                onChange={setOtp}
                disabled={busy}
                onComplete={submitOtp}
              />
              <button
                type="submit"
                disabled={busy || otp.length !== OTP_LENGTH}
                style={buttonStyle(busy || otp.length !== OTP_LENGTH)}
              >
                {busy ? "Verifying…" : "Verify & claim ✻1,000"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStepName("form");
                  setOtp("");
                  setError("");
                }}
                style={linkButtonStyle}
              >
                Use a different email
              </button>
              {error ? (
                <p
                  role="alert"
                  style={{
                    margin: 0,
                    color: "#B12525",
                    fontSize: 13,
                  }}
                >
                  {error}
                </p>
              ) : null}
            </form>
          )}
        </div>

        <div
          style={{
            width: "100%",
            aspectRatio: "16 / 10",
          }}
        >
          <AnimeCarousel />
        </div>
      </div>
    </div>
  );
};

export default TenBuckScreen;
