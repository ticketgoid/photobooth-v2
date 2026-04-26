const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    ping: (message) => ipcRenderer.invoke('ping', message),
    
    // Settings & System Server
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (data) => ipcRenderer.invoke('save-settings', data),
    getServerIP: () => ipcRenderer.invoke('get-server-ip'), // [BARU] IP Kiosk untuk Kasir
    
    // Core Sesi & Capture
    startSession: (eventName) => ipcRenderer.invoke('start-session', eventName),
    saveCapture: (data) => ipcRenderer.invoke('save-capture', data),
    
    // Pembayaran
    createQris: (amount) => ipcRenderer.invoke('create-qris', amount),
    checkPayment: (orderId) => ipcRenderer.invoke('check-payment', orderId),

    // [BARU] Template Management (Database-Driven)
    getTemplates: () => ipcRenderer.invoke('get-templates'),
    openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
    saveNewTemplate: (data) => ipcRenderer.invoke('save-new-template', data),
    updateTemplate: (data) => ipcRenderer.invoke('update-template', data),
    deleteTemplate: (id) => ipcRenderer.invoke('delete-template', id)
});