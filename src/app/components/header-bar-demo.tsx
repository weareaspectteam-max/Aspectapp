import { useState } from 'react';
import {
  Bell, BellRing, Menu, Users, Aperture,
  ArrowLeft, Zap, Activity, BarChart2, Sparkles,
  MapPin, TrendingUp, Clock, ChevronRight, X,
  MessageSquare, Home, Shield, Camera,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

/* ─── SABITLER ─── */
const PAGE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard', 'quick-sales': 'Operasyon',
  'live-feed': 'Canlı Feed', 'aspect-ai': 'Aspect AI',
  messaging: 'Mesajlar', rotasyon: 'Rotasyon',
};

const PAGES = [
  { key: 'dashboard',   label: 'Dashboard',  icon: BarChart2, color: '#a78bfa' },
  { key: 'quick-sales', label: 'Operasyon',  icon: Zap,       color: '#fb923c' },
  { key: 'live-feed',   label: 'Canlı Feed', icon: Activity,  color: '#34d399' },
  { key: 'aspect-ai',   label: 'Aspect AI',  icon: Sparkles,  color: '#f472b6' },
];

const ROLE_COLORS: Record<string, string> = {
  Yönetici: '#a855f7', Operatör: '#fb923c', Fotoğrafçı: '#34d399',
};

/* ═══════════════════════════════════════
   PILL BOTTOM NAV
═══════════════════════════════════════ */
function PillBottomNav({ activeTab, onTabChange }: {
  activeTab: string; onTabChange: (k: string) => void;
}) {
  const tabs = [
    { key: 'dashboard', icon: Home,          color: '#a78bfa' },
    { key: 'live-feed', icon: Activity,      color: '#34d399' },
    { key: 'aspect-ai', icon: Sparkles,      color: '#f472b6' },
    { key: 'messaging', icon: MessageSquare, color: '#60a5fa', badge: true },
    { key: 'rotasyon',  icon: Users,         color: '#fb923c' },
  ];
  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 flex justify-center pb-2">
      <div className="flex items-center rounded-full border border-white/15 px-2 py-1 gap-0.5"
        style={{ background: 'rgba(10,5,30,0.92)', backdropFilter: 'blur(32px)', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => onTabChange(tab.key)}
              className="relative flex items-center justify-center transition-all active:scale-90">
              {isActive ? (
                <motion.div layoutId="pill-nav-active"
                  className="w-7 h-7 flex items-center justify-center rounded-full"
                  style={{ background: tab.color + '22', border: `1px solid ${tab.color}45`, boxShadow: `0 0 10px ${tab.color}40` }}
                  transition={{ type: 'spring', damping: 22, stiffness: 280 }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: tab.color }} strokeWidth={2.2} />
                  {tab.badge && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-rose-500 border border-[#0a051e]" />}
                </motion.div>
              ) : (
                <div className="relative w-7 h-7 flex items-center justify-center rounded-full">
                  <Icon className="w-3.5 h-3.5 text-gray-600" strokeWidth={1.8} />
                  {tab.badge && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-rose-500 border border-[#0a051e]" />}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   YAN PANEL
═══════════════════════════════════════ */
function SideMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="absolute inset-0 z-30 rounded-3xl"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            className="absolute top-0 right-0 bottom-0 z-40 w-52 rounded-r-3xl flex flex-col overflow-hidden border-l border-white/10"
            style={{ background: 'linear-gradient(160deg,#1e0a3c,#2d1b69 60%,#1a1040)' }}>
            <div className="px-4 pt-5 pb-4 border-b border-white/10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black text-violet-400 tracking-widest uppercase">Aspect Ops</span>
                <button onClick={onClose} className="w-7 h-7 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
                  <X className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
              <div className="flex items-center gap-3 bg-white/8 border border-white/12 rounded-2xl p-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-400 to-fuchsia-500 flex items-center justify-center text-xl flex-shrink-0">👨‍💼</div>
                <div>
                  <p className="text-white font-black text-sm">Ahmet Yılmaz</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[10px] text-emerald-400 font-semibold">Yönetici</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              {['🏠 Dashboard','⚡ Operasyon','📍 İşletme Paneli','🏆 Liderlik','📷 Kare Takibi','🎓 Akademi','⚙️ Ayarlar'].map(item => (
                <button key={item} onClick={onClose}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/6 transition-all active:scale-95">
                  <span className="text-sm">{item.split(' ')[0]}</span>
                  <span className="text-[11px] font-bold text-slate-200 flex-1 text-left">{item.split(' ').slice(1).join(' ')}</span>
                  <ChevronRight className="w-3 h-3 text-gray-600" />
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════
   TELEFON İÇERİĞİ
═══════════════════════════════════════ */
function PhoneContent({ activePage, activeTab, onTabChange, setActivePage, menuOpen, setMenuOpen, hasNotification }: {
  activePage: string; activeTab: string; onTabChange: (k: string) => void;
  setActivePage: (p: string) => void; menuOpen: boolean;
  setMenuOpen: (v: boolean) => void; hasNotification: boolean;
}) {
  const page = PAGES.find(p => p.key === activePage) ?? PAGES[0];
  const PageIcon = page.icon;
  const isDash = activePage === 'dashboard';

  return (
    <div className="relative h-full">
      <div className="absolute inset-0 overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#1e0a3c 0%,#2d1b69 40%,#0f2027 100%)' }}>
        <div className="absolute top-10 left-5 w-24 h-24 rounded-full blur-2xl opacity-20"
          style={{ background: 'radial-gradient(circle,#7c3aed,transparent)' }} />
        <div className="absolute bottom-20 right-5 w-20 h-20 rounded-full blur-2xl opacity-15"
          style={{ background: 'radial-gradient(circle,#db2777,transparent)' }} />

        {/* HEADER — 3 sütun grid */}
        <div className="absolute top-0 left-0 right-0 z-10 px-2.5 pt-2 pb-1.5"
          style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)', alignItems: 'center', gap: 4 }}>

          {/* SOL pill */}
          <div className="flex items-center overflow-hidden">
            <VarA
              isSubPage={!isDash}
              onBack={() => setActivePage('dashboard')}
              subLabel={PAGE_LABELS[activePage]}
              subColor={page.color}
            />
          </div>

          {/* ORTA */}
          <div className="flex flex-col items-center">
            <span className="font-black leading-none" style={{
              fontSize: 11, letterSpacing: '0.15em',
              background: 'linear-gradient(90deg,#c084fc,#e879f9,#818cf8)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>ASPECT</span>
            <AnimatePresence mode="wait">
              <motion.span key={activePage}
                initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.15 }}
                className="text-[6px] font-semibold"
                style={{ color: isDash ? 'rgba(196,181,253,0.5)' : page.color + '99' }}>
                {PAGE_LABELS[activePage]}
              </motion.span>
            </AnimatePresence>
          </div>

          {/* SAĞ */}
          <div className="flex items-center justify-end gap-1">
            <button className="relative w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90"
              style={{ background: 'rgba(10,5,30,0.92)', border: hasNotification ? '1px solid rgba(251,146,60,0.5)' : '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(32px)' }}>
              {hasNotification ? <BellRing className="w-3.5 h-3.5" style={{ color: '#fb923c' }} /> : <Bell className="w-3.5 h-3.5 text-gray-600" />}
              {hasNotification && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-orange-400 border border-[#0a051e]" />}
            </button>
            <button onClick={() => setMenuOpen(true)}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90"
              style={{ background: 'rgba(10,5,30,0.92)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(32px)' }}>
              <Menu className="w-3.5 h-3.5 text-white/55" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* İÇERİK */}
        <div className="absolute inset-0 top-12 bottom-12 px-3 pb-2 overflow-hidden space-y-2.5">
          <AnimatePresence mode="wait">
            <motion.div key={activePage}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-2xl flex items-center justify-center"
                style={{ background: page.color + '20', border: `1px solid ${page.color}30` }}>
                <PageIcon className="w-4 h-4" style={{ color: page.color }} />
              </div>
              <div>
                <h2 className="text-white font-black text-base leading-tight">{page.label}</h2>
                <p className="text-gray-500 text-[9px]">11 Mart 2026 · Sultanahmet</p>
              </div>
            </motion.div>
          </AnimatePresence>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: 'Satış',  value: '₺4.280', icon: TrendingUp, color: '#34d399' },
              { label: 'Kare',   value: '127',     icon: Camera,    color: '#60a5fa' },
              { label: 'Süre',   value: '3s 42dk', icon: Clock,     color: '#f472b6' },
              { label: 'Ekip',   value: '6 kişi',  icon: Users,     color: '#fb923c' },
            ].map(m => {
              const MIcon = m.icon;
              return (
                <div key={m.label} className="rounded-xl p-2.5 border border-white/8" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[8px] text-gray-500 font-semibold">{m.label}</span>
                    <MIcon className="w-3 h-3" style={{ color: m.color }} />
                  </div>
                  <p className="text-white font-black text-sm">{m.value}</p>
                </div>
              );
            })}
          </div>
          <div className="space-y-1">
            {[
              { name: 'Elif K.', action: 'Satış kaydetti', time: '2dk', color: '#34d399' },
              { name: 'Mehmet A.', action: '3x Albüm · ₺180', time: '5dk', color: '#a78bfa' },
            ].map(f => (
              <div key={f.name} className="flex items-center gap-2 rounded-xl px-2.5 py-2 border border-white/6"
                style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: f.color }} />
                <span className="text-white text-[9px] font-black">{f.name}</span>
                <span className="text-gray-500 text-[9px]">· {f.action}</span>
                <span className="text-[8px] text-gray-600 ml-auto flex-shrink-0">{f.time}</span>
              </div>
            ))}
          </div>
        </div>

        <SideMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      </div>
      <PillBottomNav activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SOL PİLL ALTERNATİFLERİ — 4 yeni konsept
═══════════════════════════════════════════════════════ */

/**
 * Her varyant için iki satır (dashboard + subpage) gösteren
 * mini header — 3-sütun grid, hiç çakışma yok.
 */
function MiniBar({
  left,
  centerLabel,
  centerSub,
  centerSubColor,
  isSubPage = false,
}: {
  left: React.ReactNode;
  centerLabel?: string;
  centerSub?: string;
  centerSubColor?: string;
  isSubPage?: boolean;
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)',
      alignItems: 'center',
      gap: 4,
      height: 42,
      padding: '0 10px',
      borderRadius: 14,
      background: 'linear-gradient(135deg,#1a0936,#26176b)',
      border: '1px solid rgba(255,255,255,0.07)',
    }}>
      {/* SOL */}
      <div className="flex items-center overflow-hidden">{left}</div>

      {/* ORTA */}
      <div className="flex flex-col items-center gap-px">
        {centerLabel ? (
          <>
            <span className="font-black" style={{
              fontSize: 8.5, letterSpacing: '0.16em',
              background: 'linear-gradient(90deg,#c084fc,#e879f9,#818cf8)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>{centerLabel}</span>
            {centerSub && (
              <span className="text-[6px] font-semibold whitespace-nowrap"
                style={{ color: centerSubColor ?? 'rgba(196,181,253,0.45)' }}>{centerSub}</span>
            )}
          </>
        ) : (
          <span className="text-[7px] italic" style={{ color: 'rgba(255,255,255,0.15)' }}>–</span>
        )}
      </div>

      {/* SAĞ */}
      <div className="flex items-center justify-end gap-1">
        <div className="w-5 h-5 rounded-full flex items-center justify-center border flex-shrink-0"
          style={isSubPage
            ? { background: 'rgba(251,146,60,0.15)', borderColor: 'rgba(251,146,60,0.35)' }
            : { background: 'rgba(10,5,30,0.8)', borderColor: 'rgba(255,255,255,0.12)' }}>
          {isSubPage
            ? <BellRing className="w-2.5 h-2.5" style={{ color: '#fb923c' }} />
            : <Bell className="w-2.5 h-2.5" style={{ color: '#4b5563' }} />}
        </div>
        <div className="w-5 h-5 rounded-full border border-white/10 flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(10,5,30,0.8)' }}>
          <Menu className="w-2.5 h-2.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
        </div>
      </div>
    </div>
  );
}

/* ── VARYANT A ─────────────────────────────────────
   Renkli Rol Rozeti
   Ana ekranda kalkan ikonu · alt sayfada aynı daire
   ← okuna dönüşür, tıklanabilir geri butonu olur.
────────────────────────────────────────────────── */
function VarA({ isSubPage, onBack, subLabel, subColor }: {
  isSubPage?: boolean;
  onBack?: () => void;
  subLabel?: string;
  subColor?: string;
}) {
  const c = isSubPage ? (subColor ?? '#fb923c') : '#a855f7';
  return (
    <div className="flex items-center gap-1.5 rounded-full pl-1 pr-2 py-1 flex-shrink-0"
      style={{
        background: 'rgba(10,5,30,0.9)',
        border: `1px solid ${c}40`,
        backdropFilter: 'blur(24px)',
        boxShadow: `0 0 12px ${c}25`,
      }}>
      {/* İkon dairesi — sub-page'de ← olur */}
      <button
        onClick={isSubPage ? onBack : undefined}
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-90"
        style={{
          background: `${c}20`,
          border: `1.5px solid ${c}55`,
          boxShadow: isSubPage ? `0 0 8px ${c}50` : 'none',
          cursor: isSubPage ? 'pointer' : 'default',
        }}>
        {isSubPage
          ? <ArrowLeft className="w-3 h-3" style={{ color: c }} strokeWidth={2.5} />
          : <Shield className="w-3 h-3" style={{ color: c }} strokeWidth={2.5} />
        }
      </button>
      <div className="flex flex-col leading-none">
        <span className="text-white font-black text-[8px]">Ahmet Y.</span>
        <span className="text-[6.5px] font-bold" style={{ color: c }}>
          {isSubPage ? (subLabel ?? 'Operasyon') : 'Yönetici'}
        </span>
      </div>
    </div>
  );
}

/* ── VARYANT B ─────────────────────────────────────
   Vardiya Nabzı
   Yeşil nabız + "AKTİF" + saat. Tamamen operasyonel.
   Sayfa adı yok — kim olduğu değil, ne yaptığı.
────────────────────────────────────────────────── */
function VarB({ isSubPage }: { isSubPage?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 flex-shrink-0"
      style={{
        background: 'rgba(5,46,22,0.7)',
        border: '1px solid rgba(52,211,153,0.3)',
        backdropFilter: 'blur(24px)',
        boxShadow: '0 0 14px rgba(52,211,153,0.15)',
      }}>
      <div className="relative flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-emerald-400" />
        <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-[6.5px] font-black tracking-widest" style={{ color: '#34d399' }}>AKTİF VARDİYA</span>
        <span className="text-white font-black text-[8px]">
          {isSubPage ? '5s 17dk geçti' : '09:00 – 18:00'}
        </span>
      </div>
    </div>
  );
}

/* ── VARYANT C ─────────────────────────────────────
   Mekan Etiketi
   Konum ikonu + mekan adı + fotoğrafçı sayısı.
   Turizm bağlamı için çok özgün.
────────────────────────────────────────────────── */
function VarC({ isSubPage }: { isSubPage?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-1 flex-shrink-0"
      style={{
        background: 'rgba(10,5,30,0.9)',
        border: '1px solid rgba(96,165,250,0.3)',
        backdropFilter: 'blur(24px)',
        boxShadow: '0 0 12px rgba(96,165,250,0.12)',
      }}>
      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)' }}>
        <MapPin className="w-2.5 h-2.5" style={{ color: '#60a5fa' }} strokeWidth={2.5} />
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-white font-black text-[8px] whitespace-nowrap">Sultanahmet</span>
        <span className="text-[6.5px] font-semibold" style={{ color: 'rgba(96,165,250,0.7)' }}>
          {isSubPage ? 'Operasyon · A1' : '6 fotoğrafçı aktif'}
        </span>
      </div>
    </div>
  );
}

/* ── VARYANT D ─────────────────────────────────────
   Split İkili — iki ayrı mini pill
   Sol: sadece avatar + online dot.
   Sağ: sayfa adı dinamik renk chip.
   Dashboard'da sağ chip yok, salt avatar görünür.
────────────────────────────────────────────────── */
function VarD({ isSubPage }: { isSubPage?: boolean }) {
  const pageColor = '#fb923c';
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <div className="relative flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0"
        style={{ background: 'rgba(10,5,30,0.9)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(24px)' }}>
        <span className="text-[12px] leading-none">👨‍💼</span>
        <div className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 border border-[#0a051e]" />
      </div>
      {isSubPage && (
        <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-1 rounded-full px-2 py-1 flex-shrink-0"
          style={{
            background: pageColor + '18',
            border: `1px solid ${pageColor}45`,
            boxShadow: `0 0 10px ${pageColor}20`,
          }}>
          <Zap className="w-2.5 h-2.5 flex-shrink-0" style={{ color: pageColor }} />
          <span className="text-[8px] font-black whitespace-nowrap" style={{ color: pageColor }}>Operasyon</span>
        </motion.div>
      )}
    </div>
  );
}

/* ── ALTERNATIFLERIN ANA BİLEŞENİ ──────────────── */
const ALT_META = [
  {
    key: 'A',
    emoji: '🛡️',
    title: 'Rol Rozeti',
    desc: 'Kullanıcı adı + rol — border rengi ve glow sayfayla değişiyor.',
  },
  {
    key: 'B',
    emoji: '🟢',
    title: 'Vardiya Nabzı',
    desc: 'Yeşil ping animasyonu + aktif vardiya saati. Kim değil, ne yaptığı.',
  },
  {
    key: 'C',
    emoji: '📍',
    title: 'Mekan Etiketi',
    desc: 'Konum + kaç fotoğrafçı aktif. Turizm bağlamına özgü.',
  },
  {
    key: 'D',
    emoji: '✦',
    title: 'Split İkili',
    desc: 'Avatar pill sabit, sayfa chip\'i sadece alt sayfada belirir.',
  },
] as const;

function LeftPillAlternatives() {
  const [activeKey, setActiveKey] = useState<'A' | 'B' | 'C' | 'D'>('A');

  const renderLeft = (key: 'A' | 'B' | 'C' | 'D', sub: boolean) => {
    if (key === 'A') return <VarA isSubPage={sub} />;
    if (key === 'B') return <VarB isSubPage={sub} />;
    if (key === 'C') return <VarC isSubPage={sub} />;
    return <VarD isSubPage={sub} />;
  };

  return (
    <div className="w-full max-w-[300px] mt-10">
      {/* Başlık */}
      <div className="flex items-center gap-2 mb-5">
        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
        <span className="text-[8px] font-black text-violet-400 tracking-widest uppercase">4 Yeni Konsept</span>
        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
      </div>

      {/* Seçici — büyük butonlar */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        {ALT_META.map(a => (
          <button key={a.key} onClick={() => setActiveKey(a.key)}
            className="flex flex-col items-start gap-1 p-3 rounded-2xl border text-left transition-all active:scale-95"
            style={activeKey === a.key
              ? { background: 'rgba(168,85,247,0.15)', borderColor: 'rgba(168,85,247,0.45)', boxShadow: '0 0 16px rgba(168,85,247,0.15)' }
              : { background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }
            }>
            <div className="flex items-center gap-1.5">
              <span className="text-base leading-none">{a.emoji}</span>
              <span className="text-[9px] font-black" style={{ color: activeKey === a.key ? '#c084fc' : '#6b7280' }}>
                {a.key}
              </span>
            </div>
            <p className="text-[9px] font-black" style={{ color: activeKey === a.key ? '#e2e8f0' : '#4b5563' }}>{a.title}</p>
          </button>
        ))}
      </div>

      {/* Açıklama */}
      <AnimatePresence mode="wait">
        <motion.div key={activeKey}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.14 }}
          className="space-y-4">

          {/* Açıklama metni */}
          <p className="text-[9px] leading-relaxed px-1" style={{ color: 'rgba(156,163,175,0.8)' }}>
            <span className="text-white font-black">{ALT_META.find(a => a.key === activeKey)!.title}: </span>
            {ALT_META.find(a => a.key === activeKey)!.desc}
          </p>

          {/* Dashboard önizleme */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[7.5px] font-black text-emerald-400 tracking-widest uppercase">Ana ekran</span>
            </div>
            <MiniBar
              left={renderLeft(activeKey, false)}
              centerLabel="ASPECT"
              centerSub="Dashboard"
              centerSubColor="rgba(196,181,253,0.5)"
            />
          </div>

          {/* Sub-page önizleme */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
              <span className="text-[7.5px] font-black text-orange-400 tracking-widest uppercase">Alt sayfa — Operasyon</span>
            </div>
            <MiniBar
              left={renderLeft(activeKey, true)}
              centerLabel="ASPECT"
              centerSub="Operasyon"
              centerSubColor="rgba(251,146,60,0.6)"
              isSubPage
            />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════
   ANA SAYFA
═══════════════════════════════════════ */
export default function HeaderBarDemo() {
  const [activePage, setActivePage] = useState('dashboard');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [hasNotification, setHasNotification] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen"
      style={{ background: 'linear-gradient(145deg,#0f0825 0%,#1a0f3a 30%,#0a1628 60%,#0d2318 100%)' }}>
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full blur-3xl opacity-10"
          style={{ background: 'radial-gradient(circle,#7c3aed,transparent)' }} />
        <div className="absolute bottom-40 right-10 w-48 h-48 rounded-full blur-3xl opacity-8"
          style={{ background: 'radial-gradient(circle,#db2777,transparent)' }} />
      </div>

      <div className="relative flex flex-col items-center px-4 pt-6 pb-14">

        {/* Başlık */}
        <div className="w-full max-w-[280px] mb-5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="text-[9px] font-black text-violet-400 tracking-widest uppercase">Header Konsept</span>
          </div>
          <h1 className="text-white font-black text-lg leading-tight">
            Floating{' '}
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">pill nav</span>
          </h1>
          <p className="text-gray-600 text-[10px] mt-0.5">3-sütun grid · sıfır çakışma</p>
        </div>

        {/* Kontroller */}
        <div className="w-full max-w-[280px] space-y-3 mb-5">
          <div>
            <p className="text-[8px] text-gray-600 font-black uppercase tracking-widest mb-1.5">Sayfa simüle et</p>
            <div className="flex gap-1 flex-wrap">
              {PAGES.map(p => {
                const Icon = p.icon;
                const isActive = activePage === p.key;
                return (
                  <button key={p.key}
                    onClick={() => { setActivePage(p.key); setActiveTab(p.key); }}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg border text-[8px] font-bold transition-all active:scale-95"
                    style={isActive
                      ? { borderColor: 'rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: '#fff' }
                      : { borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: '#6b7280' }}>
                    <Icon className="w-2.5 h-2.5" style={{ color: isActive ? p.color : undefined }} />
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-[8px] text-gray-600 font-black uppercase tracking-widest mb-1.5">Zil durumu</p>
            <button
              onClick={() => setHasNotification(v => !v)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border text-[9px] font-bold transition-all active:scale-95"
              style={hasNotification
                ? { background: 'rgba(251,146,60,0.1)', borderColor: 'rgba(251,146,60,0.4)', color: '#fb923c' }
                : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', color: '#6b7280' }}>
              {hasNotification ? <BellRing className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
              {hasNotification ? 'Bildirim Var' : 'Bildirim Yok'}
            </button>
          </div>
        </div>

        {/* Telefon */}
        <div className="w-[240px] rounded-[28px] overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }}>
          <div style={{ background: '#1e0a3c' }} className="flex items-center justify-center py-1.5">
            <div className="w-14 h-1 rounded-full bg-white/10" />
          </div>
          <div style={{ height: 440 }}>
            <PhoneContent
              activePage={activePage} activeTab={activeTab}
              onTabChange={k => { setActiveTab(k); setActivePage(k); }}
              setActivePage={setActivePage}
              menuOpen={menuOpen} setMenuOpen={setMenuOpen}
              hasNotification={hasNotification}
            />
          </div>
          <div style={{ background: '#1e0a3c' }} className="flex items-center justify-center py-1.5">
            <div className="w-20 h-1 rounded-full bg-white/20" />
          </div>
        </div>

        {/* 4 yeni pill konsepti */}
        <LeftPillAlternatives />

      </div>
    </div>
  );
}