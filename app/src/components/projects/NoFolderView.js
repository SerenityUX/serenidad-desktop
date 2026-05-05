import React from 'react';

const NoFolderView = ({ onSelectFolder }) => (
  <div>
    <h1>Welcome to CoCreate</h1>
    <p>Please select your CoCreate folder to get started.</p>
    <button onClick={onSelectFolder}>Select Your CoCreate Folder</button>
  </div>
);

export default NoFolderView;
