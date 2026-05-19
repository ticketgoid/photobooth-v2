import { create } from 'zustand';

export const useStore = create((set) => ({
    settings: null,
    templates: [], 
    serverIP: null,
    
    activeEvent: null, 
    recentEvents: [], // [BARU] Menampung 10 event terakhir
    
    isAdminOpen: false, 
    currentScreen: 'loading', 
    
    sessionFolder: null,
    capturedPhotos: [],
    retakesLeft: 3,
    paymentAmount: 0,
    nextScreenAfterPayment: 'camera', 
    
    setScreen: (screenName) => set({ currentScreen: screenName }),
    
    setSessionFolder: (path) => set({ sessionFolder: path }),
    setCapturedPhotos: (photos) => set({ capturedPhotos: photos }),
    decrementRetake: () => set((state) => ({ retakesLeft: state.retakesLeft - 1 })),
    resetCustomerSession: () => set({ capturedPhotos: [], retakesLeft: 3, sessionFolder: null }),
    setupPayment: (amount, nextScreen) => set({ paymentAmount: amount, nextScreenAfterPayment: nextScreen, currentScreen: 'payment' }),
    
    fetchSettings: async () => { if (window.electronAPI) set({ settings: await window.electronAPI.getSettings() }); },
    fetchTemplates: async () => { if (window.electronAPI) set({ templates: await window.electronAPI.getTemplates() || [] }); },
    fetchServerIP: async () => { if (window.electronAPI) set({ serverIP: await window.electronAPI.getServerIP() }); },
    
    // [BARU] Fetch riwayat event
    fetchRecentEvents: async () => {
        if (window.electronAPI) set({ recentEvents: await window.electronAPI.getRecentEvents() || [] });
    },

    fetchActiveEvent: async () => {
        if (window.electronAPI) {
            const event = await window.electronAPI.getActiveEvent();
            if (event) {
                set({ activeEvent: event, currentScreen: 'landing' });
            } else {
                set({ activeEvent: null, currentScreen: 'session_manager' });
            }
        }
    }
}));