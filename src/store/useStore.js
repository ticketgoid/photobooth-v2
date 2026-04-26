import { create } from 'zustand';

export const useStore = create((set) => ({
    // === GLOBAL DATA ===
    settings: null,
    templates: [], // Array dari database SQLite
    serverIP: null, // IP Lokal Kiosk (Untuk QR Kasir)
    
    // === UI STATE ===
    isAdminOpen: false,
    currentScreen: 'landing', 
    
    // === SESSION STATE ===
    sessionFolder: null,
    capturedPhotos: [null, null, null],
    retakesLeft: 3,
    
    // === PAYMENT STATE ===
    paymentAmount: 15000,
    nextScreenAfterPayment: 'camera', 
    
    // === ACTIONS: UI & ROUTING ===
    toggleAdmin: () => set((state) => ({ isAdminOpen: !state.isAdminOpen })),
    setScreen: (screenName) => set({ currentScreen: screenName }),
    
    // === ACTIONS: SESSION ===
    setSessionFolder: (path) => set({ sessionFolder: path }),
    setCapturedPhotos: (photos) => set({ capturedPhotos: photos }),
    decrementRetake: () => set((state) => ({ retakesLeft: state.retakesLeft - 1 })),
    resetSession: () => set({ capturedPhotos: [null, null, null], retakesLeft: 3, sessionFolder: null }),
    
    // === ACTIONS: PAYMENT ===
    setupPayment: (amount, nextScreen) => set({ paymentAmount: amount, nextScreenAfterPayment: nextScreen, currentScreen: 'payment' }),
    
    // === ACTIONS: ASYNC FETCHING ===
    fetchSettings: async () => {
        if (window.electronAPI) {
            const data = await window.electronAPI.getSettings();
            set({ settings: data });
        }
    },
    fetchTemplates: async () => {
        if (window.electronAPI) {
            const data = await window.electronAPI.getTemplates();
            set({ templates: data || [] });
        }
    },
    fetchServerIP: async () => {
        if (window.electronAPI) {
            const ip = await window.electronAPI.getServerIP();
            set({ serverIP: ip });
        }
    }
}));