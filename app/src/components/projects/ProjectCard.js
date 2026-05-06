import React, { useState } from 'react';
import ProjectMenu from './ProjectMenu';
import { color, font, radius, space } from '../../lib/tokens';

const formatTimestamp = (ts) => {
  if (ts == null) return '—';
  const d = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(d);
};

const ProjectCard = ({ project, onClick, onRename, onShare, onDelete }) => {
  const [hovered, setHovered] = useState(false);
  const thumb =
    project.thumbnail != null && String(project.thumbnail).trim()
      ? String(project.thumbnail).trim()
      : null;
  const isOwner = project.membership === 'owner';

  return (
    <div
      className="project"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        cursor: 'pointer',
        borderRadius: radius.lg,
        border: `1px solid ${hovered ? color.borderStrong : color.border}`,
        overflow: 'hidden',
        backgroundColor: color.bg,
        transition: 'border-color 120ms ease, background-color 120ms ease',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 9',
          backgroundColor: color.bgSubtle,
          backgroundImage: thumb ? `url("${thumb}")` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          borderBottom: `1px solid ${color.border}`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: space[2],
            right: space[2],
            opacity: hovered ? 1 : 0,
            transition: 'opacity 120ms ease',
          }}
        >
          <ProjectMenu
            isOwner={isOwner}
            onRename={isOwner ? () => onRename?.(project) : undefined}
            onShare={() => onShare?.(project)}
            onDelete={() => onDelete?.(project)}
          />
        </div>
      </div>
      <div
        style={{
          padding: `${space[2]}px ${space[3]}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <div
          style={{
            fontSize: font.size.base,
            fontWeight: font.weight.medium,
            color: color.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {project.name}
        </div>
        <div
          style={{
            fontSize: font.size.sm,
            color: color.textMuted,
            display: 'flex',
            alignItems: 'center',
            gap: space[2],
          }}
        >
          <span>{formatTimestamp(project.lastEdited)}</span>
          {!isOwner ? (
            <span
              style={{
                fontSize: font.size.xs,
                color: color.textFaint,
                border: `1px solid ${color.border}`,
                borderRadius: radius.sm,
                padding: '0 6px',
                lineHeight: '16px',
              }}
            >
              Shared
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
