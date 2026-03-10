import { useState, useEffect } from 'react';
import { Shield, UserCog, Users, User, Briefcase, UserPlus, Clock, List, ChevronDown, ChevronRight, UserCheck, Trash2, Edit2, X, CheckCircle, ArrowLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface UserManagementProps {
  userName: string;
  userRole: 'admin' | 'staff';
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

interface UserData {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  last_sign_in: string | null;
  phone?: string;
}

type UserRole = 
  | 'yonetici'
  | 'ust-mudur'
  | 'mudur'
  | 'operasyon'
  | 'personel'
  | 'idari'
  | 'bekleyen';

type ActiveTab = 'active' | 'pending' | 'staff-list';
type StaffListFilter = 'all' | 'only-active' | 'only-pending' | 'signed-in' | 'not-signed-in';

export function UserManagement({ userRole, onNavigate }: UserManagementProps) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UserData[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('active');
  const [staffListFilter, setStaffListFilter] = useState<StaffListFilter>('all');
  const [expandedRoles, setExpandedRoles] = useState<Set<UserRole>>(new Set());
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Get current logged in user role
  const getCurrentUserRole = (): UserRole => {
    const storedUser = localStorage.getItem('aspectUser');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        return user.role;
      } catch (error) {
        console.error('Error parsing user:', error);
      }
    }
    return userRole === 'admin' ? 'yonetici' : 'personel';
  };

  const currentUserRole = getCurrentUserRole();

  // Role configuration
  const roleConfig = {
    yonetici: {
      icon: Shield,
      label: 'Yönetici',
      color: '#ef4444',
      bg: 'from-red-500/20 to-red-600/20',
      text: 'text-red-400',
      badge: 'bg-red-500/20 border-red-500/30 text-red-200',
    },
    'ust-mudur': {
      icon: UserCog,
      label: 'Üst Müdür',
      color: '#a78bfa',
      bg: 'from-indigo-500/20 to-indigo-600/20',
      text: 'text-indigo-400',
      badge: 'bg-indigo-500/20 border-indigo-500/30 text-indigo-200',
    },
    mudur: {
      icon: Users,
      label: 'Müdür',
      color: '#c084fc',
      bg: 'from-purple-500/20 to-purple-600/20',
      text: 'text-purple-400',
      badge: 'bg-purple-500/20 border-purple-500/30 text-purple-200',
    },
    operasyon: {
      icon: UserCheck,
      label: 'Operasyon',
      color: '#60a5fa',
      bg: 'from-blue-500/20 to-blue-600/20',
      text: 'text-blue-400',
      badge: 'bg-blue-500/20 border-blue-500/30 text-blue-200',
    },
    personel: {
      icon: User,
      label: 'Personel',
      color: '#4ade80',
      bg: 'from-green-500/20 to-green-600/20',
      text: 'text-green-400',
      badge: 'bg-green-500/20 border-green-500/30 text-green-200',
    },
    idari: {
      icon: Briefcase,
      label: 'İdari',
      color: '#facc15',
      bg: 'from-amber-500/20 to-amber-600/20',
      text: 'text-amber-400',
      badge: 'bg-amber-500/20 border-amber-500/30 text-amber-200',
    },
    bekleyen: {
      icon: UserPlus,
      label: 'Bekleyen',
      color: '#9ca3af',
      bg: 'from-gray-500/20 to-gray-600/20',
      text: 'text-gray-400',
      badge: 'bg-gray-500/20 border-gray-500/30 text-gray-200',
    },
  };

  // Mock data
  const mockActiveUsers: UserData[] = [
    // 1 Admin
    {
      id: 'user-1',
      email: 'admin@aspectops.com',
      full_name: 'Ahmet Yıldırım',
      role: 'yonetici',
      created_at: '2024-01-01T10:00:00Z',
      last_sign_in: '2024-03-05T09:00:00Z',
      phone: '+90 555 100 1001',
    },
    // 2 Üst Müdür
    {
      id: 'user-2',
      email: 'mehmet@aspectops.com',
      full_name: 'Mehmet Kaya',
      role: 'ust-mudur',
      created_at: '2024-01-10T10:00:00Z',
      last_sign_in: '2024-03-05T08:30:00Z',
      phone: '+90 555 200 2001',
    },
    {
      id: 'user-3',
      email: 'ayse@aspectops.com',
      full_name: 'Ayşe Demir',
      role: 'ust-mudur',
      created_at: '2024-01-15T10:00:00Z',
      last_sign_in: '2024-03-04T18:45:00Z',
      phone: '+90 555 200 2002',
    },
    // 3 Müdür
    {
      id: 'user-4',
      email: 'fatma@aspectops.com',
      full_name: 'Fatma Şahin',
      role: 'mudur',
      created_at: '2024-01-20T10:00:00Z',
      last_sign_in: '2024-03-05T07:15:00Z',
      phone: '+90 555 300 3001',
    },
    {
      id: 'user-5',
      email: 'ali@aspectops.com',
      full_name: 'Ali Yılmaz',
      role: 'mudur',
      created_at: '2024-01-25T10:00:00Z',
      last_sign_in: '2024-03-04T20:00:00Z',
      phone: '+90 555 300 3002',
    },
    {
      id: 'user-6',
      email: 'zeynep@aspectops.com',
      full_name: 'Zeynep Arslan',
      role: 'mudur',
      created_at: '2024-02-01T10:00:00Z',
      last_sign_in: null,
      phone: '+90 555 300 3003',
    },
    // 4 Operasyon
    {
      id: 'user-7',
      email: 'can@aspectops.com',
      full_name: 'Can Özdemir',
      role: 'operasyon',
      created_at: '2024-02-05T10:00:00Z',
      last_sign_in: '2024-03-05T10:00:00Z',
      phone: '+90 555 400 4001',
    },
    {
      id: 'user-8',
      email: 'elif@aspectops.com',
      full_name: 'Elif Çelik',
      role: 'operasyon',
      created_at: '2024-02-10T10:00:00Z',
      last_sign_in: '2024-03-05T06:30:00Z',
      phone: '+90 555 400 4002',
    },
    {
      id: 'user-9',
      email: 'burak@aspectops.com',
      full_name: 'Burak Aydın',
      role: 'operasyon',
      created_at: '2024-02-15T10:00:00Z',
      last_sign_in: '2024-03-03T14:20:00Z',
      phone: '+90 555 400 4003',
    },
    {
      id: 'user-10',
      email: 'selin@aspectops.com',
      full_name: 'Selin Kara',
      role: 'operasyon',
      created_at: '2024-02-20T10:00:00Z',
      last_sign_in: null,
      phone: '+90 555 400 4004',
    },
    // 10 Personel
    {
      id: 'user-11',
      email: 'emre@aspectops.com',
      full_name: 'Emre Yıldız',
      role: 'personel',
      created_at: '2024-02-25T10:00:00Z',
      last_sign_in: '2024-03-05T11:00:00Z',
      phone: '+90 555 500 5001',
    },
    {
      id: 'user-12',
      email: 'deniz@aspectops.com',
      full_name: 'Deniz Şen',
      role: 'personel',
      created_at: '2024-03-01T10:00:00Z',
      last_sign_in: '2024-03-05T09:45:00Z',
      phone: '+90 555 500 5002',
    },
    {
      id: 'user-13',
      email: 'ece@aspectops.com',
      full_name: 'Ece Polat',
      role: 'personel',
      created_at: '2024-03-01T11:00:00Z',
      last_sign_in: '2024-03-04T16:30:00Z',
      phone: '+90 555 500 5003',
    },
    {
      id: 'user-14',
      email: 'kerem@aspectops.com',
      full_name: 'Kerem Acar',
      role: 'personel',
      created_at: '2024-03-01T12:00:00Z',
      last_sign_in: '2024-03-05T08:00:00Z',
      phone: '+90 555 500 5004',
    },
    {
      id: 'user-15',
      email: 'merve@aspectops.com',
      full_name: 'Merve Koç',
      role: 'personel',
      created_at: '2024-03-01T13:00:00Z',
      last_sign_in: null,
      phone: '+90 555 500 5005',
    },
    {
      id: 'user-16',
      email: 'onur@aspectops.com',
      full_name: 'Onur Kurt',
      role: 'personel',
      created_at: '2024-03-01T14:00:00Z',
      last_sign_in: '2024-03-02T10:15:00Z',
      phone: '+90 555 500 5006',
    },
    {
      id: 'user-17',
      email: 'pelin@aspectops.com',
      full_name: 'Pelin Öztürk',
      role: 'personel',
      created_at: '2024-03-01T15:00:00Z',
      last_sign_in: '2024-03-05T12:30:00Z',
      phone: '+90 555 500 5007',
    },
    {
      id: 'user-18',
      email: 'cem@aspectops.com',
      full_name: 'Cem Aslan',
      role: 'personel',
      created_at: '2024-03-01T16:00:00Z',
      last_sign_in: '2024-03-04T19:00:00Z',
      phone: '+90 555 500 5008',
    },
    {
      id: 'user-19',
      email: 'damla@aspectops.com',
      full_name: 'Damla Güneş',
      role: 'personel',
      created_at: '2024-03-02T10:00:00Z',
      last_sign_in: null,
      phone: '+90 555 500 5009',
    },
    {
      id: 'user-20',
      email: 'berk@aspectops.com',
      full_name: 'Berk Eren',
      role: 'personel',
      created_at: '2024-03-02T11:00:00Z',
      last_sign_in: '2024-03-05T07:45:00Z',
      phone: '+90 555 500 5010',
    },
    // 1 İdari
    {
      id: 'user-21',
      email: 'seda@aspectops.com',
      full_name: 'Seda Öz',
      role: 'idari',
      created_at: '2024-02-28T10:00:00Z',
      last_sign_in: '2024-03-05T09:30:00Z',
      phone: '+90 555 600 6001',
    },
  ];

  const mockPendingUsers: UserData[] = [
    {
      id: 'pending-1',
      email: 'yeni1@aspectops.com',
      full_name: 'Hakan Tekin',
      role: 'bekleyen',
      created_at: '2024-03-04T14:00:00Z',
      last_sign_in: null,
      phone: '+90 555 700 7001',
    },
    {
      id: 'pending-2',
      email: 'yeni2@aspectops.com',
      full_name: 'Gizem Yalçın',
      role: 'bekleyen',
      created_at: '2024-03-04T15:30:00Z',
      last_sign_in: null,
      phone: '+90 555 700 7002',
    },
    {
      id: 'pending-3',
      email: 'yeni3@aspectops.com',
      full_name: 'Tolga Çakır',
      role: 'bekleyen',
      created_at: '2024-03-04T16:45:00Z',
      last_sign_in: null,
      phone: '+90 555 700 7003',
    },
    {
      id: 'pending-4',
      email: 'yeni4@aspectops.com',
      full_name: 'Derya Toprak',
      role: 'bekleyen',
      created_at: '2024-03-05T09:00:00Z',
      last_sign_in: null,
      phone: '+90 555 700 7004',
    },
    {
      id: 'pending-5',
      email: 'yeni5@aspectops.com',
      full_name: 'Kaan Bulut',
      role: 'bekleyen',
      created_at: '2024-03-05T10:20:00Z',
      last_sign_in: null,
      phone: '+90 555 700 7005',
    },
  ];

  // Load from LocalStorage
  useEffect(() => {
    const storedUsers = localStorage.getItem('aspect_users');
    const storedPending = localStorage.getItem('aspect_pending_users');

    if (storedUsers) {
      setUsers(JSON.parse(storedUsers));
    } else {
      setUsers(mockActiveUsers);
      localStorage.setItem('aspect_users', JSON.stringify(mockActiveUsers));
    }

    if (storedPending) {
      setPendingUsers(JSON.parse(storedPending));
    } else {
      setPendingUsers(mockPendingUsers);
      localStorage.setItem('aspect_pending_users', JSON.stringify(mockPendingUsers));
    }
  }, []);

  // Save to LocalStorage
  const saveUsers = (activeUsers: UserData[], pending: UserData[]) => {
    setUsers(activeUsers);
    setPendingUsers(pending);
    localStorage.setItem('aspect_users', JSON.stringify(activeUsers));
    localStorage.setItem('aspect_pending_users', JSON.stringify(pending));
  };

  // Permission check functions
  const canEditUser = (targetUser: UserData): boolean => {
    // Operasyon, İdari, Personel, Bekleyen: Sadece görüntüleme, düzenleme yapamaz
    if (currentUserRole === 'operasyon' || currentUserRole === 'idari' || 
        currentUserRole === 'personel' || currentUserRole === 'bekleyen') {
      return false;
    }

    // Can't edit yourself
    const currentUserEmail = getCurrentUserEmail();
    if (targetUser.email === currentUserEmail) {
      return false;
    }

    // Admin: Admin'ler hariç herkese müdahale edebilir
    if (currentUserRole === 'yonetici') {
      return targetUser.role !== 'yonetici';
    }

    // Üst Müdür: Admin ve Üst-Müdürler hariç herkese müdahale edebilir
    if (currentUserRole === 'ust-mudur') {
      return targetUser.role !== 'yonetici' && targetUser.role !== 'ust-mudur';
    }

    // Müdür: Admin, Üst-Müdür ve Müdürler hariç herkese müdahale edebilir
    if (currentUserRole === 'mudur') {
      return targetUser.role !== 'yonetici' && 
             targetUser.role !== 'ust-mudur' && 
             targetUser.role !== 'mudur';
    }

    return false;
  };

  const canDeleteUser = (targetUser: UserData): boolean => {
    if (currentUserRole === 'operasyon') return false;

    const currentUserEmail = getCurrentUserEmail();
    if (targetUser.email === currentUserEmail) {
      // Admin and Müdür can't delete themselves
      if (currentUserRole === 'yonetici' || currentUserRole === 'mudur') return false;
      // Üst Müdür can delete themselves
      if (currentUserRole === 'ust-mudur') return true;
    }

    // Same permissions as edit for others
    return canEditUser(targetUser);
  };

  const getAssignableRoles = (): UserRole[] => {
    if (currentUserRole === 'yonetici') {
      return ['ust-mudur', 'mudur', 'operasyon', 'personel', 'idari', 'bekleyen'];
    }
    if (currentUserRole === 'ust-mudur') {
      return ['mudur', 'operasyon', 'personel', 'idari', 'bekleyen'];
    }
    if (currentUserRole === 'mudur') {
      return ['operasyon', 'personel', 'idari', 'bekleyen'];
    }
    return [];
  };

  const getCurrentUserEmail = (): string => {
    const storedUser = localStorage.getItem('aspectUser');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        return user.email || '';
      } catch (error) {
        console.error('Error parsing user:', error);
      }
    }
    return '';
  };

  // Assign role
  const handleAssignRole = (userId: string, newRole: UserRole) => {
    // Check if from pending
    const pendingUser = pendingUsers.find(u => u.id === userId);
    
    if (pendingUser) {
      // Move from pending to active
      const updatedUser = { ...pendingUser, role: newRole };
      const newPending = pendingUsers.filter(u => u.id !== userId);
      const newActive = [...users, updatedUser];
      saveUsers(newActive, newPending);
      setSuccessMessage(`✅ ${pendingUser.full_name} başarıyla ${roleConfig[newRole].label} olarak atandı!`);
    } else {
      // Update existing user
      const newActive = users.map(u => 
        u.id === userId ? { ...u, role: newRole } : u
      );
      saveUsers(newActive, pendingUsers);
      
      const user = users.find(u => u.id === userId);
      if (user) {
        if (newRole === 'bekleyen') {
          // Move to pending
          const updatedUser = { ...user, role: 'bekleyen' };
          const newActiveFiltered = users.filter(u => u.id !== userId);
          const newPending = [...pendingUsers, updatedUser];
          saveUsers(newActiveFiltered, newPending);
          setSuccessMessage(`⏸️ ${user.full_name} bekleyen konumuna alındı`);
          setActiveTab('pending');
        } else {
          setSuccessMessage(`✅ ${user.full_name} başarıyla ${roleConfig[newRole].label} olarak güncellendi!`);
        }
      }
    }

    setEditingUserId(null);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // Delete user
  const handleDeleteUser = (userId: string, userEmail: string, userName: string) => {
    if (!confirm(`${userName} (${userEmail}) kullanıcısını silmek istediğinizden emin misiniz?`)) return;

    const newActive = users.filter(u => u.id !== userId);
    const newPending = pendingUsers.filter(u => u.id !== userId);
    saveUsers(newActive, newPending);

    setSuccessMessage(`🗑️ ${userName} silindi`);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // Toggle role expansion
  const toggleRoleExpansion = (role: UserRole) => {
    const newExpanded = new Set(expandedRoles);
    if (newExpanded.has(role)) {
      newExpanded.delete(role);
    } else {
      newExpanded.add(role);
    }
    setExpandedRoles(newExpanded);
  };

  // Format date
  const formatDate = (dateString: string, format: 'short' | 'long' = 'short') => {
    const date = new Date(dateString);
    
    if (format === 'short') {
      return date.toLocaleDateString('tr-TR', { 
        day: 'numeric', 
        month: 'short' 
      });
    }
    
    return date.toLocaleDateString('tr-TR', { 
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Group users by role
  const groupedUsers = (userList: UserData[]) => {
    const groups: Record<UserRole, UserData[]> = {
      yonetici: [],
      'ust-mudur': [],
      mudur: [],
      operasyon: [],
      personel: [],
      idari: [],
      bekleyen: [],
    };

    userList.forEach(user => {
      groups[user.role].push(user);
    });

    return groups;
  };

  // Filter staff list
  const getFilteredStaffList = () => {
    const sixHoursAgo = Date.now() - (6 * 60 * 60 * 1000);
    const allUsers = [...users, ...pendingUsers];

    switch (staffListFilter) {
      case 'only-active':
        return users;
      case 'only-pending':
        return pendingUsers;
      case 'signed-in':
        return allUsers.filter(u => u.last_sign_in);
      case 'not-signed-in':
        return allUsers.filter(u => 
          !u.last_sign_in || new Date(u.last_sign_in).getTime() < sixHoursAgo
        );
      default:
        return allUsers;
    }
  };

  const groupedActiveUsers = groupedUsers(users);
  const filteredStaffList = getFilteredStaffList();
  const groupedStaffList = groupedUsers(filteredStaffList);

  return (
    <div className="pb-20 bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] min-h-screen">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => onNavigate('resource-management')}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 border-2 border-white/20 hover:bg-white/20 transition-all active:scale-95"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-3xl font-bold text-white">Kullanıcı Yönetimi</h1>
          <span className="text-3xl">👥</span>
        </div>
        <p className="text-sm text-gray-400 ml-[52px]">Personel ve yöneticileri yönetin</p>
      </div>

      <div className="px-6 space-y-4">
        {/* Success Message */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 p-4 bg-green-500/20 border-2 border-green-500/30 rounded-xl"
            >
              <CheckCircle className="w-5 h-5 text-green-300" />
              <span className="text-white font-semibold">{successMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab Buttons */}
        <div className="space-y-3">
          {/* Active Users Tab */}
          <button
            onClick={() => setActiveTab('active')}
            className={`w-full p-4 rounded-xl border-2 transition-all ${
              activeTab === 'active'
                ? 'bg-gradient-to-br from-[#9dd9ea]/30 to-[#7ec8dd]/20 border-[#9dd9ea]/50'
                : 'bg-white/5 border-white/20 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserCheck className="w-5 h-5 text-[#9dd9ea]" />
                <span className="text-white font-semibold">Aktif Kullanıcılar</span>
              </div>
              <span className="text-2xl font-bold text-white">{users.length}</span>
            </div>
          </button>

          {/* Pending Users Tab - Hide for Operasyon, İdari, Personel, Bekleyen */}
          {currentUserRole !== 'operasyon' && 
           currentUserRole !== 'idari' && 
           currentUserRole !== 'personel' && 
           currentUserRole !== 'bekleyen' && (
            <button
              onClick={() => setActiveTab('pending')}
              className={`w-full p-4 rounded-xl border-2 transition-all ${
                activeTab === 'pending'
                  ? 'bg-gradient-to-br from-orange-500/30 to-orange-600/20 border-orange-500/50'
                  : 'bg-white/5 border-white/20 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-orange-400" />
                  <span className="text-white font-semibold">Bekleyen Kullanıcılar</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-white">{pendingUsers.length}</span>
                  {pendingUsers.length > 0 && (
                    <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center animate-pulse">
                      <span className="text-white text-xs font-bold">!</span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          )}

          {/* Staff List Tab - Hide for Operasyon, İdari, Personel, Bekleyen */}
          {currentUserRole !== 'operasyon' && 
           currentUserRole !== 'idari' && 
           currentUserRole !== 'personel' && 
           currentUserRole !== 'bekleyen' && (
            <button
              onClick={() => setActiveTab('staff-list')}
              className={`w-full p-4 rounded-xl border-2 transition-all ${
                activeTab === 'staff-list'
                  ? 'bg-gradient-to-br from-purple-500/30 to-purple-600/20 border-purple-500/50'
                  : 'bg-white/5 border-white/20 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <List className="w-5 h-5 text-purple-400" />
                  <span className="text-white font-semibold">Personel Listesi</span>
                </div>
                <span className="text-2xl font-bold text-white">{users.length + pendingUsers.length}</span>
              </div>
            </button>
          )}
        </div>

        {/* Tab Content */}
        {activeTab === 'active' && (
          <div className="space-y-4">
            {/* Role Groups */}
            {(Object.keys(groupedActiveUsers) as UserRole[])
              .filter(role => role !== 'bekleyen' && groupedActiveUsers[role].length > 0)
              .map((role) => {
                const config = roleConfig[role];
                const IconComponent = config.icon;
                const roleUsers = groupedActiveUsers[role];

                return (
                  <div
                    key={role}
                    className={`backdrop-blur-xl bg-gradient-to-br ${config.bg} border-2 border-white/20 rounded-2xl p-5`}
                  >
                    {/* Role Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center border-2"
                        style={{ backgroundColor: config.color, borderColor: config.color }}
                      >
                        <IconComponent className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className={`font-bold ${config.text}`}>{config.label}</h3>
                        <p className="text-xs text-gray-400">{roleUsers.length} kullanıcı</p>
                      </div>
                    </div>

                    {/* Users */}
                    <div className="space-y-3">
                      {roleUsers.map((user) => {
                        const isCurrentUser = user.email === getCurrentUserEmail();
                        const canEdit = canEditUser(user);
                        const canDelete = canDeleteUser(user);
                        const isEditing = editingUserId === user.id;

                        return (
                          <div
                            key={user.id}
                            className="bg-black/30 border-2 border-white/10 rounded-xl p-4"
                          >
                            <div className="flex items-start justify-between">
                              {/* User Info */}
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-bold text-white">{user.full_name}</h4>
                                  {isCurrentUser && (
                                    <span className="px-2 py-1 bg-pink-500/30 border border-pink-400/50 rounded text-xs text-pink-200 font-semibold">
                                      Siz
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-400 mb-2">{user.email}</p>
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                  <span>Kayıt: {formatDate(user.created_at)}</span>
                                  {user.last_sign_in && (
                                    <span className="text-green-400">
                                      Son giriş: {formatDate(user.last_sign_in)}
                                    </span>
                                  )}
                                  {!user.last_sign_in && (
                                    <span className="text-gray-500">Hiç giriş yapmadı</span>
                                  )}
                                </div>
                              </div>

                              {/* Action Buttons */}
                              {currentUserRole !== 'operasyon' && (
                                <div className="flex gap-2 flex-shrink-0 ml-3">
                                  {canEdit && (
                                    <button
                                      onClick={() => setEditingUserId(isEditing ? null : user.id)}
                                      className={`p-2 rounded-lg transition-all ${
                                        isEditing
                                          ? 'bg-gray-600/60 border-2 border-gray-500/50'
                                          : 'bg-blue-600/60 border-2 border-blue-500/50 hover:scale-110'
                                      }`}
                                    >
                                      {isEditing ? (
                                        <X className="w-4 h-4 text-white" />
                                      ) : (
                                        <Edit2 className="w-4 h-4 text-white" />
                                      )}
                                    </button>
                                  )}
                                  {canDelete && (
                                    <button
                                      onClick={() => handleDeleteUser(user.id, user.email, user.full_name)}
                                      className="p-2 bg-red-600/60 border-2 border-red-500/50 rounded-lg hover:scale-110 transition-all"
                                    >
                                      <Trash2 className="w-4 h-4 text-white" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Role Assignment Buttons */}
                            {isEditing && currentUserRole !== 'operasyon' && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="mt-4 pt-4 border-t border-white/10"
                              >
                                <p className="text-xs text-gray-400 mb-3">Rol ata:</p>
                                <div className="grid grid-cols-3 gap-2">
                                  {getAssignableRoles().map((assignRole) => {
                                    const assignConfig = roleConfig[assignRole];
                                    return (
                                      <button
                                        key={assignRole}
                                        onClick={() => handleAssignRole(user.id, assignRole)}
                                        className="px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                                        style={{
                                          backgroundColor: `${assignConfig.color}40`,
                                          borderWidth: '2px',
                                          borderColor: `${assignConfig.color}80`,
                                          color: assignConfig.color,
                                        }}
                                      >
                                        {assignConfig.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* Pending Users Content */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            {pendingUsers.map((user) => {
              const canEdit = canEditUser(user);
              const canDelete = canDeleteUser(user);
              const isEditing = editingUserId === user.id;

              return (
                <div
                  key={user.id}
                  className="backdrop-blur-xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 border-2 border-orange-500/40 rounded-2xl p-5"
                >
                  <div className="flex items-start gap-4">
                    {/* User Icon */}
                    <div className="w-16 h-16 rounded-2xl bg-orange-600/40 border-2 border-orange-500/50 flex items-center justify-center text-3xl flex-shrink-0">
                      👤
                    </div>

                    {/* User Info */}
                    <div className="flex-1">
                      <h4 className="font-bold text-white text-lg mb-1">{user.full_name}</h4>
                      <p className="text-sm text-gray-300 mb-1">{user.email}</p>
                      {user.phone && (
                        <p className="text-sm text-gray-400 mb-2">📱 {user.phone}</p>
                      )}
                      <p className="text-xs text-orange-300">
                        ⏰ Kayıt: {formatDate(user.created_at, 'long')}
                      </p>
                    </div>
                  </div>

                  {/* Assignment Buttons */}
                  {currentUserRole !== 'operasyon' && canEdit && (
                    <div className="mt-4 pt-4 border-t border-orange-500/30">
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        {getAssignableRoles()
                          .filter(r => r !== 'bekleyen')
                          .map((assignRole) => {
                            const assignConfig = roleConfig[assignRole];
                            return (
                              <button
                                key={assignRole}
                                onClick={() => handleAssignRole(user.id, assignRole)}
                                className="px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:scale-105"
                                style={{
                                  backgroundColor: `${assignConfig.color}40`,
                                  borderWidth: '2px',
                                  borderColor: `${assignConfig.color}80`,
                                  color: assignConfig.color,
                                }}
                              >
                                {assignConfig.label}
                              </button>
                            );
                          })}
                      </div>
                      
                      {/* Delete Button */}
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteUser(user.id, user.email, user.full_name)}
                          className="w-full mt-2 px-4 py-2 bg-red-600/60 border-2 border-red-500/50 rounded-lg text-white text-sm font-semibold hover:scale-105 transition-all"
                        >
                          🗑️ Kullanıcıyı Sil
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {pendingUsers.length === 0 && (
              <div className="text-center py-12">
                <UserPlus className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">Bekleyen kullanıcı yok</p>
              </div>
            )}
          </div>
        )}

        {/* Staff List Content */}
        {activeTab === 'staff-list' && (
          <div className="space-y-4">
            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setStaffListFilter('all')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  staffListFilter === 'all'
                    ? 'bg-[#9dd9ea]/30 border-2 border-[#9dd9ea]/50 text-white'
                    : 'bg-white/10 border-2 border-white/20 text-gray-400 hover:bg-white/20'
                }`}
              >
                🌐 Tümü ({users.length + pendingUsers.length})
              </button>
              <button
                onClick={() => setStaffListFilter('only-active')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  staffListFilter === 'only-active'
                    ? 'bg-[#9dd9ea]/30 border-2 border-[#9dd9ea]/50 text-white'
                    : 'bg-white/10 border-2 border-white/20 text-gray-400 hover:bg-white/20'
                }`}
              >
                ✅ Aktifler ({users.length})
              </button>
              <button
                onClick={() => setStaffListFilter('only-pending')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  staffListFilter === 'only-pending'
                    ? 'bg-[#9dd9ea]/30 border-2 border-[#9dd9ea]/50 text-white'
                    : 'bg-white/10 border-2 border-white/20 text-gray-400 hover:bg-white/20'
                }`}
              >
                ⏳ Bekleyenler ({pendingUsers.length})
              </button>
              <button
                onClick={() => setStaffListFilter('signed-in')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  staffListFilter === 'signed-in'
                    ? 'bg-[#9dd9ea]/30 border-2 border-[#9dd9ea]/50 text-white'
                    : 'bg-white/10 border-2 border-white/20 text-gray-400 hover:bg-white/20'
                }`}
              >
                🟢 Giriş Yapmış
              </button>
              <button
                onClick={() => setStaffListFilter('not-signed-in')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  staffListFilter === 'not-signed-in'
                    ? 'bg-[#9dd9ea]/30 border-2 border-[#9dd9ea]/50 text-white'
                    : 'bg-white/10 border-2 border-white/20 text-gray-400 hover:bg-white/20'
                }`}
              >
                ⚫ Son 6 Saat Giriş Yapmayan
              </button>
            </div>

            {/* Collapsible Role Groups */}
            <div className="space-y-3">
              {(Object.keys(groupedStaffList) as UserRole[])
                .filter(role => groupedStaffList[role].length > 0)
                .map((role) => {
                  const config = roleConfig[role];
                  const IconComponent = config.icon;
                  const roleUsers = groupedStaffList[role];
                  const isExpanded = expandedRoles.has(role);

                  return (
                    <div
                      key={role}
                      className="backdrop-blur-xl bg-white/5 border-2 border-white/20 rounded-2xl overflow-hidden"
                    >
                      {/* Header - Clickable */}
                      <button
                        onClick={() => toggleRoleExpansion(role)}
                        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: config.color }}
                          >
                            <IconComponent className="w-5 h-5 text-white" />
                          </div>
                          <div className="text-left">
                            <h4 className={`font-bold ${config.text}`}>{config.label}</h4>
                            <p className="text-xs text-gray-400">{roleUsers.length} kişi</p>
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-400" />
                        )}
                      </button>

                      {/* Content - Collapsible */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <div className="px-4 pb-4 space-y-2">
                              {roleUsers.map((user, index) => (
                                <div
                                  key={user.id}
                                  className="bg-black/30 rounded-lg p-3"
                                >
                                  <div className="flex items-start gap-3">
                                    <span className="text-gray-500 font-bold text-sm mt-0.5">
                                      {index + 1}
                                    </span>
                                    <div className="flex-1">
                                      <h5 className="font-bold text-white text-sm">
                                        {user.full_name}
                                      </h5>
                                      <p className="text-xs text-gray-400">{user.email}</p>
                                      {user.last_sign_in ? (
                                        <p className="text-xs text-green-400 mt-1">
                                          🟢 {formatDate(user.last_sign_in, 'long')}
                                        </p>
                                      ) : (
                                        <p className="text-xs text-gray-500 mt-1">
                                          ⚫ Hiç giriş yapmadı
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="mt-6 mb-6">
          <div className="backdrop-blur-xl bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">ℹ️</span>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-white mb-2">👥 Kullanıcı Yönetimi ve Yetki Sistemi</h4>
                <p className="text-sm text-gray-400 mb-3">
                  Herkes kullanıcı listesini görebilir ve aktif kullanıcıları inceleyebilir. 
                  Düzenleme ve silme yetkileri rol bazlıdır.
                </p>
                <div className="space-y-2">
                  <p className="text-sm text-gray-400">
                    <span className="text-red-300 font-medium">🛡️ Admin (Yönetici):</span> Admin'ler hariç herkese müdahale edebilir.
                  </p>
                  <p className="text-sm text-gray-400">
                    <span className="text-indigo-300 font-medium">👤 Üst-Müdür:</span> Admin ve Üst-Müdürler hariç herkese müdahale edebilir.
                  </p>
                  <p className="text-sm text-gray-400">
                    <span className="text-purple-300 font-medium">👥 Müdür:</span> Admin, Üst-Müdür ve Müdürler hariç herkese müdahale edebilir.
                  </p>
                  <p className="text-sm text-gray-400">
                    <span className="text-gray-300 font-medium">👁️ Diğerleri (Operasyon, İdari, Personel, Bekleyen):</span> Sadece görüntüleme yetkisi vardır.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}