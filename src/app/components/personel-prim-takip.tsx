import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, RefreshCw, Trophy, Clock, ChevronDown, ChevronUp,
  Calendar, AlertCircle, CheckCircle2, Banknote, TrendingUp,
  Wallet, Star, Award, Users, User, HelpCircle, X,
} from 'lucide-react';
import { getToken, buildHeaders, appendGhostParam } from '../lib/api';
import { projectId } from '../lib/supabase-info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

// ── Stiller ─────────────────────────────────
const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.10)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: 20,
};

const KADEME_COLORS = ['#60a5fa', 'var(--app-accent, #a855f7)', '#fbbf24', '#34d399', '#f87171', '#fb923c'];
const KADEME_EMOJIS = ['🥉', '🥈', '🥇', '🏅', '💎', '👑'];

function formatTL(val: number): string {
  if (val >= 1_000_000) return `₺${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `₺${(val / 1_000).toFixed(1)}B`;
  return `₺${Math.round(val).toLocaleString('tr-TR')}`;
}

function formatDate(tarih: string): string {
  const [y, m, d] = tarih.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function getAylar(): { value: string; label: string }[] {
  const result = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    result.push({ value, label });
  }
  return result;
}

// ── Tipler ──────────────────────────────────
interface PrimKayit {
  mekanId: string;
  mekanName: string;
  mekanEmoji: string;
  mekanColor: string;
  tarih: string;
  ciro: number;
  kademeIndex: number;
  kademeHedef: number;
  primMiktar: number;
  personelAdi: string;
  personelSayisi: number;
  personelGorev?: 'fotograf-satis' | 'baski' | 'album' | 'gozlemci';
  coklu: boolean;
  gorevKisiSayisi?: number;
  kidemSeviye?: string;
  odendi: boolean;
  odemeTarihi: string | null;
  odemeKey: string;
}

const GOREV_LABEL: Record<string, string> = {
  'fotograf-satis': '📸 Fotoğraf',
  'baski': '🖨️ Baskı',
  'album': '📒 Albüm',
};

interface Rapor {
  ay: string;
  callerAdi: string;
  primKayitlari: PrimKayit[];
  toplamPrim: number;
  odenenPrim: number;
  bekleyenPrim: number;
}

// Tarih bazlı gruplama
interface GunGrup {
  tarih: string;
  mekanName: string;
  mekanEmoji: string;
  mekanColor: string;
  mekanId: string;
  ciro: number;
  coklu: boolean;
  kayitlar: PrimKayit[];
  toplamPrim: number;
  odenenPrim: number;
  bekleyenPrim: number;
}

function grupla(kayitlar: PrimKayit[]): GunGrup[] {
  const map = new Map<string, GunGrup>();
  for (const k of kayitlar) {
    const key = `${k.tarih}_${k.mekanId}`;
    if (!map.has(key)) {
      map.set(key, {
        tarih: k.tarih,
        mekanName: k.mekanName,
        mekanEmoji: k.mekanEmoji,
        mekanColor: k.mekanColor,
        mekanId: k.mekanId,
        ciro: k.ciro,
        coklu: k.coklu,
        kayitlar: [],
        toplamPrim: 0,
        odenenPrim: 0,
        bekleyenPrim: 0,
      });
    }
    const g = map.get(key)!;
    g.kayitlar.push(k);
    g.toplamPrim += k.primMiktar;
    if (k.odendi) g.odenenPrim += k.primMiktar;
    else g.bekleyenPrim += k.primMiktar;
  }
  return Array.from(map.values()).sort((a, b) => b.tarih.localeCompare(a.tarih));
}

// ── Props ────────────────────────────────────
interface PersonelPrimTakipProps {
  userRole: string;
  userName: string;
  onBack: () => void;
}

export function PersonelPrimTakip({ userRole, userName, onBack }: PersonelPrimTakipProps) {
  const aylar = getAylar();
  const [seciliAy, setSeciliAy] = useState(aylar[0].value);
  const [rapor, setRapor] = useState<Rapor | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [error, setError] = useState('');
  const [acikGunler, setAcikGunler] = useState<Set<string>>(new Set());

  const fetchRapor = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      const res = await fetch(appendGhostParam(`${API_BASE}/primler/kendi-rapor?ay=${seciliAy}`), {
        headers: buildHeaders(token),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sunucu hatası');
      setRapor(data);
      // Tüm günleri varsayılan açık yap
      const gunler = new Set<string>(data.primKayitlari.map((k: PrimKayit) => `${k.tarih}_${k.mekanId}`));
      setAcikGunler(gunler);
    } catch (e: any) {
      console.error('PersonelPrimTakip fetch error:', e);
      setError(e.message || 'Veri alınamadı');
    } finally {
      setLoading(false);
    }
  }, [seciliAy]);

  useEffect(() => {
    fetchRapor();
  }, [fetchRapor]);

  const toggleGun = (key: string) => {
    setAcikGunler(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const gunGruplari = rapor ? grupla(rapor.primKayitlari) : [];
  const odenenenGunSayisi = gunGruplari.filter(g => g.bekleyenPrim === 0 && g.toplamPrim > 0).length;

  return (
    <div
      className="min-h-screen pb-40"
      style={{
        background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #120830 50%, #1a0a3c 100%))',
      }}
    >
      {/* Arka plan efektleri */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full blur-3xl" style={{ background: 'rgba(251,191,36,0.04)' }} />
        <div className="absolute top-1/2 -right-24 w-64 h-64 rounded-full blur-3xl" style={{ background: 'rgba(var(--app-accent-rgb),0.06)' }} />
        <div className="absolute bottom-1/4 left-1/4 w-56 h-56 rounded-full blur-3xl" style={{ background: 'rgba(52,211,153,0.04)' }} />
      </div>

      <div className="px-4 pt-4 space-y-4 relative z-10">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <button
            onClick={onBack}
            style={{ ...glass, padding: 10, borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <ChevronLeft className="w-4 h-4 text-white/60" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              <Trophy className="w-5 h-5" style={{ color: '#fbbf24' }} />
              Hakedişlerim
            </h1>
            <p className="text-xs" style={{ color: 'rgba(var(--app-accent-rgb),0.5)' }}>Kişisel hakediş geçmişi</p>
          </div>
          <button
            onClick={() => setShowGuide(true)}
            style={{ padding: 10, borderRadius: 14, background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', boxShadow: '0 0 8px rgba(251,191,36,0.2)' }}
          >
            <HelpCircle className="w-4 h-4 text-amber-400" />
          </button>
          <button
            onClick={fetchRapor}
            disabled={loading}
            style={{ ...glass, padding: 10, borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <RefreshCw className={`w-4 h-4 text-white/60 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </motion.div>

        {/* ── Hata bildirimi ── */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 p-3 rounded-xl text-sm"
              style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5' }}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Ay seçici ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
          style={{ ...glass, padding: 14 }}>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4" style={{ color: 'var(--app-accent, #a855f7)' }} />
            <p className="text-sm font-bold text-white">Dönem</p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {aylar.map(ay => (
              <button
                key={ay.value}
                onClick={() => setSeciliAy(ay.value)}
                className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: seciliAy === ay.value ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.05)',
                  border: seciliAy === ay.value ? '1px solid rgba(251,191,36,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  color: seciliAy === ay.value ? '#fbbf24' : 'rgba(255,255,255,0.4)',
                }}
              >
                {ay.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Yükleniyor ── */}
        {loading && (
          <div className="flex flex-col items-center py-16 gap-3">
            <div className="w-10 h-10 border-4 border-yellow-500/30 border-t-yellow-400 rounded-full animate-spin" />
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Primler hesaplanıyor...</p>
          </div>
        )}

        {/* ── İçerik ── */}
        {!loading && rapor && (
          <>
            {/* ── Özet kartları ── */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
              {/* Ana kazanç kartı */}
              <div
                className="relative overflow-hidden mb-3"
                style={{
                  borderRadius: 20,
                  background: 'linear-gradient(135deg, rgba(251,191,36,0.15) 0%, rgba(var(--app-accent-rgb),0.1) 100%)',
                  border: '1px solid rgba(251,191,36,0.25)',
                  padding: '20px 20px',
                }}
              >
                {/* Arka plan parıltısı */}
                <div className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl pointer-events-none"
                  style={{ background: 'rgba(251,191,36,0.08)', transform: 'translate(30%, -30%)' }} />

                <div className="flex items-center gap-3 mb-4">
                  <div style={{
                    width: 44, height: 44, borderRadius: 14,
                    background: 'rgba(251,191,36,0.15)',
                    border: '1px solid rgba(251,191,36,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22,
                  }}>🏆</div>
                  <div>
                    <p className="text-white font-black text-lg">{userName.split(' ')[0]}'nin Primleri</p>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
                      {aylar.find(a => a.value === seciliAy)?.label}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Toplam Kazanç', val: rapor.toplamPrim, color: '#fbbf24', icon: <Trophy className="w-3.5 h-3.5" /> },
                    { label: 'Ödenen', val: rapor.odenenPrim, color: '#34d399', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
                    { label: 'Alacağım', val: rapor.bekleyenPrim, color: 'var(--app-accent, #a855f7)', icon: <Wallet className="w-3.5 h-3.5" /> },
                  ].map(c => (
                    <div key={c.label} style={{
                      background: 'rgba(0,0,0,0.2)',
                      border: `1px solid ${c.color}25`,
                      borderRadius: 14,
                      padding: '10px 8px',
                      textAlign: 'center',
                    }}>
                      <div className="flex justify-center mb-1" style={{ color: c.color }}>{c.icon}</div>
                      <p style={{ color: c.color, fontSize: 15, fontWeight: 900 }}>{formatTL(c.val)}</p>
                      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: 700, marginTop: 2 }}>{c.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* İstatistik şeridi */}
              {rapor.primKayitlari.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      label: 'Kazanılan Gün',
                      val: gunGruplari.length,
                      suffix: 'gün',
                      color: '#60a5fa',
                      bg: 'rgba(96,165,250,0.08)',
                      border: 'rgba(96,165,250,0.2)',
                    },
                    {
                      label: 'Ödenen Gün',
                      val: odenenenGunSayisi,
                      suffix: 'gün',
                      color: '#34d399',
                      bg: 'rgba(52,211,153,0.08)',
                      border: 'rgba(52,211,153,0.2)',
                    },
                    {
                      label: 'Ortalama',
                      val: gunGruplari.length > 0 ? Math.round(rapor.toplamPrim / gunGruplari.length) : 0,
                      suffix: '',
                      prefix: '₺',
                      color: '#fbbf24',
                      bg: 'rgba(251,191,36,0.08)',
                      border: 'rgba(251,191,36,0.2)',
                    },
                  ].map(s => (
                    <div key={s.label} style={{
                      background: s.bg, border: `1px solid ${s.border}`,
                      borderRadius: 14, padding: '10px 8px', textAlign: 'center',
                    }}>
                      <p style={{ color: s.color, fontSize: 16, fontWeight: 900 }}>
                        {s.prefix}{s.val}{s.suffix}
                      </p>
                      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: 700, marginTop: 1 }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* ── Boş durum ── */}
            {rapor.primKayitlari.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ ...glass, padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
                <p style={{ color: 'white', fontWeight: 800, fontSize: 16, marginBottom: 8 }}>
                  Bu dönemde prim kaydı yok
                </p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, lineHeight: 1.5 }}>
                  Mekandaki günlük ciro kotaları aştığında<br />prim kazanırsın
                </p>
              </motion.div>
            )}

            {/* ── Günlük kayıtlar ── */}
            {gunGruplari.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="space-y-3">
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, paddingLeft: 4 }}>
                  KAYDEDİLEN GÜNLEr ({gunGruplari.length})
                </p>
                {gunGruplari.map((g, gi) => {
                  const gunKey = `${g.tarih}_${g.mekanId}`;
                  const acik = acikGunler.has(gunKey);
                  const tumOdendi = g.bekleyenPrim === 0;

                  return (
                    <motion.div
                      key={gunKey}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: gi * 0.04 }}
                      style={{
                        ...glass,
                        overflow: 'hidden',
                        border: tumOdendi
                          ? '1px solid rgba(52,211,153,0.2)'
                          : '1px solid rgba(251,191,36,0.2)',
                      }}
                    >
                      {/* ── Gün başlığı ── */}
                      <button
                        onClick={() => toggleGun(gunKey)}
                        className="w-full flex items-center gap-3 text-left"
                        style={{ padding: '12px 14px' }}
                      >
                        {/* Mekan emoji */}
                        <div style={{
                          width: 42, height: 42, borderRadius: 13, flexShrink: 0,
                          background: `${g.mekanColor}18`,
                          border: `1px solid ${g.mekanColor}35`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 20,
                        }}>
                          {g.mekanEmoji}
                        </div>

                        {/* Mekan + tarih */}
                        <div className="flex-1 min-w-0">
                          <p style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>{g.mekanName}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>
                              {formatDate(g.tarih)}
                            </span>
                            {g.coklu && (
                              <span style={{
                                fontSize: 9, padding: '1px 5px', borderRadius: 6, fontWeight: 700,
                                background: 'rgba(96,165,250,0.12)',
                                border: '1px solid rgba(96,165,250,0.25)',
                                color: '#93c5fd',
                              }}>
                                <Users style={{ display: 'inline', width: 8, height: 8, marginRight: 2 }} />
                                {g.kayitlar[0]?.personelGorev
                                  ? GOREV_LABEL[g.kayitlar[0].personelGorev] || 'Çoklu ekip'
                                  : 'Çoklu ekip'}
                              </span>
                            )}
                            {tumOdendi ? (
                              <span style={{
                                fontSize: 9, padding: '1px 6px', borderRadius: 6, fontWeight: 700,
                                background: 'rgba(52,211,153,0.1)',
                                border: '1px solid rgba(52,211,153,0.25)',
                                color: '#34d399',
                              }}>✓ Ödendi</span>
                            ) : (
                              <span style={{
                                fontSize: 9, padding: '1px 6px', borderRadius: 6, fontWeight: 700,
                                background: 'rgba(251,191,36,0.1)',
                                border: '1px solid rgba(251,191,36,0.25)',
                                color: '#fbbf24',
                              }}>⏳ Bekliyor</span>
                            )}
                          </div>
                        </div>

                        {/* Tutar + chevron */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <p style={{
                              color: tumOdendi ? '#34d399' : '#fbbf24',
                              fontSize: 16, fontWeight: 900,
                            }}>
                              {formatTL(g.toplamPrim)}
                            </p>
                            {g.odenenPrim > 0 && g.bekleyenPrim > 0 && (
                              <p style={{ color: 'rgba(52,211,153,0.5)', fontSize: 9 }}>
                                {formatTL(g.odenenPrim)} ödendi
                              </p>
                            )}
                          </div>
                          <div style={{ color: 'rgba(255,255,255,0.25)' }}>
                            {acik ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                        </div>
                      </button>

                      {/* ── Kademe detayları ── */}
                      <AnimatePresence>
                        {acik && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            style={{ overflow: 'hidden' }}
                          >
                            <div style={{
                              borderTop: '1px solid rgba(255,255,255,0.06)',
                              background: 'rgba(0,0,0,0.15)',
                              padding: '8px 14px 12px',
                            }}>
                              {/* Ciro bilgisi */}
                              <div className="flex items-center gap-2 mb-3 px-1">
                                <TrendingUp className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.3)' }} />
                                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>
                                  Günlük ciro:
                                </span>
                                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 700 }}>
                                  {formatTL(g.ciro)}
                                </span>
                                {g.coklu && (
                                  <>
                                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>·</span>
                                    <span style={{ color: 'rgba(96,165,250,0.7)', fontSize: 10 }}>
                                      {g.kayitlar[0]?.personelSayisi} kişilik ekip
                                    </span>
                                  </>
                                )}
                              </div>

                              {/* Kademeler */}
                              <div className="space-y-2">
                                {g.kayitlar.map((kayit) => {
                                  const kc = KADEME_COLORS[Math.min(kayit.kademeIndex, 5)];
                                  const ke = KADEME_EMOJIS[Math.min(kayit.kademeIndex, 5)];
                                  return (
                                    <div
                                      key={kayit.odemeKey}
                                      className="flex items-center gap-2"
                                      style={{
                                        padding: '8px 10px',
                                        borderRadius: 12,
                                        background: kayit.odendi
                                          ? 'rgba(52,211,153,0.07)'
                                          : `${kc}08`,
                                        border: `1px solid ${kayit.odendi ? 'rgba(52,211,153,0.18)' : kc + '22'}`,
                                      }}
                                    >
                                      {/* Kademe rozeti */}
                                      <div style={{
                                        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                                        background: `${kc}18`,
                                        border: `1px solid ${kc}35`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 14,
                                      }}>
                                        {ke}
                                      </div>

                                      <div className="flex-1 min-w-0">
                                        <p style={{ color: kc, fontSize: 11, fontWeight: 700 }}>
                                          {kayit.kademeIndex + 1}. Kademe
                                        </p>
                                        <div className="flex items-center gap-1 flex-wrap">
                                          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>
                                            Hedef: {formatTL(kayit.kademeHedef)}
                                          </span>
                                          {kayit.gorevKisiSayisi && kayit.gorevKisiSayisi > 0 && (
                                            <span style={{ fontSize: 8, padding: '0px 4px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}>
                                              {kayit.gorevKisiSayisi} kişi
                                            </span>
                                          )}
                                          {kayit.kidemSeviye && kayit.kidemSeviye !== 'kidemsiz' && (
                                            <span style={{ fontSize: 8, padding: '0px 4px', borderRadius: 4, background: kayit.kidemSeviye === 'kidemliPlus' ? 'rgba(var(--app-accent-rgb),0.12)' : 'rgba(96,165,250,0.12)', border: `1px solid ${kayit.kidemSeviye === 'kidemliPlus' ? 'rgba(var(--app-accent-rgb),0.25)' : 'rgba(96,165,250,0.25)'}`, color: kayit.kidemSeviye === 'kidemliPlus' ? 'var(--app-accent, #a855f7)' : '#93c5fd' }}>
                                              {kayit.kidemSeviye === 'kidemliPlus' ? 'Kıdemli+' : 'Kıdemli'}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Tutar */}
                                      <div className="text-right shrink-0">
                                        <p style={{
                                          color: kayit.odendi ? '#34d399' : kc,
                                          fontSize: 14, fontWeight: 900,
                                        }}>
                                          {formatTL(kayit.primMiktar)}
                                        </p>
                                        {kayit.odendi ? (
                                          <div className="flex items-center justify-end gap-1 mt-0.5">
                                            <CheckCircle2 style={{ width: 9, height: 9, color: '#34d399' }} />
                                            <span style={{ color: 'rgba(52,211,153,0.65)', fontSize: 8, fontWeight: 700 }}>
                                              Ödendi
                                            </span>
                                          </div>
                                        ) : (
                                          <div className="flex items-center justify-end gap-1 mt-0.5">
                                            <Clock style={{ width: 9, height: 9, color: '#fbbf24' }} />
                                            <span style={{ color: 'rgba(251,191,36,0.65)', fontSize: 8, fontWeight: 700 }}>
                                              Bekliyor
                                            </span>
                                          </div>
                                        )}
                                        {kayit.odendi && kayit.odemeTarihi && (
                                          <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 8, marginTop: 1 }}>
                                            {formatDateTime(kayit.odemeTarihi)}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            {/* ── Alacak özeti (bekleyenler varsa) ── */}
            {rapor.bekleyenPrim > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                style={{
                  borderRadius: 18,
                  background: 'linear-gradient(135deg, rgba(var(--app-accent-rgb),0.1) 0%, rgba(var(--app-accent-rgb),0.08) 100%)',
                  border: '1px solid rgba(var(--app-accent-rgb),0.2)',
                  padding: '16px 18px',
                }}
              >
                <div className="flex items-center gap-3">
                  <div style={{
                    width: 42, height: 42, borderRadius: 13, flexShrink: 0,
                    background: 'rgba(var(--app-accent-rgb),0.12)',
                    border: '1px solid rgba(var(--app-accent-rgb),0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Wallet className="w-5 h-5" style={{ color: 'var(--app-accent, #a855f7)' }} />
                  </div>
                  <div className="flex-1">
                    <p style={{ color: 'white', fontWeight: 800, fontSize: 13 }}>Toplam Alacağım</p>
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>
                      Ödeme yönetici tarafından işlenecek
                    </p>
                  </div>
                  <p style={{ color: 'var(--app-accent, #a855f7)', fontSize: 22, fontWeight: 900 }}>
                    {formatTL(rapor.bekleyenPrim)}
                  </p>
                </div>
              </motion.div>
            )}

            {/* ── Tümü ödendi mesajı ── */}
            {rapor.toplamPrim > 0 && rapor.bekleyenPrim === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 }}
                style={{
                  borderRadius: 18,
                  background: 'rgba(52,211,153,0.08)',
                  border: '1px solid rgba(52,211,153,0.2)',
                  padding: '16px 18px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
                <p style={{ color: '#34d399', fontWeight: 800, fontSize: 14 }}>Tüm Primler Ödendi!</p>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 4 }}>
                  Bu ay tüm hakedişlerini aldın. Tebrikler!
                </p>
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* ── Rehber Modal ── */}
      <AnimatePresence>
        {showGuide && (
          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-start justify-center pt-6 overflow-y-auto" onClick={() => setShowGuide(false)}>
            <motion.div
              initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
              className="w-full max-w-lg bg-[#1a1a2e] border border-white/10 rounded-2xl mb-8 mx-4 overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 bg-[#1a1a2e] border-b border-white/8 px-4 py-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-ta" /> Hakediş Rehberi
                </h3>
                <button onClick={() => setShowGuide(false)} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>
              <div className="p-4 space-y-4 text-[12px] leading-relaxed text-white/70">

                <div>
                  <h4 className="text-[13px] font-bold text-white mb-1.5">🏆 Hakediş Nedir?</h4>
                  <p>Hakediş (prim), mekandaki günlük ciro belirli kotaları aştığında kazanılan ek gelirdir.</p>
                  <p className="mt-1">• Her mekanın <span className="text-ta font-semibold">kota kademeleri</span> vardır (örn: 1. kademe ₺5.000, 2. kademe ₺8.000)</p>
                  <p>• Günlük ciro bir kademeyi geçtiğinde, o kademenin hakediş tutarı kazanılır</p>
                  <p>• Kademeler <span className="text-ta font-semibold">toplanarak</span> işlenir — her geçilen kademenin hakedişi bir üstekine eklenir</p>
                </div>

                <div className="border-t border-white/8 pt-3">
                  <h4 className="text-[13px] font-bold text-white mb-1.5">👥 Paylaşım</h4>
                  <p>• Mekanda <span className="text-ta font-semibold">tek kişi</span> çalışıyorsa hakediş tamamı o kişiye aittir</p>
                  <p>• <span className="text-ta font-semibold">Birden fazla kişi</span> çalışıyorsa hakediş eşit bölünür</p>
                  <p>• Görev tipi <span className="text-amber-400 font-semibold">Gözlemci</span> olanlar hakediş paylaşımına dahil edilmez</p>
                </div>

                <div className="border-t border-white/8 pt-3">
                  <h4 className="text-[13px] font-bold text-white mb-1.5">📊 Bu Sayfa</h4>
                  <p>• <span className="text-ta font-semibold">Dönem:</span> Üstteki ay seçiciden geçmiş dönemleri inceleyebilirsiniz</p>
                  <p>• <span className="text-emerald-400 font-semibold">Toplam Kazanç:</span> Seçili dönemdeki toplam hakediş tutarı</p>
                  <p>• <span className="text-ta font-semibold">Ödenen:</span> Yönetici tarafından ödenmiş olan tutar</p>
                  <p>• <span className="text-amber-400 font-semibold">Alacağım:</span> Henüz ödenmemiş hakediş tutarı</p>
                </div>

                <div className="border-t border-white/8 pt-3">
                  <h4 className="text-[13px] font-bold text-white mb-1.5">📋 Kayıt Detayları</h4>
                  <p>Her hakediş kaydında şunları görebilirsiniz:</p>
                  <p className="mt-1">• Hangi mekanda, hangi tarihte kazanıldığı</p>
                  <p>• O günkü ciro ve ulaşılan kademe</p>
                  <p>• Hakediş tutarı ve kaç kişiyle bölüşüldüğü</p>
                  <p>• Ödeme durumu: <span className="text-emerald-400 font-semibold">✓ Ödendi</span> veya <span className="text-amber-400 font-semibold">Bekliyor</span></p>
                </div>

                <div className="border-t border-white/8 pt-3">
                  <h4 className="text-[13px] font-bold text-white mb-1.5">⚡ Önemli</h4>
                  <p>• Hakediş, vardiya kapanışında otomatik hesaplanır — manuel giriş yapılmaz</p>
                  <p>• Ödeme onayı yönetici tarafından yapılır</p>
                  <p>• Bir gün birden fazla kademe aşılabilir — her kademe ayrı satır olarak görünür</p>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}