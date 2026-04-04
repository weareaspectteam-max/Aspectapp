import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, RefreshCw, Trophy, Check, Clock,
  ChevronDown, ChevronUp, Filter, CreditCard,
  Calendar, AlertCircle, CheckCircle2, User, Users,
  Banknote, X, TrendingUp, Undo2, Trash2, Settings2, Save, HelpCircle,
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

function formatTL(val: number): string {
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
  personelGorev?: 'fotograf-satis' | 'baski' | 'album' | 'gozlemci';
  personelSayisi: number;
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
const KADEME_COLORS = ['#60a5fa', 'var(--app-accent, #a855f7)', '#fbbf24', '#34d399', '#f87171', '#fb923c'];
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

// ── Gruplama: Kişi bazlı ───────────────────────
type KisiGrup = {
  personelAdi: string;
  kayitlar: PrimKayit[];
  toplamPrim: number;
  odenenPrim: number;
  bekleyenPrim: number;
  bekleyenKayitlar: PrimKayit[];
};

function grupla(kayitlar: PrimKayit[]): KisiGrup[] {
  const kisiMap: Record<string, KisiGrup> = {};

  for (const k of kayitlar) {
    if (!kisiMap[k.personelAdi]) {
      kisiMap[k.personelAdi] = {
        personelAdi: k.personelAdi,
        kayitlar: [],
        toplamPrim: 0,
        odenenPrim: 0,
        bekleyenPrim: 0,
        bekleyenKayitlar: [],
      };
    }
    const kg = kisiMap[k.personelAdi];
    kg.kayitlar.push(k);
    kg.toplamPrim += k.primMiktar;
    if (k.odendi) kg.odenenPrim += k.primMiktar;
    else { kg.bekleyenPrim += k.primMiktar; kg.bekleyenKayitlar.push(k); }
  }

  return Object.values(kisiMap).sort((a, b) => b.toplamPrim - a.toplamPrim);
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
  const [showGuide, setShowGuide] = useState(false);

  // Seçili kayıtlar: odemeKey → PrimKayit
  const [seciliMap, setSeciliMap] = useState<Map<string, PrimKayit>>(new Map());
  // Açık kişi panelleri
  const [acikKisiler, setAcikKisiler] = useState<Set<string>>(new Set());
  // Filtre: sadece bekleyenler
  const [sadeceBekleyen, setSadeceBekleyen] = useState(false);

  // ── Kıdem çarpanları ─────────────────────────────────────────
  const canViewKidem = ['yonetici', 'ust-mudur'].includes(userRole);
  const canEditKidem = userRole === 'yonetici';
  const [carpanlar, setCarpanlar] = useState({ kidemsiz: 1.0, kidemli: 1.15, kidemliPlus: 1.30 });
  const [carpanlarLoading, setCarpanlarLoading] = useState(false);
  const [carpanlarSaving, setCarpanlarSaving] = useState(false);
  const [carpanlarEdit, setCarpanlarEdit] = useState(false);
  const [editCarpan, setEditCarpan] = useState({ kidemsiz: '1.00', kidemli: '1.15', kidemliPlus: '1.30' });
  const [carpanMsg, setCarpanMsg] = useState('');
  const [carpanlarAcik, setCarpanlarAcik] = useState(false);

  const fetchCarpanlar = useCallback(async () => {
    if (!canViewKidem) return;
    setCarpanlarLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(appendGhostParam(`${API_BASE}/kidem/carpanlar`), { headers: buildHeaders(token) });
      const data = await res.json();
      if (res.ok && data.carpanlar) {
        setCarpanlar(data.carpanlar);
        setEditCarpan({
          kidemsiz: String(data.carpanlar.kidemsiz),
          kidemli: String(data.carpanlar.kidemli),
          kidemliPlus: String(data.carpanlar.kidemliPlus),
        });
      }
    } catch (e) {
      console.error('fetchCarpanlar error:', e);
    } finally {
      setCarpanlarLoading(false);
    }
  }, [canViewKidem]);

  const handleSaveCarpanlar = async () => {
    if (!canEditKidem) return;
    const kidemsiz = parseFloat(editCarpan.kidemsiz);
    const kidemli = parseFloat(editCarpan.kidemli);
    const kidemliPlus = parseFloat(editCarpan.kidemliPlus);
    if (isNaN(kidemsiz) || isNaN(kidemli) || isNaN(kidemliPlus) || kidemsiz < 0 || kidemli < 0 || kidemliPlus < 0) {
      setCarpanMsg('❌ Çarpanlar 0 veya üzeri olmalıdır!');
      setTimeout(() => setCarpanMsg(''), 3000);
      return;
    }
    setCarpanlarSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/kidem/carpanlar`, {
        method: 'POST',
        headers: buildHeaders(token),
        body: JSON.stringify({ kidemsiz, kidemli, kidemliPlus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kayıt hatası');
      setCarpanlar({ kidemsiz, kidemli, kidemliPlus });
      setCarpanlarEdit(false);
      setCarpanMsg('✅ Çarpanlar kaydedildi!');
      setTimeout(() => setCarpanMsg(''), 3000);
    } catch (e: any) {
      console.error('handleSaveCarpanlar error:', e);
      setCarpanMsg(`❌ ${e.message}`);
      setTimeout(() => setCarpanMsg(''), 4000);
    } finally {
      setCarpanlarSaving(false);
    }
  };

  const fetchRapor = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      const res = await fetch(appendGhostParam(`${API_BASE}/primler/rapor?ay=${seciliAy}`), {
        headers: buildHeaders(token),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sunucu hatası');
      setRapor(data);
      const kisiAdlari = new Set<string>(data.primKayitlari.map((k: PrimKayit) => k.personelAdi));
      setAcikKisiler(kisiAdlari);
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

  useEffect(() => {
    fetchCarpanlar();
  }, [fetchCarpanlar]);

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

  // ── Prim iptali (bekleyen kayıt silme) ───────────────
  const handleSilPrim = async (items: PrimKayit[], geriAl = false) => {
    if (!canEdit) return;
    if (!geriAl && !confirm(`${items.length > 1 ? `${items.length} prim kaydı` : '1 prim kaydı'} iptal edilecek. Emin misiniz?`)) return;
    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/primler/sil`, {
        method: 'POST',
        headers: buildHeaders(token),
        body: JSON.stringify({
          odemeKeys: items.map(i => i.odemeKey),
          geriAl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'İşlem hatası');
      const msg = geriAl
        ? `↩️ ${data.islenen} prim kaydı geri alındı.`
        : `🗑️ ${data.islenen} prim kaydı iptal edildi.`;
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(''), 4000);
      await fetchRapor();
    } catch (e: any) {
      console.error('PrimTakip sil error:', e);
      setError(e.message || 'İşlem hatası');
      setTimeout(() => setError(''), 4000);
    } finally {
      setSaving(false);
    }
  };

  // ── Seçim işlemleri ──────────────────────────────────
  const toggleKisiSecim = (kg: KisiGrup) => {
    setSeciliMap(prev => {
      const next = new Map(prev);
      const hepsiSecili = kg.bekleyenKayitlar.every(k => next.has(k.odemeKey));
      if (hepsiSecili) kg.bekleyenKayitlar.forEach(k => next.delete(k.odemeKey));
      else kg.bekleyenKayitlar.forEach(k => next.set(k.odemeKey, k));
      return next;
    });
  };

  const toggleKisiPanel = (key: string) => {
    setAcikKisiler(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ── Filtrelenmiş veriler ──────────────────────────────
  const filtreliKayitlar = rapor?.primKayitlari.filter(k => !sadeceBekleyen || !k.odendi) ?? [];
  const kisiGruplari = grupla(filtreliKayitlar);
  const tumBekleyenler = (rapor?.primKayitlari ?? []).filter(k => !k.odendi);
  const seciliArray = Array.from(seciliMap.values());
  const seciliToplam = seciliArray.reduce((s, k) => s + k.primMiktar, 0);

  return (
    <div className="min-h-screen pb-40" style={{ background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%))' }}>
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
              Hakediş Takip
            </h1>
            <p className="text-xs" style={{ color: 'rgba(var(--app-accent-rgb),0.5)' }}>İsim bazlı prim yönetimi</p>
          </div>
          <button
            onClick={() => setShowGuide(true)}
            className="active:scale-90 transition-all"
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
                  background: seciliAy === ay.value ? 'rgba(var(--app-accent-rgb),0.25)' : 'rgba(255,255,255,0.05)',
                  border: seciliAy === ay.value ? '1px solid rgba(var(--app-accent-rgb),0.5)' : '1px solid rgba(255,255,255,0.1)',
                  color: seciliAy === ay.value ? 'var(--app-accent, #a855f7)' : 'rgba(255,255,255,0.4)',
                }}
              >
                {ay.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Kıdem Çarpan Ayarları ── sadece yönetici + üst-müdür görür ── */}
        {canViewKidem && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}
            style={{
              background: 'rgba(157,217,234,0.06)',
              border: '1px solid rgba(157,217,234,0.18)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: 20,
              padding: '14px 16px',
            }}>
            {/* Başlık — tıklanınca açılır/kapanır */}
            <button
              onClick={() => setCarpanlarAcik(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <Settings2 style={{ width: 15, height: 15, color: '#9dd9ea', flexShrink: 0 }} />
              <p style={{ color: '#9dd9ea', fontSize: 13, fontWeight: 800, flex: 1, textAlign: 'left' }}>🎖️ Kıdem Çarpan Ayarları</p>
              <span style={{ color: 'rgba(157,217,234,0.5)', fontSize: 10, marginRight: 4 }}>
                ×{carpanlar.kidemsiz.toFixed(2)} · ×{carpanlar.kidemli.toFixed(2)} · ×{carpanlar.kidemliPlus.toFixed(2)}
              </span>
              <div style={{ color: 'rgba(157,217,234,0.4)' }}>
                {carpanlarAcik ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            <AnimatePresence>
            {carpanlarAcik && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <div style={{ flex: 1 }} />
              {carpanlarLoading && <RefreshCw style={{ width: 13, height: 13, color: 'rgba(157,217,234,0.4)' }} className="animate-spin" />}
              {canEditKidem && !carpanlarEdit && (
                <button
                  onClick={() => {
                    setEditCarpan({
                      kidemsiz: String(carpanlar.kidemsiz),
                      kidemli: String(carpanlar.kidemli),
                      kidemliPlus: String(carpanlar.kidemliPlus),
                    });
                    setCarpanlarEdit(true);
                  }}
                  style={{
                    fontSize: 10, padding: '3px 10px', borderRadius: 8, fontWeight: 700,
                    background: 'rgba(157,217,234,0.12)', border: '1px solid rgba(157,217,234,0.3)',
                    color: '#9dd9ea', cursor: 'pointer',
                  }}
                >
                  Düzenle
                </button>
              )}
              {canEditKidem && carpanlarEdit && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => { setCarpanlarEdit(false); }}
                    style={{
                      fontSize: 10, padding: '3px 10px', borderRadius: 8, fontWeight: 700,
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                      color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
                    }}
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleSaveCarpanlar}
                    disabled={carpanlarSaving}
                    style={{
                      fontSize: 10, padding: '3px 10px', borderRadius: 8, fontWeight: 700,
                      background: 'rgba(52,211,153,0.2)', border: '1px solid rgba(52,211,153,0.4)',
                      color: '#34d399', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    {carpanlarSaving ? <RefreshCw style={{ width: 10, height: 10 }} className="animate-spin" /> : <Save style={{ width: 10, height: 10 }} />}
                    Kaydet
                  </button>
                </div>
              )}
            </div>

            {/* Bilgi notu */}
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginBottom: 10 }}>
              Kıdemsiz · Kıdemli · Kıdemli+ çarpanları tüm mekan kota hakedişlerine uygulanır.
            </p>

            {/* Çarpan kartları */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { key: 'kidemsiz' as const, label: 'Kıdemsiz', emoji: '⚪', color: '#a7c7e7' },
                { key: 'kidemli' as const, label: 'Kıdemli', emoji: '🔵', color: '#9dd9ea' },
                { key: 'kidemliPlus' as const, label: 'Kıdemli+', emoji: '💜', color: '#d4b5f7' },
              ].map(({ key, label, emoji, color }) => (
                <div key={key} style={{
                  background: `${color}08`,
                  border: `1px solid ${color}25`,
                  borderRadius: 14, padding: '10px 8px', textAlign: 'center',
                }}>
                  <p style={{ fontSize: 16, marginBottom: 4 }}>{emoji}</p>
                  <p style={{ color: `${color}`, fontSize: 9, fontWeight: 800, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
                  {carpanlarEdit && canEditKidem ? (
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={editCarpan[key]}
                      onChange={(e) => setEditCarpan(prev => ({ ...prev, [key]: e.target.value }))}
                      style={{
                        width: '100%', textAlign: 'center', fontSize: 16, fontWeight: 900,
                        background: 'rgba(255,255,255,0.1)', border: `1.5px solid ${color}50`,
                        borderRadius: 8, color: 'white', outline: 'none', padding: '4px 2px',
                      }}
                    />
                  ) : (
                    <p style={{ color: 'white', fontSize: 18, fontWeight: 900 }}>
                      ×{carpanlar[key].toFixed(2)}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Mesaj */}
            {carpanMsg && (
              <p style={{
                marginTop: 8, fontSize: 11, fontWeight: 700, textAlign: 'center',
                color: carpanMsg.startsWith('✅') ? '#34d399' : '#fca5a5',
              }}>{carpanMsg}</p>
            )}

            {/* Örnek açıklama satırı */}
            {!carpanlarEdit && (
              <div style={{
                marginTop: 10, padding: '8px 10px', borderRadius: 10,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                display: 'flex', flexWrap: 'wrap', gap: '4px 12px',
              }}>
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9, width: '100%', marginBottom: 2 }}>
                  📌 Örnek — ₺500 temel prim:
                </p>
                {[
                  { label: 'Kıdemsiz', val: 500 * carpanlar.kidemsiz, color: '#a7c7e7' },
                  { label: 'Kıdemli', val: 500 * carpanlar.kidemli, color: '#9dd9ea' },
                  { label: 'Kıdemli+', val: 500 * carpanlar.kidemliPlus, color: '#d4b5f7' },
                ].map(({ label, val, color }) => (
                  <span key={label} style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                    {label}: <strong style={{ color }}>{formatTL(val)}</strong>
                  </span>
                ))}
              </div>
            )}

            </motion.div>
            )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── Özet kartları ── */}
        {rapor && !loading && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className="grid grid-cols-3 gap-3">
            {[
              { label: 'Toplam', val: rapor.toplamPrim, color: 'var(--app-accent, #a855f7)', bg: 'rgba(var(--app-accent-rgb),0.1)', border: 'rgba(var(--app-accent-rgb),0.25)' },
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
                  style={{ background: 'rgba(var(--app-accent-rgb),0.15)', border: '1px solid rgba(var(--app-accent-rgb),0.3)', color: 'var(--app-accent, #a855f7)' }}>
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
            <div className="w-10 h-10 border-4 border-ta/30 border-t-ta rounded-full animate-spin" />
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

        {/* ── Kişi kartları ── */}
        {!loading && kisiGruplari.length > 0 && (
          <div className="space-y-3">
            {/* Ay başlığı */}
            <p style={{ color: 'rgba(var(--app-accent-rgb),0.6)', fontSize: 11, fontWeight: 700, textAlign: 'center' }}>
              📅 {aylar.find(a => a.value === seciliAy)?.label} Hakediş Raporu
            </p>

            {kisiGruplari.map((kg, ki) => {
              const acik = acikKisiler.has(kg.personelAdi);
              const hepsiSecili = kg.bekleyenKayitlar.length > 0 && kg.bekleyenKayitlar.every(k => seciliMap.has(k.odemeKey));
              const kisimSecili = kg.bekleyenKayitlar.some(k => seciliMap.has(k.odemeKey));
              const maxKademe = kg.kayitlar.reduce((mx, k) => Math.max(mx, k.kademeIndex), 0);
              const avatarColor = KADEME_COLORS[Math.min(maxKademe, 5)];
              const allOdendi = kg.bekleyenPrim === 0;

              return (
                <motion.div
                  key={kg.personelAdi}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: ki * 0.04 }}
                  style={{
                    ...glass,
                    overflow: 'hidden',
                    border: allOdendi
                      ? '1px solid rgba(52,211,153,0.2)'
                      : '1px solid rgba(251,191,36,0.2)',
                  }}
                >
                  {/* ── Kişi başlığı ── */}
                  <div
                    className="flex items-center gap-2.5"
                    style={{
                      padding: '12px 14px',
                      background: hepsiSecili ? 'rgba(var(--app-accent-rgb),0.08)' : kisimSecili ? 'rgba(var(--app-accent-rgb),0.04)' : 'transparent',
                    }}
                  >
                    {/* Checkbox */}
                    {canEdit && kg.bekleyenKayitlar.length > 0 && (
                      <button onClick={() => toggleKisiSecim(kg)} className="shrink-0">
                        <div style={{
                          width: 18, height: 18, borderRadius: 5,
                          border: `1.5px solid ${hepsiSecili ? 'var(--app-accent, #a855f7)' : kisimSecili ? 'rgba(var(--app-accent-rgb),0.5)' : 'rgba(255,255,255,0.2)'}`,
                          background: hepsiSecili ? 'rgba(var(--app-accent-rgb),0.3)' : kisimSecili ? 'rgba(var(--app-accent-rgb),0.1)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {hepsiSecili && <Check className="w-2.5 h-2.5" style={{ color: 'var(--app-accent, #a855f7)' }} />}
                          {!hepsiSecili && kisimSecili && <div style={{ width: 6, height: 6, borderRadius: 1, background: 'var(--app-accent, #a855f7)' }} />}
                        </div>
                      </button>
                    )}
                    {canEdit && kg.bekleyenKayitlar.length === 0 && (
                      <div style={{
                        width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                        background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Check className="w-2.5 h-2.5" style={{ color: '#34d399' }} />
                      </div>
                    )}

                    {/* Avatar */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      background: allOdendi ? 'rgba(52,211,153,0.12)' : `${avatarColor}18`,
                      border: `1.5px solid ${allOdendi ? 'rgba(52,211,153,0.35)' : avatarColor + '40'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 800,
                      color: allOdendi ? '#34d399' : avatarColor,
                    }}>
                      {getInitials(kg.personelAdi)}
                    </div>

                    {/* İsim + durum */}
                    <button onClick={() => toggleKisiPanel(kg.personelAdi)} className="flex-1 min-w-0 text-left">
                      <p style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>{kg.personelAdi}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>
                          {kg.kayitlar.length} kayıt
                        </span>
                        {allOdendi ? (
                          <span style={{
                            fontSize: 9, padding: '1px 6px', borderRadius: 99, fontWeight: 800,
                            background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399',
                          }}>
                            ✓ Tümü ödendi
                          </span>
                        ) : (
                          <span style={{
                            fontSize: 9, padding: '1px 6px', borderRadius: 99, fontWeight: 800,
                            background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24',
                          }}>
                            {formatTL(kg.bekleyenPrim)} bekliyor
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Sağ: tutar + butonlar */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p style={{ color: allOdendi ? '#34d399' : '#fbbf24', fontSize: 15, fontWeight: 900 }}>
                          {formatTL(kg.toplamPrim)}
                        </p>
                        {kg.odenenPrim > 0 && kg.bekleyenPrim > 0 && (
                          <p style={{ color: 'rgba(52,211,153,0.5)', fontSize: 9 }}>
                            {formatTL(kg.odenenPrim)} ödendi
                          </p>
                        )}
                      </div>

                      {canEdit && kg.bekleyenKayitlar.length > 0 && (
                        <button
                          onClick={() => handleOde(kg.bekleyenKayitlar, true)}
                          disabled={saving}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold active:scale-95 transition-all"
                          style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.35)', color: '#34d399' }}
                        >
                          {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Öde
                        </button>
                      )}

                      <div style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {acik ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* ── Gün gün detay ── */}
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
                          padding: '6px 14px 10px',
                          background: 'rgba(0,0,0,0.15)',
                          borderTop: '1px solid rgba(255,255,255,0.05)',
                        }}>
                          <div className="space-y-1">
                            {kg.kayitlar
                              .sort((a, b) => b.tarih.localeCompare(a.tarih) || a.kademeIndex - b.kademeIndex)
                              .map((kayit) => {
                                const kc = KADEME_COLORS[Math.min(kayit.kademeIndex, 5)];
                                const ke = KADEME_EMOJIS[Math.min(kayit.kademeIndex, 5)];
                                return (
                                  <div key={kayit.odemeKey}
                                    className="flex items-center gap-2 flex-wrap"
                                    style={{ padding: '5px 8px', borderRadius: 8, background: kayit.odendi ? 'rgba(52,211,153,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${kayit.odendi ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.06)'}` }}>
                                    <Clock className="w-2.5 h-2.5 shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }} />
                                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 600 }}>
                                      {formatDate(kayit.tarih)}
                                    </span>
                                    {/* Mekan */}
                                    <span style={{ fontSize: 9, color: kayit.mekanColor || 'rgba(255,255,255,0.3)' }}>
                                      {kayit.mekanEmoji} {kayit.mekanName}
                                    </span>
                                    <span style={{
                                      fontSize: 9, padding: '1px 5px', borderRadius: 5, fontWeight: 700,
                                      background: `${kc}14`, border: `1px solid ${kc}30`, color: kc,
                                    }}>
                                      {ke} {kayit.kademeIndex + 1}. Kademe
                                    </span>
                                    {kayit.gorevKisiSayisi && kayit.gorevKisiSayisi > 0 && (
                                      <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}>
                                        {kayit.gorevKisiSayisi} kişi
                                      </span>
                                    )}
                                    {kayit.kidemSeviye && kayit.kidemSeviye !== 'kidemsiz' && (
                                      <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 4, background: kayit.kidemSeviye === 'kidemliPlus' ? 'rgba(var(--app-accent-rgb),0.12)' : 'rgba(96,165,250,0.12)', border: `1px solid ${kayit.kidemSeviye === 'kidemliPlus' ? 'rgba(var(--app-accent-rgb),0.25)' : 'rgba(96,165,250,0.25)'}`, color: kayit.kidemSeviye === 'kidemliPlus' ? 'var(--app-accent, #a855f7)' : '#93c5fd' }}>
                                        {kayit.kidemSeviye === 'kidemliPlus' ? 'Kıdemli+' : 'Kıdemli'}
                                      </span>
                                    )}
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
                                            background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5',
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
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                        <button
                                          onClick={() => handleOde([kayit], true)}
                                          disabled={saving}
                                          style={{
                                            fontSize: 8, padding: '1px 5px', borderRadius: 5, fontWeight: 700,
                                            background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399',
                                          }}
                                          className="active:scale-95 transition-all"
                                        >
                                          Öde
                                        </button>
                                        <button
                                          onClick={() => handleSilPrim([kayit])}
                                          disabled={saving}
                                          title="Bu primi iptal et"
                                          style={{
                                            padding: '2px 4px', borderRadius: 5,
                                            background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)',
                                            color: '#f87171', display: 'flex', alignItems: 'center',
                                          }}
                                          className="active:scale-95 transition-all"
                                        >
                                          <Trash2 style={{ width: 7, height: 7 }} />
                                        </button>
                                      </div>
                                    ) : null}
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
              border: '1px solid rgba(var(--app-accent-rgb),0.4)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderRadius: 18, padding: '12px 16px',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p style={{ color: 'var(--app-accent, #a855f7)', fontSize: 12, fontWeight: 800 }}>
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

      {/* Hakediş Rehber Modalı */}
      {showGuide && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-start justify-center pt-6 overflow-y-auto" onClick={() => setShowGuide(false)}>
          <div
            className="w-full max-w-lg bg-[#1a1a2e] border border-white/10 rounded-2xl mb-8 mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 bg-[#1a1a2e] border-b border-white/8 px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-400" /> Hakediş Takip Rehberi
              </h3>
              <button onClick={() => setShowGuide(false)} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>
            <div className="p-4 space-y-4 text-[12px] leading-relaxed text-white/70">

              <div>
                <h4 className="text-[13px] font-bold text-white mb-1.5">🏆 Hakediş Nedir?</h4>
                <p>Hakediş, mekanın günlük cirosu belirlenen <span className="text-amber-400 font-semibold">kota hedefini</span> geçtiğinde personele ödenen prim/komisyondur. O gün rotasyonda atanan tüm personel hakediş kazanır.</p>
              </div>

              <div className="border-t border-white/8 pt-3">
                <h4 className="text-[13px] font-bold text-white mb-1.5">🎯 Kota Sistemi</h4>
                <p>Her mekan için birden fazla kademe belirlenebilir:</p>
                <div className="mt-1.5 space-y-1">
                  <p>• 🥉 <span className="text-white font-semibold">Kademe 1</span> — Örn: ₺500 ciro → ₺200 prim</p>
                  <p>• 🥈 <span className="text-white font-semibold">Kademe 2</span> — Örn: ₺1.000 ciro → ₺350 prim</p>
                  <p>• 🥇 <span className="text-white font-semibold">Kademe 3</span> — Örn: ₺1.500 ciro → ₺500 prim</p>
                </div>
                <p className="mt-1.5 text-white/50">Ciro ₺1.500'ü geçerse tüm kademeler birlikte kazanılır.</p>
                <p className="mt-1">Kota ayarları: Mekan Yönetimi → ilgili mekan → Kota Kademeleri</p>
              </div>

              <div className="border-t border-white/8 pt-3">
                <h4 className="text-[13px] font-bold text-white mb-1.5">🎖️ Kıdem Çarpanı</h4>
                <p>Personelin kıdemine göre hakediş çarpanla artırılır:</p>
                <div className="mt-1.5 space-y-1">
                  <p>• ⚪ <span className="text-white font-semibold">Kıdemsiz</span> — ×1.00 (değişmez)</p>
                  <p>• 🔵 <span className="text-white font-semibold">Kıdemli</span> — ×1.15 (%15 fazla)</p>
                  <p>• 💜 <span className="text-white font-semibold">Kıdemli+</span> — ×1.30 (%30 fazla)</p>
                </div>
                <p className="mt-1.5 text-white/50">Formül: Hakediş = Temel Tutar × Kıdem Çarpanı</p>
              </div>

              <div className="border-t border-white/8 pt-3">
                <h4 className="text-[13px] font-bold text-white mb-1.5">📊 Üst Kartlar</h4>
                <p>• <span className="text-purple-400 font-semibold">Toplam</span> — Dönemdeki tüm hakediş tutarı</p>
                <p>• <span className="text-emerald-400 font-semibold">Ödenen</span> — Ödemesi yapılmış tutar</p>
                <p>• <span className="text-amber-400 font-semibold">Bekleyen</span> — Henüz ödenmemiş tutar</p>
              </div>

              <div className="border-t border-white/8 pt-3">
                <h4 className="text-[13px] font-bold text-white mb-1.5">💰 Ödeme İşlemleri</h4>
                <p>• Personel kartını açın → her kaydın yanında <span className="text-emerald-400 font-semibold">Öde</span> butonu var</p>
                <p>• Ödeme yapıldığında otomatik gider kaydı oluşur</p>
                <p>• Yanlış ödeme? → <span className="text-orange-400 font-semibold">İptal</span> butonu ile geri alabilirsiniz</p>
                <p>• Toplu ödeme: Checkbox ile seçin → <span className="text-emerald-400 font-semibold">Seçilenleri Öde</span></p>
              </div>

              <div className="border-t border-white/8 pt-3">
                <h4 className="text-[13px] font-bold text-white mb-1.5">📅 Dönem Seçimi</h4>
                <p>Üstteki ay butonlarıyla son 6 ayın hakediş raporlarını görebilirsiniz. Kaydırarak eski aylara ulaşın.</p>
              </div>

              <div className="border-t border-white/8 pt-3">
                <h4 className="text-[13px] font-bold text-white mb-1.5">🔐 Yetkiler</h4>
                <p>• <span className="text-white font-semibold">Yönetici</span> — Tüm işlemler + kıdem çarpan düzenleme</p>
                <p>• <span className="text-white font-semibold">Üst Müdür</span> — Ödeme + çarpanları görüntüleme</p>
                <p>• <span className="text-white font-semibold">Müdür / İdari</span> — Ödeme işlemleri</p>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}