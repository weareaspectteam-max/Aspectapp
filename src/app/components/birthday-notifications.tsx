import { useEffect, useState } from 'react';
import { Cake, X, PartyPopper } from 'lucide-react';
import { authHeaders } from '../lib/api';
import { projectId } from '/utils/supabase/info';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;
const DISMISSED_KEY = 'aspect_dismissed_birthday_notifs';

interface BirthdayNotification {
  id: string;
  type: 'reminder' | 'birthday';
  userName: string;
  userAvatar: string;
  message: string;
}

export function BirthdayNotifications() {
  const [notifications, setNotifications] = useState<BirthdayNotification[]>([]);

  useEffect(() => {
    const timer = setTimeout(checkBirthdays, 1500); // Kısa gecikme — auth oturumu kurulsun
    const interval = setInterval(checkBirthdays, 60 * 60 * 1000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, []);

  const getDismissed = (): string[] => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const raw = sessionStorage.getItem(DISMISSED_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed[today] || [];
    } catch { return []; }
  };

  const saveDismissed = (id: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const raw = sessionStorage.getItem(DISMISSED_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed[today] = [...(parsed[today] || []), id];
      sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(parsed));
    } catch {}
  };

  const checkBirthdays = async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${SERVER_URL}/birthdays`, { headers });
      if (!res.ok) return;

      const data = await res.json();
      const birthdays: any[] = data.birthdays || [];

      const today = new Date();
      const todayMonth = today.getMonth();
      const todayDay = today.getDate();

      // Yarın
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowMonth = tomorrow.getMonth();
      const tomorrowDay = tomorrow.getDate();

      const dismissed = getDismissed();
      const newNotifs: BirthdayNotification[] = [];

      birthdays.forEach((b) => {
        if (!b.birthday) return;
        const bday = new Date(b.birthday);
        const bMonth = bday.getMonth();
        const bDay = bday.getDate();

        // Bugün doğum günü mü?
        if (bMonth === todayMonth && bDay === todayDay) {
          const id = `birthday_today_${b.userId}`;
          if (!dismissed.includes(id)) {
            newNotifs.push({
              id,
              type: 'birthday',
              userName: b.name,
              userAvatar: b.avatar || '🎂',
              message: `🎉 Bugün ${b.name} adlı ekip arkadaşınızın doğum günü!`,
            });
          }
        }

        // Yarın doğum günü mü?
        if (bMonth === tomorrowMonth && bDay === tomorrowDay) {
          const id = `birthday_tomorrow_${b.userId}`;
          if (!dismissed.includes(id)) {
            newNotifs.push({
              id,
              type: 'reminder',
              userName: b.name,
              userAvatar: b.avatar || '🎂',
              message: `🎂 Yarın ${b.name} adlı ekip arkadaşınızın doğum günü!`,
            });
          }
        }
      });

      setNotifications(newNotifs);
    } catch (err) {
      console.error('[BirthdayNotifications] Hata:', err);
    }
  };

  const dismissNotification = (id: string) => {
    saveDismissed(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 space-y-3 w-[90%] max-w-md">
      {notifications.map((notif) => (
        <div
          key={notif.id}
          className={`backdrop-blur-xl border-2 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-top-5 ${
            notif.type === 'birthday'
              ? 'bg-gradient-to-br from-[#ffb3ba]/95 to-[#ffa3aa]/95 border-[#ffb3ba]/50'
              : 'bg-gradient-to-br from-[#9dd9ea]/95 to-[#7ec8dd]/95 border-[#9dd9ea]/50'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl shadow-lg border-2 border-white/30">
              {notif.userAvatar}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-white mb-1 flex items-center gap-2">
                {notif.type === 'birthday' ? (
                  <><PartyPopper className="w-4 h-4" />Doğum Günü!</>
                ) : (
                  <><Cake className="w-4 h-4" />Hatırlatma</>
                )}
              </div>
              <p className="text-sm text-white/90">{notif.message}</p>
            </div>
            <button
              onClick={() => dismissNotification(notif.id)}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all active:scale-95"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
