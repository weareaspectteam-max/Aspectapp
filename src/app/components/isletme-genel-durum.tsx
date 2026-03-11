import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  Banknote, 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  Filter, 
  Download, 
  FileText, 
  Printer 
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Expense {
  id: string;
  category: 'personel' | 'malzeme' | 'ekipman' | 'operasyonel' | 'ulasim' | 'diger';
  amount: number;
  description: string;
  date: string; // 'YYYY-MM-DD'
  created_at: string;
  created_by: string; // Kullanıcı adı
}

type DateFilter = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'last3months' | 'last6months' | 'last1year' | 'custom';

interface IsletmeGenelDurumProps {
  userName: string;
  userRole: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  onNavigate: (tab: string) => void;
}

export function IsletmeGenelDurum({ userName, userRole, onNavigate }: IsletmeGenelDurumProps) {
  // Get current user role from localStorage
  const getCurrentUserRole = () => {
    // localStorage kaldırıldı - prop'tan alıyoruz
    return userRole || 'personel';
  };

  const currentRole = getCurrentUserRole();

  // Permission checks
  const canAddExpense = ['yonetici', 'ust-mudur', 'mudur', 'idari'].includes(currentRole);
  const canDeleteExpense = ['yonetici', 'idari'].includes(currentRole);

  // Category labels and colors
  const categoryLabels = {
    personel: '💼 Personel',
    malzeme: '📦 Malzeme',
    ekipman: '🖨️ Ekipman & Bakım',
    operasyonel: '🏢 Operasyonel',
    ulasim: '🚗 Ulaşım',
    diger: '📋 Diğer'
  };

  const categoryDescriptions = {
    personel: 'Maaşlar, SGK, Prim, Ulaşım',
    malzeme: 'Fotoğraf Kağıdı, Mürekkep, Albüm',
    ekipman: 'Yazıcı bakım, Kamera bakım, Aksesuar',
    operasyonel: 'Kira, Elektrik, İnternet, Telefon',
    ulasim: 'Benzin, Araç kiralama, Park',
    diger: 'Kırtasiye, Temizlik, Küçük harcamalar'
  };

  const categoryColors = {
    personel: { 
      bg: 'from-purple-500/20 to-purple-600/20', 
      text: 'text-purple-400', 
      border: 'border-purple-500/30',
      progress: 'from-purple-500 to-purple-600'
    },
    malzeme: { 
      bg: 'from-blue-500/20 to-blue-600/20', 
      text: 'text-blue-400', 
      border: 'border-blue-500/30',
      progress: 'from-blue-500 to-blue-600'
    },
    ekipman: { 
      bg: 'from-green-500/20 to-green-600/20', 
      text: 'text-green-400', 
      border: 'border-green-500/30',
      progress: 'from-green-500 to-green-600'
    },
    operasyonel: { 
      bg: 'from-orange-500/20 to-orange-600/20', 
      text: 'text-orange-400', 
      border: 'border-orange-500/30',
      progress: 'from-orange-500 to-orange-600'
    },
    ulasim: { 
      bg: 'from-cyan-500/20 to-cyan-600/20', 
      text: 'text-cyan-400', 
      border: 'border-cyan-500/30',
      progress: 'from-cyan-500 to-cyan-600'
    },
    diger: { 
      bg: 'from-gray-500/20 to-gray-600/20', 
      text: 'text-gray-400', 
      border: 'border-gray-500/30',
      progress: 'from-gray-500 to-gray-600'
    }
  };

  // Mock expenses data (30 items)
  const mockExpenses: Expense[] = [
    { id: 'exp-1', category: 'personel', amount: 45000, description: 'Mart ayı maaş ödemeleri', date: '2026-03-01', created_at: '2026-03-01T10:00:00Z', created_by: 'Ahmet Yılmaz' },
    { id: 'exp-2', category: 'malzeme', amount: 3500, description: 'Fotoğraf kağıdı ve mürekkep alımı', date: '2026-03-02', created_at: '2026-03-02T14:20:00Z', created_by: 'Zeynep Kaya' },
    { id: 'exp-3', category: 'ekipman', amount: 2000, description: 'Yazıcı bakımı ve temizliği', date: '2026-03-03', created_at: '2026-03-03T11:15:00Z', created_by: 'Mehmet Demir' },
    { id: 'exp-4', category: 'operasyonel', amount: 5000, description: 'Aylık kira ödemesi', date: '2026-03-01', created_at: '2026-03-01T09:00:00Z', created_by: 'Ayşe Şahin' },
    { id: 'exp-5', category: 'ulasim', amount: 800, description: 'Benzin ve araç bakımı', date: '2026-03-04', created_at: '2026-03-04T16:30:00Z', created_by: 'Can Öztürk' },
    { id: 'exp-6', category: 'malzeme', amount: 2200, description: 'Albüm stok alımı', date: '2026-02-28', created_at: '2026-02-28T13:00:00Z', created_by: 'Elif Arslan' },
    { id: 'exp-7', category: 'personel', amount: 3000, description: 'Ek mesai ödemeleri', date: '2026-02-27', created_at: '2026-02-27T17:00:00Z', created_by: 'Ahmet Yılmaz' },
    { id: 'exp-8', category: 'diger', amount: 450, description: 'Ofis kırtasiye malzemeleri', date: '2026-02-26', created_at: '2026-02-26T10:30:00Z', created_by: 'Fatma Yıldız' },
    { id: 'exp-9', category: 'operasyonel', amount: 1200, description: 'Elektrik faturası', date: '2026-02-25', created_at: '2026-02-25T14:00:00Z', created_by: 'Ayşe Şahin' },
    { id: 'exp-10', category: 'ekipman', amount: 1500, description: 'Kamera lens temizliği', date: '2026-02-24', created_at: '2026-02-24T11:00:00Z', created_by: 'Mehmet Demir' },
    { id: 'exp-11', category: 'ulasim', amount: 600, description: 'Park ve köprü geçiş ücreti', date: '2026-02-23', created_at: '2026-02-23T15:45:00Z', created_by: 'Can Öztürk' },
    { id: 'exp-12', category: 'malzeme', amount: 4000, description: 'Yeni mürekkep kartuşları', date: '2026-02-22', created_at: '2026-02-22T09:30:00Z', created_by: 'Zeynep Kaya' },
    { id: 'exp-13', category: 'personel', amount: 2500, description: 'SGK primleri', date: '2026-02-21', created_at: '2026-02-21T10:00:00Z', created_by: 'Ahmet Yılmaz' },
    { id: 'exp-14', category: 'diger', amount: 300, description: 'Temizlik malzemeleri', date: '2026-02-20', created_at: '2026-02-20T13:20:00Z', created_by: 'Fatma Yıldız' },
    { id: 'exp-15', category: 'operasyonel', amount: 800, description: 'İnternet ve telefon faturası', date: '2026-02-19', created_at: '2026-02-19T14:30:00Z', created_by: 'Ayşe Şahin' },
    { id: 'exp-16', category: 'ekipman', amount: 3500, description: 'Yazıcı yedek parça değişimi', date: '2026-02-18', created_at: '2026-02-18T11:45:00Z', created_by: 'Mehmet Demir' },
    { id: 'exp-17', category: 'ulasim', amount: 900, description: 'Araç kiralama (haftalık)', date: '2026-02-17', created_at: '2026-02-17T08:00:00Z', created_by: 'Can Öztürk' },
    { id: 'exp-18', category: 'malzeme', amount: 1800, description: 'Fotoğraf kağıdı (10x15)', date: '2026-02-16', created_at: '2026-02-16T10:15:00Z', created_by: 'Elif Arslan' },
    { id: 'exp-19', category: 'personel', amount: 1200, description: 'Ulaşım yardımı', date: '2026-02-15', created_at: '2026-02-15T09:00:00Z', created_by: 'Ahmet Yılmaz' },
    { id: 'exp-20', category: 'diger', amount: 250, description: 'Çay, kahve, su alımı', date: '2026-02-14', created_at: '2026-02-14T16:00:00Z', created_by: 'Fatma Yıldız' },
    { id: 'exp-21', category: 'operasyonel', amount: 600, description: 'Sigorta ödemesi', date: '2026-02-13', created_at: '2026-02-13T11:30:00Z', created_by: 'Ayşe Şahin' },
    { id: 'exp-22', category: 'ekipman', amount: 2800, description: 'Kamera aksesuar alımı', date: '2026-02-12', created_at: '2026-02-12T14:00:00Z', created_by: 'Mehmet Demir' },
    { id: 'exp-23', category: 'ulasim', amount: 750, description: 'Yakıt alımı', date: '2026-02-11', created_at: '2026-02-11T12:30:00Z', created_by: 'Can Öztürk' },
    { id: 'exp-24', category: 'malzeme', amount: 2900, description: 'Albüm ve çerçeve malzemeleri', date: '2026-02-10', created_at: '2026-02-10T10:00:00Z', created_by: 'Elif Arslan' },
    { id: 'exp-25', category: 'personel', amount: 4000, description: 'Performans primleri', date: '2026-02-09', created_at: '2026-02-09T15:00:00Z', created_by: 'Ahmet Yılmaz' },
    { id: 'exp-26', category: 'diger', amount: 400, description: 'Küçük onarım giderleri', date: '2026-02-08', created_at: '2026-02-08T13:00:00Z', created_by: 'Fatma Yıldız' },
    { id: 'exp-27', category: 'operasyonel', amount: 1500, description: 'Su ve doğalgaz faturası', date: '2026-02-07', created_at: '2026-02-07T09:30:00Z', created_by: 'Ayşe Şahin' },
    { id: 'exp-28', category: 'ekipman', amount: 1800, description: 'Yazıcı bakım sözleşmesi', date: '2026-02-06', created_at: '2026-02-06T11:00:00Z', created_by: 'Mehmet Demir' },
    { id: 'exp-29', category: 'ulasim', amount: 550, description: 'Otopark aboneliği', date: '2026-02-05', created_at: '2026-02-05T10:30:00Z', created_by: 'Can Öztürk' },
    { id: 'exp-30', category: 'malzeme', amount: 3200, description: 'Özel albüm kağıdı alımı', date: '2026-02-04', created_at: '2026-02-04T14:45:00Z', created_by: 'Zeynep Kaya' }
  ];

  // States
  const [expenses, setExpenses] = useState<Expense[]>(mockExpenses);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [displayLimit, setDisplayLimit] = useState(15);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState({
    category: 'personel' as Expense['category'],
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Reset pagination when filters change
  useEffect(() => {
    setDisplayLimit(15);
  }, [dateFilter, categoryFilter, searchQuery]);

  // Get total revenue (mock for now, will be connected to sales data later)
  const getTotalRevenue = () => {
    // TODO: Quick Sales localStorage entegrasyonu sonrası:
    // const sales = JSON.parse(localStorage.getItem('aspect_sales') || '[]');
    // return sales.reduce((sum, sale) => sum + sale.price, 0);
    
    return 125450; // Mock değer
  };

  // Filter expenses by date
  const getFilteredExpenses = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // "Bu Hafta" → Pazartesiden bugüne
    const startOfWeek = new Date(today);
    const dayOfWeek = startOfWeek.getDay(); // 0 = Pazar, 1 = Pazartesi
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(startOfWeek.getDate() - daysToMonday);
    
    // "Bu Ay" → Ayın 1'inden bugüne
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // "Son 3 Ay" → 3 ay öncenin 1'inden bugüne
    const startOfLast3Months = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    
    // "Son 6 Ay"
    const startOfLast6Months = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    
    // "Son 1 Yıl"
    const startOfLast1Year = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    
    return expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      
      // Date filter
      let dateMatch = true;
      switch (dateFilter) {
        case 'today':
          dateMatch = expenseDate >= today;
          break;
        case 'yesterday':
          dateMatch = expenseDate >= yesterday && expenseDate < today;
          break;
        case 'week':
          dateMatch = expenseDate >= startOfWeek;
          break;
        case 'month':
          dateMatch = expenseDate >= startOfMonth;
          break;
        case 'last3months':
          dateMatch = expenseDate >= startOfLast3Months;
          break;
        case 'last6months':
          dateMatch = expenseDate >= startOfLast6Months;
          break;
        case 'last1year':
          dateMatch = expenseDate >= startOfLast1Year;
          break;
        case 'custom':
          if (customStartDate && customEndDate) {
            const start = new Date(customStartDate);
            const end = new Date(customEndDate);
            dateMatch = expenseDate >= start && expenseDate <= end;
          } else {
            dateMatch = false;
          }
          break;
        default: // 'all'
          dateMatch = true;
      }
      
      // Role-based category filter
      let roleBasedCategoryMatch = true;
      if (currentRole === 'operasyon') {
        // Operasyon rolü sadece ekipman ve ulaşım görebilir
        roleBasedCategoryMatch = expense.category === 'ekipman' || expense.category === 'ulasim';
      } else if (currentRole === 'personel' || currentRole === 'mudur') {
        // Personel ve Müdür rolleri operasyonel ve personel kategorilerini göremez
        roleBasedCategoryMatch = expense.category !== 'operasyonel' && expense.category !== 'personel';
      }
      
      // Category filter
      const categoryMatch = categoryFilter === 'all' || expense.category === categoryFilter;
      
      // Search filter
      const searchLower = searchQuery.toLowerCase().trim();
      const searchMatch = searchLower === '' || 
        expense.description?.toLowerCase().includes(searchLower) ||
        categoryLabels[expense.category].toLowerCase().includes(searchLower);
      
      return dateMatch && categoryMatch && searchMatch && roleBasedCategoryMatch;
    });
  };

  const filteredExpenses = getFilteredExpenses();
  const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const totalRevenue = getTotalRevenue();
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Category summary
  const categorySummary = Object.keys(categoryLabels).map(cat => {
    const categoryExpenses = filteredExpenses.filter(exp => exp.category === cat);
    const total = categoryExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const percentage = totalExpenses > 0 ? (total / totalExpenses) * 100 : 0;
    
    return {
      category: cat as Expense['category'],
      total,
      percentage,
      count: categoryExpenses.length
    };
  }).filter(item => item.total > 0);

  // CRUD Functions
  const handleAddExpense = () => {
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      alert('Lütfen geçerli bir tutar girin');
      return;
    }
    
    // localStorage kaldırıldı - prop'tan alıyoruz
    const currentUserName = userName || 'Bilinmeyen Kullanıcı';
    
    const newExpense: Expense = {
      id: `expense-${Date.now()}`,
      category: formData.category,
      amount: parseFloat(formData.amount),
      description: formData.description,
      date: formData.date,
      created_at: new Date().toISOString(),
      created_by: currentUserName
    };
    
    setExpenses([newExpense, ...expenses]);
    setShowAddForm(false);
    setFormData({
      category: 'personel',
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0]
    });
  };

  const handleUpdateExpense = () => {
    if (!editingExpense) return;
    
    setExpenses(expenses.map(exp =>
      exp.id === editingExpense.id
        ? {
            ...exp,
            category: formData.category,
            amount: parseFloat(formData.amount),
            description: formData.description,
            date: formData.date
          }
        : exp
    ));
    
    cancelEdit();
  };

  const handleDeleteExpense = (expenseId: string) => {
    if (!confirm('Bu gideri silmek istediğinizden emin misiniz?')) return;
    
    setExpenses(expenses.filter(exp => exp.id !== expenseId));
  };

  const startEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      category: expense.category,
      amount: expense.amount.toString(),
      description: expense.description,
      date: expense.date
    });
    setShowAddForm(true);
  };

  const cancelEdit = () => {
    setEditingExpense(null);
    setShowAddForm(false);
    setFormData({
      category: 'personel',
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0]
    });
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Başlık
    doc.setFontSize(16);
    doc.text('Gider Raporu', 14, 20);
    
    // Özet Bilgiler
    doc.setFontSize(12);
    doc.text(`Toplam Gelir: ${totalRevenue.toLocaleString('tr-TR')} TL`, 14, 30);
    doc.text(`Toplam Gider: ${totalExpenses.toLocaleString('tr-TR')} TL`, 14, 40);
    doc.text(`Net Kar/Zarar: ${netProfit >= 0 ? '+' : ''}${netProfit.toLocaleString('tr-TR')} TL`, 14, 50);
    doc.text(`Kar Marji: ${profitMargin.toFixed(1)}%`, 14, 60);
    
    // Kategori Özet Tablosu
    if (categorySummary.length > 0) {
      doc.setFontSize(14);
      doc.text('Kategori Bazli Ozet', 14, 80);
      autoTable(doc, {
        head: [['Kategori', 'Toplam', 'Yuzde', 'Kayit Sayisi']],
        body: categorySummary.map(item => [
          categoryLabels[item.category].replace(/[^\x00-\x7F]/g, ''), // Remove emojis
          `${item.total.toLocaleString('tr-TR')} TL`,
          `${item.percentage.toFixed(1)}%`,
          item.count
        ]),
        startY: 90,
        theme: 'grid'
      });
    }
    
    // Gider Listesi (Yeni Sayfa)
    doc.addPage();
    doc.setFontSize(14);
    doc.text('Son Giderler', 14, 20);
    autoTable(doc, {
      head: [['Kategori', 'Tutar', 'Tarih', 'Ekleyen', 'Saat', 'Aciklama']],
      body: filteredExpenses.slice(0, 50).map(expense => [
        categoryLabels[expense.category].replace(/[^\x00-\x7F]/g, ''),
        `${expense.amount.toLocaleString('tr-TR')} TL`,
        new Date(expense.date).toLocaleDateString('tr-TR'),
        expense.created_by,
        new Date(expense.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        expense.description || 'N/A'
      ]),
      startY: 30,
      theme: 'grid'
    });
    
    doc.save('gider_raporu.pdf');
  };

  // Export to CSV
  const exportToCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," + [
      "Kategori,Tutar,Tarih,Ekleyen,Saat,Aciklama",
      ...filteredExpenses.map(expense => [
        categoryLabels[expense.category].replace(/[^\x00-\x7F]/g, ''),
        expense.amount.toLocaleString('tr-TR'),
        new Date(expense.date).toLocaleDateString('tr-TR'),
        expense.created_by,
        new Date(expense.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        expense.description || 'N/A'
      ].join(","))
    ].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "giderler.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="pb-20 bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] min-h-screen">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <button
          onClick={() => onNavigate('business-panel')}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">Geri Dön</span>
        </button>

        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-3xl font-bold text-white">İşletme Genel Durum</h1>
          <span className="text-3xl">💼</span>
        </div>
        <p className="text-sm text-gray-400">Gelir, gider ve kar/zarar takibi</p>
      </div>

      <div className="px-6 space-y-4">
        {/* Summary Cards - Role-based visibility */}
        {currentRole !== 'operasyon' && (
          <div className="grid grid-cols-2 gap-3">
            {/* Toplam Gelir - Hidden for mudur */}
            {currentRole !== 'mudur' && (
              <div className="backdrop-blur-xl bg-gradient-to-br from-green-500/20 to-green-600/20 border-2 border-green-500/30 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Banknote className="w-5 h-5 text-green-400" />
                  <span className="text-xs text-gray-300">Toplam Gelir</span>
                </div>
                <div className="text-2xl font-bold text-white">₺{totalRevenue.toLocaleString('tr-TR')}</div>
                <div className="flex items-center gap-1 text-xs text-green-400">
                  <TrendingUp className="w-3 h-3" />
                  <span>Satışlardan</span>
                </div>
              </div>
            )}

            {/* Toplam Gider */}
            <div className="backdrop-blur-xl bg-gradient-to-br from-red-500/20 to-red-600/20 border-2 border-red-500/30 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Banknote className="w-5 h-5 text-red-400" />
                <span className="text-xs text-gray-300">Toplam Gider</span>
              </div>
              <div className="text-2xl font-bold text-white">₺{totalExpenses.toLocaleString('tr-TR')}</div>
              <div className="flex items-center gap-1 text-xs text-red-400">
                <TrendingDown className="w-3 h-3" />
                <span>{filteredExpenses.length} kayıt</span>
              </div>
            </div>

            {/* Net Kar/Zarar - Hidden for mudur */}
            {currentRole !== 'mudur' && (
              <div className={`backdrop-blur-xl bg-gradient-to-br ${
                netProfit >= 0 
                  ? 'from-blue-500/20 to-blue-600/20 border-blue-500/30' 
                  : 'from-orange-500/20 to-orange-600/20 border-orange-500/30'
              } border-2 rounded-2xl p-4`}>
                <div className="flex items-center gap-2 mb-2">
                  {netProfit >= 0 ? 
                    <TrendingUp className="w-5 h-5 text-blue-400" /> : 
                    <TrendingDown className="w-5 h-5 text-orange-400" />
                  }
                  <span className="text-xs text-gray-300">Net Kar/Zarar</span>
                </div>
                <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                  {netProfit >= 0 ? '+' : ''}₺{netProfit.toLocaleString('tr-TR')}
                </div>
                <div className="text-xs text-gray-400">Gelir - Gider</div>
              </div>
            )}

            {/* Kar Marjı - Hidden for mudur */}
            {currentRole !== 'mudur' && (
              <div className="backdrop-blur-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border-2 border-purple-500/30 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                  <span className="text-xs text-gray-300">Kar Marjı</span>
                </div>
                <div className="text-2xl font-bold text-white">{profitMargin.toFixed(1)}%</div>
                <div className="text-xs text-gray-400">
                  {profitMargin >= 0 ? 'Pozitif' : 'Negatif'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Date Filters - Row 1 */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { key: 'today' as DateFilter, label: '📅 Bugün' },
            { key: 'yesterday' as DateFilter, label: 'Dün' },
            { key: 'week' as DateFilter, label: 'Bu Hafta' },
            { key: 'month' as DateFilter, label: 'Bu Ay' }
          ].map(filter => (
            <button
              key={filter.key}
              onClick={() => setDateFilter(filter.key)}
              className={`px-3 py-2.5 rounded-lg font-semibold text-xs transition-all ${
                dateFilter === filter.key
                  ? 'bg-[#9dd9ea]/20 text-[#9dd9ea] border border-[#9dd9ea]/30'
                  : 'bg-white/5 text-gray-400 border border-white/10'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Date Filters - Row 2 */}
        <div className="grid grid-cols-5 gap-2">
          {[
            { key: 'last3months' as DateFilter, label: 'Son 3 Ay' },
            { key: 'last6months' as DateFilter, label: 'Son 6 Ay' },
            { key: 'last1year' as DateFilter, label: 'Son 1 Yıl' },
            { key: 'all' as DateFilter, label: '📊 Tümü' },
            { key: 'custom' as DateFilter, label: '📆 Özel' }
          ].map(filter => (
            <button
              key={filter.key}
              onClick={() => setDateFilter(filter.key)}
              className={`px-3 py-2.5 rounded-lg font-semibold text-xs transition-all ${
                dateFilter === filter.key
                  ? 'bg-[#9dd9ea]/20 text-[#9dd9ea] border border-[#9dd9ea]/30'
                  : 'bg-white/5 text-gray-400 border border-white/10'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Custom Date Range */}
        {dateFilter === 'custom' && (
          <div className="backdrop-blur-xl bg-gradient-to-br from-[#9dd9ea]/10 border border-[#9dd9ea]/30 rounded-2xl p-4">
            <h4 className="text-sm font-semibold text-[#9dd9ea] mb-3">📆 Tarih Aralığı Seçin</h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-300 mb-2">Başlangıç Tarihi</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              
              <div>
                <label className="block text-xs text-gray-300 mb-2">Bitiş Tarihi</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
            </div>
            
            {customStartDate && customEndDate && (
              <div className="mt-3 text-xs text-gray-400 bg-black/40 rounded-lg px-3 py-2">
                📊 Seçili Aralık: <span className="text-[#9dd9ea] font-semibold">
                  {new Date(customStartDate).toLocaleDateString('tr-TR')} 
                  {' - '}
                  {new Date(customEndDate).toLocaleDateString('tr-TR')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Add Expense Button */}
        {canAddExpense && (
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              if (showAddForm) cancelEdit();
            }}
            className="w-full bg-gradient-to-r from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:shadow-lg transition-all"
          >
            <Plus className="w-5 h-5" />
            <span>Yeni Gider Ekle</span>
          </button>
        )}

        {/* Add/Edit Form */}
        {showAddForm && (
          <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 border border-white/20 rounded-2xl p-5">
            <h3 className="font-bold text-white mb-4">
              {editingExpense ? 'Gider Düzenle' : 'Yeni Gider'}
            </h3>
            
            <div className="space-y-3">
              {/* Category */}
              <div>
                <label className="block text-sm text-gray-300 mb-2">Kategori</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as Expense['category'] })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white"
                >
                  {Object.entries(categoryLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              
              {/* Amount */}
              <div>
                <label className="block text-sm text-gray-300 mb-2">Tutar (₺)</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white"
                />
              </div>
              
              {/* Date */}
              <div>
                <label className="block text-sm text-gray-300 mb-2">Tarih</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white"
                />
              </div>
              
              {/* Description */}
              <div>
                <label className="block text-sm text-gray-300 mb-2">Açıklama (Opsiyonel)</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Örn: Mart ayı maaşları"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white"
                />
              </div>
              
              {/* Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={editingExpense ? handleUpdateExpense : handleAddExpense}
                  className="flex-1 bg-green-500/20 border border-green-500/30 text-green-400 font-semibold py-2 rounded-lg hover:bg-green-500/30 transition-colors"
                >
                  {editingExpense ? '💾 Güncelle' : '💾 Kaydet'}
                </button>
                <button
                  onClick={cancelEdit}
                  className="flex-1 bg-gray-500/20 border border-gray-500/30 text-gray-400 font-semibold py-2 rounded-lg hover:bg-gray-500/30 transition-colors"
                >
                  ❌ İptal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Category Summary */}
        {categorySummary.length > 0 && (
          <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 border border-white/20 rounded-2xl p-5">
            <h3 className="font-bold text-white mb-4">📊 Kategori Bazlı Özet</h3>
            
            <div className="space-y-2">
              {categorySummary.map(item => {
                // Personel ve Müdür rolleri operasyonel ve personel kategorilerini göremez
                if ((currentRole === 'personel' || currentRole === 'mudur') && (item.category === 'operasyonel' || item.category === 'personel')) {
                  return null;
                }
                
                return (
                  <div key={item.category} className="bg-black/40 rounded-lg p-3">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">
                          {categoryLabels[item.category]}
                        </span>
                        <span className="text-xs text-gray-500">({item.count} kayıt)</span>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm font-bold text-white">
                          ₺{item.total.toLocaleString('tr-TR')}
                        </div>
                        <div className={`text-xs ${categoryColors[item.category].text}`}>
                          {item.percentage.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${categoryColors[item.category].progress}`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Gider ara... (açıklama veya kategori)"
              className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-3 py-2.5 text-white"
            />
          </div>

          {/* Category Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-3 py-2.5 text-white"
            >
              <option value="all">🏷️ Tüm Kategoriler</option>
              {Object.entries(categoryLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Active Filters */}
          {(searchQuery || categoryFilter !== 'all') && (
            <div className="flex items-center gap-2 flex-wrap">
              {searchQuery && (
                <div className="flex items-center gap-1 bg-[#9dd9ea]/20 border border-[#9dd9ea]/30 text-[#9dd9ea] px-3 py-1 rounded-lg text-xs">
                  <span>🔍 "{searchQuery}"</span>
                  <button onClick={() => setSearchQuery('')} className="ml-1">✕</button>
                </div>
              )}
              
              {categoryFilter !== 'all' && (
                <div className="flex items-center gap-1 bg-purple-500/20 border border-purple-500/30 text-purple-400 px-3 py-1 rounded-lg text-xs">
                  <span>{categoryLabels[categoryFilter as Expense['category']]}</span>
                  <button onClick={() => setCategoryFilter('all')} className="ml-1">✕</button>
                </div>
              )}
              
              <button
                onClick={() => { setSearchQuery(''); setCategoryFilter('all'); }}
                className="text-xs text-gray-400 hover:text-white underline"
              >
                Tümünü Temizle
              </button>
            </div>
          )}
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button 
            onClick={exportToPDF}
            className="flex-1 bg-gradient-to-r from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 hover:shadow-lg transition-all"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm">PDF</span>
          </button>
          
          <button 
            onClick={exportToCSV}
            className="flex-1 bg-green-500/20 border border-green-500/30 text-green-400 font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-green-500/30 transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span className="text-sm">CSV</span>
          </button>
          
          <button 
            onClick={() => window.print()}
            className="flex-1 bg-purple-500/20 border border-purple-500/30 text-purple-400 font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-purple-500/30 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span className="text-sm">Yazdır</span>
          </button>
        </div>

        {/* Expenses List */}
        <div className="space-y-2">
          <h3 className="font-bold text-white text-lg mb-3">
            📋 Gider Listesi ({filteredExpenses.length} kayıt)
          </h3>

          {filteredExpenses.length === 0 ? (
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
              <p className="text-gray-400">Kayıt bulunamadı</p>
            </div>
          ) : (
            <>
              {filteredExpenses
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, displayLimit)
                .map(expense => (
                  <div key={expense.id} className="bg-black/40 border border-white/10 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        {/* Category + Date */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-white">
                            {categoryLabels[expense.category]}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(expense.date).toLocaleDateString('tr-TR', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                        
                        {/* Description */}
                        {expense.description && (
                          <p className="text-xs text-gray-400 mb-2">{expense.description}</p>
                        )}
                        
                        {/* Created By + Time */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-gray-500">
                            👤 {expense.created_by || 'Bilinmeyen'}
                          </span>
                          <span className="text-xs text-gray-600">•</span>
                          <span className="text-xs text-gray-500">
                            🕐 {new Date(expense.created_at).toLocaleTimeString('tr-TR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        
                        {/* Amount */}
                        <div className="text-lg font-bold text-[#ffb3ba]">
                          ₺{expense.amount.toLocaleString('tr-TR')}
                        </div>
                      </div>
                      
                      {/* Edit/Delete Buttons */}
                      <div className="flex gap-2">
                        {canAddExpense && (
                          <button
                            onClick={() => startEdit(expense)}
                            className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center hover:bg-blue-500/30 transition-colors"
                          >
                            <Edit2 className="w-4 h-4 text-blue-400" />
                          </button>
                        )}
                        {canDeleteExpense && (
                          <button
                            onClick={() => handleDeleteExpense(expense.id)}
                            className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center hover:bg-red-500/30 transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              
              {/* Load More */}
              {filteredExpenses.length > displayLimit && (
                <button
                  onClick={() => setDisplayLimit(displayLimit + 15)}
                  className="w-full bg-[#9dd9ea]/20 border border-[#9dd9ea]/30 text-[#9dd9ea] font-semibold px-6 py-3 rounded-lg hover:bg-[#9dd9ea]/30 transition-colors"
                >
                  📄 Daha Fazla Yükle ({filteredExpenses.length - displayLimit} kayıt daha)
                </button>
              )}
            </>
          )}
        </div>

        {/* Info Card */}
        <div className="mt-6 mb-6">
          <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">ℹ️</span>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-white mb-2">💼 İşletme Genel Durum ve Yetki Sistemi</h4>
                <p className="text-sm text-gray-400 mb-3">
                  Gelir, gider ve finansal raporları görme ve düzenleme yetkileri rol bazlıdır.
                </p>
                <div className="space-y-2">
                  <p className="text-sm text-gray-400">
                    <span className="text-red-300 font-medium">🛡️ Admin (Yönetici):</span> Tüm giderleri görebilir, ekleyebilir ve silebilir.
                  </p>
                  <p className="text-sm text-gray-400">
                    <span className="text-indigo-300 font-medium">👤 Üst-Müdür:</span> Tüm giderleri görebilir, ekleyebilir ve düzenleyebilir.
                  </p>
                  <p className="text-sm text-gray-400">
                    <span className="text-indigo-300 font-medium">👥 Müdür:</span> Belirli giderleri görebilir, ekleyebilir ve düzenleyebilir.
                  </p>
                  <p className="text-sm text-gray-400">
                    <span className="text-blue-300 font-medium">⚙️ Operasyon:</span> Belirli giderleri görebilir, düzenleyemez.
                  </p>
                  <p className="text-sm text-gray-400">
                    <span className="text-purple-300 font-medium">💼 İdari:</span> Tüm giderleri görebilir, ekleyebilir ve silebilir.
                  </p>
                  <p className="text-sm text-gray-400">
                    <span className="text-gray-300 font-medium">❌ Personel, Bekleyen:</span> Hiçbir şey göremez (sayfa erişimi yok).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}