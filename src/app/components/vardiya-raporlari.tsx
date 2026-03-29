/**
 * VardiyaRaporlari — Yönetici/Müdür, kapanışı tamamlanmış vardiya raporları
 * Gerçek veri: GET /vardiya/raporlar  |  DELETE /vardiya/sil
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Users, Printer, TrendingUp, Package,
  CreditCard, Banknote, Wallet, AlertTriangle, Camera, RefreshCw,
  SlidersHorizontal, ChevronUp, ChevronDown, Loader2, AlertCircle,
  Trash2, Trophy, FileSpreadsheet, FileText, PrinterIcon,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion, AnimatePresence } from 'motion/react';
import type { UserRole } from './login';
import { projectId, publicAnonKey } from '../lib/supabase-info';
import { getToken, appendGhostParam } from '../lib/api';
import { bizDateStr } from '../lib/date';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;
const SAYFA_BOYUTU = 10;

// Türkçe → ASCII (jsPDF helvetica Türkçe karakter desteklemez)
function tr(s: any): string {
  if (typeof s === 'number') return String(s);
  if (typeof s !== 'string') return String(s ?? '');
  return s
    .replace(/₺/g,'TL ').replace(/—/g,'-').replace(/–/g,'-')
    .replace(/ğ/g,'g').replace(/Ğ/g,'G')
    .replace(/ü/g,'u').replace(/Ü/g,'U')
    .replace(/ş/g,'s').replace(/Ş/g,'S')
    .replace(/ı/g,'i').replace(/İ/g,'I')
    .replace(/ö/g,'o').replace(/Ö/g,'O')
    .replace(/ç/g,'c').replace(/Ç/g,'C');
}
const trRow = (row: any[]): any[] => row.map((c: any) => typeof c === 'number' ? c : tr(String(c)));

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
  gunlukMaas?: number;
}

interface YaziciSayac {
  ad: string;
  baslangic: number;
  bitis: number;
  ribonDegisim: number;
  iadeFotograf: number;
  kullanilanBaski: number;
  cikisAdedi: number;
  satilanFotograf: number;
  kagitTipiAdi?: string | null;
  kapasitePerTakim?: number;
  birimMaliyet?: number;
  yaziciMaliyet?: number;
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
  personelMaasGideri?: number;
  mekanGunlukKira: number;
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

  const oT = v.nakitToplamTL + v.ibanToplamTL + v.krediToplamTL;

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full rounded-2xl text-left transition-all"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: v.anomaliler.length > 0 ? '1px solid rgba(251,146,60,0.25)' : '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden', cursor: 'pointer', marginBottom: 10,
        position: 'relative',
      }}
    >
      {/* Silme butonu — sadece yönetici */}
      {canDelete && (
        <button
          onClick={e => { e.stopPropagation(); onSilTalep(v); }}
          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-xl flex items-center justify-center transition-all active:scale-90"
          style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', zIndex: 2 }}
        >
          <Trash2 style={{ width: 12, height: 12, color: '#f87171' }} />
        </button>
      )}

      {/* Üst bant — mekan + bilgi + ciro */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <div>
          <div className="flex items-center gap-2 mb-0.5" style={{ paddingRight: canDelete ? 28 : 0 }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>{v.mekanEmoji}</span>
            <p className="text-[14px] font-black text-white leading-tight">{v.mekan}</p>
            {v.anomaliler.length > 0 && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.3)' }}>
                <AlertTriangle style={{ width: 9, height: 9, color: '#fb923c' }} />
                <span style={{ fontSize: 9, color: '#fb923c', fontWeight: 700 }}>{v.anomaliler.length} anomali</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {formatTarih(v.tarih)} · {v.acilisSaat}–{v.kapanisSaat}
            </span>
          </div>
        </div>
        <div className="text-right flex-shrink-0" style={{ paddingRight: canDelete ? 30 : 0 }}>
          {iskOran && (
            <div className="flex items-center justify-end gap-1 mb-1.5">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.28)' }}>
                <span style={{ fontSize: 10, color: '#fb923c', fontWeight: 600 }}>İsk</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>|</span>
                <span style={{ fontSize: 10, color: '#fb923c', fontWeight: 700 }}>-{tl(v.toplamIskonto)}</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>|</span>
                <span style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700 }}>%{iskOran}</span>
              </div>
            </div>
          )}
          <p className="text-[18px] font-black leading-tight" style={{ color: '#a78bfa' }}>
            {tl(v.toplamCiro)}
          </p>
        </div>
      </div>

      {/* Ödeme dağılımı çubuğu */}
      {oT > 0 && (
        <div className="px-4 pb-2">
          <div className="flex rounded-full overflow-hidden" style={{ height: 4, background: 'rgba(255,255,255,0.06)' }}>
            {v.nakitToplamTL > 0 && <div style={{ width: `${(v.nakitToplamTL / oT) * 100}%`, background: '#34d399' }} />}
            {v.ibanToplamTL > 0 && <div style={{ width: `${(v.ibanToplamTL / oT) * 100}%`, background: '#60a5fa' }} />}
            {v.krediToplamTL > 0 && <div style={{ width: `${(v.krediToplamTL / oT) * 100}%`, background: '#f472b6' }} />}
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            {v.nakitToplamTL > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-[8px] font-semibold" style={{ color: 'rgba(52,211,153,0.6)' }}>Nakit</span>
                <span className="text-[9px] font-bold" style={{ color: '#34d399' }}>{tl(v.nakitToplamTL)}</span>
              </div>
            )}
            {v.ibanToplamTL > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-[8px] font-semibold" style={{ color: 'rgba(96,165,250,0.6)' }}>IBAN</span>
                <span className="text-[9px] font-bold" style={{ color: '#60a5fa' }}>{tl(v.ibanToplamTL)}</span>
              </div>
            )}
            {v.krediToplamTL > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-[8px] font-semibold" style={{ color: 'rgba(244,114,182,0.6)' }}>Kredi Kartı</span>
                <span className="text-[9px] font-bold" style={{ color: '#f472b6' }}>{tl(v.krediToplamTL)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Alt bant — personeller + ok */}
      {v.personeller.length > 0 && (() => {
        const toplamKare = v.personeller.reduce((s, pp) => s + pp.kare, 0);
        return (
          <div className="flex items-center justify-between px-4 py-2.5"
            style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex gap-1.5 flex-wrap flex-1 min-w-0">
              {v.personeller.map(p => {
                const ciroYuzde = v.toplamCiro > 0 ? (p.toplamTL / v.toplamCiro) * 100 : 0;
                const kareYuzde = toplamKare > 0 ? (p.kare / toplamKare) * 100 : 0;
                const mekanKatkisi = Math.round(ciroYuzde * 0.60 + kareYuzde * 0.40);
                return (
                  <span key={p.id} className="text-[9px] font-semibold px-2 py-0.5 rounded-full truncate"
                    style={{ background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.15)', color: 'rgba(255,255,255,0.5)', maxWidth: 120 }}>
                    {p.avatar} {p.ad.split(' ')[0]} <span style={{ color: '#818cf8', fontWeight: 700 }}>%{mekanKatkisi}</span>
                  </span>
                );
              })}
            </div>
            <ChevronRight style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
          </div>
        );
      })()}
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

  /* ───── Export helpers ───── */
  const dosyaAdi = `${v.mekan.replace(/\s+/g, '_')}_${v.tarih}`;

  function handleExcel() {
    const toplamPrim = v.primBilgi?.toplamPrim || 0;
    const toplamMaliyet = v.albumMaliyeti + v.baskiMaliyeti + toplamPrim + v.mekanGunlukKira + (v.personelMaasGideri || 0);
    const brutKar = v.toplamCiro - toplamMaliyet;

    /* Sayfa 1 — Genel Özet */
    const ozet = [
      ['Alan', 'Değer'],
      ['Mekan', v.mekan],
      ['Tarih', v.tarih],
      ['Açılış', v.acilisSaat],
      ['Kapanış', v.kapanisSaat],
      ['Print Tipi', v.printType === 'yarim' ? 'Yarım Boy' : v.printType === 'tam' ? 'Tam Boy' : '-'],
      [],
      ['CIRO & MALİYET', ''],
      ['Toplam Ciro (₺)', v.toplamCiro],
      ['  Nakit (₺)', v.nakitToplamTL],
      ['  IBAN (₺)', v.ibanToplamTL],
      ['  Kredi (₺)', v.krediToplamTL],
      ['Toplam İskonto (₺)', v.toplamIskonto],
      ['Albüm Maliyeti (₺)', v.albumMaliyeti],
      ['Baskı Maliyeti (₺)', v.baskiMaliyeti],
      ['Hakediş Toplamı (₺)', toplamPrim],
      ['Mekan Kirası (₺)', v.mekanGunlukKira],
      ['Toplam Maliyet (₺)', toplamMaliyet],
      ['Brüt Kâr (₺)', brutKar],
      [],
      ['STOK', ''],
      ['Stok Açılış', v.stokBaslangic],
      ['Stok Kapanış', v.stokBitis],
    ];

    /* Sayfa 2 — Personel */
    const personelBaslik = ['Ad', 'Kare', 'Nakit (₺)', 'IBAN (₺)', 'Kredi (₺)', 'Toplam (₺)', 'İskonto (₺)'];
    const personelRows = v.personeller.map(p => {
      const satirToplam = p.satirlar.reduce((s, sr) => s + sr.toplamTL, 0);
      const iskonto = Math.round(satirToplam - p.toplamTL);
      return [p.ad, p.kare, p.nakitTL, p.ibanTL, p.krediTL, p.toplamTL, iskonto];
    });

    /* Sayfa 3 — Yazıcı */
    const yaziciBaslik = ['Yazıcı', 'Açılış', 'Kapanış', 'Kullanılan Baskı', 'Çıkış Adedi (kare)', 'Ribon Değişimi'];
    const yaziciRows = v.yazicilar.map(y => [y.ad, y.baslangic, y.bitis, y.kullanilanBaski, y.cikisAdedi, y.ribonDegisim]);

    /* Sayfa 4 — Albüm */
    const albumRows = Object.entries(v.albumler).map(([urun, adet]) => [urun, adet]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ozet), 'Ozet');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([personelBaslik, ...personelRows]), 'Personel');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([yaziciBaslik, ...yaziciRows]), 'Yazicilar');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Urun', 'Adet'], ...albumRows]), 'Album');
    XLSX.writeFile(wb, `${dosyaAdi}.xlsx`);
  }

  function handlePDF() {
    const toplamPrim = v.primBilgi?.toplamPrim || 0;
    const toplamMaliyet = v.albumMaliyeti + v.baskiMaliyeti + toplamPrim + v.mekanGunlukKira + (v.personelMaasGideri || 0);
    const brutKar = v.toplamCiro - toplamMaliyet;

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const aksan = [100, 180, 220] as [number, number, number];
    const koyu  = [15, 8, 35]  as [number, number, number];

    // Başlık bandı
    doc.setFillColor(...koyu);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(tr(`${v.mekan} — Vardiya Raporu`), 14, 12);
    doc.setFontSize(9);
    doc.setTextColor(180, 180, 200);
    doc.setFont('helvetica', 'normal');
    doc.text(tr(`Tarih: ${v.tarih}   Acilis: ${v.acilisSaat}   Kapanis: ${v.kapanisSaat}   Print: ${v.printType === 'yarim' ? 'Yarim Boy' : 'Tam Boy'}`), 14, 20);

    let y = 34;

    // Ciro & Maliyet
    autoTable(doc, {
      startY: y,
      head: [[tr('Alan'), tr('Tutar')]],
      body: [
        [tr('Toplam Ciro'), `${Math.round(v.toplamCiro).toLocaleString('tr-TR')} TL`],
        [tr('  Nakit'), `${Math.round(v.nakitToplamTL).toLocaleString('tr-TR')} TL`],
        [tr('  IBAN'), `${Math.round(v.ibanToplamTL).toLocaleString('tr-TR')} TL`],
        [tr('  Kredi'), `${Math.round(v.krediToplamTL).toLocaleString('tr-TR')} TL`],
        [tr('Toplam Iskonto'), `${Math.round(v.toplamIskonto).toLocaleString('tr-TR')} TL`],
        [tr('Album Maliyeti'), `${Math.round(v.albumMaliyeti).toLocaleString('tr-TR')} TL`],
        [tr('Baski Maliyeti'), `${Math.round(v.baskiMaliyeti).toLocaleString('tr-TR')} TL`],
        [tr('Hakedis Toplami'), `${Math.round(toplamPrim).toLocaleString('tr-TR')} TL`],
        [tr('Mekan Kirasi'), `${Math.round(v.mekanGunlukKira).toLocaleString('tr-TR')} TL`],
        [tr('Toplam Maliyet'), `${Math.round(toplamMaliyet).toLocaleString('tr-TR')} TL`],
        [tr('Brut Kar'), `${Math.round(brutKar).toLocaleString('tr-TR')} TL`],
      ],
      headStyles: { fillColor: aksan, textColor: [255,255,255], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [40, 30, 60] },
      alternateRowStyles: { fillColor: [240, 235, 255] },
      margin: { left: 14, right: 14 },
    });

    // @ts-ignore
    y = (doc as any).lastAutoTable?.finalY + 8 || y + 80;

    // Personel tablosu
    if (v.personeller.length > 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...koyu);
      doc.text(tr('Personel Detayi'), 14, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [[tr('Ad'), tr('Kare'), tr('Nakit'), tr('IBAN'), tr('Kredi'), tr('Toplam'), tr('Iskonto')]],
        body: v.personeller.map(p => {
          const st = p.satirlar.reduce((s, sr) => s + sr.toplamTL, 0);
          const isk = Math.round(st - p.toplamTL);
          return [
            tr(p.ad), p.kare,
            `${Math.round(p.nakitTL).toLocaleString('tr-TR')} TL`,
            `${Math.round(p.ibanTL).toLocaleString('tr-TR')} TL`,
            `${Math.round(p.krediTL).toLocaleString('tr-TR')} TL`,
            `${Math.round(p.toplamTL).toLocaleString('tr-TR')} TL`,
            isk > 0 ? `${isk.toLocaleString('tr-TR')} TL` : '—',
          ];
        }),
        headStyles: { fillColor: [120, 80, 200], textColor: [255,255,255], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8, textColor: [40, 30, 60] },
        alternateRowStyles: { fillColor: [245, 240, 255] },
        margin: { left: 14, right: 14 },
      });
      // @ts-ignore
      y = (doc as any).lastAutoTable?.finalY + 8 || y + 40;
    }

    // Yazıcı tablosu
    if (v.yazicilar.length > 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...koyu);
      doc.text(tr('Yazici Sayaclari'), 14, y);
      y += 4;
      autoTable(doc, {
        startY: y,
        head: [[tr('Yazici'), tr('Acilis'), tr('Kapanis'), tr('Kullanilan Baski'), tr('Cikis (kare)'), tr('Ribon')]],
        body: v.yazicilar.map(y2 => [
          tr(y2.ad), y2.baslangic, y2.bitis, y2.kullanilanBaski, y2.cikisAdedi,
          y2.ribonDegisim > 0 ? `${y2.ribonDegisim} takim` : '—',
        ]),
        headStyles: { fillColor: aksan, textColor: [255,255,255], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8, textColor: [40, 30, 60] },
        alternateRowStyles: { fillColor: [235, 248, 255] },
        margin: { left: 14, right: 14 },
      });
    }

    doc.save(`${dosyaAdi}.pdf`);
  }

  function handleYazdir() {
    window.print();
  }

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

      {/* ── Vardiya Ciro & Kâr/Zarar ── */}
      {(() => {
        const toplamPrim = v.primBilgi?.toplamPrim || 0;
        const personelMaas = v.personelMaasGideri || 0;
        const toplamMaliyet = v.albumMaliyeti + v.baskiMaliyeti + toplamPrim + v.mekanGunlukKira + personelMaas;
        const brutKar = v.toplamCiro - toplamMaliyet;
        return (
          <div style={{ ...sectionStyle, background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.14)' }}>
            <p style={labelStyle}>
              <TrendingUp style={{ width: 10, height: 10, display: 'inline', marginRight: 4 }} />
              Vardiya Ciro & Kâr/Zarar
            </p>

            {/* Nakit / IBAN / Kredi */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: 'Nakit', val: v.nakitToplamTL, color: '#34d399', Icon: Banknote   },
                { label: 'IBAN',  val: v.ibanToplamTL,  color: '#60a5fa', Icon: Wallet     },
                { label: 'Kredi', val: v.krediToplamTL, color: '#f472b6', Icon: CreditCard },
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

            {/* ── Maliyet & Kâr/Zarar özeti ── */}
            {toplamMaliyet > 0 && (
              <>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', margin: '12px 0 10px' }} />
                <div className="space-y-2">
                  {v.albumMaliyeti > 0 && (
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Albüm Maliyeti</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#f87171' }}>-{tl(v.albumMaliyeti)}</span>
                    </div>
                  )}
                  {v.baskiMaliyeti > 0 && (
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Baskı Maliyeti</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#f87171' }}>-{tl(v.baskiMaliyeti)}</span>
                    </div>
                  )}
                  {toplamPrim > 0 && (
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Hakediş Gideri</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa' }}>-{tl(toplamPrim)}</span>
                    </div>
                  )}
                  {personelMaas > 0 && (
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Personel Maaşları</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#fb923c' }}>-{tl(personelMaas)}</span>
                    </div>
                  )}
                  {v.mekanGunlukKira > 0 && (
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Mekan Kirası (günlük)</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#ffd4a3' }}>-{tl(v.mekanGunlukKira)}</span>
                    </div>
                  )}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>Toplam Maliyet</span>
                    <span style={{ fontSize: 15, fontWeight: 900, color: '#f87171' }}>-{tl(toplamMaliyet)}</span>
                  </div>
                  {v.toplamCiro > 0 && (
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>Brüt Kâr (ürün bazlı)</span>
                      <span style={{ fontSize: 15, fontWeight: 900, color: brutKar >= 0 ? '#34d399' : '#f87171' }}>{tl(brutKar)}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* ── BLOK 1: Albüm ── */}
      <div style={sectionStyle}>
        <p style={labelStyle}>
          <Package style={{ width: 10, height: 10, display: 'inline', marginRight: 4 }} />
          Albüm
        </p>

        {Object.keys(v.albumler).length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-3">
            {Object.entries(v.albumler).map(([urun, adet]) => (
              <div key={urun} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '6px 12px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{urun}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.9)' }}>×{adet}</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>Albüm satışı yok</p>
        )}

        <div className="flex items-center justify-between">
          <div>
            <p style={labelStyle}>Albüm Maliyeti</p>
            <p style={{ ...valStyle, color: '#f87171' }}>{tl(v.albumMaliyeti)}</p>
          </div>
          {v.printType && (
            <span style={{
              fontSize: 10, padding: '3px 10px', borderRadius: 20,
              background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.28)',
              color: '#a78bfa', fontWeight: 700,
            }}>
              {v.printType === 'tam' ? 'Tam Boy' : 'Yarım Boy'}
            </span>
          )}
        </div>
      </div>

      {/* ── BLOK 2: Baskı Maliyet (Yazıcı Sayaçları + Baskı özeti) ── */}
      <div style={sectionStyle}>
        <p style={labelStyle}>
          <Printer style={{ width: 10, height: 10, display: 'inline', marginRight: 4 }} />
          Baskı Maliyet
        </p>
        {(() => {
          const kullanilanBaskiToplam = v.yazicilar.reduce((s, y) => s + y.kullanilanBaski, 0);
          const cikisAdediToplam = v.yazicilar.reduce((s, y) => s + y.cikisAdedi, 0);
          return (
            <>
              {/* Yazıcı sayaç kartları */}
              {v.yazicilar.length > 0 && (
                <div className="space-y-2 mb-3">
                  {v.yazicilar.map((y, i) => (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>{y.ad}</p>
                        {y.kagitTipiAdi && (
                          <span style={{ fontSize: 9, color: '#9dd9ea', background: 'rgba(157,217,234,0.12)', border: '1px solid rgba(157,217,234,0.25)', borderRadius: 6, padding: '2px 6px', fontWeight: 700 }}>
                            🗂️ {y.kagitTipiAdi}
                          </span>
                        )}
                      </div>
                      {/* Kapasite bilgisi (kağıt tipi bağlıysa) */}
                      {y.kapasitePerTakim && y.kapasitePerTakim > 0 ? (
                        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginBottom: 8 }}>
                          {y.kapasitePerTakim} baskı/takım · {v.printType === 'yarim' ? `${y.kapasitePerTakim * 2} kare/takım (yarım)` : `${y.kapasitePerTakim} kare/takım (tam)`}
                        </p>
                      ) : null}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <p style={labelStyle}>Açılış Sayacı</p>
                          <p style={{ ...valStyle, fontSize: 13 }}>{y.baslangic.toLocaleString('tr-TR')}</p>
                        </div>
                        <div>
                          <p style={labelStyle}>Kapanış Sayacı</p>
                          <p style={{ ...valStyle, fontSize: 13 }}>{y.bitis.toLocaleString('tr-TR')}</p>
                        </div>
                        <div>
                          <p style={labelStyle}>Ribon Değişimi</p>
                          <p style={{ ...valStyle, fontSize: 13, color: y.ribonDegisim > 0 ? '#fbbf24' : 'rgba(255,255,255,0.55)' }}>
                            {y.ribonDegisim > 0 ? `${y.ribonDegisim} takım` : '—'}
                          </p>
                        </div>
                      </div>
                      {/* Toplam basılan fotoğraf: cikisAdedi çıkan kare sayısı; etiket printType'a göre dinamik */}
                      <div style={{ marginTop: 8, background: 'rgba(157,217,234,0.08)', border: '1px solid rgba(157,217,234,0.18)', borderRadius: 8, padding: '7px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <span style={{ fontSize: 10, color: 'rgba(157,217,234,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Toplam Basılan Fotoğraf</span>
                          {v.printType && (
                            <span style={{ fontSize: 9, color: 'rgba(157,217,234,0.45)', fontWeight: 600 }}>
                              {v.printType === 'yarim' ? 'Yarım Boy' : 'Tam Boy'}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 900, color: '#9dd9ea' }}>{y.cikisAdedi.toLocaleString('tr-TR')} kare</span>
                      </div>
                      {/* Per-printer baskı maliyeti (yeni field varsa göster) */}
                      {y.yaziciMaliyet != null && y.yaziciMaliyet > 0 && (
                        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 10, color: 'rgba(248,113,113,0.7)' }}>Bu yazıcı baskı maliyeti</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#f87171' }}>-₺{Math.round(y.yaziciMaliyet).toLocaleString('tr-TR')}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Ayırıcı */}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 12 }} />

              {/* Fotoğraf özet grid: Toplam Basılan | Satılan | İade */}
              {(() => {
                const iadeFotografToplam = v.yazicilar.reduce((s, y) => s + ((y as any).iadeFotograf || 0), 0);
                const satilanFotografToplam = Math.max(0, cikisAdediToplam - iadeFotografToplam);
                return (
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div style={{ background: 'rgba(157,217,234,0.07)', borderRadius: 10, padding: '10px 10px', border: '1px solid rgba(157,217,234,0.15)' }}>
                      <p style={labelStyle}>Toplam Basılan</p>
                      <p style={{ ...valStyle, color: '#9dd9ea' }}>{cikisAdediToplam.toLocaleString('tr-TR')}</p>
                      {v.printType && (
                        <p style={{ fontSize: 9, color: 'rgba(157,217,234,0.5)', marginTop: 2 }}>{v.printType === 'yarim' ? 'Yarım Boy' : 'Tam Boy'}</p>
                      )}
                    </div>
                    <div style={{ background: 'rgba(74,222,128,0.07)', borderRadius: 10, padding: '10px 10px', border: '1px solid rgba(74,222,128,0.15)' }}>
                      <p style={labelStyle}>Satılan</p>
                      <p style={{ ...valStyle, color: '#4ade80' }}>{satilanFotografToplam.toLocaleString('tr-TR')}</p>
                      <p style={{ fontSize: 9, color: 'rgba(74,222,128,0.5)', marginTop: 2 }}>kare</p>
                    </div>
                    <div style={{ background: 'rgba(248,113,113,0.07)', borderRadius: 10, padding: '10px 10px', border: '1px solid rgba(248,113,113,0.15)' }}>
                      <p style={labelStyle}>İade</p>
                      <p style={{ ...valStyle, color: '#f87171' }}>{iadeFotografToplam.toLocaleString('tr-TR')}</p>
                      <p style={{ fontSize: 9, color: 'rgba(248,113,113,0.5)', marginTop: 2 }}>kare</p>
                    </div>
                  </div>
                );
              })()}

              {/* Özet grid: 3 kolon — kullanilanBaski (fiziksel tam boy kağıt), kağıt tipi, personel çekimi */}
              {(() => {
                const personelKareToplam = v.personeller.reduce((s, p) => s + p.kare, 0);
                return (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div style={{ background: 'rgba(157,217,234,0.07)', borderRadius: 10, padding: '10px 10px', border: '1px solid rgba(157,217,234,0.15)' }}>
                      <p style={labelStyle}>Kullanılan Baskı</p>
                      <p style={{ ...valStyle, color: '#9dd9ea' }}>{kullanilanBaskiToplam.toLocaleString('tr-TR')}</p>
                      <p style={{ fontSize: 9, color: 'rgba(157,217,234,0.5)', marginTop: 2 }}>Tam Boy Baskı</p>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 10px', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <p style={labelStyle}>Kağıt Tipi</p>
                      <p style={{ ...valStyle, fontSize: 12 }}>{v.baskiPaperName || '—'}</p>
                    </div>
                    <div style={{ background: 'rgba(167,199,231,0.07)', borderRadius: 10, padding: '10px 10px', border: '1px solid rgba(167,199,231,0.15)' }}>
                      <p style={labelStyle}>Personel Çekimi</p>
                      <p style={{ ...valStyle, color: '#a7c7e7' }}>{personelKareToplam.toLocaleString('tr-TR')}</p>
                      <p style={{ fontSize: 9, color: 'rgba(167,199,231,0.5)', marginTop: 2 }}>kare</p>
                    </div>
                  </div>
                );
              })()}
              <div className="flex items-center justify-between px-1">
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Baskı Maliyeti</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#f87171' }}>-{tl(v.baskiMaliyeti)}</span>
              </div>
            </>
          );
        })()}
      </div>

      {/* ── BLOK 3: Hakediş ── */}
      {(v.personeller.length > 0 || (v.kotaKademeleri || []).length > 0) && (() => {
        const KADEME_COLORS = ['#60a5fa', '#a855f7', '#fbbf24', '#34d399', '#f87171', '#fb923c'];
        const kkList = v.kotaKademeleri || [];
        const pb = v.primBilgi;
        const hasPrim = !!pb;
        const kisiBasiPrim = pb ? pb.topKademePrim : 0;
        const toplamPrim = pb ? pb.toplamPrim : 0;
        const kotaDurumlari = kkList.map((k: any, i: number) => ({
          index: i, hedef: k.hedef,
          reached: v.toplamCiro >= k.hedef,
          color: KADEME_COLORS[Math.min(i, 5)],
        }));
        const ilkKota = kkList[0];
        const ilkFark = ilkKota ? (ilkKota.hedef - v.toplamCiro) : 0;
        return (
          <div style={{
            ...sectionStyle,
            background: hasPrim ? 'rgba(167,139,250,0.07)' : 'rgba(255,255,255,0.04)',
            border: hasPrim ? '1px solid rgba(167,139,250,0.22)' : '1px solid rgba(255,255,255,0.08)',
          }}>
            {/* Başlık */}
            <div className="flex items-center gap-2 mb-3">
              <Trophy style={{ width: 10, height: 10, color: hasPrim ? '#a78bfa' : 'rgba(255,255,255,0.3)' }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: hasPrim ? '#a78bfa' : 'rgba(255,255,255,0.35)', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>
                Hakediş{hasPrim ? ' — 🏆 Kazanıldı!' : ''}
              </span>
            </div>

            {/* Personel listesi — her zaman */}
            {v.personeller.length > 0 && (
              <div style={{
                background: 'rgba(255,255,255,0.03)', borderRadius: 10,
                padding: '8px 10px', border: '1px solid rgba(255,255,255,0.06)',
                marginBottom: 10,
              }}>
                <div className="space-y-2">
                  {v.personeller.map(p => (
                    <div key={p.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div style={{
                          width: 26, height: 26, borderRadius: 8,
                          background: hasPrim ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.06)',
                          border: hasPrim ? '1px solid rgba(167,139,250,0.28)' : '1px solid rgba(255,255,255,0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                        }}>
                          {p.avatar}
                        </div>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{p.ad}</span>
                      </div>
                      {hasPrim
                        ? <span style={{ fontSize: 13, fontWeight: 800, color: '#a78bfa' }}>{tl(kisiBasiPrim)}</span>
                        : <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontWeight: 600 }}>—</span>
                      }
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Hakediş VAR → kota durumları */}
            {hasPrim && kkList.length > 0 && (
              <div className="space-y-1.5" style={{ marginBottom: 10 }}>
                {kotaDurumlari.map(k => (
                  <div key={k.index} className="flex items-center justify-between">
                    {k.reached ? (
                      <>
                        <div className="flex items-center gap-1.5">
                          <span style={{ fontSize: 13, color: k.color, fontWeight: 900 }}>✓</span>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>{k.index + 1}. Kota Aşıldı</span>
                        </div>
                        <span style={{ fontSize: 10, color: k.color, fontWeight: 700 }}>{tl(k.hedef)}</span>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5">
                          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', fontWeight: 900 }}>○</span>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                            {k.index + 1}. Kotaya {tl(k.hedef - v.toplamCiro)} kaldı
                          </span>
                        </div>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontWeight: 600 }}>{tl(k.hedef)}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Hakediş VAR → toplam */}
            {hasPrim && (
              <div style={{ borderTop: '1px solid rgba(167,139,250,0.15)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Toplam Hakediş</span>
                <span style={{ fontSize: 16, fontWeight: 900, color: '#a78bfa' }}>{tl(toplamPrim)}</span>
              </div>
            )}

            {/* Hakediş YOK → ilk kotaya kalan */}
            {!hasPrim && ilkKota && ilkFark > 0 && (
              <div className="flex items-center gap-2">
                <Trophy style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.2)' }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
                  1. Hakediş kotasına {tl(ilkFark)} eksik kaldı
                </span>
              </div>
            )}
          </div>
        );
      })()}


      {/* ── Personel Detayı ── */}
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
                    {(() => {
                      const satirToplam = p.satirlar.reduce((s, sr) => s + sr.toplamTL, 0);
                      const iskonto = Math.round(satirToplam - p.toplamTL);
                      const isktPct = satirToplam > 0 ? Math.round((iskonto / satirToplam) * 100) : 0;
                      if (iskonto > 0) {
                        return (
                          <p style={{ fontSize: 10, color: '#fb923c', fontWeight: 700 }}>
                            -{tl(iskonto)} <span style={{ opacity: 0.7 }}>(%{isktPct})</span>
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>

                {/* Ödeme dağılımı */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: 'Nakit', val: p.nakitTL, color: '#34d399', Icon: Banknote   },
                    { label: 'IBAN',  val: p.ibanTL,  color: '#60a5fa', Icon: Wallet     },
                    { label: 'Kredi', val: p.krediTL, color: '#f472b6', Icon: CreditCard },
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

                {/* Personel katkı ve kazanç */}
                {(() => {
                  const personelKareToplam = v.personeller.reduce((s, pp) => s + pp.kare, 0);
                  const ciroYuzde = v.toplamCiro > 0 ? (p.toplamTL / v.toplamCiro) * 100 : 0;
                  const kareYuzde = personelKareToplam > 0 ? (p.kare / personelKareToplam) * 100 : 0;
                  const mekanKatkisi = ciroYuzde * 0.60 + kareYuzde * 0.40;
                  const prim = v.primBilgi?.topKademePrim || 0;
                  const maas = p.gunlukMaas || 0;
                  const personelKazanc = maas + prim;
                  return (
                    <>
                      {/* Ayırıcı */}
                      <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '10px 0' }} />

                      {/* 4 blok: Maaş, Hakediş, Ciro Katkısı, Kare Katkısı */}
                      <div className="grid grid-cols-4 gap-1.5">
                        <div style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)', borderRadius: 8, padding: '6px 8px' }}>
                          <p style={{ fontSize: 8, color: 'rgba(251,146,60,0.7)', fontWeight: 600, marginBottom: 2 }}>GÜNLÜK MAAŞ</p>
                          <p style={{ fontSize: 11, fontWeight: 800, color: '#fb923c' }}>{maas > 0 ? tl(maas) : '—'}</p>
                        </div>
                        <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8, padding: '6px 8px' }}>
                          <p style={{ fontSize: 8, color: 'rgba(251,191,36,0.7)', fontWeight: 600, marginBottom: 2 }}>HAKEDİŞ</p>
                          <p style={{ fontSize: 11, fontWeight: 800, color: '#fbbf24' }}>{prim > 0 ? tl(prim) : '—'}</p>
                        </div>
                        <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 8, padding: '6px 8px' }}>
                          <p style={{ fontSize: 8, color: 'rgba(52,211,153,0.7)', fontWeight: 600, marginBottom: 2 }}>CİRO KATKISI</p>
                          <p style={{ fontSize: 11, fontWeight: 800, color: '#34d399' }}>%{ciroYuzde.toFixed(0)}</p>
                        </div>
                        <div style={{ background: 'rgba(157,217,234,0.08)', border: '1px solid rgba(157,217,234,0.2)', borderRadius: 8, padding: '6px 8px' }}>
                          <p style={{ fontSize: 8, color: 'rgba(157,217,234,0.7)', fontWeight: 600, marginBottom: 2 }}>KARE KATKISI</p>
                          <p style={{ fontSize: 11, fontWeight: 800, color: '#9dd9ea' }}>%{kareYuzde.toFixed(0)}</p>
                        </div>
                      </div>

                      {/* 2 blok: Personel Kazanç, Mekan Katkısı */}
                      <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                        <div style={{ background: 'rgba(251,146,60,0.05)', border: '1px solid rgba(251,146,60,0.15)', borderRadius: 8, padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>Personel Kazanç</span>
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#fb923c' }}>{personelKazanc > 0 ? tl(personelKazanc) : '—'}</span>
                        </div>
                        <div style={{ background: 'rgba(157,217,234,0.05)', border: '1px solid rgba(157,217,234,0.15)', borderRadius: 8, padding: '6px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>Mekan Katkısı</span>
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#9dd9ea' }}>%{mekanKatkisi.toFixed(0)}</span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Export Butonları ── */}
      <div style={{ marginTop: 6, marginBottom: 24 }}>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, textAlign: 'center' }}>
          Dışa Aktar
        </p>
        <div className="grid grid-cols-3 gap-3">
          {/* Yazdır */}
          <button
            onClick={handleYazdir}
            className="flex flex-col items-center gap-2 py-4 rounded-2xl transition-all active:scale-95"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <PrinterIcon style={{ width: 18, height: 18, color: 'rgba(255,255,255,0.7)' }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>Yazdır</span>
          </button>

          {/* Excel */}
          <button
            onClick={handleExcel}
            className="flex flex-col items-center gap-2 py-4 rounded-2xl transition-all active:scale-95"
            style={{
              background: 'rgba(52,211,153,0.08)',
              border: '1px solid rgba(52,211,153,0.2)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.12)' }}>
              <FileSpreadsheet style={{ width: 18, height: 18, color: '#34d399' }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#34d399' }}>Excel</span>
          </button>

          {/* PDF */}
          <button
            onClick={handlePDF}
            className="flex flex-col items-center gap-2 py-4 rounded-2xl transition-all active:scale-95"
            style={{
              background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.2)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(248,113,113,0.12)' }}>
              <FileText style={{ width: 18, height: 18, color: '#f87171' }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#f87171' }}>PDF</span>
          </button>
        </div>
      </div>

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
  const [aktifSekme, setAktifSekme] = useState<'vardiya' | 'gun'>('vardiya');
  const [raporlar, setRaporlar] = useState<VardiyaKayit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seciliId, setSeciliId] = useState<string | null>(null);

  // Gün raporu state
  const [gunTarihBas, setGunTarihBas] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [gunTarihBit, setGunTarihBit] = useState(() => bizDateStr());
  const GUN_SAYFA_BOYUTU = 7;
  const [gunListe, setGunListe] = useState<any[]>([]);
  const [gunGorunenAdet, setGunGorunenAdet] = useState(GUN_SAYFA_BOYUTU);
  const [gunSecili, setGunSecili] = useState<string | null>(null);
  const [gunDetay, setGunDetay] = useState<any>(null);
  const [gunLoading, setGunLoading] = useState(false);
  const [gunError, setGunError] = useState<string | null>(null);
  const [gunDetayLoading, setGunDetayLoading] = useState(false);

  // Gün listesini çek (tarih aralığı)
  const fetchGunListesi = useCallback(async (bas: string, bit: string) => {
    setGunLoading(true);
    setGunError(null);
    setGunSecili(null);
    setGunDetay(null);
    setGunGorunenAdet(GUN_SAYFA_BOYUTU);
    try {
      const token = await getToken();
      const res = await fetch(appendGhostParam(`${API_BASE}/vardiya/gun-raporu?baslangic=${bas}&bitis=${bit}`), {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}`, 'X-Access-Token': token },
      });
      const data = await res.json();
      if (!res.ok) { setGunError(data.error || `HTTP ${res.status}`); return; }
      setGunListe(data.gunler || []);
    } catch (e) {
      setGunError('Sunucuya bağlanılamadı.');
    } finally {
      setGunLoading(false);
    }
  }, []);

  // Tek gün detayını çek
  const fetchGunDetay = useCallback(async (tarih: string) => {
    setGunDetayLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(appendGhostParam(`${API_BASE}/vardiya/gun-raporu?tarih=${tarih}`), {
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}`, 'X-Access-Token': token },
      });
      const data = await res.json();
      if (res.ok) setGunDetay(data);
    } catch (e) { /* ignore */ }
    finally { setGunDetayLoading(false); }
  }, []);

  // ── Gün Bazlı Dışa Aktarım ──
  const handleGunExcel = () => {
    if (!gunDetay || gunDetay.bos) return;
    const d = gunDetay;
    const oz = d.ozet || {};
    const mal = d.maliyet || {};
    const tarihStr = formatTarih(d.tarih || gunSecili || '');
    const wb = XLSX.utils.book_new();

    // Sheet 1: Günlük Özet
    const brutCiro = (oz.toplamCiro || 0) + (oz.toplamIskonto || 0);
    const iskYuzde = brutCiro > 0 ? Math.round((oz.toplamIskonto / brutCiro) * 100) : 0;
    const nakit = (d.odemeler || []).find((o: any) => o.yontem === 'cash')?.ciro || 0;
    const iban = (d.odemeler || []).find((o: any) => o.yontem === 'iban')?.ciro || 0;
    const kredi = (d.odemeler || []).find((o: any) => o.yontem === 'card')?.ciro || 0;
    const s1 = XLSX.utils.aoa_to_sheet([
      ['GÜNLÜK OPERASYON RAPORU'],
      [], ['Tarih', tarihStr],
      ['Mekan Sayısı', `${oz.toplamMekan || 0} (${oz.acilanMekan || 0} açıldı / ${oz.kapananMekan || 0} kapandı)`],
      [], ['Toplam Ciro', oz.toplamCiro || 0],
      ['Brüt Ciro', brutCiro],
      ['İskonto', `${oz.toplamIskonto || 0} (%${iskYuzde})`],
      [], ['Nakit', nakit], ['IBAN', iban], ['Kredi Kartı', kredi],
      [], ['Toplam Kare', oz.toplamKare || 0],
      ['Basılan Fotoğraf', oz.toplamBasilanFotograf || 0],
      ['Satılan Fotoğraf', oz.toplamSatilanFotograf || 0],
      ['İade', oz.toplamIadeFotograf || 0],
      [], ['Baskı Maliyeti', mal.baskiMaliyeti || 0],
      ['Albüm Maliyeti', mal.albumMaliyeti || 0],
      ['Kira Gideri', mal.kiraGideri || 0],
      ['Maaş Gideri', mal.maasGideri || 0],
      ['Hakediş Gideri', mal.primGideri || 0],
      ['Toplam Maliyet', mal.toplamGider || 0],
      [], ['Kar/Zarar', mal.karZarar || 0],
      ['Kar Marjı', `%${mal.karMarji || 0}`],
    ]);
    XLSX.utils.book_append_sheet(wb, s1, 'Günlük Özet');

    // Sheet 2: Mekan Bazlı
    const mekanRows = (d.mekanlar || []).map((m: any) => {
      const mBrut = (m.ciro || 0) + (m.iskonto || 0);
      const mIskYuzde = mBrut > 0 ? Math.round((m.iskonto / mBrut) * 100) : 0;
      return [m.name, m.acilisSaat || '-', m.kapanisSaat || '-', m.ciro, m.satisAdet, m.iskonto, `%${mIskYuzde}`, m.gunlukKira];
    });
    const s2 = XLSX.utils.aoa_to_sheet([
      ['Mekan', 'Açılış', 'Kapanış', 'Ciro', 'Satış', 'İskonto', 'İsk %', 'Kira'],
      ...mekanRows,
    ]);
    XLSX.utils.book_append_sheet(wb, s2, 'Mekan Bazlı');

    // Sheet 3: Personel (Kazanç = Maaş + Hakediş)
    const perRows = (d.personeller || []).map((p: any) => {
      const kazanc = (p.gunlukMaas || 0) + (p.primToplam || 0);
      return [p.ad, (p.mekanlar || []).join(', '), p.ciro, p.kare, p.gunlukMaas, p.primToplam || 0, kazanc];
    });
    const perTopMaas = (d.personeller || []).reduce((s: number, p: any) => s + (p.gunlukMaas || 0), 0);
    const perTopPrim = (d.personeller || []).reduce((s: number, p: any) => s + (p.primToplam || 0), 0);
    const perTopCiro = (d.personeller || []).reduce((s: number, p: any) => s + (p.ciro || 0), 0);
    const perTopKare = (d.personeller || []).reduce((s: number, p: any) => s + (p.kare || 0), 0);
    const perTopKazanc = perTopMaas + perTopPrim;
    perRows.push(['TOPLAM', '', perTopCiro, perTopKare, perTopMaas, perTopPrim, perTopKazanc]);
    const s3 = XLSX.utils.aoa_to_sheet([
      ['Personel', 'Mekan', 'Ciro', 'Kare', 'Maaş', 'Hakediş', 'Kazanç'],
      ...perRows,
    ]);
    XLSX.utils.book_append_sheet(wb, s3, 'Personel');

    // Sheet 4: Baskı Özeti (mekan bazlı)
    const baskiRows = (d.mekanlar || []).filter((m: any) => (m.basilanFotograf || 0) > 0).map((m: any) => [
      m.name, m.basilanFotograf || 0, m.iadeFotograf || 0, m.netSatilanFotograf || 0, m.birimBaskiMaliyeti || 0, m.baskiMaliyeti || 0,
    ]);
    const bTopBasilan = (d.mekanlar || []).reduce((s: number, m: any) => s + (m.basilanFotograf || 0), 0);
    const bTopIade = (d.mekanlar || []).reduce((s: number, m: any) => s + (m.iadeFotograf || 0), 0);
    const bTopNet = (d.mekanlar || []).reduce((s: number, m: any) => s + (m.netSatilanFotograf || 0), 0);
    const bTopMaliyet = (d.mekanlar || []).reduce((s: number, m: any) => s + (m.baskiMaliyeti || 0), 0);
    baskiRows.push(['TOPLAM', bTopBasilan, bTopIade, bTopNet, '', bTopMaliyet]);
    const s4 = XLSX.utils.aoa_to_sheet([
      ['Mekan', 'Basılan', 'İade', 'Net Satılan', 'Birim Maliyet', 'Toplam Maliyet'],
      ...baskiRows,
    ]);
    XLSX.utils.book_append_sheet(wb, s4, 'Baskı Özeti');

    // Sheet 5: Ürün/Albüm Satışları
    const albumRows = (d.albumler || []).map((a: any) => [a.tip, a.adet, a.ciro]);
    const aTopAdet = (d.albumler || []).reduce((s: number, a: any) => s + (a.adet || 0), 0);
    const aTopCiro = (d.albumler || []).reduce((s: number, a: any) => s + (a.ciro || 0), 0);
    albumRows.push(['TOPLAM', aTopAdet, aTopCiro]);
    const s5 = XLSX.utils.aoa_to_sheet([
      ['Ürün', 'Adet', 'Ciro'],
      ...albumRows,
    ]);
    XLSX.utils.book_append_sheet(wb, s5, 'Ürün Satışları');

    // Sheet 6: Ödeme Dağılımı
    const odemeler = d.odemeler || [];
    const odemeToplam = odemeler.reduce((s: number, o: any) => s + (o.ciro || 0), 0);
    const odemeLabel: Record<string, string> = { cash: 'Nakit', iban: 'IBAN', card: 'Kredi Kartı', foreign: 'Döviz' };
    const odemeRows = odemeler.map((o: any) => {
      const oran = odemeToplam > 0 ? Math.round((o.ciro / odemeToplam) * 1000) / 10 : 0;
      return [odemeLabel[o.yontem] || o.yontem, o.ciro, `%${oran}`];
    });
    odemeRows.push(['TOPLAM', odemeToplam, '%100']);
    const s6 = XLSX.utils.aoa_to_sheet([
      ['Ödeme Yöntemi', 'Tutar', 'Oran'],
      ...odemeRows,
    ]);
    XLSX.utils.book_append_sheet(wb, s6, 'Ödeme Dağılımı');

    // Sheet 7: Anomaliler
    const anomaliler = d.anomaliler || [];
    if (anomaliler.length > 0) {
      const tipLabel = (t: string) => t === 'acilis' ? 'Açılış Stok' : t === 'kapanis' ? 'Kapanış Stok' : 'Yazıcı';
      const anomaliRows = anomaliler.map((a: any) => {
        const detayStr = a.detay ? (typeof a.detay === 'object' ? Object.entries(a.detay).map(([k, v]) => `${k}: ${Number(v) > 0 ? '+' : ''}${v}`).join(', ') : String(a.detay)) : '';
        return [a.mekan, tipLabel(a.tip), detayStr];
      });
      const s7 = XLSX.utils.aoa_to_sheet([['Mekan', 'Tip', 'Detay'], ...anomaliRows]);
      XLSX.utils.book_append_sheet(wb, s7, 'Anomaliler');
    }

    XLSX.writeFile(wb, `Gun_Raporu_${d.tarih || gunSecili || 'rapor'}.xlsx`);
  };

  const handleGunPDF = () => {
    if (!gunDetay || gunDetay.bos) return;
    const d = gunDetay;
    const oz = d.ozet || {};
    const mal = d.maliyet || {};
    const tarihStr = formatTarih(d.tarih || gunSecili || '');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    let y = 12;

    // Başlık
    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text(tr(`GUNLUK OPERASYON RAPORU - ${tarihStr}`), pw / 2, y, { align: 'center' });
    y += 8;

    const headStyle = { fillColor: [30, 20, 50] as [number, number, number], textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const, fontSize: 7 };
    const bodyStyle = { fontSize: 7 };

    // Sol: Günlük Özet | Sağ: Ödeme + Baskı
    const brutCiro = (oz.toplamCiro || 0) + (oz.toplamIskonto || 0);
    const iskYuzde = brutCiro > 0 ? Math.round((oz.toplamIskonto / brutCiro) * 100) : 0;
    const nakit = (d.odemeler || []).find((o: any) => o.yontem === 'cash')?.ciro || 0;
    const ibanV = (d.odemeler || []).find((o: any) => o.yontem === 'iban')?.ciro || 0;
    const krediV = (d.odemeler || []).find((o: any) => o.yontem === 'card')?.ciro || 0;

    // Sol tablo: Günlük Özet
    autoTable(doc, {
      startY: y, margin: { left: 10, right: pw / 2 + 2 },
      head: [[tr('Gunluk Ozet'), '']],
      body: [
        ['Mekan', `${oz.toplamMekan || 0} (${oz.acilanMekan || 0} ac. / ${oz.kapananMekan || 0} kap.)`],
        [tr('Toplam Ciro'), `TL ${(oz.toplamCiro || 0).toLocaleString('tr-TR')}`],
        [tr('Iskonto'), `TL ${(oz.toplamIskonto || 0).toLocaleString('tr-TR')} (%${iskYuzde})`],
        ['Toplam Kare', String(oz.toplamKare || 0)],
        [tr('Basilan / Satilan / Iade'), `${oz.toplamBasilanFotograf || 0} / ${oz.toplamSatilanFotograf || 0} / ${oz.toplamIadeFotograf || 0}`],
        [tr('Baski Maliyeti'), `TL ${(mal.baskiMaliyeti || 0).toLocaleString('tr-TR')}`],
        [tr('Album Maliyeti'), `TL ${(mal.albumMaliyeti || 0).toLocaleString('tr-TR')}`],
        [tr('Kira Gideri'), `TL ${(mal.kiraGideri || 0).toLocaleString('tr-TR')}`],
        [tr('Maas Gideri'), `TL ${(mal.maasGideri || 0).toLocaleString('tr-TR')}`],
        ['Hakedis Gideri', `TL ${(mal.primGideri || 0).toLocaleString('tr-TR')}`],
        [tr('Toplam Maliyet'), `TL ${(mal.toplamGider || 0).toLocaleString('tr-TR')}`],
        ['Kar/Zarar', `TL ${(mal.karZarar || 0).toLocaleString('tr-TR')} (%${mal.karMarji || 0})`],
      ],
      headStyles: headStyle, bodyStyles: bodyStyle,
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 } },
      theme: 'grid',
    });

    // Sağ tablo: Ödeme Dağılımı
    const odemeToplam = nakit + ibanV + krediV;
    const oranN = odemeToplam > 0 ? Math.round((nakit / odemeToplam) * 1000) / 10 : 0;
    const oranI = odemeToplam > 0 ? Math.round((ibanV / odemeToplam) * 1000) / 10 : 0;
    const oranK = odemeToplam > 0 ? Math.round((krediV / odemeToplam) * 1000) / 10 : 0;
    autoTable(doc, {
      startY: y, margin: { left: pw / 2 + 2, right: 10 },
      head: [[tr('Odeme'), 'Tutar', '%']],
      body: [
        ['Nakit', `TL ${nakit.toLocaleString('tr-TR')}`, `%${oranN}`],
        ['IBAN', `TL ${ibanV.toLocaleString('tr-TR')}`, `%${oranI}`],
        [tr('Kredi Karti'), `TL ${krediV.toLocaleString('tr-TR')}`, `%${oranK}`],
        ['TOPLAM', `TL ${odemeToplam.toLocaleString('tr-TR')}`, '%100'],
      ],
      headStyles: headStyle, bodyStyles: bodyStyle, theme: 'grid',
    });

    // Sağ tablo: Baskı Özeti (ödemenin altına)
    const baskiY = (doc as any).lastAutoTable?.finalY + 3 || y + 40;
    const baskiMekanlar = (d.mekanlar || []).filter((m: any) => (m.basilanFotograf || 0) > 0);
    if (baskiMekanlar.length > 0) {
      const bRows = baskiMekanlar.map((m: any) => [tr(m.name), m.basilanFotograf || 0, m.iadeFotograf || 0, m.netSatilanFotograf || 0, `TL ${(m.birimBaskiMaliyeti || 0).toFixed(2)}`, `TL ${(m.baskiMaliyeti || 0).toLocaleString('tr-TR')}`]);
      const bTopB = baskiMekanlar.reduce((s: number, m: any) => s + (m.basilanFotograf || 0), 0);
      const bTopI = baskiMekanlar.reduce((s: number, m: any) => s + (m.iadeFotograf || 0), 0);
      const bTopN = baskiMekanlar.reduce((s: number, m: any) => s + (m.netSatilanFotograf || 0), 0);
      const bTopM = baskiMekanlar.reduce((s: number, m: any) => s + (m.baskiMaliyeti || 0), 0);
      bRows.push(['TOPLAM', bTopB, bTopI, bTopN, '', `TL ${bTopM.toLocaleString('tr-TR')}`]);
      autoTable(doc, {
        startY: baskiY, margin: { left: pw / 2 + 2, right: 10 },
        head: [[tr('Baski'), 'Bas.', 'Iade', 'Net', 'Birim', 'Toplam']],
        body: bRows,
        headStyles: headStyle, bodyStyles: { fontSize: 6 }, theme: 'grid',
      });
    }

    // Sol özet tablosunun altını al
    y = Math.max((doc as any).lastAutoTable?.finalY || y + 50, y + 50) + 4;

    // Mekan Bazlı (tam genişlik)
    const mekanRows = (d.mekanlar || []).map((m: any) => {
      const mBrut = (m.ciro || 0) + (m.iskonto || 0);
      const mIskY = mBrut > 0 ? Math.round((m.iskonto / mBrut) * 100) : 0;
      return [tr(m.name), m.acilisSaat || '-', m.kapanisSaat || '-', `TL ${(m.ciro || 0).toLocaleString('tr-TR')}`, m.satisAdet, `TL ${(m.iskonto || 0).toLocaleString('tr-TR')}`, `%${mIskY}`, `TL ${(m.gunlukKira || 0).toLocaleString('tr-TR')}`];
    });
    autoTable(doc, {
      startY: y, margin: { left: 10, right: 10 },
      head: [trRow(['Mekan', 'Acilis', 'Kapanis', 'Ciro', 'Satis', 'Iskonto', 'Isk%', 'Kira'])],
      body: mekanRows,
      headStyles: headStyle, bodyStyles: bodyStyle, theme: 'grid',
    });
    y = (doc as any).lastAutoTable?.finalY + 4;

    // Personel (tam genişlik)
    const perRows = (d.personeller || []).map((p: any) => {
      const kazanc = (p.gunlukMaas || 0) + (p.primToplam || 0);
      return [tr(p.ad), tr((p.mekanlar || []).join(', ')), `TL ${(p.ciro || 0).toLocaleString('tr-TR')}`, p.kare, `TL ${(p.gunlukMaas || 0).toLocaleString('tr-TR')}`, `TL ${(p.primToplam || 0).toLocaleString('tr-TR')}`, `TL ${kazanc.toLocaleString('tr-TR')}`];
    });
    const pTM = (d.personeller || []).reduce((s: number, p: any) => s + (p.gunlukMaas || 0), 0);
    const pTP = (d.personeller || []).reduce((s: number, p: any) => s + (p.primToplam || 0), 0);
    const pTC = (d.personeller || []).reduce((s: number, p: any) => s + (p.ciro || 0), 0);
    const pTK = (d.personeller || []).reduce((s: number, p: any) => s + (p.kare || 0), 0);
    perRows.push(['TOPLAM', '', `TL ${pTC.toLocaleString('tr-TR')}`, pTK, `TL ${pTM.toLocaleString('tr-TR')}`, `TL ${pTP.toLocaleString('tr-TR')}`, `TL ${(pTM + pTP).toLocaleString('tr-TR')}`]);
    autoTable(doc, {
      startY: y, margin: { left: 10, right: 10 },
      head: [['Personel', 'Mekan', 'Ciro', 'Kare', 'Maas', 'Hakedis', 'Kazanc']],
      body: perRows,
      headStyles: headStyle, bodyStyles: bodyStyle, theme: 'grid',
    });
    y = (doc as any).lastAutoTable?.finalY + 4;

    // Alt kısım: Ürün (sol) + Anomali (sağ)
    if (y > 240) { doc.addPage(); y = 12; }

    // Sol: Ürün/Albüm
    const albumRows = (d.albumler || []).map((a: any) => [tr(a.tip), a.adet, `TL ${(a.ciro || 0).toLocaleString('tr-TR')}`]);
    const aTotA = (d.albumler || []).reduce((s: number, a: any) => s + (a.adet || 0), 0);
    const aTotC = (d.albumler || []).reduce((s: number, a: any) => s + (a.ciro || 0), 0);
    albumRows.push(['TOPLAM', aTotA, `TL ${aTotC.toLocaleString('tr-TR')}`]);
    autoTable(doc, {
      startY: y, margin: { left: 10, right: pw / 2 + 2 },
      head: [[tr('Urun'), 'Adet', 'Ciro']],
      body: albumRows,
      headStyles: headStyle, bodyStyles: bodyStyle, theme: 'grid',
    });

    // Sağ: Anomaliler
    const anomaliler = d.anomaliler || [];
    if (anomaliler.length > 0) {
      const tipL = (t: string) => t === 'acilis' ? 'Acilis' : t === 'kapanis' ? 'Kapanis' : 'Yazici';
      const aRows = anomaliler.map((a: any) => {
        const det = a.detay ? (typeof a.detay === 'object' ? Object.entries(a.detay).map(([k, v]) => `${k}:${Number(v) > 0 ? '+' : ''}${v}`).join(', ') : String(a.detay)) : '';
        return [tr(a.mekan), tipL(a.tip), tr(det)];
      });
      autoTable(doc, {
        startY: y, margin: { left: pw / 2 + 2, right: 10 },
        head: [['Mekan', 'Tip', 'Detay']],
        body: aRows,
        headStyles: headStyle, bodyStyles: { fontSize: 6 }, theme: 'grid',
      });
    }

    doc.save(`Gun_Raporu_${d.tarih || gunSecili || 'rapor'}.pdf`);
  };

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
    d.setDate(d.getDate() - 7);
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
            {aktifSekme === 'gun' ? (gunSecili ? `Gün Detayı — ${gunSecili}` : `Gün Raporu — ${gunListe.length} gün`) : secili ? secili.mekan : loading ? 'Yükleniyor…' : `${raporlar.length} kapanmış vardiya`}
          </p>
        </div>
        {!secili && (
          <button
            onClick={aktifSekme === 'gun' ? () => { if (gunSecili) fetchGunDetay(gunSecili); else fetchGunListesi(gunTarihBas, gunTarihBit); } : handleAra}
            className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all active:scale-90"
            style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)' }}
          >
            <RefreshCw className={`w-4 h-4 text-violet-400 ${(aktifSekme === 'gun' ? gunLoading : loading) ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* Sekme Seçici */}
      {!secili && (
        <div className="px-4 pb-3">
          <div className="flex gap-2 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {([['vardiya', 'Vardiya Bazlı'], ['gun', 'Gün Bazlı']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setAktifSekme(key); if (key === 'gun' && gunListe.length === 0) fetchGunListesi(gunTarihBas, gunTarihBit); }}
                className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: aktifSekme === key ? 'rgba(167,139,250,0.25)' : 'transparent',
                  color: aktifSekme === key ? '#c4b5fd' : 'rgba(255,255,255,0.4)',
                  border: aktifSekme === key ? '1px solid rgba(167,139,250,0.4)' : '1px solid transparent',
                }}
              >{label}</button>
            ))}
          </div>
        </div>
      )}

      {/* ════ GÜN BAZLI RAPOR ════ */}
      {aktifSekme === 'gun' && !secili && (
        <div className="px-4 pb-8">
          {/* Tarih aralığı filtresi */}
          {!gunSecili && (
            <div className="flex items-center gap-2 mb-4">
              <input type="date" value={gunTarihBas} onChange={e => setGunTarihBas(e.target.value)}
                className="flex-1 text-xs font-bold text-white rounded-xl px-3 py-2 outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
              <span className="text-white/30 text-xs">—</span>
              <input type="date" value={gunTarihBit} onChange={e => setGunTarihBit(e.target.value)}
                className="flex-1 text-xs font-bold text-white rounded-xl px-3 py-2 outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
              <button onClick={() => fetchGunListesi(gunTarihBas, gunTarihBit)}
                className="px-3 py-2 rounded-xl text-xs font-bold active:scale-95"
                style={{ background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.4)', color: '#c4b5fd' }}>
                Ara
              </button>
            </div>
          )}

          {/* Geri butonu (detay modunda) */}
          {gunSecili && (
            <button onClick={() => { setGunSecili(null); setGunDetay(null); }}
              className="flex items-center gap-2 mb-4 text-xs font-bold active:scale-95"
              style={{ color: '#c4b5fd' }}>
              <ChevronLeft style={{ width: 14, height: 14 }} /> Listeye Dön
            </button>
          )}

          {/* Yükleniyor */}
          {gunLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-7 h-7 text-violet-400 animate-spin" />
            </div>
          )}

          {/* Hata */}
          {gunError && !gunLoading && (
            <div className="rounded-2xl p-4 text-center" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)' }}>
              <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
              <p className="text-red-300 text-sm font-bold">{gunError}</p>
            </div>
          )}

          {/* Boş */}
          {!gunLoading && !gunError && gunListe.length === 0 && !gunSecili && (
            <div className="rounded-2xl p-8 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-white/40 text-sm font-bold">Gün raporu için "Ara" butonuna tıklayın</p>
            </div>
          )}

          {/* ── GÜN LİSTESİ (kartlar) ── */}
          {!gunSecili && !gunLoading && gunListe.length > 0 && (
            <div className="space-y-3">
              {gunListe.slice(0, gunGorunenAdet).map((g: any) => {
                const karZarar = g.karZarar || 0;
                const karPositif = karZarar >= 0;
                const karRenk = karPositif ? '#34d399' : '#f87171';
                const ciro = g.toplamCiro || 0;
                const nakit = g.nakitToplam || 0;
                const iban = g.ibanToplam || 0;
                const kredi = g.krediToplam || 0;
                const odemeToplam = nakit + iban + kredi;
                return (
                  <motion.button key={g.tarih}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setGunSecili(g.tarih); fetchGunDetay(g.tarih); }}
                    className="w-full rounded-2xl text-left transition-all"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>

                    {/* Üst bant — tarih + ciro */}
                    <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                      <div>
                        <p className="text-[14px] font-black text-white leading-tight">{formatTarih(g.tarih)}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            {g.toplamMekan} mekan
                          </span>
                          <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
                          <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            {g.toplamSatisAdet} satis
                          </span>
                          <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
                          <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            {g.toplamKare} kare{g.iadeFotograf > 0 && <span style={{ color: 'rgba(248,113,113,0.5)' }}> ({g.iadeFotograf} iade)</span>}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[18px] font-black leading-tight" style={{ color: '#a78bfa' }}>
                          {tl(ciro)}
                        </p>
                      </div>
                    </div>

                    {/* Ödeme dağılımı çubuğu */}
                    {odemeToplam > 0 && (
                      <div className="px-4 pb-2">
                        <div className="flex rounded-full overflow-hidden" style={{ height: 4, background: 'rgba(255,255,255,0.06)' }}>
                          {nakit > 0 && <div style={{ width: `${(nakit / odemeToplam) * 100}%`, background: '#34d399' }} />}
                          {iban > 0 && <div style={{ width: `${(iban / odemeToplam) * 100}%`, background: '#60a5fa' }} />}
                          {kredi > 0 && <div style={{ width: `${(kredi / odemeToplam) * 100}%`, background: '#f472b6' }} />}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                          {nakit > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="text-[8px] font-semibold" style={{ color: 'rgba(52,211,153,0.6)' }}>Nakit</span>
                              <span className="text-[9px] font-bold" style={{ color: '#34d399' }}>{tl(nakit)}</span>
                            </div>
                          )}
                          {iban > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="text-[8px] font-semibold" style={{ color: 'rgba(96,165,250,0.6)' }}>IBAN</span>
                              <span className="text-[9px] font-bold" style={{ color: '#60a5fa' }}>{tl(iban)}</span>
                            </div>
                          )}
                          {kredi > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="text-[8px] font-semibold" style={{ color: 'rgba(244,114,182,0.6)' }}>Kredi Kartı</span>
                              <span className="text-[9px] font-bold" style={{ color: '#f472b6' }}>{tl(kredi)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Kar/Zarar + İskonto | Anomali + Geç Giriş */}
                    <div className="flex items-center justify-between px-4 pb-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                          style={{ background: karPositif ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', border: `1px solid ${karPositif ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)'}` }}>
                          <TrendingUp style={{ width: 10, height: 10, color: karRenk }} />
                          <span className="text-[10px] font-bold" style={{ color: karRenk }}>
                            {tl(karZarar)}
                          </span>
                          <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{
                            background: karPositif ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
                            color: karRenk,
                          }}>%{g.karMarji || 0}</span>
                        </div>

                        {g.toplamIskonto > 0 && (() => {
                          const brut = (g.toplamCiro || 0) + g.toplamIskonto;
                          const iskYuzde = brut > 0 ? Math.round((g.toplamIskonto / brut) * 100) : 0;
                          return (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-lg"
                              style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.18)' }}>
                              <span className="text-[10px] font-semibold" style={{ color: 'rgba(251,146,60,0.7)' }}>Isk</span>
                              <span className="text-[10px] font-bold" style={{ color: '#fb923c' }}>-{tl(g.toplamIskonto)}</span>
                              <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: 'rgba(251,146,60,0.15)', color: '#fbbf24' }}>%{iskYuzde}</span>
                            </div>
                          );
                        })()}
                      </div>

                      {(g.anomaliSayisi > 0 || g.gecGirisSayisi > 0) && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {g.anomaliSayisi > 0 && (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-lg"
                              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.18)' }}>
                              <AlertTriangle style={{ width: 9, height: 9, color: '#f87171' }} />
                              <span className="text-[9px] font-bold" style={{ color: '#f87171' }}>{g.anomaliSayisi} anomali</span>
                            </div>
                          )}

                          {g.gecGirisSayisi > 0 && (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-lg"
                              style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.18)' }}>
                              <AlertCircle style={{ width: 9, height: 9, color: '#fbbf24' }} />
                              <span className="text-[9px] font-bold" style={{ color: '#fbbf24' }}>{g.gecGirisSayisi} geç giriş</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Alt bant — mekanlar + ok */}
                    <div className="flex items-center justify-between px-4 py-2.5"
                      style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <div className="flex gap-1.5 flex-wrap flex-1 min-w-0">
                        {(g.mekanlar || []).slice(0, 5).map((m: string, i: number) => (
                          <span key={i} className="text-[9px] font-semibold px-2 py-0.5 rounded-full truncate"
                            style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.15)', color: 'rgba(255,255,255,0.5)', maxWidth: 100 }}>
                            {m}
                          </span>
                        ))}
                        {(g.mekanlar || []).length > 5 && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                            +{g.mekanlar.length - 5}
                          </span>
                        )}
                      </div>
                      <ChevronRight style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                    </div>
                  </motion.button>
                );
              })}

              {/* +7 Daha Göster */}
              {gunListe.length > gunGorunenAdet && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setGunGorunenAdet(prev => prev + GUN_SAYFA_BOYUTU)}
                  className="w-full py-3 rounded-2xl flex items-center justify-center gap-2 mt-1"
                  style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.15)' }}
                >
                  <ChevronDown style={{ width: 14, height: 14, color: '#a78bfa' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa' }}>
                    +{Math.min(gunListe.length - gunGorunenAdet, GUN_SAYFA_BOYUTU)} Daha Göster
                  </span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginLeft: 2 }}>
                    ({gunListe.length - gunGorunenAdet} kaldı)
                  </span>
                </motion.button>
              )}

              {/* Tümü gösterildi */}
              {gunListe.length > 0 && gunListe.length <= gunGorunenAdet && gunGorunenAdet > GUN_SAYFA_BOYUTU && (
                <p className="text-center mt-3" style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
                  Tüm {gunListe.length} gün gösteriliyor
                </p>
              )}
            </div>
          )}

          {/* ── GÜN DETAYI (tek gün seçildiğinde) ── */}
          {gunSecili && (
            <div>
              {gunDetayLoading && (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-7 h-7 text-violet-400 animate-spin" />
                </div>
              )}
              {!gunDetayLoading && gunDetay && !gunDetay.bos && (
                <div className="space-y-3">
                  {/* Özet Kartlar */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Toplam Ciro + İskonto yan yana */}
                    <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(52,211,153,0.15)' }}>
                      <div>
                        <p className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Toplam Ciro</p>
                        <p className="text-lg font-black" style={{ color: '#34d399' }}>₺{(gunDetay.ozet?.toplamCiro || 0).toLocaleString('tr-TR')}</p>
                      </div>
                      {(gunDetay.ozet?.toplamIskonto || 0) > 0 && (() => {
                        const isk = gunDetay.ozet.toplamIskonto;
                        const brut = (gunDetay.ozet.toplamCiro || 0) + isk;
                        const yuzde = brut > 0 ? Math.round((isk / brut) * 100) : 0;
                        return (
                          <div className="text-right">
                            <p className="text-[9px] font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>İskonto</p>
                            <p className="text-[13px] font-black" style={{ color: '#fb923c' }}>₺{isk.toLocaleString('tr-TR')} <span className="text-[10px]">%{yuzde}</span></p>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Satış Adedi */}
                    <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(96,165,250,0.15)' }}>
                      <p className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Satış Adedi</p>
                      <p className="text-lg font-black" style={{ color: '#60a5fa' }}>{gunDetay.ozet?.toplamSatisAdet || 0}</p>
                    </div>

                    {/* Ödeme Dağılımı (eski iskonto kartının yerine) */}
                    {(() => {
                      const odemeler: any[] = gunDetay.odemeler || [];
                      const nakit = odemeler.find((o: any) => o.yontem === 'cash')?.ciro || 0;
                      const iban = odemeler.find((o: any) => o.yontem === 'iban')?.ciro || 0;
                      const kredi = odemeler.find((o: any) => o.yontem === 'card')?.ciro || 0;
                      const toplam = nakit + iban + kredi;
                      if (toplam <= 0) return null;
                      return (
                        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <p className="text-[10px] font-semibold mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Ödeme Dağılımı</p>
                          <div className="flex rounded-full overflow-hidden mb-1.5" style={{ height: 4, background: 'rgba(255,255,255,0.06)' }}>
                            {nakit > 0 && <div style={{ width: `${(nakit / toplam) * 100}%`, background: '#34d399' }} />}
                            {iban > 0 && <div style={{ width: `${(iban / toplam) * 100}%`, background: '#60a5fa' }} />}
                            {kredi > 0 && <div style={{ width: `${(kredi / toplam) * 100}%`, background: '#f472b6' }} />}
                          </div>
                          <div className="flex items-center gap-2">
                            {nakit > 0 && <div className="flex items-center gap-0.5"><span className="text-[7px] font-semibold" style={{ color: 'rgba(52,211,153,0.6)' }}>Nakit</span><span className="text-[9px] font-bold" style={{ color: '#34d399' }}>₺{nakit.toLocaleString('tr-TR')}</span></div>}
                            {iban > 0 && <div className="flex items-center gap-0.5"><span className="text-[7px] font-semibold" style={{ color: 'rgba(96,165,250,0.6)' }}>IBAN</span><span className="text-[9px] font-bold" style={{ color: '#60a5fa' }}>₺{iban.toLocaleString('tr-TR')}</span></div>}
                            {kredi > 0 && <div className="flex items-center gap-0.5"><span className="text-[7px] font-semibold" style={{ color: 'rgba(244,114,182,0.6)' }}>Kredi</span><span className="text-[9px] font-bold" style={{ color: '#f472b6' }}>₺{kredi.toLocaleString('tr-TR')}</span></div>}
                          </div>
                        </div>
                      );
                    })()}
                    {/* Toplam Kare — satılan + iade yan yana */}
                    <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(196,181,253,0.15)' }}>
                      <div>
                        <p className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.4)' }}>Toplam Kare</p>
                        <p className="text-lg font-black" style={{ color: '#c4b5fd' }}>{gunDetay.ozet?.toplamKare || 0}</p>
                      </div>
                      {(gunDetay.ozet?.toplamBasilanFotograf || gunDetay.ozet?.toplamSatilanFotograf || 0) > 0 && (
                        <div className="flex items-center gap-3">
                          {(gunDetay.ozet?.toplamBasilanFotograf || 0) > 0 && (
                            <div className="text-right">
                              <p className="text-[9px] font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>Basılan</p>
                              <p className="text-[13px] font-black" style={{ color: '#a78bfa' }}>{gunDetay.ozet.toplamBasilanFotograf}</p>
                            </div>
                          )}
                          {(gunDetay.ozet?.toplamSatilanFotograf || 0) > 0 && (
                            <div className="text-right">
                              <p className="text-[9px] font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>Satılan</p>
                              <p className="text-[13px] font-black" style={{ color: '#34d399' }}>{gunDetay.ozet.toplamSatilanFotograf}</p>
                            </div>
                          )}
                          {(gunDetay.ozet?.toplamIadeFotograf || 0) > 0 && (
                            <div className="text-right">
                              <p className="text-[9px] font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>İade</p>
                              <p className="text-[13px] font-black" style={{ color: '#f87171' }}>{gunDetay.ozet.toplamIadeFotograf}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Kar/Zarar */}
                  {gunDetay.maliyet && (
                    <div className="rounded-xl p-4" style={{
                      background: (gunDetay.maliyet.karZarar || 0) >= 0 ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)',
                      border: `1px solid ${(gunDetay.maliyet.karZarar || 0) >= 0 ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`,
                    }}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-white/60">Günlük Kar/Zarar</p>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{
                          background: (gunDetay.maliyet.karZarar || 0) >= 0 ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)',
                          color: (gunDetay.maliyet.karZarar || 0) >= 0 ? '#34d399' : '#f87171',
                        }}>%{gunDetay.maliyet.karMarji || 0} marj</span>
                      </div>
                      <p className="text-2xl font-black" style={{ color: (gunDetay.maliyet.karZarar || 0) >= 0 ? '#34d399' : '#f87171' }}>
                        ₺{(gunDetay.maliyet.karZarar || 0).toLocaleString('tr-TR')}
                      </p>
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        {[
                          { label: 'Baskı Maliyeti', value: gunDetay.maliyet.baskiMaliyeti },
                          { label: 'Albüm Maliyeti', value: gunDetay.maliyet.albumMaliyeti },
                          { label: 'Kira Gideri', value: gunDetay.maliyet.kiraGideri },
                          { label: 'Maaş Gideri', value: gunDetay.maliyet.maasGideri },
                          { label: 'Hakediş Gideri', value: gunDetay.maliyet.primGideri },
                        ].filter(g => (g.value || 0) > 0).map(g => (
                          <div key={g.label} className="flex justify-between text-[11px]">
                            <span style={{ color: 'rgba(255,255,255,0.4)' }}>{g.label}</span>
                            <span className="font-bold text-white/70">₺{(g.value || 0).toLocaleString('tr-TR')}</span>
                          </div>
                        ))}
                      </div>
                      {(gunDetay.maliyet.toplamGider || 0) > 0 && (
                        <div className="flex justify-between text-[11px] mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                          <span style={{ color: 'rgba(248,113,113,0.6)' }} className="font-bold">Toplam Maliyet</span>
                          <span className="font-black" style={{ color: '#f87171' }}>₺{(gunDetay.maliyet.toplamGider || 0).toLocaleString('tr-TR')}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mekan Sıralaması */}
                  {(gunDetay.mekanlar || []).length > 0 && (
                    <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <p className="text-xs font-black text-white mb-2">📍 Mekan Sıralaması</p>
                      <div className="space-y-2">
                        {(gunDetay.mekanlar || []).map((m: any, i: number) => (
                          <div key={m.id} className="flex items-center gap-2 rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <span className="text-xs font-black w-5 text-center" style={{ color: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : 'rgba(255,255,255,0.3)' }}>{i + 1}</span>
                            <span className="text-sm">{m.emoji}</span>
                            <span className="text-xs font-bold text-white flex-1 truncate">{m.name}</span>
                            <span className="text-xs font-black" style={{ color: '#34d399' }}>₺{(m.ciro || 0).toLocaleString('tr-TR')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Personel */}
                  {(gunDetay.personeller || []).length > 0 && (
                    <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <p className="text-xs font-black text-white mb-2">👤 Personel Performansı</p>
                      <div className="space-y-2">
                        {(gunDetay.personeller || []).map((p: any, i: number) => (
                          <div key={p.id} className="flex items-center gap-2 rounded-lg p-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <span className="text-xs font-black w-5 text-center" style={{ color: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : 'rgba(255,255,255,0.3)' }}>{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-white truncate">{p.ad}</p>
                              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{p.satisAdet} satış · {p.kare} kare</p>
                            </div>
                            <p className="text-xs font-black" style={{ color: '#34d399' }}>₺{(p.ciro || 0).toLocaleString('tr-TR')}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ürün + Ödeme + Anomali */}
                  {(gunDetay.albumler || []).length > 0 && (
                    <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <p className="text-xs font-black text-white mb-2">📘 Ürün Dağılımı</p>
                      {(gunDetay.albumler || []).map((a: any) => (
                        <div key={a.tip} className="flex justify-between text-xs py-0.5">
                          <span style={{ color: 'rgba(255,255,255,0.5)' }}>{a.tip}</span>
                          <span className="font-bold" style={{ color: '#c4b5fd' }}>{a.adet} ad. · ₺{(a.ciro||0).toLocaleString('tr-TR')}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {(gunDetay.anomaliler || []).length > 0 && (
                    <div className="rounded-xl p-3" style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)' }}>
                      <p className="text-xs font-black text-red-400 mb-1">⚠️ Anomaliler ({gunDetay.anomaliler.length})</p>
                      {(gunDetay.anomaliler || []).map((a: any, i: number) => (
                        <p key={i} className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{a.mekanEmoji} {a.mekan} — {a.tip === 'acilis' ? 'Açılış' : 'Kapanış'}</p>
                      ))}
                    </div>
                  )}

                  {/* Dışa Aktar */}
                  <div style={{ marginTop: 6, marginBottom: 24 }}>
                    <p className="text-center text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.2)' }}>Dışa Aktar</p>
                    <div className="grid grid-cols-3 gap-3">
                      <button onClick={() => window.print()}
                        className="flex flex-col items-center gap-2 py-3 rounded-xl transition-all active:scale-95"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <PrinterIcon style={{ width: 18, height: 18, color: 'rgba(255,255,255,0.4)' }} />
                        <span className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>Yazdır</span>
                      </button>
                      <button onClick={handleGunExcel}
                        className="flex flex-col items-center gap-2 py-3 rounded-xl transition-all active:scale-95"
                        style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}>
                        <FileSpreadsheet style={{ width: 18, height: 18, color: '#34d399' }} />
                        <span className="text-[10px] font-bold" style={{ color: '#34d399' }}>Excel</span>
                      </button>
                      <button onClick={handleGunPDF}
                        className="flex flex-col items-center gap-2 py-3 rounded-xl transition-all active:scale-95"
                        style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)' }}>
                        <FileText style={{ width: 18, height: 18, color: '#f87171' }} />
                        <span className="text-[10px] font-bold" style={{ color: '#f87171' }}>PDF</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════ VARDİYA BAZLI RAPOR ════ */}
      {aktifSekme === 'vardiya' && (
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
      )}

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