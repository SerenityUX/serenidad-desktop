import React from 'react';

const formatTimestamp = (ts) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).format(new Date(ts));

const ProjectCard = ({ project, onClick }) => (
  <div className="project" style={{ cursor: 'pointer' }} onClick={onClick}>
    <img style={{ position: 'absolute' }} alt="" />
    <img
      style={{
        width: '100%',
        height: 'fit-object',
        backgroundColor: '#F2F2F2',
        objectFit: 'contain',
        aspectRatio: 16 / 9,
        display: 'flex',
      }}
      src={project.thumbnail}
      alt={project.name}
    />
    <div style={{ padding: '2px' }}>
      <div style={{ fontSize: 16 }} className="project-name">{project.name}</div>
      <div style={{ fontSize: 8 }} className="project-time">
        Last Edited: {formatTimestamp(project.lastEdited)}
      </div>
    </div>
  </div>
);

export default ProjectCard;
