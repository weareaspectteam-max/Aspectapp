 1. MENÜ KARTI (Manager/Admin Hub)
// Manager Hub Menu Item
const menuItems = [
  // ... diğer menü kartları
  {
    id: 'equipment-page',
    title: 'Malzeme Yönetimi',
    description: 'Ekipman ve malzemeleri yönetin',
    icon: Package, // Lucide-react
    emoji: '📦',
    gradient: 'from-orange-500/20 to-orange-600/20',
    borderColor: 'border-orange-500/30',
    iconColor: 'text-orange-400',
  },
];

// Render
<div className="px-6 space-y-4">
  {menuItems.map((item) => (
    <button
      key={item.id}
      onClick={() => onNavigate(item.id)}
      className={`w-full backdrop-blur-xl bg-gradient-to-br ${item.gradient} border-2 ${item.borderColor} rounded-2xl p-6 hover:scale-[1.02] transition-all active:scale-95`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Icon Circle */}
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${item.gradient} border-2 ${item.borderColor} flex items-center justify-center shadow-lg`}>
            <span className="text-3xl">{item.emoji}</span>
          </div>

          {/* Text */}
          <div className="text-left">
            <h3 className="text-xl font-bold text-white mb-1">{item.title}</h3>
            <p className="text-sm text-gray-400">{item.description}</p>
          </div>
        </div>

        {/* Arrow */}
        <ArrowRight className={`w-6 h-6 ${item.iconColor}`} />
      </div>
    </button>
  ))}
</div>
Görseldeki gibi:

┌─────────────────────────────────────────────────────────┐
│ [📦]  Malzeme Yönetimi                           [→]   │
│       Ekipman ve malzemeleri yönetin                    │
└─────────────────────────────────────────────────────────┘
  Turuncu gradient bg, turuncu border, hover scale
📊 2. DATA YAPISI
interface Equipment {
  id: string;                               // 'eq-1'
  category: 'computer' | 'camera' | 'flash' | 'printer';
  brand: string;                            // 'Canon', 'Sony', 'Apple'
  model: string;                            // 'EOS R5', 'A7 III'
  serialNumber: string;                     // 'CN1234567'
  status: 'working' | 'broken' | 'maintenance';
  location: string;                         // 'ZOKA', 'Balık Hali', vb.
  flashId?: string;                         // Sadece kameralar için
  notes?: string;                           // Arıza notları vb.
  assignedTo?: string;                      // 'Ahmet Yılmaz' veya undefined (genel havuz)
}

interface EquipmentPageProps {
  userName?: string;
  userRole?: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
  embedded?: boolean;                       // Location Management içinde gösterim
  onBack?: () => void;
}
Mock Data Örneği:

const mockEquipmentList: Equipment[] = [
  {
    id: '1',
    category: 'camera',
    brand: 'Canon',
    model: 'EOS R5',
    serialNumber: 'CN1234567',
    status: 'working',
    location: 'Operasyonel',
    flashId: '7',
    assignedTo: 'Ahmet Yılmaz'
  },
  {
    id: '2',
    category: 'printer',
    brand: 'Canon',
    model: 'SELPHY CP1500',
    serialNumber: 'PR1001',
    status: 'working',
    location: 'ZOKA',
    assignedTo: 'Mehmet Kaya'
  },
  {
    id: '3',
    category: 'printer',
    brand: 'Canon',
    model: 'SELPHY CP1300',
    serialNumber: 'PR1002',
    status: 'broken',
    location: 'Hayal Kahvesi',
    notes: 'Kağıt sıkışması'
  },
  {
    id: '4',
    category: 'flash',
    brand: 'Canon',
    model: 'Speedlite 600EX',
    serialNumber: 'FL100001',
    status: 'working',
    location: 'Operasyonel',
    assignedTo: 'Ahmet Yılmaz'
  },
  {
    id: '5',
    category: 'computer',
    brand: 'Apple',
    model: 'MacBook Pro 16"',
    serialNumber: 'MB2024001',
    status: 'working',
    location: 'Ofis',
    assignedTo: 'Can Şahin'
  }
];

const staffList = [
  'Ahmet Yılmaz',
  'Ayşe Demir',
  'Mehmet Kaya',
  'Zeynep Öztürk',
  'Can Şahin',
  'Elif Arslan',
];

const locations = [
  'ZOKA',
  'Balık Hali',
  'Hayal Kahvesi',
  'Tekne Projesi',
  'Ofis',
  'Depo',
  'Operasyonel'
];
📈 3. İSTATİSTİK KARTLARI (4 Stats)
<div className="grid grid-cols-4 gap-3">
  {/* 1. Toplam */}
  <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-xl p-3 flex flex-col items-center justify-center">
    <div className="text-2xl font-bold text-white mb-0.5">{stats.totalEquipment}</div>
    <div className="text-[10px] text-gray-400">Toplam</div>
  </div>

  {/* 2. Çalışıyor (Yeşil) */}
  <div className="backdrop-blur-xl bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-xl p-3 flex flex-col items-center justify-center">
    <div className="text-2xl font-bold text-green-400 mb-0.5">{stats.working}</div>
    <div className="text-[10px] text-gray-400">Çalışıyor</div>
  </div>

  {/* 3. Arızalı (Kırmızı) */}
  <div className="backdrop-blur-xl bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30 rounded-xl p-3 flex flex-col items-center justify-center">
    <div className="text-2xl font-bold text-red-400 mb-0.5">{stats.broken}</div>
    <div className="text-[10px] text-gray-400">Arızalı</div>
  </div>

  {/* 4. Bakımda (Sarı) */}
  <div className="backdrop-blur-xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30 rounded-xl p-3 flex flex-col items-center justify-center">
    <div className="text-2xl font-bold text-yellow-400 mb-0.5">{stats.maintenance}</div>
    <div className="text-[10px] text-gray-400">Bakımda</div>
  </div>
</div>
İstatistik Hesaplama:

const stats = {
  totalEquipment: equipmentList.length,
  working: equipmentList.filter(eq => eq.status === 'working').length,
  broken: equipmentList.filter(eq => eq.status === 'broken').length,
  maintenance: equipmentList.filter(eq => eq.status === 'maintenance').length,
};
🎨 4. KATEGORİ VE DURUM TANIMLARI
const categories = [
  { id: 'all', label: 'Tümü', icon: '📦', color: '#9ca3af' },
  { id: 'camera', label: 'Kameralar', icon: '📷', color: '#d4b5f7' }, // Mor
  { id: 'flash', label: 'Flashlar', icon: '⚡', color: '#ffd4a3' },   // Turuncu
  { id: 'printer', label: 'Yazıcılar', icon: '🖨️', color: '#9dd9ea' }, // Mavi
  { id: 'computer', label: 'Bilgisayarlar', icon: '💻', color: '#a8e6cf' }, // Yeşil
];

const statuses = [
  { id: 'all', label: 'Tümü', icon: '📋', color: 'gray' },
  { id: 'working', label: 'Çalışıyor', icon: '✅', color: 'green' },
  { id: 'broken', label: 'Arızalı', icon: '❌', color: 'red' },
  { id: 'maintenance', label: 'Bakımda', icon: '🔧', color: 'yellow' },
];

// Yardımcı Fonksiyonlar
const getCategoryIcon = (category: string) => {
  return categories.find(c => c.id === category)?.icon || '📦';
};

const getCategoryColor = (category: string) => {
  const cat = categories.find(c => c.id === category);
  return cat?.color || '#9dd9ea';
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'working': return 'bg-green-500/20 border-green-500/30 text-green-400';
    case 'broken': return 'bg-red-500/20 border-red-500/30 text-red-400';
    case 'maintenance': return 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400';
    default: return 'bg-gray-500/20 border-gray-500/30 text-gray-400';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'working': return 'Çalışıyor';
    case 'broken': return 'Arızalı';
    case 'maintenance': return 'Bakımda';
    default: return status;
  }
};

const getCategoryLabel = (category: string) => {
  switch (category) {
    case 'camera': return 'Kamera';
    case 'flash': return 'Flash';
    case 'printer': return 'Yazıcı';
    case 'computer': return 'Bilgisayar';
    default: return category;
  }
};
🔍 5. FİLTRELEME SİSTEMİ
{/* Kategori Filtresi */}
<div className="flex items-center gap-2 overflow-x-auto">
  {categories.map((cat) => (
    <button
      key={cat.id}
      onClick={() => setSelectedCategory(cat.id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-semibold text-xs whitespace-nowrap transition-all ${
        selectedCategory === cat.id
          ? 'bg-white/10 border-white/30 text-white'
          : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
      }`}
    >
      <span>{cat.icon}</span>
      <span>{cat.label}</span>
    </button>
  ))}
</div>

{/* Durum Filtresi */}
<div className="flex items-center gap-2 overflow-x-auto">
  {statuses.map((status) => (
    <button
      key={status.id}
      onClick={() => setSelectedStatus(status.id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-semibold text-xs whitespace-nowrap transition-all ${
        selectedStatus === status.id
          ? 'bg-white/10 border-white/30 text-white'
          : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
      }`}
    >
      <span>{status.icon}</span>
      <span>{status.label}</span>
    </button>
  ))}
</div>

{/* Zimmet Filtresi */}
<select
  value={selectedAssignment}
  onChange={(e) => setSelectedAssignment(e.target.value)}
  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
>
  <option value="all">👥 Tümü</option>
  <option value="unassigned">📦 Zimmetsiz (Genel Havuz)</option>
  <option value="assigned">👤 Zimmetli</option>
  {staffList.map((staff) => (
    <option key={staff} value={staff}>👤 {staff}</option>
  ))}
</select>

{/* Arama Çubuğu */}
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
  <input
    type="text"
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    placeholder="Marka, model veya seri no ara..."
    className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-3 py-2 text-white text-sm placeholder:text-gray-600"
  />
</div>
Filtreleme Mantığı:

const filteredEquipment = equipmentList.filter((equipment) => {
  // Arama
  const matchesSearch = 
    equipment.brand.toLowerCase().includes(searchQuery.toLowerCase()) || 
    equipment.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
    equipment.serialNumber.toLowerCase().includes(searchQuery.toLowerCase());
  
  // Kategori
  const matchesCategory = selectedCategory === 'all' || equipment.category === selectedCategory;
  
  // Durum
  const matchesStatus = selectedStatus === 'all' || equipment.status === selectedStatus;
  
  // Zimmet
  let matchesAssignment = true;
  if (selectedAssignment === 'unassigned') {
    matchesAssignment = !equipment.assignedTo;
  } else if (selectedAssignment === 'assigned') {
    matchesAssignment = !!equipment.assignedTo;
  } else if (selectedAssignment !== 'all') {
    matchesAssignment = equipment.assignedTo === selectedAssignment;
  }
  
  return matchesSearch && matchesCategory && matchesStatus && matchesAssignment;
});
📦 6. EKIPMAN KARTI
{filteredEquipment.map((equipment) => {
  const categoryColor = getCategoryColor(equipment.category);
  
  return (
    <div
      key={equipment.id}
      className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5 hover:border-white/30 transition-all"
    >
      {/* Header: Kategori Icon + Marka/Model */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Kategori Icon */}
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
            style={{ backgroundColor: `${categoryColor}33`, border: `2px solid ${categoryColor}66` }}
          >
            <span className="text-2xl">{getCategoryIcon(equipment.category)}</span>
          </div>
          
          {/* Marka + Model */}
          <div>
            <h3 className="font-bold text-white text-lg">{equipment.brand} {equipment.model}</h3>
            <p className="text-xs text-gray-400">{getCategoryLabel(equipment.category)}</p>
          </div>
        </div>
        
        {/* Durum Badge */}
        <div className={`px-3 py-1 rounded-lg border text-xs font-semibold ${getStatusColor(equipment.status)}`}>
          {getStatusLabel(equipment.status)}
        </div>
      </div>
      
      {/* Seri No */}
      <div className="bg-black/40 rounded-lg px-3 py-2 mb-3">
        <div className="text-xs text-gray-400 mb-1">Seri Numarası</div>
        <div className="font-mono text-white text-sm">{equipment.serialNumber}</div>
      </div>
      
      {/* Lokasyon + Zimmet */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-white/5 rounded-lg px-3 py-2">
          <div className="text-xs text-gray-400 mb-1">📍 Lokasyon</div>
          <div className="text-white text-sm font-semibold">{equipment.location}</div>
        </div>
        
        <div className="bg-white/5 rounded-lg px-3 py-2">
          <div className="text-xs text-gray-400 mb-1">👤 Zimmet</div>
          <div className="text-white text-sm font-semibold">
            {equipment.assignedTo || 'Genel Havuz'}
          </div>
        </div>
      </div>
      
      {/* Flash ID (Sadece kameralar için) */}
      {equipment.category === 'camera' && equipment.flashId && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <span className="text-xs text-blue-300">
              Flash ID: <span className="font-bold">#{equipment.flashId}</span>
            </span>
          </div>
        </div>
      )}
      
      {/* Notlar */}
      {equipment.notes && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 mb-3">
          <div className="text-xs text-yellow-300">💬 {equipment.notes}</div>
        </div>
      )}
      
      {/* Action Buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => startEdit(equipment)}
          className="bg-blue-500/20 border border-blue-500/30 text-blue-400 font-semibold py-2 rounded-lg text-xs transition-all active:scale-95 flex items-center justify-center gap-1"
        >
          <Edit2 className="w-3.5 h-3.5" />
          Düzenle
        </button>
        
        <button
          onClick={() => openAssignModal(equipment)}
          className="bg-purple-500/20 border border-purple-500/30 text-purple-400 font-semibold py-2 rounded-lg text-xs transition-all active:scale-95 flex items-center justify-center gap-1"
        >
          <User className="w-3.5 h-3.5" />
          Zimmet
        </button>
        
        <button
          onClick={() => handleDelete(equipment.id)}
          className="bg-red-500/20 border border-red-500/30 text-red-400 font-semibold py-2 rounded-lg text-xs transition-all active:scale-95 flex items-center justify-center gap-1"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Sil
        </button>
      </div>
    </div>
  );
})}
➕ 7. EKLE/DÜZENLE MODAL
{showAddModal && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
    <div className="backdrop-blur-xl bg-gradient-to-br from-white/20 to-white/10 border border-white/30 rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white">
          {editingEquipment ? 'Ekipman Düzenle' : 'Yeni Ekipman Ekle'}
        </h3>
        <button onClick={closeModal}>
          <X className="w-6 h-6 text-gray-400 hover:text-white" />
        </button>
      </div>
      
      <div className="space-y-3">
        {/* Kategori */}
        <div>
          <label className="block text-sm text-gray-300 mb-2">Kategori</label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white"
          >
            <option value="camera">📷 Kamera</option>
            <option value="flash">⚡ Flash</option>
            <option value="printer">🖨️ Yazıcı</option>
            <option value="computer">💻 Bilgisayar</option>
          </select>
        </div>
        
        {/* Marka */}
        <div>
          <label className="block text-sm text-gray-300 mb-2">Marka</label>
          <input
            type="text"
            value={formData.brand}
            onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
            placeholder="Örn: Canon, Sony"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-gray-600"
          />
        </div>
        
        {/* Model */}
        <div>
          <label className="block text-sm text-gray-300 mb-2">Model</label>
          <input
            type="text"
            value={formData.model}
            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
            placeholder="Örn: EOS R5"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white"
          />
        </div>
        
        {/* Seri Numarası */}
        <div>
          <label className="block text-sm text-gray-300 mb-2">Seri Numarası</label>
          <input
            type="text"
            value={formData.serialNumber}
            onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
            placeholder="CN1234567"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono"
          />
        </div>
        
        {/* Durum */}
        <div>
          <label className="block text-sm text-gray-300 mb-2">Durum</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white"
          >
            <option value="working">✅ Çalışıyor</option>
            <option value="broken">❌ Arızalı</option>
            <option value="maintenance">🔧 Bakımda</option>
          </select>
        </div>
        
        {/* Lokasyon */}
        <div>
          <label className="block text-sm text-gray-300 mb-2">Lokasyon</label>
          <select
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white"
          >
            <option value="">Lokasyon seçin</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </div>
        
        {/* Flash ID (Sadece kamera seçiliyse) */}
        {formData.category === 'camera' && (
          <div>
            <label className="block text-sm text-gray-300 mb-2">Flash ID (Opsiyonel)</label>
            <input
              type="text"
              value={formData.flashId || ''}
              onChange={(e) => setFormData({ ...formData, flashId: e.target.value })}
              placeholder="Flash ID"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white"
            />
          </div>
        )}
        
        {/* Notlar */}
        <div>
          <label className="block text-sm text-gray-300 mb-2">Notlar (Opsiyonel)</label>
          <textarea
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Ekstra bilgiler, arıza detayları vb."
            rows={3}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-gray-600"
          />
        </div>
        
        {/* Butonlar */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            onClick={handleSave}
            className="bg-gradient-to-r from-green-500/20 to-green-600/20 border border-green-500/30 text-green-400 font-semibold py-2 rounded-lg"
          >
            💾 Kaydet
          </button>
          <button
            onClick={closeModal}
            className="bg-gradient-to-r from-gray-500/20 to-gray-600/20 border border-gray-500/30 text-gray-400 font-semibold py-2 rounded-lg"
          >
            ✖️ İptal
          </button>
        </div>
      </div>
    </div>
  </div>
)}
👤 8. ZİMMET ATAMA MODAL
{showAssignModal && assigningEquipment && (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
    <div className="backdrop-blur-xl bg-gradient-to-br from-white/20 to-white/10 border border-white/30 rounded-2xl p-6 max-w-md w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white">Zimmet Ata</h3>
        <button onClick={() => setShowAssignModal(false)}>
          <X className="w-6 h-6 text-gray-400 hover:text-white" />
        </button>
      </div>
      
      {/* Mevcut Ekipman Bilgisi */}
      <div className="bg-black/40 rounded-lg p-3 mb-4">
        <div className="text-sm font-semibold text-white mb-1">
          {assigningEquipment.brand} {assigningEquipment.model}
        </div>
        <div className="text-xs text-gray-400">
          {assigningEquipment.serialNumber}
        </div>
      </div>
      
      {/* Personel Listesi */}
      <div className="space-y-2 mb-4">
        {/* Genel Havuz (Zimmetsiz) */}
        <button
          onClick={() => handleAssign(null)}
          className={`w-full text-left p-3 rounded-lg border transition-all ${
            !assigningEquipment.assignedTo
              ? 'bg-purple-500/20 border-purple-500/30 text-purple-300'
              : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">📦</span>
            <span className="font-semibold">Genel Havuz (Zimmetsiz)</span>
          </div>
        </button>
        
        {/* Personel Listesi */}
        {staffList.map((staff) => (
          <button
            key={staff}
            onClick={() => handleAssign(staff)}
            className={`w-full text-left p-3 rounded-lg border transition-all ${
              assigningEquipment.assignedTo === staff
                ? 'bg-blue-500/20 border-blue-500/30 text-blue-300'
                : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">👤</span>
              <span className="font-semibold">{staff}</span>
            </div>
          </button>
        ))}
      </div>
      
      <button
        onClick={() => setShowAssignModal(false)}
        className="w-full bg-gray-500/20 border border-gray-500/30 text-gray-400 font-semibold py-2 rounded-lg"
      >
        Kapat
      </button>
    </div>
  </div>
)}
⚙️ 9. FONKSİYONLAR
// Ekipman Ekleme
const handleAddEquipment = () => {
  const newEquipment: Equipment = {
    id: `eq-${Date.now()}`,
    category: formData.category!,
    brand: formData.brand!,
    model: formData.model!,
    serialNumber: formData.serialNumber!,
    status: formData.status!,
    location: formData.location!,
    flashId: formData.flashId,
    notes: formData.notes,
    assignedTo: undefined,
  };
  
  setEquipmentList([...equipmentList, newEquipment]);
  closeModal();
  alert('✅ Ekipman eklendi!');
};

// Ekipman Güncelleme
const handleUpdateEquipment = () => {
  setEquipmentList(
    equipmentList.map((eq) =>
      eq.id === editingEquipment!.id
        ? { ...eq, ...formData }
        : eq
    )
  );
  closeModal();
  alert('✅ Ekipman güncellendi!');
};

// Ekipman Silme
const handleDelete = (id: string) => {
  const equipment = equipmentList.find(eq => eq.id === id);
  if (!equipment) return;
  
  if (!confirm(`${equipment.brand} ${equipment.model} silinecek. Emin misiniz?`)) return;
  
  setEquipmentList(equipmentList.filter(eq => eq.id !== id));
  alert('✅ Ekipman silindi!');
};

// Zimmet Atama
const handleAssign = (staffName: string | null) => {
  if (!assigningEquipment) return;
  
  setEquipmentList(
    equipmentList.map((eq) =>
      eq.id === assigningEquipment.id
        ? { ...eq, assignedTo: staffName || undefined }
        : eq
    )
  );
  
  setShowAssignModal(false);
  alert(`✅ Zimmet ${staffName ? `${staffName}'a atandı` : 'kaldırıldı'}!`);
};

// Düzenleme Başlat
const startEdit = (equipment: Equipment) => {
  setEditingEquipment(equipment);
  setFormData(equipment);
  setShowAddModal(true);
};

// Modal Kapat
const closeModal = () => {
  setShowAddModal(false);
  setEditingEquipment(null);
  setFormData({
    category: 'camera',
    brand: '',
    model: '',
    serialNumber: '',
    status: 'working',
    location: '',
    flashId: '',
    notes: '',
  });
};

// Zimmet Modal Aç
const openAssignModal = (equipment: Equipment) => {
  setAssigningEquipment(equipment);
  setShowAssignModal(true);
};
📱 10. EMBEDDED MOD (Location Management İçinde)
// Location Management içinde kullanım
<div className="mb-6 mt-12 pt-8 border-t-2 border-white/10">
  <div className="flex items-center gap-2 mb-2">
    <h2 className="text-2xl font-bold text-white">Malzeme Yönetimi</h2>
    <span className="text-2xl">📦</span>
  </div>
  <p className="text-sm text-gray-400">Ekipman ve malzemeleri takip edin</p>
</div>

<EquipmentPage 
  embedded={true}
  userName={userName}
  userRole={userRole}
  onNavigate={onNavigate}
  onLogout={onLogout}
/>
Embedded modda:

StaffTopBar/NewBottomNav gizlenir
Padding'ler kaldırılır
Geri butonu gizlenir
{!embedded && (
  <StaffTopBar ... />
)}

<div className={embedded ? "mb-4" : "px-6 mb-4"}>
  {/* İçerik */}
</div>

{!embedded && (
  <NewBottomNav ... />
)}
✅ 11. ÖZET CHECKLIST
✅ Menü kartı (turuncu gradient, 📦 emoji, ArrowRight)
✅ 4 kategori (Kamera, Flash, Yazıcı, Bilgisayar)
✅ 4 istatistik kartı (Toplam, Çalışıyor, Arızalı, Bakımda)
✅ Kategori filtresi (emoji butonlar)
✅ Durum filtresi (emoji butonlar)
✅ Zimmet filtresi (dropdown: Tümü, Zimmetsiz, Zimmetli, [Personeller])
✅ Arama çubuğu (marka, model, seri no)
✅ Ekipman kartları (kategori icon, marka/model, seri no, durum badge)
✅ Lokasyon + Zimmet bilgisi
✅ Flash ID (sadece kameralar için)
✅ Notlar alanı (sarı arka plan)
✅ Düzenle + Zimmet + Sil butonları
✅ Ekle/Düzenle modal (tüm alanlar)
✅ Zimmet atama modal (personel listesi)
✅ Embedded mod desteği
✅ Glassmorphism tasarım
✅ Mobile responsive
✅ Koyu gradient arka plan
✅ Türkçe etiketler