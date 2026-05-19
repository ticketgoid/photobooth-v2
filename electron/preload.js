const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    ping: (message) => ipcRenderer.invoke('ping', message),
    
    // --- GLOBAL SETTINGS ---
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (data) => ipcRenderer.invoke('save-settings', data),
    getServerIP: () => ipcRenderer.invoke('get-server-ip'), 
    
    // --- EVENT SESSION MANAGEMENT ---
    getActiveEvent: () => ipcRenderer.invoke('get-active-event'),
    getRecentEvents: () => ipcRenderer.invoke('get-recent-events'), // [BUG FIXED]
    reopenEvent: (eventId) => ipcRenderer.invoke('reopen-event', eventId), // [BUG FIXED]
    createEvent: (data) => ipcRenderer.invoke('create-event', data),
    closeEvent: (eventId) => ipcRenderer.invoke('close-event', eventId),

    // --- MASTER TEMPLATES ---
    getTemplates: () => ipcRenderer.invoke('get-templates'),
    openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
    saveNewTemplate: (data) => ipcRenderer.invoke('save-new-template', data),
    updateTemplate: (data) => ipcRenderer.invoke('update-template', data),
    deleteTemplate: (id) => ipcRenderer.invoke('delete-template', id),

    // --- TRANSAKSI & CAPTURE ---
    startCustomerSession: (eventId) => ipcRenderer.invoke('start-customer-session', eventId),
    saveCapture: (data) => ipcRenderer.invoke('save-capture', data),
    processImages: (data) => ipcRenderer.invoke('process-images', data),
    
    // --- PEMBAYARAN MIDTRANS ---
    createQris: (amount) => ipcRenderer.invoke('create-qris', amount),
    checkPayment: (orderId) => ipcRenderer.invoke('check-payment', orderId)
});