// ⚠️ DİKKAT: BU DOSYA KULLANILMIYOR
// Bu dosya eski bir Figma import'undan kalmış bir spec/dokümantasyon dosyasıdır.
// Hiçbir bileşen tarafından import edilmemektedir.
// Referans amaçlı tutulmaktadır — aktif kod değildir.
//
// ROL SİSTEMİ: Aşağıdaki tüm roller güncel 7-rol sistemine göre güncellenmiştir.
// Aktif UserRole tipi için → /src/app/components/login.tsx
// Roller: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen'

📌 1. GENEL TANIM
Turistik fotoğrafçılık işletmesi için rol tabanlı kullanıcı yönetim paneli. Yönetici kullanıcıları yönetir, roller atar, askıya alır veya siler. 3 farklı görünüm modu var.

🎨 2. TASARIM SİSTEMİ
Renk Paleti (Rol Bazlı):
const roleColors = {
  yonetici: {
    bg: 'from-red-500/20 to-red-600/20',
    text: 'text-red-400',
    badge: 'bg-red-500/20 border-red-500/30 text-red-200'
  },
  'ust-mudur': {
    bg: 'from-pink-500/20 to-pink-600/20',
    text: 'text-pink-400',
    badge: 'bg-pink-500/20 border-pink-500/30 text-pink-200'
  },
  mudur: {
    bg: 'from-purple-500/20 to-purple-600/20',
    text: 'text-purple-400',
    badge: 'bg-purple-500/20 border-purple-500/30 text-purple-200'
  },
  operasyon: {
    bg: 'from-blue-500/20 to-blue-600/20',
    text: 'text-blue-400',
    badge: 'bg-blue-500/20 border-blue-500/30 text-blue-200'
  },
  personel: {
    bg: 'from-green-500/20 to-green-600/20',
    text: 'text-green-400',
    badge: 'bg-green-500/20 border-green-500/30 text-green-200'
  },
  idari: {
    bg: 'from-amber-500/20 to-amber-600/20',
    text: 'text-amber-400',
    badge: 'bg-amber-500/20 border-amber-500/30 text-amber-200'
  },
  bekleyen: {
    bg: 'from-gray-500/20 to-gray-600/20',
    text: 'text-gray-400',
    badge: 'bg-gray-500/20 border-gray-500/30 text-gray-200'
  }
};
İkonlar (Lucide-react):
import { Shield, Crown, UserCog, UserCheck, User, Briefcase, UserPlus } from 'lucide-react';

const roleIcons = {
  yonetici: Shield,
  'ust-mudur': Crown,
  mudur: UserCog,
  operasyon: UserCheck,
  personel: User,
  idari: Briefcase,
  bekleyen: UserPlus
};
Glassmorphism Kartlar:
backdrop-blur-xl
bg-gradient-to-br from-white/10 to-white/5
border-2 border-white/20
rounded-2xl
📊 3. SEKME SİSTEMİ (3 TAB)
TAB 1: AKTİF KULLANICILAR
<button className="w-full p-4 rounded-xl bg-gradient-to-br from-[#9dd9ea]/30 to-[#7ec8dd]/20 border-2 border-[#9dd9ea]/50">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <UserCheck className="w-5 h-5 text-[#9dd9ea]" />
      <span>Aktif</span>
    </div>
    <span className="text-2xl font-bold">{users.length}</span>
  </div>
</button>
Özellikler:

Rollere göre gruplu gösterim
Her rol için ayrı kart (yonetici, ust-mudur, mudur, operasyon, personel, idari)
Kullanıcı kartında:
İsim + Email
Oluşturulma tarihi
Son giriş tarihi
Butonlar (sadece yonetici, current user değilse):
🔄 Rol Değiştir (tıkla → rol butonları göster)
🗑️ Sil
⏸️ Askıya Al
"Siz" badge (current user için)
Layout:

[ROL İKONU] ROL ADI
             X kullanıcı
             
  [Kullanıcı 1: İsim | Email | Tarihler]  [Düzenle] [Sil] [Askıya Al]
  [Kullanıcı 2: İsim | Email | Tarihler]  [Düzenle] [Sil] [Askıya Al]
TAB 2: BEKLEYEN KULLANICILAR
<button className="bg-gradient-to-br from-orange-500/30 to-orange-600/20 border-2 border-orange-500/50">
  <div className="flex items-center gap-3">
    <Clock className="w-5 h-5 text-orange-400" />
    <span>Bekleyen</span>
  </div>
  <div className="flex items-center gap-3">
    <span>{pendingUsers.length}</span>
    {pendingUsers.length > 0 && (
      <span className="w-6 h-6 bg-orange-500 rounded-full animate-pulse">!</span>
    )}
  </div>
</button>
Özellikler:

Turuncu gradient background
Büyük kullanıcı kartları
6 Rol Atama Butonu (grid-cols-3):
Yönetici - Kırmızı
Üst Müdür - Pembe
Müdür - Mor
Operasyon - Mavi
Personel - Yeşil
İdari Personel - Amber
Sil Butonu - Kırmızı
Telefon gösterimi
Kayıt tarihi
Layout:

[TURUNCU KART]
  [👤 Icon] Mehmet Yılmaz
             mehmet@mail.com
             📱 +90 555 111 2233
             ⏰ Kayıt: 5 Mart 2024, 14:30
             
             [Yönetici] [Üst Müdür] [Müdür]
             [Operasyon] [Personel] [İdari]
             [---] [---] [Sil]
TAB 3: PERSONEL LİSTESİ
<button className="bg-gradient-to-br from-purple-500/30 to-purple-600/20 border-2 border-purple-500/50">
  <div className="flex items-center gap-3">
    <List className="w-5 h-5 text-purple-400" />
    <span>Personel Listesi</span>
  </div>
  <span>{users.length + pendingUsers.length}</span>
</button>
Özellikler:

A) 5 Filtre Butonu (Horizontal wrap):

1. 🌐 Tümü (X)
2. ✅ Aktifler (X)
3. ⏳ Bekleyenler (X)
4. 🟢 Giriş Yapmış (X)
5. ⚫ Son 6 Saat Giriş Yapmayan (X)
B) Collapsible Rol Grupları:

Her rol için ayrı accordion
Header (Tıklanabilir):
Rol ikonu + Rol adı + Kullanıcı sayısı
ChevronDown (açık) / ChevronRight (kapalı)
Content (motion/react animasyon):
Kompakt liste (bg-black/30, rounded-lg)
Numara + İsim + Email
Giriş durumu: 🟢 (giriş yapmış + tarih) veya ⚫ (hiç giriş yapmadı)
Layout:

[FİLTRELER: Tümü | Aktifler | Bekleyenler | Giriş Yapmış | 6 Saat Giriş Yapmayan]

[MÜDÜR ROL GRUBU]          [v]
  X kişi
  
  1  Mehmet Yılmaz          🟢 5 Mar, 08:30
     mehmet@mail.com
     
  2  Ayşe Demir            ⚫ Hiç giriş yapmadı
     ayse@mail.com

[PERSONEL ROL GRUBU]       [>] (Kapalı)
🔧 4. FONKSİYONLAR
A) Rol Atama:
const handleAssignRole = (userId: string, newRole: UserRole) => {
  // 1. User'ı users array'inde bul ve rol güncelle
  setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
  
  // 2. Eğer pending'den geliyorsa, pending'den çıkar ve users'a ekle
  const pendingUser = pendingUsers.find(u => u.id === userId);
  if (pendingUser) {
    setPendingUsers(pendingUsers.filter(u => u.id !== userId));
    setUsers([...users, { ...pendingUser, role: newRole }]);
  }
  
  // 3. Success mesajı göster
  setSuccessMessage('✅ Rol başarıyla atandı!');
  setTimeout(() => setSuccessMessage(''), 3000);
};
B) Kullanıcı Silme:
const handleDeleteUser = (userId: string, userEmail: string) => {
  if (!confirm(`${userEmail} kullanıcısını silmek istediğinizden emin misiniz?`)) return;
  
  setUsers(users.filter(u => u.id !== userId));
  setPendingUsers(pendingUsers.filter(u => u.id !== userId));
  
  setSuccessMessage(`✅ Kullanıcı silindi: ${userEmail}`);
  setTimeout(() => setSuccessMessage(''), 3000);
};
C) Askıya Alma:
const handleSuspendUser = (userId: string, userEmail: string) => {
  if (!confirm(`${userEmail} kullanıcısını askıya almak istediğinizden emin misiniz?`)) return;
  
  // Active'den bekleyen'e taşı
  const user = users.find(u => u.id === userId);
  if (user) {
    setUsers(users.filter(u => u.id !== userId));
    setPendingUsers([...pendingUsers, { ...user, role: 'bekleyen' }]);
  }
  
  setSuccessMessage(`⏸️ Kullanıcı askıya alındı: ${userEmail}`);
  setActiveTab('pending'); // Bekleyen sekmesine geç
  setTimeout(() => setSuccessMessage(''), 3000);
};
D) Arama Filtresi:
const filteredUsers = users.filter(user => 
  user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
  user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
  roleLabels[user.role].toLowerCase().includes(searchQuery.toLowerCase())
);
E) Personel Listesi Filtreleme:
const sixHoursAgo = Date.now() - (6 * 60 * 60 * 1000);

switch (staffListFilter) {
  case 'only-active':
    return users; // Sadece aktif kullanıcılar
  case 'only-pending':
    return pendingUsers; // Sadece bekleyen kullanıcılar
  case 'signed-in':
    return users.filter(u => u.last_sign_in); // Giriş yapmış olanlar
  case 'not-signed-in':
    return users.filter(u => 
      !u.last_sign_in || new Date(u.last_sign_in).getTime() < sixHoursAgo
    );
  default:
    return [...users, ...pendingUsers]; // Tümü
}
🎬 5. ANİMASYONLAR
Success Message (AnimatePresence):
<AnimatePresence>
  {successMessage && (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center gap-2 p-4 bg-green-500/20 border border-green-500/30 rounded-xl"
    >
      <CheckCircle className="w-5 h-5" />
      <span>{successMessage}</span>
    </motion.div>
  )}
</AnimatePresence>
Collapsible Accordion:
<AnimatePresence>
  {isExpanded && (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* İçerik */}
    </motion.div>
  )}
</AnimatePresence>
💾 6. DATA YAPISI
interface UserData {
  id: string;                    // 'user-1'
  email: string;                 // 'mehmet@aspectops.com'
  full_name: string;             // 'Mehmet Yılmaz'
  role: UserRole;                // 'mudur'
  created_at: string;            // '2024-01-15T10:00:00Z'
  last_sign_in: string | null;  // '2024-03-05T08:30:00Z' veya null
  phone?: string;                // '+90 555 111 2233' (opsiyonel)
}

// Güncel 7-rol sistemi (login.tsx ile senkronize)
type UserRole = 
  | 'yonetici'      // eski: 'admin'
  | 'ust-mudur'     // eski: (yoktu)
  | 'mudur'         // eski: 'manager'
  | 'operasyon'     // eski: 'project_lead'
  | 'personel'      // eski: 'staff'
  | 'idari'         // eski: 'administrative'
  | 'bekleyen';     // eski: 'unassigned'

Mock Data Örneği:
const mockActiveUsers = [
  {
    id: 'user-1',
    email: 'mehmet@aspectops.com',
    full_name: 'Mehmet Yılmaz',
    role: 'mudur',
    created_at: '2024-01-15T10:00:00Z',
    last_sign_in: '2024-03-05T08:30:00Z',
    phone: '+90 555 111 2233'
  },
  {
    id: 'user-2',
    email: 'ayse@aspectops.com',
    full_name: 'Ayşe Demir',
    role: 'personel',
    created_at: '2024-02-01T10:00:00Z',
    last_sign_in: null // Hiç giriş yapmamış
  }
];

const mockPendingUsers = [
  {
    id: 'pending-1',
    email: 'zeynep@aspectops.com',
    full_name: 'Zeynep Arslan',
    role: 'bekleyen', // Bekleyen kullanıcılar bekleyen rolünde
    created_at: '2024-03-03T14:00:00Z',
    last_sign_in: null,
    phone: '+90 555 333 4455'
  }
];
📱 7. RESPONSIVE TASARIM
/* Tab Butonları - Dikey Stack (Mobile-first) */
.space-y-3

/* Filtre Butonları - Horizontal Wrap */
.flex.flex-wrap.gap-2

/* Rol Atama Butonları - 3 Sütun Grid */
.grid.grid-cols-3.gap-2

/* Kullanıcı Kartları - Full Width */
.w-full
🎯 8. ÖZEL DETAYLAR
"Siz" Badge:

Current user'ın kartında pembe badge: "Siz"
Current user düzenlenemez/silinemez
Rol Değiştirme Flow:

Düzenle butonuna tıkla → rol butonları göster
Rol seçince direkt güncelle
İptal butonu (X) ile çık
Bekleyen Kullanıcı Uyarısı:

Pending tab'da turuncu animate-pulse ünlem işareti
Pending count > 0 ise görünür
Tarih Formatı:

// Kısa format (liste görünümü)
new Date(date).toLocaleDateString('tr-TR', { 
  day: 'numeric', 
  month: 'short' 
}) // "5 Mar"

// Uzun format (detay)
new Date(date).toLocaleDateString('tr-TR', { 
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
}) // "5 Mart 2024, 14:30"
Loading State:
{loading && (
  <div className="flex items-center justify-center py-20">
    <div className="w-12 h-12 border-4 border-[#9dd9ea]/30 border-t-[#9dd9ea] rounded-full animate-spin" />
  </div>
)}
