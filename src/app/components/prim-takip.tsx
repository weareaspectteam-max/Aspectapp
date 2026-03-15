import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, RefreshCw, Trophy, Check, Clock,
  ChevronDown, ChevronUp, Users, Filter, CreditCard,
  Calendar, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { getToken, buildHeaders } from '../lib/api';
import { projectId } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.10)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius: 20,
};

function formatTL(val: number): string {
  if (val >= 1_000_000) return `₺${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `₺${(val / 1_000).toFixed(0)}B`;
  return `₺${val.toLocaleString('tr-TR')}`;
}

function formatDate(tarih: string): string {
  const [y, m, d] = tarih.split('-');
  return `${d}/${m}/${y}`;
}

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
  personelSayisi: number;
  coklu: boolean;
  odendi: boolean;
  odemeKey: string;
}

interface PrimRapor {
  ay: string;
  primKayitlari: PrimKayit[];
  toplamPrim: number;
  odenenPrim: number;
  bekleyenPrim: number;
}

interface PrimTakipProps {
  userRole: string;
  onBack: () => void;
}

const KADEME_COLORS = ['#60a5fa', '#a855f7', '#fbbf24', '#34d399'];
const KADEME_EMOJIS = ['🥉', '🥈', '🥇', '🏅'];

// ── Ay seçici ──────────────────────────────────────────
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

// ── Grupla: mekan bazında ────────────────────────────
function grupla(kayitlar: PrimKayit[]): Record<string, PrimKayit[]> {
  const map: Record<string, PrimKayit[]> = {};
  for (const k of kayitlar) {
    if (!map[k.mekanId]) map[k.mekanId] = [];
    map[k.mekanId].push(k);
  }
  return map;
}

export function PrimTakip({ userRole, onBack }: PrimTakipProps) {
  const canEdit = ['yonetici', 'ust-mudur'].includes(userRole);
  const aylar = getAylar();

  const [seciliAy, setSeciliAy] = useState(aylar[0].value);
  const [rapor, setRapor] = useState<PrimRapor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // Seçili kayıtlar (toplu ödeme için)
  const [seciliKeys, setSeciliKeys] = useState<Set<string>>(new Set());
  // Açık mekan panelleri
  const [acikMekanlar, setAcikMekanlar] = useState<Set<string>>(new Set());
  // Filtre: sadece bekleyenler
  const [sadeceBekleyen, setSadeceBekleyen] = useState(false);

  const fetchRapor = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/primler/rapor?ay=${seciliAy}`, {
        headers: buildHeaders(token),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sunucu hatası');
      setRapor(data);
      // İlk yüklемede tüm mekanları aç
      const mekanIds = new Set<string>(data.primKayitlari.map((k: PrimKayit) => k.mekanId));
      setAcikMekanlar(mekanIds);
    } catch (e: any) {
      console.error('PrimTakip fetch error:', e);
      setError(e.message || 'Veri alınamadı');
    } finally {
      setLoading(false);
    }
  }, [seciliAy]);

  useEffect(() => {
    fetchRapor();
    setSeciliKeys(new Set());
  }, [fetchRapor]);

  const handleOde = async (keys: string[], odendiMi: boolean) => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/primler/ode`, {
        method: 'POST',
        headers: buildHeaders(token),
        body: JSON.stringify({ odemeKeys: keys, odendiMi }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kayıt hatası');
      setSuccessMsg(`✅ ${data.guncellenen} kayıt ${odendiMi ? 'ödendi' : 'geri alındı'} olarak işaretlendi.`);
      setTimeout(() => setSuccessMsg(''), 3000);
      setSeciliKeys(new Set());
      await fetchRapor();
    } catch (e: any) {
      console.error('PrimTakip ode error:', e);
      setError(e.message || 'İşlem hatası');
      setTimeout(() => setError(''), 4000);
    } finally {
      setSaving(false);
    }
  };

  const toggleSecim = (key: string) => {
    setSeciliKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleMekan = (mekanId: string) => {
    setAcikMekanlar(prev => {
      const next = new Set(prev);
      if (next.has(mekanId)) next.delete(mekanId);
      else next.add(mekanId);
      return next;
    });
  };

  const filtreliKayitlar = rapor?.primKayitlari.filter(k => !sadeceBekleyen || !k.odendi) ?? [];
  const mekanGruplari = grupla(filtreliKayitlar);
  const mekanIds = Object.keys(mekanGruplari).sort();

  // Toplu seçim: bekleyen tüm kayıtlar
  const tumBekleyenKeys = (rapor?.primKayitlari ?? []).filter(k => !k.odendi).map(k => k.odemeKey);

  return (
    <div className="min-h-screen pb-32">
      <div className="px-4 pt-4 space-y-4">

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
              Prim Takip
            </h1>
            <p className="text-xs" style={{ color: 'rgba(196,181,253,0.5)' }}>Kota bazlı prim yönetimi</p>
          </div>
          <button
            onClick={fetchRapor}
            disabled={loading}
            style={{ ...glass, padding: 10, borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <RefreshCw className={`w-4 h-4 text-white/60 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </motion.div>

        {/* ── Bildirimler ── */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 p-3 rounded-xl text-sm"
              style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5' }}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </motion.div>
          )}
          {successMsg && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 p-3 rounded-xl text-sm"
              style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', color: '#6ee7b7' }}>
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {successMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Ay seçici ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          style={{ ...glass, padding: 14 }}>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4" style={{ color: '#c4b5fd' }} />
            <p className="text-sm font-bold text-white">Dönem</p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {aylar.map(ay => (
              <button
                key={ay.value}
                onClick={() => setSeciliAy(ay.value)}
                className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: seciliAy === ay.value ? 'rgba(168,85,247,0.25)' : 'rgba(255,255,255,0.05)',
                  border: seciliAy === ay.value ? '1px solid rgba(168,85,247,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  color: seciliAy === ay.value ? '#c4b5fd' : 'rgba(255,255,255,0.4)',
                }}
              >
                {ay.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Özet kartları ── */}
        {rapor && !loading && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className="grid grid-cols-3 gap-3">
            {[
              { label: 'Toplam Prim', val: rapor.toplamPrim, color: '#c4b5fd', bg: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.25)' },
              { label: 'Ödenen', val: rapor.odenenPrim, color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.25)' },
              { label: 'Bekleyen', val: rapor.bekleyenPrim, color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.25)' },
            ].map(c => (
              <div key={c.label} style={{ ...glass, padding: '12px 10px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: 16, textAlign: 'center' }}>
                <p style={{ color: c.color, fontSize: 16, fontWeight: 900 }}>{formatTL(c.val)}</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 700, marginTop: 2 }}>{c.label}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* ── Filtreler + Toplu ödeme ── */}
        {rapor && !loading && rapor.primKayitlari.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="flex items-center gap-2">
            {/* Filtre toggle */}
            <button
              onClick={() => setSadeceBekleyen(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                background: sadeceBekleyen ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.05)',
                border: sadeceBekleyen ? '1px solid rgba(251,191,36,0.4)' : '1px solid rgba(255,255,255,0.12)',
                color: sadeceBekleyen ? '#fbbf24' : 'rgba(255,255,255,0.4)',
              }}
            >
              <Filter className="w-3 h-3" />
              Sadece Bekleyen
            </button>

            {/* Seçili göstergesi */}
            {seciliKeys.size > 0 && (
              <span className="text-xs font-bold px-2 py-1 rounded-lg"
                style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: '#c4b5fd' }}>
                {seciliKeys.size} seçili
              </span>
            )}

            {/* Toplu ödeme butonu */}
            {canEdit && (
              <div className="flex gap-2 ml-auto">
                {seciliKeys.size > 0 && (
                  <button
                    onClick={() => handleOde(Array.from(seciliKeys), true)}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                    style={{ background: 'rgba(52,211,153,0.2)', border: '1px solid rgba(52,211,153,0.4)', color: '#34d399' }}
                  >
                    <Check className="w-3 h-3" />
                    Seçilileri Öde
                  </button>
                )}
                {tumBekleyenKeys.length > 0 && (
                  <button
                    onClick={() => handleOde(tumBekleyenKeys, true)}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                    style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.35)', color: '#fbbf24' }}
                  >
                    <CreditCard className="w-3 h-3" />
                    Tümünü Öde ({tumBekleyenKeys.length})
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Yükleniyor ── */}
        {loading && (
          <div className="flex flex-col items-center py-12 gap-3">
            <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Primler hesaplanıyor...</p>
          </div>
        )}

        {/* ── Boş durum ── */}
        {!loading && rapor && rapor.primKayitlari.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ ...glass, padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
            <p style={{ color: 'white', fontWeight: 700, marginBottom: 6 }}>Bu dönemde kota kaydı yok</p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
              Mekanlara kota kademeleri ekleyin ve günlük ciro hedefleri geçsin
            </p>
          </motion.div>
        )}

        {/* ── Mekan bazlı kart listesi ── */}
        {!loading && mekanIds.length > 0 && (
          <div className="space-y-3">
            {mekanIds.map((mekanId, mi) => {
              const kayitlar = mekanGruplari[mekanId].sort((a, b) => b.tarih.localeCompare(a.tarih));
              const ilk = kayitlar[0];
              const acik = acikMekanlar.has(mekanId);
              const mekanToplamPrim = kayitlar.reduce((s, k) => s + k.primMiktar * k.personelSayisi, 0);
              const mekanOdenenPrim = kayitlar.filter(k => k.odendi).reduce((s, k) => s + k.primMiktar * k.personelSayisi, 0);
              const bekleyenSayisi = kayitlar.filter(k => !k.odendi).length;

              // Mekan seçim durumu
              const mekanKeys = kayitlar.filter(k => !k.odendi).map(k => k.odemeKey);
              const hepsiSecili = mekanKeys.length > 0 && mekanKeys.every(k => seciliKeys.has(k));

              const toggleMekanSecim = () => {
                setSeciliKeys(prev => {
                  const next = new Set(prev);
                  if (hepsiSecili) mekanKeys.forEach(k => next.delete(k));
                  else mekanKeys.forEach(k => next.add(k));
                  return next;
                });
              };

              return (
                <motion.div
                  key={mekanId}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: mi * 0.05 }}
                  style={{
                    ...glass,
                    overflow: 'hidden',
                    border: bekleyenSayisi > 0
                      ? '1px solid rgba(251,191,36,0.2)'
                      : '1px solid rgba(52,211,153,0.2)',
                  }}
                >
                  {/* Mekan başlık satırı */}
                  <button
                    onClick={() => toggleMekan(mekanId)}
                    className="w-full flex items-center gap-3 text-left transition-all active:scale-[0.99]"
                    style={{ padding: '12px 14px' }}
                  >
                    {/* Emoji */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      background: `${ilk.mekanColor}20`,
                      border: `1px solid ${ilk.mekanColor}40`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18,
                    }}>
                      {ilk.mekanEmoji}
                    </div>

                    {/* Bilgi */}
                    <div className="flex-1 min-w-0">
                      <p style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>{ilk.mekanName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>
                          {kayitlar.length} kayıt
                        </span>
                        {bekleyenSayisi > 0 && (
                          <span style={{
                            fontSize: 9, padding: '1px 6px', borderRadius: 99, fontWeight: 800,
                            background: 'rgba(251,191,36,0.15)',
                            border: '1px solid rgba(251,191,36,0.3)',
                            color: '#fbbf24',
                          }}>
                            {bekleyenSayisi} bekliyor
                          </span>
                        )}
                        {bekleyenSayisi === 0 && (
                          <span style={{
                            fontSize: 9, padding: '1px 6px', borderRadius: 99, fontWeight: 800,
                            background: 'rgba(52,211,153,0.12)',
                            border: '1px solid rgba(52,211,153,0.25)',
                            color: '#34d399',
                          }}>
                            ✓ Tümü ödendi
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Sağ: toplam + ok */}
                    <div className="text-right shrink-0">
                      <p style={{ color: bekleyenSayisi > 0 ? '#fbbf24' : '#34d399', fontSize: 13, fontWeight: 900 }}>
                        {formatTL(mekanToplamPrim)}
                      </p>
                      {mekanOdenenPrim < mekanToplamPrim && (
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>
                          {formatTL(mekanOdenenPrim)} ödendi
                        </p>
                      )}
                    </div>
                    <div style={{ marginLeft: 4, color: 'rgba(255,255,255,0.3)' }}>
                      {acik ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {/* Mekan seçim toplu butonu (bekleyen varsa) */}
                  {acik && canEdit && mekanKeys.length > 0 && (
                    <div style={{ paddingInline: 14, paddingBottom: 8 }}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={toggleMekanSecim}
                          className="flex items-center gap-1.5 text-xs font-bold transition-all"
                          style={{ color: hepsiSecili ? '#c4b5fd' : 'rgba(255,255,255,0.3)' }}
                        >
                          <div style={{
                            width: 14, height: 14, borderRadius: 4,
                            border: `1.5px solid ${hepsiSecili ? '#a855f7' : 'rgba(255,255,255,0.2)'}`,
                            background: hepsiSecili ? 'rgba(168,85,247,0.3)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {hepsiSecili && <Check className="w-2 h-2" style={{ color: '#c4b5fd' }} />}
                          </div>
                          Tümünü seç
                        </button>
                        {canEdit && mekanKeys.length > 0 && (
                          <button
                            onClick={() => handleOde(mekanKeys, true)}
                            disabled={saving}
                            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95"
                            style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399' }}
                          >
                            <CreditCard className="w-3 h-3" />
                            Mekânı Öde
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Kayıt satırları */}
                  <AnimatePresence>
                    {acik && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '8px 14px 12px' }} className="space-y-2">
                          {kayitlar.map((kayit) => {
                            const kadeColor = KADEME_COLORS[Math.min(kayit.kademeIndex, 3)];
                            const kadeEmoji = KADEME_EMOJIS[Math.min(kayit.kademeIndex, 3)];
                            const secili = seciliKeys.has(kayit.odemeKey);

                            return (
                              <div
                                key={kayit.odemeKey}
                                style={{
                                  borderRadius: 12,
                                  padding: '10px 12px',
                                  background: kayit.odendi
                                    ? 'rgba(52,211,153,0.06)'
                                    : secili
                                    ? 'rgba(168,85,247,0.1)'
                                    : 'rgba(255,255,255,0.04)',
                                  border: kayit.odendi
                                    ? '1px solid rgba(52,211,153,0.2)'
                                    : secili
                                    ? '1px solid rgba(168,85,247,0.35)'
                                    : '1px solid rgba(255,255,255,0.07)',
                                  transition: 'all 0.2s ease',
                                }}
                              >
                                <div className="flex items-center gap-3">
                                  {/* Checkbox (sadece bekleyen + canEdit) */}
                                  {canEdit && !kayit.odendi && (
                                    <button onClick={() => toggleSecim(kayit.odemeKey)}>
                                      <div style={{
                                        width: 16, height: 16, borderRadius: 5,
                                        border: `1.5px solid ${secili ? '#a855f7' : 'rgba(255,255,255,0.2)'}`,
                                        background: secili ? 'rgba(168,85,247,0.3)' : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0, transition: 'all 0.2s',
                                      }}>
                                        {secili && <Check className="w-2.5 h-2.5" style={{ color: '#c4b5fd' }} />}
                                      </div>
                                    </button>
                                  )}

                                  {/* Kademe rozeti */}
                                  <div style={{
                                    width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                                    background: `${kadeColor}15`,
                                    border: `1px solid ${kadeColor}35`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 15,
                                  }}>
                                    {kadeEmoji}
                                  </div>

                                  {/* Bilgi */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span style={{ color: kadeColor, fontSize: 10, fontWeight: 800 }}>
                                        {kayit.kademeIndex + 1}. Kademe
                                      </span>
                                      <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>·</span>
                                      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>
                                        Hedef: {formatTL(kayit.kademeHedef)}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}>
                                        <Clock className="w-2.5 h-2.5" />{formatDate(kayit.tarih)}
                                      </span>
                                      <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}>
                                        <Users className="w-2.5 h-2.5" />{kayit.personelSayisi} kişi{kayit.coklu && ' (çoklu)'}
                                      </span>
                                      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>
                                        Ciro: {formatTL(kayit.ciro)}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Prim + durum */}
                                  <div className="text-right shrink-0">
                                    <p style={{ color: kayit.odendi ? '#34d399' : kadeColor, fontSize: 13, fontWeight: 900 }}>
                                      {formatTL(kayit.primMiktar)}
                                    </p>
                                    <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9 }}>
                                      /kişi · {formatTL(kayit.primMiktar * kayit.personelSayisi)} toplam
                                    </p>
                                    {kayit.odendi ? (
                                      <div className="flex items-center justify-end gap-1 mt-1">
                                        <Check className="w-2.5 h-2.5" style={{ color: '#34d399' }} />
                                        <span style={{ color: '#34d399', fontSize: 8, fontWeight: 700 }}>Ödendi</span>
                                      </div>
                                    ) : canEdit ? (
                                      <button
                                        onClick={() => handleOde([kayit.odemeKey], true)}
                                        disabled={saving}
                                        className="mt-1 flex items-center gap-1 ml-auto active:scale-95"
                                        style={{
                                          fontSize: 8, padding: '2px 6px', borderRadius: 6, fontWeight: 800,
                                          background: 'rgba(52,211,153,0.15)',
                                          border: '1px solid rgba(52,211,153,0.3)',
                                          color: '#34d399',
                                        }}
                                      >
                                        <Check className="w-2 h-2" /> Öde
                                      </button>
                                    ) : (
                                      <span style={{ color: '#fbbf24', fontSize: 8, fontWeight: 700 }}>Bekliyor</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ── Bilgi kutusu ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          style={{ ...glass, padding: 14, background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.15)' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, lineHeight: 1.6 }}>
            💡 <strong style={{ color: 'rgba(255,255,255,0.6)' }}>Nasıl çalışır?</strong> Mekanlara Mekan Yönetimi'nden kota kademeleri eklenir.
            Günlük ciro bu hedefleri geçince prim otomatik hesaplanır ve burada listelenir.
            Ödeme yapıldığında "Öde" butonuna bas — kayıt kaldırılmaz, ödendi olarak işaretlenir.
          </p>
        </motion.div>

      </div>
    </div>
  );
}
