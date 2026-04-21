const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    ping: (message) => ipcRenderer.invoke('ping', message),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (data) => ipcRenderer.invoke('save-settings', data),
    
    // [BARU] Sesi 4
    startSession: (eventName) => ipcRenderer.invoke('start-session', eventName),
    saveCapture: (data) => ipcRenderer.invoke('save-capture', data)
});