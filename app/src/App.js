import React, { useState, useEffect, useCallback } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AuthScreen from "./components/auth/AuthScreen";
import FolderView from "./components/projects/FolderView";
import { apiUrl } from "./config";

const MainApp = () => {
  const { token } = useAuth();
  const [folderPath, setFolderPath] = useState(() =>
    typeof localStorage !== "undefined"
      ? localStorage.getItem("kodanFolder")
      : null,
  );
  const [projects, setProjects] = useState([]);

  const persistFolder = useCallback((selected) => {
    if (selected) {
      localStorage.setItem("kodanFolder", selected);
    } else {
      localStorage.removeItem("kodanFolder");
    }
    setFolderPath(selected);
  }, []);

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
      let list = data.projects || [];
      if (folderPath) {
        try {
          const index = await window.electron.invoke(
            "get-project-local-index",
            folderPath,
          );
          list = list.map((p) => ({
            ...p,
            path: index[String(p.id)] || null,
            lastEdited: p.created_at,
          }));
        } catch (e) {
          console.error(e);
          list = list.map((p) => ({
            ...p,
            path: null,
            lastEdited: p.created_at,
          }));
        }
      } else {
        list = list.map((p) => ({
          ...p,
          path: null,
          lastEdited: p.created_at,
        }));
      }
      setProjects(list);
    } catch (e) {
      console.error(e);
      setProjects([]);
    }
  }, [token, folderPath]);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    if (!token) return undefined;
    const unsub = window.electron.ipcRenderer.on(
      "create-project-submit",
      async (_event, payload) => {
        const {
          folderPath: ws,
          projectName,
          projectFolder,
          width,
          height,
        } = payload;
        if (!ws) {
          window.alert(
            "Select a workspace folder first (profile menu → Workspace folder…).",
          );
          return;
        }
        const w =
          Number.parseInt(String(width).replace(/\D/g, ""), 10) || 1920;
        const h =
          Number.parseInt(String(height).replace(/\D/g, ""), 10) || 1080;
        try {
          const res = await fetch(apiUrl("/projects"), {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: String(projectName || "").trim(),
              width: w,
              height: h,
            }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(body.error || "Could not create project");
          }
          await window.electron.createProject({
            folderPath: ws,
            projectName: String(projectName || "").trim(),
            projectFolder,
            width: w,
            height: h,
            apiProjectId: body.id,
          });
          window.electron.ipcRenderer.send("close-modal");
          await refreshProjects();
        } catch (err) {
          console.error(err);
          window.alert(err.message || "Create failed");
        }
      },
    );
    return () => unsub();
  }, [token, refreshProjects]);

  const handleSelectFolder = async () => {
    try {
      const selected = await window.electron.selectFolder();
      if (selected) {
        persistFolder(selected);
      }
    } catch (error) {
      console.error("Failed to select folder:", error);
    }
  };

  return (
    <div
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <FolderView
        projects={projects}
        workspaceFolder={folderPath}
        onSelectWorkspace={handleSelectFolder}
      />
    </div>
  );
};

const AppGate = () => {
  const { ready, user } = useAuth();

  if (!ready) {
    return <div>Loading…</div>;
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
