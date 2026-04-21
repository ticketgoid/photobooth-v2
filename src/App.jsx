import { useEffect, useState, useRef } from 'react';
import { useStore } from './store/useStore';

// ==========================================
// 1. KOMPONEN: Layar Pembayaran (Sesi 6)
// ==========================================
function PaymentScreen() {
  const { paymentAmount, nextScreenAfterPayment, setScreen } = useStore();
  const [qrUrl, setQrUrl] = useState(null);
  const [statusText, setStatusText] = useState("Membuat Tagihan...");
  const [timeLeft, setTimeLeft] = useState(300); // 5 menit

  useEffect(() => {
    let checkInterval;
    let timerInterval;

    const initPayment = async () => {
      if (!window.electronAPI) return;
      
      try {
        const res = await window.electronAPI.createQris(paymentAmount);
        
        if (res.success) {
          setQrUrl(res.qrUrl);
          setStatusText("Menunggu Pembayaran...");
          
          checkInterval = setInterval(async () => {
            try {
              const check = await window.electronAPI.checkPayment(res.orderId);
              if (check.success && check.status === 'settlement') {
                clearInterval(checkInterval);
                clearInterval(timerInterval);
                setStatusText("✅ Pembayaran Berhasil!");
                setTimeout(() => setScreen(nextScreenAfterPayment), 2000);
              }
            } catch(e) { console.error("Error cek status:", e); }
          }, 3000);

          timerInterval = setInterval(() => {
            setTimeLeft((prev) => {
              if (prev <= 1) {
                clearInterval(checkInterval);
                clearInterval(timerInterval);
                setStatusText("❌ Waktu Habis");
                setTimeout(() => setScreen('landing'), 3000);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);

        } else {
          // Tangkap error dari backend (misal salah API Key)
          setStatusText("❌ API Error: " + (res.error || "Gagal Midtrans"));
          setTimeout(() => setScreen('landing'), 3500);
        }
      } catch (err) {
        // Tangkap error jika IPC terputus
        setStatusText("❌ Sistem Error: Backend Tidak Merespon");
        console.error(err);
        setTimeout(() => setScreen('landing'), 3500);
      }
    };

    initPayment();
    return () => { clearInterval(checkInterval); clearInterval(timerInterval); };
  }, []);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen space-y-6">
      <div className="retro-window w-[400px] flex flex-col items-center p-6 bg-white">
        <h2 className="font-pixel text-2xl mb-4">Scan QRIS</h2>
        <div className="font-sys text-5xl font-bold text-retro-success mb-6">Rp {paymentAmount.toLocaleString('id-ID')}</div>
        
        <div className="w-[280px] h-[280px] border-4 border-retro-border border-dashed flex items-center justify-center bg-gray-100 mb-6 relative">
          {qrUrl ? (
            <img src={qrUrl} alt="QRIS" className="w-[90%] h-[90%] object-contain" />
          ) : (
            <div className="animate-spin text-4xl">⏳</div>
          )}
        </div>
        
        <div className="font-sys text-2xl font-bold text-center text-red-600">{statusText}</div>
        {qrUrl && statusText === "Menunggu Pembayaran..." && (
          <div className="mt-2 font-pixel text-retro-header bg-yellow-100 px-4 py-2 border-2 border-retro-border">
            Sisa Waktu: {formatTime(timeLeft)}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 2. KOMPONEN: Layar Kamera (Live Capture)
// ==========================================
function CameraScreen() {
  const { sessionFolder, setScreen, capturedPhotos, setCapturedPhotos } = useStore();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [countdown, setCountdown] = useState(null);
  const [shotCount, setShotCount] = useState(0);

  useEffect(() => {
    let stream = null;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) { alert("Gagal mengakses kamera!"); }
    };
    startCamera();
    return () => { if (stream) stream.getTracks().forEach(track => track.stop()); };
  }, []);

  const takePhoto = async () => {
    const currentPhotos = [...capturedPhotos];
    for (let i = 0; i < 3; i++) {
      if (currentPhotos[i] !== null) continue;

      for (let c = 3; c > 0; c--) {
        setCountdown(c);
        await new Promise(r => setTimeout(r, 1000));
      }
      setCountdown('📸 CEKREK!');
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Data = canvas.toDataURL('image/jpeg', 0.9);

      if (window.electronAPI && sessionFolder) {
        await window.electronAPI.saveCapture({ folderPath: sessionFolder, base64Data, index: i + 1 });
      }
      
      currentPhotos[i] = base64Data;
      setCapturedPhotos([...currentPhotos]);
      setShotCount(i + 1);
      
      await new Promise(r => setTimeout(r, 1000));
    }
    
    setCountdown('SELESAI!');
    setTimeout(() => setScreen('review'), 1500);
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black relative">
      <h2 className="absolute top-8 font-pixel text-white z-10 drop-shadow-md">Ambil Gaya Terbaikmu!</h2>
      <div className="relative border-8 border-retro-border rounded-xl overflow-hidden shadow-[10px_10px_0px_0px_rgba(255,255,255,0.2)] bg-gray-800 flex justify-center items-center">
        <video ref={videoRef} autoPlay playsInline muted className="w-[800px] h-[600px] object-cover scale-x-[-1]"></video>
        {countdown && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20 overflow-hidden">
            <style>{`@keyframes pop-in { 0% { transform: scale(0.5); opacity: 0; } 70% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(1); opacity: 1; } } .animate-pop-in { animation: pop-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }`}</style>
            <span key={countdown} className="animate-pop-in font-pixel text-5xl md:text-6xl text-white text-center w-full px-4 drop-shadow-[4px_4px_0_rgba(242,109,109,1)]">{countdown}</span>
          </div>
        )}
      </div>
      <button onClick={takePhoto} disabled={countdown !== null} className={`retro-btn px-8 py-4 mt-8 text-xl ${countdown !== null ? 'opacity-50 cursor-not-allowed' : ''}`}>📸 MULAI FOTO</button>
      <canvas ref={canvasRef} className="hidden"></canvas>
    </div>
  );
}

// ==========================================
// 3. KOMPONEN: Layar Review & Retake
// ==========================================
function ReviewScreen() {
  const { capturedPhotos, setCapturedPhotos, retakesLeft, decrementRetake, setScreen, resetSession, setupPayment } = useStore();

  const handleRetake = (index) => {
    if (retakesLeft <= 0) return alert("Jatah Retake Anda habis!");
    const newPhotos = [...capturedPhotos];
    newPhotos[index] = null;
    setCapturedPhotos(newPhotos);
    decrementRetake();
    setScreen('camera');
  };

  const handleSelesai = () => {
    alert("Memproses ke Printer (Sesi 7)...");
    resetSession();
    setScreen('landing');
  };

  const handleUpsell = () => {
    // Upsell Cetak Ekstra Rp 15.000, kembali ke Review setelah bayar
    setupPayment(15000, 'review'); 
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen space-y-8">
      <h1 className="font-pixel text-4xl">Review Hasil Foto</h1>
      
      <div className="flex gap-6">
        {capturedPhotos.map((photo, index) => (
          <div key={index} className="retro-window p-4 flex flex-col items-center gap-4 bg-white">
            <h3 className="font-pixel text-sm">Gaya {index + 1}</h3>
            {photo ? (
              <img src={photo} alt={`Gaya ${index + 1}`} className="w-[240px] h-[180px] object-cover border-4 border-retro-border scale-x-[-1]" />
            ) : (
              <div className="w-[240px] h-[180px] bg-gray-300 border-4 border-retro-border flex items-center justify-center font-sys text-xl">Kosong</div>
            )}
            <button onClick={() => handleRetake(index)} disabled={retakesLeft <= 0 || !photo} className={`px-4 py-2 font-pixel text-xs border-2 border-retro-border shadow-[2px_2px_0px_0px_rgba(51,51,51,1)] ${retakesLeft <= 0 || !photo ? 'bg-gray-400 cursor-not-allowed text-gray-700' : 'bg-retro-window hover:bg-yellow-100 active:translate-y-1 active:shadow-none'}`}>
              🔄 Ulang Foto
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-4 mt-8">
        <p className="font-sys text-2xl font-bold text-retro-header bg-white px-4 py-2 border-2 border-retro-border">Sisa Jatah Retake: {retakesLeft}</p>
        <div className="flex gap-4">
          {/* [BARU] Tombol Upsell Add-on */}
          <button onClick={handleUpsell} className="retro-btn px-8 py-4 text-xl bg-yellow-400 text-black hover:bg-yellow-300">
            ➕ TAMBAH CETAK (Rp 15k)
          </button>
          <button onClick={handleSelesai} className="retro-btn px-8 py-4 text-xl bg-retro-success">
            🖨️ CETAK & SELESAI
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 4. KOMPONEN: Layar Utama (Landing Page)
// ==========================================
function LandingScreen() {
  const { settings, setSessionFolder, setScreen, resetSession, setupPayment } = useStore();

  const handleStartSession = async () => {
    resetSession();
    if (window.electronAPI) {
      const folder = await window.electronAPI.startSession(settings?.nama_event || 'EventDefault');
      setSessionFolder(folder);
      
      // Logika Bypass Offline Cerdas
      if (!navigator.onLine) {
        // Jika internet mati, otomatis GRATIS (langsung ke kamera)
        alert("MODE OFFLINE: Pembayaran dilewati (Gratis).");
        setScreen('camera');
      } else {
        // Jika Online, masuk ke proses QRIS (Misal harga default Rp 15.000)
        setupPayment(15000, 'camera'); 
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen space-y-12">
      <div className="retro-window p-8 text-center animate-bounce">
        <h1 className="font-pixel text-5xl text-retro-border mb-4">PHOTOBOOTH</h1>
        <p className="font-sys text-2xl text-gray-600 tracking-wider">Tap anywhere to start</p>
      </div>
      <button onClick={handleStartSession} className="retro-btn px-10 py-6 text-2xl hover:brightness-110">
        MULAI SEKARANG
      </button>
    </div>
  );
}

// ==========================================
// 5. KOMPONEN: Root App & Menu Admin
// ==========================================
function App() {
  const { settings, fetchSettings, isAdminOpen, toggleAdmin, currentScreen } = useStore();
  const [formData, setFormData] = useState({ nama_event: '', saldo_awal: 0, hpp_kertas: 0, hpp_tinta: 0, biaya_ops: 0 });

  useEffect(() => {
    fetchSettings();
    const handleKeyDown = (e) => { if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') toggleAdmin(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => { if (settings) setFormData(settings); }, [settings]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (window.electronAPI) {
      await window.electronAPI.saveSettings(formData);
      fetchSettings();
      toggleAdmin();
    }
  };

  return (
    <div className="w-screen h-screen">
      {/* ROUTER */}
      {currentScreen === 'landing' && <LandingScreen />}
      {currentScreen === 'payment' && <PaymentScreen />}
      {currentScreen === 'camera' && <CameraScreen />}
      {currentScreen === 'review' && <ReviewScreen />}

      {/* OVERLAY MENU ADMIN (Disembunyikan kodenya untuk keringkasan visual, isinya sama persis seperti sesi sebelumnya) */}
      {isAdminOpen && (
        <div className="fixed top-0 left-0 w-full h-full bg-black/70 flex justify-center items-center z-50">
          <div className="retro-window w-[500px]">
            <div className="retro-header"><span>SYSTEM.INI - [ADMIN MODE]</span><button onClick={toggleAdmin} className="text-white hover:text-black">X</button></div>
            <form onSubmit={handleSave} className="p-6 font-sys text-2xl flex flex-col gap-4">
              <div className="flex flex-col"><label>Nama Event:</label><input type="text" className="border-4 border-retro-border p-2 bg-white outline-none" value={formData.nama_event} onChange={e => setFormData({...formData, nama_event: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4"><div className="flex flex-col"><label>Saldo Awal (Rp):</label><input type="number" className="border-4 border-retro-border p-2 bg-white outline-none" value={formData.saldo_awal} onChange={e => setFormData({...formData, saldo_awal: parseInt(e.target.value) || 0})} /></div><div className="flex flex-col"><label>Biaya Ops (Rp):</label><input type="number" className="border-4 border-retro-border p-2 bg-white outline-none" value={formData.biaya_ops} onChange={e => setFormData({...formData, biaya_ops: parseInt(e.target.value) || 0})} /></div></div>
              <div className="grid grid-cols-2 gap-4"><div className="flex flex-col"><label>HPP Kertas (Rp):</label><input type="number" className="border-4 border-retro-border p-2 bg-white outline-none" value={formData.hpp_kertas} onChange={e => setFormData({...formData, hpp_kertas: parseInt(e.target.value) || 0})} /></div><div className="flex flex-col"><label>HPP Tinta (Rp):</label><input type="number" className="border-4 border-retro-border p-2 bg-white outline-none" value={formData.hpp_tinta} onChange={e => setFormData({...formData, hpp_tinta: parseInt(e.target.value) || 0})} /></div></div>
              <div className="flex justify-end gap-4 mt-4"><button type="button" onClick={toggleAdmin} className="retro-btn-danger px-6 py-2">CANCEL</button><button type="submit" className="retro-btn px-6 py-2">SAVE.EXE</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;