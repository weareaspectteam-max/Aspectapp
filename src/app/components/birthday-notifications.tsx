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
    
    // Load dismissed notifications
    const dismissed = localStorage.getItem('dismissedBirthdayNotifications');
    if (dismissed) {
      try {
        setDismissedNotifications(JSON.parse(dismissed));
      } catch (error) {
        console.error('Dismissed notifications yüklenemedi:', error);
      }
    }

    return () => clearInterval(interval);
  }, []);

  const checkBirthdays = () => {
    const usersData = localStorage.getItem('aspectUsers');
    const currentUser = localStorage.getItem('aspectUser');
    
    if (!usersData || !currentUser) return;

    try {
      const users = JSON.parse(usersData);
      const current = JSON.parse(currentUser);
      
      // Check if current user wants to hide other birthdays
      if (current.hideOthersBirthdays === true) {
        return; // Don't show any notifications
      }
      
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayStr = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const tomorrowStr = `${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

      const newNotifications: BirthdayNotification[] = [];

      users.forEach((user: any) => {
        if (!user.birthday) return;
        
        // Skip if this user wants to hide their birthday from others
        if (user.hideBirthdayFromOthers === true && user.name !== current.name) {
          return;
        }

        const bday = new Date(user.birthday);
        const bdayStr = `${String(bday.getMonth() + 1).padStart(2, '0')}-${String(bday.getDate()).padStart(2, '0')}`;

        // Check if it's this user's birthday today
        if (user.name === current.name && bdayStr === todayStr) {
          const notifId = `birthday-${user.name}-${todayStr}`;
          if (!dismissedNotifications.includes(notifId)) {
            newNotifications.push({
              id: notifId,
              type: 'birthday',
              userName: user.name,
              userAvatar: user.avatar || '🎂',
              message: `🎉 Mutlu yıllar ${user.name}! Doğum gününüz kutlu olsun! 🎂`,
            });
          }
        }
        // Check if someone else's birthday is tomorrow (reminder for current user)
        else if (user.name !== current.name && bdayStr === tomorrowStr) {
          const notifId = `reminder-${user.name}-${tomorrowStr}`;
          if (!dismissedNotifications.includes(notifId)) {
            newNotifications.push({
              id: notifId,
              type: 'reminder',
              userName: user.name,
              userAvatar: user.avatar || '👤',
              message: `🎂 Yarın ${user.name}'ın doğum günü! Kutlamayı unutmayın!`,
            });
          }
        }
      });

      setNotifications(newNotifications);
    } catch (error) {
      console.error('Birthday check failed:', error);
    }
  };

  const dismissNotification = (notifId: string) => {
    const updated = [...dismissedNotifications, notifId];
    setDismissedNotifications(updated);
    localStorage.setItem('dismissedBirthdayNotifications', JSON.stringify(updated));
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