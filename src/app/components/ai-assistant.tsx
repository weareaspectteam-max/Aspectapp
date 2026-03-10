import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, User, TrendingUp, DollarSign, Package, Users as UsersIcon, ArrowLeft, Calendar, MapPin } from 'lucide-react';
import { StaffTopBar } from './staff-top-bar';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  data?: {
    revenue?: string;
    profit?: string;
    cost?: string;
    profitMargin?: string;
    projects?: Array<{ name: string; revenue: string }>;
    stocks?: Array<{ name: string; quantity: string; status: string; revenue?: string; profitAmount?: string }>;
    personnel?: {
      staff: Array<{
        name: string;
        revenue: string;
        sales: number;
        discountRate: string;
      }>;
      totals: {
        totalRevenue: string;
        totalPrints: number;
        totalReturns: number;
      };
    };
    dailySummary?: {
      revenue: string;
      cost: string;
      profit: string;
      profitMargin: string;
    };
    detailedEndOfDay?: {
      revenue: string;
      cost: string;
      profit: string;
      profitMargin: string;
      albums: Array<{ type: string; count: number; unitCost: string; totalCost: string }>;
      prints: { totalPrints: number; returnedPrints: number; unitCost: string; totalCost: string };
      staff: Array<{ name: string; unitCost: string }>;
      costs: {
        albumCostTotal: string;
        printCostTotal: string;
        staffCostTotal: string;
        rentTotal: string;
        totalCost: string;
        totalRevenue: string;
        netProfit: string;
      };
    };
    endOfDayReport?: {
      revenue: string;
      cost: string;
      profit: string;
      profitMargin: string;
      totalSales: number;
      totalPrints: number;
      photoReturns: number;
      albumBreakdown: Array<{ type: string; count: number; revenue: string }>;
      paymentMethods: Array<{ method: string; amount: string; percentage: string }>;
      discountInfo: { averageDiscount: string; totalDiscount: string };
      printerUsage: { ribbonUsed: string; printsCount: number };
      customerCount?: number;
      staffCount?: number;
      staffCost?: string;
      printCost?: string;
      albumCost?: string;
      operatingHours?: string;
      peakHours?: string;
      avgTransactionValue?: string;
      notes?: string;
    };
  };
}

function AIResponseCard({ data }: { data: Message['data'] }) {
  if (!data) return null;

  return (
    <div className="mt-3 space-y-2">
      {data.revenue && (
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-[#9dd9ea]" />
            <span className="text-xs text-gray-400">Toplam Ciro</span>
          </div>
          <div className="text-xl font-black text-white">{data.revenue}</div>
        </div>
      )}
      
      {data.profit && (
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-[#a8e6cf]" />
            <span className="text-xs text-gray-400">Net Kâr</span>
          </div>
          <div className="text-xl font-black text-[#a8e6cf]">{data.profit}</div>
        </div>
      )}
      
      {data.projects && data.projects.length > 0 && (
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
          <div className="text-xs text-gray-400 mb-2 font-semibold">📊 Proje Detayları</div>
          <div className="space-y-2">
            {data.projects.map((project) => (
              <div key={project.name} className="flex items-center justify-between py-1">
                <span className="text-xs text-white font-medium">{project.name}</span>
                <span className="text-xs font-bold text-[#9dd9ea]">{project.revenue}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {data.stocks && data.stocks.length > 0 && (
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
          <div className="text-xs text-gray-400 mb-2 font-semibold">📦 Stok Durumu</div>
          <div className="space-y-2">
            {data.stocks.map((stock) => {
              // Determine status color based on emoji
              let statusColor = 'text-[#a8e6cf]'; // Default green for ✅ Normal
              if (stock.status.includes('⚠️')) {
                statusColor = 'text-[#ffd4a3]'; // Orange for ⚠️ Azalmış
              } else if (stock.status.includes('❌')) {
                statusColor = 'text-[#ff5555]'; // Red for ❌ Kritik
              }
              
              return (
                <div key={stock.name} className="flex items-center justify-between py-1">
                  <span className="text-xs text-white font-medium">{stock.name}</span>
                  <span className="text-xs font-bold text-[#9dd9ea]">{stock.quantity} adet</span>
                  <span className={`text-xs font-bold ${statusColor}`}>{stock.status}</span>
                  {stock.revenue && (
                    <span className="text-xs font-bold text-[#a8e6cf]">{stock.revenue}</span>
                  )}
                  {stock.profitAmount && (
                    <span className="text-xs font-bold text-[#a8e6cf]">{stock.profitAmount}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {data.personnel && (
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 space-y-4">
          {/* Header */}
          <div className="text-sm text-[#9dd9ea] font-black flex items-center gap-2">
            <span className="text-lg">👥</span>
            PERSONEL PERFORMANSI
          </div>
          
          {/* Personel Detayları */}
          <div className="space-y-3">
            {data.personnel.staff.map((staff) => (
              <div key={staff.name} className="bg-white/5 rounded-lg p-3 border border-white/10 space-y-2">
                {/* Personel Adı ve Gelir */}
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="text-sm text-white font-bold">{staff.name}</span>
                  <span className="text-sm font-black text-[#9dd9ea]">{staff.revenue}</span>
                </div>
                
                {/* Alt Metrikler - 2 Kolon */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/5 rounded-lg p-2">
                    <div className="text-[10px] text-gray-400 mb-1">Satış Adedi</div>
                    <div className="text-xs font-bold text-[#a8e6cf]">{staff.sales} adet</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2">
                    <div className="text-[10px] text-gray-400 mb-1">İskonto Oranı</div>
                    <div className="text-xs font-bold text-[#ffd4a3]">{staff.discountRate}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Mekan Toplamları */}
          <div className="bg-gradient-to-br from-[#9dd9ea]/10 to-[#9dd9ea]/5 rounded-lg p-3 border border-[#9dd9ea]/20 space-y-2">
            <div className="text-xs text-[#9dd9ea] mb-2 font-bold">📊 MEKAN TOPLAMI</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-[10px] text-gray-400 mb-1">Toplam Ciro</div>
                <div className="text-xs font-bold text-[#9dd9ea]">{data.personnel.totals.totalRevenue}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-[10px] text-gray-400 mb-1">Baskı Adedi</div>
                <div className="text-xs font-bold text-[#ffd4a3]">{data.personnel.totals.totalPrints} adet</div>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-[10px] text-gray-400 mb-1">İade Adedi</div>
                <div className="text-xs font-bold text-[#ff5555]">{data.personnel.totals.totalReturns} adet</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {data.detailedEndOfDay && (
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 space-y-4">
          {/* Header */}
          <div className="text-sm text-[#9dd9ea] font-black flex items-center gap-2">
            <span className="text-lg">📋</span>
            DETAYLI GÜN SONU RAPORU
          </div>
          
          {/* Finansal Özet */}
          <div className="bg-gradient-to-br from-[#9dd9ea]/10 to-[#9dd9ea]/5 rounded-lg p-3 border border-[#9dd9ea]/20 space-y-2">
            <div className="text-xs text-[#9dd9ea] mb-2 font-bold">💰 FİNANSAL ÖZET</div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-white font-semibold">Ciro</span>
              <span className="text-lg font-black text-[#9dd9ea]">{data.detailedEndOfDay.revenue}</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-white font-semibold">Maliyet</span>
              <span className="text-lg font-black text-[#ff5555]">{data.detailedEndOfDay.cost}</span>
            </div>
            <div className="h-px bg-white/20 my-1"></div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-white font-bold">Net Kâr</span>
              <span className="text-xl font-black text-[#a8e6cf]">{data.detailedEndOfDay.profit}</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-white font-bold">Kâr Marjı</span>
              <span className="text-xl font-black text-[#a8e6cf]">{data.detailedEndOfDay.profitMargin}</span>
            </div>
          </div>

          {/* Çalışan Personel */}
          <div className="bg-gradient-to-br from-[#ffd4a3]/10 to-[#ffd4a3]/5 rounded-lg p-3 border border-[#ffd4a3]/20 space-y-2">
            <div className="text-xs text-[#ffd4a3] mb-2 font-bold">👥 ÇALIŞAN PERSONEL</div>
            <div className="space-y-2">
              {data.detailedEndOfDay.staff.map((person, index) => (
                <div key={index} className="flex items-center justify-between bg-white/5 rounded-lg p-2">
                  <span className="text-xs text-white font-medium">{person.name}</span>
                  <span className="text-xs font-bold text-[#ffd4a3]">{person.unitCost}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Satılan Albümler */}
          <div className="bg-gradient-to-br from-[#a8e6cf]/10 to-[#a8e6cf]/5 rounded-lg p-3 border border-[#a8e6cf]/20 space-y-2">
            <div className="text-xs text-[#a8e6cf] mb-2 font-bold">📦 SATILAN ALBÜMLER</div>
            <div className="space-y-2">
              {data.detailedEndOfDay.albums.map((album, index) => (
                <div key={index} className="bg-white/5 rounded-lg p-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white font-medium">{album.type}</span>
                    <span className="text-xs font-bold text-[#9dd9ea]">{album.count} adet</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-gray-400">Birim Maliyet: {album.unitCost}</span>
                    <span className="text-[#ffd4a3] font-semibold">Toplam: {album.totalCost}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Baskı Bilgileri */}
          <div className="bg-gradient-to-br from-[#d4a5ff]/10 to-[#d4a5ff]/5 rounded-lg p-3 border border-[#d4a5ff]/20 space-y-2">
            <div className="text-xs text-[#d4a5ff] mb-2 font-bold">🖨️ BASKI BİLGİLERİ</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-[10px] text-gray-400 mb-1">Toplam Baskı</div>
                <div className="text-xs font-bold text-[#9dd9ea]">{data.detailedEndOfDay.prints.totalPrints} adet</div>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-[10px] text-gray-400 mb-1">İade Fotoğraf</div>
                <div className="text-xs font-bold text-[#ff5555]">{data.detailedEndOfDay.prints.returnedPrints} adet</div>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-[10px] text-gray-400 mb-1">Birim Maliyet</div>
                <div className="text-xs font-bold text-[#ffd4a3]">{data.detailedEndOfDay.prints.unitCost}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-2">
                <div className="text-[10px] text-gray-400 mb-1">Toplam Maliyet</div>
                <div className="text-xs font-bold text-[#ffd4a3]">{data.detailedEndOfDay.prints.totalCost}</div>
              </div>
            </div>
          </div>

          {/* Maliyet Dağılımı */}
          <div className="bg-gradient-to-br from-[#ff5555]/10 to-[#ff5555]/5 rounded-lg p-3 border border-[#ff5555]/20 space-y-2">
            <div className="text-xs text-[#ff5555] mb-2 font-bold">💸 MALİYET DAĞILIMI</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-white">📦 Albüm Maliyeti</span>
                <span className="text-xs font-bold text-[#ffd4a3]">{data.detailedEndOfDay.costs.albumCostTotal}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-white">🖨️ Baskı Maliyeti</span>
                <span className="text-xs font-bold text-[#ffd4a3]">{data.detailedEndOfDay.costs.printCostTotal}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-white">👥 Personel Maliyeti</span>
                <span className="text-xs font-bold text-[#ffd4a3]">{data.detailedEndOfDay.costs.staffCostTotal}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-white">🏠 Mekan Kirası</span>
                <span className="text-xs font-bold text-[#ffd4a3]">{data.detailedEndOfDay.costs.rentTotal}</span>
              </div>
              <div className="h-px bg-white/20 my-1"></div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs text-white font-bold">Toplam Maliyet</span>
                <span className="text-sm font-black text-[#ff5555]">{data.detailedEndOfDay.costs.totalCost}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 bg-white/5 rounded-lg px-2">
                <span className="text-xs text-white font-bold">Net Kâr</span>
                <span className="text-base font-black text-[#a8e6cf]">{data.detailedEndOfDay.costs.netProfit}</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {data.endOfDayReport && (
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 space-y-4">
          {/* Header */}
          <div className="text-sm text-[#9dd9ea] font-black flex items-center gap-2">
            <span className="text-lg">📅</span>
            GÜN SONU RAPORU
          </div>
          
          {/* Finansal Özet - SADECE BU KALACAK */}
          <div className="bg-gradient-to-br from-[#9dd9ea]/10 to-[#9dd9ea]/5 rounded-lg p-3 border border-[#9dd9ea]/20 space-y-2">
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-white font-semibold">💰 Ciro</span>
              <span className="text-lg font-black text-[#9dd9ea]">{data.endOfDayReport.revenue}</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-white font-semibold">💸 Maliyet</span>
              <span className="text-lg font-black text-[#ff5555]">{data.endOfDayReport.cost}</span>
            </div>
            <div className="h-px bg-white/20 my-1"></div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-white font-bold">✅ Kâr</span>
              <span className="text-xl font-black text-[#a8e6cf]">{data.endOfDayReport.profit}</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-white font-bold">📊 Kâr Marjı</span>
              <span className="text-xl font-black text-[#a8e6cf]">{data.endOfDayReport.profitMargin}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface AIAssistantProps {
  userRole?: 'admin' | 'staff';
  userName?: string;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
}

export function AIAssistant({ userRole = 'admin', userName = 'User', onLogout = () => {}, onNavigate = () => {} }: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: userRole === 'admin' 
        ? '👋 Merhaba! Aspect AI\'ya hoş geldiniz. Satış raporları, stok durumu, personel performansı veya operasyonel sorularınızı yanıtlayabilirim.'
        : '👋 Merhaba! Aspect AI\'ya hoş geldiniz. Stok durumu hakkında sorularınızı yanıtlayabilirim. Lütfen bir lokasyon seçin ve stok bilgilerini sorgulayın.',
    },
  ]);
  const [input, setInput] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ✅ DYNAMIC: Load locations from Mekan Yönetimi
  const [locations, setLocations] = useState<string[]>([]);
  
  useEffect(() => {
    const stored = localStorage.getItem('aspect_locations');
    if (stored) {
      const locs = JSON.parse(stored);
      setLocations(locs.map((loc: any) => loc.name));
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const adminQuickQuestions = [
    '📊 Bugün toplam ciro',
    '🏆 En iyi personel',
    '📦 Stok durumu',
    '💰 Şubat raporu',
  ];

  const photographyQuestions = [
    '📸 Portre çekim ayarları',
    '☀️ Güneşli hava ayarları',
    '👥 Grup fotoğrafı ipuçları',
    '🌅 Gün batımı çekimi',
  ];

  const quickQuestions = userRole === 'admin' ? adminQuickQuestions : photographyQuestions;

  const handleSend = (question?: string) => {
    const messageText = question || input;
    if (!messageText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: messageText,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: generateResponse(messageText),
        data: generateData(messageText),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }, 800);
  };

  const generateResponse = (question: string): string => {
    const lowerQuestion = question.toLowerCase();
    
    // ✅ DYNAMIC: Find matching location from Mekan Yönetimi
    const matchedLocation = locations.find(loc => 
      lowerQuestion.includes(loc.toLowerCase())
    );
    
    // Simple daily summary (Gün Sonu Özet) - CHECK THIS FIRST BEFORE DETAILED
    if (lowerQuestion.includes('özet') && lowerQuestion.includes('gün sonu')) {
      if (hasZoka) {
        return `💰 **ZOKA - Gün Sonu Özeti (${selectedDate}):**\n\nFinansal performans özeti aşağıda gösterilmektedir.`;
      } else if (hasHayal) {
        return `💰 **Hayal Kahvesi - Gün Sonu Özeti (${selectedDate}):**\n\nFinansal performans özeti aşağıda gösterilmektedir.`;
      } else if (hasBalik) {
        return `💰 **Balık Hali - Gün Sonu Özeti (${selectedDate}):**\n\nFinansal performans özeti aşağıda gösterilmektedir.`;
      } else if (hasTekne) {
        return `💰 **Tekne Projesi - Gün Sonu Özeti (${selectedDate}):**\n\nFinansal performans özeti aşağıda gösterilmektedir.`;
      }
    }
    
    // Detailed end of day report (Detaylı Gün Sonu Raporu)
    if (lowerQuestion.includes('detaylı') && lowerQuestion.includes('gün sonu')) {
      if (hasZoka) {
        return `📅 **ZOKA - Detaylı Gün Sonu Raporu (${selectedDate}):**\n\nKapsamlı günlük performans raporu ve operasyonel detaylar aşağıda gösterilmektedir.`;
      } else if (hasHayal) {
        return `📅 **Hayal Kahvesi - Detaylı Gün Sonu Raporu (${selectedDate}):**\n\nKapsamlı günlük performans raporu ve operasyonel detaylar aşağıda gösterilmektedir.`;
      } else if (hasBalik) {
        return `📅 **Balık Hali - Detaylı Gün Sonu Raporu (${selectedDate}):**\n\nKapsamlı günlük performans raporu ve operasyonel detaylar aşağıda gösterilmektedir.`;
      } else if (hasTekne) {
        return `📅 **Tekne Projesi - Detaylı Gün Sonu Raporu (${selectedDate}):**\n\nKapsamlı günlük performans raporu ve operasyonel detaylar aşağıda gösterilmektedir.`;
      }
    }
    
    // Old end of day report queries (for backward compatibility)
    if (lowerQuestion.includes('gün sonu')) {
      if (hasZoka) {
        return `📅 **ZOKA - Gün Sonu Raporu (${selectedDate}):**\n\nDetaylı günlük performans raporu aşağıda gösterilmektedir.`;
      } else if (hasHayal) {
        return `📅 **Hayal Kahvesi - Gün Sonu Raporu (${selectedDate}):**\n\nDetaylı günlük performans raporu aşağıda gösterilmektedir.`;
      } else if (hasBalik) {
        return `📅 **Balık Hali - Gün Sonu Raporu (${selectedDate}):**\n\nDetaylı günlük performans raporu aşağıda gösterilmektedir.`;
      } else if (hasTekne) {
        return `📅 **Tekne Projesi - Gün Sonu Raporu (${selectedDate}):**\n\nDetaylı günlük performans raporu aşağıda gösterilmektedir.`;
      }
    }
    
    // Location-based stock queries
    if (lowerQuestion.includes('stok')) {
      if (hasZoka) {
        return `📦 **ZOKA - Stok Durumu (${selectedDate}):**\n\nGüncel stok bilgileri aşağıda gösterilmektedir.`;
      } else if (hasHayal) {
        return `📦 **Hayal Kahvesi - Stok Durumu (${selectedDate}):**\n\nGüncel stok bilgileri aşağıda gösterilmektedir.`;
      } else if (hasBalik) {
        return `📦 **Balık Hali - Stok Durumu (${selectedDate}):**\n\nGüncel stok bilgileri aşağıda gösterilmektedir.`;
      } else if (hasTekne) {
        return `📦 **Tekne Projesi - Stok Durumu (${selectedDate}):**\n\nGüncel stok bilgileri aşağıda gösterilmektedir.`;
      } else {
        return '📦 **Genel Stok Kontrolü:**\n\nMevcut Stoklar:\n• 3\'lü Albüm: 45 adet\n• 5\'li Albüm: 38 adet\n• 7\'li Albüm: 22 adet\n• 15\'li Albüm: 15 adet\n• Paspartu: 60 adet\n\n⚠️ 7\'li ve 15\'li albümlerde stok azalmış, sipariş verilmesi önerilir.';
      }
    }
    
    // Location-based sales queries
    if (lowerQuestion.includes('satış') || lowerQuestion.includes('rapor')) {
      if (hasZoka) {
        return `💰 **ZOKA - Satış Raporu (${selectedDate}):**\n\nGünlük performans özeti aşağıda gösterilmektedir.`;
      } else if (hasHayal) {
        return `💰 **Hayal Kahvesi - Satış Raporu (${selectedDate}):**\n\nGünlük performans özeti aşağıda gösterilmektedir.`;
      } else if (hasBalik) {
        return `💰 **Balık Hali - Satış Raporu (${selectedDate}):**\n\nGünlük performans özeti aşağıda gösterilmektedir.`;
      } else if (hasTekne) {
        return `💰 **Tekne Projesi - Satış Raporu (${selectedDate}):**\n\nGünlük performans özeti aşağıda gösterilmektedir.`;
      }
    }
    
    // Location-based personnel queries
    if (lowerQuestion.includes('personel') || lowerQuestion.includes('performans')) {
      if (hasZoka) {
        return `👥 **ZOKA - Personel Performansı (${selectedDate}):**\n\nPersonel bazlı satış bilgileri aşağıda gösterilmektedir.`;
      } else if (hasHayal) {
        return `👥 **Hayal Kahvesi - Personel Performansı (${selectedDate}):**\n\nPersonel bazlı satış bilgileri aşağıda gösterilmektedir.`;
      } else if (hasBalik) {
        return `👥 **Balık Hali - Personel Performansı (${selectedDate}):**\n\nPersonel bazlı satış bilgileri aşağıda gösterilmektedir.`;
      } else if (hasTekne) {
        return `👥 **Tekne Projesi - Personel Performansı (${selectedDate}):**\n\nPersonel bazlı satış bilgileri aşağıda gösterilmektedir.`;
      }
    }
    
    // Staff-specific responses
    if (lowerQuestion.includes('fiyat') || lowerQuestion.includes('albüm')) {
      return '💵 **Güncel Albüm Fiyatları:**\n\n• 1 Fotoğraf: ₺200\n• 3\'lü: ₺600\n• 5\'li: ₺1,000\n• 7\'li: ₺1,400\n• 9\'lu: ₺1,800\n• 11\'li: ₺2,200\n• 15\'li: ₺3,000\n• Paspartu: ₺200\n\nTüm fiyatlar KDV dahildir.';
    } else if (lowerQuestion.includes('nasıl yapılır')) {
      return '📸 **Satış İşlemi Adımları:**\n\n1️⃣ Satış ekranında proje seçin\n2️⃣ Albüm tipini seçin\n3️⃣ Adet girin (+ butonu)\n4️⃣ İskonto varsa uygulayın\n5️⃣ Ödeme yöntemini seçin\n6️⃣ Satışı tamamlayın ✅\n\nDöviz ödemesi için USD/EUR/GBP butonlarını kullanabilirsiniz!';
    } else if (lowerQuestion.includes('ribbon') || lowerQuestion.includes('yazıcı')) {
      return '🖨️ **Yazıcı Ribbon Değişimi:**\n\n1. Yazıcıyı kapatın\n2. Üst kapağı açın\n3. Eski ribbonu çıkarın\n4. Yeni ribbonu yerleştirin\n5. Test baskısı alın\n6. Vardiya bitiş formunda ribbon değişimini kaydedin\n\n💡 Ribbon kodu: DNP DS620';
    }
    
    // Photography tips and guidance
    if (lowerQuestion.includes('portre') || lowerQuestion.includes('çekim ayarları')) {
      return '📸 **Portre Fotoğrafı Çekim Ayarları:**\n\n📷 **Kamera Ayarları:**\n• ISO: 100-400 (gün ışığı)\n• Diyafram: f/2.8 - f/5.6 (arka plan bulanık)\n• Enstantane: 1/125 - 1/250\n\n💡 **İpuçları:**\n• Gözlere odaklanın\n• Doğal ışık kullanın\n• Altın saat (gün doğumu/batımı) idealdir\n• Kişiyi rahat ettirin\n• Farklı açılardan deneyin\n\n🌟 En iyi sonuç için sahilde gölgeli alanda çekim yapın!';
    } else if (lowerQuestion.includes('güneşli hava') || lowerQuestion.includes('güneşli')) {
      return '☀️ **Güneşli Havada Çekim Ayarları:**\n\n📷 **Önerilen Ayarlar:**\n• ISO: 100-200 (düşük tut)\n• Diyafram: f/8 - f/11\n• Enstantane: 1/250 - 1/500\n• Beyaz Dengesi: Gün ışığı modu\n\n⚠️ **Dikkat Edilmesi Gerekenler:**\n• Sert gölgelerden kaçının\n• Öğlen saatlerinde diffuser kullanın\n• Gözler için gözlük önerin\n• Yansımaları kontrol edin\n\n💡 **Pro İpucu:** Sahilde saat 10:00-11:00 veya 16:00-17:00 arası en iyi ışık!';
    } else if (lowerQuestion.includes('grup fotoğrafı') || lowerQuestion.includes('grup')) {
      return '👥 **Grup Fotoğrafı Çekimi İpuçları:**\n\n📷 **Kamera Ayarları:**\n• ISO: 200-400\n• Diyafram: f/8 - f/11 (tüm grup keskin)\n• Enstantane: 1/125 - 1/250\n• Geniş açı lens kullanın\n\n🎯 **Kompozisyon:**\n• Herkesi çerçeveye alın\n• Basamaklı düzen oluşturun\n• En az 3 kare çekin\n• Kimse gözlerini kırpmamış olsun\n\n💡 **Pro İpucu:**\n• "3-2-1" sayın ve çekin\n• Komik bir şey söyleyin (doğal gülümseme)\n• Herkesi kontrol edin\n• Yedek kareler çekin';
    } else if (lowerQuestion.includes('gün batımı') || lowerQuestion.includes('günbatımı') || lowerQuestion.includes('sunset')) {
      return '🌅 **Gün Batımı Çekimi:**\n\n📷 **Altın Saat Ayarları:**\n• ISO: 100-400\n• Diyafram: f/8 - f/16\n• Enstantane: 1/60 - 1/250\n• Beyaz Dengesi: Bulutlu/Gölge\n\n🎨 **Kompozisyon İpuçları:**\n• Kişiyi siluet olarak çekin\n• Deniz ve gökyüzü dengesini kur\n• Üçte bir kuralını kullan\n• Yansımaları kullan\n\n⏰ **Zamanlama:**\n• 30 dk önce hazır olun\n• Işık hızla değişir\n• Farklı açılardan deneyin\n\n🌟 **En iyi saat:** 18:30-19:30 (yaz sezonu)';
    } else if (lowerQuestion.includes('sahil') || lowerQuestion.includes('beach') || lowerQuestion.includes('plaj')) {
      return '🏖️ **Sahil/Beach Fotoğrafçılığı:**\n\n📷 **Önerilen Ayarlar:**\n• ISO: 100-200\n• Diyafram: f/5.6 - f/8\n• Enstantane: 1/250 - 1/500\n• Polarize filtre kullanın\n\n💡 **Püf Noktalar:**\n• Yansımalardan kaçının\n• Kumda lens değiştirmeyin\n• Ekipmanı koruyun (tuzlu su)\n• Backlight için yüzü aydınlatın\n\n🌊 **Kompozisyon:**\n• Denizi fon olarak kullan\n• Doğal çerçeveler bul\n• Hareket yakalayın (dalga, koşu)\n• Renkli aksesuarlar ekleyin';
    } else if (lowerQuestion.includes('flaş') || lowerQuestion.includes('flash')) {
      return '⚡ **Flaş Kullanımı:**\n\n💡 **Ne Zaman Kullanılır:**\n• Gölgeli alanlarda\n• Arka ışıkta (backlight)\n• Kapalı havada\n• Akşam saatlerinde\n\n📷 **Ayarlar:**\n• TTL modunda başlayın\n• -1 veya -2 kompanzasyon\n• Bounce flaş tercih edin\n• Diffuser kullanın\n\n⚠️ **Dikkat:**\n• Direkt flaş sert gölge yapar\n• Göze bakma\n• Yansımaları kontrol et\n\n🌟 **Pro İpucu:** Gün ışığında dolgu flaşı kullan!';
    } else if (lowerQuestion.includes('rüzgar') || lowerQuestion.includes('wind')) {
      return '💨 **Rüzgarlı Havada Çekim:**\n\n📸 **Teknik Ayarlar:**\n• Yüksek enstantane: 1/500+\n• ISO artırın (200-400)\n• Sürekli çekim modu\n• Otofokus takibi açık\n\n💡 **İpuçları:**\n• Saçların doğal hareketini kullan\n• Elbise/etek rüzgarda güzel\n• Arkadan rüzgar = saç yüzde\n• Yandan rüzgar = dinamik\n\n⚠️ **Ekipman Koruması:**\n• Kumu dikkat edin\n• Tripod sabitleyin\n• Lens kapağı hazır olsun';
    }
    
    // Admin-specific responses
    if (lowerQuestion.includes('bugün') || lowerQuestion.includes('ciro')) {
      return '📊 **Bugünkü Performans Özeti:**\n\nToplam satış ve ciro bilgileri aşağıda görülebilir.';
    } else if (lowerQuestion.includes('iyi')) {
      return '🏆 **En İyi Performans Gösteren Personel:**\n\n1. Ayşe Yılmaz - ₺12,400 (18 satış)\n2. Mehmet Demir - ₺9,800 (14 satış)\n3. Zeynep Kaya - ₺8,200 (12 satış)\n\n🌟 Tebrikler!';
    } else if (lowerQuestion.includes('şubat') || lowerQuestion.includes('ay')) {
      return '💰 **Şubat Ayı Performans Raporu:**\n\nAşağıda tüm lokasyonların detaylı performans bilgileri yer almaktadır.';
    }
    
    return '✨ İşte istediğiniz bilgiler:';
  };

  const generateData = (question: string): Message['data'] => {
    const lowerQuestion = question.toLowerCase();
    
    // Check for location-specific queries
    const hasZoka = lowerQuestion.includes('zoka');
    const hasHayal = lowerQuestion.includes('hayal');
    const hasBalik = lowerQuestion.includes('balık') || lowerQuestion.includes('balik');
    const hasTekne = lowerQuestion.includes('tekne');
    
    // FOR STAFF: Only return data for stock queries, nothing else
    if (userRole === 'staff') {
      // Only show stock data (without revenue/profit info)
      if (lowerQuestion.includes('stok')) {
        if (hasZoka) {
          return {
            stocks: [
              { name: '3\'lü Albüm', quantity: '52', status: '✅ Normal' },
              { name: '5\'li Albüm', quantity: '48', status: '✅ Normal' },
              { name: '7\'li Albüm', quantity: '18', status: '⚠️ Azalmış' },
              { name: '9\'lu Albüm', quantity: '25', status: '✅ Normal' },
              { name: '11\'li Albüm', quantity: '15', status: '⚠️ Azalmış' },
              { name: '15\'li Albüm', quantity: '12', status: '⚠️ Azalmış' },
              { name: 'Paspartu', quantity: '75', status: '✅ Normal' },
              { name: 'Ribbon', quantity: '8', status: '⚠️ Azalmış' },
            ],
          };
        } else if (hasHayal) {
          return {
            stocks: [
              { name: '3\'lü Albüm', quantity: '38', status: '✅ Normal' },
              { name: '5\'li Albüm', quantity: '42', status: '✅ Normal' },
              { name: '7\'li Albüm', quantity: '25', status: '✅ Normal' },
              { name: '9\'lu Albüm', quantity: '20', status: '✅ Normal' },
              { name: '11\'li Albüm', quantity: '12', status: '⚠️ Azalmış' },
              { name: '15\'li Albüm', quantity: '8', status: '❌ Kritik' },
              { name: 'Paspartu', quantity: '55', status: '✅ Normal' },
              { name: 'Ribbon', quantity: '5', status: '❌ Kritik' },
            ],
          };
        } else if (hasBalik) {
          return {
            stocks: [
              { name: '3\'lü Albüm', quantity: '45', status: '✅ Normal' },
              { name: '5\'li Albüm', quantity: '28', status: '⚠️ Azalmış' },
              { name: '7\'li Albüm', quantity: '22', status: '⚠️ Azalmış' },
              { name: '9\'lu Albüm', quantity: '18', status: '⚠️ Azalmış' },
              { name: '11\'li Albüm', quantity: '10', status: '⚠️ Azalmış' },
              { name: '15\'li Albüm', quantity: '15', status: '⚠️ Azalmış' },
              { name: 'Paspartu', quantity: '40', status: '✅ Normal' },
              { name: 'Ribbon', quantity: '6', status: '⚠️ Azalmış' },
            ],
          };
        } else if (hasTekne) {
          return {
            stocks: [
              { name: '3\'lü Albüm', quantity: '30', status: '✅ Normal' },
              { name: '5\'li Albüm', quantity: '35', status: '✅ Normal' },
              { name: '7\'li Albüm', quantity: '20', status: '✅ Normal' },
              { name: '9\'lu Albüm', quantity: '22', status: '✅ Normal' },
              { name: '11\'li Albüm', quantity: '18', status: '✅ Normal' },
              { name: '15\'li Albüm', quantity: '18', status: '✅ Normal' },
              { name: 'Paspartu', quantity: '50', status: '✅ Normal' },
              { name: 'Ribbon', quantity: '10', status: '✅ Normal' },
            ],
          };
        }
      }
      // For all other queries (photography tips, etc.), return empty object (text only, no data cards)
      return {};
    }
    
    // ADMIN ONLY - Full data responses below
    // Detailed End of Day Report (Detaylı Gün Sonu Raporu) - CHECK THIS BEFORE REGULAR GÜN SONU!
    if (lowerQuestion.includes('detaylı') && lowerQuestion.includes('gün sonu')) {
      if (hasZoka) {
        return {
          detailedEndOfDay: {
            revenue: '₺8,400',
            cost: '₺2,520',
            profit: '₺5,880',
            profitMargin: '70%',
            albums: [
              { type: '3\'lü Albüm', count: 5, unitCost: '₺12', totalCost: '₺60' },
              { type: '5\'li Albüm', count: 7, unitCost: '₺18', totalCost: '₺126' },
              { type: '7\'li Albüm', count: 3, unitCost: '₺22', totalCost: '₺66' },
              { type: '9\'lu Albüm', count: 2, unitCost: '₺28', totalCost: '₺56' },
              { type: '15\'li Albüm', count: 1, unitCost: '₺42', totalCost: '₺42' },
            ],
            prints: { totalPrints: 50, returnedPrints: 1, unitCost: '₺1.5', totalCost: '₺75' },
            staff: [
              { name: 'Ahmet Yılmaz (İskonto: 10%)', unitCost: '₺800' },
              { name: 'Ayşe Demir (İskonto: 9%)', unitCost: '₺800' },
              { name: 'Zeynep Kaya (İskonto: 12%)', unitCost: '₺750' },
            ],
            costs: {
              albumCostTotal: '₺350',
              printCostTotal: '₺75',
              staffCostTotal: '₺2,350',
              rentTotal: '₺500',
              totalCost: '₺3,275',
              totalRevenue: '₺8,400',
              netProfit: '₺5,125',
            },
          },
        };
      } else if (hasHayal) {
        return {
          detailedEndOfDay: {
            revenue: '₺6,200',
            cost: '₺1,860',
            profit: '₺4,340',
            profitMargin: '70%',
            albums: [
              { type: '3\'lü Albüm', count: 4, unitCost: '₺12', totalCost: '₺48' },
              { type: '5\'li Albüm', count: 5, unitCost: '₺18', totalCost: '₺90' },
              { type: '7\'li Albüm', count: 3, unitCost: '₺22', totalCost: '₺66' },
              { type: '11\'li Albüm', count: 2, unitCost: '₺32', totalCost: '₺64' },
            ],
            prints: { totalPrints: 40, returnedPrints: 1, unitCost: '₺1.5', totalCost: '₺60' },
            staff: [
              { name: 'Mehmet Demir (İskonto: 11%)', unitCost: '₺750' },
              { name: 'Elif Yılmaz (İskonto: 10%)', unitCost: '₺750' },
            ],
            costs: {
              albumCostTotal: '₺268',
              printCostTotal: '₺60',
              staffCostTotal: '₺1,500',
              rentTotal: '₺350',
              totalCost: '₺2,178',
              totalRevenue: '₺6,200',
              netProfit: '₺4,022',
            },
          },
        };
      } else if (hasBalik) {
        return {
          detailedEndOfDay: {
            revenue: '₺5,800',
            cost: '₺1,740',
            profit: '₺4,060',
            profitMargin: '70%',
            albums: [
              { type: '3\'lü Albüm', count: 3, unitCost: '₺12', totalCost: '₺36' },
              { type: '5\'li Albüm', count: 4, unitCost: '₺18', totalCost: '₺72' },
              { type: '7\'li Albüm', count: 2, unitCost: '₺22', totalCost: '₺44' },
              { type: '9\'lu Albüm', count: 2, unitCost: '₺28', totalCost: '₺56' },
              { type: '15\'li Albüm', count: 1, unitCost: '₺42', totalCost: '₺42' },
            ],
            prints: { totalPrints: 35, returnedPrints: 2, unitCost: '₺1.5', totalCost: '₺52.5' },
            staff: [
              { name: 'Selin Güneş (İskonto: 13%)', unitCost: '₺700' },
              { name: 'Barış Yurt (İskonto: 10%)', unitCost: '₺700' },
            ],
            costs: {
              albumCostTotal: '₺250',
              printCostTotal: '₺52.5',
              staffCostTotal: '₺1,400',
              rentTotal: '₺400',
              totalCost: '₺2,102.5',
              totalRevenue: '₺5,800',
              netProfit: '₺3,697.5',
            },
          },
        };
      } else if (hasTekne) {
        return {
          detailedEndOfDay: {
            revenue: '₺4,200',
            cost: '₺1,260',
            profit: '₺2,940',
            profitMargin: '70%',
            albums: [
              { type: '3\'lü Albüm', count: 2, unitCost: '₺12', totalCost: '₺24' },
              { type: '5\'li Albüm', count: 3, unitCost: '₺18', totalCost: '₺54' },
              { type: '7\'li Albüm', count: 2, unitCost: '₺22', totalCost: '₺44' },
              { type: '9\'lu Albüm', count: 2, unitCost: '₺28', totalCost: '₺56' },
              { type: '11\'li Albüm', count: 1, unitCost: '₺32', totalCost: '₺32' },
            ],
            prints: { totalPrints: 30, returnedPrints: 1, unitCost: '₺1.5', totalCost: '₺45' },
            staff: [
              { name: 'Ege Deniz (İskonto: 12%)', unitCost: '₺650' },
              { name: 'Deniz Kaya (İskonto: 11%)', unitCost: '₺650' },
            ],
            costs: {
              albumCostTotal: '₺210',
              printCostTotal: '₺45',
              staffCostTotal: '₺1,300',
              rentTotal: '₺300',
              totalCost: '₺1,855',
              totalRevenue: '₺4,200',
              netProfit: '₺2,345',
            },
          },
        };
      }
    }
    
    // End of day report data - CHECK THIS SECOND! (contains "rapor" keyword)
    if (lowerQuestion.includes('gün sonu')) {
      if (hasZoka) {
        return {
          endOfDayReport: {
            revenue: '₺8,400',
            cost: '₺2,520',
            profit: '₺5,880',
            profitMargin: '70%',
            totalSales: 18,
            totalPrints: 50,
            photoReturns: 1,
            albumBreakdown: [
              { type: '3\'lü', count: 5, revenue: '₺3,000' },
              { type: '5\'li', count: 7, revenue: '₺7,000' },
              { type: '7\'li', count: 3, revenue: '₺4,200' },
              { type: '9\'lu', count: 2, revenue: '₺3,600' },
              { type: '15\'li', count: 1, revenue: '₺3,000' },
            ],
            paymentMethods: [],
            discountInfo: {
              averageDiscount: '10%',
              totalDiscount: '₺840',
            },
            printerUsage: {
              ribbonUsed: '100 met',
              printsCount: 50,
            },
            notes: 'Gün oldukça yoğun geçti. 3 ribbon değişimi yapıldı. Yazıcıda hafif sıkışma problemi yaşandı ancak düzeltildi. Paspartu stoku kritik seviyede, yarın sipariş verilmesi gerekiyor. Tüm ödemeler sorunsuz alındı. - Ayşe Yılmaz',
          },
        };
      } else if (hasHayal) {
        return {
          endOfDayReport: {
            revenue: '₺6,200',
            cost: '₺1,860',
            profit: '₺4,340',
            profitMargin: '70%',
            totalSales: 14,
            totalPrints: 40,
            photoReturns: 1,
            albumBreakdown: [
              { type: '3\'lü', count: 4, revenue: '₺2,400' },
              { type: '5\'li', count: 5, revenue: '₺5,000' },
              { type: '7\'li', count: 3, revenue: '₺4,200' },
              { type: '11\'li', count: 2, revenue: '₺4,400' },
            ],
            paymentMethods: [],
            discountInfo: {
              averageDiscount: '10%',
              totalDiscount: '₺620',
            },
            printerUsage: {
              ribbonUsed: '80 met',
              printsCount: 40,
            },
            notes: 'Akşam saatleri yoğundu. 1 müşteriye %15 özel indirim uygulandı (Yönetici onayı ile). 15\'li albüm stoğu bitti, acil sipariş gerekiyor. Kasa sayımı yapıldı, fark yok. - Ali Veli',
          },
        };
      } else if (hasBalik) {
        return {
          endOfDayReport: {
            revenue: '₺5,800',
            cost: '₺1,740',
            profit: '₺4,060',
            profitMargin: '70%',
            totalSales: 12,
            totalPrints: 35,
            photoReturns: 2,
            albumBreakdown: [
              { type: '3\'lü', count: 3, revenue: '₺1,800' },
              { type: '5\'li', count: 4, revenue: '₺4,000' },
              { type: '7\'li', count: 2, revenue: '₺2,800' },
              { type: '9\'lu', count: 2, revenue: '₺3,600' },
              { type: '15\'li', count: 1, revenue: '₺3,000' },
            ],
            paymentMethods: [],
            discountInfo: {
              averageDiscount: '10%',
              totalDiscount: '₺580',
            },
            printerUsage: {
              ribbonUsed: '70 met',
              printsCount: 35,
            },
            notes: 'Sakin bir gündü. 2 iade işlemi yapıldı (fotoğraf kalitesi nedeniyle, yeniden basım yapıldı). Tüm stoklar kontrol edildi. Yarın için 5\'li ve 7\'li albüm siparişi verilmeli. - Selin Güneş',
          },
        };
      } else if (hasTekne) {
        return {
          endOfDayReport: {
            revenue: '₺4,200',
            cost: '₺1,260',
            profit: '₺2,940',
            profitMargin: '70%',
            totalSales: 10,
            totalPrints: 30,
            photoReturns: 1,
            albumBreakdown: [
              { type: '3\'lü', count: 2, revenue: '₺1,200' },
              { type: '5\'li', count: 3, revenue: '₺3,000' },
              { type: '7\'li', count: 2, revenue: '₺2,800' },
              { type: '9\'lu', count: 2, revenue: '₺3,600' },
              { type: '11\'li', count: 1, revenue: '₺2,200' },
            ],
            paymentMethods: [],
            discountInfo: {
              averageDiscount: '10%',
              totalDiscount: '₺420',
            },
            printerUsage: {
              ribbonUsed: '60 met',
              printsCount: 30,
            },
            notes: 'Tekne turları az olduğu için satışlar düşüktü. Ancak öğleden sonra bir grup geldi ve 4 albüm satışı yapıldı. Yazıcı bakımı yapıldı, temizlik OK. Stoklar yeterli. - Ege Deniz',
          },
        };
      }
    }
    
    // Location-based stock data
    if (lowerQuestion.includes('stok')) {
      if (hasZoka) {
        return {
          stocks: userRole === 'admin' ? [
            { name: '3\'lü Albüm', quantity: '52', status: '✅ Normal' },
            { name: '5\'li Albüm', quantity: '48', status: '✅ Normal' },
            { name: '7\'li Albüm', quantity: '18', status: '⚠️ Azalmış' },
            { name: '9\'lu Albüm', quantity: '25', status: '✅ Normal' },
            { name: '11\'li Albüm', quantity: '15', status: '⚠️ Azalmış' },
            { name: '15\'li Albüm', quantity: '12', status: '⚠️ Azalmış' },
            { name: 'Paspartu', quantity: '75', status: '✅ Normal' },
            { name: 'Ribbon', quantity: '8', status: '⚠️ Azalmış' },
          ] : [
            { name: '3\'lü Albüm', quantity: '52', status: '✅ Normal', revenue: '₺3,120', profitAmount: '₺2,184' },
            { name: '5\'li Albüm', quantity: '48', status: '✅ Normal', revenue: '₺4,800', profitAmount: '₺3,360' },
            { name: '7\'li Albüm', quantity: '18', status: '⚠️ Azalmış', revenue: '₺2,520', profitAmount: '₺1,764' },
            { name: '9\'lu Albüm', quantity: '25', status: '✅ Normal', revenue: '₺4,500', profitAmount: '₺3,150' },
            { name: '11\'li Albüm', quantity: '15', status: '⚠️ Azalmış', revenue: '₺3,300', profitAmount: '₺2,310' },
            { name: '15\'li Albüm', quantity: '12', status: '⚠️ Azalmış', revenue: '₺3,600', profitAmount: '₺2,520' },
            { name: 'Paspartu', quantity: '75', status: '✅ Normal', revenue: '₺1,500', profitAmount: '₺1,050' },
            { name: 'Ribbon', quantity: '8', status: '⚠️ Azalmış', revenue: '-', profitAmount: '-' },
          ],
        };
      } else if (hasHayal) {
        return {
          stocks: userRole === 'admin' ? [
            { name: '3\'lü Albüm', quantity: '38', status: '✅ Normal' },
            { name: '5\'li Albüm', quantity: '42', status: '✅ Normal' },
            { name: '7\'li Albüm', quantity: '25', status: '✅ Normal' },
            { name: '9\'lu Albüm', quantity: '20', status: '✅ Normal' },
            { name: '11\'li Albüm', quantity: '12', status: '⚠️ Azalmış' },
            { name: '15\'li Albüm', quantity: '8', status: '❌ Kritik' },
            { name: 'Paspartu', quantity: '55', status: '✅ Normal' },
            { name: 'Ribbon', quantity: '5', status: '❌ Kritik' },
          ] : [
            { name: '3\'lü Albüm', quantity: '38', status: '✅ Normal', revenue: '₺2,280', profitAmount: '₺1,596' },
            { name: '5\'li Albüm', quantity: '42', status: '✅ Normal', revenue: '₺4,200', profitAmount: '₺2,940' },
            { name: '7\'li Albüm', quantity: '25', status: '✅ Normal', revenue: '₺3,500', profitAmount: '₺2,450' },
            { name: '9\'lu Albüm', quantity: '20', status: '✅ Normal', revenue: '₺3,600', profitAmount: '₺2,520' },
            { name: '11\'li Albüm', quantity: '12', status: '⚠️ Azalmış', revenue: '₺2,640', profitAmount: '₺1,848' },
            { name: '15\'li Albüm', quantity: '8', status: '❌ Kritik', revenue: '₺2,400', profitAmount: '₺1,680' },
            { name: 'Paspartu', quantity: '55', status: '✅ Normal', revenue: '₺1,100', profitAmount: '₺770' },
            { name: 'Ribbon', quantity: '5', status: '❌ Kritik', revenue: '-', profitAmount: '-' },
          ],
        };
      } else if (hasBalik) {
        return {
          stocks: userRole === 'admin' ? [
            { name: '3\'lü Albüm', quantity: '45', status: '✅ Normal' },
            { name: '5\'li Albüm', quantity: '28', status: '⚠️ Azalmış' },
            { name: '7\'li Albüm', quantity: '22', status: '⚠️ Azalmış' },
            { name: '9\'lu Albüm', quantity: '18', status: '⚠️ Azalmış' },
            { name: '11\'li Albüm', quantity: '10', status: '⚠️ Azalmış' },
            { name: '15\'li Albüm', quantity: '15', status: '⚠️ Azalmış' },
            { name: 'Paspartu', quantity: '40', status: '✅ Normal' },
            { name: 'Ribbon', quantity: '6', status: '⚠️ Azalmış' },
          ] : [
            { name: '3\'lü Albüm', quantity: '45', status: '✅ Normal', revenue: '₺2,700', profitAmount: '₺1,890' },
            { name: '5\'li Albüm', quantity: '28', status: '⚠️ Azalmış', revenue: '₺2,800', profitAmount: '₺1,960' },
            { name: '7\'li Albüm', quantity: '22', status: '⚠️ Azalmış', revenue: '₺3,080', profitAmount: '₺2,156' },
            { name: '9\'lu Albüm', quantity: '18', status: '⚠️ Azalmış', revenue: '₺3,240', profitAmount: '₺2,268' },
            { name: '11\'li Albüm', quantity: '10', status: '⚠️ Azalmış', revenue: '₺2,200', profitAmount: '₺1,540' },
            { name: '15\'li Albüm', quantity: '15', status: '⚠️ Azalmış', revenue: '₺4,500', profitAmount: '₺3,150' },
            { name: 'Paspartu', quantity: '40', status: '✅ Normal', revenue: '₺800', profitAmount: '₺560' },
            { name: 'Ribbon', quantity: '6', status: '⚠️ Azalmış', revenue: '-', profitAmount: '-' },
          ],
        };
      } else if (hasTekne) {
        return {
          stocks: userRole === 'admin' ? [
            { name: '3\'lü Albüm', quantity: '30', status: '✅ Normal' },
            { name: '5\'li Albüm', quantity: '35', status: '✅ Normal' },
            { name: '7\'li Albüm', quantity: '20', status: '✅ Normal' },
            { name: '9\'lu Albüm', quantity: '22', status: '✅ Normal' },
            { name: '11\'li Albüm', quantity: '18', status: '✅ Normal' },
            { name: '15\'li Albüm', quantity: '18', status: '✅ Normal' },
            { name: 'Paspartu', quantity: '50', status: '✅ Normal' },
            { name: 'Ribbon', quantity: '10', status: '✅ Normal' },
          ] : [
            { name: '3\'lü Albüm', quantity: '30', status: '✅ Normal', revenue: '₺1,800', profitAmount: '₺1,260' },
            { name: '5\'li Albüm', quantity: '35', status: '✅ Normal', revenue: '₺3,500', profitAmount: '₺2,450' },
            { name: '7\'li Albüm', quantity: '20', status: '✅ Normal', revenue: '₺2,800', profitAmount: '₺1,960' },
            { name: '9\'lu Albüm', quantity: '22', status: '✅ Normal', revenue: '₺3,960', profitAmount: '₺2,772' },
            { name: '11\'li Albüm', quantity: '18', status: '✅ Normal', revenue: '₺3,960', profitAmount: '₺2,772' },
            { name: '15\'li Albüm', quantity: '18', status: '✅ Normal', revenue: '₺5,400', profitAmount: '₺3,780' },
            { name: 'Paspartu', quantity: '50', status: '✅ Normal', revenue: '₺1,000', profitAmount: '₺700' },
            { name: 'Ribbon', quantity: '10', status: '✅ Normal', revenue: '-', profitAmount: '-' },
          ],
        };
      }
    }
    
    // Location-based sales data
    if (lowerQuestion.includes('satış') || lowerQuestion.includes('rapor')) {
      if (hasZoka) {
        return {
          revenue: '₺8,400',
          profit: '₺5,880',
        };
      } else if (hasHayal) {
        return {
          revenue: '₺6,200',
          profit: '₺4,340',
        };
      } else if (hasBalik) {
        return {
          revenue: '₺5,800',
          profit: '₺4,060',
        };
      } else if (hasTekne) {
        return {
          revenue: '₺4,200',
          profit: '₺2,940',
        };
      }
    }
    
    // Location-based personnel data
    if (lowerQuestion.includes('personel') || lowerQuestion.includes('performans')) {
      if (hasZoka) {
        return {
          personnel: {
            staff: [
              { 
                name: 'Ayşe Yılmaz', 
                revenue: '₺3,200', 
                sales: 8,
                discountRate: '8%',
              },
              { 
                name: 'Mehmet Demir', 
                revenue: '₺2,800', 
                sales: 6,
                discountRate: '12%',
              },
              { 
                name: 'Zeynep Kaya', 
                revenue: '₺2,400', 
                sales: 5,
                discountRate: '10%',
              },
            ],
            totals: {
              totalRevenue: '₺8,400',
              totalPrints: 50,
              totalReturns: 1,
            },
          },
        };
      } else if (hasHayal) {
        return {
          personnel: {
            staff: [
              { 
                name: 'Ali Veli', 
                revenue: '₺2,600', 
                sales: 7,
                discountRate: '9%',
              },
              { 
                name: 'Fatma Nur', 
                revenue: '₺2,200', 
                sales: 5,
                discountRate: '11%',
              },
              { 
                name: 'Can Öz', 
                revenue: '₺1,400', 
                sales: 3,
                discountRate: '15%',
              },
            ],
            totals: {
              totalRevenue: '₺6,200',
              totalPrints: 40,
              totalReturns: 1,
            },
          },
        };
      } else if (hasBalik) {
        return {
          personnel: {
            staff: [
              { 
                name: 'Selin Güneş', 
                revenue: '₺2,400', 
                sales: 6,
                discountRate: '7%',
              },
              { 
                name: 'Burak Yıldız', 
                revenue: '₺2,000', 
                sales: 5,
                discountRate: '10%',
              },
              { 
                name: 'Deniz Kara', 
                revenue: '₺1,400', 
                sales: 4,
                discountRate: '13%',
              },
            ],
            totals: {
              totalRevenue: '₺5,800',
              totalPrints: 35,
              totalReturns: 2,
            },
          },
        };
      } else if (hasTekne) {
        return {
          personnel: {
            staff: [
              { 
                name: 'Ege Deniz', 
                revenue: '₺1,800', 
                sales: 4,
                discountRate: '8%',
              },
              { 
                name: 'Merve Ak', 
                revenue: '₺1,600', 
                sales: 3,
                discountRate: '12%',
              },
              { 
                name: 'Cem Beyaz', 
                revenue: '₺800', 
                sales: 2,
                discountRate: '14%',
              },
            ],
            totals: {
              totalRevenue: '₺4,200',
              totalPrints: 30,
              totalReturns: 1,
            },
          },
        };
      }
    }
    
    // Staff questions don't need data cards for prices/instructions
    if (lowerQuestion.includes('fiyat') || 
        lowerQuestion.includes('ribbon') ||
        lowerQuestion.includes('nasıl yapılır')) {
      return {};
    }
    
    // Admin data responses
    if (lowerQuestion.includes('bugün') || lowerQuestion.includes('ciro')) {
      return {
        revenue: '₺24,600',
        profit: '₺17,200',
      };
    } else if (lowerQuestion.includes('şubat') || lowerQuestion.includes('ay')) {
      return {
        revenue: '₺324,500',
        profit: '₺226,150',
        projects: [
          { name: 'ZOKA', revenue: '₺112,000' },
          { name: 'Hayal Kahvesi', revenue: '₺98,400' },
          { name: 'Balık Hali', revenue: '₺76,100' },
          { name: 'Tekne Projesi', revenue: '₺38,000' },
        ],
      };
    }
    
    return {};
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] flex flex-col">
      {/* Top Bar for Staff */}
      {userRole === 'staff' && (
        <StaffTopBar
          userName={userName}
          userRole="staff"
          onLogout={onLogout}
          onNavigate={onNavigate}
        />
      )}

      {/* Header - only for admin */}
      {userRole === 'admin' && (
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/0 border-b border-white/10 pt-6 px-6 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-[#2d3748]" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Aspect AI</h1>
              <p className="text-xs text-gray-400">Yapay Zeka Asistanı</p>
            </div>
          </div>
        </div>
      )}

      {/* For staff, add header after top bar */}
      {userRole === 'staff' && (
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/0 border-b border-white/10 px-6 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-[#2d3748]" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Aspect AI</h1>
              <p className="text-xs text-gray-400">Yapay Zeka Asistanı</p>
            </div>
          </div>
        </div>
      )}

      {/* Date and Location Selectors */}
      <div className="px-4 py-4 border-b border-white/10 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl">
        <div className="space-y-3">
          {/* Date Selector */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#9dd9ea]" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="flex-1 px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#9dd9ea]/50 focus:border-[#9dd9ea]/50 transition-all"
              style={{
                colorScheme: 'dark',
              }}
            />
          </div>

          {/* Location Chips */}
          <div className="flex flex-wrap gap-2">
            <MapPin className="w-4 h-4 text-[#ffd4a3] mt-1" />
            {locations.map((location) => (
              <button
                key={location}
                onClick={() => setSelectedLocation(location === selectedLocation ? '' : location)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
                  selectedLocation === location
                    ? 'bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f] text-[#2d3748] shadow-lg'
                    : 'bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20'
                }`}
              >
                {location}
              </button>
            ))}
          </div>

          {/* Quick Action Buttons Based on Selection */}
          {selectedLocation && (
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={() => handleSend(`${selectedLocation} stok durumu ${selectedDate}`)}
                className="flex-shrink-0 px-3 py-1.5 bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] rounded-lg text-xs font-bold shadow-lg hover:shadow-xl transition-all active:scale-95"
              >
                📦 Stok
              </button>
              {userRole === 'admin' && (
                <>
                  <button
                    onClick={() => handleSend(`${selectedLocation} personel performansı ${selectedDate}`)}
                    className="flex-shrink-0 px-3 py-1.5 bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f] text-[#2d3748] rounded-lg text-xs font-bold shadow-lg hover:shadow-xl transition-all active:scale-95"
                  >
                    👥 Personel
                  </button>
                  <button
                    onClick={() => handleSend(`${selectedLocation} gün sonu özet ${selectedDate}`)}
                    className="flex-shrink-0 px-3 py-1.5 bg-gradient-to-br from-[#a8e6cf] to-[#8dd9b8] text-[#2d3748] rounded-lg text-xs font-bold shadow-lg hover:shadow-xl transition-all active:scale-95"
                  >
                    💰 Gün Sonu
                  </button>
                  <button
                    onClick={() => handleSend(`${selectedLocation} detaylı gün sonu raporu ${selectedDate}`)}
                    className="flex-shrink-0 px-3 py-1.5 bg-gradient-to-br from-[#d4b5f7] to-[#c79ff0] text-[#2d3748] rounded-lg text-xs font-bold shadow-lg hover:shadow-xl transition-all active:scale-95"
                  >
                    📅 Detaylı Gün Sonu
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-32">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center shadow-lg ${
              message.type === 'user' 
                ? 'bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd]' 
                : 'bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f]'
            }`}>
              {message.type === 'user' ? (
                <User className="w-4 h-4 text-[#2d3748]" />
              ) : (
                <Sparkles className="w-4 h-4 text-[#2d3748]" />
              )}
            </div>
            
            <div className={`flex-1 max-w-[80%] ${message.type === 'user' ? 'flex justify-end' : ''}`}>
              <div className={`rounded-2xl px-4 py-3 shadow-lg ${
                message.type === 'user'
                  ? 'bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748]'
                  : 'bg-white/10 backdrop-blur-sm border border-white/20 text-white'
              }`}>
                <p className="text-sm whitespace-pre-line font-medium">{message.content}</p>
                {message.type === 'assistant' && message.data && (
                  <AIResponseCard data={message.data} />
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Questions */}
      <div className="px-4 py-3 border-t border-white/10 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl">
        {/* Add label for staff quick questions */}
        {userRole === 'staff' && (
          <div className="text-xs text-gray-400 mb-2 font-semibold px-1">📸 Fotoğrafçılık İpuçları</div>
        )}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {quickQuestions.map((question) => (
            <button
              key={question}
              onClick={() => handleSend(question)}
              className={`flex-shrink-0 px-4 py-2 backdrop-blur-sm border rounded-full text-xs font-semibold transition-all active:scale-95 ${
                userRole === 'staff'
                  ? 'bg-gradient-to-br from-[#ffd4a3]/20 to-[#ffc78f]/10 border-[#ffd4a3]/30 text-[#ffd4a3] hover:bg-[#ffd4a3]/30'
                  : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
              }`}
            >
              {question}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="px-4 py-4 border-t border-white/10 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-xl">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Bir soru sorun..."
            className="flex-1 px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9dd9ea]/50 focus:border-[#9dd9ea]/50 transition-all"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim()}
            className="px-4 py-3 bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] rounded-xl hover:shadow-lg hover:shadow-[#9dd9ea]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 font-bold"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}