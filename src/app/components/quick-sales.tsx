// quick-sales v2 — global iade, per-printer kaldirildi
import { useState, useEffect, useMemo, useRef } from 'react';
import { Send, Clock, ShoppingCart, X, Plus, Trash2, Tag, XCircle, CheckCircle, ArrowLeft, AlertCircle, Camera, ChevronRight, UserPlus, Package, Printer, Grid3x3, Film, AlertTriangle, TrendingDown, TrendingUp, Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ProjectSelector } from './project-selector';
import { LiveFeedSheet } from './live-feed-sheet';

import { NewBottomNav } from './new-bottom-nav';
import { getTasks, getStaffMembers, type StaffMember } from '../services/rotation-service';
import {
  getGunlukStok, postAcilis, postKapanis,
  bosStok, bugunTarih,
  stokAlanAdi, stokAlanEmoji,
  type StokSayim, type StokGunluk, type StokEkleme, type PrinterKapanis, type VardiyaSatis, type KareKayit,
} from '../services/stock-service';
import { buildHeaders, authHeaders, getToken, appendGhostParam } from '../lib/api';
import { projectId } from '../lib/supabase-info';
import { bizDateStr } from '../lib/date';
import {
  enqueue as offlineEnqueue,
  dequeue as offlineDequeue,
  getUserQueue,
  generateQueueId,
  type QueuedSale,
  enqueueFrame as offlineEnqueueFrame,
  dequeueFrame as offlineDequeueFrame,
  getUserFrameQueue,
  generateFrameQueueId,
  type QueuedFrame,
} from '../lib/offline-queue';

const API_BASE_QS = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

const STALE_MS = 24 * 60 * 60 * 1000; // 24 saat (ms)

const formatDelay = (ms: number): string => {
  const hours = Math.floor(ms / 3600000);
  if (hours < 24) return `${hours} saat`;
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  return rem > 0 ? `${days} gün ${rem} saat` : `${days} gün`;
};

const formatTs = (ms: number): string => {
  const d = new Date(ms);
  return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const payLabel = (pm: string) =>
  pm === 'cash' ? 'Nakit' : pm === 'iban' ? 'IBAN' : pm === 'card' ? 'Kart' : pm;

interface Project {
  id: string;
  name: string;
  location: string;
  shift: string;
  color: string;
  icon: string;
}

// Sale artık VardiyaSatis — display helper olarak kullanılır
// _pending: true ise localStorage'da bekliyor, henüz sunucuya gönderilmedi
type Sale = VardiyaSatis & { project?: string; _pending?: boolean; _queueId?: string };

interface CartItem {
  product: string;
  quantity: number;
  color: string;
  unitPrice: number;
  dijital?: boolean;
}

interface QuickSalesProps {
  userName: string;
  userRole: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  accessToken: string;
  userId?: string;
  onProjectSelect?: (projectName: string) => void;
  preSelectedProject?: string;
  onBack?: () => void;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
  onEkstraIsSelect?: (task: import('../services/rotation-service').Task) => void;
  onOzelIsSelect?: (task: import('../services/rotation-service').Task) => void;
}

const FRAME_STORAGE_KEY = 'aspect_frame_tracking';

const albumItemsLegacy = [
  { key: 'album3', label: '3 Kare', emoji: '📘' },
  { key: 'album5', label: '5 Kare', emoji: '📗' },
  { key: 'album7', label: '7 Kare', emoji: '📙' },
  { key: 'album9', label: '9 Kare', emoji: '📕' },
  { key: 'album11', label: '11 Kare', emoji: '📔' },
  { key: 'album13', label: '13 Kare', emoji: '📒' },
  { key: 'album15', label: '15 Kare', emoji: '📓' },
];
const albumItemsNew = [
  { key: 'album3_tam', label: '3 Kare Tam', emoji: '📘' },
  { key: 'album3_yarim', label: '3 Kare Yarım', emoji: '📘' },
  { key: 'album5_tam', label: '5 Kare Tam', emoji: '📗' },
  { key: 'album5_yarim', label: '5 Kare Yarım', emoji: '📗' },
  { key: 'album7_tam', label: '7 Kare Tam', emoji: '📙' },
  { key: 'album7_yarim', label: '7 Kare Yarım', emoji: '📙' },
  { key: 'album9_tam', label: '9 Kare Tam', emoji: '📕' },
  { key: 'album9_yarim', label: '9 Kare Yarım', emoji: '📕' },
  { key: 'album11_tam', label: '11 Kare Tam', emoji: '📔' },
  { key: 'album11_yarim', label: '11 Kare Yarım', emoji: '📔' },
  { key: 'album13_tam', label: '13 Kare Tam', emoji: '📒' },
  { key: 'album13_yarim', label: '13 Kare Yarım', emoji: '📒' },
  { key: 'album15_tam', label: '15 Kare Tam', emoji: '📓' },
  { key: 'album15_yarim', label: '15 Kare Yarım', emoji: '📓' },
];
// Hangi format kullanılacağını stok verisine göre belirle
const getAlbumItems = (stok: any, printType?: 'tam' | 'yarim') => {
  if (!stok) return albumItemsLegacy;
  // printType varsa sadece o tipin satırlarını göster
  const suffix = printType === 'tam' ? '_tam' : '_yarim';
  return albumItemsNew.filter(a => a.key.endsWith(suffix));
};
const albumItems = albumItemsLegacy; // fallback for non-stok contexts


export function QuickSales({ userName, userRole, accessToken, userId, onProjectSelect, preSelectedProject, onBack, onLogout, onNavigate, onEkstraIsSelect, onOzelIsSelect }: QuickSalesProps) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(() => {
    if (preSelectedProject) {
      return { id: '1', name: preSelectedProject, location: 'Antalya', shift: 'Gündüz', color: 'from-[#9dd9ea] to-[#7ec8dd]', icon: '🏖️' };
    }
    return null;
  });

  // Sales state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showDiscount, setShowDiscount] = useState(false);
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountMode, setDiscountMode] = useState<'iskonto' | 'fiyat'>('iskonto');
  const [discountRawInput, setDiscountRawInput] = useState('');
  const [showForeignNet, setShowForeignNet] = useState(false);
  const [foreignNetMode, setForeignNetMode] = useState<'iskonto' | 'fiyat'>('fiyat');
  const [foreignNetRawInput, setForeignNetRawInput] = useState('');
  const [showPaymentMethod, setShowPaymentMethod] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'iban' | 'card' | null>(null);
  const [showGerekce, setShowGerekce] = useState(false);
  const [gerekceText, setGerekceText] = useState('');
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [allSalesForKapanis, setAllSalesForKapanis] = useState<Sale[]>([]);
  const [satisSaving, setSatisSaving] = useState(false);
  const [hasCheckedIn, setHasCheckedIn] = useState(true);
  const [checkinWarningDismissed, setCheckinWarningDismissed] = useState(false);
  const [showCheckinWarning, setShowCheckinWarning] = useState(false);
  const [checkinWarningCallback, setCheckinWarningCallback] = useState<(() => void) | null>(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [queueFlushing, setQueueFlushing] = useState(false);
  // Gerçek mekan ID'si — preSelectedProject için '1' placeholder'ı replace edilir
  const [resolvedMekanId, setResolvedMekanId] = useState<string>('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelSaleId, setCancelSaleId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  // Kare silme state
  const [showDeleteKareModal, setShowDeleteKareModal] = useState(false);
  const [deleteKareEntry, setDeleteKareEntry] = useState<any | null>(null);
  const [deleteKareSaving, setDeleteKareSaving] = useState(false);
  const [showShiftEndSuccess, setShowShiftEndSuccess] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<'USD' | 'EUR' | 'GBP' | 'BGN' | 'RUB' | 'SAR' | 'TRY' | null>(null);
  const [exchangeRates, setExchangeRates] = useState({ USD: 34.52, EUR: 37.89, GBP: 43.26, BGN: 19.50, RUB: 0.38, SAR: 8.80 });
  const [mekanPriceCurrency, setMekanPriceCurrency] = useState<string>('TRY');
  const [ratesLoading, setRatesLoading] = useState(false);

  // Mode tabs: shift-start | sales | frames | shift-end
  const [activeMode, setActiveMode] = useState<'shift-start' | 'sales' | 'frames' | 'shift-end'>('shift-start');

  // Canlı feed bottom sheet
  const [showLiveFeed, setShowLiveFeed] = useState(false);

  // Operasyon paneli tam ekran
  const [operasyonFullscreen, setOperasyonFullscreen] = useState(false);

  // Satış yapılınca ProjectSelector kota bar'ını tetiklemek için sayaç
  const [saleRefreshTrigger, setSaleRefreshTrigger] = useState(0);

  // Frame tracking state
  const [framePhotographer, setFramePhotographer] = useState<StaffMember | null>(null);
  const [frameCount, setFrameCount] = useState('');
  const [rotationPersonnel, setRotationPersonnel] = useState<StaffMember[]>([]);
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);
  const [showManualPicker, setShowManualPicker] = useState(false);
  const [manualSearch, setManualSearch] = useState('');
  const [frameShowSuccess, setFrameShowSuccess] = useState(false);
  const [frameSaving, setFrameSaving] = useState(false);
  const [frameEntries, setFrameEntries] = useState<any[]>([]);
  const [musteriSayisi, setMusteriSayisi] = useState('');
  const [musteriSayisiKayitli, setMusteriSayisiKayitli] = useState(false);
  const [musteriSayisiSaving, setMusteriSayisiSaving] = useState(false);
  const [pendingFrameCount, setPendingFrameCount] = useState(0);
  const [frameFlushing, setFrameFlushing] = useState(false);

  // ── SHIFT START state ──
  const [stokGunluk, setStokGunluk] = useState<StokGunluk | null>(null);
  const [dunKapanis, setDunKapanis] = useState<StokSayim | null>(null);

  // Stok verisine göre tam/yarım veya eski format albumItems belirle
  const [acilisSayim, setAcilisSayim] = useState<StokSayim>(bosStok());
  const [acilisNot, setAcilisNot] = useState('');
  const [acilisAnomaliNeden, setAcilisAnomaliNeden] = useState('');
  const [stokYukleniyor, setStokYukleniyor] = useState(false);
  const [stokKaydediliyor, setStokKaydediliyor] = useState(false);
  const [stokEklemeler, setStokEklemeler] = useState<StokEkleme[]>([]);
  const [showAcilisAnomaliUyari, setShowAcilisAnomaliUyari] = useState(false);
  const [showKapanisAnomaliUyari, setShowKapanisAnomaliUyari] = useState(false);
  const [kapanisPhotoHata, setKapanisPhotoHata] = useState(false);
  const [yaziciAcilisAnomali, setYaziciAcilisAnomali] = useState<any[]>([]);
  const [showAcilisSifirlaModal, setShowAcilisSifirlaModal] = useState(false);
  const [acilisSifirlaYukleniyor, setAcilisSifirlaYukleniyor] = useState(false);
  // Ekipman kaydından gelen yazıcılar (mekan bazlı)
  const [mekanYazicilari, setMekanYazicilari] = useState<any[]>([]);
  // Aktif yazıcı listesi (ekipmanId bazlı, otomatik yüklenir)
  const [printers, setPrinters] = useState<Array<{
    ekipmanId: string;
    label: string;
    brand: string;
    model: string;
    serialNumber: string;
    startCounter: string;
    beklenenStartCounter: number | null;
    kagitTipiId?: string | null;
  }>>([]);
  const [printerEndCounters, setPrinterEndCounters] = useState<Record<string, string>>({});
  // ribonMevcut artık ayrı alan değil — endCounter değeri ribonMevcut olarak kullanılır
  const [shiftShelves, setShiftShelves] = useState<Record<string, number>>({
    album3: 0, album5: 0, album7: 0, album9: 0, album11: 0, album13: 0, album15: 0, passepartout: 0
  });
  const [teamPhotoTaken, setTeamPhotoTaken] = useState(false);
  const [teamPhotoPreview, setTeamPhotoPreview] = useState<string | null>(null);
  const [shiftStartDone, setShiftStartDone] = useState(false);

  // ── SHIFT END state ──
  const [kapanisSayim, setKapanisSayim] = useState<StokSayim>(bosStok());
  const [kapanisNot, setKapanisNot] = useState('');
  const [kapanisAnomali, setKapanisAnomali] = useState<Partial<StokSayim>>({});
  const [kapanisBeklenen, setKapanisBeklenen] = useState<StokSayim | null>(null);
  const [kapanisAnomaliNeden, setKapanisAnomaliNeden] = useState('');
  const [kapanisYaziciAnomali, setKapanisYaziciAnomali] = useState<{ netSatilan: number; satisToplam: number; fark: number } | null>(null);
  const [printerRibbonChanges, setPrinterRibbonChanges] = useState<Record<string, string>>({});
  const [globalIadePhotos, setGlobalIadePhotos] = useState<string>(''); // tek alan — yazıcı başına değil
  const [showClosingCount, setShowClosingCount] = useState(false);
  const [showDamagedAlbums, setShowDamagedAlbums] = useState(false);
  const [closingCount, setClosingCount] = useState<{ shelfEnd: Record<string, number>; damagedAlbums: Record<string, number> }>({
    shelfEnd: { album3: 0, album5: 0, album7: 0, album9: 0, album11: 0, album13: 0, album15: 0 },
    damagedAlbums: { album3: 0, album5: 0, album7: 0, album9: 0, album11: 0, album13: 0, album15: 0 },
  });
  const [venuePhotoTaken, setVenuePhotoTaken] = useState(false);
  const [venuePhotoPreview, setVenuePhotoPreview] = useState<string | null>(null);
  const [shiftEndDone, setShiftEndDone] = useState(false);

  // ── MEKAN kağıt ayarları ──
  const [mekanPrintType, setMekanPrintType] = useState<'tam' | 'yarim'>('yarim');
  const [mekanPrintTypeLoaded, setMekanPrintTypeLoaded] = useState(false); // mekan bulundu mu?
  const aktifAlbumItems = useMemo(() => {
    const stok = dunKapanis || stokGunluk?.acilis as any;
    return getAlbumItems(stok, mekanPrintType);
  }, [dunKapanis, stokGunluk, mekanPrintType]);
  const [mekanCurrency, setMekanCurrency] = useState('TRY');
  const [mekanPhotoPrice, setMekanPhotoPrice] = useState(200);   // mekan bazlı 1 fotoğraf fiyatı
  // ── Manuel fallback (printType alınamadığında kullanıcı girer) ──
  const [availablePapers, setAvailablePapers] = useState<any[]>([]);
  const [manualPrintType, setManualPrintType] = useState<'tam' | 'yarim'>('yarim');

  // ── REYON state ──
  const [reyonAcik, setReyonAcik] = useState(false);
  const [reyonKapanisSayim, setReyonKapanisSayim] = useState<StokSayim>(bosStok());
  const [reyonGunIciEkleme, setReyonGunIciEkleme] = useState<Record<string, number>>({
    album3: 0, album5: 0, album7: 0, album9: 0, album11: 0, album13: 0, album15: 0,
  });

  // ── Yönetici rolü (modal içi butonlar için) ──
  const isYonetici = ['yonetici', 'ust-mudur', 'mudur'].includes(userRole);
  // ── Yönetici: modal içinde uygulama içi karar verme ──
  const [kararVeriliyor, setKararVeriliyor] = useState<string | null>(null);

  // ── Stale kuyruk uyarı modal state ──
  const [staleModalItems, setStaleModalItems] = useState<Array<{ type: 'satis' | 'kare'; data: QueuedSale | QueuedFrame }>>([]);
  const [showStaleModal, setShowStaleModal] = useState(false);
  const [staleSending, setStaleSending] = useState(false);

  // ── Stale yardımcı ──
  const isStale = (queuedAt: number) => Date.now() - queuedAt >= STALE_MS;

  // ── Offline Kuyruk: bekleyen satış sayısını senkronize tut ──
  const syncPendingCount = () => {
    if (!userId) return;
    setPendingQueueCount(getUserQueue(userId).length);
  };

  // ── Offline Kare Kuyruğu: bekleyen kare sayısını senkronize tut ──
  const syncPendingFrameCount = () => {
    if (!userId) return;
    setPendingFrameCount(getUserFrameQueue(userId).length);
  };

  // ── Offline Kare Kuyruğu: bekleyen kareleri sunucuya gönder ──
  // staleAccumulator: dışarıdan geçirilirse stale itemler oraya eklenir (flushAllQueues'dan çağrılır)
  const flushFrameQueue = async (staleAccumulator?: Array<{ type: 'satis' | 'kare'; data: QueuedSale | QueuedFrame }>) => {
    if (!userId) return;
    const queue = getUserFrameQueue(userId);
    if (queue.length === 0) return;

    // Taze / eski ayır
    const freshFrames = staleAccumulator ? queue.filter(f => !isStale(f.queuedAt)) : queue;
    const staleFrames = staleAccumulator ? queue.filter(f => isStale(f.queuedAt)) : [];
    if (staleFrames.length > 0 && staleAccumulator) {
      staleAccumulator.push(...staleFrames.map(f => ({ type: 'kare' as const, data: f })));
    }

    setFrameFlushing(true);

    for (const qFrame of freshFrames) {
      try {
        const freshToken = await getToken();
        const hdr = buildHeaders(freshToken);

        const res = await fetch(`${API_BASE_QS}/stok/kare`, {
          method: 'POST',
          headers: hdr,
          body: JSON.stringify({
            mekanId: qFrame.mekanId,
            tarih: qFrame.tarih,
            photographerName: qFrame.photographerName,
            photographerId: qFrame.photographerId,
            frameCount: qFrame.frameCount,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          offlineDequeueFrame(qFrame.id);
          // Pending kaydı gerçek kayıtla değiştir
          setFrameEntries(prev =>
            prev.map(e =>
              e._queueId === qFrame.id
                ? { ...data.entry, _pending: false, _queueId: undefined }
                : e
            )
          );
        } else {
          const errData = await res.json().catch(() => ({}));
          console.warn('[offline-frame-queue] flush sunucu reddi:', errData.error);
        }
      } catch (netErr) {
        console.warn('[offline-frame-queue] flush ağ hatası, kuyrukta kalıyor:', netErr);
      }
    }

    syncPendingFrameCount();
    setFrameFlushing(false);
  };

  // ── Offline Kuyruk: bekleyen satışları sunucuya gönder ──
  // staleAccumulator: dışarıdan geçirilirse stale itemler oraya eklenir (flushAllQueues'dan çağrılır)
  const flushOfflineQueue = async (staleAccumulator?: Array<{ type: 'satis' | 'kare'; data: QueuedSale | QueuedFrame }>) => {
    if (!userId) return;
    const queue = getUserQueue(userId);
    if (queue.length === 0) return;

    // Taze / eski ayır
    const freshSales = staleAccumulator ? queue.filter(s => !isStale(s.queuedAt)) : queue;
    const staleSales = staleAccumulator ? queue.filter(s => isStale(s.queuedAt)) : [];
    if (staleSales.length > 0 && staleAccumulator) {
      staleAccumulator.push(...staleSales.map(s => ({ type: 'satis' as const, data: s })));
    }

    setQueueFlushing(true);
    let flushedAny = false;

    for (const qSale of freshSales) {
      try {
        // Gönderim anında taze token al — süresi dolmuş olsa bile Supabase refresh eder
        const freshToken = await getToken();
        const hdr = buildHeaders(freshToken);

        const res = await fetch(`${API_BASE_QS}/stok/satis`, {
          method: 'POST',
          headers: hdr,
          body: JSON.stringify({
            mekanId: qSale.mekanId,
            tarih: qSale.tarih,
            items: qSale.items,
            totalPrice: qSale.totalPrice,
            discount: qSale.discount,
            paymentMethod: qSale.paymentMethod,
            currency: qSale.currency,
            currencyPrice: qSale.currencyPrice,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          // localStorage'dan sil
          offlineDequeue(qSale.id);
          // Pending kartı gerçek satışla değiştir
          const realSale = { ...data.satis, project: qSale.projectName };
          setRecentSales(prev =>
            prev.map(s => s._queueId === qSale.id ? realSale : s)
          );
          setAllSalesForKapanis(prev =>
            prev.map(s => s._queueId === qSale.id ? realSale : s)
          );
          setSaleRefreshTrigger(prev => prev + 1);
          flushedAny = true;
        } else {
          // Sunucu reddi (401 vb.) — bu satışı kuyrukta bırak
          const errData = await res.json().catch(() => ({}));
          console.warn('[offline-queue] flush sunucu reddi:', errData.error);
        }
      } catch (netErr) {
        // Hâlâ çevrimdışı — bu satışı kuyrukta bırak, sonrakini dene
        console.warn('[offline-queue] flush ağ hatası, kuyrukta kalıyor:', netErr);
      }
    }

    syncPendingCount();
    setQueueFlushing(false);
    if (flushedAny) {
      setSaleRefreshTrigger(prev => prev + 1);
    }
  };

  // ── Tüm kuyrukları flush et: taze hemen, eskiler modal'a gönder ──
  const flushAllQueues = async () => {
    if (!userId) return;
    const staleAcc: Array<{ type: 'satis' | 'kare'; data: QueuedSale | QueuedFrame }> = [];
    await flushOfflineQueue(staleAcc);
    await flushFrameQueue(staleAcc);
    if (staleAcc.length > 0) {
      setStaleModalItems(staleAcc);
      setShowStaleModal(true);
    }
  };

  // ── Eski kayıtları "Yine de Gönder" ile flush et + Telegram bildir ──
  const handleStaleSend = async () => {
    if (!userId) return;
    setStaleSending(true);
    const now = Date.now();

    for (const item of staleModalItems) {
      if (item.type === 'satis') {
        const qSale = item.data as QueuedSale;
        try {
          const freshToken = await getToken();
          const hdr = buildHeaders(freshToken);
          const res = await fetch(`${API_BASE_QS}/stok/satis`, {
            method: 'POST',
            headers: hdr,
            body: JSON.stringify({
              mekanId: qSale.mekanId,
              tarih: qSale.tarih,
              items: qSale.items,
              totalPrice: qSale.totalPrice,
              discount: qSale.discount,
              paymentMethod: qSale.paymentMethod,
              currency: qSale.currency,
              currencyPrice: qSale.currencyPrice,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            offlineDequeue(qSale.id);
            const realSale2 = { ...data.satis, project: qSale.projectName };
            setRecentSales(prev =>
              prev.map(s => s._queueId === qSale.id ? realSale2 : s)
            );
            setAllSalesForKapanis(prev =>
              prev.map(s => s._queueId === qSale.id ? realSale2 : s)
            );
            setSaleRefreshTrigger(prev => prev + 1);
            // Telegram gecikme bildirimi
            fetch(`${API_BASE_QS}/stok/gecikme-bildir`, {
              method: 'POST',
              headers: hdr,
              body: JSON.stringify({
                type: 'satis',
                personnelName: userName,
                projectName: qSale.projectName,
                tarih: qSale.tarih,
                queuedAt: qSale.queuedAt,
                gecikmeMs: now - qSale.queuedAt,
                items: qSale.items,
                totalPrice: qSale.totalPrice,
                discount: qSale.discount,
                paymentMethod: qSale.paymentMethod,
                currency: qSale.currency,
                currencyPrice: qSale.currencyPrice,
              }),
            }).catch(e => console.warn('[gecikme-bildir] satis:', e));
          } else {
            const errData = await res.json().catch(() => ({}));
            console.warn('[stale-flush] satis sunucu reddi:', errData.error);
          }
        } catch (netErr) {
          console.warn('[stale-flush] satis ağ hatası:', netErr);
        }
      } else {
        const qFrame = item.data as QueuedFrame;
        try {
          const freshToken = await getToken();
          const hdr = buildHeaders(freshToken);
          const res = await fetch(`${API_BASE_QS}/stok/kare`, {
            method: 'POST',
            headers: hdr,
            body: JSON.stringify({
              mekanId: qFrame.mekanId,
              tarih: qFrame.tarih,
              photographerName: qFrame.photographerName,
              photographerId: qFrame.photographerId,
              frameCount: qFrame.frameCount,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            offlineDequeueFrame(qFrame.id);
            setFrameEntries(prev =>
              prev.map(e =>
                e._queueId === qFrame.id
                  ? { ...data.entry, _pending: false, _queueId: undefined }
                  : e
              )
            );
            // Telegram gecikme bildirimi
            fetch(`${API_BASE_QS}/stok/gecikme-bildir`, {
              method: 'POST',
              headers: hdr,
              body: JSON.stringify({
                type: 'kare',
                personnelName: userName,
                projectName: qFrame.projectName,
                tarih: qFrame.tarih,
                queuedAt: qFrame.queuedAt,
                gecikmeMs: now - qFrame.queuedAt,
                photographerName: qFrame.photographerName,
                frameCount: qFrame.frameCount,
              }),
            }).catch(e => console.warn('[gecikme-bildir] kare:', e));
          } else {
            const errData = await res.json().catch(() => ({}));
            console.warn('[stale-flush] kare sunucu reddi:', errData.error);
          }
        } catch (netErr) {
          console.warn('[stale-flush] kare ağ hatası:', netErr);
        }
      }
    }

    setStaleSending(false);
    setShowStaleModal(false);
    setStaleModalItems([]);
    syncPendingCount();
    syncPendingFrameCount();
  };

  // ── Online/Offline event listener ──
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      flushAllQueues();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Sayfa görünür hale geldiğinde (arka plandan dönüş, ekran açılışı) kuyruk flush
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && userId) {
        flushAllQueues();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Sayfa açılışında kuyruk varsa hemen gönder
    if (navigator.onLine && userId) {
      const q = getUserQueue(userId);
      const fq = getUserFrameQueue(userId);
      if (q.length > 0) setPendingQueueCount(q.length);
      if (fq.length > 0) setPendingFrameCount(fq.length);
      if (q.length > 0 || fq.length > 0) flushAllQueues();
    } else {
      syncPendingCount();
      syncPendingFrameCount();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    const load = async () => {
      // Canlı kur çek
      try {
        setRatesLoading(true);
        const headers = await authHeaders();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        let res: Response;
        try {
          res = await fetch(appendGhostParam(`${API_BASE_QS}/doviz/canli`), { headers, signal: controller.signal });
        } finally {
          clearTimeout(timer);
        }
        if (res.ok) {
          const data = await res.json();
          if (data.rates) {
            setExchangeRates({ USD: Number(data.rates.USD), EUR: Number(data.rates.EUR), GBP: Number(data.rates.GBP), BGN: Number(data.rates.BGN) || 19.50, RUB: Number(data.rates.RUB) || 0.38, SAR: Number(data.rates.SAR) || 8.80 });
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          console.warn('QuickSales exchange rate fetch timeout — fallback kurlar kullanılıyor.');
        } else {
          console.warn('QuickSales exchange rate fetch hatası — fallback kurlar kullanılıyor:', err?.message ?? err);
        }
        // Fallback: yaklaşık kurlar (sunucu erişilemezse)
        setExchangeRates({ USD: 32.5, EUR: 35.2, GBP: 41.0, BGN: 19.50, RUB: 0.38, SAR: 8.80 });
      } finally {
        setRatesLoading(false);
      }
      const staff = await getStaffMembers();
      setAllStaff(Array.isArray(staff) ? staff : []);
    };
    load();
  }, []);

  // ── Yönetici: modal içi karar gönder (kendi açtığı iptal talebi için) ──
  const handleIptalKarar = async (approvalId: string, karar: 'onaylandi' | 'reddedildi') => {
    setKararVeriliyor(approvalId);
    try {
      const hdr = buildHeaders(accessToken);
      const res = await fetch(`${API_BASE_QS}/stok/satis-iptal-karar/${approvalId}`, {
        method: 'POST',
        headers: hdr,
        body: JSON.stringify({ karar }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Karar gönderilemedi.');
      }
    } catch (err) {
      console.error('handleIptalKarar error:', err);
      alert('Bağlantı hatası.');
    } finally {
      setKararVeriliyor(null);
    }
  };

  // Proje değişince: mekan ID resolve et → stok + rotasyon yükle
  useEffect(() => {
    if (!selectedProject) return;
    const load = async () => {
      const hdr = buildHeaders(accessToken);
      const tarih = bugunTarih();

      // ── 1. Mekanlar → gerçek ID resolve et ──────────────
      let realMekanId = selectedProject.id;
      try {
        const mekanRes = await fetch(appendGhostParam(`${API_BASE_QS}/mekanlar`), { headers: hdr });
        if (mekanRes.ok) {
          const { mekanlar } = await mekanRes.json();
          // Önce ID ile eşleş (manager flow), bulamazsa name ile (staff flow, id='1')
          const mekan = (mekanlar || []).find(
            (m: any) => m.id === selectedProject.id || m.name === selectedProject.name
          );
          if (mekan) {
            realMekanId = mekan.id;
            if (mekan.photoPrice && mekan.photoPrice > 0) setMekanPhotoPrice(mekan.photoPrice);
            if (mekan.priceCurrency) setMekanPriceCurrency(mekan.priceCurrency);
            const pt = mekan.printType === 'tam' ? 'tam' : 'yarim';
            setMekanPrintType(pt);
            setMekanPrintTypeLoaded(true);
            // Kağıt bilgisi artık yazıcıdan geliyor — sadece availablePapers yükle
            const paperRes = await fetch(appendGhostParam(`${API_BASE_QS}/maliyetler`), { headers: hdr });
            if (paperRes.ok) {
              const { papers } = await paperRes.json();
              const allPapers = (papers || []).filter((p: any) => p.pcsPerBox && p.setsPerBox);
              setAvailablePapers(allPapers);
            }
          }
        }
      } catch (e) {
        console.log('Mekan verisi yüklenemedi:', e);
      }
      setResolvedMekanId(realMekanId);

      // ── 2. Rotasyon personeli ────────────────────────────
      const today = bizDateStr();
      const tasks = await getTasks();
      const todayTasks = (Array.isArray(tasks) ? tasks : []).filter(t =>
        t.date === today &&
        t.location === selectedProject.name &&
        (t.status === 'sent' || t.status === 'draft' || t.status === 'revised')
      );
      const ids = new Set<string>();
      const list: StaffMember[] = [];
      todayTasks.forEach(task => {
        task.personnel.forEach(p => {
          if (!ids.has(p.id)) {
            ids.add(p.id);
            list.push({ id: p.id, name: p.name, avatar: p.avatar, role: p.role, status: 'active' });
          }
        });
      });
      setRotationPersonnel(list);

      // ── 3. Stok (gerçek ID ile) ──────────────────────────
      setStokYukleniyor(true);
      const stokData = await getGunlukStok(realMekanId, tarih);
      setStokGunluk(stokData.bugun);
      setDunKapanis(stokData.dunKapanis);
      setStokEklemeler(stokData.eklemeler || []);

      // ── Yazıcı listesi: ekipman kaydından otomatik yükle ──
      const yaziciHelper = (yazicilar: any[]) =>
        (yazicilar || []).map((y: any) => ({
          ekipmanId: y.ekipmanId,
          label: `${y.brand || ''} ${y.model || ''}`.trim() || y.ekipmanId,
          brand: y.brand || '',
          model: y.model || '',
          serialNumber: y.serialNumber || '',
          startCounter: '',
          kagitTipiId: y.kagitTipiId || null,
          beklenenStartCounter: (y.ribonMevcut !== null && y.ribonMevcut !== undefined)
            ? Number(y.ribonMevcut)
            : null,
        }));

      if (stokData.mekanYazicilari) {
        setMekanYazicilari(stokData.mekanYazicilari);
      }

      if (stokData.bugun?.acilisYapildi) {
        setAcilisSayim({ ...bosStok(), ...(stokData.bugun.acilis as Partial<StokSayim>) });
        setShiftStartDone(true);
        // Açılış yapılmışsa acilisYazicilar'dan yükle (ekipmanId bağlantılı)
        const acilisYazicilar = (stokData.bugun as any)?.acilisYazicilar;
        if (acilisYazicilar && acilisYazicilar.length > 0) {
          setPrinters(acilisYazicilar.map((y: any) => {
            // beklenenStartCounter için ekipman kaydını bul
            const ekipmanRec = (stokData.mekanYazicilari || []).find((m: any) => m.ekipmanId === (y.ekipmanId || y.id));
            return {
              ekipmanId: y.ekipmanId || y.id || '',
              label: y.label || `${y.brand || ''} ${y.model || ''}`.trim() || y.ekipmanId,
              brand: y.brand || '',
              model: y.model || '',
              serialNumber: y.serialNumber || '',
              startCounter: String(y.startCounter || ''),
              kagitTipiId: ekipmanRec?.kagitTipiId || y.kagitTipiId || null,
              beklenenStartCounter: ekipmanRec?.ribonMevcut !== undefined && ekipmanRec?.ribonMevcut !== null
                ? Number(ekipmanRec.ribonMevcut)
                : null,
            };
          }));
        } else if (stokData.mekanYazicilari) {
          // Eski kayıt — mekan yazıcılarını kullan
          setPrinters(yaziciHelper(stokData.mekanYazicilari));
        }
        if (stokData.bugun.kapanisYapildi) {
          setKapanisSayim({ ...bosStok(), ...(stokData.bugun.kapanish as Partial<StokSayim>) });
          setKapanisAnomali(stokData.bugun.kapanisAnomali || {});
          setKapanisBeklenen(stokData.bugun.kapanisBeklenen || null);
          setKapanisYaziciAnomali((stokData.bugun as any).kapanisYaziciAnomali || null);
          setShiftEndDone(true);
          // Kapanış printerData'yı geri yükle (bitiş sayaçları ve ribonMevcut)
          const kapanisPrinterData = (stokData.bugun as any)?.printerData;
          if (kapanisPrinterData && Array.isArray(kapanisPrinterData)) {
            const endCounters: Record<string, string> = {};
            const ribonChanges: Record<string, string> = {};
            const iadePhotos: Record<string, string> = {};
            for (const pr of kapanisPrinterData) {
              const eid = pr.ekipmanId || pr.id;
              if (!eid) continue;
              if (pr.endCounter !== undefined) endCounters[eid] = String(pr.endCounter);
              if (pr.ribonDegisim !== undefined) ribonChanges[eid] = String(pr.ribonDegisim);
              if (pr.iadeFotograf !== undefined) iadePhotos[eid] = String(pr.iadeFotograf);
            }
            setPrinterEndCounters(endCounters);
            setPrinterRibbonChanges(ribonChanges);
            // Global iade: daha önce kaydedildiyse ilk yazıcıdan al (geriye dönük uyum)
            const firstIade = Object.values(iadePhotos).find(v => Number(v) > 0);
            if (firstIade) setGlobalIadePhotos(firstIade);
          }
        }
      } else {
        // Açılış yapılmamış — mekan yazıcılarından otomatik doldur (son endCounter ile)
        if (stokData.mekanYazicilari) {
          setPrinters(yaziciHelper(stokData.mekanYazicilari));
        }
        if (stokData.dunKapanis) {
          setAcilisSayim({ ...bosStok(), ...stokData.dunKapanis });
        }
      }
      setStokYukleniyor(false);

      // ── 4. Satışlar ve kare kayıtları stok kaydından gelir ──
      const tumSatislar = (stokData.bugun?.satislar || []).filter((s: any) => !s.iptal);
      const yetkiliRoller = ['yonetici', 'ust-mudur', 'mudur', 'operasyon'];
      const gunlukSatislar = yetkiliRoller.includes(userRole) ? tumSatislar : tumSatislar.filter((s: any) => s.kaydedenId === userId);
      setRecentSales(gunlukSatislar);
      setAllSalesForKapanis(tumSatislar);
      setFrameEntries(stokData.bugun?.kareKayitlari || []);
      if (stokData.bugun?.musteriSayisi) {
        setMusteriSayisi(String(stokData.bugun.musteriSayisi));
        setMusteriSayisiKayitli(true);
      } else {
        setMusteriSayisi('');
        setMusteriSayisiKayitli(false);
      }

      // ── 5. Check-in durumu kontrol ──
      try {
        const ciRes = await fetch(appendGhostParam(`${API_BASE_QS}/vardiya/bugun`), { headers: buildHeaders(accessToken) });
        if (ciRes.ok) {
          const ciData = await ciRes.json();
          setHasCheckedIn(!!ciData.checkin);
        }
      } catch {}
    };
    load();
    setCheckinWarningDismissed(false);
  }, [selectedProject]);

  const currencySymbol = (c: string) => c === 'EUR' ? '€' : c === 'USD' ? '$' : c === 'GBP' ? '£' : c === 'BGN' ? 'лв' : c === 'RUB' ? '₽' : c === 'SAR' ? '﷼' : '₺';
  const pSym = currencySymbol(mekanPriceCurrency);

  const products = [
    { name: "1 Fotoğraf", price: mekanPhotoPrice,      color: 'from-[#9dd9ea] to-[#7ec8dd]', icon: '📸' },
    { name: "3'lü",       price: mekanPhotoPrice * 3,  color: 'from-[#b8d4f1] to-[#9cc0e8]', icon: '🎨' },
    { name: "5'li",       price: mekanPhotoPrice * 5,  color: 'from-[#d4b5f7] to-[#c79ff0]', icon: '🖼️' },
    { name: "7'li",       price: mekanPhotoPrice * 7,  color: 'from-[#ffb3d9] to-[#ff99cc]', icon: '✨' },
    { name: "9'lu",       price: mekanPhotoPrice * 9,  color: 'from-[#ffe5b4] to-[#ffd89b]', icon: '🌟' },
    { name: "11'li",      price: mekanPhotoPrice * 11, color: 'from-[#a8e6cf] to-[#8dd9b8]', icon: '💎' },
    { name: "13'lü",      price: mekanPhotoPrice * 13, color: 'from-[#c5a8f5] to-[#b490ed]', icon: '🏆' },
    { name: "15'li",      price: mekanPhotoPrice * 15, color: 'from-[#ffd4a3] to-[#ffc78f]', icon: '🎯' },
  ];

  const calculateTotal = () => cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = calculateTotal();

  const calculateForeignCurrency = () => {
    if (!selectedCurrency) return '0.00';
    const discount = Number(discountAmount) || 0;
    const netAmount = totalPrice - discount;
    if (mekanPriceCurrency === 'TRY') {
      // TRY mekan → dövize çevir (TRY / kur)
      return (netAmount / exchangeRates[selectedCurrency]).toFixed(2);
    } else {
      // Döviz mekan → önce TRY'ye çevir, sonra hedef dövize çevir
      const mekanKur = exchangeRates[mekanPriceCurrency as keyof typeof exchangeRates] || 1;
      const tlAmount = netAmount * mekanKur;
      if (selectedCurrency === 'TRY' as any) return tlAmount.toFixed(2);
      return (tlAmount / exchangeRates[selectedCurrency]).toFixed(2);
    }
  };

  // Currency değişince foreignNet input/discount sıfırla; null/TRY olunca numpad'i de kapat
  useEffect(() => {
    setForeignNetRawInput('');
    setDiscountAmount('');
    if (!selectedCurrency || (selectedCurrency as any) === 'TRY') {
      setShowForeignNet(false);
      setForeignNetMode('fiyat');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCurrency]);

  // Müşterinin döviz net girişini mekan currency cinsinden discountAmount'a çevir
  const applyForeignNet = (rawInput: string, mode: 'iskonto' | 'fiyat') => {
    if (!selectedCurrency) return;
    const foreignVal = Number(rawInput) || 0;
    const toMekanCurrency = (foreignAmount: number): number => {
      if (mekanPriceCurrency === 'TRY') {
        if ((selectedCurrency as any) === 'TRY') return foreignAmount;
        return foreignAmount * exchangeRates[selectedCurrency];
      }
      const tl = (selectedCurrency as any) === 'TRY'
        ? foreignAmount
        : foreignAmount * exchangeRates[selectedCurrency];
      const mekanKur = exchangeRates[mekanPriceCurrency as keyof typeof exchangeRates] || 1;
      return tl / mekanKur;
    };
    if (mode === 'iskonto') {
      setDiscountAmount(String(Math.round(toMekanCurrency(foreignVal) * 100) / 100));
    } else {
      const equivMekan = toMekanCurrency(foreignVal);
      setDiscountAmount(String(Math.round((totalPrice - equivMekan) * 100) / 100));
    }
  };

  // Check-in uyarı kontrolü — işlem yapmadan önce çağır
  const checkCheckinWarning = (callback: () => void) => {
    if (hasCheckedIn || checkinWarningDismissed) { callback(); return; }
    setCheckinWarningCallback(() => callback);
    setShowCheckinWarning(true);
  };

  const addToCart = (productName: string, unitPrice: number) => {
    const existing = cart.find(i => i.product === productName);
    const product = products.find(p => p.name === productName);
    if (existing) {
      setCart(cart.map(i => i.product === productName ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCart([...cart, { product: productName, quantity: 1, color: product?.color || '', unitPrice }]);
    }
  };

  const removeFromCart = (productName: string) => {
    const existing = cart.find(i => i.product === productName);
    if (existing && existing.quantity > 1) {
      setCart(cart.map(i => i.product === productName ? { ...i, quantity: i.quantity - 1 } : i));
    } else {
      setCart(cart.filter(i => i.product !== productName));
    }
  };

  const handleProceed = () => {
    if (!selectedProject) { alert('Lütfen önce proje seçin!'); return; }
    if (cart.length === 0) { alert('Lütfen ürün seçin'); return; }
    checkCheckinWarning(() => setShowPaymentMethod(true));
  };

  const handleCompleteSale = async () => {
    if (!paymentMethod || !selectedProject) return;
    const discount = Number(discountAmount) || 0;
    const mekanId = resolvedMekanId || selectedProject.id;
    const tarih = bugunTarih();
    const saleItems = cart.map(i => ({ product: i.product, quantity: i.quantity, unitPrice: i.unitPrice, color: i.color, ...(i.dijital ? { dijital: true } : {}) }));
    // Döviz mekanında: currency = mekan para birimi, currencyPrice = döviz tutarı, totalPrice TL'ye çevrilir
    // TRY mekanında: selectedCurrency (manuel seçim) veya TRY
    const isForeignMekan = mekanPriceCurrency !== 'TRY';
    const currency = isForeignMekan ? mekanPriceCurrency : (selectedCurrency || 'TRY');
    const foreignAmount = isForeignMekan ? (totalPrice - discount) : (selectedCurrency ? Number(calculateForeignCurrency()) : null);
    const currencyPrice = foreignAmount;
    // Döviz mekanında totalPrice ve discount'u TL'ye çevir
    const kurOrani = isForeignMekan ? (exchangeRates[mekanPriceCurrency as keyof typeof exchangeRates] || 1) : 1;
    const totalPriceTL = isForeignMekan ? Math.round(totalPrice * kurOrani) : totalPrice;
    const discountTL = isForeignMekan ? Math.round(discount * kurOrani) : discount;

    // ── Çevrimdışı kontrolü: navigator.onLine hızlı ön kontrol ──
    const currentlyOnline = navigator.onLine;

    setSatisSaving(true);

    // Çevrimdışıysa direkt kuyruğa al, fetch deneme
    if (!currentlyOnline) {
      const queueId = generateQueueId();
      const qSale: QueuedSale = {
        id: queueId,
        userId: userId || 'unknown',
        projectName: selectedProject.name,
        mekanId,
        tarih,
        items: saleItems,
        totalPrice: totalPriceTL,
        discount: discountTL,
        paymentMethod,
        currency,
        currencyPrice,
        queuedAt: Date.now(),
      };
      offlineEnqueue(qSale);
      syncPendingCount();

      // Listede "bekliyor" olarak göster
      const pendingSale: Sale = {
        id: queueId,
        items: saleItems,
        totalPrice: totalPriceTL,
        discount: discountTL,
        finalPrice: totalPriceTL - discountTL,
        paymentMethod,
        currency,
        currencyPrice,
        timestamp: new Date().toISOString(),
        iptal: false,
        project: selectedProject.name,
        _pending: true,
        _queueId: queueId,
      };
      setRecentSales(prev => [pendingSale, ...prev]);
      setAllSalesForKapanis(prev => [pendingSale, ...prev]);
      setSatisSaving(false);
      setCart([]); setDiscountAmount(''); setDiscountRawInput(''); setDiscountMode('iskonto'); setShowDiscount(false); setShowForeignNet(false); setForeignNetRawInput(''); setForeignNetMode('fiyat'); setShowPaymentMethod(false); setPaymentMethod(null); setSelectedCurrency(null); setShowGerekce(false); setGerekceText('');
      return;
    }

    // ── Çevrimiçi: normal akış, ağ hatası olursa kuyruğa al ──
    try {
      const hdr = buildHeaders(accessToken);
      const res = await fetch(`${API_BASE_QS}/stok/satis`, {
        method: 'POST',
        headers: hdr,
        body: JSON.stringify({
          mekanId,
          tarih,
          items: saleItems,
          totalPrice: totalPriceTL,
          discount: discountTL,
          paymentMethod,
          currency,
          currencyPrice,
          ...(gerekceText.trim() ? { gerekce: gerekceText.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Satış kayıt hatası:', data.error);
        alert(data.error || 'Satış kaydedilemedi.');
        return;
      }
      // Listeye ekle
      setRecentSales(prev => [{ ...data.satis, project: selectedProject.name }, ...prev]);
      setAllSalesForKapanis(prev => [{ ...data.satis, project: selectedProject.name }, ...prev]);
      setSaleRefreshTrigger(prev => prev + 1);
    } catch (err) {
      // Ağ hatası — navigator.onLine yalan söyledi (zayıf sinyal vb.)
      console.warn('handleCompleteSale ağ hatası, kuyruğa alınıyor:', err);

      const queueId = generateQueueId();
      const qSale: QueuedSale = {
        id: queueId,
        userId: userId || 'unknown',
        projectName: selectedProject.name,
        mekanId,
        tarih,
        items: saleItems,
        totalPrice: totalPriceTL,
        discount: discountTL,
        paymentMethod,
        currency,
        currencyPrice,
        queuedAt: Date.now(),
      };
      offlineEnqueue(qSale);
      syncPendingCount();

      // Listede "bekliyor" olarak göster
      const pendingSale: Sale = {
        id: queueId,
        items: saleItems,
        totalPrice: totalPriceTL,
        discount: discountTL,
        finalPrice: totalPriceTL - discountTL,
        paymentMethod,
        currency,
        currencyPrice,
        timestamp: new Date().toISOString(),
        iptal: false,
        project: selectedProject.name,
        _pending: true,
        _queueId: queueId,
      };
      setRecentSales(prev => [pendingSale, ...prev]);
      setAllSalesForKapanis(prev => [pendingSale, ...prev]);
    } finally {
      setSatisSaving(false);
    }
    setCart([]); setDiscountAmount(''); setDiscountRawInput(''); setDiscountMode('iskonto'); setShowDiscount(false); setShowForeignNet(false); setForeignNetRawInput(''); setForeignNetMode('fiyat'); setShowPaymentMethod(false); setPaymentMethod(null); setSelectedCurrency(null); setShowGerekce(false); setGerekceText('');
  };

  // ── Satış İptal: onay akışı state ──
  type CancelStep = 'form' | 'bekliyor' | 'onaylandi' | 'reddedildi' | 'timeout';
  const [cancelStep, setCancelStep] = useState<CancelStep>('form');
  const [cancelApprovalId, setCancelApprovalId] = useState<string | null>(null);
  const [cancelCountdown, setCancelCountdown] = useState(180);
  const cancelPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const openCancelModal = (id: string) => {
    setCancelSaleId(id);
    setShowCancelModal(true);
    setCancelStep('form');
    setCancelApprovalId(null);
    setCancelCountdown(180);
  };

  const closeCancelModal = () => {
    if (cancelPollingRef.current) {
      clearInterval(cancelPollingRef.current);
      cancelPollingRef.current = null;
    }
    setShowCancelModal(false);
    setCancelSaleId(null);
    setCancelReason('');
    setCancelStep('form');
    setCancelApprovalId(null);
    setCancelCountdown(180);
  };

  // Onay geldikten sonra gerçek DELETE çağrısını yap
  const executeCancelSale = async (mekanId: string, tarih: string, satisId: string, neden: string) => {
    try {
      const hdr = buildHeaders(accessToken);
      const res = await fetch(`${API_BASE_QS}/stok/satis/${mekanId}/${tarih}/${satisId}`, {
        method: 'DELETE',
        headers: hdr,
        body: JSON.stringify({ neden, skipTelegram: true }),
      });
      if (res.ok) {
        setRecentSales(prev => prev.filter(s => s.id !== satisId));
        setAllSalesForKapanis(prev => prev.filter(s => s.id !== satisId));
      } else {
        const data = await res.json();
        console.error('executeCancelSale sunucu hatası:', data.error);
      }
    } catch (err) {
      console.error('executeCancelSale error:', err);
    }
  };

  // Adım 1: Telegram onay talebi gönder → polling başlat
  const sendCancelRequest = async () => {
    if (!cancelReason.trim()) { alert('Lütfen iptal sebebini yazın'); return; }
    if (!cancelSaleId || !selectedProject) return;
    const mekanId = resolvedMekanId || selectedProject.id;
    const tarih = bugunTarih();
    const satisId = cancelSaleId;
    const neden = cancelReason;

    try {
      const hdr = buildHeaders(accessToken);
      const res = await fetch(`${API_BASE_QS}/stok/satis-iptal-talep`, {
        method: 'POST',
        headers: hdr,
        body: JSON.stringify({ mekanId, tarih, satisId, neden }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Talep gönderilemedi.'); return; }

      const approvalId = data.approvalId;
      setCancelApprovalId(approvalId);
      setCancelStep('bekliyor');
      setCancelCountdown(180);

      // Polling: her 3 saniyede durum kontrol et
      let timeLeft = 180;
      cancelPollingRef.current = setInterval(async () => {
        timeLeft -= 3;
        setCancelCountdown(timeLeft);

        if (timeLeft <= 0) {
          if (cancelPollingRef.current) { clearInterval(cancelPollingRef.current); cancelPollingRef.current = null; }
          setCancelStep('timeout');
          return;
        }

        try {
          const pollRes = await fetch(appendGhostParam(`${API_BASE_QS}/stok/satis-iptal-durum/${approvalId}`), { headers: hdr });
          const pollData = await pollRes.json();

          if (pollData.status === 'onaylandi') {
            if (cancelPollingRef.current) { clearInterval(cancelPollingRef.current); cancelPollingRef.current = null; }
            setCancelStep('onaylandi');
            await executeCancelSale(mekanId, tarih, satisId, neden);
            setTimeout(() => closeCancelModal(), 2500);
          } else if (pollData.status === 'reddedildi') {
            if (cancelPollingRef.current) { clearInterval(cancelPollingRef.current); cancelPollingRef.current = null; }
            setCancelStep('reddedildi');
          }
        } catch (e) {
          console.error('İptal durum polling hatası:', e);
        }
      }, 3000);

    } catch (err) {
      console.error('sendCancelRequest error:', err);
      alert('Bağlantı hatası. Lütfen tekrar deneyin.');
    }
  };

  // ── Kare silme ──
  const openDeleteKareModal = (entry: any) => { setDeleteKareEntry(entry); setShowDeleteKareModal(true); };
  const closeDeleteKareModal = () => { setShowDeleteKareModal(false); setDeleteKareEntry(null); };
  const confirmDeleteKare = async () => {
    if (!deleteKareEntry || !selectedProject) return;
    const mekanId = resolvedMekanId || selectedProject.id;
    const tarih = bugunTarih();
    setDeleteKareSaving(true);
    try {
      const hdr = buildHeaders(accessToken);
      const res = await fetch(`${API_BASE_QS}/stok/kare/${mekanId}/${tarih}/${deleteKareEntry.id}`, {
        method: 'DELETE',
        headers: hdr,
      });
      if (res.ok) {
        setFrameEntries(prev => prev.filter((e: any) => e.id !== deleteKareEntry.id));
        closeDeleteKareModal();
      } else {
        const data = await res.json();
        alert(data.error || 'Kare kaydı silinemedi.');
      }
    } catch (err) {
      console.error('confirmDeleteKare error:', err);
      alert('Bağlantı hatası.');
    } finally {
      setDeleteKareSaving(false);
    }
  };

  const handleMusteriSayisiSave = async () => {
    if (!musteriSayisi || !selectedProject) return;
    const count = parseInt(musteriSayisi);
    if (isNaN(count) || count <= 0) return;
    setMusteriSayisiSaving(true);
    try {
      const headers = buildHeaders(accessToken);
      const res = await fetch(`${API_BASE_QS}/stok/musteri-sayisi`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ mekanId: selectedProject.id, tarih: bugunTarih(), musteriSayisi: count }),
      });
      if (res.ok) {
        setMusteriSayisiKayitli(true);
      } else {
        const data = await res.json().catch(() => ({ error: 'Hata' }));
        alert(data.error || 'Müşteri sayısı kaydedilemedi.');
      }
    } catch {
      alert('Bağlantı hatası.');
    } finally {
      setMusteriSayisiSaving(false);
    }
  };

  const handleFrameSave = async () => {
    if (!framePhotographer || !frameCount || !selectedProject) return;
    const count = parseInt(frameCount);
    if (isNaN(count) || count <= 0) return;

    if (!hasCheckedIn && !checkinWarningDismissed) {
      checkCheckinWarning(() => handleFrameSave());
      return;
    }

    const mekanId = resolvedMekanId || selectedProject.id;
    const tarih = bugunTarih();

    setFrameSaving(true);

    // ── Çevrimdışı kontrolü ──
    const currentlyOnline = navigator.onLine;

    if (!currentlyOnline) {
      const queueId = generateFrameQueueId();
      const qFrame: QueuedFrame = {
        id: queueId,
        userId: userId || 'unknown',
        projectName: selectedProject.name,
        mekanId,
        tarih,
        photographerName: framePhotographer.name,
        photographerId: framePhotographer.id,
        frameCount: count,
        queuedAt: Date.now(),
      };
      offlineEnqueueFrame(qFrame);
      syncPendingFrameCount();

      // UI'da "bekliyor" olarak göster
      const pendingEntry = {
        id: queueId,
        photographerName: framePhotographer.name,
        photographerId: framePhotographer.id,
        frameCount: count,
        timestamp: new Date().toISOString(),
        _pending: true,
        _queueId: queueId,
      };
      setFrameEntries(prev => [...prev, pendingEntry]);
      setFramePhotographer(null);
      setFrameCount('');
      setFrameSaving(false);
      setFrameShowSuccess(true);
      setTimeout(() => setFrameShowSuccess(false), 2500);
      return;
    }

    // ── Çevrimiçi: normal akış, ağ hatası olursa kuyruğa al ──
    try {
      const headers = buildHeaders(accessToken);
      const res = await fetch(`${API_BASE_QS}/stok/kare`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          mekanId,
          tarih,
          photographerName: framePhotographer.name,
          photographerId: framePhotographer.id,
          frameCount: count,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Kare kaydedilemedi.');
        return;
      }
      setFrameEntries(prev => [...prev, data.entry]);
      setFramePhotographer(null);
      setFrameCount('');
      setFrameShowSuccess(true);
      setTimeout(() => setFrameShowSuccess(false), 2500);
    } catch (err) {
      console.error('handleFrameSave network hatası — kuyruğa alınıyor:', err);
      // Ağ hatası → kuyruğa al
      const queueId = generateFrameQueueId();
      const qFrame: QueuedFrame = {
        id: queueId,
        userId: userId || 'unknown',
        projectName: selectedProject.name,
        mekanId,
        tarih,
        photographerName: framePhotographer.name,
        photographerId: framePhotographer.id,
        frameCount: count,
        queuedAt: Date.now(),
      };
      offlineEnqueueFrame(qFrame);
      syncPendingFrameCount();

      const pendingEntry = {
        id: queueId,
        photographerName: framePhotographer.name,
        photographerId: framePhotographer.id,
        frameCount: count,
        timestamp: new Date().toISOString(),
        _pending: true,
        _queueId: queueId,
      };
      setFrameEntries(prev => [...prev, pendingEntry]);
      setFramePhotographer(null);
      setFrameCount('');
      setFrameShowSuccess(true);
      setTimeout(() => setFrameShowSuccess(false), 2500);
    } finally {
      setFrameSaving(false);
    }
  };

  const filteredManualStaff = allStaff.filter(s =>
    s.name.toLowerCase().includes(manualSearch.toLowerCase())
  );

  // ── Shift Start helpers ──
  const updateShiftStock = (key: string, val: number) => setShiftStock(p => ({ ...p, [key]: Math.max(0, val) }));
  const updateShiftShelves = (key: string, val: number) => setShiftShelves(p => ({ ...p, [key]: Math.max(0, val) }));
  // Yazıcı state fonksiyonları (ekipmanId bazlı — manual ekleme kaldırıldı)
  const updatePrinterStart = (ekipmanId: string, val: string) =>
    setPrinters(p => p.map(pr => pr.ekipmanId === ekipmanId ? { ...pr, startCounter: val } : pr));
  const updatePrinterEnd = (ekipmanId: string, val: string) =>
    setPrinterEndCounters(p => ({ ...p, [ekipmanId]: val }));
  const updatePrinterRibbon = (ekipmanId: string, val: string) =>
    setPrinterRibbonChanges(p => ({ ...p, [ekipmanId]: val }));
  // (per-printer iade kaldırıldı — globalIadePhotos kullanılıyor)

  // ── Fotoğraf küçültme: max 1280px, %70 JPEG ──
  const resizePhoto = (base64: string, maxW = 1280, quality = 0.7): Promise<string> =>
    new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const ratio = Math.min(maxW / img.width, maxW / img.height, 1);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = base64;
    });

  const handleTeamPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => { setTeamPhotoPreview(reader.result as string); setTeamPhotoTaken(true); };
    reader.readAsDataURL(file);
  };
  // ── Efektif kapasite & print type ──
  // printType → mekan'dan; kapasite → her yazıcının kendi kagitTipiId'sinden
  const effectiveKapasite = 0; // artık global kapasite yok — her yazıcı kendi kağıdını kullanır
  const effectivePrintType = mekanPrintTypeLoaded ? mekanPrintType : manualPrintType;
  const needsManualInput = !mekanPrintTypeLoaded; // sadece mekan bulunamadığında

  // Mekanın printType'ına göre stok alanlarını filtrele (sadece _tam veya _yarim göster, eski Kare satırlarını gizle)
  const stokAlanlari = (Object.keys(stokAlanAdi) as Array<keyof StokSayim>).filter(a => {
    if (a === 'ribon' || a === 'ribonlar') return false;
    const key = a as string;
    if (/^album\d+$/.test(key)) return false; // eski Kare formatını gizle
    if (effectivePrintType === 'tam' && key.endsWith('_yarim')) return false;
    if (effectivePrintType === 'yarim' && key.endsWith('_tam')) return false;
    return true;
  });

  // Eski format stok verisini (album3, album5...) yeni formata (album3_tam/album3_yarim) aktarır
  const migrateStok = (sayim: StokSayim, pt: 'tam' | 'yarim'): StokSayim => {
    const result = { ...sayim };
    const suffix = pt === 'tam' ? '_tam' : '_yarim';
    for (const size of [3, 5, 7, 9, 11, 13, 15]) {
      const eskiKey = `album${size}` as keyof StokSayim;
      const yeniKey = `album${size}${suffix}` as keyof StokSayim;
      const eskiVal = Number(result[eskiKey]) || 0;
      const yeniVal = Number(result[yeniKey]) || 0;
      if (eskiVal > 0 && yeniVal === 0) {
        (result as any)[yeniKey] = eskiVal;
      }
    }
    return result;
  };

  // Migrasyon uygulanmış dünkü kapanış ve açılış verisi
  const migratedDunKapanis = dunKapanis ? migrateStok(dunKapanis, effectivePrintType) : null;
  const migratedAcilisSayim = migrateStok(acilisSayim, effectivePrintType);

  // ── Anomali tespiti (submit öncesi) ──
  const acilisAnomaliDetect = (): Record<string, number> => {
    if (!migratedDunKapanis) return {};
    const result: Record<string, number> = {};
    stokAlanlari.forEach(alan => {
      const fark = (migratedAcilisSayim[alan] ?? 0) - (migratedDunKapanis[alan] ?? 0);
      if (fark !== 0) result[alan] = fark;
    });
    return result;
  };

  // Net satılan fotoğraf adedi — JSX içinde block-body arrow fn kullanmamak için burada hesaplanıyor
  const netSatilanAdet = Math.max(0, printers.reduce((sum, pr) => {
    const s = Number(pr.startCounter) || 0;
    const e = Number(printerEndCounters[pr.ekipmanId] || 0);
    const r = Number(printerRibbonChanges[pr.ekipmanId] || 0);
    const pObjNet = pr.kagitTipiId ? availablePapers.find((p: any) => p.id === pr.kagitTipiId) : null;
    const kapNet = pObjNet ? Number(pObjNet.pcsPerBox) / Number(pObjNet.setsPerBox) : 0;
    const kb = kapNet > 0 ? Math.max(0, s + r * kapNet - e) : Math.max(0, s - e);
    return sum + Math.round(kb * (effectivePrintType === 'tam' ? 1 : 2));
  }, 0) - Number(globalIadePhotos));

  // ── Satışlardan albüm düşümü — backend stok/kapanis ile tutarlı ──
  const kapanisSatisAlbumDusum = useMemo(() => {
    const result: Record<string, number> = {};
    for (const satis of allSalesForKapanis) {
      for (const item of (satis.items || [])) {
        if (item.dijital) continue; // Dijital satışlar stoktan düşülmez
        const match = String(item.product || '').match(/^(\d+)/);
        if (match) {
          const alan = `album${match[1]}`;
          result[alan] = (result[alan] || 0) + (Number(item.quantity) || 0);
        }
      }
    }
    return result;
  }, [allSalesForKapanis]);

  const kapanisAnomaliDetect = (): Record<string, number> => {
    if (!stokGunluk?.acilis) return {};
    const toplamRibonDegisim = printers.reduce(
      (sum, pr) => sum + (Number(printerRibbonChanges[pr.ekipmanId] || 0)), 0
    );
    const result: Record<string, number> = {};
    const migratedAcilis = migrateStok(stokGunluk!.acilis as StokSayim, effectivePrintType);
    stokAlanlari.forEach(alan => {
      let beklenen = migratedAcilis[alan] || 0;
      for (const ek of stokEklemeler) {
        beklenen += (ek.miktar as Record<string, number>)[alan] || 0;
      }
      beklenen -= kapanisSatisAlbumDusum[alan] || 0;
      if (alan === 'ribon') beklenen -= toplamRibonDegisim;
      beklenen = Math.max(0, beklenen);
      const fark = (kapanisSayim[alan] ?? 0) - beklenen;
      if (fark !== 0) result[alan] = fark;
    });
    return result;
  };

  const handleAcilisSubmitClick = () => {
    checkCheckinWarning(() => {
      const anomali = acilisAnomaliDetect();
      if (Object.keys(anomali).length > 0) {
        setShowAcilisAnomaliUyari(true);
      } else {
        handleShiftStartComplete();
      }
    });
  };

  const handleKapanisSubmitClick = () => {
    if (reyonAcik) {
      handleShiftEndComplete();
      return;
    }
    const anomali = kapanisAnomaliDetect();
    if (Object.keys(anomali).length > 0) {
      setShowKapanisAnomaliUyari(true);
    } else {
      handleShiftEndComplete();
    }
  };

  const handleAcilisSifirla = async () => {
    if (!selectedProject) return;
    const mekanId = resolvedMekanId || selectedProject.id;
    const tarih = bugunTarih();
    setAcilisSifirlaYukleniyor(true);
    try {
      const hdr = buildHeaders(accessToken);
      const res = await fetch(`${API_BASE_QS}/stok/acilis-sifirla`, {
        method: 'POST',
        headers: { ...hdr, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mekanId, tarih }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Açılış sıfırlama hatası:', data.error);
        alert(`Hata: ${data.error}`);
      } else {
        // Frontend state sıfırla
        setStokGunluk(null);
        setShiftStartDone(false);
        setShiftEndDone(false);
        setAcilisSayim(dunKapanis ? { ...dunKapanis } : bosStok());
        setAcilisNot('');
        setAcilisAnomaliNeden('');
        setKapanisSayim(bosStok());
        setKapanisNot('');
        setKapanisAnomali({});
        setKapanisBeklenen(null);
        setKapanisAnomaliNeden('');
        setKapanisYaziciAnomali(null);
        setTeamPhotoTaken(false);
        setTeamPhotoPreview(null);
        // Yazıcıları ekipman listesinden sıfırla — alan boş, beklenen ayrıca gösterilir
        setPrinters(mekanYazicilari.map((y: any) => ({
          ekipmanId: y.ekipmanId,
          label: `${y.brand || ''} ${y.model || ''}`.trim() || y.ekipmanId,
          brand: y.brand || '',
          model: y.model || '',
          serialNumber: y.serialNumber || '',
          startCounter: '',
          beklenenStartCounter: (y.ribonMevcut !== null && y.ribonMevcut !== undefined)
            ? Number(y.ribonMevcut)
            : null,
        })));
        setPrinterEndCounters({});
        setPrinterRibbonChanges({});
        setGlobalIadePhotos('');
        setYaziciAcilisAnomali([]);
        setReyonAcik(false);
        setReyonKapanisSayim(bosStok());
        setActiveMode('shift-start');
        setShowAcilisSifirlaModal(false);
      }
    } catch (err) {
      console.error('Açılış sıfırlama beklenmeyen hata:', err);
      alert('Sunucuya ulaşılamadı. Lütfen tekrar deneyin.');
    } finally {
      setAcilisSifirlaYukleniyor(false);
    }
  };

  const handleShiftStartComplete = async () => {
    if (!selectedProject) return;
    setStokKaydediliyor(true);
    const tarih = bugunTarih();
    const mekanId = resolvedMekanId || selectedProject.id;
    // Yazıcı açılış verilerini topla (ekipmanId bağlantılı)
    const acilisYazicilar = printers
      .filter(pr => pr.ekipmanId)
      .map(pr => ({
        ekipmanId: pr.ekipmanId,
        label: pr.label,
        brand: pr.brand,
        model: pr.model,
        serialNumber: pr.serialNumber,
        startCounter: Number(pr.startCounter) || 0,
      }));
    const resizedPhoto = teamPhotoPreview ? await resizePhoto(teamPhotoPreview) : null;
    const result = await postAcilis(mekanId, tarih, acilisSayim, acilisNot, acilisYazicilar, resizedPhoto);
    setStokKaydediliyor(false);
    if (result) {
      setStokGunluk(result.kayit);
      setShiftStartDone(true);
      // Yazıcı sayaç anomalisi varsa kaydet (uyarı olarak gösterilecek)
      if ((result as any).printerAnomali && (result as any).printerAnomali.length > 0) {
        setYaziciAcilisAnomali((result as any).printerAnomali);
      }
      setActiveMode('sales');
    } else {
      alert('Açılış kaydedilirken hata oluştu. Lütfen tekrar deneyin.');
    }
  };

  // ── Shift End helpers ──
  const updateClosingCount = (cat: 'shelfEnd' | 'damagedAlbums', key: string, val: number) =>
    setClosingCount(p => ({ ...p, [cat]: { ...p[cat], [key]: Math.max(0, val) } }));
  const handleVenuePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => { setVenuePhotoPreview(reader.result as string); setVenuePhotoTaken(true); };
    reader.readAsDataURL(file);
  };
  const handleShiftEndComplete = async () => {
    if (!venuePhotoTaken || !selectedProject) return;
    setStokKaydediliyor(true);
    const tarih = bugunTarih();

    // Reyon modunda kapanisSayim'i reyon datadan hesapla
    let finalKapanisSayim = kapanisSayim;
    if (reyonAcik) {
      const computed: StokSayim = { ...migratedAcilisSayim };
      stokAlanlari.forEach(alan => {
        const reyonAcilis = shiftShelves[alan as string] || 0;
        const gunIciEkleme = reyonGunIciEkleme[alan as string] || 0;
        const reyonKapanis = reyonKapanisSayim[alan] || 0;
        const satilan = Math.max(0, (reyonAcilis + gunIciEkleme) - reyonKapanis);
        computed[alan] = Math.max(0, (migratedAcilisSayim[alan] || 0) - satilan);
      });
      finalKapanisSayim = computed;
    }

    // Yazıcı verilerini topla (ekipmanId bağlantılı, ribonMevcut dahil)
    const globalIade = Number(globalIadePhotos) || 0;
    const printerData = printers.map((pr, idx) => ({
      id: pr.ekipmanId,
      ekipmanId: pr.ekipmanId,
      label: pr.label,
      brand: pr.brand,
      model: pr.model,
      serialNumber: pr.serialNumber,
      startCounter: Number(pr.startCounter) || 0,
      endCounter: Number(printerEndCounters[pr.ekipmanId] || 0),
      ribonDegisim: Number(printerRibbonChanges[pr.ekipmanId] || 0),
      // Global iade ilk yazıcıya atanır (backend toplamIadeFotograf için)
      iadeFotograf: idx === 0 ? globalIade : 0,
      ribonMevcut: Number(printerEndCounters[pr.ekipmanId] || 0),
    }));

    const mekanId = resolvedMekanId || selectedProject.id;
    const resizedVenuePhoto = venuePhotoPreview ? await resizePhoto(venuePhotoPreview) : null;
    const result = await postKapanis(mekanId, tarih, finalKapanisSayim, kapanisNot, printerData, resizedVenuePhoto);
    setStokKaydediliyor(false);
    if (result && !('__hata' in result)) {
      setKapanisAnomali((result as any).anomali || {});
      setKapanisBeklenen((result as any).beklenen || null);
      setKapanisYaziciAnomali((result as any).kapanisYaziciAnomali || null);
      setStokGunluk((result as any).kayit);
      setShiftEndDone(true);
      setShowShiftEndSuccess(true);
      setTimeout(() => { setShowShiftEndSuccess(false); onNavigate('profile'); }, 3000);
    } else {
      // Hata nedenini backend'den gelen mesajla göster
      const hataMsg = (result && '__hata' in result)
        ? result.__hata
        : 'Sunucuya bağlanılamadı.';
      console.error('[Kapanış Hatası]', hataMsg);
      alert(`❌ Kapanış başarısız:\n\n${hataMsg}`);
    }
  };

  return (
    <div
      className={operasyonFullscreen
        ? 'fixed inset-0 z-[70] overflow-y-auto overscroll-contain flex flex-col'
        : 'pb-32 min-h-screen'
      }
      style={{ background: 'var(--app-bg, linear-gradient(to bottom, #0a051e, #120830, #1a0a3c))' }}
    >
      {/* Tam ekran modunda status bar boşluğu */}
      {operasyonFullscreen && (
        <div className="flex-shrink-0 h-safe-top" style={{ height: 'env(safe-area-inset-top, 44px)' }} />
      )}

      {(['yonetici', 'ust-mudur', 'mudur', 'idari'].includes(userRole) || !preSelectedProject) && (
        <ProjectSelector
          onProjectSelect={(project) => {
            setSelectedProject(project);
            if (onProjectSelect) onProjectSelect(project.name);
          }}
          selectedProject={selectedProject}
          onBack={onBack}
          userRole={userRole}
          userId={userId}
          userName={userName}
          onEkstraIsSelect={onEkstraIsSelect}
          onOzelIsSelect={onOzelIsSelect}
          refreshTrigger={saleRefreshTrigger}
          onLiveFeed={
            ['yonetici', 'ust-mudur', 'mudur', 'operasyon'].includes(userRole) && selectedProject
              ? () => setShowLiveFeed(true)
              : undefined
          }
        />
      )}

      {!selectedProject ? (
        <div className="px-6 py-12 text-center">
          <div className="text-6xl mb-4">📍</div>
          <h3 className="text-xl font-bold text-white mb-2">Lütfen Mekan Seçin</h3>
          <p className="text-sm text-gray-400">Vardiya işlemlerine başlamak için yukarıdan mekanınızı seçin</p>
        </div>
      ) : (
        <>

          {/* ── GECİKMİŞ KAYIT UYARI MODAL ── */}
          {showStaleModal && (
            <div
              style={{
                position: 'fixed', inset: 0, zIndex: 9999,
                background: 'rgba(0,0,0,0.85)',
                backdropFilter: 'blur(12px)',
                display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: '100%', maxWidth: 480,
                  background: 'linear-gradient(135deg, rgba(0,0,0,0.98) 0%, rgba(10,10,10,0.98) 100%)',
                  border: '1px solid rgba(255,180,50,0.3)',
                  borderRadius: '24px 24px 0 0',
                  padding: '24px 20px 36px',
                  maxHeight: '85vh',
                  overflowY: 'auto',
                }}
              >
                {/* Başlık */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 14,
                    background: 'linear-gradient(135deg, rgba(255,180,50,0.25) 0%, rgba(255,140,0,0.15) 100%)',
                    border: '1px solid rgba(255,180,50,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                  }}>⚠️</div>
                  <div>
                    <div style={{ color: '#ffd47a', fontWeight: 800, fontSize: 15 }}>Eski Offline Kayıt Bulundu</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>
                      {staleModalItems.length} kayıt 24 saatten daha eski
                    </div>
                  </div>
                </div>

                {/* Kayıt listesi */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  {staleModalItems.map((item, idx) => {
                    const isSatis = item.type === 'satis';
                    const d = item.data;
                    const gecikmeMs = Date.now() - d.queuedAt;

                    return (
                      <div
                        key={idx}
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: `1px solid ${isSatis ? 'rgba(157,217,234,0.2)' : 'rgba(212,181,247,0.2)'}`,
                          borderRadius: 16,
                          padding: '14px 16px',
                        }}
                      >
                        {/* Tip + mekan + gecikme */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 18 }}>{isSatis ? '🛒' : '🎞️'}</span>
                            <div>
                              <div style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>
                                {isSatis ? 'Satış' : 'Kare Kaydı'}
                              </div>
                              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
                                📍 {(d as QueuedSale).projectName || (d as QueuedFrame).projectName}
                              </div>
                            </div>
                          </div>
                          <div style={{
                            background: 'rgba(255,140,0,0.15)',
                            border: '1px solid rgba(255,140,0,0.3)',
                            borderRadius: 8, padding: '3px 8px',
                            color: '#ffd47a', fontSize: 11, fontWeight: 700,
                          }}>
                            ⏱ {formatDelay(gecikmeMs)}
                          </div>
                        </div>

                        {/* Kuyruğa alınma */}
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 8 }}>
                          🕐 {formatTs(d.queuedAt)}
                        </div>

                        {/* Detaylar */}
                        {isSatis ? (() => {
                          const s = d as QueuedSale;
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              {(s.items || []).map((it, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                  <span style={{ color: 'rgba(255,255,255,0.7)' }}>{it.product} x{it.quantity}</span>
                                  <span style={{ color: '#9dd9ea', fontWeight: 600 }}>
                                    {(it.unitPrice * it.quantity).toLocaleString('tr-TR')} TL
                                  </span>
                                </div>
                              ))}
                              {s.discount > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                  <span style={{ color: 'rgba(255,255,255,0.5)' }}>İskonto</span>
                                  <span style={{ color: '#ff8a80' }}>-{s.discount.toLocaleString('tr-TR')} TL</span>
                                </div>
                              )}
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                <span style={{ color: 'white', fontWeight: 700 }}>Toplam</span>
                                <span style={{ color: '#a8e6cf', fontWeight: 800 }}>{s.totalPrice.toLocaleString('tr-TR')} TL</span>
                              </div>
                              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>
                                💳 {payLabel(s.paymentMethod)}
                                {s.currencyPrice && s.currency !== 'TRY' ? ` · ${s.currencyPrice} ${s.currency}` : ''}
                              </div>
                            </div>
                          );
                        })() : (() => {
                          const f = d as QueuedFrame;
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Fotoğrafçı</span>
                                <span style={{ color: '#d4b5f7', fontWeight: 600 }}>{f.photographerName}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                <span style={{ color: 'rgba(255,255,255,0.6)' }}>Kare sayısı</span>
                                <span style={{ color: '#d4b5f7', fontWeight: 700 }}>{f.frameCount}</span>
                              </div>
                              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>🗓 {f.tarih}</div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>

                {/* Bilgi notu */}
                <div style={{
                  background: 'rgba(255,180,50,0.08)',
                  border: '1px solid rgba(255,180,50,0.2)',
                  borderRadius: 12, padding: '10px 14px',
                  color: 'rgba(255,212,122,0.8)', fontSize: 12,
                  marginBottom: 16, lineHeight: 1.5,
                }}>
                  "Yine de Gönder" seçildiğinde bu kayıtlar sunucuya iletilir ve yöneticilere gecikme bildirimi gönderilir.
                </div>

                {/* Butonlar */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => { setShowStaleModal(false); setStaleModalItems([]); }}
                    disabled={staleSending}
                    style={{
                      flex: 1, padding: '13px 0', borderRadius: 14,
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 14,
                      cursor: staleSending ? 'not-allowed' : 'pointer',
                      opacity: staleSending ? 0.5 : 1,
                    }}
                  >
                    Kapat
                  </button>
                  <button
                    onClick={handleStaleSend}
                    disabled={staleSending}
                    style={{
                      flex: 2, padding: '13px 0', borderRadius: 14,
                      background: staleSending
                        ? 'rgba(255,180,50,0.3)'
                        : 'linear-gradient(135deg, #ffd47a 0%, #ffaa00 100%)',
                      border: 'none',
                      color: staleSending ? 'rgba(255,255,255,0.6)' : '#1a0a00',
                      fontWeight: 800, fontSize: 14,
                      cursor: staleSending ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                  >
                    {staleSending ? (
                      <>
                        <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        Gönderiliyor...
                      </>
                    ) : (
                      <>📤 Yine de Gönder</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── 4 MODE TABS ── */}
          <div className="px-4 pb-3">
            <div className="flex gap-1 items-stretch bg-white/5 rounded-2xl p-1 border border-white/10">
              <button
                onClick={() => setActiveMode('shift-start')}
                className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold transition-all flex flex-col items-center gap-0.5 ${
                  activeMode === 'shift-start'
                    ? 'bg-gradient-to-br from-[#a8e6cf] to-[#8dd9b8] text-[#2d3748] shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <span className="text-base">{shiftStartDone ? '✅' : '🌅'}</span>
                <span>Açılış</span>
              </button>
              <button
                onClick={() => setActiveMode('sales')}
                className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold transition-all flex flex-col items-center gap-0.5 ${
                  activeMode === 'sales'
                    ? 'bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <span className="text-base">⚡</span>
                <span>Satış</span>
              </button>
              <button
                onClick={() => setActiveMode('frames')}
                className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold transition-all flex flex-col items-center gap-0.5 ${
                  activeMode === 'frames'
                    ? 'bg-gradient-to-br from-[#d4b5f7] to-[#c79ff0] text-[#2d3748] shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <div className="relative">
                  <span className="text-base">📷</span>
                  {pendingFrameCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#d4b5f7] rounded-full flex items-center justify-center text-[8px] font-black text-[#2d3748] leading-none">
                      {pendingFrameCount}
                    </span>
                  )}
                </div>
                <span>Kare</span>
              </button>
              <button
                onClick={() => setActiveMode('shift-end')}
                className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold transition-all flex flex-col items-center gap-0.5 ${
                  activeMode === 'shift-end'
                    ? 'bg-gradient-to-br from-[#ffb3ba] to-[#ff9ea5] text-[#2d3748] shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <span className="text-base">{shiftEndDone ? '✅' : '🏁'}</span>
                <span>Kapanış</span>
              </button>

              {/* Tam ekran butonu */}
              <button
                onClick={() => setOperasyonFullscreen(v => !v)}
                className={`w-9 self-stretch rounded-xl flex items-center justify-center transition-all active:scale-90 flex-shrink-0 ${
                  operasyonFullscreen
                    ? 'bg-white/20 text-white'
                    : 'text-gray-500 hover:text-white hover:bg-white/10'
                }`}
                title={operasyonFullscreen ? 'Küçült' : 'Tam Ekran'}
              >
                {operasyonFullscreen
                  ? <Minimize2 className="w-3.5 h-3.5" />
                  : <Maximize2 className="w-3.5 h-3.5" />
                }
              </button>
            </div>
          </div>

          {/* ══════════════════════════════════ */}
          {/* ── VARDIYA AÇILIŞ TAB ── */}
          {/* ══════════════════════════════════ */}
          {activeMode === 'shift-start' && (
            <div className="px-4 space-y-4 pb-8">
              {/* Mekan badge */}
              <div className="flex items-center gap-3 bg-gradient-to-br from-[#a8e6cf]/15 to-[#8dd9b8]/10 border border-[#a8e6cf]/30 rounded-2xl p-3">
                <span className="text-xl">{selectedProject.icon}</span>
                <div className="flex-1">
                  <div className="font-bold text-white text-sm">{selectedProject.name}</div>
                  <div className="text-xs text-[#a8e6cf]/70">Vardiya Açılışı</div>
                </div>
                {shiftStartDone && (
                  <span className="text-xs bg-[#a8e6cf]/20 text-[#a8e6cf] border border-[#a8e6cf]/30 rounded-lg px-2 py-1 font-semibold">Tamamlandı ✓</span>
                )}
              </div>

              {/* 1 — Açılış Stok Sayımı */}
              {stokYukleniyor ? (
                <div className="text-center py-6 text-gray-400 text-sm">Stok verisi yükleniyor...</div>
              ) : (
                <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] flex items-center justify-center shadow-lg">
                      <Package className="w-5 h-5 text-[#2d3748]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Açılış Stok Sayımı</h3>
                      <p className="text-xs text-gray-400">{dunKapanis ? 'Dünün kapanışından yüklendi — sayıp onaylayın' : 'Fiziksel sayım yapın'}</p>
                    </div>
                  </div>
                  {dunKapanis && !stokGunluk?.acilisYapildi && (
                    <div className="mb-3 bg-[#9dd9ea]/10 border border-[#9dd9ea]/25 rounded-xl px-3 py-2 flex items-center gap-2">
                      <span className="text-sm">📋</span>
                      <p className="text-xs text-[#9dd9ea]">Dünün kapanışından otomatik yüklendi. Fiziksel sayımı yapıp fark varsa düzeltin.</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    {stokAlanlari.map((alan) => {
                      const beklenen = migratedDunKapanis?.[alan] ?? null;
                      const gercek = migratedAcilisSayim[alan] ?? 0;
                      const fark = beklenen !== null ? gercek - (beklenen as number) : 0;
                      const sapmaVar = beklenen !== null && fark !== 0;
                      return (
                        <div key={alan} className="flex items-center justify-between bg-black/30 border border-white/10 rounded-xl px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{stokAlanEmoji[alan]}</span>
                            <div>
                              <span className="text-sm font-semibold text-white">{stokAlanAdi[alan]}</span>
                              {beklenen !== null && (
                                <p className="text-xs text-gray-500">Beklenen: {beklenen as number}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {sapmaVar && (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${fark > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {fark > 0 ? '+' : ''}{fark}
                              </span>
                            )}
                            <input
                              type="number"
                              inputMode="numeric"
                              value={acilisSayim[alan] || ''}
                              onChange={e => setAcilisSayim(p => ({ ...p, [alan]: parseInt(e.target.value) || 0 }))}
                              placeholder="0"
                              disabled={!!stokGunluk?.acilisYapildi}
                              className={`w-20 px-2 py-2 border rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#9dd9ea]/50 text-center font-bold text-lg disabled:opacity-60 ${
                                sapmaVar ? (fark < 0 ? 'bg-red-500/10 border-red-500/40' : 'bg-green-500/10 border-green-500/40') : 'bg-white/10 border-white/20'
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}

                    {/* ── Kağıt tipine göre dinamik ribon satırları ── */}
                    {(() => {
                      // Mekandaki yazıcıların kağıt tiplerinden benzersiz tipleri çıkar
                      const ribonTipleri = new Map<string, string>(); // kagitTipiId → name
                      for (const pr of printers) {
                        if (pr.kagitTipiId) {
                          const paper = availablePapers.find((p: any) => p.id === pr.kagitTipiId);
                          ribonTipleri.set(pr.kagitTipiId, paper?.name || pr.kagitTipiId);
                        }
                      }
                      // Kağıt tipi olmayan yazıcı varsa "Bilinmeyen" ekle
                      if (printers.some(pr => !pr.kagitTipiId) && printers.length > 0 && ribonTipleri.size === 0) {
                        ribonTipleri.set('_bilinmeyen', 'Ribon');
                      }
                      // Hiç yazıcı yoksa eski tek ribon alanını göster
                      if (ribonTipleri.size === 0) {
                        const beklenen = dunKapanis?.ribon ?? null;
                        const gercek = acilisSayim.ribon ?? 0;
                        const fark = beklenen !== null ? gercek - beklenen : 0;
                        const sapmaVar = beklenen !== null && fark !== 0;
                        return (
                          <div className="flex items-center justify-between bg-black/30 border border-white/10 rounded-xl px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">🎞️</span>
                              <div>
                                <span className="text-sm font-semibold text-white">Ribon Takımı</span>
                                {beklenen !== null && <p className="text-xs text-gray-500">Beklenen: {beklenen}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {sapmaVar && (
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${fark > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                  {fark > 0 ? '+' : ''}{fark}
                                </span>
                              )}
                              <input type="number" inputMode="numeric"
                                value={acilisSayim.ribon || ''}
                                onChange={e => setAcilisSayim(p => ({ ...p, ribon: parseInt(e.target.value) || 0 }))}
                                placeholder="0" disabled={!!stokGunluk?.acilisYapildi}
                                className={`w-20 px-2 py-2 border rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#9dd9ea]/50 text-center font-bold text-lg disabled:opacity-60 ${
                                  sapmaVar ? (fark < 0 ? 'bg-red-500/10 border-red-500/40' : 'bg-green-500/10 border-green-500/40') : 'bg-white/10 border-white/20'
                                }`}
                              />
                            </div>
                          </div>
                        );
                      }
                      const acilisRibonlar = acilisSayim.ribonlar || {};
                      const dunRibonlar = dunKapanis?.ribonlar || {};
                      return Array.from(ribonTipleri.entries()).map(([tipId, tipAdi]) => {
                        const beklenen = dunRibonlar[tipId] ?? (dunKapanis?.ribon != null && ribonTipleri.size === 1 ? dunKapanis.ribon : null);
                        const gercek = acilisRibonlar[tipId] ?? 0;
                        const fark = beklenen !== null ? gercek - beklenen : 0;
                        const sapmaVar = beklenen !== null && fark !== 0;
                        return (
                          <div key={`ribon_${tipId}`} className="flex items-center justify-between bg-pink-500/5 border border-pink-500/15 rounded-xl px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">🎞️</span>
                              <div>
                                <span className="text-sm font-semibold text-pink-200">{tipAdi} Ribon</span>
                                {beklenen !== null && <p className="text-xs text-gray-500">Beklenen: {beklenen}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {sapmaVar && (
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${fark > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                  {fark > 0 ? '+' : ''}{fark}
                                </span>
                              )}
                              <input type="number" inputMode="numeric"
                                value={acilisRibonlar[tipId] || ''}
                                onChange={e => {
                                  const val = parseInt(e.target.value) || 0;
                                  setAcilisSayim(p => {
                                    const yeniRibonlar = { ...(p.ribonlar || {}), [tipId]: val };
                                    const toplam = Object.values(yeniRibonlar).reduce((s, v) => s + (v || 0), 0);
                                    return { ...p, ribonlar: yeniRibonlar, ribon: toplam };
                                  });
                                }}
                                placeholder="0" disabled={!!stokGunluk?.acilisYapildi}
                                className={`w-20 px-2 py-2 border rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-pink-400/50 text-center font-bold text-lg disabled:opacity-60 ${
                                  sapmaVar ? (fark < 0 ? 'bg-red-500/10 border-red-500/40' : 'bg-green-500/10 border-green-500/40') : 'bg-pink-500/10 border-pink-500/20'
                                }`}
                              />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* Anomali uyarı bandı */}
                  {migratedDunKapanis && !stokGunluk?.acilisYapildi &&
                    stokAlanlari.some(a => (migratedAcilisSayim[a] ?? 0) !== (migratedDunKapanis[a] ?? 0)) && (
                    <div className="mt-4 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <p className="text-xs text-amber-300">Dünkü kapanıştan farklı — göndermeden önce kontrol edin.</p>
                    </div>
                  )}

                  {/* Kayıtlı anomali göster */}
                  {stokGunluk?.acilisYapildi && Object.keys(stokGunluk.acilisAnomali || {}).length > 0 && (
                    <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                      <p className="text-xs font-bold text-amber-400 mb-1">⚠️ Açılış anomalileri kaydedildi</p>
                      {(Object.entries(stokGunluk.acilisAnomali || {}) as [string, number][]).map(([alan, fark]) => (
                        <p key={alan} className="text-xs text-gray-300">
                          {stokAlanEmoji[alan]} {stokAlanAdi[alan]}: {fark > 0 ? '+' : ''}{fark}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Açılış notu — kayıt öncesi giriş, sonrası görüntü */}
                  {stokGunluk?.acilisYapildi ? (
                    stokGunluk.acilisNot ? (
                      <div className="mt-3 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                        <p className="text-xs text-gray-500 mb-0.5">Açılış notu</p>
                        <p className="text-sm text-gray-300">{stokGunluk.acilisNot}</p>
                      </div>
                    ) : null
                  ) : (
                    <textarea
                      value={acilisNot}
                      onChange={e => setAcilisNot(e.target.value)}
                      placeholder="Açılış notu (isteğe bağlı)..."
                      className="mt-3 w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-400 focus:outline-none resize-none"
                      rows={2}
                    />
                  )}
                </div>
              )}

              {/* Yazıcı Sayaç Anomali Uyarısı */}
              {yaziciAcilisAnomali.length > 0 && (
                <div className="backdrop-blur-xl bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <p className="text-xs font-bold text-amber-300">Yazıcı Sayaç Anomalisi Tespit Edildi</p>
                  </div>
                  <div className="space-y-2">
                    {yaziciAcilisAnomali.map((a: any, i: number) => (
                      <div key={i} className="bg-black/30 border border-amber-500/20 rounded-xl px-3 py-2">
                        <p className="text-xs font-semibold text-white mb-1">{a.label || `${a.ekipmanId}`}</p>
                        <p className="text-[10px] text-gray-400 font-mono">SN: {a.serialNumber || '—'}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs">
                          <span className="hidden">Son bitiş: <span className="text-white font-done-final">{null}</span></span>
                          <span className="text-gray-400">Açılış: <span className="text-[#ffd4a3] font-bold">{a.startCounter}</span></span>
                          <span className={`font-bold ${a.fark > 0 ? 'text-green-400' : 'text-red-400'}`}>{a.fark > 0 ? '+' : ''}{a.fark}</span>
                        </div>

                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setYaziciAcilisAnomali([])}
                    className="mt-2 w-full text-[10px] text-amber-300/50 text-center"
                  >
                    Uyarıyı kapat
                  </button>
                </div>
              )}

              {/* 2 — Yazıcı Sayaçları (ekipman kaydından otomatik) */}
              <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f] flex items-center justify-center shadow-lg">
                    <Printer className="w-5 h-5 text-[#744210]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Yazıcı Başlangıç Sayacı</h3>
                    <p className="text-xs text-gray-400">
                      {printers.length > 0
                        ? `${printers.length} yazıcı • ekipman kaydından`
                        : 'Kayıtlı yazıcı yok'}
                    </p>
                  </div>
                </div>
                {printers.length === 0 ? (
                  <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3 flex items-center gap-3">
                    <span className="text-lg">🖨️</span>
                    <p className="text-xs text-amber-300">
                      Bu mekana henüz yazıcı atanmamış. Malzeme Yönetimi'nden bu mekana yazıcı ekleyin.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {printers.map((printer) => (
                      <div key={printer.ekipmanId} className="bg-black/30 border border-white/10 rounded-xl p-3">
                        {/* Yazıcı kimlik bilgisi */}
                        <div className="flex items-center gap-2 mb-2.5">
                          <span className="text-base">🖨️</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{printer.brand} {printer.model}</p>
                            <p className="text-[10px] text-gray-500 font-mono">SN: {printer.serialNumber || '—'}</p>
                          </div>

                        </div>
                        {printer.beklenenStartCounter !== null && !stokGunluk?.acilisYapildi && (
                          <p className="text-[10px] text-[#ffd4a3]/70 mb-1.5 text-center">
                            Beklenen: <span className="font-bold text-[#ffd4a3]">{printer.beklenenStartCounter}</span>
                          </p>
                        )}
                        <input
                          type="number"
                          inputMode="numeric"
                          value={printer.startCounter}
                          onChange={e => updatePrinterStart(printer.ekipmanId, e.target.value)}
                          disabled={!!stokGunluk?.acilisYapildi}
                          placeholder="Yazıcıdan okuyun, girin"
                          className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-[#ffd4a3]/50 focus:outline-none focus:ring-2 focus:ring-[#ffd4a3]/50 text-center font-bold disabled:opacity-60"
                        />

                      </div>
                    ))}
                  </div>
                )}

              </div>

              {/* 3 — Reyon Albümleri */}
              <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] flex items-center justify-center shadow-lg">
                      <Grid3x3 className="w-5 h-5 text-[#2d3748]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Reyon</h3>
                      <p className="text-xs text-gray-400">Bugün reyon açılacak mı?</p>
                    </div>
                  </div>
                  {/* Toggle switch */}
                  <button
                    onClick={() => setReyonAcik(v => !v)}
                    disabled={!!stokGunluk?.acilisYapildi}
                    className={`relative w-12 h-6 rounded-full transition-colors disabled:opacity-50 ${reyonAcik ? 'bg-[#9dd9ea]' : 'bg-white/20'}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all ${reyonAcik ? 'left-[26px]' : 'left-0.5'}`} />
                  </button>
                </div>

                {reyonAcik ? (
                  <div className="space-y-2">
                    <p className="text-xs text-[#9dd9ea] bg-[#9dd9ea]/10 border border-[#9dd9ea]/20 rounded-xl px-3 py-2 mb-2">
                      Reyona koyulan albüm adedini girin — kapanışta kalanı sayacaksınız, fark = satılan
                    </p>
                    {aktifAlbumItems.map(({ key, label, emoji }) => (
                      <div key={key} className="flex items-center justify-between bg-black/30 border border-white/10 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{emoji}</span>
                          <span className="text-sm font-semibold text-white">{label}</span>
                        </div>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={shiftShelves[key] || ''}
                          onChange={e => setShiftShelves(p => ({ ...p, [key]: parseInt(e.target.value) || 0 }))}
                          placeholder="0"
                          disabled={!!stokGunluk?.acilisYapildi}
                          className="w-20 px-2 py-2 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#9dd9ea]/50 text-center font-bold text-lg disabled:opacity-60"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-center">
                    <p className="text-xs text-gray-500">Reyon kullanılmayacak — kapanışta tam stok sayımı yapılacak</p>
                  </div>
                )}
              </div>

              {/* 4 — Personel Fotoğrafı */}
              <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#a8e6cf] to-[#8dd9b8] flex items-center justify-center shadow-lg">
                    <Camera className="w-5 h-5 text-[#2d3748]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Personel Fotoğrafı</h3>
                    <p className="text-xs text-gray-400">Vardiya başlangıç kaydı</p>
                  </div>
                </div>
                {teamPhotoPreview ? (
                  <div className="relative">
                    <img src={teamPhotoPreview} alt="Personel" className="w-full h-44 object-cover rounded-xl border-2 border-[#a8e6cf]/50" />
                    <button
                      onClick={() => { setTeamPhotoPreview(null); setTeamPhotoTaken(false); }}
                      className="absolute top-2 right-2 bg-red-500 rounded-full p-1.5 shadow-lg active:scale-95"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                    <div className="mt-2 flex items-center gap-2 text-[#a8e6cf] text-sm font-semibold">
                      <CheckCircle className="w-4 h-4" /> Fotoğraf çekildi
                    </div>
                  </div>
                ) : (
                  <label className="block">
                    <input type="file" accept="image/*" capture="user" onChange={handleTeamPhoto} className="hidden" />
                    <div className="cursor-pointer bg-gradient-to-br from-[#a8e6cf] to-[#8dd9b8] rounded-xl py-4 flex items-center justify-center gap-2 transition-all active:scale-95">
                      <Camera className="w-5 h-5 text-[#2d3748]" />
                      <span className="font-bold text-[#2d3748]">Fotoğraf Çek</span>
                    </div>
                  </label>
                )}
                {!teamPhotoTaken && (
                  <div className="mt-3 bg-[#ffb3ba]/10 border border-[#ffb3ba]/30 rounded-xl p-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-[#ffb3ba] flex-shrink-0" />
                    <span className="text-xs text-gray-300">Personel fotoğrafı zorunludur</span>
                  </div>
                )}
              </div>

              {/* Vardiyayı Aç Butonu */}
              <button
                onClick={handleAcilisSubmitClick}
                disabled={
                  !!stokGunluk?.acilisYapildi ||
                  stokKaydediliyor ||
                  !teamPhotoTaken ||
                  !printers.some(p => p.startCounter.trim() !== '')
                }
                className={`w-full py-4 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 shadow-lg ${
                  !stokGunluk?.acilisYapildi && !stokKaydediliyor && teamPhotoTaken && printers.some(p => p.startCounter.trim() !== '')
                    ? 'bg-gradient-to-r from-[#a8e6cf] to-[#8dd9b8] text-[#2d3748] hover:shadow-xl active:scale-[0.98]'
                    : 'bg-white/10 text-gray-500 cursor-not-allowed border border-white/10'
                }`}
              >
                {stokKaydediliyor ? (
                  <span>Kaydediliyor...</span>
                ) : stokGunluk?.acilisYapildi ? (
                  <><CheckCircle className="w-5 h-5" /> Açılış Tamamlandı ✓</>
                ) : (
                  <><CheckCircle className="w-5 h-5" /> Vardiyayı Aç → Satışa Geç</>
                )}
              </button>

              {/* Açılışı Sıfırla — sadece açılış yapıldıysa göster */}
              {stokGunluk?.acilisYapildi && (
                <button
                  onClick={() => setShowAcilisSifirlaModal(true)}
                  className="w-full py-3 rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2 border border-red-500/40 text-red-400 bg-red-500/10 hover:bg-red-500/20 active:scale-[0.98]"
                >
                  <X className="w-4 h-4" />
                  Açılışı Sıfırla
                </button>
              )}
            </div>
          )}

          {/* Frame success toast */}
          <AnimatePresence>
            {frameShowSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mx-4 mb-2 bg-gradient-to-r from-[#a8e6cf] to-[#8dd9b8] text-[#1a4a2e] px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 font-bold text-sm"
              >
                <CheckCircle className="w-5 h-5" />
                Kare kaydı başarıyla eklendi!
              </motion.div>
            )}
          </AnimatePresence>

          {/* ══════════════════════════════════ */}
          {/* ── SATIŞ MODU ── */}
          {/* ══════════════════════════════════ */}
          {activeMode === 'sales' && (
            <div className="px-6 space-y-4 pb-8">
              {/* Product Grid */}
              <div>
                <label className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <span>Albüm Seç</span>
                  <span className="text-lg">📚</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {products.map((product) => (
                    <button
                      key={product.name}
                      onClick={() => addToCart(product.name, product.price)}
                      className={`relative aspect-square p-2 rounded-xl bg-gradient-to-br ${product.color} text-[#2d3748] transition-all active:scale-95 shadow-lg hover:shadow-xl group flex flex-col items-center justify-center`}
                    >
                      <div className="text-lg mb-0.5">{product.icon}</div>
                      <div className="text-[10px] font-bold leading-tight text-center">{product.name}</div>
                      <div className="text-[10px] opacity-90 font-semibold mt-0.5">{pSym}{product.price}</div>
                      <div className="absolute top-1 right-1 w-5 h-5 bg-white/20 backdrop-blur rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus className="w-3 h-3 text-[#2d3748]" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cart */}
              {cart.length > 0 && (
                <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border-2 border-[#9dd9ea]/50 rounded-2xl p-5 shadow-xl animate-in slide-in-from-bottom-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5 text-[#9dd9ea]" />
                      <h3 className="font-bold text-white">Sepet</h3>
                      <span className="px-2 py-1 bg-[#9dd9ea] text-[#2d3748] rounded-full text-xs font-bold">{totalItems}</span>
                    </div>
                    <button onClick={() => { setCart([]); setShowForeignNet(false); setForeignNetRawInput(''); setDiscountAmount(''); }} className="text-[#ffb3ba] hover:bg-[#ffb3ba]/10 p-2 rounded-lg transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2 mb-4">
                    {cart.map((item) => (
                      <div key={item.product} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center text-[#2d3748] font-bold shadow-md`}>
                            {item.quantity}
                          </div>
                          <div>
                            <span className="font-semibold text-white block">{item.product}</span>
                            <span className="text-xs text-gray-400">{item.quantity} × {pSym}{item.unitPrice} = {pSym}{item.quantity * item.unitPrice}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setCart(prev => prev.map(c => c.product === item.product ? { ...c, dijital: !c.dijital } : c))}
                            style={{
                              padding: '4px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                              background: item.dijital ? 'rgba(168,130,255,0.25)' : 'rgba(255,255,255,0.06)',
                              border: item.dijital ? '1px solid rgba(168,130,255,0.5)' : '1px solid rgba(255,255,255,0.1)',
                              color: item.dijital ? '#c4b5fd' : 'rgba(255,255,255,0.3)',
                              cursor: 'pointer', transition: 'all 0.2s',
                            }}
                          >
                            {item.dijital ? '📱 DİJİTAL' : '📱'}
                          </button>
                          <button onClick={() => removeFromCart(item.product)} className="w-8 h-8 rounded-lg bg-[#ffb3ba]/20 text-[#ffb3ba] hover:bg-[#ffb3ba]/30 flex items-center justify-center transition-all">
                            <X className="w-4 h-4" />
                          </button>
                          <button onClick={() => addToCart(item.product, item.unitPrice)} className="w-8 h-8 rounded-lg bg-[#9dd9ea] text-[#2d3748] hover:bg-[#7ec8dd] flex items-center justify-center transition-all">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-gradient-to-br from-[#b8d4f1] to-[#9dd9ea] rounded-2xl p-5 mb-4 shadow-lg">
                    <div className="text-[#2d3748]/70 text-sm mb-1">Toplam Tutar</div>
                    <div className="text-[#2d3748] text-4xl font-bold">{pSym}{totalPrice}</div>
                  </div>
                  {!showDiscount && !showForeignNet ? (
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => { setShowDiscount(true); setShowForeignNet(false); setForeignNetRawInput(''); }} className="bg-gradient-to-r from-[#ffd4a3] to-[#ffc78f] text-[#744210] py-4 rounded-2xl font-bold text-base hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg">
                        <Tag className="w-5 h-5" /> İskonto
                      </button>
                      <button onClick={handleProceed} className="bg-gradient-to-r from-[#9dd9ea] via-[#7ec8dd] to-[#9dd9ea] text-[#2d3748] py-4 rounded-2xl font-bold text-base hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg">
                        <Send className="w-5 h-5" /> İlerle
                      </button>
                    </div>
                  ) : !showForeignNet ? (
                    <div className="space-y-3">
                      <div className="bg-gradient-to-br from-[#ffd4a3]/20 to-[#ffc78f]/10 rounded-2xl p-4 border-2 border-[#ffd4a3]/30">
                        {/* Mod toggle */}
                        <div className="flex rounded-xl overflow-hidden border border-white/15 mb-3">
                          <button
                            onClick={() => { setDiscountMode('iskonto'); setDiscountRawInput(''); setDiscountAmount(''); }}
                            style={{ flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700, transition: 'all 0.2s', background: discountMode === 'iskonto' ? 'rgba(255,212,163,0.25)' : 'transparent', color: discountMode === 'iskonto' ? '#ffd4a3' : 'rgba(255,255,255,0.4)', borderRight: '1px solid rgba(255,255,255,0.1)' }}
                          >
                            İskonto Tutarı
                          </button>
                          <button
                            onClick={() => { setDiscountMode('fiyat'); setDiscountRawInput(''); setDiscountAmount(''); }}
                            style={{ flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700, transition: 'all 0.2s', background: discountMode === 'fiyat' ? 'rgba(168,230,207,0.25)' : 'transparent', color: discountMode === 'fiyat' ? '#a8e6cf' : 'rgba(255,255,255,0.4)' }}
                          >
                            Satış Fiyatı
                          </button>
                        </div>
                        <div style={{ borderRadius: 16, padding: 16, marginBottom: 12, textAlign: 'right', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', background: discountMode === 'iskonto' ? 'linear-gradient(135deg, #ffd4a3, #ffc78f)' : 'linear-gradient(135deg, #a8e6cf, #8dd9b8)' }}>
                          <div style={{ fontSize: 11, color: discountMode === 'iskonto' ? '#744210aa' : '#2d3748aa', marginBottom: 4 }}>{discountMode === 'iskonto' ? 'İskonto TL' : 'Satış Fiyatı TL'}</div>
                          <div style={{ fontSize: 28, fontWeight: 800, color: discountMode === 'iskonto' ? '#744210' : '#2d3748', minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>{discountRawInput || '0'}</div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          {['1','2','3','4','5','6','7','8','9'].map(num => (
                            <button key={num} onClick={() => {
                              if (discountRawInput.length >= 6) return;
                              const newVal = discountRawInput + num;
                              setDiscountRawInput(newVal);
                              if (discountMode === 'iskonto') { setDiscountAmount(newVal); }
                              else { const diff = totalPrice - Number(newVal); setDiscountAmount(String(diff)); }
                            }} className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xl font-bold py-3 rounded-xl transition-all active:scale-95">{num}</button>
                          ))}
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <button onClick={() => { setDiscountRawInput(''); setDiscountAmount(''); }} className="bg-[#ffb3ba]/20 text-[#ffb3ba] text-sm font-bold py-3 rounded-xl transition-all active:scale-95">C</button>
                          <button onClick={() => {
                            if (discountRawInput.length >= 6) return;
                            const newVal = discountRawInput + '0';
                            setDiscountRawInput(newVal);
                            if (discountMode === 'iskonto') { setDiscountAmount(newVal); }
                            else { const diff = totalPrice - Number(newVal); setDiscountAmount(diff > 0 ? String(diff) : '0'); }
                          }} className="bg-white/10 text-white text-xl font-bold py-3 rounded-xl transition-all active:scale-95">0</button>
                          <button onClick={() => {
                            const newVal = discountRawInput.slice(0, -1);
                            setDiscountRawInput(newVal);
                            if (discountMode === 'iskonto') { setDiscountAmount(newVal); }
                            else { const diff = totalPrice - (Number(newVal) || 0); setDiscountAmount(String(diff)); }
                          }} className="bg-[#ffd4a3]/20 text-[#ffd4a3] text-sm font-bold py-3 rounded-xl transition-all active:scale-95">⌫</button>
                        </div>
                        {(() => {
                          const disc = Number(discountAmount) || 0;
                          const odenecek = totalPrice - disc;
                          if (disc === 0) return null;
                          const isZam = disc < 0;
                          const pct = Math.round((Math.abs(disc) / totalPrice) * 100);
                          return (
                          <div className="bg-white/5 rounded-xl p-3 border-2 border-[#a8e6cf]/30 mb-3">
                            <div className="flex items-center justify-between text-sm mb-1"><span className="text-gray-400">Orijinal:</span><span className="font-semibold text-white">{pSym}{totalPrice}</span></div>
                            {isZam ? (
                              <div className="text-[11px] text-white/50 italic mb-1">↑ müşteri {pSym}{Math.abs(disc)} fazla ödüyor</div>
                            ) : (
                              <div className="flex items-center justify-between text-sm mb-1"><span className="text-[#ffd4a3] font-semibold">İskonto ({pct}%):</span><span className="font-semibold text-[#ffd4a3]">-{pSym}{disc}</span></div>
                            )}
                            <div className="border-t border-white/20 my-2" />
                            <div className="flex items-center justify-between"><span className="font-bold text-white">Ödenecek:</span><span className="font-bold text-2xl text-[#a8e6cf]">{pSym}{odenecek}</span></div>
                          </div>
                          );
                        })()}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => { setShowDiscount(false); setDiscountAmount(''); setDiscountRawInput(''); setDiscountMode('iskonto'); }} className="bg-white/10 text-white py-4 rounded-2xl font-bold text-base transition-all active:scale-[0.98]">İptal</button>
                        <button onClick={handleProceed} className="bg-gradient-to-r from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] py-4 rounded-2xl font-bold text-base hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg">
                          <Send className="w-5 h-5" /> İlerle
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Exchange Rates */}
              <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-xl p-4 shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2"><span className="text-lg">💱</span><h3 className="text-sm font-bold text-white">Güncel Kurlar & Çevirici</h3></div>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${ratesLoading ? 'bg-yellow-400 animate-pulse' : 'bg-[#a8e6cf] animate-pulse'}`} />
                    <span className="text-[10px] text-gray-400">{ratesLoading ? 'Yükleniyor' : 'Canlı'}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { code: 'TRY', flag: '🇹🇷', rate: 1, color: '#ffb3ba', sym: '₺' },
                    { code: 'USD', flag: '🇺🇸', rate: exchangeRates.USD, color: '#a8e6cf', sym: '$' },
                    { code: 'EUR', flag: '🇪🇺', rate: exchangeRates.EUR, color: '#9dd9ea', sym: '€' },
                    { code: 'GBP', flag: '🇬🇧', rate: exchangeRates.GBP, color: '#ffd4a3', sym: '£' },
                    { code: 'BGN', flag: '🇧🇬', rate: exchangeRates.BGN, color: '#c4b5fd', sym: 'лв' },
                    { code: 'RUB', flag: '🇷🇺', rate: exchangeRates.RUB, color: '#f9a8d4', sym: '₽' },
                    { code: 'SAR', flag: '🇸🇦', rate: exchangeRates.SAR, color: '#86efac', sym: '﷼' },
                  ].filter(c => c.code !== mekanPriceCurrency).map(c => (
                    <button key={c.code} onClick={() => setSelectedCurrency(c.code === 'TRY' ? (mekanPriceCurrency !== 'TRY' ? 'TRY' as any : null) : c.code as any)}
                      style={{ background: selectedCurrency === c.code ? `${c.color}22` : 'rgba(255,255,255,0.05)', border: selectedCurrency === c.code ? `2px solid ${c.color}88` : '2px solid transparent', borderRadius: 12, padding: '10px 4px', textAlign: 'center', transition: 'all 0.15s', cursor: 'pointer' }}
                    >
                      <div className="text-xs text-gray-400 mb-1 flex items-center justify-center gap-1"><span>{c.flag}</span><span>{c.code}</span></div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: c.color }}>{c.code === 'TRY' ? '₺ TRY' : `₺${c.rate.toFixed(2)}`}</div>
                      <div className="text-[10px] text-white/30 mt-0.5">{c.code === 'TRY' ? 'Türk Lirası' : `1 ${c.code}`}</div>
                    </button>
                  ))}
                </div>
                <div className="relative mb-3">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/20" /></div>
                  <div className="relative flex justify-center"><span className="bg-white/5 px-2 py-0.5 text-xs text-gray-400 rounded-full">🔄</span></div>
                </div>
                {cart.length > 0 ? (
                  <div className="space-y-2">
                    <div style={{ padding: 12, borderRadius: 12, border: '2px solid #a8e6cf88', background: '#a8e6cf22' }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span style={{ fontSize: 18 }}>🛒</span>
                          <div className="flex flex-col min-w-0">
                            <div className="text-xs text-gray-300 leading-tight">{discountAmount && Number(discountAmount) !== 0 ? 'Ödenecek Tutar' : 'Sepet Toplamı'}</div>
                            <div className="text-[10px] text-white/40 leading-tight">{totalItems} ürün</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 900, color: '#a8e6cf' }}>{pSym}{discountAmount && Number(discountAmount) !== 0 ? totalPrice - Number(discountAmount) : totalPrice}</div>
                      </div>
                    </div>
                    {selectedCurrency && (() => {
                      const cMap: Record<string, { flag: string; color: string }> = {
                        TRY: { flag: '🇹🇷', color: '#ffb3ba' }, USD: { flag: '🇺🇸', color: '#a8e6cf' }, EUR: { flag: '🇪🇺', color: '#9dd9ea' },
                        GBP: { flag: '🇬🇧', color: '#ffd4a3' }, BGN: { flag: '🇧🇬', color: '#c4b5fd' }, RUB: { flag: '🇷🇺', color: '#f9a8d4' }, SAR: { flag: '🇸🇦', color: '#86efac' },
                      };
                      const ci = cMap[selectedCurrency] || cMap.TRY;
                      const isClickable = (selectedCurrency as any) !== 'TRY';
                      return (
                      <>
                      <button
                        type="button"
                        onClick={isClickable ? () => { setShowDiscount(false); setShowForeignNet(true); setForeignNetRawInput(''); setForeignNetMode('fiyat'); setDiscountAmount(''); } : undefined}
                        disabled={!isClickable}
                        style={{ width: '100%', padding: 12, borderRadius: 12, border: `2px solid ${ci.color}88`, background: `${ci.color}22`, cursor: isClickable ? 'pointer' : 'default', textAlign: 'left' }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="text-xs text-gray-400">{ci.flag} {selectedCurrency}</div>
                            {isClickable && <span className="text-[9px] text-white/40">✏️ tıkla</span>}
                          </div>
                          <div style={{ fontSize: 28, fontWeight: 900, color: ci.color }}>{selectedCurrency === 'TRY' ? `₺${((totalPrice - (Number(discountAmount) || 0)) * (exchangeRates[mekanPriceCurrency as keyof typeof exchangeRates] || 1)).toFixed(0)}` : calculateForeignCurrency()}</div>
                        </div>
                      </button>
                      {showForeignNet && isClickable && (
                        <div className="space-y-3 mt-3">
                          <div className="rounded-2xl p-4 border-2" style={{ background: `${ci.color}10`, borderColor: `${ci.color}40` }}>
                            {/* Mod toggle */}
                            <div className="flex rounded-xl overflow-hidden border border-white/15 mb-3">
                              <button
                                onClick={() => { setForeignNetMode('iskonto'); setForeignNetRawInput(''); setDiscountAmount(''); }}
                                style={{ flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700, transition: 'all 0.2s', background: foreignNetMode === 'iskonto' ? 'rgba(255,212,163,0.25)' : 'transparent', color: foreignNetMode === 'iskonto' ? '#ffd4a3' : 'rgba(255,255,255,0.4)', borderRight: '1px solid rgba(255,255,255,0.1)' }}
                              >
                                İskonto Tutarı
                              </button>
                              <button
                                onClick={() => { setForeignNetMode('fiyat'); setForeignNetRawInput(''); setDiscountAmount(''); }}
                                style={{ flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700, transition: 'all 0.2s', background: foreignNetMode === 'fiyat' ? 'rgba(168,230,207,0.25)' : 'transparent', color: foreignNetMode === 'fiyat' ? '#a8e6cf' : 'rgba(255,255,255,0.4)' }}
                              >
                                Satış Fiyatı
                              </button>
                            </div>
                            {/* Display kutusu */}
                            <div style={{ borderRadius: 16, padding: 16, marginBottom: 12, textAlign: 'right', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', background: foreignNetMode === 'iskonto' ? 'linear-gradient(135deg, #ffd4a3, #ffc78f)' : 'linear-gradient(135deg, #a8e6cf, #8dd9b8)' }}>
                              <div style={{ fontSize: 11, color: foreignNetMode === 'iskonto' ? '#744210aa' : '#2d3748aa', marginBottom: 4 }}>{foreignNetMode === 'iskonto' ? `İskonto ${selectedCurrency}` : `Satış Fiyatı ${selectedCurrency}`}</div>
                              <div style={{ fontSize: 28, fontWeight: 800, color: foreignNetMode === 'iskonto' ? '#744210' : '#2d3748', minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>{foreignNetRawInput || '0'}</div>
                            </div>
                            {/* Numpad 1-9 */}
                            <div className="grid grid-cols-3 gap-2 mb-3">
                              {['1','2','3','4','5','6','7','8','9'].map(num => (
                                <button key={num} onClick={() => {
                                  if (foreignNetRawInput.length >= 6) return;
                                  const newVal = foreignNetRawInput + num;
                                  setForeignNetRawInput(newVal);
                                  applyForeignNet(newVal, foreignNetMode);
                                }} className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xl font-bold py-3 rounded-xl transition-all active:scale-95">{num}</button>
                              ))}
                            </div>
                            <div className="grid grid-cols-3 gap-2 mb-3">
                              <button onClick={() => { setForeignNetRawInput(''); setDiscountAmount(''); }} className="bg-[#ffb3ba]/20 text-[#ffb3ba] text-sm font-bold py-3 rounded-xl transition-all active:scale-95">C</button>
                              <button onClick={() => {
                                if (foreignNetRawInput.length >= 6) return;
                                const newVal = foreignNetRawInput + '0';
                                setForeignNetRawInput(newVal);
                                applyForeignNet(newVal, foreignNetMode);
                              }} className="bg-white/10 text-white text-xl font-bold py-3 rounded-xl transition-all active:scale-95">0</button>
                              <button onClick={() => {
                                const newVal = foreignNetRawInput.slice(0, -1);
                                setForeignNetRawInput(newVal);
                                applyForeignNet(newVal, foreignNetMode);
                              }} className="bg-[#ffd4a3]/20 text-[#ffd4a3] text-sm font-bold py-3 rounded-xl transition-all active:scale-95">⌫</button>
                            </div>
                            {/* Önizleme */}
                            {(() => {
                              const disc = Number(discountAmount) || 0;
                              const odenecek = totalPrice - disc;
                              if (disc === 0) return null;
                              const isZam = disc < 0;
                              return (
                                <div className="bg-white/5 rounded-xl p-3 border-2 border-[#a8e6cf]/30">
                                  <div className="flex items-center justify-between text-sm mb-1">
                                    <span className="text-gray-400">Sepet:</span>
                                    <span className="font-semibold text-white">{pSym}{totalPrice}</span>
                                  </div>
                                  {!isZam ? (
                                    <div className="flex items-center justify-between text-sm mb-1">
                                      <span className="text-[#ffd4a3] font-semibold">İskonto:</span>
                                      <span className="font-semibold text-[#ffd4a3]">-{pSym}{disc}</span>
                                    </div>
                                  ) : (
                                    <div className="text-[11px] text-white/50 italic mb-1">↑ müşteri {pSym}{Math.abs(disc)} fazla ödüyor</div>
                                  )}
                                  <div className="border-t border-white/20 my-2" />
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-white">Ödenecek:</span>
                                    <span className="font-bold text-2xl text-[#a8e6cf]">{pSym}{odenecek}</span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                          {/* Alt butonlar */}
                          <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => { setShowForeignNet(false); setForeignNetRawInput(''); setDiscountAmount(''); setForeignNetMode('fiyat'); setSelectedCurrency(null); }} className="bg-white/10 text-white py-4 rounded-2xl font-bold text-base transition-all active:scale-[0.98]">İptal</button>
                            <button onClick={handleProceed} className="bg-gradient-to-r from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] py-4 rounded-2xl font-bold text-base hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg">
                              <Send className="w-5 h-5" /> İlerle
                            </button>
                          </div>
                        </div>
                      )}
                      </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="bg-white/5 rounded-lg p-4 border border-white/20 text-center"><div className="text-3xl mb-2">🛒</div><div className="text-sm text-gray-400">Sepete ürün ekleyin</div></div>
                )}
              </div>

              {/* Recent Sales */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  Bugünkü Satışlar <span className="text-lg">📊</span>
                  {recentSales.filter(s => !s._pending).length > 0 && (
                    <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-[#a8e6cf]/20 text-[#a8e6cf]">
                      ₺{recentSales.filter(s => !s._pending).reduce((s, sale) => s + (sale.finalPrice || sale.totalPrice - sale.discount), 0).toLocaleString('tr-TR')}
                    </span>
                  )}
                </h3>

                {/* Çevrimdışı durum bandı */}
                {!isOnline && (
                  <div style={{ background: 'rgba(255,180,50,0.12)', border: '1px solid rgba(255,180,50,0.35)', borderRadius: 12, padding: '10px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>📡</span>
                    <span style={{ color: '#ffd4a3', fontSize: 12, fontWeight: 600 }}>Çevrimdışısınız — satışlar kuyruğa alınıyor</span>
                  </div>
                )}

                {/* Kuyrukta bekleyen + gönderiliyor bildirimi */}
                {pendingQueueCount > 0 && isOnline && (
                  <div style={{ background: 'rgba(157,217,234,0.12)', border: '1px solid rgba(157,217,234,0.35)', borderRadius: 12, padding: '10px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {queueFlushing ? (
                      <span className="w-3 h-3 border-2 border-[#9dd9ea]/40 border-t-[#9dd9ea] rounded-full animate-spin flex-shrink-0" />
                    ) : (
                      <span style={{ fontSize: 16 }}>🔄</span>
                    )}
                    <span style={{ color: '#9dd9ea', fontSize: 12, fontWeight: 600 }}>
                      {queueFlushing ? `${pendingQueueCount} satış sunucuya gönderiliyor...` : `${pendingQueueCount} satış senkronize bekliyor`}
                    </span>
                    {!queueFlushing && (
                      <button
                        onClick={flushOfflineQueue}
                        style={{ marginLeft: 'auto', fontSize: 11, color: '#9dd9ea', background: 'rgba(157,217,234,0.15)', border: '1px solid rgba(157,217,234,0.3)', borderRadius: 8, padding: '3px 10px', cursor: 'pointer', fontWeight: 700 }}
                      >
                        Şimdi Gönder
                      </button>
                    )}
                  </div>
                )}

                {satisSaving && (
                  <div className="flex items-center gap-2 text-xs text-[#a8e6cf] mb-2">
                    <span className="w-3 h-3 border-2 border-[#a8e6cf]/40 border-t-[#a8e6cf] rounded-full animate-spin" />
                    Satış kaydediliyor...
                  </div>
                )}
                <div className="space-y-2">
                  {recentSales.length === 0 ? (
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-center">
                      <div className="text-2xl mb-1">📋</div>
                      <div className="text-xs text-gray-400">Henüz satış kaydı yok</div>
                    </div>
                  ) : recentSales.map(sale => {
                    const itemSummary = sale.items?.map(i => `${i.dijital ? '📱 ' : ''}${i.quantity}× ${i.product}`).join(', ') || '—';
                    const saleTime = sale.timestamp
                      ? new Date(sale.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
                      : '—';
                    const pmIcon = sale.paymentMethod === 'cash' ? '💵' : sale.paymentMethod === 'iban' ? '🏦' : '💳';
                    const isPending = sale._pending === true;
                    return (
                      <div
                        key={sale.id}
                        style={isPending ? {
                          background: 'linear-gradient(135deg, rgba(255,180,50,0.10), rgba(255,180,50,0.05))',
                          border: '1px dashed rgba(255,180,50,0.45)',
                          borderRadius: 12,
                          padding: 16,
                        } : undefined}
                        className={isPending ? '' : 'backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-xl p-4'}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isPending ? (
                              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, rgba(255,180,50,0.3), rgba(255,140,0,0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                                ⏳
                              </div>
                            ) : (
                              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#a8e6cf] to-[#8dd9b8] flex items-center justify-center text-[#2d3748] text-lg shadow-md flex-shrink-0">✓</div>
                            )}
                            <div className="min-w-0">
                              <div className="font-semibold text-white text-sm truncate max-w-[160px]">{itemSummary}</div>
                              <div className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5 flex-wrap">
                                {isPending ? (
                                  <span style={{ color: '#ffd4a3', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span className="w-2.5 h-2.5 border-2 border-[#ffd4a3]/40 border-t-[#ffd4a3] rounded-full animate-spin inline-block" />
                                    İnternet bekleniyor...
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{saleTime}</span>
                                )}
                                <span>{pmIcon} {sale.paymentMethod === 'cash' ? 'Nakit' : sale.paymentMethod === 'iban' ? 'IBAN' : 'Kart'}</span>
                                {sale.kaydeden && <span className="text-[#9dd9ea]">👤 {sale.kaydeden}</span>}
                                {sale.currency !== 'TRY' && sale.currencyPrice && (
                                  <span className="text-[#ffd4a3]">{sale.currency} {sale.currencyPrice}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-right">
                              <div style={{ fontWeight: 700, fontSize: 14, color: isPending ? '#ffd4a3' : 'white' }}>
                                ₺{(sale.finalPrice ?? sale.totalPrice - sale.discount).toLocaleString('tr-TR')}
                              </div>
                              {sale.discount > 0 && (
                                <div className="text-xs text-[#ffd4a3] flex items-center gap-1 justify-end">
                                  <Tag className="w-3 h-3" />₺{sale.discount} indirim
                                </div>
                              )}
                            </div>
                            {/* Pending satışlar iptal edilemez, gerçek satışlar edilebilir */}
                            {!isPending && cart.length === 0 && (
                              <button onClick={() => openCancelModal(sale.id)} className="w-8 h-8 rounded-lg bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center transition-all active:scale-95">
                                <XCircle className="w-4 h-4 text-destructive" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════ */}
          {/* ── KARE GİRİŞİ MODU ── */}
          {/* ══════════════════════════════════ */}
          {activeMode === 'frames' && (
            <div className="px-4 space-y-3 pb-8">

              {/* Çevrimdışı durum bandı */}
              {!isOnline && (
                <div style={{ background: 'rgba(255,180,50,0.12)', border: '1px solid rgba(255,180,50,0.35)', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>📡</span>
                  <span style={{ color: '#ffd4a3', fontSize: 12, fontWeight: 600 }}>Çevrimdışısınız — kareler kuyruğa alınıyor</span>
                </div>
              )}

              {/* Bekleyen kare kuyruğu bildirimi */}
              {pendingFrameCount > 0 && isOnline && (
                <div style={{ background: 'rgba(212,181,247,0.12)', border: '1px solid rgba(212,181,247,0.35)', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {frameFlushing ? (
                    <span className="w-3 h-3 border-2 border-[#d4b5f7]/40 border-t-[#d4b5f7] rounded-full animate-spin flex-shrink-0" />
                  ) : (
                    <span style={{ fontSize: 16 }}>🔄</span>
                  )}
                  <span style={{ color: '#d4b5f7', fontSize: 12, fontWeight: 600 }}>
                    {frameFlushing ? `${pendingFrameCount} kare sunucuya gönderiliyor...` : `${pendingFrameCount} kare senkronize bekliyor`}
                  </span>
                  {!frameFlushing && (
                    <button
                      onClick={flushFrameQueue}
                      style={{ marginLeft: 'auto', fontSize: 11, color: '#d4b5f7', background: 'rgba(212,181,247,0.15)', border: '1px solid rgba(212,181,247,0.3)', borderRadius: 8, padding: '3px 10px', cursor: 'pointer', fontWeight: 700 }}
                    >
                      Şimdi Gönder
                    </button>
                  )}
                </div>
              )}

              {/* Seçili Mekan */}
              <div className="flex items-center gap-3 bg-gradient-to-br from-[#d4b5f7]/15 to-[#c79ff0]/10 border border-[#d4b5f7]/30 rounded-2xl p-3">
                <span className="text-xl">{selectedProject.icon}</span>
                <div className="flex-1">
                  <div className="font-bold text-white text-sm">{selectedProject.name}</div>
                  <div className="text-xs text-[#d4b5f7]/70">Seçili mekan</div>
                </div>
              </div>

              {/* Müşteri Sayısı Girişi */}
              <div className="backdrop-blur-xl bg-gradient-to-br from-[#ffd4a3]/10 to-[#ffd4a3]/5 border border-[#ffd4a3]/25 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">👥</span>
                  <span className="font-black text-white text-sm">Bugünkü Müşteri Sayısı</span>
                  {musteriSayisiKayitli && <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">✓ Kayıtlı</span>}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Müşteri sayısı..."
                    value={musteriSayisi}
                    onChange={e => { if (!musteriSayisiKayitli) setMusteriSayisi(e.target.value); }}
                    readOnly={musteriSayisiKayitli && !['yonetici', 'ust-mudur', 'mudur'].includes(userRole)}
                    inputMode="numeric"
                    className={`flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-lg font-black placeholder-gray-600 outline-none text-center ${musteriSayisiKayitli ? 'opacity-60' : 'focus:border-[#ffd4a3]/50'}`}
                  />
                  {!musteriSayisiKayitli ? (
                    <button
                      onClick={handleMusteriSayisiSave}
                      disabled={!musteriSayisi || parseInt(musteriSayisi) <= 0 || musteriSayisiSaving}
                      className={`px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                        musteriSayisi && parseInt(musteriSayisi) > 0 && !musteriSayisiSaving
                          ? 'bg-[#ffd4a3] text-[#2d3748] active:scale-95'
                          : 'bg-white/10 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {musteriSayisiSaving ? '...' : 'Kaydet'}
                    </button>
                  ) : ['yonetici', 'ust-mudur', 'mudur'].includes(userRole) && (
                    <button
                      onClick={() => setMusteriSayisiKayitli(false)}
                      className="px-3 py-3 rounded-xl text-xs font-bold border border-white/15 text-white/50 active:scale-95"
                    >
                      Düzelt
                    </button>
                  )}
                </div>
                {musteriSayisi && parseInt(musteriSayisi) > 0 && (
                  <div className="text-[11px] text-[#ffd4a3]/60 text-center">
                    Kota: {musteriSayisi} müşteri × {(selectedProject as any)?.kareCharpani || 5} = <span className="font-bold text-[#ffd4a3]">{parseInt(musteriSayisi) * ((selectedProject as any)?.kareCharpani || 5)} kare</span>
                  </div>
                )}
              </div>

              {!framePhotographer ? (
                <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Camera className="w-4 h-4 text-[#9dd9ea]" />
                    <span className="font-black text-white text-sm">Fotoğrafçı seç</span>
                  </div>
                  {rotationPersonnel.length > 0 ? (
                    <>
                      <p className="text-xs text-gray-400">Bugün bu mekanda rotasyonda:</p>
                      <div className="space-y-2">
                        {rotationPersonnel.map(p => (
                          <button
                            key={p.id}
                            onClick={() => setFramePhotographer(p)}
                            className="w-full flex items-center gap-3 bg-white/10 hover:bg-[#9dd9ea]/10 border border-white/15 rounded-xl p-3.5 text-left transition-all active:scale-95"
                          >
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9dd9ea]/30 to-[#7ec8dd]/20 flex items-center justify-center text-lg flex-shrink-0">{p.avatar}</div>
                            <div className="flex-1">
                              <div className="font-bold text-white text-sm">{p.name}</div>
                              <div className="text-xs text-[#9dd9ea]/80 flex items-center gap-1 mt-0.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#a8e6cf]" /> Rotasyonda
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4 bg-white/5 rounded-xl border border-white/10">
                      <div className="text-2xl mb-1">📋</div>
                      <p className="text-gray-400 text-xs">Bu mekan için bugün rotasyon kaydı yok.</p>
                    </div>
                  )}
                  <button
                    onClick={() => { setManualSearch(''); setShowManualPicker(true); }}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-dashed border-white/20 text-gray-400 hover:text-white hover:border-white/40 transition-all text-sm font-bold"
                  >
                    <UserPlus className="w-4 h-4" /> Listeden başka biri seç
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="backdrop-blur-xl bg-gradient-to-br from-[#9dd9ea]/15 to-[#9dd9ea]/5 border border-[#9dd9ea]/30 rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9dd9ea]/30 to-[#7ec8dd]/20 flex items-center justify-center text-lg">{framePhotographer.avatar}</div>
                    <div className="flex-1">
                      <div className="font-bold text-white text-sm">{framePhotographer.name}</div>
                      <div className="text-xs text-gray-400">Fotoğrafçı</div>
                    </div>
                    <button onClick={() => setFramePhotographer(null)} className="text-xs text-[#9dd9ea]/60 border border-[#9dd9ea]/20 rounded-lg px-2 py-1">Değiştir</button>
                  </div>

                  <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🎞️</span>
                      <span className="font-black text-white text-sm">Kaç kare teslim edildi?</span>
                    </div>
                    <input
                      type="number"
                      placeholder="Kare sayısını girin..."
                      value={frameCount}
                      onChange={e => setFrameCount(e.target.value)}
                      min="1"
                      autoFocus
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-4 text-white text-2xl font-black placeholder-gray-600 outline-none focus:border-[#ffd4a3]/50 text-center"
                    />
                    <div className="flex items-center justify-center gap-2 bg-white/5 rounded-xl px-4 py-2.5 border border-white/10">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-xs text-gray-400">Saat otomatik:</span>
                      <span className="text-xs font-black text-[#9dd9ea]">{new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <button
                      onClick={handleFrameSave}
                      disabled={!frameCount || parseInt(frameCount) <= 0 || frameSaving}
                      className={`w-full py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-2 ${
                        frameCount && parseInt(frameCount) > 0 && !frameSaving
                          ? 'bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] shadow-xl active:scale-95'
                          : 'bg-white/10 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {frameSaving ? (
                        <><span className="w-5 h-5 border-2 border-[#2d3748]/40 border-t-[#2d3748] rounded-full animate-spin" /> Kaydediliyor...</>
                      ) : '✅ Kareyi Kaydet'}
                    </button>
                  </div>
                </div>
              )}


              {/* Günün Kare Kayıtları */}
              {frameEntries.length > 0 && (
                <div className="backdrop-blur-xl bg-gradient-to-br from-white/8 to-white/3 border border-white/15 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Film className="w-4 h-4 text-[#d4b5f7]" />
                    <span className="font-black text-white text-sm">Bugünün Kayıtları</span>
                    <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-[#d4b5f7]/20 text-[#d4b5f7]">
                      {frameEntries.reduce((s: number, e: any) => s + (e.frameCount || 0), 0)} kare
                    </span>
                  </div>
                  <div className="space-y-2">
                    {frameEntries.map((entry: any) => {
                      const isPendingFrame = entry._pending === true;
                      return (
                      <div key={entry.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 border"
                        style={{
                          background: isPendingFrame ? 'rgba(212,181,247,0.07)' : 'rgba(255,255,255,0.05)',
                          borderColor: isPendingFrame ? 'rgba(212,181,247,0.3)' : 'rgba(255,255,255,0.10)',
                        }}
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#d4b5f7]/20 flex items-center justify-center text-sm flex-shrink-0">
                          {isPendingFrame ? '⏳' : '📸'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-white text-xs truncate">{entry.photographerName}</div>
                          <div className="text-xs text-gray-400 flex items-center gap-1">
                            {isPendingFrame ? (
                              <span style={{ color: '#d4b5f7', fontWeight: 600 }}>● Senkronize bekliyor</span>
                            ) : (
                              new Date(entry.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-black text-[#9dd9ea] text-sm">{entry.frameCount}</div>
                          <div className="text-xs text-gray-500">kare</div>
                        </div>
                        {!isPendingFrame && ['yonetici', 'ust-mudur', 'mudur', 'operasyon'].includes(userRole) && (
                          <button
                            onClick={() => openDeleteKareModal(entry)}
                            style={{
                              width: 30, height: 30, borderRadius: 10, flexShrink: 0,
                              background: 'rgba(248,113,113,0.10)',
                              border: '1px solid rgba(248,113,113,0.25)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer',
                            }}
                          >
                            <XCircle style={{ width: 14, height: 14, color: '#f87171' }} />
                          </button>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════ */}
          {/* ── VARDIYA KAPANIŞ TAB ── */}
          {/* ══════════════════════════════════ */}
          {activeMode === 'shift-end' && (
            <div className="px-4 space-y-4 pb-8">
              {/* Mekan badge */}
              <div className="flex items-center gap-3 bg-gradient-to-br from-[#ffb3ba]/15 to-[#ff9ea5]/10 border border-[#ffb3ba]/30 rounded-2xl p-3">
                <span className="text-xl">{selectedProject.icon}</span>
                <div className="flex-1">
                  <div className="font-bold text-white text-sm">{selectedProject.name}</div>
                  <div className="text-xs text-[#ffb3ba]/70">Vardiya Kapanışı</div>
                </div>
                {shiftEndDone && (
                  <span className="text-xs bg-[#a8e6cf]/20 text-[#a8e6cf] border border-[#a8e6cf]/30 rounded-lg px-2 py-1 font-semibold">Tamamlandı ✓</span>
                )}
              </div>

              {/* 1 — Yazıcı Bitiş Sayaçları + Ribon */}
              <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f] flex items-center justify-center shadow-lg">
                    <Printer className="w-5 h-5 text-[#744210]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-white text-sm">Yazıcı Kapanış</h3>
                    <p className="text-xs text-gray-400">
                      {printers.length > 0 ? `${printers.length} yazıcı` : 'Kayıtlı yazıcı yok'} • bitiş sayacı & ribon
                      {effectiveKapasite > 0 && (
                        <span className="text-[#a8e6cf]/70 ml-1">• kapasite: {effectiveKapasite}/takım</span>
                      )}
                    </p>
                  </div>
                </div>
                {needsManualInput && (
                  <div className="mb-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <p className="text-[10px] text-amber-300 font-medium">
                        Mekan ayarları yüklenemedi — baskı modunu manuel seçin
                      </p>
                    </div>
                    {/* Sadece Tam / Yarım seçici — kağıt tipi yazıcıdan geliyor */}
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1.5 font-semibold uppercase tracking-wide">Kağıt Modu</p>
                      <div className="flex gap-2">
                        {(['tam', 'yarim'] as const).map(mode => (
                          <button
                            key={mode}
                            onClick={() => setManualPrintType(mode)}
                            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                              manualPrintType === mode
                                ? 'bg-amber-400/20 border-amber-400/60 text-amber-300'
                                : 'bg-white/5 border-white/15 text-gray-400 active:scale-95'
                            }`}
                          >
                            {mode === 'tam' ? '▣ Tam Kağıt' : '▨ Yarım Kağıt'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div className="space-y-3">
                  {printers.map(printer => {
                    const start = Number(printer.startCounter) || 0;
                    const end = Number(printerEndCounters[printer.ekipmanId] || 0);
                    const ribbonCount = Number(printerRibbonChanges[printer.ekipmanId] || 0);
                    // Per-printer kapasite: önce kendi kagitTipiId'sinden bak, fallback: mekan/global kapasite
                    const yaziciPaperObj = printer.kagitTipiId
                      ? availablePapers.find((p: any) => p.id === printer.kagitTipiId)
                      : null;
                    const yaziciKapasite = yaziciPaperObj
                      ? Number(yaziciPaperObj.pcsPerBox) / Number(yaziciPaperObj.setsPerBox)
                      : effectiveKapasite;
                    // Canlı hesaplama: kullanilanBaskı = açılış + degisim×kapasite - kapanış
                    const kullanilanBaskı = yaziciKapasite > 0
                      ? Math.max(0, start + (ribbonCount * yaziciKapasite) - end)
                      : Math.max(0, start - end);
                    const carpan = effectivePrintType === 'tam' ? 1 : 2;
                    const cikisAdedi = Math.round(kullanilanBaskı * carpan);
                    const hasEndInput = !!printerEndCounters[printer.ekipmanId] && start > 0;
                    return (
                      <div key={printer.ekipmanId} className="bg-black/30 border border-white/10 rounded-xl p-3 space-y-3">
                        {/* Başlık — ekipman bilgisi */}
                        <div className="flex items-center gap-2">
                          <span className="text-base">🖨️</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{printer.brand} {printer.model}</p>
                            <p className="text-[10px] text-gray-500 font-mono">SN: {printer.serialNumber || '—'}</p>
                          </div>
                          {printer.startCounter && (
                            <span className="text-xs text-gray-400 shrink-0">Açılış: <span className="text-[#ffd4a3] font-bold">{printer.startCounter}</span></span>
                          )}
                        </div>
                        {/* Bitiş Sayacı */}
                        <div>
                          <p className="text-xs text-gray-400 mb-1.5">Bitiş Sayacı</p>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={printerEndCounters[printer.ekipmanId] || ''}
                            onChange={e => updatePrinterEnd(printer.ekipmanId, e.target.value)}
                            placeholder="0"
                            className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#ffd4a3]/50 text-center font-bold text-lg"
                          />
                          {hasEndInput && (
                            <div className="flex items-center justify-between bg-[#ffd4a3]/10 border border-[#ffd4a3]/20 rounded-lg px-3 py-1.5 mt-1.5">
                              <span className="text-xs text-gray-400">Kullanılan baskı:</span>
                              <span className="text-sm font-black text-[#ffd4a3]">{kullanilanBaskı} adet</span>
                            </div>
                          )}
                        </div>
                        {/* Ribon Değişimi */}
                        <div>
                          <p className="text-xs text-gray-400 mb-1.5 flex items-center gap-1.5">
                            <Film className="w-3.5 h-3.5 text-[#9dd9ea]" /> Ribon Değişim Adedi
                          </p>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={printerRibbonChanges[printer.ekipmanId] || ''}
                            onChange={e => updatePrinterRibbon(printer.ekipmanId, e.target.value)}
                            placeholder="0"
                            className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#9dd9ea]/50 text-center font-bold text-lg"
                          />
                          {ribbonCount > 0 && (
                            <div className="flex items-center justify-between bg-[#9dd9ea]/10 border border-[#9dd9ea]/20 rounded-lg px-3 py-1.5 mt-1.5">
                              <span className="text-xs text-gray-400">Değiştirilen ribon:</span>
                              <span className="text-sm font-black text-[#9dd9ea]">{ribbonCount} adet</span>
                            </div>
                          )}
                        </div>

                        {/* ── Canlı Hesaplama Özeti ── */}
                        {hasEndInput && (
                          <div className="bg-gradient-to-br from-[#a8e6cf]/10 to-[#8dd9b8]/5 border border-[#a8e6cf]/25 rounded-xl p-3">
                            <p className="text-[10px] text-[#a8e6cf]/70 font-semibold mb-2 uppercase tracking-wide">Vardiya Hesabı</p>
                            <div className="space-y-1.5">
                              {yaziciKapasite > 0 && (
                                <div className="text-[10px] text-gray-500 bg-black/20 rounded-lg px-2 py-1 font-mono">
                                  {start} + {ribbonCount}×{yaziciKapasite} − {end} = <span className="text-[#ffd4a3] font-bold">{kullanilanBaskı}</span> baskı
                                  {yaziciPaperObj && <span className="ml-1 text-[#9dd9ea]/60">({yaziciPaperObj.name})</span>}
                                </div>
                              )}
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">Kullanılan baskı</span>
                                <span className="text-sm font-black text-[#ffd4a3]">{kullanilanBaskı}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">
                                  Çıkış adedi
                                  {effectivePrintType === 'yarim' && <span className="text-gray-600 ml-1">(×2 yarım)</span>}
                                </span>
                                <span className="text-sm font-black text-[#9dd9ea]">{cikisAdedi}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* ── Global İade Fotoğraf Alanı ── */}
                {printers.length > 0 && (
                  <div className="mt-3 bg-[#ffb3ba]/8 border border-[#ffb3ba]/20 rounded-xl p-4">
                    <p className="text-xs text-gray-300 mb-2 flex items-center gap-1.5 font-semibold">
                      <span>↩️</span>
                      <span>İade Fotoğraf Adedi</span>
                      <span className="text-gray-500 text-[10px] font-normal">(isteğe bağlı — tüm yazıcılar toplam)</span>
                    </p>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={globalIadePhotos}
                      onChange={e => setGlobalIadePhotos(e.target.value)}
                      placeholder="0"
                      disabled={shiftEndDone}
                      className="w-full px-3 py-2.5 bg-[#ffb3ba]/10 border border-[#ffb3ba]/20 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#ffb3ba]/40 text-center font-bold text-lg disabled:opacity-60"
                    />
                    {Number(globalIadePhotos) > 0 && (
                      <p className="text-xs text-[#ffb3ba] mt-1.5 text-center">−{globalIadePhotos} adet net satıştan düşülecek</p>
                    )}
                  </div>
                )}

                {printers.length > 1 && (
                  <div className="mt-3 space-y-2">
                    <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 flex items-center justify-between">
                      <span className="text-xs text-gray-400">Toplam kullanılan baskı:</span>
                      <span className="text-sm font-black text-[#a8e6cf]">
                        {printers.reduce((sum, pr) => {
                          const s = Number(pr.startCounter) || 0;
                          const e = Number(printerEndCounters[pr.ekipmanId] || 0);
                          const r = Number(printerRibbonChanges[pr.ekipmanId] || 0);
                          const pObj = pr.kagitTipiId ? availablePapers.find((p: any) => p.id === pr.kagitTipiId) : null;
                          const kap = pObj ? Number(pObj.pcsPerBox) / Number(pObj.setsPerBox) : effectiveKapasite;
                          return sum + (kap > 0
                            ? Math.max(0, s + r * kap - e)
                            : Math.max(0, s - e));
                        }, 0)} adet
                      </span>
                    </div>
                    <div className="bg-[#9dd9ea]/10 border border-[#9dd9ea]/20 rounded-xl px-4 py-2.5 flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        Toplam çıkış {effectivePrintType === 'yarim' ? '(×2 yarım)' : '(tam)'}:
                      </span>
                      <span className="text-sm font-black text-[#9dd9ea]">
                        {printers.reduce((sum, pr) => {
                          const s = Number(pr.startCounter) || 0;
                          const e = Number(printerEndCounters[pr.ekipmanId] || 0);
                          const r = Number(printerRibbonChanges[pr.ekipmanId] || 0);
                          const pObj = pr.kagitTipiId ? availablePapers.find((p: any) => p.id === pr.kagitTipiId) : null;
                          const kap = pObj ? Number(pObj.pcsPerBox) / Number(pObj.setsPerBox) : effectiveKapasite;
                          const kb = kap > 0
                            ? Math.max(0, s + r * kap - e)
                            : Math.max(0, s - e);
                          return sum + Math.round(kb * (effectivePrintType === 'tam' ? 1 : 2));
                        }, 0)} adet
                      </span>
                    </div>
                    {printers.some(pr => Number(printerRibbonChanges[pr.ekipmanId] || 0) > 0) && (
                      <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 flex items-center justify-between">
                        <span className="text-xs text-gray-400">Toplam ribon değişimi:</span>
                        <span className="text-sm font-black text-[#9dd9ea]">
                          {printers.reduce((sum, pr) => sum + Number(printerRibbonChanges[pr.ekipmanId] || 0), 0)} adet
                        </span>
                      </div>
                    )}
                    {Number(globalIadePhotos) > 0 && (
                      <div className="bg-[#ffb3ba]/10 border border-[#ffb3ba]/20 rounded-xl px-4 py-2.5 flex items-center justify-between">
                        <span className="text-xs text-gray-400">İade fotoğraf:</span>
                        <span className="text-sm font-black text-[#ffb3ba]">
                          −{Number(globalIadePhotos)} adet
                        </span>
                      </div>
                    )}
                    {printers.some(pr => Number(printerEndCounters[pr.ekipmanId] || 0) > 0) && (
                      <div className="bg-[#d4b5f7]/10 border border-[#d4b5f7]/20 rounded-xl px-4 py-2.5 flex items-center justify-between">
                        <span className="text-xs text-gray-400">Yazıcılarda kalan ribon:</span>
                        <span className="text-sm font-black text-[#d4b5f7]">
                          {printers.reduce((sum, pr) => sum + Number(printerEndCounters[pr.ekipmanId] || 0), 0)} adet
                        </span>
                      </div>
                    )}
                    <div className="bg-gradient-to-r from-[#a8e6cf]/15 to-[#8dd9b8]/10 border border-[#a8e6cf]/30 rounded-xl px-4 py-2.5 flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Net Satılan 📸</span>
                      <span className="text-sm font-black text-[#a8e6cf]">
                        {netSatilanAdet} adet
                      </span>
                    </div>
                  </div>
                )}
              </div>


              {/* 4 — Kapanış Sayımı (accordion) */}
              <div>
                <button
                  onClick={() => setShowClosingCount(!showClosingCount)}
                  className="w-full backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 hover:border-[#ffd4a3]/50 rounded-2xl p-5 transition-all text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f] flex items-center justify-center shadow-lg">
                        <Package className="w-5 h-5 text-[#744210]" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm">
                          {reyonAcik ? 'Reyon Kapanış Sayımı' : 'Kapanış Stok Sayımı'}
                        </h3>
                        <p className="text-xs text-gray-400">
                          {reyonAcik ? 'Reyonda kalan albüm adedi' : 'Tüm ürünlerin kapanış miktarı'}
                        </p>
                      </div>
                    </div>
                    <motion.div animate={{ rotate: showClosingCount ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <svg className="w-5 h-5 text-[#ffd4a3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </motion.div>
                  </div>
                </button>

                <AnimatePresence>
                  {showClosingCount && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 backdrop-blur-xl bg-gradient-to-br from-white/8 to-white/3 border border-white/15 rounded-2xl p-5 space-y-3">

                        {/* ── REYON MODU ── */}
                        {reyonAcik ? (
                          <>
                            <div className="bg-[#9dd9ea]/10 border border-[#9dd9ea]/20 rounded-xl p-3">
                              <p className="text-xs font-semibold text-[#9dd9ea]">
                                📊 Gün içi ekleme yaptıysanız girin → Satılan = (Açılış + Ekleme) − Kalan
                              </p>
                            </div>

                            {aktifAlbumItems.map(({ key, label, emoji }) => {
                              const acilis = shiftShelves[key] || 0;
                              const gunIciEkleme = reyonGunIciEkleme[key] || 0;
                              const kapanis = reyonKapanisSayim[key as keyof StokSayim] || 0;
                              const satilan = Math.max(0, (acilis + gunIciEkleme) - kapanis);
                              return (
                                <div key={key} className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 space-y-2">
                                  {/* Başlık + satılan badge */}
                                  <div className="flex items-center gap-3">
                                    <span className="text-xl">{emoji}</span>
                                    <span className="text-sm font-semibold text-white flex-1">{label}</span>
                                    {satilan > 0 && (
                                      <span className="text-xs bg-[#a8e6cf]/20 text-[#a8e6cf] border border-[#a8e6cf]/30 rounded-lg px-2 py-0.5 font-bold">
                                        −{satilan} satıldı
                                      </span>
                                    )}
                                  </div>
                                  {/* 3 sütun: Açılış | +Ekleme | Kalan */}
                                  <div className="grid grid-cols-3 gap-2">
                                    {/* Açılış — salt okunur */}
                                    <div className="text-center">
                                      <p className="text-[10px] text-gray-500 mb-1">Açılış</p>
                                      <div className="w-full px-2 py-2 bg-white/5 border border-white/10 rounded-xl text-gray-400 text-center font-bold text-base">
                                        {acilis}
                                      </div>
                                    </div>
                                    {/* Gün içi ekleme */}
                                    <div className="text-center">
                                      <p className="text-[10px] text-[#ffd4a3] mb-1">+ Ekleme</p>
                                      <input
                                        type="number"
                                        inputMode="numeric"
                                        value={reyonGunIciEkleme[key] || ''}
                                        onChange={e => setReyonGunIciEkleme(p => ({ ...p, [key]: parseInt(e.target.value) || 0 }))}
                                        placeholder="0"
                                        disabled={shiftEndDone}
                                        className="w-full px-2 py-2 bg-[#ffd4a3]/10 border border-[#ffd4a3]/30 rounded-xl text-[#ffd4a3] placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#ffd4a3]/50 text-center font-bold text-base disabled:opacity-60"
                                      />
                                    </div>
                                    {/* Kalan */}
                                    {(() => {
                                      const satisDusum = kapanisSatisAlbumDusum[key] || 0;
                                      const absoluteMax = acilis + gunIciEkleme;
                                      const beklenenKalan = Math.max(0, absoluteMax - satisDusum);
                                      const imkansiz = kapanis > absoluteMax;
                                      const fazla = !imkansiz && kapanis > beklenenKalan && absoluteMax > 0;
                                      return (
                                        <div className="text-center">
                                          <p className="text-[10px] text-[#9dd9ea] mb-1">
                                            Kalan
                                            {absoluteMax > 0 && (
                                              <span className={fazla || imkansiz ? 'text-red-400' : 'text-gray-500'}>
                                                {' '}(bkl.{beklenenKalan})
                                              </span>
                                            )}
                                          </p>
                                          <input
                                            type="number"
                                            inputMode="numeric"
                                            value={reyonKapanisSayim[key as keyof StokSayim] || ''}
                                            onChange={e => setReyonKapanisSayim(p => ({ ...p, [key]: parseInt(e.target.value) || 0 }))}
                                            placeholder="0"
                                            disabled={shiftEndDone}
                                            className={`w-full px-2 py-2 border rounded-xl placeholder:text-gray-600 focus:outline-none focus:ring-2 text-center font-bold text-base disabled:opacity-60 ${
                                              imkansiz
                                                ? 'bg-red-500/10 border-red-500/50 text-red-400 focus:ring-red-500/50'
                                                : fazla
                                                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 focus:ring-amber-500/50'
                                                  : 'bg-[#9dd9ea]/10 border-[#9dd9ea]/30 text-[#9dd9ea] focus:ring-[#9dd9ea]/50'
                                            }`}
                                          />
                                          {imkansiz && (
                                            <p className="text-[9px] text-red-400 mt-0.5">⚠ Açılıştan fazla!</p>
                                          )}
                                          {!imkansiz && fazla && (
                                            <p className="text-[9px] text-amber-400 mt-0.5">⚠ Satıştan fazla kalan!</p>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                  {/* Özet satır */}
                                  {(acilis > 0 || gunIciEkleme > 0) && (
                                    <div className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-1.5 text-xs text-gray-400">
                                      <span>
                                        <span className="text-white">{acilis}</span>
                                        {gunIciEkleme > 0 && <span className="text-[#ffd4a3]"> +{gunIciEkleme}</span>}
                                        {' − '}
                                        <span className="text-[#9dd9ea]">{kapanis}</span>
                                      </span>
                                      <span className={`font-bold ${satilan > 0 ? 'text-[#a8e6cf]' : 'text-gray-500'}`}>
                                        = {satilan} satıldı
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {/* ── Kağıt tipine göre ribon satırları (kapanış) ── */}
                            {(() => {
                              // Yazıcıları kağıt tipine göre grupla
                              const ribonTipleri = new Map<string, string>();
                              for (const pr of printers) {
                                if (pr.kagitTipiId) {
                                  const paper = availablePapers.find((p: any) => p.id === pr.kagitTipiId);
                                  ribonTipleri.set(pr.kagitTipiId, paper?.name || pr.kagitTipiId);
                                }
                              }
                              if (ribonTipleri.size === 0) ribonTipleri.set('_bilinmeyen', 'Ribon');

                              const acilisRibonlar = acilisSayim.ribonlar || {};
                              const kapanisRibonlar = reyonKapanisSayim.ribonlar || {};

                              return Array.from(ribonTipleri.entries()).map(([tipId, tipAdi]) => {
                                // Bu tipteki yazıcıların ribon değişim toplamı
                                const tipDegisim = printers
                                  .filter(pr => (pr.kagitTipiId || '_bilinmeyen') === tipId)
                                  .reduce((sum, pr) => sum + Number(printerRibbonChanges[pr.ekipmanId] || 0), 0);
                                const ribonAcilis = acilisRibonlar[tipId] ?? (ribonTipleri.size === 1 ? (acilisSayim.ribon || 0) : 0);
                                const ribonBeklenen = Math.max(0, ribonAcilis - tipDegisim);
                                const ribonKapanis = kapanisRibonlar[tipId] || 0;
                                const ribonFark = ribonKapanis - ribonBeklenen;
                                const ribonSapma = ribonFark !== 0;
                                return (
                                  <div key={`ribon_kap_${tipId}`} className="bg-pink-500/5 border border-pink-500/15 rounded-xl px-4 py-3 space-y-2">
                                    <div className="flex items-center gap-3">
                                      <span className="text-xl">🎞️</span>
                                      <span className="text-sm font-semibold text-pink-200 flex-1">{tipAdi} Ribon</span>
                                      {ribonSapma && (
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 ${ribonFark > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                          {ribonFark > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                          {ribonFark > 0 ? '+' : ''}{ribonFark}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-[#9dd9ea]/80">
                                      Açılış <span className="font-bold text-white">{ribonAcilis}</span>
                                      {' − '}Değişim <span className="font-bold text-[#ffd4a3]">{tipDegisim}</span>
                                      {' = '}Beklenen <span className="font-bold text-[#9dd9ea]">{ribonBeklenen}</span>
                                    </p>
                                    <input
                                      type="number" inputMode="numeric"
                                      value={kapanisRibonlar[tipId] || ''}
                                      onChange={e => {
                                        const val = parseInt(e.target.value) || 0;
                                        setReyonKapanisSayim(p => {
                                          const yeniRibonlar = { ...(p.ribonlar || {}), [tipId]: val };
                                          const toplam = Object.values(yeniRibonlar).reduce((s, v) => s + (v || 0), 0);
                                          return { ...p, ribonlar: yeniRibonlar, ribon: toplam };
                                        });
                                      }}
                                      placeholder="0" disabled={shiftEndDone}
                                      className={`w-full px-3 py-2.5 border rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-pink-400/50 text-center font-bold text-lg disabled:opacity-60 ${
                                        ribonSapma ? (ribonFark < 0 ? 'bg-red-500/10 border-red-500/40' : 'bg-green-500/10 border-green-500/40') : 'bg-pink-500/10 border-pink-500/20'
                                      }`}
                                    />
                                  </div>
                                );
                              });
                            })()}

                            {/* Toplam satış özeti */}
                            {aktifAlbumItems.some(({ key }) => (shiftShelves[key] || 0) > 0 || (reyonGunIciEkleme[key] || 0) > 0) && (
                              <div className="bg-[#a8e6cf]/10 border border-[#a8e6cf]/20 rounded-xl p-3">
                                <p className="text-xs font-semibold text-[#a8e6cf] mb-2">🎯 Reyon satış özeti:</p>
                                <div className="flex flex-wrap gap-x-4 gap-y-1">
                                  {aktifAlbumItems.map(({ key, label }) => {
                                    const acilis = shiftShelves[key] || 0;
                                    const gunIciEkleme = reyonGunIciEkleme[key] || 0;
                                    if (acilis === 0 && gunIciEkleme === 0) return null;
                                    const kapanis = reyonKapanisSayim[key as keyof StokSayim] || 0;
                                    const satilan = Math.max(0, (acilis + gunIciEkleme) - kapanis);
                                    return (
                                      <span key={key} className="text-xs text-gray-300">
                                        {label}: <strong className="text-[#a8e6cf]">{satilan} satıldı</strong>
                                        {gunIciEkleme > 0 && <span className="text-[#ffd4a3]"> (+{gunIciEkleme} eklendi)</span>}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          /* ── TAM STOK MODU ── */
                          <>
                            {kapanisBeklenen && (
                              <div className="bg-[#9dd9ea]/10 border border-[#9dd9ea]/20 rounded-xl p-3">
                                <p className="text-xs font-semibold text-[#9dd9ea] mb-1">📊 Beklenen kapanış (açılış + eklemeler)</p>
                                <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                                  {stokAlanlari.filter(a => (kapanisBeklenen[a] ?? 0) > 0).map(alan => (
                                    <span key={alan} className="text-xs text-gray-400">{stokAlanEmoji[alan]} {kapanisBeklenen[alan]}</span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {stokAlanlari.map((alan) => {
                              // Albümler için client-side beklenen: açılış + eklemeler − satılan
                              const albumAcilis = (migratedAcilisSayim[alan] || 0);
                              const albumEkleme = stokEklemeler.reduce((s, ek) => s + ((ek.miktar as Record<string, number>)[alan] || 0), 0);
                              const albumSatilan = kapanisSatisAlbumDusum[alan] || 0;
                              const clientBeklenenAlbum = Math.max(0, albumAcilis + albumEkleme - albumSatilan);

                              // Kapanış öncesi: her zaman client hesabını göster; sonrası: server değeri
                              let beklenen: number | null = kapanisBeklenen?.[alan] ?? null;
                              if (!shiftEndDone) {
                                beklenen = stokGunluk?.acilisYapildi ? clientBeklenenAlbum : null;
                              }

                              const gercek = kapanisSayim[alan] ?? 0;
                              const fark = beklenen !== null ? gercek - beklenen : 0;
                              const sapmaVar = beklenen !== null && fark !== 0;
                              return (
                                <div key={alan} className="bg-black/30 border border-white/10 rounded-xl px-4 py-3">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <span className="text-xl">{stokAlanEmoji[alan]}</span>
                                      <div>
                                        <span className="text-sm font-semibold text-white">{stokAlanAdi[alan]}</span>
                                        {beklenen !== null ? (
                                          <p className="text-xs text-[#9dd9ea]/70 mt-0.5">
                                            <span className="text-white">{albumAcilis}</span>
                                            {albumEkleme > 0 && <span className="text-[#ffd4a3]"> +{albumEkleme}</span>}
                                            {albumSatilan > 0 && <span className="text-[#ffb3ba]"> −{albumSatilan} satıldı</span>}
                                            {' = '}Beklenen <span className="font-bold text-[#9dd9ea]">{beklenen}</span>
                                          </p>
                                        ) : null}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {sapmaVar && (
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 ${fark > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                          {fark > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                          {fark > 0 ? '+' : ''}{fark}
                                        </span>
                                      )}
                                      <input
                                        type="number"
                                        inputMode="numeric"
                                        value={kapanisSayim[alan] || ''}
                                        onChange={e => setKapanisSayim(p => ({ ...p, [alan]: parseInt(e.target.value) || 0 }))}
                                        placeholder="0"
                                        disabled={shiftEndDone}
                                        className={`w-20 px-2 py-2 border rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#ffd4a3]/50 text-center font-bold text-lg disabled:opacity-60 ${
                                          sapmaVar ? (fark < 0 ? 'bg-red-500/10 border-red-500/40' : 'bg-green-500/10 border-green-500/40') : 'bg-white/10 border-white/20'
                                        }`}
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                            {/* ── Kağıt tipine göre ribon kapanış (tam stok modu) ── */}
                            {(() => {
                              const ribonTipleri = new Map<string, string>();
                              for (const pr of printers) {
                                if (pr.kagitTipiId) {
                                  const paper = availablePapers.find((p: any) => p.id === pr.kagitTipiId);
                                  ribonTipleri.set(pr.kagitTipiId, paper?.name || pr.kagitTipiId);
                                }
                              }
                              if (ribonTipleri.size === 0) ribonTipleri.set('_bilinmeyen', 'Ribon');
                              const acilisRibonlar = acilisSayim.ribonlar || {};
                              const kapRibonlar = kapanisSayim.ribonlar || {};
                              return Array.from(ribonTipleri.entries()).map(([tipId, tipAdi]) => {
                                const tipDegisim = printers
                                  .filter(pr => (pr.kagitTipiId || '_bilinmeyen') === tipId)
                                  .reduce((sum, pr) => sum + Number(printerRibbonChanges[pr.ekipmanId] || 0), 0);
                                const ribonAcilis = acilisRibonlar[tipId] ?? (ribonTipleri.size === 1 ? (acilisSayim.ribon || 0) : 0);
                                const ribonBeklenen = Math.max(0, ribonAcilis - tipDegisim);
                                const gercek = kapRibonlar[tipId] || 0;
                                const fark = gercek - ribonBeklenen;
                                const sapmaVar = fark !== 0;
                                return (
                                  <div key={`ribon_full_${tipId}`} className="bg-pink-500/5 border border-pink-500/15 rounded-xl px-4 py-3">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <span className="text-xl">🎞️</span>
                                        <div>
                                          <span className="text-sm font-semibold text-pink-200">{tipAdi} Ribon</span>
                                          <p className="text-xs text-[#9dd9ea]/80 mt-0.5">
                                            Açılış <span className="font-bold text-white">{ribonAcilis}</span>
                                            {' − '}Değişim <span className="font-bold text-[#ffd4a3]">{tipDegisim}</span>
                                            {' = '}Beklenen <span className="font-bold text-[#9dd9ea]">{ribonBeklenen}</span>
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {sapmaVar && (
                                          <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${fark > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {fark > 0 ? '+' : ''}{fark}
                                          </span>
                                        )}
                                        <input type="number" inputMode="numeric"
                                          value={kapRibonlar[tipId] || ''}
                                          onChange={e => {
                                            const val = parseInt(e.target.value) || 0;
                                            setKapanisSayim(p => {
                                              const yeniRibonlar = { ...(p.ribonlar || {}), [tipId]: val };
                                              const toplam = Object.values(yeniRibonlar).reduce((s, v) => s + (v || 0), 0);
                                              return { ...p, ribonlar: yeniRibonlar, ribon: toplam };
                                            });
                                          }}
                                          placeholder="0" disabled={shiftEndDone}
                                          className={`w-20 px-2 py-2 border rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-pink-400/50 text-center font-bold text-lg disabled:opacity-60 ${
                                            sapmaVar ? (fark < 0 ? 'bg-red-500/10 border-red-500/40' : 'bg-green-500/10 border-green-500/40') : 'bg-pink-500/10 border-pink-500/20'
                                          }`}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              });
                            })()}

                            {!shiftEndDone && !reyonAcik && stokGunluk?.acilis &&
                              stokAlanlari.some(a => {
                                let bek = (migrateStok(stokGunluk!.acilis as StokSayim, effectivePrintType))[a] || 0;
                                for (const ek of stokEklemeler) bek += (ek.miktar as Record<string, number>)[a] || 0;
                                bek -= kapanisSatisAlbumDusum[a] || 0;
                                return (kapanisSayim[a] ?? 0) !== Math.max(0, bek);
                              }) && (
                              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                                <p className="text-xs text-amber-300">Stok sapması var — göndermeden önce kontrol edin.</p>
                              </div>
                            )}
                          </>
                        )}

                        {/* Kapanış notu — her iki modda da */}
                        {shiftEndDone ? (
                          stokGunluk?.kapanisNot ? (
                            <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                              <p className="text-xs text-gray-500 mb-0.5">Kapanış notu</p>
                              <p className="text-sm text-gray-300">{stokGunluk.kapanisNot}</p>
                            </div>
                          ) : null
                        ) : (
                          <textarea
                            value={kapanisNot}
                            onChange={e => setKapanisNot(e.target.value)}
                            placeholder="Kapanış notu (isteğe bağlı)..."
                            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-400 focus:outline-none resize-none"
                            rows={2}
                          />
                        )}

                                {shiftEndDone && Object.keys(kapanisAnomali).length > 0 && (
                          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                            <p className="text-xs font-bold text-amber-400 mb-1">⚠️ Kapanış anomalileri kaydedildi</p>
                            {(Object.entries(kapanisAnomali) as [string, number][]).map(([alan, fark]) => (
                              <p key={alan} className="text-xs text-gray-300">
                                {stokAlanEmoji[alan]} {stokAlanAdi[alan]}: {fark > 0 ? '+' : ''}{fark}
                              </p>
                            ))}
                          </div>
                        )}

                        {shiftEndDone && kapanisYaziciAnomali && (
                          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                            <p className="text-xs font-bold text-red-400 mb-1">🖨️ Bitiş Sayacı Anomalisi Kaydedildi</p>
                            <p className="text-xs text-gray-300">
                              Yazıcı net satılan: <span className="text-white font-bold">{kapanisYaziciAnomali.netSatilan}</span>
                            </p>
                            <p className="text-xs text-gray-300">
                              Satış toplamı: <span className="text-white font-bold">{kapanisYaziciAnomali.satisToplam}</span>
                            </p>
                            <p className="text-xs text-red-300 font-semibold mt-1">
                              Fark: {kapanisYaziciAnomali.fark > 0 ? '+' : ''}{kapanisYaziciAnomali.fark} fotoğraf → Vardiya ekibine 1'er puan yazıldı
                            </p>
                          </div>
                        )}

                        {/* Vardiya baskı & satış özeti — kapanış sonrası */}
                        {shiftEndDone && (stokGunluk as any)?.vardiyaToplam && (() => {
                          const vt = (stokGunluk as any).vardiyaToplam;
                          return (
                            <div className="bg-gradient-to-br from-[#a8e6cf]/10 to-[#8dd9b8]/5 border border-[#a8e6cf]/25 rounded-xl p-4 space-y-2">
                              <p className="text-xs font-bold text-[#a8e6cf] mb-2">📊 Vardiya Baskı & Satış Özeti</p>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="bg-black/20 rounded-xl px-3 py-2 text-center">
                                  <p className="text-[10px] text-gray-500 mb-0.5">Kullanılan Baskı</p>
                                  <p className="text-base font-black text-white">{vt.toplamKullanilanBaskı}</p>
                                  <p className="text-[10px] text-gray-600">stok düşümü</p>
                                </div>
                                <div className="bg-black/20 rounded-xl px-3 py-2 text-center">
                                  <p className="text-[10px] text-gray-500 mb-0.5">Çıkış Adedi</p>
                                  <p className="text-base font-black text-[#9dd9ea]">{vt.toplamCikisAdedi}</p>
                                  <p className="text-[10px] text-gray-600">{vt.printType === 'tam' ? 'tam kağıt' : 'yarım kağıt ×2'}</p>
                                </div>
                                {vt.toplamIadeFotograf > 0 && (
                                  <div className="bg-black/20 rounded-xl px-3 py-2 text-center">
                                    <p className="text-[10px] text-gray-500 mb-0.5">İade</p>
                                    <p className="text-base font-black text-[#ffb3ba]">−{vt.toplamIadeFotograf}</p>
                                    <p className="text-[10px] text-gray-600">fotoğraf</p>
                                  </div>
                                )}
                                <div className="bg-black/20 rounded-xl px-3 py-2 text-center">
                                  <p className="text-[10px] text-gray-500 mb-0.5">Satılan</p>
                                  <p className="text-base font-black text-[#a8e6cf]">{vt.toplamSatılanFotograf}</p>
                                  <p className="text-[10px] text-gray-600">net fotoğraf</p>
                                </div>
                                {vt.toplamMaliyet > 0 && userRole === 'yonetici' && (
                                  <div className={`bg-black/20 rounded-xl px-3 py-2 text-center ${vt.toplamIadeFotograf > 0 ? '' : 'col-span-2'}`}>
                                    <p className="text-[10px] text-gray-500 mb-0.5">Toplam Maliyet</p>
                                    <p className="text-base font-black text-[#ffd4a3]">
                                      {vt.toplamMaliyet.toFixed(2)} {vt.currency}
                                    </p>
                                    {vt.paperName && <p className="text-[10px] text-gray-600">{vt.paperName}</p>}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 5 — Mekan Genel Görünüm Fotoğrafı */}
              <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] flex items-center justify-center shadow-lg">
                    <Camera className="w-5 h-5 text-[#2d3748]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Mekan Genel Görünüm</h3>
                    <p className="text-xs text-gray-400">Reyon dahil kapanış fotoğrafı</p>
                  </div>
                </div>
                {venuePhotoPreview ? (
                  <div className="relative">
                    <img src={venuePhotoPreview} alt="Mekan" className="w-full h-44 object-cover rounded-xl border-2 border-[#9dd9ea]/50" />
                    <button
                      onClick={() => { setVenuePhotoPreview(null); setVenuePhotoTaken(false); }}
                      className="absolute top-2 right-2 bg-red-500 rounded-full p-1.5 shadow-lg active:scale-95"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                    <div className="mt-2 flex items-center gap-2 text-[#a8e6cf] text-sm font-semibold">
                      <CheckCircle className="w-4 h-4" /> Fotoğraf çekildi
                    </div>
                  </div>
                ) : (
                  <label className="block">
                    <input type="file" accept="image/*" capture="environment" onChange={handleVenuePhoto} className="hidden" />
                    <div className="cursor-pointer bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] rounded-xl py-4 flex items-center justify-center gap-2 transition-all active:scale-95">
                      <Camera className="w-5 h-5 text-[#2d3748]" />
                      <span className="font-bold text-[#2d3748]">Fotoğraf Çek</span>
                    </div>
                  </label>
                )}
                {!venuePhotoTaken && (
                  <div className="mt-3 bg-[#ffb3ba]/10 border border-[#ffb3ba]/30 rounded-xl p-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-[#ffb3ba] flex-shrink-0" />
                    <span className="text-xs text-gray-300">Mekan fotoğrafı zorunludur</span>
                  </div>
                )}
              </div>

              {/* Vardiyayı Tamamla */}
              <button
                onClick={handleKapanisSubmitClick}
                disabled={
                  shiftEndDone ||
                  stokKaydediliyor ||
                  !venuePhotoTaken
                }
                className={`w-full py-4 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 shadow-lg ${
                  !shiftEndDone && !stokKaydediliyor && venuePhotoTaken
                    ? 'bg-gradient-to-r from-[#a8e6cf] to-[#8dd9b8] text-[#2d3748] hover:shadow-xl active:scale-[0.98]'
                    : 'bg-white/10 text-gray-500 cursor-not-allowed border border-white/10'
                }`}
              >
                {stokKaydediliyor ? (
                  <span>Kaydediliyor...</span>
                ) : shiftEndDone ? (
                  <><CheckCircle className="w-5 h-5" /> Kapanış Tamamlandı ✓</>
                ) : (
                  <><CheckCircle className="w-5 h-5" /> Vardiyayı Tamamla</>
                )}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Açılış Anomali Onay Modali ── */}
      <AnimatePresence>
        {showAcilisAnomaliUyari && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center max-w-[480px] mx-auto px-5"
            onClick={() => setShowAcilisAnomaliUyari(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full bg-black border border-amber-500/30 rounded-3xl p-6 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Anomali Tespit Edildi</h3>
                  <p className="text-xs text-gray-400">Dünkü kapanıştan farklılık var</p>
                </div>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 mb-4 space-y-1">
                {(Object.entries(acilisAnomaliDetect()) as [string, number][]).map(([alan, fark]) => (
                  <div key={alan} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">{stokAlanEmoji[alan]} {stokAlanAdi[alan]}</span>
                    <span className={`font-bold ${fark > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {fark > 0 ? '+' : ''}{fark} adet
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mb-5 text-center">
                Sayımı tekrar kontrol edebilir ya da yine de gönderebilirsiniz.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAcilisAnomaliUyari(false)}
                  className="flex-1 py-3 rounded-2xl bg-white/10 border border-white/20 text-white font-semibold text-sm active:scale-[0.98] transition-all"
                >
                  ← Geri Dön
                </button>
                <button
                  onClick={() => { setShowAcilisAnomaliUyari(false); handleShiftStartComplete(); }}
                  className="flex-1 py-3 rounded-2xl bg-amber-500/80 text-white font-bold text-sm active:scale-[0.98] transition-all"
                >
                  Yine de Gönder
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Kapanış Anomali Onay Modali ── */}
      <AnimatePresence>
        {showKapanisAnomaliUyari && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center max-w-[480px] mx-auto px-5"
            onClick={() => setShowKapanisAnomaliUyari(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full bg-black border border-amber-500/30 rounded-3xl p-6 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Anomali Tespit Edildi</h3>
                  <p className="text-xs text-gray-400">Beklenen stoktan farklılık var</p>
                </div>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 mb-4 space-y-1">
                {(Object.entries(kapanisAnomaliDetect()) as [string, number][]).map(([alan, fark]) => (
                  <div key={alan} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">{stokAlanEmoji[alan]} {stokAlanAdi[alan]}</span>
                    <span className={`font-bold ${fark > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {fark > 0 ? '+' : ''}{fark} adet
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mb-5 text-center">
                Sayımı tekrar kontrol edebilir ya da yine de gönderebilirsiniz.
              </p>
              {kapanisPhotoHata && (
                <div className="mb-3 bg-red-500/15 border border-red-400/40 rounded-2xl px-4 py-2.5 flex items-center gap-2">
                  <span className="text-lg">📷</span>
                  <span className="text-xs text-red-300 font-medium">Mekan fotoğrafı çekilmeden kapanış gönderilemez. Lütfen önce fotoğraf çekiniz.</span>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowKapanisAnomaliUyari(false); setKapanisPhotoHata(false); }}
                  className="flex-1 py-3 rounded-2xl bg-white/10 border border-white/20 text-white font-semibold text-sm active:scale-[0.98] transition-all"
                >
                  ← Geri Dön
                </button>
                <button
                  onClick={() => {
                    if (!venuePhotoTaken) {
                      setKapanisPhotoHata(true);
                      return;
                    }
                    setKapanisPhotoHata(false);
                    setShowKapanisAnomaliUyari(false);
                    handleShiftEndComplete();
                  }}
                  className="flex-1 py-3 rounded-2xl bg-amber-500/80 text-white font-bold text-sm active:scale-[0.98] transition-all"
                >
                  Yine de Gönder
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Picker Modal */}
      <AnimatePresence>
        {showManualPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-end justify-center max-w-[480px] mx-auto"
            onClick={() => setShowManualPicker(false)}
          >
            <motion.div
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full bg-black rounded-t-3xl p-5 max-h-[70vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-black text-white text-base">Tüm Personel</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Listeden fotoğrafçıyı seçin</p>
                </div>
                <button onClick={() => setShowManualPicker(false)} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
              <input
                type="text"
                placeholder="İsim ara..."
                value={manualSearch}
                onChange={e => setManualSearch(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-500 outline-none focus:border-[#9dd9ea]/50 mb-3"
              />
              <div className="overflow-y-auto flex-1 space-y-2 pr-1">
                {filteredManualStaff.length === 0 ? (
                  <p className="text-center text-gray-500 text-sm py-6">Personel bulunamadı</p>
                ) : (
                  filteredManualStaff.map(s => {
                    const isInRotation = rotationPersonnel.some(r => r.id === s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => { setFramePhotographer(s); setShowManualPicker(false); }}
                        className="w-full flex items-center gap-3 bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl p-3 text-left transition-all active:scale-95"
                      >
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#9dd9ea]/30 to-[#7ec8dd]/20 flex items-center justify-center text-base flex-shrink-0">{s.avatar}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-white text-sm truncate">{s.name}</div>
                          <div className="text-xs text-gray-400 capitalize">{s.role}</div>
                        </div>
                        {isInRotation && (
                          <span className="text-xs bg-[#9dd9ea]/20 text-[#9dd9ea] border border-[#9dd9ea]/30 rounded-lg px-2 py-0.5 flex-shrink-0">Rotasyonda</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Method Modal */}
      {showPaymentMethod && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-black rounded-3xl shadow-2xl border-2 border-white/10 overflow-hidden max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-8 duration-300">
            <div className="relative backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border-b border-white/10 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] flex items-center justify-center text-2xl shadow-lg">💳</div>
                <div>
                  <h3 className="text-2xl font-black text-white">Ödeme Yöntemi</h3>
                  {!isOnline ? (
                    <p className="text-xs font-semibold mt-0.5" style={{ color: '#ffd4a3' }}>
                      📡 Çevrimdışı — satış kuyruğa alınacak
                    </p>
                  ) : (
                    <p className="text-gray-400 text-sm">Nasıl ödeme alacaksınız?</p>
                  )}
                </div>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gray-400 font-medium">Toplam Tutar:</span>
                  <span className="text-3xl font-black text-white">{pSym}{totalPrice}</span>
                </div>
                {discountAmount && Number(discountAmount) !== 0 && (() => {
                  const disc = Number(discountAmount);
                  const isZam = disc < 0;
                  return (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`${isZam ? 'text-white/60' : 'text-[#ffd4a3]'} font-bold flex items-center gap-2`}>
                          <span className="text-xl">{isZam ? '↑' : '🏷️'}</span>
                          {isZam ? 'Müşteri fazla ödüyor:' : 'İskonto:'}
                        </span>
                        <span className={`${isZam ? 'text-white/60' : 'text-[#ffd4a3]'} font-black text-xl`}>
                          {isZam ? `+${pSym}${Math.abs(disc)}` : `-${pSym}${disc}`}
                        </span>
                      </div>
                      <div className="border-t border-white/20 pt-3 mt-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white">Ödenecek:</span>
                          <span className="text-4xl font-black bg-gradient-to-r from-[#a8e6cf] to-[#8dd9b8] bg-clip-text text-transparent">{pSym}{totalPrice - disc}</span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
              <div className="space-y-3">
                {[
                  { id: 'cash' as const, emoji: '💵', label: 'Nakit', sub: 'Peşin ödeme', color: '[#a8e6cf]' },
                  { id: 'card' as const, emoji: '💳', label: 'Kredi Kartı', sub: 'Kart ile ödeme', color: '[#9dd9ea]' },
                  { id: 'iban' as const, emoji: '🏦', label: 'İban / Havale', sub: 'Banka havalesi', color: '[#ffd4a3]' },
                ].map(pm => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setPaymentMethod(pm.id)}
                    className={`w-full p-5 rounded-2xl border-2 transition-all hover:scale-[1.02] active:scale-[0.98] ${
                      paymentMethod === pm.id
                        ? `border-${pm.color} bg-${pm.color}/10 shadow-lg`
                        : 'border-white/20 bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg ${paymentMethod === pm.id ? `bg-gradient-to-br from-${pm.color} to-${pm.color} scale-110` : 'bg-gradient-to-br from-white/10 to-white/5'}`}>
                        {pm.emoji}
                      </div>
                      <div className="flex-1 text-left">
                        <div className={`font-black text-xl ${paymentMethod === pm.id ? `text-${pm.color}` : 'text-white'}`}>{pm.label}</div>
                        <div className="text-sm text-gray-400">{pm.sub}</div>
                      </div>
                      {paymentMethod === pm.id && (
                        <div className={`w-8 h-8 rounded-full bg-${pm.color} flex items-center justify-center shadow-lg animate-in zoom-in duration-200`}>
                          <CheckCircle className="w-6 h-6 text-[#2d3748]" />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              {/* Gerekçe ekle butonu + textarea */}
              <button
                type="button"
                onClick={() => { setShowGerekce(!showGerekce); if (showGerekce) setGerekceText(''); }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 14,
                  border: showGerekce ? '1.5px solid rgba(255,212,163,0.4)' : '1.5px solid rgba(255,255,255,0.1)',
                  background: showGerekce ? 'rgba(255,212,163,0.08)' : 'rgba(255,255,255,0.03)',
                  color: showGerekce ? '#ffd4a3' : 'rgba(255,255,255,0.45)',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'all 0.2s',
                }}
              >
                <span>📝</span>
                <span>{showGerekce ? 'Gerekçeyi kaldır' : 'Gerekçe ekle'}</span>
              </button>
              {showGerekce && (
                <textarea
                  value={gerekceText}
                  onChange={(e) => setGerekceText(e.target.value)}
                  placeholder="Satış gerekçesini yazın..."
                  rows={2}
                  className="w-full px-4 py-3 bg-white/5 border border-[#ffd4a3]/25 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#ffd4a3] transition-all resize-none animate-in slide-in-from-top-2 duration-200"
                />
              )}

              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => { setShowPaymentMethod(false); setPaymentMethod(null); setShowGerekce(false); setGerekceText(''); }} className="backdrop-blur-xl bg-white/10 border-2 border-white/20 text-white py-4 rounded-2xl font-bold text-base hover:bg-white/20 transition-all active:scale-[0.98]">Geri</button>
                <button
                  type="button"
                  onClick={handleCompleteSale}
                  disabled={!paymentMethod || satisSaving || (showGerekce && !gerekceText.trim())}
                  className={`py-4 rounded-2xl font-bold text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg ${paymentMethod && !satisSaving && (!showGerekce || gerekceText.trim()) ? 'bg-gradient-to-br from-[#a8e6cf] to-[#8dd9b8] text-[#2d3748] hover:shadow-xl cursor-pointer' : 'bg-white/5 text-gray-600 cursor-not-allowed opacity-50 border-2 border-white/10'}`}
                >
                  {satisSaving ? (
                    <><span className="w-4 h-4 border-2 border-[#2d3748]/40 border-t-[#2d3748] rounded-full animate-spin" /> Kaydediliyor...</>
                  ) : !isOnline ? (
                    <><span style={{ fontSize: 16 }}>📡</span> Kuyruğa Al</>
                  ) : (
                    <><CheckCircle className="w-5 h-5" /> Satışı Yap</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Açılış Sıfırla Onay Modalı */}
      <AnimatePresence>
        {showAcilisSifirlaModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[110] flex items-end justify-center p-4 pb-6"
            onClick={() => !acilisSifirlaYukleniyor && setShowAcilisSifirlaModal(false)}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-full max-w-md bg-black border border-red-500/30 rounded-3xl shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-red-900/60 to-red-800/40 border-b border-red-500/20 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                    <span className="text-2xl">⚠️</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Açılışı Sıfırla</h3>
                    <p className="text-xs text-red-300">Bu işlem geri alınamaz</p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                  <p className="text-sm font-semibold text-white">Sıfırlanacaklar:</p>
                  <div className="space-y-1.5">
                    {[
                      { icon: '🔄', text: 'Açılış stok sayımı', color: 'text-red-300' },
                      { icon: '🔄', text: 'Kapanış stok sayımı', color: 'text-red-300' },
                      { icon: '🖨️', text: 'Yazıcı sayaç verileri', color: 'text-red-300' },
                    ].map((item, i) => (
                      <div key={i} className={`flex items-center gap-2 text-xs ${item.color}`}>
                        <span>{item.icon}</span>
                        <span>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 space-y-2">
                  <p className="text-sm font-semibold text-white">Korunacaklar:</p>
                  <div className="space-y-1.5">
                    {[
                      { icon: '✅', text: 'Tüm satış kayıtları', color: 'text-green-300' },
                      { icon: '✅', text: 'Kare fotoğraf kayıtları', color: 'text-green-300' },
                    ].map((item, i) => (
                      <div key={i} className={`flex items-center gap-2 text-xs ${item.color}`}>
                        <span>{item.icon}</span>
                        <span>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-gray-400 text-center">
                  Sıfırladıktan sonra yeniden fiziksel sayım yapıp açılışı ve kapanışı tekrar doldurabilirsiniz.
                </p>

                {/* Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    onClick={() => setShowAcilisSifirlaModal(false)}
                    disabled={acilisSifirlaYukleniyor}
                    className="py-3.5 rounded-2xl border border-white/20 text-white font-semibold text-sm transition-all hover:bg-white/10 active:scale-95 disabled:opacity-50"
                  >
                    Vazgeç
                  </button>
                  <button
                    onClick={handleAcilisSifirla}
                    disabled={acilisSifirlaYukleniyor}
                    className="py-3.5 rounded-2xl bg-gradient-to-r from-red-600 to-red-500 text-white font-bold text-sm shadow-lg transition-all hover:shadow-red-500/40 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {acilisSifirlaYukleniyor ? (
                      <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sıfırlanıyor...</>
                    ) : (
                      <><X className="w-4 h-4" />Evet, Sıfırla</>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel Modal — Telegram onay akışı */}
      {showCancelModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{
            width: '100%', maxWidth: 420,
            background: 'rgba(15,8,32,0.97)',
            border: cancelStep === 'onaylandi' ? '1px solid rgba(34,197,94,0.4)'
              : cancelStep === 'reddedildi' ? '1px solid rgba(220,38,38,0.45)'
              : cancelStep === 'bekliyor' ? '1px solid rgba(157,217,234,0.3)'
              : '1px solid rgba(255,100,100,0.25)',
            borderRadius: 28, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.75)',
            transition: 'border-color 0.4s',
          }}>

            {/* ── FORM ── */}
            {cancelStep === 'form' && (
              <>
                <div style={{ background: 'linear-gradient(135deg, #dc2626, #ff4d4d)', padding: '22px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                    <AlertCircle style={{ width: 26, height: 26, color: 'white' }} />
                    <span style={{ color: 'white', fontWeight: 900, fontSize: 18 }}>Satış İptali</span>
                  </div>
                  <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>Talep yönetici onayına gönderilecek</p>
                </div>
                <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <textarea
                    value={cancelReason}
                    onChange={e => setCancelReason(e.target.value)}
                    placeholder="İptal sebebini yazın... (zorunlu)"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: '12px 14px', color: 'white', fontSize: 14, resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    rows={3}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <button onClick={closeCancelModal} style={{ padding: '13px 0', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>Vazgeç</button>
                    <button onClick={sendCancelRequest} style={{ padding: '13px 0', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #dc2626, #ff4d4d)', color: 'white', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 20px rgba(220,38,38,0.4)' }}>
                      📤 Onaya Gönder
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ── BEKLİYOR ── */}
            {cancelStep === 'bekliyor' && (
              <div style={{ padding: '40px 28px', textAlign: 'center' }}>
                {/* Dönen halka animasyonu — motion ile */}
                <div style={{ width: 76, height: 76, margin: '0 auto 22px', position: 'relative' }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    style={{
                      position: 'absolute', inset: 0, borderRadius: '50%',
                      border: '3px solid rgba(157,217,234,0.15)',
                      borderTop: '3px solid #9dd9ea',
                    }}
                  />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>✈️</div>
                </div>
                <p style={{ color: 'white', fontWeight: 900, fontSize: 17, marginBottom: 8 }}>Onay Bekleniyor</p>
                <p style={{ color: 'rgba(157,217,234,0.85)', fontSize: 13, marginBottom: 22 }}>
                  Telegram grubundan onaylanması gerekiyor
                </p>
                {/* Geri sayım */}
                <div style={{ background: 'rgba(157,217,234,0.07)', border: '1px solid rgba(157,217,234,0.2)', borderRadius: 16, padding: '14px 20px', marginBottom: 22 }}>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Kalan süre</p>
                  <p style={{ color: '#9dd9ea', fontWeight: 900, fontSize: 32, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                    {Math.floor(cancelCountdown / 60)}:{String(cancelCountdown % 60).padStart(2, '0')}
                  </p>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginBottom: 16 }}>
                  Telegram grubundaki ✅ / ❌ butonlarına tıklanması bekleniyor
                </p>

                {/* Yöneticiler için uygulama içi onay butonları */}
                {isYonetici && cancelApprovalId && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ background: 'rgba(157,217,234,0.06)', border: '1px solid rgba(157,217,234,0.2)', borderRadius: 16, padding: '14px 16px', marginBottom: 12 }}>
                      <p style={{ color: 'rgba(157,217,234,0.9)', fontSize: 12, fontWeight: 700, marginBottom: 10, textAlign: 'left' }}>
                        🔑 Yönetici — Doğrudan Karar Ver
                      </p>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          disabled={kararVeriliyor === cancelApprovalId}
                          onClick={async () => {
                            await handleIptalKarar(cancelApprovalId, 'onaylandi');
                            setCancelStep('onaylandi');
                            const mekanId2 = resolvedMekanId || selectedProject?.id || '';
                            const tarih2 = bugunTarih();
                            if (cancelSaleId) await executeCancelSale(mekanId2, tarih2, cancelSaleId, cancelReason);
                            setTimeout(() => closeCancelModal(), 2500);
                          }}
                          style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: 'none', background: kararVeriliyor === cancelApprovalId ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.25)', color: '#4ade80', fontWeight: 800, fontSize: 14, cursor: kararVeriliyor === cancelApprovalId ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
                        >
                          {kararVeriliyor === cancelApprovalId ? '⏳' : '✅'} Onayla
                        </button>
                        <button
                          disabled={kararVeriliyor === cancelApprovalId}
                          onClick={async () => {
                            await handleIptalKarar(cancelApprovalId, 'reddedildi');
                            setCancelStep('reddedildi');
                          }}
                          style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: 'none', background: kararVeriliyor === cancelApprovalId ? 'rgba(220,38,38,0.1)' : 'rgba(220,38,38,0.2)', color: '#f87171', fontWeight: 800, fontSize: 14, cursor: kararVeriliyor === cancelApprovalId ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
                        >
                          {kararVeriliyor === cancelApprovalId ? '⏳' : '❌'} Reddet
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <button onClick={closeCancelModal} style={{ width: '100%', padding: '12px 0', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.45)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Vazgeç
                </button>
              </div>
            )}

            {/* ── ONAYLANDI ── */}
            {cancelStep === 'onaylandi' && (
              <div style={{ padding: '40px 28px', textAlign: 'center' }}>
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 12 }}
                  style={{ width: 76, height: 76, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 34 }}
                >
                  ✅
                </motion.div>
                <p style={{ color: 'white', fontWeight: 900, fontSize: 18, marginBottom: 8 }}>Satış İptal Edildi</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 20 }}>Yönetici onayladı, kayıt sisteme işlendi</p>
                <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 14, padding: '11px 18px' }}>
                  <span style={{ color: 'rgba(34,197,94,0.9)', fontSize: 13, fontWeight: 700 }}>✅ İşlem başarıyla tamamlandı</span>
                </div>
              </div>
            )}

            {/* ── REDDEDİLDİ ── */}
            {cancelStep === 'reddedildi' && (
              <div style={{ padding: '40px 28px', textAlign: 'center' }}>
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 12 }}
                  style={{ width: 76, height: 76, borderRadius: '50%', background: 'rgba(220,38,38,0.15)', border: '2px solid rgba(220,38,38,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 34 }}
                >
                  🚫
                </motion.div>
                <p style={{ color: 'white', fontWeight: 900, fontSize: 18, marginBottom: 8 }}>İptal Reddedildi</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 22 }}>Yönetici bu iptal talebini onaylamadı</p>
                <button onClick={closeCancelModal} style={{ width: '100%', padding: '13px 0', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                  Kapat
                </button>
              </div>
            )}

            {/* ── TIMEOUT ── */}
            {cancelStep === 'timeout' && (
              <div style={{ padding: '40px 28px', textAlign: 'center' }}>
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 12 }}
                  style={{ width: 76, height: 76, borderRadius: '50%', background: 'rgba(255,212,163,0.1)', border: '2px solid rgba(255,212,163,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 34 }}
                >
                  ⏳
                </motion.div>
                <p style={{ color: 'white', fontWeight: 900, fontSize: 18, marginBottom: 8 }}>Süre Doldu</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 22 }}>3 dakika içinde yanıt gelmedi</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <button onClick={closeCancelModal} style={{ padding: '13px 0', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    Kapat
                  </button>
                  <button onClick={() => { setCancelStep('form'); setCancelCountdown(180); }} style={{ padding: '13px 0', borderRadius: 14, background: 'rgba(255,212,163,0.12)', color: '#ffd4a3', fontWeight: 700, fontSize: 14, cursor: 'pointer', border: '1px solid rgba(255,212,163,0.25)' }}>
                    🔄 Tekrar Gönder
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Check-in Uyarı Modal */}
      {showCheckinWarning && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[110] flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-[#1a1a2e] rounded-3xl border border-[#fbbf24]/30 shadow-2xl overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-[#fbbf24]/15 border-2 border-[#fbbf24]/40 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">⚠️</span>
              </div>
              <h3 className="text-lg font-black text-white mb-2">Check-in Yapılmadı</h3>
              <p className="text-sm text-white/50 leading-relaxed">Vardiya check-in yapmadan işlem yapıyorsunuz. İşlem kaydedilecek ama check-in yapmanız önerilir.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 px-6 pb-6">
              <button
                onClick={() => { setShowCheckinWarning(false); setCheckinWarningCallback(null); }}
                className="py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
                style={{ background: 'rgba(157,217,234,0.15)', border: '1px solid rgba(157,217,234,0.35)', color: '#9dd9ea' }}
              >
                Check-in Yap
              </button>
              <button
                onClick={() => {
                  setCheckinWarningDismissed(true);
                  setShowCheckinWarning(false);
                  if (checkinWarningCallback) { checkinWarningCallback(); setCheckinWarningCallback(null); }
                }}
                className="py-3 rounded-xl font-bold text-sm transition-all active:scale-95"
                style={{ background: 'rgba(255,180,50,0.15)', border: '1px solid rgba(255,180,50,0.35)', color: '#fbbf24' }}
              >
                Devam Et
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kare Silme Modal */}
      {showDeleteKareModal && deleteKareEntry && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center pb-8 px-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget && !deleteKareSaving) closeDeleteKareModal(); }}
        >
          <div style={{
            width: '100%', maxWidth: 420,
            background: 'rgba(20,10,40,0.97)',
            border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: 24, padding: '22px 20px 28px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          }}>
            {/* Başlık */}
            <div className="flex items-center gap-3 mb-4">
              <div style={{
                width: 42, height: 42, borderRadius: 14, flexShrink: 0,
                background: 'rgba(248,113,113,0.15)',
                border: '1px solid rgba(248,113,113,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <XCircle style={{ width: 20, height: 20, color: '#f87171' }} />
              </div>
              <div>
                <p style={{ color: 'white', fontWeight: 900, fontSize: 15 }}>Kare Kaydını Sil</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Bu işlem geri alınamaz</p>
              </div>
            </div>

            {/* Kayıt önizleme */}
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 14, padding: '12px 14px', marginBottom: 18,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 12,
                background: 'rgba(213,181,247,0.15)',
                border: '1px solid rgba(213,181,247,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, flexShrink: 0,
              }}>📸</div>
              <div className="flex-1 min-w-0">
                <p style={{ color: 'white', fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>
                  {deleteKareEntry.photographerName}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>
                  {new Date(deleteKareEntry.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} kaydedildi
                </p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ color: '#9dd9ea', fontWeight: 900, fontSize: 18, lineHeight: 1 }}>{deleteKareEntry.frameCount}</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>kare</p>
              </div>
            </div>

            {/* Butonlar */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button
                onClick={closeDeleteKareModal}
                disabled={deleteKareSaving}
                style={{
                  padding: '13px 0', borderRadius: 16, fontWeight: 700, fontSize: 13,
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                  opacity: deleteKareSaving ? 0.5 : 1,
                }}
              >
                Vazgeç
              </button>
              <button
                onClick={confirmDeleteKare}
                disabled={deleteKareSaving}
                style={{
                  padding: '13px 0', borderRadius: 16, fontWeight: 800, fontSize: 13,
                  background: 'rgba(248,113,113,0.18)',
                  border: '1px solid rgba(248,113,113,0.45)',
                  color: '#f87171', cursor: deleteKareSaving ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {deleteKareSaving
                  ? <><span style={{ width: 14, height: 14, border: '2px solid rgba(248,113,113,0.3)', borderTopColor: '#f87171', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />Siliniyor…</>
                  : <><XCircle style={{ width: 14, height: 14 }} />Evet, Sil</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift End Success Modal */}
      {showShiftEndSuccess && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-6"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="w-full max-w-md bg-black rounded-3xl shadow-2xl border-2 border-[#a8e6cf]/30 overflow-hidden"
          >
            <div className="relative p-12 text-center">
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-0 bg-gradient-to-br from-[#a8e6cf]/40 to-[#9dd9ea]/40 blur-3xl"
              />
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="relative w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-[#a8e6cf] to-[#8dd9b8] rounded-full flex items-center justify-center shadow-2xl"
              >
                <CheckCircle className="w-20 h-20 text-[#2d3748]" strokeWidth={2.5} />
              </motion.div>
              <motion.h2 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} className="text-3xl font-black text-white mb-3">
                Harika İş! 🎉
              </motion.h2>
              <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }} className="text-gray-300 text-lg mb-2">
                Vardiya başarıyla tamamlandı
              </motion.p>
              <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }} className="text-gray-400 text-sm">
                Bugünkü çalışmanız için teşekkürler! 🌟
              </motion.p>
              <div className="absolute top-10 left-10 text-4xl animate-bounce">✨</div>
              <div className="absolute top-16 right-12 text-3xl animate-bounce" style={{ animationDelay: '0.2s' }}>🎊</div>
              <div className="absolute bottom-16 left-16 text-3xl animate-bounce" style={{ animationDelay: '0.4s' }}>🏆</div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* ── Canlı Feed Bottom Sheet ── */}
      {showLiveFeed && selectedProject && (
        <LiveFeedSheet
          mekanId={resolvedMekanId || selectedProject.id}
          mekanName={selectedProject.name}
          mekanIcon={selectedProject.icon}
          mekanColor={selectedProject.color}
          onClose={() => setShowLiveFeed(false)}
        />
      )}
    </div>
  );
}
