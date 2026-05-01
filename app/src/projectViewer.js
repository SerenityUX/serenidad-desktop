import React from 'react';
import { createRoot } from 'react-dom/client';
import ProjectComponent from './components/editor/ProjectComponent';

const urlParams = new URLSearchParams(window.location.search);
const rawPath = urlParams.get('filePath');
const filePath = rawPath ? decodeURIComponent(rawPath) : null;

const container = document.getElementById('root');
const root = createRoot(container);

root.render(<ProjectComponent filePath={filePath} />);
