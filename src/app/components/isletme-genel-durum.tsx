import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, TrendingUp, TrendingDown, Banknote, Plus, Edit2, Trash2,
  Search, Filter, Download, FileText, Printer, Users, ChevronDown, Check,
  Loader2, Save, X, Sparkles, HelpCircle
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { projectId } from '../lib/supabase-info';
import { getToken, buildHeaders, appendGhostParam } from '../lib/api';

// ─── Types ────────────────────────────────
interface Expense {
  id: string;
  category: string;
  amount: number;
  currency: string;
  description: string;
  date: string;
  created_at: string;
  created_by: string;
  // Personel ödemesine özgü alanlar
  personelId?: string;
  personelAdi?: string;
  personelRol?: string;
  odemeTipi?: 'maas' | 'prim' | 'ikramiye' | 'avans' | 'diger';
  donem?: string; // YYYY-MM
}

interface SalaryDef {
  id: string;
  name: string;
  userId?: string;
  userRole?: string;
  amount: number;
  currency: string;
  frequency: string;
  extraCostPercentage: number;
}

interface MekanKira {
  id: string;
  name: string;
  emoji: string;
  yearlyRent: number;
}

interface RecurringCostItem {
  id: string;
  name: string;
  amount: number;
  currency: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

interface SystemUser {
  id: string;
  ad: string;
  rol: string;
  email: string;
}

type DateFilter = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'last3months' | 'last6months' | 'last1year' | 'custom';

interface Gelir {
  id: string;
  mekanId: string;
  mekanAdi: string;
  amount: number;
  description: string;
  date: string;
  created_at: string;
  created_by: string;
}

interface IsletmeGenelDurumProps {
  userName: string;
  userRole: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  accessToken: string;
  onNavigate: (tab: string) => void;
}

// ─── Constants ────────────────────────────
const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

const categoryLabels = {
  personel: '💼 Personel',
  malzeme: '📦 Malzeme',
  ekipman: '🖨️ Ekipman & Bakım',
  operasyonel: '🏢 Operasyonel',
  ulasim: '🚗 Ulaşım',
  diger: '📋 Diğer',
  kira: '🏠 Mekan Kiraları',
  tedarikci: '📦 Tedarikçiler',
  // Kasa (Yeni) ayna kategorileri
  yakit: '⛽ Yakıt',
  market: '🛒 Market',
  ribon: '🎞️ Ribon',
  fatura: '🧾 Faturalar',
  lojman: '🏘️ Lojman',
  // Kasa P&L-dışı bilgi kategorileri (kasadan ödenen maaş/hakediş/avans vb.)
  maas: '💼 Maaş',
  hakedis: '🏆 Hakediş',
  avans: '💳 Avans',
  duzeltme: '🧮 Düzeltme',
  borc: '⇄ Borç Ödeme',
} as Record<string, string>;

const categoryColors = {
  personel: { bg: 'from-ta/20 to-ta/20', text: 'text-ta', border: 'border-ta/30', progress: 'from-ta to-ta' },
  malzeme: { bg: 'from-blue-500/20 to-blue-600/20', text: 'text-blue-400', border: 'border-blue-500/30', progress: 'from-blue-500 to-blue-600' },
  ekipman: { bg: 'from-green-500/20 to-green-600/20', text: 'text-green-400', border: 'border-green-500/30', progress: 'from-green-500 to-green-600' },
  operasyonel: { bg: 'from-orange-500/20 to-orange-600/20', text: 'text-orange-400', border: 'border-orange-500/30', progress: 'from-orange-500 to-orange-600' },
  ulasim: { bg: 'from-cyan-500/20 to-cyan-600/20', text: 'text-cyan-400', border: 'border-cyan-500/30', progress: 'from-cyan-500 to-cyan-600' },
  diger: { bg: 'from-slate-400/20 to-slate-500/20', text: 'text-slate-300', border: 'border-slate-400/40', progress: 'from-slate-400 to-slate-500' },
  kira: { bg: 'from-yellow-500/20 to-yellow-600/20', text: 'text-yellow-400', border: 'border-yellow-500/30', progress: 'from-yellow-500 to-yellow-600' },
} as Record<string, { bg: string; text: string; border: string; progress: string }>;

const roleAvatars: Record<string, string> = {
  'yonetici': '👨‍💼', 'ust-mudur': '👩‍💼', 'mudur': '🧑‍💼',
  'operasyon': '👨‍🔧', 'personel': '👤', 'idari': '👩‍💻',
};
const roleLabels: Record<string, string> = {
  'yonetici': 'Yönetici', 'ust-mudur': 'Üst Müdür', 'mudur': 'Müdür',
  'operasyon': 'Operasyon', 'personel': 'Personel', 'idari': 'İdari',
};
const roleColors: Record<string, string> = {
  'yonetici': 'bg-ta/20 text-ta border-ta/30',
  'ust-mudur': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'mudur': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  'operasyon': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'personel': 'bg-green-500/20 text-green-300 border-green-500/30',
  'idari': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
};

const odemeTipiLabels: Record<string, string> = {
  maas: '💰 Maaş', prim: '🏆 Hakediş', ikramiye: '🎁 İkramiye', avans: '💳 Avans', diger: '📦 Diğer'
};
const odemeTipiColors: Record<string, string> = {
  maas: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  prim: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  ikramiye: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  avans: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  diger: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
};

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

function formatDonem(donem?: string) {
  if (!donem) return '';
  const [y, m] = donem.split('-');
  return `${MONTHS_TR[parseInt(m) - 1]} ${y}`;
}

// ─── Component ────────────────────────────
export function IsletmeGenelDurum({ userName, userRole, accessToken, onNavigate }: IsletmeGenelDurumProps) {
  const currentRole = userRole || 'personel';
  // İGD SALT RAPOR (2026-07-20): gider/gelir girişi ve düzenleme SADECE Kasa'dan yapılır.
  // Kayıtlar Kasa hareketlerinden (ayna senkron) + otomatik tahakkuklardan (maaş/kira/hakediş/tedarikçi) gelir.
  const canAddExpense = false;
  const canDeleteExpense = false;

  // ─── State ──────────────────────────────
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [showIgdGuide, setShowIgdGuide] = useState(false);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  // Kasadan yapılan P&L-dışı çıkışlar (maaş/hakediş/avans/kira ödemeleri vb.) — listede görünür, hesaba girmez
  const [kasaBilgi, setKasaBilgi] = useState<any[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [salaryDefs, setSalaryDefs] = useState<SalaryDef[]>([]);

  // Otomatik gider kaynakları
  const [mekanKiralar, setMekanKiralar] = useState<MekanKira[]>([]);
  const [recurringCosts, setRecurringCosts] = useState<RecurringCostItem[]>([]);
  const [cariler, setCariler] = useState<any[]>([]);
  const [acikKategori, setAcikKategori] = useState<string | null>(null);
  const [allSalaries, setAllSalaries] = useState<SalaryDef[]>([]);
  const [exchangeRates, setExchangeRates] = useState<{ EUR: number; USD: number; GBP: number }>({ EUR: 35.50, USD: 32.80, GBP: 41.20 });

  // Ciro (satış geliri)
  const [ciroData, setCiroData] = useState<{
    toplamCiro: number; toplamSatisAdet: number; toplamIskonto: number;
    mekanlar: Array<{ id: string; name: string; emoji: string; color: string; ciro: number; satisAdet: number; }>;
  }>({ toplamCiro: 0, toplamSatisAdet: 0, toplamIskonto: 0, mekanlar: [] });
  const [isCiroLoading, setIsCiroLoading] = useState(false);

  const [dateFilter, setDateFilter] = useState<DateFilter>('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [mekanFilter, setMekanFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [displayLimit, setDisplayLimit] = useState(15);
  const [showAllMekanGelir, setShowAllMekanGelir] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [userPickerSearch, setUserPickerSearch] = useState('');
  const userPickerRef = useRef<HTMLDivElement>(null);

  // Gelir state
  const [gelirler, setGelirler] = useState<Gelir[]>([]);
  const [showGelirForm, setShowGelirForm] = useState(false);
  const [editingGelir, setEditingGelir] = useState<Gelir | null>(null);
  const [gelirForm, setGelirForm] = useState({
    mekanId: '',
    mekanAdi: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [isSavingGelir, setIsSavingGelir] = useState(false);
  // Mekan listesi (tüm mekanlar — gelir formu için)
  const [tumMekanlar, setTumMekanlar] = useState<Array<{ id: string; name: string; emoji: string }>>([]);

  const now = new Date();
  const defaultDonem = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [formData, setFormData] = useState({
    category: 'personel' as string,
    amount: '',
    currency: 'TRY',
    description: '',
    date: now.toISOString().split('T')[0],
    personelId: '',
    personelAdi: '',
    personelRol: '',
    odemeTipi: 'maas' as 'maas' | 'prim' | 'ikramiye' | 'avans' | 'diger',
    donem: defaultDonem,
    mekanId: '',
    mekanAdi: '',
    odpiendi: false,
  });

  // ─── Auth ───────────────────────────────
  const getAuthHeaders = async () => {
    const token = await getToken();
    return buildHeaders(token);
  };

  // ─── Fetch ──────────────────────────────
  useEffect(() => { fetchData(); }, []);
  // fetchCiro, dateFilter değişince — fonksiyon tanımlandıktan sonra çağrılır (hoisting safe)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!isLoading) fetchCiro(); }, [dateFilter, customStartDate, customEndDate]);

  useEffect(() => { setDisplayLimit(15); }, [dateFilter, categoryFilter, searchQuery]);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (userPickerRef.current && !userPickerRef.current.contains(e.target as Node)) {
        setShowUserPicker(false);
      }
    };
    if (showUserPicker) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showUserPicker]);

  const fetchData = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const h = await getAuthHeaders();
      const [giderRes, usersRes, maliyetRes, mekanRes, gelirRes] = await Promise.all([
        fetch(appendGhostParam(`${API_BASE}/isletme/giderler`), { headers: h }),
        fetch(appendGhostParam(`${API_BASE}/auth/kullanicilar`), { headers: h }),
        fetch(appendGhostParam(`${API_BASE}/maliyetler`), { headers: h }),
        fetch(appendGhostParam(`${API_BASE}/mekanlar`), { headers: h }),
        fetch(appendGhostParam(`${API_BASE}/isletme/gelirler`), { headers: h }),
      ]);
      if (giderRes.ok) {
        const d = await giderRes.json();
        setExpenses(d.giderler || []);
        setKasaBilgi(d.kasaBilgi || []);
      } else {
        const e = await giderRes.json().catch(() => ({}));
        setApiError(e.error || `HTTP ${giderRes.status}`);
      }
      if (usersRes.ok) {
        const d = await usersRes.json();
        setSystemUsers(d.kullanicilar || []);
      }
      if (maliyetRes.ok) {
        const d = await maliyetRes.json();
        setSalaryDefs(d.salaries || []);
        setAllSalaries(d.salaries || []);
        setRecurringCosts(d.recurring || []);
        setCariler(d.cariler || []);
        if (d.exchangeRates) setExchangeRates(d.exchangeRates);
      }
      if (mekanRes.ok) {
        const d = await mekanRes.json();
        const allMekanlar = (d.mekanlar || []);
        setTumMekanlar(allMekanlar.map((m: any) => ({ id: m.id, name: m.name, emoji: m.emoji || '📍' })));
        setMekanKiralar(
          allMekanlar
            .filter((m: any) => m.yearlyRent && m.yearlyRent > 0)
            .map((m: any) => ({ id: m.id, name: m.name, emoji: m.emoji || '📍', yearlyRent: m.yearlyRent }))
        );
      }
      if (gelirRes.ok) {
        const d = await gelirRes.json();
        setGelirler(d.gelirler || []);
      }
    } catch (err) {
      console.log('isletme fetchData error:', err);
      setApiError('Sunucuya bağlanılamadı.');
    } finally {
      setIsLoading(false);
    }
  };

  // fetchData tamamlandıktan sonra ciro çek
  useEffect(() => { if (!isLoading) fetchCiro(); }, [isLoading]); // eslint-disable-line

  // ─── Tarih Aralığı Hesaplama ─────────────
  const getDateRangeForFilter = () => {
    const todayStr = now.toISOString().split('T')[0];
    const yesterdayD = new Date(now); yesterdayD.setDate(yesterdayD.getDate() - 1);
    const yesterdayStr = yesterdayD.toISOString().split('T')[0];
    const startOfWeekD = new Date(now);
    const dow = startOfWeekD.getDay();
    startOfWeekD.setDate(startOfWeekD.getDate() - (dow === 0 ? 6 : dow - 1));
    const computeDays = (s: string, e: string) =>
      Math.max(1, Math.round((new Date(e).getTime() - new Date(s).getTime()) / 86400000) + 1);

    switch (dateFilter) {
      case 'today':       return { baslangic: todayStr, bitis: todayStr, days: 1 };
      case 'yesterday':   return { baslangic: yesterdayStr, bitis: yesterdayStr, days: 1 };
      case 'week': {
        const s = startOfWeekD.toISOString().split('T')[0];
        return { baslangic: s, bitis: todayStr, days: computeDays(s, todayStr) };
      }
      case 'month': {
        const s = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        return { baslangic: s, bitis: todayStr, days: computeDays(s, todayStr) };
      }
      case 'last3months': {
        const s = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split('T')[0];
        return { baslangic: s, bitis: todayStr, days: computeDays(s, todayStr) };
      }
      case 'last6months': {
        const s = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0];
        return { baslangic: s, bitis: todayStr, days: computeDays(s, todayStr) };
      }
      case 'last1year': {
        const s = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().split('T')[0];
        return { baslangic: s, bitis: todayStr, days: computeDays(s, todayStr) };
      }
      case 'custom':
        if (customStartDate && customEndDate)
          return { baslangic: customStartDate, bitis: customEndDate, days: computeDays(customStartDate, customEndDate) };
        return { baslangic: '', bitis: '', days: 0 };
      default: return { baslangic: '', bitis: '', days: 0 };
    }
  };

  // Sabit giderler: sadece kira (maaş ve düzenli giderler otomatik olarak isletme_gider_'e ekleniyor)
  const computeAutoGider = (days: number): number => {
    if (days <= 0) return 0;
    let total = 0;
    for (const m of mekanKiralar) total += (m.yearlyRent / 365) * days;
    return Math.round(total);
  };

  // ─── Ciro Fetch ─────────────────────────
  const fetchCiro = async (overrideDateFilter?: DateFilter, overrideStart?: string, overrideEnd?: string) => {
    const ef = overrideDateFilter || dateFilter;
    const eStart = overrideStart || customStartDate;
    const eEnd = overrideEnd || customEndDate;

    const todayStr = now.toISOString().split('T')[0];
    const computeDays = (s: string, e: string) =>
      Math.max(1, Math.round((new Date(e).getTime() - new Date(s).getTime()) / 86400000) + 1);
    const getRange = () => {
      const yesterdayD = new Date(now); yesterdayD.setDate(yesterdayD.getDate() - 1);
      const yesterdayStr = yesterdayD.toISOString().split('T')[0];
      const sowD = new Date(now); const d = sowD.getDay();
      sowD.setDate(sowD.getDate() - (d === 0 ? 6 : d - 1));
      switch (ef) {
        case 'today':       return { baslangic: todayStr, bitis: todayStr };
        case 'yesterday':   return { baslangic: yesterdayStr, bitis: yesterdayStr };
        case 'week': {      const s = sowD.toISOString().split('T')[0]; return { baslangic: s, bitis: todayStr }; }
        case 'month': {     const s = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]; return { baslangic: s, bitis: todayStr }; }
        case 'last3months': { const s = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split('T')[0]; return { baslangic: s, bitis: todayStr }; }
        case 'last6months': { const s = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0]; return { baslangic: s, bitis: todayStr }; }
        case 'last1year':   { const s = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().split('T')[0]; return { baslangic: s, bitis: todayStr }; }
        case 'custom':      return eStart && eEnd ? { baslangic: eStart, bitis: eEnd } : { baslangic: '', bitis: '' };
        default:            return { baslangic: '', bitis: '' };
      }
    };

    setIsCiroLoading(true);
    try {
      const h = await getAuthHeaders();
      const { baslangic, bitis } = getRange();
      const url = baslangic && bitis
        ? `${API_BASE}/isletme/ciro?baslangic=${baslangic}&bitis=${bitis}`
        : `${API_BASE}/isletme/ciro`;
      const res = await fetch(url, { headers: h });
      if (res.ok) {
        const d = await res.json();
        setCiroData({ toplamCiro: d.toplamCiro || 0, toplamSatisAdet: d.toplamSatisAdet || 0, toplamIskonto: d.toplamIskonto || 0, mekanlar: d.mekanlar || [] });
      } else {
        console.log('Ciro fetch hatası:', res.status);
      }
    } catch (err) {
      console.log('fetchCiro error:', err);
    } finally {
      setIsCiroLoading(false);
    }
  };

  // ─── CRUD ───────────────────────────────
  const handleSave = async () => {
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      alert('Lütfen geçerli bir tutar girin.');
      return;
    }
    if (formData.category === 'personel' && !formData.personelAdi) {
      alert('Lütfen personel seçin.');
      return;
    }
    setIsSaving(true);
    try {
      const h = await getAuthHeaders();
      const payload: any = {
        category: formData.category?.startsWith('cari:') ? formData.category.slice(5) : formData.category,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        description: formData.description,
        date: formData.date,
        mekanId: formData.mekanId || null,
        mekanAdi: formData.mekanAdi || null,
        odpiendi: formData.odpiendi || false,
      };
      if (formData.category === 'personel') {
        payload.personelId = formData.personelId || null;
        payload.personelAdi = formData.personelAdi;
        payload.personelRol = formData.personelRol || null;
        payload.odemeTipi = formData.odemeTipi;
        payload.donem = formData.donem;
        // description otomatik oluştur
        if (!formData.description) {
          payload.description = `${odemeTipiLabels[formData.odemeTipi].replace(/[^\w\s]/g, '').trim()} — ${formData.personelAdi} (${formatDonem(formData.donem)})`;
        }
      }
      const isEdit = !!editingExpense;
      const url = isEdit ? `${API_BASE}/isletme/giderler/${editingExpense!.id}` : `${API_BASE}/isletme/giderler`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: h,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert(e.error || 'Kayıt başarısız.');
        return;
      }
      const { gider } = await res.json();
      if (isEdit) {
        setExpenses(prev => prev.map(e => e.id === gider.id ? gider : e));
      } else {
        setExpenses(prev => [gider, ...prev]);
      }
      // Ödendi işaretliyse kasaya ödeme kaydı ekle
      if (formData.odpiendi && !isEdit && gider?.id) {
        try {
          const giderId = gider.otomatikKey || gider.id;
          await fetch(appendGhostParam(`${API_BASE}/kasa/sirket/ode`), {
            method: 'POST', headers: await getAuthHeaders(),
            body: JSON.stringify({ giderId, tutar: parseFloat(formData.amount), aciklama: `İGD'den ödendi olarak eklendi` }),
          });
        } catch {}
      }
      cancelEdit();
    } catch (err) {
      console.log('handleSave error:', err);
      alert('Sunucu hatası!');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu gideri silmek istediğinizden emin misiniz?')) return;
    try {
      const h = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/isletme/giderler/${id}`, {
        method: 'DELETE',
        headers: h,
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert(e.error || 'Silinemedi.');
        return;
      }
      setExpenses(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      alert('Sunucu hatası!');
    }
  };

  const startEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      category: expense.category,
      amount: expense.amount.toString(),
      currency: expense.currency || 'TRY',
      description: expense.description || '',
      date: expense.date,
      personelId: expense.personelId || '',
      personelAdi: expense.personelAdi || '',
      personelRol: expense.personelRol || '',
      odemeTipi: (expense.odemeTipi as any) || 'maas',
      donem: expense.donem || defaultDonem,
      mekanId: (expense as any).mekanId || '',
      mekanAdi: (expense as any).mekanAdi || '',
    });
    setShowAddForm(true);
    setShowUserPicker(false);
  };

  const cancelEdit = () => {
    setEditingExpense(null);
    setShowAddForm(false);
    setShowUserPicker(false);
    setUserPickerSearch('');
    setFormData({
      category: 'personel',
      amount: '',
      currency: 'TRY',
      description: '',
      date: now.toISOString().split('T')[0],
      personelId: '',
      personelAdi: '',
      personelRol: '',
      odemeTipi: 'maas',
      donem: defaultDonem,
      mekanId: '',
      mekanAdi: '',
    });
  };

  // ─── Gelir CRUD ────────────────────────────
  const handleSaveGelir = async () => {
    if (!gelirForm.amount || parseFloat(gelirForm.amount) <= 0) {
      alert('Lütfen geçerli bir tutar girin.');
      return;
    }
    setIsSavingGelir(true);
    try {
      const h = await getAuthHeaders();
      const payload = {
        mekanId: gelirForm.mekanId,
        mekanAdi: gelirForm.mekanAdi,
        amount: parseFloat(gelirForm.amount),
        description: gelirForm.description,
        date: gelirForm.date,
      };
      const isEdit = !!editingGelir;
      const url = isEdit ? `${API_BASE}/isletme/gelirler/${editingGelir!.id}` : `${API_BASE}/isletme/gelirler`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: h,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert(e.error || 'Kayıt başarısız.');
        return;
      }
      const { gelir } = await res.json();
      if (isEdit) {
        setGelirler(prev => prev.map(g => g.id === gelir.id ? gelir : g));
      } else {
        setGelirler(prev => [gelir, ...prev]);
      }
      cancelGelirEdit();
    } catch (err) {
      console.log('handleSaveGelir error:', err);
      alert('Sunucu hatası!');
    } finally {
      setIsSavingGelir(false);
    }
  };

  const handleDeleteGelir = async (id: string) => {
    if (!confirm('Bu gelir kaydını silmek istediğinizden emin misiniz?')) return;
    try {
      const h = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/isletme/gelirler/${id}`, { method: 'DELETE', headers: h });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert(e.error || 'Silinemedi.');
        return;
      }
      setGelirler(prev => prev.filter(g => g.id !== id));
    } catch (err) {
      alert('Sunucu hatası!');
    }
  };

  const startGelirEdit = (gelir: Gelir) => {
    setEditingGelir(gelir);
    setGelirForm({
      mekanId: gelir.mekanId || '',
      mekanAdi: gelir.mekanAdi || '',
      amount: gelir.amount.toString(),
      description: gelir.description || '',
      date: gelir.date,
    });
    setShowGelirForm(true);
  };

  const cancelGelirEdit = () => {
    setEditingGelir(null);
    setShowGelirForm(false);
    setGelirForm({
      mekanId: '',
      mekanAdi: '',
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
    });
  };

  // Maaş tanımından hızlı yükleme
  const loadFromSalaryDef = (def: SalaryDef) => {
    setFormData(prev => ({
      ...prev,
      amount: def.amount.toString(),
      currency: def.currency || 'TRY',
      odemeTipi: 'maas',
    }));
  };

  // Personel seçince maaş tanımı varsa otomatik doldur
  const selectPersonel = (user: SystemUser) => {
    const def = salaryDefs.find(s => s.userId === user.id);
    setFormData(prev => ({
      ...prev,
      personelId: user.id,
      personelAdi: user.ad,
      personelRol: user.rol,
      // Maaş seçiliyse ve tanım varsa otomatik yükle
      ...(prev.odemeTipi === 'maas' && def ? {
        amount: def.amount.toString(),
        currency: def.currency || 'TRY',
      } : {}),
    }));
    setShowUserPicker(false);
    setUserPickerSearch('');
  };

  // ─── Filters ────────────────────────────
  const getFilteredExpenses = (list: Expense[] = expenses) => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const startOfWeek = new Date(today);
    const dow = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - (dow === 0 ? 6 : dow - 1));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOf3M = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const startOf6M = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const startOf1Y = new Date(now.getFullYear() - 1, now.getMonth(), 1);

    return list.filter(exp => {
      const d = new Date(exp.date);
      let dateMatch = true;
      switch (dateFilter) {
        case 'today': dateMatch = d >= today; break;
        case 'yesterday': dateMatch = d >= yesterday && d < today; break;
        case 'week': dateMatch = d >= startOfWeek; break;
        case 'month': dateMatch = d >= startOfMonth; break;
        case 'last3months': dateMatch = d >= startOf3M; break;
        case 'last6months': dateMatch = d >= startOf6M; break;
        case 'last1year': dateMatch = d >= startOf1Y; break;
        case 'custom':
          if (customStartDate && customEndDate) {
            dateMatch = d >= new Date(customStartDate) && d <= new Date(customEndDate);
          } else { dateMatch = false; }
          break;
        default: dateMatch = true;
      }

      let roleCatMatch = true;
      if (currentRole === 'operasyon') roleCatMatch = exp.category === 'ekipman' || exp.category === 'ulasim';
      else if (currentRole === 'personel' || currentRole === 'mudur') roleCatMatch = exp.category !== 'operasyonel' && exp.category !== 'personel';

      const catMatch = categoryFilter === 'all' || exp.category === categoryFilter;
      const mekanMatch = mekanFilter === 'all' || ((exp as any).mekanId || '') === mekanFilter || (mekanFilter === 'genel' && !(exp as any).mekanId);
      const q = searchQuery.toLowerCase().trim();
      const searchMatch = !q || exp.description?.toLowerCase().includes(q) || exp.personelAdi?.toLowerCase().includes(q) || (categoryLabels[exp.category] || exp.category).toLowerCase().includes(q);
      return dateMatch && roleCatMatch && catMatch && mekanMatch && searchMatch;
    });
  };

  const filteredExpenses = getFilteredExpenses();
  // Bilgi kayıtları aynı tarih/kategori/arama filtresinden geçer ama HİÇBİR toplama katılmaz
  const bilgiKayitlari = getFilteredExpenses(kasaBilgi as any);
  // Görünen liste: P&L kayıtları + kasa bilgi kayıtları (rozetli) — tarihe göre karışık sıralı
  const listeKayitlari: any[] = [...filteredExpenses, ...bilgiKayitlari]
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  // Döviz → TL çevirme
  const toTL = (amount: number, currency?: string) => {
    if (!currency || currency === 'TRY') return amount;
    if (currency === 'EUR') return amount * (exchangeRates.EUR || 35.50);
    if (currency === 'USD') return amount * (exchangeRates.USD || 32.80);
    if (currency === 'GBP') return amount * (exchangeRates.GBP || 41.20);
    return amount;
  };
  // Sabit giderler: otomatik kayıtlar + elle eklenen maaşlar + operasyonel giderler
  const isSabitGider = (e: any) => e.otomatik || (e.category === 'personel' && e.odemeTipi === 'maas') || e.category === 'operasyonel';
  const sabitGiderler = filteredExpenses.filter(isSabitGider);
  const manuelGiderler = filteredExpenses.filter((e: any) => !isSabitGider(e));
  const manualGiderToplam = manuelGiderler.reduce((s, e) => s + toTL(e.amount, e.currency), 0);
  const otomatikGiderToplam = sabitGiderler.reduce((s, e) => s + toTL(e.amount, e.currency), 0);
  const { days: filterDays } = getDateRangeForFilter();
  const kiraGiderToplam = dateFilter !== 'all' ? computeAutoGider(filterDays) : 0;
  const autoGiderToplam = kiraGiderToplam + otomatikGiderToplam;
  const totalExpenses = manualGiderToplam + autoGiderToplam;
  // Gelir kayıtlarını tarih + mekan filtresine göre filtrele
  const filteredGelirler = gelirler.filter(g => {
    const d = new Date(g.date);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const startOfWeek = new Date(today); const dow2 = startOfWeek.getDay(); startOfWeek.setDate(startOfWeek.getDate() - (dow2 === 0 ? 6 : dow2 - 1));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    let dateMatch = true;
    switch (dateFilter) {
      case 'today': dateMatch = d >= today; break;
      case 'yesterday': dateMatch = d >= yesterday && d < today; break;
      case 'week': dateMatch = d >= startOfWeek; break;
      case 'month': dateMatch = d >= startOfMonth; break;
      case 'last3months': dateMatch = d >= new Date(now.getFullYear(), now.getMonth() - 2, 1); break;
      case 'last6months': dateMatch = d >= new Date(now.getFullYear(), now.getMonth() - 5, 1); break;
      case 'last1year': dateMatch = d >= new Date(now.getFullYear() - 1, now.getMonth(), 1); break;
      case 'custom': dateMatch = customStartDate && customEndDate ? d >= new Date(customStartDate) && d <= new Date(customEndDate) : false; break;
      default: dateMatch = true;
    }
    const mekanMatch = mekanFilter === 'all' || (g.mekanId || '') === mekanFilter || (mekanFilter === 'genel' && !g.mekanId);
    return dateMatch && mekanMatch;
  });
  const ekGelirToplam = filteredGelirler.reduce((s, g) => s + g.amount, 0);
  const totalRevenue = ciroData.toplamCiro + ekGelirToplam;
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const standardCats = Object.keys(categoryLabels);
  const categorySummaryBase = standardCats
    .filter(cat => cat !== 'kira') // kira ayrı hesaplanıyor
    .map(cat => {
      const items = filteredExpenses.filter(e => e.category === cat);
      const total = items.reduce((s, e) => s + toTL(e.amount, e.currency), 0);
      return { category: cat, total, count: items.length, percentage: 0 };
    }).filter(i => i.total > 0);
  // Kira ekle — İGD'deki kira düzeltmelerini de dahil et
  const kiraDuzeltmeleri = filteredExpenses.filter(e => e.category === 'kira').reduce((s, e) => s + e.amount, 0);
  const netKira = Math.max(0, kiraGiderToplam + kiraDuzeltmeleri);
  if (netKira > 0) {
    categorySummaryBase.push({ category: 'kira', total: netKira, count: mekanKiralar.length, percentage: 0 });
  }
  // Cari kategorileri ekle (standart kategorilerde olmayan her şey)
  const allCats = new Set(filteredExpenses.map(e => e.category));
  for (const cat of allCats) {
    if (standardCats.includes(cat) || cat === 'kira' || cat === 'duzeltme') continue;
    const items = filteredExpenses.filter(e => e.category === cat);
    const total = items.reduce((s, e) => s + toTL(e.amount, e.currency), 0);
    if (total > 0) categorySummaryBase.push({ category: cat, total, count: items.length, percentage: 0 });
  }
  // Yüzdeleri hesapla ve sırala
  const categorySummary = categorySummaryBase
    .map(i => ({ ...i, percentage: totalExpenses > 0 ? (i.total / totalExpenses) * 100 : 0 }))
    .sort((a, b) => b.total - a.total);

  // ─── Export ─────────────────────────────
  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text('Gider Raporu', 14, 20);
    doc.setFontSize(12);
    doc.text(`Toplam Gider: ${totalExpenses.toLocaleString('tr-TR')} TL`, 14, 30);
    if (categorySummary.length > 0) {
      autoTable(doc, {
        head: [['Kategori', 'Toplam', 'Yüzde', 'Kayıt']],
        body: categorySummary.map(i => [
          (categoryLabels[i.category] || i.category).replace(/[^\x00-\x7F]/g, ''),
          `${i.total.toLocaleString('tr-TR')} TL`,
          `${i.percentage.toFixed(1)}%`,
          i.count,
        ]),
        startY: 40,
      });
    }
    doc.addPage();
    autoTable(doc, {
      head: [['Tarih', 'Kategori', 'Personel', 'Tip', 'Tutar', 'Açıklama']],
      body: filteredExpenses.slice(0, 100).map(e => [
        new Date(e.date).toLocaleDateString('tr-TR'),
        (categoryLabels[e.category] || e.category).replace(/[^\x00-\x7F]/g, ''),
        e.personelAdi || '-',
        e.odemeTipi ? odemeTipiLabels[e.odemeTipi].replace(/[^\x00-\x7F]/g, '').trim() : '-',
        `${e.amount.toLocaleString('tr-TR')} ${e.currency || 'TRY'}`,
        e.description || '',
      ]),
      startY: 20,
    });
    doc.save('gider_raporu.pdf');
  };

  const exportToCSV = () => {
    const rows = [
      'Tarih,Kategori,Personel,Rol,Ödeme Tipi,Dönem,Tutar,Para Birimi,Ekleyen,Açıklama',
      ...filteredExpenses.map(e => [
        e.date,
        (categoryLabels[e.category] || e.category).replace(/[^\x00-\x7F]/g, ''),
        e.personelAdi || '',
        e.personelRol || '',
        e.odemeTipi || '',
        e.donem || '',
        e.amount,
        e.currency || 'TRY',
        e.created_by,
        e.description || '',
      ].join(','))
    ].join('\n');
    const link = document.createElement('a');
    link.href = 'data:text/csv;charset=utf-8,' + encodeURI(rows);
    link.download = 'giderler.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─── Derived helpers ────────────────────
  const selectedPersonelSalaryDef = formData.personelId
    ? salaryDefs.find(s => s.userId === formData.personelId)
    : null;
  const filteredSystemUsers = userPickerSearch
    ? systemUsers.filter(u => u.ad.toLowerCase().includes(userPickerSearch.toLowerCase()) || u.email.toLowerCase().includes(userPickerSearch.toLowerCase()))
    : systemUsers;

  // ─── Render ─────────────────────────────
  return (
    <div className="pb-24 min-h-screen" style={{ background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%))' }}>
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-black text-white">İşletme Genel Durum</h1>
              <span className="text-2xl">💼</span>
            </div>
            <p className="text-sm text-gray-400">Finansal Genel Bakış — Gelir, gider ve ödeme takibi</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowIgdGuide(true)}
              className="w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-all"
              style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', boxShadow: '0 0 8px rgba(251,191,36,0.2)' }}
            >
              <HelpCircle className="w-4 h-4 text-amber-400" />
            </button>
            <button onClick={fetchData} disabled={isLoading} className="p-2 bg-white/10 border border-white/20 rounded-xl text-white hover:bg-white/20 transition-all">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="text-sm">↻</span>}
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#9dd9ea]" />
        </div>
      ) : apiError ? (
        <div className="mx-5 p-6 bg-red-500/10 border border-red-500/30 rounded-2xl text-center">
          <p className="text-red-300 mb-3">{apiError}</p>
          <button onClick={fetchData} className="px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm">Tekrar Dene</button>
        </div>
      ) : (
        <div className="px-5 space-y-4">

          {/* ── Özet Kartlar ── */}
          {currentRole !== 'operasyon' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {/* Toplam Gelir */}
                {currentRole !== 'mudur' && (
                  <div className="backdrop-blur-xl bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Banknote className="w-4 h-4 text-green-400" />
                      <span className="text-xs text-gray-300">Toplam Gelir</span>
                      {isCiroLoading && <Loader2 className="w-3 h-3 animate-spin text-green-400 ml-auto" />}
                    </div>
                    <div className="text-xl font-bold text-white">₺{totalRevenue.toLocaleString('tr-TR')}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {ciroData.toplamSatisAdet} satış
                      {ekGelirToplam > 0 && <span className="text-green-400/60"> + ₺{ekGelirToplam.toLocaleString('tr-TR')} ek gelir</span>}
                    </div>
                    {ciroData.mekanlar.length > 0 && (() => {
                      // Mekan bazlı ek gelirleri hesapla
                      const mekanEkGelir: Record<string, number> = {};
                      for (const g of filteredGelirler) {
                        if (g.mekanId) mekanEkGelir[g.mekanId] = (mekanEkGelir[g.mekanId] || 0) + g.amount;
                      }
                      // Ciro + ek gelir birleşimi
                      const mekanGelirList = ciroData.mekanlar.map(m => ({
                        ...m,
                        toplamGelir: m.ciro + (mekanEkGelir[m.id] || 0),
                        ekGelir: mekanEkGelir[m.id] || 0,
                      })).filter(m => m.toplamGelir > 0 && m.name && !m.name.match(/^\d{5,}/)).sort((a, b) => b.toplamGelir - a.toplamGelir);
                      return (
                        <div className="mt-2 space-y-1">
                          {mekanGelirList.slice(0, 3).map(m => (
                            <div key={m.id} className="flex items-center justify-between">
                              <span className="text-xs text-gray-400 truncate">{m.emoji} {m.name}</span>
                              <span className="text-xs font-semibold text-green-300 shrink-0 ml-1">₺{Math.round(m.toplamGelir).toLocaleString('tr-TR')}</span>
                            </div>
                          ))}
                          {mekanGelirList.length > 3 && !showAllMekanGelir && (
                            <button onClick={() => setShowAllMekanGelir(true)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                              +{mekanGelirList.length - 3} mekan daha
                            </button>
                          )}
                          {showAllMekanGelir && mekanGelirList.slice(3).map(m => (
                            <div key={m.id} className="flex items-center justify-between">
                              <span className="text-xs text-gray-400 truncate">{m.emoji} {m.name}</span>
                              <span className="text-xs font-semibold text-green-300 shrink-0 ml-1">₺{Math.round(m.toplamGelir).toLocaleString('tr-TR')}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Toplam Gider */}
                <div className="backdrop-blur-xl bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="w-4 h-4 text-red-400" />
                    <span className="text-xs text-gray-300">Toplam Gider</span>
                  </div>
                  <div className="text-xl font-bold text-white">₺{totalExpenses.toLocaleString('tr-TR')}</div>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">📋 Manuel kayıtlar</span>
                      <span className="text-xs font-semibold text-red-300">₺{manualGiderToplam.toLocaleString('tr-TR')}</span>
                    </div>
                    {autoGiderToplam > 0 && (
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">⚙️ Sabit giderler</span>
                          <span className="text-xs font-semibold text-orange-300">₺{autoGiderToplam.toLocaleString('tr-TR')}</span>
                        </div>
                        <div className="text-[9px] text-gray-500 ml-5">Maaş & Kira & Operasyonel</div>
                      </div>
                    )}
                    {dateFilter === 'all' && (
                      <div className="text-xs text-gray-600 italic">Sabit giderler: tarih seçin</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Net Kar / Kar Marjı */}
              {currentRole !== 'mudur' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className={`backdrop-blur-xl bg-gradient-to-br border rounded-2xl p-4 ${netProfit >= 0 ? 'from-blue-500/20 to-blue-600/20 border-blue-500/30' : 'from-orange-500/20 to-orange-600/20 border-orange-500/30'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className={`w-4 h-4 ${netProfit >= 0 ? 'text-blue-400' : 'text-orange-400'}`} />
                      <span className="text-xs text-gray-300">Net Kar/Zarar</span>
                    </div>
                    <div className={`text-xl font-bold ${netProfit >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                      {netProfit >= 0 ? '+' : ''}₺{netProfit.toLocaleString('tr-TR')}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Gelir - Gider</div>
                  </div>
                  <div className="backdrop-blur-xl bg-gradient-to-br from-ta/20 to-ta/20 border border-ta/30 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-ta" />
                      <span className="text-xs text-gray-300">Kar Marjı</span>
                    </div>
                    <div className="text-xl font-bold text-white">{profitMargin.toFixed(1)}%</div>
                    <div className="text-xs text-gray-500 mt-1">{profitMargin >= 0 ? 'Pozitif' : 'Negatif'}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tarih Filtreleri ── */}
          <div className="grid grid-cols-4 gap-2">
            {([
              { key: 'today', label: '📅 Bugün' },
              { key: 'yesterday', label: 'Dün' },
              { key: 'week', label: 'Bu Hafta' },
              { key: 'month', label: 'Bu Ay' },
            ] as const).map(f => (
              <button key={f.key} onClick={() => setDateFilter(f.key)}
                className={`px-2 py-2.5 rounded-xl font-semibold text-xs transition-all ${dateFilter === f.key ? 'bg-[#9dd9ea]/20 text-[#9dd9ea] border border-[#9dd9ea]/30' : 'bg-white/5 text-gray-400 border border-white/10'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-5 gap-2">
            {([
              { key: 'last3months', label: 'Son 3 Ay' },
              { key: 'last6months', label: 'Son 6 Ay' },
              { key: 'last1year', label: 'Son 1 Yıl' },
              { key: 'all', label: '📊 Tümü' },
              { key: 'custom', label: '📆 Özel' },
            ] as const).map(f => (
              <button key={f.key} onClick={() => setDateFilter(f.key)}
                className={`px-2 py-2.5 rounded-xl font-semibold text-xs transition-all ${dateFilter === f.key ? 'bg-[#9dd9ea]/20 text-[#9dd9ea] border border-[#9dd9ea]/30' : 'bg-white/5 text-gray-400 border border-white/10'}`}>
                {f.label}
              </button>
            ))}
          </div>
          {dateFilter === 'custom' && (
            <div className="backdrop-blur-xl bg-white/5 border border-white/15 rounded-2xl p-4">
              <h4 className="text-sm font-semibold text-[#9dd9ea] mb-3">📆 Tarih Aralığı</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Başlangıç</label>
                  <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#9dd9ea]" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Bitiş</label>
                  <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#9dd9ea]" />
                </div>
              </div>
            </div>
          )}

          {/* Ayırıcı */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />

          {/* ── Mekan Filtresi ── */}
          {tumMekanlar.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setMekanFilter('all')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  mekanFilter === 'all' ? 'bg-[#9dd9ea]/20 text-[#9dd9ea] border border-[#9dd9ea]/30' : 'bg-white/5 text-gray-400 border border-white/10'
                }`}
              >
                Tümü
              </button>
              <button
                onClick={() => setMekanFilter('genel')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  mekanFilter === 'genel' ? 'bg-[#9dd9ea]/20 text-[#9dd9ea] border border-[#9dd9ea]/30' : 'bg-white/5 text-gray-400 border border-white/10'
                }`}
              >
                🏢 Genel
              </button>
              {tumMekanlar.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMekanFilter(m.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    mekanFilter === m.id ? 'bg-[#9dd9ea]/20 text-[#9dd9ea] border border-[#9dd9ea]/30' : 'bg-white/5 text-gray-400 border border-white/10'
                  }`}
                >
                  {m.emoji} {m.name}
                </button>
              ))}
            </div>
          )}

          {/* ── Salt rapor — giriş Kasa'dan ── */}
          {['yonetici', 'ust-mudur'].includes(currentRole) && (
            <button
              onClick={() => onNavigate('kasa-yeni')}
              className="w-full py-3 px-4 rounded-2xl flex items-center justify-center gap-2 font-semibold text-sm bg-white/5 border border-white/15 text-gray-300 hover:bg-white/10 transition-all active:scale-[0.98]"
            >
              💰 Gider ve gelir girişi artık Kasa'dan yapılır — Kasa'yı aç
            </button>
          )}

          {/* ── Yeni Gelir / Gider Butonları ── */}
          {canAddExpense && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setShowGelirForm(!showGelirForm); if (showGelirForm) cancelGelirEdit(); if (showAddForm) { setShowAddForm(false); cancelEdit(); } }}
                className={`py-3 px-4 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all active:scale-95 shadow-lg ${
                  showGelirForm
                    ? 'bg-white/10 border border-white/20 text-gray-300'
                    : 'bg-gradient-to-r from-green-500 to-green-600 text-white'
                }`}
              >
                {showGelirForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {showGelirForm ? 'Kapat' : 'Gelir Ekle'}
              </button>
              <button
                onClick={() => { setShowAddForm(!showAddForm); if (showAddForm) cancelEdit(); if (showGelirForm) { setShowGelirForm(false); cancelGelirEdit(); } }}
                className={`py-3 px-4 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all active:scale-95 shadow-lg ${
                  showAddForm
                    ? 'bg-white/10 border border-white/20 text-gray-300'
                    : 'bg-gradient-to-r from-[#9dd9ea] to-[#7ec8dd] text-[#0a051e]'
                }`}
              >
                {showAddForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {showAddForm ? 'Kapat' : 'Gider Ekle'}
              </button>
            </div>
          )}

          {/* ══════════════════════════════════
              GELİR EKLEME / DÜZENLEME FORMU
          ══════════════════════════════════ */}
          {showGelirForm && (
            <div className="backdrop-blur-2xl bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-green-500/20">
                <div className="w-9 h-9 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                  {editingGelir ? <Edit2 className="w-4 h-4 text-green-400" /> : <Plus className="w-4 h-4 text-green-400" />}
                </div>
                <h3 className="font-bold text-white">{editingGelir ? 'Gelir Düzenle' : 'Yeni Gelir'}</h3>
              </div>

              {/* Mekan Seçimi */}
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 block">Mekan</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setGelirForm(prev => ({ ...prev, mekanId: '', mekanAdi: '' }))}
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition-all ${
                      !gelirForm.mekanId ? 'bg-green-500/20 border border-green-500/30 text-green-300' : 'bg-white/5 border border-white/10 text-gray-400'
                    }`}
                  >
                    🏢 Genel (Mekansız)
                  </button>
                  {tumMekanlar.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setGelirForm(prev => ({ ...prev, mekanId: m.id, mekanAdi: m.name }))}
                      className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition-all ${
                        gelirForm.mekanId === m.id ? 'bg-green-500/20 border border-green-500/30 text-green-300' : 'bg-white/5 border border-white/10 text-gray-400'
                      }`}
                    >
                      {m.emoji} {m.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tutar */}
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 block">Tutar (₺)</label>
                <input
                  type="number"
                  value={gelirForm.amount}
                  onChange={e => setGelirForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-lg font-bold focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400/30"
                />
              </div>

              {/* Tarih */}
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 block">Tarih</label>
                <input
                  type="date"
                  value={gelirForm.date}
                  onChange={e => setGelirForm(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-400"
                />
              </div>

              {/* Açıklama */}
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 block">Açıklama</label>
                <input
                  type="text"
                  value={gelirForm.description}
                  onChange={e => setGelirForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Opsiyonel açıklama"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-green-400"
                />
              </div>

              {/* Kaydet/İptal */}
              <div className="flex gap-3 pt-2">
                <button onClick={cancelGelirEdit} className="flex-1 py-3 px-4 bg-white/10 border border-white/20 rounded-xl text-gray-400 font-semibold">
                  İptal
                </button>
                <button
                  onClick={handleSaveGelir}
                  disabled={isSavingGelir}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSavingGelir ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editingGelir ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════
              GIDER EKLEME / DÜZENLEME FORMU
          ══════════════════════════════════ */}
          {showAddForm && (
            <div className="backdrop-blur-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5 space-y-4">
              {/* Form başlığı */}
              <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                <div className="w-9 h-9 rounded-xl bg-[#9dd9ea]/20 border border-[#9dd9ea]/30 flex items-center justify-center">
                  {editingExpense ? <Edit2 className="w-4 h-4 text-[#9dd9ea]" /> : <Plus className="w-4 h-4 text-[#9dd9ea]" />}
                </div>
                <h3 className="font-bold text-white">{editingExpense ? 'Gider Düzenle' : 'Yeni Gider'}</h3>
              </div>

              {/* ── Kategori Seçimi ── */}
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 block">Kategori</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(categoryLabels) as [string, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setFormData(prev => ({ ...prev, category: key }))}
                      className={`py-2.5 px-2 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                        formData.category === key
                          ? `bg-gradient-to-br ${(categoryColors[key] || categoryColors.diger).bg} border ${(categoryColors[key] || categoryColors.diger).border} ${(categoryColors[key] || categoryColors.diger).text}`
                          : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  {/* Cariler kategorisi butonu */}
                  {cariler.length > 0 && (
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, category: prev.category?.startsWith('cari:') ? '' : 'cari:' }))}
                      className={`py-2.5 px-2 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                        formData.category?.startsWith('cari:')
                          ? 'bg-gradient-to-br from-ta/20 to-ta/20 border border-ta/30 text-ta'
                          : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      🏢 Cariler
                    </button>
                  )}
                </div>
                {/* Cari seçici — Cariler kategorisi seçiliyse göster */}
                {formData.category?.startsWith('cari:') && cariler.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {cariler.map((cari) => {
                      const cariKey = `cari:${cari.name}`;
                      return (
                        <button
                          key={`cari-${cari.id}`}
                          onClick={() => setFormData(prev => ({ ...prev, category: cariKey }))}
                          className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition-all active:scale-95 text-left ${
                            formData.category === cariKey
                              ? 'bg-gradient-to-br from-ta/20 to-ta/20 border border-ta/30 text-ta'
                              : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                          }`}
                        >
                          {cari.emoji || '🏢'} {cari.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Mekan Seçimi (opsiyonel) ── */}
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 block">Mekan (opsiyonel)</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, mekanId: '', mekanAdi: '' }))}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                      !formData.mekanId ? 'bg-[#9dd9ea]/20 border border-[#9dd9ea]/30 text-[#9dd9ea]' : 'bg-white/5 border border-white/10 text-gray-400'
                    }`}
                  >
                    🏢 Genel
                  </button>
                  {tumMekanlar.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setFormData(prev => ({ ...prev, mekanId: m.id, mekanAdi: m.name }))}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                        formData.mekanId === m.id ? 'bg-[#9dd9ea]/20 border border-[#9dd9ea]/30 text-[#9dd9ea]' : 'bg-white/5 border border-white/10 text-gray-400'
                      }`}
                    >
                      {m.emoji} {m.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* ══ PERSONEL ÖZEL FORMU ══ */}
              {formData.category === 'personel' && (
                <div className="space-y-4 p-4 bg-ta/10 border border-ta/20 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-ta" />
                    <span className="text-sm font-bold text-ta">Personel Ödeme Detayı</span>
                  </div>

                  {/* Personel Seçici */}
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block">Personel</label>
                    <div className="relative" ref={userPickerRef}>
                      <button
                        type="button"
                        onClick={() => setShowUserPicker(p => !p)}
                        className={`w-full px-4 py-3 bg-white/10 border rounded-xl text-left flex items-center justify-between transition-all ${showUserPicker ? 'border-ta ring-1 ring-ta/30' : 'border-white/20 hover:border-white/40'}`}
                      >
                        {formData.personelAdi ? (
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{roleAvatars[formData.personelRol] || '👤'}</span>
                            <div>
                              <div className="text-white font-semibold text-sm">{formData.personelAdi}</div>
                              {formData.personelRol && <div className="text-xs text-gray-400">{roleLabels[formData.personelRol] || formData.personelRol}</div>}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">Personel seçin...</span>
                        )}
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showUserPicker ? 'rotate-180' : ''}`} />
                      </button>

                      {showUserPicker && (
                        <div className="absolute top-full left-0 right-0 mt-2 backdrop-blur-2xl bg-black/90 border border-white/20 rounded-2xl shadow-2xl z-50 overflow-hidden">
                          <div className="p-3 border-b border-white/10">
                            <input
                              autoFocus
                              type="text"
                              placeholder="İsim ara..."
                              value={userPickerSearch}
                              onChange={e => setUserPickerSearch(e.target.value)}
                              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-ta"
                            />
                          </div>
                          <div className="max-h-56 overflow-y-auto py-2">
                            {filteredSystemUsers.length === 0 ? (
                              <div className="px-4 py-5 text-center text-gray-400 text-sm">Personel bulunamadı</div>
                            ) : filteredSystemUsers.map(user => {
                              const isSelected = formData.personelId === user.id;
                              const hasSalaryDef = salaryDefs.some(s => s.userId === user.id);
                              return (
                                <button
                                  key={user.id}
                                  type="button"
                                  onClick={() => selectPersonel(user)}
                                  className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-white/10 transition-all text-left ${isSelected ? 'bg-ta/10' : ''}`}
                                >
                                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 ${isSelected ? 'bg-ta/20 border border-ta/40' : 'bg-white/10 border border-white/15'}`}>
                                    {roleAvatars[user.rol] || '👤'}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-white text-sm font-semibold truncate">{user.ad}</span>
                                      {hasSalaryDef && <span className="text-xs px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full shrink-0">Maaş tanımlı</span>}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className={`text-xs px-1.5 py-0.5 rounded-full border ${roleColors[user.rol] || 'bg-white/10 text-gray-400 border-white/20'}`}>
                                        {roleLabels[user.rol] || user.rol}
                                      </span>
                                      <span className="text-xs text-gray-500 truncate">{user.email}</span>
                                    </div>
                                  </div>
                                  {isSelected && <Check className="w-4 h-4 text-ta shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Maaş Tanımı Kartı — otomatik yükleme */}
                  {selectedPersonelSalaryDef && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-emerald-400 font-semibold mb-0.5 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Maaş Yönetimi'nden Tanımlı
                          </div>
                          <div className="text-white text-sm font-bold">
                            {selectedPersonelSalaryDef.amount.toLocaleString('tr-TR')} {selectedPersonelSalaryDef.currency}
                            <span className="text-gray-400 font-normal text-xs ml-1">
                              / {selectedPersonelSalaryDef.frequency === 'monthly' ? 'ay' : selectedPersonelSalaryDef.frequency === 'daily' ? 'gün' : selectedPersonelSalaryDef.frequency === 'weekly' ? 'hafta' : 'yıl'}
                            </span>
                          </div>
                          {selectedPersonelSalaryDef.extraCostPercentage > 0 && (
                            <div className="text-xs text-gray-400">+%{selectedPersonelSalaryDef.extraCostPercentage} ek gider dahil</div>
                          )}
                        </div>
                        <button
                          onClick={() => loadFromSalaryDef(selectedPersonelSalaryDef)}
                          className="px-3 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-semibold hover:bg-emerald-500/30 transition-all active:scale-95"
                        >
                          Yükle
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Ödeme Tipi */}
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block">Ödeme Tipi</label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {(['maas', 'prim', 'ikramiye', 'avans', 'diger'] as const).map(tip => (
                        <button
                          key={tip}
                          onClick={() => {
                            setFormData(prev => ({ ...prev, odemeTipi: tip }));
                            // Maaş seçilince ve personel seçiliyse tanımdan otomatik yükle
                            if (tip === 'maas' && formData.personelId) {
                              const def = salaryDefs.find(s => s.userId === formData.personelId);
                              if (def) loadFromSalaryDef(def);
                            }
                          }}
                          className={`py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                            formData.odemeTipi === tip
                              ? `${odemeTipiColors[tip]} border`
                              : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                          }`}
                        >
                          {odemeTipiLabels[tip].split(' ')[0]}<br />
                          <span className="text-xs">{odemeTipiLabels[tip].split(' ').slice(1).join(' ')}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dönem */}
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block">Dönem (Ay/Yıl)</label>
                    <input
                      type="month"
                      value={formData.donem}
                      onChange={e => setFormData(prev => ({ ...prev, donem: e.target.value }))}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:border-ta transition-all"
                    />
                    {formData.donem && (
                      <p className="text-xs text-ta mt-1">📅 {formatDonem(formData.donem)}</p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Tutar + Para Birimi ── */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 mb-1.5 block">Tutar</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={e => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9dd9ea] transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Para Birimi</label>
                  <select
                    value={formData.currency}
                    onChange={e => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full px-3 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-[#9dd9ea] transition-all"
                  >
                    <option value="TRY" className="bg-gray-900">TRY</option>
                    <option value="EUR" className="bg-gray-900">EUR</option>
                    <option value="USD" className="bg-gray-900">USD</option>
                    <option value="GBP" className="bg-gray-900">GBP</option>
                  </select>
                </div>
              </div>

              {/* ── Tarih ── */}
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Ödeme Tarihi</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-[#9dd9ea] transition-all"
                />
              </div>

              {/* ── Açıklama ── */}
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Açıklama / Not <span className="text-gray-600">(opsiyonel)</span></label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={formData.category === 'personel' ? 'Örn: "Şubat maaşı", "Fuar hakedişleri"' : 'Açıklama...'}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9dd9ea] transition-all"
                />
              </div>

              {/* ── Ödendi mi? ── */}
              {!editingExpense && (
                <div>
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, odpiendi: !prev.odpiendi }))}
                    className={`w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                      formData.odpiendi
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                        : 'bg-white/5 border border-white/10 text-white/40'
                    }`}
                  >
                    {formData.odpiendi ? '✅ Ödendi — Kasaya ödendi olarak işlenir' : '⏳ Ödenmedi — Kasada bekleyen ödemeye düşer'}
                  </button>
                </div>
              )}

              {/* ── Kaydet / İptal ── */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 py-3 bg-gradient-to-r from-[#9dd9ea] to-[#7ec8dd] text-[#0a051e] font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95 disabled:opacity-60 disabled:scale-100"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {isSaving ? 'Kaydediliyor...' : (editingExpense ? 'Güncelle' : 'Kaydet')}
                </button>
                <button
                  onClick={cancelEdit}
                  className="px-5 py-3 bg-white/10 border border-white/20 rounded-xl text-white font-semibold hover:bg-white/20 transition-all active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* ── Kategori Özet ── */}
          {categorySummary.length > 0 && (
            <div className="backdrop-blur-xl bg-white/5 border border-white/15 rounded-2xl p-5">
              <h3 className="font-bold text-white mb-4 text-sm">📊 Kategori Bazlı Özet</h3>
              <div className="space-y-2">
                {categorySummary.map(item => {
                  if ((currentRole === 'personel' || currentRole === 'mudur') && (item.category === 'operasyonel' || item.category === 'personel')) return null;
                  const isOpen = acikKategori === item.category;
                  const detayItems = item.category === 'kira'
                    ? mekanKiralar
                    : filteredExpenses.filter(e => e.category === item.category);
                  return (
                    <div key={item.category} className="bg-white/5 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setAcikKategori(isOpen ? null : item.category)}
                        className="w-full p-3 text-left"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-white">{categoryLabels[item.category] || `🏢 ${item.category}`} <span className="text-xs text-gray-500 font-normal">({item.count})</span></span>
                          <div className="text-right">
                            <div className="text-sm font-bold text-white">₺{Math.round(item.total).toLocaleString('tr-TR')}</div>
                            <div className={`text-xs ${(categoryColors[item.category] || categoryColors.diger).text}`}>{item.percentage.toFixed(1)}%</div>
                          </div>
                        </div>
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className={`h-full bg-gradient-to-r ${(categoryColors[item.category] || categoryColors.diger).progress} transition-all`} style={{ width: `${item.percentage}%` }} />
                        </div>
                      </button>
                      {/* Detay — açılır panel (kişi/kaynak bazlı gruplanmış) */}
                      {isOpen && (() => {
                        // Kişi/kaynak bazlı grupla
                        const { days: fDays } = getDateRangeForFilter();
                        const grupMap: Record<string, { label: string; toplam: number; count: number }> = {};
                        for (const e of detayItems) {
                          const key = e.personelAdi || e.name || e.description || '-';
                          if (!grupMap[key]) grupMap[key] = { label: key, toplam: 0, count: 0 };
                          // Kira: yearlyRent'ten dönem bazlı hesapla, diğerleri: amount
                          const tutar = e.yearlyRent ? (e.yearlyRent / 365) * fDays : toTL(e.amount || 0, e.currency);
                          grupMap[key].toplam += tutar;
                          grupMap[key].count++;
                        }
                        const gruplar = Object.values(grupMap).sort((a, b) => b.toplam - a.toplam);

                        return (
                          <div className="px-3 pb-3 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            {gruplar.length === 0 ? (
                              <p className="text-[10px] text-white/20 py-2 text-center">Kayıt yok</p>
                            ) : gruplar.map((g, i) => (
                              <div key={i} className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] text-white/70 truncate">{g.label}</p>
                                  {g.count > 1 && <p className="text-[9px] text-white/20">{g.count} kayıt</p>}
                                </div>
                                <span className="text-[11px] font-bold text-white/60 shrink-0 ml-2">₺{Math.round(g.toplam).toLocaleString('tr-TR')}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
                {/* Toplam */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10, marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="text-sm font-bold text-white">Toplam</span>
                  <span className="text-sm font-bold" style={{ color: '#f87171' }}>
                    -₺{Math.round(categorySummary.reduce((s, c) => s + c.total, 0)).toLocaleString('tr-TR')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Arama & Filtre ── */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Ara... (personel, açıklama, kategori)"
                className="w-full bg-white/10 border border-white/20 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#9dd9ea] transition-all"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#9dd9ea] transition-all"
              >
                <option value="all" className="bg-gray-900">🏷️ Tüm Kategoriler</option>
                {Object.entries(categoryLabels).map(([k, v]) => (
                  <option key={k} value={k} className="bg-gray-900">{v}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Export ── */}
          <div className="grid grid-cols-3 gap-2">
            <button onClick={exportToPDF} className="bg-gradient-to-r from-[#9dd9ea] to-[#7ec8dd] text-[#0a051e] font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-sm">
              <Download className="w-4 h-4" /> PDF
            </button>
            <button onClick={exportToCSV} className="bg-green-500/20 border border-green-500/30 text-green-400 font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-sm">
              <FileText className="w-4 h-4" /> CSV
            </button>
            <button onClick={() => window.print()} className="bg-ta/20 border border-ta/30 text-ta font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-sm">
              <Printer className="w-4 h-4" /> Yazdır
            </button>
          </div>

          {/* ── Gider Listesi ── */}
          <div>
            <h3 className="font-bold text-white text-base mb-3">
              📋 Gider Listesi <span className="text-gray-400 font-normal text-sm">({filteredExpenses.length} kayıt{bilgiKayitlari.length > 0 ? ` + ${bilgiKayitlari.length} kasa ödemesi` : ''})</span>
            </h3>

            {listeKayitlari.length === 0 ? (
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-10 text-center">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-gray-400">Bu dönemde kayıt bulunamadı</p>
              </div>
            ) : (
              <>
                {listeKayitlari
                  .slice(0, displayLimit)
                  .map(expense => (
                    <div key={expense.id} className="mb-2 backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/8 transition-all">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* ── Personel kategorisi özel görünüm ── */}
                          {expense.category === 'personel' && expense.personelAdi ? (
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-10 h-10 rounded-xl bg-ta/20 border border-ta/30 flex items-center justify-center text-xl shrink-0">
                                {roleAvatars[expense.personelRol || ''] || '👤'}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-white text-sm">{expense.personelAdi}</span>
                                  {expense.odemeTipi && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${odemeTipiColors[expense.odemeTipi]}`}>
                                      {odemeTipiLabels[expense.odemeTipi]}
                                    </span>
                                  )}
                                  {expense.personelRol && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full border ${roleColors[expense.personelRol] || 'bg-white/10 text-gray-400 border-white/20'}`}>
                                      {roleLabels[expense.personelRol] || expense.personelRol}
                                    </span>
                                  )}
                                </div>
                                {expense.donem && (
                                  <div className="text-xs text-ta mt-0.5">📅 {formatDonem(expense.donem)}</div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className={`text-xs font-semibold px-2 py-1 rounded-lg bg-gradient-to-r ${(categoryColors[expense.category] || categoryColors.diger).bg} border ${(categoryColors[expense.category] || categoryColors.diger).border} ${(categoryColors[expense.category] || categoryColors.diger).text}`}>
                                {categoryLabels[expense.category] || `🏢 ${expense.category}`}
                              </span>
                              {(expense as any).plHaric && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300" title="Kasadan yapılan ödeme — gideri tahakkuk kanalından zaten sayıldığı için toplama katılmaz">💸 Kasa ödemesi · hesaba katılmaz</span>
                              )}
                            </div>
                          )}

                          {expense.description && (
                            <p className="text-xs text-gray-400 mb-2 line-clamp-1">{expense.description}</p>
                          )}

                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xl font-black text-[#ffb3ba]">
                              ₺{expense.amount.toLocaleString('tr-TR')}
                              {expense.currency && expense.currency !== 'TRY' && (
                                <span className="text-sm font-normal text-gray-400 ml-1">{expense.currency}</span>
                              )}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(expense.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-xs text-gray-600">👤 {expense.created_by}</span>
                            <span className="text-xs text-gray-700">
                              {new Date(expense.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-1.5 shrink-0">
                          {canAddExpense && (
                            <button onClick={() => startEdit(expense)} className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center hover:bg-blue-500/30 transition-colors">
                              <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                            </button>
                          )}
                          {canDeleteExpense && (
                            <button onClick={() => handleDelete(expense.id)} className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center hover:bg-red-500/30 transition-colors">
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                {listeKayitlari.length > displayLimit && (
                  <button
                    onClick={() => setDisplayLimit(p => p + 15)}
                    className="w-full bg-white/5 border border-white/15 text-gray-300 font-semibold px-6 py-3 rounded-xl hover:bg-white/10 transition-colors text-sm"
                  >
                    📄 Daha Fazla Yükle ({listeKayitlari.length - displayLimit} kayıt daha)
                  </button>
                )}
              </>
            )}
          </div>

          {/* ── Gelir Kayıtları ── */}
          {gelirler.length > 0 && (
            <div className="backdrop-blur-xl bg-gradient-to-br from-green-500/8 to-green-600/5 border border-green-500/20 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <h3 className="font-bold text-white text-sm">Gelir Kayıtları</h3>
                <span className="text-xs text-gray-500 ml-auto">{gelirler.length} kayıt</span>
              </div>
              {gelirler.slice(0, 15).map(g => (
                <div key={g.id} className="backdrop-blur-xl bg-green-500/5 border border-green-500/15 rounded-xl p-3">
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {g.mekanAdi && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 border border-green-500/20 text-green-300 font-medium">📍 {g.mekanAdi}</span>}
                        {!g.mekanAdi && <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-gray-400">🏢 Genel</span>}
                      </div>
                      {g.description && <div className="text-xs text-gray-400 mt-1">{g.description}</div>}
                    </div>
                    <div className="flex gap-1 shrink-0 ml-2">
                      {canAddExpense && (
                        <button onClick={() => startGelirEdit(g)} className="p-1.5 bg-white/5 hover:bg-white/15 border border-white/10 rounded-lg transition-colors">
                          <Edit2 className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                      )}
                      {canDeleteExpense && (
                        <button onClick={() => handleDeleteGelir(g.id)} className="p-1.5 bg-red-500/10 hover:bg-red-500/25 border border-red-500/20 rounded-lg transition-colors">
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-green-400">+₺{g.amount.toLocaleString('tr-TR')}</span>
                    <span className="text-xs text-gray-500">{new Date(g.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">👤 {g.created_by || 'Bilinmiyor'}</div>
                </div>
              ))}
              {gelirler.length > 15 && (
                <div className="text-xs text-gray-500 text-center">+{gelirler.length - 15} kayıt daha</div>
              )}
            </div>
          )}

          {/* ── Bilgi Kartı ── */}
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                <span className="text-xl">ℹ️</span>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-2">Yetki Sistemi</h4>
                <div className="space-y-1.5 text-xs text-gray-400">
                  <p><span className="text-ta font-medium">Yönetici:</span> Tüm gelir/giderleri görebilir, ekleyebilir ve silebilir.</p>
                  <p><span className="text-blue-300 font-medium">Üst Müdür:</span> Tüm gelir/giderleri görebilir ve ekleyebilir.</p>
                  <p><span className="text-gray-300 font-medium">Diğer roller:</span> Bu sayfaya erişim yok.</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Otomatik Gider Kaynakları Bilgi Kartı ── */}
          <div className="backdrop-blur-xl bg-gradient-to-br from-[#9dd9ea]/8 to-[#7ec8dd]/5 border border-[#9dd9ea]/20 rounded-2xl p-5 mb-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#9dd9ea]/15 border border-[#9dd9ea]/30 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-[#9dd9ea]" />
              </div>
              <div>
                <h4 className="font-semibold text-white mb-0.5">Otomatik Gider Kaynakları</h4>
                <p className="text-xs text-gray-400">Maliyet Yönetimi'ndeki veriler bu sayfada referans olarak görünür. Düzenlemek için Maliyet Yönetimi'ne gidin.</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Mekan Kiraları */}
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">🏠</span>
                  <span className="text-sm font-semibold text-orange-300">Mekan Kiraları</span>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-300 font-medium">→ 🏢 Operasyonel</span>
                </div>
                {mekanKiralar.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">Kira bedeli tanımlı mekan yok.</p>
                ) : (
                  <div className="space-y-1.5">
                    {mekanKiralar.map(m => (
                      <div key={m.id} className="flex items-center justify-between">
                        <span className="text-xs text-gray-300">{m.emoji} {m.name}</span>
                        <div className="text-right">
                          <span className="text-xs font-semibold text-orange-200">
                            ₺{Math.round(m.yearlyRent / 12).toLocaleString('tr-TR')}/ay
                          </span>
                          <span className="text-xs text-gray-500 ml-1">(yıllık ₺{m.yearlyRent.toLocaleString('tr-TR')})</span>
                        </div>
                      </div>
                    ))}
                    <div className="pt-1.5 border-t border-orange-500/20 flex items-center justify-between">
                      <span className="text-xs text-gray-400 font-medium">Toplam aylık</span>
                      <span className="text-sm font-bold text-orange-300">
                        ₺{Math.round(mekanKiralar.reduce((s, m) => s + m.yearlyRent / 12, 0)).toLocaleString('tr-TR')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Düzenli Giderler */}
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">🔄</span>
                  <span className="text-sm font-semibold text-orange-300">Düzenli Giderler</span>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-300 font-medium">→ 🏢 Operasyonel</span>
                </div>
                {recurringCosts.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">Düzenli gider tanımlanmamış.</p>
                ) : (
                  <div className="space-y-1.5">
                    {recurringCosts.map((r: RecurringCostItem) => {
                      const freqLabel: Record<string, string> = { daily: '/gün', weekly: '/hafta', monthly: '/ay', yearly: '/yıl' };
                      const toMonthly = (rc: RecurringCostItem) => {
                        if (rc.frequency === 'daily') return rc.amount * 30;
                        if (rc.frequency === 'weekly') return rc.amount * 4;
                        if (rc.frequency === 'yearly') return rc.amount / 12;
                        return rc.amount;
                      };
                      return (
                        <div key={r.id} className="flex items-center justify-between">
                          <span className="text-xs text-gray-300">{r.name}</span>
                          <div className="text-right">
                            <span className="text-xs font-semibold text-orange-200">
                              {r.amount.toLocaleString('tr-TR')} {r.currency}{freqLabel[r.frequency] || ''}
                            </span>
                            {r.frequency !== 'monthly' && (
                              <span className="text-xs text-gray-500 ml-1">(≈₺{Math.round(toMonthly(r)).toLocaleString('tr-TR')}/ay)</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Personel Maaşları */}
              <div className="bg-ta/10 border border-ta/20 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">💰</span>
                  <span className="text-sm font-semibold text-ta">Personel Maaşları</span>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-ta/20 border border-ta/30 text-ta font-medium">→ 💼 Personel</span>
                </div>
                {allSalaries.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">Maaş tanımlanmamış.</p>
                ) : (
                  <div className="space-y-1.5">
                    {allSalaries.map((s: SalaryDef) => {
                      const ekMaliyet = s.extraCostPercentage > 0
                        ? Math.round(s.amount * (1 + s.extraCostPercentage / 100))
                        : s.amount;
                      return (
                        <div key={s.id} className="flex items-center justify-between">
                          <span className="text-xs text-gray-300">
                            {roleAvatars[s.userRole || ''] || '👤'} {s.name}
                          </span>
                          <div className="text-right">
                            <span className="text-xs font-semibold text-ta">
                              ₺{s.amount.toLocaleString('tr-TR')}/ay
                            </span>
                            {s.extraCostPercentage > 0 && (
                              <span className="text-xs text-gray-500 ml-1">(+%{s.extraCostPercentage} → ₺{ekMaliyet.toLocaleString('tr-TR')})</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-1.5 border-t border-ta/20 flex items-center justify-between">
                      <span className="text-xs text-gray-400 font-medium">Toplam aylık maaş yükü</span>
                      <span className="text-sm font-bold text-ta">
                        ₺{allSalaries.reduce((s: number, sal: SalaryDef) => s + Math.round(sal.amount * (1 + (sal.extraCostPercentage || 0) / 100)), 0).toLocaleString('tr-TR')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Toplam satır */}
            <div className="mt-3 flex items-center gap-2 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl">
              <span className="text-xs text-gray-400">Tahmini toplam aylık sabit gider</span>
              <span className="text-sm font-bold text-[#9dd9ea] ml-auto">
                ₺{(
                  mekanKiralar.reduce((s, m) => s + Math.round(m.yearlyRent / 12), 0) +
                  recurringCosts.reduce((s: number, r: RecurringCostItem) => {
                    if (r.frequency === 'daily') return s + r.amount * 30;
                    if (r.frequency === 'weekly') return s + r.amount * 4;
                    if (r.frequency === 'yearly') return s + Math.round(r.amount / 12);
                    return s + r.amount;
                  }, 0) +
                  allSalaries.reduce((s: number, sal: SalaryDef) => s + Math.round(sal.amount * (1 + (sal.extraCostPercentage || 0) / 100)), 0)
                ).toLocaleString('tr-TR')}
              </span>
            </div>
          </div>
        </div>
      )}
      {/* İGD Rehber Modalı */}
      {showIgdGuide && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-start justify-center pt-6 overflow-y-auto" onClick={() => setShowIgdGuide(false)}>
          <div
            className="w-full max-w-lg bg-[#1a1a2e] border border-white/10 rounded-2xl mb-8 mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 bg-[#1a1a2e] border-b border-white/8 px-4 py-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-ta" /> İşletme Genel Durum Rehberi
              </h3>
              <button onClick={() => setShowIgdGuide(false)} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>
            <div className="p-4 space-y-4 text-[12px] leading-relaxed text-white/70">

              <div>
                <h4 className="text-[13px] font-bold text-white mb-1.5">💼 Bu Sayfa Ne İşe Yarar?</h4>
                <p>İşletmenin tüm <span className="text-ta font-semibold">gelir ve gider</span> hareketlerini tek ekranda takip edin.</p>
                <p className="mt-1">• Toplam gelir, toplam gider, net kâr/zarar ve kâr marjı anlık hesaplanır</p>
                <p>• Tüm veriler seçilen tarih aralığı ve mekana göre filtrelenir</p>
              </div>

              <div className="border-t border-white/8 pt-3">
                <h4 className="text-[13px] font-bold text-white mb-1.5">📊 Üst Kartlar</h4>
                <p>• <span className="text-emerald-400 font-semibold">Toplam Gelir</span>: Seçilen dönemdeki satış cirosu (mekan bazlı veya genel)</p>
                <p>• <span className="text-red-400 font-semibold">Toplam Gider</span>: Manuel kayıtlar + sabit giderler (maaş, kira, operasyonel)</p>
                <p>• <span className="text-blue-400 font-semibold">Net Kâr/Zarar</span>: Gelir − Gider farkı</p>
                <p>• <span className="text-white font-semibold">Kâr Marjı</span>: Net kâr / gelir yüzdesi</p>
              </div>

              <div className="border-t border-white/8 pt-3">
                <h4 className="text-[13px] font-bold text-white mb-1.5">📅 Tarih Filtreleri</h4>
                <p>İki satır halinde hızlı tarih seçenekleri:</p>
                <p className="mt-1">• <span className="text-ta font-semibold">Bugün · Dün · Bu Hafta · Bu Ay</span> — kısa dönem</p>
                <p>• <span className="text-ta font-semibold">Son 3 Ay · Son 6 Ay · Son 1 Yıl · Tümü · Özel</span> — uzun dönem</p>
                <p>• <span className="text-amber-400 font-semibold">Özel</span> seçeneğiyle başlangıç/bitiş tarihi belirleyebilirsiniz</p>
              </div>

              <div className="border-t border-white/8 pt-3">
                <h4 className="text-[13px] font-bold text-white mb-1.5">📍 Mekan Filtresi</h4>
                <p>Verileri mekana göre daraltabilirsiniz:</p>
                <p className="mt-1">• <span className="text-ta font-semibold">Tümü</span>: Tüm mekanların toplamı</p>
                <p>• <span className="text-ta font-semibold">🏢 Genel</span>: Mekana bağlı olmayan gelir/giderler</p>
                <p>• Belirli bir mekana tıklayarak o mekanın verilerini görüntüleyin</p>
              </div>

              <div className="border-t border-white/8 pt-3">
                <h4 className="text-[13px] font-bold text-white mb-1.5">➕ Gelir & Gider Girişi</h4>
                <p>• Gider ve gelir girişleri <span className="text-emerald-400 font-semibold">Kasa</span> sayfasından yapılır; buraya otomatik yansır</p>
                <p>• Bu sayfa salt rapordur: maaş, kira, hakediş ve tedarikçi giderleri de otomatik hesaplanır</p>
                <p className="mt-1">• Personel ödemelerinde <span className="text-ta font-semibold">kişi seçimi</span>, dönem ve ödeme tipi belirtilir</p>
                <p>• Var olan kayıtları düzenleyebilir veya silebilirsiniz</p>
              </div>

              <div className="border-t border-white/8 pt-3">
                <h4 className="text-[13px] font-bold text-white mb-1.5">📊 Kategori Bazlı Özet</h4>
                <p>Giderler kategoriye göre gruplanır ve toplam tutarları gösterilir.</p>
                <p className="mt-1">• Her kategoriyi açarak alt detayları görebilirsiniz</p>
                <p>• Yüzde dağılımı ile hangi kategoriye ne kadar harcandığını takip edin</p>
              </div>

              <div className="border-t border-white/8 pt-3">
                <h4 className="text-[13px] font-bold text-white mb-1.5">⚙️ Sabit Giderler</h4>
                <p>Otomatik hesaplanan kalemler:</p>
                <p className="mt-1">• <span className="text-ta font-semibold">Maaşlar</span>: Tanımlı personel maaşları + ek maliyet yüzdesi</p>
                <p>• <span className="text-ta font-semibold">Kiralar</span>: Mekan kiraları (yıllık / 12)</p>
                <p>• <span className="text-ta font-semibold">Düzenli giderler</span>: Günlük/haftalık/aylık/yıllık tekrarlayan ödemeler</p>
              </div>

              <div className="border-t border-white/8 pt-3">
                <h4 className="text-[13px] font-bold text-white mb-1.5">📥 Dışa Aktarma</h4>
                <p>• <span className="text-ta font-semibold">PDF</span>: Kategori özeti ve detaylı gider listesi</p>
                <p>• <span className="text-ta font-semibold">CSV</span>: Excel'de açılabilir tablo formatında dışa aktarım</p>
              </div>

              <div className="border-t border-white/8 pt-3">
                <h4 className="text-[13px] font-bold text-white mb-1.5">⚡ Erişim Yetkileri</h4>
                <p>• <span className="text-ta font-semibold">Gider ekleme</span>: Yönetici, Üst Müdür, Müdür, İdari</p>
                <p>• <span className="text-red-400 font-semibold">Gider silme</span>: Yalnızca Yönetici ve İdari</p>
                <p>• Tüm işlemler kayıt altına alınır — kim ekledi/sildi izlenebilir</p>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}