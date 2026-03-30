import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, RefreshCw, Camera, ChevronDown, ChevronUp,
  Filter, Calendar, MapPin, User, TrendingUp, Award,
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
interface GunDetay {
  tarih: string;
  mekanId: string;
  mekanAd: string;
  kare: number;
  gunToplam: number;
  yuzde: number;
}

interface MekanDetay {
  mekanId: string;
  mekanAd: string;
  mekanEmoji: string;
  mekanColor: string;
  kare: number;
}

interface PersonelKare {
  id: string;
  ad: string;
  toplamKare: number;
  genelYuzde: number;
  gunSayisi: number;
  gunDetay: GunDetay[];
  mekanDetay: MekanDetay[];
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
function haftaPazartesi(): string {
  const d = new Date();
  const gun = d.getDay(); // 0=Pazar, 1=Pazartesi...
  const fark = gun === 0 ? 6 : gun - 1; // Pazartesi'ye kaç gün geri
  d.setDate(d.getDate() - fark);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function haftaPazar(): string {
  const d = new Date();
  const gun = d.getDay();
  const fark = gun === 0 ? 0 : 7 - gun; // Pazar'a kaç gün ileri
  d.setDate(d.getDate() + fark);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatTarih(s: string): string {
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

// ── Sıralama bar renkleri ───────────────
const RANK_COLORS = ['#fbbf24', '#c0c0c0', '#cd7f32', '#60a5fa', '#a855f7', '#34d399'];

// ── Ana bileşen ─────────────────────────
export function KareIstatistik({ userName, userRole, onNavigate }: KareIstatistikProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [personeller, setPersoneller] = useState<PersonelKare[]>([]);
  const [genelToplam, setGenelToplam] = useState(0);
  const [mekanlar, setMekanlar] = useState<MekanOption[]>([]);

  // Filtreler
  const [baslangic, setBaslangic] = useState(haftaPazartesi());
  const [bitis, setBitis] = useState(haftaPazar());
  const [seciliMekan, setSeciliMekan] = useState('');
  const [personelFilter, setPersonelFilter] = useState('');
  const [filtreAcik, setFiltreAcik] = useState(false);

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
      const url = appendGhostParam(`${API_BASE}/kare/istatistik?${params.toString()}`);
      const res = await fetch(url, { headers: buildHeaders(token) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sunucu hatası');
      setPersoneller(data.personeller || []);
      setGenelToplam(data.genelToplamKare || 0);
      if (data.mekanlar) setMekanlar(data.mekanlar);
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

  // Personel filtresi
  const filtrelenmis = personelFilter
    ? personeller.filter(p => p.ad.toLowerCase().includes(personelFilter.toLowerCase()))
    : personeller;

  // En yüksek kare (bar genişliği için)
  const maxKare = filtrelenmis.length > 0 ? filtrelenmis[0].toplamKare : 1;

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
              <Camera className="w-5 h-5" style={{ color: '#60a5fa' }} />
              Kare İstatistikleri
            </h1>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Personel bazlı fotoğraf karesi analizi</p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            style={{ ...glass, padding: 10, borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <RefreshCw className={`w-4 h-4 text-white/60 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </motion.div>

        {/* ── Filtre paneli ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          style={{ ...glass, padding: 14, overflow: 'hidden' }}>
          <button
            onClick={() => setFiltreAcik(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <Filter className="w-4 h-4" style={{ color: '#60a5fa' }} />
            <span style={{ color: '#60a5fa', fontSize: 13, fontWeight: 700, flex: 1, textAlign: 'left' }}>Filtreler</span>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>
              {formatTarih(baslangic)} — {formatTarih(bitis)}
              {seciliMekan ? ` · ${mekanlar.find(m => m.id === seciliMekan)?.name || ''}` : ''}
            </span>
            <div style={{ color: 'rgba(96,165,250,0.5)' }}>
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
                  {/* Tarih */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                        <Calendar className="w-3 h-3" /> Başlangıç
                      </label>
                      <input type="date" value={baslangic} onChange={e => setBaslangic(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600, color: 'white', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', outline: 'none' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                        <Calendar className="w-3 h-3" /> Bitiş
                      </label>
                      <input type="date" value={bitis} onChange={e => setBitis(e.target.value)}
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

                  {/* Hızlı tarih butonları */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Bugün', fn: () => { setBaslangic(bugun()); setBitis(bugun()); } },
                      { label: 'Bu Hafta', fn: () => { setBaslangic(haftaPazartesi()); setBitis(haftaPazar()); } },
                      { label: 'Bu Ay', fn: () => { const d = new Date(); setBaslangic(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`); setBitis(bugun()); } },
                    ].map(b => (
                      <button key={b.label} onClick={b.fn}
                        style={{ padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700, color: 'rgba(96,165,250,0.8)', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', cursor: 'pointer' }}>
                        {b.label}
                      </button>
                    ))}
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
              { label: 'Toplam Kare', val: genelToplam.toLocaleString('tr-TR'), color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.25)' },
              { label: 'Personel', val: filtrelenmis.length.toString(), color: '#a855f7', bg: 'rgba(var(--app-accent-rgb),0.1)', border: 'rgba(var(--app-accent-rgb),0.25)' },
              { label: 'Ort. Kare', val: filtrelenmis.length > 0 ? Math.round(genelToplam / filtrelenmis.length).toLocaleString('tr-TR') : '0', color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.25)' },
            ].map(c => (
              <div key={c.label} style={{ ...glass, padding: '12px 10px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: 16, textAlign: 'center' }}>
                <p style={{ color: c.color, fontSize: 18, fontWeight: 900 }}>{c.val}</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 700, marginTop: 2 }}>{c.label}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* ── Yükleniyor ── */}
        {loading && (
          <div className="flex flex-col items-center py-12 gap-3">
            <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-400 rounded-full animate-spin" />
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Kare verileri yükleniyor...</p>
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
            <div style={{ fontSize: 40, marginBottom: 12 }}>📸</div>
            <p style={{ color: 'white', fontWeight: 700, marginBottom: 6 }}>Bu dönemde kare kaydı yok</p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>Seçili tarih aralığı ve mekan için kare verisi bulunamadı</p>
          </motion.div>
        )}

        {/* ── Personel listesi ── */}
        {!loading && filtrelenmis.length > 0 && (
          <div className="space-y-3">
            {filtrelenmis.map((p, pi) => {
              const acik = acikPersoneller.has(p.id);
              const rankColor = RANK_COLORS[Math.min(pi, RANK_COLORS.length - 1)];
              const barWidth = maxKare > 0 ? Math.max((p.toplamKare / maxKare) * 100, 4) : 0;

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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* Sıra */}
                      <div style={{
                        width: 28, height: 28, borderRadius: 9, flexShrink: 0,
                        background: pi < 3 ? `${rankColor}25` : 'rgba(255,255,255,0.06)',
                        border: `1.5px solid ${pi < 3 ? rankColor + '50' : 'rgba(255,255,255,0.1)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 900,
                        color: pi < 3 ? rankColor : 'rgba(255,255,255,0.4)',
                      }}>
                        {pi + 1}
                      </div>

                      {/* Avatar */}
                      <div style={{
                        width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                        background: `${rankColor}15`,
                        border: `1.5px solid ${rankColor}35`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 800, color: rankColor,
                      }}>
                        {getInitials(p.ad)}
                      </div>

                      {/* İsim + bilgi */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>{p.ad}</p>
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>
                          {p.gunSayisi} gün · {p.mekanDetay.length} mekan
                        </p>
                      </div>

                      {/* Kare + yüzde */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ color: '#60a5fa', fontSize: 16, fontWeight: 900 }}>
                          {p.toplamKare.toLocaleString('tr-TR')}
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 700 }}>
                          %{p.genelYuzde}
                        </p>
                      </div>

                      <div style={{ color: 'rgba(255,255,255,0.25)' }}>
                        {acik ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{ width: `${barWidth}%`, height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${rankColor}, ${rankColor}80)`, transition: 'width 0.5s ease' }} />
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

                          {/* Mekan dağılımı */}
                          {p.mekanDetay.length > 1 && (
                            <div style={{ marginTop: 10, marginBottom: 8 }}>
                              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                Mekan Dağılımı
                              </p>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {p.mekanDetay.map(md => (
                                  <div key={md.mekanId} style={{
                                    padding: '4px 8px', borderRadius: 8,
                                    background: `${md.mekanColor}12`, border: `1px solid ${md.mekanColor}30`,
                                    fontSize: 10, fontWeight: 700, color: md.mekanColor,
                                  }}>
                                    {md.mekanEmoji} {md.mekanAd}: {md.kare}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Gün gün detay */}
                          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 700, marginTop: 8, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Gün Detayı
                          </p>
                          <div className="space-y-1">
                            {p.gunDetay.map((g, gi) => (
                              <div key={gi} style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '5px 8px', borderRadius: 8,
                                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                              }}>
                                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 600, minWidth: 50 }}>
                                  {formatTarih(g.tarih)}
                                </span>
                                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
                                  {g.mekanAd}
                                </span>
                                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: '#60a5fa' }}>
                                  {g.kare}
                                </span>
                                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', minWidth: 28, textAlign: 'right' }}>
                                  /{g.gunToplam}
                                </span>
                                <div style={{
                                  padding: '1px 6px', borderRadius: 6, fontSize: 9, fontWeight: 800,
                                  background: g.yuzde >= 50 ? 'rgba(52,211,153,0.12)' : g.yuzde >= 25 ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.05)',
                                  border: `1px solid ${g.yuzde >= 50 ? 'rgba(52,211,153,0.25)' : g.yuzde >= 25 ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.1)'}`,
                                  color: g.yuzde >= 50 ? '#34d399' : g.yuzde >= 25 ? '#fbbf24' : 'rgba(255,255,255,0.4)',
                                }}>
                                  %{g.yuzde}
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
