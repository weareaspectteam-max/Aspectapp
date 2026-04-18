import { useState, useCallback } from 'react';

// DM popup'lar için dynamic key format: `dm:<userId>:<userName>`
// WindowKey union'a ek olarak string de kabul eder — dynamic DM key desteği
export type WindowKey = string & {} |
  // Sol: Yönetici Hızlı Erişim
  | 'live-feed' | 'personel-izin-cetveli' | 'prim-takip' | 'vardiya-raporlari'
  | 'isletme-genel-durum' | 'hedef-takip' | 'kasa' | 'tedarikci-yonetimi'
  // Sağ: Genel
  | 'dashboard-win' | 'messaging' | 'leaderboard' | 'aspect-ai' | 'academy'
  // Sağ: Operasyon
  | 'quick-sales' | 'rotation' | 'announcements'
  // Sağ: Malzeme
  | 'equipment-page' | 'stock-distribution'
  // Sağ: Personel
  | 'personel-prim-takip' | 'kisisel-izin-cetveli'
  // Sağ: Oyun
  | 'aspect-runner' | 'aspect-quest' | 'xox-game' | 'foto-tkm'
  // Sağ: Hesap
  | 'profile' | 'settings';

export interface WindowInfo {
  key: WindowKey;
  title: string;
  defaultWidth: number;
  defaultHeight: number;
}

export const WINDOW_REGISTRY: Record<string, WindowInfo> = {
  'live-feed':            { key: 'live-feed',            title: '📡 Canlı Feed',            defaultWidth: 420, defaultHeight: 600 },
  'personel-izin-cetveli':{ key: 'personel-izin-cetveli',title: '📋 İzin Çizelgesi',        defaultWidth: 780, defaultHeight: 560 },
  'prim-takip':           { key: 'prim-takip',           title: '📈 Hakediş Takip',         defaultWidth: 720, defaultHeight: 600 },
  'vardiya-raporlari':    { key: 'vardiya-raporlari',    title: '📊 Vardiya Raporları',     defaultWidth: 900, defaultHeight: 640 },
  'isletme-genel-durum':  { key: 'isletme-genel-durum',  title: '📊 İşletme Genel Durum',   defaultWidth: 900, defaultHeight: 640 },
  'isletme-istatistikleri':{ key: 'isletme-istatistikleri' as any, title: '📊 İşletme İstatistikleri', defaultWidth: 900, defaultHeight: 640 },
  'hedef-takip':          { key: 'hedef-takip',          title: '🎯 Hedef Takibi',          defaultWidth: 680, defaultHeight: 520 },
  'kasa':                 { key: 'kasa',                 title: '💰 Kasa',                  defaultWidth: 880, defaultHeight: 640 },
  'tedarikci-yonetimi':   { key: 'tedarikci-yonetimi',   title: '📦 Tedarikçi Yönetimi',    defaultWidth: 960, defaultHeight: 640 },
  'dashboard-win':        { key: 'dashboard-win',        title: '🏠 Dashboard',             defaultWidth: 900, defaultHeight: 640 },
  'messaging':            { key: 'messaging',            title: '💬 Mesajlar',              defaultWidth: 640, defaultHeight: 640 },
  'leaderboard':          { key: 'leaderboard',          title: '🏆 Liderlik Tablosu',      defaultWidth: 680, defaultHeight: 600 },
  'aspect-ai':            { key: 'aspect-ai',            title: '✨ Aspect AI',             defaultWidth: 640, defaultHeight: 640 },
  'academy':              { key: 'academy',              title: '🎓 Akademi',               defaultWidth: 720, defaultHeight: 600 },
  'quick-sales':          { key: 'quick-sales',          title: '⚡ Operasyon Paneli',      defaultWidth: 820, defaultHeight: 640 },
  'rotation':             { key: 'rotation',             title: '🔄 Rotasyon',              defaultWidth: 880, defaultHeight: 640 },
  'announcements':        { key: 'announcements',        title: '📢 Duyurular',             defaultWidth: 640, defaultHeight: 520 },
  'equipment-page':       { key: 'equipment-page',       title: '📦 Malzeme Yönetimi',      defaultWidth: 880, defaultHeight: 640 },
  'stock-distribution':   { key: 'stock-distribution',   title: '📊 Stok Dağılımı',         defaultWidth: 820, defaultHeight: 640 },
  'personel-prim-takip':  { key: 'personel-prim-takip',  title: '💼 Hakedişlerim',          defaultWidth: 680, defaultHeight: 600 },
  'kisisel-izin-cetveli': { key: 'kisisel-izin-cetveli', title: '📅 Kişisel İzin Çizelgesi',defaultWidth: 720, defaultHeight: 560 },
  'aspect-runner':        { key: 'aspect-runner',        title: '🏃 Aspect Runner',         defaultWidth: 480, defaultHeight: 640 },
  'aspect-quest':         { key: 'aspect-quest',         title: '🗺️ Aspect Quest',          defaultWidth: 480, defaultHeight: 640 },
  'xox-game':             { key: 'xox-game',             title: '📷 Fotoğraf XOX',          defaultWidth: 480, defaultHeight: 560 },
  'foto-tkm':             { key: 'foto-tkm',             title: '💰 Foto TKM',              defaultWidth: 520, defaultHeight: 600 },
  'profile':              { key: 'profile',              title: '👤 Profil',                defaultWidth: 560, defaultHeight: 520 },
  'settings':             { key: 'settings',             title: '⚙️ Ayarlar',               defaultWidth: 640, defaultHeight: 560 },
};

export interface OpenWindow {
  key: WindowKey;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  title?: string;
}

export function useWindowManager() {
  const [windows, setWindows] = useState<OpenWindow[]>([]);
  const [maxZ, setMaxZ] = useState(100);

  const openWindow = useCallback((key: WindowKey, origin: 'left' | 'right' | 'center' = 'center', dynamicInfo?: Partial<WindowInfo>) => {
    setWindows(prev => {
      const existing = prev.find(w => w.key === key);
      if (existing) {
        // Varsa en üste getir (focus)
        setMaxZ(z => z + 1);
        return prev.map(w => w.key === key ? { ...w, z: maxZ + 1 } : w);
      }
      const registryInfo = WINDOW_REGISTRY[key as string];
      const info: WindowInfo = registryInfo || {
        key,
        title: dynamicInfo?.title || String(key),
        defaultWidth: dynamicInfo?.defaultWidth || 380,
        defaultHeight: dynamicInfo?.defaultHeight || 520,
      };
      const defaultX =
        origin === 'left' ? 240 :
        origin === 'right' ? Math.max(40, window.innerWidth - 240 - info.defaultWidth) :
        Math.max(40, (window.innerWidth - info.defaultWidth) / 2);
      const defaultY = Math.max(72, (window.innerHeight - info.defaultHeight) / 2);
      const newZ = maxZ + 1;
      setMaxZ(newZ);
      return [...prev, { key, x: defaultX, y: defaultY, w: info.defaultWidth, h: info.defaultHeight, z: newZ, title: info.title }];
    });
  }, [maxZ]);

  const closeWindow = useCallback((key: WindowKey) => {
    setWindows(prev => prev.filter(w => w.key !== key));
  }, []);

  const focusWindow = useCallback((key: WindowKey) => {
    setMaxZ(z => {
      const newZ = z + 1;
      setWindows(prev => prev.map(w => w.key === key ? { ...w, z: newZ } : w));
      return newZ;
    });
  }, []);

  const moveWindow = useCallback((key: WindowKey, x: number, y: number) => {
    setWindows(prev => prev.map(w => w.key === key ? { ...w, x, y } : w));
  }, []);

  const resizeWindow = useCallback((key: WindowKey, w: number, h: number) => {
    setWindows(prev => prev.map(win => win.key === key ? { ...win, w, h } : win));
  }, []);

  return { windows, openWindow, closeWindow, focusWindow, moveWindow, resizeWindow };
}
