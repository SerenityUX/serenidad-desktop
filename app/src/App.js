import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AuthScreen from "./components/auth/AuthScreen";
import NoFolderView from "./components/projects/NoFolderView";
import FolderView from "./components/projects/FolderView";

const MainApp = () => {
  const [folderPath, setFolderPath] = useState(null);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    const savedFolder = localStorage.getItem("kodanFolder");
    if (savedFolder) {
      loadProjects(savedFolder);
    }
  }, []);

  const loadProjects = async (pathValue) => {
    try {
      const list = await window.electron.getProjectData(pathValue);
      setProjects(list);
      setFolderPath(pathValue);
    } catch (error) {
      console.error("Failed to load projects:", error);
    }
  };

  const handleSelectFolder = async () => {
    try {
      const selected = await window.electron.selectFolder();
      if (selected) {
        localStorage.setItem("kodanFolder", selected);
        loadProjects(selected);
      }
    } catch (error) {
      console.error("Failed to select folder:", error);
    }
  };

  const handleChangeFolder = () => {
    window.electron.selectFolder().then((selected) => {
      if (selected) {
        localStorage.setItem("kodanFolder", selected);
        loadProjects(selected);
      }
    });
  };

  const handleCreateProject = async (projectDetails) => {
    try {
      const success = await window.electron.createProject(projectDetails);
      if (success && folderPath) {
        loadProjects(folderPath);
      }
    } catch (error) {
      console.error("Failed to create project:", error);
    }
  };

  return (
    <div
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      {!folderPath ? (
        <NoFolderView onSelectFolder={handleSelectFolder} />
      ) : (
        <FolderView
          onSubmit={handleCreateProject}
          projects={projects}
          onChangeFolder={handleChangeFolder}
        />
      )}
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
