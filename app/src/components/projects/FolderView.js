import React, { useState, useEffect } from 'react';
import ProjectCard from './ProjectCard';
import ProfileAvatarMenu from '../ProfileAvatarMenu';
import { useAuth } from '../../context/AuthContext';

/** Side rails match width so the title stays centered; fits the Create button + avatar */
const HEADER_RAIL_WIDTH_PX = 88;

const createBtnStyle = {
  backgroundColor: '#1F93FF',
  cursor: 'pointer',
  border: '0px',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '14px',
  padding: '6px 12px',
  lineHeight: 1.2,
};

const FolderView = ({
  projects,
  workspaceFolder,
  onSelectWorkspace,
}) => {
  const { user } = useAuth();
  const [isOverlayVisible, setOverlayVisible] = useState(false);

  useEffect(() => {
    const unsub = window.electron.ipcRenderer.on('close-modal', () =>
      setOverlayVisible(false),
    );
    return () => unsub();
  }, []);

  const openCreateProjectModal = () => {
    window.electron.ipcRenderer.send('open-modal', workspaceFolder ?? null);
    setOverlayVisible(true);
  };

  const handleProjectClick = (project) => {
    if (project.path) {
      window.electron.ipcRenderer.send('open-project', project.path);
    } else {
      window.alert(
        'This project has no local folder in your workspace yet. Select a workspace folder and create the project from here, or open it after syncing.',
      );
    }
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `${HEADER_RAIL_WIDTH_PX}px 1fr ${HEADER_RAIL_WIDTH_PX}px`,
        alignItems: 'center',
        columnGap: 12,
        padding: '16px',
        boxSizing: 'border-box',
      }}>
        <div style={{
          width: HEADER_RAIL_WIDTH_PX,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}
        >
          <ProfileAvatarMenu
            user={user}
            size={24}
            onPickWorkspaceFolder={onSelectWorkspace}
          />
        </div>
        <p style={{
          fontSize: 24,
          margin: 0,
          textAlign: 'center',
          justifySelf: 'stretch',
        }}
        >
          Kōdan Anime Studio
        </p>
        <div style={{
          width: HEADER_RAIL_WIDTH_PX,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
        >
          <button
            type="button"
            onClick={openCreateProjectModal}
            style={createBtnStyle}
          >
            Create
          </button>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        columnGap: 16,
        rowGap: 16,
        paddingLeft: 16,
        paddingRight: 16,
        boxSizing: 'border-box',
      }}>
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onClick={() => handleProjectClick(project)}
          />
        ))}
      </div>

      <div
        aria-hidden={!isOverlayVisible}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          backgroundColor: '#000',
          pointerEvents: isOverlayVisible ? 'auto' : 'none',
          opacity: isOverlayVisible ? 0.5 : 0,
          transition: 'opacity 0.3s ease-out',
        }}
      />
    </div>
  );
};

export default FolderView;
