import { useState, useEffect } from 'react';
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
import { buildHeaders } from '../lib/api';
import { projectId } from '/utils/supabase/info';
import { localDateStr } from '../lib/date';

const API_BASE_QS = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

interface Project {
  id: string;
  name: string;
  location: string;
  shift: string;
  color: string;
  icon: string;
}

// Sale artık VardiyaSatis — display helper olarak kullanılır
type Sale = VardiyaSatis & { project?: string };

interface CartItem {
  product: string;
  quantity: number;
  color: string;
  unitPrice: number;
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
}

const FRAME_STORAGE_KEY = 'aspect_frame_tracking';

const albumItems = [
  { key: 'album3', label: '3 Kare', emoji: '📘' },
  { key: 'album5', label: '5 Kare', emoji: '📗' },
  { key: 'album7', label: '7 Kare', emoji: '📙' },
  { key: 'album9', label: '9 Kare', emoji: '📕' },
  { key: 'album11', label: '11 Kare', emoji: '📔' },
  { key: 'album13', label: '13 Kare', emoji: '📒' },
  { key: 'album15', label: '15 Kare', emoji: '📓' },
];


export function QuickSales({ userName, userRole, accessToken, userId, onProjectSelect, preSelectedProject, onBack, onLogout, onNavigate }: QuickSalesProps) {
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
  const [showPaymentMethod, setShowPaymentMethod] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'iban' | 'card' | null>(null);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [satisSaving, setSatisSaving] = useState(false);
  // Gerçek mekan ID'si — preSelectedProject için '1' placeholder'ı replace edilir
  const [resolvedMekanId, setResolvedMekanId] = useState<string>('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelSaleId, setCancelSaleId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showShiftEndSuccess, setShowShiftEndSuccess] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<'USD' | 'EUR' | 'GBP' | null>(null);
  const [exchangeRates, setExchangeRates] = useState({ USD: 34.52, EUR: 37.89, GBP: 43.26 });
  const [ratesLoading, setRatesLoading] = useState(false);

  // Mode tabs: shift-start | sales | frames | shift-end
  const [activeMode, setActiveMode] = useState<'shift-start' | 'sales' | 'frames' | 'shift-end'>('shift-start');

  // Canlı feed bottom sheet
  const [showLiveFeed, setShowLiveFeed] = useState(false);

  // Operasyon paneli tam ekran
  const [operasyonFullscreen, setOperasyonFullscreen] = useState(false);

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

  // ── SHIFT START state ──
  const [stokGunluk, setStokGunluk] = useState<StokGunluk | null>(null);
  const [dunKapanis, setDunKapanis] = useState<StokSayim | null>(null);
  const [acilisSayim, setAcilisSayim] = useState<StokSayim>(bosStok());
  const [acilisNot, setAcilisNot] = useState('');
  const [acilisAnomaliNeden, setAcilisAnomaliNeden] = useState('');
  const [stokYukleniyor, setStokYukleniyor] = useState(false);
  const [stokKaydediliyor, setStokKaydediliyor] = useState(false);
  const [stokEklemeler, setStokEklemeler] = useState<StokEkleme[]>([]);
  const [showAcilisAnomaliUyari, setShowAcilisAnomaliUyari] = useState(false);
  const [showKapanisAnomaliUyari, setShowKapanisAnomaliUyari] = useState(false);
  const [showAcilisSifirlaModal, setShowAcilisSifirlaModal] = useState(false);
  const [acilisSifirlaYukleniyor, setAcilisSifirlaYukleniyor] = useState(false);
  const [printers, setPrinters] = useState([{ id: '1', label: 'Yazıcı 1', startCounter: '' }]);
  const [printerEndCounters, setPrinterEndCounters] = useState<Record<string, string>>({});
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
  const [printerRibbonChanges, setPrinterRibbonChanges] = useState<Record<string, string>>({});
  const [printerIadePhotos, setPrinterIadePhotos] = useState<Record<string, string>>({});
  const [showClosingCount, setShowClosingCount] = useState(false);
  const [showDamagedAlbums, setShowDamagedAlbums] = useState(false);
  const [closingCount, setClosingCount] = useState<{ shelfEnd: Record<string, number>; damagedAlbums: Record<string, number> }>({
    shelfEnd: { album3: 0, album5: 0, album7: 0, album9: 0, album11: 0, album15: 0 },
    damagedAlbums: { album3: 0, album5: 0, album7: 0, album9: 0, album11: 0, album15: 0 },
  });
  const [venuePhotoTaken, setVenuePhotoTaken] = useState(false);
  const [venuePhotoPreview, setVenuePhotoPreview] = useState<string | null>(null);
  const [shiftEndDone, setShiftEndDone] = useState(false);

  // ── MEKAN kağıt ayarları ──
  const [mekanKapasite, setMekanKapasite] = useState(0);         // pcsPerBox / setsPerBox
  const [mekanPrintType, setMekanPrintType] = useState<'tam' | 'yarim'>('yarim');
  const [mekanCurrency, setMekanCurrency] = useState('TRY');
  // ── Manuel fallback (kapasite alınamadığında kullanıcı girer) ──
  const [availablePapers, setAvailablePapers] = useState<any[]>([]);
  const [manualPaperId, setManualPaperId] = useState<string>('');
  const [manualPrintType, setManualPrintType] = useState<'tam' | 'yarim'>('yarim');

  // ── REYON state ──
  const [reyonAcik, setReyonAcik] = useState(false);
  const [reyonKapanisSayim, setReyonKapanisSayim] = useState<StokSayim>(bosStok());
  const [reyonGunIciEkleme, setReyonGunIciEkleme] = useState<Record<string, number>>({
    album3: 0, album5: 0, album7: 0, album9: 0, album11: 0, album13: 0, album15: 0,
  });

  useEffect(() => {
    const load = async () => {
      // Canlı kur çek
      try {
        setRatesLoading(true);
        const { authHeaders } = await import('../lib/api');
        const headers = await authHeaders();
        const res = await fetch(`${API_BASE_QS}/doviz/canli`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (data.rates) {
            setExchangeRates({ USD: Number(data.rates.USD), EUR: Number(data.rates.EUR), GBP: Number(data.rates.GBP) });
          }
        }
      } catch (err) {
        console.error('QuickSales exchange rate fetch error:', err);
      } finally {
        setRatesLoading(false);
      }
      const staff = await getStaffMembers();
      setAllStaff(Array.isArray(staff) ? staff : []);
    };
    load();
  }, []);

  // Proje değişince: mekan ID resolve et → stok + rotasyon yükle
  useEffect(() => {
    if (!selectedProject) return;
    const load = async () => {
      const hdr = buildHeaders(accessToken);
      const tarih = bugunTarih();

      // ── 1. Mekanlar → gerçek ID resolve et ──────────────
      let realMekanId = selectedProject.id;
      try {
        const mekanRes = await fetch(`${API_BASE_QS}/mekanlar`, { headers: hdr });
        if (mekanRes.ok) {
          const { mekanlar } = await mekanRes.json();
          // Önce ID ile eşleş (manager flow), bulamazsa name ile (staff flow, id='1')
          const mekan = (mekanlar || []).find(
            (m: any) => m.id === selectedProject.id || m.name === selectedProject.name
          );
          if (mekan) {
            realMekanId = mekan.id;
            setMekanPrintType(mekan.printType === 'tam' ? 'tam' : 'yarim');
            const paperRes = await fetch(`${API_BASE_QS}/maliyetler`, { headers: hdr });
            if (paperRes.ok) {
              const { papers } = await paperRes.json();
              const allPapers = (papers || []).filter((p: any) => p.pcsPerBox && p.setsPerBox);
              setAvailablePapers(allPapers);
              if (mekan.paperType) {
                const paper = allPapers.find((p: any) => p.id === mekan.paperType)
                           || allPapers.find((p: any) => p.name === mekan.paperType);
                if (paper) {
                  setMekanKapasite(Number(paper.pcsPerBox) / Number(paper.setsPerBox));
                  setMekanCurrency(paper.currency || 'TRY');
                }
              }
            }
          }
        }
      } catch (e) {
        console.log('Mekan verisi yüklenemedi:', e);
      }
      setResolvedMekanId(realMekanId);

      // ── 2. Rotasyon personeli ────────────────────────────
      const today = localDateStr();
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

      if (stokData.bugun?.acilisYapildi) {
        setAcilisSayim(stokData.bugun.acilis as StokSayim);
        setShiftStartDone(true);
        if (stokData.bugun.kapanisYapildi) {
          setKapanisSayim(stokData.bugun.kapanish as StokSayim);
          setKapanisAnomali(stokData.bugun.kapanisAnomali || {});
          setKapanisBeklenen(stokData.bugun.kapanisBeklenen || null);
          setShiftEndDone(true);
        }
      } else if (stokData.dunKapanis) {
        setAcilisSayim({ ...stokData.dunKapanis });
      }
      setStokYukleniyor(false);

      // ── 4. Satışlar ve kare kayıtları stok kaydından gelir ──
      const gunlukSatislar = (stokData.bugun?.satislar || []).filter((s: any) => !s.iptal);
      setRecentSales(gunlukSatislar);
      setFrameEntries(stokData.bugun?.kareKayitlari || []);
    };
    load();
  }, [selectedProject]);

  const products = [
    { name: "1 Fotoğraf", price: 200, color: 'from-[#9dd9ea] to-[#7ec8dd]', icon: '📸' },
    { name: "3'lü", price: 600, color: 'from-[#b8d4f1] to-[#9cc0e8]', icon: '🎨' },
    { name: "5'li", price: 1000, color: 'from-[#d4b5f7] to-[#c79ff0]', icon: '🖼️' },
    { name: "7'li", price: 1400, color: 'from-[#ffb3d9] to-[#ff99cc]', icon: '✨' },
    { name: "9'lu", price: 1800, color: 'from-[#ffe5b4] to-[#ffd89b]', icon: '🌟' },
    { name: "11'li", price: 2200, color: 'from-[#a8e6cf] to-[#8dd9b8]', icon: '💎' },
    { name: "15'li", price: 3000, color: 'from-[#ffd4a3] to-[#ffc78f]', icon: '🎯' },
    { name: 'Paspartu', price: 200, color: 'from-[#a8e6e1] to-[#8fd9d1]', icon: '🖼️' },
  ];

  const calculateTotal = () => cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = calculateTotal();

  const calculateForeignCurrency = () => {
    if (!selectedCurrency) return '0.00';
    const discount = Number(discountAmount) || 0;
    return ((totalPrice - discount) / exchangeRates[selectedCurrency]).toFixed(2);
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
    const discount = Number(discountAmount) || 0;
    if (discount > 0 && totalPrice - discount < 0) { alert('İskonto tutarı toplam fiyattan fazla olamaz!'); return; }
    setShowPaymentMethod(true);
  };

  const handleCompleteSale = async () => {
    if (!paymentMethod || !selectedProject) return;
    const discount = Number(discountAmount) || 0;
    const mekanId = resolvedMekanId || selectedProject.id;
    const tarih = bugunTarih();

    setSatisSaving(true);
    try {
      const hdr = buildHeaders(accessToken);
      const res = await fetch(`${API_BASE_QS}/stok/satis`, {
        method: 'POST',
        headers: hdr,
        body: JSON.stringify({
          mekanId,
          tarih,
          items: cart.map(i => ({ product: i.product, quantity: i.quantity, unitPrice: i.unitPrice, color: i.color })),
          totalPrice,
          discount,
          paymentMethod,
          currency: selectedCurrency || 'TRY',
          currencyPrice: selectedCurrency ? Number(calculateForeignCurrency()) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Satış kayıt hatası:', data.error);
        alert(data.error || 'Satış kaydedilemedi.');
        return;
      }
      // Listeye ekle (aktif satışlar, iptal edilmemiş)
      setRecentSales(prev => [{ ...data.satis, project: selectedProject.name }, ...prev]);
    } catch (err) {
      console.error('handleCompleteSale error:', err);
      alert('Bağlantı hatası. Satış kaydedilemedi.');
      return;
    } finally {
      setSatisSaving(false);
    }
    setCart([]); setDiscountAmount(''); setShowDiscount(false); setShowPaymentMethod(false); setPaymentMethod(null); setSelectedCurrency(null);
  };

  const openCancelModal = (id: string) => { setCancelSaleId(id); setShowCancelModal(true); };
  const closeCancelModal = () => { setShowCancelModal(false); setCancelSaleId(null); setCancelReason(''); };
  const confirmCancelSale = async () => {
    if (!cancelReason.trim()) { alert('Lütfen iptal sebebini yazın'); return; }
    if (!cancelSaleId || !selectedProject) return;
    const mekanId = resolvedMekanId || selectedProject.id;
    const tarih = bugunTarih();
    try {
      const hdr = buildHeaders(accessToken);
      const res = await fetch(`${API_BASE_QS}/stok/satis/${mekanId}/${tarih}/${cancelSaleId}`, {
        method: 'DELETE',
        headers: hdr,
        body: JSON.stringify({ neden: cancelReason }),
      });
      if (res.ok) {
        setRecentSales(prev => prev.filter(s => s.id !== cancelSaleId));
        closeCancelModal();
      } else {
        const data = await res.json();
        alert(data.error || 'Satış iptal edilemedi.');
      }
    } catch (err) {
      console.error('confirmCancelSale error:', err);
      alert('Bağlantı hatası.');
    }
  };

  const handleFrameSave = async () => {
    if (!framePhotographer || !frameCount || !selectedProject) return;
    const count = parseInt(frameCount);
    if (isNaN(count) || count <= 0) return;
    const mekanId = resolvedMekanId || selectedProject.id;
    const tarih = bugunTarih();

    setFrameSaving(true);
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
      console.error('handleFrameSave error:', err);
      alert('Bağlantı hatası. Tekrar deneyin.');
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
  const addPrinter = () => {
    if (printers.length >= 5) return;
    const newId = Date.now().toString();
    setPrinters(p => [...p, { id: newId, label: `Yazıcı ${p.length + 1}`, startCounter: '' }]);
  };
  const removePrinter = (id: string) => {
    if (printers.length <= 1) return;
    setPrinters(p => p.filter(pr => pr.id !== id));
  };
  const updatePrinterStart = (id: string, val: string) => setPrinters(p => p.map(pr => pr.id === id ? { ...pr, startCounter: val } : pr));
  const updatePrinterLabel = (id: string, val: string) => setPrinters(p => p.map(pr => pr.id === id ? { ...pr, label: val } : pr));
  const updatePrinterEnd = (id: string, val: string) => setPrinterEndCounters(p => ({ ...p, [id]: val }));
  const updatePrinterRibbon = (id: string, val: string) => setPrinterRibbonChanges(p => ({ ...p, [id]: val }));
  const updatePrinterIade = (id: string, val: string) => setPrinterIadePhotos(p => ({ ...p, [id]: val }));
  const handleTeamPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => { setTeamPhotoPreview(reader.result as string); setTeamPhotoTaken(true); };
    reader.readAsDataURL(file);
  };
  // ── Anomali tespiti (submit öncesi) ──
  const acilisAnomaliDetect = (): Record<string, number> => {
    if (!dunKapanis) return {};
    const result: Record<string, number> = {};
    (Object.keys(stokAlanAdi) as Array<keyof StokSayim>).forEach(alan => {
      const fark = (acilisSayim[alan] ?? 0) - (dunKapanis[alan] ?? 0);
      if (fark !== 0) result[alan] = fark;
    });
    return result;
  };

  // ── Efektif kapasite & print type (mekan verisinden veya manuel girişten) ──
  const manualPaperObj = availablePapers.find(p => p.id === manualPaperId);
  const manualKapasite = manualPaperObj
    ? Number(manualPaperObj.pcsPerBox) / Number(manualPaperObj.setsPerBox)
    : 0;
  const effectiveKapasite = mekanKapasite > 0 ? mekanKapasite : manualKapasite;
  const effectivePrintType = mekanKapasite > 0 ? mekanPrintType : manualPrintType;
  const needsManualInput = mekanKapasite === 0; // mekan'dan veri alınamadı

  const kapanisAnomaliDetect = (): Record<string, number> => {
    if (!stokGunluk?.acilis) return {};
    const toplamRibonDegisim = printers.reduce(
      (sum, pr) => sum + (Number(printerRibbonChanges[pr.id] || 0)), 0
    );
    const result: Record<string, number> = {};
    (Object.keys(stokAlanAdi) as Array<keyof StokSayim>).forEach(alan => {
      let beklenen = (stokGunluk!.acilis as StokSayim)[alan] || 0;
      for (const ek of stokEklemeler) {
        beklenen += (ek.miktar as Record<string, number>)[alan] || 0;
      }
      // Ribon: değiştirilen takım adedi stoktan düşer
      if (alan === 'ribon') beklenen -= toplamRibonDegisim;
      beklenen = Math.max(0, beklenen);
      const fark = (kapanisSayim[alan] ?? 0) - beklenen;
      if (fark !== 0) result[alan] = fark;
    });
    return result;
  };

  const handleAcilisSubmitClick = () => {
    const anomali = acilisAnomaliDetect();
    if (Object.keys(anomali).length > 0) {
      setShowAcilisAnomaliUyari(true);
    } else {
      handleShiftStartComplete();
    }
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
        setTeamPhotoTaken(false);
        setTeamPhotoPreview(null);
        setPrinters([{ id: '1', label: 'Yazıcı 1', startCounter: '' }]);
        setPrinterEndCounters({});
        setPrinterRibbonChanges({});
        setPrinterIadePhotos({});
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
    const result = await postAcilis(mekanId, tarih, acilisSayim, acilisNot);
    setStokKaydediliyor(false);
    if (result) {
      setStokGunluk(result.kayit);
      setShiftStartDone(true);
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
      const computed: StokSayim = { ...acilisSayim };
      (Object.keys(stokAlanAdi) as Array<keyof StokSayim>).forEach(alan => {
        const reyonAcilis = shiftShelves[alan as string] || 0;
        const gunIciEkleme = reyonGunIciEkleme[alan as string] || 0;
        const reyonKapanis = reyonKapanisSayim[alan] || 0;
        const satilan = Math.max(0, (reyonAcilis + gunIciEkleme) - reyonKapanis);
        computed[alan] = Math.max(0, (acilisSayim[alan] || 0) - satilan);
      });
      finalKapanisSayim = computed;
    }

    // Yazıcı verilerini topla (sayaç azalıyor: start - end)
    const printerData = printers.map(pr => ({
      id: pr.id,
      label: pr.label,
      startCounter: Number(pr.startCounter) || 0,
      endCounter: Number(printerEndCounters[pr.id] || 0),
      ribonDegisim: Number(printerRibbonChanges[pr.id] || 0),
      iadeFotograf: Number(printerIadePhotos[pr.id] || 0),
    }));

    const mekanId = resolvedMekanId || selectedProject.id;
    const result = await postKapanis(mekanId, tarih, finalKapanisSayim, kapanisNot, printerData);
    setStokKaydediliyor(false);
    if (result) {
      setKapanisAnomali(result.anomali || {});
      setKapanisBeklenen(result.beklenen || null);
      setStokGunluk(result.kayit);
      setShiftEndDone(true);
      setShowShiftEndSuccess(true);
      setTimeout(() => { setShowShiftEndSuccess(false); onNavigate('profile'); }, 3000);
    } else {
      alert('Kapanış kaydedilirken hata oluştu. Lütfen tekrar deneyin.');
    }
  };

  return (
    <div className={operasyonFullscreen
      ? 'fixed inset-0 z-[70] bg-gradient-to-b from-[#0a051e] via-[#120830] to-[#1a0a3c] overflow-y-auto overscroll-contain flex flex-col'
      : 'pb-32 bg-gradient-to-b from-[#0a051e] via-[#120830] to-[#1a0a3c] min-h-screen'
    }>
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
          onLiveFeed={
            ['yonetici', 'ust-mudur', 'mudur', 'idari'].includes(userRole) && selectedProject
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
                <span className="text-base">📷</span>
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
                    {(Object.keys(stokAlanAdi) as Array<keyof StokSayim>).map((alan) => {
                      const beklenen = dunKapanis?.[alan] ?? null;
                      const gercek = acilisSayim[alan] ?? 0;
                      const fark = beklenen !== null ? gercek - beklenen : 0;
                      const sapmaVar = beklenen !== null && fark !== 0;
                      return (
                        <div key={alan} className="flex items-center justify-between bg-black/30 border border-white/10 rounded-xl px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{stokAlanEmoji[alan]}</span>
                            <div>
                              <span className="text-sm font-semibold text-white">{stokAlanAdi[alan]}</span>
                              {beklenen !== null && (
                                <p className="text-xs text-gray-500">Beklenen: {beklenen}</p>
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
                  </div>

                  {/* Anomali uyarı bandı */}
                  {dunKapanis && !stokGunluk?.acilisYapildi &&
                    (Object.keys(stokAlanAdi) as Array<keyof StokSayim>).some(a => (acilisSayim[a] ?? 0) !== (dunKapanis[a] ?? 0)) && (
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

              {/* 2 — Yazıcı Sayaçları */}
              <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f] flex items-center justify-center shadow-lg">
                      <Printer className="w-5 h-5 text-[#744210]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Yazıcı Başlangıç Sayaçları</h3>
                      <p className="text-xs text-gray-400">{printers.length} yazıcı aktif • maks. 5</p>
                    </div>
                  </div>
                  {printers.length < 5 && (
                    <button
                      onClick={addPrinter}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ffd4a3]/20 hover:bg-[#ffd4a3]/30 border border-[#ffd4a3]/40 rounded-xl text-[#ffd4a3] text-xs font-bold transition-all active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" /> Yazıcı Ekle
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {printers.map((printer, idx) => (
                    <div key={printer.id} className="bg-black/30 border border-white/10 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-base">🖨️</span>
                        <input
                          type="text"
                          value={printer.label}
                          onChange={e => updatePrinterLabel(printer.id, e.target.value)}
                          className="flex-1 bg-transparent text-white text-sm font-bold outline-none border-b border-white/20 focus:border-[#ffd4a3]/60 pb-0.5 transition-all"
                        />
                        {printers.length > 1 && (
                          <button
                            onClick={() => removePrinter(printer.id)}
                            className="w-6 h-6 rounded-lg bg-[#ffb3ba]/20 text-[#ffb3ba] flex items-center justify-center active:scale-95"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <input
                        type="number"
                        value={printer.startCounter}
                        onChange={e => updatePrinterStart(printer.id, e.target.value)}
                        placeholder="Başlangıç sayacı (örn: 10482)"
                        className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#ffd4a3]/50 text-center font-bold"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-600 text-center mt-3">LCD ekrandaki toplam baskı sayısını girin</p>
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
                    {albumItems.map(({ key, label, emoji }) => (
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
                      <div className="text-[10px] opacity-90 font-semibold mt-0.5">₺{product.price}</div>
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
                    <button onClick={() => setCart([])} className="text-[#ffb3ba] hover:bg-[#ffb3ba]/10 p-2 rounded-lg transition-all">
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
                            <span className="text-xs text-gray-400">{item.quantity} × ₺{item.unitPrice} = ₺{item.quantity * item.unitPrice}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
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
                    <div className="text-[#2d3748] text-4xl font-bold">₺{totalPrice}</div>
                  </div>
                  {!showDiscount ? (
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setShowDiscount(true)} className="bg-gradient-to-r from-[#ffd4a3] to-[#ffc78f] text-[#744210] py-4 rounded-2xl font-bold text-base hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg">
                        <Tag className="w-5 h-5" /> İskonto
                      </button>
                      <button onClick={handleProceed} className="bg-gradient-to-r from-[#9dd9ea] via-[#7ec8dd] to-[#9dd9ea] text-[#2d3748] py-4 rounded-2xl font-bold text-base hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg">
                        <Send className="w-5 h-5" /> İlerle
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-gradient-to-br from-[#ffd4a3]/20 to-[#ffc78f]/10 rounded-2xl p-4 border-2 border-[#ffd4a3]/30">
                        <label className="text-sm font-semibold text-white mb-2 block flex items-center gap-2">
                          <Tag className="w-4 h-4 text-[#ffd4a3]" /><span>İskonto Tutarı</span>
                        </label>
                        <div className="bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f] rounded-xl p-4 mb-3 text-right shadow-md">
                          <div className="text-[#744210]/60 text-xs mb-1">TL</div>
                          <div className="text-[#744210] text-3xl font-bold min-h-[40px] flex items-center justify-end">{discountAmount || '0'}</div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          {['1','2','3','4','5','6','7','8','9'].map(num => (
                            <button key={num} onClick={() => discountAmount.length < 6 && setDiscountAmount(discountAmount + num)} className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xl font-bold py-3 rounded-xl transition-all active:scale-95">{num}</button>
                          ))}
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <button onClick={() => setDiscountAmount('')} className="bg-[#ffb3ba]/20 text-[#ffb3ba] text-sm font-bold py-3 rounded-xl transition-all active:scale-95">C</button>
                          <button onClick={() => discountAmount.length < 6 && setDiscountAmount(discountAmount + '0')} className="bg-white/10 text-white text-xl font-bold py-3 rounded-xl transition-all active:scale-95">0</button>
                          <button onClick={() => setDiscountAmount(discountAmount.slice(0, -1))} className="bg-[#ffd4a3]/20 text-[#ffd4a3] text-sm font-bold py-3 rounded-xl transition-all active:scale-95">⌫</button>
                        </div>
                        {discountAmount && Number(discountAmount) > 0 && (
                          <div className="bg-white/5 rounded-xl p-3 border-2 border-[#a8e6cf]/30 mb-3">
                            <div className="flex items-center justify-between text-sm mb-1"><span className="text-gray-400">Orijinal:</span><span className="font-semibold text-white">₺{totalPrice}</span></div>
                            <div className="flex items-center justify-between text-sm mb-1"><span className="text-[#ffd4a3] font-semibold">İskonto:</span><span className="font-semibold text-[#ffd4a3]">-₺{discountAmount}</span></div>
                            <div className="border-t border-white/20 my-2" />
                            <div className="flex items-center justify-between"><span className="font-bold text-white">Ödenecek:</span><span className="font-bold text-2xl text-[#a8e6cf]">₺{totalPrice - Number(discountAmount)}</span></div>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => { setShowDiscount(false); setDiscountAmount(''); }} className="bg-white/10 text-white py-4 rounded-2xl font-bold text-base transition-all active:scale-[0.98]">İptal</button>
                        <button onClick={handleProceed} className="bg-gradient-to-r from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] py-4 rounded-2xl font-bold text-base hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg">
                          <Send className="w-5 h-5" /> İlerle
                        </button>
                      </div>
                    </div>
                  )}
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
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { code: 'USD' as const, flag: '🇺🇸', rate: exchangeRates.USD, color: '[#a8e6cf]' },
                    { code: 'EUR' as const, flag: '🇪🇺', rate: exchangeRates.EUR, color: '[#9dd9ea]' },
                    { code: 'GBP' as const, flag: '🇬🇧', rate: exchangeRates.GBP, color: '[#ffd4a3]' },
                  ].map(c => (
                    <button key={c.code} onClick={() => setSelectedCurrency(c.code)}
                      className={`bg-white/5 rounded-lg p-3 text-center transition-all active:scale-95 ${selectedCurrency === c.code ? `ring-2 ring-${c.color} bg-${c.color}/10` : 'hover:bg-white/10'}`}
                    >
                      <div className="text-xs text-gray-400 mb-1 flex items-center justify-center gap-1"><span>{c.flag}</span><span>{c.code}</span></div>
                      <div className={`text-base font-bold text-${c.color}`}>₺{c.rate.toFixed(2)}</div>
                      <div className="text-[10px] text-white/30 mt-0.5">1 {c.code}</div>
                    </button>
                  ))}
                </div>
                <div className="relative mb-3">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/20" /></div>
                  <div className="relative flex justify-center"><span className="bg-white/5 px-2 py-0.5 text-xs text-gray-400 rounded-full">🔄</span></div>
                </div>
                {cart.length > 0 ? (
                  <div className="space-y-2">
                    <div className="bg-white/5 rounded-lg p-3 border border-white/20">
                      <div className="text-xs text-gray-400 mb-1">{discountAmount && Number(discountAmount) > 0 ? 'Ödenecek Tutar' : 'Sepet Toplamı'}</div>
                      <div className="text-2xl font-black text-white">₺{discountAmount && Number(discountAmount) > 0 ? totalPrice - Number(discountAmount) : totalPrice}</div>
                    </div>
                    {selectedCurrency && (
                      <div className={`p-3 rounded-lg border-2 ${selectedCurrency === 'USD' ? 'bg-[#a8e6cf]/20 border-[#a8e6cf]/50' : selectedCurrency === 'EUR' ? 'bg-[#9dd9ea]/20 border-[#9dd9ea]/50' : 'bg-[#ffd4a3]/20 border-[#ffd4a3]/50'}`}>
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-gray-400">{selectedCurrency === 'USD' ? '🇺🇸 USD' : selectedCurrency === 'EUR' ? '🇪🇺 EUR' : '🇬🇧 GBP'}</div>
                          <div className={`text-3xl font-black ${selectedCurrency === 'USD' ? 'text-[#a8e6cf]' : selectedCurrency === 'EUR' ? 'text-[#9dd9ea]' : 'text-[#ffd4a3]'}`}>{calculateForeignCurrency()}</div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white/5 rounded-lg p-4 border border-white/20 text-center"><div className="text-3xl mb-2">🛒</div><div className="text-sm text-gray-400">Sepete ürün ekleyin</div></div>
                )}
              </div>

              {/* Recent Sales */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  Bugünkü Satışlar <span className="text-lg">📊</span>
                  {recentSales.length > 0 && (
                    <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-[#a8e6cf]/20 text-[#a8e6cf]">
                      ₺{recentSales.reduce((s, sale) => s + (sale.finalPrice || sale.totalPrice - sale.discount), 0).toLocaleString('tr-TR')}
                    </span>
                  )}
                </h3>
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
                    const itemSummary = sale.items?.map(i => `${i.quantity}× ${i.product}`).join(', ') || '—';
                    const saleTime = sale.timestamp
                      ? new Date(sale.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
                      : '—';
                    const pmIcon = sale.paymentMethod === 'cash' ? '💵' : sale.paymentMethod === 'iban' ? '🏦' : '💳';
                    return (
                      <div key={sale.id} className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#a8e6cf] to-[#8dd9b8] flex items-center justify-center text-[#2d3748] text-lg shadow-md flex-shrink-0">✓</div>
                            <div className="min-w-0">
                              <div className="font-semibold text-white text-sm truncate max-w-[160px]">{itemSummary}</div>
                              <div className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{saleTime}</span>
                                <span>{pmIcon} {sale.paymentMethod === 'cash' ? 'Nakit' : sale.paymentMethod === 'iban' ? 'IBAN' : 'Kart'}</span>
                                {sale.currency !== 'TRY' && sale.currencyPrice && (
                                  <span className="text-[#ffd4a3]">{sale.currency} {sale.currencyPrice}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="text-right">
                              <div className="font-bold text-white text-sm">₺{(sale.finalPrice ?? sale.totalPrice - sale.discount).toLocaleString('tr-TR')}</div>
                              {sale.discount > 0 && (
                                <div className="text-xs text-[#ffd4a3] flex items-center gap-1 justify-end">
                                  <Tag className="w-3 h-3" />₺{sale.discount} indirim
                                </div>
                              )}
                            </div>
                            {cart.length === 0 && (
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
              {/* Seçili Mekan */}
              <div className="flex items-center gap-3 bg-gradient-to-br from-[#d4b5f7]/15 to-[#c79ff0]/10 border border-[#d4b5f7]/30 rounded-2xl p-3">
                <span className="text-xl">{selectedProject.icon}</span>
                <div className="flex-1">
                  <div className="font-bold text-white text-sm">{selectedProject.name}</div>
                  <div className="text-xs text-[#d4b5f7]/70">Seçili mekan</div>
                </div>
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
                    {frameEntries.map((entry: any) => (
                      <div key={entry.id} className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2.5 border border-white/10">
                        <div className="w-8 h-8 rounded-lg bg-[#d4b5f7]/20 flex items-center justify-center text-sm flex-shrink-0">📸</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-white text-xs truncate">{entry.photographerName}</div>
                          <div className="text-xs text-gray-400">
                            {new Date(entry.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-black text-[#9dd9ea] text-sm">{entry.frameCount}</div>
                          <div className="text-xs text-gray-500">kare</div>
                        </div>
                      </div>
                    ))}
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
                      {printers.length} yazıcı • bitiş sayacı & ribon değişimi
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
                        Mekan'dan kağıt bilgisi alınamadı — lütfen aşağıdan manuel seçin
                      </p>
                    </div>
                    {/* Kağıt tipi seçici */}
                    {availablePapers.length > 0 ? (
                      <div>
                        <p className="text-[10px] text-gray-400 mb-1.5 font-semibold uppercase tracking-wide">Kağıt Tipi</p>
                        <div className="flex flex-wrap gap-2">
                          {availablePapers.map(p => {
                            const kap = Number(p.pcsPerBox) / Number(p.setsPerBox);
                            const selected = manualPaperId === p.id;
                            return (
                              <button
                                key={p.id}
                                onClick={() => setManualPaperId(p.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                  selected
                                    ? 'bg-amber-400/20 border-amber-400/60 text-amber-300'
                                    : 'bg-white/5 border-white/15 text-gray-400 active:scale-95'
                                }`}
                              >
                                {p.name || p.id}
                                <span className="ml-1 text-[10px] opacity-70">({kap}/tkm)</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-500">Tanımlı kağıt tipi yok — Maliyet Yönetimi'nden ekleyin</p>
                    )}
                    {/* Tam / Yarım seçici */}
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
                    {/* Seçim özeti */}
                    {manualPaperId && (
                      <div className="bg-amber-400/10 border border-amber-400/20 rounded-xl px-3 py-1.5 flex items-center justify-between">
                        <span className="text-[10px] text-amber-300">Kapasite</span>
                        <span className="text-xs font-black text-amber-200">{manualKapasite}/takım • {manualPrintType === 'tam' ? 'Tam' : 'Yarım'}</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-3">
                  {printers.map(printer => {
                    const start = Number(printer.startCounter) || 0;
                    const end = Number(printerEndCounters[printer.id] || 0);
                    const ribbonCount = Number(printerRibbonChanges[printer.id] || 0);
                    const iade = Number(printerIadePhotos[printer.id] || 0);
                    // Canlı hesaplama: kullanilanBaskı = açılış + degisim×kapasite - kapanış
                    const kullanilanBaskı = effectiveKapasite > 0
                      ? Math.max(0, start + (ribbonCount * effectiveKapasite) - end)
                      : Math.max(0, start - end); // kapasite bilinmiyorsa sadece fark
                    const carpan = effectivePrintType === 'tam' ? 1 : 2;
                    const cikisAdedi = Math.round(kullanilanBaskı * carpan);
                    const satılan = Math.max(0, cikisAdedi - iade);
                    const hasEndInput = !!printerEndCounters[printer.id] && start > 0;
                    return (
                      <div key={printer.id} className="bg-black/30 border border-white/10 rounded-xl p-3 space-y-3">
                        {/* Başlık */}
                        <div className="flex items-center gap-2">
                          <span className="text-base">🖨️</span>
                          <span className="text-sm font-bold text-white flex-1">{printer.label}</span>
                          {printer.startCounter && (
                            <span className="text-xs text-gray-400">Açılış: <span className="text-[#ffd4a3] font-bold">{printer.startCounter}</span></span>
                          )}
                        </div>
                        {/* Bitiş Sayacı */}
                        <div>
                          <p className="text-xs text-gray-400 mb-1.5">Bitiş Sayacı</p>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={printerEndCounters[printer.id] || ''}
                            onChange={e => updatePrinterEnd(printer.id, e.target.value)}
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
                            value={printerRibbonChanges[printer.id] || ''}
                            onChange={e => updatePrinterRibbon(printer.id, e.target.value)}
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

                        {/* İade Fotoğraf */}
                        <div>
                          <p className="text-xs text-gray-400 mb-1.5 flex items-center gap-1.5">
                            <span className="text-[#ffb3ba]">↩️</span>
                            <span>İade Fotoğraf Adedi</span>
                            <span className="text-gray-600 text-[10px]">(isteğe bağlı)</span>
                          </p>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={printerIadePhotos[printer.id] || ''}
                            onChange={e => updatePrinterIade(printer.id, e.target.value)}
                            placeholder="0"
                            disabled={shiftEndDone}
                            className="w-full px-3 py-2.5 bg-[#ffb3ba]/10 border border-[#ffb3ba]/20 rounded-lg text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#ffb3ba]/40 text-center font-bold text-lg disabled:opacity-60"
                          />
                          {iade > 0 && (
                            <div className="flex items-center justify-between bg-[#ffb3ba]/10 border border-[#ffb3ba]/20 rounded-lg px-3 py-1.5 mt-1.5">
                              <span className="text-xs text-gray-400">İade:</span>
                              <span className="text-sm font-black text-[#ffb3ba]">−{iade} adet</span>
                            </div>
                          )}
                        </div>

                        {/* ── Canlı Hesaplama Özeti ── */}
                        {hasEndInput && (
                          <div className="bg-gradient-to-br from-[#a8e6cf]/10 to-[#8dd9b8]/5 border border-[#a8e6cf]/25 rounded-xl p-3">
                            <p className="text-[10px] text-[#a8e6cf]/70 font-semibold mb-2 uppercase tracking-wide">Vardiya Hesabı</p>
                            <div className="space-y-1.5">
                              {/* Formül satırı */}
                              {effectiveKapasite > 0 && (
                                <div className="text-[10px] text-gray-500 bg-black/20 rounded-lg px-2 py-1 font-mono">
                                  {start} + {ribbonCount}×{effectiveKapasite} − {end} = <span className="text-[#ffd4a3] font-bold">{kullanilanBaskı}</span> baskı
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
                              {iade > 0 && (
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-gray-400">İade düşüldü</span>
                                  <span className="text-sm font-black text-[#ffb3ba]">−{iade}</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between border-t border-white/10 pt-1.5 mt-1">
                                <span className="text-xs font-bold text-white">Net Satılan</span>
                                <span className="text-base font-black text-[#a8e6cf]">{satılan} 📸</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {printers.length > 1 && (
                  <div className="mt-3 space-y-2">
                    <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 flex items-center justify-between">
                      <span className="text-xs text-gray-400">Toplam kullanılan baskı:</span>
                      <span className="text-sm font-black text-[#a8e6cf]">
                        {printers.reduce((sum, pr) => {
                          const s = Number(pr.startCounter) || 0;
                          const e = Number(printerEndCounters[pr.id] || 0);
                          const r = Number(printerRibbonChanges[pr.id] || 0);
                          return sum + (effectiveKapasite > 0
                            ? Math.max(0, s + r * effectiveKapasite - e)
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
                          const e = Number(printerEndCounters[pr.id] || 0);
                          const r = Number(printerRibbonChanges[pr.id] || 0);
                          const kb = effectiveKapasite > 0
                            ? Math.max(0, s + r * effectiveKapasite - e)
                            : Math.max(0, s - e);
                          return sum + Math.round(kb * (effectivePrintType === 'tam' ? 1 : 2));
                        }, 0)} adet
                      </span>
                    </div>
                    {printers.some(pr => Number(printerRibbonChanges[pr.id] || 0) > 0) && (
                      <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 flex items-center justify-between">
                        <span className="text-xs text-gray-400">Toplam ribon değişimi:</span>
                        <span className="text-sm font-black text-[#9dd9ea]">
                          {printers.reduce((sum, pr) => sum + Number(printerRibbonChanges[pr.id] || 0), 0)} adet
                        </span>
                      </div>
                    )}
                    {printers.some(pr => Number(printerIadePhotos[pr.id] || 0) > 0) && (
                      <div className="bg-[#ffb3ba]/10 border border-[#ffb3ba]/20 rounded-xl px-4 py-2.5 flex items-center justify-between">
                        <span className="text-xs text-gray-400">Toplam iade fotoğraf:</span>
                        <span className="text-sm font-black text-[#ffb3ba]">
                          −{printers.reduce((sum, pr) => sum + Number(printerIadePhotos[pr.id] || 0), 0)} adet
                        </span>
                      </div>
                    )}
                    <div className="bg-gradient-to-r from-[#a8e6cf]/15 to-[#8dd9b8]/10 border border-[#a8e6cf]/30 rounded-xl px-4 py-2.5 flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Net Satılan 📸</span>
                      <span className="text-sm font-black text-[#a8e6cf]">
                        {printers.reduce((sum, pr) => {
                          const s = Number(pr.startCounter) || 0;
                          const e = Number(printerEndCounters[pr.id] || 0);
                          const r = Number(printerRibbonChanges[pr.id] || 0);
                          const ia = Number(printerIadePhotos[pr.id] || 0);
                          const kb = effectiveKapasite > 0
                            ? Math.max(0, s + r * effectiveKapasite - e)
                            : Math.max(0, s - e);
                          const cikis = Math.round(kb * (effectivePrintType === 'tam' ? 1 : 2));
                          return sum + Math.max(0, cikis - ia);
                        }, 0)} adet
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

                            {albumItems.map(({ key, label, emoji }) => {
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
                                    <div className="text-center">
                                      <p className="text-[10px] text-[#9dd9ea] mb-1">Kalan</p>
                                      <input
                                        type="number"
                                        inputMode="numeric"
                                        value={reyonKapanisSayim[key as keyof StokSayim] || ''}
                                        onChange={e => setReyonKapanisSayim(p => ({ ...p, [key]: parseInt(e.target.value) || 0 }))}
                                        placeholder="0"
                                        disabled={shiftEndDone}
                                        className="w-full px-2 py-2 bg-[#9dd9ea]/10 border border-[#9dd9ea]/30 rounded-xl text-[#9dd9ea] placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#9dd9ea]/50 text-center font-bold text-base disabled:opacity-60"
                                      />
                                    </div>
                                  </div>
                                  {/* Özet satır */}
                                  {(acilis > 0 || gunIciEkleme > 0) && (
                                    <div className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-1.5 text-xs text-gray-400">
                                      <span>{acilis} + {gunIciEkleme} − {kapanis}</span>
                                      <span className={`font-bold ${satilan > 0 ? 'text-[#a8e6cf]' : 'text-gray-500'}`}>
                                        = {satilan} satıldı
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {/* Toplam satış özeti */}
                            {albumItems.some(({ key }) => (shiftShelves[key] || 0) > 0 || (reyonGunIciEkleme[key] || 0) > 0) && (
                              <div className="bg-[#a8e6cf]/10 border border-[#a8e6cf]/20 rounded-xl p-3">
                                <p className="text-xs font-semibold text-[#a8e6cf] mb-2">🎯 Reyon satış özeti:</p>
                                <div className="flex flex-wrap gap-x-4 gap-y-1">
                                  {albumItems.map(({ key, label }) => {
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
                                  {(Object.keys(stokAlanAdi) as Array<keyof StokSayim>).filter(a => (kapanisBeklenen[a] ?? 0) > 0).map(alan => (
                                    <span key={alan} className="text-xs text-gray-400">{stokAlanEmoji[alan]} {kapanisBeklenen[alan]}</span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {(Object.keys(stokAlanAdi) as Array<keyof StokSayim>).map((alan) => {
                              // Ribon için yazıcı değişim verilerinden client-side beklenen hesapla
                              const toplamRibonDegisim = printers.reduce((sum, pr) => sum + Number(printerRibbonChanges[pr.id] || 0), 0);
                              const clientBeklenenRibon = Math.max(0, (acilisSayim.ribon || 0) - toplamRibonDegisim);

                              // Kapanış öncesi ribon için client hesabını göster, sonrası için server değerini
                              let beklenen = kapanisBeklenen?.[alan] ?? null;
                              if (alan === 'ribon' && !shiftEndDone) {
                                beklenen = clientBeklenenRibon;
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
                                        {alan === 'ribon' ? (
                                          <p className="text-xs text-[#9dd9ea]/80 mt-0.5">
                                            Açılış <span className="font-bold text-white">{acilisSayim.ribon || 0}</span>
                                            {' − '}Değişim <span className="font-bold text-[#ffd4a3]">{toplamRibonDegisim}</span>
                                            {' = '}Beklenen <span className="font-bold text-[#9dd9ea]">{clientBeklenenRibon}</span>
                                          </p>
                                        ) : (
                                          beklenen !== null && <p className="text-xs text-gray-500">Beklenen: {beklenen}</p>
                                        )}
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

                            {!shiftEndDone && !reyonAcik && stokGunluk?.acilis &&
                              (Object.keys(stokAlanAdi) as Array<keyof StokSayim>).some(a => {
                                let bek = (stokGunluk!.acilis as StokSayim)[a] || 0;
                                for (const ek of stokEklemeler) bek += (ek.miktar as Record<string, number>)[a] || 0;
                                if (a === 'ribon') bek -= printers.reduce((s, pr) => s + (Number(printerRibbonChanges[pr.id] || 0)), 0);
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
                                {vt.toplamMaliyet > 0 && (
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
              className="w-full bg-gradient-to-b from-[#3a3a4e] to-[#2f3439] border border-amber-500/30 rounded-3xl p-6 shadow-2xl"
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
              className="w-full bg-gradient-to-b from-[#3a3a4e] to-[#2f3439] border border-amber-500/30 rounded-3xl p-6 shadow-2xl"
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
              <div className="flex gap-3">
                <button
                  onClick={() => setShowKapanisAnomaliUyari(false)}
                  className="flex-1 py-3 rounded-2xl bg-white/10 border border-white/20 text-white font-semibold text-sm active:scale-[0.98] transition-all"
                >
                  ← Geri Dön
                </button>
                <button
                  onClick={() => { setShowKapanisAnomaliUyari(false); handleShiftEndComplete(); }}
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
              className="w-full bg-gradient-to-b from-[#3a3a4e] to-[#2f3439] rounded-t-3xl p-5 max-h-[70vh] flex flex-col"
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
          <div className="w-full max-w-md bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] rounded-3xl shadow-2xl border-2 border-white/10 overflow-hidden max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-8 duration-300">
            <div className="relative backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border-b border-white/10 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] flex items-center justify-center text-2xl shadow-lg">💳</div>
                <div><h3 className="text-2xl font-black text-white">Ödeme Yöntemi</h3><p className="text-gray-400 text-sm">Nasıl ödeme alacaksınız?</p></div>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gray-400 font-medium">Toplam Tutar:</span>
                  <span className="text-3xl font-black text-white">₺{totalPrice}</span>
                </div>
                {discountAmount && Number(discountAmount) > 0 && (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[#ffd4a3] font-bold flex items-center gap-2"><span className="text-xl">🏷️</span>İskonto:</span>
                      <span className="text-[#ffd4a3] font-black text-xl">-₺{discountAmount}</span>
                    </div>
                    <div className="border-t border-white/20 pt-3 mt-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">Ödenecek:</span>
                        <span className="text-4xl font-black bg-gradient-to-r from-[#a8e6cf] to-[#8dd9b8] bg-clip-text text-transparent">₺{totalPrice - Number(discountAmount)}</span>
                      </div>
                    </div>
                  </>
                )}
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
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => { setShowPaymentMethod(false); setPaymentMethod(null); }} className="backdrop-blur-xl bg-white/10 border-2 border-white/20 text-white py-4 rounded-2xl font-bold text-base hover:bg-white/20 transition-all active:scale-[0.98]">Geri</button>
                <button
                  type="button"
                  onClick={handleCompleteSale}
                  disabled={!paymentMethod || satisSaving}
                  className={`py-4 rounded-2xl font-bold text-base transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg ${paymentMethod && !satisSaving ? 'bg-gradient-to-br from-[#a8e6cf] to-[#8dd9b8] text-[#2d3748] hover:shadow-xl cursor-pointer' : 'bg-white/5 text-gray-600 cursor-not-allowed opacity-50 border-2 border-white/10'}`}
                >
                  {satisSaving ? (
                    <><span className="w-4 h-4 border-2 border-[#2d3748]/40 border-t-[#2d3748] rounded-full animate-spin" /> Kaydediliyor...</>
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
              className="w-full max-w-md bg-gradient-to-b from-[#1a0a2e] to-[#0a051e] border border-red-500/30 rounded-3xl shadow-2xl overflow-hidden"
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

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-gradient-to-b from-white to-[#ffe5e5] rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-destructive to-[#ff6b6b] p-6 text-white">
              <div className="flex items-center gap-3 mb-2"><AlertCircle className="w-8 h-8" /><h3 className="text-2xl font-bold">Satış İptali</h3></div>
              <p className="text-white/90 text-sm">Bu satış neden iptal ediliyor?</p>
            </div>
            <div className="p-6 space-y-4">
              <textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="İptal sebebini yazın..."
                className="w-full bg-white border-2 border-gray-200 focus:border-destructive rounded-xl px-4 py-3 text-gray-800 text-sm resize-none outline-none transition-all"
                rows={3}
              />
              <div className="grid grid-cols-2 gap-3">
                <button onClick={closeCancelModal} className="py-3 rounded-xl border-2 border-gray-300 text-gray-600 font-bold transition-all hover:bg-gray-50">Vazgeç</button>
                <button onClick={confirmCancelSale} className="py-3 rounded-xl bg-gradient-to-r from-destructive to-[#ff6b6b] text-white font-bold shadow-lg transition-all hover:shadow-xl active:scale-95">İptal Et</button>
              </div>
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
            className="w-full max-w-md bg-gradient-to-br from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] rounded-3xl shadow-2xl border-2 border-[#a8e6cf]/30 overflow-hidden"
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
