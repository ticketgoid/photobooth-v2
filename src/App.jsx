import { useEffect, useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useStore } from './store/useStore';

// ==========================================
// KOMPONEN: VISUAL TEMPLATE EDITOR
// ==========================================
function VisualEditor({ template, onSave, onCancel }) {
  const initialSlots = typeof template.slots === 'string' ? JSON.parse(template.slots) : (template.slots || []);
  const [slots, setSlots] = useState(initialSlots);
  const [scale, setScale] = useState(1);
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;
      const scaleX = (containerWidth - 40) / Number(template.width);
      const scaleY = (containerHeight - 40) / Number(template.height);
      setScale(Math.min(scaleX, scaleY, 1));
    }
  }, [template]);

  const handlePointerDown = (e, index, action) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startSlot = { ...slots[index] };

    const handlePointerMove = (moveEvent) => {
      const dx = (moveEvent.clientX - startX) / scale;
      const dy = (moveEvent.clientY - startY) / scale;
      
      const newSlots = [...slots];
      if (action === 'move') {
        newSlots[index] = { ...startSlot, left: Math.round(startSlot.left + dx), top: Math.round(startSlot.top + dy) };
      } else if (action === 'resize') {
        newSlots[index] = { ...startSlot, width: Math.max(50, Math.round(startSlot.width + dx)), height: Math.max(50, Math.round(startSlot.height + dy)) };
      }
      setSlots(newSlots);
    };

    const handlePointerUp = () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
  };

  const addSlot = () => { setSlots([...slots, { top: 50, left: 50, width: 300, height: 200 }]); };
  const removeSlot = (index) => { setSlots(slots.filter((_, i) => i !== index)); };

  return (
    <div className="fixed inset-0 bg-black/90 z-[60] flex p-6 gap-6">
      <div ref={containerRef} className="flex-1 editor-canvas-container flex items-center justify-center relative overflow-hidden">
        <div 
          style={{ 
            width: Number(template.width), 
            height: Number(template.height), 
            transform: `scale(${scale})`, 
            transformOrigin: 'center center',
            backgroundImage: `url('http://localhost:3000/templates/${template.filename}')`, 
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center'
          }} 
          className="relative shadow-[0_0_20px_rgba(0,0,0,0.5)] bg-white shrink-0"
        >
          {slots.map((slot, i) => (
            <div 
              key={i} className="slot-box"
              style={{ top: slot.top, left: slot.left, width: slot.width, height: slot.height }}
              onMouseDown={(e) => handlePointerDown(e, i, 'move')}
            >
              {i + 1}
              <div className="resize-handle" onMouseDown={(e) => { e.stopPropagation(); handlePointerDown(e, i, 'resize'); }} />
            </div>
          ))}
        </div>
      </div>

      <div className="w-[350px] retro-window bg-white flex flex-col shrink-0">
        <div className="retro-header">⚙️ EDITOR TEMPLATE</div>
        <div className="p-4 flex flex-col gap-4 flex-1 overflow-y-auto">
          <button onClick={addSlot} className="retro-btn py-2">➕ TAMBAH SLOT FOTO</button>
          
          <div className="font-sys text-lg border-t-2 border-dashed border-gray-400 pt-4 mt-2">
            <p className="font-bold mb-2">Daftar Slot:</p>
            {slots.length === 0 && <p className="text-gray-500">Belum ada slot foto.</p>}
            {slots.map((slot, i) => (
              <div key={i} className="flex justify-between items-center bg-gray-100 p-2 border-2 border-retro-border mb-2">
                <span>Slot {i + 1} ({slot.width}x{slot.height})</span>
                <button onClick={() => removeSlot(i)} className="text-red-600 font-bold hover:scale-110">X</button>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-t-4 border-retro-border flex gap-2">
          <button onClick={onCancel} className="retro-btn-danger flex-1 py-2 text-sm">BATAL</button>
          <button onClick={() => onSave(slots)} className="retro-btn flex-1 py-2 text-sm">SIMPAN</button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// KOMPONEN: LAYAR PEMILIHAN TEMPLATE
// ==========================================
function TemplateScreen({ onSelectTemplate }) {
  const { templates, setScreen } = useStore();
  const visibleTemplates = templates.filter(t => t.is_visible === 1);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-retro-bg p-10">
      <h1 className="font-pixel text-4xl text-retro-border mb-8 drop-shadow-md">Pilih Frame Favoritmu</h1>
      
      <div className="flex flex-wrap justify-center gap-8 overflow-y-auto w-full max-w-6xl pb-10">
        {visibleTemplates.length === 0 && (
          <div className="retro-window p-8 text-xl font-sys text-center">Belum ada template yang diaktifkan.<br/>Hubungi Admin.</div>
        )}
        
        {visibleTemplates.map(tpl => (
          <div 
            key={tpl.id} 
            onClick={() => onSelectTemplate(tpl)}
            className="retro-window w-[250px] bg-white cursor-pointer hover:scale-105 hover:border-blue-500 transition-transform group flex flex-col"
          >
            <div className="h-[350px] border-b-4 border-retro-border bg-gray-200 overflow-hidden flex items-center justify-center p-2 relative">
              <img src={`http://localhost:3000/templates/${tpl.filename}`} alt="Frame" className="max-w-full max-h-full object-contain drop-shadow-lg" />
              
              <div className="absolute top-2 right-2 font-pixel text-[10px] text-white px-2 py-1 border-2 border-retro-border shadow-sm bg-retro-header">
                {tpl.is_free === 1 ? 'GRATIS' : `Rp ${(tpl.price/1000)}k`}
              </div>
            </div>
            <div className="p-4 text-center font-pixel text-sm group-hover:bg-blue-100 transition-colors">PILIH FRAME</div>
          </div>
        ))}
      </div>

      <button onClick={() => setScreen('landing')} className="retro-btn-danger px-8 py-3 absolute bottom-8 left-8">KEMBALI</button>
    </div>
  );
}

// ==========================================
// KOMPONEN UTAMA (ROUTER & ADMIN)
// ==========================================
function App() {
  const store = useStore();
  const [formData, setFormData] = useState({ nama_event: '', saldo_awal: 0, hpp_kertas: 0, hpp_tinta: 0, biaya_ops: 0, midtrans_server_key: '', midtrans_client_key: '', app_mode: 'online' });
  const [adminTab, setAdminTab] = useState('umum');
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  useEffect(() => {
    store.fetchSettings();
    store.fetchTemplates();
    store.fetchServerIP();
    
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') store.toggleAdmin();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => { if (store.settings) setFormData(store.settings); }, [store.settings]);

  const handleTemplateSelect = async (tpl) => {
    setSelectedTemplate(tpl);
    if (window.electronAPI) {
      const folder = await window.electronAPI.startSession(store.settings?.nama_event || 'EventDefault');
      store.setSessionFolder(folder);
    }
    if (store.settings?.app_mode === 'offline' || tpl.is_free === 1) { store.setScreen('camera'); } 
    else { store.setupPayment(tpl.price, 'camera'); }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (window.electronAPI) {
      await window.electronAPI.saveSettings(formData);
      store.fetchSettings();
      alert("Pengaturan Disimpan!");
    }
  };

  const handleUploadTemplate = async () => {
    const filePath = await window.electronAPI.openFileDialog();
    if (filePath) {
      const res = await window.electronAPI.saveNewTemplate({ tempPath: filePath });
      if (res.success) { store.fetchTemplates(); alert("Template Berhasil Diunggah!"); }
      else alert("Gagal mengunggah: " + res.error);
    }
  };

  const handleUpdateTemplateAttr = async (tpl, field, value) => {
    const updated = { ...tpl, [field]: value };
    await window.electronAPI.updateTemplate(updated);
    store.fetchTemplates();
  };

  const handleDeleteTemplate = async (id) => {
    if (confirm("Hapus template ini permanen?")) {
      await window.electronAPI.deleteTemplate(id);
      store.fetchTemplates();
    }
  };

  return (
    <div className="w-screen h-screen overflow-hidden">
      
      {/* ---------------- ROUTER LAYAR USER ---------------- */}
      
      {store.currentScreen === 'landing' && (
        <div className="flex flex-col items-center justify-center h-screen space-y-12">
          <div className="retro-window p-8 text-center animate-bounce">
            <h1 className="font-pixel text-5xl text-retro-border mb-4">PHOTOBOOTH</h1>
            <p className="font-sys text-2xl text-gray-600 tracking-wider">Tap anywhere to start</p>
          </div>
          <button onClick={() => { store.resetSession(); store.setScreen('template'); }} className="retro-btn px-10 py-6 text-2xl hover:brightness-110">
            MULAI SEKARANG
          </button>
        </div>
      )}

      {store.currentScreen === 'template' && <TemplateScreen onSelectTemplate={handleTemplateSelect} />}
      
      {store.currentScreen === 'payment' && (
        <div className="flex flex-col items-center justify-center h-screen">
          <div className="retro-window p-8 text-center font-sys text-3xl">
            [LAYAR QRIS MIDTRANS]<br/><br/>
            Rp {store.paymentAmount.toLocaleString('id-ID')}<br/><br/>
            <button onClick={() => store.setScreen('camera')} className="retro-btn px-6 py-2 text-sm">Bypass (Test)</button>
          </div>
        </div>
      )}

      {store.currentScreen === 'camera' && (
        <div className="flex flex-col items-center justify-center h-screen">
          <div className="retro-window p-8 text-center font-sys text-3xl bg-black text-white">
            [LAYAR KAMERA AKTIF]<br/>
            Mengambil {typeof selectedTemplate?.slots === 'string' ? JSON.parse(selectedTemplate.slots).length : (selectedTemplate?.slots?.length || 0)} Foto<br/><br/>
            <button onClick={() => store.setScreen('review')} className="retro-btn px-6 py-2 text-sm">Selesai Foto (Test)</button>
          </div>
        </div>
      )}

      {store.currentScreen === 'review' && (
        <div className="flex flex-col items-center justify-center h-screen">
          <div className="retro-window p-8 text-center font-sys text-3xl">
            [LAYAR REVIEW]<br/><br/>
            <button onClick={() => store.setScreen('landing')} className="retro-btn px-6 py-2 text-sm">Cetak & Kembali</button>
          </div>
        </div>
      )}

      {/* ---------------- OVERLAY MENU ADMIN ---------------- */}
      
      {store.isAdminOpen && (
        <div className="fixed top-0 left-0 w-full h-full bg-black/80 flex justify-center items-center z-50 p-10">
          <div className="retro-window w-full max-w-5xl h-full max-h-[800px] flex flex-col bg-gray-100">
            
            <div className="retro-header">
              <span>SYSTEM.INI - [ADMIN DASHBOARD]</span>
              <button onClick={store.toggleAdmin} className="text-white hover:text-black">X</button>
            </div>
            
            <div className="flex flex-1 overflow-hidden">
              <div className="w-[200px] border-r-4 border-retro-border bg-white p-4 flex flex-col gap-4 font-pixel text-xs shrink-0">
                <button onClick={() => setAdminTab('umum')} className={`p-4 text-left border-4 border-transparent ${adminTab === 'umum' ? 'bg-blue-200 border-retro-border shadow-[2px_2px_0_0_#333]' : 'hover:bg-gray-100'}`}>⚙️ PENGATURAN UMUM</button>
                <button onClick={() => setAdminTab('template')} className={`p-4 text-left border-4 border-transparent ${adminTab === 'template' ? 'bg-blue-200 border-retro-border shadow-[2px_2px_0_0_#333]' : 'hover:bg-gray-100'}`}>🖼️ MANAJEMEN TEMPLATE</button>
                
                <div className="mt-auto border-t-4 border-retro-border pt-4 text-center font-sys text-sm">
                  <p className="font-bold mb-2">Remote Kasir QR</p>
                  <div className="bg-white p-2 border-2 border-black inline-block">
                    {store.serverIP ? <QRCodeSVG value={`http://${store.serverIP}:3000`} size={120} /> : 'Memuat IP...'}
                  </div>
                  <p className="mt-1 font-pixel text-[8px] break-all">http://{store.serverIP}:3000</p>
                </div>
              </div>

              <div className="flex-1 p-6 overflow-y-auto">
                
                {adminTab === 'umum' && (
                  <form onSubmit={handleSaveSettings} className="font-sys text-xl flex flex-col gap-4 max-w-2xl mx-auto">
                    <h2 className="font-pixel text-lg mb-4 border-b-4 border-retro-border pb-2">Mode Operasional</h2>
                    <div className="flex gap-6 mb-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="app_mode" value="online" checked={formData.app_mode === 'online'} onChange={(e) => setFormData({...formData, app_mode: e.target.value})} className="w-5 h-5" />
                        <b>ONLINE</b> (Auto-Midtrans & GDrive)
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-retro-header">
                        <input type="radio" name="app_mode" value="offline" checked={formData.app_mode === 'offline'} onChange={(e) => setFormData({...formData, app_mode: e.target.value})} className="w-5 h-5" />
                        <b>OFFLINE</b> (Bayar di Kasir & Local Download)
                      </label>
                    </div>

                    <h2 className="font-pixel text-lg mb-2 mt-4 border-b-4 border-retro-border pb-2">Data Event & HPP Dasar</h2>
                    <div className="flex flex-col"><label>Nama Event:</label><input type="text" className="border-4 border-retro-border p-2 bg-white outline-none" value={formData.nama_event} onChange={e => setFormData({...formData, nama_event: e.target.value})} /></div>
                    
                    {/* [PERBAIKAN BUG]: Menambahkan min="0" dan Math.max pada input Umum */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col"><label>Saldo Awal (Rp):</label><input type="number" min="0" className="border-4 border-retro-border p-2 bg-white outline-none" value={formData.saldo_awal} onChange={e => setFormData({...formData, saldo_awal: e.target.value === '' ? '' : Math.max(0, Number(e.target.value))})} /></div>
                      <div className="flex flex-col"><label>Biaya Ops (Rp):</label><input type="number" min="0" className="border-4 border-retro-border p-2 bg-white outline-none" value={formData.biaya_ops} onChange={e => setFormData({...formData, biaya_ops: e.target.value === '' ? '' : Math.max(0, Number(e.target.value))})} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col"><label>HPP Kertas (Rp):</label><input type="number" min="0" className="border-4 border-retro-border p-2 bg-white outline-none" value={formData.hpp_kertas} onChange={e => setFormData({...formData, hpp_kertas: e.target.value === '' ? '' : Math.max(0, Number(e.target.value))})} /></div>
                      <div className="flex flex-col"><label>HPP Tinta (Rp):</label><input type="number" min="0" className="border-4 border-retro-border p-2 bg-white outline-none" value={formData.hpp_tinta} onChange={e => setFormData({...formData, hpp_tinta: e.target.value === '' ? '' : Math.max(0, Number(e.target.value))})} /></div>
                    </div>
                    
                    <h2 className="font-pixel text-lg mb-2 mt-4 border-b-4 border-retro-border pb-2">API Keys (Midtrans Sandbox)</h2>
                    <div className="flex flex-col"><label>Server Key:</label><input type="text" className="border-4 border-retro-border p-2 bg-white outline-none" value={formData.midtrans_server_key} onChange={e => setFormData({...formData, midtrans_server_key: e.target.value})} /></div>
                    <div className="flex flex-col"><label>Client Key:</label><input type="text" className="border-4 border-retro-border p-2 bg-white outline-none" value={formData.midtrans_client_key} onChange={e => setFormData({...formData, midtrans_client_key: e.target.value})} /></div>
                    
                    <button type="submit" className="retro-btn py-3 mt-6">SAVE_SETTINGS.EXE</button>
                  </form>
                )}

                {adminTab === 'template' && (
                  <div className="flex flex-col gap-6">
                    <button onClick={handleUploadTemplate} className="retro-btn py-4 text-xl self-start px-8">➕ UPLOAD TEMPLATE BARU (PNG)</button>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {store.templates.map(tpl => {
                        const slotCount = typeof tpl.slots === 'string' ? JSON.parse(tpl.slots).length : (tpl.slots?.length || 0);
                        return (
                        <div key={tpl.id} className="bg-white border-4 border-retro-border p-4 flex gap-4 shadow-[4px_4px_0_0_#333]">
                          <div className="w-[120px] h-[160px] bg-gray-200 border-2 border-gray-400 flex items-center justify-center overflow-hidden shrink-0">
                            <img src={`http://localhost:3000/templates/${tpl.filename}`} alt="tpl" className="max-w-full max-h-full object-contain" />
                          </div>
                          <div className="flex flex-col flex-1 font-sys text-lg gap-2 overflow-hidden">
                            <p className="font-bold border-b-2 border-gray-300 pb-1 break-all truncate">{tpl.filename}</p>
                            
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input type="checkbox" checked={tpl.is_visible === 1} onChange={(e) => handleUpdateTemplateAttr(tpl, 'is_visible', e.target.checked ? 1 : 0)} /> Aktif (Tampil)
                              </label>
                              <label className="flex items-center gap-1 cursor-pointer text-retro-header font-bold">
                                <input type="checkbox" checked={tpl.is_free === 1} onChange={(e) => handleUpdateTemplateAttr(tpl, 'is_free', e.target.checked ? 1 : 0)} /> FREE
                              </label>
                            </div>

                            {!tpl.is_free && (
                              <div className="flex items-center gap-2">
                                <span>Harga: Rp</span>
                                {/* [PERBAIKAN BUG]: Menggunakan defaultValue dan onBlur agar keyboard bisa digunakan bebas tanpa kehilangan fokus */}
                                <input 
                                  type="number" 
                                  min="0"
                                  className="border-2 border-retro-border px-1 w-24 outline-none" 
                                  defaultValue={tpl.price} 
                                  onBlur={(e) => {
                                    const val = Math.max(0, Number(e.target.value) || 0);
                                    e.target.value = val; // Memaksa UI menampilkan angka valid jika user mengetik minus
                                    if (val !== tpl.price) {
                                      handleUpdateTemplateAttr(tpl, 'price', val);
                                    }
                                  }} 
                                />
                              </div>
                            )}

                            <p className="text-sm text-gray-600">Terpasang: {slotCount} Slot Foto</p>

                            <div className="mt-auto flex gap-2">
                              <button onClick={() => setEditingTemplate(tpl)} className="retro-btn py-1 px-2 flex-1 text-xs">Atur Slot</button>
                              <button onClick={() => handleDeleteTemplate(tpl.id)} className="retro-btn-danger py-1 px-2 text-xs font-bold">X</button>
                            </div>
                          </div>
                        </div>
                      )})}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      )}

      {editingTemplate && (
        <VisualEditor 
          template={editingTemplate} 
          onCancel={() => setEditingTemplate(null)}
          onSave={async (newSlots) => {
            await handleUpdateTemplateAttr(editingTemplate, 'slots', newSlots);
            setEditingTemplate(null);
            alert("Posisi slot berhasil disimpan!");
          }}
        />
      )}

    </div>
  );
}

export default App;