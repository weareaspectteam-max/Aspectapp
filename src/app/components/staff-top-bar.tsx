import { ArrowLeft, Bell } from 'lucide-react';
import { HamburgerMenu } from './hamburger-menu';
import logoImage from 'figma:asset/6a6eb47a9fe2eac247532ef175a68c5b1b4ebed7.png';

interface StaffTopBarProps {
  userName: string;
  userRole: 'admin' | 'staff';
  userAvatar?: string;
  onBack?: () => void;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
  showBackButton?: boolean;
}

export function StaffTopBar({ 
  userName, 
  userRole, 
  userAvatar,
  onBack, 
  onLogout, 
  onNavigate,
  showBackButton = false 
}: StaffTopBarProps) {
  return (
    <div className="sticky top-0 z-50 backdrop-blur-xl bg-gradient-to-br from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] border-b border-white/10">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left: User Info */}
        <div className="flex items-center gap-3">
          {/* Profile Photo */}
          <div className="relative">
            {userAvatar ? (
              <img 
                src={userAvatar} 
                alt={userName}
                className="w-12 h-12 rounded-2xl object-cover border-2 border-white/20"
              />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] flex items-center justify-center border-2 border-white/20">
                <span className="text-2xl">😊</span>
              </div>
            )}
            {/* Online Status */}
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#a8e6cf] rounded-full border-2 border-[#2a2a3a]"></div>
          </div>

          {/* User Name & Role */}
          <div>
            <h3 className="font-bold text-white text-sm leading-tight">{userName}</h3>
            <p className="text-xs text-gray-400">Personel</p>
          </div>
        </div>

        {/* Center: App Logo */}
        <div className="absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2">
          <img 
            src={logoImage} 
            alt="Aspect Operations" 
            className="h-44 w-auto object-contain"
          />
        </div>

        {/* Right: Back Arrow, Bell & Menu */}
        <div className="flex items-center gap-3">
          {/* Back Button - conditionally rendered */}
          {showBackButton && onBack && (
            <button
              onClick={onBack}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all active:scale-95"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
          )}

          {/* Bell Icon */}
          <button className="relative flex items-center justify-center w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all active:scale-95">
            <Bell className="w-5 h-5 text-white" />
            <div className="absolute top-1 right-1 w-2 h-2 bg-[#ffb3ba] rounded-full border border-[#2a2a3a]"></div>
          </button>

          {/* Hamburger Menu */}
          <HamburgerMenu
            userName={userName}
            userRole={userRole}
            onLogout={onLogout}
            onNavigate={onNavigate}
            darkMode={true}
          />
        </div>
      </div>
    </div>
  );
}