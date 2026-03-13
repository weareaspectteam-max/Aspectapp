/**
 * OzelIsEkrani
 * Özel iş (makine tamiri, ekipman taşıma vb.) için
 * basit başlat → tamamla akışı: not ekleme, fotoğraf yükleme.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, CheckCircle2, Play, Clock, AlertTriangle,
  Loader2, Camera, FileText, X, Image
} from 'lucide-react';
import { motion } from 'motion/react';
import { StaffTopBar } from './staff-top-bar';
import { authHeaders } from '../lib/api';
import { projectId } from '/utils/supabase/info';
import { localDateStr } from '../lib/date';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

interface OzelIsKayit {
  taskId: string;
  tarih: string;
  baslatildi: boolean;
  tamamlandi: boolean;
  baslamaNot: string;
  baslatan: string;
  baslamaTarihi: string;
  tamamlamaTarihi: string | null;
  tamamlamaNot: string;
  fotografUrl: string | null;
}

interface OzelIsEkraniProps {
  userName: string;
  userId: string;
  userRole: string;
  task: {
    id: string;
    location: string;
    locationIcon: string;
    startTime: string;
    endTime: string;
    notes?: string;
  };
  onBack: () => void;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export function OzelIsEkrani({ userName, userId, userRole, task, onBack, onLogout, onNavigate }: OzelIsEkraniProps) {
  const tarih = localDateStr();

  type Asama = 'yukleniyor' | 'bekliyor' | 'devamda' | 'tamamlandi';
  const [asama, setAsama] = useState<Asama>('yukleniyor');
  const [kayit, setKayit] = useState<OzelIsKayit | null>(null);

  // Başlatma
  const [baslamaNot, setBaslamaNot] = useState('');
  const [baslatYukleniyor, setBaslatYukleniyor] = useState(false);
  const [baslatHata, setBaslatHata] = useState('');

  // Tamamlama
  const [tamamlamaNot, setTamamlamaNot] = useState('');
  const [fotografPreview, setFotografPreview] = useState<string | null>(null);
  const [tamamlaYukleniyor, setTamamlaYukleniyor] = useState(false);
  const [tamamlaHata, setTamamlaHata] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Geçen süre (başlatıldıktan sonra)
  const [gecenSure, setGecenSure] = useState('');

  const durumYukle = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/ozel-is/durum/${task.id}/${tarih}`, { headers });
      if (!res.ok) { setAsama('bekliyor'); return; }
      const data = await res.json();
      if (!data.kayit) { setAsama('bekliyor'); return; }
      const k: OzelIsKayit = data.kayit;
      setKayit(k);
      if (k.tamamlandi) setAsama('tamamlandi');
      else if (k.baslatildi) setAsama('devamda');
      else setAsama('bekliyor');
    } catch {
      setAsama('bekliyor');
    }
  }, [task.id, tarih]);

  useEffect(() => { durumYukle(); }, [durumYukle]);

  // Geçen süre sayacı
  useEffect(() => {
    if (asama !== 'devamda' || !kayit?.baslamaTarihi) return;
    const update = () => {
      const bas = new Date(kayit.baslamaTarihi).getTime();
      const simdi = Date.now();
      const diff = Math.floor((simdi - bas) / 1000);
      const h = Math.floor(diff / 3600).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      setGecenSure(`${h}:${m}:${s}`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [asama, kayit?.baslamaTarihi]);

  const handleBaslat = async () => {
    setBaslatYukleniyor(true);
    setBaslatHata('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/ozel-is/baslat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ taskId: task.id, tarih, baslamaNot }),
      });
      const data = await res.json();
      if (!res.ok) { setBaslatHata(data.error || 'Başlatılamadı.'); return; }
      setKayit(data.kayit);
      setAsama('devamda');
    } catch {
      setBaslatHata('Bağlantı hatası.');
    } finally {
      setBaslatYukleniyor(false);
    }
  };

  const handleFotografSec = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setFotografPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleTamamla = async () => {
    setTamamlaYukleniyor(true);
    setTamamlaHata('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/ozel-is/tamamla`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          taskId: task.id,
          tarih,
          tamamlamaNot,
          fotografUrl: fotografPreview || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setTamamlaHata(data.error || 'Tamamlanamadı.'); return; }
      setKayit(data.kayit);
      setAsama('tamamlandi');
    } catch {
      setTamamlaHata('Bağlantı hatası.');
    } finally {
      setTamamlaYukleniyor(false);
    }
  };

  // ─── Ekranlar ──────────────────────────────────────────────────────────────

  const BeklyorEkrani = () => (
    <div className="space-y-4">
      <div className="backdrop-blur-xl bg-white/8 rounded-2xl border border-white/15 p-5 text-center">
        <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">{task.locationIcon || '🔧'}</span>
        </div>
        <h3 className="text-base font-bold text-white mb-1">{task.location}</h3>
        <p className="text-sm text-white/50">Görevi başlatmak için aşağıdaki butona tıklayın.</p>
      </div>

      <div className="backdrop-blur-xl bg-white/8 rounded-2xl border border-white/15 p-4">
        <label className="text-xs text-white/50 mb-2 flex items-center gap-1.5">
          <FileText className="w-3 h-3" />
          Başlama Notu (isteğe bağlı)
        </label>
        <textarea
          value={baslamaNot}
          onChange={e => setBaslamaNot(e.target.value)}
          placeholder="Göreve başlamadan önce notunuzu girin..."
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 resize-none outline-none focus:border-purple-400/50"
        />
      </div>

      {baslatHata && (
        <div className="flex items-center gap-2 bg-red-500/15 border border-red-500/30 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-300">{baslatHata}</p>
        </div>
      )}

      <motion.button
        onClick={handleBaslat}
        disabled={baslatYukleniyor}
        whileTap={{ scale: 0.97 }}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600/80 to-violet-600/80 border border-purple-400/30 text-white font-bold text-base shadow-xl disabled:opacity-60 flex items-center justify-center gap-3"
      >
        {baslatYukleniyor
          ? <Loader2 className="w-5 h-5 animate-spin" />
          : <Play className="w-5 h-5" />
        }
        Görevi Başlat
      </motion.button>
    </div>
  );

  const DevamEkrani = () => (
    <div className="space-y-4">
      {/* Sayaç */}
      <div className="backdrop-blur-xl bg-purple-500/12 rounded-2xl border border-purple-500/25 p-5 text-center">
        <p className="text-xs text-purple-300/70 mb-1 font-semibold">GEÇEN SÜRE</p>
        <p className="text-4xl font-black text-white tracking-widest font-mono">{gecenSure || '00:00:00'}</p>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-400" />
          </span>
          <p className="text-xs text-purple-300/60">Devam ediyor</p>
        </div>
      </div>

      {/* Başlama notu */}
      {kayit?.baslamaNot && (
        <div className="backdrop-blur-xl bg-white/6 rounded-xl border border-white/10 px-4 py-3">
          <p className="text-[10px] text-white/40 mb-1">Başlama Notu</p>
          <p className="text-sm text-white/80">{kayit.baslamaNot}</p>
        </div>
      )}

      {/* Tamamlama notu */}
      <div className="backdrop-blur-xl bg-white/8 rounded-2xl border border-white/15 p-4">
        <label className="text-xs text-white/50 mb-2 flex items-center gap-1.5">
          <FileText className="w-3 h-3" />
          Tamamlama Notu (isteğe bağlı)
        </label>
        <textarea
          value={tamamlamaNot}
          onChange={e => setTamamlamaNot(e.target.value)}
          placeholder="Yapılan işler, önemli notlar..."
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 resize-none outline-none focus:border-purple-400/50"
        />
      </div>

      {/* Fotoğraf yükleme */}
      <div className="backdrop-blur-xl bg-white/8 rounded-2xl border border-white/15 p-4">
        <label className="text-xs text-white/50 mb-2 flex items-center gap-1.5">
          <Camera className="w-3 h-3" />
          Fotoğraf Ekle (isteğe bağlı)
        </label>

        {fotografPreview ? (
          <div className="relative">
            <img
              src={fotografPreview}
              alt="Önizleme"
              className="w-full h-40 object-cover rounded-xl border border-white/10"
            />
            <button
              onClick={() => setFotografPreview(null)}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 border border-white/20 flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-28 border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center gap-2 text-white/40 hover:border-purple-400/40 hover:text-white/60 transition-all"
          >
            <Image className="w-8 h-8" />
            <span className="text-xs">Fotoğraf seç veya çek</span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFotografSec}
        />
      </div>

      {tamamlaHata && (
        <div className="flex items-center gap-2 bg-red-500/15 border border-red-500/30 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-300">{tamamlaHata}</p>
        </div>
      )}

      <motion.button
        onClick={handleTamamla}
        disabled={tamamlaYukleniyor}
        whileTap={{ scale: 0.97 }}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-green-600/80 to-emerald-600/80 border border-green-400/30 text-white font-bold text-base shadow-xl disabled:opacity-60 flex items-center justify-center gap-3"
      >
        {tamamlaYukleniyor
          ? <Loader2 className="w-5 h-5 animate-spin" />
          : <CheckCircle2 className="w-5 h-5" />
        }
        Görevi Tamamla
      </motion.button>
    </div>
  );

  const TamamlandiEkrani = () => {
    const sure = kayit?.baslamaTarihi && kayit.tamamlamaTarihi
      ? Math.round((new Date(kayit.tamamlamaTarihi).getTime() - new Date(kayit.baslamaTarihi).getTime()) / 60000)
      : null;

    return (
      <div className="space-y-4">
        <div className="backdrop-blur-xl bg-green-500/12 rounded-2xl border border-green-500/30 p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500/40 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-400" />
          </div>
          <h3 className="text-xl font-black text-white mb-1">Görev Tamamlandı!</h3>
          <p className="text-sm text-white/50">{task.location}</p>
          {sure !== null && (
            <p className="text-xs text-green-300/70 mt-2">{sure} dakikada tamamlandı</p>
          )}
        </div>

        <div className="backdrop-blur-xl bg-white/8 rounded-2xl border border-white/15 p-4 space-y-3">
          {kayit?.baslamaNot && (
            <div>
              <p className="text-[10px] text-white/40 mb-1">Başlama Notu</p>
              <p className="text-sm text-white/80">{kayit.baslamaNot}</p>
            </div>
          )}
          {kayit?.tamamlamaNot && (
            <div className="pt-2 border-t border-white/8">
              <p className="text-[10px] text-white/40 mb-1">Tamamlama Notu</p>
              <p className="text-sm text-white/80">{kayit.tamamlamaNot}</p>
            </div>
          )}
          {kayit?.fotografUrl && (
            <div className="pt-2 border-t border-white/8">
              <p className="text-[10px] text-white/40 mb-2">Fotoğraf</p>
              <img
                src={kayit.fotografUrl}
                alt="Görev fotoğrafı"
                className="w-full h-40 object-cover rounded-xl border border-white/10"
              />
            </div>
          )}
          <div className="pt-2 border-t border-white/8 flex justify-between text-xs text-white/40">
            <span>Tamamlayan</span>
            <span className="text-white/70">{kayit?.tamamlayan}</span>
          </div>
        </div>

        <button
          onClick={onBack}
          className="w-full py-3.5 rounded-2xl bg-white/8 border border-white/15 text-white font-bold text-sm active:scale-[0.98] transition-all"
        >
          Ana Sayfaya Dön
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0a3c] via-[#0a051e] to-[#0d0a2e] pb-8">
      <StaffTopBar
        userName={userName}
        userRole={userRole as any}
        onLogout={onLogout}
        onNavigate={onNavigate}
        onBack={onBack}
        showBackButton={true}
      />

      <div className="px-4 pt-4 pb-8">
        {/* Görev başlığı */}
        <div className="backdrop-blur-xl bg-gradient-to-br from-purple-500/20 to-violet-500/10 rounded-2xl border border-purple-500/30 px-4 py-4 mb-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300">🔧 ÖZEL İŞ</span>
          </div>
          <h2 className="text-base font-bold text-white">{task.location}</h2>
          <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{task.startTime} – {task.endTime}</span>
          </div>
          {task.notes && (
            <p className="text-xs text-purple-300/70 mt-2 bg-purple-500/10 rounded-lg px-3 py-1.5">{task.notes}</p>
          )}
        </div>

        {/* İçerik */}
        {asama === 'yukleniyor' && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
        )}
        {asama === 'bekliyor' && <BeklyorEkrani />}
        {asama === 'devamda' && <DevamEkrani />}
        {asama === 'tamamlandi' && <TamamlandiEkrani />}
      </div>
    </div>
  );
}