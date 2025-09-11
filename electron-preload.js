// This file is used to expose specific Electron APIs to the renderer process
// with better security practices

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // You can add specific IPC methods here if needed
  // For example:
  // sendMessage: (message) => ipcRenderer.send('message', message),
  // onMessage: (callback) => ipcRenderer.on('message', callback)
  
  // Auto-update related methods
  onUpdateMessage: (callback) => ipcRenderer.on('message', callback)
});