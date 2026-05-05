import React, { useState } from 'react';
import ProjectCard from './ProjectCard';
import ProfileAvatarMenu from '../ProfileAvatarMenu';
import TokensPill from '../TokensPill';
import TokensModal from '../TokensModal';
import NewProjectModal from './NewProjectModal';
import { useAuth } from '../../context/AuthContext';
import platform from '../../platform';

/** Side rails match width so the title stays centered; fits the Create button + avatar */
const HEADER_RAIL_WIDTH_PX = 140;

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
  createOpen,
  onOpenCreate,
  onCloseCreate,
  onCreateSubmit,
  createResult,
}) => {
  const { user, token } = useAuth();
  const [tokensOpen, setTokensOpen] = useState(false);

  const handleProjectClick = async (project) => {
    if (!token || !project?.id) return;
    try {
      await platform.openProject({
        projectId: String(project.id),
        token,
      });
    } catch (e) {
      console.error(e);
      window.alert('Could not open project.');
    }
  };

  return (
    <div style={{ position: 'relative', minHeight: 'calc(100vh - var(--app-top-offset, 0px))' }}>
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
          gap: 8,
        }}
        >
          <ProfileAvatarMenu user={user} size={24} />
          {user ? (
            <TokensPill tokens={user.tokens ?? 0} onClick={() => setTokensOpen(true)} />
          ) : null}
        </div>
        <p style={{
          fontSize: 24,
          margin: 0,
          textAlign: 'center',
          justifySelf: 'stretch',
        }}
        >
          CoCreate Cafe
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
            onClick={onOpenCreate}
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

      <TokensModal open={tokensOpen} onClose={() => setTokensOpen(false)} />

      <NewProjectModal
        open={!!createOpen}
        onClose={onCloseCreate}
        onSubmit={onCreateSubmit}
        pendingError={createResult}
      />
    </div>
  );
};

export default FolderView;
