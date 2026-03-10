import { useState, useEffect } from 'react';
import { Login, UserRole } from './components/login';
import { AdminDashboard } from './components/admin-dashboard';
import { ManagerDashboard } from './components/manager-dashboard';
import { OperationsDashboard } from './components/operations-dashboard';
import { AdministrativeDashboard } from './components/administrative-dashboard';
import { PendingDashboard } from './components/pending-dashboard';
import { BusinessPanel } from './components/business-panel';
import { QuickSales } from './components/quick-sales';
import { LiveSalesFeed } from './components/live-sales-feed';
import { Leaderboard } from './components/leaderboard';
import { Messaging } from './components/messaging';
import { StaffProfile } from './components/staff-profile';
import { Settings } from './components/settings';
import { NewBottomNav } from './components/new-bottom-nav';
import { ShiftSetup, ShiftSetupData } from './components/shift-setup';
import { ShiftChoice } from './components/shift-choice';
import { ShiftEnd } from './components/shift-end';
import { CurrentStock } from './components/current-stock';
import { HamburgerMenu } from './components/hamburger-menu';
// ❌ REMOVED: import { Rotation } from './components/rotation'; (file deleted)
import { RotationSystem } from './components/rotation-system';
import { AspectAcademy } from './components/aspect-academy';
import { AIAssistant } from './components/ai-assistant';
import { StaffPersonalDashboard } from './components/staff-personal-dashboard';
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
import { Bell, ArrowLeft } from 'lucide-react';
import logoImage from 'figma:asset/6a6eb47a9fe2eac247532ef175a68c5b1b4ebed7.png';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('personel');
  const [userName, setUserName] = useState('');
  const [activeTab, setActiveTab] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [shiftSetupCompleted, setShiftSetupCompleted] = useState(false);
  const [shiftSetupData, setShiftSetupData] = useState<ShiftSetupData | null>(null);
  const [showShiftChoice, setShowShiftChoice] = useState(false);
  const [showShiftSetup, setShowShiftSetup] = useState(false);
  const [showShiftEnd, setShowShiftEnd] = useState(false);
  const [showCurrentStock, setShowCurrentStock] = useState(false);

  // LocalStorage'dan kullanıcı bilgilerini yükle
  useEffect(() => {
    const storedUser = localStorage.getItem('aspectUser');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);

        // 🔧 MIGRATION: Eski email tabanlı ID'leri düzelt
        if (user.id && user.id.includes('@')) {
          const stableId = `mock-user-${user.role}`;
          
          // aspect_users'ı güncelle
          try {
            const aspectUsersStr = localStorage.getItem('aspect_users');
            let aspectUsers: any[] = aspectUsersStr ? JSON.parse(aspectUsersStr) : [];
            
            // stableId zaten var mı?
            const alreadyExists = aspectUsers.find((u: any) => u.id === stableId);
            if (!alreadyExists) {
              aspectUsers.push({
                id: stableId,
                email: user.email,
                full_name: user.name,
                role: user.role,
                created_at: new Date().toISOString(),
                last_sign_in: new Date().toISOString(),
                phone: '',
              });
              localStorage.setItem('aspect_users', JSON.stringify(aspectUsers));
            }
          } catch (e) { /* silent */ }
          
          // aspectUser'ı güncelle
          user.id = stableId;
          localStorage.setItem('aspectUser', JSON.stringify(user));
        }

        setUserRole(user.role);
        setUserName(user.name);
        setIsLoggedIn(true);
        setActiveTab(user.role === 'bekleyen' ? '' : 'dashboard');
      } catch (error) {
        console.error('Kullanıcı bilgileri yüklenemedi:', error);
        localStorage.removeItem('aspectUser');
      }
    }
  }, []);

  const handleLogin = (role: UserRole, name: string) => {
    setUserRole(role);
    setUserName(name);
    setIsLoggedIn(true);
    // Bekleyen kullanıcılar için tab yok, diğerleri için dashboard
    setActiveTab(role === 'bekleyen' ? '' : 'dashboard');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserRole('personel');
    setUserName('');
    setActiveTab('');
    setSelectedProject('');
    setShiftSetupCompleted(false);
    setShiftSetupData(null);
    setShowShiftChoice(false);
    setShowShiftSetup(false);
    setShowShiftEnd(false);
    setShowCurrentStock(false);
    // LocalStorage'ı temizle
    localStorage.removeItem('aspectUser');
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
          userRole="staff"
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
          userRole="staff"
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
          userRole="staff"
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
          userRole="staff"
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
              userRole="staff"
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
            userRole={isStaffRole ? 'staff' : 'admin'} 
            onProjectSelect={handleProjectSelect}
            preSelectedProject={isStaffRole && shiftSetupCompleted ? selectedProject : undefined}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      
      case 'live-feed':
        return <LiveSalesFeed userName={userName} userRole={isStaffRole ? 'staff' : 'admin'} onLogout={handleLogout} onNavigate={handleNavigate} />;
      
      case 'leaderboard':
        return (
          <Leaderboard 
            userName={userName}
            userRole={isStaffRole ? 'staff' : 'admin'}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      
      case 'messaging':
        return (
          <Messaging 
            currentUser={userName}
            userRole={isStaffRole ? 'staff' : 'admin'}
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
            userRole={isStaffRole ? 'staff' : 'admin'}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      
      case 'settings':
        return (
          <Settings 
            userName={userName}
            userRole={isStaffRole ? 'staff' : 'admin'}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      
      case 'academy':
        return (
          <AspectAcademy 
            userName={userName}
            userRole={isStaffRole ? 'staff' : 'admin'}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      
      case 'aspect-ai':
        return (
          <AIAssistant 
            userRole={isStaffRole ? 'staff' : 'admin'}
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
            userRole={isStaffRole ? 'staff' : 'admin'}
            onLogout={handleLogout}
            onNavigate={handleNavigate}
          />
        );
      
      case 'operations-demo':
        return (
          <OperationsDemo 
            userName={userName}
            userRole={isStaffRole ? 'staff' : 'admin'}
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
      return <AdminDashboard userName={userName} userRole="admin" onLogout={handleLogout} onNavigate={handleNavigate} />;
    }
  };

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
              <div className="absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2">
                <img 
                  src={logoImage} 
                  alt="Aspect Operations" 
                  className="h-44 w-auto object-contain"
                />
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
                  userRole={isStaffRole ? 'staff' : 'admin'}
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
          <NewBottomNav activeTab={activeTab} onTabChange={handleNavigate} userRole={isStaffRole ? 'staff' : 'admin'} />
        )}

        {/* Birthday Test Helper - Development only */}
        <BirthdayTestHelper />
      </div>
    </div>
  );
}