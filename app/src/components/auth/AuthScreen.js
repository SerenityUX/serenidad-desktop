import React, { useEffect, useRef, useState } from "react";

const flowerSrc = new URL("../../../public/KodanFlower.png", import.meta.url)
  .href;
const capybaraSrc = new URL("../../../public/capybara.mp4", import.meta.url)
  .href;

const MOBILE_BREAKPOINT = 720;

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.innerWidth < MOBILE_BREAKPOINT
      : false,
  );
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = (e) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    if (mql.addEventListener) {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);
  return isMobile;
};
import { useAuth } from "../../context/AuthContext";

const TEXT = "#404040";
const BORDER = "#D9D9D9";
const PRIMARY = "#4736C1";
const VIDEO_BG = "#E5E5E5";

const inputStyle = {
  color: TEXT,
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  backgroundColor: "#fff",
};

const buttonStyle = (disabled) => ({
  width: "100%",
  padding: "10px 12px",
  border: 0,
  borderRadius: 8,
  backgroundColor: PRIMARY,
  color: "#fff",
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.5 : 1,
  fontSize: 14,
  fontWeight: 600,
  boxSizing: "border-box",
});

const linkButtonStyle = {
  background: "none",
  border: 0,
  padding: 0,
  color: TEXT,
  fontSize: 13,
  cursor: "pointer",
  textDecoration: "underline",
};

const OTP_LENGTH = 6;

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
    if (!digits) {
      const next = setDigit(i, "");
      return next;
    }
    if (digits.length === 1) {
      const next = setDigit(i, digits);
      if (i < OTP_LENGTH - 1) inputsRef.current[i + 1]?.focus();
      if (next.length === OTP_LENGTH && !next.includes("")) {
        onComplete?.(next);
      }
      return next;
    }
    // Multi-char paste-like input
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
    const focusIdx = Math.min(cursor, OTP_LENGTH - 1);
    inputsRef.current[focusIdx]?.focus();
    if (next.length === OTP_LENGTH && !next.includes("")) {
      onComplete?.(next);
    }
    return next;
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      if (value[i]) {
        setDigit(i, "");
      } else if (i > 0) {
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

  const handlePaste = (i, e) => {
    const text = e.clipboardData.getData("text");
    const digits = text.replace(/\D/g, "");
    if (!digits) return;
    e.preventDefault();
    handleChange(i, digits);
  };

  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
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
          onPaste={(e) => handlePaste(i, e)}
          onFocus={(e) => e.target.select()}
          style={{
            width: 44,
            height: 52,
            textAlign: "center",
            fontSize: 22,
            fontWeight: 600,
            color: TEXT,
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            outline: "none",
            backgroundColor: "#fff",
          }}
        />
      ))}
    </div>
  );
};

const AuthScreen = () => {
  const { requestSignup, requestLogin, verifyOtp } = useAuth();
  const [step, setStep] = useState("email"); // email | name | otp
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const otpAttemptingRef = useRef(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (step !== "otp") return;
    if (otp.length !== OTP_LENGTH) return;
    if (otp.includes("")) return;
    submitOtp(otp);
    // submitOtp is stable enough for this guard; we only care about otp/step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, step]);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const id = setInterval(() => {
      setResendIn((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  const sendLoginCode = async (targetEmail) => {
    await requestLogin(targetEmail);
    setStep("otp");
    setOtp("");
    setResendIn(60);
  };

  const sendSignupCode = async (targetEmail, targetName) => {
    await requestSignup(targetEmail, targetName);
    setStep("otp");
    setOtp("");
    setResendIn(60);
  };

  const onSubmitEmail = async (e) => {
    e.preventDefault();
    setError("");
    const trimmed = email.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await sendLoginCode(trimmed);
    } catch (err) {
      const msg = err?.message || "";
      if (/no account/i.test(msg) || /not found/i.test(msg)) {
        setStep("name");
      } else {
        setError(msg || "Could not send code");
      }
    } finally {
      setBusy(false);
    }
  };

  const onSubmitName = async (e) => {
    e.preventDefault();
    setError("");
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setBusy(true);
    try {
      await sendSignupCode(trimmedEmail, trimmedName);
    } catch (err) {
      setError(err?.message || "Could not send code");
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

  const onSubmitOtp = (e) => {
    e.preventDefault();
    submitOtp(otp);
  };

  const onResend = async () => {
    if (resendIn > 0 || busy) return;
    setError("");
    setBusy(true);
    try {
      if (name.trim()) {
        await sendSignupCode(email.trim(), name.trim());
      } else {
        await sendLoginCode(email.trim());
      }
    } catch (err) {
      setError(err?.message || "Could not resend code");
    } finally {
      setBusy(false);
    }
  };

  const goBackToEmail = () => {
    setStep("email");
    setOtp("");
    setName("");
    setError("");
    setResendIn(0);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        color: TEXT,
        backgroundColor: "#fff",
      }}
    >
      {isMobile ? null : (
        <div
          style={{
            flex: 1,
            backgroundColor: VIDEO_BG,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <video
            src={capybaraSrc}
            autoPlay
            loop
            muted
            playsInline
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              imageRendering: "pixelated",
            }}
          />
        </div>
      )}

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          boxSizing: "border-box",
        }}
      >
        <div style={{ width: "100%", maxWidth: 360 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <img
              src={flowerSrc}
              alt="CoCreate Cafe"
              style={{ width: 88, height: 88, objectFit: "contain" }}
            />
          </div>

          {step === "email" ? (
            <form onSubmit={onSubmitEmail}>
              <h1
                style={{
                  margin: 0,
                  fontSize: 24,
                  fontWeight: 700,
                  color: "#000",
                  textAlign: "center",
                }}
              >
                Sign Up or Log In
              </h1>
              <p
                style={{
                  margin: "8px 0 20px",
                  fontSize: 13,
                  color: TEXT,
                  textAlign: "center",
                }}
              >
                Welcome! Enter your email to receive a verification code.
              </p>
              <input
                type="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                placeholder="Email address"
                required
                autoComplete="email"
                autoFocus
                style={inputStyle}
              />
              <div style={{ height: 16 }} />
              <button
                type="submit"
                disabled={busy || !email.trim()}
                style={buttonStyle(busy || !email.trim())}
              >
                {busy ? "Sending…" : "Continue"}
              </button>
              {error ? (
                <p
                  role="alert"
                  style={{
                    marginTop: 14,
                    color: "#C0392B",
                    fontSize: 12,
                    textAlign: "center",
                  }}
                >
                  {error}
                </p>
              ) : null}
            </form>
          ) : null}

          {step === "name" ? (
            <form onSubmit={onSubmitName}>
              <h1
                style={{
                  margin: 0,
                  fontSize: 24,
                  fontWeight: 700,
                  color: "#000",
                  textAlign: "center",
                }}
              >
                What&apos;s your name?
              </h1>
              <p
                style={{
                  margin: "8px 0 20px",
                  fontSize: 13,
                  color: TEXT,
                  textAlign: "center",
                }}
              >
                We&apos;ll create an account for {email.trim()}.
              </p>
              <input
                type="text"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                placeholder="Your name"
                required
                autoComplete="name"
                autoFocus
                style={inputStyle}
              />
              <div style={{ height: 16 }} />
              <button
                type="submit"
                disabled={busy || !name.trim()}
                style={buttonStyle(busy || !name.trim())}
              >
                {busy ? "Sending…" : "Continue"}
              </button>
              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <button
                  type="button"
                  onClick={goBackToEmail}
                  style={linkButtonStyle}
                >
                  Use a different email
                </button>
              </div>
              {error ? (
                <p
                  role="alert"
                  style={{
                    marginTop: 14,
                    color: "#C0392B",
                    fontSize: 12,
                    textAlign: "center",
                  }}
                >
                  {error}
                </p>
              ) : null}
            </form>
          ) : null}

          {step === "otp" ? (
            <form onSubmit={onSubmitOtp}>
              <h1
                style={{
                  margin: 0,
                  fontSize: 24,
                  fontWeight: 700,
                  color: "#000",
                  textAlign: "center",
                }}
              >
                Enter verification code
              </h1>
              <p
                style={{
                  margin: "8px 0 20px",
                  fontSize: 13,
                  color: TEXT,
                  textAlign: "center",
                }}
              >
                We sent a {OTP_LENGTH}-digit code to {email.trim()}
              </p>
              <OtpInput
                value={otp}
                onChange={setOtp}
                disabled={busy}
                onComplete={submitOtp}
              />
              <div style={{ height: 16 }} />
              <button
                type="submit"
                disabled={busy || otp.length !== OTP_LENGTH}
                style={buttonStyle(busy || otp.length !== OTP_LENGTH)}
              >
                {busy ? "Verifying…" : "Verify"}
              </button>
              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {resendIn > 0 ? (
                  <span style={{ fontSize: 13, color: TEXT }}>
                    Resend code in {resendIn}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={onResend}
                    disabled={busy}
                    style={linkButtonStyle}
                  >
                    Resend code
                  </button>
                )}
                <button
                  type="button"
                  onClick={goBackToEmail}
                  style={linkButtonStyle}
                >
                  Use a different email
                </button>
              </div>
              {error ? (
                <p
                  role="alert"
                  style={{
                    marginTop: 14,
                    color: "#C0392B",
                    fontSize: 12,
                    textAlign: "center",
                  }}
                >
                  {error}
                </p>
              ) : null}
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
