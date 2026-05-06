import React, { useEffect, useState } from 'react';
import ProjectCard from './ProjectCard';
import ProfileAvatarMenu from '../ProfileAvatarMenu';
import TokensPill from '../TokensPill';
import TokensModal from '../TokensModal';
import NewProjectModal from './NewProjectModal';
import RenameProjectModal from './RenameProjectModal';
import DeleteProjectDialog from './DeleteProjectDialog';
import EmptyProjectsState from './EmptyProjectsState';
import LauncherOnboarding from '../onboarding/LauncherOnboarding';
import ShareModal from '../editor/ShareModal';
import { useAuth } from '../../context/AuthContext';
import { useOnboarding, STEPS } from '../../context/OnboardingContext';
import { apiUrl } from '../../config';
import platform from '../../platform';
import useIsMobile from '../../hooks/useIsMobile';
import { color, font, space } from '../../lib/tokens';

/** Side rails match width so the title stays centered; fits the Create button + avatar */
const HEADER_RAIL_WIDTH_PX = 160;

const FolderView = ({
  projects,
  createOpen,
  onOpenCreate,
  onCloseCreate,
  onCreateSubmit,
  createResult,
  onProjectsChanged,
}) => {
  const { user, token } = useAuth();
  const onboarding = useOnboarding();
  const isMobile = useIsMobile();
  const [tokensOpen, setTokensOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [shareTarget, setShareTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleCreateClick = () => {
    onboarding.advanceFrom(STEPS.CLICK_CREATE);
    onOpenCreate?.();
  };

  // Existing users who already have projects haven't been through the
  // tour — skip it rather than greet them with a welcome card.
  useEffect(() => {
    if (projects.length > 0 && onboarding.step === STEPS.WELCOME) {
      onboarding.skip();
    }
  }, [projects.length, onboarding]);

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

  const handleRenameSubmit = async (newName) => {
    if (!renameTarget || !token) return;
    const res = await fetch(
      apiUrl(`/projects/${encodeURIComponent(renameTarget.id)}`),
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ name: newName }),
      },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error || 'Rename failed');
    }
    setRenameTarget(null);
    await onProjectsChanged?.();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || !token) return;
    const res = await fetch(
      apiUrl(`/projects/${encodeURIComponent(deleteTarget.id)}`),
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.error || 'Could not remove project');
    }
    setDeleteTarget(null);
    await onProjectsChanged?.();
  };

  const deleteMode =
    deleteTarget?.membership === 'owner' ? 'owner' : 'invite';

  return (
    <div style={{
      position: 'relative',
      minHeight: 'calc(100vh - var(--app-top-offset, 0px))',
      backgroundColor: color.bg,
      color: color.text,
      fontFamily: font.family,
    }}>
      <div style={{
        display: isMobile ? 'flex' : 'grid',
        gridTemplateColumns: isMobile
          ? undefined
          : `${HEADER_RAIL_WIDTH_PX}px 1fr ${HEADER_RAIL_WIDTH_PX}px`,
        alignItems: 'center',
        justifyContent: isMobile ? 'space-between' : undefined,
        columnGap: space[3],
        padding: isMobile
          ? `calc(${space[2]}px + var(--safe-top, 0px)) calc(${space[3]}px + var(--safe-right, 0px)) ${space[2]}px calc(${space[3]}px + var(--safe-left, 0px))`
          : `${space[4]}px ${space[6]}px`,
        boxSizing: 'border-box',
        borderBottom: `1px solid ${color.border}`,
        gap: isMobile ? space[2] : undefined,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: space[2],
          flexShrink: 0,
        }}>
          <ProfileAvatarMenu user={user} size={24} />
          {user ? (
            <TokensPill
              tokens={user.tokens ?? 0}
              size={isMobile ? 'sm' : 'md'}
              onClick={() => setTokensOpen(true)}
            />
          ) : null}
        </div>
        {isMobile ? null : (
          <p style={{
            fontSize: font.size.lg,
            fontWeight: font.weight.semibold,
            letterSpacing: '-0.01em',
            margin: 0,
            textAlign: 'center',
            color: color.text,
          }}>
            CoCreate
          </p>
        )}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          flexShrink: 0,
        }}>
          <button
            type="button"
            className={`btn btn-primary${isMobile ? ' btn-sm' : ''}`}
            onClick={handleCreateClick}
            data-onboard="create-button"
          >
            {isMobile ? 'Create' : 'Create project'}
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <EmptyProjectsState onCreate={handleCreateClick} />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile
            ? '1fr'
            : 'repeat(auto-fill, minmax(260px, 1fr))',
          columnGap: space[4],
          rowGap: space[4],
          padding: isMobile
            ? `${space[3]}px calc(${space[3]}px + var(--safe-right, 0px)) calc(${space[6]}px + var(--safe-bottom, 0px)) calc(${space[3]}px + var(--safe-left, 0px))`
            : `${space[6]}px`,
          boxSizing: 'border-box',
        }}>
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => handleProjectClick(project)}
              onRename={(p) => setRenameTarget(p)}
              onShare={(p) => setShareTarget(p)}
              onDelete={(p) => setDeleteTarget(p)}
            />
          ))}
        </div>
      )}

      <TokensModal open={tokensOpen} onClose={() => setTokensOpen(false)} />

      <NewProjectModal
        open={!!createOpen}
        onClose={onCloseCreate}
        onSubmit={onCreateSubmit}
        pendingError={createResult}
      />

      <RenameProjectModal
        open={!!renameTarget}
        project={renameTarget}
        onClose={() => setRenameTarget(null)}
        onSubmit={handleRenameSubmit}
      />

      <DeleteProjectDialog
        open={!!deleteTarget}
        project={deleteTarget}
        mode={deleteMode}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />

      {shareTarget ? (
        <ShareModal
          projectId={shareTarget.id}
          authToken={token}
          onClose={() => setShareTarget(null)}
        />
      ) : null}

      <LauncherOnboarding />
    </div>
  );
};

export default FolderView;
