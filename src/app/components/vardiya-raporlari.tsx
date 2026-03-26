/**
 * VardiyaRaporlari — Yönetici/Müdür, kapanışı tamamlanmış vardiya raporları
 * Gerçek veri: GET /vardiya/raporlar  |  DELETE /vardiya/sil
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft, ChevronRight, Users, Printer, TrendingUp, Package,
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
  ribonDegisim: number;
  iadeFotograf: number;
  kullanilanBaski: number;
  cikisAdedi: number;
  satilanFotograf: number;
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

  /* ───── Export helpers ───── */
  const dosyaAdi = `${v.mekan.replace(/\s+/g, '_')}_${v.tarih}`;

  // Türkçe → ASCII (PDF font uyumu için)
  function tr(s: string) {
    return s
      .replace(/ğ/g,'g').replace(/Ğ/g,'G')
      .replace(/ü/g,'u').replace(/Ü/g,'U')
      .replace(/ş/g,'s').replace(/Ş/g,'S')
      .replace(/ı/g,'i').replace(/İ/g,'I')
      .replace(/ö/g,'o').replace(/Ö/g,'O')
      .replace(/ç/g,'c').replace(/Ç/g,'C');
  }

  function handleExcel() {
    const toplamPrim = v.primBilgi?.toplamPrim || 0;
    const toplamMaliyet = v.albumMaliyeti + v.baskiMaliyeti + toplamPrim + v.mekanGunlukKira;
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
      ['Prim Toplamı (₺)', toplamPrim],
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
    const toplamMaliyet = v.albumMaliyeti + v.baskiMaliyeti + toplamPrim + v.mekanGunlukKira;
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
        [tr('Prim Toplami'), `${Math.round(toplamPrim).toLocaleString('tr-TR')} TL`],
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
        const toplamMaliyet = v.albumMaliyeti + v.baskiMaliyeti + toplamPrim + v.mekanGunlukKira;
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
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Prim Hakedişi</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa' }}>-{tl(toplamPrim)}</span>
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
                    <span style={{ fontSize: 15, fontWeight: 900, color: '#f87171' }}>{tl(toplamMaliyet)}</span>
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
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 700, marginBottom: 8 }}>{y.ad}</p>
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
                    </div>
                  ))}
                </div>
              )}

              {/* Ayırıcı */}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 12 }} />

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
                <span style={{ fontSize: 14, fontWeight: 800, color: '#f87171' }}>{tl(v.baskiMaliyeti)}</span>
              </div>
            </>
          );
        })()}
      </div>

      {/* ── BLOK 3: Prim ── */}
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
                Prim{hasPrim ? ' — 🏆 Kazanıldı!' : ''}
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

            {/* Prim VAR → kota durumları */}
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

            {/* Prim VAR → toplam */}
            {hasPrim && (
              <div style={{ borderTop: '1px solid rgba(167,139,250,0.15)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Toplam Prim Hakedişi</span>
                <span style={{ fontSize: 16, fontWeight: 900, color: '#a78bfa' }}>{tl(toplamPrim)}</span>
              </div>
            )}

            {/* Prim YOK → ilk kotaya kalan */}
            {!hasPrim && ilkKota && ilkFark > 0 && (
              <div className="flex items-center gap-2">
                <Trophy style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.2)' }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
                  1. Prim kotasına {tl(ilkFark)} eksik kaldı
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── BLOK 4: Mekan Kirası ── */}
      {v.mekanGunlukKira > 0 && (
        <div style={sectionStyle}>
          <p style={labelStyle}>
            <Banknote style={{ width: 10, height: 10, display: 'inline', marginRight: 4 }} />
            Mekan Kirası
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Günlük Kira</p>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>Yıllık kira / 365 gün</p>
            </div>
            <p style={{ fontSize: 18, fontWeight: 900, color: '#ffd4a3' }}>{tl(v.mekanGunlukKira)}<span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,212,163,0.5)', marginLeft: 3 }}>/gün</span></p>
          </div>
        </div>
      )}

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