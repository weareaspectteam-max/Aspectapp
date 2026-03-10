import { useState, useEffect } from 'react';
import { MapPin, Plus, Trash2, Edit2, X, Save, ArrowLeft } from 'lucide-react';

interface MekanManagementProps {
  userName: string;
  userRole: 'admin' | 'staff';
  onLogout: () => void;
  onNavigate: (tab: string) => void;
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
  paperType?: string; // Kullanılan kağıt tipi (opsiyonel)
  printType?: 'tam' | 'yarim'; // Baskı tipi
  workingHours?: {
    start: string; // "09:00"
    end: string;   // "18:00"
  };
}

type UserRole = 
  | 'yonetici'
  | 'ust-mudur'
  | 'mudur'
  | 'operasyon'
  | 'personel'
  | 'idari'
  | 'bekleyen';

export function MekanManagement({ userRole, onNavigate }: MekanManagementProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  
  // Form states
  const [formName, setFormName] = useState('');
  const [formEmoji, setFormEmoji] = useState('📍');
  const [formColor, setFormColor] = useState('#9dd9ea');
  const [formPhotoPrice, setFormPhotoPrice] = useState('0');
  const [formYearlyRent, setFormYearlyRent] = useState('0');
  const [formDailyCost, setFormDailyCost] = useState('0');
  const [formProfit, setFormProfit] = useState('0');
  const [formPaperType, setFormPaperType] = useState('');
  const [formPrintType, setFormPrintType] = useState<'tam' | 'yarim'>('yarim');
  const [formWorkingHoursStart, setFormWorkingHoursStart] = useState('09:00');
  const [formWorkingHoursEnd, setFormWorkingHoursEnd] = useState('18:00');
  
  // Price editing states
  const [editingPrices, setEditingPrices] = useState<{ [key: string]: string }>({});

  // Paper types from Cost Management
  const [paperTypes, setPaperTypes] = useState<{ name: string }[]>([]);

  // Get current logged in user role
  const getCurrentUserRole = (): UserRole => {
    const storedUser = localStorage.getItem('aspectUser');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        return user.role;
      } catch (error) {
        console.error('Error parsing user:', error);
      }
    }
    return userRole === 'admin' ? 'yonetici' : 'personel';
  };

  const currentUserRole = getCurrentUserRole();

  // Check access permission
  const hasAccess = currentUserRole !== 'personel' && currentUserRole !== 'bekleyen';
  const canEdit = currentUserRole === 'yonetici';
  const canViewNumbers = currentUserRole !== 'operasyon';

  const emojiOptions = ['🏖️', '☕', '🐟', '⛵', '🏪', '🍽️', '🏨', '🎪', '🎭', '🎨', '🏝️', '🌊', '🌅', '🎵', '🍹', '📍', '🌈', '🌸', '💎', '🎀', '🥥', '🌴', '🌺', '🐚'];
  const colorOptions = [
    // Mevcut Pastel Serisi (7)
    '#a8d8ea', '#b8e6d5', '#ff7675', '#fab1a0', '#d4b5f7', '#ffeaa7', '#ffb6b9',
    // Neon Serisi (8)
    '#00f5ff', '#ff0080', '#00ff88', '#b84fff', '#ffae42', '#fffc00', '#ff77ff', '#4d4dff',
    // Parlak Serisi (7)
    '#0984e3', '#fd79a8', '#00b894', '#6c5ce7', '#fdcb6e', '#74b9ff', '#55efc4',
    // Soft Serisi (2)
    '#a29bfe', '#81ecec'
  ];

  // Demo locations
  const demoLocations: Location[] = [
    {
      id: '1',
      name: 'ZOKA Beach Club',
      emoji: '🏖️',
      color: '#9dd9ea',
      yearlyRent: 15000,
      dailyCostPercentage: 35,
      profitPercentage: 20,
      photoPrice: 200,
    },
    {
      id: '2',
      name: 'Balık Hali',
      emoji: '🐟',
      color: '#a8e6cf',
      yearlyRent: 12000,
      dailyCostPercentage: 30,
      profitPercentage: 25,
      photoPrice: 180,
    },
    {
      id: '3',
      name: 'Tekne Turu',
      emoji: '⛵',
      color: '#ffd4a3',
      yearlyRent: 8000,
      dailyCostPercentage: 40,
      profitPercentage: 30,
      photoPrice: 190,
    },
  ];

  // Load from LocalStorage
  useEffect(() => {
    const stored = localStorage.getItem('aspect_locations');
    if (stored) {
      setLocations(JSON.parse(stored));
    } else {
      // Initialize with demo data
      setLocations(demoLocations);
      localStorage.setItem('aspect_locations', JSON.stringify(demoLocations));
    }

    // Load paper types from Cost Management
    const storedPapers = localStorage.getItem('aspect_paper_costs');
    if (storedPapers) {
      try {
        const papers = JSON.parse(storedPapers);
        setPaperTypes(papers);
      } catch (error) {
        console.error('Error loading paper types:', error);
      }
    }
  }, []);

  // Save to LocalStorage
  const saveLocations = (newLocations: Location[]) => {
    setLocations(newLocations);
    localStorage.setItem('aspect_locations', JSON.stringify(newLocations));
  };

  // Calculate daily expectation
  const calculateDailyExpectation = (yearlyRent: number, dailyCost: number, profit: number): number => {
    const dailyRent = yearlyRent / 365;
    const dailyTotalCost = dailyRent * (1 + dailyCost / 100);
    return dailyTotalCost * (1 + profit / 100);
  };

  // Add location
  const handleAddLocation = () => {
    if (!formName.trim()) return;

    const newLocation: Location = {
      id: Date.now().toString(),
      name: formName.trim(),
      emoji: formEmoji,
      color: formColor,
      photoPrice: parseFloat(formPhotoPrice) || 0,
      yearlyRent: parseFloat(formYearlyRent) || 0,
      dailyCostPercentage: parseFloat(formDailyCost) || 0,
      profitPercentage: parseFloat(formProfit) || 0,
      paperType: formPaperType,
      printType: formPrintType,
      workingHours: {
        start: formWorkingHoursStart,
        end: formWorkingHoursEnd,
      },
    };

    saveLocations([...locations, newLocation]);
    resetForm();
  };

  // Update location
  const handleUpdateLocation = () => {
    if (!editingLocation || !formName.trim()) return;

    const updated = locations.map(loc =>
      loc.id === editingLocation.id
        ? {
            ...loc,
            name: formName.trim(),
            emoji: formEmoji,
            color: formColor,
            photoPrice: parseFloat(formPhotoPrice) || 0,
            yearlyRent: parseFloat(formYearlyRent) || 0,
            dailyCostPercentage: parseFloat(formDailyCost) || 0,
            profitPercentage: parseFloat(formProfit) || 0,
            paperType: formPaperType,
            printType: formPrintType,
            workingHours: {
              start: formWorkingHoursStart,
              end: formWorkingHoursEnd,
            },
          }
        : loc
    );

    saveLocations(updated);
    resetForm();
  };

  // Delete location
  const handleDeleteLocation = (id: string) => {
    if (confirm('Bu mekanı silmek istediğinize emin misiniz?')) {
      saveLocations(locations.filter(loc => loc.id !== id));
    }
  };

  // Start editing
  const startEdit = (location: Location) => {
    setEditingLocation(location);
    setFormName(location.name);
    setFormEmoji(location.emoji);
    setFormColor(location.color);
    setFormPhotoPrice((location.photoPrice ?? 0).toString());
    setFormYearlyRent((location.yearlyRent ?? 0).toString());
    setFormDailyCost((location.dailyCostPercentage ?? 0).toString());
    setFormProfit((location.profitPercentage ?? 0).toString());
    setFormPaperType(location.paperType || '');
    setFormPrintType(location.printType || 'yarim');
    setFormWorkingHoursStart(location.workingHours?.start || '09:00');
    setFormWorkingHoursEnd(location.workingHours?.end || '18:00');
  };

  // Reset form
  const resetForm = () => {
    setShowAddForm(false);
    setEditingLocation(null);
    setFormName('');
    setFormEmoji('📍');
    setFormColor('#9dd9ea');
    setFormPhotoPrice('0');
    setFormYearlyRent('0');
    setFormDailyCost('0');
    setFormProfit('0');
    setFormPaperType('');
    setFormPrintType('yarim');
    setFormWorkingHoursStart('09:00');
    setFormWorkingHoursEnd('18:00');
  };

  // Update photo price
  const handleUpdatePhotoPrice = (locationId: string) => {
    const newPrice = parseFloat(editingPrices[locationId] || '0');
    const updated = locations.map(loc =>
      loc.id === locationId ? { ...loc, photoPrice: newPrice } : loc
    );
    saveLocations(updated);
    
    // Remove from editing
    const newEditingPrices = { ...editingPrices };
    delete newEditingPrices[locationId];
    setEditingPrices(newEditingPrices);
  };

  // Format currency
  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || isNaN(value)) return '0';
    return value.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  // If user doesn't have access, show message
  if (!hasAccess) {
    return (
      <div className="pb-20 bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] min-h-screen flex items-center justify-center">
        <div className="px-6 max-w-md">
          <div className="backdrop-blur-xl bg-red-700/20 border-2 border-red-600/40 rounded-2xl p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500/40 flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🔒</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Erişim Reddedildi</h2>
            <p className="text-gray-300 mb-6">
              Mekan Yönetimi sayfasına erişim yetkiniz bulunmamaktadır.
            </p>
            <button
              onClick={() => onNavigate('resource-management')}
              className="w-full py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white font-semibold hover:bg-white/20 transition-all active:scale-95"
            >
              Geri Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] min-h-screen">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => onNavigate('resource-management')}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 border-2 border-white/20 hover:bg-white/20 transition-all active:scale-95"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-3xl font-bold text-white">Mekan Yönetimi</h1>
          <span className="text-3xl">📍</span>
        </div>
        <p className="text-sm text-gray-400 ml-[52px]">Proje mekanlarını yönetin</p>
      </div>

      <div className="px-6 space-y-4">
        {/* Add/Edit Form Card */}
        {(showAddForm || editingLocation) && (
          <div className="backdrop-blur-xl bg-pink-700/20 border-2 border-pink-600/40 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">✏️</span>
                <h3 className="font-semibold text-white">
                  {editingLocation ? 'Mekan Düzenle' : 'Yeni Mekan Ekle'}
                </h3>
              </div>
              <button
                onClick={resetForm}
                className="w-10 h-10 rounded-xl bg-white/10 border-2 border-white/20 hover:bg-white/20 flex items-center justify-center transition-all active:scale-95"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="space-y-4">
                {/* Mekan Adı */}
                <div>
                  <label className="text-sm font-semibold text-gray-300 mb-2 block">Mekan Adı</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-pink-400 transition-all"
                    placeholder="örn: ZOKA Beach Club"
                  />
                </div>

                {/* Fotoğraf Fiyatı ve Kağıt Tipi - YAN YANA */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Fotoğraf Fiyatı */}
                  <div>
                    <label className="text-sm font-semibold text-gray-300 mb-2 block">💰 1 Fotoğraf Fiyatı (₺)</label>
                    <input
                      type="number"
                      value={formPhotoPrice}
                      onChange={(e) => setFormPhotoPrice(e.target.value)}
                      className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-pink-400 transition-all"
                      placeholder="200"
                    />
                    <p className="text-xs text-gray-400 mt-1">Albüm fiyatları bu değere göre hesaplanır</p>
                  </div>

                  {/* Kağıt Tipi */}
                  <div>
                    <label className="text-sm font-semibold text-gray-300 mb-2 block">📄 Kullanılan Kağıt Tipi</label>
                    <select
                      value={formPaperType}
                      onChange={(e) => setFormPaperType(e.target.value)}
                      className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white focus:outline-none focus:border-pink-400 transition-all"
                    >
                      <option value="" className="bg-[#2a2a3a]">Seçilmedi</option>
                      {paperTypes.map((type) => (
                        <option key={type.name} value={type.name} className="bg-[#2a2a3a]">
                          {type.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">Maliyet Yönetimi'nden yüklenir</p>
                  </div>

                  {/* Baskı Tipi */}
                  <div>
                    <label className="text-sm font-semibold text-gray-300 mb-2 block">🖨️ Baskı Tipi</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormPrintType('tam')}
                        className={`py-3 rounded-xl font-semibold transition-all active:scale-95 ${
                          formPrintType === 'tam'
                            ? 'bg-pink-500/40 border-2 border-pink-400 text-white'
                            : 'bg-white/10 border-2 border-white/20 text-gray-300 hover:bg-white/20'
                        }`}
                      >
                        Tam Boy
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormPrintType('yarim')}
                        className={`py-3 rounded-xl font-semibold transition-all active:scale-95 ${
                          formPrintType === 'yarim'
                            ? 'bg-pink-500/40 border-2 border-pink-400 text-white'
                            : 'bg-white/10 border-2 border-white/20 text-gray-300 hover:bg-white/20'
                        }`}
                      >
                        Yarım Boy
                      </button>
                    </div>
                  </div>
                </div>

                {/* Emoji ve Renk Seçici */}
                <div>
                  <label className="text-sm font-semibold text-gray-300 mb-2 block">Emoji ve renk seç</label>
                  
                  {/* Emoji Grid */}
                  <div className="grid grid-cols-8 gap-2 mb-3">
                    {emojiOptions.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => setFormEmoji(emoji)}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all ${
                          formEmoji === emoji
                            ? 'bg-pink-500/40 border-2 border-pink-400 scale-110'
                            : 'bg-white/10 border-2 border-white/20 hover:bg-white/20'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  {/* Renk Grid */}
                  <div className="grid grid-cols-8 gap-2">
                    {colorOptions.map((color) => (
                      <button
                        key={color}
                        onClick={() => setFormColor(color)}
                        className={`w-10 h-10 rounded-lg transition-all ${
                          formColor === color
                            ? 'border-4 border-white scale-110'
                            : 'border-2 border-white/30 hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Yıllık Kira */}
                <div>
                  <label className="text-sm font-semibold text-gray-300 mb-2 block">Yıllık Kira (TL)</label>
                  <input
                    type="number"
                    value={formYearlyRent}
                    onChange={(e) => setFormYearlyRent(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-pink-400 transition-all"
                    placeholder="örn: 15000"
                  />
                </div>

                {/* Günlük Maliyet % */}
                <div>
                  <label className="text-sm font-semibold text-gray-300 mb-2 block">Günlük Maliyet Tahmini (%)</label>
                  <input
                    type="number"
                    value={formDailyCost}
                    onChange={(e) => setFormDailyCost(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-pink-400 transition-all"
                    placeholder="35"
                  />
                  <p className="text-xs text-gray-400 mt-1">Kira + ek maliyetler (personel, elektrik vb.)</p>
                </div>

                {/* Kar Beklentisi % */}
                <div>
                  <label className="text-sm font-semibold text-gray-300 mb-2 block">Yıllık Kar Beklentisi (%)</label>
                  <input
                    type="number"
                    value={formProfit}
                    onChange={(e) => setFormProfit(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-pink-400 transition-all"
                    placeholder="20"
                  />
                  <p className="text-xs text-gray-400 mt-1">Hedef kar marjı</p>
                </div>

                {/* Çalışma Saatleri */}
                <div>
                  <label className="text-sm font-semibold text-gray-300 mb-2 block">Çalışma Saatleri</label>
                  <div className="flex gap-3">
                    <input
                      type="time"
                      value={formWorkingHoursStart}
                      onChange={(e) => setFormWorkingHoursStart(e.target.value)}
                      className="w-24 px-3 py-2 bg-white/10 border-2 border-white/20 rounded-lg text-white focus:outline-none focus:border-pink-400 transition-all"
                    />
                    <span className="text-white font-semibold">-</span>
                    <input
                      type="time"
                      value={formWorkingHoursEnd}
                      onChange={(e) => setFormWorkingHoursEnd(e.target.value)}
                      className="w-24 px-3 py-2 bg-white/10 border-2 border-white/20 rounded-lg text-white focus:outline-none focus:border-pink-400 transition-all"
                    />
                  </div>
                </div>

                {/* 💰 Fiyat Güncelleme */}
                {parseFloat(formPhotoPrice) > 0 && (
                  <div className="p-4 bg-gradient-to-br from-pink-600/20 to-purple-600/20 border-2 border-pink-500/40 rounded-xl">
                    <h5 className="text-sm font-bold text-pink-300 mb-3">💰 Fiyat Güncelleme</h5>
                    
                    <div className="space-y-2 text-xs">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex justify-between">
                          <span className="text-gray-300">3'lü:</span>
                          <span className="font-bold text-white">₺{formatCurrency(parseFloat(formPhotoPrice) * 3)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-300">5'li:</span>
                          <span className="font-bold text-white">₺{formatCurrency(parseFloat(formPhotoPrice) * 5)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-300">7'li:</span>
                          <span className="font-bold text-white">₺{formatCurrency(parseFloat(formPhotoPrice) * 7)}</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex justify-between">
                          <span className="text-gray-300">9'lu:</span>
                          <span className="font-bold text-white">₺{formatCurrency(parseFloat(formPhotoPrice) * 9)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-300">11'li:</span>
                          <span className="font-bold text-white">₺{formatCurrency(parseFloat(formPhotoPrice) * 11)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-300">13'lü:</span>
                          <span className="font-bold text-white">₺{formatCurrency(parseFloat(formPhotoPrice) * 13)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex justify-between">
                          <span className="text-gray-300">15'li:</span>
                          <span className="font-bold text-white">₺{formatCurrency(parseFloat(formPhotoPrice) * 15)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-300">1 Fotoğraf:</span>
                          <span className="font-bold text-green-300">₺{formatCurrency(parseFloat(formPhotoPrice))}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 📊 Hesaplama Özeti */}
                {parseFloat(formYearlyRent) > 0 && (
                  <div className="p-4 bg-gradient-to-br from-blue-600/20 to-green-600/20 border-2 border-blue-500/40 rounded-xl space-y-2">
                    <h5 className="text-sm font-bold text-blue-300 mb-3">📊 Hesaplama Özeti</h5>
                    
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-300">Günlük Kira:</span>
                        <span className="font-bold text-white">₺{formatCurrency(parseFloat(formYearlyRent) / 365)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-orange-300">Minimum Günlük Ciro:</span>
                        <span className="font-bold text-orange-300">
                          ₺{formatCurrency((parseFloat(formYearlyRent) / 365) * (1 + parseFloat(formDailyCost) / 100))}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-300">Günlük Kar Hedefi:</span>
                        <span className="font-bold text-green-300">
                          ₺{formatCurrency(
                            ((parseFloat(formYearlyRent) / 365) * (1 + parseFloat(formDailyCost) / 100)) * (parseFloat(formProfit) / 100)
                          )}
                        </span>
                      </div>
                      
                      <div className="pt-2 border-t border-blue-500/30 mt-3">
                        <div className="flex justify-between">
                          <span className="text-pink-300 font-bold">Yıllık Kar Beklentisi:</span>
                          <span className="font-bold text-pink-300">
                            ₺{formatCurrency(parseFloat(formYearlyRent) * (parseFloat(formProfit) / 100))}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Butonlar */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={editingLocation ? handleUpdateLocation : handleAddLocation}
                    className="flex-1 py-3 bg-pink-600/60 border-2 border-pink-500/50 rounded-xl text-white font-semibold hover:scale-105 transition-all active:scale-95"
                  >
                    {editingLocation ? 'Güncelle' : 'Ekle'}
                  </button>
                  <button
                    onClick={resetForm}
                    className="px-6 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white font-semibold hover:bg-white/20 transition-all active:scale-95"
                  >
                    İptal
                  </button>
              </div>
            </div>
          </div>
        )}

        {/* Mekanlar Card */}
        <div className="backdrop-blur-xl bg-purple-700/20 border-2 border-purple-600/40 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-purple-300" />
              <h3 className="font-semibold text-white">Mekanlar</h3>
            </div>
            {canEdit && (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1 px-3 py-2 bg-pink-600/60 border-2 border-pink-500/50 rounded-xl text-white text-sm font-semibold hover:scale-105 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Yeni Mekan
              </button>
            )}
          </div>

          {/* Mekan Listesi */}
          <div className="space-y-3">
            {locations.map((location) => {
              const dailyExpectation = calculateDailyExpectation(
                location.yearlyRent,
                location.dailyCostPercentage,
                location.profitPercentage
              );

              return (
                <div
                  key={location.id}
                  className="backdrop-blur-xl bg-white/5 border-2 border-white/20 rounded-xl p-4 hover:border-white/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    {/* Emoji Box */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 border-2"
                      style={{ backgroundColor: location.color, borderColor: location.color }}
                    >
                      {location.emoji}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-white mb-1">{location.name}</h4>
                      {canViewNumbers ? (
                        <div className="text-xs text-gray-400 space-y-0.5">
                          <div>
                            Yıllık: ₺{formatCurrency(location.yearlyRent)} | Kar: %{location.profitPercentage}
                          </div>
                          <div className="flex gap-3 flex-wrap">
                            <span className="text-blue-300">Günlük Hedef: ₺{formatCurrency(dailyExpectation)}</span>
                            <span className="text-pink-300">Fotoğraf: ₺{formatCurrency(location.photoPrice)}</span>
                          </div>
                          {location.workingHours && (
                            <div className="flex items-center gap-1 text-[#a8e6cf] mt-1">
                              <span>🕐</span>
                              <span className="font-semibold">{location.workingHours.start} - {location.workingHours.end}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">
                          Mekan bilgileri
                        </div>
                      )}
                    </div>

                    {/* Edit/Delete Buttons */}
                    {canEdit && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => startEdit(location)}
                          className="p-2 bg-blue-600/60 border-2 border-blue-500/50 rounded-lg text-white hover:scale-110 transition-all active:scale-95"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteLocation(location.id)}
                          className="p-2 bg-red-600/60 border-2 border-red-500/50 rounded-lg text-white hover:scale-110 transition-all active:scale-95"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Fotoğraf Fiyat Yönetimi - Sadece form açık değilken göster */}
        {canEdit && !showAddForm && !editingLocation && (
          <div className="backdrop-blur-xl bg-emerald-700/20 border-2 border-emerald-600/40 rounded-2xl p-5">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">💰</span>
                <h3 className="font-semibold text-white">1 Fotoğraf Fiyatı Ayarları</h3>
              </div>
              <p className="text-xs text-gray-400">Her mekan için birim fotoğraf fiyatını buradan belirleyin</p>
            </div>

            <div className="space-y-3">
              {locations.map((location) => {
                const isEditing = editingPrices[location.id] !== undefined;
                const currentPrice = isEditing ? editingPrices[location.id] : (location.photoPrice ?? 0).toString();

                return (
                  <div
                    key={location.id}
                    className="backdrop-blur-xl bg-white/5 border-2 border-white/20 rounded-xl p-4"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl border-2"
                          style={{ backgroundColor: location.color, borderColor: location.color }}
                        >
                          {location.emoji}
                        </div>
                        <div>
                          <h4 className="font-bold text-white">{location.name}</h4>
                          <p className="text-xs text-gray-400">Mevcut: ₺{formatCurrency(location.photoPrice)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={currentPrice}
                          onChange={(e) =>
                            setEditingPrices({ ...editingPrices, [location.id]: e.target.value })
                          }
                          className="w-24 px-3 py-2 bg-white/10 border-2 border-white/20 rounded-lg text-white text-center focus:outline-none focus:border-emerald-400 transition-all"
                        />
                        <span className="text-white font-semibold">₺</span>
                        <button
                          onClick={() => handleUpdatePhotoPrice(location.id)}
                          className="flex items-center gap-1 px-3 py-2 bg-emerald-600/60 border-2 border-emerald-500/50 rounded-lg text-white text-sm font-semibold hover:scale-105 transition-all active:scale-95"
                        >
                          <Save className="w-4 h-4" />
                          Kaydet
                        </button>
                      </div>
                    </div>

                    {/* Price Preview */}
                    <div className="space-y-2 text-xs">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex justify-between">
                          <span className="text-gray-400">3'lü:</span>
                          <span className="text-white font-semibold">₺{formatCurrency(parseFloat(currentPrice || '0') * 3)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">5'li:</span>
                          <span className="text-white font-semibold">₺{formatCurrency(parseFloat(currentPrice || '0') * 5)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">7'li:</span>
                          <span className="text-white font-semibold">₺{formatCurrency(parseFloat(currentPrice || '0') * 7)}</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex justify-between">
                          <span className="text-gray-400">9'lu:</span>
                          <span className="text-white font-semibold">₺{formatCurrency(parseFloat(currentPrice || '0') * 9)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">11'li:</span>
                          <span className="text-white font-semibold">₺{formatCurrency(parseFloat(currentPrice || '0') * 11)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">13'lü:</span>
                          <span className="text-white font-semibold">₺{formatCurrency(parseFloat(currentPrice || '0') * 13)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex justify-between">
                          <span className="text-gray-400">15'li:</span>
                          <span className="text-white font-semibold">₺{formatCurrency(parseFloat(currentPrice || '0') * 15)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-300">1 Fotoğraf:</span>
                          <span className="text-green-300 font-semibold">₺{formatCurrency(parseFloat(currentPrice || '0'))}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="mt-6 mb-6">
          <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">ℹ️</span>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-white mb-2">📍 Mekan Yönetimi ve Yetki Sistemi</h4>
                <p className="text-sm text-gray-400 mb-3">
                  Mekan bilgilerini görme ve düzenleme yetkileri rol bazlıdır.
                </p>
                <div className="space-y-2">
                  <p className="text-sm text-gray-400">
                    <span className="text-red-300 font-medium">🛡️ Admin (Yönetici):</span> Her şeyi görebilir ve değiştirebilir.
                  </p>
                  <p className="text-sm text-gray-400">
                    <span className="text-indigo-300 font-medium">👤 Üst-Müdür, Müdür, İdari:</span> Her şeyi görebilir, düzenleyemez.
                  </p>
                  <p className="text-sm text-gray-400">
                    <span className="text-blue-300 font-medium">⚙️ Operasyon:</span> Sadece mekanları görebilir, rakamları göremez.
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