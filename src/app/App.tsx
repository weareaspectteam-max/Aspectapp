import { useState, useEffect, useRef } from 'react';
import { Bell, ArrowLeft } from 'lucide-react';
import { AspectLogo } from './components/aspect-logo';
import { supabase } from './lib/supabase';
import { Login } from './components/login';
import { NewBottomNav } from './components/new-bottom-nav';
import { HamburgerMenu } from './components/hamburger-menu';
import { AdminDashboard } from './components/admin-dashboard';
import { ManagerDashboard } from './components/manager-dashboard';
import { OperationsDashboard } from './components/operations-dashboard';
import { AdministrativeDashboard } from './components/administrative-dashboard';
import { StaffPersonalDashboard } from './components/staff-personal-dashboard';
import { PendingDashboard } from './components/pending-dashboard';
import { QuickSales } from './components/quick-sales';
import { LiveSalesFeed } from './components/live-sales-feed';
import { Leaderboard } from './components/leaderboard';
import { Messaging } from './components/messaging';
import { RotationSystem } from './components/rotation-system';
import { StaffProfile } from './components/staff-profile';
import { Settings } from './components/settings';
import { AspectAcademy } from './components/aspect-academy';
import { AIAssistant } from './components/ai-assistant';
import { BusinessPanel } from './components/business-panel';
import { MekanManagement } from './components/mekan-management';
import { UserManagement } from './components/user-management';
import { IsletmeGenelDurum } from './components/isletme-genel-durum';
import { EquipmentPage } from './components/equipment-page';
import { StokDagilimi } from './components/stok-dagilimi';
import { ResourceManagement } from './components/resource-management';
import { CostManagement } from './components/cost-management';
import { LocationVisits } from './components/location-visits';
import { ManagerReports } from './components/manager-reports';
import { BirthdayCalendar } from './components/birthday-calendar';
import { BirthdayNotifications } from './components/birthday-notifications';
import { BirthdayTestHelper } from './components/birthday-test-helper';
import { Announcements } from './components/announcements';
import { OperationsDemo } from './components/operations-demo';
import { FrameTracking } from './components/frame-tracking';
import { ShiftSetup } from './components/shift-setup';
import { ShiftChoice } from './components/shift-choice';
import { ShiftEnd } from './components/shift-end';
import { CurrentStock } from './components/current-stock';
import type { UserRole } from './components/login';
import type { ShiftSetupData } from './components/shift-setup';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('personel');
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [shiftSetupCompleted, setShiftSetupCompleted] = useState(false);
  const [shiftSetupData, setShiftSetupData] = useState<ShiftSetupData | null>(null);
  const [showShiftChoice, setShowShiftChoice] = useState(false);
  const [showShiftSetup, setShowShiftSetup] = useState(false);
  const [showShiftEnd, setShowShiftEnd] = useState(false);
  const [showCurrentStock, setShowCurrentStock] = useState(false);
  const sessionApplied = useRef(false); // ← İlk giriş işareti

  // ─── Supabase session yönetimi ───────────────────
  useEffect(() => {
    // Mevcut session'ı kontrol et
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        _applySession(session.user, session.access_token);
      }
      setAuthLoading(false);
    });

    // Auth state değişikliklerini dinle
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        _resetState();
      } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        _applySession(session.user, session.access_token);
      } else if (event === 'TOKEN_REFRESHED') {
        // Sadece token'ı güncelle, aktif tab'ı değiştirme
        setAccessToken(session.access_token);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const _applySession = (user: any, token: string) => {
    const role: UserRole = (user.user_metadata?.role as UserRole) || 'bekleyen';
    const name: string = user.user_metadata?.full_name || user.email || '';

    setUserId(user.id);
    setUserRole(role);
    setUserName(name);
    setAccessToken(token);
    setIsLoggedIn(true);

    // Sadece ilk girişte dashboard'a yönlendir, sonraki token yenilemelerinde değil
    if (!sessionApplied.current) {
      sessionApplied.current = true;
      setActiveTab(role === 'bekleyen' ? '' : 'dashboard');
    }
  };

  const _resetState = () => {
    sessionApplied.current = false; // ← Çıkışta işareti sıfırla
    setIsLoggedIn(false);
    setUserRole('personel');
    setUserName('');
    setUserId('');
    setAccessToken('');
    setActiveTab('');
    setSelectedProject('');
    setShiftSetupCompleted(false);
    setShiftSetupData(null);
    setShowShiftChoice(false);
    setShowShiftSetup(false);
    setShowShiftEnd(false);
    setShowCurrentStock(false);
  };

  const handleLogin = (role: UserRole, name: string, uid: string, token: string) => {
    setUserId(uid);
    setUserRole(role);
    setUserName(name);
    setAccessToken(token);
    setIsLoggedIn(true);
    setActiveTab(role === 'bekleyen' ? '' : 'dashboard');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    _resetState();
  };

  const handleShiftSetupComplete = (setupData: ShiftSetupData) => {
    setShiftSetupData(setupData);
    setShiftSetupCompleted(true);
    setShowShiftSetup(false);
    setShowShiftChoice(false);
  };

  const handleProjectSelect = (projectName: string) => {
    setSelectedProject(projectName);
    // Personel için proje seçildiğinde choice ekranını göster
    if (userRole === 'personel') {
      setShowShiftChoice(true);
    }
  };

  const handleStartShiftSetup = () => {
    setShowShiftChoice(false);
    setShowShiftSetup(true);
  };

  const handleStartSales = () => {
    setShowShiftChoice(false);
    setShowCurrentStock(false);
    setShiftSetupCompleted(true);
    setActiveTab('quick-sales');
  };

  const handleViewStock = () => {
    setShowShiftChoice(false);
    setShowCurrentStock(true);
  };

  const handleEndShift = () => {
    setShowShiftChoice(false);
    setShowShiftEnd(true);
  };

  const handleBackFromStock = () => {
    setShowCurrentStock(false);
    setShowShiftChoice(true);
  };

  const handleBackFromShiftEnd = () => {
    setShowShiftEnd(false);
    setShowShiftChoice(true);
  };

  const handleBackFromChoice = () => {
    setShowShiftChoice(false);
    setSelectedProject('');
  };

  const handleNavigate = (tab: string) => {
    setShowCurrentStock(false);
    setShowShiftSetup(false);
    setShowShiftEnd(false);
    
    if (tab === 'home' && userRole === 'personel' && selectedProject) {
      setShowShiftChoice(true);
      setActiveTab('');
    } else {
      setShowShiftChoice(false);
      setActiveTab(tab);
    }
  };

  // Rol bazlı yetki kontrolleri
  const isManagerRole = ['yonetici', 'ust-mudur', 'mudur'].includes(userRole);
  const isOperationsRole = userRole === 'operasyon';
  const isAdministrativeRole = userRole === 'idari';
  const isStaffRole = userRole === 'personel';
  const isPendingRole = userRole === 'bekleyen';

  // Rol isimlerini Türkçeleştir
  const getRoleTitle = (role: UserRole): string => {
    const titles: Record<UserRole, string> = {
      'yonetici': 'Yönetici',
      'ust-mudur': 'Üst Müdür',
      'mudur': 'Müdür',
      'operasyon': 'Operasyon Yöneticisi',
      'personel': 'Personel',
      'idari': 'İdari Görevli',
      'bekleyen': 'Bekleyen Kullanıcı',
    };
    return titles[role];
  };

  const renderContent = () => {
    // Bekleyen kullanıcılar için sadece pending dashboard
    if (isPendingRole) {
      return <PendingDashboard userName={userName} onLogout={handleLogout} onNavigate={handleNavigate} />;
    }

    // Personel için mevcut akış
    if (isStaffRole && selectedProject && showCurrentStock) {
      return (
        <CurrentStock
          userName={userName}
          userRole={userRole}
          projectName={selectedProject}
          onBack={handleBackFromStock}
          onLogout={handleLogout}
          onNavigate={handleNavigate}
        />
      );
    }

    if (isStaffRole && selectedProject && showShiftEnd) {
      return (
        <ShiftEnd
          userName={userName}
          userRole={userRole}
          projectName={selectedProject}
          onBack={handleBackFromShiftEnd}
          onLogout={handleLogout}
          onNavigate={handleNavigate}
        />
      );
    }

    if (isStaffRole && selectedProject && showShiftChoice) {
      return (
        <ShiftChoice
          userName={userName}
          userRole={userRole}
          projectName={selectedProject}
          onStartShiftSetup={handleStartShiftSetup}
          onStartSales={handleStartSales}
          onViewStock={handleViewStock}
          onEndShift={handleEndShift}
          onLogout={handleLogout}
          onNavigate={handleNavigate}
          onBack={handleBackFromChoice}
        />
      );
    }

    if (isStaffRole && selectedProject && showShiftSetup) {
      return (
        <ShiftSetup 
          userName={userName}
          userRole={userRole}
          projectName={selectedProject} 
          onComplete={handleShiftSetupComplete}
          onLogout={handleLogout}
          onNavigate={handleNavigate}
          onBack={() => {
            setShowShiftSetup(false);
            setShowShiftChoice(true);
          }}
        />
      );
    }

    // Tab bazlı içerik
    switch (activeTab) {
      case 'home':
        if (isStaffRole && selectedProject) {
          return (
            <ShiftChoice
              userName={userName}
              userRole={userRole}
              projectName={selectedProject}
              onStartShiftSetup={handleStartShiftSetup}
              onStartSales={handleStartSales}
              onViewStock={handleViewStock}
              onEndShift={handleEndShift}
              onLogout={handleLogout}
              onNavigate={handleNavigate}
            />
          );
        }
        return renderDashboard();
      
      case 'dashboard':
        return renderDashboard();
      
      case 'quick-sales':
        return (
          <QuickSales 
            userName={userName} 
            userRole={userRole} 
            onProjectSelect={handleProjectSelect}
            preSelectedProject={isStaffRole && shiftSetupCompleted ? selectedProject : undefined}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      
      case 'live-feed':
        return <LiveSalesFeed userName={userName} userRole={userRole} onLogout={handleLogout} onNavigate={handleNavigate} />;
      
      case 'leaderboard':
        return (
          <Leaderboard 
            userName={userName}
            userRole={userRole}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      
      case 'messaging':
        return (
          <Messaging 
            currentUser={userName}
            userRole={userRole}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      
      case 'rotation':
        return (
          <RotationSystem 
            userName={userName}
            userRole={userRole}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      
      case 'rotation-system':
        return (
          <RotationSystem 
            userName={userName}
            userRole={userRole}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      
      case 'profile':
        return (
          <StaffProfile 
            userName={userName}
            userRole={userRole}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      
      case 'settings':
        return (
          <Settings 
            userName={userName}
            userRole={userRole}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      
      case 'academy':
        return (
          <AspectAcademy 
            userName={userName}
            userRole={userRole}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      
      case 'aspect-ai':
        return (
          <AIAssistant 
            userRole={userRole}
            userName={userName}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      
      case 'business-panel':
        return (
          <BusinessPanel 
            userName={userName}
            userRole={userRole}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      
      case 'mekan-management':
        return (
          <MekanManagement 
            userName={userName}
            userRole={userRole}
            accessToken={accessToken}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      
      case 'user-management':
        return (
          <UserManagement 
            userName={userName}
            userRole={userRole}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      
      case 'isletme-genel-durum':
        return (
          <IsletmeGenelDurum 
            userName={userName}
            userRole={userRole}
            onNavigate={handleNavigate}
          />
        );
      
      case 'equipment-page':
        return (
          <EquipmentPage 
            userName={userName}
            userRole={userRole}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      
      case 'stock-distribution':
        return (
          <StokDagilimi 
            userName={userName}
            userRole={userRole}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      
      case 'resource-management':
        return (
          <ResourceManagement 
            userName={userName}
            userRole={userRole}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      
      case 'cost-management':
        return (
          <CostManagement 
            userName={userName}
            userRole={userRole}
            accessToken={accessToken}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      
      case 'location-visits':
        return (
          <LocationVisits 
            userName={userName}
            userRole={userRole}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
            embedded={true}
            onBack={() => handleNavigate('business-panel')}
          />
        );
      
      case 'manager-reports':
        return (
          <ManagerReports 
            userName={userName}
            userRole={userRole}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
            onBack={() => handleNavigate('business-panel')}
          />
        );
      
      case 'birthday-calendar':
        return (
          <BirthdayCalendar 
            userName={userName}
            userRole={userRole}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
            onBack={() => handleNavigate('dashboard')}
          />
        );
      
      case 'announcements':
        return (
          <Announcements 
            userName={userName}
            userRole={userRole}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      
      case 'operations-demo':
        return (
          <OperationsDemo 
            userName={userName}
            userRole={userRole}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      
      case 'frame-tracking':
        return (
          <FrameTracking
            userName={userName}
            userRole={userRole}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      
      default:
        return renderDashboard();
    }
  };

  const renderDashboard = () => {
    if (isStaffRole) {
      return <StaffPersonalDashboard userName={userName} onLogout={handleLogout} onNavigate={handleNavigate} />;
    } else if (isOperationsRole) {
      return <OperationsDashboard userName={userName} onLogout={handleLogout} onNavigate={handleNavigate} />;
    } else if (isAdministrativeRole) {
      return <AdministrativeDashboard userName={userName} onLogout={handleLogout} onNavigate={handleNavigate} />;
    } else if (userRole === 'ust-mudur') {
      return <ManagerDashboard userName={userName} roleTitle="Üst Müdür" onLogout={handleLogout} onNavigate={handleNavigate} />;
    } else if (userRole === 'mudur') {
      return <ManagerDashboard userName={userName} roleTitle="Müdür" onLogout={handleLogout} onNavigate={handleNavigate} />;
    } else {
      // Yönetici
      return <AdminDashboard userName={userName} userRole={userRole} onLogout={handleLogout} onNavigate={handleNavigate} />;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] flex items-center justify-center">
        <div className="text-center space-y-6">
          <AspectLogo width={192} height={52} className="mx-auto opacity-80" />
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-[#9dd9ea] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-[#9dd9ea] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-[#9dd9ea] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  // Bekleyen kullanıcılar için sadece pending screen, navbar yok
  if (isPendingRole) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439]">
        <div className="max-w-[480px] mx-auto min-h-screen relative">
          {renderContent()}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439]">
      {/* Mobile Container */}
      <div className="max-w-[480px] mx-auto min-h-screen relative">
        {/* Birthday Notifications */}
        {isLoggedIn && <BirthdayNotifications />}

        {/* Header Bar - Sadece yönetici rolleri için göster, personel için gizle */}
        {!isStaffRole && !(showShiftChoice || showShiftSetup || showShiftEnd || showCurrentStock) && (
          <div className="fixed top-0 left-0 right-0 backdrop-blur-xl bg-gradient-to-br from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] border-b border-white/10 z-10 max-w-[480px] mx-auto">
            <div className="flex items-center justify-between px-6 py-4">
              {/* Left: Profile Avatar */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#b8d4f1] to-[#9dd9ea] flex items-center justify-center text-2xl shadow-lg border-2 border-white/20">
                    👨‍💼
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#a8e6cf] rounded-full border-2 border-[#2a2a3a]"></div>
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm leading-tight">{userName}</h3>
                  <p className="text-xs text-gray-400">{getRoleTitle(userRole)}</p>
                </div>
              </div>

              {/* Center: Logo */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <span className="text-white font-black text-xl tracking-[0.2em] uppercase">ASPECT</span>
              </div>

              {/* Right: Notifications & Menu */}
              <div className="flex items-center gap-3">
                {activeTab !== 'dashboard' && (
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all active:scale-95"
                  >
                    <ArrowLeft className="w-5 h-5 text-white" />
                  </button>
                )}

                <button className="relative flex items-center justify-center w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all active:scale-95">
                  <Bell className="w-5 h-5 text-white" />
                  <div className="absolute top-1 right-1 w-2 h-2 bg-[#ffd4a3] rounded-full border border-[#2a2a3a]"></div>
                </button>
                <HamburgerMenu
                  userName={userName}
                  userRole={userRole}
                  onLogout={handleLogout}
                  onNavigate={handleNavigate}
                />
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className={!isStaffRole && !(showShiftChoice || showShiftSetup || showShiftEnd || showCurrentStock) ? 'pt-20 pb-20' : isStaffRole && !(showShiftChoice || showShiftSetup || showShiftEnd || showCurrentStock) ? 'pb-20' : ''}>
          {renderContent()}
        </main>

        {/* Bottom Navigation */}
        {!(showShiftChoice || showShiftSetup || showShiftEnd || showCurrentStock) && (
          <NewBottomNav activeTab={activeTab} onTabChange={handleNavigate} userRole={userRole} />
        )}

        {/* Birthday Test Helper - Development only */}
        <BirthdayTestHelper />
      </div>
    </div>
  );
}