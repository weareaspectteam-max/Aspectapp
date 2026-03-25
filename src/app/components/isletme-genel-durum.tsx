import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, TrendingUp, TrendingDown, Banknote, Plus, Edit2, Trash2,
  Search, Filter, Download, FileText, Printer, Users, ChevronDown, Check,
  Loader2, Save, X, Sparkles
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { projectId } from '../lib/supabase-info';
import { getToken, buildHeaders, appendGhostParam } from '../lib/api';

// ─── Types ────────────────────────────────
interface Expense {
  id: string;
  category: 'personel' | 'malzeme' | 'ekipman' | 'operasyonel' | 'ulasim' | 'diger';
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
  diger: '📋 Diğer'
};

const categoryColors = {
  personel: { bg: 'from-purple-500/20 to-purple-600/20', text: 'text-purple-400', border: 'border-purple-500/30', progress: 'from-purple-500 to-purple-600' },
  malzeme: { bg: 'from-blue-500/20 to-blue-600/20', text: 'text-blue-400', border: 'border-blue-500/30', progress: 'from-blue-500 to-blue-600' },
  ekipman: { bg: 'from-green-500/20 to-green-600/20', text: 'text-green-400', border: 'border-green-500/30', progress: 'from-green-500 to-green-600' },
  operasyonel: { bg: 'from-orange-500/20 to-orange-600/20', text: 'text-orange-400', border: 'border-orange-500/30', progress: 'from-orange-500 to-orange-600' },
  ulasim: { bg: 'from-cyan-500/20 to-cyan-600/20', text: 'text-cyan-400', border: 'border-cyan-500/30', progress: 'from-cyan-500 to-cyan-600' },
  diger: { bg: 'from-gray-500/20 to-gray-600/20', text: 'text-gray-400', border: 'border-gray-500/30', progress: 'from-gray-500 to-gray-600' }
};

const roleAvatars: Record<string, string> = {
  'yonetici': '👨‍💼', 'ust-mudur': '👩‍💼', 'mudur': '🧑‍💼',
  'operasyon': '👨‍🔧', 'personel': '👤', 'idari': '👩‍💻',
};
const roleLabels: Record<string, string> = {
  'yonetici': 'Yönetici', 'ust-mudur': 'Üst Müdür', 'mudur': 'Müdür',
  'operasyon': 'Operasyon', 'personel': 'Personel', 'idari': 'İdari',
};
const roleColors: Record<string, string> = {
  'yonetici': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'ust-mudur': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'mudur': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  'operasyon': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'personel': 'bg-green-500/20 text-green-300 border-green-500/30',
  'idari': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
};

const odemeTipiLabels: Record<string, string> = {
  maas: '💰 Maaş', prim: '🏆 Prim', ikramiye: '🎁 İkramiye', avans: '💳 Avans', diger: '📦 Diğer'
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
  const canAddExpense = ['yonetici', 'ust-mudur', 'mudur', 'idari'].includes(currentRole);
  const canDeleteExpense = ['yonetici', 'idari'].includes(currentRole);

  // ─── State ──────────────────────────────
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [salaryDefs, setSalaryDefs] = useState<SalaryDef[]>([]);

  // Otomatik gider kaynakları
  const [mekanKiralar, setMekanKiralar] = useState<MekanKira[]>([]);
  const [recurringCosts, setRecurringCosts] = useState<RecurringCostItem[]>([]);
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
  const [searchQuery, setSearchQuery] = useState('');
  const [displayLimit, setDisplayLimit] = useState(15);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [userPickerSearch, setUserPickerSearch] = useState('');
  const userPickerRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const defaultDonem = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [formData, setFormData] = useState({
    category: 'personel' as Expense['category'],
    amount: '',
    currency: 'TRY',
    description: '',
    date: now.toISOString().split('T')[0],
    personelId: '',
    personelAdi: '',
    personelRol: '',
    odemeTipi: 'maas' as 'maas' | 'prim' | 'ikramiye' | 'avans' | 'diger',
    donem: defaultDonem,
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
      const [giderRes, usersRes, maliyetRes, mekanRes] = await Promise.all([
        fetch(appendGhostParam(`${API_BASE}/isletme/giderler`), { headers: h }),
        fetch(appendGhostParam(`${API_BASE}/auth/kullanicilar`), { headers: h }),
        fetch(appendGhostParam(`${API_BASE}/maliyetler`), { headers: h }),
        fetch(appendGhostParam(`${API_BASE}/mekanlar`), { headers: h }),
      ]);
      if (giderRes.ok) {
        const d = await giderRes.json();
        setExpenses(d.giderler || []);
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
        if (d.exchangeRates) setExchangeRates(d.exchangeRates);
      }
      if (mekanRes.ok) {
        const d = await mekanRes.json();
        setMekanKiralar(
          (d.mekanlar || [])
            .filter((m: any) => m.yearlyRent && m.yearlyRent > 0)
            .map((m: any) => ({ id: m.id, name: m.name, emoji: m.emoji || '📍', yearlyRent: m.yearlyRent }))
        );
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

  const computeAutoGider = (days: number): number => {
    if (days <= 0) return 0;
    const toTRY = (amount: number, cur: string) => {
      if (cur === 'EUR') return amount * exchangeRates.EUR;
      if (cur === 'USD') return amount * exchangeRates.USD;
      if (cur === 'GBP') return amount * exchangeRates.GBP;
      return amount;
    };
    let total = 0;
    for (const m of mekanKiralar) total += (m.yearlyRent / 365) * days;
    for (const r of recurringCosts) {
      const tryAmt = toTRY(r.amount, r.currency);
      if (r.frequency === 'daily') total += tryAmt * days;
      else if (r.frequency === 'weekly') total += (tryAmt / 7) * days;
      else if (r.frequency === 'monthly') total += (tryAmt / 30) * days;
      else if (r.frequency === 'yearly') total += (tryAmt / 365) * days;
    }
    for (const s of allSalaries) {
      const tryAmt = toTRY(s.amount, s.currency);
      const withExtra = tryAmt * (1 + (s.extraCostPercentage || 0) / 100);
      total += (withExtra / 30) * days;
    }
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
        category: formData.category,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        description: formData.description,
        date: formData.date,
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
  const getFilteredExpenses = () => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const startOfWeek = new Date(today);
    const dow = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - (dow === 0 ? 6 : dow - 1));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOf3M = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const startOf6M = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const startOf1Y = new Date(now.getFullYear() - 1, now.getMonth(), 1);

    return expenses.filter(exp => {
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
      const q = searchQuery.toLowerCase().trim();
      const searchMatch = !q || exp.description?.toLowerCase().includes(q) || exp.personelAdi?.toLowerCase().includes(q) || categoryLabels[exp.category].toLowerCase().includes(q);
      return dateMatch && roleCatMatch && catMatch && searchMatch;
    });
  };

  const filteredExpenses = getFilteredExpenses();
  const manualGiderToplam = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const { days: filterDays } = getDateRangeForFilter();
  const autoGiderToplam = dateFilter !== 'all' ? computeAutoGider(filterDays) : 0;
  const totalExpenses = manualGiderToplam + autoGiderToplam;
  const totalRevenue = ciroData.toplamCiro;
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  const categorySummary = Object.keys(categoryLabels).map(cat => {
    const items = filteredExpenses.filter(e => e.category === cat);
    const total = items.reduce((s, e) => s + e.amount, 0);
    return { category: cat as Expense['category'], total, count: items.length, percentage: totalExpenses > 0 ? (total / totalExpenses) * 100 : 0 };
  }).filter(i => i.total > 0).sort((a, b) => b.total - a.total);

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
          categoryLabels[i.category].replace(/[^\x00-\x7F]/g, ''),
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
        categoryLabels[e.category].replace(/[^\x00-\x7F]/g, ''),
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
        categoryLabels[e.category].replace(/[^\x00-\x7F]/g, ''),
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
    <div className="pb-24 min-h-screen bg-gradient-to-b from-[#0a051e] via-[#120830] to-[#1a0a3c]">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-black text-white">İşletme Genel Durum</h1>
              <span className="text-2xl">💼</span>
            </div>
            <p className="text-sm text-gray-400">Gelir, gider ve ödeme takibi</p>
          </div>
          <button onClick={fetchData} disabled={isLoading} className="p-2 bg-white/10 border border-white/20 rounded-xl text-white hover:bg-white/20 transition-all">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="text-sm">↻</span>}
          </button>
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
                    <div className="text-xs text-gray-500 mt-1">{ciroData.toplamSatisAdet} satış</div>
                    {ciroData.mekanlar.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {ciroData.mekanlar.slice(0, 3).map(m => (
                          <div key={m.id} className="flex items-center justify-between">
                            <span className="text-xs text-gray-400 truncate">{m.emoji} {m.name}</span>
                            <span className="text-xs font-semibold text-green-300 shrink-0 ml-1">₺{m.ciro.toLocaleString('tr-TR')}</span>
                          </div>
                        ))}
                        {ciroData.mekanlar.length > 3 && (
                          <div className="text-xs text-gray-600">+{ciroData.mekanlar.length - 3} mekan daha</div>
                        )}
                      </div>
                    )}
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
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">⚙️ Sabit giderler</span>
                        <span className="text-xs font-semibold text-orange-300">₺{autoGiderToplam.toLocaleString('tr-TR')}</span>
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
                  <div className="backdrop-blur-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-purple-400" />
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

          {/* ── Yeni Gider Butonu ── */}
          {canAddExpense && (
            <button
              onClick={() => { setShowAddForm(!showAddForm); if (showAddForm) cancelEdit(); }}
              className="w-full bg-gradient-to-r from-[#9dd9ea] to-[#7ec8dd] text-[#0a051e] font-bold py-3 px-4 rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95 shadow-lg"
            >
              {showAddForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              {showAddForm ? 'Formu Kapat' : 'Yeni Gider Ekle'}
            </button>
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
                  {(Object.entries(categoryLabels) as [Expense['category'], string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setFormData(prev => ({ ...prev, category: key }))}
                      className={`py-2.5 px-2 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                        formData.category === key
                          ? `bg-gradient-to-br ${categoryColors[key].bg} border ${categoryColors[key].border} ${categoryColors[key].text}`
                          : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ══ PERSONEL ÖZEL FORMU ══ */}
              {formData.category === 'personel' && (
                <div className="space-y-4 p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-bold text-purple-300">Personel Ödeme Detayı</span>
                  </div>

                  {/* Personel Seçici */}
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block">Personel</label>
                    <div className="relative" ref={userPickerRef}>
                      <button
                        type="button"
                        onClick={() => setShowUserPicker(p => !p)}
                        className={`w-full px-4 py-3 bg-white/10 border rounded-xl text-left flex items-center justify-between transition-all ${showUserPicker ? 'border-purple-400 ring-1 ring-purple-400/30' : 'border-white/20 hover:border-white/40'}`}
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
                        <div className="absolute top-full left-0 right-0 mt-2 backdrop-blur-2xl bg-[#0a051e]/95 border border-white/20 rounded-2xl shadow-2xl z-50 overflow-hidden">
                          <div className="p-3 border-b border-white/10">
                            <input
                              autoFocus
                              type="text"
                              placeholder="İsim ara..."
                              value={userPickerSearch}
                              onChange={e => setUserPickerSearch(e.target.value)}
                              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-400"
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
                                  className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-white/10 transition-all text-left ${isSelected ? 'bg-purple-500/10' : ''}`}
                                >
                                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 ${isSelected ? 'bg-purple-500/20 border border-purple-500/40' : 'bg-white/10 border border-white/15'}`}>
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
                                  {isSelected && <Check className="w-4 h-4 text-purple-400 shrink-0" />}
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
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:border-purple-400 transition-all"
                    />
                    {formData.donem && (
                      <p className="text-xs text-purple-300 mt-1">📅 {formatDonem(formData.donem)}</p>
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
                  placeholder={formData.category === 'personel' ? 'Örn: "Şubat maaşı", "Fuar primleri"' : 'Açıklama...'}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#9dd9ea] transition-all"
                />
              </div>

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
                  return (
                    <div key={item.category} className="bg-white/5 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-white">{categoryLabels[item.category]} <span className="text-xs text-gray-500 font-normal">({item.count})</span></span>
                        <div className="text-right">
                          <div className="text-sm font-bold text-white">₺{item.total.toLocaleString('tr-TR')}</div>
                          <div className={`text-xs ${categoryColors[item.category].text}`}>{item.percentage.toFixed(1)}%</div>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className={`h-full bg-gradient-to-r ${categoryColors[item.category].progress} transition-all`} style={{ width: `${item.percentage}%` }} />
                      </div>
                    </div>
                  );
                })}
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
            <button onClick={() => window.print()} className="bg-purple-500/20 border border-purple-500/30 text-purple-400 font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-sm">
              <Printer className="w-4 h-4" /> Yazdır
            </button>
          </div>

          {/* ── Gider Listesi ── */}
          <div>
            <h3 className="font-bold text-white text-base mb-3">
              📋 Gider Listesi <span className="text-gray-400 font-normal text-sm">({filteredExpenses.length} kayıt)</span>
            </h3>

            {filteredExpenses.length === 0 ? (
              <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-10 text-center">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-gray-400">Bu dönemde kayıt bulunamadı</p>
              </div>
            ) : (
              <>
                {filteredExpenses
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, displayLimit)
                  .map(expense => (
                    <div key={expense.id} className="mb-2 backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/8 transition-all">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* ── Personel kategorisi özel görünüm ── */}
                          {expense.category === 'personel' && expense.personelAdi ? (
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-xl shrink-0">
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
                                  <div className="text-xs text-purple-300 mt-0.5">📅 {formatDonem(expense.donem)}</div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-semibold px-2 py-1 rounded-lg bg-gradient-to-r ${categoryColors[expense.category].bg} border ${categoryColors[expense.category].border} ${categoryColors[expense.category].text}`}>
                                {categoryLabels[expense.category]}
                              </span>
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

                {filteredExpenses.length > displayLimit && (
                  <button
                    onClick={() => setDisplayLimit(p => p + 15)}
                    className="w-full bg-white/5 border border-white/15 text-gray-300 font-semibold px-6 py-3 rounded-xl hover:bg-white/10 transition-colors text-sm"
                  >
                    📄 Daha Fazla Yükle ({filteredExpenses.length - displayLimit} kayıt daha)
                  </button>
                )}
              </>
            )}
          </div>

          {/* ── Bilgi Kartı ── */}
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                <span className="text-xl">ℹ️</span>
              </div>
              <div>
                <h4 className="font-semibold text-white mb-2">Yetki Sistemi</h4>
                <div className="space-y-1.5 text-xs text-gray-400">
                  <p><span className="text-purple-300 font-medium">Yönetici / İdari:</span> Tüm giderleri görebilir, ekleyebilir ve silebilir.</p>
                  <p><span className="text-blue-300 font-medium">Üst Müdür / Müdür:</span> Tüm giderleri görebilir ve ekleyebilir.</p>
                  <p><span className="text-orange-300 font-medium">Operasyon:</span> Sadece ekipman ve ulaşım giderlerini görebilir.</p>
                  <p><span className="text-gray-300 font-medium">Personel / Bekleyen:</span> Bu sayfaya erişim yok.</p>
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
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">💰</span>
                  <span className="text-sm font-semibold text-purple-300">Personel Maaşları</span>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 font-medium">→ 💼 Personel</span>
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
                            <span className="text-xs font-semibold text-purple-200">
                              ₺{s.amount.toLocaleString('tr-TR')}/ay
                            </span>
                            {s.extraCostPercentage > 0 && (
                              <span className="text-xs text-gray-500 ml-1">(+%{s.extraCostPercentage} → ₺{ekMaliyet.toLocaleString('tr-TR')})</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-1.5 border-t border-purple-500/20 flex items-center justify-between">
                      <span className="text-xs text-gray-400 font-medium">Toplam aylık maaş yükü</span>
                      <span className="text-sm font-bold text-purple-300">
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
    </div>
  );
}