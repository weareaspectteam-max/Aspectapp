ROTASYON VE İZİNLER YÖNETİMİ SAYFASI
EKSİKSİZ TASARIM VE GELİŞTİRME DOKÜMANI
📋 PROJE BAĞLAMI
Uygulama Bilgileri
Uygulama Adı: Aspect Operations
Sektör: Turistik fotoğrafçılık işletmeleri
Platform: iOS mobil uygulama
Tasarım Dili: Modern, dark mode, glassmorphism
Tasarım Sistemi
Arka plan gradient:

background: linear-gradient(to bottom, #2a2a3a, #3a3a4e, #2f3439);
Tailwind: bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439]

Glassmorphism efekt:

Backdrop blur: backdrop-blur-xl
Şeffaf arka plan: bg-white/5, bg-white/10
İnce border: border border-white/10
Rounded köşeler: rounded-2xl, rounded-xl
Kullanıcı Rolleri
6 farklı rol: Yönetici, Müdür, Operasyon Sorumlusu, Personel, İdari, Kullanıcı

Modül Konumu
Ana menüde "Rotasyon ve İzinler" kategorisi
İki alt modül: Rotasyon Planı ve İzin Yönetimi
🎯 SAYFA AMACI VE İŞLEVSELLİK
Ana Sayfa - Hub (Rotasyon ve İzinler)
Ana hub sayfasında 2 kart olacak:

Rotasyon Planı 🔄 - Personel lokasyonlar arası rotasyon yönetimi
İzin Yönetimi 🏖️ - Yıllık izin, hastalık izni, mazeret izni takibi
📱 ANA HUB SAYFASI TASARIMI
Sayfa Header
<div className="sticky top-0 z-10 backdrop-blur-xl bg-gradient-to-b from-[#2a2a3a]/95 via-[#2a2a3a]/90 to-transparent border-b border-white/10">
  <div className="px-6 py-4">
    <div className="flex items-center gap-4 mb-3">
      <button className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all active:scale-95">
        <ArrowLeft className="w-5 h-5 text-white" />
      </button>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-white">Rotasyon ve İzinler</h1>
        <span className="text-2xl">🔄</span>
      </div>
    </div>
    <p className="text-sm text-gray-400 ml-14">
      Personel rotasyonu ve izin takip sistemi
    </p>
  </div>
</div>
Hub Kartları
<div className="px-6 mt-6 space-y-4">
  {/* Rotasyon Planı Kartı */}
  <button
    onClick={() => setCurrentView('rotation')}
    className="w-full backdrop-blur-xl bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-2 border-blue-500/20 rounded-2xl p-6 hover:scale-[1.02] transition-all duration-200 text-left"
  >
    <div className="flex items-start justify-between mb-4">
      <div className="w-14 h-14 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
        <span className="text-3xl">🔄</span>
      </div>
      <div className="flex items-center gap-1 px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full">
        <span className="text-xs font-semibold text-blue-300">12 Aktif Rotasyon</span>
      </div>
    </div>
    <h2 className="text-xl font-bold text-white mb-2">Rotasyon Planı</h2>
    <p className="text-sm text-gray-400 mb-4">
      Personellerin lokasyonlar arası çalışma programını yönetin
    </p>
    <div className="flex items-center gap-2 text-blue-400">
      <span className="text-sm font-semibold">Detayları Gör</span>
      <ChevronRight className="w-4 h-4" />
    </div>
  </button>

  {/* İzin Yönetimi Kartı */}
  <button
    onClick={() => setCurrentView('leave')}
    className="w-full backdrop-blur-xl bg-gradient-to-br from-green-500/10 to-green-600/10 border-2 border-green-500/20 rounded-2xl p-6 hover:scale-[1.02] transition-all duration-200 text-left"
  >
    <div className="flex items-start justify-between mb-4">
      <div className="w-14 h-14 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
        <span className="text-3xl">🏖️</span>
      </div>
      <div className="flex items-center gap-1 px-3 py-1 bg-orange-500/20 border border-orange-500/30 rounded-full">
        <span className="text-xs font-semibold text-orange-300">5 Bekliyor</span>
      </div>
    </div>
    <h2 className="text-xl font-bold text-white mb-2">İzin Yönetimi</h2>
    <p className="text-sm text-gray-400 mb-4">
      Yıllık izin, hastalık izni ve izin taleplerini takip edin
    </p>
    <div className="flex items-center gap-2 text-green-400">
      <span className="text-sm font-semibold">Detayları Gör</span>
      <ChevronRight className="w-4 h-4" />
    </div>
  </button>
</div>
Info Kartı
<div className="px-6 mt-6">
  <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
        <span className="text-xl">ℹ️</span>
      </div>
      <div className="flex-1">
        <h4 className="font-semibold text-white mb-2">🔄 Rotasyon ve İzin Sistemi</h4>
        <p className="text-sm text-gray-400">
          Bu modül ile personellerin lokasyonlar arası rotasyonunu planlayabilir, 
          izin taleplerini onaylayabilir ve tüm personelin izin bakiyelerini takip edebilirsiniz.
        </p>
      </div>
    </div>
  </div>
</div>
🔄 ROTASYON PLANI SAYFASI
1. SAYFA HEADER
<div className="sticky top-0 z-10 backdrop-blur-xl bg-gradient-to-b from-[#2a2a3a]/95 via-[#2a2a3a]/90 to-transparent border-b border-white/10">
  <div className="px-6 py-4">
    <div className="flex items-center gap-4 mb-3">
      <button 
        onClick={() => setCurrentView('hub')}
        className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all active:scale-95"
      >
        <ArrowLeft className="w-5 h-5 text-white" />
      </button>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-white">Rotasyon Planı</h1>
        <span className="text-2xl">🔄</span>
      </div>
    </div>
    <div className="flex items-center justify-between ml-14">
      <p className="text-sm text-gray-400">
        Personel lokasyon rotasyon programı
      </p>
      <button
        onClick={() => setShowNewRotationForm(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/20 hover:from-blue-500/30 hover:to-blue-600/30 border border-blue-500/30 transition-all hover:scale-105 active:scale-95"
      >
        <Plus className="w-4 h-4 text-blue-400" />
        <span className="text-blue-400 font-semibold text-xs">Yeni Ekle</span>
      </button>
    </div>
  </div>
</div>
2. FİLTRE SİSTEMİ
<div className="px-6 mt-6">
  <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/10 border border-white/10 rounded-2xl p-4">
    <div className="grid grid-cols-3 gap-3">
      <button
        onClick={() => setRotationFilter('all')}
        className={`px-3 py-2.5 rounded-xl font-semibold text-xs transition-all ${
          rotationFilter === 'all'
            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50'
            : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
        }`}
      >
        🔍 Tümü
      </button>
      <button
        onClick={() => setRotationFilter('active')}
        className={`px-3 py-2.5 rounded-xl font-semibold text-xs transition-all ${
          rotationFilter === 'active'
            ? 'bg-green-500 text-white shadow-lg shadow-green-500/50'
            : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
        }`}
      >
        ✅ Aktif
      </button>
      <button
        onClick={() => setRotationFilter('upcoming')}
        className={`px-3 py-2.5 rounded-xl font-semibold text-xs transition-all ${
          rotationFilter === 'upcoming'
            ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/50'
            : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
        }`}
      >
        ⏳ Yaklaşan
      </button>
      <button
        onClick={() => setRotationFilter('completed')}
        className={`px-3 py-2.5 rounded-xl font-semibold text-xs transition-all col-span-2 ${
          rotationFilter === 'completed'
            ? 'bg-gray-500 text-white shadow-lg shadow-gray-500/50'
            : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
        }`}
      >
        ✔️ Tamamlanan
      </button>
      <button
        onClick={() => setRotationFilter('cancelled')}
        className={`px-3 py-2.5 rounded-xl font-semibold text-xs transition-all ${
          rotationFilter === 'cancelled'
            ? 'bg-red-500 text-white shadow-lg shadow-red-500/50'
            : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
        }`}
      >
        ❌ İptal
      </button>
    </div>
  </div>
</div>
Filtre Tipleri:

Tümü: Tüm rotasyonlar
Aktif: Şu anda devam eden rotasyonlar
Yaklaşan: Gelecekte başlayacak rotasyonlar
Tamamlanan: Bitmiş rotasyonlar
İptal: İptal edilmiş rotasyonlar
3. ROTASYON KARTLARI
<div className="px-6 mt-6 space-y-4">
  {filteredRotations.map((rotation) => (
    <div
      key={rotation.id}
      className="backdrop-blur-xl bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-2 border-blue-500/20 rounded-2xl p-5"
    >
      {/* Üst Kısım - Personel Bilgisi */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-blue-400" />
            <h3 className="text-lg font-bold text-white">{rotation.staffName}</h3>
            <span className="px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded text-xs text-blue-300">
              {rotation.staffRole}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>{rotation.startDate} - {rotation.endDate}</span>
            </div>
            <div className="w-px h-4 bg-white/10"></div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{rotation.duration} gün</span>
            </div>
          </div>
        </div>
        {/* Durum Badge */}
        {rotation.status === 'active' && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-full">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-400 font-semibold">Aktif</span>
          </div>
        )}
        {rotation.status === 'upcoming' && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/20 border border-orange-500/30 rounded-full">
            <Clock className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-orange-400 font-semibold">Yaklaşan</span>
          </div>
        )}
        {rotation.status === 'completed' && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-500/20 border border-gray-500/30 rounded-full">
            <Check className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-400 font-semibold">Tamamlandı</span>
          </div>
        )}
        {rotation.status === 'cancelled' && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-full">
            <X className="w-4 h-4 text-red-400" />
            <span className="text-xs text-red-400 font-semibold">İptal Edildi</span>
          </div>
        )}
      </div>

      {/* Lokasyon Akışı */}
      <div className="mb-4 p-4 bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-xl">
        <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-purple-400" />
          Rotasyon Akışı
        </h4>
        <div className="flex items-center gap-3">
          {/* Kaynak Lokasyon */}
          <div className="flex-1 px-3 py-2 bg-purple-500/20 border border-purple-500/30 rounded-lg">
            <div className="text-xs text-purple-300 mb-1">Kaynak</div>
            <div className="text-sm font-semibold text-white">{rotation.fromLocation}</div>
          </div>
          
          {/* Ok İşareti */}
          <div className="flex-shrink-0">
            <ArrowRight className="w-6 h-6 text-blue-400" />
          </div>
          
          {/* Hedef Lokasyon */}
          <div className="flex-1 px-3 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg">
            <div className="text-xs text-blue-300 mb-1">Hedef</div>
            <div className="text-sm font-semibold text-white">{rotation.toLocation}</div>
          </div>
        </div>
      </div>

      {/* Rotasyon Nedeni */}
      {rotation.reason && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-400 mb-2">📝 Rotasyon Nedeni</h4>
          <p className="text-sm text-gray-300">{rotation.reason}</p>
        </div>
      )}

      {/* Sorumlu Müdür */}
      <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-gray-400">
          <Briefcase className="w-4 h-4" />
          <span>Sorumlu: {rotation.assignedManager}</span>
        </div>
        <div className="text-gray-500">
          Oluşturulma: {rotation.createdDate}
        </div>
      </div>
    </div>
  ))}
</div>
4. YENİ ROTASYON FORMU
{showNewRotationForm && (
  <div className="pb-20 bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] min-h-screen">
    {/* Header */}
    <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#2a2a3a]/95 border-b border-white/10">
      <div className="px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => setShowNewRotationForm(false)}
            className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center active:scale-95 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Plus className="w-6 h-6 text-blue-400" />
              Yeni Rotasyon Kaydı
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Personel lokasyon rotasyonu planı
            </p>
          </div>
        </div>
        <button
          onClick={handleSaveRotation}
          disabled={!canSaveRotation}
          className={`w-full py-3 rounded-xl font-bold text-white transition-all ${
            canSaveRotation
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:scale-[1.02] active:scale-95'
              : 'bg-gray-600 opacity-50 cursor-not-allowed'
          }`}
        >
          {canSaveRotation ? '✅ Rotasyonu Kaydet' : '⚠️ Gerekli Alanları Doldurun'}
        </button>
      </div>
    </div>

    <div className="px-6 mt-4 space-y-4 pb-6">
      {/* Personel Seçimi */}
      <div className="backdrop-blur-xl bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-2xl p-5">
        <label className="block text-sm font-semibold text-blue-400 mb-3">
          <User className="w-4 h-4 inline mr-2" />
          Personel Bilgileri *
        </label>
        <div className="space-y-3">
          <input
            type="text"
            value={newRotation.staffName}
            onChange={(e) => setNewRotation({ ...newRotation, staffName: e.target.value })}
            placeholder="Personel adı..."
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
          />
          <input
            type="text"
            value={newRotation.staffRole}
            onChange={(e) => setNewRotation({ ...newRotation, staffRole: e.target.value })}
            placeholder="Pozisyon (Fotoğrafçı, Satış Danışmanı, vb.)"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>

      {/* Kaynak Lokasyon */}
      <div className="backdrop-blur-xl bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20 rounded-2xl p-5">
        <label className="block text-sm font-semibold text-purple-400 mb-2">
          <MapPin className="w-4 h-4 inline mr-2" />
          Kaynak Lokasyon *
        </label>
        <input
          type="text"
          value={newRotation.fromLocation}
          onChange={(e) => setNewRotation({ ...newRotation, fromLocation: e.target.value })}
          placeholder="Mevcut çalıştığı lokasyon..."
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
        />
      </div>

      {/* Hedef Lokasyon */}
      <div className="backdrop-blur-xl bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-2xl p-5">
        <label className="block text-sm font-semibold text-blue-400 mb-2">
          <MapPin className="w-4 h-4 inline mr-2" />
          Hedef Lokasyon *
        </label>
        <input
          type="text"
          value={newRotation.toLocation}
          onChange={(e) => setNewRotation({ ...newRotation, toLocation: e.target.value })}
          placeholder="Rotasyon yapılacak lokasyon..."
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
        />
      </div>

      {/* Tarih Aralığı */}
      <div className="grid grid-cols-2 gap-3">
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
          <label className="block text-sm font-semibold text-white mb-2">
            <Calendar className="w-4 h-4 inline mr-2 text-green-400" />
            Başlangıç *
          </label>
          <input
            type="text"
            value={newRotation.startDate}
            onChange={(e) => setNewRotation({ ...newRotation, startDate: e.target.value })}
            placeholder="10.03.2026"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50"
          />
        </div>
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
          <label className="block text-sm font-semibold text-white mb-2">
            <Calendar className="w-4 h-4 inline mr-2 text-orange-400" />
            Bitiş *
          </label>
          <input
            type="text"
            value={newRotation.endDate}
            onChange={(e) => setNewRotation({ ...newRotation, endDate: e.target.value })}
            placeholder="20.03.2026"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
          />
        </div>
      </div>

      {/* Rotasyon Nedeni */}
      <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
        <label className="block text-sm font-semibold text-white mb-2">
          📝 Rotasyon Nedeni <span className="text-xs text-gray-500">(Opsiyonel)</span>
        </label>
        <textarea
          value={newRotation.reason}
          onChange={(e) => setNewRotation({ ...newRotation, reason: e.target.value })}
          placeholder="İş yoğunluğu, personel takviyesi, eğitim, vb..."
          rows={3}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 resize-none"
        />
      </div>

      {/* Sorumlu Müdür */}
      <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
        <label className="block text-sm font-semibold text-white mb-2">
          <Briefcase className="w-4 h-4 inline mr-2 text-yellow-400" />
          Sorumlu Müdür *
        </label>
        <input
          type="text"
          value={newRotation.assignedManager}
          onChange={(e) => setNewRotation({ ...newRotation, assignedManager: e.target.value })}
          placeholder="Rotasyonu koordine edecek müdür..."
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500/50"
        />
      </div>
    </div>
  </div>
)}
5. ROTASYON MOCK VERİLERİ
const MOCK_ROTATIONS = [
  {
    id: '1',
    staffName: 'Mehmet Özkan',
    staffRole: 'Fotoğrafçı',
    fromLocation: 'Beach Club Antalya',
    toLocation: 'Sunset Restaurant',
    startDate: '10.03.2026',
    endDate: '20.03.2026',
    duration: 10,
    reason: 'Sunset Restaurant\'ta sezon yoğunluğu nedeniyle personel takviyesi gerekiyor',
    assignedManager: 'Ahmet Yılmaz',
    status: 'active',
    createdDate: '05.03.2026'
  },
  {
    id: '2',
    staffName: 'Zeynep Kaya',
    staffRole: 'Satış Danışmanı',
    fromLocation: 'Marina Tekne Turu',
    toLocation: 'Paradise Beach',
    startDate: '15.03.2026',
    endDate: '29.03.2026',
    duration: 14,
    reason: 'Paradise Beach yeni lokasyonunda eğitim ve adaptasyon süreci',
    assignedManager: 'Ayşe Demir',
    status: 'upcoming',
    createdDate: '04.03.2026'
  },
  {
    id: '3',
    staffName: 'Can Yıldız',
    staffRole: 'Asistan Fotoğrafçı',
    fromLocation: 'Paradise Beach',
    toLocation: 'Beach Club Antalya',
    startDate: '01.03.2026',
    endDate: '07.03.2026',
    duration: 7,
    reason: 'Beach Club\'ta kıdemli fotoğrafçıdan teknik eğitim alacak',
    assignedManager: 'Mehmet Kaya',
    status: 'completed',
    createdDate: '25.02.2026'
  },
  {
    id: '4',
    staffName: 'Elif Şahin',
    staffRole: 'Fotoğrafçı',
    fromLocation: 'Sunset Restaurant',
    toLocation: 'Marina Tekne Turu',
    startDate: '08.03.2026',
    endDate: '22.03.2026',
    duration: 14,
    reason: '',
    assignedManager: 'Zeynep Arslan',
    status: 'active',
    createdDate: '03.03.2026'
  },
  {
    id: '5',
    staffName: 'Burak Demir',
    staffRole: 'Satış Danışmanı',
    fromLocation: 'Beach Club Antalya',
    toLocation: 'Sunset Restaurant',
    startDate: '05.03.2026',
    endDate: '10.03.2026',
    duration: 5,
    reason: 'Personelin kendi isteği ile iptal edildi',
    assignedManager: 'Ahmet Yılmaz',
    status: 'cancelled',
    createdDate: '01.03.2026'
  }
];
🏖️ İZİN YÖNETİMİ SAYFASI
1. SAYFA HEADER
<div className="sticky top-0 z-10 backdrop-blur-xl bg-gradient-to-b from-[#2a2a3a]/95 via-[#2a2a3a]/90 to-transparent border-b border-white/10">
  <div className="px-6 py-4">
    <div className="flex items-center gap-4 mb-3">
      <button 
        onClick={() => setCurrentView('hub')}
        className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all active:scale-95"
      >
        <ArrowLeft className="w-5 h-5 text-white" />
      </button>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-white">İzin Yönetimi</h1>
        <span className="text-2xl">🏖️</span>
      </div>
    </div>
    <div className="flex items-center justify-between ml-14">
      <p className="text-sm text-gray-400">
        Yıllık izin, hastalık izni ve izin talepleri
      </p>
      <button
        onClick={() => setShowNewLeaveForm(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-br from-green-500/20 to-green-600/20 hover:from-green-500/30 hover:to-green-600/30 border border-green-500/30 transition-all hover:scale-105 active:scale-95"
      >
        <Plus className="w-4 h-4 text-green-400" />
        <span className="text-green-400 font-semibold text-xs">Yeni Talep</span>
      </button>
    </div>
  </div>
</div>
2. TAB SİSTEMİ (İzin Talepleri / İzin Bakiyeleri)
<div className="px-6 mt-6">
  <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/10 border border-white/10 rounded-2xl p-4">
    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={() => setLeaveTab('requests')}
        className={`px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
          leaveTab === 'requests'
            ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/50 border-2 border-green-400/30'
            : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
        }`}
      >
        <span className="mr-2">📝</span>
        İzin Talepleri
      </button>
      <button
        onClick={() => setLeaveTab('balances')}
        className={`px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
          leaveTab === 'balances'
            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/50 border-2 border-blue-400/30'
            : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
        }`}
      >
        <span className="mr-2">📊</span>
        İzin Bakiyeleri
      </button>
    </div>
  </div>
</div>
3. İZİN TALEPLERİ GÖRÜNÜMÜ
Filtre Sistemi
<div className="px-6 mt-6">
  <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/10 border border-white/10 rounded-2xl p-4">
    <div className="grid grid-cols-2 gap-3">
      <button
        onClick={() => setLeaveStatusFilter('all')}
        className={`px-3 py-2.5 rounded-xl font-semibold text-xs transition-all ${
          leaveStatusFilter === 'all'
            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50'
            : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
        }`}
      >
        🔍 Tümü
      </button>
      <button
        onClick={() => setLeaveStatusFilter('pending')}
        className={`px-3 py-2.5 rounded-xl font-semibold text-xs transition-all ${
          leaveStatusFilter === 'pending'
            ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/50'
            : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
        }`}
      >
        ⏳ Bekliyor
      </button>
      <button
        onClick={() => setLeaveStatusFilter('approved')}
        className={`px-3 py-2.5 rounded-xl font-semibold text-xs transition-all ${
          leaveStatusFilter === 'approved'
            ? 'bg-green-500 text-white shadow-lg shadow-green-500/50'
            : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
        }`}
      >
        ✅ Onaylı
      </button>
      <button
        onClick={() => setLeaveStatusFilter('rejected')}
        className={`px-3 py-2.5 rounded-xl font-semibold text-xs transition-all ${
          leaveStatusFilter === 'rejected'
            ? 'bg-red-500 text-white shadow-lg shadow-red-500/50'
            : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
        }`}
      >
        ❌ Reddedildi
      </button>
    </div>
  </div>
</div>
İzin Talep Kartları
<div className="px-6 mt-6 space-y-4">
  {filteredLeaveRequests.map((leave) => (
    <div
      key={leave.id}
      className={`backdrop-blur-xl bg-gradient-to-br border-2 rounded-2xl p-5 ${
        leave.status === 'pending' ? 'from-orange-500/10 to-orange-600/10 border-orange-500/20' :
        leave.status === 'approved' ? 'from-green-500/10 to-green-600/10 border-green-500/20' :
        'from-red-500/10 to-red-600/10 border-red-500/20'
      }`}
    >
      {/* Üst Kısım */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-blue-400" />
            <h3 className="text-lg font-bold text-white">{leave.staffName}</h3>
            <span className="px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded text-xs text-blue-300">
              {leave.staffRole}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <MapPin className="w-4 h-4" />
            <span>{leave.location}</span>
          </div>
        </div>
        
        {/* Durum Badge */}
        {leave.status === 'pending' && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/20 border border-orange-500/30 rounded-full">
            <Clock className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-orange-400 font-semibold">Bekliyor</span>
          </div>
        )}
        {leave.status === 'approved' && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-full">
            <Check className="w-4 h-4 text-green-400" />
            <span className="text-xs text-green-400 font-semibold">Onaylandı</span>
          </div>
        )}
        {leave.status === 'rejected' && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-full">
            <X className="w-4 h-4 text-red-400" />
            <span className="text-xs text-red-400 font-semibold">Reddedildi</span>
          </div>
        )}
      </div>

      {/* İzin Tipi Badge */}
      <div className="mb-4">
        {leave.type === 'annual' && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-full text-xs font-semibold text-blue-300">
            🏖️ Yıllık İzin
          </span>
        )}
        {leave.type === 'sick' && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-full text-xs font-semibold text-red-300">
            🤒 Hastalık İzni
          </span>
        )}
        {leave.type === 'excuse' && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded-full text-xs font-semibold text-purple-300">
            📋 Mazeret İzni
          </span>
        )}
      </div>

      {/* Tarih ve Süre Bilgisi */}
      <div className="mb-4 p-4 bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-xl">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-400 mb-1">Başlangıç</div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Calendar className="w-4 h-4 text-green-400" />
              {leave.startDate}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Bitiş</div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Calendar className="w-4 h-4 text-orange-400" />
              {leave.endDate}
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Toplam Süre</span>
            <span className="text-sm font-bold text-blue-400">{leave.days} gün</span>
          </div>
        </div>
      </div>

      {/* İzin Nedeni */}
      {leave.reason && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-400 mb-2">📝 İzin Nedeni</h4>
          <p className="text-sm text-gray-300">{leave.reason}</p>
        </div>
      )}

      {/* Onay/Red Notu */}
      {leave.approvalNote && (
        <div className={`mb-4 p-3 rounded-lg border ${
          leave.status === 'approved' 
            ? 'bg-green-500/10 border-green-500/30' 
            : 'bg-red-500/10 border-red-500/30'
        }`}>
          <h4 className={`text-sm font-semibold mb-1 ${
            leave.status === 'approved' ? 'text-green-400' : 'text-red-400'
          }`}>
            {leave.status === 'approved' ? '✅ Onay Notu' : '❌ Red Nedeni'}
          </h4>
          <p className="text-sm text-gray-300">{leave.approvalNote}</p>
        </div>
      )}

      {/* Alt Bilgi */}
      <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
        <div className="text-gray-400">
          Talep Tarihi: {leave.requestDate}
        </div>
        {leave.approvedBy && (
          <div className="flex items-center gap-2 text-gray-400">
            <Briefcase className="w-4 h-4" />
            <span>Onaylayan: {leave.approvedBy}</span>
          </div>
        )}
      </div>

      {/* Bekliyor Durumunda Onay/Red Butonları */}
      {leave.status === 'pending' && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => handleApproveLeave(leave.id)}
            className="py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold text-sm hover:scale-[1.02] active:scale-95 transition-all"
          >
            ✅ Onayla
          </button>
          <button
            onClick={() => handleRejectLeave(leave.id)}
            className="py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold text-sm hover:scale-[1.02] active:scale-95 transition-all"
          >
            ❌ Reddet
          </button>
        </div>
      )}
    </div>
  ))}
</div>
4. İZİN BAKİYELERİ GÖRÜNÜMÜ
<div className="px-6 mt-6 space-y-4">
  {staffLeaveBalances.map((staff) => (
    <div
      key={staff.id}
      className="backdrop-blur-xl bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-2 border-blue-500/20 rounded-2xl p-5"
    >
      {/* Personel Bilgisi */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
          <User className="w-6 h-6 text-blue-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white">{staff.staffName}</h3>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded text-xs text-blue-300">
              {staff.staffRole}
            </span>
            <div className="w-px h-4 bg-white/10"></div>
            <MapPin className="w-3 h-3" />
            <span className="text-xs">{staff.location}</span>
          </div>
        </div>
      </div>

      {/* İzin Bakiye Kartları */}
      <div className="grid grid-cols-3 gap-3">
        {/* Yıllık İzin */}
        <div className="p-3 bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-xl">
          <div className="text-xs text-green-300 mb-1">🏖️ Yıllık</div>
          <div className="text-2xl font-bold text-white mb-1">{staff.annualLeaveBalance}</div>
          <div className="text-xs text-gray-400">/ {staff.annualLeaveTotal} gün</div>
          {/* Progress Bar */}
          <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-400 to-green-500"
              style={{ width: `${(staff.annualLeaveBalance / staff.annualLeaveTotal) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Hastalık İzni */}
        <div className="p-3 bg-gradient-to-br from-red-500/20 to-red-600/20 border border-red-500/30 rounded-xl">
          <div className="text-xs text-red-300 mb-1">🤒 Hastalık</div>
          <div className="text-2xl font-bold text-white mb-1">{staff.sickLeaveUsed}</div>
          <div className="text-xs text-gray-400">gün kullanıldı</div>
          <div className="mt-2 text-xs text-red-300">
            {staff.sickLeaveUsed === 0 ? '✓ Kullanılmadı' : `Son: ${staff.lastSickLeave}`}
          </div>
        </div>

        {/* Mazeret İzni */}
        <div className="p-3 bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 rounded-xl">
          <div className="text-xs text-purple-300 mb-1">📋 Mazeret</div>
          <div className="text-2xl font-bold text-white mb-1">{staff.excuseLeaveUsed}</div>
          <div className="text-xs text-gray-400">gün kullanıldı</div>
          <div className="mt-2 text-xs text-purple-300">
            {staff.excuseLeaveUsed === 0 ? '✓ Kullanılmadı' : `Son: ${staff.lastExcuseLeave}`}
          </div>
        </div>
      </div>

      {/* Ek Bilgiler */}
      <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-4 text-xs">
        <div>
          <span className="text-gray-400">İşe Başlama:</span>
          <span className="ml-2 text-white font-semibold">{staff.hireDate}</span>
        </div>
        <div>
          <span className="text-gray-400">Son İzin:</span>
          <span className="ml-2 text-white font-semibold">{staff.lastLeaveDate || 'Yok'}</span>
        </div>
      </div>
    </div>
  ))}
</div>
5. YENİ İZİN TALEBİ FORMU
{showNewLeaveForm && (
  <div className="pb-20 bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] min-h-screen">
    {/* Header */}
    <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#2a2a3a]/95 border-b border-white/10">
      <div className="px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => setShowNewLeaveForm(false)}
            className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center active:scale-95 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Plus className="w-6 h-6 text-green-400" />
              Yeni İzin Talebi
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              İzin talep formu
            </p>
          </div>
        </div>
        <button
          onClick={handleSaveLeave}
          disabled={!canSaveLeave}
          className={`w-full py-3 rounded-xl font-bold text-white transition-all ${
            canSaveLeave
              ? 'bg-gradient-to-r from-green-500 to-green-600 hover:scale-[1.02] active:scale-95'
              : 'bg-gray-600 opacity-50 cursor-not-allowed'
          }`}
        >
          {canSaveLeave ? '✅ Talebi Gönder' : '⚠️ Gerekli Alanları Doldurun'}
        </button>
      </div>
    </div>

    <div className="px-6 mt-4 space-y-4 pb-6">
      {/* Personel Bilgileri */}
      <div className="backdrop-blur-xl bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-2xl p-5">
        <label className="block text-sm font-semibold text-blue-400 mb-3">
          <User className="w-4 h-4 inline mr-2" />
          Personel Bilgileri *
        </label>
        <div className="space-y-3">
          <input
            type="text"
            value={newLeave.staffName}
            onChange={(e) => setNewLeave({ ...newLeave, staffName: e.target.value })}
            placeholder="Personel adı..."
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
          />
          <input
            type="text"
            value={newLeave.staffRole}
            onChange={(e) => setNewLeave({ ...newLeave, staffRole: e.target.value })}
            placeholder="Pozisyon..."
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
          />
          <input
            type="text"
            value={newLeave.location}
            onChange={(e) => setNewLeave({ ...newLeave, location: e.target.value })}
            placeholder="Lokasyon..."
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>

      {/* İzin Tipi */}
      <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
        <label className="block text-sm font-semibold text-white mb-2">
          📋 İzin Tipi *
        </label>
        <select
          value={newLeave.type}
          onChange={(e) => setNewLeave({ ...newLeave, type: e.target.value as any })}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
          style={{ colorScheme: 'dark' }}
        >
          <option value="annual" className="bg-[#2a2a3a] text-white">🏖️ Yıllık İzin</option>
          <option value="sick" className="bg-[#2a2a3a] text-white">🤒 Hastalık İzni</option>
          <option value="excuse" className="bg-[#2a2a3a] text-white">📋 Mazeret İzni</option>
        </select>
      </div>

      {/* Tarih Aralığı */}
      <div className="grid grid-cols-2 gap-3">
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
          <label className="block text-sm font-semibold text-white mb-2">
            <Calendar className="w-4 h-4 inline mr-2 text-green-400" />
            Başlangıç *
          </label>
          <input
            type="text"
            value={newLeave.startDate}
            onChange={(e) => setNewLeave({ ...newLeave, startDate: e.target.value })}
            placeholder="10.03.2026"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50"
          />
        </div>
        <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
          <label className="block text-sm font-semibold text-white mb-2">
            <Calendar className="w-4 h-4 inline mr-2 text-orange-400" />
            Bitiş *
          </label>
          <input
            type="text"
            value={newLeave.endDate}
            onChange={(e) => setNewLeave({ ...newLeave, endDate: e.target.value })}
            placeholder="15.03.2026"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
          />
        </div>
      </div>

      {/* İzin Nedeni */}
      <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
        <label className="block text-sm font-semibold text-white mb-2">
          📝 İzin Nedeni *
        </label>
        <textarea
          value={newLeave.reason}
          onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })}
          placeholder="İzin talebinin nedeni..."
          rows={4}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 resize-none"
        />
      </div>
    </div>
  </div>
)}
6. İZİN MOCK VERİLERİ
const MOCK_LEAVE_REQUESTS = [
  {
    id: '1',
    staffName: 'Mehmet Özkan',
    staffRole: 'Fotoğrafçı',
    location: 'Beach Club Antalya',
    type: 'annual',
    startDate: '20.03.2026',
    endDate: '27.03.2026',
    days: 7,
    reason: 'Aile ziyareti için yıllık izin talebi',
    status: 'pending',
    requestDate: '05.03.2026',
    approvedBy: null,
    approvalNote: null
  },
  {
    id: '2',
    staffName: 'Zeynep Kaya',
    staffRole: 'Satış Danışmanı',
    location: 'Marina Tekne Turu',
    type: 'sick',
    startDate: '08.03.2026',
    endDate: '10.03.2026',
    days: 2,
    reason: 'Grip şikayeti, doktor raporu mevcut',
    status: 'approved',
    requestDate: '07.03.2026',
    approvedBy: 'Ayşe Demir',
    approvalNote: 'Rapor onaylandı, geçmiş olsun'
  },
  {
    id: '3',
    staffName: 'Can Yıldız',
    staffRole: 'Asistan Fotoğrafçı',
    location: 'Paradise Beach',
    type: 'excuse',
    startDate: '12.03.2026',
    endDate: '12.03.2026',
    days: 1,
    reason: 'Resmi kurum işlemleri',
    status: 'approved',
    requestDate: '10.03.2026',
    approvedBy: 'Mehmet Kaya',
    approvalNote: 'Onaylandı'
  },
  {
    id: '4',
    staffName: 'Elif Şahin',
    staffRole: 'Fotoğrafçı',
    location: 'Sunset Restaurant',
    type: 'annual',
    startDate: '15.03.2026',
    endDate: '25.03.2026',
    days: 10,
    reason: 'Yurtdışı tatil planı',
    status: 'rejected',
    requestDate: '05.03.2026',
    approvedBy: 'Zeynep Arslan',
    approvalNote: 'Sezon yoğunluğu nedeniyle bu tarihler uygun değil. Nisan ayı için tekrar talep oluşturabilirsiniz.'
  },
  {
    id: '5',
    staffName: 'Burak Demir',
    staffRole: 'Satış Danışmanı',
    location: 'Beach Club Antalya',
    type: 'annual',
    startDate: '10.04.2026',
    endDate: '17.04.2026',
    days: 7,
    reason: 'Bayram tatili için yıllık izin',
    status: 'pending',
    requestDate: '05.03.2026',
    approvedBy: null,
    approvalNote: null
  }
];

const MOCK_LEAVE_BALANCES = [
  {
    id: '1',
    staffName: 'Mehmet Özkan',
    staffRole: 'Fotoğrafçı',
    location: 'Beach Club Antalya',
    annualLeaveTotal: 14,
    annualLeaveBalance: 7,
    sickLeaveUsed: 2,
    lastSickLeave: '15.01.2026',
    excuseLeaveUsed: 0,
    lastExcuseLeave: null,
    hireDate: '01.04.2024',
    lastLeaveDate: '20.02.2026'
  },
  {
    id: '2',
    staffName: 'Zeynep Kaya',
    staffRole: 'Satış Danışmanı',
    location: 'Marina Tekne Turu',
    annualLeaveTotal: 14,
    annualLeaveBalance: 14,
    sickLeaveUsed: 0,
    lastSickLeave: null,
    excuseLeaveUsed: 1,
    lastExcuseLeave: '10.02.2026',
    hireDate: '15.05.2024',
    lastLeaveDate: null
  },
  {
    id: '3',
    staffName: 'Can Yıldız',
    staffRole: 'Asistan Fotoğrafçı',
    location: 'Paradise Beach',
    annualLeaveTotal: 14,
    annualLeaveBalance: 11,
    sickLeaveUsed: 1,
    lastSickLeave: '20.12.2025',
    excuseLeaveUsed: 1,
    lastExcuseLeave: '12.03.2026',
    hireDate: '01.06.2024',
    lastLeaveDate: '05.01.2026'
  },
  {
    id: '4',
    staffName: 'Elif Şahin',
    staffRole: 'Fotoğrafçı',
    location: 'Sunset Restaurant',
    annualLeaveTotal: 20,
    annualLeaveBalance: 15,
    sickLeaveUsed: 3,
    lastSickLeave: '25.02.2026',
    excuseLeaveUsed: 0,
    lastExcuseLeave: null,
    hireDate: '01.01.2023',
    lastLeaveDate: '10.08.2025'
  },
  {
    id: '5',
    staffName: 'Burak Demir',
    staffRole: 'Satış Danışmanı',
    location: 'Beach Club Antalya',
    annualLeaveTotal: 14,
    annualLeaveBalance: 10,
    sickLeaveUsed: 0,
    lastSickLeave: null,
    excuseLeaveUsed: 2,
    lastExcuseLeave: '01.03.2026',
    hireDate: '01.03.2024',
    lastLeaveDate: '15.01.2026'
  }
];
🔧 TEKNİK DETAYLAR
TypeScript Interface'ler
// Rotasyon
interface Rotation {
  id: string;
  staffName: string;
  staffRole: string;
  fromLocation: string;
  toLocation: string;
  startDate: string;
  endDate: string;
  duration: number; // gün
  reason: string;
  assignedManager: string;
  status: 'active' | 'upcoming' | 'completed' | 'cancelled';
  createdDate: string;
}

// İzin Talebi
interface LeaveRequest {
  id: string;
  staffName: string;
  staffRole: string;
  location: string;
  type: 'annual' | 'sick' | 'excuse';
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestDate: string;
  approvedBy: string | null;
  approvalNote: string | null;
}

// İzin Bakiyesi
interface LeaveBalance {
  id: string;
  staffName: string;
  staffRole: string;
  location: string;
  annualLeaveTotal: number;
  annualLeaveBalance: number;
  sickLeaveUsed: number;
  lastSickLeave: string | null;
  excuseLeaveUsed: number;
  lastExcuseLeave: string | null;
  hireDate: string;
  lastLeaveDate: string | null;
}
State Tanımlamaları
// View yönetimi
const [currentView, setCurrentView] = useState<'hub' | 'rotation' | 'leave'>('hub');

// Rotasyon
const [rotationFilter, setRotationFilter] = useState<'all' | 'active' | 'upcoming' | 'completed' | 'cancelled'>('all');
const [showNewRotationForm, setShowNewRotationForm] = useState(false);
const [rotations, setRotations] = useState<Rotation[]>(MOCK_ROTATIONS);

// İzin
const [leaveTab, setLeaveTab] = useState<'requests' | 'balances'>('requests');
const [leaveStatusFilter, setLeaveStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
const [showNewLeaveForm, setShowNewLeaveForm] = useState(false);
const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(MOCK_LEAVE_REQUESTS);
const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>(MOCK_LEAVE_BALANCES);
🎨 RENK PALETİ
Kullanım	Renk	Tailwind
Rotasyon Ana	Mavi	blue-500/600
İzin Ana	Yeşil	green-500/600
Aktif Durum	Yeşil	green-400/500
Bekliyor	Turuncu	orange-400/500
Tamamlandı	Gri	gray-400/500
İptal/Reddedildi	Kırmızı	red-400/500
Yıllık İzin	Mavi	blue-300/400
Hastalık İzni	Kırmızı	red-300/400
Mazeret İzni	Mor	purple-300/400
Lokasyonlar	Mor	purple-400/500
✅ ÖNEMLİ NOKTALAR
Progress Bar: İzin bakiyelerinde yıllık izin progress bar'ı dinamik genişlikte
Animasyonlu Nokta: Aktif rotasyonlarda animate-pulse efekti
Conditional Buttons: Bekliyor durumunda Onayla/Reddet butonları
Tab Geçişleri: Smooth animasyonlar
Form Validasyonu: Zorunlu alanlar kontrolü
Responsive Grid: Mobile-first tasarım