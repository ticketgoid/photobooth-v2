const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

const dbPath = path.join(app.getPath('userData'), 'photobooth_v2.db');
const db = new Database(dbPath);

// ==========================================
// INISIALISASI TABEL (MULTI-EVENT ARCHITECTURE)
// ==========================================
db.exec(`
    -- TABEL PENGATURAN MESIN GLOBAL (Shortcut: Ctrl+Shift+P)
    CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hpp_kertas INTEGER DEFAULT 3000,
        hpp_tinta INTEGER DEFAULT 2000,
        biaya_ops INTEGER DEFAULT 0,
        midtrans_server_key TEXT DEFAULT '',
        midtrans_client_key TEXT DEFAULT '',
        app_mode TEXT DEFAULT 'online' 
    );
    
    -- TABEL MASTER TEMPLATE (Shortcut: Ctrl+Shift+T)
    CREATE TABLE IF NOT EXISTS templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT UNIQUE,
        filepath TEXT,
        is_free INTEGER DEFAULT 0,
        price INTEGER DEFAULT 15000, -- Harga Dasar (HET)
        is_visible INTEGER DEFAULT 1,
        width INTEGER,
        height INTEGER,
        slots_json TEXT DEFAULT '[]'
    );
    
    -- TABEL SESI EVENT (OTAK OPERASIONAL BARU)
    CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nama_event TEXT,
        folder_name TEXT,
        saldo_awal INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1, -- 1: Aktif, 0: Ditutup/Exit
        templates_json TEXT DEFAULT '[]', -- Array { id_template, override_price }
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    -- TABEL TRANSAKSI / CUSTOMER FOTO
    CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER,
        folder_name TEXT,
        waktu TEXT,
        harga_jual INTEGER,
        status_cetak TEXT,
        link_gdrive TEXT,
        token_download TEXT
    );
`);

// Seeder Awal untuk Settings (Hanya 1 baris ID=1 yang akan ada selamanya)
const stmt = db.prepare('SELECT COUNT(*) as count FROM settings');
if (stmt.get().count === 0) {
    db.prepare(`
        INSERT INTO settings (hpp_kertas, hpp_tinta, biaya_ops, midtrans_server_key, midtrans_client_key, app_mode) 
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(3000, 2000, 0, '', '', 'online');
}

module.exports = db;