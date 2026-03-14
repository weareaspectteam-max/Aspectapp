/**
 * VardiyaRaporlari — Yönetici'ye özel, kapanışı tamamlanmış vardiya raporları
 * 3 farklı layout demo: A (Accordion), B (Master/Detail), C (Modal)
 */

import { useState, useMemo } from 'react';
import {
  ArrowLeft, LayoutList, PanelLeftOpen, Layers,
  ChevronDown, ChevronRight, X, Filter, Calendar,
  MapPin, Users, Printer, TrendingUp, Package,
  CreditCard, Banknote, Wallet, AlertTriangle,
  Camera, Image, RefreshCw, Clock, Star, Award,
  Search, SlidersHorizontal, CheckCircle2, Zap,
  BarChart3, ChevronUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { UserRole } from './login';

/* ─────────────────────── Types ─────────────────────── */
interface SatisKalemi {
  urun: string;
  adet: number;
  birimFiyat: number;
  para: 'TRY' | 'EUR' | 'USD';
  renk?: string;
}

interface PersonelSatis {
  ad: string;
  avatar: string;
  kare: number;
  iade: number;
  nakit: { TRY: number; EUR: number; USD: number };
  iban: { TRY: number; EUR: number; USD: number };
  kredi: { TRY: number; EUR: number; USD: number };
  satirlar: SatisKalemi[];
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
  puan: number;
  etkilenen: string[];
}

interface VardiyaKayit {
  id: string;
  tur: 'rotasyon' | 'ekstra-is' | 'ozel-is';
  mekan: string;
  mekanIcon: string;
  tarih: string;
  acilisSaat: string;
  kapanisSaat: string;
  personeller: PersonelSatis[];
  yazicilar: YaziciSayac[];
  anomaliler: Anomali[];
  albümler: { [urun: string]: number };
  toplamKare: number;
  toplamIade: number;
  stokBaslangic: number;
  stokBitis: number;
}

/* ─────────────────────── Mock Data ─────────────────────── */
const MOCK_VARDIYAS: VardiyaKayit[] = [
  {
    id: 'v001',
    tur: 'rotasyon',
    mekan: 'Boğaz Turu',
    mekanIcon: '⛵',
    tarih: '2026-03-14',
    acilisSaat: '09:15',
    kapanisSaat: '18:42',
    personeller: [
      {
        ad: 'Ahmet Yılmaz',
        avatar: '👨‍💼',
        kare: 247,
        iade: 12,
        nakit:  { TRY: 1200, EUR: 80, USD: 0 },
        iban:   { TRY: 500,  EUR: 0,  USD: 0 },
        kredi:  { TRY: 800,  EUR: 40, USD: 0 },
        satirlar: [
          { urun: "5'li",  adet: 8,  birimFiyat: 150, para: 'TRY' },
          { urun: "7'li",  adet: 4,  birimFiyat: 200, para: 'TRY' },
          { urun: "5'li",  adet: 3,  birimFiyat: 30,  para: 'EUR' },
        ],
      },
      {
        ad: 'Elif Kaya',
        avatar: '👩‍💼',
        kare: 189,
        iade: 8,
        nakit:  { TRY: 900,  EUR: 60, USD: 20 },
        iban:   { TRY: 300,  EUR: 0,  USD: 0  },
        kredi:  { TRY: 600,  EUR: 30, USD: 0  },
        satirlar: [
          { urun: "3'lü",  adet: 10, birimFiyat: 100, para: 'TRY' },
          { urun: "5'li",  adet: 6,  birimFiyat: 150, para: 'TRY' },
          { urun: "3'lü",  adet: 4,  birimFiyat: 25,  para: 'EUR' },
        ],
      },
    ],
    yazicilar: [
      { ad: 'Yazıcı-1', baslangic: 12450, bitis: 12886, netBasilan: 436 },
    ],
    anomaliler: [],
    albümler: { "3'lü": 10, "5'li": 17, "7'li": 4 },
    toplamKare: 436,
    toplamIade: 20,
    stokBaslangic: 50,
    stokBitis: 19,
  },
  {
    id: 'v002',
    tur: 'ekstra-is',
    mekan: 'Galata Kulesi',
    mekanIcon: '🗼',
    tarih: '2026-03-14',
    acilisSaat: '10:00',
    kapanisSaat: '17:30',
    personeller: [
      {
        ad: 'Mert Demir',
        avatar: '👨‍🎨',
        kare: 312,
        iade: 25,
        nakit:  { TRY: 1800, EUR: 120, USD: 50 },
        iban:   { TRY: 700,  EUR: 50,  USD: 0  },
        kredi:  { TRY: 1200, EUR: 80,  USD: 30 },
        satirlar: [
          { urun: "7'li",   adet: 6,  birimFiyat: 200, para: 'TRY' },
          { urun: "9'lu",   adet: 4,  birimFiyat: 280, para: 'TRY' },
          { urun: "5'li",   adet: 8,  birimFiyat: 35,  para: 'EUR' },
          { urun: "1 Fotoğraf", adet: 12, birimFiyat: 10, para: 'EUR' },
        ],
      },
    ],
    yazicilar: [
      { ad: 'Yazıcı-2', baslangic: 8900, bitis: 9212, netBasilan: 312 },
    ],
    anomaliler: [
      {
        tip: 'yazici',
        aciklama: 'Net basılan (312) ile satış toplamı (287) arasında 25 kare fark tespit edildi.',
        puan: 1,
        etkilenen: ['Mert Demir'],
      },
    ],
    albümler: { "7'li": 6, "9'lu": 4 },
    toplamKare: 312,
    toplamIade: 25,
    stokBaslangic: 40,
    stokBitis: 30,
  },
  {
    id: 'v003',
    tur: 'ozel-is',
    mekan: 'Sultanahmet',
    mekanIcon: '🕌',
    tarih: '2026-03-13',
    acilisSaat: '08:30',
    kapanisSaat: '19:15',
    personeller: [
      {
        ad: 'Selin Arslan',
        avatar: '👩‍🎨',
        kare: 540,
        iade: 30,
        nakit:  { TRY: 2200, EUR: 200, USD: 100 },
        iban:   { TRY: 1000, EUR: 80,  USD: 0   },
        kredi:  { TRY: 1500, EUR: 150, USD: 60  },
        satirlar: [
          { urun: "9'lu",   adet: 5,  birimFiyat: 280, para: 'TRY' },
          { urun: "11'li",  adet: 3,  birimFiyat: 350, para: 'TRY' },
          { urun: "7'li",   adet: 8,  birimFiyat: 50,  para: 'EUR' },
          { urun: "1 Fotoğraf", adet: 20, birimFiyat: 10, para: 'EUR' },
        ],
      },
      {
        ad: 'Burak Yıldız',
        avatar: '👨‍💻',
        kare: 320,
        iade: 15,
        nakit:  { TRY: 1400, EUR: 100, USD: 0 },
        iban:   { TRY: 600,  EUR: 0,   USD: 0 },
        kredi:  { TRY: 900,  EUR: 80,  USD: 0 },
        satirlar: [
          { urun: "5'li",  adet: 10, birimFiyat: 150, para: 'TRY' },
          { urun: "7'li",  adet: 5,  birimFiyat: 200, para: 'TRY' },
          { urun: "5'li",  adet: 5,  birimFiyat: 35,  para: 'EUR' },
        ],
      },
    ],
    yazicilar: [
      { ad: 'Yazıcı-1', baslangic: 5200, bitis: 5740, netBasilan: 540 },
      { ad: 'Yazıcı-2', baslangic: 3100, bitis: 3420, netBasilan: 320 },
    ],
    anomaliler: [
      {
        tip: 'stok',
        aciklama: 'Stok başlangıç sayacı (5200) önceki kapanış değerinden (5185) farklı.',
        puan: 1,
        etkilenen: ['Selin Arslan', 'Burak Yıldız'],
      },
    ],
    albümler: { "5'li": 15, "7'li": 13, "9'lu": 5, "11'li": 3 },
    toplamKare: 860,
    toplamIade: 45,
    stokBaslangic: 60,
    stokBitis: 24,
  },
  {
    id: 'v004',
    tur: 'rotasyon',
    mekan: 'Kapalıçarşı',
    mekanIcon: '🏪',
    tarih: '2026-03-13',
    acilisSaat: '09:45',
    kapanisSaat: '17:00',
    personeller: [
      {
        ad: 'Can Öztürk',
        avatar: '🧑‍💼',
        kare: 198,
        iade: 5,
        nakit:  { TRY: 980,  EUR: 50, USD: 0 },
        iban:   { TRY: 400,  EUR: 0,  USD: 0 },
        kredi:  { TRY: 620,  EUR: 30, USD: 0 },
        satirlar: [
          { urun: "3'lü",  adet: 8,  birimFiyat: 100, para: 'TRY' },
          { urun: "5'li",  adet: 5,  birimFiyat: 150, para: 'TRY' },
          { urun: "3'lü",  adet: 4,  birimFiyat: 25,  para: 'EUR' },
        ],
      },
    ],
    yazicilar: [
      { ad: 'Yazıcı-3', baslangic: 22100, bitis: 22298, netBasilan: 198 },
    ],
    anomaliler: [],
    albümler: { "3'lü": 8, "5'li": 5 },
    toplamKare: 198,
    toplamIade: 5,
    stokBaslangic: 30,
    stokBitis: 17,
  },
  {
    id: 'v005',
    tur: 'rotasyon',
    mekan: 'Boğaz Turu',
    mekanIcon: '⛵',
    tarih: '2026-03-12',
    acilisSaat: '09:00',
    kapanisSaat: '18:00',
    personeller: [
      {
        ad: 'Zeynep Çelik',
        avatar: '👩‍💼',
        kare: 410,
        iade: 18,
        nakit:  { TRY: 2100, EUR: 160, USD: 80 },
        iban:   { TRY: 800,  EUR: 60,  USD: 0  },
        kredi:  { TRY: 1300, EUR: 100, USD: 40 },
        satirlar: [
          { urun: "7'li",   adet: 8,  birimFiyat: 200, para: 'TRY' },
          { urun: "9'lu",   adet: 5,  birimFiyat: 280, para: 'TRY' },
          { urun: "7'li",   adet: 6,  birimFiyat: 50,  para: 'EUR' },
          { urun: "1 Fotoğraf", adet: 18, birimFiyat: 10, para: 'EUR' },
        ],
      },
    ],
    yazicilar: [
      { ad: 'Yazıcı-1', baslangic: 12000, bitis: 12410, netBasilan: 410 },
    ],
    anomaliler: [],
    albümler: { "7'li": 14, "9'lu": 5 },
    toplamKare: 410,
    toplamIade: 18,
    stokBaslangic: 45,
    stokBitis: 26,
  },
];

/* ─────────────────────── Helpers ─────────────────────── */
const TUR_RENK: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  'rotasyon':  { bg: 'rgba(99,102,241,0.18)', text: '#818cf8', label: 'Rotasyon',   icon: '🔄' },
  'ekstra-is': { bg: 'rgba(251,146,60,0.18)', text: '#fb923c', label: 'Ekstra İş',  icon: '⚡' },
  'ozel-is':   { bg: 'rgba(52,211,153,0.18)', text: '#34d399', label: 'Özel İş',    icon: '⭐' },
};

function toplamCiro(p: PersonelSatis) {
  const sum = (o: { TRY: number; EUR: number; USD: number }) => o.TRY + o.EUR * 38 + o.USD * 33;
  return sum(p.nakit) + sum(p.iban) + sum(p.kredi);
}

function vardiyaToplam(v: VardiyaKayit) {
  const allP = v.personeller;
  const nakit = { TRY: 0, EUR: 0, USD: 0 };
  const iban  = { TRY: 0, EUR: 0, USD: 0 };
  const kredi = { TRY: 0, EUR: 0, USD: 0 };
  allP.forEach(p => {
    (['TRY', 'EUR', 'USD'] as const).forEach(c => {
      nakit[c] += p.nakit[c];
      iban[c]  += p.iban[c];
      kredi[c] += p.kredi[c];
    });
  });
  return { nakit, iban, kredi };
}

function formatPara(obj: { TRY: number; EUR: number; USD: number }) {
  const parts: string[] = [];
  if (obj.TRY > 0) parts.push(`₺${obj.TRY.toLocaleString('tr-TR')}`);
  if (obj.EUR > 0) parts.push(`€${obj.EUR}`);
  if (obj.USD > 0) parts.push(`$${obj.USD}`);
  return parts.length ? parts.join(' + ') : '—';
}

function formatTarih(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function toplamTL(v: VardiyaKayit) {
  const t = vardiyaToplam(v);
  const sum = (o: { TRY: number; EUR: number; USD: number }) => o.TRY + o.EUR * 38 + o.USD * 33;
  return sum(t.nakit) + sum(t.iban) + sum(t.kredi);
}

function enCokSatan(v: VardiyaKayit) {
  const map: Record<string, number> = {};
  v.personeller.forEach(p => p.satirlar.forEach(s => {
    if (s.urun !== '1 Fotoğraf') map[s.urun] = (map[s.urun] || 0) + s.adet;
  }));
  return Object.entries(map).sort((a, b) => b[1] - a[1])[0] ?? ['—', 0];
}

function albümMaliyet(v: VardiyaKayit) {
  const MALIYET: Record<string, number> = {
    "3'lü": 3, "5'li": 5, "7'li": 7, "9'lu": 9,
    "11'li": 11, "13'lü": 13, "15'li": 15,
  };
  return Object.entries(v.albümler).reduce((s, [k, a]) => s + (MALIYET[k] ?? 0) * a, 0);
}

function baskiMaliyet(v: VardiyaKayit) {
  return v.toplamKare * 1.2; // ₺1.2/kare varsayım
}

function ortalamaSepet(v: VardiyaKayit) {
  const toplamSatis = v.personeller.reduce((s, p) =>
    s + p.satirlar.filter(x => x.urun !== '1 Fotoğraf').reduce((ss, x) => ss + x.adet, 0), 0);
  return toplamSatis ? Math.round(toplamTL(v) / toplamSatis) : 0;
}

/* ─────────────────────── Sub-components ─────────────────────── */

// ── Filtre paneli ──────────────────────────────────────
interface FiltrePaneliProps {
  filtreTur: string;
  setFiltreTur: (v: string) => void;
  filtreMekan: string;
  setFiltreMekan: (v: string) => void;
  filtrePersonel: string;
  setFiltrePersonel: (v: string) => void;
  filtreTarihBas: string;
  setFiltreTarihBas: (v: string) => void;
  filtreTarihBit: string;
  setFiltreTarihBit: (v: string) => void;
  mekanlar: string[];
  personeller: string[];
  onReset: () => void;
}

function FiltrePaneli({
  filtreTur, setFiltreTur, filtreMekan, setFiltreMekan,
  filtrePersonel, setFiltrePersonel,
  filtreTarihBas, setFiltreTarihBas, filtreTarihBit, setFiltreTarihBit,
  mekanlar, personeller, onReset,
}: FiltrePaneliProps) {
  const [acik, setAcik] = useState(false);

  const chipStyle = (active: boolean, color = '#a78bfa') => ({
    padding: '5px 12px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    border: `1px solid ${active ? color : 'rgba(255,255,255,0.1)'}`,
    background: active ? `${color}22` : 'rgba(255,255,255,0.04)',
    color: active ? color : 'rgba(255,255,255,0.5)',
    transition: 'all 0.15s',
  } as React.CSSProperties);

  const inputStyle = {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: '7px 10px',
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    outline: 'none',
  } as React.CSSProperties;

  const selectStyle = { ...inputStyle };

  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, marginBottom: 12, overflow: 'hidden' }}>
      <button
        onClick={() => setAcik(!acik)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: '#a78bfa' }} />
          <span className="text-white/70 font-semibold" style={{ fontSize: 12 }}>Filtrele & Ara</span>
        </div>
        {acik ? <ChevronUp className="w-3.5 h-3.5 text-white/30" /> : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
      </button>

      <AnimatePresence>
        {acik && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 pb-4 space-y-3">
              {/* Tarih aralığı */}
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

              {/* Vardiya türü */}
              <div>
                <p className="text-white/40 mb-2" style={{ fontSize: 10 }}>Vardiya Türü</p>
                <div className="flex flex-wrap gap-1.5">
                  {(['hepsi', 'rotasyon', 'ekstra-is', 'ozel-is'] as const).map(t => (
                    <button key={t} onClick={() => setFiltreTur(t)} style={chipStyle(filtreTur === t)}>
                      {t === 'hepsi' ? 'Hepsi' : TUR_RENK[t].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mekan */}
              <div>
                <p className="text-white/40 mb-1" style={{ fontSize: 10 }}>Mekan</p>
                <select value={filtreMekan} onChange={e => setFiltreMekan(e.target.value)} style={selectStyle}>
                  <option value="hepsi">Tüm Mekanlar</option>
                  {mekanlar.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              {/* Personel */}
              <div>
                <p className="text-white/40 mb-1" style={{ fontSize: 10 }}>Personel</p>
                <select value={filtrePersonel} onChange={e => setFiltrePersonel(e.target.value)} style={selectStyle}>
                  <option value="hepsi">Tüm Personel</option>
                  {personeller.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <button onClick={onReset} className="flex items-center gap-1.5 text-white/40 hover:text-white/60 transition-colors" style={{ fontSize: 11 }}>
                <RefreshCw className="w-3 h-3" /> Filtreleri Sıfırla
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Vardiya Detay İçeriği (3 layoutta da paylaşılan) ──
function VardiyaDetay({ v }: { v: VardiyaKayit }) {
  const toplam = vardiyaToplam(v);
  const tur = TUR_RENK[v.tur];
  const [en, enAdet] = enCokSatan(v);

  const sectionStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: '14px 16px',
    marginBottom: 10,
  } as React.CSSProperties;

  const labelStyle = { fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6 };
  const valStyle   = { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: 700 };
  const subStyle   = { fontSize: 11, color: 'rgba(255,255,255,0.5)' };

  return (
    <div>
      {/* Başlık */}
      <div className="flex items-center gap-3 mb-4">
        <div style={{ fontSize: 28 }}>{v.mekanIcon}</div>
        <div className="flex-1">
          <p className="text-white font-bold" style={{ fontSize: 16 }}>{v.mekan}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span style={{ ...labelStyle, marginBottom: 0, fontSize: 9 }}>{formatTarih(v.tarih)}</span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>•</span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{v.acilisSaat} – {v.kapanisSaat}</span>
          </div>
        </div>
        <div style={{ background: tur.bg, border: `1px solid ${tur.text}40`, borderRadius: 20, padding: '4px 10px', fontSize: 10, color: tur.text, fontWeight: 700 }}>
          {tur.icon} {tur.label}
        </div>
      </div>

      {/* Anomali uyarısı */}
      {v.anomaliler.length > 0 && (
        <div className="mb-3 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(251,146,60,0.3)', background: 'rgba(251,146,60,0.08)' }}>
          {v.anomaliler.map((a, i) => (
            <div key={i} className="flex items-start gap-2.5 px-3 py-2.5">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#fb923c' }} />
              <div>
                <p style={{ fontSize: 11, color: '#fb923c', fontWeight: 700 }}>
                  {a.tip === 'stok' ? 'Stok Anomalisi' : 'Yazıcı Anomalisi'}
                  {' '}— {a.puan} puan
                </p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{a.aciklama}</p>
                <p style={{ fontSize: 10, color: '#fb923c', marginTop: 2 }}>Etkilenen: {a.etkilenen.join(', ')}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Özet metrikler */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {[
          { label: 'Toplam Kare', val: v.toplamKare, icon: Camera, color: '#818cf8' },
          { label: 'İade Kare',   val: v.toplamIade, icon: RefreshCw, color: '#f87171' },
          { label: 'En Çok Satan', val: `${en} × ${enAdet}`, icon: Star, color: '#fbbf24', isStr: true },
          { label: 'Ort. Sepet',  val: `₺${ortalamaSepet(v)}`, icon: BarChart3, color: '#34d399', isStr: true },
        ].map(m => {
          const Icon = m.icon;
          return (
            <div key={m.label} style={{ ...sectionStyle, padding: '10px 12px', marginBottom: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 10, background: `${m.color}18`, border: `1px solid ${m.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon style={{ width: 13, height: 13, color: m.color }} />
              </div>
              <div>
                <p style={labelStyle}>{m.label}</p>
                <p style={{ ...valStyle, fontSize: 13, color: m.color }}>{m.isStr ? m.val : m.val.toLocaleString('tr-TR')}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Personel bazlı ──────────── */}
      <div style={sectionStyle}>
        <p style={labelStyle}><Users style={{ width: 10, height: 10, display: 'inline', marginRight: 4 }} />Personel Detayı</p>
        <div className="space-y-3">
          {v.personeller.map(p => (
            <div key={p.ad} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2 mb-2">
                <span style={{ fontSize: 18 }}>{p.avatar}</span>
                <div className="flex-1">
                  <p style={valStyle}>{p.ad}</p>
                  <p style={subStyle}>{p.kare} kare · {p.iade} iade</p>
                </div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#34d399' }}>₺{toplamCiro(p).toLocaleString('tr-TR')}</p>
              </div>

              {/* Ödeme detayı */}
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {[
                  { label: 'Nakit',   icon: Banknote,    val: p.nakit,  color: '#34d399' },
                  { label: 'IBAN',    icon: Wallet,      val: p.iban,   color: '#60a5fa' },
                  { label: 'Kredi',   icon: CreditCard,  val: p.kredi,  color: '#f472b6' },
                ].map(od => {
                  const Icon = od.icon;
                  return (
                    <div key={od.label} style={{ background: `${od.color}10`, borderRadius: 8, padding: '6px 8px', border: `1px solid ${od.color}20` }}>
                      <div className="flex items-center gap-1 mb-1">
                        <Icon style={{ width: 9, height: 9, color: od.color }} />
                        <span style={{ fontSize: 9, color: od.color, fontWeight: 700 }}>{od.label}</span>
                      </div>
                      <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>{formatPara(od.val)}</p>
                    </div>
                  );
                })}
              </div>

              {/* Ürün dökümü */}
              <div>
                <p style={{ ...labelStyle, marginBottom: 4 }}>Ürün Dökümü</p>
                <div className="flex flex-wrap gap-1">
                  {p.satirlar.map((s, i) => (
                    <span key={i} style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.2)', color: 'rgba(255,255,255,0.6)' }}>
                      {s.urun} × {s.adet} ({s.para === 'TRY' ? '₺' : s.para === 'EUR' ? '€' : '$'}{s.birimFiyat})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Toplam ciro ──────────── */}
      <div style={sectionStyle}>
        <p style={labelStyle}><TrendingUp style={{ width: 10, height: 10, display: 'inline', marginRight: 4 }} />Toplam Ciro</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Nakit',  val: toplam.nakit,  color: '#34d399', icon: Banknote },
            { label: 'IBAN',   val: toplam.iban,   color: '#60a5fa', icon: Wallet   },
            { label: 'Kredi',  val: toplam.kredi,  color: '#f472b6', icon: CreditCard },
          ].map(t => {
            const Icon = t.icon;
            return (
              <div key={t.label} style={{ background: `${t.color}10`, borderRadius: 10, padding: '10px 10px', border: `1px solid ${t.color}20` }}>
                <div className="flex items-center gap-1 mb-1.5">
                  <Icon style={{ width: 11, height: 11, color: t.color }} />
                  <span style={{ fontSize: 10, color: t.color, fontWeight: 700 }}>{t.label}</span>
                </div>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>{formatPara(t.val)}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between px-1">
          <span style={subStyle}>Tahmini Toplam (TL bazlı)</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#a78bfa' }}>₺{toplamTL(v).toLocaleString('tr-TR')}</span>
        </div>
      </div>

      {/* Albüm özeti ──────────── */}
      <div style={sectionStyle}>
        <p style={labelStyle}><Package style={{ width: 10, height: 10, display: 'inline', marginRight: 4 }} />Albüm & Baskı Özeti</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {Object.entries(v.albümler).map(([urun, adet]) => (
            <div key={urun} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '6px 10px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{urun}</p>
              <p style={{ fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,0.9)' }}>{adet}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p style={labelStyle}>Albüm Maliyet</p>
            <p style={{ ...valStyle, color: '#f87171' }}>₺{albümMaliyet(v)}</p>
          </div>
          <div>
            <p style={labelStyle}>Baskı Maliyet</p>
            <p style={{ ...valStyle, color: '#f87171' }}>₺{baskiMaliyet(v).toFixed(0)}</p>
          </div>
          <div>
            <p style={labelStyle}>Stok (Baş→Son)</p>
            <p style={{ ...valStyle, color: '#60a5fa' }}>{v.stokBaslangic}→{v.stokBitis}</p>
          </div>
        </div>
      </div>

      {/* Yazıcı sayaçları ──────────── */}
      <div style={sectionStyle}>
        <p style={labelStyle}><Printer style={{ width: 10, height: 10, display: 'inline', marginRight: 4 }} />Yazıcı Sayaçları</p>
        <div className="space-y-2">
          {v.yazicilar.map(y => (
            <div key={y.ad} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '8px 12px', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 700, marginBottom: 4 }}>{y.ad}</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Açılış', val: y.baslangic },
                  { label: 'Kapanış', val: y.bitis },
                  { label: 'Net Basılan', val: y.netBasilan },
                ].map(s => (
                  <div key={s.label}>
                    <p style={labelStyle}>{s.label}</p>
                    <p style={{ ...valStyle, fontSize: 12 }}>{s.val.toLocaleString('tr-TR')}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Özet Kart (liste için) ────────────────────────────
function OzetKart({ v, onClick, aktiF }: { v: VardiyaKayit; onClick?: () => void; aktiF?: boolean }) {
  const tur = TUR_RENK[v.tur];
  const tl  = toplamTL(v);
  const hastaAnomali = v.anomaliler.length > 0;

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{
        background: aktiF ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${aktiF ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 14,
        padding: '12px 14px',
        cursor: onClick ? 'pointer' : 'default',
        marginBottom: 8,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {hastaAnomali && (
        <div style={{ position: 'absolute', top: 8, right: 8 }}>
          <AlertTriangle className="w-3 h-3" style={{ color: '#fb923c' }} />
        </div>
      )}
      <div className="flex items-center gap-3">
        <div style={{ fontSize: 26, flexShrink: 0 }}>{v.mekanIcon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-white font-bold truncate" style={{ fontSize: 13 }}>{v.mekan}</span>
            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 10, background: tur.bg, color: tur.text, fontWeight: 700, flexShrink: 0 }}>{tur.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{formatTarih(v.tarih)}</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>·</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{v.acilisSaat}–{v.kapanisSaat}</span>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <span style={{ fontSize: 10, color: '#818cf8' }}>👥 {v.personeller.map(p => p.ad.split(' ')[0]).join(', ')}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p style={{ fontSize: 14, fontWeight: 800, color: '#a78bfa' }}>₺{tl.toLocaleString('tr-TR')}</p>
          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>{v.toplamKare} kare</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────────────────── Layout A — Accordion ─────────────────────── */
function LayoutAccordion({ vardiyas }: { vardiyas: VardiyaKayit[] }) {
  const [acikId, setAcikId] = useState<string | null>(null);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 px-1">
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa' }} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
          LAYOUT A — Accordion ({vardiyas.length} vardiya)
        </span>
      </div>
      {vardiyas.length === 0 && (
        <div className="text-center py-12">
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Filtre sonucu bulunamadı.</p>
        </div>
      )}
      {vardiyas.map(v => (
        <div key={v.id} style={{ marginBottom: 8, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
          {/* Başlık satırı */}
          <button
            onClick={() => setAcikId(acikId === v.id ? null : v.id)}
            className="w-full flex items-center gap-3 px-4 py-3"
          >
            <span style={{ fontSize: 22 }}>{v.mekanIcon}</span>
            <div className="flex-1 text-left">
              <p className="text-white font-bold" style={{ fontSize: 13 }}>{v.mekan}</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{formatTarih(v.tarih)} · {v.acilisSaat}–{v.kapanisSaat}</p>
            </div>
            <div className="text-right mr-2">
              <p style={{ fontSize: 13, fontWeight: 800, color: '#a78bfa' }}>₺{toplamTL(v).toLocaleString('tr-TR')}</p>
              {v.anomaliler.length > 0 && <AlertTriangle className="w-3 h-3 ml-auto mt-0.5" style={{ color: '#fb923c' }} />}
            </div>
            <div style={{ transition: 'transform 0.2s', transform: acikId === v.id ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <ChevronDown className="w-4 h-4 text-white/30" />
            </div>
          </button>

          {/* İçerik */}
          <AnimatePresence>
            {acikId === v.id && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                transition={{ duration: 0.25 }}
                style={{ overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div className="px-4 py-4">
                  <VardiyaDetay v={v} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────── Layout B — Master/Detail ─────────────────────── */
function LayoutMasterDetail({ vardiyas }: { vardiyas: VardiyaKayit[] }) {
  const [seciliId, setSeciliId] = useState<string | null>(null);
  const secili = vardiyas.find(v => v.id === seciliId);

  if (secili) {
    return (
      <div>
        <button
          onClick={() => setSeciliId(null)}
          className="flex items-center gap-2 mb-4 text-white/60 hover:text-white/90 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Geri Dön</span>
        </button>
        <VardiyaDetay v={secili} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 px-1">
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa' }} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
          LAYOUT B — Master/Detail ({vardiyas.length} vardiya)
        </span>
      </div>
      {vardiyas.length === 0 && (
        <div className="text-center py-12">
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Filtre sonucu bulunamadı.</p>
        </div>
      )}
      {vardiyas.map(v => (
        <OzetKart key={v.id} v={v} aktiF={seciliId === v.id} onClick={() => setSeciliId(v.id)} />
      ))}
    </div>
  );
}

/* ─────────────────────── Layout C — Modal ─────────────────────── */
function LayoutModal({ vardiyas }: { vardiyas: VardiyaKayit[] }) {
  const [seciliId, setSeciliId] = useState<string | null>(null);
  const secili = vardiyas.find(v => v.id === seciliId);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 px-1">
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399' }} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
          LAYOUT C — Modal Popup ({vardiyas.length} vardiya)
        </span>
      </div>
      {vardiyas.length === 0 && (
        <div className="text-center py-12">
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Filtre sonucu bulunamadı.</p>
        </div>
      )}
      {vardiyas.map(v => (
        <OzetKart key={v.id} v={v} onClick={() => setSeciliId(v.id)} />
      ))}

      {/* Modal */}
      <AnimatePresence>
        {secili && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSeciliId(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 200 }}
            />
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 280 }}
              style={{
                position: 'fixed',
                left: '50%',
                transform: 'translateX(-50%)',
                bottom: 0,
                width: '100%',
                maxWidth: 480,
                maxHeight: '88vh',
                background: 'linear-gradient(170deg, #120830 0%, #1a0a3c 50%, #0f0620 100%)',
                borderRadius: '20px 20px 0 0',
                border: '1px solid rgba(255,255,255,0.1)',
                zIndex: 201,
                overflowY: 'auto',
              }}
            >
              {/* Modal başlık */}
              <div className="sticky top-0 flex items-center justify-between px-4 py-3" style={{ background: 'rgba(18,8,48,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-white font-bold" style={{ fontSize: 14 }}>Vardiya Raporu</p>
                <button onClick={() => setSeciliId(null)} className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <X className="w-3.5 h-3.5 text-white/70" />
                </button>
              </div>
              <div className="px-4 py-4">
                <VardiyaDetay v={secili} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────── Ana Bileşen ─────────────────────── */
interface Props {
  userName:   string;
  userRole:   UserRole;
  onLogout:   () => void;
  onNavigate: (tab: string) => void;
}

export function VardiyaRaporlari({ userName, userRole, onLogout, onNavigate }: Props) {
  const [aktifLayout, setAktifLayout] = useState<'A' | 'B' | 'C'>('A');

  // Filtreler
  const [filtreTur,       setFiltreTur]       = useState('hepsi');
  const [filtreMekan,     setFiltreMekan]     = useState('hepsi');
  const [filtrePersonel,  setFiltrePersonel]  = useState('hepsi');
  const [filtreTarihBas,  setFiltreTarihBas]  = useState('');
  const [filtreTarihBit,  setFiltreTarihBit]  = useState('');

  const mekanlar    = useMemo(() => [...new Set(MOCK_VARDIYAS.map(v => v.mekan))], []);
  const personeller = useMemo(() => [...new Set(MOCK_VARDIYAS.flatMap(v => v.personeller.map(p => p.ad)))], []);

  const filtrelenmis = useMemo(() => {
    return MOCK_VARDIYAS.filter(v => {
      if (filtreTur !== 'hepsi' && v.tur !== filtreTur) return false;
      if (filtreMekan !== 'hepsi' && v.mekan !== filtreMekan) return false;
      if (filtrePersonel !== 'hepsi' && !v.personeller.some(p => p.ad === filtrePersonel)) return false;
      if (filtreTarihBas && v.tarih < filtreTarihBas) return false;
      if (filtreTarihBit && v.tarih > filtreTarihBit) return false;
      return true;
    }).sort((a, b) => b.tarih.localeCompare(a.tarih));
  }, [filtreTur, filtreMekan, filtrePersonel, filtreTarihBas, filtreTarihBit]);

  const resetFiltreler = () => {
    setFiltreTur('hepsi');
    setFiltreMekan('hepsi');
    setFiltrePersonel('hepsi');
    setFiltreTarihBas('');
    setFiltreTarihBit('');
  };

  const LAYOUTS = [
    { key: 'A' as const, label: 'Accordion', icon: LayoutList,    color: '#a78bfa' },
    { key: 'B' as const, label: 'Master/Detail', icon: PanelLeftOpen, color: '#60a5fa' },
    { key: 'C' as const, label: 'Modal',     icon: Layers,         color: '#34d399' },
  ];

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <button
          onClick={() => onNavigate('dashboard')}
          className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <ArrowLeft className="w-4 h-4 text-white/70" />
        </button>
        <div className="flex-1">
          <h1 className="text-white font-black" style={{ fontSize: 18 }}>Vardiya Raporları</h1>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Demo · 3 layout seçeneği</p>
        </div>
        <div style={{ fontSize: 9, padding: '4px 10px', borderRadius: 20, background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.3)', color: '#fb923c', fontWeight: 700 }}>
          DEMO
        </div>
      </div>

      {/* Layout seçici */}
      <div className="px-4 mb-3">
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600, marginBottom: 8, letterSpacing: '0.08em' }}>
          BİR LAYOUT SEÇ — BEĞENDIĞINI SÖYLE, DİĞERLERİNİ SİLELİM
        </p>
        <div className="flex gap-2">
          {LAYOUTS.map(l => {
            const Icon = l.icon;
            const aktif = aktifLayout === l.key;
            return (
              <button
                key={l.key}
                onClick={() => setAktifLayout(l.key)}
                style={{
                  flex: 1,
                  padding: '8px 6px',
                  borderRadius: 12,
                  border: `1px solid ${aktif ? l.color + '60' : 'rgba(255,255,255,0.08)'}`,
                  background: aktif ? `${l.color}18` : 'rgba(255,255,255,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.15s',
                }}
              >
                <Icon style={{ width: 16, height: 16, color: aktif ? l.color : 'rgba(255,255,255,0.35)' }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: aktif ? l.color : 'rgba(255,255,255,0.4)', letterSpacing: '0.04em' }}>
                  {l.key}. {l.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filtreler */}
      <div className="px-4">
        <FiltrePaneli
          filtreTur={filtreTur} setFiltreTur={setFiltreTur}
          filtreMekan={filtreMekan} setFiltreMekan={setFiltreMekan}
          filtrePersonel={filtrePersonel} setFiltrePersonel={setFiltrePersonel}
          filtreTarihBas={filtreTarihBas} setFiltreTarihBas={setFiltreTarihBas}
          filtreTarihBit={filtreTarihBit} setFiltreTarihBit={setFiltreTarihBit}
          mekanlar={mekanlar} personeller={personeller}
          onReset={resetFiltreler}
        />
      </div>

      {/* İçerik */}
      <div className="px-4 pb-8">
        <AnimatePresence mode="wait">
          {aktifLayout === 'A' && (
            <motion.div key="A" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <LayoutAccordion vardiyas={filtrelenmis} />
            </motion.div>
          )}
          {aktifLayout === 'B' && (
            <motion.div key="B" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <LayoutMasterDetail vardiyas={filtrelenmis} />
            </motion.div>
          )}
          {aktifLayout === 'C' && (
            <motion.div key="C" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <LayoutModal vardiyas={filtrelenmis} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
