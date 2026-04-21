const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

// Menyimpan file .db di folder userData agar aman dari proses update aplikasi / build .exe
const dbPath = path.join(app.getPath('userData'), 'photobooth_v2.db');
const db = new Database(dbPath);

// Inisialisasi Tabel
db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nama_event TEXT,
        saldo_awal INTEGER,
        hpp_kertas INTEGER,
        hpp_tinta INTEGER,
        biaya_ops INTEGER
    );
    
    CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nama_user TEXT,
        folder_name TEXT,
        waktu TEXT,
        harga_jual INTEGER,
        status_cetak TEXT,
        link_gdrive TEXT
    );
    
    CREATE TABLE IF NOT EXISTS print_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER,
        waktu_cetak TEXT
    );
`);

// Jika tabel settings kosong, masukkan data default
const stmt = db.prepare('SELECT COUNT(*) as count FROM settings');
if (stmt.get().count === 0) {
    db.prepare(`
        INSERT INTO settings (nama_event, saldo_awal, hpp_kertas, hpp_tinta, biaya_ops)
        VALUES (?, ?, ?, ?, ?)
    `).run('Event Default', 0, 3000, 2000, 0);
}

module.exports = db;