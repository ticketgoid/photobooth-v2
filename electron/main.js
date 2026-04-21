const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./database');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const midtransClient = require('midtrans-client');

const coreApi = new midtransClient.CoreApi({
    isProduction: false,
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY
});

console.log("[BACKEND] Status API Key Midtrans:", !!process.env.MIDTRANS_SERVER_KEY ? "Loaded dari .env" : "Menggunakan Fallback");

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true, // WAJIB TRUE untuk keamanan
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Deteksi environment: Dev vs Prod
    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools(); // Buka DevTools otomatis di mode dev
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// --- IPC HANDLERS ---
ipcMain.handle('ping', async (event, message) => {
    return "PONG! Komunikasi IPC Berhasil.";
});

// [BARU] Handler untuk mengambil dan menyimpan pengaturan
ipcMain.handle('get-settings', () => {
    return db.prepare('SELECT * FROM settings ORDER BY id DESC LIMIT 1').get();
});

ipcMain.handle('save-settings', (event, data) => {
    const stmt = db.prepare(`
        UPDATE settings 
        SET nama_event=?, saldo_awal=?, hpp_kertas=?, hpp_tinta=?, biaya_ops=? 
        WHERE id=1
    `);
    stmt.run(data.nama_event, data.saldo_awal, data.hpp_kertas, data.hpp_tinta, data.biaya_ops);
    return true;
});

// --- IPC HANDLERS UNTUK FILE SYSTEM & CAMERA ---

// 1. Buat hierarki folder otomatis
ipcMain.handle('start-session', async (event, eventName) => {
    // Kita simpan di folder Documents komputer agar mudah diakses Admin
    const baseDir = path.join(app.getPath('documents'), 'Photobooth_Output');
    
    // Format Tanggal (YYYY-MM-DD) & Waktu (HH-mm-ss)
    const dateStr = new Date().toISOString().split('T')[0]; 
    const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
    
    // Path: Documents/Photobooth_Output/2026-04-21_NamaEvent/14-30-22_Customer
    const safeEventName = (eventName || 'DefaultEvent').replace(/[^a-zA-Z0-9]/g, '_');
    const eventDir = path.join(baseDir, `${dateStr}_${safeEventName}`);
    const sessionDir = path.join(eventDir, `${timeStr}_Customer`);

    // Eksekusi pembuatan folder secara sinkron
    if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir);
    if (!fs.existsSync(eventDir)) fs.mkdirSync(eventDir);
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir);

    console.log(`[BACKEND] Folder Sesi Dibuat: ${sessionDir}`);
    return sessionDir; // Kembalikan path ke React
});

// 2. Simpan Base64 menjadi file fisik .jpg
ipcMain.handle('save-capture', async (event, { folderPath, base64Data, index }) => {
    try {
        // Buang header "data:image/jpeg;base64,"
        const base64Image = base64Data.split(';base64,').pop();
        const buffer = Buffer.from(base64Image, 'base64');
        
        const filePath = path.join(folderPath, `raw_${index}.jpg`);
        fs.writeFileSync(filePath, buffer);
        
        console.log(`[BACKEND] Foto disimpan: ${filePath}`);
        return { success: true, path: filePath };
    } catch (err) {
        console.error(`[BACKEND] Gagal menyimpan foto:`, err);
        return { success: false, error: err.message };
    }
});

// --- IPC HANDLERS UNTUK PEMBAYARAN (Sesi 6) ---

ipcMain.handle('create-qris', async (event, amount) => {
    const orderId = `ORDER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const parameter = {
        payment_type: "qris",
        transaction_details: { order_id: orderId, gross_amount: amount },
        qris: { acquirer: "gopay" }
    };

    try {
        console.log(`[BACKEND] Meminta QRIS ke Midtrans untuk Rp ${amount}...`);
        const chargeResponse = await coreApi.charge(parameter);
        const qrAction = chargeResponse.actions?.find(a => a.name === 'generate-qr-code');
        
        if (qrAction) {
            console.log(`[BACKEND] Sukses mendapat URL QRIS!`);
            return { success: true, orderId: orderId, qrUrl: qrAction.url };
        }
        
        console.error(`[BACKEND] Midtrans tidak mengembalikan QR URL:`, chargeResponse);
        return { success: false, error: "Midtrans gagal mengembalikan QR URL" };
    } catch (e) {
        console.error(`[BACKEND] Error API Midtrans:`, e.message);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('check-payment', async (event, orderId) => {
    try {
        const statusResponse = await coreApi.transaction.status(orderId);
        return { success: true, status: statusResponse.transaction_status };
    } catch (e) {
        return { success: false, error: e.message };
    }
});