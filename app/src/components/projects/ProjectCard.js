import React from 'react';

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

const ProjectCard = ({ project, onClick }) => {
  const thumb =
    project.thumbnail != null && String(project.thumbnail).trim()
      ? String(project.thumbnail).trim()
      : null;

  return (
    <div className="project" style={{ cursor: 'pointer' }} onClick={onClick}>
      {thumb ? (
        <img
          src={thumb}
          alt=""
          style={{
            width: '100%',
            aspectRatio: '16 / 9',
            backgroundColor: '#F2F2F2',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            aspectRatio: '16 / 9',
            backgroundColor: '#D9D9D9',
          }}
        />
      )}
      <div style={{ padding: '2px' }}>
        <div style={{ fontSize: 16 }} className="project-name">{project.name}</div>
        <div style={{ fontSize: 8 }} className="project-time">
          Last Edited: {formatTimestamp(project.lastEdited)}
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;
