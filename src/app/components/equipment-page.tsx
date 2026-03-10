import { useState, useEffect } from 'react';
import { ArrowLeft, Search, Plus, Edit2, Trash2, User, X, Save } from 'lucide-react';
import { NewBottomNav } from './new-bottom-nav';
import { UserRole } from './login';

interface Equipment {
  id: string;
  category: 'computer' | 'camera' | 'flash' | 'printer';
  brand: string;
  model: string;
  serialNumber: string;
  status: 'working' | 'broken' | 'maintenance';
  location: string;
  flashId?: string;
  notes?: string;
  assignedTo?: string;
}

interface EquipmentPageProps {
  userName: string;
  userRole: UserRole;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
  embedded?: boolean;
}

export function EquipmentPage({ userName, userRole, onLogout, onNavigate, embedded = false }: EquipmentPageProps) {
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedAssignment, setSelectedAssignment] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [assigningEquipment, setAssigningEquipment] = useState<Equipment | null>(null);
  const [staffList, setStaffList] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    category: 'camera' as 'computer' | 'camera' | 'flash' | 'printer',
    brand: '',
    model: '',
    serialNumber: '',
    status: 'working' as 'working' | 'broken' | 'maintenance',
    location: '',
    flashId: '',
    notes: '',
  });

  // Permission checks
  const canAddEquipment = () => {
    return userRole === 'yonetici' || userRole === 'ust-mudur' || userRole === 'mudur' || userRole === 'operasyon';
  };

  const canEditEquipment = () => {
    return userRole === 'yonetici' || userRole === 'ust-mudur' || userRole === 'mudur' || userRole === 'operasyon';
  };

  const canDeleteEquipment = () => {
    return userRole === 'yonetici' || userRole === 'ust-mudur' || userRole === 'mudur';
  };

  const canAssignEquipment = () => {
    return userRole === 'yonetici' || userRole === 'ust-mudur' || userRole === 'mudur';
  };

  // Mock data
  const mockEquipmentList: Equipment[] = [
    {
      id: '1',
      category: 'camera',
      brand: 'Canon',
      model: 'EOS R5',
      serialNumber: 'CN1234567',
      status: 'working',
      location: 'ZOKA Beach Club',
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
      location: 'ZOKA Beach Club',
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
      location: 'ZOKA Beach Club',
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
    },
    {
      id: '6',
      category: 'flash',
      brand: 'Canon',
      model: 'Speedlite 430EX',
      serialNumber: 'FL100002',
      status: 'working',
      location: 'Balık Hali',
    },
    {
      id: '7',
      category: 'flash',
      brand: 'Canon',
      model: 'Speedlite 600EX',
      serialNumber: 'FL100003',
      status: 'working',
      location: 'ZOKA Beach Club',
    },
  ];

  // Load data from localStorage
  useEffect(() => {
    // Load equipment
    const storedEquipment = localStorage.getItem('aspect_malzeme');
    if (storedEquipment) {
      setEquipmentList(JSON.parse(storedEquipment));
    } else {
      setEquipmentList(mockEquipmentList);
      localStorage.setItem('aspect_malzeme', JSON.stringify(mockEquipmentList));
    }

    // Load staff list from user management
    const storedUsers = localStorage.getItem('aspect_users');
    if (storedUsers) {
      const users = JSON.parse(storedUsers);
      const staffNames = users.map((user: any) => user.name || user.username);
      setStaffList(staffNames);
    } else {
      setStaffList(['Ahmet Yılmaz', 'Ayşe Demir', 'Mehmet Kaya', 'Zeynep Öztürk', 'Can Şahin', 'Elif Arslan']);
    }

    // Load locations from mekan management
    const storedLocations = localStorage.getItem('aspect_locations');
    if (storedLocations) {
      const locs = JSON.parse(storedLocations);
      const locationNames = locs.map((loc: any) => loc.name);
      setLocations([...locationNames, 'Ofis', 'Depo', 'Operasyonel']);
    } else {
      setLocations(['ZOKA Beach Club', 'Balık Hali', 'Hayal Kahvesi', 'Tekne Turu', 'Ofis', 'Depo', 'Operasyonel']);
    }
  }, []);

  // Save equipment to localStorage
  const saveEquipment = (newList: Equipment[]) => {
    setEquipmentList(newList);
    localStorage.setItem('aspect_malzeme', JSON.stringify(newList));
  };

  const categories = [
    { id: 'all', label: 'Tümü', icon: '📦', color: '#9ca3af' },
    { id: 'camera', label: 'Kamera', icon: '📷', color: '#d4b5f7' },
    { id: 'flash', label: 'Flash', icon: '⚡', color: '#ffd4a3' },
    { id: 'printer', label: 'Yazıcı', icon: '🖨️', color: '#9dd9ea' },
    { id: 'computer', label: 'Bilgisayar', icon: '💻', color: '#a8e6cf' },
  ];

  const statuses = [
    { id: 'all', label: 'Tümü', icon: '📋', color: 'gray' },
    { id: 'working', label: 'Çalışıyor', icon: '✅', color: 'green' },
    { id: 'broken', label: 'Arızalı', icon: '❌', color: 'red' },
    { id: 'maintenance', label: 'Bakımda', icon: '🔧', color: 'yellow' },
  ];

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
      case 'camera': return 'Kameralar';
      case 'flash': return 'Flashlar';
      case 'printer': return 'Yazıcılar';
      case 'computer': return 'Bilgisayarlar';
      default: return category;
    }
  };

  // Filter equipment
  const filteredEquipment = equipmentList.filter((equipment) => {
    const matchesSearch = 
      equipment.brand.toLowerCase().includes(searchQuery.toLowerCase()) || 
      equipment.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      equipment.serialNumber.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || equipment.category === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || equipment.status === selectedStatus;
    
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

  // Calculate stats
  const stats = {
    totalEquipment: equipmentList.length,
    working: equipmentList.filter(eq => eq.status === 'working').length,
    broken: equipmentList.filter(eq => eq.status === 'broken').length,
    maintenance: equipmentList.filter(eq => eq.status === 'maintenance').length,
  };

  // Get available flashes (not assigned to any camera)
  const getAvailableFlashes = () => {
    const assignedFlashIds = equipmentList
      .filter(eq => eq.category === 'camera' && eq.flashId)
      .map(eq => eq.flashId);
    
    return equipmentList
      .filter(eq => eq.category === 'flash' && !assignedFlashIds.includes(eq.id));
  };

  const handleSave = () => {
    if (!formData.brand || !formData.model || !formData.serialNumber || !formData.location) {
      alert('⚠️ Lütfen tüm zorunlu alanları doldurun!');
      return;
    }

    if (editingEquipment) {
      // Update existing
      const updatedList = equipmentList.map((eq) =>
        eq.id === editingEquipment.id
          ? { ...eq, ...formData, flashId: formData.flashId || undefined, notes: formData.notes || undefined }
          : eq
      );
      saveEquipment(updatedList);
      alert('✅ Ekipman güncellendi!');
    } else {
      // Add new
      const newEquipment: Equipment = {
        id: `eq-${Date.now()}`,
        category: formData.category,
        brand: formData.brand,
        model: formData.model,
        serialNumber: formData.serialNumber,
        status: formData.status,
        location: formData.location,
        flashId: formData.flashId || undefined,
        notes: formData.notes || undefined,
        assignedTo: undefined,
      };
      saveEquipment([...equipmentList, newEquipment]);
      alert('✅ Ekipman eklendi!');
    }
    closeModal();
  };

  const handleDelete = (id: string) => {
    const equipment = equipmentList.find(eq => eq.id === id);
    if (!equipment) return;
    
    if (!confirm(`${equipment.brand} ${equipment.model} silinecek. Emin misiniz?`)) return;
    
    saveEquipment(equipmentList.filter(eq => eq.id !== id));
    alert('✅ Ekipman silindi!');
  };

  const handleAssign = (staffName: string | null) => {
    if (!assigningEquipment) return;
    
    const updatedList = equipmentList.map((eq) =>
      eq.id === assigningEquipment.id
        ? { ...eq, assignedTo: staffName || undefined }
        : eq
    );
    saveEquipment(updatedList);
    
    setShowAssignModal(false);
    setAssigningEquipment(null);
    alert(`✅ Zimmet ${staffName ? `${staffName}'a atandı` : 'kaldırıldı'}!`);
  };

  const startEdit = (equipment: Equipment) => {
    setEditingEquipment(equipment);
    setFormData({
      category: equipment.category,
      brand: equipment.brand,
      model: equipment.model,
      serialNumber: equipment.serialNumber,
      status: equipment.status,
      location: equipment.location,
      flashId: equipment.flashId || '',
      notes: equipment.notes || '',
    });
    setShowAddModal(true);
  };

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

  const openAssignModal = (equipment: Equipment) => {
    setAssigningEquipment(equipment);
    setShowAssignModal(true);
  };

  return (
    <div className="pb-20 bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] min-h-screen">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-2">
          <button 
            onClick={() => onNavigate('resource-management')}
            className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-white">Malzeme Yönetimi</h1>
            <span className="text-3xl">📦</span>
          </div>
        </div>
        <p className="text-sm text-gray-400 ml-[52px]">Ekipman ve malzemeleri yönetin</p>
      </div>

      {/* Stats Cards */}
      <div className="px-6 mb-6">
        <div className="grid grid-cols-4 gap-3">
          {/* Toplam */}
          <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-xl p-3 flex flex-col items-center justify-center">
            <div className="text-2xl font-bold text-white mb-0.5">{stats.totalEquipment}</div>
            <div className="text-[10px] text-gray-400">Toplam</div>
          </div>

          {/* Çalışıyor */}
          <div className="backdrop-blur-xl bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-xl p-3 flex flex-col items-center justify-center">
            <div className="text-2xl font-bold text-green-400 mb-0.5">{stats.working}</div>
            <div className="text-[10px] text-gray-400">Çalışıyor</div>
          </div>

          {/* Arızalı */}
          <div className="backdrop-blur-xl bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30 rounded-xl p-3 flex flex-col items-center justify-center">
            <div className="text-2xl font-bold text-red-400 mb-0.5">{stats.broken}</div>
            <div className="text-[10px] text-gray-400">Arızalı</div>
          </div>

          {/* Bakımda */}
          <div className="backdrop-blur-xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30 rounded-xl p-3 flex flex-col items-center justify-center">
            <div className="text-2xl font-bold text-yellow-400 mb-0.5">{stats.maintenance}</div>
            <div className="text-[10px] text-gray-400">Bakımda</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 mb-6 space-y-3">
        {/* Category Filter */}
        <div>
          <div className="text-xs text-gray-400 mb-2">Kategori</div>
          
          {/* Tümü Button */}
          <button
            onClick={() => setSelectedCategory('all')}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border font-semibold text-xs transition-all mb-2 ${
              selectedCategory === 'all'
                ? 'bg-white/10 border-white/30 text-white'
                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
            }`}
          >
            <span>📦</span>
            <span>Tümü</span>
          </button>
          
          {/* Other Categories */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide mb-2">
            {categories.filter(cat => cat.id !== 'all').map((cat) => (
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
          
          {/* Separator Line */}
          <div className="h-px bg-white/10"></div>
        </div>

        {/* Status Filter */}
        <div>
          <div className="text-xs text-gray-400 mb-2">Durum</div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
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
        </div>

        {/* Assignment Filter */}
        <div>
          <div className="text-xs text-gray-400 mb-2">Zimmet</div>
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
        </div>

        {/* Search */}
        <div>
          <div className="text-xs text-gray-400 mb-2">Ara</div>
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
        </div>
      </div>

      {/* Add Button */}
      {/* Add Equipment Button - Only for authorized roles */}
      {canAddEquipment() && (
        <div className="px-6 mb-4">
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full bg-gradient-to-r from-green-500/20 to-green-600/20 border border-green-500/30 text-green-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:from-green-500/30 hover:to-green-600/30 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Yeni Ekipman Ekle
          </button>
        </div>
      )}

      {/* Equipment List */}
      <div className="px-6 space-y-3 pb-6">
        {filteredEquipment.length === 0 ? (
          <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3">📭</div>
            <div className="text-white font-semibold mb-1">Ekipman bulunamadı</div>
            <div className="text-sm text-gray-400">Filtreleri değiştirin veya yeni ekipman ekleyin</div>
          </div>
        ) : (
          filteredEquipment.map((equipment) => {
            const categoryColor = getCategoryColor(equipment.category);
            
            return (
              <div
                key={equipment.id}
                className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5 hover:border-white/30 transition-all"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {/* Category Icon */}
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
                      style={{ backgroundColor: `${categoryColor}33`, border: `2px solid ${categoryColor}66` }}
                    >
                      <span className="text-2xl">{getCategoryIcon(equipment.category)}</span>
                    </div>
                    
                    {/* Brand + Model */}
                    <div>
                      <h3 className="font-bold text-white text-lg">{equipment.brand} {equipment.model}</h3>
                      <p className="text-xs text-gray-400">{getCategoryLabel(equipment.category)}</p>
                    </div>
                  </div>
                  
                  {/* Status Badge */}
                  <div className={`px-3 py-1 rounded-lg border text-xs font-semibold ${getStatusColor(equipment.status)}`}>
                    {getStatusLabel(equipment.status)}
                  </div>
                </div>
                
                {/* Serial Number */}
                <div className="bg-black/40 rounded-lg px-3 py-2 mb-3">
                  <div className="text-xs text-gray-400 mb-1">Seri Numarası</div>
                  <div className="font-mono text-white text-sm">{equipment.serialNumber}</div>
                </div>
                
                {/* Location + Assignment */}
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
                
                {/* Assigned Flash */}
                {equipment.category === 'camera' && equipment.flashId && (() => {
                  const assignedFlash = equipmentList.find(eq => eq.id === equipment.flashId);
                  return (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">⚡</span>
                        <div>
                          <div className="text-xs text-blue-300">Atanmış Flash</div>
                          {assignedFlash && (
                            <div className="font-bold text-white text-sm">
                              {assignedFlash.brand} {assignedFlash.model}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
                
                {/* Notes */}
                {equipment.notes && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 mb-3">
                    <div className="text-xs text-yellow-300">💬 {equipment.notes}</div>
                  </div>
                )}
                
                {/* Action Buttons - Role-based visibility */}
                <div className={`grid gap-2 ${
                  canEditEquipment() && canAssignEquipment() && canDeleteEquipment() ? 'grid-cols-3' :
                  (canEditEquipment() && !canAssignEquipment() && !canDeleteEquipment()) || 
                  (!canEditEquipment() && !canAssignEquipment() && !canDeleteEquipment()) ? 'grid-cols-1' : 'grid-cols-2'
                }`}>
                  {canEditEquipment() && (
                    <button
                      onClick={() => startEdit(equipment)}
                      className="bg-blue-500/20 border border-blue-500/30 text-blue-400 font-semibold py-2 rounded-lg text-xs transition-all active:scale-95 flex items-center justify-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Düzenle
                    </button>
                  )}
                  
                  {canAssignEquipment() && (
                    <button
                      onClick={() => openAssignModal(equipment)}
                      className="bg-purple-500/20 border border-purple-500/30 text-purple-400 font-semibold py-2 rounded-lg text-xs transition-all active:scale-95 flex items-center justify-center gap-1"
                    >
                      <User className="w-3.5 h-3.5" />
                      Zimmet
                    </button>
                  )}
                  
                  {canDeleteEquipment() && (
                    <button
                      onClick={() => handleDelete(equipment.id)}
                      className="bg-red-500/20 border border-red-500/30 text-red-400 font-semibold py-2 rounded-lg text-xs transition-all active:scale-95 flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Sil
                    </button>
                  )}
                  
                  {!canEditEquipment() && !canAssignEquipment() && !canDeleteEquipment() && (
                    <div className="bg-gray-500/10 border border-gray-500/30 text-gray-400 font-semibold py-2 rounded-lg text-xs flex items-center justify-center">
                      Görüntüleme Modu
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
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
              {/* Category */}
              <div>
                <label className="block text-sm text-gray-300 mb-2">Kategori</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white"
                >
                  <option value="camera">📷 Kameralar</option>
                  <option value="flash">⚡ Flashlar</option>
                  <option value="printer">🖨️ Yazıcılar</option>
                  <option value="computer">💻 Bilgisayarlar</option>
                </select>
              </div>
              
              {/* Brand */}
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
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-gray-600"
                />
              </div>
              
              {/* Serial Number */}
              <div>
                <label className="block text-sm text-gray-300 mb-2">Seri Numarası</label>
                <input
                  type="text"
                  value={formData.serialNumber}
                  onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  placeholder="CN1234567"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono placeholder:text-gray-600"
                />
              </div>
              
              {/* Status */}
              <div>
                <label className="block text-sm text-gray-300 mb-2">Durum</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white"
                >
                  <option value="working">✅ Çalışıyor</option>
                  <option value="broken">❌ Arızalı</option>
                  <option value="maintenance">🔧 Bakımda</option>
                </select>
              </div>
              
              {/* Location */}
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
              
              {/* Flash ID (Only for cameras) */}
              {formData.category === 'camera' && (
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Flash ID (Opsiyonel)</label>
                  <select
                    value={formData.flashId}
                    onChange={(e) => setFormData({ ...formData, flashId: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="">Flash seçin</option>
                    {getAvailableFlashes().map((flash) => (
                      <option key={flash.id} value={flash.id}>
                        ⚡ {flash.brand} {flash.model} (#{flash.id})
                      </option>
                    ))}
                    {editingEquipment?.flashId && (
                      <option key={`current-flash-${editingEquipment.flashId}`} value={editingEquipment.flashId}>
                        ⚡ Mevcut Flash (#{editingEquipment.flashId})
                      </option>
                    )}
                  </select>
                </div>
              )}
              
              {/* Notes */}
              <div>
                <label className="block text-sm text-gray-300 mb-2">Notlar (Opsiyonel)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Ekstra bilgiler, arıza detayları vb."
                  rows={3}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white placeholder:text-gray-600"
                />
              </div>
              
              {/* Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={handleSave}
                  className="bg-gradient-to-r from-green-500/20 to-green-600/20 border border-green-500/30 text-green-400 font-semibold py-2 rounded-lg flex items-center justify-center gap-1"
                >
                  <Save className="w-4 h-4" />
                  Kaydet
                </button>
                <button
                  onClick={closeModal}
                  className="bg-gradient-to-r from-gray-500/20 to-gray-600/20 border border-gray-500/30 text-gray-400 font-semibold py-2 rounded-lg"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignModal && assigningEquipment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div className="backdrop-blur-xl bg-gradient-to-br from-white/20 to-white/10 border border-white/30 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Zimmet Ata</h3>
              <button onClick={() => setShowAssignModal(false)}>
                <X className="w-6 h-6 text-gray-400 hover:text-white" />
              </button>
            </div>
            
            {/* Current Equipment Info */}
            <div className="bg-black/40 rounded-lg p-3 mb-4">
              <div className="text-sm font-semibold text-white mb-1">
                {assigningEquipment.brand} {assigningEquipment.model}
              </div>
              <div className="text-xs text-gray-400">
                {assigningEquipment.serialNumber}
              </div>
            </div>
            
            {/* Staff List */}
            <div className="space-y-2 mb-4 max-h-[400px] overflow-y-auto">
              {/* General Pool */}
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
              
              {/* Staff List */}
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

      {/* Info Card */}
      <div className="px-6 mt-6 mb-24">
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">ℹ️</span>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-white mb-2">📦 Malzeme Yönetimi ve Yetki Sistemi</h4>
              <p className="text-sm text-gray-400 mb-3">
                Ekipman ve malzemeleri görme ve düzenleme yetkileri rol bazlıdır.
              </p>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">
                  <span className="text-red-300 font-medium">🛡️ Admin (Yönetici):</span> Her şeyi görebilir, ekleyebilir, düzenleyebilir, silebilir ve zimmet atayabilir.
                </p>
                <p className="text-sm text-gray-400">
                  <span className="text-indigo-300 font-medium">👤 Üst-Müdür, Müdür:</span> Her şeyi görebilir, ekleyebilir, düzenleyebilir, silebilir ve zimmet atayabilir.
                </p>
                <p className="text-sm text-gray-400">
                  <span className="text-blue-300 font-medium">⚙️ Operasyon:</span> Ekipmanları görebilir, ekleyebilir ve düzenleyebilir (silme ve zimmet yok).
                </p>
                <p className="text-sm text-gray-400">
                  <span className="text-purple-300 font-medium">💼 İdari:</span> Sadece görebilir, hiçbir değişiklik yapamaz.
                </p>
                <p className="text-sm text-gray-400">
                  <span className="text-yellow-300 font-medium">👔 Personel:</span> Sadece görebilir, hiçbir değişiklik yapamaz.
                </p>
                <p className="text-sm text-gray-400">
                  <span className="text-gray-300 font-medium">❌ Bekleyen:</span> Hiçbir şey göremez (sayfa erişimi yok).
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <NewBottomNav
        activeTab="business-panel"
        onTabChange={onNavigate}
        userRole={userRole}
      />
    </div>
  );
}