import { TrendingUp, Zap, Target, Award, DollarSign, Percent, ChevronRight, Flame, Star, ShoppingBag, Trophy } from 'lucide-react';
import { CurrencyWidget } from './currency-widget';

interface StaffPersonalDashboardProps {
  userName: string;
  onLogout?: () => void;
  onNavigate?: (tab: string) => void;
}

export function StaffPersonalDashboard({ userName, onLogout = () => {}, onNavigate = () => {} }: StaffPersonalDashboardProps) {
  const todayStats = {
    totalSales: 12,
    discountRate: 8.5,
    revenue: 8400,
  };

  const monthlyStats = {
    salesCount: 156,
    targetRevenue: 120000,
    actualRevenue: 104760,
    averageDiscount: 9.2,
  };

  const revenuePercentage = (monthlyStats.actualRevenue / monthlyStats.targetRevenue) * 100;
  const discountScore = Math.max(0, 100 - (monthlyStats.averageDiscount * 5));
  const performanceScore = (discountScore * 0.4 + revenuePercentage * 0.6);

  // Dinamik ay adı
  const now = new Date();
  const monthName = now.toLocaleString('tr-TR', { month: 'long' });
  const year = now.getFullYear();

  const performanceLabel =
    performanceScore >= 90 ? { text: 'Mükemmel', emoji: '🏆', color: '#ffd4a3' } :
    performanceScore >= 75 ? { text: 'Harika', emoji: '⭐', color: '#9dd9ea' } :
    performanceScore >= 60 ? { text: 'İyi', emoji: '👍', color: '#a8e6cf' } :
                             { text: 'Gelişebilir', emoji: '📈', color: '#c084fc' };

  const strokeLen = 2 * Math.PI * 85; // ~534

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a051e] via-[#120830] to-[#1a0a3c] pb-32 relative overflow-x-hidden">

      {/* Arka plan glow efektleri */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="absolute top-1/3 -right-24 w-64 h-64 rounded-full bg-cyan-500/8 blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-56 h-56 rounded-full bg-purple-500/8 blur-3xl" />
      </div>

      {/* ── Hoşgeldin kartı ── */}
      <div className="px-5 pt-5 pb-4 relative z-10">
        <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-white/[0.07] backdrop-blur-xl shadow-2xl">
          {/* İç parıltı */}
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-cyan-500/8 pointer-events-none" />
          {/* Üst çizgi aksanı */}
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

          <div className="relative p-5">
            <div className="flex items-center gap-4 mb-5">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-2xl shadow-lg shadow-violet-500/30 border border-white/20">
                  😊
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 border-2 border-[#0a051e] flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-black text-white leading-tight">
                  Merhaba, {userName}! 👋
                </h1>
                <p className="text-sm text-gray-400 mt-0.5 truncate">Bugünkü performansın harika gidiyor!</p>
              </div>
              <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center">
                <Flame className="w-4 h-4 text-orange-400" />
              </div>
            </div>

            {/* Günlük stat kartları */}
            <div className="grid grid-cols-3 gap-2.5">
              {/* Satış */}
              <div className="relative overflow-hidden rounded-2xl border border-[#9dd9ea]/20 bg-[#9dd9ea]/8 p-3 text-center">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-px bg-[#9dd9ea]/40" />
                <Zap className="w-4 h-4 text-[#9dd9ea] mx-auto mb-1.5" />
                <div className="text-2xl font-black text-white leading-none">{todayStats.totalSales}</div>
                <div className="text-[10px] text-[#9dd9ea]/80 font-semibold mt-1 uppercase tracking-wide">Satış</div>
              </div>
              {/* İskonto */}
              <div className="relative overflow-hidden rounded-2xl border border-[#ffd4a3]/20 bg-[#ffd4a3]/8 p-3 text-center">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-px bg-[#ffd4a3]/40" />
                <Percent className="w-4 h-4 text-[#ffd4a3] mx-auto mb-1.5" />
                <div className="text-2xl font-black text-white leading-none">%{todayStats.discountRate}</div>
                <div className="text-[10px] text-[#ffd4a3]/80 font-semibold mt-1 uppercase tracking-wide">İskonto</div>
              </div>
              {/* Ciro */}
              <div className="relative overflow-hidden rounded-2xl border border-[#a8e6cf]/20 bg-[#a8e6cf]/8 p-3 text-center">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-px bg-[#a8e6cf]/40" />
                <DollarSign className="w-4 h-4 text-[#a8e6cf] mx-auto mb-1.5" />
                <div className="text-lg font-black text-white leading-none">₺{(todayStats.revenue / 1000).toFixed(1)}k</div>
                <div className="text-[10px] text-[#a8e6cf]/80 font-semibold mt-1 uppercase tracking-wide">Ciro</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Aylık Performans ── */}
      <div className="px-5 pb-4 relative z-10">
        <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-white/[0.07] backdrop-blur-xl shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/8 via-transparent to-violet-500/8 pointer-events-none" />
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

          <div className="relative p-5">
            {/* Başlık */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/40 to-purple-600/30 border border-violet-400/30 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <Award className="w-5 h-5 text-violet-300" />
              </div>
              <div>
                <h2 className="text-base font-black text-white">Aylık Performans</h2>
                <p className="text-xs text-gray-400">{monthName} {year} Değerlendirmesi</p>
              </div>
            </div>

            {/* Çember + Breakdown yan yana */}
            <div className="flex items-center gap-5">
              {/* SVG çemberi */}
              <div className="relative flex-shrink-0 w-36 h-36">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
                  <defs>
                    <linearGradient id="perfGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#a78bfa" />
                      <stop offset="50%" stopColor="#9dd9ea" />
                      <stop offset="100%" stopColor="#a8e6cf" />
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  {/* Arka halka */}
                  <circle cx="100" cy="100" r="85" stroke="rgba(255,255,255,0.08)" strokeWidth="16" fill="none" />
                  {/* İlerleme halkası */}
                  <circle
                    cx="100" cy="100" r="85"
                    stroke="url(#perfGrad)"
                    strokeWidth="16"
                    fill="none"
                    strokeDasharray={`${(performanceScore / 100) * strokeLen} ${strokeLen}`}
                    strokeLinecap="round"
                    filter="url(#glow)"
                    className="transition-all duration-1000"
                  />
                </svg>
                {/* Merkez skor */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-3xl font-black text-white leading-none">{performanceScore.toFixed(0)}</div>
                  <div className="text-[10px] text-gray-400 font-semibold">/ 100</div>
                  <div className="text-xs font-bold mt-1" style={{ color: performanceLabel.color }}>
                    {performanceLabel.emoji} {performanceLabel.text}
                  </div>
                </div>
              </div>

              {/* Breakdown çubukları */}
              <div className="flex-1 space-y-3 min-w-0">
                {/* İskonto skoru */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-400 font-semibold flex items-center gap-1">
                      <Percent className="w-3 h-3 text-[#ffd4a3]" />İskonto
                    </span>
                    <span className="text-xs font-black text-[#ffd4a3]">{discountScore.toFixed(0)}</span>
                  </div>
                  <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#ffd4a3] to-[#ffc78f] transition-all duration-1000"
                      style={{ width: `${discountScore}%` }}
                    />
                  </div>
                </div>
                {/* Ciro hedefi */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-400 font-semibold flex items-center gap-1">
                      <Target className="w-3 h-3 text-[#9dd9ea]" />Hedef
                    </span>
                    <span className="text-xs font-black text-[#9dd9ea]">{revenuePercentage.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#9dd9ea] to-[#7ec8dd] transition-all duration-1000"
                      style={{ width: `${Math.min(revenuePercentage, 100)}%` }}
                    />
                  </div>
                </div>
                {/* Satış hacmi */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-400 font-semibold flex items-center gap-1">
                      <ShoppingBag className="w-3 h-3 text-violet-400" />Satış
                    </span>
                    <span className="text-xs font-black text-violet-400">{monthlyStats.salesCount}</span>
                  </div>
                  <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-400 transition-all duration-1000"
                      style={{ width: `${Math.min((monthlyStats.salesCount / 200) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Aylık Özet ── */}
      <div className="px-5 pb-4 relative z-10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-gradient-to-b from-violet-400 to-cyan-400 inline-block" />
            Aylık Özet
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {/* Toplam Satış */}
          <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.07] backdrop-blur-xl p-4">
            <div className="absolute inset-0 bg-gradient-to-br from-[#9dd9ea]/8 to-transparent pointer-events-none" />
            <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-[#9dd9ea]/30 to-transparent" />
            <TrendingUp className="w-5 h-5 text-[#9dd9ea] mb-3" />
            <div className="text-2xl font-black text-white mb-0.5">{monthlyStats.salesCount}</div>
            <div className="text-[11px] text-gray-400 font-semibold">Toplam Satış</div>
          </div>
          {/* Ortalama İskonto */}
          <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.07] backdrop-blur-xl p-4">
            <div className="absolute inset-0 bg-gradient-to-br from-[#ffd4a3]/8 to-transparent pointer-events-none" />
            <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-[#ffd4a3]/30 to-transparent" />
            <Percent className="w-5 h-5 text-[#ffd4a3] mb-3" />
            <div className="text-2xl font-black text-white mb-0.5">%{monthlyStats.averageDiscount.toFixed(1)}</div>
            <div className="text-[11px] text-gray-400 font-semibold">Ort. İskonto</div>
          </div>
          {/* Aylık Ciro */}
          <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.07] backdrop-blur-xl p-4">
            <div className="absolute inset-0 bg-gradient-to-br from-[#a8e6cf]/8 to-transparent pointer-events-none" />
            <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-[#a8e6cf]/30 to-transparent" />
            <DollarSign className="w-5 h-5 text-[#a8e6cf] mb-3" />
            <div className="text-2xl font-black text-white mb-0.5">₺{(monthlyStats.actualRevenue / 1000).toFixed(0)}k</div>
            <div className="text-[11px] text-gray-400 font-semibold">Aylık Ciro</div>
          </div>
          {/* Hedef Gerçekleşme */}
          <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.07] backdrop-blur-xl p-4">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/8 to-transparent pointer-events-none" />
            <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-violet-400/30 to-transparent" />
            <Target className="w-5 h-5 text-violet-400 mb-3" />
            <div className="text-2xl font-black text-white mb-0.5">%{revenuePercentage.toFixed(0)}</div>
            <div className="text-[11px] text-gray-400 font-semibold">Hedef Ger.</div>
          </div>
        </div>
      </div>

      {/* ── Döviz Widget ── */}
      <div className="px-5 pb-4 relative z-10">
        <CurrencyWidget />
      </div>

      {/* ── Performans İpucu ── */}
      <div className="px-5 pb-4 relative z-10">
        <div className="relative overflow-hidden rounded-2xl border border-[#ffd4a3]/20 bg-[#ffd4a3]/6 backdrop-blur-xl p-4">
          <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-[#ffd4a3]/30 to-transparent" />
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#ffd4a3]/15 border border-[#ffd4a3]/25 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-base">💡</span>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-white mb-1">Performans İpucu</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                {performanceScore >= 85
                  ? 'Harika gidiyorsun! Bu performansı sürdürürsen bu ayın yıldız personeli olabilirsin! 🌟'
                  : monthlyStats.averageDiscount > 10
                  ? 'İskonto oranını %10\'un altına çekersen performans puanın artacak. Müşterileri ikna etmeye çalış! 💪'
                  : monthlyStats.salesCount < 150
                  ? 'Satış sayını artırırsan daha yüksek performans puanı alabilirsin. 15\'li albüm satışlarına odaklan! 📸'
                  : 'Harika performans! İskonto oranın dengeli. Böyle devam! 🚀'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Hızlı Erişim ── */}
      <div className="px-5 pb-6 relative z-10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-gradient-to-b from-violet-400 to-cyan-400 inline-block" />
            Hızlı Erişim
          </h3>
        </div>
        <div className="space-y-2">
          <button
            onClick={() => onNavigate('quick-sales')}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl hover:bg-white/[0.10] active:scale-[0.98] transition-all text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-[#9dd9ea]/15 border border-[#9dd9ea]/25 flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-[#9dd9ea]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white">Hızlı Satış</div>
              <div className="text-xs text-gray-400">Yeni satış oluştur</div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
          </button>
          <button
            onClick={() => onNavigate('leaderboard')}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl hover:bg-white/[0.10] active:scale-[0.98] transition-all text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-[#ffd4a3]/15 border border-[#ffd4a3]/25 flex items-center justify-center flex-shrink-0">
              <Star className="w-4 h-4 text-[#ffd4a3]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white">Liderlik Tablosu</div>
              <div className="text-xs text-gray-400">Sıralamanı gör</div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
          </button>
          <button
            onClick={() => onNavigate('personel-prim-takip')}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl border active:scale-[0.98] transition-all text-left"
            style={{
              background: 'rgba(251,191,36,0.07)',
              border: '1px solid rgba(251,191,36,0.2)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.25)' }}>
              <Trophy className="w-4 h-4" style={{ color: '#fbbf24' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white">Primlerim</div>
              <div className="text-xs" style={{ color: 'rgba(251,191,36,0.6)' }}>Kazançlarını ve alacaklarını gör</div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}