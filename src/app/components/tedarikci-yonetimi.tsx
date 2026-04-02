/**
 * TedarikciYonetimi — Admin tarafı tedarikçi yönetim sayfası.
 * 4 tab: Tedarikçiler, Siparişler, Teslimatlar, Ödemeler
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Package, Truck, Banknote, CheckCircle2, XCircle, Clock, Plus, Send, Eye,
  RefreshCw, UserPlus, ChevronDown, ChevronUp, X, AlertCircle, ChevronRight,
  FileText, Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SERVER_URL } from '../lib/supabase';
import { buildHeaders } from '../lib/api';
import type { UserRole } from './login';

interface TedarikciYonetimiProps {
  userName: string;
  userRole: UserRole;
  accessToken: string;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

type TabKey = 'tedarikci' | 'siparis' | 'teslimat' | 'odeme';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  taslak:         { label: 'Taslak',          color: '#9ca3af', bg: 'rgba(156,163,175,0.15)' },
  gonderildi:     { label: 'Gönderildi',      color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  onaylandi:      { label: 'Onaylandı',       color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
  kismen_teslim:  { label: 'Kısmen Teslim',   color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  teslim_edildi:  { label: 'Teslim Edildi',    color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' },
  tamamlandi:     { label: 'Tamamlandı',       color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  iptal:          { label: 'İptal',            color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
  beklemede:      { label: 'Beklemede',        color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  reddedildi:     { label: 'Reddedildi',       color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
};

const glassBg = 'rgba(255,255,255,0.04)';
const glassBorder = 'rgba(255,255,255,0.08)';

const TABS: Array<{ key: TabKey; label: string; icon: any; color: string }> = [
  { key: 'tedarikci', label: 'Tedarikçiler', icon: Users,    color: '#f97316' },
  { key: 'siparis',   label: 'Siparişler',   icon: Package,  color: '#60a5fa' },
  { key: 'teslimat',  label: 'Teslimatlar',  icon: Truck,    color: '#fbbf24' },
  { key: 'odeme',     label: 'Ödemeler',     icon: Banknote, color: '#34d399' },
];

export function TedarikciYonetimi({ userName, userRole, accessToken, onLogout, onNavigate }: TedarikciYonetimiProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('tedarikci');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  // Modals
  const [showInvite, setShowInvite] = useState(false);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showPayment, setShowPayment] = useState<string | null>(null); // siparisId
  const [actionLoading, setActionLoading] = useState('');

  // Invite form
  const [invEmail, setInvEmail] = useState('');
  const [invName, setInvName] = useState('');
  const [invPhone, setInvPhone] = useState('');
  const [invPassword, setInvPassword] = useState('');
  const [invCariId, setInvCariId] = useState('');

  // New order form
  const [orderCariId, setOrderCariId] = useState('');
  const [orderCurrency, setOrderCurrency] = useState('TRY');
  const [orderNotes, setOrderNotes] = useState('');
  const [orderItems, setOrderItems] = useState<Array<{ productName: string; quantity: number; unitPrice: number }>>([{ productName: '', quantity: 0, unitPrice: 0 }]);

  // Payment form
  const [payAmount, setPayAmount] = useState(0);
  const [payCurrency, setPayCurrency] = useState('TRY');
  const [payMethod, setPayMethod] = useState('havale');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));

  const getHeaders = () => buildHeaders(accessToken);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/tedarikci/ozet`, { headers: buildHeaders(accessToken) });
      const text = await res.text();
      let d: any;
      try { d = JSON.parse(text); } catch { throw new Error('Sunucu yanıtı geçersiz'); }
      if (!res.ok) throw new Error(d.error || 'Veri alınamadı');
      setData(d);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const cariler: any[] = data?.cariler || [];
  const siparisler: any[] = data?.siparisler || [];
  const teslimatlar: any[] = data?.teslimatlar || [];
  const odemeler: any[] = data?.odemeler || [];

  // ── Actions ──
  const inviteSupplier = async () => {
    if (!invEmail || !invCariId) return;
    setActionLoading('invite');
    try {
      const res = await fetch(`${SERVER_URL}/tedarikci/davet`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ email: invEmail, fullName: invName, phone: invPhone, cariId: invCariId, tempPassword: invPassword || undefined }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error); return; }
      setShowInvite(false);
      setInvEmail(''); setInvName(''); setInvPhone(''); setInvPassword(''); setInvCariId('');
      fetchData();
    } finally { setActionLoading(''); }
  };

  const createOrder = async (send: boolean) => {
    if (!orderCariId || orderItems.every(i => !i.productName)) return;
    setActionLoading('order');
    try {
      const items = orderItems.filter(i => i.productName);
      const res = await fetch(`${SERVER_URL}/tedarikci/siparisler`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ cariId: orderCariId, items, currency: orderCurrency, notes: orderNotes }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error); return; }
      if (send && d.siparis?.id) {
        await fetch(`${SERVER_URL}/tedarikci/siparisler/${d.siparis.id}/gonder`, { method: 'POST', headers: getHeaders() });
      }
      setShowNewOrder(false);
      setOrderCariId(''); setOrderNotes(''); setOrderItems([{ productName: '', quantity: 0, unitPrice: 0 }]);
      fetchData();
    } finally { setActionLoading(''); }
  };

  const sendOrder = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch(`${SERVER_URL}/tedarikci/siparisler/${id}/gonder`, { method: 'POST', headers: getHeaders() });
      fetchData();
    } finally { setActionLoading(''); }
  };

  const cancelOrder = async (id: string) => {
    const reason = prompt('İptal sebebi:');
    if (reason === null) return;
    setActionLoading(id);
    try {
      await fetch(`${SERVER_URL}/tedarikci/siparisler/${id}/iptal`, {
        method: 'POST', headers: getHeaders(), body: JSON.stringify({ reason }),
      });
      fetchData();
    } finally { setActionLoading(''); }
  };

  const approveDelivery = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch(`${SERVER_URL}/tedarikci/teslimatlar/${id}/onayla`, { method: 'PUT', headers: getHeaders() });
      fetchData();
    } finally { setActionLoading(''); }
  };

  const rejectDelivery = async (id: string) => {
    const reason = prompt('Red sebebi:');
    if (reason === null) return;
    setActionLoading(id);
    try {
      await fetch(`${SERVER_URL}/tedarikci/teslimatlar/${id}/reddet`, {
        method: 'PUT', headers: getHeaders(), body: JSON.stringify({ reason }),
      });
      fetchData();
    } finally { setActionLoading(''); }
  };

  const recordPayment = async () => {
    if (!showPayment || !payAmount) return;
    setActionLoading('pay');
    try {
      await fetch(`${SERVER_URL}/tedarikci/odemeler`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ siparisId: showPayment, amount: payAmount, currency: payCurrency, paymentMethod: payMethod, paymentDate: payDate }),
      });
      setShowPayment(null);
      setPayAmount(0);
      fetchData();
    } finally { setActionLoading(''); }
  };

  // ── Input helper ──
  const inputStyle = "w-full px-3 py-2.5 rounded-xl text-white bg-white/10 border border-white/15 text-sm placeholder:text-white/25 focus:outline-none focus:border-white/30";

  // ── Render tabs ──
  const renderTedarikciTab = () => (
    <div className="space-y-3">
      <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowInvite(true)}
        className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
        <UserPlus className="w-4 h-4" /> Tedarikçi Davet Et
      </motion.button>

      {cariler.map((c: any) => (
        <div key={c.id} className="p-4 rounded-2xl" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
          <div className="flex items-center gap-3">
            <div className="text-2xl">{c.emoji || '🏢'}</div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm truncate">{c.name}</p>
              {c.linkedUserEmail && <p className="text-green-400 text-xs">✓ {c.linkedUserEmail}</p>}
              {!c.linkedUserId && <p className="text-white/30 text-xs">Hesap bağlı değil</p>}
            </div>
            {c.description && <p className="text-white/30 text-xs max-w-[100px] truncate">{c.description}</p>}
          </div>
        </div>
      ))}
      {cariler.length === 0 && <p className="text-center text-white/30 py-8 text-sm">Henüz cari tanımı yok. Maliyet Yönetimi'nden ekleyin.</p>}
    </div>
  );

  const renderSiparisTab = () => (
    <div className="space-y-3">
      <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowNewOrder(true)}
        className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg, #60a5fa, #3b82f6)' }}>
        <Plus className="w-4 h-4" /> Yeni Sipariş
      </motion.button>

      {siparisler.map((s: any) => {
        const sc = STATUS_CONFIG[s.status] || STATUS_CONFIG.taslak;
        return (
          <div key={s.id} className="p-4 rounded-2xl space-y-2" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{s.cariName}</p>
                <p className="text-white/40 text-xs">{new Date(s.createdAt).toLocaleDateString('tr-TR')}</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
            </div>
            <div className="text-white/50 text-xs">
              {s.items?.map((i: any) => `${i.productName} ×${i.quantity}`).join(', ')}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-white font-bold text-sm">{(s.totalAmount || 0).toLocaleString('tr-TR')} {s.currency}</p>
              <div className="flex gap-2">
                {s.status === 'taslak' && (
                  <>
                    <motion.button whileTap={{ scale: 0.95 }} onClick={() => sendOrder(s.id)}
                      disabled={actionLoading === s.id}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-500/20 border border-blue-500/30">
                      <Send className="w-3 h-3 inline mr-1" /> Gönder
                    </motion.button>
                    <button onClick={() => cancelOrder(s.id)} className="px-3 py-1.5 rounded-lg text-xs text-red-400 bg-red-500/10 border border-red-500/20">İptal</button>
                  </>
                )}
                {['teslim_edildi', 'kismen_teslim', 'onaylandi'].includes(s.status) && (
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setShowPayment(s.id); setPayCurrency(s.currency || 'TRY'); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-green-500/20 border border-green-500/30">
                    <Banknote className="w-3 h-3 inline mr-1" /> Ödeme
                  </motion.button>
                )}
                {!['taslak', 'tamamlandi', 'iptal'].includes(s.status) && (
                  <button onClick={() => cancelOrder(s.id)} className="px-2 py-1.5 rounded-lg text-xs text-red-400/60 hover:text-red-400">
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {siparisler.length === 0 && <p className="text-center text-white/30 py-8 text-sm">Henüz sipariş yok</p>}
    </div>
  );

  const renderTeslimatTab = () => {
    const bekleyen = teslimatlar.filter((t: any) => t.status === 'beklemede');
    const diger = teslimatlar.filter((t: any) => t.status !== 'beklemede');
    return (
      <div className="space-y-3">
        {bekleyen.length > 0 && (
          <div className="p-3 rounded-xl" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.20)' }}>
            <p className="text-amber-400 text-xs font-semibold mb-2">{bekleyen.length} bekleyen teslimat</p>
          </div>
        )}
        {teslimatlar.map((t: any) => {
          const tc = STATUS_CONFIG[t.status] || STATUS_CONFIG.beklemede;
          return (
            <div key={t.id} className="p-4 rounded-2xl space-y-2" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold text-sm">{t.cariName}</p>
                  <p className="text-white/40 text-xs">{t.deliveryDate}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: tc.bg, color: tc.color }}>{tc.label}</span>
              </div>
              <div className="text-white/50 text-xs">
                {t.lines?.map((l: any) => `${l.productName}: ${l.quantity}`).join(', ')}
              </div>
              {t.deliveryNote && <p className="text-white/30 text-xs italic">{t.deliveryNote}</p>}
              {t.status === 'beklemede' && (
                <div className="flex gap-2 pt-1">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => approveDelivery(t.id)}
                    disabled={actionLoading === t.id}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg, #34d399, #10b981)' }}>
                    {actionLoading === t.id ? '...' : '✓ Onayla'}
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => rejectDelivery(t.id)}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20">
                    ✗ Reddet
                  </motion.button>
                </div>
              )}
              {t.rejectionReason && <p className="text-red-400 text-xs">Sebep: {t.rejectionReason}</p>}
              {t.reviewedBy && <p className="text-white/30 text-xs">İşleyen: {t.reviewedBy}</p>}
            </div>
          );
        })}
        {teslimatlar.length === 0 && <p className="text-center text-white/30 py-8 text-sm">Henüz teslimat yok</p>}
      </div>
    );
  };

  const renderOdemeTab = () => (
    <div className="space-y-3">
      {odemeler.map((o: any) => (
        <div key={o.id} className="p-4 rounded-2xl" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-white font-semibold text-sm">{o.cariName}</p>
            <p className="text-white font-bold text-sm">{(o.amount || 0).toLocaleString('tr-TR')} {o.currency}</p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-white/40 text-xs">{o.paymentDate} · {o.paymentMethod}</p>
            <div className="flex items-center gap-2">
              {o.supplierConfirmed ? (
                <span className="text-green-400 text-xs flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Tedarikçi Onayladı</span>
              ) : (
                <span className="text-amber-400 text-xs flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Onay Bekliyor</span>
              )}
            </div>
          </div>
        </div>
      ))}
      {odemeler.length === 0 && <p className="text-center text-white/30 py-8 text-sm">Henüz ödeme yok</p>}
    </div>
  );

  return (
    <div className="min-h-screen pb-28 px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-white">Tedarikçi Yönetimi</h1>
        <button onClick={fetchData} className="p-2 rounded-xl" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
          <RefreshCw className={`w-5 h-5 text-white/50 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map(t => {
          const active = activeTab === t.key;
          const count = t.key === 'teslimat' ? (data?.bekleyenTeslimat || 0) : 0;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all relative"
              style={{
                background: active ? `${t.color}20` : glassBg,
                border: `1px solid ${active ? `${t.color}40` : glassBorder}`,
                color: active ? t.color : 'rgba(255,255,255,0.5)',
              }}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
              {count > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-orange-400 animate-spin" />
        </div>
      ) : (
        <>
          {activeTab === 'tedarikci' && renderTedarikciTab()}
          {activeTab === 'siparis' && renderSiparisTab()}
          {activeTab === 'teslimat' && renderTeslimatTab()}
          {activeTab === 'odeme' && renderOdemeTab()}
        </>
      )}

      {/* ── INVITE MODAL ── */}
      <AnimatePresence>
        {showInvite && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-5"
            onClick={() => setShowInvite(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl p-5 space-y-4"
              style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.10)' }}>
              <div className="flex items-center justify-between">
                <h2 className="text-white font-bold text-lg">Tedarikçi Davet Et</h2>
                <button onClick={() => setShowInvite(false)}><X className="w-5 h-5 text-white/40" /></button>
              </div>
              <select value={invCariId} onChange={e => setInvCariId(e.target.value)} className={inputStyle + ' bg-white/10'}>
                <option value="" className="bg-gray-900">Cari seç...</option>
                {cariler.filter((c: any) => !c.linkedUserId).map((c: any) => (
                  <option key={c.id} value={c.id} className="bg-gray-900">{c.emoji || '🏢'} {c.name}</option>
                ))}
              </select>
              <input type="email" placeholder="E-posta" value={invEmail} onChange={e => setInvEmail(e.target.value)} className={inputStyle} />
              <input type="text" placeholder="Ad Soyad" value={invName} onChange={e => setInvName(e.target.value)} className={inputStyle} />
              <input type="text" placeholder="Telefon (opsiyonel)" value={invPhone} onChange={e => setInvPhone(e.target.value)} className={inputStyle} />
              <input type="password" placeholder="Şifre" value={invPassword} onChange={e => setInvPassword(e.target.value)} className={inputStyle} />
              <motion.button whileTap={{ scale: 0.97 }} onClick={inviteSupplier}
                disabled={!invEmail || !invCariId || !invPassword || actionLoading === 'invite'}
                className="w-full py-3 rounded-xl font-semibold text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
                {actionLoading === 'invite' ? 'Gönderiliyor...' : 'Davet Et'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── NEW ORDER MODAL ── */}
      <AnimatePresence>
        {showNewOrder && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowNewOrder(false)}>
            <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg rounded-t-3xl p-6 space-y-4 max-h-[85vh] overflow-y-auto"
              style={{ background: 'rgba(15,10,40,0.98)', border: '1px solid rgba(255,255,255,0.10)', borderBottom: 'none' }}>
              <div className="flex items-center justify-between">
                <h2 className="text-white font-bold text-lg">Yeni Sipariş</h2>
                <button onClick={() => setShowNewOrder(false)}><X className="w-5 h-5 text-white/40" /></button>
              </div>
              <select value={orderCariId} onChange={e => setOrderCariId(e.target.value)} className={inputStyle + ' bg-white/10'}>
                <option value="" className="bg-gray-900">Tedarikçi seç...</option>
                {cariler.map((c: any) => (
                  <option key={c.id} value={c.id} className="bg-gray-900">{c.emoji || '🏢'} {c.name}</option>
                ))}
              </select>
              <select value={orderCurrency} onChange={e => setOrderCurrency(e.target.value)} className={inputStyle + ' bg-white/10'}>
                {['TRY', 'USD', 'EUR', 'GBP'].map(cur => <option key={cur} value={cur} className="bg-gray-900">{cur}</option>)}
              </select>

              <p className="text-white/60 text-xs font-semibold">Kalemler</p>
              {orderItems.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <input placeholder="Ürün adı" value={item.productName}
                    onChange={e => setOrderItems(prev => prev.map((p, i) => i === idx ? { ...p, productName: e.target.value } : p))}
                    className={inputStyle + ' flex-1'} />
                  <input type="number" placeholder="Adet" value={item.quantity || ''}
                    onChange={e => setOrderItems(prev => prev.map((p, i) => i === idx ? { ...p, quantity: parseInt(e.target.value) || 0 } : p))}
                    className={inputStyle + ' w-20 text-center'} />
                  <input type="number" placeholder="Fiyat" value={item.unitPrice || ''}
                    onChange={e => setOrderItems(prev => prev.map((p, i) => i === idx ? { ...p, unitPrice: parseFloat(e.target.value) || 0 } : p))}
                    className={inputStyle + ' w-24 text-center'} />
                  {orderItems.length > 1 && (
                    <button onClick={() => setOrderItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 pb-2"><X className="w-4 h-4" /></button>
                  )}
                </div>
              ))}
              <button onClick={() => setOrderItems(prev => [...prev, { productName: '', quantity: 0, unitPrice: 0 }])}
                className="text-blue-400 text-xs font-medium">+ Kalem Ekle</button>

              <textarea placeholder="Not (opsiyonel)" value={orderNotes} onChange={e => setOrderNotes(e.target.value)}
                className={inputStyle + ' resize-none'} rows={2} />

              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => createOrder(false)}
                  disabled={!orderCariId || actionLoading === 'order'}
                  className="flex-1 py-3 rounded-xl font-semibold text-white/60 bg-white/10 border border-white/15 disabled:opacity-40 text-sm">
                  Taslak Kaydet
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => createOrder(true)}
                  disabled={!orderCariId || actionLoading === 'order'}
                  className="flex-1 py-3 rounded-xl font-semibold text-white disabled:opacity-40 text-sm"
                  style={{ background: 'linear-gradient(135deg, #60a5fa, #3b82f6)' }}>
                  {actionLoading === 'order' ? '...' : 'Kaydet & Gönder'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PAYMENT MODAL ── */}
      <AnimatePresence>
        {showPayment && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowPayment(null)}>
            <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg rounded-t-3xl p-6 space-y-4"
              style={{ background: 'rgba(15,10,40,0.98)', border: '1px solid rgba(255,255,255,0.10)', borderBottom: 'none' }}>
              <div className="flex items-center justify-between">
                <h2 className="text-white font-bold text-lg">Ödeme Kaydet</h2>
                <button onClick={() => setShowPayment(null)}><X className="w-5 h-5 text-white/40" /></button>
              </div>
              <input type="number" placeholder="Tutar" value={payAmount || ''} onChange={e => setPayAmount(parseFloat(e.target.value) || 0)} className={inputStyle} />
              <select value={payCurrency} onChange={e => setPayCurrency(e.target.value)} className={inputStyle + ' bg-white/10'}>
                {['TRY', 'USD', 'EUR', 'GBP'].map(cur => <option key={cur} value={cur} className="bg-gray-900">{cur}</option>)}
              </select>
              <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className={inputStyle + ' bg-white/10'}>
                <option value="havale" className="bg-gray-900">Havale/EFT</option>
                <option value="nakit" className="bg-gray-900">Nakit</option>
                <option value="kart" className="bg-gray-900">Kredi Kartı</option>
              </select>
              <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className={inputStyle} />
              <motion.button whileTap={{ scale: 0.97 }} onClick={recordPayment}
                disabled={!payAmount || actionLoading === 'pay'}
                className="w-full py-3 rounded-xl font-semibold text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #34d399, #10b981)' }}>
                {actionLoading === 'pay' ? '...' : 'Ödemeyi Kaydet'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
