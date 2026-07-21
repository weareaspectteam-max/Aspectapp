/**
 * TedarikciYonetimi — Admin tarafı tedarikçi yönetim sayfası.
 * 4 tab: Tedarikçiler, Siparişler, Teslimatlar, Ödemeler
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Package, Truck, Banknote, CheckCircle2, XCircle, Clock, Plus, Send, Eye,
  RefreshCw, UserPlus, ChevronDown, ChevronUp, X, AlertCircle, ChevronRight,
  FileText, Users, HelpCircle,
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

function TedarikciYonetimiAdmin({ userName, userRole, accessToken, onLogout, onNavigate, kisitli = false }: TedarikciYonetimiProps & { kisitli?: boolean }) {
  const [activeTab, setActiveTab] = useState<TabKey>('tedarikci');
  const [selectedTedarikci, setSelectedTedarikci] = useState<any>(null); // seçili tedarikçi
  const [tedarikciTab, setTedarikciTab] = useState<'siparisler' | 'fiyatlar' | 'bakiye'>('siparisler');

  /* Kişi bazlı panel yetkisi (yönetici): sipariş + teslimat verilir, ödeme görünmez */
  const [showYetki, setShowYetki] = useState(false);
  const [yetkiUsers, setYetkiUsers] = useState<Array<{ id: string; ad: string; rol: string }>>([]);
  const [yetkiIds, setYetkiIds] = useState<string[]>([]);
  const [yetkiSaving, setYetkiSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [showTedGuide, setShowTedGuide] = useState(false);

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
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());
  const [showArchive, setShowArchive] = useState<Record<string, boolean>>({});
  const [adminBakiyeDonem, setAdminBakiyeDonem] = useState<'tumu' | 'bu_ay' | 'gecen_ay' | 'bu_yil'>('tumu');

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

  // Sipariş formu ürün listesini tedarikçi tipine göre kur — hem select onChange hem
  // tedarikçi ekranından (cari hazır seçili) açılışta çağrılır
  const buildOrderItemsFor = (cariId: string) => {
    const cari = cariler.find((c: any) => c.id === cariId);
    const st = cari?.supplierType || '';
    if (st === 'album') {
      const items: Array<{ productName: string; quantity: number; unitPrice: number }> = [];
      const sizes = [3, 5, 7, 9, 11, 13, 15];
      for (const s of sizes) {
        const a = (albumler || []).find((al: any) => al.size === s || al.size === String(s));
        items.push({ productName: `${s} Kare Tam`, quantity: 0, unitPrice: a?.tamBoy || 0 });
        items.push({ productName: `${s} Kare Yarım`, quantity: 0, unitPrice: a?.yarimBoy || 0 });
      }
      items.push({ productName: 'Paspartu', quantity: 0, unitPrice: 0 });
      setOrderItems(items);
      setOrderCurrency((albumler || [])[0]?.currency || 'TRY');
    } else {
      setOrderItems([{ productName: '', quantity: 0, unitPrice: 0 }]);
    }
  };
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
  // Döviz → TRY (bakiye/toplam hesaplarında para birimi karışmasın)
  const rates: any = data?.exchangeRates || { EUR: 38, USD: 33, GBP: 41.2 };
  const toTRY = (v: number, cur?: string) => { const cc = (cur || 'TRY').toUpperCase(); const n = Number(v) || 0; return cc === 'EUR' ? n * (Number(rates.EUR) || 38) : cc === 'USD' ? n * (Number(rates.USD) || 33) : cc === 'GBP' ? n * (Number(rates.GBP) || 41.2) : n; };

  // Derived: selected cari's supplier type + product list
  const selectedCari = cariler.find((c: any) => c.id === orderCariId);
  const supplierType = selectedCari?.supplierType || '';
  const albumler: any[] = data?.albumler || [];
  const depoStok: any = data?.depoStok || {};
  const genelStok: any = data?.genelStok || {};
  const papers: any[] = data?.papers || [];
  const fiyatMap: any = data?.fiyatMap || {};
  const fiyatTalepMap: any = data?.fiyatTalepMap || {};
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
      // Tedarikçi onayı öncesi açık sipariş (taslak/gönderildi) varsa kalem ekle, yoksa yeni oluştur
      const mevcutTaslak = siparisler.find((s: any) => s.cariId === orderCariId && ['taslak', 'gonderildi'].includes(s.status));
      let siparisId: string;
      if (mevcutTaslak) {
        // Taslağa kalem ekle
        const res = await fetch(appendGhostParam(`${SERVER_URL}/tedarikci/siparisler/${mevcutTaslak.id}/kalem-ekle`), {
          method: 'PUT', headers: getHeaders(),
          body: JSON.stringify({ items, teklifFiyat: orderTeklifFiyat ? parseFloat(orderTeklifFiyat) : null }),
        });
        const d = await res.json();
        if (!res.ok) { setError(d.error); return; }
        siparisId = mevcutTaslak.id;
      } else {
        const res = await fetch(appendGhostParam(`${SERVER_URL}/tedarikci/siparisler`), {
          method: 'POST', headers: getHeaders(),
          body: JSON.stringify({ cariId: orderCariId, items, currency: orderCurrency, notes: orderNotes, teklifFiyat: orderTeklifFiyat ? parseFloat(orderTeklifFiyat) : null }),
        });
        const d = await res.json();
        if (!res.ok) { setError(d.error); return; }
        siparisId = d.siparis?.id;
      }
      if (send && siparisId) {
        await fetch(appendGhostParam(`${SERVER_URL}/tedarikci/siparisler/${siparisId}/gonder`), { method: 'POST', headers: getHeaders() });
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

  /* Sipariş dışı kalem onayı: backend fazlaOnayGerekli dönerse dialog açılır, karar ile tekrar çağrılır */
  const [fazlaDialog, setFazlaDialog] = useState<{ teslimatId: string; kalemler: Array<{ productName: string; adet: number; birimFiyat: number }> } | null>(null);

  const approveDelivery = async (id: string, fazlaKarar?: 'kabul' | 'haric') => {
    setActionLoading(id);
    try {
      const res = await fetch(appendGhostParam(`${SERVER_URL}/tedarikci/teslimatlar/${id}/onayla`), {
        method: 'PUT', headers: getHeaders(), body: JSON.stringify(fazlaKarar ? { fazlaKarar } : {}),
      });
      const d = await res.json().catch(() => ({}));
      if (d.fazlaOnayGerekli) { setFazlaDialog({ teslimatId: id, kalemler: d.fazlaKalemler || [] }); return; }
      if (!res.ok && d.error) setError(d.error);
      setFazlaDialog(null);
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
      const res = await fetch(appendGhostParam(`${SERVER_URL}/tedarikci/odemeler`), {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ siparisId: showPayment, amount: payAmount, currency: payCurrency, paymentMethod: payMethod, paymentDate: payDate }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Ödeme kaydedilemedi'); }
      setShowPayment(null);
      setPayAmount(0);
      fetchData();
    } catch (e: any) { alert(e.message); } finally { setActionLoading(''); }
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
                {c.supplierType === 'album' && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">Albüm</span>}
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
            {/* Bakiye */}
            {(() => {
              const sipTutar = toTRY(s.teklifFiyat || s.totalAmount || 0, s.currency);
              const sipOdemeler = odemeler.filter((o: any) => o.siparisId === (s.id || '').replace('siparis_', '') && o.status !== 'reddedildi' && o.status !== 'iptal');
              const odpipienenToplam = sipOdemeler.reduce((a: number, o: any) => a + toTRY(o.amount || 0, o.currency), 0);
              const kalanBorc = sipTutar - odpipienenToplam;
              return (
                <div className="flex items-center gap-3 mt-2 pt-2 border-t" style={{ borderColor: glassBorder }}>
                  <span className="text-white/50 text-[10px]">Toplam: <span className="text-white font-bold">₺{sipTutar.toLocaleString('tr-TR')}</span></span>
                  <span className="text-emerald-400 text-[10px]">Ödenen: <span className="font-bold">₺{odpipienenToplam.toLocaleString('tr-TR')}</span></span>
                  {kalanBorc > 0 && <span className="text-amber-400 text-[10px]">Kalan: <span className="font-bold">₺{kalanBorc.toLocaleString('tr-TR')}</span></span>}
                  {kalanBorc <= 0 && <span className="text-emerald-400 text-[10px] font-bold">Tamam</span>}
                </div>
              );
            })()}
          </div>

          {/* Kalemler */}
          <div className="rounded-2xl overflow-hidden" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
            <div className="px-4 py-2 border-b" style={{ borderColor: glassBorder }}><p className="text-white font-semibold text-sm">Kalemler</p></div>
            {(s.items || []).map((item: any) => {
              const delivered = item.deliveredQuantity || 0;
              const kalan = item.quantity - delivered;
              const hasTeslim = delivered > 0;
              const pct = item.quantity > 0 ? Math.min(100, (delivered / item.quantity) * 100) : 0;
              return (
                <div key={item.id} className="px-4 py-2 border-b" style={{ borderColor: glassBorder }}>
                  <div className="flex justify-between items-center">
                    <span className="text-white text-xs">{item.productName}</span>
                    <div className="text-right flex items-center gap-2">
                      {hasTeslim ? (
                        <span className="text-emerald-400 text-xs font-medium">{delivered}/{item.quantity}</span>
                      ) : (
                        <span className="text-white/60 text-xs">{item.quantity} adet</span>
                      )}
                      <span className="text-white/30 text-xs">₺{item.unitPrice}</span>
                    </div>
                  </div>
                  {hasTeslim && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400" style={{ width: `${pct}%` }} />
                      </div>
                      {kalan > 0 && <span className="text-amber-400 text-[9px] font-bold shrink-0">{kalan} kalan</span>}
                      {kalan === 0 && <span className="text-emerald-400 text-[9px] font-bold shrink-0">Tamam</span>}
                    </div>
                  )}
                </div>
              );
            })}
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
                        const items: Array<{ productName: string; quantity: number; unitPrice: number }> = [];
                        for (const sz of [3,5,7,9,11,13,15]) {
                          const a = (albumler || []).find((al: any) => al.size === sz || al.size === String(sz));
                          const existingTam = (s.items || []).find((i: any) => i.productName === `${sz} Kare Tam`);
                          const existingYarim = (s.items || []).find((i: any) => i.productName === `${sz} Kare Yarım`);
                          // Eski format desteği: "3 Kare" → yarım olarak al
                          const existingEski = !existingTam && !existingYarim ? (s.items || []).find((i: any) => i.productName === `${sz} Kare`) : null;
                          items.push({ productName: `${sz} Kare Tam`, quantity: existingTam?.quantity || 0, unitPrice: existingTam?.unitPrice || a?.tamBoy || 0 });
                          items.push({ productName: `${sz} Kare Yarım`, quantity: existingYarim?.quantity || existingEski?.quantity || 0, unitPrice: existingYarim?.unitPrice || existingEski?.unitPrice || a?.yarimBoy || 0 });
                        }
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
                        const isTam = item.productName.includes('Tam');
                        const depoKey = item.productName === 'Paspartu' ? 'paspartu' : `album${size}${isTam ? '_tam' : '_yarim'}`;
                        const genelKey = item.productName === 'Paspartu' ? 'paspartu' : `album${size}`;
                        const depo = depoStok[depoKey] || 0;
                        const genel = genelStok[genelKey] || 0;
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

            {/* Sipariş bazlı ödeme kaldırıldı (2026-07-21) — ödeme TEK YERDEN: Bakiye sekmesindeki "Ödeme Yap" (FIFO) */}

            {!kisitli && !['taslak', 'tamamlandi', 'iptal'].includes(s.status) && (
              <button onClick={() => { cancelOrder(s.id); setSelectedSiparis(null); }}
                className="w-full py-2 rounded-xl text-xs text-red-400/60 bg-red-500/5 border border-red-500/10">İptal Et</button>
            )}

            {['iptal', 'taslak'].includes(s.status) && (
              <button onClick={async () => {
                if (!confirm('Bu siparişi kalıcı olarak silmek istiyor musunuz?')) return;
                setActionLoading(s.id);
                try {
                  await fetch(appendGhostParam(`${SERVER_URL}/tedarikci/siparisler/${s.id}`), { method: 'DELETE', headers: getHeaders() });
                  setSelectedSiparis(null); fetchData();
                } finally { setActionLoading(''); }
              }} disabled={actionLoading === s.id}
                className="w-full py-2 rounded-xl text-xs text-red-500 bg-red-500/10 border border-red-500/20 font-bold">Kalıcı Sil</button>
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

      {/* Tedarikçiye göre gruplu görünüm */}
      {(() => {
        // Siparişleri tedarikçiye göre grupla
        const grouped: Record<string, { cariName: string; cariId: string; orders: any[] }> = {};
        for (const s of sirali) {
          const key = s.cariId || 'unknown';
          if (!grouped[key]) grouped[key] = { cariName: s.cariName || 'Bilinmeyen', cariId: key, orders: [] };
          grouped[key].orders.push(s);
        }
        const groups = Object.values(grouped);
        if (groups.length === 0) return <p className="text-center text-white/30 py-8 text-sm">Bu filtrede sipariş yok</p>;

        return groups.map((g) => {
          const aktifCount = g.orders.filter((s: any) => !['tamamlandi', 'iptal'].includes(s.status)).length;
          const toplamTutar = g.orders.filter((s: any) => ['onaylandi', 'kismen_teslim', 'teslim_edildi', 'tamamlandi'].includes(s.status)).reduce((a: number, s: any) => a + toTRY(s.teklifFiyat || s.totalAmount || 0, s.currency), 0);
          const isExpanded = expandedSuppliers.has(g.cariId);
          const aktifOrders = g.orders.filter((s: any) => !['tamamlandi', 'iptal'].includes(s.status));
          const arsivOrders = g.orders.filter((s: any) => ['tamamlandi', 'iptal'].includes(s.status));

          return (
            <div key={g.cariId} className="rounded-2xl overflow-hidden" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
              {/* Tedarikçi Header — tıklanınca aç/kapa */}
              <button onClick={() => setExpandedSuppliers(prev => { const next = new Set(prev); if (next.has(g.cariId)) next.delete(g.cariId); else next.add(g.cariId); return next; })}
                className="w-full p-4 flex items-center justify-between text-left">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm truncate">{g.cariName}</p>
                  <p className="text-white/40 text-[10px]">{aktifCount} aktif sipariş · ₺{toplamTutar.toLocaleString('tr-TR')}</p>
                  {(() => {
                    const cariOdemeler = odemeler.filter((o: any) => o.cariId === g.cariId && o.status !== 'reddedildi' && o.status !== 'iptal');
                    const odpipienenToplam = cariOdemeler.reduce((a: number, o: any) => a + toTRY(o.amount || 0, o.currency), 0);
                    const kalanBorc = toplamTutar - odpipienenToplam;
                    if (odpipienenToplam > 0 || kalanBorc > 0) return (
                      <p className="text-[10px] mt-0.5">
                        <span className="text-emerald-400">₺{odpipienenToplam.toLocaleString('tr-TR')} ödendi</span>
                        {kalanBorc > 0 && <span className="text-amber-400 ml-2">₺{kalanBorc.toLocaleString('tr-TR')} kalan</span>}
                      </p>
                    );
                    return null;
                  })()}
                </div>
                <div className="flex items-center gap-2">
                  {aktifCount > 0 && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">{aktifCount}</span>}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                </div>
              </button>

              {/* Açık: sipariş listesi */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    {/* Aktif Siparişler */}
                    {aktifOrders.length > 0 && aktifOrders.map((s: any) => {
                      const sc = STATUS_CONFIG[s.status] || STATUS_CONFIG.taslak;
                      return (
                        <button key={s.id} onClick={() => { setSelectedSiparis(s); setKarsiTeklifItems([]); setKarsiTeklifFiyat(''); }}
                          className="w-full px-4 py-3 flex items-center justify-between text-left border-t" style={{ borderColor: glassBorder }}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-medium" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                              {s.kaynakTedarikci && <span className="text-[9px] text-orange-300">🏭</span>}
                              <span className="text-white/30 text-[10px]">{new Date(s.createdAt).toLocaleDateString('tr-TR')}</span>
                            </div>
                            <p className="text-white/50 text-[10px] truncate mt-0.5">{s.items?.map((i: any) => `${i.productName} ×${i.quantity}`).join(', ')}</p>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <p className="text-white font-bold text-xs">₺{(s.teklifFiyat || s.totalAmount || 0).toLocaleString('tr-TR')}</p>
                            {(() => {
                              const totalQty = (s.items || []).reduce((a: number, i: any) => a + (i.quantity || 0), 0);
                              const deliveredQty = (s.items || []).reduce((a: number, i: any) => a + (i.deliveredQuantity || 0), 0);
                              if (totalQty > 0 && deliveredQty > 0) return <span className="text-[9px] text-white/30">{deliveredQty}/{totalQty} teslim</span>;
                              return null;
                            })()}
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-white/15 ml-1" />
                        </button>
                      );
                    })}

                    {/* Arşiv Siparişler */}
                    {arsivOrders.length > 0 && (
                      <div className="border-t" style={{ borderColor: glassBorder }}>
                        <button onClick={() => setShowArchive(prev => ({ ...prev, [g.cariId]: !prev[g.cariId] }))}
                          className="w-full px-4 py-2 flex items-center justify-between text-left">
                          <span className="text-white/30 text-[10px] font-semibold">Arşiv ({arsivOrders.length})</span>
                          {showArchive[g.cariId] ? <ChevronUp className="w-3 h-3 text-white/20" /> : <ChevronDown className="w-3 h-3 text-white/20" />}
                        </button>
                        {showArchive[g.cariId] && arsivOrders.map((s: any) => {
                          const sc = STATUS_CONFIG[s.status] || STATUS_CONFIG.taslak;
                          return (
                            <button key={s.id} onClick={() => { setSelectedSiparis(s); setKarsiTeklifItems([]); setKarsiTeklifFiyat(''); }}
                              className="w-full px-4 py-2 flex items-center justify-between text-left opacity-50 border-t" style={{ borderColor: glassBorder }}>
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-medium" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                                <span className="text-white/30 text-[10px]">{new Date(s.createdAt).toLocaleDateString('tr-TR')}</span>
                              </div>
                              <span className="text-white/40 text-xs">₺{(s.teklifFiyat || s.totalAmount || 0).toLocaleString('tr-TR')}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        });
      })()}
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
        <div className="flex items-center gap-2">
          {userRole === 'yonetici' && !kisitli && (
            <button
              onClick={async () => {
                setShowYetki(true);
                try {
                  const [uRes, yRes] = await Promise.all([
                    fetch(appendGhostParam(`${SERVER_URL}/auth/kullanicilar`), { headers: getHeaders() }),
                    fetch(appendGhostParam(`${SERVER_URL}/tedarikci/yetki`), { headers: getHeaders() }),
                  ]);
                  if (uRes.ok) { const d = await uRes.json(); setYetkiUsers((d.kullanicilar || []).filter((u: any) => !['yonetici', 'ust-mudur'].includes(u.rol))); }
                  if (yRes.ok) { const d = await yRes.json(); setYetkiIds(d.userIds || []); }
                } catch {}
              }}
              className="w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-all"
              style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.4)' }}
              title="Kimler görebilir"
            >
              <span className="text-xs">🔒</span>
            </button>
          )}
          <button
            onClick={() => setShowTedGuide(true)}
            className="w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-all"
            style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', boxShadow: '0 0 8px rgba(251,191,36,0.2)' }}
          >
            <HelpCircle className="w-4 h-4 text-amber-400" />
          </button>
          <button onClick={fetchData} className="p-2 rounded-xl" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
            <RefreshCw className={`w-5 h-5 text-white/50 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.filter(t => !kisitli || t.key !== 'odeme').map(t => {
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
            ]).filter(t => !kisitli || t.key === 'siparisler').map(t => (
              <button key={t.key} onClick={() => setTedarikciTab(t.key)}
                className="flex-1 py-2 rounded-xl text-[11px] font-bold transition-all"
                style={{ background: tedarikciTab === t.key ? `${t.color}20` : glassBg, border: `1px solid ${tedarikciTab === t.key ? `${t.color}50` : glassBorder}`, color: tedarikciTab === t.key ? t.color : 'rgba(255,255,255,0.4)' }}>
                {t.label}{t.key === 'fiyatlar' && fiyatTalepMap[selectedTedarikci.id] ? ' 🔔' : ''}
              </button>
            ))}
          </div>

          {/* Siparişler */}
          {tedarikciTab === 'siparisler' && (() => {
            const mySip = siparisler.filter((s: any) => s.cariId === selectedTedarikci.id);
            if (selectedSiparis) return renderSiparisTab(); // detay görünümü kullan
            return (
              <div className="space-y-3">
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setOrderCariId(selectedTedarikci.id); buildOrderItemsFor(selectedTedarikci.id); setOrderNotes(''); setOrderTeklifFiyat(''); setShowNewOrder(true); }}
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
                        {s.siparisDisi && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold ml-1" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>SİPARİŞ DIŞI</span>}
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
          {tedarikciTab === 'fiyatlar' && (<>
            {/* Bekleyen fiyat güncelleme talebi — tedarikçiden geldi, kabul/red bekliyor */}
            {(() => {
              const talep = fiyatTalepMap[selectedTedarikci.id];
              if (!talep) return null;
              const degisenler = (talep.items || []).filter((it: any) => (it.yeniFiyat || 0) !== (it.eskiFiyat || 0));
              return (
                <div className="rounded-2xl overflow-hidden mb-3" style={{ background: 'rgba(251,191,36,0.06)', border: '1.5px solid rgba(251,191,36,0.4)' }}>
                  <div className="px-4 py-3 border-b border-white/5">
                    <p className="text-amber-400 font-bold text-sm">🔔 Fiyat Güncelleme Talebi</p>
                    <p className="text-white/40 text-[10px] mt-0.5">
                      {talep.gonderenKisi || 'Tedarikçi'} · {talep.tarih ? new Date(talep.tarih).toLocaleDateString('tr-TR') : ''} — kabul edersen anlaşma fiyatları ve maliyet listesi güncellenir
                    </p>
                  </div>
                  {degisenler.length === 0 && (
                    <p className="px-4 py-3 text-white/40 text-xs">Fiyat değişikliği içermiyor.</p>
                  )}
                  {degisenler.map((it: any, i: number) => (
                    <div key={i} className="px-4 py-2 flex items-center justify-between border-b border-white/5">
                      <span className="text-white text-xs font-semibold">{it.productName}</span>
                      <span className="text-xs">
                        <span className="text-white/40">₺{(it.eskiFiyat || 0).toLocaleString('tr-TR')}</span>
                        <span className="text-white/30"> → </span>
                        <b style={{ color: (it.yeniFiyat || 0) > (it.eskiFiyat || 0) ? '#f87171' : '#34d399' }}>₺{(it.yeniFiyat || 0).toLocaleString('tr-TR')}</b>
                      </span>
                    </div>
                  ))}
                  <div className="p-3 flex gap-2">
                    <button
                      onClick={async () => {
                        setActionLoading('fiyattalep');
                        try {
                          await fetch(appendGhostParam(`${SERVER_URL}/tedarikci/fiyat-talep/${selectedTedarikci.id}/kabul`), { method: 'POST', headers: getHeaders(), body: JSON.stringify({}) });
                          fetchData();
                        } finally { setActionLoading(''); }
                      }}
                      disabled={actionLoading === 'fiyattalep'}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #34d399, #10b981)' }}>
                      ✓ Kabul Et
                    </button>
                    <button
                      onClick={async () => {
                        setActionLoading('fiyattalep');
                        try {
                          await fetch(appendGhostParam(`${SERVER_URL}/tedarikci/fiyat-talep/${selectedTedarikci.id}/red`), { method: 'POST', headers: getHeaders(), body: JSON.stringify({}) });
                          fetchData();
                        } finally { setActionLoading(''); }
                      }}
                      disabled={actionLoading === 'fiyattalep'}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 disabled:opacity-50">
                      ✗ Reddet
                    </button>
                  </div>
                </div>
              );
            })()}
            <div className="rounded-2xl overflow-hidden" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
              <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: glassBorder }}>
                <p className="text-white font-semibold text-sm">💰 Anlaşma Fiyatları</p>
                <button onClick={() => {
                  setShowPriceList(selectedTedarikci.id);
                  const rawItems = fiyatMap[selectedTedarikci.id]?.items || [];
                  const items: Array<{ productName: string; fiyat: number; currency: string }> = [];
                  for (const s of [3, 5, 7, 9, 11, 13, 15]) {
                    const a = (albumler || []).find((al: any) => al.size === s || al.size === String(s));
                    const flTam = rawItems.find((f: any) => f.productName === `${s} Kare Tam`);
                    const flYarim = rawItems.find((f: any) => f.productName === `${s} Kare Yarım`);
                    const flEski = rawItems.find((f: any) => f.productName === `${s} Kare`);
                    items.push({ productName: `${s} Kare Tam`, fiyat: flTam?.fiyat || flEski?.fiyat || a?.tamBoy || 0, currency: 'TRY' });
                    items.push({ productName: `${s} Kare Yarım`, fiyat: flYarim?.fiyat || flEski?.fiyat || a?.yarimBoy || 0, currency: 'TRY' });
                  }
                  // Paspartu
                  const flPas = rawItems.find((f: any) => f.productName === 'Paspartu');
                  items.push({ productName: 'Paspartu', fiyat: flPas?.fiyat || 0, currency: 'TRY' });
                  setPriceListItems(items);
                }}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20">Düzenle</button>
              </div>
              {[3,5,7,9,11,13,15].map(s => {
                const a = (albumler || []).find((al: any) => al.size === s || al.size === String(s));
                const flTam = (fiyatMap[selectedTedarikci.id]?.items || []).find((f: any) => f.productName === `${s} Kare Tam`);
                const flYarim = (fiyatMap[selectedTedarikci.id]?.items || []).find((f: any) => f.productName === `${s} Kare Yarım`);
                // Eski format desteği
                const flEski = (fiyatMap[selectedTedarikci.id]?.items || []).find((f: any) => f.productName === `${s} Kare`);
                const tamFiyat = flTam?.fiyat || flEski?.fiyat || a?.tamBoy || 0;
                const yarimFiyat = flYarim?.fiyat || flEski?.fiyat || a?.yarimBoy || 0;
                const emojis: Record<number,string> = {3:'📘',5:'📗',7:'📙',9:'📕',11:'📔',13:'📒',15:'📓'};
                return (
                  <div key={s} className="px-4 py-2 border-b flex items-center gap-2" style={{ borderColor: glassBorder }}>
                    <span className="text-base">{emojis[s]}</span>
                    <span className="text-white text-xs font-semibold w-12">{s} Kare</span>
                    <div className="flex-1 flex items-center justify-end gap-3">
                      <span className="text-[10px] text-[#9dd9ea]">Tam: <span className="font-bold">₺{tamFiyat}</span></span>
                      <span className="text-[10px] text-[#ffd4a3]">Yarım: <span className="font-bold">₺{yarimFiyat}</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>)}

          {/* Bakiye */}
          {tedarikciTab === 'bakiye' && (
            <div className="space-y-3">
              {/* Dönem filtresi */}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {([
                  { key: 'tumu', label: 'Tümü' },
                  { key: 'bu_ay', label: 'Bu Ay' },
                  { key: 'gecen_ay', label: 'Geçen Ay' },
                  { key: 'bu_yil', label: 'Bu Yıl' },
                ] as const).map(f => {
                  const active = adminBakiyeDonem === f.key;
                  return (
                    <button key={f.key} onClick={() => setAdminBakiyeDonem(f.key)}
                      className="px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all"
                      style={{ background: active ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${active ? 'rgba(96,165,250,0.40)' : 'rgba(255,255,255,0.08)'}`, color: active ? '#60a5fa' : 'rgba(255,255,255,0.4)' }}>
                      {f.label}
                    </button>
                  );
                })}
              </div>
              {(() => {
                const now = new Date();
                const buAyBaslangic = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
                const gecenAyBaslangic = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
                const gecenAyBitis = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
                const buYilBaslangic = `${now.getFullYear()}-01-01`;
                const donemFiltre = (tarih: string) => {
                  if (!tarih) return adminBakiyeDonem === 'tumu';
                  const t = tarih.slice(0, 10);
                  if (adminBakiyeDonem === 'tumu') return true;
                  if (adminBakiyeDonem === 'bu_ay') return t >= buAyBaslangic;
                  if (adminBakiyeDonem === 'gecen_ay') return t >= gecenAyBaslangic && t <= gecenAyBitis;
                  if (adminBakiyeDonem === 'bu_yil') return t >= buYilBaslangic;
                  return true;
                };

                const mySip = siparisler.filter((s: any) => s.cariId === selectedTedarikci.id && ['onaylandi', 'kismen_teslim', 'teslim_edildi', 'tamamlandi'].includes(s.status));
                const toplam = mySip.reduce((a: number, s: any) => a + toTRY(s.teklifFiyat || s.totalAmount || 0, s.currency), 0);
                const tumOdemeler = odemeler.filter((o: any) => o.cariId === selectedTedarikci.id && o.status !== 'reddedildi' && o.status !== 'iptal');
                const odenen = tumOdemeler.reduce((a: number, o: any) => a + toTRY(o.amount || 0, o.currency), 0);
                const kalan = toplam - odenen;

                const filtreliOdemeler = tumOdemeler.filter((o: any) => donemFiltre(o.paymentDate || o.createdAt));
                const filtreliTeslimatlar = teslimatlar.filter((t: any) => t.cariId === selectedTedarikci.id && t.status === 'onaylandi' && donemFiltre(t.deliveryDate || t.createdAt));

                const teslimKalemler: Record<string, number> = {};
                for (const t of filtreliTeslimatlar) {
                  for (const line of (t.lines || [])) {
                    teslimKalemler[line.productName] = (teslimKalemler[line.productName] || 0) + (line.quantity || 0);
                  }
                }
                const toplamTeslimAdet = Object.values(teslimKalemler).reduce((a: number, v: number) => a + v, 0);
                const donemOdenen = filtreliOdemeler.reduce((a: number, o: any) => a + toTRY(o.amount || 0, o.currency), 0);

                return (
                  <>
                    {/* Bakiye kartı */}
                    <div className="p-5 rounded-2xl text-center" style={{ background: kalan > 0 ? 'rgba(251,191,36,0.08)' : 'rgba(52,211,153,0.08)', border: `1px solid ${kalan > 0 ? 'rgba(251,191,36,0.20)' : 'rgba(52,211,153,0.20)'}` }}>
                      <p className="text-white/40 text-xs mb-1">{kalan > 0 ? 'Kalan Borcumuz' : kalan < 0 ? 'Alacağımız (önden/fazla ödenen)' : 'Bakiye'}</p>
                      <p className={`text-3xl font-bold ${kalan > 0 ? 'text-amber-400' : 'text-green-400'}`}>{kalan < 0 ? '+' : ''}₺{Math.abs(kalan).toLocaleString('tr-TR')}</p>
                      {toplam > 0 && (
                        <div className="mt-3">
                          <div className="flex justify-between text-[10px] mb-1">
                            <span className="text-emerald-400 font-bold">Ödenen ₺{odenen.toLocaleString('tr-TR')}</span>
                            <span className="text-white/40">Sipariş toplamı ₺{toplam.toLocaleString('tr-TR')}</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400" style={{ width: `${Math.min(100, Math.round((odenen / toplam) * 100))}%` }} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Dönem özet kartları */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 rounded-2xl text-center" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
                        <p className="text-emerald-400/50 text-[9px]">Ödenen</p>
                        <p className="text-emerald-400 font-bold text-lg">₺{donemOdenen.toLocaleString('tr-TR')}</p>
                        <p className="text-white/20 text-[9px]">{filtreliOdemeler.length} ödeme</p>
                      </div>
                      <div className="p-3 rounded-2xl text-center" style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)' }}>
                        <p className="text-blue-400/50 text-[9px]">Teslim Edilen</p>
                        <p className="text-blue-400 font-bold text-lg">{toplamTeslimAdet.toLocaleString('tr-TR')}</p>
                        <p className="text-white/20 text-[9px]">{filtreliTeslimatlar.length} teslimat</p>
                      </div>
                    </div>

                    {/* Teslim edilen kalemler */}
                    {Object.keys(teslimKalemler).length > 0 && (
                      <div className="rounded-2xl overflow-hidden" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
                        <div className="px-4 py-2 border-b" style={{ borderColor: glassBorder }}>
                          <p className="text-white font-semibold text-sm">Teslim Edilen Kalemler</p>
                        </div>
                        {Object.entries(teslimKalemler).map(([name, qty]) => (
                          <div key={name} className="px-4 py-2 flex justify-between border-b" style={{ borderColor: glassBorder }}>
                            <span className="text-white/60 text-xs">{name}</span>
                            <span className="text-blue-400 font-bold text-xs">{qty} adet</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Ödeme geçmişi */}
                    {filtreliOdemeler.length > 0 && (
                      <div className="rounded-2xl overflow-hidden" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
                        <div className="px-4 py-2 border-b" style={{ borderColor: glassBorder }}>
                          <p className="text-white font-semibold text-sm">Ödeme Geçmişi</p>
                        </div>
                        {filtreliOdemeler.map((o: any, i: number) => (
                          <div key={i} className="px-4 py-2 flex justify-between border-b" style={{ borderColor: glassBorder }}>
                            <div>
                              <span className="text-white/60 text-xs">{new Date(o.paymentDate || o.createdAt).toLocaleDateString('tr-TR')}</span>
                              {o.tip === 'on_odeme' && <span className="text-orange-400 text-[9px] ml-1">ön ödeme</span>}
                            </div>
                            <span className="text-emerald-400 font-bold text-xs">₺{(o.amount || 0).toLocaleString('tr-TR')}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Genel hesap */}
                    <div className="rounded-2xl overflow-hidden" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
                      <div className="px-4 py-2 flex justify-between border-b" style={{ borderColor: glassBorder }}>
                        <span className="text-white/50 text-xs">Toplam Sipariş</span><span className="text-white font-bold text-xs">₺{toplam.toLocaleString('tr-TR')}</span>
                      </div>
                      <div className="px-4 py-2 flex justify-between border-b" style={{ borderColor: glassBorder }}>
                        <span className="text-white/50 text-xs">Toplam Ödenen</span><span className="text-green-400 font-bold text-xs">₺{odenen.toLocaleString('tr-TR')}</span>
                      </div>
                      <div className="px-4 py-2 flex justify-between">
                        <span className="text-white/50 text-xs">Kalan</span><span className="text-amber-400 font-bold text-xs">₺{kalan.toLocaleString('tr-TR')}</span>
                      </div>
                    </div>

                    {/* Ödeme Yap — TEK ödeme noktası: FIFO en eski borçtan düşer, kasadan otomatik (önce banka, yetmezse nakit) */}
                    {!showOnOdeme ? (
                      <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowOnOdeme(true)}
                        className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2"
                        style={{ background: 'linear-gradient(135deg, #34d399, #10b981)' }}>
                        💳 Ödeme Yap
                      </motion.button>
                    ) : (
                      <div className="p-4 rounded-2xl space-y-3" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.20)' }}>
                        <p className="text-green-400 text-xs font-semibold">💳 Ödeme Yap</p>
                        <p className="text-white/40 text-[10px] leading-relaxed">
                          Borç varsa <b className="text-white/70">en eski siparişten başlayarak</b> kapatır; borç yoksa/artarsa <b className="text-white/70">ön ödeme (alacağımız)</b> yazılır.
                          Kasadan otomatik düşer: <b className="text-white/70">önce banka, yetmezse nakit.</b> Tedarikçi ödemeyi kendi panelinden onaylar.
                        </p>
                        <input type="number" min={0} value={onOdemeTutar} onChange={e => setOnOdemeTutar(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-white bg-white/10 border border-white/20 text-center font-bold" style={{ fontSize: 16 }} placeholder="Tutar (₺)" />
                        <input type="text" value={onOdemeAciklama} onChange={e => setOnOdemeAciklama(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-white bg-white/10 border border-white/20 text-sm" placeholder="Açıklama (opsiyonel)" />
                        <div className="flex gap-2">
                          <button onClick={() => { setShowOnOdeme(false); setOnOdemeTutar(''); setOnOdemeAciklama(''); }}
                            className="flex-1 py-2 rounded-lg text-xs text-white/40 bg-white/5">Vazgeç</button>
                          <motion.button whileTap={{ scale: 0.95 }} onClick={async () => {
                            if (!onOdemeTutar) return;
                            setActionLoading('onodeme');
                            try {
                              const _onRes = await fetch(appendGhostParam(`${SERVER_URL}/tedarikci/odeme-genel`), {
                                method: 'POST', headers: getHeaders(),
                                body: JSON.stringify({ cariId: selectedTedarikci.id, amount: parseFloat(onOdemeTutar), aciklama: onOdemeAciklama || '' }),
                              });
                              const _d = await _onRes.json().catch(() => ({}));
                              if (!_onRes.ok) { alert(_d.error || 'Ödeme kaydedilemedi'); return; }
                              setShowOnOdeme(false); setOnOdemeTutar(''); setOnOdemeAciklama('');
                              fetchData();
                            } catch (e: any) { alert(e.message); } finally { setActionLoading(''); }
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
                <h2 className="text-white font-bold text-lg">{orderCariId && siparisler.some((s: any) => s.cariId === orderCariId && ['taslak', 'gonderildi'].includes(s.status)) ? 'Açık Siparişe Kalem Ekle' : 'Yeni Sipariş'}</h2>
                <button onClick={() => setShowNewOrder(false)}><X className="w-5 h-5 text-white/40" /></button>
              </div>
              {orderCariId && siparisler.some((s: any) => s.cariId === orderCariId && ['taslak', 'gonderildi'].includes(s.status)) && (
                <div className="px-3 py-2 rounded-lg text-[11px] text-amber-400" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.15)' }}>
                  Bu tedarikçinin onay bekleyen açık siparişi var. Kalemler o siparişe eklenecek.
                </div>
              )}
              <select value={orderCariId} onChange={e => {
                setOrderCariId(e.target.value);
                buildOrderItemsFor(e.target.value);
              }} className={inputStyle + ' bg-white/10'}>
                <option value="" className="bg-gray-900">Tedarikçi seç...</option>
                {cariler.filter((c: any) => c.supplierType === 'album').map((c: any) => (
                  <option key={c.id} value={c.id} className="bg-gray-900">{c.emoji || '🏢'} {c.name}</option>
                ))}
              </select>

              {/* Ürün listesi — albüm tipi */}
              {orderCariId && supplierType === 'album' && (
                <div className="space-y-1.5">
                  {[3,5,7,9,11,13,15].map(size => {
                    const tamIdx = orderItems.findIndex(i => i.productName === `${size} Kare Tam`);
                    const yarimIdx = orderItems.findIndex(i => i.productName === `${size} Kare Yarım`);
                    if (tamIdx < 0 && yarimIdx < 0) return null;
                    const emojis: Record<number,string> = {3:'📘',5:'📗',7:'📙',9:'📕',11:'📔',13:'📒',15:'📓'};
                    const anlasmItems = (cariFiyat?.items || []);
                    const fiyatOf = (idx: number) => {
                      if (idx < 0) return 0;
                      const it = orderItems[idx];
                      const anlasma = anlasmItems.find((f: any) => f.productName === it.productName)?.fiyat;
                      return anlasma !== undefined ? anlasma : (it.unitPrice || 0);
                    };
                    const setQty = (idx: number, raw: string) => {
                      const q = parseInt(raw.replace(/\D/g, '')) || 0;
                      setOrderItems(prev => prev.map((p, i) => i === idx ? { ...p, quantity: q } : p));
                    };
                    const tamQty = tamIdx >= 0 ? orderItems[tamIdx].quantity : 0;
                    const yarimQty = yarimIdx >= 0 ? orderItems[yarimIdx].quantity : 0;
                    return (
                      <div key={size} className="flex items-center gap-2 py-1.5 px-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="w-[70px] flex items-center gap-1.5 shrink-0">
                          <span className="text-base">{emojis[size]}</span>
                          <span className="text-white text-xs font-bold">{size} Kare</span>
                        </div>
                        {/* Tam */}
                        <div className="flex-1 flex items-center justify-end gap-1.5">
                          <div className="text-right leading-tight">
                            <div className="text-[10px] font-bold text-[#9dd9ea]">▣ Tam {fiyatOf(tamIdx) > 0 ? `₺${fiyatOf(tamIdx)}` : ''}</div>
                            <div className="text-[9px] text-white/35">depo {depoStok[`album${size}_tam`] || 0}</div>
                          </div>
                          <input type="text" inputMode="numeric" value={tamQty || ''}
                            onChange={e => setQty(tamIdx, e.target.value)}
                            className={`w-12 h-10 rounded-lg text-center text-white font-extrabold border ${tamQty > 0 ? 'bg-[#9dd9ea]/25 border-[#9dd9ea]' : 'bg-[#9dd9ea]/10 border-[#9dd9ea]/25'}`}
                            style={{ fontSize: 16 }}
                            placeholder="0" />
                        </div>
                        {/* Yarım */}
                        <div className="flex-1 flex items-center justify-end gap-1.5">
                          <div className="text-right leading-tight">
                            <div className="text-[10px] font-bold text-[#ffd4a3]">▨ Yarım {fiyatOf(yarimIdx) > 0 ? `₺${fiyatOf(yarimIdx)}` : ''}</div>
                            <div className="text-[9px] text-white/35">depo {depoStok[`album${size}_yarim`] || 0}</div>
                          </div>
                          <input type="text" inputMode="numeric" value={yarimQty || ''}
                            onChange={e => setQty(yarimIdx, e.target.value)}
                            className={`w-12 h-10 rounded-lg text-center text-white font-extrabold border ${yarimQty > 0 ? 'bg-[#ffd4a3]/25 border-[#ffd4a3]' : 'bg-[#ffd4a3]/10 border-[#ffd4a3]/25'}`}
                            style={{ fontSize: 16 }}
                            placeholder="0" />
                        </div>
                      </div>
                    );
                  })}
                  {/* Paspartu */}
                  {(() => {
                    const pasIdx = orderItems.findIndex(i => i.productName === 'Paspartu');
                    if (pasIdx < 0) return null;
                    const pas = orderItems[pasIdx];
                    return (
                      <div className="flex items-center gap-2 py-1.5 px-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="w-[70px] flex items-center gap-1.5 shrink-0">
                          <span className="text-base">🖼️</span>
                          <span className="text-white text-xs font-bold">Paspartu</span>
                        </div>
                        <div className="flex-1 flex items-center justify-end gap-1.5">
                          <span className="text-[10px] text-white/40 font-bold">Toplam ₺</span>
                          <input type="text" inputMode="numeric" value={pas.unitPrice || ''}
                            onChange={e => setOrderItems(prev => prev.map((p, i) => i === pasIdx ? { ...p, unitPrice: parseInt(e.target.value.replace(/\D/g, '')) || 0 } : p))}
                            className={`w-20 h-10 rounded-lg text-center font-extrabold border ${pas.unitPrice > 0 ? 'text-green-300 bg-green-500/20 border-green-400/60' : 'text-white bg-white/5 border-white/20'}`}
                            style={{ fontSize: 16 }}
                            placeholder="0" />
                          <span className="text-[10px] text-white/40 font-bold">Adet</span>
                          <input type="text" inputMode="numeric" value={pas.quantity || ''}
                            onChange={e => setOrderItems(prev => prev.map((p, i) => i === pasIdx ? { ...p, quantity: parseInt(e.target.value.replace(/\D/g, '')) || 0 } : p))}
                            className={`w-14 h-10 rounded-lg text-center text-white font-extrabold border ${pas.quantity > 0 ? 'bg-white/20 border-white/50' : 'bg-white/5 border-white/20'}`}
                            style={{ fontSize: 16 }}
                            placeholder="0" />
                        </div>
                      </div>
                    );
                  })()}
                  {/* Toplam */}
                  <div className="flex justify-between items-center pt-2 px-1 border-t border-white/10">
                    <span className="text-white/50 text-xs font-semibold">
                      Toplam
                      {(() => { const adet = orderItems.reduce((a, i) => a + (i.productName === 'Paspartu' ? 0 : i.quantity), 0); return adet > 0 ? ` · ${adet} albüm` : ''; })()}
                    </span>
                    <span className="text-amber-300 font-extrabold text-lg">₺{orderItems.reduce((a, i) => a + (i.productName === 'Paspartu' ? (i.unitPrice || 0) : (i.quantity * i.unitPrice)), 0).toLocaleString('tr-TR')}</span>
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
                  const defaults: Array<{ productName: string; fiyat: number; currency: string }> = [];
                  for (const s of sizes) {
                    defaults.push({ productName: `${s} Kare Tam`, fiyat: 0, currency: 'TRY' });
                    defaults.push({ productName: `${s} Kare Yarım`, fiyat: 0, currency: 'TRY' });
                  }
                  defaults.push({ productName: 'Paspartu', fiyat: 0, currency: 'TRY' });
                  setTimeout(() => setPriceListItems(defaults), 0);
                }
                return null;
              })()}
              <div className="space-y-1.5">
                {[3,5,7,9,11,13,15].map(size => {
                  const tamIdx = priceListItems.findIndex(i => i.productName === `${size} Kare Tam`);
                  const yarimIdx = priceListItems.findIndex(i => i.productName === `${size} Kare Yarım`);
                  if (tamIdx < 0 && yarimIdx < 0) return null;
                  const emojis: Record<number,string> = {3:'📘',5:'📗',7:'📙',9:'📕',11:'📔',13:'📒',15:'📓'};
                  return (
                    <div key={size} className="flex items-center gap-2 py-1.5 px-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span className="text-lg">{emojis[size]}</span>
                      <span className="text-white text-xs font-semibold w-14">{size} Kare</span>
                      <div className="flex items-center gap-1 flex-1">
                        <span className="text-[10px] text-[#9dd9ea]">Tam</span>
                        <span className="text-white/30 text-[10px]">₺</span>
                        <input type="number" min={0} value={tamIdx >= 0 ? (priceListItems[tamIdx].fiyat || '') : ''}
                          onChange={e => { if (tamIdx >= 0) setPriceListItems(prev => prev.map((p, i) => i === tamIdx ? { ...p, fiyat: parseFloat(e.target.value) || 0 } : p)); }}
                          className="w-16 px-1.5 py-1 rounded-lg text-center text-[#9dd9ea] bg-[#9dd9ea]/10 border border-[#9dd9ea]/20 text-xs"
                          placeholder="0" />
                      </div>
                      <div className="flex items-center gap-1 flex-1">
                        <span className="text-[10px] text-[#ffd4a3]">Yarım</span>
                        <span className="text-white/30 text-[10px]">₺</span>
                        <input type="number" min={0} value={yarimIdx >= 0 ? (priceListItems[yarimIdx].fiyat || '') : ''}
                          onChange={e => { if (yarimIdx >= 0) setPriceListItems(prev => prev.map((p, i) => i === yarimIdx ? { ...p, fiyat: parseFloat(e.target.value) || 0 } : p)); }}
                          className="w-16 px-1.5 py-1 rounded-lg text-center text-[#ffd4a3] bg-[#ffd4a3]/10 border border-[#ffd4a3]/20 text-xs"
                          placeholder="0" />
                      </div>
                    </div>
                  );
                })}
                {/* Paspartu */}
                {(() => {
                  const pasIdx = priceListItems.findIndex(i => i.productName === 'Paspartu');
                  if (pasIdx < 0) return null;
                  return (
                    <div className="flex items-center gap-2 py-1.5 px-1">
                      <span className="text-lg">🖼️</span>
                      <span className="text-white text-xs font-semibold flex-1">Paspartu</span>
                      <span className="text-white/30 text-[10px]">₺</span>
                      <input type="number" min={0} value={priceListItems[pasIdx].fiyat || ''}
                        onChange={e => setPriceListItems(prev => prev.map((p, i) => i === pasIdx ? { ...p, fiyat: parseFloat(e.target.value) || 0 } : p))}
                        className="w-20 px-2 py-1 rounded-lg text-center text-green-400 bg-white/10 border border-white/20 text-xs"
                        placeholder="0" />
                    </div>
                  );
                })()}
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
      {/* Sipariş dışı ürün onayı — teslimatta hiçbir siparişe düşmeyen kalemler */}
      <AnimatePresence>
        {fazlaDialog && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-5">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl p-5 space-y-3"
              style={{ background: '#1a1a2e', border: '1.5px solid rgba(251,191,36,0.4)' }}>
              <h2 className="text-amber-400 font-bold text-base">⚠️ Sipariş Dışı Ürün</h2>
              <p className="text-white/50 text-[11px] leading-relaxed">
                Bu kalemler hiçbir açık siparişte yok (ya da sipariş toplamını aşıyor).
                <b className="text-white/80"> Kabul edersen</b> depoya girer ve tutarı tedarikçinin bakiyesine borç yazılır;
                <b className="text-white/80"> hariç tutarsan</b> hiç işlenmez.
              </p>
              <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {fazlaDialog.kalemler.map((k, i) => (
                  <div key={i} className="px-3 py-2 flex justify-between items-center border-b border-white/5">
                    <span className="text-white text-xs font-semibold">{k.adet}× {k.productName}</span>
                    <span className="text-white/50 text-xs">₺{(k.birimFiyat || 0).toLocaleString('tr-TR')} → <b className="text-amber-300">₺{((k.birimFiyat || 0) * k.adet).toLocaleString('tr-TR')}</b></span>
                  </div>
                ))}
                <div className="px-3 py-2 flex justify-between items-center">
                  <span className="text-white/50 text-xs font-bold">Toplam (bakiyeye eklenecek)</span>
                  <span className="text-amber-300 font-bold text-sm">₺{fazlaDialog.kalemler.reduce((a, k) => a + (k.birimFiyat || 0) * k.adet, 0).toLocaleString('tr-TR')}</span>
                </div>
              </div>
              <div className="space-y-2">
                <button onClick={() => approveDelivery(fazlaDialog.teslimatId, 'kabul')}
                  disabled={!!actionLoading}
                  className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #34d399, #10b981)' }}>
                  ✓ Kabul Et — depoya gir + bakiyeye borç yaz
                </button>
                <button onClick={() => approveDelivery(fazlaDialog.teslimatId, 'haric')}
                  disabled={!!actionLoading}
                  className="w-full py-2.5 rounded-xl font-bold text-xs text-red-400 bg-red-500/10 border border-red-500/20 disabled:opacity-50">
                  ✗ Hariç Tut — bu kalemler işlenmesin
                </button>
                <button onClick={() => setFazlaDialog(null)}
                  className="w-full py-2 rounded-xl text-xs text-white/40">Vazgeç (teslimat beklemede kalır)</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kimler görebilir — kişi bazlı panel yetkisi (yönetici) */}
      <AnimatePresence>
        {showYetki && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-5"
            onClick={() => setShowYetki(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl p-5 space-y-3 max-h-[80vh] overflow-y-auto"
              style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.10)' }}>
              <div className="flex items-center justify-between">
                <h2 className="text-white font-bold text-lg">🔒 Kimler Görebilir</h2>
                <button onClick={() => setShowYetki(false)}><X className="w-5 h-5 text-white/40" /></button>
              </div>
              <p className="text-white/40 text-[11px] leading-relaxed">
                Seçtiğin kişiler tedarikçi panelini <b className="text-white/70">kısıtlı</b> görür:
                sipariş verebilir ve teslimat onaylayabilir — <b className="text-red-400">ödeme, bakiye ve fiyat listelerini göremez.</b>
                Sen, üst müdürler ve müdürler her zaman tam yetkilidir.
              </p>
              <div className="space-y-1.5">
                {yetkiUsers.length === 0 && <p className="text-white/30 text-xs text-center py-3">Yükleniyor...</p>}
                {yetkiUsers.map(u => {
                  const secili = yetkiIds.includes(u.id);
                  return (
                    <button key={u.id}
                      onClick={() => setYetkiIds(prev => secili ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left"
                      style={{
                        background: secili ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.04)',
                        border: secili ? '1px solid rgba(167,139,250,0.45)' : '1px solid rgba(255,255,255,0.08)',
                      }}>
                      <span className="w-[18px] h-[18px] rounded-md flex items-center justify-center shrink-0"
                        style={{ background: secili ? '#a78bfa' : 'transparent', border: secili ? 'none' : '1.5px solid rgba(255,255,255,0.3)' }}>
                        {secili && <span className="text-[11px] font-black" style={{ color: '#1a1a2e' }}>✓</span>}
                      </span>
                      <span className="text-white text-sm font-semibold flex-1">{u.ad}</span>
                      <span className="text-white/30 text-[10px]">{u.rol}</span>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={async () => {
                  setYetkiSaving(true);
                  try {
                    const res = await fetch(appendGhostParam(`${SERVER_URL}/tedarikci/yetki`), {
                      method: 'POST', headers: getHeaders(), body: JSON.stringify({ userIds: yetkiIds }),
                    });
                    if (res.ok) setShowYetki(false);
                  } catch {} finally { setYetkiSaving(false); }
                }}
                disabled={yetkiSaving}
                className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)' }}>
                {yetkiSaving ? 'Kaydediliyor...' : 'Yetkileri Kaydet'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tedarikçi Yönetimi Rehber Modalı */}
      <AnimatePresence>
        {showTedGuide && (
          <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-start justify-center pt-6 overflow-y-auto" onClick={() => setShowTedGuide(false)}>
            <motion.div
              initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
              className="w-full max-w-lg bg-[#1a1a2e] border border-white/10 rounded-2xl mb-8 mx-4 overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 bg-[#1a1a2e] border-b border-white/8 px-4 py-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-ta" /> Tedarikçi Yönetimi Rehberi
                </h3>
                <button onClick={() => setShowTedGuide(false)} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>
              <div className="p-4 space-y-4 text-[12px] leading-relaxed text-white/70">

                <div>
                  <h4 className="text-[13px] font-bold text-white mb-1.5">📦 Bu Sayfa Ne İşe Yarar?</h4>
                  <p>Tedarikçilerle olan tüm <span className="text-ta font-semibold">sipariş, teslimat ve ödeme</span> süreçlerini yönetin.</p>
                  <p className="mt-1">• 4 ana sekme: Tedarikçiler · Siparişler · Teslimatlar · Ödemeler</p>
                </div>

                <div className="border-t border-white/8 pt-3">
                  <h4 className="text-[13px] font-bold text-white mb-1.5">👥 Tedarikçiler Sekmesi</h4>
                  <p>Kayıtlı tedarikçilerin listesi ve detayları:</p>
                  <p className="mt-1">• <span className="text-ta font-semibold">Tedarikçi Davet Et</span>: E-posta ile yeni tedarikçi davet edin</p>
                  <p>• Albüm tedarikçileri kartlarında <span className="text-ta font-semibold">Albüm etiketi</span> görünür</p>
                  <p>• <span className="text-emerald-400 font-semibold">Stok Açık</span> rozeti: Tedarikçinin stok kataloğu aktif</p>
                  <p>• Tedarikçiye tıklayarak sipariş geçmişi, fiyat listesi ve bakiye detayını görün</p>
                </div>

                <div className="border-t border-white/8 pt-3">
                  <h4 className="text-[13px] font-bold text-white mb-1.5">🛒 Siparişler Sekmesi</h4>
                  <p>Tüm siparişlerin takibi ve yönetimi:</p>
                  <p className="mt-1">• <span className="text-ta font-semibold">+ Yeni Sipariş</span>: Tedarikçiye sipariş oluşturun</p>
                  <p>• Sipariş durumları:</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5 ml-2">
                    <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold" style={{ background: 'rgba(156,163,175,0.15)', color: '#9ca3af' }}>Taslak</span>
                    <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold" style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>Gönderildi</span>
                    <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}>Onaylandı</span>
                    <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>Kısmen Teslim</span>
                  </div>
                  <p className="mt-1.5">• Sipariş detayında <span className="text-amber-400 font-semibold">karşı teklif</span> oluşturabilirsiniz</p>
                  <p>• Filtreleme: Tümü · Aktif · Teklif · Geçmiş · İptal</p>
                </div>

                <div className="border-t border-white/8 pt-3">
                  <h4 className="text-[13px] font-bold text-white mb-1.5">🚚 Teslimatlar Sekmesi</h4>
                  <p>Siparişlerin teslimat durumlarını takip edin:</p>
                  <p className="mt-1">• Kısmen veya tamamen teslim alınan ürünleri görüntüleyin</p>
                  <p>• Teslimat onayı verin — stok otomatik güncellenir</p>
                  <p>• Eksik teslimatlar <span className="text-amber-400 font-semibold">Kısmen Teslim</span> olarak işaretlenir</p>
                </div>

                <div className="border-t border-white/8 pt-3">
                  <h4 className="text-[13px] font-bold text-white mb-1.5">💰 Ödemeler Sekmesi</h4>
                  <p>Tedarikçilere yapılan ödemelerin takibi:</p>
                  <p className="mt-1">• Sipariş bazlı ödeme kaydı oluşturun</p>
                  <p>• <span className="text-emerald-400 font-semibold">Ödendi</span> / <span className="text-amber-400 font-semibold">Beklemede</span> durumlarını takip edin</p>
                  <p>• Kısmi ödeme desteği — kalan bakiye otomatik hesaplanır</p>
                </div>

                <div className="border-t border-white/8 pt-3">
                  <h4 className="text-[13px] font-bold text-white mb-1.5">📋 Fiyat Listesi</h4>
                  <p>• Her tedarikçi için ürün bazlı <span className="text-ta font-semibold">fiyat listesi</span> tanımlayın</p>
                  <p>• Fiyat listesi sipariş oluştururken otomatik olarak kullanılır</p>
                  <p>• Fiyat güncelleme geçmişi kaydedilir</p>
                </div>

                <div className="border-t border-white/8 pt-3">
                  <h4 className="text-[13px] font-bold text-white mb-1.5">🔄 Sipariş Akışı</h4>
                  <p className="text-white/50">Taslak → Gönderildi → Onaylandı → Kısmen Teslim → Teslim Edildi → Tamamlandı</p>
                  <p className="mt-1">• Her aşamada bildirim gider</p>
                  <p>• Tedarikçi portalından onay/red/teklif yapılabilir</p>
                  <p>• İptal edilen siparişler ayrı filtrede görünür</p>
                </div>

                <div className="border-t border-white/8 pt-3">
                  <h4 className="text-[13px] font-bold text-white mb-1.5">⚡ Önemli Bilgiler</h4>
                  <p>• Tedarikçi <span className="text-ta font-semibold">e-posta ile</span> davet edilir — portal erişimi otomatik açılır</p>
                  <p>• Teslimat onayı sonrası stok miktarları otomatik güncellenir</p>
                  <p>• Ödeme kayıtları <span className="text-ta font-semibold">Kasa</span> ile senkronize çalışır</p>
                  <p>• Tüm işlemler kayıt altına alınır</p>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   OPERASYON GÖRÜNÜMÜ — parasal veri İÇERMEZ (kullanıcı kararı 2026-07-20)
   Rıdvan'ın bildirdiği teslimatları operasyon rolü onaylar/reddeder;
   fiyat, tutar, bakiye, ödeme bilgisi bu ekranda YOKTUR.
   ═══════════════════════════════════════════════════════════════ */
function OperasyonTeslimatView({ userName, accessToken }: { userName: string; accessToken: string }) {
  const [teslimatlar, setTeslimatlar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(appendGhostParam(`${SERVER_URL}/tedarikci/teslimatlar`), { headers: buildHeaders(accessToken) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Veri alınamadı');
      setTeslimatlar((d.teslimatlar || []).sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || '')));
      setErr('');
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }, [accessToken]);
  useEffect(() => { load(); }, [load]);

  const islem = async (id: string, aksiyon: 'onayla' | 'reddet') => {
    if (aksiyon === 'reddet' && !confirm('Bu teslimatı reddetmek istiyor musun?')) return;
    setBusy(id + aksiyon);
    try {
      await fetch(appendGhostParam(`${SERVER_URL}/tedarikci/teslimatlar/${id}/${aksiyon}`), {
        method: 'PUT', headers: buildHeaders(accessToken),
        body: aksiyon === 'reddet' ? JSON.stringify({ reason: 'Operasyon reddetti' }) : undefined,
      });
      load();
    } finally { setBusy(''); }
  };

  const bekleyen = teslimatlar.filter(t => t.status === 'beklemede');
  const gecmis = teslimatlar.filter(t => t.status !== 'beklemede').slice(0, 10);

  const kart = (t: any, aktif: boolean) => (
    <div key={t.id} className="rounded-2xl p-4 space-y-2" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>
      <div className="flex items-center justify-between">
        <p className="text-white font-semibold text-sm">📦 {t.cariName || 'Tedarikçi'}</p>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ color: STATUS_CONFIG[t.status]?.color, background: STATUS_CONFIG[t.status]?.bg }}>{STATUS_CONFIG[t.status]?.label || t.status}</span>
      </div>
      <div className="space-y-1">
        {(t.lines || []).map((l: any, i: number) => (
          <div key={i} className="flex justify-between text-xs">
            <span className="text-white/70">{l.productName}</span>
            <span className="text-white font-bold">× {l.quantity}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-[10px] text-white/30">
        <span>{t.deliveryDate}</span>
        {t.deliveryNote && <span className="truncate ml-2">{t.deliveryNote}</span>}
        {t.reviewedBy && <span>✓ {t.reviewedBy}</span>}
      </div>
      {aktif && (
        <div className="flex gap-2 pt-1">
          <button onClick={() => islem(t.id, 'onayla')} disabled={busy !== ''}
            className="flex-1 py-2.5 rounded-xl text-white text-xs font-bold active:scale-95"
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
            {busy === t.id + 'onayla' ? '...' : '✓ Teslim Alındı — Onayla'}
          </button>
          <button onClick={() => islem(t.id, 'reddet')} disabled={busy !== ''}
            className="px-4 py-2.5 rounded-xl text-red-400 text-xs font-bold active:scale-95"
            style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)' }}>
            Reddet
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen pb-28 px-4 pt-4 space-y-4" style={{ background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%))' }}>
      <div>
        <h1 className="text-2xl font-black text-white">Teslimat Onayı 📦</h1>
        <p className="text-xs text-white/40">{userName} · Tedarikçi teslimatlarını kontrol edip onayla</p>
      </div>
      {err && <div className="px-3 py-2 rounded-lg text-xs text-red-400" style={{ background: 'rgba(248,113,113,0.1)' }}>{err}</div>}
      {loading ? (
        <div className="text-center text-white/40 text-sm py-12">Yükleniyor…</div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-white font-bold text-sm">Bekleyen Teslimatlar</h2>
            <button onClick={load} className="text-white/40 text-xs">↻ Yenile</button>
          </div>
          {bekleyen.length === 0 && <div className="rounded-2xl p-6 text-center text-white/40 text-sm" style={{ background: glassBg, border: `1px solid ${glassBorder}` }}>Bekleyen teslimat yok 👍</div>}
          {bekleyen.map(t => kart(t, true))}
          {gecmis.length > 0 && (<>
            <h2 className="text-white/60 font-bold text-sm pt-2">Son İşlenenler</h2>
            {gecmis.map(t => kart(t, false))}
          </>)}
        </>
      )}
    </div>
  );
}

/* Rol dallandırma: operasyon → parasal-veri-siz teslimat onayı; yonetici/ust-mudur/mudur → tam panel;
   diğerleri (yönetici tarafından kişi bazlı yetki verilenler) → KISITLI panel: sipariş + teslimat var, ödeme/bakiye/fiyat YOK */
export function TedarikciYonetimi(props: TedarikciYonetimiProps) {
  if (props.userRole === 'operasyon') {
    return <OperasyonTeslimatView userName={props.userName} accessToken={props.accessToken} />;
  }
  const tamYetki = ['yonetici', 'ust-mudur', 'mudur'].includes(props.userRole);
  return <TedarikciYonetimiAdmin {...props} kisitli={!tamYetki} />;
}
