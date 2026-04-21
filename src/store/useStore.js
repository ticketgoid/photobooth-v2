import { create } from 'zustand';

export const useStore = create((set) => ({
    settings: null,
    isAdminOpen: false,
    currentScreen: 'landing', 
    sessionFolder: null,
    capturedPhotos: [null, null, null],
    retakesLeft: 3,
    
    // [BARU] Sesi 6: State Pembayaran
    paymentAmount: 15000,
    nextScreenAfterPayment: 'camera', // 'camera' (awal) atau 'review' (upsell cetak)
    
    toggleAdmin: () => set((state) => ({ isAdminOpen: !state.isAdminOpen })),
    setScreen: (screenName) => set({ currentScreen: screenName }),
    setSessionFolder: (path) => set({ sessionFolder: path }),
    setCapturedPhotos: (photos) => set({ capturedPhotos: photos }),
    decrementRetake: () => set((state) => ({ retakesLeft: state.retakesLeft - 1 })),
    resetSession: () => set({ capturedPhotos: [null, null, null], retakesLeft: 3, sessionFolder: null }),
    
    // [BARU] Action Pembayaran
    setupPayment: (amount, nextScreen) => set({ paymentAmount: amount, nextScreenAfterPayment: nextScreen, currentScreen: 'payment' }),
    
    fetchSettings: async () => {
        if (window.electronAPI) {
            const data = await window.electronAPI.getSettings();
            set({ settings: data });
        }
    }
}));