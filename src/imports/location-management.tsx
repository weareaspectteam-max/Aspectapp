import { useState, useEffect } from 'react';
import { MapPin, Plus, Trash2, Edit2, X, Users, Bug } from 'lucide-react';
import { NewBottomNav } from './new-bottom-nav';
import { UserManagement } from './user-management';
import { BusinessOverview } from './business-overview';
import { AlbumDistribution } from './album-distribution';
import { EquipmentPage } from './equipment-page';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { supabase } from '../../../utils/supabase/client';

interface LocationManagementProps {
  userName: string;
  userRole: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

interface Location {
  id: string;
  name: string;
  emoji: string;
  color: string;
  location?: string; // Şehir/Bölge
  shift?: string; // Vardiya saati
  yearlyRent: number; // Yıllık kira (TL)
  dailyCostPercentage: number; // Günlük maliyet tahmini (%)
  profitPercentage: number; // Kar beklentisi (%)
  photoPrice?: number; // 1 Fotoğraf Fiyatı (₺)
}

export function LocationManagement({ userName, userRole, onLogout, onNavigate }: LocationManagementProps) {
  // Permission checks based on role
  const canViewLocations = ['yonetici', 'ust-mudur', 'mudur', 'operasyon', 'idari'].includes(userRole);
  const canViewFinancials = ['yonetici', 'ust-mudur', 'mudur', 'idari'].includes(userRole);
  const canAddEditDelete = ['yonetici', 'ust-mudur'].includes(userRole);

  // Mekan Yönetimi State
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationCity, setNewLocationCity] = useState('Çeşme');
  const [newLocationShift, setNewLocationShift] = useState('10:00 - 18:00');
  const [selectedEmoji, setSelectedEmoji] = useState('📍');
  const [selectedColor, setSelectedColor] = useState('#9dd9ea');
  const [yearlyRentInput, setYearlyRentInput] = useState('0');
  const [dailyCostPercentageInput, setDailyCostPercentageInput] = useState('0');
  const [profitPercentageInput, setProfitPercentageInput] = useState('0');
  const [photoPriceInput, setPhotoPriceInput] = useState('0');
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debugResults, setDebugResults] = useState<any>(null);
  const [useDemoMode, setUseDemoMode] = useState(false);
  const [editingPrices, setEditingPrices] = useState<{ [key: string]: string }>({});

  const emojiOptions = ['🏖️', '☕', '🐟', '⛵', '🏪', '🍽️', '🏨', '🎪', '🎭', '🎨', '🏝️', '🌊', '🌅', '🎵', '🍹', '📍'];
  const colorOptions = ['#9dd9ea', '#ffd4a3', '#a8e6cf', '#d4b5f7', '#ffb3d9', '#ffe5b4', '#b8d4f1', '#ffc0cb'];

  // Demo data
  const demoLocations: Location[] = [
    {
      id: 'location:1',
      name: 'ZOKA Restaurant',
      emoji: '🏖️',
      color: '#9dd9ea',
      location: 'Çeşme',
      shift: '10:00 - 18:00',
      yearlyRent: 15000,
      dailyCostPercentage: 35,
      profitPercentage: 20,
      photoPrice: 200,
    },
    {
      id: 'location:2',
      name: 'Balık Hali',
      emoji: '🐟',
      color: '#a8e6cf',
      location: 'Çeşme',
      shift: '12:00 - 23:00',
      yearlyRent: 12000,
      dailyCostPercentage: 30,
      profitPercentage: 25,
      photoPrice: 180,
    },
    {
      id: 'location:3',
      name: 'Tekne Turu',
      emoji: '⛵',
      color: '#ffd4a3',
      location: 'Çeşme',
      shift: '09:00 - 17:00',
      yearlyRent: 8000,
      dailyCostPercentage: 40,
      profitPercentage: 30,
      photoPrice: 190,
    },
  ];

  // DEBUG: Test endpoints
  const runDebugTests = async () => {
    setDebugResults({ status: 'running', tests: {} });
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const results: any = {
        session: {
          hasSession: !!session,
          hasToken: !!session?.access_token,
          tokenLength: session?.access_token?.length || 0,
          tokenPreview: session?.access_token?.slice(0, 20) + '...',
        }
      };

      // Test 1: Debug env endpoint
      console.log('🧪 TEST 1: Checking backend environment...');
      try {
        const envResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-91934896/debug-env`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
        results.envTest = {
          status: envResponse.status,
          ok: envResponse.ok,
          data: envResponse.ok ? await envResponse.json() : await envResponse.text(),
        };
        console.log('✅ ENV Test result:', results.envTest);
      } catch (err) {
        results.envTest = { error: err instanceof Error ? err.message : 'Unknown error' };
        console.error('❌ ENV Test failed:', err);
      }

      // Test 1B: Public locations test (NO TOKEN)
      console.log('🧪 TEST 1B: Checking /locations WITHOUT token...');
      try {
        const publicResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-91934896/locations`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              // NO Authorization header
            },
          }
        );
        results.publicLocationTest = {
          status: publicResponse.status,
          ok: publicResponse.ok,
          data: publicResponse.ok ? await publicResponse.json() : await publicResponse.text(),
        };
        console.log('✅ Public Location Test result:', results.publicLocationTest);
      } catch (err) {
        results.publicLocationTest = { error: err instanceof Error ? err.message : 'Unknown error' };
        console.error('❌ Public Location Test failed:', err);
      }

      // Test 2: Invoke test (Supabase client)
      console.log('🧪 TEST 2: Testing supabase.functions.invoke...');
      try {
        const { data, error } = await supabase.functions.invoke('make-server-91934896/locations', {
          method: 'GET',
        });
        results.invokeTest = {
          success: !error,
          hasData: !!data,
          data: data,
          error: error,
        };
        console.log('✅ Invoke test result:', results.invokeTest);
      } catch (err) {
        results.invokeTest = { error: err instanceof Error ? err.message : 'Unknown error' };
        console.error('❌ Invoke test failed:', err);
      }

      // Test 3: Fetch with token
      console.log('🧪 TEST 3: Testing fetch with Bearer token...');
      try {
        const fetchResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-91934896/locations`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${session?.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        results.fetchTest = {
          status: fetchResponse.status,
          ok: fetchResponse.ok,
          statusText: fetchResponse.statusText,
          data: fetchResponse.ok ? await fetchResponse.json() : await fetchResponse.text(),
        };
        console.log('✅ Fetch test result:', results.fetchTest);
      } catch (err) {
        results.fetchTest = { error: err instanceof Error ? err.message : 'Unknown error' };
        console.error('❌ Fetch test failed:', err);
      }

      // Test 4: Debug token endpoint
      console.log('🧪 TEST 4: Testing debug-token endpoint...');
      try {
        const tokenResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-91934896/debug-token`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session?.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        results.tokenTest = {
          status: tokenResponse.status,
          ok: tokenResponse.ok,
          data: tokenResponse.ok ? await tokenResponse.json() : await tokenResponse.text(),
        };
        console.log('✅ Token test result:', results.tokenTest);
      } catch (err) {
        results.tokenTest = { error: err instanceof Error ? err.message : 'Unknown error' };
        console.error('❌ Token test failed:', err);
      }

      setDebugResults({ status: 'complete', tests: results });
      console.log('🎉 All tests complete:', results);
    } catch (err) {
      setDebugResults({ 
        status: 'error', 
        error: err instanceof Error ? err.message : 'Unknown error' 
      });
      console.error('💥 Debug tests failed:', err);
    }
  };

  // Fetch locations from backend
  const fetchLocations = async () => {
    try {
      setLoading(true);

      // Try backend first
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          // No session, use demo mode silently
          setLocations(demoLocations);
          setUseDemoMode(true);
          setError('');
          return;
        }

        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-91934896/locations`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
          setLocations(result.locations || []);
          setUseDemoMode(false);
          setError('');
        } else {
          throw new Error(result.error || 'Backend error');
        }
      } catch (backendError) {
        // Backend failed, use demo mode silently
        setLocations(demoLocations);
        setUseDemoMode(true);
        setError('');
      }
    } catch (err) {
      // Fallback to demo mode silently
      setLocations(demoLocations);
      setUseDemoMode(true);
      setError('');
    } finally {
      setLoading(false);
    }
  };

  // Load locations on mount
  useEffect(() => {
    fetchLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize demo locations if needed
  const initDemoLocations = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91934896/init-demo-locations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Reload locations
      await fetchLocations();
      
      alert(`✅ ${result.count} demo mekan başarıyla oluşturuldu!`);
    } catch (err) {
      // Backend unavailable - silently use demo mode
      alert('⚠️ Backend bağlantısı kurulamadı. Demo mode aktif.');
    }
  };

  const handleAddLocation = async () => {
    if (newLocationName.trim()) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          setError('Oturum bulunamadı');
          return;
        }

        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-91934896/locations`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: newLocationName.trim(),
              emoji: selectedEmoji,
              color: selectedColor,
              location: newLocationCity,
              shift: newLocationShift,
              yearlyRent: parseFloat(yearlyRentInput),
              dailyCostPercentage: parseFloat(dailyCostPercentageInput),
              profitPercentage: parseFloat(profitPercentageInput),
              photoPrice: parseFloat(photoPriceInput),
            }),
          }
        );

        const result = await response.json();

        if (result.success) {
          console.log('✅ Location created successfully');
          await fetchLocations(); // Refresh list
          setNewLocationName('');
          setNewLocationCity('Çeşme');
          setNewLocationShift('10:00 - 18:00');
          setSelectedEmoji('📍');
          setSelectedColor('#9dd9ea');
          setYearlyRentInput('0');
          setDailyCostPercentageInput('0');
          setProfitPercentageInput('0');
          setPhotoPriceInput('0');
          setShowAddLocation(false);
          setError('');
        } else {
          console.error('❌ Failed to create location:', result.error);
          setError(result.error || 'Mekan eklenemedi');
        }
      } catch (err) {
        console.error('❌ Error creating location:', err);
        setError('Mekan eklenirken hata oluştu');
      }
    }
  };

  const handleUpdateLocation = async () => {
    if (editingLocation && newLocationName.trim()) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          setError('Oturum bulunamadı');
          return;
        }

        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-91934896/locations/${editingLocation.id}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: newLocationName.trim(),
              emoji: selectedEmoji,
              color: selectedColor,
              location: newLocationCity,
              shift: newLocationShift,
              yearlyRent: parseFloat(yearlyRentInput),
              dailyCostPercentage: parseFloat(dailyCostPercentageInput),
              profitPercentage: parseFloat(profitPercentageInput),
              photoPrice: parseFloat(photoPriceInput),
            }),
          }
        );

        const result = await response.json();

        if (result.success) {
          console.log('✅ Location updated successfully');
          await fetchLocations(); // Refresh list
          setEditingLocation(null);
          setNewLocationName('');
          setNewLocationCity('Çeşme');
          setNewLocationShift('10:00 - 18:00');
          setSelectedEmoji('📍');
          setSelectedColor('#9dd9ea');
          setYearlyRentInput('0');
          setDailyCostPercentageInput('0');
          setProfitPercentageInput('0');
          setPhotoPriceInput('0');
          setError('');
        } else {
          console.error('❌ Failed to update location:', result.error);
          setError(result.error || 'Mekan güncellenemedi');
        }
      } catch (err) {
        console.error('❌ Error updating location:', err);
        setError('Mekan güncellenirken hata oluştu');
      }
    }
  };

  const handleDeleteLocation = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        setError('Oturum bulunamadı');
        return;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91934896/locations/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (result.success) {
        console.log('✅ Location deleted successfully');
        await fetchLocations(); // Refresh list
        setError('');
      } else {
        console.error('❌ Failed to delete location:', result.error);
        setError(result.error || 'Mekan silinemedi');
      }
    } catch (err) {
      console.error('❌ Error deleting location:', err);
      setError('Mekan silinirken hata oluştu');
    }
  };

  const startEditLocation = (location: Location) => {
    setEditingLocation(location);
    setNewLocationName(location.name);
    setSelectedEmoji(location.emoji);
    setSelectedColor(location.color);
    setYearlyRentInput(location.yearlyRent.toString());
    setDailyCostPercentageInput(location.dailyCostPercentage.toString());
    setProfitPercentageInput(location.profitPercentage.toString());
    setPhotoPriceInput((location.photoPrice || 0).toString());
    setNewLocationCity(location.location || 'Çeşme');
    setNewLocationShift(location.shift || '10:00 - 18:00');
  };

  const cancelEdit = () => {
    setEditingLocation(null);
    setNewLocationName('');
    setSelectedEmoji('📍');
    setSelectedColor('#9dd9ea');
    setYearlyRentInput('0');
    setDailyCostPercentageInput('0');
    setProfitPercentageInput('0');
    setPhotoPriceInput('0');
    setShowAddLocation(false);
  };

  // Günlük Ciro Beklentisi Hesaplama Fonksiyonu
  const calculateDailyExpectation = (yearlyRent: number, dailyCostPercentage: number, profitPercentage: number): number => {
    const dailyRent = yearlyRent / 365;
    const dailyTotalCost = dailyRent * (1 + dailyCostPercentage / 100);
    const dailyRevenue = dailyTotalCost * (1 + profitPercentage / 100);
    return dailyRevenue;
  };

  // Fotoğraf Fiyatı Güncelleme Fonksiyonu
  const updatePhotoPrice = async (locationId: string, newPrice: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        setError('Oturum bulunamadı');
        return;
      }

      const location = locations.find(loc => loc.id === locationId);
      if (!location) return;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91934896/locations/${locationId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...location,
            photoPrice: newPrice,
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        await fetchLocations();
        setError('');
        // Düzenleme modundan çık
        const newEditingPrices = { ...editingPrices };
        delete newEditingPrices[locationId];
        setEditingPrices(newEditingPrices);
      } else {
        setError(result.error || 'Fiyat güncellenemedi');
      }
    } catch (err) {
      console.error('❌ Error updating price:', err);
      setError('Fiyat güncellenirken hata oluştu');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] pb-32">
      {/* DEBUG PANEL - REMOVE AFTER FIXING */}
      <div className="fixed top-0 left-0 right-0 bg-red-500 text-white p-2 text-xs z-[9999] font-mono">
        <div><strong>🔍 DEBUG MEKAN YÖNETİMİ:</strong></div>
        <div>userRole prop = "{userRole}" | currentRole (from localStorage) = "{currentRole}"</div>
        <div>canViewLocations = {canViewLocations.toString()} | canViewFinancials = {canViewFinancials.toString()} | canAddEditDelete = {canAddEditDelete.toString()}</div>
      </div>

      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-white">Mekan Yönetimi</h1>
            <span className="text-3xl">🏖️</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="w-8 h-8 rounded-lg bg-[#ff6b6b]/20 hover:bg-[#ff6b6b]/30 border border-[#ff6b6b]/30 flex items-center justify-center transition-all active:scale-95"
            >
              <Bug className="w-4 h-4 text-[#ff6b6b]" />
            </button>
            <button
              onClick={onLogout}
              className="w-8 h-8 rounded-lg bg-[#ff6b6b]/20 hover:bg-[#ff6b6b]/30 border border-[#ff6b6b]/30 flex items-center justify-center transition-all active:scale-95"
            >
              <X className="w-4 h-4 text-[#ff6b6b]" />
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-400">Proje mekanlarını yönetin</p>
      </div>

      {/* Location Management Section */}
      <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#ffb3d9]" />
            <h3 className="font-semibold text-white">Mekanlar</h3>
            {useDemoMode && (
              <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-lg border border-yellow-500/30">
                Demo Mode
              </span>
            )}
          </div>
          {canAddEditDelete && (
            <button
              onClick={() => setShowAddLocation(true)}
              className="flex items-center gap-1 px-3 py-2 bg-gradient-to-r from-[#ffb3d9]/20 to-[#ff9ecb]/20 hover:from-[#ffb3d9]/30 hover:to-[#ff9ecb]/30 border border-[#ffb3d9]/30 rounded-xl text-[#ffb3d9] text-sm font-semibold transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Yeni Mekan
            </button>
          )}
        </div>

        {/* Add/Edit Location Form */}
        {(showAddLocation || editingLocation) && (
          <div className="mb-4 p-4 bg-black/30 backdrop-blur-sm border border-[#ffb3d9]/30 rounded-xl max-h-[600px] overflow-y-auto">
            <div className="flex items-center justify-between mb-3 sticky top-0 bg-black/30 backdrop-blur-sm pb-3 z-10">
              <h4 className="font-semibold text-white">
                {editingLocation ? 'Mekan Düzenle' : 'Yeni Mekan Ekle'}
              </h4>
              <button
                onClick={cancelEdit}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-semibold text-gray-300 mb-2 block">Mekan Adı</label>
                <input
                  type="text"
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#ffb3d9] transition-all"
                  placeholder="örn: ZOKA Beach Club"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-300 mb-2 block">💰 1 Fotoğraf Fiyatı (₺)</label>
                <input
                  type="number"
                  value={photoPriceInput}
                  onChange={(e) => setPhotoPriceInput(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#ffb3d9] transition-all"
                  placeholder="200"
                />
                <p className="text-xs text-gray-400 mt-1">Albüm ve paspartu fiyatları bu değere göre hesaplanır</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-300 mb-2 block">Emoji ve renk seç</label>
                <div className="grid grid-cols-8 gap-2 mb-2">
                  {emojiOptions.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setSelectedEmoji(emoji)}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all ${
                        selectedEmoji === emoji
                          ? 'bg-[#ffb3d9]/30 border-2 border-[#ffb3d9] scale-110'
                          : 'bg-white/10 border-2 border-white/20 hover:bg-white/20'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-8 gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`w-10 h-10 rounded-lg transition-all ${
                        selectedColor === color
                          ? 'border-4 border-white scale-110'
                          : 'border-2 border-white/30 hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-300 mb-2 block">Yıllık Kira (TL)</label>
                <input
                  type="number"
                  value={yearlyRentInput}
                  onChange={(e) => setYearlyRentInput(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#ffb3d9] transition-all"
                  placeholder="örn: 15000"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-300 mb-2 block">Günlük Maliyet Tahmini (%)</label>
                <input
                  type="number"
                  value={dailyCostPercentageInput}
                  onChange={(e) => setDailyCostPercentageInput(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#ffb3d9] transition-all"
                  placeholder="35"
                />
                <p className="text-xs text-gray-400 mt-1">Kira + ek maliyetler (personel, elektrik vb.)</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-300 mb-2 block">Yıllık Kar Beklentisi (%)</label>
                <input
                  type="number"
                  value={profitPercentageInput}
                  onChange={(e) => setProfitPercentageInput(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border-2 border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#ffb3d9] transition-all"
                  placeholder="20"
                />
                <p className="text-xs text-gray-400 mt-1">Hedef kar marjı</p>
              </div>

              {/* Fiyat Önizlemesi */}
              {parseFloat(photoPriceInput) > 0 && (
                <div className="p-4 bg-gradient-to-br from-[#ffb3d9]/10 to-[#d4b5f7]/10 border-2 border-[#ffb3d9]/30 rounded-xl space-y-2">
                  <h5 className="text-sm font-bold text-[#ffb3d9] mb-3">💰 Fiyat Önizlemesi</h5>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-300">3'lü Albüm:</span>
                      <span className="font-bold text-white">₺{(parseFloat(photoPriceInput) * 3).toLocaleString('tr-TR')}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-300">5'li Albüm:</span>
                      <span className="font-bold text-white">₺{(parseFloat(photoPriceInput) * 5).toLocaleString('tr-TR')}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-300">7'li Albüm:</span>
                      <span className="font-bold text-white">₺{(parseFloat(photoPriceInput) * 7).toLocaleString('tr-TR')}</span>
                    </div>
                    <div className="flex justify-between items-xs">
                      <span className="text-gray-300">9'lu Albüm:</span>
                      <span className="font-bold text-white">₺{(parseFloat(photoPriceInput) * 9).toLocaleString('tr-TR')}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-300">11'li Albüm:</span>
                      <span className="font-bold text-white">₺{(parseFloat(photoPriceInput) * 11).toLocaleString('tr-TR')}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-300">15'li Albüm:</span>
                      <span className="font-bold text-white">₺{(parseFloat(photoPriceInput) * 15).toLocaleString('tr-TR')}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs pt-2 border-t border-white/10">
                    <span className="text-gray-300">1 Paspartu:</span>
                    <span className="font-bold text-[#a8e6cf]">₺{parseFloat(photoPriceInput).toLocaleString('tr-TR')}</span>
                  </div>
                </div>
              )}

              {/* Hesaplama Özeti */}
              {parseFloat(yearlyRentInput) > 0 && (
                <div className="p-4 bg-gradient-to-br from-[#9dd9ea]/10 to-[#a8e6cf]/10 border-2 border-[#9dd9ea]/30 rounded-xl space-y-2">
                  <h5 className="text-sm font-bold text-[#9dd9ea] mb-3">📊 Hesaplama Özeti</h5>
                  
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-300">Günlük Kira:</span>
                    <span className="font-bold text-white">₺{(parseFloat(yearlyRentInput) / 365).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</span>
                  </div>

                  {parseFloat(dailyCostPercentageInput) > 0 && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-300">Minimum Günlük Ciro:</span>
                      <span className="font-bold text-[#ffd4a3]">₺{((parseFloat(yearlyRentInput) / 365) * (1 + parseFloat(dailyCostPercentageInput) / 100)).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</span>
                    </div>
                  )}

                  {parseFloat(profitPercentageInput) > 0 && parseFloat(dailyCostPercentageInput) > 0 && (
                    <>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-300">Günlük Kar Hedefi:</span>
                        <span className="font-bold text-[#a8e6cf]">₺{(((parseFloat(yearlyRentInput) / 365) * (1 + parseFloat(dailyCostPercentageInput) / 100)) * (parseFloat(profitPercentageInput) / 100)).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</span>
                      </div>

                      <div className="flex justify-between items-center text-xs pt-2 border-t border-white/10">
                        <span className="text-gray-300">Yıllık Kar Beklentisi:</span>
                        <span className="font-bold text-[#ffb3d9]">₺{(parseFloat(yearlyRentInput) * (parseFloat(profitPercentageInput) / 100)).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={editingLocation ? handleUpdateLocation : handleAddLocation}
                  className="flex-1 py-3 bg-gradient-to-r from-[#ffb3d9] to-[#ff9ecb] text-white font-semibold rounded-xl hover:shadow-lg transition-all active:scale-95"
                >
                  {editingLocation ? 'Güncelle' : 'Ekle'}
                </button>
                <button
                  onClick={cancelEdit}
                  className="px-4 py-3 bg-white/10 border-2 border-white/20 text-white font-semibold rounded-xl hover:bg-white/20 transition-all active:scale-95"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Locations List */}
        <div className="space-y-2">
          {locations.map((location) => (
            <div
              key={location.id}
              className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-lg"
                    style={{ backgroundColor: location.color }}
                  >
                    {location.emoji}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-white">{location.name}</h4>
                    {canViewFinancials && (
                      <>
                        <div className="flex items-center gap-3 mt-1">
                          <div className="text-xs text-gray-400">
                            Yıllık: <span className="font-semibold text-white">₺{location.yearlyRent.toLocaleString()}</span>
                          </div>
                          <div className="text-xs text-gray-400">
                            Kar: <span className="font-semibold text-[#a8e6cf]">%{location.profitPercentage}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <div className="text-xs text-gray-400">
                            Günlük Hedef: <span className="font-semibold text-[#9dd9ea]">₺{calculateDailyExpectation(location.yearlyRent, location.dailyCostPercentage, location.profitPercentage).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</span>
                          </div>
                          {location.photoPrice && (
                            <div className="text-xs text-gray-400">
                              Fotoğraf: <span className="font-semibold text-[#ffb3d9]">₺{location.photoPrice}</span>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                    {!canViewFinancials && (
                      <p className="text-xs text-gray-500 mt-1">
                        {location.location && `📍 ${location.location}`}
                        {location.shift && ` • 🕐 ${location.shift}`}
                      </p>
                    )}
                  </div>
                </div>
                {canAddEditDelete && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEditLocation(location)}
                      className="w-9 h-9 rounded-lg bg-[#9dd9ea]/20 hover:bg-[#9dd9ea]/30 border border-[#9dd9ea]/30 flex items-center justify-center transition-all active:scale-95"
                    >
                      <Edit2 className="w-4 h-4 text-[#9dd9ea]" />
                    </button>
                    <button
                      onClick={() => handleDeleteLocation(location.id)}
                      className="w-9 h-9 rounded-lg bg-[#ff6b6b]/20 hover:bg-[#ff6b6b]/30 border border-[#ff6b6b]/30 flex items-center justify-center transition-all active:scale-95"
                    >
                      <Trash2 className="w-4 h-4 text-[#ff6b6b]" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info Card - Rol Yetkileri */}
      <div className="mt-6">
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">ℹ️</span>
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-white mb-2">📍 Mekan Yönetimi ve Yetki Sistemi</h4>
              <p className="text-sm text-gray-400 mb-3">
                Mekan görüntüleme, finansal bilgilere erişim ve düzenleme yetkileri rol bazlıdır.
              </p>
              <div className="space-y-2">
                <p className="text-sm text-gray-400">
                  <span className="text-red-300 font-medium">🛡️ Admin (Yönetici):</span> Tüm mekanları görebilir, finansal bilgilere erişebilir, mekan ekleyebilir/düzenleyebilir/silebilir.
                </p>
                <p className="text-sm text-gray-400">
                  <span className="text-indigo-300 font-medium">👤 Üst-Müdür, Müdür, İdari:</span> Tüm mekanları görebilir, finansal bilgilere erişebilir, düzenleme yapamaz.
                </p>
                <p className="text-sm text-gray-400">
                  <span className="text-blue-300 font-medium">⚙️ Operasyon:</span> Sadece mekanları görebilir, finansal bilgilere erişemez.
                </p>
                <p className="text-sm text-gray-400">
                  <span className="text-gray-300 font-medium">❌ Personel, Bekleyen:</span> Hiçbir şey göremez (sayfa erişimi yok).
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Photo Price Management Section - Only for Admin */}
      {canAddEditDelete && locations.length > 0 && (
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">💰</span>
            <h3 className="font-semibold text-white">1 Fotoğraf Fiyatı Ayarları</h3>
          </div>
          <p className="text-xs text-gray-400 mb-4">Her mekan için birim fotoğraf fiyatını buradan belirleyin</p>
          
          <div className="space-y-3">
            {locations.map((location) => (
              <div
                key={location.id}
                className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-lg"
                      style={{ backgroundColor: location.color }}
                    >
                      {location.emoji}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-white text-sm">{location.name}</h4>
                      <p className="text-xs text-gray-400">
                        Mevcut: {location.photoPrice ? `₺${location.photoPrice}` : 'Belirtilmemiş'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={editingPrices[location.id] !== undefined ? editingPrices[location.id] : (location.photoPrice || '')}
                      onChange={(e) => {
                        setEditingPrices({
                          ...editingPrices,
                          [location.id]: e.target.value
                        });
                      }}
                      className="w-24 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:border-[#ffb3d9] transition-all"
                      placeholder="200"
                    />
                    <span className="text-sm text-gray-400">₺</span>
                    <button
                      onClick={() => {
                        const newPrice = parseFloat(editingPrices[location.id] || '0') || 0;
                        updatePhotoPrice(location.id, newPrice);
                      }}
                      className="px-3 py-2 bg-[#a8e6cf]/20 hover:bg-[#a8e6cf]/30 border border-[#a8e6cf]/30 rounded-lg text-[#a8e6cf] text-xs font-semibold transition-all active:scale-95"
                    >
                      Kaydet
                    </button>
                  </div>
                </div>
                
                {/* Fiyat hesaplama önizlemesi */}
                {location.photoPrice && location.photoPrice > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">3'lü:</span>
                        <span className="font-semibold text-white">₺{(location.photoPrice * 3).toLocaleString('tr-TR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">5'li:</span>
                        <span className="font-semibold text-white">₺{(location.photoPrice * 5).toLocaleString('tr-TR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">7'li:</span>
                        <span className="font-semibold text-white">₺{(location.photoPrice * 7).toLocaleString('tr-TR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">9'lu:</span>
                        <span className="font-semibold text-white">₺{(location.photoPrice * 9).toLocaleString('tr-TR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">11'li:</span>
                        <span className="font-semibold text-white">₺{(location.photoPrice * 11).toLocaleString('tr-TR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Paspartu:</span>
                        <span className="font-semibold text-[#a8e6cf]">₺{location.photoPrice.toLocaleString('tr-TR')}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User Management Section - Only for Admin */}
      {canAddEditDelete && (
        <>
          {/* Kullanıcı Yönetimi Ayırıcı ve Başlık */}
          <div className="mb-6 mt-12 pt-8 border-t-2 border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-2xl font-bold text-white">Kullanıcı Yönetimi</h2>
              <span className="text-2xl">👥</span>
            </div>
            <p className="text-sm text-gray-400">Personel ve yöneticileri buradan yönetebilirsiniz</p>
          </div>

          {/* UserManagement Embedded */}
          <UserManagement />

          {/* İşletme Genel Durum Ayırıcı ve Başlık */}
          <div className="mb-6 mt-12 pt-8 border-t-2 border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-2xl font-bold text-white">İşletme Genel Durum</h2>
              <span className="text-2xl">💼</span>
            </div>
            <p className="text-sm text-gray-400">Gelir, gider ve kar/zarar takibi</p>
          </div>

          {/* BusinessOverview Embedded */}
          <BusinessOverview />
          {/* Malzeme Yönetimi Ayırıcı ve Başlık */}
          <div className="mb-6 mt-12 pt-8 border-t-2 border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-2xl font-bold text-white">Malzeme Yönetimi</h2>
              <span className="text-2xl">📦</span>
            </div>
            <p className="text-sm text-gray-400">Ekipman ve malzemeleri takip edin</p>
          </div>

          {/* EquipmentPage Embedded */}
          <EquipmentPage embedded={true} userName={userName} userRole={userRole} onNavigate={onNavigate} onLogout={onLogout} />

          {/* Albüm Dağıtım Ayırıcı ve Başlık */}
          <div className="mb-6 mt-12 pt-8 border-t-2 border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-2xl font-bold text-white">Stok Dağılımı</h2>
              <span className="text-2xl">📊</span>
            </div>
            <p className="text-sm text-gray-400">Albüm ve baskı kağıdı stok analizi</p>
          </div>

          {/* AlbumDistribution Embedded */}
          <AlbumDistribution embedded={true} userName={userName} userRole={userRole} onNavigate={onNavigate} onLogout={onLogout} />
        </>
      )}
    </div>
  );
}