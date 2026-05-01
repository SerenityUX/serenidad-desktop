import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";

const AuthScreen = () => {
  const { requestSignup, requestLogin, verifyOtp } = useAuth();
  const [mode, setMode] = useState("login");
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onSendCode = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") {
        await requestSignup(email.trim(), name.trim());
      } else {
        await requestLogin(email.trim());
      }
      setStep("otp");
    } catch (err) {
      setError(err.message || "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const onVerify = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await verifyOtp(email.trim(), otp.trim());
    } catch (err) {
      setError(err.message || "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1>Serenidad</h1>
      {step === "email" ? (
        <form onSubmit={onSendCode}>
          <div>
            <label>
              <input
                type="radio"
                name="mode"
                checked={mode === "login"}
                onChange={() => setMode("login")}
              />{" "}
              Sign in
            </label>
            <label>
              <input
                type="radio"
                name="mode"
                checked={mode === "signup"}
                onChange={() => setMode("signup")}
              />{" "}
              Sign up
            </label>
          </div>
          <div>
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              required
              autoComplete="email"
            />
          </div>
          {mode === "signup" ? (
            <div>
              <label htmlFor="auth-name">Name</label>
              <input
                id="auth-name"
                type="text"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                required
                autoComplete="name"
              />
            </div>
          ) : null}
          <button type="submit" disabled={busy}>
            Send code
          </button>
        </form>
      ) : (
        <form onSubmit={onVerify}>
          <p>
            Code sent to <strong>{email}</strong>
          </p>
          <div>
            <label htmlFor="auth-otp">OTP</label>
            <input
              id="auth-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(ev) => setOtp(ev.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={busy}>
            Verify
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setStep("email");
              setOtp("");
              setError("");
            }}
          >
            Back
          </button>
        </form>
      )}
      {error ? (
        <p role="alert">{error}</p>
      ) : null}
    </div>
  );
};

export default AuthScreen;
