import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, RefreshCw, Loader2, WifiOff, Package,
  Printer, Plus, Minus, X, ChevronDown, ChevronRight,
  ArrowDownToLine, ArrowUpFromLine, Clock,
  Edit3, Trash2, AlertTriangle, Check,
} from 'lucide-react';
import { NewBottomNav } from './new-bottom-nav';
import { UserRole } from './login';
import { authHeaders } from '../lib/api';
import { projectId } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

// ─── Sabitler ─────────────────────────────────────────────────────────────────
const RIBON_PER_TAKIM = 200;
const TAKIM_PER_KUTU = 2;

const ALBUM_TIPLERI = ['album3','album5','album7','album9','album11','album13','album15','ribon'] as const;
const ALAN_ETIKET: Record<string, string> = {
  album3:'3 Kare', album5:'5 Kare', album7:'7 Kare', album9:'9 Kare',
  album11:'11 Kare', album13:'13 Kare', album15:'15 Kare', ribon:'Ribon',
};
const ALAN_RENK: Record<string, string> = {
  album3:'#9dd9ea', album5:'#a8e6cf', album7:'#ffd4a3', album9:'#ffb3ba',
  album11:'#d4a5ff', album13:'#b8d4f1', album15:'#ffc78f', ribon:'#f9a8d4',
};
const SADECE_ALBUMLER = ['album3','album5','album7','album9','album11','album13','album15'] as const;

// ─── Types ────────────────────────────────────────────────────────────────────
interface AlbumDagilimItem {
  alan: string; name: string; color: string; count: number;
}
interface MekanOzet {
  id: string; name: string; emoji: string; color: string;
  vardiyaDurumu: 'acik' | 'kapandi' | 'yok';
  albumSayilari: Record<string, number>;
  stokRibonAdet: number;
  makinaKalan: number;
  toplamRibonKapasite: number;
  veriVar: boolean;
}
interface DepoOzet {
  albumSayilari: Record<string, number>;
  ribonTakim: number;
  ribonAdet: number;
}
interface GenelDurum {
  tarih: string;
  mekanlar: MekanOzet[];
  genelAlbumDagilimi: AlbumDagilimItem[];
  genelRibonKapasite: number;
  ribonPerTakim: number;
  depo: DepoOzet;
}
interface Hareket {
  id: string; tip: 'giris'|'cikis'; alan: string; miktar: number;
  eskiDeger: number; yeniDeger: number; not: string; tarih: string;
  kullaniciAdi: string; hedefMekan?: string;
}
interface StokDagilimiProps {
  userName: string; userRole: UserRole;
  onLogout: () => void; onNavigate: (tab: string) => void;
}

// ─── Yardımcı Fonksiyonlar ────────────────────────────────────────────────────
function ribonMetni(takim: number): string {
  const adet = takim * RIBON_PER_TAKIM;
  const kutu = Math.floor(takim / TAKIM_PER_KUTU);
  const kalanTakim = takim % TAKIM_PER_KUTU;
  const kutuKisim = kutu > 0
    ? `${kutu} Tam Kutu${kalanTakim > 0 ? ` + ${kalanTakim} takım` : ''}`
    : `${takim} takım`;
  return `${adet.toLocaleString('tr-TR')} adet (${takim} takım - ${kutuKisim})`;
}

function VardiyaBadge({ durum }: { durum: MekanOzet['vardiyaDurumu'] }) {
  if (durum === 'kapandi')
    return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">KAPANDI</span>;
  if (durum === 'acik')
    return (
      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/30 text-blue-300 flex items-center gap-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />AÇIK
      </span>
    );
  return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-white/8 border border-white/10 text-white/25">VERİ YOK</span>;
}

// ─── Genel Albüm Dağılımı Kartı ───────────────────────────────────────────────
function GenelAlbumCard({ dagilim }: { dagilim: AlbumDagilimItem[] }) {
  const sadecAlbumler = dagilim.filter(d => d.alan !== 'ribon');
  const toplam = sadecAlbumler.reduce((s, d) => s + d.count, 0);
  return (
    <div className="mx-4 mb-4 rounded-2xl border border-white/12 bg-[rgba(10,5,30,0.6)] backdrop-blur overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-white/8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-bold text-white">Genel Albüm Dağılımı</span>
        </div>
        <span className="text-[10px] text-white/30">Tüm mekanlar + depo</span>
      </div>
      <div className="px-4 py-3 space-y-2.5">
        {toplam === 0 ? (
          <p className="text-center text-xs text-white/25 py-3">Stok verisi henüz girilmemiş</p>
        ) : sadecAlbumler.map(item => {
          const pct = toplam > 0 ? Math.round((item.count / toplam) * 100) : 0;
          return (
            <div key={item.alan} className="flex items-center gap-2">
              <div className="w-14 text-xs text-white/55 font-medium">{item.name}</div>
              <div className="flex-1 h-6 bg-black/30 rounded-lg overflow-hidden border border-white/6">
                <div className="h-full rounded-lg transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: item.color, opacity: 0.82 }} />
              </div>
              <div className="w-10 text-right text-xs font-bold text-white">{item.count}</div>
              <div className="w-9 text-right text-[10px] text-white/30">%{pct}</div>
            </div>
          );
        })}
      </div>
      <div className="px-4 py-3 border-t border-white/8 flex justify-between items-center">
        <span className="text-xs text-white/35">Toplam Albüm</span>
        <span className="text-base font-bold text-white">{toplam.toLocaleString('tr-TR')}</span>
      </div>
    </div>
  );
}

// ─── Ribon Stoğu Kartı ────────────────────────────────────────────────────────
function RibonCard({ mekanlar, depo }: { mekanlar: MekanOzet[]; depo: DepoOzet }) {
  const toplamKapasite = mekanlar.reduce((s, m) => s + m.toplamRibonKapasite, 0) + depo.ribonAdet;
  const maxKapasite = Math.max(
    ...mekanlar.map(m => m.toplamRibonKapasite),
    depo.ribonAdet,
    1
  );

  const RibonSatir = ({
    emoji, name, takim, makinaKalan, toplam, veriVar, vardiyaDurumu
  }: {
    emoji: string; name: string; takim: number;
    makinaKalan?: number; toplam: number;
    veriVar?: boolean; vardiyaDurumu?: MekanOzet['vardiyaDurumu'];
  }) => {
    const pct = maxKapasite > 0 ? Math.round((toplam / maxKapasite) * 100) : 0;
    const renk = toplam === 0 ? '#f87171' : toplam < 200 ? '#fbbf24' : '#f9a8d4';
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-base shrink-0">{emoji}</span>
          <span className="text-xs font-semibold text-white flex-1 truncate">{name}</span>
          {vardiyaDurumu && <VardiyaBadge durum={vardiyaDurumu} />}
        </div>
        <div className="flex items-center gap-2 pl-6">
          <div className="flex-1 h-5 bg-black/30 rounded-lg overflow-hidden border border-white/6">
            <div className="h-full rounded-lg transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: renk, opacity: 0.72 }} />
          </div>
          <div className="w-28 text-right">
            <span className="text-xs font-bold" style={{ color: renk }}>
              {toplam.toLocaleString('tr-TR')}
            </span>
            <span className="text-[10px] text-white/30 ml-0.5">adet</span>
          </div>
        </div>
        {/* Detay satırı */}
        <div className="flex gap-3 pl-6">
          {takim > 0 && (
            <span className="text-[10px] text-white/22">📦 {ribonMetni(takim)}</span>
          )}
          {(makinaKalan ?? 0) > 0 && (
            <span className="text-[10px] text-white/22">🖨️ Makina: {makinaKalan!.toLocaleString('tr-TR')}</span>
          )}
          {veriVar === false && (
            <span className="text-[10px] text-white/18">Bugün veri girilmemiş</span>
          )}
          {takim === 0 && (makinaKalan ?? 0) === 0 && veriVar && (
            <span className="text-[10px] text-red-400/60">Ribon yok</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-4 mb-4 rounded-2xl border border-pink-500/20 bg-[rgba(10,5,30,0.6)] backdrop-blur overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-white/8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Printer className="w-4 h-4 text-pink-400" />
          <span className="text-sm font-bold text-white">Ribon Stoğu</span>
        </div>
        <span className="text-[10px] text-white/30">Basılabilir resim adedi</span>
      </div>
      <div className="px-4 py-3 space-y-4">
        {/* Mekanlar */}
        {mekanlar.map(m => (
          <RibonSatir
            key={m.id}
            emoji={m.emoji}
            name={m.name}
            takim={m.albumSayilari['ribon'] || 0}
            makinaKalan={m.makinaKalan}
            toplam={m.toplamRibonKapasite}
            veriVar={m.veriVar}
            vardiyaDurumu={m.vardiyaDurumu}
          />
        ))}
        {/* Ayırıcı */}
        <div className="border-t border-white/8" />
        {/* Depo */}
        <RibonSatir
          emoji="🏪"
          name="Depo"
          takim={depo.ribonTakim}
          toplam={depo.ribonAdet}
          veriVar={true}
        />
      </div>
      <div className="px-4 py-3 border-t border-white/8 flex justify-between items-center">
        <span className="text-xs text-white/35">Toplam Basılabilir Resim</span>
        <div>
          <span className="text-base font-bold text-pink-300">{toplamKapasite.toLocaleString('tr-TR')}</span>
          <span className="text-[10px] text-white/30 ml-1">adet</span>
        </div>
      </div>
    </div>
  );
}

// ─── Mekan Albüm Accordion ────────────────────────────────────────────────────
function MekanAlbumCard({
  mekan, isYonetici, onGuncelle, onSifirla,
}: {
  mekan: MekanOzet;
  isYonetici: boolean;
  onGuncelle: (m: MekanOzet) => void;
  onSifirla: (m: MekanOzet) => void;
}) {
  const [acik, setAcik] = useState(false);
  const albumToplam = SADECE_ALBUMLER.reduce((s, a) => s + (mekan.albumSayilari[a] || 0), 0);
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 overflow-hidden">
      <button
        onClick={() => setAcik(e => !e)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left active:bg-white/4 transition-colors"
      >
        <span className="text-xl">{mekan.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white truncate">{mekan.name}</span>
            <VardiyaBadge durum={mekan.vardiyaDurumu} />
          </div>
          <p className="text-[11px] text-white/30 mt-0.5">
            {mekan.veriVar ? `${albumToplam} albüm` : 'Veri yok'}
          </p>
        </div>
        <span className="text-xs font-bold text-white/50">{albumToplam}</span>
        {acik ? <ChevronDown className="w-4 h-4 text-white/30" /> : <ChevronRight className="w-4 h-4 text-white/30" />}
      </button>
      {acik && (
        <div className="px-4 pb-4 pt-2 border-t border-white/8 space-y-2">
          {!mekan.veriVar ? (
            <p className="text-xs text-white/25 text-center py-2">Bugün için stok verisi girilmemiş</p>
          ) : albumToplam === 0 ? (
            <p className="text-xs text-white/25 text-center py-2">Tüm albümler sıfır</p>
          ) : (
            SADECE_ALBUMLER.map(alan => {
              const adet = mekan.albumSayilari[alan] || 0;
              const pct = albumToplam > 0 ? Math.round((adet / albumToplam) * 100) : 0;
              return (
                <div key={alan} className="flex items-center gap-2">
                  <div className="w-14 text-xs text-white/45">{ALAN_ETIKET[alan]}</div>
                  <div className="flex-1 h-5 bg-black/30 rounded overflow-hidden">
                    <div className="h-full rounded transition-all"
                      style={{ width: `${pct}%`, backgroundColor: ALAN_RENK[alan], opacity: 0.8 }} />
                  </div>
                  <div className="w-8 text-right text-xs font-bold text-white">{adet}</div>
                  <div className="w-9 text-right text-[10px] text-white/28">%{pct}</div>
                </div>
              );
            })
          )}
          {/* Ribon satırı */}
          {(mekan.albumSayilari['ribon'] || 0) > 0 && (
            <div className="flex items-center gap-2 pt-1 border-t border-white/6">
              <div className="w-14 text-xs text-pink-300/70">Ribon</div>
              <div className="flex-1 text-[10px] text-white/25">{ribonMetni(mekan.albumSayilari['ribon'] || 0)}</div>
              <div className="w-8 text-right text-xs font-bold text-pink-300">{mekan.albumSayilari['ribon'] || 0}</div>
              <div className="w-9" />
            </div>
          )}
          {/* Yönetici butonları */}
          {isYonetici && (
            <div className="flex gap-2 pt-3 border-t border-white/8 mt-1">
              <button onClick={() => onGuncelle(mekan)}
                className="flex-1 h-9 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center gap-1.5 text-xs font-semibold text-violet-300 active:scale-95 transition-transform">
                <Edit3 className="w-3.5 h-3.5" /> Stok Güncelle
              </button>
              <button onClick={() => onSifirla(mekan)}
                className="flex-1 h-9 rounded-xl bg-red-500/12 border border-red-500/25 flex items-center justify-center gap-1.5 text-xs font-semibold text-red-400 active:scale-95 transition-transform">
                <Trash2 className="w-3.5 h-3.5" /> Stok Sıfırla
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Depo Albüm Accordion ─────────────────────────────────────────────────────
function DepoAlbumCard({
  depo, isYonetici, onGuncelle, onSifirla,
}: {
  depo: DepoOzet;
  isYonetici: boolean;
  onGuncelle: () => void;
  onSifirla: () => void;
}) {
  const [acik, setAcik] = useState(false);
  const toplam = SADECE_ALBUMLER.reduce((s, a) => s + (depo.albumSayilari[a] || 0), 0);
  return (
    <div className="rounded-xl border-2 border-white/15 bg-black/30 overflow-hidden">
      <button
        onClick={() => setAcik(e => !e)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left active:bg-white/4 transition-colors"
      >
        <span className="text-xl">🏪</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">Depo</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-300">MERKEZ</span>
          </div>
          <p className="text-[11px] text-white/30 mt-0.5">{toplam} albüm · {depo.ribonTakim} takım ribon</p>
        </div>
        <span className="text-xs font-bold text-white/50">{toplam}</span>
        {acik ? <ChevronDown className="w-4 h-4 text-white/30" /> : <ChevronRight className="w-4 h-4 text-white/30" />}
      </button>
      {acik && (
        <div className="px-4 pb-4 pt-2 border-t border-white/8 space-y-2">
          {SADECE_ALBUMLER.map(alan => {
            const adet = depo.albumSayilari[alan] || 0;
            const pct = toplam > 0 ? Math.round((adet / toplam) * 100) : 0;
            return (
              <div key={alan} className="flex items-center gap-2">
                <div className="w-14 text-xs text-white/45">{ALAN_ETIKET[alan]}</div>
                <div className="flex-1 h-5 bg-black/30 rounded overflow-hidden">
                  <div className="h-full rounded transition-all"
                    style={{ width: `${pct}%`, backgroundColor: ALAN_RENK[alan], opacity: 0.8 }} />
                </div>
                <div className="w-8 text-right text-xs font-bold text-white">{adet}</div>
                <div className="w-9 text-right text-[10px] text-white/28">%{pct}</div>
              </div>
            );
          })}
          {/* Ribon satırı */}
          <div className="flex items-center gap-2 pt-1 border-t border-white/6">
            <div className="w-14 text-xs text-pink-300/70">Ribon</div>
            <div className="flex-1 text-[10px] text-white/25">{ribonMetni(depo.ribonTakim)}</div>
            <div className="w-8 text-right text-xs font-bold text-pink-300">{depo.ribonTakim}</div>
            <div className="w-9" />
          </div>
          {/* Yönetici butonları */}
          {isYonetici && (
            <div className="flex gap-2 pt-3 border-t border-white/8 mt-1">
              <button onClick={onGuncelle}
                className="flex-1 h-9 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center gap-1.5 text-xs font-semibold text-violet-300 active:scale-95 transition-transform">
                <Edit3 className="w-3.5 h-3.5" /> Stok Güncelle
              </button>
              <button onClick={onSifirla}
                className="flex-1 h-9 rounded-xl bg-red-500/12 border border-red-500/25 flex items-center justify-center gap-1.5 text-xs font-semibold text-red-400 active:scale-95 transition-transform">
                <Trash2 className="w-3.5 h-3.5" /> Stok Sıfırla
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Stok Güncelle Modalı (sadece yönetici) ───────────────────────────────────
function StokGuncelleModal({
  mekanId, mekanAdi, mekanEmoji, mevcutAlbumSayilari, mevcutRibonTakim, onClose, onSuccess,
}: {
  mekanId: string; mekanAdi: string; mekanEmoji: string;
  mevcutAlbumSayilari: Record<string, number>; mevcutRibonTakim: number;
  onClose: () => void; onSuccess: () => void;
}) {
  const [albumDegerleri, setAlbumDegerleri] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    SADECE_ALBUMLER.forEach(a => { init[a] = String(mevcutAlbumSayilari[a] || 0); });
    return init;
  });
  const [ribonTakim, setRibonTakim] = useState(String(mevcutRibonTakim || 0));
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState('');

  const kaydet = async () => {
    setYukleniyor(true); setHata('');
    try {
      const headers = await authHeaders();
      const albumSayilari: Record<string, number> = {};
      SADECE_ALBUMLER.forEach(a => { albumSayilari[a] = Math.max(0, parseInt(albumDegerleri[a] || '0') || 0); });
      const res = await fetch(`${API_BASE}/stok/mekan/guncelle`, {
        method: 'POST', headers,
        body: JSON.stringify({ mekanId, albumSayilari, ribonTakim: Math.max(0, parseInt(ribonTakim || '0') || 0) }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      onSuccess();
    } catch (err: any) { setHata(err.message || 'Güncelleme başarısız.'); }
    finally { setYukleniyor(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/65 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-t-3xl overflow-hidden"
        style={{ background: '#0e0826', border: '1px solid rgba(255,255,255,0.12)', maxHeight: '92vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-xl">{mekanEmoji}</span>
            <div>
              <h2 className="text-sm font-bold text-white">{mekanAdi} — Stok Güncelle</h2>
              <p className="text-[10px] text-white/30">Albüm ve ribon değerlerini düzenle</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/8 border border-white/12 flex items-center justify-center active:scale-90 transition-transform">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>
        {/* Form */}
        <div className="overflow-y-auto px-5 py-4 space-y-3" style={{ maxHeight: 'calc(92vh - 140px)' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">Albümler (adet)</p>
          <div className="grid grid-cols-2 gap-2">
            {SADECE_ALBUMLER.map(alan => (
              <div key={alan} className="rounded-xl border border-white/10 bg-white/4 px-3 py-2.5 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: ALAN_RENK[alan] }} />
                <span className="text-xs text-white/55 flex-1">{ALAN_ETIKET[alan]}</span>
                <input type="number" min={0} value={albumDegerleri[alan]}
                  onChange={e => setAlbumDegerleri(v => ({ ...v, [alan]: e.target.value }))}
                  className="w-16 text-right text-sm font-bold text-white bg-transparent outline-none" />
              </div>
            ))}
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mt-3 mb-1">Ribon (takım)</p>
          <div className="rounded-xl border border-pink-500/25 bg-pink-500/6 px-3 py-2.5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-pink-400 flex-shrink-0" />
            <span className="text-xs text-pink-300/70 flex-1">Ribon Takımı</span>
            <input type="number" min={0} value={ribonTakim}
              onChange={e => setRibonTakim(e.target.value)}
              className="w-16 text-right text-sm font-bold text-pink-300 bg-transparent outline-none" />
          </div>
          {parseInt(ribonTakim || '0') > 0 && (
            <p className="text-[10px] text-pink-400/50 text-right">
              = {(parseInt(ribonTakim) * RIBON_PER_TAKIM).toLocaleString('tr-TR')} baskı kapasitesi
            </p>
          )}
          {hata && <div className="rounded-xl bg-red-500/12 border border-red-500/20 px-4 py-3 text-xs text-red-300">{hata}</div>}
        </div>
        {/* Footer */}
        <div className="px-5 pt-3 flex gap-3 border-t border-white/8" style={{ paddingBottom: 'calc(1.5rem + max(80px, env(safe-area-inset-bottom) + 70px))' }}>
          <button onClick={onClose}
            className="flex-1 h-11 rounded-xl bg-white/6 border border-white/12 text-sm font-semibold text-white/50 active:scale-95 transition-transform">
            İptal
          </button>
          <button onClick={kaydet} disabled={yukleniyor}
            className="flex-1 h-11 rounded-xl bg-gradient-to-r from-violet-600/80 to-purple-600/80 border border-violet-400/30 text-sm font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-40">
            {yukleniyor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stok Sıfırla Onay Modalı (sadece yönetici) ───────────────────────────────
function StokSifirlaOnay({
  mekanId, mekanAdi, mekanEmoji, onClose, onSuccess,
}: {
  mekanId: string; mekanAdi: string; mekanEmoji: string;
  onClose: () => void; onSuccess: () => void;
}) {
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState('');

  const sifirla = async () => {
    setYukleniyor(true); setHata('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/stok/mekan/sifirla`, {
        method: 'POST', headers,
        body: JSON.stringify({ mekanId }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      onSuccess();
    } catch (err: any) { setHata(err.message || 'Sıfırlama başarısız.'); }
    finally { setYukleniyor(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm px-6"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm rounded-3xl p-6"
        style={{ background: '#0e0826', border: '1px solid rgba(239,68,68,0.25)' }}>
        <div className="flex flex-col items-center text-center gap-3 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/25 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Stoğu Sıfırla</h2>
            <p className="text-xs text-white/40 mt-1">
              <span className="text-white/70">{mekanEmoji} {mekanAdi}</span> için tüm albüm ve ribon değerleri{' '}
              <span className="text-red-400 font-semibold">0</span>'a çekilecek. Bu işlem geri alınamaz.
            </p>
          </div>
        </div>
        {hata && <div className="rounded-xl bg-red-500/12 border border-red-500/20 px-4 py-3 text-xs text-red-300 mb-4">{hata}</div>}
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 h-11 rounded-xl bg-white/6 border border-white/12 text-sm font-semibold text-white/50 active:scale-95 transition-transform">
            Vazgeç
          </button>
          <button onClick={sifirla} disabled={yukleniyor}
            className="flex-1 h-11 rounded-xl bg-gradient-to-r from-red-600/80 to-rose-600/80 border border-red-400/30 text-sm font-bold text-white flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-40">
            {yukleniyor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Evet, Sıfırla
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Depo Yönetim Modalı ──────────────────────────────────────────────────────
function DepoModal({
  onClose, onSuccess, mekanlar,
}: {
  onClose: () => void;
  onSuccess: () => void;
  mekanlar: MekanOzet[];
}) {
  const [sekme, setSekme] = useState<'giris' | 'cikis' | 'gecmis'>('giris');
  const [alan, setAlan] = useState('album3');
  const [miktar, setMiktar] = useState('');
  const [hedefMekan, setHedefMekan] = useState('');
  const [not, setNot] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState('');
  const [basarili, setBasarili] = useState('');
  const [hareketler, setHareketler] = useState<Hareket[]>([]);
  const [gecmisYukleniyor, setGecmisYukleniyor] = useState(false);

  const islem = async () => {
    if (!miktar || isNaN(Number(miktar)) || Number(miktar) <= 0) {
      setHata('Geçerli bir miktar girin.');
      return;
    }
    setYukleniyor(true);
    setHata('');
    setBasarili('');
    try {
      const headers = await authHeaders();
      const endpoint = sekme === 'giris' ? 'giris' : 'cikis';
      const body: any = { alan, miktar: Number(miktar), not };
      if (sekme === 'cikis' && hedefMekan) body.hedefMekan = hedefMekan;

      const res = await fetch(`${API_BASE}/depo/${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);

      setBasarili(
        sekme === 'giris'
          ? `✓ ${miktar} adet ${ALAN_ETIKET[alan]} depoya eklendi.`
          : `✓ ${miktar} adet ${ALAN_ETIKET[alan]} depodan çıkarıldı.`
      );
      setMiktar('');
      setNot('');
      setHedefMekan('');
      onSuccess();
    } catch (err: any) {
      setHata(err.message || 'İşlem başarısız.');
    } finally {
      setYukleniyor(false);
    }
  };

  const gecmisYukle = async () => {
    setGecmisYukleniyor(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/depo/hareketler`, { headers });
      const json = await res.json();
      if (json.hareketler) setHareketler(json.hareketler);
    } catch { /* sessiz */ }
    finally { setGecmisYukleniyor(false); }
  };

  useEffect(() => {
    if (sekme === 'gecmis') gecmisYukle();
  }, [sekme]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-[#0e0826] border border-white/12 rounded-t-3xl overflow-hidden mb-16"
        style={{ maxHeight: '92vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏪</span>
            <div>
              <h2 className="text-sm font-bold text-white">Depo Yönetimi</h2>
              <p className="text-[10px] text-white/30">Stok giriş / çıkış</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/8 border border-white/12 flex items-center justify-center active:scale-90 transition-transform">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* Sekmeler */}
        <div className="flex border-b border-white/8">
          {(['giris','cikis','gecmis'] as const).map(s => {
            const labels = { giris: 'Giriş', cikis: 'Çıkış', gecmis: 'Geçmiş' };
            const icons = { giris: ArrowDownToLine, cikis: ArrowUpFromLine, gecmis: Clock };
            const Ikon = icons[s];
            return (
              <button key={s} onClick={() => { setSekme(s); setHata(''); setBasarili(''); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors ${
                  sekme === s ? 'text-white border-b-2 border-violet-400' : 'text-white/35'
                }`}>
                <Ikon className="w-3.5 h-3.5" />
                {labels[s]}
              </button>
            );
          })}
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(92vh - 130px)' }}>
          {/* Giriş / Çıkış formu */}
          {(sekme === 'giris' || sekme === 'cikis') && (
            <div className="p-5 space-y-4">
              {/* Ürün seçimi */}
              <div>
                <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block mb-2">Ürün</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {ALBUM_TIPLERI.map(a => (
                    <button key={a} onClick={() => setAlan(a)}
                      className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                        alan === a
                          ? 'border-violet-400/60 bg-violet-500/20 text-violet-200'
                          : 'border-white/8 bg-white/4 text-white/40 active:bg-white/8'
                      }`}>
                      {ALAN_ETIKET[a]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Miktar */}
              <div>
                <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block mb-2">
                  Miktar {alan === 'ribon' ? '(takım)' : '(adet)'}
                </label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setMiktar(v => String(Math.max(0, Number(v||0) - 1)))}
                    className="w-11 h-11 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center active:scale-90 transition-transform">
                    <Minus className="w-4 h-4 text-white/60" />
                  </button>
                  <input
                    type="number" min={0} value={miktar}
                    onChange={e => setMiktar(e.target.value)}
                    placeholder="0"
                    className="flex-1 h-11 rounded-xl bg-white/6 border border-white/12 text-white text-center text-lg font-bold outline-none focus:border-violet-400/50 transition-colors"
                  />
                  <button onClick={() => setMiktar(v => String(Number(v||0) + 1))}
                    className="w-11 h-11 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center active:scale-90 transition-transform">
                    <Plus className="w-4 h-4 text-white/60" />
                  </button>
                </div>
                {/* Ribon özet */}
                {alan === 'ribon' && Number(miktar) > 0 && (
                  <p className="text-[10px] text-pink-300/60 mt-1.5 text-center">
                    = {(Number(miktar) * RIBON_PER_TAKIM).toLocaleString('tr-TR')} baskı · {Math.floor(Number(miktar)/TAKIM_PER_KUTU)} kutu{Number(miktar)%2>0?' + 1 takım':''}
                  </p>
                )}
              </div>

              {/* Çıkış → hedef mekan */}
              {sekme === 'cikis' && (
                <div>
                  <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block mb-2">Hedef Mekan (opsiyonel)</label>
                  <select value={hedefMekan} onChange={e => setHedefMekan(e.target.value)}
                    className="w-full h-11 rounded-xl bg-white/6 border border-white/12 text-white text-sm px-3 outline-none focus:border-violet-400/50 appearance-none">
                    <option value="">Seçin (veya boş bırakın)</option>
                    {mekanlar.map(m => <option key={m.id} value={m.name}>{m.emoji} {m.name}</option>)}
                  </select>
                </div>
              )}

              {/* Not */}
              <div>
                <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block mb-2">Not (opsiyonel)</label>
                <input
                  type="text" value={not} onChange={e => setNot(e.target.value)}
                  placeholder="Örn: Üretim partisi #42"
                  className="w-full h-11 rounded-xl bg-white/6 border border-white/12 text-white text-sm px-3 outline-none focus:border-violet-400/50 transition-colors placeholder-white/20"
                />
              </div>

              {hata && <div className="rounded-xl bg-red-500/12 border border-red-500/20 px-4 py-3 text-xs text-red-300">{hata}</div>}
              {basarili && <div className="rounded-xl bg-emerald-500/12 border border-emerald-500/20 px-4 py-3 text-xs text-emerald-300">{basarili}</div>}

              <button
                onClick={islem}
                disabled={yukleniyor || !miktar}
                className={`w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40 ${
                  sekme === 'giris'
                    ? 'bg-gradient-to-r from-emerald-500/80 to-teal-500/80 text-white'
                    : 'bg-gradient-to-r from-amber-500/80 to-orange-500/80 text-white'
                }`}>
                {yukleniyor ? <Loader2 className="w-4 h-4 animate-spin" /> : sekme === 'giris' ? <ArrowDownToLine className="w-4 h-4" /> : <ArrowUpFromLine className="w-4 h-4" />}
                {sekme === 'giris' ? 'Depoya Ekle' : 'Depodan Çıkar'}
              </button>
            </div>
          )}

          {/* Geçmiş */}
          {sekme === 'gecmis' && (
            <div className="p-4 space-y-2">
              {gecmisYukleniyor ? (
                <div className="flex items-center justify-center py-8 gap-2">
                  <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
                  <span className="text-xs text-white/30">Yükleniyor...</span>
                </div>
              ) : hareketler.length === 0 ? (
                <p className="text-center text-xs text-white/25 py-8">Henüz hareket yok</p>
              ) : (
                hareketler.map(h => (
                  <div key={h.id} className="rounded-xl bg-white/4 border border-white/8 px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${h.tip === 'giris' ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {h.tip === 'giris' ? '▲ Giriş' : '▼ Çıkış'}
                        </span>
                        <span className="text-xs text-white font-semibold">{ALAN_ETIKET[h.alan] || h.alan}</span>
                        <span className={`text-xs font-bold ${h.tip === 'giris' ? 'text-emerald-300' : 'text-amber-300'}`}>
                          {h.tip === 'giris' ? '+' : '-'}{h.miktar}
                        </span>
                      </div>
                      <span className="text-[9px] text-white/25">
                        {new Date(h.tarih).toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                      </span>
                    </div>
                    <div className="text-[10px] text-white/30">
                      {h.kullaniciAdi}
                      {h.hedefMekan ? ` → ${h.hedefMekan}` : ''}
                      {h.not ? ` · ${h.not}` : ''}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────
export function StokDagilimi({ userName, userRole, onLogout, onNavigate }: StokDagilimiProps) {
  const [veri, setVeri] = useState<GenelDurum | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState(false);
  const [sonGuncelleme, setSonGuncelleme] = useState<Date | null>(null);
  const [depoModalAcik, setDepoModalAcik] = useState(false);

  // Yönetici stok güncelle / sıfırla modalları
  type GuncelleHedef = { mekanId: string; mekanAdi: string; mekanEmoji: string; albumSayilari: Record<string,number>; ribonTakim: number } | null;
  type SifirlaHedef = { mekanId: string; mekanAdi: string; mekanEmoji: string } | null;
  const [guncelleHedef, setGuncelleHedef] = useState<GuncelleHedef>(null);
  const [sifirlaHedef, setSifirlaHedef] = useState<SifirlaHedef>(null);

  const isYonetici = userRole === 'yonetici';
  const canEditDepo = ['admin', 'yonetici'].includes(userRole);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    setHata(false);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/stok/genel-durum`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.mekanlar) throw new Error('Geçersiz yanıt');
      setVeri(json as GenelDurum);
      setSonGuncelleme(new Date());
    } catch (err) {
      console.error('[StokDagilimi] Veri yüklenemedi:', err);
      setHata(true);
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => { yukle(); }, [yukle]);

  return (
    <div className="pb-24 min-h-screen bg-gradient-to-br from-[#0a051e] via-[#120830] to-[#1a0a3c]">

      {/* Header */}
      <div className="bg-[rgba(10,5,30,0.92)] backdrop-blur-xl border-b border-white/10 px-4 pt-3 pb-3">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate('business-panel')}
            className="w-9 h-9 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center active:scale-90 transition-transform">
            <ArrowLeft className="w-4 h-4 text-white/70" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-white">Stok Dağılımı</h1>
            <div className="text-[10px] text-white/30 flex items-center gap-1 mt-0.5">
              {yukleniyor
                ? <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Yükleniyor...</>
                : hata
                ? <><WifiOff className="w-2.5 h-2.5 text-red-400" /> Bağlantı hatası</>
                : sonGuncelleme
                ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> {sonGuncelleme.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} güncellendi</>
                : 'Gerçek veri'}
            </div>
          </div>
          {canEditDepo && (
            <button
              onClick={() => setDepoModalAcik(true)}
              className="h-9 px-3 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center gap-1.5 active:scale-90 transition-transform">
              <span className="text-sm">🏪</span>
              <span className="text-xs font-semibold text-amber-300">Depo</span>
            </button>
          )}
          <button onClick={yukle} disabled={yukleniyor}
            className="w-9 h-9 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40">
            <RefreshCw className={`w-4 h-4 text-white/50 ${yukleniyor ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Yükleniyor */}
      {yukleniyor && !veri && (
        <div className="flex flex-col items-center justify-center pt-24 gap-3">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          <span className="text-sm text-white/30">Stok verileri yükleniyor...</span>
        </div>
      )}

      {/* Hata */}
      {hata && !veri && (
        <div className="mx-4 mt-8 rounded-2xl border border-red-500/20 bg-red-500/8 px-5 py-6 text-center">
          <WifiOff className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <div className="text-sm font-semibold text-red-300 mb-1">Veri yüklenemedi</div>
          <div className="text-xs text-white/30 mb-4">Sunucu bağlantısını kontrol edin</div>
          <button onClick={yukle}
            className="px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-xs font-semibold text-red-300 active:scale-95 transition-transform">
            Tekrar Dene
          </button>
        </div>
      )}

      {/* Ana içerik */}
      {veri && (
        <div className="pt-4">
          {/* Üst bilgi şeridi */}
          <div className="px-4 mb-4 flex items-center justify-between">
            <span className="text-[11px] text-white/28 font-semibold tracking-wide">
              {new Date(veri.tarih + 'T00:00:00').toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' })}
              {' · '}{veri.mekanlar.length} mekan
            </span>
            {veri.genelRibonKapasite > 0 && (
              <span className="text-[11px] text-pink-400/60 font-semibold">
                🖨️ {veri.genelRibonKapasite.toLocaleString('tr-TR')} toplam baskı
              </span>
            )}
          </div>

          {/* 1 · Genel Albüm Dağılımı */}
          <GenelAlbumCard dagilim={veri.genelAlbumDagilimi} />

          {/* 2 · Ribon Stoğu */}
          <RibonCard mekanlar={veri.mekanlar} depo={veri.depo} />

          {/* 3 · Mekan Bazlı Albüm Dağılımı */}
          <div className="mx-4 mb-4 rounded-2xl border border-white/12 bg-[rgba(10,5,30,0.6)] backdrop-blur overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-white/8 flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-bold text-white">Mekan Bazlı Albüm Dağılımı</span>
            </div>
            <div className="p-3 space-y-2">
              {veri.mekanlar.map(m => (
                <MekanAlbumCard
                  key={m.id}
                  mekan={m}
                  isYonetici={isYonetici}
                  onGuncelle={mekan => setGuncelleHedef({
                    mekanId: mekan.id, mekanAdi: mekan.name, mekanEmoji: mekan.emoji,
                    albumSayilari: mekan.albumSayilari, ribonTakim: mekan.albumSayilari['ribon'] || 0,
                  })}
                  onSifirla={mekan => setSifirlaHedef({ mekanId: mekan.id, mekanAdi: mekan.name, mekanEmoji: mekan.emoji })}
                />
              ))}
              <DepoAlbumCard
                depo={veri.depo}
                isYonetici={isYonetici}
                onGuncelle={() => setGuncelleHedef({
                  mekanId: 'depo', mekanAdi: 'Depo', mekanEmoji: '🏪',
                  albumSayilari: veri.depo.albumSayilari, ribonTakim: veri.depo.ribonTakim,
                })}
                onSifirla={() => setSifirlaHedef({ mekanId: 'depo', mekanAdi: 'Depo', mekanEmoji: '🏪' })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Depo Modalı */}
      {depoModalAcik && veri && (
        <DepoModal
          mekanlar={veri.mekanlar}
          onClose={() => setDepoModalAcik(false)}
          onSuccess={() => { setDepoModalAcik(false); yukle(); }}
        />
      )}

      {/* Stok Güncelle Modalı */}
      {guncelleHedef && (
        <StokGuncelleModal
          mekanId={guncelleHedef.mekanId}
          mekanAdi={guncelleHedef.mekanAdi}
          mekanEmoji={guncelleHedef.mekanEmoji}
          mevcutAlbumSayilari={guncelleHedef.albumSayilari}
          mevcutRibonTakim={guncelleHedef.ribonTakim}
          onClose={() => setGuncelleHedef(null)}
          onSuccess={() => { setGuncelleHedef(null); yukle(); }}
        />
      )}

      {/* Stok Sıfırla Onay Modalı */}
      {sifirlaHedef && (
        <StokSifirlaOnay
          mekanId={sifirlaHedef.mekanId}
          mekanAdi={sifirlaHedef.mekanAdi}
          mekanEmoji={sifirlaHedef.mekanEmoji}
          onClose={() => setSifirlaHedef(null)}
          onSuccess={() => { setSifirlaHedef(null); yukle(); }}
        />
      )}

      <NewBottomNav
        activeTab="business-panel"
        onNavigate={onNavigate}
        userRole={userRole}
        onLogout={onLogout}
      />
    </div>
  );
}