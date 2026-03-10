ROTASYON SİSTEMİ - DETAYLI TEKNİK PROMPT
GENEL AÇIKLAMA
"Aspect Operations" turistik fotoğrafçılık işletmesi için iOS mobil uygulaması içinde çalışan Rotasyon Yönetim Sistemi. Personel görevlendirme, izin takibi ve günlük görev planlama için kullanılıyor.

TASARIM SİSTEMİ
Renk Paleti
Arka Plan: Koyu gradient (dark gray/blue tones)
Kartlar: Glassmorphism efektli (backdrop-blur-xl, bg-white/10, border-2 border-white/20)
Primary Buton: Gradient mavi-cyan from-[#9dd9ea] to-[#7ec8dd]
Success Buton: Gradient yeşil from-[#a8e6cf] to-[#8dd9b8]
Aktif Tab: Mavi renkli bg-[#9dd9ea] text-[#2d3748]
Draft Görev: Turuncu bg-orange-500/10 border-orange-500/30
Sent Görev: Mavi bg-blue-500/10 border-blue-500/30
Revised Görev: Turuncu bg-orange-500/10 border-orange-500/30
Cancelled Görev: Kırmızı bg-red-500/10 border-red-500/40
Special Görev: Mor bg-purple-500/10 border-purple-500/30
İzinli Kart: Mavi/yeşil ton
Beklemede Kart: Gri/amber ton
Tipografi
Başlıklar: font-bold, text-white
Alt Başlıklar: text-sm/text-xs, text-gray-400
Buton Metinleri: font-semibold/font-bold, text-xs/text-sm
İkonlar
Lucide React paketi kullan
Emoji ikonları: 🏖️ 🍽️ 🐟 ☕ 🌊 ⚓ 🚢 ⚡ 📋 📅 🔄 ✅ ❌
Animasyonlar
motion/react paketi (Framer Motion eski adı)
AnimatePresence ile giriş/çıkış animasyonları
initial/animate/exit yapısı
Butonlarda active:scale-95 efekti
Hover geçişleri transition-all
COMPONENT YAPISI
Props Interface
interface RotationProps {
  userName: string;
  userRole: 'admin' | 'manager' | 'project_lead' | 'staff';
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}
State Yönetimi (21 state)
const [activeTab, setActiveTab] = useState<'plan' | 'assigned' | 'leaves'>('plan');
const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
const [showTaskModal, setShowTaskModal] = useState(false);
const [modalType, setModalType] = useState<'regular_location' | 'extra_special'>('regular_location');
const [editingTask, setEditingTask] = useState<Task | null>(null);
const [showCancelModal, setShowCancelModal] = useState(false);
const [cancellingTask, setCancellingTask] = useState<Task | null>(null);
const [cancelReason, setCancelReason] = useState('');
const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
const [showSuccessNotification, setShowSuccessNotification] = useState(false);
const [showLeaveModal, setShowLeaveModal] = useState(false);
const [notificationMessage, setNotificationMessage] = useState('');
const [selectedOnLeave, setSelectedOnLeave] = useState<string[]>([]);
const [selectedStandby, setSelectedStandby] = useState<string[]>([]);
const [dailyOnLeave, setDailyOnLeave] = useState<Record<string, string[]>>({});
const [visibleTaskCount, setVisibleTaskCount] = useState(30);
const [showPersonalHistory, setShowPersonalHistory] = useState(false);
const [historyFilter, setHistoryFilter] = useState<'week' | 'month' | '2months'>('month');
const [tasks, setTasks] = useState<Task[]>([]);
const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
const [leaveForm, setLeaveForm] = useState({ personnelId: '', startDate: '', endDate: '', type: 'annual', notes: '' });
const [taskForm, setTaskForm] = useState({ personnelIds: [], location: '', startTime: '09:00', endTime: '17:00', type: 'regular', notes: '' });
DATA MODELLERI
Task Interface
interface Task {
  id: string;
  personnel: Personnel[]; // Çoklu personel
  location: string;
  locationIcon: string;
  startTime: string; // "09:00"
  endTime: string; // "17:00"
  type: 'regular' | 'special';
  notes?: string;
  status: 'draft' | 'sent' | 'revised' | 'cancelled'; // 4 DURUM
  date: string; // ISO format
  sentAt?: string; // "14:30"
  cancelledAt?: string;
  cancelReason?: string;
  revisedAt?: string;
  revisionCount?: number; // Kaç kez revize edildi
}
StaffMember Interface
interface StaffMember {
  id: string;
  name: string;
  avatar: string; // Emoji
  role: 'admin' | 'manager' | 'project_lead' | 'staff' | 'administrative';
  status: 'active' | 'on_leave'; // SABİT İZİNLİLER
}
LeaveRequest Interface
interface LeaveRequest {
  id: string;
  personnelId: string;
  personnelName: string;
  personnelAvatar: string;
  startDate: string; // "2026-03-10"
  endDate: string; // "2026-03-14"
  days: number;
  type: 'annual' | 'sick' | 'personal';
  notes: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}
Mock Data
30 Personel: ID 1-30, isimler Türkçe, emoji avatarlar
7 Lokasyon: ZOKA Beach Club 🏖️, Müjgan Restaurant 🍽️, Balıkhali 🐟, Hayal Kahvesi ☕, Alaçatı Beach 🌊, Marina ⚓, Port Alaçatı 🚢
60 günlük kişisel geçmiş: Mart, Şubat, Ocak 2026 verileri
3 SEKMELİ SİSTEM
1️⃣ GÖREV PLANLA (plan)
Tarih Seçici
Yatay kaydırmalı tarih listesi (bugün ±7 gün)
Seçili tarih mavi arka plan
Bugün yeşil border
Tarih formatı: "7 Mar" + haftanın günü
Lokasyon Bazlı Görevler
7 lokasyon için ayrı kartlar
Her kart: Lokasyon ikonu + isim + saat + personel avatarları
Checkbox seçim (draft görevlerde)
4 durum yönetimi:
Draft (taslak): Turuncu, checkbox var, düzenlenebilir
Sent (gönderildi): Mavi, checkbox yok, salt okunur
Revised (revize edildi): Turuncu, tekrar gönderilebilir, revize sayısı badge
Cancelled (iptal edildi): Kırmızı, çizgili, iptal nedeni gösterilir
Revize Badge Sistemi
Sağ üst köşede taşan badge
Amber renk bg-amber-600/90 border-amber-500
"Revize" yazısı + sayı (örn: "2x")
Sadece revisionCount > 0 ise göster
3 Katmanlı İzinli Personel Koruması
KORUMA 1 - Modal Açılışta:

const availableStaff = staffMembers.filter(staff => {
  if (staff.status === 'on_leave') return false;
  const dailyOnLeaveList = dailyOnLeave[selectedDate] || [];
  if (dailyOnLeaveList.includes(staff.id)) return false;
  const approvedLeave = leaveRequests.find(leave => 
    leave.personnelId === staff.id && 
    leave.status === 'approved' &&
    new Date(selectedDate) >= new Date(leave.startDate) &&
    new Date(selectedDate) <= new Date(leave.endDate)
  );
  return !approvedLeave;
});
KORUMA 2 - Form Submit:

const isAnyOnLeave = selectedPersonnel.some(personnelId => {
  const staff = staffMembers.find(s => s.id === personnelId);
  if (!staff) return false;
  if (staff.status === 'on_leave') return true;
  const dailyOnLeaveList = dailyOnLeave[selectedDate] || [];
  if (dailyOnLeaveList.includes(personnelId)) return true;
  // ... izin kontrolü
});
KORUMA 3 - Görsel İpuçları:

İzinli personel kırmızı border + 🏖️ ikonu
Bildirim: "Bu personel izinli, eklenemiyor!"
Modalda sadece müsait personel göster
İzinli ve Beklemede Kartları
İzinli Kart:

Yeşil/mavi ton
🏖️ ikonu
İzinli personel listesi (avatarlar)
Checkbox seçim
"Tümünü Seç" / "Seçimi Temizle" butonları
Beklemede Kart:

Gri/amber ton
⏳ ikonu
Göreve atanmamış + izinli olmayan personel
Checkbox seçim
"Tümünü Seç" / "Seçimi Temizle" butonları
Gönderi Butonları (Floating Footer)
Seçimi Temizle: Gri, sadece seçim varsa görünür
Seçili Gönder: Mavi, seçilen görev/personel sayısı gösterilir, disabled yoksa
Tümünü Gönder: Yeşil, tüm draft+revised+izinli+beklemede sayısı
Ekstra & Özel Görevler
Düz liste (lokasyon kartları gibi)
2 tip:
Special: Özel görev (mor)
Extra: Lokasyon listesinde olmayan görev (mavi)
Aynı durum yönetimi (draft/sent/revised/cancelled)
Modallar
Görev Ekleme/Düzenleme Modal:

2 tip: regular_location (lokasyon seç) veya extra_special (manuel lokasyon gir)
Personel çoklu seçim (avatarlar + isimler)
Lokasyon dropdown veya input
Başlangıç/Bitiş saati
Notlar (opsiyonel)
"Kaydet" ve "İptal" butonları
Görev İptal Modal:

İptal nedeni textarea (zorunlu)
"İptali Onayla" ve "Vazgeç" butonları
İptal edilince status: 'cancelled'
Bildirim Toast:

Sağ üstte yeşil toast
3 saniye otomatik kapanır
Mesaj: "X Görev 📱 Y İzinli 🏖️ Z Beklemede ⏳"
2️⃣ ROTASYONLAR (assigned)
Son 3 Gün Sistemi
Bugün dahil son 3 günü göster
Her gün için başlık: "Bugün (7 Mar)" / "Dün (6 Mar)" / "2 Mart Cuma"
Tarih grupları tersten sıralı (en yeni üstte)
Dinamik Kartlar
Her tarih için OTOMATİK 2 kart oluştur:

İzinli Kart (sadece izinli varsa)
Beklemede Kart (sadece beklemedeki varsa)
Görev Kartları
Sadece sent, revised, cancelled durumlu görevler
Gönderilen saat gösterilir
Revize badge (varsa)
İptal edilmişse: çizgili, iptal nedeni ve saati
"Daha Fazla Göster" Butonu
İlk başta 30 görev göster
Buton: "+20 Daha Fazla Göster"
Her tıklamada 20 artır
3️⃣ İZİNLER (leaves)
Kişisel Geçmiş Butonu
"📊 Geçmişim" butonu
Toggle açılır/kapanır
Altta kompakt liste
Geçmiş Filtreleme
3 Filtre Butonu:

Bu Hafta: Pazartesi - Bugün
Bu Ay: Ayın 1'i - Bugün
Son 2 Ay: Geçen ayın 1'i - Bugün
Filtreleme Mantığı:

const getFilteredHistory = () => {
  const now = new Date();
  let startDate: Date;

  if (historyFilter === 'week') {
    // Pazartesiden bugüne
    const dayOfWeek = now.getDay(); // 0 = Pazar
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startDate = new Date(now);
    startDate.setDate(now.getDate() - daysFromMonday);
    startDate.setHours(0, 0, 0, 0);
  } else if (historyFilter === 'month') {
    // Ayın 1'inden bugüne
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    // Geçen ayın 1'inden bugüne
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  }

  return personalHistoryAll.filter(record => {
    const recordDate = new Date(record.date);
    return recordDate >= startDate && recordDate <= now;
  });
};
Geçmiş Liste Görünümü
Glassmorphism kart
Başlık: "📅 Çalışma Geçmişim" + kayıt sayısı
Filtre butonları: Aktif olanı mavi, diğerleri gri
Max-height: 80 (overflow-y-auto)
Her satır:
Tarih (2-digit day + short month)
Çalışma: Lokasyon ikonu + adı + saatler (mavi arka plan)
İzin: İzin tipi + açıklama (turuncu arka plan)
Veri Yapısı:

{ 
  date: '2026-03-07', 
  type: 'work' | 'leave',
  // type: 'work' için:
  location: 'ZOKA Beach Club',
  icon: '🏖️',
  startTime: '09:00',
  endTime: '17:00',
  // type: 'leave' için:
  leaveType: 'annual' | 'sick' | 'personal',
  reason: 'Yıllık İzin'
}
İzin Talepleri Listesi
Her izin talebi için kart
Avatar + isim
Tarih aralığı + gün sayısı
İzin tipi (Yıllık/Hastalık/Kişisel)
Durum badge (pending/approved/rejected)
Notlar
İzin Ekleme Modal
Personel seçimi (dropdown)
Başlangıç/Bitiş tarihi
İzin tipi (annual/sick/personal)
Notlar
"Kaydet" butonu
FONKSİYONLAR
Görev Gönderme
const handleSendTasks = (sendAll: boolean) => {
  // Sadece draft ve revised görevleri seç
  const sendableTasksToday = todayTasks.filter(t => t.status === 'draft' || t.status === 'revised');
  const tasksToSend = sendAll ? sendableTasksToday.map(t => t.id) : selectedTasks;
  const onLeaveToSend = sendAll ? onLeavePersonnel.map(p => p.id) : selectedOnLeave;
  const standbyToSend = sendAll ? standbyPersonnel.map(p => p.id) : selectedStandby;

  // Status'u 'sent' yap
  setTasks(tasks.map(t => 
    tasksToSend.includes(t.id) 
      ? { ...t, status: 'sent', sentAt: currentTime }
      : t
  ));

  // Mesaj formatla ve "gönder" (console.log)
  // Toast göster
};
Görev İptal Etme
const handleCancelTask = () => {
  setTasks(tasks.map(t => 
    t.id === cancellingTask.id 
      ? { ...t, status: 'cancelled', cancelledAt: currentTime, cancelReason: cancelReason }
      : t
  ));
  // İptal mesajı gönder
};
Görev Reaktive Etme (İptali Geri Al)
const handleReactivateTask = (task: Task) => {
  setTasks(tasks.map(t => 
    t.id === task.id 
      ? { 
          ...t, 
          status: 'revised', 
          cancelledAt: undefined, 
          cancelReason: undefined,
          revisedAt: currentTime,
          revisionCount: (t.revisionCount || 0) + 1
        }
      : t
  ));
};
Mesaj Formatlama (Mock)
const sendMessageToRotationChannel = (message: string) => {
  console.log('📤 ROTASYON MESAJI GÖNDERİLDİ:');
  console.log(message);
};

const formatRotationMessage = (tasksToSend: Task[]) => {
  const dateStr = new Date(selectedDate).toLocaleDateString('tr-TR', { 
    day: 'numeric', month: 'long', year: 'numeric', weekday: 'long'
  });
  
  let message = `📋 **GÜNLÜK ROTASYON** - ${dateStr}\n\n`;
  
  tasksToSend.forEach(task => {
    const taskType = task.type === 'special' ? '⚡' : '📌';
    message += `${taskType} ${task.locationIcon} **${task.location}**\n`;
    message += `   🕐 ${task.startTime}-${task.endTime}\n`;
    message += `   👥 Personel:\n`;
    task.personnel.forEach(person => {
      message += `      • ${person.avatar} ${person.name}\n`;
    });
    if (task.notes) message += `   📝 ${task.notes}\n`;
    message += '\n';
  });
  
  message += '✅ Görevler gönderildi. İyi çalışmalar!';
  return message;
};
ÖNEMLİ DETAYLAR
Tarih Hesaplamaları
Bugün: new Date().toISOString().split('T')[0]
Pazartesi: const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
Ayın ilk günü: new Date(now.getFullYear(), now.getMonth(), 1)
Personel Filtreleme
// İzinli personel
const onLeavePersonnel = staffMembers.filter(staff => {
  if (staff.status === 'on_leave') return true; // Sabit izinli
  const todayOnLeave = dailyOnLeave[selectedDate] || [];
  if (todayOnLeave.includes(staff.id)) return true; // Günlük izinli
  const approvedLeave = leaveRequests.find(leave => 
    leave.personnelId === staff.id && 
    leave.status === 'approved' &&
    new Date(selectedDate) >= new Date(leave.startDate) &&
    new Date(selectedDate) <= new Date(leave.endDate)
  );
  return !!approvedLeave; // Uzun dönemli izinli
});

// Göreve atanmış personel
const assignedPersonnelIds = todayTasks
  .filter(t => t.status === 'draft' || t.status === 'sent' || t.status === 'revised')
  .flatMap(task => task.personnel.map(p => p.id));

// Beklemedeki personel
const standbyPersonnel = staffMembers.filter(staff => 
  !assignedPersonnelIds.includes(staff.id) && 
  !onLeavePersonnel.some(p => p.id === staff.id)
);
Task Gruplama (Rotasyonlar sekmesi)
const last3DaysTasks = sentAndCancelledTasks.filter(task => {
  const taskDate = new Date(task.date);
  return taskDate >= threeDaysAgo && taskDate <= today;
});

const groupedTasks: { [date: string]: Task[] } = {};
last3DaysTasks.forEach(task => {
  if (!groupedTasks[task.date]) groupedTasks[task.date] = [];
  groupedTasks[task.date].push(task);
});

const sortedDates = Object.keys(groupedTasks).sort((a, b) => 
  new Date(b).getTime() - new Date(a).getTime()
);
UX DETAYLARI
Buton İnteraktivitesi
Tüm butonlarda active:scale-95
Hover'da hover:bg-white/20 veya gradient geçişler
Disabled durumda disabled:opacity-50 disabled:cursor-not-allowed
Checkbox Sistemi
CheckSquare (seçili): Yeşil renk text-[#a8e6cf]
Square (boş): Gri renk text-gray-400
Sadece draft görevlerde göster
Status Badge'leri
Draft: 🟠 Turuncu "Taslak"
Sent: 🟢 Yeşil "Gönderildi" + saat
Revised: 🟠 Turuncu "Revize Edildi"
Cancelled: 🔴 Kırmızı "İptal Edildi" + neden
Responsive Tasarım
Mobile-first yaklaşım
Yatay kaydırmalı tarih listesi (overflow-x-auto)
Sticky başlıklar
Floating footer butonları (fixed bottom)
TEKNİK GEREKSINIMLER
Paketler
{
  "dependencies": {
    "motion": "latest", // import { motion, AnimatePresence } from 'motion/react'
    "lucide-react": "latest"
  }
}
Import'lar
import { useState, useEffect } from 'react';
import { 
  Users, MapPin, Send, Calendar, Clock, Plus, X, Check, 
  ChevronRight, Edit2, Trash2, CheckCircle, XCircle, 
  AlertCircle, CheckSquare, Square, UmbrellaOff, FileText, RefreshCw 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
TypeScript
Tüm state'ler tip güvenli
Interface'ler açık ve net
Optional chaining kullan (task.notes?.trim())
Type guards (as const)
MOCK MESAJ SİSTEMİ
Tüm gönderi işlemleri console.log ile mock edilmiş:

const sendMessageToRotationChannel = (message: string) => {
  console.log('📤 ROTASYON MESAJI GÖNDERİLDİ:');
  console.log(message);
  console.log('-----------------------------------');
};
Mesaj formatları:

Günlük rotasyon: formatRotationMessage()
Revizyon: formatRevisionMessage()
İptal: formatCancelMessage()
İzinli: formatOnLeaveMessage()
Beklemede: formatStandbyMessage()
TEST SENARYOLARI
Görev oluştur → Draft durumda görünmeli
Görev gönder → Sent durumuna geçmeli, saat eklenmiş olmalı
Görev düzenle → Revised duruma geçmeli, revize sayısı artmalı
Görev iptal et → Cancelled duruma geçmeli, neden gösterilmeli
İptali geri al → Revised duruma geçmeli, revize sayısı +1
İzinli personel seç → Modal'da görünmemeli, uyarı verilmeli
Geçmiş filtrele → Bu hafta/Bu ay/Son 2 ay doğru çalışmalı
Tarih değiştir → İzinli ve beklemedeki personel güncellenmeli
