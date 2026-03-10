import { Home, FileText, BarChart3, MessageSquare, Folder, MessageCircle } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  userRole: 'admin' | 'staff';
}

export function BottomNav({ activeTab, onTabChange, userRole }: BottomNavProps) {
  const adminTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'entry', label: 'Veri Girişi', icon: FileText },
    { id: 'reports', label: 'Raporlar', icon: BarChart3 },
    { id: 'projects', label: 'Projeler', icon: Folder },
    { id: 'messages', label: 'Mesajlar', icon: MessageCircle },
  ];

  const staffTabs = [
    { id: 'staff-summary', label: 'Özet', icon: Home },
    { id: 'entry', label: 'Veri Girişi', icon: FileText },
    { id: 'messages', label: 'Mesajlar', icon: MessageCircle },
    { id: 'ai', label: 'AI Yardım', icon: MessageSquare },
  ];

  const tabs = userRole === 'admin' ? adminTabs : staffTabs;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border max-w-[480px] mx-auto">
      <div className="flex items-center justify-around px-2 py-2 safe-area-inset-bottom">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg transition-all ${
                isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className={`w-5 h-5 mb-1 ${isActive ? 'stroke-[2.5px]' : 'stroke-[2px]'}`} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
