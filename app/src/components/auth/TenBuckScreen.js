import React, { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { asset } from "../../lib/asset";

const PRIMARY = "#4736C1";
const TEXT = "#404040";
const BORDER = "#D9D9D9";

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
  padding: "12px 14px",
  border: 0,
  borderRadius: 10,
  backgroundColor: PRIMARY,
  color: "#fff",
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.5 : 1,
  fontSize: 15,
  fontWeight: 700,
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

/**
 * Promo landing page: /tenbuck. New accounts created here get ✻1000
 * (about $10) instead of the standard ✻100. Existing accounts can't claim
 * — the API only applies the credit when pending_signup → false, which
 * only happens once per user.
 */
const TenBuckScreen = () => {
  const { user, ready, requestSignup, verifyOtp } = useAuth();
  const [step, setStep] = useState("form"); // form | otp
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const otpAttemptingRef = useRef(false);

  useEffect(() => {
    if (step !== "otp") return;
    if (otp.length !== OTP_LENGTH) return;
    if (otp.includes("")) return;
    submitOtp(otp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, step]);

  // Already-signed-in users: bounce to the launcher. They can't claim the
  // bonus on an existing account.
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
      setStep("otp");
      setOtp("");
    } catch (err) {
      const msg = err?.message || "";
      if (/already registered/i.test(msg)) {
        setError(
          "An account already exists for this email. The Shiba Buck bonus is for new accounts only — sign in normally.",
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
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        boxSizing: "border-box",
        background:
          "radial-gradient(1200px 600px at 50% -100px, #FFF6E0 0%, #FFFDF8 60%, #fff 100%)",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        color: TEXT,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          borderRadius: 18,
          border: "1px solid #EFE7D2",
          padding: 28,
          boxShadow: "0 24px 60px rgba(120, 80, 0, 0.08)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        <img
          src={asset("ShibaBuck.png")}
          alt="Shiba Buck"
          draggable={false}
          style={{
            width: 180,
            height: 180,
            objectFit: "contain",
            userSelect: "none",
            WebkitUserSelect: "none",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1.2,
              color: "#B07A1A",
              textTransform: "uppercase",
            }}
          >
            Shiba Buck offer
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 800,
              color: "#111",
              letterSpacing: "-0.01em",
            }}
          >
            $10 of free tokens
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: TEXT, lineHeight: 1.5 }}>
            Sign up below and we&apos;ll drop{" "}
            <strong>✻1,000</strong> into your CoCreate account — about ten
            bucks&apos; worth — to make your first stories on us.
          </p>
        </div>

        {step === "form" ? (
          <form
            onSubmit={submitForm}
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginTop: 4,
            }}
          >
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
              autoComplete="name"
              autoFocus
              style={inputStyle}
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              autoComplete="email"
              style={inputStyle}
            />
            <button
              type="submit"
              disabled={busy || !email.trim() || !name.trim()}
              style={buttonStyle(busy || !email.trim() || !name.trim())}
            >
              {busy ? "Sending code…" : "Claim ✻1,000"}
            </button>
            <p
              style={{
                margin: 0,
                fontSize: 11,
                color: "#9A8A6A",
                textAlign: "center",
                lineHeight: 1.4,
              }}
            >
              New accounts only. One bonus per email.
            </p>
            {error ? (
              <p
                role="alert"
                style={{
                  margin: 0,
                  color: "#C0392B",
                  fontSize: 12,
                  textAlign: "center",
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
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginTop: 4,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: TEXT,
                textAlign: "center",
              }}
            >
              We sent a {OTP_LENGTH}-digit code to {email.trim()}.
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
                setStep("form");
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
                  color: "#C0392B",
                  fontSize: 12,
                  textAlign: "center",
                }}
              >
                {error}
              </p>
            ) : null}
          </form>
        )}
      </div>
    </div>
  );
};

export default TenBuckScreen;
