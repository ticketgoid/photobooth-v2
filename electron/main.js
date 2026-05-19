const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const sharp = require('sharp');
const qrcode = require('qrcode');
const midtransClient = require('midtrans-client');
const express = require('express');

const db = require('./database');

// ==========================================
// 1. SETUP LINGKUNGAN FOLDER
// ==========================================
const USER_TEMPLATES_PATH = path.join(app.getPath('userData'), 'user_templates');
const OUTPUT_PATH = path.join(app.getPath('userData'), 'outputs');
const TEMP_VIDEO_PATH = path.join(app.getPath('userData'), 'temp_videos');

if (!fs.existsSync(USER_TEMPLATES_PATH)) fs.mkdirSync(USER_TEMPLATES_PATH, { recursive: true });
if (!fs.existsSync(OUTPUT_PATH)) fs.mkdirSync(OUTPUT_PATH, { recursive: true });
if (!fs.existsSync(TEMP_VIDEO_PATH)) fs.mkdirSync(TEMP_VIDEO_PATH, { recursive: true });

// ==========================================
// 2. SETUP EXPRESS (LOCAL SERVER UNTUK KASIR)
// ==========================================
const expressApp = express();
const PORT = 3000;
let serverIP = 'localhost';

function getLocalIP() {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal && !name.toLowerCase().includes('vethernet')) {
                return net.address;
            }
        }
    }
    return '127.0.0.1';
}

app.whenReady().then(() => {
    serverIP = getLocalIP();
    
    // API Endpoint
    expressApp.get('/api/status', (req, res) => {
        const settings = db.prepare('SELECT app_mode, nama_event FROM settings WHERE id=1').get();
        res.json({ status: 'OK', machine_ip: serverIP, mode: settings?.app_mode, event: settings?.nama_event });
    });

    // Buka Akses Folder Publik
    expressApp.use('/download', express.static(OUTPUT_PATH));
    expressApp.use('/templates', express.static(USER_TEMPLATES_PATH));

    // [PERBAIKAN BUG]: Front-End Mini untuk HP Kasir saat QR discan
    expressApp.get('/', (req, res) => {
        const settings = db.prepare('SELECT app_mode, nama_event FROM settings WHERE id=1').get();
        res.send(`
            <!DOCTYPE html>
            <html lang="id">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Dashboard Kasir Photobooth</title>
                <style>
                    body { font-family: monospace; background: #a8a4e6; padding: 20px; color: #333; margin: 0; }
                    .card { background: white; border: 4px solid #333; padding: 20px; box-shadow: 4px 4px 0px #333; margin-bottom: 20px; }
                    h1 { margin-top: 0; font-size: 24px; color: #f26d6d; }
                    button { background: #6ebf9f; border: 4px solid #333; padding: 15px; font-weight: bold; width: 100%; box-shadow: 4px 4px 0px #333; font-size: 16px; cursor: pointer; margin-top: 10px; }
                    button:active { box-shadow: none; transform: translate(4px, 4px); }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>⚙️ REMOTE KASIR</h1>
                    <p><b>Event:</b> ${settings?.nama_event || 'Default'}</p>
                    <p><b>Mode Mesin:</b> <span style="background: yellow; padding: 2px 6px; border: 2px solid #333;">${(settings?.app_mode || 'online').toUpperCase()}</span></p>
                    <p><b>Status Koneksi:</b> Terhubung ke Kiosk</p>
                </div>
                
                <div class="card">
                    <p style="margin:0 0 10px 0; font-weight:bold;">Test Koneksi API Lokal:</p>
                    <button onclick="fetch('/api/status').then(r=>r.json()).then(d=>alert('Response PC:\\n' + JSON.stringify(d, null, 2))).catch(e=>alert('Error: ' + e))">
                        PING KIOSK
                    </button>
                </div>
                
                <p style="text-align: center; font-size: 12px;"><i>*Modul Cetak Ulang (Reprint) & Antrean Drive akan ditambahkan di Set 4</i></p>
            </body>
            </html>
        `);
    });

    expressApp.listen(PORT, '0.0.0.0', () => {
        console.log(`[LOCAL SERVER] Menyala di http://${serverIP}:${PORT}`);
    });

    createWindow();
});

// ==========================================
// 3. SETUP BROWSER WINDOW (ELECTRON)
// ==========================================
let mainWindow;
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280, height: 720,
        fullscreen: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ==========================================
// 4. IPC HANDLERS: SETTINGS & SYSTEM
// ==========================================
ipcMain.handle('ping', () => 'PONG');
ipcMain.handle('get-server-ip', () => serverIP);
ipcMain.handle('get-settings', () => db.prepare('SELECT * FROM settings WHERE id=1').get());

ipcMain.handle('save-settings', (event, data) => {
    const stmt = db.prepare(`
        UPDATE settings SET 
        nama_event=?, saldo_awal=?, hpp_kertas=?, hpp_tinta=?, biaya_ops=?, 
        midtrans_server_key=?, midtrans_client_key=?, app_mode=? 
        WHERE id=1
    `);
    stmt.run(
        data.nama_event, data.saldo_awal || 0, data.hpp_kertas || 0, data.hpp_tinta || 0, data.biaya_ops || 0, 
        data.midtrans_server_key || '', data.midtrans_client_key || '', data.app_mode || 'online'
    );
    return true;
});

// ==========================================
// 5. IPC HANDLERS: MANAJEMEN TEMPLATE (CRUD)
// ==========================================
ipcMain.handle('get-templates', () => {
    const rows = db.prepare('SELECT * FROM templates ORDER BY id DESC').all();
    return rows.map(r => ({ ...r, slots: JSON.parse(r.slots_json) }));
});

ipcMain.handle('open-file-dialog', async () => {
    const res = await dialog.showOpenDialog({ filters: [{ name: 'Images', extensions: ['png'] }] });
    return res.canceled ? null : res.filePaths[0];
});

ipcMain.handle('save-new-template', async (event, { tempPath }) => {
    try {
        const metadata = await sharp(tempPath).metadata();
        const filename = `tpl-${Date.now()}.png`;
        const newPath = path.join(USER_TEMPLATES_PATH, filename);
        
        fs.copyFileSync(tempPath, newPath);

        const stmt = db.prepare(`
            INSERT INTO templates (filename, filepath, width, height, is_free, price, is_visible, slots_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(filename, newPath, metadata.width, metadata.height, 0, 15000, 1, '[]');
        
        return { success: true, id: info.lastInsertRowid };
    } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('update-template', async (event, data) => {
    try {
        const stmt = db.prepare(`
            UPDATE templates SET 
            is_free=?, price=?, is_visible=?, slots_json=?
            WHERE id=?
        `);
        stmt.run(
            data.is_free ? 1 : 0, data.price || 0, data.is_visible ? 1 : 0, 
            JSON.stringify(data.slots || []), data.id
        );
        return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('delete-template', async (event, id) => {
    try {
        const tpl = db.prepare('SELECT filepath FROM templates WHERE id=?').get(id);
        if (tpl && fs.existsSync(tpl.filepath)) fs.unlinkSync(tpl.filepath);
        db.prepare('DELETE FROM templates WHERE id=?').run(id);
        return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
});

// ==========================================
// 6. IPC HANDLERS: SESI & CAPTURE
// ==========================================
ipcMain.handle('start-session', async (event, eventName) => {
    const baseDir = path.join(app.getPath('documents'), 'Photobooth_Output');
    const now = new Date();
    const y = now.getFullYear(); const m = String(now.getMonth() + 1).padStart(2, '0'); const d = String(now.getDate()).padStart(2, '0');
    
    const dateStr = `${y}-${m}-${d}`; 
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    
    const safeEventName = (eventName || 'DefaultEvent').replace(/[^a-zA-Z0-9]/g, '_');
    const eventDir = path.join(baseDir, `${dateStr}_${safeEventName}`);
    const sessionDir = path.join(eventDir, `${timeStr}_Customer`);

    if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir);
    if (!fs.existsSync(eventDir)) fs.mkdirSync(eventDir);
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir);

    return sessionDir;
});

ipcMain.handle('save-capture', async (event, { folderPath, base64Data, index }) => {
    try {
        const buffer = Buffer.from(base64Data.split(';base64,').pop(), 'base64');
        const filePath = path.join(folderPath, `raw_${index}.jpg`);
        fs.writeFileSync(filePath, buffer);
        return { success: true, path: filePath };
    } catch (err) { return { success: false, error: err.message }; }
});

// ==========================================
// 7. IPC HANDLERS: MIDTRANS
// ==========================================
ipcMain.handle('create-qris', async (event, amount) => {
    const settings = db.prepare('SELECT midtrans_server_key, midtrans_client_key FROM settings WHERE id=1').get();
    if (!settings || !settings.midtrans_server_key) return { success: false, error: "API Key Midtrans belum di-setting!" };

    const coreApi = new midtransClient.CoreApi({
        isProduction: false, serverKey: settings.midtrans_server_key, clientKey: settings.midtrans_client_key
    });

    const orderId = `ORDER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    try {
        const chargeResponse = await coreApi.charge({
            payment_type: "qris", transaction_details: { order_id: orderId, gross_amount: amount }, qris: { acquirer: "gopay" }
        });
        const qrAction = chargeResponse.actions?.find(a => a.name === 'generate-qr-code');
        if (qrAction) return { success: true, orderId: orderId, qrUrl: qrAction.url };
        return { success: false, error: "Gagal mendapatkan QR URL" };
    } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('check-payment', async (event, orderId) => {
    const settings = db.prepare('SELECT midtrans_server_key, midtrans_client_key FROM settings WHERE id=1').get();
    const coreApi = new midtransClient.CoreApi({
        isProduction: false, serverKey: settings.midtrans_server_key, clientKey: settings.midtrans_client_key
    });
    try {
        const statusResponse = await coreApi.transaction.status(orderId);
        return { success: true, status: statusResponse.transaction_status };
    } catch (e) { return { success: false, error: e.message }; }
});

// ==========================================
// 8. IPC HANDLERS: ENGINE SHARP
// ==========================================
ipcMain.handle('process-images', async (event, { photosBase64, templateId }) => {
    try {
        const tpl = db.prepare('SELECT * FROM templates WHERE id=?').get(templateId);
        if (!tpl) throw new Error("Template tidak ditemukan");
        
        const slots = JSON.parse(tpl.slots_json);
        const compositeOperations = await Promise.all(photosBase64.map(async (base64, index) => {
            const slot = slots[index] || { width: 400, height: 300, top: 0, left: 0 };
            const buffer = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            const resized = await sharp(buffer).resize({ width: slot.width, height: slot.height, fit: 'cover', position: 'center' }).toBuffer();
            return { input: resized, top: slot.top, left: slot.left };
        }));

        compositeOperations.push({ input: tpl.filepath, top: 0, left: 0 });

        const outputFilename = `print-${Date.now()}.png`;
        const outputPath = path.join(OUTPUT_PATH, outputFilename);

        await sharp({ create: { width: tpl.width, height: tpl.height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
        .composite(compositeOperations).png().toFile(outputPath);

        const downloadUrl = `http://${serverIP}:${PORT}/download/${outputFilename}`;
        const qrCodeDataUrl = await qrcode.toDataURL(downloadUrl);

        return { success: true, printPath: outputPath, qrCode: qrCodeDataUrl, downloadUrl };
    } catch (err) { return { success: false, error: err.message }; }
}); 