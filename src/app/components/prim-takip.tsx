import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, RefreshCw, Trophy, Check, Clock,
  ChevronDown, ChevronUp, Filter, CreditCard,
  Calendar, AlertCircle, CheckCircle2, User, Users,
  Banknote, X,
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
  return `₺${Math.round(val).toLocaleString('tr-TR')}`;
}

function formatDate(tarih: string): string {
  const [y, m, d] = tarih.split('-');
  return `${d}/${m}/${y}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ── Interface'ler ───────────────────────────────────────
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
  coklu: boolean;
  odendi: boolean;
  odemeTarihi: string | null;
  odemeKey: string;
}

interface OdemeDetay {
  key: string;
  personelAdi: string;
  mekanAdi: string;
  tarih: string;
  kademeIndex: number;
  primMiktar: number;
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

// ── Yardımcı sabitler ───────────────────────────────────
const KADEME_COLORS = ['#60a5fa', '#a855f7', '#fbbf24', '#34d399', '#f87171', '#fb923c'];
const KADEME_EMOJIS = ['🥉', '🥈', '🥇', '🏅', '💎', '👑'];

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

// ── Grupla: mekan → tarih → kişiler ────────────────────
type MekanGrup = {
  mekanId: string;
  mekanName: string;
  mekanEmoji: string;
  mekanColor: string;
  tarihGruplari: {
    tarih: string;
    ciro: number;
    kisiListesi: PrimKayit[];
  }[];
};

function grupla(kayitlar: PrimKayit[]): MekanGrup[] {
  const mekanMap: Record<string, MekanGrup> = {};
  for (const k of kayitlar) {
    if (!mekanMap[k.mekanId]) {
      mekanMap[k.mekanId] = {
        mekanId: k.mekanId,
        mekanName: k.mekanName,
        mekanEmoji: k.mekanEmoji,
        mekanColor: k.mekanColor,
        tarihGruplari: [],
      };
    }
    const mg = mekanMap[k.mekanId];
    let tg = mg.tarihGruplari.find(t => t.tarih === k.tarih);
    if (!tg) {
      tg = { tarih: k.tarih, ciro: k.ciro, kisiListesi: [] };
      mg.tarihGruplari.push(tg);
    }
    tg.kisiListesi.push(k);
  }
  // Tarihleri yeniden eskiye sırala
  for (const mg of Object.values(mekanMap)) {
    mg.tarihGruplari.sort((a, b) => b.tarih.localeCompare(a.tarih));
  }
  return Object.values(mekanMap).sort((a, b) => a.mekanName.localeCompare(b.mekanName));
}

// ── Ana bileşen ─────────────────────────────────────────
export function PrimTakip({ userRole, onBack }: PrimTakipProps) {
  const canEdit = ['yonetici', 'ust-mudur'].includes(userRole);
  const aylar = getAylar();

  const [seciliAy, setSeciliAy] = useState(aylar[0].value);
  const [rapor, setRapor] = useState<PrimRapor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // Seçili kayıtlar: key → PrimKayit
  const [seciliMap, setSeciliMap] = useState<Map<string, PrimKayit>>(new Map());
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
    setSeciliMap(new Map());
  }, [fetchRapor]);

  // ── Ödeme işlemi ──────────────────────────────────────
  const handleOde = async (items: PrimKayit[], odendiMi: boolean) => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const token = await getToken();
      const odemeDetaylari: OdemeDetay[] = odendiMi ? items.map(k => ({
        key: k.odemeKey,
        personelAdi: k.personelAdi,
        mekanAdi: k.mekanName,
        tarih: k.tarih,
        kademeIndex: k.kademeIndex,
        primMiktar: k.primMiktar,
      })) : [];

      const res = await fetch(`${API_BASE}/primler/ode`, {
        method: 'POST',
        headers: buildHeaders(token),
        body: JSON.stringify({
          odemeKeys: items.map(i => i.odemeKey),
          odendiMi,
          odemeDetaylari,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kayıt hatası');
      const msg = odendiMi
        ? `✅ ${data.guncellenen} ödeme işlendi, ${data.giderOlusturulan ?? 0} gider kalemi oluşturuldu.`
        : `↩️ ${data.guncellenen} kayıt geri alındı.`;
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), 4000);
      setSeciliMap(new Map());
      await fetchRapor();
    } catch (e: any) {
      console.error('PrimTakip ode error:', e);
      setError(e.message || 'İşlem hatası');
      setTimeout(() => setError(''), 4000);
    } finally {
      setSaving(false);
    }
  };

  // ── Seçim işlemleri ──────────────────────────────────
  const toggleSecim = (kayit: PrimKayit) => {
    setSeciliMap(prev => {
      const next = new Map(prev);
      if (next.has(kayit.odemeKey)) next.delete(kayit.odemeKey);
      else next.set(kayit.odemeKey, kayit);
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

  // ── Filtrelenmiş veriler ──────────────────────────────
  const filtreliKayitlar = rapor?.primKayitlari.filter(k => !sadeceBekleyen || !k.odendi) ?? [];
  const mekanGruplari = grupla(filtreliKayitlar);

  const tumBekleyenler = (rapor?.primKayitlari ?? []).filter(k => !k.odendi);
  const seciliArray = Array.from(seciliMap.values());

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
            <p className="text-xs" style={{ color: 'rgba(196,181,253,0.5)' }}>Kişi bazlı prim yönetimi</p>
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

        {/* ── Araç çubuğu ── */}
        {rapor && !loading && rapor.primKayitlari.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="flex flex-wrap items-center gap-2">

            {/* Filtre */}
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

            {/* Seçili gösterge */}
            {seciliArray.length > 0 && (
              <span className="text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1"
                style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: '#c4b5fd' }}>
                <User className="w-3 h-3" />
                {seciliArray.length} seçili · {formatTL(seciliArray.reduce((s, k) => s + k.primMiktar, 0))}
              </span>
            )}

            {/* Seçilileri sıfırla */}
            {seciliArray.length > 0 && (
              <button onClick={() => setSeciliMap(new Map())} className="p-1.5 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.35)' }}>
                <X className="w-3 h-3" />
              </button>
            )}

            {/* Sağ: toplu ödeme butonları */}
            {canEdit && (
              <div className="flex gap-2 ml-auto">
                {seciliArray.length > 0 && (
                  <button
                    onClick={() => handleOde(seciliArray, true)}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                    style={{ background: 'rgba(52,211,153,0.2)', border: '1px solid rgba(52,211,153,0.4)', color: '#34d399' }}
                  >
                    <Check className="w-3 h-3" />
                    Seçilileri Öde ({seciliArray.length})
                  </button>
                )}
                {tumBekleyenler.length > 0 && (
                  <button
                    onClick={() => handleOde(tumBekleyenler, true)}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                    style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.35)', color: '#fbbf24' }}
                  >
                    <Banknote className="w-3 h-3" />
                    Tümünü Öde ({tumBekleyenler.length})
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

        {/* ── Mekan kartları ── */}
        {!loading && mekanGruplari.length > 0 && (
          <div className="space-y-3">
            {mekanGruplari.map((mg, mi) => {
              const acik = acikMekanlar.has(mg.mekanId);
              const tumKisiler = mg.tarihGruplari.flatMap(tg => tg.kisiListesi);
              const bekleyenKisiler = tumKisiler.filter(k => !k.odendi);
              const mekanToplamPrim = tumKisiler.reduce((s, k) => s + k.primMiktar, 0);
              const mekanOdenenPrim = tumKisiler.filter(k => k.odendi).reduce((s, k) => s + k.primMiktar, 0);
              const bekleyenSayisi = bekleyenKisiler.length;

              const hepsiSecili = bekleyenKisiler.length > 0 &&
                bekleyenKisiler.every(k => seciliMap.has(k.odemeKey));

              const toggleMekanSecim = () => {
                setSeciliMap(prev => {
                  const next = new Map(prev);
                  if (hepsiSecili) bekleyenKisiler.forEach(k => next.delete(k.odemeKey));
                  else bekleyenKisiler.forEach(k => next.set(k.odemeKey, k));
                  return next;
                });
              };

              return (
                <motion.div
                  key={mg.mekanId}
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
                  {/* Mekan başlık */}
                  <button
                    onClick={() => toggleMekan(mg.mekanId)}
                    className="w-full flex items-center gap-3 text-left transition-all active:scale-[0.99]"
                    style={{ padding: '12px 14px' }}
                  >
                    <div style={{
                      width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                      background: `${mg.mekanColor}20`,
                      border: `1px solid ${mg.mekanColor}40`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 19,
                    }}>
                      {mg.mekanEmoji}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>{mg.mekanName}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>
                          {mg.tarihGruplari.length} gün · {tumKisiler.length} kayıt
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

                    <div className="text-right shrink-0 mr-1">
                      <p style={{ color: bekleyenSayisi > 0 ? '#fbbf24' : '#34d399', fontSize: 13, fontWeight: 900 }}>
                        {formatTL(mekanToplamPrim)}
                      </p>
                      {mekanOdenenPrim > 0 && mekanOdenenPrim < mekanToplamPrim && (
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>
                          {formatTL(mekanOdenenPrim)} ödendi
                        </p>
                      )}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {acik ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {/* Mekan içi: toplu seçim + öde */}
                  {acik && canEdit && bekleyenKisiler.length > 0 && (
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
                        <button
                          onClick={() => handleOde(bekleyenKisiler, true)}
                          disabled={saving}
                          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95"
                          style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', color: '#34d399' }}
                        >
                          <CreditCard className="w-3 h-3" />
                          Mekânı Öde ({bekleyenKisiler.length})
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tarih grupları */}
                  <AnimatePresence>
                    {acik && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                          {mg.tarihGruplari.map((tg, tgi) => (
                            <div key={tg.tarih}>
                              {/* Tarih başlığı */}
                              <div
                                className="flex items-center gap-2"
                                style={{
                                  padding: '8px 14px 6px',
                                  borderTop: tgi > 0 ? '1px solid rgba(255,255,255,0.05)' : undefined,
                                  background: 'rgba(255,255,255,0.02)',
                                }}
                              >
                                <Clock className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.3)' }} />
                                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700 }}>
                                  {formatDate(tg.tarih)}
                                </span>
                                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9 }}>
                                  Ciro: {formatTL(tg.ciro)}
                                </span>
                                {tg.kisiListesi[0]?.coklu ? (
                                  <span className="flex items-center gap-0.5" style={{ color: 'rgba(168,85,247,0.6)', fontSize: 9 }}>
                                    <Users className="w-2.5 h-2.5" /> Çoklu Rotasyon
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-0.5" style={{ color: 'rgba(96,165,250,0.6)', fontSize: 9 }}>
                                    <User className="w-2.5 h-2.5" /> Tekli
                                  </span>
                                )}
                              </div>

                              {/* Kişi satırları */}
                              <div className="space-y-1.5" style={{ padding: '4px 12px 10px' }}>
                                {tg.kisiListesi.map((kayit) => {
                                  const kadeColor = KADEME_COLORS[Math.min(kayit.kademeIndex, 5)];
                                  const kadeEmoji = KADEME_EMOJIS[Math.min(kayit.kademeIndex, 5)];
                                  const secili = seciliMap.has(kayit.odemeKey);

                                  return (
                                    <div
                                      key={kayit.odemeKey}
                                      style={{
                                        borderRadius: 12,
                                        padding: '9px 11px',
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
                                      <div className="flex items-center gap-2.5">
                                        {/* Checkbox */}
                                        {canEdit && !kayit.odendi && (
                                          <button onClick={() => toggleSecim(kayit)} className="shrink-0">
                                            <div style={{
                                              width: 16, height: 16, borderRadius: 5,
                                              border: `1.5px solid ${secili ? '#a855f7' : 'rgba(255,255,255,0.2)'}`,
                                              background: secili ? 'rgba(168,85,247,0.3)' : 'transparent',
                                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                                              transition: 'all 0.2s',
                                            }}>
                                              {secili && <Check className="w-2.5 h-2.5" style={{ color: '#c4b5fd' }} />}
                                            </div>
                                          </button>
                                        )}
                                        {/* Ödendi checkmark placeholder */}
                                        {kayit.odendi && (
                                          <div style={{
                                            width: 16, height: 16, borderRadius: 5, flexShrink: 0,
                                            background: 'rgba(52,211,153,0.2)',
                                            border: '1px solid rgba(52,211,153,0.4)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          }}>
                                            <Check className="w-2.5 h-2.5" style={{ color: '#34d399' }} />
                                          </div>
                                        )}

                                        {/* Kişi avatarı */}
                                        <div style={{
                                          width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                                          background: kayit.odendi ? 'rgba(52,211,153,0.12)' : `${kadeColor}18`,
                                          border: `1px solid ${kayit.odendi ? 'rgba(52,211,153,0.3)' : kadeColor + '35'}`,
                                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          fontSize: 11, fontWeight: 800,
                                          color: kayit.odendi ? '#34d399' : kadeColor,
                                        }}>
                                          {getInitials(kayit.personelAdi)}
                                        </div>

                                        {/* Bilgi */}
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>
                                              {kayit.personelAdi}
                                            </span>
                                            <span style={{
                                              fontSize: 9, padding: '1px 5px', borderRadius: 6, fontWeight: 700,
                                              background: `${kadeColor}18`, border: `1px solid ${kadeColor}35`,
                                              color: kadeColor,
                                            }}>
                                              {kadeEmoji} {kayit.kademeIndex + 1}. Kademe
                                            </span>
                                          </div>
                                          {kayit.odendi && kayit.odemeTarihi ? (
                                            <p style={{ color: 'rgba(52,211,153,0.6)', fontSize: 9, marginTop: 1 }}>
                                              Ödendi: {formatDateTime(kayit.odemeTarihi)}
                                            </p>
                                          ) : (
                                            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, marginTop: 1 }}>
                                              Hedef: {formatTL(kayit.kademeHedef)} · {kayit.coklu ? 'Çoklu prim' : 'Tekli prim'}
                                            </p>
                                          )}
                                        </div>

                                        {/* Prim + öde butonu */}
                                        <div className="text-right shrink-0">
                                          <p style={{ color: kayit.odendi ? '#34d399' : kadeColor, fontSize: 14, fontWeight: 900 }}>
                                            {formatTL(kayit.primMiktar)}
                                          </p>
                                          {!kayit.odendi && canEdit && (
                                            <button
                                              onClick={() => handleOde([kayit], true)}
                                              disabled={saving}
                                              className="mt-1 flex items-center gap-1 ml-auto active:scale-95"
                                              style={{
                                                fontSize: 8, padding: '2px 7px', borderRadius: 6, fontWeight: 800,
                                                background: 'rgba(52,211,153,0.15)',
                                                border: '1px solid rgba(52,211,153,0.3)',
                                                color: '#34d399',
                                              }}
                                            >
                                              <Check className="w-2 h-2" />
                                              Öde
                                            </button>
                                          )}
                                          {kayit.odendi && (
                                            <p style={{ fontSize: 8, color: '#34d399', fontWeight: 700, marginTop: 2 }}>✓ Ödendi</p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ── Seçili kişiler — sabit alt panel ── */}
        <AnimatePresence>
          {canEdit && seciliArray.length > 0 && (
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              style={{
                position: 'fixed', bottom: 80, left: 16, right: 16, zIndex: 50,
                background: 'rgba(15,10,30,0.92)',
                border: '1px solid rgba(168,85,247,0.35)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                borderRadius: 18, padding: '12px 16px',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p style={{ color: '#c4b5fd', fontSize: 12, fontWeight: 800 }}>
                    {seciliArray.length} kişi seçili
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>
                    Toplam: {formatTL(seciliArray.reduce((s, k) => s + k.primMiktar, 0))}
                  </p>
                </div>
                <button
                  onClick={() => setSeciliMap(new Map())}
                  className="p-2 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleOde(seciliArray, true)}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-all"
                  style={{ background: 'rgba(52,211,153,0.2)', border: '1px solid rgba(52,211,153,0.4)', color: '#34d399' }}
                >
                  {saving
                    ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    : <Banknote className="w-3.5 h-3.5" />
                  }
                  Öde
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
