const { app, shell, BrowserWindow, ipcMain, screen, dialog } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs-extra');
const fontkit = require('fontkit');
const glob = require('glob');

let mainWindow;
let viewerAuthToken = null;

function getResourcePath(filename) {
  return app.isPackaged
    ? path.join(process.resourcesPath, filename)
    : path.join(__dirname, '..', filename);
}

function getAppIconPath() {
  const pngName = 'KodanFlower-dock.png';
  const icnsName = 'KodanFlower.icns';

  if (!app.isPackaged) {
    const devRoot = path.join(__dirname, '..');
    const devPng = path.join(devRoot, pngName);
    if (fs.existsSync(devPng)) return devPng;
    return path.join(devRoot, icnsName);
  }

  const resPng = path.join(process.resourcesPath, pngName);
  if (fs.existsSync(resPng)) return resPng;
  const resIcns = path.join(process.resourcesPath, icnsName);
  if (fs.existsSync(resIcns)) return resIcns;
  return path.join(__dirname, '..', icnsName);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    icon: getAppIconPath(),
    width: 652,
    height: 560,
    resizable: false,
    minimizable: true,
    maximizable: false,
    closable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../dist/index.html')).catch((err) => {
    console.error('Failed to load index.html:', err);
  });

  if (process.env.OPEN_DEVTOOLS === '1') {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    });
  }
}

function createProjectWindow(projectId) {
  if (!projectId || typeof projectId !== 'string') {
    console.error('createProjectWindow: missing projectId');
    return;
  }
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const projectWindow = new BrowserWindow({
    width,
    height,
    icon: getAppIconPath(),
    resizable: true,
    minimizable: true,
    maximizable: true,
    closable: true,
    frame: false,
    title: 'Project Viewer',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Single SPA: load index.html and route to the editor via hash. Used to
  // be a separate project-viewer.html bundle; the router handles it now.
  const indexHtmlPath = path.join(__dirname, '../dist/index.html');
  const indexUrl = new URL(pathToFileURL(indexHtmlPath).href);
  indexUrl.hash = `/project/${encodeURIComponent(projectId)}`;
  projectWindow.loadURL(indexUrl.href);

  projectWindow.on('closed', () => {
    viewerAuthToken = null;
  });
}

// ---------- App lifecycle ----------
app.whenReady().then(() => {
  const iconPath = getAppIconPath();
  if (process.platform === 'darwin' && app.dock && fs.existsSync(iconPath)) {
    const dockResult = app.dock.setIcon(iconPath);
    if (dockResult != null && typeof dockResult.catch === 'function') {
      dockResult.catch((err) =>
        console.warn('Dock icon failed:', err && err.message ? err.message : err),
      );
    }
  }
  createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------- Window controls ----------
ipcMain.handle('close-app', () => {
  app.quit();
});

ipcMain.handle('minimize-app', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.minimize();
});

ipcMain.handle('maximize-app', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});

ipcMain.on('close-window', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.close();
});

ipcMain.on('close-main-window', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setClosable(true);
    mainWindow.close();
  }
});

// ---------- Project viewer (cloud project) ----------
ipcMain.handle('get-viewer-auth-token', async () => viewerAuthToken);

ipcMain.handle('open-project-window', async (_event, payload) => {
  const projectId =
    payload && typeof payload.projectId === 'string' ? payload.projectId : null;
  const token =
    payload && typeof payload.token === 'string' && payload.token.trim()
      ? payload.token.trim()
      : null;
  if (!projectId) return false;
  viewerAuthToken = token;
  createProjectWindow(projectId);
  return true;
});

ipcMain.handle('open-external-link', (_event, url) => {
  shell.openExternal(url);
});

// ---------- System fonts ----------
ipcMain.handle('get-system-fonts', async () => {
  try {
    const fontDirs = [
      '/System/Library/Fonts',
      '/Library/Fonts',
      `${process.env.HOME}/Library/Fonts`,
    ];

    const fontFiles = fontDirs.flatMap((dir) =>
      glob.sync(path.join(dir, '**/*.{ttf,otf}')),
    );

    const fontMap = new Map();
    const arialWeights = new Set();

    for (const file of fontFiles) {
      try {
        const font = fontkit.openSync(file);
        const family = font.familyName;
        let weight = 400;

        const psName = font.postscriptName.toLowerCase();
        const fullName = font.fullName.toLowerCase();

        if (psName.includes('thin') || fullName.includes('thin')) weight = 100;
        else if (psName.includes('extralight') || fullName.includes('extra light')) weight = 200;
        else if (psName.includes('light')) weight = 300;
        else if (psName.includes('medium')) weight = 500;
        else if (psName.includes('semibold') || fullName.includes('semi bold')) weight = 600;
        else if (psName.includes('extrabold') || fullName.includes('extra bold')) weight = 800;
        else if (psName.includes('bold')) weight = 700;
        else if (psName.includes('black') || fullName.includes('black')) weight = 900;

        if (family.toLowerCase() === 'arial') arialWeights.add(weight);

        if (!fontMap.has(family)) fontMap.set(family, new Set());
        fontMap.get(family).add(weight);
      } catch (err) {
        console.error(`Error processing font file ${file}:`, err);
      }
    }

    let result = Array.from(fontMap, ([name, weights]) => ({
      name,
      weights: Array.from(weights).sort((a, b) => a - b),
    }));

    if (arialWeights.size > 0) {
      const arialEntry = result.find((f) => f.name.toLowerCase() === 'arial');
      if (arialEntry) {
        result = [arialEntry, ...result.filter((f) => f.name.toLowerCase() !== 'arial')];
      }
    }

    return result;
  } catch (error) {
    console.error('Error fetching system fonts:', error);
    return [];
  }
});

// ---------- Project export ----------
/**
 * Two-step export. The renderer asks for a destination first so the save
 * dialog opens immediately on click, then it encodes via WebCodecs and ships
 * the resulting mp4 buffer back to be written to disk.
 */
ipcMain.handle('pick-export-path', async (_event, payload) => {
  const { suggestedName = 'export.mp4', extension = 'mp4' } = payload || {};
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export Project',
    defaultPath: suggestedName,
    filters: [{ name: 'Video', extensions: [extension] }],
  });
  if (canceled || !filePath) return null;
  const ext = `.${extension}`;
  return filePath.toLowerCase().endsWith(ext) ? filePath : `${filePath}${ext}`;
});

/**
 * Fetch a remote URL from the main process so the renderer can dodge CORS.
 * Used by the export pipeline (composeScene + exportProject), which needs
 * raw bytes to draw remote images/videos onto a canvas — `fetch(url, {mode:
 * 'cors'})` from the renderer fails with "Failed to fetch" against storage
 * hosts that don't send Access-Control-Allow-Origin.
 *
 * Returns `{ buffer, contentType }`. `buffer` is a Node Buffer; Electron's
 * structured-clone serializes it back to the renderer as a Uint8Array, which
 * the renderer wraps in a Blob.
 */
ipcMain.handle('fetch-remote-bytes', async (_event, url) => {
  if (!url || typeof url !== 'string') {
    throw new Error('fetch-remote-bytes: url required');
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetch-remote-bytes: ${res.status} ${res.statusText} for ${url}`);
  }
  const ab = await res.arrayBuffer();
  return {
    buffer: Buffer.from(ab),
    contentType: res.headers.get('content-type') || '',
  };
});

ipcMain.handle('write-export-buffer', async (_event, payload) => {
  const { path: targetPath, buffer } = payload || {};
  if (!targetPath) throw new Error('No target path');
  if (!buffer || (!buffer.byteLength && !buffer.length)) {
    throw new Error('No export data received');
  }
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  await fs.promises.writeFile(targetPath, data);
  shell.showItemInFolder(targetPath);
  return targetPath;
});
