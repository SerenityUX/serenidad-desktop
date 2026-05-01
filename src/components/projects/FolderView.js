import React, { useState, useEffect } from 'react';
import ProjectCard from './ProjectCard';

const FolderView = ({ projects }) => {
  const [isOverlayVisible, setOverlayVisible] = useState(false);

  useEffect(() => {
    window.electron.ipcRenderer.on('close-modal', () => setOverlayVisible(false));
    return () => window.electron.ipcRenderer.removeAllListeners('close-modal');
  }, []);

  const openCreateProjectModal = () => {
    window.electron.ipcRenderer.send('open-modal');
    setOverlayVisible(true);
  };

  const handleProjectClick = (projectFilePath) => {
    window.electron.ipcRenderer.send('open-project', projectFilePath);
  };

  return (
    <div>
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'absolute',
        backgroundColor: '#000',
        pointerEvents: !isOverlayVisible ? 'none' : 'auto',
        opacity: isOverlayVisible ? 0.5 : 0,
        transition: 'opacity 0.3s ease-out',
      }} />

      <div style={{ display: 'flex', padding: '16px', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 24, margin: 0 }}>Kōdan Anime Studio</p>
        <button
          onClick={openCreateProjectModal}
          style={{
            backgroundColor: '#1F93FF',
            cursor: 'pointer',
            border: '0px',
            borderRadius: '4px',
            color: '#fff',
          }}
        >
          Create Anime
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px' }}>
        {projects.map((project, index) => (
          <ProjectCard
            key={index}
            project={project}
            onClick={() => handleProjectClick(project.path)}
          />
        ))}
      </div>
    </div>
  );
};

export default FolderView;
