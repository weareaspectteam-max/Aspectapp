/**
 * EkstraIsEkrani
 * Ekstra iş (başka lokasyonda çekim) için açılış → satış → kapanış akışı.
 * Stok: depo veya başka mekandan alınır, günsonunda iade edilir.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Package, Camera, CheckCircle2, AlertTriangle,
  Loader2, ChevronDown, ChevronUp, Plus, Minus, ClipboardList,
  ArrowRightLeft, MapPin, Clock, X, Printer, Film
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StaffTopBar } from './staff-top-bar';
import { authHeaders } from '../lib/api';
import { projectId } from '/utils/supabase/info';
import { bizDateStr } from '../lib/date';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

// ─── Types ───────────────────────────────────────────────────────────────────

interface StokSayim {
  album3: number; album5: number; album7: number; album9: number;
  album11: number; album13: number; album15: number;
}

const bosStok = (): StokSayim => ({
  album3: 0, album5: 0, album7: 0, album9: 0, album11: 0, album13: 0, album15: 0
});

const ALBUM_ALANLARI: (keyof StokSayim)[] = [
  'album3','album5','album7','album9','album11','album13','album15'
];

const ALBUM_ETIKET: Record<string, string> = {
  album3:'3 Kare', album5:'5 Kare', album7:'7 Kare', album9:'9 Kare',
  album11:'11 Kare', album13:'13 Kare', album15:'15 Kare',
};

const ALBUM_RENK: Record<string, string> = {
  album3:'#9dd9ea', album5:'#a8e6cf', album7:'#ffd4a3', album9:'#ffb3ba',
  album11:'#d4a5ff', album13:'#b8d4f1', album15:'#ffc78f',
};

interface Kaynak {
  id: string;
  name: string;
  emoji: string;
  color?: string;
}

interface KareKayit {
  id: string;
  photographerName: string;
  photographerId: string;
  frameCount: number;
  timestamp: string;
}

interface EkstraIsKayit {
  taskId: string;
  tarih: string;
  kaynakId: string;
  kaynakAdi: string;
  kaynakEmoji: string;
  acilis: StokSayim;
  acilisNot: string;
  acilisYapildi: boolean;
  acilisZamani: string;
  kapanisYapildi: boolean;
  kapalis?: StokSayim;
  kapanisAnomali?: Partial<StokSayim>;
  kapanisBeklenen?: StokSayim;
  kapanisZamani?: string;
  kareKayitlari: KareKayit[];
}

interface EkstraIsEkraniProps {
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

// ─── Yazıcı tipi ─────────────────────────────────────────────────────────────
interface EkstraYazici {
  ekipmanId: string;
  brand: string;
  model: string;
  serialNumber: string;
  status: string;
  mekanId: string | null;
  mekanAdi: string | null;
  mekanEmoji: string | null;
  lastEndCounter: number | null;
  lastEndTarih: string | null;
  lastEndRibonMevcut: number | null;
}

// ─── Stok sayım giriş satırı ─────────────────────────────────────────────────
function StokSatir({
  alan, value, onChange, maxValue, disabled
}: {
  alan: keyof StokSayim;
  value: number;
  onChange: (v: number) => void;
  maxValue?: number;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/6 last:border-0">
      <div
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: ALBUM_RENK[alan] }}
      />
      <span className="flex-1 text-sm text-white">{ALBUM_ETIKET[alan]}</span>
      {maxValue !== undefined && (
        <span className="text-[10px] text-white/30 mr-1">max {maxValue}</span>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={() => !disabled && onChange(Math.max(0, value - 1))}
          disabled={disabled || value === 0}
          className="w-7 h-7 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white disabled:opacity-30 active:scale-90 transition-all"
        >
          <Minus className="w-3 h-3" />
        </button>
        <span className="w-8 text-center text-sm font-bold text-white">{value}</span>
        <button
          onClick={() => {
            if (disabled) return;
            if (maxValue !== undefined && value >= maxValue) return;
            onChange(value + 1);
          }}
          disabled={disabled || (maxValue !== undefined && value >= maxValue)}
          className="w-7 h-7 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-white disabled:opacity-30 active:scale-90 transition-all"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────
export function EkstraIsEkrani({ userName, userId, userRole, task, onBack, onLogout, onNavigate }: EkstraIsEkraniProps) {
  const tarih = bizDateStr();

  // Aşama: yukleniyor | kaynak-sec | yazici-sec | acilis | calisiyor | kapalis | tamamlandi
  type Asama = 'yukleniyor' | 'kaynak-sec' | 'yazici-sec' | 'acilis' | 'calisiyor' | 'kapalis' | 'tamamlandi';
  const [asama, setAsama] = useState<Asama>('yukleniyor');

  // Kaynak seçimi
  const [kaynaklar, setKaynaklar] = useState<{ mekanlar: Kaynak[]; depo: Kaynak & { albumSayilari: any }; yazicilar: EkstraYazici[] } | null>(null);
  const [seciliKaynak, setSeciliKaynak] = useState<Kaynak | null>(null);
  const [kaynakListeAcik, setKaynakListeAcik] = useState(false);

  // Yazıcı seçimi
  const [seciliYazici, setSeciliYazici] = useState<EkstraYazici | null>(null);
  const [yaziciListeAcik, setYaziciListeAcik] = useState(false);
  const [yaziciAtla, setYaziciAtla] = useState(false);
  const [yaziciStartCounter, setYaziciStartCounter] = useState('');
  const [yaziciEndCounter, setYaziciEndCounter] = useState('');
  const [yaziciRibonMevcut, setYaziciRibonMevcut] = useState('');
  const [yaziciRibonDegisim, setYaziciRibonDegisim] = useState('');

  // Açılış
  const [acilisStok, setAcilisStok] = useState<StokSayim>(bosStok());
  const [acilisNot, setAcilisNot] = useState('');
  const [acilisYukleniyor, setAcilisYukleniyor] = useState(false);
  const [acilisHata, setAcilisHata] = useState('');

  // Mevcut kayıt
  const [kayit, setKayit] = useState<EkstraIsKayit | null>(null);

  // Kare kaydı
  const [kareCount, setKareCount] = useState(1);
  const [kareYukleniyor, setKareYukleniyor] = useState(false);
  const [kareMesaj, setKareMesaj] = useState('');
  const [kareListeAcik, setKareListeAcik] = useState(false);

  // Kapanış
  const [kapalisStok, setKapalisStok] = useState<StokSayim>(bosStok());
  const [kapalisNot, setKapalisNot] = useState('');
  const [kapalisYukleniyor, setKapalisYukleniyor] = useState(false);
  const [kapalisHata, setKapalisHata] = useState('');
  const [kapalisAnomali, setKapalisAnomali] = useState<Partial<StokSayim> | null>(null);
  const [kapalisBeklenen, setKapalisBeklenen] = useState<StokSayim | null>(null);

  // İade hedefi (kapanış)
  const [iadeHedef, setIadeHedef] = useState<Kaynak | null>(null);
  const [iadeHedefListeAcik, setIadeHedefListeAcik] = useState(false);
  const [kapalisAdim, setKapalisAdim] = useState<'hedef-sec' | 'stok-gir'>('hedef-sec');

  // Mevcut durumu yükle
  const durumYukle = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/ekstra-is/durum/${task.id}/${tarih}`, { headers });
      if (!res.ok) { setAsama('kaynak-sec'); return; }
      const data = await res.json();
      if (!data.kayit) {
        setAsama('kaynak-sec');
        return;
      }
      const k: EkstraIsKayit = data.kayit;
      setKayit(k);
      // Yazıcı bilgisini geri yükle (kayıtta varsa)
      const kAny = k as any;
      if (kAny.yaziciData?.ekipmanId) {
        setSeciliYazici({
          ekipmanId: kAny.yaziciData.ekipmanId,
          brand: kAny.yaziciData.brand || '',
          model: kAny.yaziciData.model || '',
          serialNumber: kAny.yaziciData.serialNumber || '',
          status: 'working',
          mekanId: null,
          mekanAdi: null,
          mekanEmoji: null,
          lastEndCounter: null,
          lastEndTarih: null,
          lastEndRibonMevcut: null,
        });
        setYaziciStartCounter(String(kAny.yaziciData.startCounter || ''));
      }
      if (k.kapanisYapildi) {
        setKapalisAnomali(k.kapanisAnomali || null);
        setKapalisBeklenen(k.kapanisBeklenen || null);
        setAsama('tamamlandi');
      } else if (k.acilisYapildi) {
        setAsama('calisiyor');
      } else {
        setAsama('kaynak-sec');
      }
    } catch {
      setAsama('kaynak-sec');
    }
  }, [task.id, tarih]);

  const kaynakYukle = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/ekstra-is/kaynaklar`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      setKaynaklar(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const init = async () => {
      await Promise.all([durumYukle(), kaynakYukle()]);
    };
    init();
  }, [durumYukle, kaynakYukle]);

  // Açılış kaydet
  const handleAcilis = async () => {
    if (!seciliKaynak) { setAcilisHata('Lütfen kaynak seçin.'); return; }
    const toplamAlim = ALBUM_ALANLARI.reduce((s, a) => s + acilisStok[a], 0);
    if (toplamAlim === 0) { setAcilisHata('En az 1 albüm almalısınız.'); return; }
    setAcilisYukleniyor(true);
    setAcilisHata('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/ekstra-is/acilis`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          taskId: task.id,
          tarih,
          kaynakId: seciliKaynak.id,
          kaynakAdi: seciliKaynak.name,
          kaynakEmoji: seciliKaynak.emoji,
          acilis: acilisStok,
          acilisNot,
          yaziciData: seciliYazici && !yaziciAtla ? {
            ekipmanId: seciliYazici.ekipmanId,
            brand: seciliYazici.brand,
            model: seciliYazici.model,
            serialNumber: seciliYazici.serialNumber,
            startCounter: Number(yaziciStartCounter) || seciliYazici.lastEndCounter || 0,
          } : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setAcilisHata(data.error || 'Açılış yapılamadı.'); return; }
      setKayit(data.kayit);
      setAsama('calisiyor');
    } catch (e) {
      setAcilisHata('Bağlantı hatası.');
    } finally {
      setAcilisYukleniyor(false);
    }
  };

  // Kare kaydı
  const handleKareKaydet = async () => {
    if (!kayit || kareCount < 1) return;
    setKareYukleniyor(true);
    setKareMesaj('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/ekstra-is/kare`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          taskId: task.id,
          tarih,
          photographerName: userName,
          photographerId: userId,
          frameCount: kareCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setKareMesaj(data.error || 'Kayıt yapılamadı.'); return; }
      setKayit(k => k ? { ...k, kareKayitlari: data.kareKayitlari } : k);
      setKareMesaj(`✅ ${kareCount} kare kaydedildi`);
      setKareCount(1);
      setTimeout(() => setKareMesaj(''), 3000);
    } catch {
      setKareMesaj('Bağlantı hatası.');
    } finally {
      setKareYukleniyor(false);
    }
  };

  // Kapanış
  const handleKapalis = async () => {
    if (!kayit || !iadeHedef) return;
    setKapalisYukleniyor(true);
    setKapalisHata('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/ekstra-is/kapalis`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          taskId: task.id,
          tarih,
          kapalis: kapalisStok,
          kapalisNot,
          iadeHedefId: iadeHedef.id,
          iadeHedefAdi: iadeHedef.name,
          iadeHedefEmoji: iadeHedef.emoji,
          yaziciKapanisData: seciliYazici && yaziciEndCounter ? {
            ekipmanId: seciliYazici.ekipmanId,
            endCounter: Number(yaziciEndCounter),
            ribonMevcut: Number(yaziciRibonMevcut) || 0,
            ribonDegisim: Number(yaziciRibonDegisim) || 0,
          } : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setKapalisHata(data.error || 'Kapanış yapılamadı.'); return; }
      setKayit(data.kayit);
      setKapalisAnomali(data.anomali);
      setKapalisBeklenen(data.beklenen);
      setAsama('tamamlandi');
    } catch {
      setKapalisHata('Bağlantı hatası.');
    } finally {
      setKapalisYukleniyor(false);
    }
  };

  const toplamKare = kayit?.kareKayitlari?.reduce((s, k) => s + k.frameCount, 0) || 0;

  // ─── Kaynak seçim ekranı ─────────────────────────────────────────────────
  const KaynakSecEkrani = () => (
    <div className="space-y-4">
      <div className="backdrop-blur-xl bg-white/8 rounded-2xl border border-white/15 p-4 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <ArrowRightLeft className="w-4 h-4 text-amber-300" />
          <h3 className="text-sm font-bold text-white">Stok Kaynağı Seç</h3>
        </div>
        <p className="text-xs text-white/50">Ekstra işte kullanacağınız stok nereden alınacak?</p>

        {/* Kaynak seçici */}
        <div>
          <button
            onClick={() => setKaynakListeAcik(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
          >
            <div className="flex items-center gap-2">
              {seciliKaynak ? (
                <>
                  <span className="text-xl">{seciliKaynak.emoji}</span>
                  <span className="font-semibold">{seciliKaynak.name}</span>
                </>
              ) : (
                <span className="text-white/40">Kaynak seçin...</span>
              )}
            </div>
            {kaynakListeAcik ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
          </button>

          <AnimatePresence>
            {kaynakListeAcik && kaynaklar && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-1 bg-[#1a1a2e]/95 border border-white/15 rounded-xl overflow-hidden shadow-xl"
              >
                {/* Depo */}
                <button
                  onClick={() => {
                    setSeciliKaynak({ id: 'depo', name: 'Depo', emoji: '🏪' });
                    setKaynakListeAcik(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/8 border-b border-white/8 text-left"
                >
                  <span className="text-xl">🏪</span>
                  <div>
                    <p className="text-sm font-semibold text-white">Depo</p>
                    <p className="text-[10px] text-amber-300/70">Merkez depo</p>
                  </div>
                </button>
                {/* Mekanlar */}
                {kaynaklar.mekanlar.map(m => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSeciliKaynak(m);
                      setKaynakListeAcik(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/8 border-b border-white/8 last:border-0 text-left"
                  >
                    <span className="text-xl">{m.emoji}</span>
                    <p className="text-sm font-semibold text-white">{m.name}</p>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mevcut depo stoku (bilgi) */}
      {seciliKaynak?.id === 'depo' && kaynaklar && (
        <div className="backdrop-blur-xl bg-amber-500/8 rounded-2xl border border-amber-500/20 p-4">
          <p className="text-xs text-amber-300/70 mb-2 font-semibold">Depodaki Mevcut Stok</p>
          <div className="space-y-1.5">
            {ALBUM_ALANLARI.map(alan => {
              const adet = kaynaklar.depo.albumSayilari[alan] || 0;
              return (
                <div key={alan} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ALBUM_RENK[alan] }} />
                  <span className="flex-1 text-xs text-white/70">{ALBUM_ETIKET[alan]}</span>
                  <span className="text-xs font-bold text-white">{adet}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Seçilen mekan stok önizlemesi */}
      {seciliKaynak && seciliKaynak.id !== 'depo' && kaynaklar && (() => {
        const mekan = kaynaklar.mekanlar.find((m: any) => m.id === seciliKaynak.id);
        if (!mekan) return null;
        return (
          <div className="backdrop-blur-xl bg-white/5 rounded-2xl border border-white/15 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-white/50 font-semibold">{seciliKaynak.emoji} {seciliKaynak.name} Mevcut Stok</p>
              {mekan.stokTarihi && (
                <span className="text-[10px] text-amber-400 font-semibold bg-amber-500/15 px-2 py-0.5 rounded-full">{mekan.stokTarihi} tarihli</span>
              )}
            </div>
            <div className="space-y-1.5">
              {ALBUM_ALANLARI.map((alan: string) => {
                const adet = mekan.albumSayilari[alan] || 0;
                return (
                  <div key={alan} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ALBUM_RENK[alan] }} />
                    <span className="flex-1 text-xs text-white/70">{ALBUM_ETIKET[alan]}</span>
                    <span className={`text-xs font-bold ${adet === 0 ? 'text-red-400' : 'text-white'}`}>{adet}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <button
        onClick={() => {
          if (!seciliKaynak) { setAcilisHata('Lütfen kaynak seçin.'); return; }
          setAsama('yazici-sec');
        }}
        disabled={!seciliKaynak}
        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500/80 to-orange-500/80 text-white font-bold text-sm shadow-lg disabled:opacity-40 active:scale-[0.98] transition-all"
      >
        Devam Et →
      </button>
    </div>
  );

  // ─── Yazıcı seçim ekranı ─────────────────────────────────────────────────
  const YaziciSecEkrani = () => (
    <div className="space-y-4">
      <div className="backdrop-blur-xl bg-white/8 rounded-2xl border border-white/15 p-4 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Printer className="w-4 h-4 text-amber-300" />
          <h3 className="text-sm font-bold text-white">Yazıcı Seç</h3>
        </div>
        <p className="text-xs text-white/50">Ekstra işte kullanacağınız yazıcı hangisi?</p>

        {/* Yazıcı seçici */}
        <div>
          <button
            onClick={() => setYaziciListeAcik(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
          >
            <div className="flex items-center gap-2">
              {seciliYazici ? (
                <>
                  <span className="text-xl">{seciliYazici.mekanEmoji || '🖨️'}</span>
                  <span className="font-semibold">{seciliYazici.brand} {seciliYazici.model}</span>
                </>
              ) : (
                <span className="text-white/40">Yazıcı seçin...</span>
              )}
            </div>
            {yaziciListeAcik ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
          </button>

          <AnimatePresence>
            {yaziciListeAcik && kaynaklar && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-1 bg-[#1a1a2e]/95 border border-white/15 rounded-xl overflow-hidden shadow-xl"
              >
                {/* Yazıcılar */}
                {kaynaklar.yazicilar.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-white/40">Kayıtlı yazıcı bulunamadı</div>
                ) : (
                  kaynaklar.yazicilar.map(y => (
                    <button
                      key={y.ekipmanId}
                      onClick={() => {
                        setSeciliYazici(y);
                        setYaziciListeAcik(false);
                        // Son endCounter'ı başlangıç sayacına otomatik doldur
                        if (y.lastEndCounter !== null) {
                          setYaziciStartCounter(String(y.lastEndCounter));
                        }
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/8 border-b border-white/8 last:border-0 text-left"
                    >
                      <span className="text-xl">{y.mekanEmoji || '🖨️'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{y.brand} {y.model}</p>
                        <p className="text-[10px] text-gray-500">
                          SN: {y.serialNumber || '—'}
                          {y.mekanAdi && <span className="text-amber-400/70 ml-2">📍 {y.mekanAdi}</span>}
                        </p>
                      </div>
                      {y.lastEndCounter !== null && (
                        <span className="text-[10px] text-[#ffd4a3] shrink-0">{y.lastEndCounter}</span>
                      )}
                    </button>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Yazıcı seçilmemişse bilgi */}
      {!seciliYazici && (
        <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center">
          <p className="text-xs text-white/30">Yazıcı seçilmedi — listedeki bir yazıcıyı seçin</p>
          {kaynaklar && kaynaklar.yazicilar.length === 0 && (
            <p className="text-[10px] text-amber-300/50 mt-1">Malzeme Yönetimi'nden yazıcı ekleyin</p>
          )}
        </div>
      )}

      {/* Seçilen yazıcı detayı + başlangıç sayacı */}
      {seciliYazici && kaynaklar && (() => {
        const yazici = kaynaklar.yazicilar.find((y: any) => y.ekipmanId === seciliYazici.ekipmanId);
        if (!yazici) return null;
        return (
          <div className="space-y-3">
            <div className="backdrop-blur-xl bg-white/5 rounded-2xl border border-white/15 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Printer className="w-4 h-4 text-[#ffd4a3]" />
                  <p className="text-xs text-white/70 font-semibold">{yazici.brand} {yazici.model}</p>
                </div>
                {yazici.lastEndTarih && (
                  <span className="text-[10px] text-amber-400 font-semibold bg-amber-500/15 px-2 py-0.5 rounded-full">{yazici.lastEndTarih}</span>
                )}
              </div>
              <p className="text-[10px] text-gray-500 font-mono mb-3">SN: {yazici.serialNumber || '—'}</p>
              <div className="flex items-center justify-between py-1.5 border-b border-white/8">
                <span className="text-xs text-white/50">Son Bitiş Sayacı</span>
                <span className="text-sm font-bold text-[#ffd4a3]">{yazici.lastEndCounter ?? '—'}</span>
              </div>
              {yazici.lastEndRibonMevcut !== null && (
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs text-white/50">İçindeki Ribon</span>
                  <span className="text-sm font-bold text-[#d4b5f7]">{yazici.lastEndRibonMevcut}</span>
                </div>
              )}
            </div>

            {/* Başlangıç sayacı — otomatik doluyor, kullanıcı onaylayabilir */}
            <div className="backdrop-blur-xl bg-[#ffd4a3]/8 rounded-2xl border border-[#ffd4a3]/20 p-4">
              <p className="text-xs text-[#ffd4a3] font-semibold mb-2">Başlangıç Sayacı (Onaylayın)</p>
              <input
                type="number"
                inputMode="numeric"
                value={yaziciStartCounter}
                onChange={e => setYaziciStartCounter(e.target.value)}
                placeholder={yazici.lastEndCounter !== null ? String(yazici.lastEndCounter) : 'Sayaç giriniz'}
                className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#ffd4a3]/50 text-center font-bold text-lg"
              />
              {yaziciStartCounter && yazici.lastEndCounter !== null &&
                Number(yaziciStartCounter) !== yazici.lastEndCounter && (
                <div className="flex items-center gap-2 bg-amber-500/15 border border-amber-500/30 rounded-lg px-3 py-2 mt-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <p className="text-[10px] text-amber-300">
                    Anomali: Beklenen {yazici.lastEndCounter}, girilen {yaziciStartCounter} (fark: {Number(yaziciStartCounter) - yazici.lastEndCounter})
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Yazıcı seçmek istemiyorum */}
      <button
        onClick={() => { setYaziciAtla(true); setSeciliYazici(null); setYaziciStartCounter(''); setAsama('acilis'); }}
        className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/40 text-xs font-semibold active:scale-95 transition-all"
      >
        Yazıcı olmadan devam et →
      </button>

      <div className="flex gap-3">
        <button
          onClick={() => setAsama('kaynak-sec')}
          className="px-5 py-3.5 rounded-2xl bg-white/8 border border-white/15 text-white font-semibold text-sm active:scale-95 transition-all"
        >
          Geri
        </button>
        <button
          onClick={() => {
            // Başlangıç sayacını otomatik doldur (seçildiyse)
            if (seciliYazici && !yaziciStartCounter && seciliYazici.lastEndCounter !== null) {
              setYaziciStartCounter(String(seciliYazici.lastEndCounter));
            }
            setAsama('acilis');
          }}
          className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500/80 to-orange-500/80 text-white font-bold text-sm shadow-lg active:scale-[0.98] transition-all"
        >
          Devam Et →
        </button>
      </div>
    </div>
  );

  // ─── Açılış stok giriş ekranı ─────────────────────────────────────────────
  const AcilisEkrani = () => {
    const kaynakMaxStok = seciliKaynak?.id === 'depo' && kaynaklar
      ? kaynaklar.depo.albumSayilari
      : seciliKaynak && seciliKaynak.id !== 'depo' && kaynaklar
        ? (kaynaklar.mekanlar.find((m: any) => m.id === seciliKaynak.id) as any)?.albumSayilari
        : undefined;

    return (
      <div className="space-y-4">
        <div className="backdrop-blur-xl bg-white/8 rounded-2xl border border-white/15 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-4 h-4 text-amber-300" />
            <h3 className="text-sm font-bold text-white">Açılış Stok Sayımı</h3>
          </div>
          <p className="text-xs text-white/50 mb-4">
            <span className="text-amber-300 font-semibold">{seciliKaynak?.emoji} {seciliKaynak?.name}</span>'dan kaç adet alıyorsunuz?
          </p>

          {ALBUM_ALANLARI.map(alan => (
            <StokSatir
              key={alan}
              alan={alan}
              value={acilisStok[alan]}
              onChange={v => setAcilisStok(s => ({ ...s, [alan]: v }))}
              maxValue={kaynakMaxStok ? (kaynakMaxStok[alan] || 0) : undefined}
            />
          ))}
        </div>

        <div className="backdrop-blur-xl bg-white/8 rounded-2xl border border-white/15 p-4">
          <label className="text-xs text-white/50 mb-2 block">Not (isteğe bağlı)</label>
          <textarea
            value={acilisNot}
            onChange={e => setAcilisNot(e.target.value)}
            placeholder="Açılış notu..."
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 resize-none outline-none focus:border-amber-400/50"
          />
        </div>

        {acilisHata && (
          <div className="flex items-center gap-2 bg-red-500/15 border border-red-500/30 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-300">{acilisHata}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => setAsama('yazici-sec')}
            className="px-5 py-3.5 rounded-2xl bg-white/8 border border-white/15 text-white font-semibold text-sm active:scale-95 transition-all"
          >
            Geri
          </button>
          <button
            onClick={handleAcilis}
            disabled={acilisYukleniyor}
            className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500/80 to-orange-500/80 text-white font-bold text-sm shadow-lg disabled:opacity-60 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {acilisYukleniyor ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Stok Al & Başla
          </button>
        </div>
      </div>
    );
  };

  // ─── Çalışıyor ekranı ────────────────────────────────────────────────────
  const CalisiyorEkrani = () => (
    <div className="space-y-4">
      {/* Özet kart */}
      <div className="backdrop-blur-xl bg-amber-500/10 rounded-2xl border border-amber-500/25 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{kayit?.kaynakEmoji}</span>
            <div>
              <p className="text-xs text-amber-300/70">Kaynak</p>
              <p className="text-sm font-bold text-white">{kayit?.kaynakAdi}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/50">Toplam Kare</p>
            <p className="text-2xl font-black text-amber-300">{toplamKare}</p>
          </div>
        </div>

        {/* Açılış stok özeti */}
        <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-white/8">
          {ALBUM_ALANLARI.filter(a => (kayit?.acilis?.[a] || 0) > 0).map(alan => (
            <div key={alan} className="text-center">
              <div
                className="w-2 h-2 rounded-full mx-auto mb-0.5"
                style={{ backgroundColor: ALBUM_RENK[alan] }}
              />
              <p className="text-[9px] text-white/40">{ALBUM_ETIKET[alan]}</p>
              <p className="text-xs font-bold text-white">{kayit?.acilis?.[alan] || 0}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Kare kayıt */}
      <div className="backdrop-blur-xl bg-white/8 rounded-2xl border border-white/15 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Camera className="w-4 h-4 text-[#9dd9ea]" />
          <h3 className="text-sm font-bold text-white">Kare Kaydı</h3>
        </div>
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => setKareCount(v => Math.max(1, v - 1))}
            className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white active:scale-90 transition-all"
          >
            <Minus className="w-4 h-4" />
          </button>
          <div className="flex-1 text-center">
            <span className="text-3xl font-black text-white">{kareCount}</span>
            <p className="text-[10px] text-white/40">kare</p>
          </div>
          <button
            onClick={() => setKareCount(v => v + 1)}
            className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white active:scale-90 transition-all"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={handleKareKaydet}
          disabled={kareYukleniyor}
          className="w-full py-3 rounded-xl bg-[#9dd9ea]/20 border border-[#9dd9ea]/30 text-[#9dd9ea] font-bold text-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {kareYukleniyor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          Kare Kaydet
        </button>
        {kareMesaj && (
          <p className={`text-xs text-center mt-2 ${kareMesaj.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
            {kareMesaj}
          </p>
        )}
      </div>

      {/* Kare geçmişi */}
      {(kayit?.kareKayitlari?.length || 0) > 0 && (
        <div className="backdrop-blur-xl bg-white/8 rounded-2xl border border-white/15 overflow-hidden">
          <button
            onClick={() => setKareListeAcik(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-white/50" />
              <span className="text-sm font-semibold text-white">Kare Geçmişi</span>
              <span className="text-[10px] px-2 py-0.5 bg-white/10 rounded-full text-white/60">
                {kayit?.kareKayitlari?.length || 0}
              </span>
            </div>
            {kareListeAcik ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
          </button>
          <AnimatePresence>
            {kareListeAcik && (
              <motion.div
                initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                className="overflow-hidden border-t border-white/8"
              >
                <div className="px-4 pb-3 pt-2 space-y-1.5 max-h-48 overflow-y-auto">
                  {[...(kayit?.kareKayitlari || [])].reverse().map(k => (
                    <div key={k.id} className="flex items-center justify-between text-xs">
                      <span className="text-white/60">{new Date(k.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-white font-semibold">{k.frameCount} kare</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Kapanışa geç */}
      <button
        onClick={() => {
          setIadeHedef(null);
          setIadeHedefListeAcik(false);
          setKapalisStok(bosStok());
          setKapalisHata('');
          setAsama('kapalis');
        }}
        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-500/70 to-violet-500/70 border border-purple-400/30 text-white font-bold text-sm shadow-lg active:scale-[0.98] transition-all"
      >
        Kapanış Yap
      </button>
    </div>
  );

  // ─── Kapanış ekranı ───────────────────────────────────────────────────────
  const KapalisEkrani = () => (
    <div className="space-y-4">

      {/* ADIM 1: İade hedefi seç */}
      <div className="backdrop-blur-xl bg-purple-500/10 rounded-2xl border border-purple-500/25 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-purple-300" />
          <h3 className="text-sm font-bold text-white">Kalan Stok Nereye İade Edilecek?</h3>
        </div>
        <p className="text-xs text-white/50">Elinizdeki albümleri hangi yere teslim ediyorsunuz?</p>

        <button
          onClick={() => setIadeHedefListeAcik(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
        >
          <div className="flex items-center gap-2">
            {iadeHedef ? (
              <>
                <span className="text-xl">{iadeHedef.emoji}</span>
                <span className="font-semibold text-sm">{iadeHedef.name}</span>
              </>
            ) : (
              <span className="text-white/40 text-sm">İade yeri seçin...</span>
            )}
          </div>
          {iadeHedefListeAcik ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
        </button>

        <AnimatePresence>
          {iadeHedefListeAcik && kaynaklar && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="bg-[#1a1a2e]/95 border border-white/15 rounded-xl overflow-hidden shadow-xl"
            >
              {/* Depo */}
              <button
                onClick={() => { setIadeHedef({ id: 'depo', name: 'Depo', emoji: '🏪' }); setIadeHedefListeAcik(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/8 border-b border-white/8 text-left"
              >
                <span className="text-xl">🏪</span>
                <div>
                  <p className="text-sm font-semibold text-white">Depo</p>
                  <p className="text-[10px] text-amber-300/70">Merkez depo</p>
                </div>
              </button>
              {/* Mekanlar */}
              {kaynaklar.mekanlar.map(m => (
                <button
                  key={m.id}
                  onClick={() => { setIadeHedef(m); setIadeHedefListeAcik(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/8 border-b border-white/8 last:border-0 text-left"
                >
                  <span className="text-xl">{m.emoji}</span>
                  <p className="text-sm font-semibold text-white">{m.name}</p>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {iadeHedef && (
          <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
            <p className="text-xs text-green-300">
              <span className="font-semibold">{iadeHedef.emoji} {iadeHedef.name}</span> stoğuna eklenecek
            </p>
          </div>
        )}
      </div>

      {/* ADIM 2: Stok miktarları (sadece hedef seçilince aktif) */}
      <div className={`backdrop-blur-xl bg-white/8 rounded-2xl border border-white/15 p-4 transition-opacity ${!iadeHedef ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="flex items-center gap-2 mb-1">
          <Package className="w-4 h-4 text-purple-300" />
          <h3 className="text-sm font-bold text-white">İade Miktarları</h3>
        </div>
        <p className="text-xs text-white/50 mb-4">Elinizde kalan kaç adet var?</p>

        {ALBUM_ALANLARI.map(alan => {
          const acilisAdet = kayit?.acilis?.[alan] || 0;
          return acilisAdet > 0 ? (
            <StokSatir
              key={alan}
              alan={alan}
              value={kapalisStok[alan]}
              onChange={v => setKapalisStok(s => ({ ...s, [alan]: v }))}
              maxValue={acilisAdet}
              disabled={!iadeHedef}
            />
          ) : null;
        })}
      </div>

      {/* ADIM 3: Yazıcı bitiş sayacı (yazıcı seçildiyse) */}
      {seciliYazici && !yaziciAtla && (
        <div className="backdrop-blur-xl bg-[#ffd4a3]/8 rounded-2xl border border-[#ffd4a3]/20 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-[#ffd4a3]" />
            <h3 className="text-sm font-bold text-white">Yazıcı Bitiş Sayacı</h3>
          </div>
          <div className="bg-black/30 border border-white/10 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-white">{seciliYazici.brand} {seciliYazici.model}</p>
              <p className="text-[10px] text-gray-500 font-mono">SN: {seciliYazici.serialNumber || '—'}</p>
            </div>
            <p className="text-[10px] text-gray-500 mb-3">Açılış: <span className="text-[#ffd4a3] font-bold">{yaziciStartCounter || seciliYazici.lastEndCounter || '—'}</span></p>

            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-400 mb-1">Bitiş Sayacı</p>
                <input
                  type="number"
                  inputMode="numeric"
                  value={yaziciEndCounter}
                  onChange={e => setYaziciEndCounter(e.target.value)}
                  placeholder="Bitiş sayacını girin"
                  className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#ffd4a3]/50 text-center font-bold"
                />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1.5">
                  <Film className="w-3 h-3 text-[#d4b5f7]" />
                  <span className="text-[#d4b5f7]">Yazıcıda Kalan Ribon</span>
                </p>
                <input
                  type="number"
                  inputMode="numeric"
                  value={yaziciRibonMevcut}
                  onChange={e => setYaziciRibonMevcut(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2.5 bg-[#d4b5f7]/10 border border-[#d4b5f7]/20 rounded-lg text-white placeholder:text-gray-600 focus:outline-none text-center font-bold"
                />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1 flex items-center gap-1.5">
                  <Film className="w-3 h-3 text-[#9dd9ea]" /> Ribon Değişim Adedi
                </p>
                <input
                  type="number"
                  inputMode="numeric"
                  value={yaziciRibonDegisim}
                  onChange={e => setYaziciRibonDegisim(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2.5 bg-[#9dd9ea]/10 border border-[#9dd9ea]/20 rounded-lg text-white placeholder:text-gray-600 focus:outline-none text-center font-bold"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="backdrop-blur-xl bg-white/8 rounded-2xl border border-white/15 p-4">
        <label className="text-xs text-white/50 mb-2 block">Not (isteğe bağlı)</label>
        <textarea
          value={kapalisNot}
          onChange={e => setKapalisNot(e.target.value)}
          placeholder="Kapanış notu..."
          rows={2}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 resize-none outline-none focus:border-purple-400/50"
        />
      </div>

      {kapalisHata && (
        <div className="flex items-center gap-2 bg-red-500/15 border border-red-500/30 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-300">{kapalisHata}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => setAsama('calisiyor')}
          className="px-5 py-3.5 rounded-2xl bg-white/8 border border-white/15 text-white font-semibold text-sm active:scale-95 transition-all"
        >
          Geri
        </button>
        <button
          onClick={handleKapalis}
          disabled={kapalisYukleniyor || !iadeHedef}
          className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-purple-500/80 to-violet-500/80 text-white font-bold text-sm shadow-lg disabled:opacity-40 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          {kapalisYukleniyor ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Kapat & İade Et
        </button>
      </div>
    </div>
  );

  // ─── Tamamlandı ekranı ────────────────────────────────────────────────────
  const TamamlandiEkrani = () => {
    const hasAnomali = kapalisAnomali && Object.keys(kapalisAnomali).length > 0;
    return (
      <div className="space-y-4">
        <div className={`backdrop-blur-xl rounded-2xl border p-6 text-center ${
          hasAnomali
            ? 'bg-amber-500/10 border-amber-500/25'
            : 'bg-green-500/10 border-green-500/25'
        }`}>
          <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
            hasAnomali ? 'bg-amber-500/20' : 'bg-green-500/20'
          }`}>
            {hasAnomali
              ? <AlertTriangle className="w-8 h-8 text-amber-400" />
              : <CheckCircle2 className="w-8 h-8 text-green-400" />
            }
          </div>
          <h3 className="text-lg font-bold text-white mb-1">
            {hasAnomali ? 'İş Tamamlandı — Anomali Var' : 'İş Başarıyla Tamamlandı!'}
          </h3>
          <p className="text-sm text-white/60">
            {task.location} · {toplamKare} kare
          </p>
        </div>

        {/* Anomali detay */}
        {hasAnomali && kapalisAnomali && (
          <div className="backdrop-blur-xl bg-amber-500/10 rounded-2xl border border-amber-500/25 p-4">
            <p className="text-xs text-amber-300 font-bold mb-3">⚠️ Stok Anomalisi</p>
            {Object.entries(kapalisAnomali).map(([alan, fark]) => (
              <div key={alan} className="flex items-center gap-2 py-1.5 border-b border-white/6 last:border-0">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ALBUM_RENK[alan] || '#fff' }} />
                <span className="flex-1 text-xs text-white">{ALBUM_ETIKET[alan] || alan}</span>
                <span className={`text-xs font-bold ${(fark as number) < 0 ? 'text-red-400' : 'text-amber-400'}`}>
                  {(fark as number) > 0 ? '+' : ''}{fark}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Özet */}
        <div className="backdrop-blur-xl bg-white/8 rounded-2xl border border-white/15 p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-white/50">Kaynak</span>
            <span className="text-white font-semibold">{kayit?.kaynakEmoji} {kayit?.kaynakAdi}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/50">Toplam Kare</span>
            <span className="text-white font-bold">{toplamKare}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/50">İade Yeri</span>
            <span className="text-white font-semibold">
              {(kayit as any)?.iadeHedefEmoji} {(kayit as any)?.iadeHedefAdi || '—'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/50">Kapanış Zamanı</span>
            <span className="text-white/70 text-xs">
              {kayit?.kapanisZamani ? new Date(kayit.kapanisZamani).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—'}
            </span>
          </div>
          {(kayit as any)?.yaziciData?.ekipmanId && (
            <div className="border-t border-white/8 pt-3 mt-1 space-y-2">
              <p className="text-[10px] text-[#ffd4a3] font-semibold uppercase tracking-wide">🖨️ Yazıcı</p>
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Model</span>
                <span className="text-white font-semibold">{(kayit as any).yaziciData.brand} {(kayit as any).yaziciData.model}</span>
              </div>
              {(kayit as any)?.yaziciKapanisData?.endCounter !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Bitiş Sayacı</span>
                  <span className="text-[#ffd4a3] font-bold">{(kayit as any).yaziciKapanisData.endCounter}</span>
                </div>
              )}
            </div>
          )}
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

  // ─── Render ──────────────────────────────────────────────────────────────
  const asamaBaslik: Record<string, string> = {
    'yukleniyor': 'Yükleniyor...',
    'kaynak-sec': 'Kaynak Seç',
    'yazici-sec': 'Yazıcı Seç',
    'acilis': 'Açılış Sayımı',
    'calisiyor': 'Çalışıyor',
    'kapalis': 'Kapanış',
    'tamamlandi': 'Tamamlandı',
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
        <div className="backdrop-blur-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 rounded-2xl border border-amber-500/30 px-4 py-4 mb-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300">⚡ EKSTRA İŞ</span>
            <span className="text-xs text-white/40">{asamaBaslik[asama]}</span>
          </div>
          <h2 className="text-base font-bold text-white">{task.location}</h2>
          <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{task.startTime} – {task.endTime}</span>
          </div>
          {task.notes && (
            <p className="text-xs text-amber-300/70 mt-2 bg-amber-500/10 rounded-lg px-3 py-1.5">{task.notes}</p>
          )}
        </div>

        {/* Adım göstergesi */}
        {asama !== 'yukleniyor' && (
          <div className="flex items-center gap-1 mb-5">
            {['kaynak-sec', 'yazici-sec', 'acilis', 'calisiyor', 'kapalis', 'tamamlandi'].map((s, i) => {
              const asamaList = ['kaynak-sec', 'yazici-sec', 'acilis', 'calisiyor', 'kapalis', 'tamamlandi'];
              const currentIdx = asamaList.indexOf(asama);
              const isActive = i === currentIdx;
              const isDone = i < currentIdx;
              return (
                <div key={s} className="flex items-center gap-1 flex-1">
                  <div className={`h-1 flex-1 rounded-full transition-all ${
                    isDone ? 'bg-amber-400' : isActive ? 'bg-amber-400/50' : 'bg-white/10'
                  }`} />
                  {i === 5 && <div className={`w-2 h-2 rounded-full ${isDone || isActive ? 'bg-amber-400' : 'bg-white/10'}`} />}
                </div>
              );
            })}
          </div>
        )}

        {/* İçerik */}
        {asama === 'yukleniyor' && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          </div>
        )}
        {asama === 'kaynak-sec' && <KaynakSecEkrani />}
        {asama === 'yazici-sec' && <YaziciSecEkrani />}
        {asama === 'acilis' && <AcilisEkrani />}
        {asama === 'calisiyor' && <CalisiyorEkrani />}
        {asama === 'kapalis' && <KapalisEkrani />}
        {asama === 'tamamlandi' && <TamamlandiEkrani />}
      </div>
    </div>
  );
}