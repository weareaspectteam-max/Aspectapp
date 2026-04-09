import { useState, useEffect, useRef } from 'react';
import { Edit2, Trash2, Save, ChevronRight, ChevronLeft, Plus, RefreshCw, Loader2, Users, ChevronDown, Check, ArrowRight } from 'lucide-react';
import { projectId } from '../lib/supabase-info';
import { getToken, buildHeaders, appendGhostParam } from '../lib/api';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

const glass: React.CSSProperties = {
  background:           'rgba(255,255,255,0.05)',
  border:               '1px solid rgba(255,255,255,0.10)',
  backdropFilter:       'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderRadius:         20,
};

interface CostManagementProps {
  userName: string;
  userRole: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  accessToken: string;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

interface ExchangeRates {
  EUR: number;
  USD: number;
  GBP: number;
  BGN: number;
  RUB: number;
  SAR: number;
}

type Currency = 'TRY' | 'EUR' | 'USD' | 'GBP' | 'BGN' | 'RUB' | 'SAR';
type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface AlbumCost {
  size: number;
  tamBoy: number;
  yarimBoy: number;
  currency: Currency;
}

interface PaperCost {
  id: string;
  name: string;
  boxPrice: number;
  currency: Currency;
  pcsPerBox: number;
  setsPerBox: number;
}

interface RecurringCost {
  id: string;
  name: string;
  amount: number;
  currency: Currency;
  frequency: Frequency;
}

interface Salary {
  id: string;
  name: string;
  userId?: string;
  userRole?: string;
  amount: number;
  currency: Currency;
  frequency: Frequency;
  extraCostPercentage: number;
}

interface SystemUser {
  id: string;
  ad: string;
  rol: string;
  email: string;
}

interface Location {
  id: string;
  name: string;
  emoji: string;
  color: string;
  yearlyRent: number;
  dailyCostPercentage: number;
  profitPercentage: number;
  photoPrice: number;
}

type ViewType = 'main' | 'products' | 'recurring' | 'salaries' | 'rents' | 'cariler';

export function CostManagement({ userName, userRole, accessToken, onLogout, onNavigate }: CostManagementProps) {
  const [currentView, setCurrentView] = useState<ViewType>('main');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // System users for salary picker
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const userPickerRef = useRef<HTMLDivElement>(null);
  
  // Exchange rates
  const [isAutoExchange, setIsAutoExchange] = useState(false);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>({
    EUR: 35.50,
    USD: 32.80,
    GBP: 41.20,
    BGN: 19.50,
    RUB: 0.38,
    SAR: 8.80,
  });

  // Albums
  const [albumCosts, setAlbumCosts] = useState<AlbumCost[]>([
    { size: 3,  tamBoy: 25, yarimBoy: 20, currency: 'TRY' },
    { size: 5,  tamBoy: 35, yarimBoy: 28, currency: 'TRY' },
    { size: 7,  tamBoy: 45, yarimBoy: 36, currency: 'TRY' },
    { size: 9,  tamBoy: 55, yarimBoy: 44, currency: 'TRY' },
    { size: 11, tamBoy: 65, yarimBoy: 52, currency: 'TRY' },
    { size: 13, tamBoy: 75, yarimBoy: 60, currency: 'TRY' },
    { size: 15, tamBoy: 85, yarimBoy: 68, currency: 'TRY' },
  ]);

  // Papers
  const [papers, setPapers] = useState<PaperCost[]>([]);
  const [showPaperForm, setShowPaperForm] = useState(false);
  const [editingPaper, setEditingPaper] = useState<PaperCost | null>(null);

  // Recurring costs
  const [recurringCosts, setRecurringCosts] = useState<RecurringCost[]>([]);
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringCost | null>(null);

  // Salaries
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const [editingSalary, setEditingSalary] = useState<Salary | null>(null);

  // Locations from mekan-management
  const [locations, setLocations] = useState<Location[]>([]);

  // Cariler
  const [cariler, setCariler] = useState<any[]>([]);
  const [showCariForm, setShowCariForm] = useState(false);
  const [cariForm, setCariForm] = useState({ emoji: '🏢', name: '', description: '', supplierType: '' });

  // Form states for paper
  const [paperForm, setPaperForm] = useState({
    name: '',
    boxPrice: '',
    currency: 'TRY' as Currency,
    pcsPerBox: '',
    setsPerBox: '',
  });

  // Form states for recurring
  const [recurringForm, setRecurringForm] = useState({
    name: '',
    amount: '',
    currency: 'TRY' as Currency,
    frequency: 'monthly' as Frequency,
  });

  // Form states for salary
  const [salaryForm, setSalaryForm] = useState({
    name: '',
    userId: '',
    userRole: '',
    amount: '',
    currency: 'TRY' as Currency,
    frequency: 'monthly' as Frequency,
    extraCostPercentage: '15',
  });

  const albumDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exchangeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Picker dışına tıklayınca kapat
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userPickerRef.current && !userPickerRef.current.contains(e.target as Node)) {
        setShowUserPicker(false);
      }
    };
    if (showUserPicker) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserPicker]);

  // ─── Token helper ───────────────────────────────────────
  // getToken ve buildHeaders artık ../lib/api'den geliyor

  // ─── Veri yükle — sadece mount'ta bir kez ────────────────
  const fetchData = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const token = await getToken();
      const freshHeaders = buildHeaders(token);
      const [costRes, mekanRes, usersRes] = await Promise.all([
        fetch(appendGhostParam(`${API_BASE}/maliyetler`), { headers: freshHeaders }),
        fetch(appendGhostParam(`${API_BASE}/mekanlar`), { headers: freshHeaders }),
        fetch(appendGhostParam(`${API_BASE}/auth/kullanicilar`), { headers: freshHeaders }),
      ]);

      if (!costRes.ok) {
        const rawText = await costRes.text();
        console.log('[CostMgmt] token prefix:', token?.substring(0, 20));
        console.log('[CostMgmt] Maliyet HTTP status:', costRes.status);
        console.log('[CostMgmt] Maliyet raw response:', rawText);
        let err: any = {};
        try { err = JSON.parse(rawText); } catch {}
        setApiError(err.error || err.message || `HTTP ${costRes.status}: ${rawText.slice(0, 200)}`);
      } else {
        const data = await costRes.json();
        const er = data.exchangeRates;
        setExchangeRates({ EUR: er.EUR, USD: er.USD, GBP: er.GBP });
        setIsAutoExchange(er.isAuto || false);
        setAlbumCosts(data.albums || []);
        setPapers(data.papers || []);
        setRecurringCosts(data.recurring || []);
        setSalaries(data.salaries || []);
        setCariler(data.cariler || []);
      }

      if (mekanRes.ok) {
        const mekanData = await mekanRes.json();
        setLocations(mekanData.mekanlar || []);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setSystemUsers(usersData.kullanicilar || []);
      }
    } catch (err) {
      console.log('[CostMgmt] fetch error:', err);
      setApiError('Sunucuya bağlanılamadı.');
    } finally {
      setIsLoading(false);
    }
  };

  // user-management ile aynı: boş deps → sadece mount'ta çalışır, döngü yok
  useEffect(() => {
    fetchData();
  }, []);

  // ─── API Kayıt Fonksiyonları ──────────────────────
  const saveExchangeRates = (rates: ExchangeRates, isAuto: boolean) => {
    setExchangeRates(rates);
    setIsAutoExchange(isAuto);
    if (exchangeDebounceRef.current) clearTimeout(exchangeDebounceRef.current);
    exchangeDebounceRef.current = setTimeout(async () => {
      try {
        const token = await getToken();
        await fetch(`${API_BASE}/maliyetler/doviz`, {
          method: 'PUT',
          headers: buildHeaders(token),
          body: JSON.stringify({ ...rates, isAuto }),
        });
      } catch (err) {
        console.log('Döviz kaydetme hatası:', err);
      }
    }, 600);
  };

  const saveAlbumCosts = (costs: AlbumCost[]) => {
    setAlbumCosts(costs);
    if (albumDebounceRef.current) clearTimeout(albumDebounceRef.current);
    albumDebounceRef.current = setTimeout(async () => {
      try {
        const token = await getToken();
        await fetch(`${API_BASE}/maliyetler/albumler`, {
          method: 'PUT',
          headers: buildHeaders(token),
          body: JSON.stringify({ albums: costs }),
        });
      } catch (err) {
        console.log('Albüm kaydetme hatası:', err);
      }
    }, 600);
  };

  const savePapers = (newPapers: PaperCost[]) => {
    setPapers(newPapers);
  };

  const saveRecurringCosts = (costs: RecurringCost[]) => {
    setRecurringCosts(costs);
  };

  const saveSalaries = (newSalaries: Salary[]) => {
    setSalaries(newSalaries);
  };

  // ─── Kur güncelle ───────────────────────────────
  const fetchExchangeRates = async () => {
    try {
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/TRY');
      const data = await response.json();
      const newRates: ExchangeRates = {
        EUR: 1 / data.rates.EUR,
        USD: 1 / data.rates.USD,
        GBP: 1 / data.rates.GBP,
        BGN: 1 / data.rates.BGN,
        RUB: 1 / data.rates.RUB,
        SAR: 1 / data.rates.SAR,
      };
      saveExchangeRates(newRates, true);
      alert('Kurlar başarıyla güncellendi!');
    } catch (error) {
      alert('Kur güncellenirken hata oluştu!');
    }
  };

  // Conversion functions
  const convertToTRY = (amount: number, currency: Currency): number => {
    if (currency === 'TRY') return amount;
    return amount * exchangeRates[currency];
  };

  const convertToMonthly = (amount: number, frequency: Frequency): number => {
    switch (frequency) {
      case 'daily': return amount * 30;
      case 'weekly': return amount * 4;
      case 'monthly': return amount;
      case 'yearly': return amount / 12;
    }
  };

  // Calculate total monthly cost
  const calculateTotalMonthlyCost = (): number => {
    let total = 0;

    // Recurring costs
    recurringCosts.forEach(cost => {
      const amountTRY = convertToTRY(cost.amount, cost.currency);
      total += convertToMonthly(amountTRY, cost.frequency);
    });

    // Salaries
    salaries.forEach(salary => {
      const salaryTRY = convertToTRY(salary.amount, salary.currency);
      const extraCost = salaryTRY * (salary.extraCostPercentage / 100);
      const totalSalary = salaryTRY + extraCost;
      total += convertToMonthly(totalSalary, salary.frequency);
    });

    // Location rents
    (locations || []).forEach(location => {
      total += location.yearlyRent / 12;
    });

    return total;
  };

  // Format currency
  const formatCurrency = (value: number): string => {
    return value.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const formatDecimal = (value: number, decimals: number = 2): string => {
    return value.toLocaleString('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  // Paper form handlers
  const handleAddPaper = async () => {
    if (!paperForm.name.trim() || !paperForm.boxPrice || !paperForm.pcsPerBox || !paperForm.setsPerBox) {
      alert('Lütfen tüm alanları doldurun!');
      return;
    }
    setIsSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/maliyetler/kagitlar`, {
        method: 'POST',
        headers: buildHeaders(token),
        body: JSON.stringify({
          name: paperForm.name.trim(),
          boxPrice: parseFloat(paperForm.boxPrice),
          currency: paperForm.currency,
          pcsPerBox: parseInt(paperForm.pcsPerBox),
          setsPerBox: parseInt(paperForm.setsPerBox),
        }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.error || 'Kağıt eklenemedi.'); return; }
      const { paper } = await res.json();
      setPapers(prev => [...prev, paper]);
      resetPaperForm();
    } catch (err) {
      console.log('Kağıt ekleme hatası:', err);
      alert('Sunucu hatası!');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePaper = async () => {
    if (!editingPaper || !paperForm.name.trim() || !paperForm.boxPrice || !paperForm.pcsPerBox || !paperForm.setsPerBox) {
      alert('Lütfen tüm alanları doldurun!');
      return;
    }
    setIsSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/maliyetler/kagitlar/${editingPaper.id}`, {
        method: 'PUT',
        headers: buildHeaders(token),
        body: JSON.stringify({
          name: paperForm.name.trim(),
          boxPrice: parseFloat(paperForm.boxPrice),
          currency: paperForm.currency,
          pcsPerBox: parseInt(paperForm.pcsPerBox),
          setsPerBox: parseInt(paperForm.setsPerBox),
        }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.error || 'Kağıt güncellenemedi.'); return; }
      const { paper } = await res.json();
      setPapers(prev => prev.map(p => p.id === paper.id ? paper : p));
      resetPaperForm();
    } catch (err) {
      console.log('Kağıt güncelleme hatası:', err);
      alert('Sunucu hatası!');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePaper = async (id: string) => {
    if (!confirm('Bu kağıt tipini silmek istediğinize emin misiniz?')) return;
    try {
      const token = await getToken();
      await fetch(`${API_BASE}/maliyetler/kagitlar/${id}`, { method: 'DELETE', headers: buildHeaders(token) });
      setPapers(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.log('Kağıt silme hatası:', err);
    }
  };

  const startEditPaper = (paper: PaperCost) => {
    setEditingPaper(paper);
    setPaperForm({
      name: paper.name,
      boxPrice: paper.boxPrice.toString(),
      currency: paper.currency,
      pcsPerBox: paper.pcsPerBox.toString(),
      setsPerBox: (paper.setsPerBox ?? 1).toString(),
    });
    setShowPaperForm(true);
  };

  const resetPaperForm = () => {
    setShowPaperForm(false);
    setEditingPaper(null);
    setPaperForm({
      name: '',
      boxPrice: '',
      currency: 'TRY',
      pcsPerBox: '',
      setsPerBox: '',
    });
  };

  // Recurring form handlers
  const handleAddRecurring = async () => {
    if (!recurringForm.name.trim() || !recurringForm.amount) {
      alert('Lütfen tüm alanları doldurun!');
      return;
    }
    setIsSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/maliyetler/giderler`, {
        method: 'POST',
        headers: buildHeaders(token),
        body: JSON.stringify({
          name: recurringForm.name.trim(),
          amount: parseFloat(recurringForm.amount),
          currency: recurringForm.currency,
          frequency: recurringForm.frequency,
        }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.error || 'Gider eklenemedi.'); return; }
      const { gider } = await res.json();
      setRecurringCosts(prev => [...prev, gider]);
      resetRecurringForm();
    } catch (err) {
      console.log('Gider ekleme hatası:', err);
      alert('Sunucu hatası!');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateRecurring = async () => {
    if (!editingRecurring || !recurringForm.name.trim() || !recurringForm.amount) {
      alert('Lütfen tüm alanları doldurun!');
      return;
    }
    setIsSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/maliyetler/giderler/${editingRecurring.id}`, {
        method: 'PUT',
        headers: buildHeaders(token),
        body: JSON.stringify({
          name: recurringForm.name.trim(),
          amount: parseFloat(recurringForm.amount),
          currency: recurringForm.currency,
          frequency: recurringForm.frequency,
        }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.error || 'Gider güncellenemedi.'); return; }
      const { gider } = await res.json();
      setRecurringCosts(prev => prev.map(c => c.id === gider.id ? gider : c));
      resetRecurringForm();
    } catch (err) {
      console.log('Gider güncelleme hatası:', err);
      alert('Sunucu hatası!');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRecurring = async (id: string) => {
    if (!confirm('Bu gideri silmek istediğinize emin misiniz?')) return;
    try {
      const token = await getToken();
      await fetch(`${API_BASE}/maliyetler/giderler/${id}`, { method: 'DELETE', headers: buildHeaders(token) });
      setRecurringCosts(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.log('Gider silme hatası:', err);
    }
  };

  const startEditRecurring = (cost: RecurringCost) => {
    setEditingRecurring(cost);
    setRecurringForm({
      name: cost.name,
      amount: cost.amount.toString(),
      currency: cost.currency,
      frequency: cost.frequency,
    });
    setShowRecurringForm(true);
  };

  const resetRecurringForm = () => {
    setShowRecurringForm(false);
    setEditingRecurring(null);
    setRecurringForm({
      name: '',
      amount: '',
      currency: 'TRY',
      frequency: 'monthly',
    });
  };

  // Salary form handlers
  const handleAddSalary = async () => {
    if (!salaryForm.name.trim() || !salaryForm.amount) {
      alert('Lütfen personel seçin ve maaş tutarı girin!');
      return;
    }
    setIsSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/maliyetler/maaslar`, {
        method: 'POST',
        headers: buildHeaders(token),
        body: JSON.stringify({
          name: salaryForm.name.trim(),
          userId: salaryForm.userId || null,
          userRole: salaryForm.userRole || null,
          amount: parseFloat(salaryForm.amount),
          currency: salaryForm.currency,
          frequency: salaryForm.frequency,
          extraCostPercentage: parseFloat(salaryForm.extraCostPercentage),
        }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.error || 'Maaş eklenemedi.'); return; }
      const { maas } = await res.json();
      setSalaries(prev => [...prev, maas]);
      resetSalaryForm();
    } catch (err) {
      console.log('Maaş ekleme hatası:', err);
      alert('Sunucu hatası!');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateSalary = async () => {
    if (!editingSalary || !salaryForm.name.trim() || !salaryForm.amount) {
      alert('Lütfen personel seçin ve maaş tutarı girin!');
      return;
    }
    setIsSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/maliyetler/maaslar/${editingSalary.id}`, {
        method: 'PUT',
        headers: buildHeaders(token),
        body: JSON.stringify({
          name: salaryForm.name.trim(),
          userId: salaryForm.userId || null,
          userRole: salaryForm.userRole || null,
          amount: parseFloat(salaryForm.amount),
          currency: salaryForm.currency,
          frequency: salaryForm.frequency,
          extraCostPercentage: parseFloat(salaryForm.extraCostPercentage),
        }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.error || 'Maaş güncellenemedi.'); return; }
      const { maas } = await res.json();
      setSalaries(prev => prev.map(s => s.id === maas.id ? maas : s));
      resetSalaryForm();
    } catch (err) {
      console.log('Maaş güncelleme hatası:', err);
      alert('Sunucu hatası!');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSalary = async (id: string) => {
    if (!confirm('Bu maaşı silmek istediğinize emin misiniz?')) return;
    try {
      const token = await getToken();
      await fetch(`${API_BASE}/maliyetler/maaslar/${id}`, { method: 'DELETE', headers: buildHeaders(token) });
      setSalaries(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.log('Maaş silme hatası:', err);
    }
  };

  const startEditSalary = (salary: Salary) => {
    setEditingSalary(salary);
    setSalaryForm({
      name: salary.name,
      userId: salary.userId || '',
      userRole: salary.userRole || '',
      amount: salary.amount.toString(),
      currency: salary.currency,
      frequency: salary.frequency,
      extraCostPercentage: salary.extraCostPercentage.toString(),
    });
    setShowSalaryForm(true);
  };

  const resetSalaryForm = () => {
    setShowSalaryForm(false);
    setEditingSalary(null);
    setShowUserPicker(false);
    setSalaryForm({
      name: '',
      userId: '',
      userRole: '',
      amount: '',
      currency: 'TRY',
      frequency: 'monthly',
      extraCostPercentage: '15',
    });
  };

  // ─── Cari CRUD ──────────────────────────────
  const handleAddCari = async () => {
    if (!cariForm.name.trim()) {
      alert('Lütfen cari adını girin!');
      return;
    }
    setIsSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(appendGhostParam(`${API_BASE}/maliyetler/cariler`), {
        method: 'POST',
        headers: buildHeaders(token),
        body: JSON.stringify({
          emoji: cariForm.emoji || '🏢',
          name: cariForm.name.trim(),
          description: cariForm.description.trim(),
          supplierType: cariForm.supplierType || '',
        }),
      });
      if (!res.ok) { const e = await res.json(); alert(e.error || 'Cari eklenemedi.'); return; }
      const { cari } = await res.json();
      setCariler(prev => [...prev, cari]);
      setCariForm({ emoji: '🏢', name: '', description: '', supplierType: '' });
      setShowCariForm(false);
    } catch (err) {
      console.log('Cari ekleme hatası:', err);
      alert('Sunucu hatası!');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCari = async (id: string) => {
    if (!confirm('Bu cariyi silmek istediğinize emin misiniz?')) return;
    try {
      const token = await getToken();
      await fetch(appendGhostParam(`${API_BASE}/maliyetler/cariler/${id}`), { method: 'DELETE', headers: buildHeaders(token) });
      setCariler(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.log('Cari silme hatası:', err);
    }
  };

  // CARILER VIEW
  const renderCarilerView = () => {
    return (
      <div className="px-6 space-y-4">
        {/* Header */}
        <div className="backdrop-blur-xl bg-gradient-to-br from-[#c4b5fd]/20 to-[#a78bfa]/10 border border-[#c4b5fd]/30 rounded-2xl p-5 text-center">
          <p className="text-sm text-gray-300 mb-2">Toplam Cari</p>
          <p className="text-3xl font-bold text-white">{cariler.length}</p>
        </div>

        {cariler.length === 0 && !showCariForm && (
          <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-8 text-center">
            <p className="text-gray-400 mb-4">Henüz cari eklenmemiş</p>
            <button
              onClick={() => setShowCariForm(true)}
              className="px-6 py-3 bg-gradient-to-r from-[#c4b5fd] to-[#a78bfa] rounded-xl text-white font-bold hover:scale-105 transition-all active:scale-95 inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              İlk Cariyi Ekle
            </button>
          </div>
        )}

        {cariler.length > 0 && !showCariForm && (
          <div className="space-y-3">
            {cariler.map((cari) => (
              <div key={cari.id} className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{cari.emoji || '🏢'}</span>
                    <div>
                      <h4 className="font-bold text-white">{cari.name}</h4>
                      {cari.description && <p className="text-sm text-gray-400">{cari.description}</p>}
                      {cari.supplierType && <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">{cari.supplierType === 'album' ? '📸 Albüm' : '🖨️ Ribon'}</span>}
                      {cari.linkedUserEmail && <p className="text-xs text-green-400 mt-0.5">🏭 {cari.linkedUserEmail}</p>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteCari(cari.id)}
                    className="p-2 bg-red-600/60 border border-red-500/50 rounded-lg text-white hover:scale-110 transition-all active:scale-95"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={() => setShowCariForm(true)}
              className="w-full py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white font-semibold hover:bg-white/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Yeni Cari Ekle
            </button>
          </div>
        )}

        {/* Cari Form */}
        {showCariForm && (
          <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5 space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-300 mb-2 block">Emoji:</label>
              <input
                type="text"
                value={cariForm.emoji}
                onChange={(e) => setCariForm({ ...cariForm, emoji: e.target.value })}
                className="w-20 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-center text-xl focus:outline-none focus:border-[#c4b5fd] transition-all"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-300 mb-2 block">Cari Adı:</label>
              <input
                type="text"
                value={cariForm.name}
                onChange={(e) => setCariForm({ ...cariForm, name: e.target.value })}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#c4b5fd] transition-all"
                placeholder="Örn: Ribon Tedarikçisi"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-300 mb-2 block">Açıklama (opsiyonel):</label>
              <input
                type="text"
                value={cariForm.description}
                onChange={(e) => setCariForm({ ...cariForm, description: e.target.value })}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#c4b5fd] transition-all"
                placeholder="Kısa açıklama..."
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-300 mb-2 block">Tedarikçi Tipi:</label>
              <div className="flex gap-2">
                {[{ key: '', label: 'Yok', emoji: '—' }, { key: 'album', label: 'Albüm', emoji: '📸' }, { key: 'ribon', label: 'Ribon/Kağıt', emoji: '🖨️' }].map(t => (
                  <button key={t.key} onClick={() => setCariForm({ ...cariForm, supplierType: t.key })}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${cariForm.supplierType === t.key ? 'bg-gradient-to-r from-[#c4b5fd] to-[#a78bfa] text-white' : 'bg-white/10 border border-white/20 text-gray-400'}`}>
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowCariForm(false); setCariForm({ emoji: '🏢', name: '', description: '', supplierType: '' }); }}
                className="flex-1 py-3 bg-white/10 border border-white/20 rounded-xl text-white font-semibold hover:bg-white/20 transition-all active:scale-95"
              >
                İptal
              </button>
              <button
                onClick={handleAddCari}
                disabled={isSaving}
                className="flex-1 py-3 bg-gradient-to-r from-[#c4b5fd] to-[#a78bfa] rounded-xl text-white font-bold hover:scale-105 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Kaydet
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // MAIN VIEW
  const renderMainView = () => {
    const totalMonthlyCost = calculateTotalMonthlyCost();
    const totalRecurringMonthly = recurringCosts.reduce((sum, cost) => {
      const amountTRY = convertToTRY(cost.amount, cost.currency);
      return sum + convertToMonthly(amountTRY, cost.frequency);
    }, 0);
    
    const totalSalariesMonthly = salaries.reduce((sum, salary) => {
      const salaryTRY = convertToTRY(salary.amount, salary.currency);
      const extraCost = salaryTRY * (salary.extraCostPercentage / 100);
      const totalSalary = salaryTRY + extraCost;
      return sum + convertToMonthly(totalSalary, salary.frequency);
    }, 0);

    const totalRentsMonthly = (locations || []).reduce((sum, loc) => sum + (loc.yearlyRent / 12), 0);

    const CATEGORY_CARDS = [
      {
        view: 'products' as ViewType,
        emoji: '📸',
        title: 'Ürün Maliyetleri',
        subtitle: `${albumCosts.length} albüm • ${papers.length} kağıt tipi`,
        color: '#9dd9ea',
      },
      {
        view: 'recurring' as ViewType,
        emoji: '🏢',
        title: 'Düzenli Giderler',
        subtitle: `${recurringCosts.length} gider • ₺${formatCurrency(totalRecurringMonthly)}/ay`,
        color: '#ffd4a3',
      },
      {
        view: 'salaries' as ViewType,
        emoji: '👥',
        title: 'Personel Maaşları',
        subtitle: `${salaries.length} personel • ₺${formatCurrency(totalSalariesMonthly)}/ay`,
        color: '#a8e6cf',
      },
      {
        view: 'rents' as ViewType,
        emoji: '📍',
        title: 'Mekan Kiraları',
        subtitle: `${(locations || []).length} mekan • ₺${formatCurrency(totalRentsMonthly)}/ay`,
        color: '#d4b5f7',
      },
      {
        view: 'cariler' as ViewType,
        emoji: '🏢',
        title: 'Cariler',
        subtitle: `${cariler.length} cari`,
        color: '#c4b5fd',
      },
    ];

    return (
      <div className="px-4 space-y-4">

        {/* Döviz Kurları */}
        <div style={{ ...glass, padding: 20, border: '1px solid rgba(157,217,234,0.25)', boxShadow: '0 4px 24px rgba(157,217,234,0.08)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(157,217,234,0.15)', border: '1px solid rgba(157,217,234,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 18 }}>💱</span>
            </div>
            <h3 className="font-bold text-white text-base">Döviz Kurları</h3>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Manuel</span>
            <button
              onClick={() => { const newAuto = !isAutoExchange; saveExchangeRates(exchangeRates, newAuto); }}
              style={{ position: 'relative', width: 52, height: 26, borderRadius: 9999, background: isAutoExchange ? '#9dd9ea' : 'rgba(255,255,255,0.15)', transition: 'background 0.2s', flexShrink: 0 }}
            >
              <div style={{ position: 'absolute', top: 3, width: 20, height: 20, background: 'white', borderRadius: 9999, boxShadow: '0 2px 4px rgba(0,0,0,0.3)', transition: 'all 0.2s', ...(isAutoExchange ? { right: 3 } : { left: 3 }) }} />
            </button>
            <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>Otomatik API</span>
          </div>

          {!isAutoExchange && (
            <div className="space-y-3">
              {(['EUR', 'USD', 'GBP', 'BGN', 'RUB', 'SAR'] as const).map((currency) => (
                <div key={currency} className="flex items-center gap-3">
                  <span className="text-xl">{currency === 'EUR' ? '🇪🇺' : currency === 'USD' ? '🇺🇸' : currency === 'GBP' ? '🇬🇧' : currency === 'BGN' ? '🇧🇬' : currency === 'RUB' ? '🇷🇺' : '🇸🇦'}</span>
                  <span className="text-white font-semibold w-12">{currency}:</span>
                  <input
                    type="number" step="0.01"
                    value={exchangeRates[currency].toFixed(2)}
                    onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) saveExchangeRates({ ...exchangeRates, [currency]: parseFloat(v.toFixed(2)) }, false); }}
                    onBlur={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) e.target.value = v.toFixed(2); }}
                    style={{ width: 110, padding: '8px 12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, color: 'white', outline: 'none', fontSize: 14 }}
                  />
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>TL</span>
                </div>
              ))}
            </div>
          )}

          {isAutoExchange && (
            <div className="space-y-3">
              <div className="space-y-2">
                {(['EUR', 'USD', 'GBP', 'BGN', 'RUB', 'SAR'] as const).map((currency) => (
                  <div key={currency} className="flex items-center justify-between px-4 py-2" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>
                    <span className="text-white font-semibold">{currency === 'EUR' ? '🇪🇺' : currency === 'USD' ? '🇺🇸' : currency === 'GBP' ? '🇬🇧' : currency === 'BGN' ? '🇧🇬' : currency === 'RUB' ? '🇷🇺' : '🇸🇦'} {currency}:</span>
                    <span className="text-white font-bold">{formatDecimal(exchangeRates[currency])} TL</span>
                  </div>
                ))}
              </div>
              <button
                onClick={fetchExchangeRates}
                className="w-full flex items-center justify-center gap-2 font-bold transition-all active:scale-95"
                style={{ padding: '12px 0', borderRadius: 14, background: 'rgba(157,217,234,0.15)', border: '1px solid rgba(157,217,234,0.35)', color: '#9dd9ea' }}
              >
                <RefreshCw className="w-4 h-4" />
                Kurları Güncelle
              </button>
            </div>
          )}
        </div>

        {/* Toplam Aylık Maliyet */}
        <div style={{ ...glass, padding: 20, border: '1px solid #ffd4a3bb', boxShadow: '0 4px 32px #ffd4a350', textAlign: 'center' }}>
          <p className="text-sm mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>Toplam Aylık Sabit Maliyet</p>
          <p className="text-4xl font-black text-white mb-1">₺{formatCurrency(totalMonthlyCost)}</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Giderler + Maaşlar + Kiralar</p>
        </div>

        {/* Kategori Kartları */}
        <div className="space-y-3">
          {CATEGORY_CARDS.map((card) => (
            <button
              key={card.view}
              onClick={() => setCurrentView(card.view)}
              className="w-full text-left transition-all active:scale-[0.98]"
              style={{
                ...glass,
                padding: 16,
                border: `1px solid ${card.color}bb`,
                boxShadow: `0 4px 32px ${card.color}50`,
              }}
            >
              <div className="flex items-center gap-4">
                <div style={{ width: 48, height: 48, borderRadius: 14, background: `${card.color}55`, border: `1px solid ${card.color}aa`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 22 }}>{card.emoji}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white leading-snug" style={{ fontSize: '1rem' }}>{card.title}</p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{card.subtitle}</p>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: `${card.color}55`, border: `1px solid ${card.color}aa`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ArrowRight style={{ width: 15, height: 15, color: card.color }} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  // PRODUCTS VIEW
  const renderProductsView = () => {
    return (
      <div className="px-6 space-y-4">
        {/* Albums Section */}
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">📸</span>
            <h3 className="font-bold text-white text-lg">ALBÜMLER</h3>
          </div>

          {/* Column header hint */}
          <div className="grid grid-cols-2 gap-3 mb-1 px-1">
            <div className="text-xs text-[#9dd9ea] font-semibold text-center">🔲 Tam Boy</div>
            <div className="text-xs text-[#ffd4a3] font-semibold text-center">▪️ Yarım Boy</div>
          </div>

          <div className="space-y-3">
            {albumCosts.map((album) => {
              const tamBoyTRY = convertToTRY(album.tamBoy, album.currency);
              const yarimBoyTRY = convertToTRY(album.yarimBoy, album.currency);

              return (
                <div key={album.size} className="backdrop-blur-xl bg-white/5 border border-white/20 rounded-xl p-4">
                  {/* Title + currency row */}
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-white">{album.size}'li Albüm</h4>
                    <select
                      value={album.currency}
                      onChange={(e) => {
                        const updated = albumCosts.map(a =>
                          a.size === album.size ? { ...a, currency: e.target.value as Currency } : a
                        );
                        saveAlbumCosts(updated);
                      }}
                      className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:border-[#9dd9ea] transition-all"
                    >
                      <option value="TRY" className="bg-gray-800 text-white">TRY</option>
                      <option value="EUR" className="bg-gray-800 text-white">EUR</option>
                      <option value="USD" className="bg-gray-800 text-white">USD</option>
                      <option value="GBP" className="bg-gray-800 text-white">GBP</option>
                    </select>
                  </div>

                  {/* Price inputs */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Tam Boy */}
                    <div>
                      <label className="text-xs text-[#9dd9ea] font-semibold mb-1.5 block">Tam Boy</label>
                      <input
                        type="number"
                        step="0.01"
                        value={album.tamBoy}
                        onChange={(e) => {
                          const updated = albumCosts.map(a =>
                            a.size === album.size ? { ...a, tamBoy: parseFloat(e.target.value) || 0 } : a
                          );
                          saveAlbumCosts(updated);
                        }}
                        className="w-full px-3 py-2.5 bg-white/10 border border-[#9dd9ea]/40 rounded-lg text-white text-center focus:outline-none focus:border-[#9dd9ea] transition-all"
                      />
                      {album.currency !== 'TRY' && (
                        <div className="text-[10px] text-gray-400 mt-1 text-center">
                          ≈ ₺{formatDecimal(tamBoyTRY)}
                        </div>
                      )}
                    </div>

                    {/* Yarım Boy */}
                    <div>
                      <label className="text-xs text-[#ffd4a3] font-semibold mb-1.5 block">Yarım Boy</label>
                      <input
                        type="number"
                        step="0.01"
                        value={album.yarimBoy}
                        onChange={(e) => {
                          const updated = albumCosts.map(a =>
                            a.size === album.size ? { ...a, yarimBoy: parseFloat(e.target.value) || 0 } : a
                          );
                          saveAlbumCosts(updated);
                        }}
                        className="w-full px-3 py-2.5 bg-white/10 border border-[#ffd4a3]/40 rounded-lg text-white text-center focus:outline-none focus:border-[#ffd4a3] transition-all"
                      />
                      {album.currency !== 'TRY' && (
                        <div className="text-[10px] text-gray-400 mt-1 text-center">
                          ≈ ₺{formatDecimal(yarimBoyTRY)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Papers Section */}
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">📄</span>
            <h3 className="font-bold text-white text-lg">FOTOĞRAF KAĞITLARI</h3>
          </div>

          {papers.length === 0 && !showPaperForm && (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">Henüz kağıt tipi eklenmemiş</p>
              <button
                onClick={() => setShowPaperForm(true)}
                className="px-6 py-3 bg-gradient-to-r from-[#9dd9ea] to-[#7ec8dd] rounded-xl text-white font-bold hover:scale-105 transition-all active:scale-95 inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                İlk Kağıdı Ekle
              </button>
            </div>
          )}

          {papers.length > 0 && !showPaperForm && (
            <div className="space-y-3">
              {papers.map((paper) => {
                const unitCost = paper.boxPrice / paper.pcsPerBox;
                const unitCostTRY = convertToTRY(unitCost, paper.currency);
                const boxTotalTRY = convertToTRY(paper.boxPrice, paper.currency);

                return (
                  <div key={paper.id} className="backdrop-blur-xl bg-white/5 border border-white/20 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-white">{paper.name}</h4>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEditPaper(paper)}
                          className="p-2 bg-blue-600/60 border border-blue-500/50 rounded-lg text-white hover:scale-110 transition-all active:scale-95"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePaper(paper.id)}
                          className="p-2 bg-red-600/60 border border-red-500/50 rounded-lg text-white hover:scale-110 transition-all active:scale-95"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm text-gray-300">
                      <div>Kutu Fiyatı: {paper.boxPrice} {paper.currency}</div>
                      <div>Kutu İçi Adet: {paper.pcsPerBox} baskı</div>
                      <div>Kutu İçi Takım: {paper.setsPerBox ?? 1} takım</div>
                      <div className="border-t border-white/10 my-2 pt-2 space-y-1">
                        <div className="font-semibold text-white">
                          Takım Başına: {formatDecimal(paper.boxPrice / (paper.setsPerBox ?? 1))} {paper.currency}
                          {paper.currency !== 'TRY' && (
                            <span className="text-xs text-gray-400 ml-1">
                              (≈ ₺{formatDecimal(convertToTRY(paper.boxPrice / (paper.setsPerBox ?? 1), paper.currency))})
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400">
                          Baskı Başına: {formatDecimal(unitCost)} {paper.currency}
                          {paper.currency !== 'TRY' && ` (≈ ₺${formatDecimal(unitCostTRY)})`}
                        </div>
                      </div>
                      <div>Kutu TL: ₺{formatCurrency(boxTotalTRY)}</div>
                    </div>
                  </div>
                );
              })}

              <button
                onClick={() => setShowPaperForm(true)}
                className="w-full py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white font-semibold hover:bg-white/20 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Yeni Kağıt Tipi Ekle
              </button>
            </div>
          )}

          {/* Paper Form */}
          {showPaperForm && (
            <div className="space-y-4 border-t border-white/20 pt-4 mt-4">
              <div>
                <label className="text-sm font-semibold text-gray-300 mb-2 block">Kağıt Türü / Marka:</label>
                <input
                  type="text"
                  value={paperForm.name}
                  onChange={(e) => setPaperForm({ ...paperForm, name: e.target.value })}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#9dd9ea] transition-all"
                  placeholder="Örn: Premium Mat Kağıt"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-300 mb-2 block">Kutu Fiyatı:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={paperForm.boxPrice}
                    onChange={(e) => setPaperForm({ ...paperForm, boxPrice: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#9dd9ea] transition-all"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-300 mb-2 block">Para Birimi:</label>
                  <select
                    value={paperForm.currency}
                    onChange={(e) => setPaperForm({ ...paperForm, currency: e.target.value as Currency })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-[#9dd9ea] transition-all"
                  >
                    <option value="TRY" className="bg-gray-800 text-white">TRY</option>
                    <option value="EUR" className="bg-gray-800 text-white">EUR</option>
                    <option value="USD" className="bg-gray-800 text-white">USD</option>
                    <option value="GBP" className="bg-gray-800 text-white">GBP</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-300 mb-2 block">Kutu İçi Adet:</label>
                  <input
                    type="number"
                    value={paperForm.pcsPerBox}
                    onChange={(e) => setPaperForm({ ...paperForm, pcsPerBox: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#9dd9ea] transition-all"
                    placeholder="Örn: 500"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-300 mb-2 block">Kutu İçi Takım:</label>
                  <input
                    type="number"
                    value={paperForm.setsPerBox}
                    onChange={(e) => setPaperForm({ ...paperForm, setsPerBox: e.target.value })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#9dd9ea] transition-all"
                    placeholder="Örn: 2"
                  />
                </div>
              </div>

              {/* Preview */}
              {paperForm.boxPrice && paperForm.pcsPerBox && (
                <div className="p-4 bg-[#9dd9ea]/10 border border-[#9dd9ea]/30 rounded-xl">
                  <h5 className="text-sm font-bold text-[#9dd9ea] mb-3">📊 Hesaplanan Değerler:</h5>
                  <div className="space-y-1.5 text-sm text-white">
                    {paperForm.setsPerBox && parseInt(paperForm.setsPerBox) > 0 && (
                      <div className="font-semibold">
                        Takım Başına: {formatDecimal(parseFloat(paperForm.boxPrice) / parseInt(paperForm.setsPerBox))} {paperForm.currency}
                        {paperForm.currency !== 'TRY' && (
                          <span className="text-xs text-gray-300 ml-1">
                            (≈ ₺{formatDecimal(convertToTRY(parseFloat(paperForm.boxPrice) / parseInt(paperForm.setsPerBox), paperForm.currency))})
                          </span>
                        )}
                      </div>
                    )}
                    <div className="text-xs text-gray-300">
                      Baskı Başına: {formatDecimal(parseFloat(paperForm.boxPrice) / parseFloat(paperForm.pcsPerBox))} {paperForm.currency}
                      {paperForm.currency !== 'TRY' && (
                        <span className="ml-1">
                          (≈ {formatDecimal(convertToTRY(parseFloat(paperForm.boxPrice) / parseFloat(paperForm.pcsPerBox), paperForm.currency))} TL)
                        </span>
                      )}
                    </div>
                    <div>Kutu Toplam: ₺{formatCurrency(convertToTRY(parseFloat(paperForm.boxPrice), paperForm.currency))}</div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={editingPaper ? handleUpdatePaper : handleAddPaper}
                  className="flex-1 py-3 bg-gradient-to-r from-[#a8e6cf] to-[#8fd4b8] rounded-xl text-white font-bold hover:scale-105 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  Kaydet
                </button>
                <button
                  onClick={resetPaperForm}
                  className="px-6 py-3 bg-white/10 border border-white/20 rounded-xl text-white font-semibold hover:bg-white/20 transition-all active:scale-95"
                >
                  ❌ İptal
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // RECURRING COSTS VIEW
  const renderRecurringView = () => {
    const totalMonthly = recurringCosts.reduce((sum, cost) => {
      const amountTRY = convertToTRY(cost.amount, cost.currency);
      return sum + convertToMonthly(amountTRY, cost.frequency);
    }, 0);

    return (
      <div className="px-6 space-y-4">
        {/* Header */}
        <div className="backdrop-blur-xl bg-gradient-to-br from-[#ffd4a3]/20 to-[#ffc78f]/10 border border-[#ffd4a3]/30 rounded-2xl p-5 text-center">
          <p className="text-sm text-gray-300 mb-2">Toplam Aylık</p>
          <p className="text-3xl font-bold text-white">₺{formatCurrency(totalMonthly)}</p>
        </div>

        {recurringCosts.length === 0 && !showRecurringForm && (
          <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-8 text-center">
            <p className="text-gray-400 mb-4">Henüz gider eklenmemiş</p>
            <button
              onClick={() => setShowRecurringForm(true)}
              className="px-6 py-3 bg-gradient-to-r from-[#ffd4a3] to-[#ffc78f] rounded-xl text-white font-bold hover:scale-105 transition-all active:scale-95 inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              İlk Gideri Ekle
            </button>
          </div>
        )}

        {recurringCosts.length > 0 && !showRecurringForm && (
          <div className="space-y-3">
            {recurringCosts.map((cost) => {
              const amountTRY = convertToTRY(cost.amount, cost.currency);
              const monthlyTRY = convertToMonthly(amountTRY, cost.frequency);

              return (
                <div key={cost.id} className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-bold text-white flex items-center gap-2">
                        <span>🏢</span>
                        {cost.name}
                      </h4>
                      <p className="text-sm text-gray-400">{cost.amount} {cost.currency} / {cost.frequency === 'daily' ? 'Gün' : cost.frequency === 'weekly' ? 'Hafta' : cost.frequency === 'monthly' ? 'Ay' : 'Yıl'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditRecurring(cost)}
                        className="p-2 bg-blue-600/60 border border-blue-500/50 rounded-lg text-white hover:scale-110 transition-all active:scale-95"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteRecurring(cost.id)}
                        className="p-2 bg-red-600/60 border border-red-500/50 rounded-lg text-white hover:scale-110 transition-all active:scale-95"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="p-3 bg-[#ffd4a3]/10 border border-[#ffd4a3]/30 rounded-xl">
                    <div className="text-sm font-bold text-white">Aylık Maliyet: ₺{formatCurrency(monthlyTRY)}</div>
                    {cost.currency !== 'TRY' && (
                      <div className="text-xs text-gray-400 mt-1">
                        {cost.amount} {cost.currency} × {formatDecimal(exchangeRates[cost.currency])} = ₺{formatCurrency(amountTRY)} / {cost.frequency === 'daily' ? 'Gün' : cost.frequency === 'weekly' ? 'Hafta' : cost.frequency === 'monthly' ? 'Ay' : 'Yıl'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <button
              onClick={() => setShowRecurringForm(true)}
              className="w-full py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white font-semibold hover:bg-white/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Yeni Gider Ekle
            </button>
          </div>
        )}

        {/* Recurring Form */}
        {showRecurringForm && (
          <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5 space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-300 mb-2 block">Gider Adı:</label>
              <input
                type="text"
                value={recurringForm.name}
                onChange={(e) => setRecurringForm({ ...recurringForm, name: e.target.value })}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#ffd4a3] transition-all"
                placeholder="Örn: Ofis Kirası"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold text-gray-300 mb-2 block">Tutar:</label>
                <input
                  type="number"
                  step="0.01"
                  value={recurringForm.amount}
                  onChange={(e) => setRecurringForm({ ...recurringForm, amount: e.target.value })}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#ffd4a3] transition-all"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-300 mb-2 block">Para Birimi:</label>
                <select
                  value={recurringForm.currency}
                  onChange={(e) => setRecurringForm({ ...recurringForm, currency: e.target.value as Currency })}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-[#ffd4a3] transition-all"
                >
                  <option value="TRY" className="bg-gray-800 text-white">TRY</option>
                  <option value="EUR" className="bg-gray-800 text-white">EUR</option>
                  <option value="USD" className="bg-gray-800 text-white">USD</option>
                  <option value="GBP" className="bg-gray-800 text-white">GBP</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-300 mb-2 block">Periyot:</label>
              <div className="grid grid-cols-2 gap-2">
                {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((freq) => (
                  <button
                    key={freq}
                    onClick={() => setRecurringForm({ ...recurringForm, frequency: freq })}
                    className={`py-3 rounded-xl font-semibold transition-all active:scale-95 ${
                      recurringForm.frequency === freq
                        ? 'bg-[#ffd4a3] text-white'
                        : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
                    }`}
                  >
                    {freq === 'daily' ? 'Günlük' : freq === 'weekly' ? 'Haftalık' : freq === 'monthly' ? 'Aylık' : 'Yıllık'}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            {recurringForm.amount && (
              <div className="p-4 bg-[#ffd4a3]/10 border border-[#ffd4a3]/30 rounded-xl">
                <h5 className="text-sm font-bold text-[#ffd4a3] mb-3">📊 Aylık Maliyet:</h5>
                <div className="text-2xl font-bold text-white mb-2">
                  ₺{formatCurrency(convertToMonthly(convertToTRY(parseFloat(recurringForm.amount), recurringForm.currency), recurringForm.frequency))}
                </div>
                {recurringForm.currency !== 'TRY' && (
                  <div className="text-xs text-gray-300">
                    ({recurringForm.amount} {recurringForm.currency} × {formatDecimal(exchangeRates[recurringForm.currency])} = {formatCurrency(convertToTRY(parseFloat(recurringForm.amount), recurringForm.currency))} TL / {recurringForm.frequency === 'daily' ? 'Gün' : recurringForm.frequency === 'weekly' ? 'Hafta' : recurringForm.frequency === 'monthly' ? 'Ay' : 'Yıl'})
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={editingRecurring ? handleUpdateRecurring : handleAddRecurring}
                className="flex-1 py-3 bg-gradient-to-r from-[#a8e6cf] to-[#8fd4b8] rounded-xl text-white font-bold hover:scale-105 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                Kaydet
              </button>
              <button
                onClick={resetRecurringForm}
                className="px-6 py-3 bg-white/10 border border-white/20 rounded-xl text-white font-semibold hover:bg-white/20 transition-all active:scale-95"
              >
                ❌ İptal
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── Rol yardımcıları ─────────────────────
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

  // SALARIES VIEW
  const renderSalariesView = () => {
    const totalMonthly = salaries.reduce((sum, salary) => {
      const salaryTRY = convertToTRY(salary.amount, salary.currency);
      const extraCost = salaryTRY * (salary.extraCostPercentage / 100);
      const totalSalary = salaryTRY + extraCost;
      return sum + convertToMonthly(totalSalary, salary.frequency);
    }, 0);

    return (
      <div className="px-6 space-y-4">
        {/* Header */}
        <div className="backdrop-blur-xl bg-gradient-to-br from-[#a8e6cf]/20 to-[#8fd4b8]/10 border border-[#a8e6cf]/30 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#a8e6cf]" />
              <span className="text-sm font-semibold text-[#a8e6cf]">{salaries.length} Personel</span>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400">Yıllık</div>
              <div className="text-sm font-bold text-[#a8e6cf]">₺{formatCurrency(totalMonthly * 12)}</div>
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-1">Toplam Aylık Maliyet</p>
          <p className="text-3xl font-bold text-white">₺{formatCurrency(totalMonthly)}</p>
        </div>

        {salaries.length === 0 && !showSalaryForm && (
          <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-white font-semibold mb-1">Henüz maaş kaydı yok</p>
            <p className="text-gray-400 text-sm mb-4">Sistemdeki personeli seçerek maaş ve ek gider bilgilerini ekleyin</p>
            <button
              onClick={() => setShowSalaryForm(true)}
              className="px-6 py-3 bg-gradient-to-r from-[#a8e6cf] to-[#8fd4b8] rounded-xl text-white font-bold hover:scale-105 transition-all active:scale-95 inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Personel Ekle
            </button>
          </div>
        )}

        {salaries.length > 0 && !showSalaryForm && (
          <div className="space-y-3">
            {salaries.map((salary) => {
              const salaryTRY = convertToTRY(salary.amount, salary.currency);
              const extraCost = salaryTRY * (salary.extraCostPercentage / 100);
              const totalSalary = salaryTRY + extraCost;
              const monthlyTRY = convertToMonthly(totalSalary, salary.frequency);

              return (
                <div key={salary.id} className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-xl shrink-0">
                        {salary.userRole ? roleAvatars[salary.userRole] || '👤' : '👤'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-white truncate">{salary.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          {salary.userRole && (
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${roleColors[salary.userRole] || 'bg-white/10 text-gray-300 border-white/20'}`}>
                              {roleLabels[salary.userRole] || salary.userRole}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {salary.amount} {salary.currency} / {salary.frequency === 'daily' ? 'Gün' : salary.frequency === 'weekly' ? 'Hafta' : salary.frequency === 'monthly' ? 'Ay' : 'Yıl'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => startEditSalary(salary)}
                        className="p-2 bg-blue-600/60 border border-blue-500/50 rounded-lg text-white hover:scale-110 transition-all active:scale-95"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSalary(salary.id)}
                        className="p-2 bg-red-600/60 border border-red-500/50 rounded-lg text-white hover:scale-110 transition-all active:scale-95"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="p-3 bg-[#a8e6cf]/10 border border-[#a8e6cf]/30 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-gray-400 mb-0.5">Aylık Toplam Maliyet (+%{salary.extraCostPercentage} ek)</div>
                        <div className="text-lg font-bold text-white">₺{formatCurrency(monthlyTRY)}/ay</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-400 mb-0.5">Yıllık</div>
                        <div className="text-sm font-semibold text-[#a8e6cf]">₺{formatCurrency(monthlyTRY * 12)}</div>
                      </div>
                    </div>
                    {salary.currency !== 'TRY' && (
                      <div className="text-xs text-gray-400 mt-2 border-t border-white/10 pt-2">
                        {salary.amount} {salary.currency} × {formatDecimal(exchangeRates[salary.currency])} = ₺{formatCurrency(salaryTRY)} + %{salary.extraCostPercentage}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <button
              onClick={() => setShowSalaryForm(true)}
              className="w-full py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white font-semibold hover:bg-white/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Yeni Maaş Ekle
            </button>
          </div>
        )}

        {/* Salary Form */}
        {showSalaryForm && (
          <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-white/10">
              <div className="w-8 h-8 rounded-xl bg-[#a8e6cf]/20 border border-[#a8e6cf]/30 flex items-center justify-center">
                <Users className="w-4 h-4 text-[#a8e6cf]" />
              </div>
              <h3 className="font-bold text-white">{editingSalary ? 'Maaş Düzenle' : 'Yeni Maaş Kaydı'}</h3>
            </div>
            {/* Personel Seçici */}
            <div>
              <label className="text-sm font-semibold text-gray-300 mb-2 block flex items-center gap-2">
                <Users className="w-4 h-4 text-[#a8e6cf]" />
                Personel Seç:
              </label>
              <div className="relative" ref={userPickerRef}>
                <button
                  type="button"
                  onClick={() => setShowUserPicker(prev => !prev)}
                  className={`w-full px-4 py-3 bg-white/10 border rounded-xl text-left flex items-center justify-between transition-all ${
                    showUserPicker ? 'border-[#a8e6cf] ring-1 ring-[#a8e6cf]/30' : 'border-white/20 hover:border-white/40'
                  }`}
                >
                  {salaryForm.name ? (
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{salaryForm.userRole ? roleAvatars[salaryForm.userRole] || '👤' : '👤'}</span>
                      <div>
                        <div className="text-white font-semibold text-sm">{salaryForm.name}</div>
                        {salaryForm.userRole && (
                          <div className="text-xs text-gray-400">{roleLabels[salaryForm.userRole] || salaryForm.userRole}</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">Sistemden personel seçin...</span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showUserPicker ? 'rotate-180' : ''}`} />
                </button>

                {showUserPicker && (
                  <div className="absolute top-full left-0 right-0 mt-2 backdrop-blur-2xl bg-black/90 border border-white/20 rounded-2xl shadow-2xl z-50 overflow-hidden">
                    {/* Arama */}
                    <div className="p-3 border-b border-white/10">
                      <input
                        type="text"
                        placeholder="İsim ara..."
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#a8e6cf]"
                        onChange={(e) => {
                          const q = e.target.value.toLowerCase();
                          // filter handled inline below via local state
                          (e.target as any)._filterQuery = q;
                          e.target.closest('.relative')?.querySelectorAll('[data-user-item]').forEach((el: any) => {
                            const name = el.dataset.userName?.toLowerCase() || '';
                            el.style.display = name.includes(q) ? '' : 'none';
                          });
                        }}
                      />
                    </div>
                    <div className="max-h-60 overflow-y-auto py-2">
                      {systemUsers.length === 0 ? (
                        <div className="px-4 py-6 text-center text-gray-400 text-sm">Kullanıcı bulunamadı</div>
                      ) : (
                        systemUsers.filter(u => !['superadmin', 'yonetici'].includes(u.rol)).map((user) => {
                          const isSelected = salaryForm.userId === user.id;
                          const hasExistingSalary = salaries.some(s => s.userId === user.id && (!editingSalary || s.id !== editingSalary.id));
                          return (
                            <button
                              key={user.id}
                              type="button"
                              data-user-item
                              data-user-name={user.ad}
                              onClick={() => {
                                setSalaryForm(prev => ({
                                  ...prev,
                                  name: user.ad,
                                  userId: user.id,
                                  userRole: user.rol,
                                }));
                                setShowUserPicker(false);
                              }}
                              className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-white/10 transition-all text-left ${
                                isSelected ? 'bg-[#a8e6cf]/10' : ''
                              }`}
                            >
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                                isSelected ? 'bg-[#a8e6cf]/20 border border-[#a8e6cf]/40' : 'bg-white/10 border border-white/15'
                              }`}>
                                {roleAvatars[user.rol] || '👤'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-white text-sm font-semibold truncate">{user.ad}</span>
                                  {hasExistingSalary && (
                                    <span className="text-xs px-1.5 py-0.5 bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded-full shrink-0">Maaş var</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full border ${roleColors[user.rol] || 'bg-white/10 text-gray-400 border-white/20'}`}>
                                    {roleLabels[user.rol] || user.rol}
                                  </span>
                                  <span className="text-xs text-gray-500 truncate">{user.email}</span>
                                </div>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-[#a8e6cf] shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold text-gray-300 mb-2 block">Maaş:</label>
                <input
                  type="number"
                  step="0.01"
                  value={salaryForm.amount}
                  onChange={(e) => setSalaryForm({ ...salaryForm, amount: e.target.value })}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#a8e6cf] transition-all"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-300 mb-2 block">Para Birimi:</label>
                <select
                  value={salaryForm.currency}
                  onChange={(e) => setSalaryForm({ ...salaryForm, currency: e.target.value as Currency })}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-[#a8e6cf] transition-all"
                >
                  <option value="TRY" className="bg-gray-800 text-white">TRY</option>
                  <option value="EUR" className="bg-gray-800 text-white">EUR</option>
                  <option value="USD" className="bg-gray-800 text-white">USD</option>
                  <option value="GBP" className="bg-gray-800 text-white">GBP</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-300 mb-2 block">Ek Gider Oranı (%):</label>
              <input
                type="number"
                min="0"
                max="100"
                value={salaryForm.extraCostPercentage}
                onChange={(e) => setSalaryForm({ ...salaryForm, extraCostPercentage: e.target.value })}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#a8e6cf] transition-all"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-300 mb-2 block">Periyot:</label>
              <div className="grid grid-cols-2 gap-2">
                {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((freq) => (
                  <button
                    key={freq}
                    onClick={() => setSalaryForm({ ...salaryForm, frequency: freq })}
                    className={`py-3 rounded-xl font-semibold transition-all active:scale-95 ${
                      salaryForm.frequency === freq
                        ? 'bg-[#a8e6cf] text-white'
                        : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
                    }`}
                  >
                    {freq === 'daily' ? 'Günlük' : freq === 'weekly' ? 'Haftalık' : freq === 'monthly' ? 'Aylık' : 'Yıllık'}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            {salaryForm.amount && (
              <div className="p-4 bg-[#a8e6cf]/10 border border-[#a8e6cf]/30 rounded-xl">
                <h5 className="text-sm font-bold text-[#a8e6cf] mb-3">📊 Toplam Maliyet:</h5>
                <div className="space-y-1 text-sm text-white">
                  <div>Maaş: ₺{formatCurrency(convertToTRY(parseFloat(salaryForm.amount), salaryForm.currency))}</div>
                  <div>Ek Gider (%{salaryForm.extraCostPercentage}): ₺{formatCurrency(convertToTRY(parseFloat(salaryForm.amount), salaryForm.currency) * (parseFloat(salaryForm.extraCostPercentage) / 100))}</div>
                  <div className="border-t border-[#a8e6cf]/30 my-2 pt-2">
                    <div className="text-2xl font-bold">
                      ₺{formatCurrency(convertToMonthly(convertToTRY(parseFloat(salaryForm.amount), salaryForm.currency) * (1 + parseFloat(salaryForm.extraCostPercentage) / 100), salaryForm.frequency))}/ay
                    </div>
                  </div>
                  {salaryForm.currency !== 'TRY' && (
                    <div className="text-xs text-gray-300">
                      ({salaryForm.amount} {salaryForm.currency} × {formatDecimal(exchangeRates[salaryForm.currency])} = ₺{formatCurrency(convertToTRY(parseFloat(salaryForm.amount), salaryForm.currency))} / {salaryForm.frequency === 'daily' ? 'Gün' : salaryForm.frequency === 'weekly' ? 'Hafta' : salaryForm.frequency === 'monthly' ? 'Ay' : 'Yıl'})
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={editingSalary ? handleUpdateSalary : handleAddSalary}
                disabled={isSaving}
                className="flex-1 py-3 bg-gradient-to-r from-[#a8e6cf] to-[#8fd4b8] rounded-xl text-white font-bold hover:scale-105 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60 disabled:scale-100"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
              <button
                onClick={resetSalaryForm}
                className="px-6 py-3 bg-white/10 border border-white/20 rounded-xl text-white font-semibold hover:bg-white/20 transition-all active:scale-95"
              >
                ❌ İptal
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // RENTS VIEW (READ-ONLY)
  const renderRentsView = () => {
    const safeLocations = locations || [];
    const totalYearly = safeLocations.reduce((sum, loc) => sum + loc.yearlyRent, 0);
    const totalMonthly = totalYearly / 12;

    return (
      <div className="px-6 space-y-4">
        {/* Summary Card */}
        <div className="backdrop-blur-xl bg-gradient-to-br from-[#d4b5f7]/20 to-[#c49fef]/10 border border-[#d4b5f7]/30 rounded-2xl p-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-300 mb-2">Toplam Yıllık Kira</p>
              <p className="text-3xl font-bold text-white">₺{formatCurrency(totalYearly)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-300 mb-2">Aylık Maliyet</p>
              <p className="text-2xl font-bold text-[#d4b5f7]">₺{formatCurrency(totalMonthly)}</p>
            </div>
          </div>
        </div>

        {/* Locations List */}
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">📍</span>
            <h3 className="font-bold text-white text-lg">MEKANLAR</h3>
          </div>

          {safeLocations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-2">Henüz mekan eklenmemiş</p>
              <p className="text-sm text-gray-500">Mekanlar, Mekan Yönetimi'nden otomatik olarak alınır</p>
            </div>
          ) : (
            <div className="space-y-3">
              {safeLocations.map((location) => {
                const monthlyRent = location.yearlyRent / 12;
                const dailyRent = monthlyRent / 30;

                return (
                  <div
                    key={location.id}
                    className="backdrop-blur-xl bg-white/5 rounded-xl p-4"
                    style={{ borderLeft: `4px solid ${location.color}40` }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                        style={{ backgroundColor: `${location.color}40` }}
                      >
                        {location.emoji}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-lg">{location.name}</h4>
                        <p className="text-sm text-gray-400">Yıllık Kira: ₺{formatCurrency(location.yearlyRent)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-white/5 rounded-lg">
                        <p className="text-xs text-gray-400 mb-1">Aylık Kira</p>
                        <p className="text-lg font-bold text-white">₺{formatCurrency(monthlyRent)}</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-lg">
                        <p className="text-xs text-gray-400 mb-1">Günlük Kira</p>
                        <p className="text-lg font-bold text-white">₺{formatCurrency(dailyRent)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Info Note */}
        <div className="backdrop-blur-xl bg-[#9dd9ea]/10 border border-[#9dd9ea]/30 rounded-2xl p-4">
          <p className="text-sm text-gray-300">
            💡 <strong>Not:</strong> Mekanlar ve kiraları, Mekan Yönetimi sayfasından otomatik olarak yüklenir. 
            Yeni mekan eklemek veya kira tutarlarını değiştirmek için Mekan Yönetimi'ne gidin.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="pb-28 min-h-screen" style={{ background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%))' }}>
      {/* Header */}
      <div className="sticky top-0 z-[5]" style={{ backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', background: 'rgba(42,42,58,0.92)', borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            {currentView !== 'main' && (
              <button onClick={() => setCurrentView('main')} className="w-9 h-9 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center active:scale-95 transition-all shrink-0">
                <ChevronLeft className="w-4 h-4 text-white/70" />
              </button>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white">
                  {currentView === 'main'      && 'Maliyet Yönetimi'}
                  {currentView === 'products'  && 'Ürün Maliyetleri'}
                  {currentView === 'recurring' && 'Düzenli Giderler'}
                  {currentView === 'salaries'  && 'Personel Maaşları'}
                  {currentView === 'rents'     && 'Mekan Kiraları'}
                  {currentView === 'cariler'   && 'Cariler'}
                </h1>
                {currentView === 'main' && <span className="text-xl">💰</span>}
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#9dd9ea' }} />}
              </div>
              <p className="text-xs font-medium" style={{ color: 'rgba(var(--app-accent-rgb),0.5)' }}>
                {currentView === 'main'      && 'Sabit maliyetlerinizi yönetin'}
                {currentView === 'products'  && 'Albümler ve kağıt maliyetleri'}
                {currentView === 'recurring' && 'Düzenli gider takibi'}
                {currentView === 'salaries'  && 'Personel maaş yönetimi'}
                {currentView === 'rents'     && 'Mekan kiraları (Sadece görüntüleme)'}
                {currentView === 'cariler'   && 'Tedarikçi ve cari hesap yönetimi'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Loading / Error / Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="w-10 h-10 animate-spin" style={{ color: '#9dd9ea' }} />
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Veriler yükleniyor...</p>
        </div>
      ) : apiError ? (
        <div className="px-4 pt-8 text-center">
          <p className="text-red-400 mb-4">{apiError}</p>
          <button
            onClick={fetchData}
            style={{ padding: '12px 24px', background: 'rgba(157,217,234,0.15)', border: '1px solid rgba(157,217,234,0.35)', borderRadius: 14, color: 'white', fontWeight: 600 }}
          >
            Tekrar Dene
          </button>
        </div>
      ) : (
        <div className="pt-4">
          {currentView === 'main'      && renderMainView()}
          {currentView === 'products'  && renderProductsView()}
          {currentView === 'recurring' && renderRecurringView()}
          {currentView === 'salaries'  && renderSalariesView()}
          {currentView === 'rents'     && renderRentsView()}
          {currentView === 'cariler'   && renderCarilerView()}
        </div>
      )}
    </div>
  );
}
