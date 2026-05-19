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
const OUTPUT_PATH = path.join(app.getPath('documents'), 'Photobooth_Output'); // Root Export Excel & Folder Sesi

if (!fs.existsSync(USER_TEMPLATES_PATH)) fs.mkdirSync(USER_TEMPLATES_PATH, { recursive: true });
if (!fs.existsSync(OUTPUT_PATH)) fs.mkdirSync(OUTPUT_PATH, { recursive: true });

// ==========================================
// 2. EXPRESS SERVER (KASIR & DOWNLOAD)
// ==========================================
const expressApp = express();
const PORT = 3000;
let serverIP = 'localhost';

function getLocalIP() {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal && !name.toLowerCase().includes('vethernet')) return net.address;
        }
    }
    return '127.0.0.1';
}

app.whenReady().then(() => {
    serverIP = getLocalIP();
    
    expressApp.get('/api/status', (req, res) => {
        const settings = db.prepare('SELECT app_mode FROM settings WHERE id=1').get();
        const activeEvent = db.prepare('SELECT nama_event FROM events WHERE is_active=1 ORDER BY id DESC LIMIT 1').get();
        res.json({ status: 'OK', machine_ip: serverIP, mode: settings?.app_mode, event: activeEvent?.nama_event || 'Tidak Ada Sesi' });
    });

    expressApp.use('/download', express.static(OUTPUT_PATH));
    expressApp.use('/templates', express.static(USER_TEMPLATES_PATH));

    expressApp.get('/', (req, res) => {
        res.send(`<h1>Dashboard Kasir Photobooth</h1><p>Versi Multi-Event (Dalam Pengembangan Fase 4)</p>`);
    });

    expressApp.listen(PORT, '0.0.0.0', () => console.log(`[LOCAL SERVER] Menyala di http://${serverIP}:${PORT}`));
    createWindow();
});

// ==========================================
// 3. ELECTRON BROWSER WINDOW
// ==========================================
let mainWindow;
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280, height: 720, fullscreen: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') }
    });
    if (process.env.NODE_ENV === 'development') { mainWindow.loadURL('http://localhost:5173'); mainWindow.webContents.openDevTools(); } 
    else { mainWindow.loadFile(path.join(__dirname, '../dist/index.html')); }
}
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ==========================================
// 4. IPC HANDLERS: GLOBAL SETTINGS
// ==========================================
ipcMain.handle('ping', () => 'PONG');
ipcMain.handle('get-server-ip', () => serverIP);
ipcMain.handle('get-settings', () => db.prepare('SELECT * FROM settings WHERE id=1').get());

ipcMain.handle('save-settings', (event, data) => {
    db.prepare(`UPDATE settings SET hpp_kertas=?, hpp_tinta=?, biaya_ops=?, midtrans_server_key=?, midtrans_client_key=?, app_mode=? WHERE id=1`)
      .run(data.hpp_kertas || 0, data.hpp_tinta || 0, data.biaya_ops || 0, data.midtrans_server_key || '', data.midtrans_client_key || '', data.app_mode || 'online');
    return true;
});

// ==========================================
// 5. IPC HANDLERS: EVENT SESSION MANAGEMENT
// ==========================================
ipcMain.handle('get-active-event', () => {
    return db.prepare('SELECT * FROM events WHERE is_active=1 ORDER BY id DESC LIMIT 1').get();
});

// [BARU] Ambil 10 Riwayat Event Terakhir
ipcMain.handle('get-recent-events', () => {
    return db.prepare('SELECT * FROM events ORDER BY id DESC LIMIT 10').all();
});

// [BARU] Buka ulang event lama
ipcMain.handle('reopen-event', (event, eventId) => {
    db.prepare('UPDATE events SET is_active=0').run(); // Matikan semua
    db.prepare('UPDATE events SET is_active=1 WHERE id=?').run(eventId); // Aktifkan target
    return { success: true };
});

ipcMain.handle('create-event', (event, data) => {
    try {
        db.prepare('UPDATE events SET is_active=0').run(); // Matikan sesi lain
        
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        const safeName = data.nama_event.replace(/[^a-zA-Z0-9]/g, '_');
        const folderName = `${dateStr}_${safeName}`;
        
        // [BUG FIXED]: Memasukkan variabel folderName ke dalam fungsi .run()
        const info = db.prepare(`INSERT INTO events (nama_event, folder_name, saldo_awal, is_active, templates_json) VALUES (?, ?, ?, 1, ?)`)
          .run(data.nama_event, folderName, data.saldo_awal || 0, JSON.stringify(data.templates));

        const eventDir = path.join(OUTPUT_PATH, folderName);
        if (!fs.existsSync(eventDir)) fs.mkdirSync(eventDir, { recursive: true });

        return { success: true, id: info.lastInsertRowid };
    } catch (err) { 
        console.error("[BACKEND ERROR]:", err.message);
        return { success: false, error: err.message }; 
    }
});

ipcMain.handle('close-event', (event, eventId) => {
    db.prepare('UPDATE events SET is_active=0 WHERE id=?').run(eventId);
    return { success: true };
});

// ==========================================
// 6. IPC HANDLERS: MASTER TEMPLATES
// ==========================================
ipcMain.handle('get-templates', () => db.prepare('SELECT * FROM templates ORDER BY id DESC').all().map(r => ({ ...r, slots: JSON.parse(r.slots_json) })));
ipcMain.handle('open-file-dialog', async () => { const res = await dialog.showOpenDialog({ filters: [{ name: 'Images', extensions: ['png'] }] }); return res.canceled ? null : res.filePaths[0]; });
ipcMain.handle('save-new-template', async (event, { tempPath }) => {
    try {
        const metadata = await sharp(tempPath).metadata();
        const filename = `tpl-${Date.now()}.png`;
        const newPath = path.join(USER_TEMPLATES_PATH, filename);
        fs.copyFileSync(tempPath, newPath);
        const info = db.prepare(`INSERT INTO templates (filename, filepath, width, height, price, is_visible, slots_json) VALUES (?, ?, ?, ?, ?, 1, '[]')`)
          .run(filename, newPath, metadata.width, metadata.height, 15000);
        return { success: true, id: info.lastInsertRowid };
    } catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('update-template', async (event, data) => {
    db.prepare(`UPDATE templates SET price=?, is_visible=?, slots_json=? WHERE id=?`).run(data.price || 0, data.is_visible ? 1 : 0, JSON.stringify(data.slots || []), data.id);
    return { success: true };
});
ipcMain.handle('delete-template', async (event, id) => {
    const tpl = db.prepare('SELECT filepath FROM templates WHERE id=?').get(id);
    if (tpl && fs.existsSync(tpl.filepath)) fs.unlinkSync(tpl.filepath);
    db.prepare('DELETE FROM templates WHERE id=?').run(id);
    return { success: true };
});

// ==========================================
// 7. IPC HANDLERS: TRANSAKSI CUSTOMER & ENGINE
// ==========================================
ipcMain.handle('start-customer-session', async (event, eventId) => {
    const ev = db.prepare('SELECT folder_name FROM events WHERE id=?').get(eventId);
    if (!ev) throw new Error("Event tidak ditemukan!");
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const sessionDir = path.join(OUTPUT_PATH, ev.folder_name, `${timeStr}_Customer`);
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
    return sessionDir;
});

ipcMain.handle('save-capture', async (event, { folderPath, base64Data, index }) => {
    try { fs.writeFileSync(path.join(folderPath, `raw_${index}.jpg`), Buffer.from(base64Data.split(';base64,').pop(), 'base64')); return { success: true }; } 
    catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('process-images', async (event, { photosBase64, templateId, eventFolder }) => {
    try {
        const tpl = db.prepare('SELECT * FROM templates WHERE id=?').get(templateId);
        const slots = JSON.parse(tpl.slots_json);
        const compositeOps = await Promise.all(photosBase64.map(async (b64, i) => {
            const s = slots[i] || { width: 400, height: 300, top: 0, left: 0 };
            return { input: await sharp(Buffer.from(b64.replace(/^data:image\/\w+;base64,/, ''), 'base64')).resize({ width: s.width, height: s.height, fit: 'cover', position: 'center' }).toBuffer(), top: s.top, left: s.left };
        }));
        compositeOps.push({ input: tpl.filepath, top: 0, left: 0 });

        const outputFilename = `print-${Date.now()}.png`;
        const outputPath = path.join(OUTPUT_PATH, eventFolder, outputFilename); // Simpan di dalam folder Event

        await sharp({ create: { width: tpl.width, height: tpl.height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
          .composite(compositeOps).png().toFile(outputPath);

        // [PERUBAHAN]: URL QR Diarahkan secara relatif ke folder event
        const downloadUrl = `http://${serverIP}:${PORT}/download/${eventFolder}/${outputFilename}`;
        return { success: true, printPath: outputPath, qrCode: await qrcode.toDataURL(downloadUrl), downloadUrl };
    } catch (err) { return { success: false, error: err.message }; }
});

// ==========================================
// 8. IPC HANDLERS: MIDTRANS
// ==========================================
ipcMain.handle('create-qris', async (e, amount) => {
    const st = db.prepare('SELECT midtrans_server_key, midtrans_client_key FROM settings WHERE id=1').get();
    if (!st || !st.midtrans_server_key) return { success: false, error: "API Key belum diset!" };
    try {
        const api = new midtransClient.CoreApi({ isProduction: false, serverKey: st.midtrans_server_key, clientKey: st.midtrans_client_key });
        const oid = `ORD-${Date.now()}`;
        const res = await api.charge({ payment_type: "qris", transaction_details: { order_id: oid, gross_amount: amount }, qris: { acquirer: "gopay" } });
        const qr = res.actions?.find(a => a.name === 'generate-qr-code');
        if (qr) return { success: true, orderId: oid, qrUrl: qr.url };
        return { success: false, error: "Gagal Midtrans" };
    } catch (e) { return { success: false, error: e.message }; }
});
ipcMain.handle('check-payment', async (e, oid) => {
    const st = db.prepare('SELECT midtrans_server_key, midtrans_client_key FROM settings WHERE id=1').get();
    try { return { success: true, status: (await new midtransClient.CoreApi({ isProduction: false, serverKey: st.midtrans_server_key, clientKey: st.midtrans_client_key }).transaction.status(oid)).transaction_status }; } 
    catch (e) { return { success: false, error: e.message }; }
});