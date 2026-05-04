/**
 * Electron implementation of the platform interface. Each method is a thin
 * wrapper around the IPC channels exposed by `main/preload.js`. Keep this
 * file the only place in the renderer that touches `window.electron` so
 * the web build stays clean.
 */
const e = () => window.electron;
const ipc = () => window.electron.ipcRenderer;

const electronPlatform = {
  isElectron: true,

  capabilities: {
    hasNativeChrome: true,
    hasNativeSaveDialog: true,
    hasNativeFonts: true,
    hasVideoEncoder:
      typeof window !== 'undefined' && 'VideoEncoder' in window,
  },

  /**
   * Resize the existing window to fullscreen and navigate to the editor
   * route. We used to spawn a separate BrowserWindow for the editor, but
   * the router now handles in-window navigation and the launcher / editor
   * are the same React tree — keep one window, two routes.
   */
  openProject: async ({ projectId, token }) => {
    await e().openProjectWindow({ projectId, token });
    return true;
  },

  openExternal: (url) => e().openExternalLink(url),

  /**
   * Auth-token handoff for the editor window. The launcher passes a token
   * via `openProjectWindow`; the editor window then reads it back here. The
   * web build doesn't need this dance — it reads the same token from
   * localStorage — so keep callers tolerant of either path.
   */
  getEditorAuthToken: () => e().getViewerAuthToken(),

  /**
   * CORS bypass: storage hosts (fal, etc.) don't always send ACAO so a
   * renderer-side fetch fails. Main process has no CORS, so we proxy bytes
   * through it and wrap them in a Blob on the renderer side.
   */
  fetchBytes: async (url) => {
    const { buffer, contentType } = await ipc().invoke(
      'fetch-remote-bytes',
      url,
    );
    return { buffer, contentType: contentType || '' };
  },

  /** Native save dialog. Returns the chosen path or null if cancelled. */
  pickSavePath: async ({ suggestedName, extension }) => {
    const path = await ipc().invoke('pick-export-path', {
      suggestedName,
      extension,
    });
    if (!path) return null;
    return { kind: 'electron-path', path, suggestedName };
  },

  /** Persist an export buffer to the path returned by pickSavePath. */
  writeFile: async (target, buffer) => {
    if (!target || target.kind !== 'electron-path') {
      throw new Error('writeFile: invalid target');
    }
    return ipc().invoke('write-export-buffer', {
      path: target.path,
      buffer,
    });
  },

  listSystemFonts: () => ipc().invoke('get-system-fonts'),

  window: {
    close: () => ipc().invoke('close-app'),
    minimize: () => ipc().invoke('minimize-app'),
    maximize: () => ipc().invoke('maximize-app'),
  },
};

export default electronPlatform;
