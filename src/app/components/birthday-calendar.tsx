import { useState, useEffect } from 'react';
import { Cake, Calendar, ArrowLeft, User, Gift, PartyPopper, Loader2 } from 'lucide-react';
import { authHeaders } from '../lib/api';
import { projectId } from '../lib/supabase-info';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

interface BirthdayCalendarProps {
  userName: string;
  userRole: string;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
  onBack: () => void;
}

interface UserBirthday {
  userId: string;
  name: string;
  avatar: string;
  birthday: string;
  hideBirthdayFromOthers?: boolean;
  hideOthersBirthdays?: boolean;
}

export function BirthdayCalendar({ userName, userRole, onLogout, onNavigate, onBack }: BirthdayCalendarProps) {
  const [birthdays, setBirthdays] = useState<UserBirthday[]>([]);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<UserBirthday[]>([]);
  const [todayBirthdays, setTodayBirthdays] = useState<UserBirthday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadBirthdays();
  }, []);

  const loadBirthdays = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`${SERVER_URL}/birthdays`, { headers });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Doğum günleri yüklenemedi.');
        return;
      }
      const data = await res.json();
      const all: UserBirthday[] = (data.birthdays || []).filter((b: UserBirthday) => !!b.birthday);

      const today = new Date();
      const todayMonth = today.getMonth();
      const todayDay = today.getDate();

      const todayList = all.filter(b => {
        const d = new Date(b.birthday);
        return d.getMonth() === todayMonth && d.getDate() === todayDay;
      });

      const upcomingList = all
        .filter(b => {
          const days = getDaysUntil(b.birthday);
          return days > 0 && days <= 30;
        })
        .sort((a, b) => getDaysUntil(a.birthday) - getDaysUntil(b.birthday));

      const sortedAll = [...all].sort((a, b) => {
        const da = getDaysUntilSorted(a.birthday);
        const db = getDaysUntilSorted(b.birthday);
        return da - db;
      });

      setBirthdays(sortedAll);
      setTodayBirthdays(todayList);
      setUpcomingBirthdays(upcomingList);
    } catch (err) {
      console.error('Load birthdays error:', err);
      setError('Bağlantı hatası.');
    } finally {
      setLoading(false);
    }
  };

  const getDaysUntil = (birthdayStr: string): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bday = new Date(birthdayStr);
    const next = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
    if (next <= today) next.setFullYear(today.getFullYear() + 1);
    return Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getDaysUntilSorted = (birthdayStr: string): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bday = new Date(birthdayStr);
    const next = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
    if (next < today) next.setFullYear(today.getFullYear() + 1);
    return Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const formatBirthday = (birthdayStr: string): string => {
    const bday = new Date(birthdayStr);
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    return `${bday.getDate()} ${months[bday.getMonth()]}`;
  };

  const getAge = (birthdayStr: string): number => {
    const today = new Date();
    const bday = new Date(birthdayStr);
    let age = today.getFullYear() - bday.getFullYear();
    const monthDiff = today.getMonth() - bday.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < bday.getDate())) age--;
    return age;
  };

  const getPrivacyBadge = (user: UserBirthday) => {
    if (user.hideBirthdayFromOthers && !user.hideOthersBirthdays) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 rounded-lg border border-white/10">
          <span className="text-sm">🙈</span>
          <span className="text-xs text-gray-400">Doğum günümü gizliyor</span>
        </div>
      );
    }
    if (!user.hideBirthdayFromOthers && user.hideOthersBirthdays) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 rounded-lg border border-white/10">
          <span className="text-sm">🔕</span>
          <span className="text-xs text-gray-400">Hatırlatma almıyor</span>
        </div>
      );
    }
    if (user.hideBirthdayFromOthers && user.hideOthersBirthdays) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 rounded-lg border border-white/10">
          <span className="text-sm">🙈🔕</span>
          <span className="text-xs text-gray-400">Tamamen gizli</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 rounded-lg border border-white/10">
        <span className="text-sm">✅</span>
        <span className="text-xs text-gray-400">Bildirimler aktif</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] pb-20">
      {/* Header */}
      <div className="sticky top-0 backdrop-blur-xl bg-gradient-to-br from-[#2a2a3a]/95 via-[#3a3a4e]/95 to-[#2f3439]/95 border-b border-white/10 z-10 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all active:scale-95"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#ffb3ba] to-[#ffa3aa] flex items-center justify-center shadow-lg">
              <Cake className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white text-xl">Doğum Günleri</h1>
              <p className="text-xs text-gray-400">Ekip doğum günü takvimi</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 pt-6 space-y-5 pb-8">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="w-10 h-10 text-[#ffb3ba] animate-spin" />
            <p className="text-gray-400 text-sm">Doğum günleri yükleniyor...</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="backdrop-blur-xl bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center">
            <p className="text-red-400">{error}</p>
            <button onClick={loadBirthdays} className="mt-3 text-sm text-[#ffb3ba] underline">Tekrar Dene</button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Today's Birthdays */}
            {todayBirthdays.length > 0 && (
              <div className="backdrop-blur-xl bg-gradient-to-br from-[#ffb3ba]/20 to-[#ffa3aa]/10 border-2 border-[#ffb3ba]/50 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-5">
                  <PartyPopper className="w-6 h-6 text-[#ffb3ba]" />
                  <h2 className="font-bold text-white text-lg">🎉 Bugün Doğum Günü Olanlar</h2>
                </div>
                <div className="space-y-3">
                  {todayBirthdays.map((user) => (
                    <div
                      key={user.userId}
                      className="backdrop-blur-xl bg-gradient-to-br from-[#ffb3ba]/30 to-[#ffa3aa]/20 border border-[#ffb3ba]/40 rounded-xl p-4"
                    >
                      <div className="flex items-center gap-4 mb-3">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#ffb3ba] to-[#ffa3aa] flex items-center justify-center text-2xl shadow-lg border-2 border-white/30">
                          {user.avatar || '🎂'}
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-white flex items-center gap-2">
                            {user.name}
                            <span className="text-2xl">🎂</span>
                          </div>
                          <div className="text-sm text-gray-300">{getAge(user.birthday)} yaşında</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl">🎁</div>
                          <div className="text-xs text-[#ffb3ba] font-bold mt-1">BUGÜN!</div>
                        </div>
                      </div>
                      {getPrivacyBadge(user)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Birthdays (Next 30 days) */}
            {upcomingBirthdays.length > 0 && (
              <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-5">
                  <Calendar className="w-6 h-6 text-[#9dd9ea]" />
                  <h2 className="font-bold text-white text-lg">Yaklaşan Doğum Günleri</h2>
                </div>
                <div className="space-y-3">
                  {upcomingBirthdays.map((user) => {
                    const daysUntil = getDaysUntil(user.birthday);
                    return (
                      <div
                        key={user.userId}
                        className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4"
                      >
                        <div className="flex items-center gap-4 mb-3">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] flex items-center justify-center text-2xl shadow-lg">
                            {user.avatar || '👤'}
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-white">{user.name}</div>
                            <div className="text-sm text-gray-400">{formatBirthday(user.birthday)}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-xs text-gray-400">Kalan</div>
                            <div className="font-bold text-[#9dd9ea]">{daysUntil} gün</div>
                          </div>
                        </div>
                        {getPrivacyBadge(user)}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* All Birthdays */}
            <div className="backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border-2 border-white/20 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-3 mb-5">
                <User className="w-6 h-6 text-[#d4b5f7]" />
                <h2 className="font-bold text-white text-lg">Tüm Doğum Günleri</h2>
              </div>
              {birthdays.length === 0 ? (
                <div className="text-center py-8">
                  <Gift className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                  <p className="text-gray-400">Henüz kayıtlı doğum günü yok</p>
                  <p className="text-xs text-gray-500 mt-2">Personel doğum günlerini hesap ayarlarından ekleyebilir</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {birthdays.map((user) => {
                    const isToday = todayBirthdays.some(t => t.userId === user.userId);
                    const daysUntil = getDaysUntil(user.birthday);
                    return (
                      <div
                        key={user.userId}
                        className={`backdrop-blur-xl border rounded-xl p-4 ${
                          isToday
                            ? 'bg-gradient-to-br from-[#ffb3ba]/20 to-[#ffa3aa]/10 border-[#ffb3ba]/40'
                            : 'bg-white/5 border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-lg ${
                            isToday ? 'bg-gradient-to-br from-[#ffb3ba] to-[#ffa3aa]' : 'bg-white/10'
                          }`}>
                            {user.avatar || '👤'}
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-white flex items-center gap-2">
                              {user.name}
                              {isToday && <span>🎂</span>}
                            </div>
                            <div className="text-sm text-gray-400">{formatBirthday(user.birthday)}</div>
                          </div>
                          <div className="text-right">
                            {isToday ? (
                              <span className="text-xs font-bold text-[#ffb3ba]">BUGÜN</span>
                            ) : (
                              <span className="text-xs text-gray-400">{daysUntil} gün</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
