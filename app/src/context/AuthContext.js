import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiUrl } from "../config";

const TOKEN_KEY = "serenidad_auth_token";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() =>
    typeof localStorage !== "undefined"
      ? localStorage.getItem(TOKEN_KEY)
      : null,
  );
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const persistToken = useCallback((t) => {
    if (t) {
      localStorage.setItem(TOKEN_KEY, t);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    setTokenState(t);
  }, []);

  const loadMe = useCallback(
    async (authToken) => {
      const res = await fetch(apiUrl("/auth/me"), {
        headers: {
          Authorization: `Bearer ${authToken}`,
          Accept: "application/json",
        },
      });
      if (!res.ok) {
        persistToken(null);
        setUser(null);
        return false;
      }
      const data = await res.json();
      setUser(data.user);
      return true;
    },
    [persistToken],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setUser(null);
        setReady(true);
        return;
      }
      try {
        await loadMe(token);
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, loadMe]);

  const logout = useCallback(() => {
    persistToken(null);
    setUser(null);
  }, [persistToken]);

  const requestSignup = useCallback(async (email, name) => {
    const res = await fetch(apiUrl("/auth/signup"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error || "Signup failed");
    }
    return body;
  }, []);

  const requestLogin = useCallback(async (email) => {
    const res = await fetch(apiUrl("/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error || "Login failed");
    }
    return body;
  }, []);

  const verifyOtp = useCallback(
    async (email, otp) => {
      const res = await fetch(apiUrl("/auth/verify-otp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Verification failed");
      }
      persistToken(body.token);
      setUser(body.user);
      return body;
    },
    [persistToken],
  );

  const value = useMemo(
    () => ({
      ready,
      token,
      user,
      logout,
      requestSignup,
      requestLogin,
      verifyOtp,
      refreshUser: () => (token ? loadMe(token) : Promise.resolve(false)),
    }),
    [
      ready,
      token,
      user,
      logout,
      requestSignup,
      requestLogin,
      verifyOtp,
      loadMe,
    ],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
