import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "./context/AuthContext";
import AuthScreen from "./components/auth/AuthScreen";
import FolderView from "./components/projects/FolderView";
import LauncherLoadingSkeleton from "./components/projects/LauncherLoadingSkeleton";
import { apiUrl } from "./config";
import platform, { isElectron } from "./platform";

const MOBILE_MAX_WIDTH = 768;

const MobileGate = () => (
  <div
    style={{
      minHeight: "100vh",
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      backgroundColor: "#000",
      color: "#fff",
      textAlign: "center",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      boxSizing: "border-box",
    }}
  >
    <div style={{ maxWidth: 420, fontSize: 18, lineHeight: 1.5 }}>
      Hey! The main CoCreate app is available only on laptop &amp; tablet!
      Please switch to one of these devices to continue your experience.
    </div>
  </div>
);

const useIsMobileViewport = () => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < MOBILE_MAX_WIDTH,
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_MAX_WIDTH);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isMobile;
};

const MainApp = () => {
  const { token } = useAuth();
  const [projects, setProjects] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  /**
   * Three states: undefined = no result yet, null = success (modal can close
   * itself / parent will close it), string = error to surface inline.
   */
  const [createResult, setCreateResult] = useState(undefined);

  const refreshProjects = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(apiUrl("/projects"), {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.warn("Failed to load projects:", data.error || res.status);
        setProjects([]);
        return;
      }
      const list = (data.projects || []).map((p) => ({
        ...p,
        lastEdited: p.created_at,
      }));
      setProjects(list);
    } catch (e) {
      console.error(e);
      setProjects([]);
    }
  }, [token]);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const handleCreateSubmit = useCallback(
    async ({ projectName, width, height }) => {
      try {
        if (!token) {
          throw new Error(
            "Not signed in yet — wait for sign-in to finish, then try again.",
          );
        }
        const trimmedName = String(projectName || "").trim();
        if (!trimmedName) throw new Error("Project name is required.");
        const w = Number.parseInt(String(width).replace(/\D/g, ""), 10) || 1280;
        const h = Number.parseInt(String(height).replace(/\D/g, ""), 10) || 720;

        const res = await fetch(apiUrl("/projects"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: trimmedName, width: w, height: h }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            body.error || `Could not create project (HTTP ${res.status})`,
          );
        }
        setCreateResult(null);
        setCreateOpen(false);
        await refreshProjects();
        await platform.openProject({ projectId: body.id, token });
      } catch (err) {
        console.error(err);
        setCreateResult(String(err?.message || "Create failed"));
      }
    },
    [token, refreshProjects],
  );

  return (
    <div
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <FolderView
        projects={projects}
        createOpen={createOpen}
        onOpenCreate={() => {
          setCreateResult(undefined);
          setCreateOpen(true);
        }}
        onCloseCreate={() => setCreateOpen(false)}
        onCreateSubmit={handleCreateSubmit}
        createResult={createResult}
      />
    </div>
  );
};

const AppGate = () => {
  const { ready, user } = useAuth();
  const isMobile = useIsMobileViewport();

  if (!ready) {
    return <LauncherLoadingSkeleton />;
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (!isElectron && isMobile) {
    return <MobileGate />;
  }

  return <MainApp />;
};

const App = () => <AppGate />;

export default App;
