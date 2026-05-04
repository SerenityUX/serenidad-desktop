/**
 * Platform abstraction. The renderer code is identical between Electron
 * and the web build — capability differences (native save dialog, system
 * fonts, multi-window, etc.) live entirely behind this seam.
 *
 * Detection: `window.electron` is injected by `main/preload.js` only inside
 * the Electron renderer. In the web build, that bridge doesn't exist so we
 * fall through to the browser implementation.
 */
import electronImpl from './electron';
import webImpl from './web';

export const isElectron =
  typeof window !== 'undefined' && !!window.electron;

const platform = isElectron ? electronImpl : webImpl;

export default platform;
