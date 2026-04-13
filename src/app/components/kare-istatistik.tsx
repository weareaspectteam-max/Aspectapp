import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, RefreshCw, Camera, ChevronDown, ChevronUp,
  Filter, Calendar, MapPin, User, TrendingUp, Award, Printer,
} from 'lucide-react';
import { getToken, buildHeaders, appendGhostParam } from '../lib/api';
import { projectId } from '../lib/supabase-info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.10)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: 20,
};

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ── Types ───────────────────────────────
interface GunPerf {
  tarih: string;
  mekanId: string;
  mekanAd: string;
  mekanEmoji: string;
  musteriSayisi: number;
  kota: number;
  kisiBasiKota: number;
  cektigiKare: number;
  cekimYuzde: number;
  baskiDonusumYuzde: number;
}

interface PersonelPerf {
  id: string;
  ad: string;
  toplamKare: number;
  toplamSorumluMusteri: number;
  gunSayisi: number;
  ortCekimYuzde: number;
  ortBaskiDonusumYuzde: number;
  gunler: GunPerf[];
}

interface MekanOption {
  id: string;
  name: string;
  emoji: string;
}

interface KareIstatistikProps {
  userName: string;
  userRole: string;
  onNavigate: (tab: string) => void;
  onLogout: () => void;
}

// ── Tarih yardımcıları ──────────────────
function bugun(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function ayBaslangic(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function haftaPazartesi(): string {
  const d = new Date();
  const gun = d.getDay();
  const fark = gun === 0 ? 6 : gun - 1;
  d.setDate(d.getDate() - fark);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function uc_ay_once(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function formatTarih(s: string): string {
  const [y, m, d] = s.split('-');
  return `${d}/${m}`;
}
function formatTarihFull(s: string): string {
  return new Date(s).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

// ── Renk yardımcıları ───────────────────
function cekimRenk(yuzde: number): string {
  if (yuzde >= 120) return '#22c55e';
  if (yuzde >= 100) return '#4ade80';
  if (yuzde >= 80) return '#fbbf24';
  return '#f87171';
}
function baskiRenk(yuzde: number): string {
  if (yuzde >= 70) return '#4ade80';
  if (yuzde >= 50) return '#fbbf24';
  return '#f87171';
}

const RANK_COLORS = ['#fbbf24', '#c0c0c0', '#cd7f32', '#60a5fa', '#a855f7', '#34d399'];

// ── Ana bileşen ─────────────────────────
export function KareIstatistik({ userName, userRole, onNavigate }: KareIstatistikProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [personeller, setPersoneller] = useState<PersonelPerf[]>([]);
  const [genelOrtCekim, setGenelOrtCekim] = useState(0);
  const [genelOrtBaski, setGenelOrtBaski] = useState(0);
  const [mekanlar, setMekanlar] = useState<MekanOption[]>([]);

  // Filtreler
  const [baslangic, setBaslangic] = useState(ayBaslangic());
  const [bitis, setBitis] = useState(bugun());
  const [seciliMekan, setSeciliMekan] = useState('');
  const [personelFilter, setPersonelFilter] = useState('');
  const [filtreAcik, setFiltreAcik] = useState(false);
  const [tarihPreset, setTarihPreset] = useState('bu-ay');

  // Açık personel detayları
  const [acikPersoneller, setAcikPersoneller] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      const params = new URLSearchParams();
      if (baslangic) params.set('baslangic', baslangic);
      if (bitis) params.set('bitis', bitis);
      if (seciliMekan) params.set('mekanId', seciliMekan);

      // Performans endpoint'i
      const url = appendGhostParam(`${API_BASE}/kare/performans?${params.toString()}`);
      const res = await fetch(url, { headers: buildHeaders(token) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sunucu hatası');

      setPersoneller(data.personeller || []);
      setGenelOrtCekim(data.genelOrtCekimYuzde || 0);
      setGenelOrtBaski(data.genelOrtBaskiDonusumYuzde || 0);

      // Mekanları ayrıca çek (ilk sefer)
      if (mekanlar.length === 0) {
        try {
          const mRes = await fetch(appendGhostParam(`${API_BASE}/mekanlar`), { headers: buildHeaders(token) });
          if (mRes.ok) {
            const mData = await mRes.json();
            setMekanlar((mData.mekanlar || []).map((m: any) => ({ id: m.id, name: m.name, emoji: m.emoji })));
          }
        } catch {}
      }
    } catch (e: any) {
      setError(e.message || 'Veri alınamadı');
    } finally {
      setLoading(false);
    }
  }, [baslangic, bitis, seciliMekan]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const togglePersonel = (id: string) => {
    setAcikPersoneller(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const setTarih = (preset: string) => {
    setTarihPreset(preset);
    switch (preset) {
      case 'bugun': setBaslangic(bugun()); setBitis(bugun()); break;
      case 'hafta': setBaslangic(haftaPazartesi()); setBitis(bugun()); break;
      case 'bu-ay': setBaslangic(ayBaslangic()); setBitis(bugun()); break;
      case 'son-3-ay': setBaslangic(uc_ay_once()); setBitis(bugun()); break;
    }
  };

  // Personel filtresi
  const filtrelenmis = personelFilter
    ? personeller.filter(p => p.ad.toLowerCase().includes(personelFilter.toLowerCase()))
    : personeller;

  return (
    <div className="min-h-screen pb-32" style={{ background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%))' }}>
      <div className="px-4 pt-4 space-y-4">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('isletme-istatistikleri')}
            style={{ ...glass, padding: 10, borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <ArrowLeft className="w-4 h-4 text-white/60" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-black text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5" style={{ color: '#4ade80' }} />
              Personel Performans İstatistikleri
            </h1>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Çekim & baskı dönüşüm analizi</p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            style={{ ...glass, padding: 10, borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <RefreshCw className={`w-4 h-4 text-white/60 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </motion.div>

        {/* ── Tarih hızlı butonları ── */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { key: 'bugun', label: 'Bugün' },
            { key: 'hafta', label: 'Son 1 Hafta' },
            { key: 'bu-ay', label: 'Bu Ay' },
            { key: 'son-3-ay', label: 'Son 3 Ay' },
          ].map(b => (
            <button key={b.key} onClick={() => setTarih(b.key)}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 10, fontSize: 10, fontWeight: 800,
                color: tarihPreset === b.key ? 'white' : 'rgba(255,255,255,0.45)',
                background: tarihPreset === b.key ? 'rgba(74,222,128,0.20)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${tarihPreset === b.key ? 'rgba(74,222,128,0.40)' : 'rgba(255,255,255,0.08)'}`,
                cursor: 'pointer', transition: 'all 0.2s',
              }}>
              {b.label}
            </button>
          ))}
        </div>

        {/* ── Filtre paneli ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          style={{ ...glass, padding: 14, overflow: 'hidden' }}>
          <button
            onClick={() => setFiltreAcik(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <Filter className="w-4 h-4" style={{ color: '#4ade80' }} />
            <span style={{ color: '#4ade80', fontSize: 13, fontWeight: 700, flex: 1, textAlign: 'left' }}>Filtreler</span>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>
              {formatTarih(baslangic)} — {formatTarih(bitis)}
              {seciliMekan ? ` · ${mekanlar.find(m => m.id === seciliMekan)?.name || ''}` : ''}
            </span>
            <div style={{ color: 'rgba(74,222,128,0.5)' }}>
              {filtreAcik ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          <AnimatePresence>
            {filtreAcik && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Tarih özel aralık */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                        <Calendar className="w-3 h-3" /> Başlangıç
                      </label>
                      <input type="date" value={baslangic} onChange={e => { setBaslangic(e.target.value); setTarihPreset('ozel'); }}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600, color: 'white', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', outline: 'none' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                        <Calendar className="w-3 h-3" /> Bitiş
                      </label>
                      <input type="date" value={bitis} onChange={e => { setBitis(e.target.value); setTarihPreset('ozel'); }}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600, color: 'white', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', outline: 'none' }} />
                    </div>
                  </div>

                  {/* Mekan */}
                  <div>
                    <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                      <MapPin className="w-3 h-3" /> Mekan
                    </label>
                    <select value={seciliMekan} onChange={e => setSeciliMekan(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600, color: 'white', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', outline: 'none' }}>
                      <option value="" style={{ background: 'black' }}>Tüm Mekanlar</option>
                      {mekanlar.map(m => (
                        <option key={m.id} value={m.id} style={{ background: 'black' }}>{m.emoji} {m.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Personel arama */}
                  <div>
                    <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                      <User className="w-3 h-3" /> Personel Ara
                    </label>
                    <input type="text" value={personelFilter} onChange={e => setPersonelFilter(e.target.value)}
                      placeholder="İsim yazın..."
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600, color: 'white', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', outline: 'none' }} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Özet kartları ── */}
        {!loading && personeller.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className="grid grid-cols-3 gap-3">
            {[
              { label: 'Çekim Perf.', val: `%${genelOrtCekim}`, color: cekimRenk(genelOrtCekim), bg: `${cekimRenk(genelOrtCekim)}15`, border: `${cekimRenk(genelOrtCekim)}35`, icon: '📸' },
              { label: 'Baskı Dön.', val: `%${genelOrtBaski}`, color: baskiRenk(genelOrtBaski), bg: `${baskiRenk(genelOrtBaski)}15`, border: `${baskiRenk(genelOrtBaski)}35`, icon: '🖨️' },
              { label: 'Personel', val: filtrelenmis.length.toString(), color: '#a855f7', bg: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.25)', icon: '👥' },
            ].map(c => (
              <div key={c.label} style={{ ...glass, padding: '12px 10px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: 16, textAlign: 'center' }}>
                <p style={{ fontSize: 10, marginBottom: 2 }}>{c.icon}</p>
                <p style={{ color: c.color, fontSize: 18, fontWeight: 900 }}>{c.val}</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 700, marginTop: 2 }}>{c.label}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* ── Yükleniyor ── */}
        {loading && (
          <div className="flex flex-col items-center py-12 gap-3">
            <div className="w-10 h-10 border-4 border-green-500/30 border-t-green-400 rounded-full animate-spin" />
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Performans verileri yükleniyor...</p>
          </div>
        )}

        {/* ── Hata ── */}
        {error && (
          <div style={{ ...glass, padding: 16, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 16 }}>
            <p style={{ color: '#fca5a5', fontSize: 13 }}>{error}</p>
          </div>
        )}

        {/* ── Boş durum ── */}
        {!loading && !error && personeller.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ ...glass, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
            <p style={{ color: 'white', fontWeight: 700, marginBottom: 6 }}>Performans verisi yok</p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>Seçili dönemde müşteri sayısı girilmiş ve kare kaydı olan veri bulunamadı</p>
          </motion.div>
        )}

        {/* ── Personel listesi ── */}
        {!loading && filtrelenmis.length > 0 && (
          <div className="space-y-3">
            {filtrelenmis.map((p, pi) => {
              const acik = acikPersoneller.has(p.id);
              const rankColor = RANK_COLORS[Math.min(pi, RANK_COLORS.length - 1)];

              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: pi * 0.03 }}
                  style={{ ...glass, overflow: 'hidden' }}
                >
                  {/* Personel satırı */}
                  <button
                    onClick={() => togglePersonel(p.id)}
                    style={{ width: '100%', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {/* Sıra */}
                      <div style={{
                        width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                        background: pi < 3 ? `${rankColor}25` : 'rgba(255,255,255,0.06)',
                        border: `1.5px solid ${pi < 3 ? rankColor + '50' : 'rgba(255,255,255,0.1)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 900,
                        color: pi < 3 ? rankColor : 'rgba(255,255,255,0.4)',
                      }}>
                        {pi + 1}
                      </div>

                      {/* Avatar */}
                      <div style={{
                        width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                        background: `${rankColor}15`,
                        border: `1.5px solid ${rankColor}35`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 800, color: rankColor,
                      }}>
                        {getInitials(p.ad)}
                      </div>

                      {/* İsim + özet */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>{p.ad}</p>
                        <p style={{ color: 'rgba(255,255,255,0.30)', fontSize: 9 }}>
                          {p.gunSayisi} gün · {p.toplamKare.toLocaleString('tr-TR')} kare · 👥 {p.toplamSorumluMusteri.toLocaleString('tr-TR')}
                        </p>
                      </div>

                      {/* Performans badge'leri */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0, alignItems: 'flex-end' }}>
                        <div style={{
                          padding: '2px 8px', borderRadius: 7, fontSize: 11, fontWeight: 900,
                          color: cekimRenk(p.ortCekimYuzde),
                          background: `${cekimRenk(p.ortCekimYuzde)}15`,
                          border: `1px solid ${cekimRenk(p.ortCekimYuzde)}35`,
                        }}>
                          📸 %{p.ortCekimYuzde}
                        </div>
                        <div style={{
                          padding: '2px 8px', borderRadius: 7, fontSize: 10, fontWeight: 800,
                          color: baskiRenk(p.ortBaskiDonusumYuzde),
                          background: `${baskiRenk(p.ortBaskiDonusumYuzde)}15`,
                          border: `1px solid ${baskiRenk(p.ortBaskiDonusumYuzde)}35`,
                        }}>
                          🖨️ %{p.ortBaskiDonusumYuzde}
                        </div>
                      </div>

                      <div style={{ color: 'rgba(255,255,255,0.25)' }}>
                        {acik ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </button>

                  {/* Detay */}
                  <AnimatePresence>
                    {acik && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{ padding: '0 16px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>

                          {/* Özet satırı */}
                          <div style={{ display: 'flex', gap: 8, marginTop: 10, marginBottom: 10 }}>
                            {[
                              { label: 'Çekim Perf.', val: `%${p.ortCekimYuzde}`, color: cekimRenk(p.ortCekimYuzde) },
                              { label: 'Baskı Dön.', val: `%${p.ortBaskiDonusumYuzde}`, color: baskiRenk(p.ortBaskiDonusumYuzde) },
                              { label: 'Müşteri', val: p.toplamSorumluMusteri.toLocaleString('tr-TR'), color: '#ffd4a3' },
                              { label: 'Kare', val: p.toplamKare.toLocaleString('tr-TR'), color: '#60a5fa' },
                            ].map(s => (
                              <div key={s.label} style={{ flex: 1, textAlign: 'center', padding: '6px 4px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <p style={{ color: s.color, fontSize: 14, fontWeight: 900 }}>{s.val}</p>
                                <p style={{ color: 'rgba(255,255,255,0.30)', fontSize: 8, fontWeight: 700 }}>{s.label}</p>
                              </div>
                            ))}
                          </div>

                          {/* Gün bazlı detay */}
                          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Gün Detayı
                          </p>
                          <div className="space-y-1">
                            {p.gunler.map((g, gi) => (
                              <div key={gi} style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '6px 8px', borderRadius: 8,
                                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                              }}>
                                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 600, minWidth: 38 }}>
                                  {formatTarihFull(g.tarih)}
                                </span>
                                <span style={{ fontSize: 12 }}>{g.mekanEmoji}</span>
                                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.30)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {g.mekanAd}
                                </span>
                                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>
                                  👥{g.musteriSayisi}
                                </span>
                                <span style={{ fontSize: 10, fontWeight: 800, color: '#60a5fa' }}>
                                  {g.cektigiKare}
                                </span>
                                <div style={{
                                  padding: '1px 5px', borderRadius: 5, fontSize: 9, fontWeight: 800,
                                  color: cekimRenk(g.cekimYuzde),
                                  background: `${cekimRenk(g.cekimYuzde)}12`,
                                  border: `1px solid ${cekimRenk(g.cekimYuzde)}30`,
                                }}>
                                  %{g.cekimYuzde}
                                </div>
                                <div style={{
                                  padding: '1px 5px', borderRadius: 5, fontSize: 9, fontWeight: 800,
                                  color: baskiRenk(g.baskiDonusumYuzde),
                                  background: `${baskiRenk(g.baskiDonusumYuzde)}12`,
                                  border: `1px solid ${baskiRenk(g.baskiDonusumYuzde)}30`,
                                }}>
                                  🖨️%{g.baskiDonusumYuzde}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
