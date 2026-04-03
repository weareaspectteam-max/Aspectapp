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
import { buildHeaders, appendGhostParam } from '../lib/api';
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
  const [selectedTedarikci, setSelectedTedarikci] = useState<any>(null); // seçili tedarikçi
  const [tedarikciTab, setTedarikciTab] = useState<'siparisler' | 'fiyatlar' | 'bakiye'>('siparisler');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  // Modals
  const [showInvite, setShowInvite] = useState(false);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showPayment, setShowPayment] = useState<string | null>(null); // siparisId
  const [showPriceList, setShowPriceList] = useState<string | null>(null); // cariId
  const [selectedSiparis, setSelectedSiparis] = useState<any>(null); // detay görünümü
  const [karsiTeklifItems, setKarsiTeklifItems] = useState<Array<{ productName: string; quantity: number; unitPrice: number }>>([]);
  const [karsiTeklifFiyat, setKarsiTeklifFiyat] = useState('');
  const [siparisFiltre, setSiparisFiltre] = useState<'tumu' | 'aktif' | 'teklif' | 'gecmis' | 'iptal'>('tumu');
  const [showOnOdeme, setShowOnOdeme] = useState(false);
  const [onOdemeTutar, setOnOdemeTutar] = useState('');
  const [onOdemeAciklama, setOnOdemeAciklama] = useState('');
  const [priceListItems, setPriceListItems] = useState<Array<{ productName: string; fiyat: number; currency: string }>>([]);
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
  const [orderItems, setOrderItems] = useState<Array<{ productName: string; quantity: number; unitPrice: number }>>([]);
  const [orderTeklifFiyat, setOrderTeklifFiyat] = useState('');

  // Payment form
  const [payAmount, setPayAmount] = useState(0);
  const [payCurrency, setPayCurrency] = useState('TRY');
  const [payMethod, setPayMethod] = useState('havale');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));

  const getHeaders = () => buildHeaders(accessToken);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(appendGhostParam(`${SERVER_URL}/tedarikci/ozet`), { headers: buildHeaders(accessToken) });
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

  // Derived: selected cari's supplier type + product list
  const selectedCari = cariler.find((c: any) => c.id === orderCariId);
  const supplierType = selectedCari?.supplierType || '';
  const albumler: any[] = data?.albumler || [];
  const depoStok: any = data?.depoStok || {};
  const genelStok: any = data?.genelStok || {};
  const papers: any[] = data?.papers || [];
  const fiyatMap: any = data?.fiyatMap || {};
  const cariFiyat: any = fiyatMap[orderCariId] || {};

  // ── Actions ──
  const inviteSupplier = async () => {
    if (!invEmail || !invCariId) return;
    setActionLoading('invite');
    try {
      const res = await fetch(appendGhostParam(`${SERVER_URL}/tedarikci/davet`), {
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
      const items = orderItems.filter(i => i.productName && i.quantity > 0);
      const res = await fetch(appendGhostParam(`${SERVER_URL}/tedarikci/siparisler`), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ cariId: orderCariId, items, currency: orderCurrency, notes: orderNotes, teklifFiyat: orderTeklifFiyat ? parseFloat(orderTeklifFiyat) : null }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error); return; }
      if (send && d.siparis?.id) {
        await fetch(appendGhostParam(`${SERVER_URL}/tedarikci/siparisler/${d.siparis.id}/gonder`), { method: 'POST', headers: getHeaders() });
      }
      setShowNewOrder(false);
      setOrderCariId(''); setOrderNotes(''); setOrderItems([]); setOrderTeklifFiyat('');
      fetchData();
    } finally { setActionLoading(''); }
  };

  const sendOrder = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch(appendGhostParam(`${SERVER_URL}/tedarikci/siparisler/${id}/gonder`), { method: 'POST', headers: getHeaders() });
      fetchData();
    } finally { setActionLoading(''); }
  };

  const cancelOrder = async (id: string) => {
    if (!confirm('Bu siparişi iptal etmek istiyor musunuz?')) return;
    setActionLoading(id);
    try {
      await fetch(appendGhostParam(`${SERVER_URL}/tedarikci/siparisler/${id}/iptal`), {
        method: 'POST', headers: getHeaders(), body: JSON.stringify({ reason: 'İptal edildi' }),
      });
      fetchData();
    } finally { setActionLoading(''); }
  };

  const approveDelivery = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch(appendGhostParam(`${SERVER_URL}/tedarikci/teslimatlar/${id}/onayla`), { method: 'PUT', headers: getHeaders() });
      fetchData();
    } finally { setActionLoading(''); }
  };

  const rejectDelivery = async (id: string) => {
    if (!confirm('Bu teslimatı reddetmek istiyor musunuz?')) return;
    const reason = 'Reddedildi';
    setActionLoading(id);
    try {
      await fetch(appendGhostParam(`${SERVER_URL}/tedarikci/teslimatlar/${id}/reddet`), {
        method: 'PUT', headers: getHeaders(), body: JSON.stringify({ reason }),
      });
      fetchData();
    } finally { setActionLoading(''); }
  };

  const recordPayment = async () => {
    if (!showPayment || !payAmount) return;
    setActionLoading('pay');
    try {
      await fetch(appendGhostParam(`${SERVER_URL}/tedarikci/odemeler`), {
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
        <motion.button key={c.id} whileTap={{ scale: 0.98 }} onClick={() => { setSelectedTedarikci(c); setTedarikciTab('siparisler'); setSelectedSiparis(null); }}
          className="w-full p-4 rounded-2xl text-left" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
          <div className="flex items-center gap-3">
            <div className="text-2xl">{c.emoji || '🏢'}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-white font-semibold text-sm truncate">{c.name}</p>
                {c.supplierType && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">{c.supplierType === 'album' ? 'Albüm' : 'Ribon'}</span>}
              </div>
              {c.linkedUserEmail && <p className="text-green-400 text-xs">✓ {c.linkedUserEmail}</p>}
              {!c.linkedUserId && <p className="text-white/30 text-xs">Hesap bağlı değil</p>}
              {c.description && <p className="text-white/25 text-[10px]">{c.description}</p>}
            </div>
            <div className="flex flex-col items-end gap-1.5">
              {c.linkedUserId && (
                <span className={`px-2 py-1 rounded-lg text-[9px] font-medium ${c.stokGorunur !== false ? 'text-cyan-400 border-cyan-400/20 bg-cyan-400/10' : 'text-white/30 border-white/10 bg-white/5'} border`}>
                  {c.stokGorunur !== false ? '👁 Stok Açık' : '🚫 Stok Kapalı'}
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-white/20" />
            </div>
          </div>
        </motion.button>
      ))}
      {cariler.length === 0 && <p className="text-center text-white/30 py-8 text-sm">Henüz cari tanımı yok. Maliyet Yönetimi'nden ekleyin.</p>}
    </div>
  );

  const renderSiparisTab = () => {
    // Detay görünümü
    if (selectedSiparis) {
      const s = selectedSiparis;
      const sc = STATUS_CONFIG[s.status] || STATUS_CONFIG.taslak;
      const showTeklifActions = ['karsi_teklif', 'tedarikci_teklifi', 'teklif_verildi'].includes(s.teklifDurum);
      return (
        <div className="space-y-3">
          <button onClick={() => setSelectedSiparis(null)} className="text-white/50 text-sm">← Geri</button>

          {/* Header */}
          <div className="p-4 rounded-2xl" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-white font-bold">{s.cariName}</p>
                <p className="text-white/40 text-xs">{new Date(s.createdAt).toLocaleDateString('tr-TR')}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {s.kaynakTedarikci && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30">🏭</span>}
                <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
              </div>
            </div>
            {s.notes && <p className="text-white/30 text-xs italic">{s.notes}</p>}
          </div>

          {/* Kalemler */}
          <div className="rounded-2xl overflow-hidden" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
            <div className="px-4 py-2 border-b" style={{ borderColor: glassBorder }}><p className="text-white font-semibold text-sm">Kalemler</p></div>
            {(s.items || []).map((item: any) => (
              <div key={item.id} className="px-4 py-2 border-b flex justify-between" style={{ borderColor: glassBorder }}>
                <span className="text-white text-xs">{item.productName}</span>
                <div className="text-right">
                  <span className="text-white/60 text-xs">{item.quantity} adet</span>
                  <span className="text-white/30 text-xs ml-2">₺{item.unitPrice}</span>
                </div>
              </div>
            ))}
            <div className="px-4 py-2 flex justify-between">
              <span className="text-white/50 text-xs">Toplam:</span>
              <span className="text-white font-bold text-sm">₺{(s.totalAmount || 0).toLocaleString('tr-TR')}</span>
            </div>
          </div>

          {/* Teklif Geçmişi */}
          {(s.teklifler || []).length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
              <div className="px-4 py-2 border-b" style={{ borderColor: glassBorder }}><p className="text-white font-semibold text-sm">💰 Teklif Geçmişi</p></div>
              {(s.teklifler || []).map((t: any, i: number) => (
                <div key={i} className="px-4 py-2 border-b flex justify-between items-center" style={{ borderColor: glassBorder }}>
                  <div>
                    <span className={`text-xs font-medium ${t.taraf === 'admin' ? 'text-blue-400' : 'text-orange-400'}`}>{t.taraf === 'admin' ? '🏢 Sen' : '🏭 Tedarikçi'}</span>
                    <span className="text-white/30 text-[10px] ml-2">{new Date(t.tarih).toLocaleDateString('tr-TR')}</span>
                  </div>
                  <span className="text-white font-bold text-xs">
                    {t.aksiyon === 'kabul' ? '✓ Kabul' : t.aksiyon === 'red' ? '✗ Red' : `₺${(t.fiyat || 0).toLocaleString('tr-TR')}`}
                  </span>
                </div>
              ))}
              {s.teklifFiyat && (
                <div className="px-4 py-2 flex justify-between">
                  <span className="text-amber-400 text-xs font-semibold">Güncel Teklif:</span>
                  <span className="text-amber-400 font-bold">₺{s.teklifFiyat.toLocaleString('tr-TR')}</span>
                </div>
              )}
            </div>
          )}

          {/* Aktivite Logu */}
          {(s.loglar || []).length > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
              <div className="px-4 py-2 border-b" style={{ borderColor: glassBorder }}><p className="text-white font-semibold text-sm">📋 Aktivite</p></div>
              {(s.loglar || []).slice().reverse().map((log: any, i: number) => (
                <div key={i} className="px-4 py-1.5 border-b flex items-start gap-2" style={{ borderColor: glassBorder }}>
                  <span className="text-[10px] mt-0.5">{log.taraf === 'admin' ? '🏢' : log.taraf === 'tedarikci' ? '🏭' : '⚙️'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/70 text-[10px]">{log.mesaj}</p>
                    <p className="text-white/25 text-[9px]">{log.kisi} · {new Date(log.tarih).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Aksiyonlar */}
          <div className="space-y-2">
            {['taslak', 'gonderildi'].includes(s.status) && (
              <button onClick={() => {
                setOrderCariId(s.cariId);
                setOrderItems((s.items || []).map((i: any) => ({ productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice })));
                setOrderNotes(s.notes || '');
                setOrderTeklifFiyat('');
                setShowNewOrder(true);
                setSelectedSiparis(null);
                // Eski siparişi iptal et
                cancelOrder(s.id);
              }} className="w-full py-2 rounded-xl text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20">✏️ Düzenle (Yeni Olarak Gönder)</button>
            )}

            {s.status === 'taslak' && (
              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => { sendOrder(s.id); setSelectedSiparis(null); }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-500/20 border border-blue-500/30"><Send className="w-3 h-3 inline mr-1" /> Gönder</motion.button>
                <button onClick={() => { cancelOrder(s.id); setSelectedSiparis(null); }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20">İptal</button>
              </div>
            )}

            {showTeklifActions && (
              <div className="space-y-2">
                <motion.button whileTap={{ scale: 0.95 }} onClick={async () => {
                  await fetch(appendGhostParam(`${SERVER_URL}/tedarikci/siparisler/${s.id}/teklif`), { method: 'POST', headers: getHeaders(), body: JSON.stringify({ aksiyon: 'kabul' }) });
                  fetchData(); setSelectedSiparis(null);
                }} className="w-full py-2.5 rounded-xl text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #34d399, #10b981)' }}>✓ Teklifi Kabul Et</motion.button>

                {/* Karşı Teklif — tam ürün listesi + stok */}
                <div className="p-3 rounded-xl space-y-2" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)' }}>
                  <p className="text-amber-400 text-xs font-semibold">↩ Karşı Teklif</p>
                  {karsiTeklifItems.length === 0 && (
                    <button onClick={() => {
                      // Siparişteki cari'nin tipine göre tam ürün listesi oluştur
                      const cari = cariler.find((c: any) => c.id === s.cariId);
                      const st = cari?.supplierType || '';
                      if (st === 'album') {
                        const items = [3,5,7,9,11,13,15].map(sz => {
                          const a = (albumler || []).find((al: any) => al.size === sz || al.size === String(sz));
                          const existing = (s.items || []).find((i: any) => i.productName?.includes(String(sz)));
                          return { productName: `${sz} Kare`, quantity: existing?.quantity || 0, unitPrice: existing?.unitPrice || a?.yarimBoy || a?.tamBoy || 0 };
                        });
                        items.push({ productName: 'Paspartu', quantity: (s.items || []).find((i: any) => i.productName === 'Paspartu')?.quantity || 0, unitPrice: 0 });
                        setKarsiTeklifItems(items);
                      } else {
                        setKarsiTeklifItems((s.items || []).map((i: any) => ({ productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice })));
                      }
                      setKarsiTeklifFiyat('');
                    }} className="w-full py-2 rounded-lg text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20">↩ Karşı Teklif Hazırla</button>
                  )}
                  {karsiTeklifItems.length > 0 && (
                    <>
                      <div className="grid grid-cols-[1fr_42px_42px_50px_48px] text-[8px] text-white/30 font-semibold px-1 gap-1">
                        <span>Ürün</span><span className="text-center">Depo</span><span className="text-center">Genel</span><span className="text-center">Fiyat</span><span className="text-center">Adet</span>
                      </div>
                      {karsiTeklifItems.map((item, idx) => {
                        const sizeMatch = item.productName.match(/(\d+)/);
                        const size = sizeMatch ? parseInt(sizeMatch[1]) : 0;
                        const stokKey = item.productName === 'Paspartu' ? 'paspartu' : `album${size}`;
                        const depo = depoStok[stokKey] || 0;
                        const genel = genelStok[stokKey] || 0;
                        return (
                          <div key={idx} className="grid grid-cols-[1fr_42px_42px_50px_48px] items-center py-1 gap-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <span className="text-white text-[10px]">{item.productName}</span>
                            <span className="text-center text-[9px] text-amber-400 font-bold">{depo}</span>
                            <span className="text-center text-[9px] text-cyan-400 font-bold">{genel}</span>
                            <input type="number" min={0} value={item.unitPrice || ''} onChange={e => setKarsiTeklifItems(prev => prev.map((p, i) => i === idx ? { ...p, unitPrice: parseFloat(e.target.value) || 0 } : p))}
                              className="w-full px-1 py-0.5 rounded text-center text-green-400 bg-white/10 border border-white/20 text-[9px]" placeholder="₺" />
                            <input type="number" min={0} value={item.quantity || ''} onChange={e => setKarsiTeklifItems(prev => prev.map((p, i) => i === idx ? { ...p, quantity: parseInt(e.target.value) || 0 } : p))}
                              className="w-full px-1 py-0.5 rounded text-center text-white bg-white/10 border border-white/20 text-[10px]" placeholder="0" />
                          </div>
                        );
                      })}
                      <div className="flex justify-between pt-1 border-t border-white/10">
                        <span className="text-white/40 text-[10px]">Kalem Toplam:</span>
                        <span className="text-white font-bold text-xs">₺{karsiTeklifItems.reduce((a, i) => a + (i.quantity * i.unitPrice), 0).toLocaleString('tr-TR')}</span>
                      </div>
                      <div className="p-2 rounded-lg" style={{ background: 'rgba(251,191,36,0.10)' }}>
                        <span className="text-amber-400 text-[10px] block mb-1">Teklif Fiyatı (opsiyonel)</span>
                        <input type="number" min={0} value={karsiTeklifFiyat || ''} onChange={e => setKarsiTeklifFiyat(e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg text-center text-amber-400 bg-white/10 border border-amber-400/20 text-xs font-bold" placeholder="₺ Teklif tutarı" />
                      </div>
                      <motion.button whileTap={{ scale: 0.95 }} onClick={async () => {
                        const items = karsiTeklifItems.filter(i => i.quantity > 0 && i.productName);
                        const fiyat = karsiTeklifFiyat ? parseFloat(karsiTeklifFiyat) : items.reduce((a, i) => a + (i.quantity * i.unitPrice), 0);
                        await fetch(appendGhostParam(`${SERVER_URL}/tedarikci/siparisler/${s.id}/teklif`), { method: 'POST', headers: getHeaders(), body: JSON.stringify({ fiyat, items }) });
                        setKarsiTeklifItems([]); setKarsiTeklifFiyat('');
                        fetchData(); setSelectedSiparis(null);
                      }} className="w-full py-2.5 rounded-lg text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #fbbf24, #d97706)' }}>↩ Karşı Teklif Gönder</motion.button>
                      <button onClick={() => setKarsiTeklifItems([])} className="w-full py-1.5 text-white/30 text-[10px]">Vazgeç</button>
                    </>
                  )}
                </div>

                <button onClick={async () => {
                  await fetch(appendGhostParam(`${SERVER_URL}/tedarikci/siparisler/${s.id}/teklif`), { method: 'POST', headers: getHeaders(), body: JSON.stringify({ aksiyon: 'red' }) });
                  fetchData(); setSelectedSiparis(null);
                }} className="w-full py-2 rounded-xl text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20">✗ Reddet</button>
              </div>
            )}

            {['teslim_edildi', 'kismen_teslim', 'onaylandi'].includes(s.status) && (
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setShowPayment(s.id); setPayCurrency(s.currency || 'TRY'); }}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #34d399, #10b981)' }}>
                <Banknote className="w-3 h-3 inline mr-1" /> Ödeme Yap
              </motion.button>
            )}

            {!['taslak', 'tamamlandi', 'iptal'].includes(s.status) && (
              <button onClick={() => { cancelOrder(s.id); setSelectedSiparis(null); }}
                className="w-full py-2 rounded-xl text-xs text-red-400/60 bg-red-500/5 border border-red-500/10">İptal Et</button>
            )}
          </div>
        </div>
      );
    }

    // Log penceresi — tüm siparişlerdeki logları birleştir
    const tumLoglar = siparisler.flatMap((s: any) => (s.loglar || []).map((log: any) => ({ ...log, cariName: s.cariName, siparisId: s.id })));
    const sonLoglar = tumLoglar.sort((a: any, b: any) => (b.tarih || '').localeCompare(a.tarih || '')).slice(0, 15);

    // Kategorize
    const isTeklif = (s: any) => ['karsi_teklif', 'tedarikci_teklifi', 'teklif_verildi'].includes(s.teklifDurum) && s.status !== 'iptal' && s.status !== 'tamamlandi';
    const isAktif = (s: any) => ['onaylandi', 'kismen_teslim', 'teslim_edildi', 'gonderildi'].includes(s.status) && !isTeklif(s);
    const isGecmis = (s: any) => s.status === 'tamamlandi';
    const isIptal = (s: any) => s.status === 'iptal';

    const filtrelenmis = siparisler.filter((s: any) => {
      if (siparisFiltre === 'aktif') return isAktif(s);
      if (siparisFiltre === 'teklif') return isTeklif(s);
      if (siparisFiltre === 'gecmis') return isGecmis(s);
      if (siparisFiltre === 'iptal') return isIptal(s);
      return true;
    });

    // Sırala: teklif > aktif > taslak > geçmiş > iptal
    const sirali = [...filtrelenmis].sort((a: any, b: any) => {
      const oncelik = (s: any) => isTeklif(s) ? 0 : isAktif(s) ? 1 : s.status === 'taslak' ? 2 : isGecmis(s) ? 3 : 4;
      return oncelik(a) - oncelik(b) || (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    const kartRenk = (s: any) => {
      if (isIptal(s)) return { border: 'rgba(248,113,113,0.20)', bg: 'rgba(248,113,113,0.04)', opacity: 0.5 };
      if (isGecmis(s)) return { border: 'rgba(255,255,255,0.15)', bg: 'rgba(255,255,255,0.03)', opacity: 0.6 };
      if (isTeklif(s)) return { border: 'rgba(251,191,36,0.30)', bg: 'rgba(251,191,36,0.06)', opacity: 1 };
      if (isAktif(s)) return { border: 'rgba(52,211,153,0.30)', bg: 'rgba(52,211,153,0.06)', opacity: 1 };
      return { border: glassBorder, bg: glassBg, opacity: 1 };
    };

    const FILTRELER = [
      { key: 'tumu', label: 'Tümü', color: '#9ca3af' },
      { key: 'aktif', label: 'Aktif', color: '#34d399' },
      { key: 'teklif', label: 'Teklif', color: '#fbbf24' },
      { key: 'gecmis', label: 'Geçmiş', color: '#ffffff' },
      { key: 'iptal', label: 'İptal', color: '#f87171' },
    ] as const;

    // Liste görünümü
    return (
    <div className="space-y-3">
      <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowNewOrder(true)}
        className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg, #60a5fa, #3b82f6)' }}>
        <Plus className="w-4 h-4" /> Yeni Sipariş
      </motion.button>

      {/* Log Penceresi */}
      {sonLoglar.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <span className="text-white font-semibold text-xs">📋 Son Aktiviteler</span>
            <span className="text-white/20 text-[9px]">{sonLoglar.length} kayıt</span>
          </div>
          <div className="max-h-32 overflow-y-auto">
            {sonLoglar.map((log: any, i: number) => (
              <div key={i} className="px-3 py-1 flex items-start gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <span className="text-[9px] mt-0.5 shrink-0">{log.taraf === 'admin' ? '🏢' : log.taraf === 'tedarikci' ? '🏭' : '⚙️'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white/60 text-[10px] truncate">{log.mesaj}</p>
                  <p className="text-white/20 text-[9px]">{log.kisi} · {new Date(log.tarih).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtreler */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTRELER.map(f => {
          const active = siparisFiltre === f.key;
          const count = f.key === 'tumu' ? siparisler.length : siparisler.filter((s: any) => f.key === 'aktif' ? isAktif(s) : f.key === 'teklif' ? isTeklif(s) : f.key === 'gecmis' ? isGecmis(s) : isIptal(s)).length;
          return (
            <button key={f.key} onClick={() => setSiparisFiltre(f.key as any)}
              className="px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all"
              style={{ background: active ? `${f.color}20` : 'rgba(255,255,255,0.03)', border: `1px solid ${active ? `${f.color}50` : 'rgba(255,255,255,0.08)'}`, color: active ? f.color : 'rgba(255,255,255,0.4)' }}>
              {f.label} {count > 0 && <span className="ml-1 opacity-60">{count}</span>}
            </button>
          );
        })}
      </div>

      {sirali.map((s: any) => {
        const sc = STATUS_CONFIG[s.status] || STATUS_CONFIG.taslak;
        const kr = kartRenk(s);
        return (
          <motion.button key={s.id} whileTap={{ scale: 0.98 }} onClick={() => { setSelectedSiparis(s); setKarsiTeklifItems([]); setKarsiTeklifFiyat(''); }}
            className="w-full p-4 rounded-2xl space-y-2 text-left transition-all" style={{ background: kr.bg, border: `1px solid ${kr.border}`, opacity: kr.opacity }}>
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{s.cariName}</p>
                <p className="text-white/40 text-xs">{new Date(s.createdAt).toLocaleDateString('tr-TR')}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {s.kaynakTedarikci && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30">🏭</span>}
                <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
              </div>
            </div>
            <div className="text-white/50 text-xs truncate">{s.items?.map((i: any) => `${i.productName} ×${i.quantity}`).join(', ')}</div>
            {(() => {
              const totalQty = (s.items || []).reduce((a: number, i: any) => a + (i.quantity || 0), 0);
              const deliveredQty = (s.items || []).reduce((a: number, i: any) => a + (i.deliveredQuantity || 0), 0);
              if (totalQty > 0 && ['onaylandi', 'kismen_teslim', 'teslim_edildi', 'tamamlandi'].includes(s.status)) {
                const pct = Math.min(100, (deliveredQty / totalQty) * 100);
                return (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-white/40 shrink-0">{deliveredQty}/{totalQty}</span>
                  </div>
                );
              }
              return null;
            })()}
            <div className="flex items-center justify-between">
              <p className="text-white font-bold text-sm">₺{(s.totalAmount || 0).toLocaleString('tr-TR')}</p>
              {s.teklifFiyat && <span className="text-amber-400 text-xs font-bold">Teklif: ₺{s.teklifFiyat.toLocaleString('tr-TR')}</span>}
              <ChevronRight className="w-4 h-4 text-white/20" />
            </div>
          </motion.button>
        );
      })}
      {sirali.length === 0 && <p className="text-center text-white/30 py-8 text-sm">Bu filtrede sipariş yok</p>}
    </div>
    );
  };

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
      ) : selectedTedarikci ? (
        /* ═══ TEDARİKÇİ DETAY EKRANI ═══ */
        <div className="space-y-3">
          <button onClick={() => { setSelectedTedarikci(null); setSelectedSiparis(null); }} className="text-white/50 text-sm">← Geri</button>
          <div className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
            <div className="text-2xl">{selectedTedarikci.emoji || '🏢'}</div>
            <div className="flex-1">
              <p className="text-white font-bold">{selectedTedarikci.name}</p>
              {selectedTedarikci.linkedUserEmail && <p className="text-green-400 text-xs">✓ {selectedTedarikci.linkedUserEmail}</p>}
            </div>
            <div className="flex gap-1">
              <button onClick={async () => {
                const newVal = !(selectedTedarikci.stokGorunur !== false);
                await fetch(appendGhostParam(`${SERVER_URL}/maliyetler/cariler`), { method: 'POST', headers: getHeaders(), body: JSON.stringify({ ...selectedTedarikci, stokGorunur: newVal }) });
                fetchData(); setSelectedTedarikci({ ...selectedTedarikci, stokGorunur: newVal });
              }} className={`px-2 py-1 rounded-lg text-[9px] font-medium ${selectedTedarikci.stokGorunur !== false ? 'text-cyan-400 border-cyan-400/20 bg-cyan-400/10' : 'text-white/30 border-white/10 bg-white/5'} border`}>
                {selectedTedarikci.stokGorunur !== false ? '👁 Stok' : '🚫 Stok'}
              </button>
            </div>
          </div>

          {/* Loglar */}
          {(() => {
            const mySiparisler = siparisler.filter((s: any) => s.cariId === selectedTedarikci.id);
            const tumLoglar = mySiparisler.flatMap((s: any) => (s.loglar || []).map((log: any) => ({ ...log, siparisId: s.id })));
            const sonLoglar = tumLoglar.sort((a: any, b: any) => (b.tarih || '').localeCompare(a.tarih || '')).slice(0, 15);
            return (
              <div className="rounded-2xl overflow-hidden" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
                <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: glassBorder }}>
                  <span className="text-white font-semibold text-xs">📋 Aktiviteler</span>
                  <span className="text-white/20 text-[9px]">{sonLoglar.length} kayıt</span>
                </div>
                <div className="max-h-32 overflow-y-auto">
                  {sonLoglar.length === 0 ? <p className="text-white/20 text-xs text-center py-3">Henüz aktivite yok</p> : sonLoglar.map((log: any, i: number) => (
                    <div key={i} className="px-3 py-1 flex items-start gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <span className="text-[9px] mt-0.5 shrink-0">{log.taraf === 'admin' ? '🏢' : log.taraf === 'tedarikci' ? '🏭' : '⚙️'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white/60 text-[10px]">{log.mesaj}</p>
                        <p className="text-white/20 text-[9px]">{log.kisi} · {new Date(log.tarih).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Tab'lar */}
          <div className="flex gap-1.5">
            {([
              { key: 'siparisler' as const, label: '📦 Siparişler', color: '#60a5fa' },
              { key: 'fiyatlar' as const, label: '💰 Fiyatlar', color: '#fbbf24' },
              { key: 'bakiye' as const, label: '💳 Bakiye', color: '#34d399' },
            ]).map(t => (
              <button key={t.key} onClick={() => setTedarikciTab(t.key)}
                className="flex-1 py-2 rounded-xl text-[11px] font-bold transition-all"
                style={{ background: tedarikciTab === t.key ? `${t.color}20` : glassBg, border: `1px solid ${tedarikciTab === t.key ? `${t.color}50` : glassBorder}`, color: tedarikciTab === t.key ? t.color : 'rgba(255,255,255,0.4)' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Siparişler */}
          {tedarikciTab === 'siparisler' && (() => {
            const mySip = siparisler.filter((s: any) => s.cariId === selectedTedarikci.id);
            if (selectedSiparis) return renderSiparisTab(); // detay görünümü kullan
            return (
              <div className="space-y-3">
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setOrderCariId(selectedTedarikci.id); setShowNewOrder(true); }}
                  className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #60a5fa, #3b82f6)' }}>
                  <Plus className="w-4 h-4" /> Yeni Sipariş
                </motion.button>
                {mySip.length === 0 ? <p className="text-center text-white/30 py-8 text-sm">Henüz sipariş yok</p> : mySip.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || '')).map((s: any) => {
                  const sc = STATUS_CONFIG[s.status] || STATUS_CONFIG.taslak;
                  const totalQty = (s.items || []).reduce((a: number, i: any) => a + (i.quantity || 0), 0);
                  const deliveredQty = (s.items || []).reduce((a: number, i: any) => a + (i.deliveredQuantity || 0), 0);
                  const pct = totalQty > 0 ? Math.min(100, (deliveredQty / totalQty) * 100) : 0;
                  return (
                    <motion.button key={s.id} whileTap={{ scale: 0.98 }} onClick={() => { setSelectedSiparis(s); setKarsiTeklifItems([]); setKarsiTeklifFiyat(''); }}
                      className="w-full p-3 rounded-2xl text-left space-y-1" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
                      <div className="flex items-center justify-between">
                        <p className="text-white text-sm font-medium truncate flex-1">{s.items?.map((i: any) => `${i.productName} ×${i.quantity}`).join(', ')}</p>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium ml-2" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                      </div>
                      {totalQty > 0 && ['onaylandi', 'kismen_teslim', 'teslim_edildi', 'tamamlandi'].includes(s.status) && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400" style={{ width: `${pct}%` }} /></div>
                          <span className="text-[10px] text-white/40">{deliveredQty}/{totalQty}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-white/40 text-xs">{new Date(s.createdAt).toLocaleDateString('tr-TR')}</span>
                        <span className="text-white font-bold text-xs">₺{(s.totalAmount || 0).toLocaleString('tr-TR')}</span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            );
          })()}

          {/* Fiyatlar */}
          {tedarikciTab === 'fiyatlar' && (
            <div className="rounded-2xl overflow-hidden" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
              <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: glassBorder }}>
                <p className="text-white font-semibold text-sm">💰 Anlaşma Fiyatları</p>
                <button onClick={() => { setShowPriceList(selectedTedarikci.id); setPriceListItems(fiyatMap[selectedTedarikci.id]?.items || []); }}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20">Düzenle</button>
              </div>
              {[3,5,7,9,11,13,15].map(s => {
                const a = (albumler || []).find((al: any) => al.size === s || al.size === String(s));
                const flItem = (fiyatMap[selectedTedarikci.id]?.items || []).find((f: any) => f.productName === `${s} Kare`);
                const fiyat = flItem?.fiyat || a?.yarimBoy || a?.tamBoy || 0;
                return (
                  <div key={s} className="px-4 py-2 border-b flex justify-between" style={{ borderColor: glassBorder }}>
                    <span className="text-white text-xs">{s} Kare</span>
                    <span className="text-green-400 font-bold text-xs">₺{fiyat}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bakiye */}
          {tedarikciTab === 'bakiye' && (
            <div className="space-y-3">
              {(() => {
                const mySip = siparisler.filter((s: any) => s.cariId === selectedTedarikci.id && ['onaylandi', 'kismen_teslim', 'teslim_edildi', 'tamamlandi'].includes(s.status));
                const toplam = mySip.reduce((a: number, s: any) => a + (s.totalAmount || 0), 0);
                const odenen = odemeler.filter((o: any) => o.cariId === selectedTedarikci.id).reduce((a: number, o: any) => a + (o.amount || 0), 0);
                const kalan = toplam - odenen;
                return (
                  <>
                    <div className="p-6 rounded-2xl text-center" style={{ background: kalan > 0 ? 'rgba(251,191,36,0.08)' : 'rgba(52,211,153,0.08)', border: `1px solid ${kalan > 0 ? 'rgba(251,191,36,0.20)' : 'rgba(52,211,153,0.20)'}` }}>
                      <p className="text-white/40 text-xs mb-1">Bakiye</p>
                      <p className={`text-3xl font-bold ${kalan > 0 ? 'text-amber-400' : 'text-green-400'}`}>₺{Math.abs(kalan).toLocaleString('tr-TR')}</p>
                      <p className="text-white/30 text-xs mt-1">{kalan > 0 ? 'Borç' : 'Temiz'}</p>
                    </div>
                    <div className="rounded-2xl overflow-hidden" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
                      <div className="px-4 py-2 flex justify-between border-b" style={{ borderColor: glassBorder }}>
                        <span className="text-white/50 text-xs">Toplam Sipariş</span><span className="text-white font-bold text-xs">₺{toplam.toLocaleString('tr-TR')}</span>
                      </div>
                      <div className="px-4 py-2 flex justify-between border-b" style={{ borderColor: glassBorder }}>
                        <span className="text-white/50 text-xs">Ödenen</span><span className="text-green-400 font-bold text-xs">₺{odenen.toLocaleString('tr-TR')}</span>
                      </div>
                      <div className="px-4 py-2 flex justify-between">
                        <span className="text-white/50 text-xs">Kalan</span><span className="text-amber-400 font-bold text-xs">₺{kalan.toLocaleString('tr-TR')}</span>
                      </div>
                    </div>

                    {/* Ön Ödeme */}
                    {!showOnOdeme ? (
                      <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowOnOdeme(true)}
                        className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2"
                        style={{ background: 'linear-gradient(135deg, #34d399, #10b981)' }}>
                        💳 Ön Ödeme Yap
                      </motion.button>
                    ) : (
                      <div className="p-4 rounded-2xl space-y-3" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.20)' }}>
                        <p className="text-green-400 text-xs font-semibold">💳 Ön Ödeme</p>
                        <input type="number" min={0} value={onOdemeTutar} onChange={e => setOnOdemeTutar(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-white bg-white/10 border border-white/20 text-sm text-center" placeholder="Tutar (₺)" />
                        <input type="text" value={onOdemeAciklama} onChange={e => setOnOdemeAciklama(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-white bg-white/10 border border-white/20 text-sm" placeholder="Açıklama (opsiyonel)" />
                        <div className="flex gap-2">
                          <button onClick={() => { setShowOnOdeme(false); setOnOdemeTutar(''); setOnOdemeAciklama(''); }}
                            className="flex-1 py-2 rounded-lg text-xs text-white/40 bg-white/5">Vazgeç</button>
                          <motion.button whileTap={{ scale: 0.95 }} onClick={async () => {
                            if (!onOdemeTutar) return;
                            setActionLoading('onodeme');
                            try {
                              // Sipariş olmadan ödeme — kasadan düşer
                              await fetch(appendGhostParam(`${SERVER_URL}/tedarikci/odemeler`), {
                                method: 'POST', headers: getHeaders(),
                                body: JSON.stringify({ siparisId: `on_odeme_${Date.now()}`, amount: parseFloat(onOdemeTutar), currency: 'TRY', paymentMethod: 'havale', paymentDate: new Date().toISOString().slice(0, 10) }),
                              });
                              setShowOnOdeme(false); setOnOdemeTutar(''); setOnOdemeAciklama('');
                              fetchData();
                            } finally { setActionLoading(''); }
                          }} disabled={!onOdemeTutar || actionLoading === 'onodeme'}
                            className="flex-1 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-40"
                            style={{ background: 'linear-gradient(135deg, #34d399, #10b981)' }}>
                            {actionLoading === 'onodeme' ? '...' : 'Öde'}
                          </motion.button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-5"
            onClick={() => setShowNewOrder(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
              style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.10)' }}>
              <div className="flex items-center justify-between">
                <h2 className="text-white font-bold text-lg">Yeni Sipariş</h2>
                <button onClick={() => setShowNewOrder(false)}><X className="w-5 h-5 text-white/40" /></button>
              </div>
              <select value={orderCariId} onChange={e => {
                setOrderCariId(e.target.value);
                // Tedarikçi seçilince ürün listesini otomatik oluştur
                const cari = cariler.find((c: any) => c.id === e.target.value);
                const st = cari?.supplierType || '';
                if (st === 'album') {
                  const items: Array<{ productName: string; quantity: number; unitPrice: number }> = [];
                  const sizes = [3, 5, 7, 9, 11, 13, 15];
                  for (const s of sizes) {
                    const a = (albumler || []).find((al: any) => al.size === s || al.size === String(s));
                    items.push({ productName: `${s} Kare`, quantity: 0, unitPrice: a?.yarimBoy || a?.tamBoy || 0 });
                  }
                  items.push({ productName: 'Paspartu', quantity: 0, unitPrice: 0 });
                  setOrderItems(items);
                  setOrderCurrency((albumler || [])[0]?.currency || 'TRY');
                } else if (st === 'ribon') {
                  setOrderItems((papers || []).map((p: any) => ({ productName: p.name || p.id, quantity: 0, unitPrice: p.boxPrice || 0 })));
                  setOrderCurrency((papers || [])[0]?.currency || 'TRY');
                } else {
                  setOrderItems([{ productName: '', quantity: 0, unitPrice: 0 }]);
                }
              }} className={inputStyle + ' bg-white/10'}>
                <option value="" className="bg-gray-900">Tedarikçi seç...</option>
                {cariler.filter((c: any) => c.supplierType).map((c: any) => (
                  <option key={c.id} value={c.id} className="bg-gray-900">{c.emoji || '🏢'} {c.name} ({c.supplierType === 'album' ? 'Albüm' : 'Ribon'})</option>
                ))}
              </select>

              {/* Ürün listesi — albüm tipi */}
              {orderCariId && supplierType === 'album' && (
                <div className="space-y-0">
                  <div className="grid grid-cols-[1fr_42px_42px_50px_48px] text-[8px] text-white/30 font-semibold px-1 pb-1 gap-1">
                    <span>Ürün</span>
                    <span className="text-center">Depo</span>
                    <span className="text-center">Genel</span>
                    <span className="text-center">Fiyat</span>
                    <span className="text-center">Adet</span>
                  </div>
                  {orderItems.map((item, idx) => {
                    const sizeMatch = item.productName.match(/(\d+)/);
                    const size = sizeMatch ? parseInt(sizeMatch[1]) : 0;
                    const stokKey = item.productName === 'Paspartu' ? 'paspartu' : `album${size}`;
                    const depo = depoStok[stokKey] || 0;
                    const genel = genelStok[stokKey] || 0;
                    const albumData = size ? (albumler || []).find((a: any) => a.size === size || a.size === String(size)) : null;
                    const maliyet = albumData?.yarimBoy || albumData?.tamBoy || 0;
                    const isPaspartu = item.productName === 'Paspartu';
                    const anlasmItems = (cariFiyat?.items || []);
                    const anlasmaFiyat = anlasmItems.find((f: any) => f.productName === item.productName)?.fiyat;
                    if (isPaspartu) {
                      return (
                        <div key={idx} className="grid grid-cols-[1fr_1fr_48px] items-center py-1.5 gap-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <span className="text-white text-[11px] font-medium">Paspartu</span>
                          <input type="number" min={0} value={item.unitPrice || ''}
                            onChange={e => setOrderItems(prev => prev.map((p, i) => i === idx ? { ...p, unitPrice: parseFloat(e.target.value) || 0 } : p))}
                            className="w-full px-1 py-0.5 rounded text-center text-green-400 bg-white/10 border border-white/20 text-[10px]"
                            placeholder="Toplam ₺ (0=bedelsiz)" />
                          <input type="number" min={0} value={item.quantity || ''}
                            onChange={e => setOrderItems(prev => prev.map((p, i) => i === idx ? { ...p, quantity: parseInt(e.target.value) || 0 } : p))}
                            className="w-full px-1 py-1 rounded-lg text-center text-white bg-white/10 border border-white/20 text-[11px]"
                            placeholder="Adet" />
                        </div>
                      );
                    }
                    return (
                      <div key={idx} className="grid grid-cols-[1fr_42px_42px_50px_48px] items-center py-1.5 gap-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span className="text-white text-[11px] font-medium">{item.productName}</span>
                        <span className="text-center text-[10px] text-amber-400 font-bold">{depo}</span>
                        <span className="text-center text-[10px] text-cyan-400 font-bold">{genel}</span>
                        <span className="text-center text-[10px] text-green-400 font-bold">{anlasmaFiyat !== undefined ? `₺${anlasmaFiyat}` : (item.unitPrice > 0 ? `₺${item.unitPrice}` : '—')}</span>
                        <input type="number" min={0} value={item.quantity || ''}
                          onChange={e => setOrderItems(prev => prev.map((p, i) => i === idx ? { ...p, quantity: parseInt(e.target.value) || 0 } : p))}
                          className="w-full px-1 py-1 rounded-lg text-center text-white bg-white/10 border border-white/20 text-[11px]"
                          placeholder="0" />
                      </div>
                    );
                  })}
                  <div className="flex justify-between pt-2 border-t border-white/10">
                    <span className="text-white/50 text-xs">Toplam:</span>
                    <span className="text-white font-bold text-sm">₺{orderItems.reduce((a, i) => a + (i.productName === 'Paspartu' ? (i.unitPrice || 0) : (i.quantity * i.unitPrice)), 0).toLocaleString('tr-TR')}</span>
                  </div>
                </div>
              )}

              {/* Ribon tipi */}
              {orderCariId && supplierType === 'ribon' && (
                <div className="space-y-1">
                  <div className="flex text-[10px] text-white/30 font-semibold px-1">
                    <span className="flex-1">Kağıt Tipi</span>
                    <span className="w-16 text-center">Fiyat</span>
                    <span className="w-16 text-center">Adet</span>
                  </div>
                  {orderItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1 py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span className="flex-1 text-white text-xs truncate">{item.productName}</span>
                      <span className="w-16 text-center text-[11px] text-white/40">{item.unitPrice > 0 ? `₺${item.unitPrice}` : '—'}</span>
                      <input type="number" min={0} value={item.quantity || ''}
                        onChange={e => setOrderItems(prev => prev.map((p, i) => i === idx ? { ...p, quantity: parseInt(e.target.value) || 0 } : p))}
                        className="w-16 px-2 py-1.5 rounded-lg text-center text-white bg-white/10 border border-white/20 text-xs"
                        placeholder="0" />
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t border-white/10">
                    <span className="text-white/50 text-xs">Toplam:</span>
                    <span className="text-white font-bold text-sm">₺{orderItems.reduce((a, i) => a + (i.productName === 'Paspartu' ? (i.unitPrice || 0) : (i.quantity * i.unitPrice)), 0).toLocaleString('tr-TR')}</span>
                  </div>
                </div>
              )}

              {/* Generic form — tip yoksa */}
              {orderCariId && !supplierType && (
                <>
                  <select value={orderCurrency} onChange={e => setOrderCurrency(e.target.value)} className={inputStyle + ' bg-white/10'}>
                    {['TRY', 'USD', 'EUR', 'GBP'].map(cur => <option key={cur} value={cur} className="bg-gray-900">{cur}</option>)}
                  </select>
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
                    </div>
                  ))}
                  <button onClick={() => setOrderItems(prev => [...prev, { productName: '', quantity: 0, unitPrice: 0 }])}
                    className="text-blue-400 text-xs font-medium">+ Kalem Ekle</button>
                </>
              )}

              <textarea placeholder="Not (opsiyonel)" value={orderNotes} onChange={e => setOrderNotes(e.target.value)}
                className={inputStyle + ' resize-none'} rows={2} />

              {/* Teklif bölümü */}
              {orderCariId && supplierType && (
                <div className="p-3 rounded-xl space-y-2" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-amber-400 text-xs font-semibold">Teklif Fiyatı (opsiyonel)</span>
                    <span className="text-white/30 text-[10px]">Liste: ₺{orderItems.reduce((a, i) => a + (i.productName === 'Paspartu' ? (i.unitPrice || 0) : (i.quantity * i.unitPrice)), 0).toLocaleString('tr-TR')}</span>
                  </div>
                  <input type="number" min={0} value={orderTeklifFiyat || ''} onChange={e => setOrderTeklifFiyat(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-amber-400 bg-white/10 border border-amber-400/20 text-sm font-bold text-center"
                    placeholder="₺ Teklif tutarı girin..." />
                </div>
              )}

              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => createOrder(true)}
                  disabled={!orderCariId || orderItems.every(i => i.quantity === 0) || actionLoading === 'order'}
                  className="flex-1 py-3 rounded-xl font-semibold text-white disabled:opacity-40 text-sm"
                  style={{ background: 'linear-gradient(135deg, #60a5fa, #3b82f6)' }}>
                  {actionLoading === 'order' ? '...' : 'Sipariş Gönder'}
                </motion.button>
                {orderTeklifFiyat && (
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => createOrder(true)}
                    disabled={!orderCariId || orderItems.every(i => i.quantity === 0) || actionLoading === 'order'}
                    className="flex-1 py-3 rounded-xl font-semibold text-white disabled:opacity-40 text-sm"
                    style={{ background: 'linear-gradient(135deg, #fbbf24, #d97706)' }}>
                    {actionLoading === 'order' ? '...' : '💰 Teklif Gönder'}
                  </motion.button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PAYMENT MODAL ── */}
      <AnimatePresence>
        {showPayment && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-5"
            onClick={() => setShowPayment(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl p-5 space-y-4"
              style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.10)' }}>
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

      {/* ── PRICE LIST MODAL ── */}
      <AnimatePresence>
        {showPriceList && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-5"
            onClick={() => setShowPriceList(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl p-5 space-y-3 max-h-[85vh] overflow-y-auto"
              style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.10)' }}>
              <div className="flex items-center justify-between">
                <h2 className="text-white font-bold text-lg">💰 Fiyat Listesi</h2>
                <button onClick={() => setShowPriceList(null)}><X className="w-5 h-5 text-white/40" /></button>
              </div>
              <p className="text-white/40 text-xs">{cariler.find((c: any) => c.id === showPriceList)?.name}</p>
              {(() => {
                const cari = cariler.find((c: any) => c.id === showPriceList);
                const st = cari?.supplierType || '';
                // Ürün listesini oluştur (henüz fiyat yoksa default)
                if (priceListItems.length === 0 && st === 'album') {
                  const sizes = [3, 5, 7, 9, 11, 13, 15];
                  const defaults = sizes.map(s => ({ productName: `${s} Kare`, fiyat: 0, currency: 'TRY' }));
                  defaults.push({ productName: 'Paspartu', fiyat: 0, currency: 'TRY' });
                  setTimeout(() => setPriceListItems(defaults), 0);
                }
                return null;
              })()}
              <div className="space-y-1">
                {priceListItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 py-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span className="flex-1 text-white text-xs">{item.productName}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-white/30 text-[10px]">₺</span>
                      <input type="number" min={0} value={item.fiyat || ''}
                        onChange={e => setPriceListItems(prev => prev.map((p, i) => i === idx ? { ...p, fiyat: parseFloat(e.target.value) || 0 } : p))}
                        className="w-20 px-2 py-1 rounded-lg text-center text-green-400 bg-white/10 border border-white/20 text-xs"
                        placeholder="0" />
                    </div>
                  </div>
                ))}
              </div>
              <motion.button whileTap={{ scale: 0.97 }}
                onClick={async () => {
                  setActionLoading('price');
                  try {
                    await fetch(appendGhostParam(`${SERVER_URL}/tedarikci/fiyat/${showPriceList}`), {
                      method: 'PUT', headers: getHeaders(),
                      body: JSON.stringify({ items: priceListItems }),
                    });
                    fetchData();
                    setShowPriceList(null);
                  } finally { setActionLoading(''); }
                }}
                disabled={actionLoading === 'price'}
                className="w-full py-3 rounded-xl font-semibold text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #fbbf24, #d97706)' }}>
                {actionLoading === 'price' ? '...' : 'Kaydet'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
