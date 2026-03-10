import { TrendingUp, CheckCircle, Clock, Award } from 'lucide-react';

interface StaffSummaryProps {
  userName: string;
}

export function StaffSummary({ userName }: StaffSummaryProps) {
  const todayStats = {
    entriesCompleted: 3,
    albumsSold: 24,
    hoursWorked: 6.5,
    performance: 92,
  };

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <h1 className="text-3xl font-bold text-foreground mb-1">Hoş Geldin, {userName}!</h1>
        <p className="text-muted-foreground text-sm">Bugünkün performansın</p>
      </div>

      <div className="px-6 space-y-4">
        {/* Performance Score */}
        <div className="bg-gradient-to-br from-[#b8d4f1] to-[#a7c7e7] rounded-2xl p-6 text-[#2d3748]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm opacity-90 mb-1">Performans Skoru</div>
              <div className="text-4xl font-bold">{todayStats.performance}%</div>
            </div>
            <div className="w-16 h-16 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
              <Award className="w-8 h-8" />
            </div>
          </div>
          <div className="text-xs opacity-75">Harika gidiyorsun! Devam et 🎉</div>
        </div>

        {/* Today's Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                <CheckCircle className="w-4 h-4 text-[#10b981]" />
              </div>
            </div>
            <div className="text-xs text-muted-foreground mb-1">Tamamlanan Rapor</div>
            <div className="text-2xl font-bold text-foreground">{todayStats.entriesCompleted}</div>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(30, 64, 175, 0.1)' }}>
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
            </div>
            <div className="text-xs text-muted-foreground mb-1">Satılan Albüm</div>
            <div className="text-2xl font-bold text-foreground">{todayStats.albumsSold}</div>
          </div>
        </div>

        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
                <Clock className="w-4 h-4 text-[#f59e0b]" />
              </div>
              <div className="text-xs text-muted-foreground">Çalışma Saati</div>
            </div>
            <div className="text-xl font-bold text-foreground">{todayStats.hoursWorked} saat</div>
          </div>
        </div>

        {/* Tips Card */}
        <div className="bg-card rounded-2xl p-5 border border-border">
          <h3 className="font-semibold text-foreground mb-3">💡 Günün İpucu</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Albüm satışlarını kaydederken bozuk ürünleri de not etmeyi unutmayın. Bu, stok yönetimi için çok önemlidir.
          </p>
        </div>

        {/* Recent Activity */}
        <div className="bg-card rounded-2xl p-5 border border-border">
          <h3 className="font-semibold text-foreground mb-3">Son Aktiviteler</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
              <div className="w-2 h-2 rounded-full bg-[#10b981]"></div>
              <div className="flex-1">
                <div className="text-sm text-foreground">ZOKA raporu tamamlandı</div>
                <div className="text-xs text-muted-foreground">15 dakika önce</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
              <div className="w-2 h-2 rounded-full bg-primary"></div>
              <div className="flex-1">
                <div className="text-sm text-foreground">18 albüm satışı kaydedildi</div>
                <div className="text-xs text-muted-foreground">2 saat önce</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
              <div className="w-2 h-2 rounded-full bg-[#f59e0b]"></div>
              <div className="flex-1">
                <div className="text-sm text-foreground">Yazıcı ribbon değişimi yapıldı</div>
                <div className="text-xs text-muted-foreground">4 saat önce</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
