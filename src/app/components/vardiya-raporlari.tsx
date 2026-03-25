/**
 * VardiyaRaporlari — Yönetici/Müdür, kapanışı tamamlanmış vardiya raporları
 * Gerçek veri: GET /vardiya/raporlar  |  DELETE /vardiya/sil
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft, ChevronRight, Users, Printer, TrendingUp, Package,
  CreditCard, Banknote, Wallet, AlertTriangle, Camera, RefreshCw,
  SlidersHorizontal, ChevronUp, ChevronDown, Loader2, AlertCircle,
  Trash2, Trophy,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { UserRole } from './login';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { getToken, appendGhostParam } from '../lib/api';
import { bizDateStr } from '../lib/date';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;
const SAYFA_BOYUTU = 10;

/* ─────────────────────── Types ─────────────────────── */
interface UrunSatir {
  urun: string;
  adet: number;
  toplamTL: number;
}

interface PersonelSatis {
  id: string;
  ad: string;
  avatar: string;
  kare: number;
  nakitTL: number;
  ibanTL: number;
  krediTL: number;
  toplamTL: number;
  satirlar: UrunSatir[];
}

interface YaziciSayac {
  ad: string;
  baslangic: number;
  bitis: number;
  netBasilan: number;
}

interface Anomali {
  tip: 'stok' | 'yazici';
  aciklama: string;
}

interface VardiyaKayit {
  id: string;
  mekanId: string;
  mekan: string;
  mekanEmoji: string;
  mekanColor: string;
  tarih: string;
  acilisSaat: string;
  kapanisSaat: string;
  printType: 'tam' | 'yarim' | null;
  personeller: PersonelSatis[];
  yazicilar: YaziciSayac[];
  anomaliler: Anomali[];
  albumler: Record<string, number>;
  toplamKare: number;
  toplamIade: number;
  stokBaslangic: number;
  stokBitis: number;
  toplamIskonto: number;
  toplamCiro: number;
  nakitToplamTL: number;
  ibanToplamTL: number;
  krediToplamTL: number;
  albumMaliyeti: number;
  baskiMaliyeti: number;
  baskiPaperName: string | null;
  kotaKademeleri?: any[];
  primBilgi?: {
    kademeIndex: number;
    kademeHedef: number;
    topKademePrim: number;
    toplamPrim: number;
    toplamKademe: number;
    personelSayisi: number;
    coklu: boolean;
  } | null;
}

/* ─────────────────────── Helpers ─────────────────────── */
function formatTarih(s: string) {
  return new Date(s + 'T00:00:00').toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function tl(n: number) {
  return `₺${Math.round(n).toLocaleString('tr-TR')}`;
}

/* ─────────────────────── FiltrePaneli ─────────────────────── */
interface FiltreProps {
  filtreMekan: string; setFiltreMekan: (v: string) => void;
  filtreTarihBas: string; setFiltreTarihBas: (v: string) => void;
  filtreTarihBit: string; setFiltreTarihBit: (v: string) => void;
  mekanlar: { id: string; ad: string }[];
  onReset: () => void;
  onAra: () => void;
}

function FiltrePaneli({
  filtreMekan, setFiltreMekan,
  filtreTarihBas, setFiltreTarihBas,
  filtreTarihBit, setFiltreTarihBit,
  mekanlar, onReset, onAra,
}: FiltreProps) {
  const [acik, setAcik] = useState(false);

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
    padding: '7px 10px', fontSize: 12, color: 'rgba(255,255,255,0.85)', outline: 'none',
  };

  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, marginBottom: 12, overflow: 'hidden' }}>
      <button onClick={() => setAcik(!acik)} className="w-full flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
          <span className="text-white/70 font-semibold" style={{ fontSize: 12 }}>Filtre & Tarih Aralığı</span>
        </div>
        {acik ? <ChevronUp className="w-3.5 h-3.5 text-white/30" /> : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
      </button>

      <AnimatePresence>
        {acik && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-white/40 mb-1" style={{ fontSize: 10 }}>Başlangıç</p>
                  <input type="date" value={filtreTarihBas} onChange={e => setFiltreTarihBas(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <p className="text-white/40 mb-1" style={{ fontSize: 10 }}>Bitiş</p>
                  <input type="date" value={filtreTarihBit} onChange={e => setFiltreTarihBit(e.target.value)} style={inputStyle} />
                </div>
              </div>

              <div>
                <p className="text-white/40 mb-1" style={{ fontSize: 10 }}>Mekan</p>
                <select value={filtreMekan} onChange={e => setFiltreMekan(e.target.value)} style={inputStyle}>
                  <option value="">Tüm Mekanlar</option>
                  {mekanlar.map(m => <option key={m.id} value={m.id}>{m.ad}</option>)}
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={onAra}
                  className="flex-1 py-2 rounded-xl text-white font-bold"
                  style={{ background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.4)', fontSize: 12 }}
                >
                  Ara
                </button>
                <button
                  onClick={onReset}
                  className="flex items-center gap-1.5 px-3 text-white/40 hover:text-white/60 transition-colors"
                  style={{ fontSize: 11 }}
                >
                  <RefreshCw className="w-3 h-3" /> Sıfırla
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────── SilmeOnayDialog ─────────────────────── */
function SilmeOnayDialog({
  v, yukleniyor, onOnayla, onIptal,
}: {
  v: VardiyaKayit;
  yukleniyor: boolean;
  onOnayla: () => void;
  onIptal: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center pb-6 px-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onIptal(); }}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 260 }}
        style={{
          width: '100%', maxWidth: 420,
          background: 'rgba(30,15,50,0.97)',
          border: '1px solid rgba(248,113,113,0.3)',
          borderRadius: 20, padding: '20px 20px 24px',
        }}
      >
        {/* İkon */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)' }}>
            <Trash2 className="w-5 h-5" style={{ color: '#f87171' }} />
          </div>
          <div>
            <p className="text-white font-black" style={{ fontSize: 15 }}>Vardiyayı Sil</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Bu işlem geri alınamaz</p>
          </div>
        </div>

        {/* Kart önizleme */}
        <div className="flex items-center gap-2.5 mb-4 px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize: 22 }}>{v.mekanEmoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold truncate" style={{ fontSize: 13 }}>{v.mekan}</p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
              {formatTarih(v.tarih)} · {v.acilisSaat}–{v.kapanisSaat}
            </p>
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#a78bfa' }}>{tl(v.toplamCiro)}</span>
        </div>

        {/* Uyarı metni */}
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 18 }}>
          Bu vardiyaya ait tüm satış, stok, kare ve yazıcı verileri kalıcı olarak silinecektir. Tüm raporlardan düşer.
        </p>

        {/* Butonlar */}
        <div className="flex gap-2">
          <button
            onClick={onIptal}
            disabled={yukleniyor}
            className="flex-1 py-3 rounded-2xl text-white/60 font-bold transition-all"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 13 }}
          >
            İptal
          </button>
          <button
            onClick={onOnayla}
            disabled={yukleniyor}
            className="flex-1 py-3 rounded-2xl font-black transition-all flex items-center justify-center gap-2"
            style={{ background: 'rgba(248,113,113,0.2)', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171', fontSize: 13 }}
          >
            {yukleniyor
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <><Trash2 className="w-4 h-4" /> Evet, Sil</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────── OzetKart ─────────────────────── */
function OzetKart({
  v, onClick, canDelete, onSilTalep,
}: {
  v: VardiyaKayit;
  onClick: () => void;
  canDelete: boolean;
  onSilTalep: (v: VardiyaKayit) => void;
}) {
  const iskOran = v.toplamIskonto > 0 && v.toplamCiro > 0
    ? ((v.toplamIskonto / (v.toplamCiro + v.toplamIskonto)) * 100).toFixed(1)
    : null;

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: v.anomaliler.length > 0 ? '1px solid rgba(251,146,60,0.25)' : '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: '14px 16px', cursor: 'pointer', marginBottom: 10,
        position: 'relative',
      }}
    >
      {/* Silme butonu — sadece yönetici */}
      {canDelete && (
        <button
          onClick={e => { e.stopPropagation(); onSilTalep(v); }}
          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-xl flex items-center justify-center transition-all active:scale-90"
          style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)' }}
        >
          <Trash2 style={{ width: 12, height: 12, color: '#f87171' }} />
        </button>
      )}

      <div className="flex items-start gap-3">
        <div style={{ fontSize: 28, flexShrink: 0, lineHeight: 1, marginTop: 2 }}>{v.mekanEmoji}</div>

        <div className="flex-1 min-w-0">
          {/* Satır 1: mekan + anomali badge */}
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap" style={{ paddingRight: canDelete ? 28 : 0 }}>
            <span className="text-white font-bold" style={{ fontSize: 14 }}>{v.mekan}</span>
            {v.anomaliler.length > 0 && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.3)' }}>
                <AlertTriangle style={{ width: 9, height: 9, color: '#fb923c' }} />
                <span style={{ fontSize: 9, color: '#fb923c', fontWeight: 700 }}>{v.anomaliler.length} anomali</span>
              </div>
            )}
          </div>

          {/* Satır 2: tarih + saat */}
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
            {formatTarih(v.tarih)} · {v.acilisSaat}–{v.kapanisSaat}
          </p>

          {/* Satır 3: personel kare chip'leri */}
          {v.personeller.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {v.personeller.map(p => (
                <div key={p.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)' }}>
                  <span style={{ fontSize: 9 }}>{p.avatar}</span>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                    {p.ad.split(' ')[0]}
                  </span>
                  {p.kare > 0 && (
                    <>
                      <Camera style={{ width: 8, height: 8, color: '#818cf8' }} />
                      <span style={{ fontSize: 9, color: '#818cf8', fontWeight: 700 }}>{p.kare}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sağ: iskonto (üstte) + ciro + nakit */}
        <div className="flex items-center gap-1.5 flex-shrink-0 self-center">
          <div className="text-right">
            {/* İskonto — cironun üstünde */}
            {iskOran && (
              <div className="flex items-center justify-end gap-1 mb-1.5">
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.28)' }}>
                  <span style={{ fontSize: 11, color: '#fb923c', fontWeight: 600 }}>İsk</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>|</span>
                  <span style={{ fontSize: 11, color: '#fb923c', fontWeight: 700 }}>-{tl(v.toplamIskonto)}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>|</span>
                  <span style={{ fontSize: 11, color: '#fbbf24', fontWeight: 700 }}>%{iskOran}</span>
                </div>
              </div>
            )}

            {/* Ciro */}
            <p style={{ fontSize: 16, fontWeight: 800, color: '#a78bfa', lineHeight: 1 }}>{tl(v.toplamCiro)}</p>

            {/* Nakit */}
            <div className="flex items-center justify-end gap-1 mt-1.5">
              <Banknote style={{ width: 9, height: 9, color: '#34d399' }} />
              <span style={{ fontSize: 11, color: '#34d399', fontWeight: 700 }}>{tl(v.nakitToplamTL)}</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-white/20 flex-shrink-0" />
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────────────── VardiyaDetay ─────────────────────── */
function VardiyaDetay({ v, onBack }: { v: VardiyaKayit; onBack: () => void }) {
  const sectionStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14, padding: '14px 16px', marginBottom: 10,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4,
  };
  const valStyle: React.CSSProperties = { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: 700 };

  const enCokSatan = useMemo(() => {
    const map: Record<string, number> = {};
    for (const [urun, adet] of Object.entries(v.albumler)) {
      map[urun] = (map[urun] || 0) + adet;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])[0] ?? ['—', 0];
  }, [v.albumler]);

  const toplamSatisAdet = useMemo(() =>
    v.personeller.reduce((s, p) => s + p.satirlar.reduce((ss, sr) => ss + sr.adet, 0), 0),
  [v.personeller]);

  const ortalamaSepet = toplamSatisAdet > 0 ? Math.round(v.toplamCiro / toplamSatisAdet) : 0;

  return (
    <div>
      {/* Geri */}
      <button onClick={onBack} className="flex items-center gap-2 mb-4 text-white/60 hover:text-white/90 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span style={{ fontSize: 13, fontWeight: 600 }}>Tüm Vardiyalar</span>
      </button>

      {/* Başlık */}
      <div className="flex items-center gap-3 mb-4">
        <div style={{ fontSize: 32, lineHeight: 1 }}>{v.mekanEmoji}</div>
        <div className="flex-1">
          <p className="text-white font-black" style={{ fontSize: 18 }}>{v.mekan}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{formatTarih(v.tarih)}</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>·</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{v.acilisSaat} – {v.kapanisSaat}</span>
            {v.printType && (
              <>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>·</span>
                <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: 'rgba(167,139,250,0.15)', color: '#a78bfa', fontWeight: 700 }}>
                  {v.printType === 'tam' ? 'Tam Boy' : 'Yarım Boy'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Anomaliler */}
      {v.anomaliler.length > 0 && (
        <div className="mb-3 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(251,146,60,0.3)', background: 'rgba(251,146,60,0.08)' }}>
          {v.anomaliler.map((a, i) => (
            <div key={i} className="flex items-start gap-2.5 px-3 py-2.5">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#fb923c' }} />
              <div>
                <p style={{ fontSize: 11, color: '#fb923c', fontWeight: 700 }}>
                  {a.tip === 'stok' ? 'Stok Anomalisi' : 'Yazıcı Anomalisi'}
                </p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{a.aciklama}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Özet metrikler */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {[
          { label: 'Toplam Kare', val: `${v.toplamKare}`, color: '#818cf8' },
          { label: 'İptal Satış', val: `${v.toplamIade}`, color: '#f87171' },
          { label: 'En Çok Satan', val: `${enCokSatan[0]} ×${enCokSatan[1]}`, color: '#fbbf24' },
          { label: 'Ort. Sepet', val: tl(ortalamaSepet), color: '#34d399' },
        ].map(m => (
          <div key={m.label} style={{ ...sectionStyle, padding: '10px 12px', marginBottom: 0 }}>
            <p style={labelStyle}>{m.label}</p>
            <p style={{ ...valStyle, color: m.color }}>{m.val}</p>
          </div>
        ))}
      </div>

      {/* Personel Detayı */}
      {v.personeller.length > 0 && (
        <div style={sectionStyle}>
          <p style={labelStyle}>
            <Users style={{ width: 10, height: 10, display: 'inline', marginRight: 4 }} />
            Personel Detayı
          </p>
          <div className="space-y-3">
            {v.personeller.map(p => (
              <div key={p.id} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2.5 mb-3">
                  <span style={{ fontSize: 22 }}>{p.avatar}</span>
                  <div className="flex-1">
                    <p style={{ ...valStyle, fontSize: 14 }}>{p.ad}</p>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                      {p.kare > 0 ? `${p.kare} kare` : 'Kare kaydı yok'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p style={{ fontSize: 14, fontWeight: 800, color: '#a78bfa' }}>{tl(p.toplamTL)}</p>
                    <p style={{ fontSize: 10, color: '#34d399', fontWeight: 600 }}>Nakit: {tl(p.nakitTL)}</p>
                  </div>
                </div>

                {/* Ödeme dağılımı */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: 'Nakit',  val: p.nakitTL, color: '#34d399', Icon: Banknote   },
                    { label: 'IBAN',   val: p.ibanTL,  color: '#60a5fa', Icon: Wallet     },
                    { label: 'Kredi',  val: p.krediTL, color: '#f472b6', Icon: CreditCard },
                  ].map(od => (
                    <div key={od.label} style={{ background: `${od.color}10`, borderRadius: 10, padding: '8px 10px', border: `1px solid ${od.color}20` }}>
                      <div className="flex items-center gap-1 mb-1.5">
                        <od.Icon style={{ width: 10, height: 10, color: od.color }} />
                        <span style={{ fontSize: 9, color: od.color, fontWeight: 700 }}>{od.label}</span>
                      </div>
                      <p style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.85)' }}>{tl(od.val)}</p>
                    </div>
                  ))}
                </div>

                {/* Ürün dökümü */}
                {p.satirlar.length > 0 && (
                  <div>
                    <p style={{ ...labelStyle, marginBottom: 6 }}>Satılan Ürünler</p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.satirlar.map((s, i) => (
                        <span key={i} style={{
                          fontSize: 10, padding: '3px 9px', borderRadius: 20,
                          background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)',
                          color: 'rgba(255,255,255,0.65)',
                        }}>
                          {s.urun} ×{s.adet}{s.toplamTL > 0 ? ` · ${tl(s.toplamTL)}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toplam Ciro */}
      <div style={sectionStyle}>
        <p style={labelStyle}>
          <TrendingUp style={{ width: 10, height: 10, display: 'inline', marginRight: 4 }} />
          Vardiya Toplam Ciro
        </p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: 'Nakit',  val: v.nakitToplamTL, color: '#34d399', Icon: Banknote   },
            { label: 'IBAN',   val: v.ibanToplamTL,  color: '#60a5fa', Icon: Wallet     },
            { label: 'Kredi',  val: v.krediToplamTL, color: '#f472b6', Icon: CreditCard },
          ].map(t => (
            <div key={t.label} style={{ background: `${t.color}10`, borderRadius: 12, padding: '10px 12px', border: `1px solid ${t.color}20` }}>
              <div className="flex items-center gap-1 mb-1.5">
                <t.Icon style={{ width: 10, height: 10, color: t.color }} />
                <span style={{ fontSize: 9, color: t.color, fontWeight: 700 }}>{t.label}</span>
              </div>
              <p style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.9)' }}>{tl(t.val)}</p>
            </div>
          ))}
        </div>
        {v.toplamIskonto > 0 && (
          <div className="flex items-center justify-between px-1 mb-2">
            <span style={{ fontSize: 11, color: 'rgba(251,146,60,0.7)' }}>Toplam İskonto</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fb923c' }}>-{tl(v.toplamIskonto)}</span>
          </div>
        )}
        <div style={{ background: 'rgba(52,211,153,0.08)', borderRadius: 10, padding: '10px 14px', border: '1px solid rgba(52,211,153,0.2)', marginBottom: 8 }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Banknote style={{ width: 13, height: 13, color: '#34d399' }} />
              <span style={{ fontSize: 11, color: '#34d399', fontWeight: 700 }}>Teslim Edilecek Nakit</span>
            </div>
            <p style={{ fontSize: 15, fontWeight: 800, color: '#34d399' }}>{tl(v.nakitToplamTL)}</p>
          </div>
          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Kredi kartı ve IBAN hariç</p>
        </div>
        <div className="flex items-center justify-between px-1">
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Genel Toplam</span>
          <span style={{ fontSize: 16, fontWeight: 900, color: '#a78bfa' }}>{tl(v.toplamCiro)}</span>
        </div>
      </div>

      {/* Albüm & Baskı */}
      <div style={sectionStyle}>
        <p style={labelStyle}>
          <Package style={{ width: 10, height: 10, display: 'inline', marginRight: 4 }} />
          Albüm & Baskı Özeti
        </p>

        {Object.keys(v.albumler).length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-3">
            {Object.entries(v.albumler).map(([urun, adet]) => (
              <div key={urun} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '8px 12px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>{urun}</p>
                <p style={{ fontSize: 16, fontWeight: 800, color: 'rgba(255,255,255,0.9)' }}>{adet}</p>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>Albüm satışı yok</p>
        )}

        <div className="grid grid-cols-3 gap-2">
          <div>
            <p style={labelStyle}>Albüm Maliyeti</p>
            <p style={{ ...valStyle, color: '#f87171' }}>{tl(v.albumMaliyeti)}</p>
            {v.printType && (
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{v.printType === 'tam' ? 'Tam Boy' : 'Yarım Boy'}</p>
            )}
          </div>
          <div>
            <p style={labelStyle}>Baskı Maliyeti</p>
            <p style={{ ...valStyle, color: '#f87171' }}>{tl(v.baskiMaliyeti)}</p>
            {v.baskiPaperName && (
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{v.baskiPaperName}</p>
            )}
          </div>
          <div>
            <p style={labelStyle}>Stok Baş→Son</p>
            <p style={{ ...valStyle, color: '#60a5fa' }}>{v.stokBaslangic}→{v.stokBitis}</p>
          </div>
        </div>

        {(v.albumMaliyeti > 0 || v.baskiMaliyeti > 0) && (
          <div className="mt-3 flex items-center justify-between px-1">
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Toplam Maliyet</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#f87171' }}>{tl(v.albumMaliyeti + v.baskiMaliyeti)}</span>
          </div>
        )}

        {v.toplamCiro > 0 && (v.albumMaliyeti > 0 || v.baskiMaliyeti > 0) && (
          <div className="mt-2 flex items-center justify-between px-1">
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Brüt Kâr (ürün bazlı)</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#34d399' }}>
              {tl(v.toplamCiro - v.albumMaliyeti - v.baskiMaliyeti)}
            </span>
          </div>
        )}
      </div>

      {/* Yazıcı Sayaçları */}
      {v.yazicilar.length > 0 && (
        <div style={sectionStyle}>
          <p style={labelStyle}>
            <Printer style={{ width: 10, height: 10, display: 'inline', marginRight: 4 }} />
            Yazıcı Sayaçları
          </p>
          <div className="space-y-2">
            {v.yazicilar.map((y, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 700, marginBottom: 6 }}>{y.ad}</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Açılış Sayacı', val: y.baslangic.toLocaleString('tr-TR') },
                    { label: 'Kapanış Sayacı', val: y.bitis.toLocaleString('tr-TR') },
                    { label: 'Net Basılan', val: `${y.netBasilan} kare` },
                  ].map(s => (
                    <div key={s.label}>
                      <p style={labelStyle}>{s.label}</p>
                      <p style={{ ...valStyle, fontSize: 12 }}>{s.val}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Prim Özeti ── */}
      {v.primBilgi && (() => {
        const pb = v.primBilgi!;
        const KADEME_COLORS = ['#60a5fa', '#a855f7', '#fbbf24', '#34d399', '#f87171', '#fb923c'];
        const KADEME_EMOJIS = ['🥉', '🥈', '🥇', '🏅', '💎', '👑'];
        const KADEME_LABELS = ['1. Kademe', '2. Kademe', '3. Kademe', '4. Kademe', '5. Kademe', '6. Kademe'];
        const idx = Math.min(pb.kademeIndex, 5);
        const color = KADEME_COLORS[idx];
        const emoji = KADEME_EMOJIS[idx];
        const label = KADEME_LABELS[idx];

        // Personel isimleri: v.personeller varsa oradan al
        const personelIsimleri: string[] = (v.personeller || []).map((p: any) => p.ad).filter(Boolean);

        return (
          <div style={{
            background: `linear-gradient(135deg, ${color}18 0%, ${color}08 100%)`,
            border: `1px solid ${color}40`,
            borderRadius: 14, padding: '14px 16px', marginBottom: 10,
          }}>
            {/* Başlık */}
            <div className="flex items-center gap-2 mb-3">
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: `${color}22`, border: `1px solid ${color}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, flexShrink: 0,
              }}>{emoji}</div>
              <div className="flex-1">
                <p style={{ fontSize: 13, fontWeight: 800, color: 'white' }}>
                  🏆 Prim Kazanıldı!
                </p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
                  {label} · Hedef {tl(pb.kademeHedef)} geçildi
                </p>
              </div>
              <div style={{
                padding: '3px 8px', borderRadius: 8,
                background: `${color}25`, border: `1px solid ${color}50`,
              }}>
                <span style={{ fontSize: 14, fontWeight: 900, color }}>{tl(pb.toplamPrim)}</span>
              </div>
            </div>

            {/* Detay satırları */}
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 10px', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Kişi Başı</p>
                <p style={{ fontSize: 13, fontWeight: 800, color }}>{tl(pb.topKademePrim)}</p>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 10px', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Personel</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.85)' }}>
                  {pb.personelSayisi} kişi{pb.coklu ? ' 👥' : ' 👤'}
                </p>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 10px', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Kademe</p>
                <p style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.85)' }}>
                  {pb.toplamKademe}/{(v.kotaKademeleri || []).length}
                </p>
              </div>
            </div>

            {/* Kişi bazlı prim listesi */}
            {personelIsimleri.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '8px 10px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 8 }}>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>
                  Kişi Bazlı Kazanım
                </p>
                <div className="space-y-1.5">
                  {personelIsimleri.map((ad, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div style={{
                          width: 20, height: 20, borderRadius: 6,
                          background: `${color}18`, border: `1px solid ${color}30`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, fontWeight: 800, color,
                        }}>
                          {ad.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>{ad}</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 800, color }}>{tl(pb.topKademePrim)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Progress bar: kaç kota geçildi */}
            {(v.kotaKademeleri || []).length > 0 && (
              <div className="mt-1">
                <div style={{ display: 'flex', gap: 4 }}>
                  {(v.kotaKademeleri || []).map((k: any, i: number) => {
                    const reached = v.toplamCiro >= k.hedef;
                    const kColor = KADEME_COLORS[Math.min(i, 5)];
                    return (
                      <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: reached ? kColor : 'rgba(255,255,255,0.1)', boxShadow: reached ? `0 0 6px ${kColor}80` : 'none' }} />
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  {(v.kotaKademeleri || []).map((k: any, i: number) => (
                    <span key={i} style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                      {k.hedef >= 1000 ? `${(k.hedef / 1000).toFixed(0)}B` : k.hedef}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Prim yoksa ama kota varsa minimal bilgi */}
      {!v.primBilgi && (v.kotaKademeleri || []).length > 0 && (() => {
        const kkList = v.kotaKademeleri || [];
        const ilk = kkList[0];
        const fark = ilk.hedef - v.toplamCiro;
        if (fark <= 0) return null;
        return (
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14, padding: '12px 14px', marginBottom: 10,
          }}>
            <div className="flex items-center gap-2">
              <Trophy style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.25)' }} />
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
                1. Prim kotasına {tl(fark)} eksik kaldı
              </p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ─────────────────────── Ana Bileşen ─────────────────────── */
interface Props {
  userName: string;
  userRole: UserRole;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export function VardiyaRaporlari({ userName, userRole, onLogout, onNavigate }: Props) {
  const [raporlar, setRaporlar] = useState<VardiyaKayit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seciliId, setSeciliId] = useState<string | null>(null);

  // Sayfalama
  const [gorunenAdet, setGorunenAdet] = useState(SAYFA_BOYUTU);

  // Silme
  const [silOnayV, setSilOnayV] = useState<VardiyaKayit | null>(null);
  const [silYukleniyor, setSilYukleniyor] = useState(false);

  const canDelete = userRole === 'yonetici';

  // Filtreler
  const [filtreMekan, setFiltreMekan] = useState('');
  const [filtreTarihBas, setFiltreTarihBas] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    // Türkiye lokal tarihi (UTC değil) — gece yarısı 00:00–02:59 arası kayma önlendi
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [filtreTarihBit, setFiltreTarihBit] = useState(() => bizDateStr());

  const mekanlar = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of raporlar) map[r.mekanId] = r.mekan;
    return Object.entries(map).map(([id, ad]) => ({ id, ad }));
  }, [raporlar]);

  const fetchRaporlar = useCallback(async (bas: string, bit: string, mkId: string) => {
    setLoading(true);
    setError(null);
    setGorunenAdet(SAYFA_BOYUTU);
    try {
      const token = await getToken();
      const params = new URLSearchParams();
      if (bas) params.set('baslangic', bas);
      if (bit) params.set('bitis', bit);
      if (mkId) params.set('mekanId', mkId);

      const res = await fetch(appendGhostParam(`${API_BASE}/vardiya/raporlar?${params.toString()}`), {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Access-Token': token,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      setRaporlar(data.raporlar || []);
    } catch (e) {
      console.error('[VardiyaRaporlari] fetch error:', e);
      setError('Sunucuya bağlanılamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRaporlar(filtreTarihBas, filtreTarihBit, filtreMekan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAra = () => {
    fetchRaporlar(filtreTarihBas, filtreTarihBit, filtreMekan);
  };

  const handleReset = () => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    const bas = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const bit = bizDateStr();
    setFiltreMekan('');
    setFiltreTarihBas(bas);
    setFiltreTarihBit(bit);
    fetchRaporlar(bas, bit, '');
  };

  const handleSil = async () => {
    if (!silOnayV) return;
    setSilYukleniyor(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/vardiya/sil`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Access-Token': token,
        },
        body: JSON.stringify({ mekanId: silOnayV.mekanId, tarih: silOnayV.tarih }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('[VardiyaRaporlari] silme hatası:', data.error);
        alert(`Silme hatası: ${data.error}`);
        return;
      }
      // Listeden çıkar
      setRaporlar(prev => prev.filter(r => r.id !== silOnayV.id));
      setSilOnayV(null);
    } catch (e) {
      console.error('[VardiyaRaporlari] silme fetch error:', e);
      alert('Sunucuya bağlanılamadı.');
    } finally {
      setSilYukleniyor(false);
    }
  };

  const secili = raporlar.find(r => r.id === seciliId) ?? null;
  const gorunenRaporlar = raporlar.slice(0, gorunenAdet);
  const kalanAdet = raporlar.length - gorunenAdet;

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-white font-black" style={{ fontSize: 18 }}>Vardiya Raporları</h1>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            {secili ? secili.mekan : loading ? 'Yükleniyor…' : `${raporlar.length} kapanmış vardiya`}
          </p>
        </div>
        {!secili && (
          <button
            onClick={handleAra}
            className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all active:scale-90"
            style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)' }}
          >
            <RefreshCw className={`w-4 h-4 text-violet-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* İçerik */}
      <div className="px-4 pb-8">
        <AnimatePresence mode="wait">
          {/* Liste */}
          {!secili && (
            <motion.div key="liste" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
              <FiltrePaneli
                filtreMekan={filtreMekan}       setFiltreMekan={setFiltreMekan}
                filtreTarihBas={filtreTarihBas} setFiltreTarihBas={setFiltreTarihBas}
                filtreTarihBit={filtreTarihBit} setFiltreTarihBit={setFiltreTarihBit}
                mekanlar={mekanlar}
                onReset={handleReset}
                onAra={handleAra}
              />

              {loading && (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Vardiyalar yükleniyor…</p>
                </div>
              )}

              {!loading && error && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)' }}>
                    <AlertCircle className="w-6 h-6 text-red-400" />
                  </div>
                  <p style={{ fontSize: 13, color: '#f87171', fontWeight: 600, textAlign: 'center' }}>{error}</p>
                  <button
                    onClick={handleAra}
                    className="px-4 py-2 rounded-xl text-white/70 text-sm"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    Tekrar Dene
                  </button>
                </div>
              )}

              {!loading && !error && raporlar.length === 0 && (
                <div className="text-center py-16">
                  <p style={{ fontSize: 32, marginBottom: 12 }}>📋</p>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Bu tarih aralığında kapanmış vardiya bulunamadı.</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>Tarih aralığını genişletmeyi deneyin.</p>
                </div>
              )}

              {!loading && !error && gorunenRaporlar.map(v => (
                <OzetKart
                  key={v.id}
                  v={v}
                  onClick={() => setSeciliId(v.id)}
                  canDelete={canDelete}
                  onSilTalep={setSilOnayV}
                />
              ))}

              {/* +10 Daha Göster */}
              {!loading && !error && kalanAdet > 0 && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setGorunenAdet(prev => prev + SAYFA_BOYUTU)}
                  className="w-full py-3 rounded-2xl flex items-center justify-center gap-2 mt-1"
                  style={{
                    background: 'rgba(167,139,250,0.08)',
                    border: '1px solid rgba(167,139,250,0.2)',
                  }}
                >
                  <ChevronDown style={{ width: 14, height: 14, color: '#a78bfa' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa' }}>
                    +{Math.min(kalanAdet, SAYFA_BOYUTU)} Daha Göster
                  </span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginLeft: 2 }}>
                    ({kalanAdet} kaldı)
                  </span>
                </motion.button>
              )}

              {/* Tümü gösterildi bilgisi */}
              {!loading && !error && raporlar.length > 0 && kalanAdet <= 0 && gorunenAdet > SAYFA_BOYUTU && (
                <p className="text-center mt-3" style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
                  Tüm {raporlar.length} vardiya gösteriliyor
                </p>
              )}
            </motion.div>
          )}

          {/* Detay */}
          {secili && (
            <motion.div key={secili.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.22 }}>
              <VardiyaDetay v={secili} onBack={() => setSeciliId(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Silme Onay Dialog */}
      <AnimatePresence>
        {silOnayV && (
          <SilmeOnayDialog
            v={silOnayV}
            yukleniyor={silYukleniyor}
            onOnayla={handleSil}
            onIptal={() => { if (!silYukleniyor) setSilOnayV(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}