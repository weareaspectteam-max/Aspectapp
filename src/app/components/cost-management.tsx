import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Edit2, Trash2, Save, ChevronRight, Plus, RefreshCw, Loader2 } from 'lucide-react';
import { projectId } from '/utils/supabase/info';
import { getToken, buildHeaders } from '../lib/api';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

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
}

type Currency = 'TRY' | 'EUR' | 'USD' | 'GBP';
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
  amount: number;
  currency: Currency;
  frequency: Frequency;
  extraCostPercentage: number;
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

type ViewType = 'main' | 'products' | 'recurring' | 'salaries' | 'rents';

export function CostManagement({ userName, userRole, accessToken, onLogout, onNavigate }: CostManagementProps) {
  const [currentView, setCurrentView] = useState<ViewType>('main');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  
  // Exchange rates
  const [isAutoExchange, setIsAutoExchange] = useState(false);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>({
    EUR: 35.50,
    USD: 32.80,
    GBP: 41.20,
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
    amount: '',
    currency: 'TRY' as Currency,
    frequency: 'monthly' as Frequency,
    extraCostPercentage: '15',
  });

  const albumDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exchangeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Token helper ───────────────────────────────────────
  // getToken ve buildHeaders artık ../lib/api'den geliyor

  // ─── Veri yükle — sadece mount'ta bir kez ────────────────
  const fetchData = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const token = await getToken();
      const freshHeaders = buildHeaders(token);
      const [costRes, mekanRes] = await Promise.all([
        fetch(`${API_BASE}/maliyetler`, { headers: freshHeaders }),
        fetch(`${API_BASE}/mekanlar`, { headers: freshHeaders }),
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
      }

      if (mekanRes.ok) {
        const mekanData = await mekanRes.json();
        setLocations(mekanData.mekanlar || []);
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
      alert('Lütfen tüm alanları doldurun!');
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
      alert('Lütfen tüm alanları doldurun!');
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
    setSalaryForm({
      name: '',
      amount: '',
      currency: 'TRY',
      frequency: 'monthly',
      extraCostPercentage: '15',
    });
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

    return (
      <div className="px-6 space-y-4">
        {/* Exchange Rates Card */}
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">💱</span>
            <h3 className="font-bold text-white text-lg">Döviz Kurları</h3>
          </div>

          {/* Toggle */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm text-gray-300">Manuel Giriş</span>
            <button
              onClick={() => {
                const newAuto = !isAutoExchange;
                saveExchangeRates(exchangeRates, newAuto);
              }}
              className={`relative w-14 h-7 rounded-full transition-all ${
                isAutoExchange ? 'bg-[#9dd9ea]' : 'bg-gray-600'
              }`}
            >
              <div
                className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-lg transition-all ${
                  isAutoExchange ? 'right-1' : 'left-1'
                }`}
              />
            </button>
            <span className="text-sm text-gray-300">Otomatik API</span>
          </div>

          {/* Manual Mode */}
          {!isAutoExchange && (
            <div className="space-y-3">
              {(['EUR', 'USD', 'GBP'] as const).map((currency) => (
                <div key={currency} className="flex items-center gap-3">
                  <span className="text-2xl">
                    {currency === 'EUR' ? '🇪🇺' : currency === 'USD' ? '🇺🇸' : '🇬🇧'}
                  </span>
                  <span className="text-white font-semibold w-12">{currency}:</span>
                  <input
                    type="number"
                    step="0.01"
                    value={exchangeRates[currency].toFixed(2)}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value)) {
                        const newRates = { ...exchangeRates, [currency]: parseFloat(value.toFixed(2)) };
                        saveExchangeRates(newRates, false);
                      }
                    }}
                    onBlur={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value)) {
                        e.target.value = value.toFixed(2);
                      }
                    }}
                    className="w-32 px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-[#9dd9ea] transition-all"
                  />
                  <span className="text-gray-300">TL</span>
                </div>
              ))}
            </div>
          )}

          {/* Auto Mode */}
          {isAutoExchange && (
            <div className="space-y-3">
              <div className="space-y-2">
                {(['EUR', 'USD', 'GBP'] as const).map((currency) => (
                  <div key={currency} className="flex items-center justify-between py-2 px-4 bg-white/5 rounded-xl">
                    <span className="text-white font-semibold">{currency}:</span>
                    <span className="text-white font-bold">{formatDecimal(exchangeRates[currency])} TL</span>
                  </div>
                ))}
              </div>
              <button
                onClick={fetchExchangeRates}
                className="w-full py-3 bg-gradient-to-r from-[#9dd9ea] to-[#7ec8dd] rounded-xl text-white font-bold hover:scale-105 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                Kurları Güncelle
              </button>
            </div>
          )}
        </div>

        {/* Total Cost Summary */}
        <div className="backdrop-blur-xl bg-gradient-to-br from-[#ffd4a3]/20 to-[#ffc78f]/10 border border-[#ffd4a3]/30 rounded-2xl p-6 text-center">
          <p className="text-sm text-gray-300 mb-2">Toplam Aylık Sabit Maliyet</p>
          <p className="text-4xl font-bold text-white mb-2">₺{formatCurrency(totalMonthlyCost)}</p>
          <p className="text-xs text-gray-400">Giderler + Maaşlar + Kiralar</p>
        </div>

        {/* Category Cards */}
        <div className="space-y-3">
          {/* Product Costs */}
          <button
            onClick={() => setCurrentView('products')}
            className="w-full backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5 hover:scale-[1.02] transition-all active:scale-95"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] flex items-center justify-center">
                  <span className="text-2xl">📸</span>
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-white text-lg mb-1">Ürün Maliyetleri</h3>
                  <p className="text-sm text-gray-400">{albumCosts.length} albüm • {papers.length} kağıt tipi</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-gray-400" />
            </div>
          </button>

          {/* Recurring Costs */}
          <button
            onClick={() => setCurrentView('recurring')}
            className="w-full backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5 hover:scale-[1.02] transition-all active:scale-95"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f] flex items-center justify-center">
                  <span className="text-2xl">🏢</span>
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-white text-lg mb-1">Düzenli Giderler</h3>
                  <p className="text-sm text-gray-400">{recurringCosts.length} gider • ₺{formatCurrency(totalRecurringMonthly)}/ay</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-gray-400" />
            </div>
          </button>

          {/* Salaries */}
          <button
            onClick={() => setCurrentView('salaries')}
            className="w-full backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5 hover:scale-[1.02] transition-all active:scale-95"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#a8e6cf] to-[#8fd4b8] flex items-center justify-center">
                  <span className="text-2xl">👥</span>
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-white text-lg mb-1">Personel Maaşları</h3>
                  <p className="text-sm text-gray-400">{salaries.length} personel • ₺{formatCurrency(totalSalariesMonthly)}/ay</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-gray-400" />
            </div>
          </button>

          {/* Location Rents */}
          <button
            onClick={() => setCurrentView('rents')}
            className="w-full backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5 hover:scale-[1.02] transition-all active:scale-95"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#d4b5f7] to-[#c49fef] flex items-center justify-center">
                  <span className="text-2xl">📍</span>
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-white text-lg mb-1">Mekan Kiraları</h3>
                  <p className="text-sm text-gray-400">{(locations || []).length} mekan • ₺{formatCurrency(totalRentsMonthly)}/ay</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-gray-400" />
            </div>
          </button>
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
        <div className="backdrop-blur-xl bg-gradient-to-br from-[#a8e6cf]/20 to-[#8fd4b8]/10 border border-[#a8e6cf]/30 rounded-2xl p-5 text-center">
          <p className="text-sm text-gray-300 mb-2">Toplam Aylık</p>
          <p className="text-3xl font-bold text-white">₺{formatCurrency(totalMonthly)}</p>
        </div>

        {salaries.length === 0 && !showSalaryForm && (
          <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-8 text-center">
            <p className="text-gray-400 mb-4">Henüz personel eklenmemiş</p>
            <button
              onClick={() => setShowSalaryForm(true)}
              className="px-6 py-3 bg-gradient-to-r from-[#a8e6cf] to-[#8fd4b8] rounded-xl text-white font-bold hover:scale-105 transition-all active:scale-95 inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              İlk Personeli Ekle
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
                    <div>
                      <h4 className="font-bold text-white flex items-center gap-2">
                        <span>👤</span>
                        {salary.name}
                      </h4>
                      <p className="text-sm text-gray-400">Maaş: {salary.amount} {salary.currency} / {salary.frequency === 'daily' ? 'Gün' : salary.frequency === 'weekly' ? 'Hafta' : salary.frequency === 'monthly' ? 'Ay' : 'Yıl'}</p>
                    </div>
                    <div className="flex gap-2">
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
                    <div className="text-sm font-bold text-white mb-1">Toplam Maliyet (Ek Gider %{salary.extraCostPercentage}):</div>
                    <div className="text-lg font-bold text-white">₺{formatCurrency(monthlyTRY)}/ay</div>
                    {salary.currency !== 'TRY' && (
                      <div className="text-xs text-gray-400 mt-1">
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
            <div>
              <label className="text-sm font-semibold text-gray-300 mb-2 block">Personel Adı:</label>
              <input
                type="text"
                value={salaryForm.name}
                onChange={(e) => setSalaryForm({ ...salaryForm, name: e.target.value })}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#a8e6cf] transition-all"
                placeholder="Örn: Ahmet Yılmaz"
              />
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
                className="flex-1 py-3 bg-gradient-to-r from-[#a8e6cf] to-[#8fd4b8] rounded-xl text-white font-bold hover:scale-105 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                Kaydet
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
    <div className="pb-20 bg-gradient-to-br from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-[5] backdrop-blur-xl bg-gradient-to-r from-[#2a2a3a]/95 to-[#3a3a4e]/95 border-b border-white/10">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => {
                if (currentView === 'main') {
                  onNavigate('resource-management');
                } else {
                  setCurrentView('main');
                }
              }}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors active:scale-95"
            >
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white">
                  {currentView === 'main' && '💰 Maliyet Yönetimi'}
                  {currentView === 'products' && '📸 Ürün Maliyetleri'}
                  {currentView === 'recurring' && '🏢 Düzenli Giderler'}
                  {currentView === 'salaries' && '👥 Personel Maaşları'}
                  {currentView === 'rents' && '📍 Mekan Kiraları'}
                </h1>
                {isSaving && <Loader2 className="w-4 h-4 text-[#9dd9ea] animate-spin" />}
              </div>
              <p className="text-sm text-gray-400">
                {currentView === 'main' && 'Sabit maliyetlerinizi yönetin'}
                {currentView === 'products' && 'Albümler ve kağıt maliyetleri'}
                {currentView === 'recurring' && 'Düzenli gider takibi'}
                {currentView === 'salaries' && 'Personel maaş yönetimi'}
                {currentView === 'rents' && 'Mekan kiraları (Sadece görüntüleme)'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Loading / Error / Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Loader2 className="w-10 h-10 text-[#9dd9ea] animate-spin" />
          <p className="text-gray-400 text-sm">Veriler yükleniyor...</p>
        </div>
      ) : apiError ? (
        <div className="px-6 pt-8 text-center">
          <p className="text-red-400 mb-4">{apiError}</p>
          <button
            onClick={fetchData}
            className="px-6 py-3 bg-[#9dd9ea]/20 border border-[#9dd9ea]/40 rounded-xl text-white font-semibold"
          >
            Tekrar Dene
          </button>
        </div>
      ) : (
        <div className="pt-4">
          {currentView === 'main' && renderMainView()}
          {currentView === 'products' && renderProductsView()}
          {currentView === 'recurring' && renderRecurringView()}
          {currentView === 'salaries' && renderSalariesView()}
          {currentView === 'rents' && renderRentsView()}
        </div>
      )}
    </div>
  );
}
