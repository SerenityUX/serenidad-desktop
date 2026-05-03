import React, { useState, useEffect, useCallback } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AuthScreen from "./components/auth/AuthScreen";
import FolderView from "./components/projects/FolderView";
import LauncherLoadingSkeleton from "./components/projects/LauncherLoadingSkeleton";
import { apiUrl } from "./config";

const MainApp = () => {
  const { token } = useAuth();
  const [projects, setProjects] = useState([]);

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

  useEffect(() => {
    // Register unconditionally so the listener exists even before auth has
    // hydrated. We check token inside the handler and report a clear error
    // back to the modal instead of silently dropping the click.
    const unsub = window.electron.ipcRenderer.on(
      "create-project-submit",
      /** Preload forwards only payload args (not the IPC event). */
      async (payload) => {
        const reportResult = (result) => {
          window.electron.ipcRenderer.send("create-project-result", result);
        };

        try {
          if (!token) {
            throw new Error(
              "Not signed in yet — wait for sign-in to finish, then try again.",
            );
          }
          const { projectName, width, height } = payload || {};
          const trimmedName = String(projectName || "").trim();
          if (!trimmedName) throw new Error("Project name is required.");
          const w =
            Number.parseInt(String(width).replace(/\D/g, ""), 10) || 1280;
          const h =
            Number.parseInt(String(height).replace(/\D/g, ""), 10) || 720;

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
          reportResult({ ok: true });
          window.electron.ipcRenderer.send("close-modal");
          await refreshProjects();
          await window.electron.openProjectWindow({
            projectId: body.id,
            token,
          });
        } catch (err) {
          console.error(err);
          reportResult({
            ok: false,
            error: String(err?.message || "Create failed"),
          });
        }
      },
    );
    return () => unsub();
  }, [token, refreshProjects]);

  return (
    <div
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <FolderView projects={projects} />
    </div>
  );
};

const AppGate = () => {
  const { ready, user } = useAuth();

  if (!ready) {
    return <LauncherLoadingSkeleton />;
  }

  if (!user) {
    return <AuthScreen />;
  }

  return <MainApp />;
};

const App = () => (
  <AuthProvider>
    <AppGate />
  </AuthProvider>
);

export default App;
