import { useState } from 'react';
import { DollarSign, Users, CheckCircle, TrendingUp, Award, Clock, Tag, X } from 'lucide-react';

interface Sale {
  id: string;
  staff: string;
  product: string;
  price: number;
  discount: number;
  time: string;
}

interface ClosingViewProps {
  projectName: string;
  onClose: () => void;
  userName: string;
  userRole: 'admin' | 'staff';
}

export function ClosingView({ projectName, onClose, userName, userRole }: ClosingViewProps) {
  const [isClosed, setIsClosed] = useState(false);

  // Mock data - gerçek uygulamada backend'den gelecek
  const allSales: Sale[] = [
    { id: '1', staff: 'Ahmet Yılmaz', product: "2× 5'li", price: 1800, discount: 200, time: '14:23' },
    { id: '2', staff: 'Mehmet Demir', product: "1× 3'lü", price: 600, discount: 0, time: '14:35' },
    { id: '3', staff: 'Ayşe Kaya', product: "3× 7'li", price: 3600, discount: 600, time: '14:47' },
    { id: '4', staff: 'Ahmet Yılmaz', product: "1× 9'lu", price: 1800, discount: 0, time: '15:12' },
    { id: '5', staff: 'Mehmet Demir', product: "1× Paspartu", price: 200, discount: 0, time: '15:28' },
    { id: '6', staff: 'Fatma Öz', product: "2× 3'lü", price: 1200, discount: 0, time: '15:45' },
    { id: '7', staff: 'Ahmet Yılmaz', product: "1× 11'li", price: 2000, discount: 200, time: '16:03' },
    { id: '8', staff: 'Ayşe Kaya', product: "1× 5'li", price: 1000, discount: 0, time: '16:21' },
    { id: '9', staff: 'Mehmet Demir', product: "1× 7'li", price: 1400, discount: 0, time: '16:38' },
    { id: '10', staff: 'Fatma Öz', product: "2× 9'lu", price: 3600, discount: 0, time: '16:52' },
  ];

  // Personelse sadece kendi satışlarını göster
  const visibleSales = userRole === 'staff' 
    ? allSales.filter(sale => sale.staff === userName)
    : allSales;

  // Personel bazlı istatistikler
  const staffStats = visibleSales.reduce((acc, sale) => {
    if (!acc[sale.staff]) {
      acc[sale.staff] = {
        name: sale.staff,
        totalSales: 0,
        totalRevenue: 0,
        totalDiscount: 0,
        salesCount: 0,
      };
    }
    acc[sale.staff].totalSales += 1;
    acc[sale.staff].totalRevenue += sale.price;
    acc[sale.staff].totalDiscount += sale.discount;
    acc[sale.staff].salesCount += 1;
    return acc;
  }, {} as Record<string, any>);

  const staffList = Object.values(staffStats).sort((a: any, b: any) => b.totalRevenue - a.totalRevenue);

  const totalRevenue = visibleSales.reduce((sum, sale) => sum + sale.price, 0);
  const totalDiscount = visibleSales.reduce((sum, sale) => sum + sale.discount, 0);
  const totalSales = visibleSales.length;

  const handleClosing = () => {
    if (confirm(`${projectName} için günü kapatmak istediğinize emin misiniz?\n\nToplam Ciro: ₺${totalRevenue.toLocaleString()}\nToplam Satış: ${totalSales} adet`)) {
      setIsClosed(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto p-4">
      <div className="w-full max-w-4xl my-8">
        <div className="bg-gradient-to-b from-white to-[#e0f2fe] rounded-3xl shadow-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-[#9dd9ea] rounded-t-3xl p-6 text-primary-foreground">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold mb-1">{projectName}</h2>
                <p className="text-white/80 text-sm">Günlük Kapanış & Satış Raporu</p>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                <div className="text-white/70 text-xs mb-1">{userRole === 'staff' ? 'Benim Cirom' : 'Toplam Ciro'}</div>
                <div className="text-2xl font-bold">₺{totalRevenue.toLocaleString()}</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                <div className="text-white/70 text-xs mb-1">{userRole === 'staff' ? 'Benim Satışım' : 'Toplam Satış'}</div>
                <div className="text-2xl font-bold">{totalSales} adet</div>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                <div className="text-white/70 text-xs mb-1">İskonto</div>
                <div className="text-2xl font-bold">₺{totalDiscount}</div>
              </div>
            </div>

            {/* Closing Button at Top */}
            {!isClosed ? (
              <button
                onClick={handleClosing}
                className="w-full bg-white/20 hover:bg-white/30 backdrop-blur text-white py-4 rounded-xl font-bold text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2 border border-white/30"
              >
                <CheckCircle className="w-5 h-5" />
                Gün Sonu Kapanışı Yap
              </button>
            ) : (
              <div className="bg-white/20 backdrop-blur text-white py-6 rounded-xl text-center border border-white/30">
                <div className="text-5xl mb-2">✅</div>
                <div className="text-xl font-bold mb-1">Kapanış Tamamlandı!</div>
                <div className="text-white/80 text-sm">
                  Gün sonu kapanışı başarıyla yapıldı
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Staff Performance - Sadece yönetici görsün */}
            {userRole === 'admin' && (
              <div>
                <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Personel Performansı
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {staffList.map((staff: any, index: number) => (
                    <div
                      key={staff.name}
                      className="bg-white rounded-xl p-4 border border-border shadow-sm"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold ${
                          index === 0 ? 'bg-gradient-to-br from-[#f59e0b] to-[#d97706]' :
                          index === 1 ? 'bg-gradient-to-br from-[#d6e0ec] to-[#c1cede]' :
                          index === 2 ? 'bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f]' :
                          'bg-gradient-to-br from-primary to-[#9dd9ea]'
                        }`}>
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-foreground">{staff.name}</div>
                          <div className="text-xs text-muted-foreground">{staff.salesCount} satış</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold bg-gradient-to-r from-primary to-[#9dd9ea] bg-clip-text text-transparent">
                            ₺{staff.totalRevenue.toLocaleString()}
                          </div>
                          {staff.totalDiscount > 0 && (
                            <div className="text-xs text-orange">-₺{staff.totalDiscount}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All Sales */}
            <div>
              <h3 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                {userRole === 'staff' ? 'Benim Satışlarım' : 'Tüm Satışlar'} ({totalSales})
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {visibleSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="bg-white rounded-xl p-4 border border-border shadow-sm flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-success to-[#059669] flex items-center justify-center text-white font-bold">
                        ✓
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{sale.product}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          {userRole === 'admin' && (
                            <>
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {sale.staff}
                              </span>
                              <span>•</span>
                            </>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {sale.time}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-foreground">₺{sale.price}</div>
                      {sale.discount > 0 && (
                        <div className="text-xs text-orange flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          ₺{sale.discount} iskonto
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
