const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    ping: (message) => ipcRenderer.invoke('ping', message),
    
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (data) => ipcRenderer.invoke('save-settings', data),
    getServerIP: () => ipcRenderer.invoke('get-server-ip'), 
    
    getActiveEvent: () => ipcRenderer.invoke('get-active-event'),
    getRecentEvents: () => ipcRenderer.invoke('get-recent-events'),
    reopenEvent: (eventId) => ipcRenderer.invoke('reopen-event', eventId),
    createEvent: (data) => ipcRenderer.invoke('create-event', data),
    closeEvent: (eventId) => ipcRenderer.invoke('close-event', eventId),
    
    // [BARU] Mengambil data statistik Live Dashboard
    getDashboardData: (eventId) => ipcRenderer.invoke('get-dashboard-data', eventId),

    getTemplates: () => ipcRenderer.invoke('get-templates'),
    openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
    saveNewTemplate: (data) => ipcRenderer.invoke('save-new-template', data),
    updateTemplate: (data) => ipcRenderer.invoke('update-template', data),
    deleteTemplate: (id) => ipcRenderer.invoke('delete-template', id),

    startCustomerSession: (eventId) => ipcRenderer.invoke('start-customer-session', eventId),
    saveCapture: (data) => ipcRenderer.invoke('save-capture', data),
    processImages: (data) => ipcRenderer.invoke('process-images', data),
    
    createQris: (amount) => ipcRenderer.invoke('create-qris', amount),
    checkPayment: (orderId) => ipcRenderer.invoke('check-payment', orderId)
});