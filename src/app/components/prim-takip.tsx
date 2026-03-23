import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, RefreshCw, Trophy, Check, Clock,
  ChevronDown, ChevronUp, Filter, CreditCard,
  Calendar, AlertCircle, CheckCircle2, User, Users,
  Banknote, X, TrendingUp, Undo2,
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
  personelGorev?: 'fotograf-satis' | 'baski' | 'album';
  personelSayisi: number;
  coklu: boolean;
  odendi: boolean;
  odemeTarihi: string | null;
  odemeKey: string;
}

const GOREV_LABEL: Record<string, string> = {
  'fotograf-satis': '📸 Fotoğraf',
  'baski': '🖨️ Baskı',
  'album': '📒 Albüm',
};

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

// ── Sabitler ─────────────────────────────────────────
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

// ── Yeni gruplama: Mekan → Kişi ───────────────────────
type PersonGrup = {
  personelAdi: string;
  kayitlar: PrimKayit[]; // Tüm kademeler (tarih bazlı)
  toplamPrim: number;
  odenenPrim: number;
  bekleyenPrim: number;
  bekleyenKayitlar: PrimKayit[];
};

type MekanGrup = {
  mekanId: string;
  mekanName: string;
  mekanEmoji: string;
  mekanColor: string;
  kisiler: PersonGrup[];
  toplamPrim: number;
  odenenPrim: number;
  bekleyenPrim: number;
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
        kisiler: [],
        toplamPrim: 0,
        odenenPrim: 0,
        bekleyenPrim: 0,
      };
    }
    const mg = mekanMap[k.mekanId];

    let pg = mg.kisiler.find(p => p.personelAdi === k.personelAdi);
    if (!pg) {
      pg = {
        personelAdi: k.personelAdi,
        kayitlar: [],
        toplamPrim: 0,
        odenenPrim: 0,
        bekleyenPrim: 0,
        bekleyenKayitlar: [],
      };
      mg.kisiler.push(pg);
    }
    pg.kayitlar.push(k);
    pg.toplamPrim += k.primMiktar;
    if (k.odendi) pg.odenenPrim += k.primMiktar;
    else { pg.bekleyenPrim += k.primMiktar; pg.bekleyenKayitlar.push(k); }

    mg.toplamPrim += k.primMiktar;
    if (k.odendi) mg.odenenPrim += k.primMiktar;
    else mg.bekleyenPrim += k.primMiktar;
  }

  // Her mekan içindeki kişileri ada göre sırala
  for (const mg of Object.values(mekanMap)) {
    mg.kisiler.sort((a, b) => a.personelAdi.localeCompare(b.personelAdi));
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

  // Seçili kayıtlar: odemeKey → PrimKayit
  const [seciliMap, setSeciliMap] = useState<Map<string, PrimKayit>>(new Map());
  // Açık mekan panelleri
  const [acikMekanlar, setAcikMekanlar] = useState<Set<string>>(new Set());
  // Açık kişi detay panelleri
  const [acikKisiler, setAcikKisiler] = useState<Set<string>>(new Set());
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
        : `↩️ ${data.guncellenen} ödeme iptali gerçekleşti${data.giderSilinen ? `, ${data.giderSilinen} gider kalemi silindi` : ''}.`;
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
  const toggleKisiSecim = (pg: PersonGrup) => {
    setSeciliMap(prev => {
      const next = new Map(prev);
      const hepsiSecili = pg.bekleyenKayitlar.every(k => next.has(k.odemeKey));
      if (hepsiSecili) pg.bekleyenKayitlar.forEach(k => next.delete(k.odemeKey));
      else pg.bekleyenKayitlar.forEach(k => next.set(k.odemeKey, k));
      return next;
    });
  };

  const toggleMekanSecim = (mg: MekanGrup) => {
    const tumBekleyenler = mg.kisiler.flatMap(p => p.bekleyenKayitlar);
    setSeciliMap(prev => {
      const next = new Map(prev);
      const hepsiSecili = tumBekleyenler.every(k => next.has(k.odemeKey));
      if (hepsiSecili) tumBekleyenler.forEach(k => next.delete(k.odemeKey));
      else tumBekleyenler.forEach(k => next.set(k.odemeKey, k));
      return next;
    });
  };

  const toggleKisiDetay = (key: string) => {
    setAcikKisiler(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ── Filtrelenmiş veriler ──────────────────────────────
  const filtreliKayitlar = rapor?.primKayitlari.filter(k => !sadeceBekleyen || !k.odendi) ?? [];
  const mekanGruplari = grupla(filtreliKayitlar);
  const tumBekleyenler = (rapor?.primKayitlari ?? []).filter(k => !k.odendi);
  const seciliArray = Array.from(seciliMap.values());
  const seciliToplam = seciliArray.reduce((s, k) => s + k.primMiktar, 0);

  return (
    <div className="min-h-screen pb-40">
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
            <p className="text-xs" style={{ color: 'rgba(196,181,253,0.5)' }}>İsim bazlı prim yönetimi</p>
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
              { label: 'Toplam', val: rapor.toplamPrim, color: '#c4b5fd', bg: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.25)' },
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
            className="flex items-center gap-2">
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
              Bekleyen
            </button>

            {seciliArray.length > 0 && (
              <>
                <span className="text-xs font-bold px-2 py-1.5 rounded-lg flex items-center gap-1"
                  style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)', color: '#c4b5fd' }}>
                  <User className="w-3 h-3" />
                  {seciliArray.length} · {formatTL(seciliToplam)}
                </span>
                <button onClick={() => setSeciliMap(new Map())} className="p-1.5 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.35)' }}>
                  <X className="w-3 h-3" />
                </button>
              </>
            )}

            {canEdit && seciliArray.length > 0 && (
              <button
                onClick={() => handleOde(seciliArray, true)}
                disabled={saving}
                className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold active:scale-95 transition-all"
                style={{ background: 'rgba(52,211,153,0.2)', border: '1px solid rgba(52,211,153,0.4)', color: '#34d399' }}
              >
                <Check className="w-3 h-3" />
                Seçilenleri Öde
              </button>
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
              const tumBekleyen = mg.kisiler.flatMap(p => p.bekleyenKayitlar);
              const hepsiMekanSecili = tumBekleyen.length > 0 && tumBekleyen.every(k => seciliMap.has(k.odemeKey));

              return (
                <motion.div
                  key={mg.mekanId}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: mi * 0.05 }}
                  style={{
                    ...glass,
                    overflow: 'hidden',
                    border: mg.bekleyenPrim > 0
                      ? '1px solid rgba(251,191,36,0.2)'
                      : '1px solid rgba(52,211,153,0.2)',
                  }}
                >
                  {/* ── Mekan başlığı ── */}
                  <div className="flex items-center gap-3" style={{ padding: '12px 14px' }}>
                    {/* Checkbox mekan */}
                    {canEdit && tumBekleyen.length > 0 && (
                      <button onClick={() => toggleMekanSecim(mg)} className="shrink-0">
                        <div style={{
                          width: 18, height: 18, borderRadius: 5,
                          border: `1.5px solid ${hepsiMekanSecili ? '#a855f7' : 'rgba(255,255,255,0.2)'}`,
                          background: hepsiMekanSecili ? 'rgba(168,85,247,0.3)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.2s',
                        }}>
                          {hepsiMekanSecili && <Check className="w-2.5 h-2.5" style={{ color: '#c4b5fd' }} />}
                        </div>
                      </button>
                    )}

                    {/* Emoji */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      background: `${mg.mekanColor}20`, border: `1px solid ${mg.mekanColor}40`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                    }}>
                      {mg.mekanEmoji}
                    </div>

                    {/* Mekan adı + özet */}
                    <button
                      onClick={() => setAcikMekanlar(prev => {
                        const next = new Set(prev);
                        if (next.has(mg.mekanId)) next.delete(mg.mekanId);
                        else next.add(mg.mekanId);
                        return next;
                      })}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>{mg.mekanName}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>
                          {mg.kisiler.length} kişi
                        </span>
                        {mg.bekleyenPrim > 0 ? (
                          <span style={{
                            fontSize: 9, padding: '1px 6px', borderRadius: 99, fontWeight: 800,
                            background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24',
                          }}>
                            {formatTL(mg.bekleyenPrim)} bekliyor
                          </span>
                        ) : (
                          <span style={{
                            fontSize: 9, padding: '1px 6px', borderRadius: 99, fontWeight: 800,
                            background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399',
                          }}>
                            ✓ Tümü ödendi
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Toplam + öde butonu */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p style={{ color: mg.bekleyenPrim > 0 ? '#fbbf24' : '#34d399', fontSize: 14, fontWeight: 900 }}>
                          {formatTL(mg.toplamPrim)}
                        </p>
                        {mg.odenenPrim > 0 && mg.odenenPrim < mg.toplamPrim && (
                          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>
                            {formatTL(mg.odenenPrim)} ödendi
                          </p>
                        )}
                      </div>

                      {canEdit && tumBekleyen.length > 0 && (
                        <button
                          onClick={() => handleOde(tumBekleyen, true)}
                          disabled={saving}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold active:scale-95 transition-all"
                          style={{
                            background: 'rgba(52,211,153,0.15)',
                            border: '1px solid rgba(52,211,153,0.35)',
                            color: '#34d399',
                          }}
                        >
                          <CreditCard className="w-3 h-3" />
                          Mekânı Öde
                        </button>
                      )}

                      {/* Mekan bazlı ödeme iptali — tüm kayıtlar ödendiyse göster */}
                      {canEdit && tumBekleyen.length === 0 && mg.odenenPrim > 0 && (() => {
                        const tumOdenenler = mg.kisiler.flatMap(p => p.kayitlar.filter(k => k.odendi));
                        return (
                          <button
                            onClick={() => handleOde(tumOdenenler, false)}
                            disabled={saving}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold active:scale-95 transition-all"
                            style={{
                              background: 'rgba(248,113,113,0.12)',
                              border: '1px solid rgba(248,113,113,0.3)',
                              color: '#fca5a5',
                            }}
                          >
                            <Undo2 className="w-3 h-3" />
                            İptal
                          </button>
                        );
                      })()}

                      <div style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {acik ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* ── Kişi listesi ── */}
                  <AnimatePresence>
                    {acik && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                          {mg.kisiler.map((pg, pi) => {
                            const kisiKey = `${mg.mekanId}_${pg.personelAdi}`;
                            const detayAcik = acikKisiler.has(kisiKey);
                            const hepsiKisiSecili = pg.bekleyenKayitlar.length > 0 &&
                              pg.bekleyenKayitlar.every(k => seciliMap.has(k.odemeKey));
                            const kisimSecili = pg.bekleyenKayitlar.some(k => seciliMap.has(k.odemeKey));

                            // En yüksek kademe rengi
                            const maxKademe = pg.kayitlar.reduce((mx, k) => Math.max(mx, k.kademeIndex), 0);
                            const avatarColor = KADEME_COLORS[Math.min(maxKademe, 5)];
                            const allOdendi = pg.bekleyenPrim === 0;

                            return (
                              <div
                                key={kisiKey}
                                style={{
                                  borderTop: pi > 0 ? '1px solid rgba(255,255,255,0.05)' : undefined,
                                }}
                              >
                                {/* Kişi satırı */}
                                <div
                                  style={{
                                    padding: '10px 14px',
                                    background: hepsiKisiSecili
                                      ? 'rgba(168,85,247,0.08)'
                                      : kisimSecili
                                      ? 'rgba(168,85,247,0.04)'
                                      : 'transparent',
                                    transition: 'background 0.2s',
                                  }}
                                  className="flex items-center gap-2.5"
                                >
                                  {/* Checkbox kişi */}
                                  {canEdit && pg.bekleyenKayitlar.length > 0 && (
                                    <button onClick={() => toggleKisiSecim(pg)} className="shrink-0">
                                      <div style={{
                                        width: 16, height: 16, borderRadius: 4,
                                        border: `1.5px solid ${hepsiKisiSecili ? '#a855f7' : kisimSecili ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.2)'}`,
                                        background: hepsiKisiSecili ? 'rgba(168,85,247,0.3)' : kisimSecili ? 'rgba(168,85,247,0.1)' : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        transition: 'all 0.2s',
                                      }}>
                                        {hepsiKisiSecili && <Check className="w-2 h-2" style={{ color: '#c4b5fd' }} />}
                                        {!hepsiKisiSecili && kisimSecili && <div style={{ width: 6, height: 6, borderRadius: 1, background: '#a855f7' }} />}
                                      </div>
                                    </button>
                                  )}
                                  {canEdit && pg.bekleyenKayitlar.length === 0 && (
                                    <div style={{
                                      width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                                      background: 'rgba(52,211,153,0.15)',
                                      border: '1px solid rgba(52,211,153,0.3)',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                      <Check className="w-2 h-2" style={{ color: '#34d399' }} />
                                    </div>
                                  )}

                                  {/* Avatar */}
                                  <div style={{
                                    width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                                    background: allOdendi ? 'rgba(52,211,153,0.12)' : `${avatarColor}18`,
                                    border: `1.5px solid ${allOdendi ? 'rgba(52,211,153,0.35)' : avatarColor + '40'}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 12, fontWeight: 800,
                                    color: allOdendi ? '#34d399' : avatarColor,
                                  }}>
                                    {getInitials(pg.personelAdi)}
                                  </div>

                                  {/* İsim + kademeler */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>
                                        {pg.personelAdi}
                                      </span>
                                      {/* Kazanılan kademeler özeti */}
                                      {[...new Set(pg.kayitlar.map(k => k.kademeIndex))].sort().map(ki => {
                                        const c = KADEME_COLORS[Math.min(ki, 5)];
                                        const e = KADEME_EMOJIS[Math.min(ki, 5)];
                                        const odendi = pg.kayitlar.filter(k => k.kademeIndex === ki).every(k => k.odendi);
                                        return (
                                          <span key={ki} style={{
                                            fontSize: 9, padding: '1px 5px', borderRadius: 6, fontWeight: 700,
                                            background: odendi ? 'rgba(52,211,153,0.1)' : `${c}18`,
                                            border: `1px solid ${odendi ? 'rgba(52,211,153,0.3)' : c + '35'}`,
                                            color: odendi ? '#34d399' : c,
                                          }}>
                                            {e} {ki + 1}. Kd {odendi ? '✓' : ''}
                                          </span>
                                        );
                                      })}
                                    </div>
                                    {/* Alt bilgi */}
                                    <div className="flex items-center gap-2 mt-0.5">
                                      {allOdendi ? (
                                        <p style={{ color: 'rgba(52,211,153,0.6)', fontSize: 9 }}>Tümü ödendi</p>
                                      ) : (
                                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>
                                          {pg.kayitlar[0]?.coklu
                                             ? (pg.kayitlar[0]?.personelGorev ? GOREV_LABEL[pg.kayitlar[0].personelGorev] || 'Çoklu rotasyon' : 'Çoklu rotasyon')
                                             : 'Tekli rotasyon'
                                          } · {pg.kayitlar.length} kademe
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Sağ: tutarlar + butonlar */}
                                  <div className="flex items-center gap-2 shrink-0">
                                    <div className="text-right">
                                      <p style={{ color: allOdendi ? '#34d399' : '#fbbf24', fontSize: 15, fontWeight: 900 }}>
                                        {formatTL(pg.toplamPrim)}
                                      </p>
                                      {pg.odenenPrim > 0 && pg.bekleyenPrim > 0 && (
                                        <p style={{ color: 'rgba(52,211,153,0.5)', fontSize: 9 }}>
                                          {formatTL(pg.odenenPrim)} ödendi
                                        </p>
                                      )}
                                      {pg.bekleyenPrim > 0 && pg.odenenPrim > 0 && (
                                        <p style={{ color: 'rgba(251,191,36,0.6)', fontSize: 9 }}>
                                          {formatTL(pg.bekleyenPrim)} bekliyor
                                        </p>
                                      )}
                                    </div>

                                    {/* Öde butonu */}
                                    {canEdit && pg.bekleyenKayitlar.length > 0 && (
                                      <button
                                        onClick={() => handleOde(pg.bekleyenKayitlar, true)}
                                        disabled={saving}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold active:scale-95 transition-all"
                                        style={{
                                          background: 'rgba(52,211,153,0.15)',
                                          border: '1px solid rgba(52,211,153,0.35)',
                                          color: '#34d399',
                                        }}
                                      >
                                        {saving ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Check className="w-2.5 h-2.5" />}
                                        Öde
                                      </button>
                                    )}

                                    {/* Kişi bazlı ödeme iptali — tüm kayıtlar ödendiyse göster */}
                                    {canEdit && allOdendi && pg.kayitlar.length > 0 && (
                                      <button
                                        onClick={() => handleOde(pg.kayitlar.filter(k => k.odendi), false)}
                                        disabled={saving}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold active:scale-95 transition-all"
                                        style={{
                                          background: 'rgba(248,113,113,0.12)',
                                          border: '1px solid rgba(248,113,113,0.3)',
                                          color: '#fca5a5',
                                        }}
                                      >
                                        {saving ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Undo2 className="w-2.5 h-2.5" />}
                                        İptal
                                      </button>
                                    )}

                                    {/* Detay toggle */}
                                    <button
                                      onClick={() => toggleKisiDetay(kisiKey)}
                                      style={{ color: 'rgba(255,255,255,0.25)', padding: 2 }}
                                    >
                                      {detayAcik ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    </button>
                                  </div>
                                </div>

                                {/* Kişi detay: tarih × kademe breakdown */}
                                <AnimatePresence>
                                  {detayAcik && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.18 }}
                                      style={{ overflow: 'hidden' }}
                                    >
                                      <div style={{
                                        padding: '4px 14px 10px 44px',
                                        background: 'rgba(0,0,0,0.15)',
                                        borderTop: '1px solid rgba(255,255,255,0.04)',
                                      }}>
                                        <div className="space-y-1">
                                          {pg.kayitlar
                                            .sort((a, b) => b.tarih.localeCompare(a.tarih) || a.kademeIndex - b.kademeIndex)
                                            .map((kayit) => {
                                              const kc = KADEME_COLORS[Math.min(kayit.kademeIndex, 5)];
                                              const ke = KADEME_EMOJIS[Math.min(kayit.kademeIndex, 5)];
                                              return (
                                                <div key={kayit.odemeKey}
                                                  className="flex items-center gap-2"
                                                  style={{ padding: '5px 8px', borderRadius: 8, background: kayit.odendi ? 'rgba(52,211,153,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${kayit.odendi ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.06)'}` }}>
                                                  <Clock className="w-2.5 h-2.5 shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }} />
                                                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 600, minWidth: 44 }}>
                                                    {formatDate(kayit.tarih)}
                                                  </span>
                                                  <span style={{
                                                    fontSize: 9, padding: '1px 5px', borderRadius: 5, fontWeight: 700,
                                                    background: `${kc}14`, border: `1px solid ${kc}30`, color: kc,
                                                  }}>
                                                    {ke} {kayit.kademeIndex + 1}. Kademe
                                                  </span>
                                                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9 }}>
                                                    Hedef {formatTL(kayit.kademeHedef)}
                                                  </span>
                                                  <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, color: kayit.odendi ? '#34d399' : kc }}>
                                                    {formatTL(kayit.primMiktar)}
                                                  </span>
                                                  {kayit.odendi ? (
                                                    canEdit ? (
                                                      <button
                                                        onClick={() => handleOde([kayit], false)}
                                                        disabled={saving}
                                                        style={{
                                                          fontSize: 8, padding: '1px 5px', borderRadius: 5, fontWeight: 700,
                                                          background: 'rgba(248,113,113,0.12)',
                                                          border: '1px solid rgba(248,113,113,0.3)',
                                                          color: '#fca5a5',
                                                        }}
                                                        className="active:scale-95 transition-all flex items-center gap-0.5"
                                                      >
                                                        <Undo2 style={{ width: 7, height: 7 }} />
                                                        İptal
                                                      </button>
                                                    ) : (
                                                      <span style={{ fontSize: 8, color: 'rgba(52,211,153,0.6)', fontWeight: 700 }}>✓</span>
                                                    )
                                                  ) : canEdit ? (
                                                    <button
                                                      onClick={() => handleOde([kayit], true)}
                                                      disabled={saving}
                                                      style={{
                                                        fontSize: 8, padding: '1px 5px', borderRadius: 5, fontWeight: 700,
                                                        background: 'rgba(52,211,153,0.12)',
                                                        border: '1px solid rgba(52,211,153,0.25)',
                                                        color: '#34d399',
                                                      }}
                                                      className="active:scale-95 transition-all"
                                                    >
                                                      Öde
                                                    </button>
                                                  ) : null}
                                                </div>
                                              );
                                            })}
                                        </div>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
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

      </div>

      {/* ── Sabit alt panel: seçili kişiler ── */}
      <AnimatePresence>
        {canEdit && seciliArray.length > 0 && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            style={{
              position: 'fixed', bottom: 80, left: 16, right: 16, zIndex: 50,
              background: 'rgba(15,10,30,0.93)',
              border: '1px solid rgba(168,85,247,0.4)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderRadius: 18, padding: '12px 16px',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p style={{ color: '#c4b5fd', fontSize: 12, fontWeight: 800 }}>
                  {seciliArray.length} kayıt seçili
                </p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>
                  Toplam: {formatTL(seciliToplam)}
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
                Seçilenleri Öde
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}