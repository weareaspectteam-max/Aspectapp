import HeaderBarDemo from './components/header-bar-demo';
import { useState, useEffect, useRef } from 'react';
import { AppHeader } from './components/app-header';
import { AspectLogo } from './components/aspect-logo';
import { supabase } from './lib/supabase';
import { setAuthToken } from './lib/api';
import { Login } from './components/login';
import { NewBottomNav } from './components/new-bottom-nav';
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
import { AspectAIPage } from './components/aspect-ai-page';
import { BusinessPanel } from './components/business-panel';
import { MekanManagement } from './components/mekan-management';
import { UserManagement } from './components/user-management';
import { IsletmeGenelDurum } from './components/isletme-genel-durum';
import { EquipmentPage } from './components/equipment-page';
import { StokDagilimi } from './components/stok-dagilimi';
import { ResourceManagement } from './components/resource-management';
import { CostManagement } from './components/cost-management';
import { LocationVisits } from './components/location-visits';
import { SatisRaporu } from './components/satis-raporu';
import { ManagerReports } from './components/manager-reports';
import { AnomaliPanosu } from './components/anomali-panosu';
import { IndirimIstatistik } from './components/indirim-istatistik';
import { BirthdayCalendar } from './components/birthday-calendar';
import { BirthdayNotifications } from './components/birthday-notifications';
import { Announcements } from './components/announcements';
import { OperationsDemo } from './components/operations-demo';
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
  const [userAvatar, setUserAvatar] = useState('👨‍💼');
  const [userEmail, setUserEmail] = useState('');
  const [userBirthDate, setUserBirthDate] = useState('');
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
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (session?.user) {
          _applySession(session.user, session.access_token);
        }
        setAuthLoading(false);
      })
      .catch(() => {
        // Ağ hatası vb. olsa bile loading ekranından çıkılsın
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
        setAuthToken(session.access_token);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const _applySession = (user: any, token: string) => {
    const role: UserRole = (user.user_metadata?.role as UserRole) || 'bekleyen';
    const name: string = user.user_metadata?.full_name || user.email || '';
    const avatar: string = user.user_metadata?.avatar || '👨‍💼';

    setUserId(user.id);
    setUserRole(role);
    setUserName(name);
    setUserEmail(user.email || '');
    setUserBirthDate(user.user_metadata?.birth_date || '');
    setAccessToken(token);
    setIsLoggedIn(true);
    setAuthToken(token); // ← Cache'e yaz, authHeaders() için fallback
    setUserAvatar(avatar);

    // Sadece ilk girişte dashboard'a yönlendir, sonraki token yenilemelerinde değil
    if (!sessionApplied.current) {
      sessionApplied.current = true;
      setActiveTab(role === 'bekleyen' ? '' : 'dashboard');
    }
  };

  const _resetState = () => {
    sessionApplied.current = false;
    setIsLoggedIn(false);
    setUserRole('personel');
    setUserName('');
    setUserId('');
    setAccessToken('');
    setUserAvatar('👨‍💼');
    setUserEmail('');
    setUserBirthDate('');
    setAuthToken(''); // ← Cache'i temizle
    setActiveTab('');
    setSelectedProject('');
    setShiftSetupCompleted(false);
    setShiftSetupData(null);
    setShowShiftChoice(false);
    setShowShiftSetup(false);
    setShowShiftEnd(false);
    setShowCurrentStock(false);
  };

  const handleLogin = (role: UserRole, name: string, uid: string, token: string, avatar: string = '👨‍💼', email: string = '') => {
    setUserId(uid);
    setUserRole(role);
    setUserName(name);
    setAccessToken(token);
    setUserAvatar(avatar);
    setUserEmail(email);
    setIsLoggedIn(true);
    setAuthToken(token); // ← Cache'e yaz
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
    // — quick-sales tabındayken bu akışı tetikleme (AppHeader/BottomNav gizlenmesin)
    if (userRole === 'personel' && activeTab !== 'quick-sales') {
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

    // Hızlı Satış sekmesine explicit navigate edilirse TÜM roller QuickSales görür
    if (activeTab === 'quick-sales') {
      return (
        <QuickSales
          userName={userName}
          userRole={userRole}
          accessToken={accessToken}
          userId={userId}
          onProjectSelect={handleProjectSelect}
          preSelectedProject={isStaffRole && shiftSetupCompleted ? selectedProject : undefined}
          onLogout={handleLogout}
          onNavigate={handleNavigate}
        />
      );
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
            accessToken={accessToken}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      
      case 'rotation-system':
        return (
          <RotationSystem 
            userName={userName}
            userRole={userRole}
            accessToken={accessToken}
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
            userAvatar={userAvatar}
            userEmail={userEmail}
            userBirthDate={userBirthDate}
            accessToken={accessToken}
            onAvatarChange={(avatar) => setUserAvatar(avatar)}
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
          <AspectAIPage 
            userRole={userRole}
            userName={userName}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      
      case 'aspect-ai-page':
        return (
          <AspectAIPage 
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
            accessToken={accessToken}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      
      case 'isletme-genel-durum':
        return (
          <IsletmeGenelDurum 
            userName={userName}
            userRole={userRole}
            accessToken={accessToken}
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
      
      case 'satis-raporu':
        return (
          <SatisRaporu
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
            accessToken={accessToken}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
            onBack={() => handleNavigate('business-panel')}
          />
        );
      
      case 'anomali-panosu':
        return (
          <AnomaliPanosu 
            userName={userName}
            userRole={userRole}
            accessToken={accessToken}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      
      case 'indirim-istatistik':
        return (
          <IndirimIstatistik 
            userName={userName}
            userRole={userRole}
            accessToken={accessToken}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
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
      
      case 'header-demo':
        return <HeaderBarDemo onNavigate={handleNavigate} />;
      
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
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg,#0a051e 0%,#1a0a3c 50%,#0d0a2e 100%)' }}>
      {/* Mobile Container */}
      <div className="max-w-[480px] mx-auto min-h-screen relative">
        {/* Birthday Notifications */}
        {isLoggedIn && <BirthdayNotifications />}

        {/* App Header — tüm roller için, vardiya akışı dışında */}
        {(activeTab === 'quick-sales' || !(showShiftChoice || showShiftSetup || showShiftEnd || showCurrentStock)) && (
          <AppHeader
            userName={userName}
            userRole={userRole}
            activeTab={activeTab}
            onNavigate={handleNavigate}
            onLogout={handleLogout}
          />
        )}

        {/* Main Content */}
        <main className={
          (activeTab === 'quick-sales' || !(showShiftChoice || showShiftSetup || showShiftEnd || showCurrentStock))
            ? 'pt-[60px] pb-24'
            : ''
        }>
          {renderContent()}
        </main>

        {/* Bottom Navigation */}
        {(activeTab === 'quick-sales' || !(showShiftChoice || showShiftSetup || showShiftEnd || showCurrentStock)) && (
          <NewBottomNav activeTab={activeTab} onTabChange={handleNavigate} userRole={userRole} />
        )}

      </div>
    </div>
  );
}