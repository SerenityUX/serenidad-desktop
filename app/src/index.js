import React from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  HashRouter,
  Routes,
  Route,
  useParams,
  Navigate,
} from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import ProjectComponent from "./components/editor/ProjectComponent";
import platform, { isElectron } from "./platform";

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("React render error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
          <h1>Something broke</h1>
          <pre style={{ whiteSpace: "pre-wrap" }}>
            {String(this.state.error && this.state.error.message
              ? this.state.error.message
              : this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Editor route. Reads `:id` from the URL, hands it to the existing editor
 * component. ProjectComponent already pulls the auth token via
 * `platform.getEditorAuthToken()` (Electron: IPC, Web: localStorage), so
 * nothing else needs threading through here.
 */
const ProjectRoute = () => {
  const { id } = useParams();
  if (!id) return <Navigate to="/" replace />;
  return (
    <div style={{ height: "100%", width: "100%", display: "flex" }}>
      <ProjectComponent projectId={decodeURIComponent(id)} />
    </div>
  );
};

/**
 * Electron loads us via `file://.../dist/index.html` so we can't rely on
 * pushState-style routes. HashRouter sidesteps that. Web uses BrowserRouter
 * for clean URLs.
 */
const Router = isElectron ? HashRouter : BrowserRouter;

const Root = () => (
  <Router>
    <AuthProvider>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/project/:id" element={<ProjectRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  </Router>
);

const container = document.getElementById("root");
if (!container) {
  document.body.innerHTML =
    '<p style="padding:16px;font-family:system-ui">Missing #root in index.html</p>';
} else {
  const root = createRoot(container);
  root.render(
    <RootErrorBoundary>
      <Root />
    </RootErrorBoundary>,
  );
}
