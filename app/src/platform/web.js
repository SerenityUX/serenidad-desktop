/**
 * Web implementation of the platform interface. Uses standard browser APIs
 * — File System Access for save, queryLocalFonts when available, plain
 * fetch for remote bytes — with sane fallbacks where APIs aren't supported
 * (Firefox, Safari).
 *
 * Auth: this file MUST stay in sync with AuthContext's TOKEN_KEY. We can't
 * import it from here because the editor reads the token before any React
 * tree mounts.
 */
const TOKEN_KEY = 'serenidad_auth_token';

/**
 * Curated baseline shown when neither queryLocalFonts is available nor
 * permitted. Kept tiny on purpose — the editor's font picker is meant for
 * captions, not typography exploration.
 */
const FALLBACK_FONTS = [
  { name: 'Arial', weights: [400, 700] },
  { name: 'Helvetica', weights: [400, 700] },
  { name: 'Georgia', weights: [400, 700] },
  { name: 'Times New Roman', weights: [400, 700] },
  { name: 'Courier New', weights: [400, 700] },
  { name: 'Verdana', weights: [400, 700] },
  { name: 'Trebuchet MS', weights: [400, 700] },
  { name: 'Inter', weights: [300, 400, 500, 600, 700] },
];

function inferWeightFromName(postscript, fullName) {
  const ps = String(postscript || '').toLowerCase();
  const full = String(fullName || '').toLowerCase();
  if (ps.includes('thin') || full.includes('thin')) return 100;
  if (ps.includes('extralight') || full.includes('extra light')) return 200;
  if (ps.includes('light')) return 300;
  if (ps.includes('medium')) return 500;
  if (ps.includes('semibold') || full.includes('semi bold')) return 600;
  if (ps.includes('extrabold') || full.includes('extra bold')) return 800;
  if (ps.includes('bold')) return 700;
  if (ps.includes('black') || full.includes('black')) return 900;
  return 400;
}

const webPlatform = {
  isElectron: false,

  capabilities: {
    hasNativeChrome: false,
    hasNativeSaveDialog:
      typeof window !== 'undefined' && 'showSaveFilePicker' in window,
    hasNativeFonts:
      typeof window !== 'undefined' && 'queryLocalFonts' in window,
    hasVideoEncoder:
      typeof window !== 'undefined' && 'VideoEncoder' in window,
  },

  /**
   * Web "open project" is a same-tab navigation. The router picks up the
   * route on the other side. Token isn't passed here because the web build
   * reads it from localStorage (same origin, same key).
   */
  openProject: ({ projectId }) => {
    const id = encodeURIComponent(String(projectId));
    window.location.assign(`/project/${id}`);
    return Promise.resolve(true);
  },

  openExternal: (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    return Promise.resolve();
  },

  getEditorAuthToken: () => {
    try {
      return Promise.resolve(localStorage.getItem(TOKEN_KEY));
    } catch {
      return Promise.resolve(null);
    }
  },

  /**
   * No CORS bypass available — the storage host must send ACAO. If it
   * doesn't, the call fails with a generic "Failed to fetch" and the
   * caller surfaces it. The fix lives in the storage layer, not here.
   */
  fetchBytes: async (url) => {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) {
      throw new Error(`fetch failed: ${res.status} ${res.statusText} for ${url}`);
    }
    const ab = await res.arrayBuffer();
    return {
      buffer: new Uint8Array(ab),
      contentType: res.headers.get('content-type') || '',
    };
  },

  /**
   * File System Access path returns a writable file handle. Browsers that
   * don't support it (Firefox/Safari) fall through to a download-style
   * write — same UX, just less control over destination.
   */
  pickSavePath: async ({ suggestedName, extension }) => {
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName,
          types: [
            {
              description: extension === 'mp4' ? 'MP4 Video' : extension.toUpperCase(),
              accept: {
                [extension === 'mp4'
                  ? 'video/mp4'
                  : 'application/octet-stream']: [`.${extension}`],
              },
            },
          ],
        });
        return { kind: 'fs-handle', handle, suggestedName, extension };
      } catch (err) {
        if (err && err.name === 'AbortError') return null;
        // Permission failures fall through to the download path.
      }
    }
    return { kind: 'download', suggestedName, extension };
  },

  writeFile: async (target, buffer) => {
    if (!target) throw new Error('writeFile: missing target');
    const data =
      buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

    if (target.kind === 'fs-handle' && target.handle) {
      const writable = await target.handle.createWritable();
      await writable.write(data);
      await writable.close();
      return target.suggestedName;
    }

    const mime = target.extension === 'mp4'
      ? 'video/mp4'
      : 'application/octet-stream';
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = target.suggestedName || `export.${target.extension || 'bin'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return target.suggestedName;
  },

  listSystemFonts: async () => {
    if ('queryLocalFonts' in window) {
      try {
        const fonts = await window.queryLocalFonts();
        const map = new Map();
        for (const f of fonts) {
          const family = f.family;
          const weight = inferWeightFromName(f.postscriptName, f.fullName);
          if (!map.has(family)) map.set(family, new Set());
          map.get(family).add(weight);
        }
        if (map.size > 0) {
          return Array.from(map, ([name, weights]) => ({
            name,
            weights: Array.from(weights).sort((a, b) => a - b),
          }));
        }
      } catch {
        // Permission denied or unsupported environment — fall through.
      }
    }
    return FALLBACK_FONTS;
  },

  window: {
    close: () => Promise.resolve(),
    minimize: () => Promise.resolve(),
    maximize: () => Promise.resolve(),
  },
};

export default webPlatform;
