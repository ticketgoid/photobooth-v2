import { useEffect, useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useStore } from './store/useStore';

// ==========================================
// UTILITY: FORMATTER RUPIAH 
// ==========================================
const formatRp = (val) => {
  if (val === '' || val === null || val === undefined || isNaN(val)) return '';
  return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};
const parseRp = (val) => {
  if (typeof val !== 'string') return val;
  const parsed = parseInt(val.replace(/\./g, ''), 10);
  return isNaN(parsed) ? '' : parsed;
};

// ==========================================
// VISUAL TEMPLATE EDITOR
// ==========================================
function VisualEditor({ template, onSave, onCancel }) {
  const initialSlots = typeof template.slots === 'string' ? JSON.parse(template.slots) : (template.slots || []);
  const [slots, setSlots] = useState(initialSlots);
  const [scale, setScale] = useState(1);
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      const scaleX = (containerRef.current.clientWidth - 40) / Number(template.width);
      const scaleY = (containerRef.current.clientHeight - 40) / Number(template.height);
      setScale(Math.min(scaleX, scaleY, 1));
    }
  }, [template]);

  const handlePointerDown = (e, index, action) => {
    e.preventDefault();
    const startX = e.clientX; const startY = e.clientY; const startSlot = { ...slots[index] };
    const handlePointerMove = (moveEvent) => {
      const dx = (moveEvent.clientX - startX) / scale; const dy = (moveEvent.clientY - startY) / scale;
      const newSlots = [...slots];
      if (action === 'move') newSlots[index] = { ...startSlot, left: Math.round(startSlot.left + dx), top: Math.round(startSlot.top + dy) };
      else if (action === 'resize') newSlots[index] = { ...startSlot, width: Math.max(50, Math.round(startSlot.width + dx)), height: Math.max(50, Math.round(startSlot.height + dy)) };
      setSlots(newSlots);
    };
    const handlePointerUp = () => { window.removeEventListener('mousemove', handlePointerMove); window.removeEventListener('mouseup', handlePointerUp); };
    window.addEventListener('mousemove', handlePointerMove); window.addEventListener('mouseup', handlePointerUp);
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[80] flex p-6 gap-6">
      <div ref={containerRef} className="flex-1 editor-canvas-container flex items-center justify-center relative overflow-hidden">
        <div style={{ width: Number(template.width), height: Number(template.height), transform: `scale(${scale})`, transformOrigin: 'center center', backgroundImage: `url('http://localhost:3000/templates/${template.filename}')`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }} className="relative shadow-[0_0_20px_rgba(0,0,0,0.5)] bg-white shrink-0">
          {slots.map((slot, i) => (
            <div key={i} className="slot-box" style={{ top: slot.top, left: slot.left, width: slot.width, height: slot.height }} onMouseDown={(e) => handlePointerDown(e, i, 'move')}>
              {i + 1}<div className="resize-handle" onMouseDown={(e) => { e.stopPropagation(); handlePointerDown(e, i, 'resize'); }} />
            </div>
          ))}
        </div>
      </div>
      <div className="w-[350px] retro-window bg-white flex flex-col shrink-0">
        <div className="retro-header">⚙️ EDITOR TEMPLATE</div>
        <div className="p-4 flex flex-col gap-4 flex-1 overflow-y-auto">
          <button onClick={() => setSlots([...slots, { top: 50, left: 50, width: 300, height: 200 }])} className="retro-btn py-2">➕ TAMBAH SLOT FOTO</button>
          <div className="font-sys text-lg border-t-2 border-dashed border-gray-400 pt-4 mt-2">
            {slots.map((slot, i) => (
              <div key={i} className="flex justify-between items-center bg-gray-100 p-2 border-2 border-retro-border mb-2">
                <span>Slot {i + 1}</span>
                <button onClick={() => setSlots(slots.filter((_, idx) => idx !== i))} className="text-red-600 font-bold hover:scale-110">X</button>
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
// KOMPONEN UTAMA
// ==========================================
export default function App() {
  const store = useStore();
  
  // States - Admin Modals
  const [isGlobalOpen, setGlobalOpen] = useState(false);
  const [isTemplateOpen, setTemplateOpen] = useState(false);
  const [isDashboardOpen, setDashboardOpen] = useState(false); // [BARU]
  const [dashboardData, setDashboardData] = useState(null); // [BARU]
  
  const [globalData, setGlobalData] = useState({ hpp_kertas: '', hpp_tinta: '', biaya_ops: '', midtrans_server_key: '', midtrans_client_key: '', app_mode: 'online' });
  const [editingTemplate, setEditingTemplate] = useState(null);

  // States - Session Manager
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEventData, setNewEventData] = useState({ nama_event: '', saldo_awal: '' });
  const [selectedEventTemplates, setSelectedEventTemplates] = useState([]); 

  // States - Customer Flow
  const [customerTemplate, setCustomerTemplate] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [finalResult, setFinalResult] = useState(null);
  const [qrUrl, setQrUrl] = useState(null);
  const [statusText, setStatusText] = useState("");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [countdown, setCountdown] = useState(null);
  
  // Timer Sesi
  const [sessionExpiresAt, setSessionExpiresAt] = useState(null);
  const [timeLeftDisplay, setTimeLeftDisplay] = useState(0);

  const capturedPhotosRef = useRef(store.capturedPhotos);
  const currentScreenRef = useRef(store.currentScreen);
  useEffect(() => { capturedPhotosRef.current = store.capturedPhotos; }, [store.capturedPhotos]);
  useEffect(() => { currentScreenRef.current = store.currentScreen; }, [store.currentScreen]);

  useEffect(() => {
    store.fetchSettings(); store.fetchTemplates(); store.fetchServerIP(); 
    store.fetchActiveEvent(); store.fetchRecentEvents();
    
    const handleKeyDown = async (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') { setGlobalOpen(p=>!p); setTemplateOpen(false); setDashboardOpen(false); }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 't') { setTemplateOpen(p=>!p); setGlobalOpen(false); setDashboardOpen(false); }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') { 
        setDashboardOpen(p=>!p); setGlobalOpen(false); setTemplateOpen(false); 
        fetchDashboardData(); 
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'x') {
        const ev = await window.electronAPI.getActiveEvent();
        if (ev && confirm(`TUTUP event "${ev.nama_event}" secara permanen?`)) {
          await window.electronAPI.closeEvent(ev.id);
          store.fetchActiveEvent(); store.fetchRecentEvents(); setShowCreateForm(false); setDashboardOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => { if (store.settings) setGlobalData(store.settings); }, [store.settings]);
  useEffect(() => { if (store.recentEvents.length === 0) setShowCreateForm(true); }, [store.recentEvents]);

  // LIVE DASHBOARD DATA FETCHING
  const fetchDashboardData = async () => {
    const ev = await window.electronAPI.getActiveEvent();
    if (ev) {
      const data = await window.electronAPI.getDashboardData(ev.id);
      setDashboardData(data);
    }
  };

  // LOGIKA TIMER 10 MENIT
  useEffect(() => {
    if (!sessionExpiresAt) return;
    const displayInterval = setInterval(() => { setTimeLeftDisplay(Math.max(0, Math.floor((sessionExpiresAt - Date.now()) / 1000))); }, 1000);
    const timeToWait = sessionExpiresAt - Date.now();
    const doomTimer = setTimeout(() => { handleAutoFinish(); }, Math.max(0, timeToWait));
    return () => { clearInterval(displayInterval); clearTimeout(doomTimer); };
  }, [sessionExpiresAt, customerTemplate]);

  const handleAutoFinish = async () => {
    const screen = currentScreenRef.current;
    if (screen !== 'camera' && screen !== 'review') return; 

    setSessionExpiresAt(null);
    if (videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t => t.stop());

    const blankImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
    const filledPhotos = capturedPhotosRef.current.map(p => p || blankImage);
    
    store.setCapturedPhotos(filledPhotos);
    store.setScreen('loading');

    const res = await window.electronAPI.processImages({ 
      photosBase64: filledPhotos, 
      templateId: customerTemplate.id, 
      eventFolder: store.activeEvent.folder_name,
      eventId: store.activeEvent.id,
      customerName: customerName,
      price: customerTemplate.override_price
    });

    if(res.success) { setFinalResult(res); store.setScreen('result'); } 
    else { alert("Gagal Merender: " + res.error); store.setScreen('landing'); }
  };

  // ADMIN HANDLERS
  const saveGlobalSettings = async (e) => { e.preventDefault(); await window.electronAPI.saveSettings(globalData); store.fetchSettings(); alert("Pengaturan Disimpan!"); setGlobalOpen(false); };
  const uploadMasterTemplate = async () => { const filePath = await window.electronAPI.openFileDialog(); if (filePath) { const res = await window.electronAPI.saveNewTemplate({ tempPath: filePath }); if (res.success) store.fetchTemplates(); } };
  const updateMasterAttr = async (tpl, field, value) => { await window.electronAPI.updateTemplate({ ...tpl, [field]: value }); store.fetchTemplates(); };

  const toggleEventTemplate = (tpl) => {
    const exists = selectedEventTemplates.find(t => t.id === tpl.id);
    if (exists) setSelectedEventTemplates(selectedEventTemplates.filter(t => t.id !== tpl.id));
    else setSelectedEventTemplates([...selectedEventTemplates, { ...tpl, override_price: tpl.price }]);
  };

  const createEventSession = async () => {
    if(!newEventData.nama_event) return alert("Nama Event wajib diisi!");
    if(selectedEventTemplates.length === 0) return alert("Minimal pilih 1 template!");
    const res = await window.electronAPI.createEvent({ nama_event: newEventData.nama_event, saldo_awal: parseRp(newEventData.saldo_awal) || 0, templates: selectedEventTemplates });
    if(res.success) { setNewEventData({ nama_event: '', saldo_awal: '' }); setSelectedEventTemplates([]); setShowCreateForm(false); store.fetchActiveEvent(); store.fetchRecentEvents(); } 
    else alert("Sistem Gagal: " + res.error);
  };
  const reopenEvent = async (eventId) => { if(confirm("Lanjutkan sesi ini?")) { await window.electronAPI.reopenEvent(eventId); store.fetchActiveEvent(); } };

  // CUSTOMER FLOW HANDLERS
  const startCustomerPhoto = async (tpl) => {
    setCustomerTemplate(tpl);
    const slotsArr = typeof tpl.slots === 'string' ? JSON.parse(tpl.slots) : (tpl.slots || []);
    store.setCapturedPhotos(Array(slotsArr.length).fill(null));

    const folder = await window.electronAPI.startCustomerSession(store.activeEvent.id);
    store.setSessionFolder(folder);

    if (store.settings?.app_mode === 'offline' || tpl.override_price <= 0) { store.setScreen('input_name'); } 
    else { store.setupPayment(tpl.override_price, 'input_name'); initMidtrans(tpl.override_price); }
  };

  const initMidtrans = async (amount) => {
    setQrUrl(null); setStatusText("Membuat Tagihan...");
    const res = await window.electronAPI.createQris(amount);
    if(res.success) {
      setQrUrl(res.qrUrl); setStatusText("Menunggu Pembayaran...");
      const chk = setInterval(async () => {
        const st = await window.electronAPI.checkPayment(res.orderId);
        if(st.success && st.status === 'settlement') { clearInterval(chk); setStatusText("Lunas!"); setTimeout(() => { store.setScreen('input_name'); }, 1500); }
      }, 3000);
    } else setStatusText("Error Midtrans");
  };

  const executeStartSessionTimer = async () => {
    if(!customerName) return alert("Nama wajib diisi!");
    setSessionExpiresAt(Date.now() + 600000); 
    store.setScreen('camera');
    try { const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } }); if(videoRef.current) videoRef.current.srcObject = stream; } 
    catch(e) { console.error("Kamera gagal", e); }
  };

  const takePhotoAction = async () => {
    const current = [...store.capturedPhotos];
    for(let i=0; i<current.length; i++) {
      if(current[i] !== null) continue;
      for(let c=3; c>0; c--) { setCountdown(c); await new Promise(r=>setTimeout(r,1000)); }
      setCountdown('📸');
      const v = videoRef.current; const cvs = canvasRef.current; const ctx = cvs.getContext('2d');
      cvs.width = v.videoWidth; cvs.height = v.videoHeight; ctx.drawImage(v, 0, 0, cvs.width, cvs.height);
      const b64 = cvs.toDataURL('image/jpeg', 0.9);
      await window.electronAPI.saveCapture({ folderPath: store.sessionFolder, base64Data: b64, index: i+1 });
      current[i] = b64; store.setCapturedPhotos([...current]);
      await new Promise(r=>setTimeout(r,1000));
    }
    setCountdown(null); store.setScreen('review');
    if(videoRef.current?.srcObject) videoRef.current.srcObject.getTracks().forEach(t=>t.stop());
  };

  const processStitching = async () => {
    setSessionExpiresAt(null); 
    store.setScreen('loading');
    
    // [PERBAIKAN]: Menyisipkan data Event, Nama, dan Harga untuk disimpan ke DB SQLite
    const res = await window.electronAPI.processImages({ 
      photosBase64: store.capturedPhotos, 
      templateId: customerTemplate.id, 
      eventFolder: store.activeEvent.folder_name,
      eventId: store.activeEvent.id,
      customerName: customerName,
      price: customerTemplate.override_price
    });
    
    if(res.success) { setFinalResult(res); store.setScreen('result'); } 
    else { alert("Gagal Merender: " + res.error); store.setScreen('landing'); }
  };

  const renderScreen = () => {
    if (store.currentScreen === 'loading') return <div className="flex h-screen items-center justify-center bg-retro-bg font-sys text-3xl">MEMUAT SISTEM...</div>;

    if (store.currentScreen === 'session_manager') return (
      <div className="flex flex-col items-center justify-center h-screen bg-retro-bg p-8 overflow-hidden">
        <div className="retro-window w-full max-w-5xl bg-white flex flex-col h-[85vh]">
          <div className="retro-header flex justify-between items-center">
            <span>📅 MANAJEMEN SESI EVENT</span>
            {!showCreateForm && <button onClick={()=>setShowCreateForm(true)} className="bg-white text-black px-4 font-bold border-2 border-black hover:bg-yellow-200">BUAT SESI BARU</button>}
          </div>

          <div className="p-8 flex flex-col flex-1 overflow-y-auto">
            {!showCreateForm && (
              <div className="flex flex-col h-full">
                <h2 className="font-pixel text-2xl mb-6">Riwayat Sesi Terakhir</h2>
                {store.recentEvents.length === 0 ? ( <p className="font-sys text-xl text-gray-500">Belum ada riwayat event.</p> ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {store.recentEvents.map(ev => (
                      <div key={ev.id} className="border-4 border-retro-border p-4 flex flex-col bg-gray-50 hover:bg-white hover:border-blue-500 group">
                        <h3 className="font-sys text-2xl font-bold mb-2">{ev.nama_event}</h3>
                        <p className="font-pixel text-[10px] text-gray-500 mb-4">{new Date(ev.created_at).toLocaleString()}</p>
                        <button onClick={()=>reopenEvent(ev.id)} className="retro-btn py-2 text-sm mt-auto opacity-0 group-hover:opacity-100 transition-opacity">Buka & Lanjutkan Sesi Ini</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showCreateForm && (
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-4 mb-6">
                  {store.recentEvents.length > 0 && <button onClick={()=>setShowCreateForm(false)} className="retro-btn-danger px-4 py-2 text-xs">KEMBALI</button>}
                  <h2 className="font-pixel text-2xl">Buka Sesi Event Baru</h2>
                </div>
                <div className="grid grid-cols-2 gap-6 border-b-4 border-retro-border pb-6">
                  <div className="flex flex-col font-sys text-xl"><label className="font-bold">Nama Event / Klien:</label><input type="text" className="border-4 border-retro-border p-2 outline-none" value={newEventData.nama_event} onChange={e=>setNewEventData({...newEventData, nama_event: e.target.value})} /></div>
                  <div className="flex flex-col font-sys text-xl"><label className="font-bold">Saldo Awal / Deposit (Rp):</label><input type="text" className="border-4 border-retro-border p-2 outline-none" value={formatRp(newEventData.saldo_awal)} onChange={e=>setNewEventData({...newEventData, saldo_awal: parseRp(e.target.value)})} placeholder="0" /></div>
                </div>
                <div className="flex flex-col font-sys text-xl mt-6 flex-1 overflow-y-auto pr-4">
                  <label className="font-bold mb-4">Pilih & Atur Harga Frame (WAJIB):</label>
                  <div className="grid grid-cols-3 gap-4 pb-10">
                    {store.templates.filter(t=>t.is_visible).map(tpl => {
                      const isSelected = selectedEventTemplates.find(t=>t.id === tpl.id);
                      return (
                        <div key={tpl.id} className={`border-4 p-2 flex flex-col gap-2 cursor-pointer transition-all ${isSelected ? 'border-blue-600 bg-blue-50' : 'border-gray-300 hover:border-blue-300'}`} onClick={(e) => { if(e.target.tagName !== 'INPUT') toggleEventTemplate(tpl); }}>
                          <div className="h-[120px] bg-gray-200 flex justify-center"><img src={`http://localhost:3000/templates/${tpl.filename}`} className="h-full object-contain" /></div>
                          <div className="flex items-center gap-2"><input type="checkbox" checked={!!isSelected} onChange={() => toggleEventTemplate(tpl)} className="w-5 h-5" /><span className="font-bold truncate text-sm">{tpl.filename}</span></div>
                          {isSelected && (
                            <div className="mt-auto">
                              <label className="text-xs font-bold text-retro-header">Harga Sesi Ini (Rp):</label>
                              <input type="text" className="w-full border-2 border-black p-1 text-sm outline-none" value={formatRp(isSelected.override_price)} onChange={(e) => setSelectedEventTemplates(prev => prev.map(p => p.id === tpl.id ? {...p, override_price: parseRp(e.target.value)} : p))} />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <button onClick={createEventSession} className="retro-btn py-4 text-xl mt-4 bg-retro-success shrink-0">BUKA EVENT SEKARANG</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );

    if (store.currentScreen === 'landing') return (
      <div className="flex flex-col items-center justify-center h-screen space-y-8 bg-retro-bg relative">
        <div className="absolute top-4 left-4 bg-white border-4 border-retro-border px-4 py-2 font-pixel text-sm text-retro-header shadow-md animate-pulse">🔴 LIVE: {store.activeEvent?.nama_event}</div>
        <div className="absolute top-4 right-4 bg-black text-white border-2 border-white px-3 py-1 font-pixel text-[10px] tracking-widest shadow-[2px_2px_0_0_#999]">
          MODE: {store.settings?.app_mode?.toUpperCase() || 'ONLINE'}
        </div>
        <div className="retro-window p-8 text-center animate-bounce">
          <h1 className="font-pixel text-6xl text-retro-border mb-4">SayGumi!</h1>
          <p className="font-sys text-2xl text-gray-600 tracking-wider">Tap anywhere to start</p>
        </div>
        <button onClick={() => { store.resetCustomerSession(); setCustomerName(''); setSessionExpiresAt(null); store.setScreen('template'); }} className="retro-btn px-10 py-6 text-2xl hover:brightness-110">MULAI SEKARANG</button>
      </div>
    );

    if (store.currentScreen === 'template') {
      const eventTemplates = JSON.parse(store.activeEvent?.templates_json || '[]');
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-retro-bg p-10">
          <h1 className="font-pixel text-4xl mb-8">Pilih Frame Favoritmu</h1>
          <div className="flex gap-8 overflow-y-auto max-w-6xl">
            {eventTemplates.map(tpl => (
              <div key={tpl.id} onClick={() => startCustomerPhoto(tpl)} className="retro-window w-[250px] bg-white cursor-pointer hover:scale-105 flex flex-col">
                <div className="h-[350px] bg-gray-200 border-b-4 border-retro-border p-2 relative flex justify-center items-center">
                  <img src={`http://localhost:3000/templates/${tpl.filename}`} className="max-w-full max-h-full object-contain drop-shadow-lg" />
                  <div className="absolute top-2 right-2 font-pixel text-[10px] text-white px-2 py-1 border-2 border-retro-border bg-retro-header">{tpl.override_price <= 0 ? 'GRATIS' : `Rp ${(tpl.override_price/1000)}k`}</div>
                </div>
                <div className="p-4 text-center font-pixel text-sm group-hover:bg-blue-100">PILIH FRAME</div>
              </div>
            ))}
          </div>
          <button onClick={() => store.setScreen('landing')} className="retro-btn-danger px-8 py-3 absolute bottom-8 left-8">KEMBALI</button>
        </div>
      );
    }

    if (store.currentScreen === 'payment') return <div className="flex flex-col items-center justify-center h-screen bg-retro-bg"><div className="retro-window w-[400px] p-6 bg-white text-center"><h2 className="font-pixel text-2xl mb-4">Scan QRIS</h2><div className="font-sys text-5xl font-bold text-retro-success mb-6">Rp {store.paymentAmount.toLocaleString('id-ID')}</div><div className="w-[280px] h-[280px] mx-auto border-4 border-retro-border flex items-center justify-center bg-gray-100 mb-6">{qrUrl ? <img src={qrUrl} className="w-[90%] h-[90%] object-contain" /> : <div className="animate-spin text-4xl">⏳</div>}</div><div className="font-sys text-2xl font-bold text-red-600">{statusText}</div></div></div>;
    
    if (store.currentScreen === 'input_name') return (
      <div className="flex flex-col items-center justify-center h-screen bg-retro-bg">
        <div className="retro-window w-[500px] p-8 bg-white text-center">
          <h2 className="font-pixel text-2xl mb-6">Nama Kamu Siapa?</h2>
          <input type="text" className="w-full border-4 border-black p-4 text-center font-sys text-2xl outline-none bg-gray-100 focus:bg-white" placeholder="Ketik namamu..." value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <button onClick={executeStartSessionTimer} className="retro-btn w-full mt-8 py-4 text-xl bg-retro-success">LANJUTKAN KE KAMERA</button>
        </div>
      </div>
    );

    if (store.currentScreen === 'camera') return (
      <div className="flex flex-col items-center justify-center h-screen bg-black relative">
        {sessionExpiresAt && <div className="absolute top-4 right-4 bg-red-600 text-white px-4 py-2 font-pixel text-xl border-4 border-white z-50">⏳ {Math.floor(timeLeftDisplay / 60).toString().padStart(2, '0')}:{(timeLeftDisplay % 60).toString().padStart(2, '0')}</div>}
        <h2 className="absolute top-8 font-pixel text-white z-10 text-2xl">Sisa Jepretan: {store.capturedPhotos.filter(p=>p===null).length}</h2>
        <div className="relative border-8 border-retro-border rounded-xl overflow-hidden bg-gray-800"><video ref={videoRef} autoPlay playsInline muted className="w-[800px] h-[600px] object-cover scale-x-[-1]"></video>{countdown && <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20"><span className="font-pixel text-6xl text-white drop-shadow-[4px_4px_0_rgba(242,109,109,1)]">{countdown}</span></div>}</div>
        <button onClick={takePhotoAction} disabled={countdown !== null} className={`retro-btn px-8 py-4 mt-8 text-xl ${countdown !== null ? 'opacity-50' : ''}`}>📸 MULAI FOTO</button><canvas ref={canvasRef} className="hidden"></canvas>
      </div>
    );

    if (store.currentScreen === 'review') return (
      <div className="flex flex-col items-center justify-center h-screen bg-retro-bg space-y-8 relative">
        {sessionExpiresAt && <div className="absolute top-4 right-4 bg-red-600 text-white px-4 py-2 font-pixel text-xl border-4 border-white z-50">⏳ {Math.floor(timeLeftDisplay / 60).toString().padStart(2, '0')}:{(timeLeftDisplay % 60).toString().padStart(2, '0')}</div>}
        <h1 className="font-pixel text-4xl">Review Hasil</h1>
        <div className="flex gap-6 max-w-6xl overflow-x-auto p-4">
          {store.capturedPhotos.map((photo, i) => (
            <div key={i} className="retro-window p-4 flex flex-col items-center bg-white shrink-0"><h3 className="font-pixel text-sm mb-2">Gaya {i + 1}</h3>{photo ? <img src={photo} className="w-[200px] h-[150px] object-cover border-4 border-retro-border scale-x-[-1]" /> : <div className="w-[200px] h-[150px] bg-gray-300 border-4 border-retro-border"></div>}
            {timeLeftDisplay > 60 && ( <button onClick={() => { const nw = [...store.capturedPhotos]; nw[i]=null; store.setCapturedPhotos(nw); store.decrementRetake(); store.setScreen('camera'); executeStartSessionTimer(); }} disabled={store.retakesLeft <= 0 || !photo} className="mt-4 px-4 py-2 font-pixel text-xs border-2 border-retro-border bg-gray-200 hover:bg-yellow-100 disabled:opacity-50">🔄 Retake</button> )}
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center gap-4 mt-4">
          {timeLeftDisplay > 60 && <p className="font-sys text-xl font-bold bg-white px-4 py-1 border-2 border-retro-border">Sisa Retake: {store.retakesLeft}</p>}
          <button onClick={processStitching} className="retro-btn px-10 py-4 text-2xl bg-retro-success">🖨️ CETAK SEKARANG</button>
        </div>
      </div>
    );

    if (store.currentScreen === 'result') return <div className="flex flex-col items-center justify-center h-screen space-y-6 bg-retro-bg"><h1 className="font-pixel text-3xl">Selesai! Scan untuk Download</h1><div className="flex gap-10"><div className="retro-window bg-white p-4 h-[400px] flex"><img src={`file://${finalResult?.printPath}`} className="max-h-full object-contain border-4" /></div><div className="retro-window bg-white p-8 flex flex-col items-center justify-center gap-4"><div className="border-4 p-2 bg-gray-100"><img src={finalResult?.qrCode} className="w-[200px] h-[200px]" /></div></div></div><button onClick={() => { store.resetCustomerSession(); store.setScreen('landing'); }} className="retro-btn px-8 py-4 mt-8">KEMBALI KE AWAL</button></div>;

    return null;
  };

  return (
    <div className="w-screen h-screen overflow-hidden relative">
      {renderScreen()}

      {/* ==========================================
          MODAL 1: LIVE DASHBOARD EVENT (Ctrl+Shift+D)
      ========================================== */}
      {isDashboardOpen && (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[100] p-10">
          <div className="retro-window w-full max-w-6xl bg-gray-100 flex flex-col h-[90vh]">
            <div className="retro-header bg-green-700">LIVE DASHBOARD - {store.activeEvent?.nama_event} <button onClick={()=>setDashboardOpen(false)}>X</button></div>
            
            <div className="p-6 flex flex-col gap-6 overflow-y-auto">
              {/* Top Stats Cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white border-4 border-retro-border p-4 text-center">
                  <p className="font-sys text-gray-500">Saldo/Deposit Awal</p>
                  <p className="font-pixel text-xl text-blue-600">Rp {formatRp(dashboardData?.stats?.saldo_awal)}</p>
                </div>
                <div className="bg-white border-4 border-retro-border p-4 text-center">
                  <p className="font-sys text-gray-500">Total Transaksi</p>
                  <p className="font-pixel text-xl text-black">{dashboardData?.stats?.total_trx || 0} Lembar</p>
                </div>
                <div className="bg-white border-4 border-retro-border p-4 text-center">
                  <p className="font-sys text-gray-500">Beban HPP (Kertas+Tinta)</p>
                  <p className="font-pixel text-xl text-red-600">Rp {formatRp(dashboardData?.stats?.total_beban_hpp)}</p>
                </div>
                <div className="bg-white border-4 border-retro-border p-4 text-center shadow-[4px_4px_0_0_#222]">
                  <p className="font-sys font-bold">Saldo / Laba Bersih</p>
                  <p className={`font-pixel text-2xl ${dashboardData?.stats?.sisa_saldo < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    Rp {formatRp(dashboardData?.stats?.sisa_saldo)}
                  </p>
                </div>
              </div>

              {/* Tabel Riwayat Sesi */}
              <div className="bg-white border-4 border-retro-border flex-1 flex flex-col">
                <div className="bg-gray-200 border-b-4 border-retro-border p-2 font-pixel text-sm flex">
                  <div className="w-[150px]">WAKTU</div><div className="flex-1">NAMA PELANGGAN</div><div className="w-[150px]">STATUS</div><div className="w-[150px]">HARGA</div>
                </div>
                <div className="overflow-y-auto font-sys text-lg">
                  {dashboardData?.sessions?.length === 0 && <p className="p-4 text-center text-gray-500">Belum ada transaksi.</p>}
                  {dashboardData?.sessions?.map((s, i) => (
                    <div key={i} className="flex p-2 border-b-2 border-gray-100 hover:bg-yellow-50">
                      <div className="w-[150px] text-sm text-gray-500">{s.waktu}</div>
                      <div className="flex-1 font-bold">{s.customer_name}</div>
                      <div className="w-[150px] text-green-600">{s.status_cetak}</div>
                      <div className="w-[150px]">Rp {formatRp(s.harga_jual)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 2: GLOBAL SETTINGS (Ctrl+Shift+P)
      ========================================== */}
      {isGlobalOpen && (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[90] p-10">
          <div className="retro-window w-[800px] bg-white flex flex-col max-h-[90vh]">
            <div className="retro-header bg-gray-800">GLOBAL SETTINGS.INI <button onClick={()=>setGlobalOpen(false)}>X</button></div>
            <form onSubmit={saveGlobalSettings} className="p-8 overflow-y-auto flex flex-col gap-6 font-sys text-xl">
              <div className="flex items-center gap-4 bg-yellow-100 p-4 border-2 border-black">
                <label className="font-bold">Mode Aplikasi:</label>
                <select className="border-2 border-black p-1 outline-none" value={globalData.app_mode} onChange={e=>setGlobalData({...globalData, app_mode: e.target.value})}>
                  <option value="online">ONLINE (Midtrans Aktif)</option>
                  <option value="offline">OFFLINE (Bayar Kasir)</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col"><label className="font-bold">HPP Kertas (Rp)</label><input type="text" className="border-4 p-2 outline-none" value={formatRp(globalData.hpp_kertas)} onChange={e=>setGlobalData({...globalData, hpp_kertas: parseRp(e.target.value)})} /></div>
                <div className="flex flex-col"><label className="font-bold">HPP Tinta (Rp)</label><input type="text" className="border-4 p-2 outline-none" value={formatRp(globalData.hpp_tinta)} onChange={e=>setGlobalData({...globalData, hpp_tinta: parseRp(e.target.value)})} /></div>
                <div className="flex flex-col"><label className="font-bold">Biaya Ops (Rp)</label><input type="text" className="border-4 p-2 outline-none" value={formatRp(globalData.biaya_ops)} onChange={e=>setGlobalData({...globalData, biaya_ops: parseRp(e.target.value)})} /></div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-bold">Midtrans Server Key (Global):</label><input type="text" className="border-4 p-2 outline-none" value={globalData.midtrans_server_key} onChange={e=>setGlobalData({...globalData, midtrans_server_key: e.target.value})} />
                <label className="font-bold">Midtrans Client Key (Global):</label><input type="text" className="border-4 p-2 outline-none" value={globalData.midtrans_client_key} onChange={e=>setGlobalData({...globalData, midtrans_client_key: e.target.value})} />
              </div>
              <button type="submit" className="retro-btn py-4 bg-retro-success mt-4">SIMPAN PENGATURAN MESIN</button>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL 3: MASTER TEMPLATE (Ctrl+Shift+T)
      ========================================== */}
      {isTemplateOpen && (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[90] p-10">
          <div className="retro-window w-full max-w-6xl bg-gray-100 flex flex-col h-[90vh]">
            <div className="retro-header bg-blue-800">MASTER TEMPLATE LIBRARY <button onClick={()=>setTemplateOpen(false)}>X</button></div>
            <div className="p-6 flex flex-col gap-6 overflow-y-auto">
              <div className="flex justify-between items-center bg-white p-4 border-4 border-retro-border">
                <div><h2 className="font-pixel text-xl">Database Master Template</h2></div>
                <button onClick={uploadMasterTemplate} className="retro-btn px-6 py-3">➕ UPLOAD PNG BARU</button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {store.templates.map(tpl => (
                  <div key={tpl.id} className="bg-white border-4 p-4 flex gap-4">
                    <div className="w-[100px] h-[140px] bg-gray-200 flex justify-center items-center shrink-0 border-2"><img src={`http://localhost:3000/templates/${tpl.filename}`} className="max-h-full object-contain" /></div>
                    <div className="flex flex-col flex-1 font-sys gap-2">
                      <p className="font-bold truncate border-b-2 pb-1">{tpl.filename}</p>
                      <div className="flex gap-4"><label className="text-sm"><input type="checkbox" checked={tpl.is_visible===1} onChange={e=>updateMasterAttr(tpl, 'is_visible', e.target.checked?1:0)} /> Tampil di List</label></div>
                      <div className="flex items-center gap-2 mt-2"><span className="text-sm font-bold">Harga Dasar: Rp</span><input type="text" className="border-2 p-1 w-24 outline-none" value={formatRp(tpl.price)} onChange={(e) => updateMasterAttr(tpl, 'price', parseRp(e.target.value))} /></div>
                      <div className="mt-auto flex gap-2">
                        <button onClick={() => setEditingTemplate(tpl)} className="retro-btn flex-1 py-1 text-xs">Atur Slot</button>
                        <button onClick={() => { if(confirm("Hapus master template?")) window.electronAPI.deleteTemplate(tpl.id).then(()=>store.fetchTemplates()); }} className="retro-btn-danger px-3 py-1 text-xs font-bold">X</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {editingTemplate && <VisualEditor template={editingTemplate} onCancel={()=>setEditingTemplate(null)} onSave={async(s) => { await updateMasterAttr(editingTemplate, 'slots', s); setEditingTemplate(null); alert("Disimpan!"); }} />}
    </div>
  );
}