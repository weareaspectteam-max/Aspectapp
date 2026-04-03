/**
 * TedarikciPortal — Tedarikçi (supplier) ana dashboard'u.
 * Çok şirketli: üstte şirket seçimi, siparişler, teslimat bildirimi, ödeme onayı.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Package, Truck, Banknote, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp,
  Building2, RefreshCw, Send, AlertCircle, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SERVER_URL } from '../lib/supabase';
import { buildHeaders } from '../lib/api';
import type { UserRole } from './login';

// ── Types ──
interface LinkedCompany { companyId: string; cariId: string; companyName: string }
interface OrderItem { id: string; productName: string; quantity: number; unitPrice: number; currency: string; deliveredQuantity: number; notes?: string }
interface PurchaseOrder {
  id: string; cariId: string; cariName: string; status: string; items: OrderItem[];
  totalAmount: number; currency: string; notes: string; createdAt: string;
  sentAt?: string; confirmedAt?: string; completedAt?: string; cancelReason?: string;
}
interface DeliveryRecord { id: string; siparisId: string; status: string; lines: Array<{ itemId: string; productName: string; quantity: number }>; deliveryDate: string; deliveryNote?: string; createdAt: string; reviewedBy?: string; rejectionReason?: string }
interface SupplierPayment { id: string; siparisId: string; amount: number; currency: string; paymentMethod: string; paymentDate: string; status: string; supplierConfirmed: boolean; createdAt: string }

interface TedarikciPortalProps {
  userName: string;
  userId: string;
  accessToken: string;
  linkedCompanies: LinkedCompany[];
  activeCompanyId: string;
  onCompanyChange: (id: string) => void;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

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

export function TedarikciPortal({ userName, userId, accessToken, linkedCompanies, activeCompanyId, onCompanyChange, onLogout, onNavigate }: TedarikciPortalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [portalData, setPortalData] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [deliveryLines, setDeliveryLines] = useState<Array<{ itemId: string; quantity: number }>>([]);
  const [deliveryNote, setDeliveryNote] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [offerItems, setOfferItems] = useState<Array<{ productName: string; quantity: number; unitPrice: number }>>([]);
  const [offerNotes, setOfferNotes] = useState('');
  const [offerTeklifFiyat, setOfferTeklifFiyat] = useState('');

  const headers = useCallback(() => ({
    ...buildHeaders(accessToken),
    'X-Supplier-Company': activeCompanyId,
  }), [accessToken, activeCompanyId]);

  // ── Fetch portal data ──
  const fetchPortal = useCallback(async () => {
    if (!activeCompanyId) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${SERVER_URL}/tedarikci/portal`, { headers: headers() });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { throw new Error('Sunucu yanıtı geçersiz'); }
      if (!res.ok) throw new Error(data.error || 'Veri alınamadı');
      setPortalData(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, headers]);

  useEffect(() => { fetchPortal(); }, [fetchPortal]);

  // ── Fetch order detail ──
  const fetchOrderDetail = async (orderId: string) => {
    try {
      const res = await fetch(`${SERVER_URL}/tedarikci/siparisler/${orderId}`, { headers: headers() });
      const data = await res.json();
      if (res.ok) setOrderDetail(data);
    } catch {}
  };

  useEffect(() => {
    if (selectedOrder) fetchOrderDetail(selectedOrder);
    else setOrderDetail(null);
  }, [selectedOrder]);

  // ── Actions ──
  const confirmOrder = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      const res = await fetch(`${SERVER_URL}/tedarikci/siparisler/${orderId}/onayla`, { method: 'POST', headers: headers() });
      if (res.ok) { fetchPortal(); if (selectedOrder === orderId) fetchOrderDetail(orderId); }
    } finally { setActionLoading(''); }
  };

  const submitDelivery = async (orderId: string) => {
    const validLines = deliveryLines.filter(l => l.quantity > 0);
    if (!validLines.length) return;
    setActionLoading('delivery');
    try {
      const res = await fetch(`${SERVER_URL}/tedarikci/teslimat`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ siparisId: orderId, lines: validLines, deliveryNote }),
      });
      if (res.ok) {
        setShowDeliveryForm(false);
        setDeliveryLines([]);
        setDeliveryNote('');
        fetchPortal();
        if (selectedOrder === orderId) fetchOrderDetail(orderId);
      }
    } finally { setActionLoading(''); }
  };

  const confirmPayment = async (odemeId: string) => {
    setActionLoading(odemeId);
    try {
      const res = await fetch(`${SERVER_URL}/tedarikci/odemeler/${odemeId}/onayla`, { method: 'POST', headers: headers() });
      if (res.ok) { fetchPortal(); if (selectedOrder) fetchOrderDetail(selectedOrder); }
    } finally { setActionLoading(''); }
  };

  // ── Şirket Seçim Ekranı ──
  if (!activeCompanyId && linkedCompanies.length > 1) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🏭</div>
            <h1 className="text-2xl font-bold text-white mb-2">Hoş geldin, {userName}</h1>
            <p className="text-white/50">Hangi şirketin portalına girmek istiyorsun?</p>
          </div>
          <div className="space-y-3">
            {linkedCompanies.map(lc => (
              <motion.button
                key={lc.companyId}
                whileTap={{ scale: 0.98 }}
                onClick={() => onCompanyChange(lc.companyId)}
                className="w-full p-4 rounded-2xl text-left flex items-center gap-4"
                style={{ background: glassBg, border: `1px solid ${glassBorder}` }}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-orange-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold">{lc.companyName}</p>
                  <p className="text-white/40 text-sm">{lc.companyId}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-white/30" />
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  if (!activeCompanyId && linkedCompanies.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-white/60">Henüz hiçbir şirkete bağlı değilsiniz.</p>
        </div>
      </div>
    );
  }

  const activeCompany = linkedCompanies.find(lc => lc.companyId === activeCompanyId);
  const ozet = portalData?.ozet || {};
  const siparisler: PurchaseOrder[] = portalData?.siparisler || [];
  const teslimatlar: DeliveryRecord[] = portalData?.teslimatlar || [];
  const odemeler: SupplierPayment[] = portalData?.odemeler || [];

  // ── Sipariş Detay View ──
  const renderOrderDetail = () => {
    if (!orderDetail?.siparis) return null;
    const s: PurchaseOrder = orderDetail.siparis;
    const sTeslimatlar: DeliveryRecord[] = orderDetail.teslimatlar || [];
    const sOdemeler: SupplierPayment[] = orderDetail.odemeler || [];
    const sc = STATUS_CONFIG[s.status] || STATUS_CONFIG.taslak;

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => setSelectedOrder(null)} className="text-white/50 hover:text-white">← Geri</button>
          <div className="flex-1" />
          <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
        </div>

        {/* Kalemler Tablosu */}
        <div className="rounded-2xl overflow-hidden" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: glassBorder }}>
            <p className="text-white font-semibold text-sm">Sipariş Kalemleri</p>
          </div>
          {s.items.map(item => {
            const remaining = item.quantity - (item.deliveredQuantity || 0);
            const pct = item.quantity > 0 ? Math.min(100, ((item.deliveredQuantity || 0) / item.quantity) * 100) : 0;
            return (
              <div key={item.id} className="px-4 py-3 border-b" style={{ borderColor: glassBorder }}>
                <div className="flex justify-between items-start mb-1">
                  <p className="text-white text-sm font-medium">{item.productName}</p>
                  <p className="text-white/50 text-xs">{item.unitPrice.toLocaleString('tr-TR')} {item.currency}/adet</p>
                </div>
                <div className="flex gap-4 text-xs text-white/40 mb-2">
                  <span>Sipariş: {item.quantity}</span>
                  <span className="text-green-400">Teslim: {item.deliveredQuantity || 0}</span>
                  <span className="text-orange-400">Kalan: {remaining}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Aksiyonlar */}
        {/* Teklif bölümü */}
        {s.teklifFiyat && (
          <div className="p-3 rounded-xl" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-amber-400 text-xs font-semibold">💰 Teklif</span>
              {s.teklifDurum === 'kabul_edildi' && <span className="text-green-400 text-[10px]">✓ Kabul edildi</span>}
              {s.teklifDurum === 'reddedildi' && <span className="text-red-400 text-[10px]">✗ Reddedildi</span>}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/40 text-xs">Liste: ₺{(s.totalAmount || 0).toLocaleString('tr-TR')}</span>
              <span className="text-amber-400 font-bold">Teklif: ₺{s.teklifFiyat.toLocaleString('tr-TR')}</span>
            </div>
            {(s.teklifler || []).length > 0 && (
              <div className="mt-2 space-y-1">
                {(s.teklifler || []).map((t: any, i: number) => (
                  <div key={i} className="flex justify-between text-[10px]">
                    <span className={t.taraf === 'admin' ? 'text-blue-400' : 'text-orange-400'}>{t.taraf === 'admin' ? '🏢' : '🏭'} {t.kisi}</span>
                    <span className="text-white/50">{t.aksiyon === 'kabul' ? '✓ Kabul' : t.aksiyon === 'red' ? '✗ Red' : `₺${t.fiyat?.toLocaleString('tr-TR')}`}</span>
                  </div>
                ))}
              </div>
            )}
            {s.teklifDurum !== 'kabul_edildi' && s.teklifDurum !== 'reddedildi' && (
              <div className="flex gap-2 mt-3">
                <button onClick={async () => {
                  setActionLoading('teklif_kabul');
                  await fetch(`${SERVER_URL}/tedarikci/siparisler/${s.id}/teklif`, { method: 'POST', headers: headers(), body: JSON.stringify({ aksiyon: 'kabul' }) });
                  fetchPortal(); fetchOrderDetail(s.id); setActionLoading('');
                }} className="flex-1 py-2 rounded-lg text-xs font-bold text-green-400 bg-green-500/15 border border-green-500/25">✓ Kabul</button>
                <button onClick={async () => {
                  const f = prompt('Karşı teklif fiyatı (₺):');
                  if (!f) return;
                  setActionLoading('teklif_karsi');
                  await fetch(`${SERVER_URL}/tedarikci/siparisler/${s.id}/teklif`, { method: 'POST', headers: headers(), body: JSON.stringify({ fiyat: parseFloat(f) }) });
                  fetchPortal(); fetchOrderDetail(s.id); setActionLoading('');
                }} className="flex-1 py-2 rounded-lg text-xs font-bold text-amber-400 bg-amber-500/15 border border-amber-500/25">↩ Karşı Teklif</button>
                <button onClick={async () => {
                  setActionLoading('teklif_red');
                  await fetch(`${SERVER_URL}/tedarikci/siparisler/${s.id}/teklif`, { method: 'POST', headers: headers(), body: JSON.stringify({ aksiyon: 'red' }) });
                  fetchPortal(); fetchOrderDetail(s.id); setActionLoading('');
                }} className="flex-1 py-2 rounded-lg text-xs font-bold text-red-400 bg-red-500/15 border border-red-500/25">✗ Red</button>
              </div>
            )}
          </div>
        )}

        {s.status === 'gonderildi' && !s.teklifFiyat && (
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => confirmOrder(s.id)}
            disabled={actionLoading === s.id}
            className="w-full py-3 rounded-xl font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #34d399, #10b981)' }}>
            {actionLoading === s.id ? 'Onaylanıyor...' : '✓ Siparişi Kabul Et'}
          </motion.button>
        )}

        {['onaylandi', 'kismen_teslim'].includes(s.status) && !showDeliveryForm && (
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => {
            setShowDeliveryForm(true);
            setDeliveryLines(s.items.filter(i => i.quantity > (i.deliveredQuantity || 0)).map(i => ({ itemId: i.id, quantity: 0 })));
          }}
            className="w-full py-3 rounded-xl font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #60a5fa, #3b82f6)' }}>
            <Truck className="w-4 h-4 inline mr-2" />Teslimat Bildir
          </motion.button>
        )}

        {/* Teslimat Formu */}
        <AnimatePresence>
          {showDeliveryForm && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="rounded-2xl overflow-hidden" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.20)' }}>
              <div className="p-4 space-y-3">
                <p className="text-white font-semibold text-sm">Teslimat Miktarları</p>
                {s.items.filter(i => i.quantity > (i.deliveredQuantity || 0)).map((item, idx) => {
                  const max = item.quantity - (item.deliveredQuantity || 0);
                  return (
                    <div key={item.id} className="flex items-center gap-3">
                      <span className="text-white/60 text-sm flex-1">{item.productName} (kalan: {max})</span>
                      <input
                        type="number" min={0} max={max}
                        value={deliveryLines[idx]?.quantity || 0}
                        onChange={e => {
                          const v = Math.min(max, Math.max(0, parseInt(e.target.value) || 0));
                          setDeliveryLines(prev => prev.map((l, i) => i === idx ? { ...l, quantity: v } : l));
                        }}
                        className="w-20 px-3 py-2 rounded-lg text-center text-white bg-white/10 border border-white/20 text-sm"
                      />
                    </div>
                  );
                })}
                <textarea
                  placeholder="Not (opsiyonel)"
                  value={deliveryNote}
                  onChange={e => setDeliveryNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-white bg-white/10 border border-white/20 text-sm resize-none"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button onClick={() => setShowDeliveryForm(false)} className="flex-1 py-2 rounded-lg text-white/60 bg-white/5 text-sm">İptal</button>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => submitDelivery(s.id)}
                    disabled={actionLoading === 'delivery' || deliveryLines.every(l => l.quantity === 0)}
                    className="flex-1 py-2 rounded-lg font-semibold text-white text-sm disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg, #60a5fa, #3b82f6)' }}>
                    {actionLoading === 'delivery' ? 'Gönderiliyor...' : 'Bildir'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Teslimat Geçmişi */}
        {sTeslimatlar.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: glassBorder }}>
              <p className="text-white font-semibold text-sm">Teslimat Geçmişi</p>
            </div>
            {sTeslimatlar.map(t => {
              const tc = STATUS_CONFIG[t.status] || STATUS_CONFIG.beklemede;
              return (
                <div key={t.id} className="px-4 py-3 border-b" style={{ borderColor: glassBorder }}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-white/60 text-xs">{t.deliveryDate}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: tc.bg, color: tc.color }}>{tc.label}</span>
                  </div>
                  <div className="text-white/50 text-xs">
                    {t.lines.map(l => `${l.productName}: ${l.quantity}`).join(', ')}
                  </div>
                  {t.rejectionReason && <p className="text-red-400 text-xs mt-1">Sebep: {t.rejectionReason}</p>}
                </div>
              );
            })}
          </div>
        )}

        {/* Ödeme Geçmişi */}
        {sOdemeler.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: glassBorder }}>
              <p className="text-white font-semibold text-sm">Ödemeler</p>
            </div>
            {sOdemeler.map(o => (
              <div key={o.id} className="px-4 py-3 border-b flex items-center gap-3" style={{ borderColor: glassBorder }}>
                <div className="flex-1">
                  <p className="text-white text-sm">{o.amount.toLocaleString('tr-TR')} {o.currency}</p>
                  <p className="text-white/40 text-xs">{o.paymentDate} · {o.paymentMethod}</p>
                </div>
                {o.supplierConfirmed ? (
                  <span className="text-green-400 text-xs flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Onaylandı</span>
                ) : (
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => confirmPayment(o.id)}
                    disabled={actionLoading === o.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                    style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)' }}>
                    {actionLoading === o.id ? '...' : 'Aldım ✓'}
                  </motion.button>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>
    );
  };

  // ── Ana Dashboard ──
  return (
    <div className="min-h-screen pb-28 px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Tedarikçi Portalı</h1>
          <p className="text-white/40 text-sm">{userName} · {activeCompany?.companyName || activeCompanyId}</p>
        </div>
        <div className="flex items-center gap-2">
          {linkedCompanies.length > 1 && (
            <button onClick={() => onCompanyChange('')} className="p-2 rounded-xl" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
              <Building2 className="w-5 h-5 text-orange-400" />
            </button>
          )}
          <button onClick={fetchPortal} className="p-2 rounded-xl" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
            <RefreshCw className={`w-5 h-5 text-white/50 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      )}

      {loading && !portalData ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-orange-400 animate-spin" />
        </div>
      ) : selectedOrder ? (
        renderOrderDetail()
      ) : (
        <div className="space-y-4">
          {/* Özet Kartlar */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Package, label: 'Aktif Sipariş', value: ozet.aktivSiparis || 0, color: '#60a5fa' },
              { icon: Truck, label: 'Bekleyen Teslimat', value: ozet.bekleyenTeslimat || 0, color: '#fbbf24' },
              { icon: Banknote, label: 'Toplam Tutar', value: `₺${(ozet.toplamSiparisTutar || 0).toLocaleString('tr-TR')}`, color: '#a78bfa' },
              { icon: CheckCircle2, label: 'Ödenen', value: `₺${(ozet.toplamOdenen || 0).toLocaleString('tr-TR')}`, color: '#34d399' },
            ].map((c, i) => (
              <div key={i} className="p-4 rounded-2xl" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
                <c.icon className="w-5 h-5 mb-2" style={{ color: c.color }} />
                <p className="text-white font-bold text-lg">{c.value}</p>
                <p className="text-white/40 text-xs">{c.label}</p>
              </div>
            ))}
          </div>

          {/* Kalan Borç */}
          {(ozet.kalanBorc || 0) > 0 && (
            <div className="p-4 rounded-2xl" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.20)' }}>
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-amber-400" />
                <span className="text-amber-400 font-semibold">Kalan Alacak: ₺{(ozet.kalanBorc || 0).toLocaleString('tr-TR')}</span>
              </div>
            </div>
          )}

          {/* Teklif Oluştur butonu */}
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => {
            const cari = portalData?.cari || {};
            const albums: any[] = portalData?.albumler || [];
            const fl = portalData?.fiyatListesi;
            if (cari.supplierType === 'album') {
              const items = [3,5,7,9,11,13,15].map(s => {
                const a = albums.find((al: any) => al.size === s || al.size === String(s));
                const flItem = (fl?.items || []).find((f: any) => f.productName === `${s} Kare`);
                return { productName: `${s} Kare`, quantity: 0, unitPrice: flItem?.fiyat || a?.yarimBoy || a?.tamBoy || 0 };
              });
              items.push({ productName: 'Paspartu', quantity: 0, unitPrice: 0 });
              setOfferItems(items);
            } else {
              setOfferItems([{ productName: '', quantity: 0, unitPrice: 0 }]);
            }
            setOfferNotes(''); setOfferTeklifFiyat('');
            setShowOfferForm(true);
          }}
            className="w-full py-3 rounded-2xl font-semibold text-white flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #fbbf24, #d97706)' }}>
            💰 Teklif Oluştur
          </motion.button>

          {/* Siparişler */}
          <div className="rounded-2xl overflow-hidden" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: glassBorder }}>
              <p className="text-white font-semibold">Siparişler</p>
            </div>
            {siparisler.length === 0 ? (
              <div className="p-8 text-center text-white/30 text-sm">Henüz sipariş yok</div>
            ) : (
              siparisler.map(s => {
                const sc = STATUS_CONFIG[s.status] || STATUS_CONFIG.taslak;
                return (
                  <motion.button
                    key={s.id} whileTap={{ scale: 0.99 }}
                    onClick={() => setSelectedOrder(s.id)}
                    className="w-full px-4 py-3 border-b text-left flex items-center gap-3"
                    style={{ borderColor: glassBorder }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {s.items.map(i => i.productName).join(', ')}
                      </p>
                      <p className="text-white/40 text-xs mt-0.5">
                        {new Date(s.createdAt).toLocaleDateString('tr-TR')} · {s.totalAmount.toLocaleString('tr-TR')} {s.currency}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap" style={{ background: sc.bg, color: sc.color }}>
                      {sc.label}
                    </span>
                    <ChevronRight className="w-4 h-4 text-white/20 flex-shrink-0" />
                  </motion.button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Teklif Oluştur Modal */}
      <AnimatePresence>
        {showOfferForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-5"
            onClick={() => setShowOfferForm(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl p-5 space-y-3 max-h-[85vh] overflow-y-auto"
              style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.10)' }}>
              <div className="flex items-center justify-between">
                <h2 className="text-white font-bold text-lg">💰 Teklif Oluştur</h2>
                <button onClick={() => setShowOfferForm(false)} className="text-white/40"><span className="text-xl">×</span></button>
              </div>

              <div className="space-y-1">
                {offerItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 py-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span className="flex-1 text-white text-xs">{item.productName || 'Ürün'}</span>
                    <input type="number" min={0} value={item.unitPrice || ''} onChange={e => setOfferItems(prev => prev.map((p, i) => i === idx ? { ...p, unitPrice: parseFloat(e.target.value) || 0 } : p))}
                      className="w-16 px-1 py-1 rounded text-center text-green-400 bg-white/10 border border-white/20 text-[10px]" placeholder="₺" />
                    <input type="number" min={0} value={item.quantity || ''} onChange={e => setOfferItems(prev => prev.map((p, i) => i === idx ? { ...p, quantity: parseInt(e.target.value) || 0 } : p))}
                      className="w-14 px-1 py-1 rounded text-center text-white bg-white/10 border border-white/20 text-[10px]" placeholder="Adet" />
                  </div>
                ))}
              </div>

              <div className="flex justify-between text-xs">
                <span className="text-white/40">Liste Toplam:</span>
                <span className="text-white font-bold">₺{offerItems.reduce((a, i) => a + (i.quantity * i.unitPrice), 0).toLocaleString('tr-TR')}</span>
              </div>

              <div className="p-3 rounded-xl" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)' }}>
                <span className="text-amber-400 text-xs font-semibold block mb-1">Teklif Fiyatı</span>
                <input type="number" min={0} value={offerTeklifFiyat || ''} onChange={e => setOfferTeklifFiyat(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-amber-400 bg-white/10 border border-amber-400/20 text-sm font-bold text-center" placeholder="₺ Toplam teklif tutarı" />
              </div>

              <textarea placeholder="Not (opsiyonel)" value={offerNotes} onChange={e => setOfferNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-white bg-white/10 border border-white/20 text-sm resize-none" rows={2} />

              <motion.button whileTap={{ scale: 0.97 }} onClick={async () => {
                const items = offerItems.filter(i => i.quantity > 0);
                if (!items.length) return;
                setActionLoading('offer');
                try {
                  await fetch(`${SERVER_URL}/tedarikci/teklif`, {
                    method: 'POST', headers: headers(),
                    body: JSON.stringify({ items, currency: 'TRY', notes: offerNotes, teklifFiyat: offerTeklifFiyat ? parseFloat(offerTeklifFiyat) : null }),
                  });
                  setShowOfferForm(false);
                  fetchPortal();
                } finally { setActionLoading(''); }
              }}
                disabled={offerItems.every(i => i.quantity === 0) || actionLoading === 'offer'}
                className="w-full py-3 rounded-xl font-semibold text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #fbbf24, #d97706)' }}>
                {actionLoading === 'offer' ? '...' : '💰 Teklif Gönder'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
