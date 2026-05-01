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
const USER_KEY = "serenidad_auth_user";

const AuthContext = createContext(null);

function readCachedUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() =>
    typeof localStorage !== "undefined"
      ? localStorage.getItem(TOKEN_KEY)
      : null,
  );
  const [user, setUser] = useState(() => {
    if (typeof localStorage === "undefined") {
      return null;
    }
    if (!localStorage.getItem(TOKEN_KEY)) {
      return null;
    }
    return readCachedUser();
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (user) {
      try {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      } catch {
        /* ignore quota */
      }
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }, [user]);

  const persistToken = useCallback((t) => {
    if (t) {
      localStorage.setItem(TOKEN_KEY, t);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    setTokenState(t);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(USER_KEY);
    persistToken(null);
    setUser(null);
  }, [persistToken]);

  const loadMe = useCallback(
    async (authToken) => {
      try {
        const res = await fetch(apiUrl("/auth/me"), {
          headers: {
            Authorization: `Bearer ${authToken}`,
            Accept: "application/json",
          },
        });

        if (res.status === 401 || res.status === 403) {
          clearSession();
          return false;
        }

        if (!res.ok) {
          console.warn(`[auth] /auth/me failed: HTTP ${res.status}`);
          return false;
        }

        const data = await res.json();
        setUser(data.user);
        return true;
      } catch (e) {
        console.warn("[auth] /auth/me network error", e);
        return false;
      }
    },
    [clearSession],
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
    clearSession();
  }, [clearSession]);

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

  const uploadProfilePicture = useCallback(
    async (file) => {
      if (!token) {
        throw new Error("Not signed in");
      }
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(apiUrl("/auth/profile-picture"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: fd,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Upload failed");
      }
      setUser(body.user);
      return body.user;
    },
    [token],
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
      uploadProfilePicture,
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
      uploadProfilePicture,
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
