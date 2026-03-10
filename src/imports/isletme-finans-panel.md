İŞLETME GENEL DURUM PANELİ - DETAYLI PROMPT REHBERİ
🎯 HIZLI VERSİYON (Kopyala-Yapıştır):
İşletme gider yönetimi ve finansal durum paneli oluştur:

4 ÖZET KARTI (grid-cols-2):
1. Toplam Gelir (Yeşil) - TrendingUp icon
2. Toplam Gider (Kırmızı) - TrendingDown icon  
3. Net Kar/Zarar (Mavi/Turuncu) - Dinamik renk
4. Kar Marjı (Mor) - Yüzde gösterim

6 GİDER KATEGORİSİ:
- personel (💼 Personel) - Mor
- malzeme (📦 Malzeme) - Mavi
- ekipman (🖨️ Ekipman & Bakım) - Yeşil
- operasyonel (🏢 Operasyonel) - Turuncu
- ulasim (🚗 Ulaşım) - Cyan
- diger (📋 Diğer) - Gri

TARİH FİLTRELEME (2 Sıra):
Sıra 1: Bugün, Dün, Bu Hafta, Bu Ay (grid-cols-4)
Sıra 2: Son 3 Ay, Son 6 Ay, Son 1 Yıl, Tümü, Özel (grid-cols-5)
Özel: Başlangıç-Bitiş tarihi seçici

ÖZELLİKLER:
- Yeni Gider Ekle formu (kategori, tutar, tarih, açıklama)
- Düzenle/Sil butonları
- Kategori bazlı özet (progress bar + yüzde)
- Arama (açıklama + kategori)
- Kategori filtresi (dropdown)
- Pagination (15'er yükle + "Daha Fazla Yükle")
- PDF/CSV export
- Yazdır (window.print)

MOCK DATA:
interface Expense {
  id: string;
  category: 'personel' | 'malzeme' | 'ekipman' | 'operasyonel' | 'ulasim' | 'diger';
  amount: number;
  description: string;
  date: string; // 'YYYY-MM-DD'
  created_at: string;
}

TASARIM:
- Glassmorphism kartlar
- Her kategori için farklı renk paleti
- Lucide-react iconlar
- Mobile responsive
- jsPDF + jspdf-autotable için PDF export
🔥 TAM DETAYLI VERSİYON:
📌 1. GENEL TANIM
Turistik fotoğrafçılık işletmesi için gider yönetimi ve finansal rapor paneli. Giderleri kategorize eder, tarih aralıklarına göre filtreler, kar/zarar hesaplar ve PDF/CSV rapor çıkarır.

🎨 2. TASARIM SİSTEMİ
Kategori Renk Paleti:
const categoryColors = {
  personel: { 
    bg: 'from-purple-500/20 to-purple-600/20', 
    text: 'text-purple-400', 
    border: 'border-purple-500/30' 
  },
  malzeme: { 
    bg: 'from-blue-500/20 to-blue-600/20', 
    text: 'text-blue-400', 
    border: 'border-blue-500/30' 
  },
  ekipman: { 
    bg: 'from-green-500/20 to-green-600/20', 
    text: 'text-green-400', 
    border: 'border-green-500/30' 
  },
  operasyonel: { 
    bg: 'from-orange-500/20 to-orange-600/20', 
    text: 'text-orange-400', 
    border: 'border-orange-500/30' 
  },
  ulasim: { 
    bg: 'from-cyan-500/20 to-cyan-600/20', 
    text: 'text-cyan-400', 
    border: 'border-cyan-500/30' 
  },
  diger: { 
    bg: 'from-gray-500/20 to-gray-600/20', 
    text: 'text-gray-400', 
    border: 'border-gray-500/30' 
  }
};
Kategori Etiketleri:
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
📊 3. ÖZET KARTLARI (4 Card - grid-cols-2)
{/* 1. TOPLAM GELİR - YEŞİL */}
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

{/* 2. TOPLAM GİDER - KIRMIZI */}
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

{/* 3. NET KAR/ZARAR - DİNAMİK RENK */}
<div className={`backdrop-blur-xl bg-gradient-to-br ${
  netProfit >= 0 
    ? 'from-blue-500/20 to-blue-600/20 border-blue-500/30' 
    : 'from-orange-500/20 to-orange-600/20 border-orange-500/30'
} border-2 rounded-2xl p-4`}>
  <div className="flex items-center gap-2 mb-2">
    {netProfit >= 0 ? <TrendingUp /> : <TrendingDown />}
    <span className="text-xs text-gray-300">Net Kar/Zarar</span>
  </div>
  <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
    {netProfit >= 0 ? '+' : ''}₺{netProfit.toLocaleString('tr-TR')}
  </div>
  <div className="text-xs text-gray-400">Gelir - Gider</div>
</div>

{/* 4. KAR MARJI - MOR */}
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
Hesaplama Formülleri:

const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
const totalRevenue = 125450; // Mock - gerçekte satışlardan gelecek
const netProfit = totalRevenue - totalExpenses;
const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
📅 4. TARİH FİLTRELEME SİSTEMİ
2 Sıra Filtre Butonları:
{/* SIRA 1: Kısa Dönem Filtreler (grid-cols-4) */}
<div className="grid grid-cols-4 gap-2">
  {[
    { key: 'today', label: '📅 Bugün' },
    { key: 'yesterday', label: 'Dün' },
    { key: 'week', label: 'Bu Hafta' },
    { key: 'month', label: 'Bu Ay' }
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

{/* SIRA 2: Uzun Dönem Filtreler (grid-cols-5) */}
<div className="grid grid-cols-5 gap-2">
  {[
    { key: 'last3months', label: 'Son 3 Ay' },
    { key: 'last6months', label: 'Son 6 Ay' },
    { key: 'last1year', label: 'Son 1 Yıl' },
    { key: 'all', label: '📊 Tümü' },
    { key: 'custom', label: '📆 Özel' }
  ].map(filter => (
    <button key={filter.key} onClick={() => setDateFilter(filter.key)}>
      {filter.label}
    </button>
  ))}
</div>
Özel Tarih Aralığı Seçici:
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
          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white"
        />
      </div>
      
      <div>
        <label className="block text-xs text-gray-300 mb-2">Bitiş Tarihi</label>
        <input
          type="date"
          value={customEndDate}
          onChange={(e) => setCustomEndDate(e.target.value)}
          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white"
        />
      </div>
    </div>
    
    {/* Seçili aralık gösterimi */}
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
Filtreleme Mantığı:
type DateFilter = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'last3months' | 'last6months' | 'last1year' | 'custom';

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
    
    switch (dateFilter) {
      case 'today':
        return expenseDate >= today;
      case 'yesterday':
        return expenseDate >= yesterday && expenseDate < today;
      case 'week':
        return expenseDate >= startOfWeek;
      case 'month':
        return expenseDate >= startOfMonth;
      case 'last3months':
        return expenseDate >= startOfLast3Months;
      case 'last6months':
        return expenseDate >= startOfLast6Months;
      case 'last1year':
        return expenseDate >= startOfLast1Year;
      case 'custom':
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate);
          const end = new Date(customEndDate);
          return expenseDate >= start && expenseDate <= end;
        }
        return false;
      default: // 'all'
        return true;
    }
  });
};
➕ 5. YENİ GİDER EKLEME FORMU
<button
  onClick={() => setShowAddForm(!showAddForm)}
  className="w-full bg-gradient-to-r from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2"
>
  <Plus className="w-5 h-5" />
  <span>Yeni Gider Ekle</span>
</button>

{showAddForm && (
  <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 border border-white/20 rounded-2xl p-5">
    <h3 className="font-bold text-white mb-4">
      {editingExpense ? 'Gider Düzenle' : 'Yeni Gider'}
    </h3>
    
    <div className="space-y-3">
      {/* Kategori */}
      <div>
        <label className="block text-sm text-gray-300 mb-2">Kategori</label>
        <select
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white"
        >
          {Object.entries(categoryLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>
      
      {/* Tutar */}
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
      
      {/* Tarih */}
      <div>
        <label className="block text-sm text-gray-300 mb-2">Tarih</label>
        <input
          type="date"
          value={formData.date}
          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white"
        />
      </div>
      
      {/* Açıklama */}
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
      
      {/* Butonlar */}
      <div className="flex gap-2">
        <button
          onClick={editingExpense ? handleUpdateExpense : handleAddExpense}
          className="flex-1 bg-green-500/20 border border-green-500/30 text-green-400 font-semibold py-2 rounded-lg"
        >
          {editingExpense ? '💾 Güncelle' : '💾 Kaydet'}
        </button>
        <button
          onClick={cancelEdit}
          className="flex-1 bg-gray-500/20 border border-gray-500/30 text-gray-400 font-semibold py-2 rounded-lg"
        >
          ❌ İptal
        </button>
      </div>
    </div>
  </div>
)}
📊 6. KATEGORİ BAZLI ÖZET
{categorySummary.length > 0 && (
  <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 border border-white/20 rounded-2xl p-5">
    <h3 className="font-bold text-white mb-4">📊 Kategori Bazlı Özet</h3>
    
    <div className="space-y-2">
      {categorySummary.map(item => (
        <div key={item.category} className="bg-black/40 rounded-lg p-3">
          {/* Başlık */}
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
              className={`h-full bg-gradient-to-r ${categoryColors[item.category].bg.replace('/20', '/60')}`}
              style={{ width: `${item.percentage}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  </div>
)}
Özet Hesaplama:

const categorySummary = Object.keys(categoryLabels).map(cat => {
  const categoryExpenses = filteredExpenses.filter(exp => exp.category === cat);
  const total = categoryExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const percentage = totalExpenses > 0 ? (total / totalExpenses) * 100 : 0;
  
  return {
    category: cat,
    total,
    percentage,
    count: categoryExpenses.length
  };
}).filter(item => item.total > 0); // Sadece tutarı olan kategoriler
🔍 7. ARAMA VE FİLTRELEME
{/* Arama Çubuğu */}
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

{/* Kategori Filtresi */}
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

{/* Aktif Filtreler */}
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
        <span>{categoryLabels[categoryFilter]}</span>
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
Filtreleme Mantığı:

const filteredExpenses = expenses.filter(expense => {
  // Tarih filtresi (yukarıda açıklandı)
  const dateMatch = /* ... */;
  
  // Kategori filtresi
  const categoryMatch = categoryFilter === 'all' || expense.category === categoryFilter;
  
  // Arama filtresi
  const searchLower = searchQuery.toLowerCase().trim();
  const searchMatch = searchLower === '' || 
    expense.description?.toLowerCase().includes(searchLower) ||
    categoryLabels[expense.category].toLowerCase().includes(searchLower);
  
  return dateMatch && categoryMatch && searchMatch;
});
📄 8. GİDER LİSTESİ + PAGİNATİON
<div className="space-y-2">
  {filteredExpenses
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // En yeniden eskiye
    .slice(0, displayLimit) // İlk X kayıt
    .map(expense => (
      <div key={expense.id} className="bg-black/40 border border-white/10 rounded-xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            {/* Kategori + Tarih */}
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
            
            {/* Açıklama */}
            {expense.description && (
              <p className="text-xs text-gray-400 mb-2">{expense.description}</p>
            )}
            
            {/* Tutar */}
            <div className="text-lg font-bold text-[#ffb3ba]">
              ₺{expense.amount.toLocaleString('tr-TR')}
            </div>
          </div>
          
          {/* Düzenle/Sil Butonları */}
          <div className="flex gap-2">
            <button
              onClick={() => startEdit(expense)}
              className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center"
            >
              <Edit2 className="w-4 h-4 text-blue-400" />
            </button>
            <button
              onClick={() => handleDeleteExpense(expense.id)}
              className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>
          </div>
        </div>
      </div>
    ))}
  
  {/* Daha Fazla Yükle Butonu */}
  {filteredExpenses.length > displayLimit && (
    <button
      onClick={() => setDisplayLimit(displayLimit + 15)}
      className="bg-[#9dd9ea]/20 border border-[#9dd9ea]/30 text-[#9dd9ea] font-semibold px-6 py-3 rounded-lg"
    >
      📄 Daha Fazla Yükle ({filteredExpenses.length - displayLimit} kayıt daha)
    </button>
  )}
</div>
Pagination State:

const [displayLimit, setDisplayLimit] = useState(15);

// Filtre değiştiğinde pagination'ı sıfırla
useEffect(() => {
  setDisplayLimit(15);
}, [dateFilter, categoryFilter, searchQuery]);
📥 9. PDF/CSV EXPORT
PDF Export (jsPDF + jspdf-autotable):
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const exportToPDF = () => {
  const doc = new jsPDF();
  
  // Başlık
  doc.setFontSize(16);
  doc.text('Gider Raporu', 14, 20);
  
  // Özet Bilgiler
  doc.setFontSize(12);
  doc.text(`Toplam Gelir: ₺${totalRevenue.toLocaleString('tr-TR')}`, 14, 30);
  doc.text(`Toplam Gider: ₺${totalExpenses.toLocaleString('tr-TR')}`, 14, 40);
  doc.text(`Net Kar/Zarar: ${netProfit >= 0 ? '+' : ''}₺${netProfit.toLocaleString('tr-TR')}`, 14, 50);
  doc.text(`Kar Marjı: ${profitMargin.toFixed(1)}%`, 14, 60);
  
  // Kategori Özet Tablosu
  doc.setFontSize(14);
  doc.text('Kategori Bazlı Özet', 14, 80);
  autoTable(doc, {
    head: [['Kategori', 'Toplam', 'Yüzde', 'Kayıt Sayısı']],
    body: categorySummary.map(item => [
      categoryLabels[item.category],
      `₺${item.total.toLocaleString('tr-TR')}`,
      `${item.percentage.toFixed(1)}%`,
      item.count
    ]),
    startY: 90,
    theme: 'grid'
  });
  
  // Gider Listesi (Yeni Sayfa)
  doc.addPage();
  doc.setFontSize(14);
  doc.text('Son Giderler', 14, 20);
  autoTable(doc, {
    head: [['Kategori', 'Tutar', 'Tarih', 'Açıklama']],
    body: filteredExpenses.map(expense => [
      categoryLabels[expense.category],
      `₺${expense.amount.toLocaleString('tr-TR')}`,
      new Date(expense.date).toLocaleDateString('tr-TR'),
      expense.description || 'N/A'
    ]),
    startY: 30,
    theme: 'grid'
  });
  
  doc.save('gider_raporu.pdf');
};
CSV Export:
const exportToCSV = () => {
  const csvContent = "data:text/csv;charset=utf-8," + [
    "Kategori,Tutar,Tarih,Açıklama",
    ...filteredExpenses.map(expense => [
      categoryLabels[expense.category],
      expense.amount.toLocaleString('tr-TR'),
      new Date(expense.date).toLocaleDateString('tr-TR'),
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
Yazdır (Print):
const printReport = () => {
  const doc = new jsPDF();
  // ...PDF içeriği (yukarıdaki gibi)
  
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  const printWindow = window.open(pdfUrl, '_blank');
  
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
    };
  }
};
Export Butonları:

<div className="flex items-center gap-2">
  <button onClick={exportToPDF} className="bg-gradient-to-r from-[#9dd9ea] to-[#7ec8dd] ...">
    <Download className="w-5 h-5" />
    <span>PDF İndir</span>
  </button>
  
  <button onClick={exportToCSV} className="...">
    <FileText className="w-5 h-5" />
    <span>CSV İndir</span>
  </button>
  
  <button onClick={printReport} className="...">
    <Printer className="w-5 h-5" />
    <span>Yazdır</span>
  </button>
</div>
💾 10. DATA YAPISI
interface Expense {
  id: string;                    // 'expense-1'
  category: 'personel' | 'malzeme' | 'ekipman' | 'operasyonel' | 'ulasim' | 'diger';
  amount: number;                // 5000
  description: string;           // 'Mart ayı maaşları'
  date: string;                  // '2024-03-01' (YYYY-MM-DD)
  created_at: string;            // '2024-03-05T14:30:00Z'
}

type DateFilter = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'last3months' | 'last6months' | 'last1year' | 'custom';
Mock Data Örneği:
const mockExpenses: Expense[] = [
  {
    id: 'expense-1',
    category: 'personel',
    amount: 45000,
    description: 'Mart ayı maaş ödemeleri',
    date: '2024-03-01',
    created_at: '2024-03-01T10:00:00Z'
  },
  {
    id: 'expense-2',
    category: 'malzeme',
    amount: 3500,
    description: 'Fotoğraf kağıdı ve mürekkep alımı',
    date: '2024-03-03',
    created_at: '2024-03-03T14:20:00Z'
  },
  {
    id: 'expense-3',
    category: 'ekipman',
    amount: 2000,
    description: 'Yazıcı bakımı',
    date: '2024-03-04',
    created_at: '2024-03-04T11:15:00Z'
  }
];
🔧 11. FONKSİYONLAR
A) Gider Ekleme:
const handleAddExpense = () => {
  if (!formData.amount || parseFloat(formData.amount) <= 0) {
    alert('Lütfen geçerli bir tutar girin');
    return;
  }
  
  const newExpense: Expense = {
    id: `expense-${Date.now()}`,
    category: formData.category,
    amount: parseFloat(formData.amount),
    description: formData.description,
    date: formData.date,
    created_at: new Date().toISOString()
  };
  
  setExpenses([...expenses, newExpense]);
  setShowAddForm(false);
  setFormData({
    category: 'personel',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });
};
B) Gider Güncelleme:
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
C) Gider Silme:
const handleDeleteExpense = (expenseId: string) => {
  if (!confirm('Bu gideri silmek istediğinizden emin misiniz?')) return;
  
  setExpenses(expenses.filter(exp => exp.id !== expenseId));
};
D) Düzenleme Başlatma:
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
✅ ÖZET CHECKLIST
✅ 4 Özet Kartı (Gelir, Gider, Kar/Zarar, Kar Marjı)
✅ 6 Gider Kategorisi (renk kodlu)
✅ 2 Sıra Tarih Filtresi (9 buton)
✅ Özel tarih aralığı seçici
✅ Yeni gider ekleme formu (kategori, tutar, tarih, açıklama)
✅ Düzenle/Sil butonları
✅ Kategori bazlı özet (progress bar + yüzde)
✅ Arama çubuğu (açıklama + kategori)
✅ Kategori dropdown filtresi
✅ Aktif filtreler gösterimi + temizleme
✅ Pagination (15'er yükle + "Daha Fazla")
✅ PDF export (jsPDF + autoTable)
✅ CSV export
✅ Yazdır (window.print)
✅ Loading state
✅ Empty state
✅ Glassmorphism tasarım
✅ Mobile responsive
✅ Türkçe para formatı (₺X,XXX)
✅ Türkçe tarih formatı (5 Mar 2024)