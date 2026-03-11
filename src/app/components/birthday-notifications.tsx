import { useEffect, useState } from 'react';
import { Cake, X, PartyPopper } from 'lucide-react';

interface BirthdayNotification {
  id: string;
  type: 'reminder' | 'birthday';
  userName: string;
  userAvatar: string;
  message: string;
}

export function BirthdayNotifications() {
  const [notifications, setNotifications] = useState<BirthdayNotification[]>([]);
  const [dismissedNotifications, setDismissedNotifications] = useState<string[]>([]);

  useEffect(() => {
    checkBirthdays();
    // Check every hour
    const interval = setInterval(checkBirthdays, 60 * 60 * 1000);
    // localStorage kaldırıldı - KV store entegrasyonu yapılacak
    return () => clearInterval(interval);
  }, []);

  const checkBirthdays = () => {
    // localStorage kaldırıldı - KV store entegrasyonu yapılacak
    // Boş başlıyoruz, doğum günü bildirimleri KV store'dan gelecek
    setNotifications([]);
  };

  const dismissNotification = (notifId: string) => {
    const updated = [...dismissedNotifications, notifId];
    setDismissedNotifications(updated);
    // localStorage kaldırıldı - KV store entegrasyonu yapılacak
    setNotifications(notifications.filter(n => n.id !== notifId));
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
                  <>
                    <PartyPopper className="w-4 h-4" />
                    Doğum Günü!
                  </>
                ) : (
                  <>
                    <Cake className="w-4 h-4" />
                    Hatırlatma
                  </>
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