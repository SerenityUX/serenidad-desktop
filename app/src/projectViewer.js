import React from 'react';
import { createRoot } from 'react-dom/client';
import ProjectComponent from './components/editor/ProjectComponent';
import { AuthProvider } from './context/AuthContext';

const urlParams = new URLSearchParams(window.location.search);
const projectIdRaw = urlParams.get('projectId');
const projectId = projectIdRaw ? decodeURIComponent(projectIdRaw).trim() : null;

const container = document.getElementById('root');
const root = createRoot(container);

if (!projectId) {
  root.render(
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      Missing project id. Close this window and open a project from the launcher.
    </div>,
  );
} else {
  root.render(
    <AuthProvider>
      <ProjectComponent projectId={projectId} />
    </AuthProvider>,
  );
}
