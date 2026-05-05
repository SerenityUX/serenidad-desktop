import React from 'react';

const NoFolderView = ({ onSelectFolder }) => (
  <div>
    <h1>Welcome to CoCreate Cafe</h1>
    <p>Please select your CoCreate Cafe folder to get started.</p>
    <button onClick={onSelectFolder}>Select Your CoCreate Cafe Folder</button>
  </div>
);

export default NoFolderView;
