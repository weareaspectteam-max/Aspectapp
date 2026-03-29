import { useState } from 'react';
import { TestTube, Users, Calendar, Check } from 'lucide-react';

export function BirthdayTestHelper() {
  const [showHelper, setShowHelper] = useState(false);
  const [message, setMessage] = useState('');

  const addTestUsers = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const testUsers = [
      {
        id: 'user_1',
        name: 'Ahmet Yılmaz',
        email: 'ahmet@aspectops.com',
        role: 'personel',
        avatar: '👨‍💼',
        birthday: `1990-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}` // Bugün
      },
      {
        id: 'user_2',
        name: 'Ayşe Demir',
        email: 'ayse@aspectops.com',
        role: 'personel',
        avatar: '👩‍💼',
        birthday: `1992-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}` // Yarın
      },
      {
        id: 'user_3',
        name: 'Mehmet Kaya',
        email: 'mehmet@aspectops.com',
        role: 'personel',
        avatar: '🧑‍💻',
        birthday: '1988-05-15' // Normal tarih
      },
      {
        id: 'user_4',
        name: 'Zeynep Şahin',
        email: 'zeynep@aspectops.com',
        role: 'idari',
        avatar: '👩‍🎨',
        birthday: '1995-08-20'
      },
      {
        id: 'user_5',
        name: 'Can Özkan',
        email: 'can@aspectops.com',
        role: 'operasyon',
        avatar: '👨‍🔧',
        birthday: '1987-12-10'
      }
    ];

    // localStorage kaldırıldı - KV store entegrasyonu yapılacak
    setMessage('✅ Test kullanıcıları eklendi! (KV store entegrasyonu yapılacak)');
    
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  };

  const clearTestData = () => {
    // localStorage kaldırıldı - KV store entegrasyonu yapılacak
    setMessage('🗑️ Test verileri temizlendi! (KV store entegrasyonu yapılacak)');
    
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  const setCurrentUser = (userName: string) => {
    // localStorage kaldırıldı - KV store entegrasyonu yapılacak
    setMessage(`⚠️ Test helper'ı KV store entegrasyonu bekliyor`);
  };

  if (!showHelper) {
    return (
      <button
        onClick={() => setShowHelper(true)}
        className="fixed bottom-24 right-4 w-12 h-12 rounded-full bg-gradient-to-br from-[#d4b5f7] to-[#c79ff0] flex items-center justify-center shadow-2xl hover:scale-110 transition-all active:scale-95 z-50"
      >
        <TestTube className="w-6 h-6 text-white" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="backdrop-blur-xl bg-black border-2 border-white/20 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#d4b5f7] to-[#c79ff0] flex items-center justify-center">
            <TestTube className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-white text-lg">Test Yardımcısı</h2>
            <p className="text-xs text-gray-400">Doğum günü bildirimlerini test edin</p>
          </div>
        </div>

        {message && (
          <div className="mb-4 p-3 bg-gradient-to-br from-[#a8e6cf]/20 to-[#8dd9b8]/10 border border-[#a8e6cf]/30 rounded-xl">
            <p className="text-sm text-white text-center">{message}</p>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={addTestUsers}
            className="w-full py-3 bg-gradient-to-br from-[#a8e6cf] to-[#8dd9b8] text-white font-bold rounded-xl hover:shadow-lg hover:shadow-[#a8e6cf]/30 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Users className="w-5 h-5" />
            Test Kullanıcıları Ekle
          </button>

          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-3">Kullanıcı olarak giriş yap:</p>
            <div className="space-y-2">
              <button
                onClick={() => setCurrentUser('Ahmet Yılmaz')}
                className="w-full py-2 px-3 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-all flex items-center gap-2"
              >
                <span>👨‍💼</span>
                Ahmet (Bugün doğum günü)
              </button>
              <button
                onClick={() => setCurrentUser('Ayşe Demir')}
                className="w-full py-2 px-3 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-all flex items-center gap-2"
              >
                <span>👩‍💼</span>
                Ayşe (Yarın doğum günü)
              </button>
              <button
                onClick={() => setCurrentUser('Mehmet Kaya')}
                className="w-full py-2 px-3 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-all flex items-center gap-2"
              >
                <span>🧑‍💻</span>
                Mehmet (Normal kullanıcı)
              </button>
            </div>
          </div>

          <button
            onClick={clearTestData}
            className="w-full py-2 bg-gradient-to-br from-[#ffb3ba] to-[#ffa3aa] text-white font-semibold rounded-xl hover:shadow-lg transition-all active:scale-95 text-sm"
          >
            Test Verilerini Temizle
          </button>

          <button
            onClick={() => setShowHelper(false)}
            className="w-full py-2 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all active:scale-95 text-sm"
          >
            Kapat
          </button>
        </div>

        <div className="mt-4 p-3 bg-gradient-to-br from-[#9dd9ea]/10 to-[#7ec8dd]/5 border border-[#9dd9ea]/20 rounded-xl">
          <p className="text-xs text-gray-300 leading-relaxed">
            💡 <strong>Nasıl Kullanılır:</strong><br/>
            1. "Test Kullanıcıları Ekle" butonuna tıklayın<br/>
            2. İstediğiniz kullanıcı olarak giriş yapın<br/>
            3. Bildirimleri görmek için sayfayı yenileyin
          </p>
        </div>
      </div>
    </div>
  );
}