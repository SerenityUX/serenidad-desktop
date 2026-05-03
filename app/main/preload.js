const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  getViewerAuthToken: () => ipcRenderer.invoke('get-viewer-auth-token'),
  openProjectWindow: (payload) => ipcRenderer.invoke('open-project-window', payload),
  openExternalLink: (url) => ipcRenderer.invoke('open-external-link', url),
  closeWindow: () => ipcRenderer.send('close-window'),
  ipcRenderer: {
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    on: (channel, func) => {
      const subscription = (_event, ...args) => func(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    },
    once: (channel, func) => {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
    removeListener: (channel, func) => {
      ipcRenderer.removeListener(channel, func);
    },
    removeAllListeners: (channel) => {
      ipcRenderer.removeAllListeners(channel);
    },
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  },
});
