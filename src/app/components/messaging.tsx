import { useState } from 'react';
import { Send, Hash, User, ArrowLeft, Smile, Paperclip, Trash2 } from 'lucide-react';
import { StaffTopBar } from './staff-top-bar';
import { NewBottomNav } from './new-bottom-nav';

interface Channel {
  id: string;
  name: string;
  type: 'channel' | 'dm' | 'project';
  unread: number;
  lastMessage: string;
  timestamp: string;
  avatar?: string;
  isAdminOnly?: boolean;
}

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  isOwn: boolean;
  avatar: string;
  isSalesLog?: boolean;
}

interface MessagingProps {
  currentUser: string;
  userRole: 'admin' | 'staff';
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export function Messaging({ currentUser, userRole, onLogout, onNavigate }: MessagingProps) {
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [teamMessage, setTeamMessage] = useState('');
  const [dmMessages, setDmMessages] = useState<Record<string, Message[]>>({});
  const [deletedChannels, setDeletedChannels] = useState<string[]>([]);

  const channels: Channel[] = [
    {
      id: 'general',
      name: 'general',
      type: 'channel',
      unread: 3,
      lastMessage: 'Bugün çok iyi satış yapıyoruz!',
      timestamp: '10:24',
      isAdminOnly: false,
    },
    {
      id: 'rotasyon',
      name: 'rotasyon',
      type: 'channel',
      unread: 1,
      lastMessage: '📋 Günlük rotasyon planı yayınlandı',
      timestamp: '09:00',
      isAdminOnly: true,
    },
    {
      id: 'project-zoka',
      name: 'zoka',
      type: 'project',
      unread: 5,
      lastMessage: '🎯 Mehmet Kaya - 14:30 • 5\'li Albüm (1000 TL)',
      timestamp: '14:30',
      isAdminOnly: true,
    },
    {
      id: 'project-balikhali',
      name: 'balikhali',
      type: 'project',
      unread: 2,
      lastMessage: '📸 Ayşe Demir - 13:15 • 3\'lü Albüm + Paspartu (800 TL)',
      timestamp: '13:15',
      isAdminOnly: true,
    },
    {
      id: 'project-hayalkahvesi',
      name: 'hayalkahvesi',
      type: 'project',
      unread: 0,
      lastMessage: '🎯 Fatma Öz - 12:00 • 7\'li Albüm (1400 TL)',
      timestamp: 'Dün',
      isAdminOnly: true,
    },
    {
      id: 'dm-ahmet',
      name: 'Ahmet Yılmaz',
      type: 'dm',
      unread: 2,
      lastMessage: 'Raporu paylaştım',
      timestamp: '11:15',
      avatar: '👨‍💼',
      isAdminOnly: false,
    },
    {
      id: 'dm-mehmet',
      name: 'Mehmet Kaya',
      type: 'dm',
      unread: 0,
      lastMessage: 'Tamam, teşekkürler',
      timestamp: '08:30',
      avatar: '👨',
      isAdminOnly: false,
    },
  ];

  const getMessagesForChannel = (channelId: string): Message[] => {
    // Rotasyon channel - load from localStorage
    if (channelId === 'rotasyon') {
      const storedMessages = JSON.parse(localStorage.getItem('messages') || '{}');
      const rotasyonMessages = storedMessages['rotasyon'] || [];
      
      return rotasyonMessages.map((msg: any) => ({
        id: msg.id,
        sender: msg.sender,
        content: msg.text,
        timestamp: msg.timestamp,
        isOwn: false,
        avatar: '📋',
        isSalesLog: true,
      }));
    }
    
    // DM channels - load from state or use defaults
    if (channelId.startsWith('dm-')) {
      if (dmMessages[channelId]) {
        return dmMessages[channelId];
      }
      
      // Default DM messages
      if (channelId === 'dm-ahmet') {
        return [
          {
            id: 'dm-ahmet-1',
            sender: 'Ahmet Yılmaz',
            content: 'Merhaba! Bugünkü satışları nasıl buluyorsun?',
            timestamp: '10:30',
            isOwn: false,
            avatar: '👨‍💼',
          },
          {
            id: 'dm-ahmet-2',
            sender: currentUser,
            content: 'Harika gidiyor! 5 satış yaptım şimdiye kadar',
            timestamp: '10:32',
            isOwn: true,
            avatar: '👤',
          },
          {
            id: 'dm-ahmet-3',
            sender: 'Ahmet Yılmaz',
            content: 'Raporu paylaştım',
            timestamp: '11:15',
            isOwn: false,
            avatar: '👨‍💼',
          },
        ];
      }
      
      if (channelId === 'dm-mehmet') {
        return [
          {
            id: 'dm-mehmet-1',
            sender: currentUser,
            content: 'Mehmet, yazıcı kağıdı bitmiş mi kontrol eder misin?',
            timestamp: '08:15',
            isOwn: true,
            avatar: '👤',
          },
          {
            id: 'dm-mehmet-2',
            sender: 'Mehmet Kaya',
            content: 'Tamam, teşekkürler',
            timestamp: '08:30',
            isOwn: false,
            avatar: '👨',
          },
        ];
      }
      
      return [];
    }
    
    // Project channel messages (Sales logs)
    if (channelId === 'project-zoka') {
      return [
        {
          id: 'z1',
          sender: 'SATIŞ SİSTEMİ',
          content: '🎯 Mehmet Kaya - 09:30\n5\'li Albüm (1000 TL)\nToplam: 1000 TL',
          timestamp: '09:30',
          isOwn: false,
          avatar: '💰',
          isSalesLog: true,
        },
        {
          id: 'z2',
          sender: 'SATIŞ SİSTEMİ',
          content: '📸 Ayşe Demir - 10:15\n3\'lü Albüm (600 TL) + Paspartu (200 TL)\n%10 İskonto (-80 TL)\nToplam: 720 TL',
          timestamp: '10:15',
          isOwn: false,
          avatar: '💰',
          isSalesLog: true,
        },
        {
          id: 'z3',
          sender: 'SATIŞ SİSTEMİ',
          content: '🎯 Mehmet Kaya - 11:45\n7\'li Albüm (1400 TL)\nToplam: 1400 TL',
          timestamp: '11:45',
          isOwn: false,
          avatar: '💰',
          isSalesLog: true,
        },
        {
          id: 'z4',
          sender: 'SATIŞ SİSTEMİ',
          content: '📸 Fatma Öz - 13:20\n5\'li Albüm (1000 TL)\n%15 İskonto (-150 TL)\nToplam: 850 TL',
          timestamp: '13:20',
          isOwn: false,
          avatar: '💰',
          isSalesLog: true,
        },
        {
          id: 'z5',
          sender: 'SATIŞ SİSTEMİ',
          content: '🎯 Mehmet Kaya - 14:30\n5\'li Albüm (1000 TL)\nToplam: 1000 TL',
          timestamp: '14:30',
          isOwn: false,
          avatar: '💰',
          isSalesLog: true,
        },
      ];
    }
    
    if (channelId === 'project-balikhali') {
      return [
        {
          id: 'b1',
          sender: 'SATIŞ SİSTEMİ',
          content: '📸 Ali Veli - 09:00\n3\'lü Albüm (600 TL)\nToplam: 600 TL',
          timestamp: '09:00',
          isOwn: false,
          avatar: '💰',
          isSalesLog: true,
        },
        {
          id: 'b2',
          sender: 'SATIŞ SİSTEMİ',
          content: '🎯 Ayşe Demir - 13:15\n3\'lü Albüm (600 TL) + Paspartu (200 TL)\nToplam: 800 TL',
          timestamp: '13:15',
          isOwn: false,
          avatar: '💰',
          isSalesLog: true,
        },
      ];
    }

    if (channelId === 'project-hayalkahvesi') {
      return [
        {
          id: 'h1',
          sender: 'SATIŞ SİSTEMİ',
          content: '🎯 Fatma Öz - 12:00\n7\'li Albüm (1400 TL)\nToplam: 1400 TL',
          timestamp: '12:00',
          isOwn: false,
          avatar: '💰',
          isSalesLog: true,
        },
      ];
    }

    // Default general channel messages
    return [
      {
        id: '1',
        sender: 'Ahmet Yılmaz',
        content: 'Günaydın ekip! Bugün harika bir gün olacak 🌞',
        timestamp: '08:15',
        isOwn: false,
        avatar: '👨‍💼',
      },
      {
        id: '2',
        sender: 'Mehmet Kaya',
        content: 'Günaydın! ZOKA lokasyonunda hazırız',
        timestamp: '08:18',
        isOwn: false,
        avatar: '👨',
      },
      {
        id: '3',
        sender: currentUser,
        content: 'Harika! Balık Halinde de her şey hazır',
        timestamp: '08:20',
        isOwn: true,
        avatar: '👤',
      },
      {
        id: '4',
        sender: 'Ayşe Demir',
        content: 'Yazıcı kontrollerini yaptım, sorun yok 👍',
        timestamp: '08:25',
        isOwn: false,
        avatar: '👩',
      },
      {
        id: '5',
        sender: currentUser,
        content: 'Mükemmel! İlk satışlar gelmeye başladı',
        timestamp: '10:24',
        isOwn: true,
        avatar: '👤',
      },
    ];
  };

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    setMessageInput('');
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!selectedChannel || !currentChannel?.type) return;
    
    // Only allow deletion in DM channels
    if (currentChannel.type === 'dm') {
      const currentMessages = getMessagesForChannel(selectedChannel);
      const updatedMessages = currentMessages.filter(msg => msg.id !== messageId);
      setDmMessages({
        ...dmMessages,
        [selectedChannel]: updatedMessages
      });
    }
  };

  const handleDeleteConversation = (channelId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent channel selection
    setDeletedChannels([...deletedChannels, channelId]);
  };

  if (!selectedChannel) {
    return (
      <div className="pb-20 bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] min-h-screen">
        {/* Sticky Top Bar */}
        {userRole === 'staff' && (
          <StaffTopBar
            userName={currentUser}
            userRole={userRole}
            onLogout={onLogout}
            onNavigate={onNavigate}
            onBack={() => onNavigate('home')}
            showBackButton={true}
          />
        )}

        {/* Channels Section */}
        <div className="px-6 pt-6 mb-6">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Hash className="w-4 h-4" />
            Kanallar
          </h3>
          <div className="space-y-2">
            {channels
              .filter((c) => c.type === 'channel')
              .map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => setSelectedChannel(channel.id)}
                  className="w-full backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4 hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] flex items-center justify-center">
                      <Hash className="w-6 h-6 text-[#2d3748]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-white">#{channel.name}</span>
                        <span className="text-xs text-gray-400">{channel.timestamp}</span>
                      </div>
                      <p className="text-sm text-gray-400 truncate">{channel.lastMessage}</p>
                    </div>
                    {channel.unread > 0 && (
                      <div className="w-6 h-6 rounded-full bg-[#9dd9ea] text-[#2d3748] text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {channel.unread}
                      </div>
                    )}
                  </div>
                </button>
              ))}
          </div>
        </div>

        {/* Project Channels Section - Admin Only */}
        {userRole === 'admin' && (
          <div className="px-6 mb-6">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Hash className="w-4 h-4" />
              Mekan Kanalları
              <span className="ml-auto text-xs bg-[#ffd4a3]/20 text-[#ffd4a3] px-2 py-1 rounded-lg">Sadece Yönetici</span>
            </h3>
            <div className="space-y-2">
              {channels
                .filter((c) => c.type === 'project')
                .map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => setSelectedChannel(channel.id)}
                    className="w-full backdrop-blur-xl bg-gradient-to-br from-[#ffd4a3]/10 to-[#ffc78f]/5 border border-[#ffd4a3]/30 rounded-2xl p-4 hover:shadow-md transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f] flex items-center justify-center">
                        <Hash className="w-6 h-6 text-[#744210]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-white">#{channel.name}</span>
                          <span className="text-xs text-gray-400">{channel.timestamp}</span>
                        </div>
                        <p className="text-xs text-gray-400 truncate">{channel.lastMessage}</p>
                      </div>
                      {channel.unread > 0 && (
                        <div className="w-6 h-6 rounded-full bg-[#ffd4a3] text-[#744210] text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {channel.unread}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Direct Messages Section */}
        <div className="px-6 pb-6">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <User className="w-4 h-4" />
            Direkt Mesajlar
          </h3>
          <div className="space-y-2">
            {channels
              .filter((c) => c.type === 'dm' && !deletedChannels.includes(c.id))
              .map((channel) => (
                <div
                  key={channel.id}
                  className="relative w-full backdrop-blur-xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4 hover:shadow-md transition-all"
                >
                  <button
                    onClick={() => setSelectedChannel(channel.id)}
                    className="w-full text-left pr-12"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] flex items-center justify-center text-2xl border-2 border-white shadow">
                        {channel.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-white">{channel.name}</span>
                          <span className="text-xs text-gray-400">{channel.timestamp}</span>
                        </div>
                        <p className="text-sm text-gray-400 truncate">{channel.lastMessage}</p>
                      </div>
                      {channel.unread > 0 && (
                        <div className="w-6 h-6 rounded-full bg-[#9dd9ea] text-[#2d3748] text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {channel.unread}
                        </div>
                      )}
                    </div>
                  </button>
                  {/* Delete conversation button - Always visible */}
                  <button
                    onClick={(e) => handleDeleteConversation(channel.id, e)}
                    className="absolute top-1/2 -translate-y-1/2 right-3 w-9 h-9 rounded-xl bg-red-500/80 hover:bg-red-600 flex items-center justify-center transition-all active:scale-90"
                    title="Konuşmayı sil"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                </div>
              ))}
          </div>
          
          {/* Personel Listesi Button - Both Admin and Staff */}
          <button
            onClick={() => setShowTeamModal(true)}
            className="w-full mt-4 backdrop-blur-xl bg-gradient-to-br from-[#ffd4a3]/20 to-[#ffc78f]/10 border border-[#ffd4a3]/30 rounded-2xl p-4 hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-center gap-2">
              <User className="w-5 h-5 text-[#ffd4a3]" />
              <span className="font-bold text-[#ffd4a3]">Personel Listesi</span>
            </div>
          </button>
        </div>

        {/* Team Modal - Both Admin and Staff */}
        {showTeamModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-gradient-to-br from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] rounded-3xl border border-white/20 shadow-2xl max-w-md w-full max-h-[75vh] flex flex-col">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-white/10 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <User className="w-6 h-6 text-[#9dd9ea]" />
                    Personel Listesi
                  </h2>
                  <button
                    onClick={() => {
                      setShowTeamModal(false);
                      setSelectedStaff([]);
                      setTeamMessage('');
                    }}
                    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
                  >
                    <span className="text-white text-xl">×</span>
                  </button>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  {selectedStaff.length > 0 ? `${selectedStaff.length} personel seçildi` : 'Mesaj göndermek için personel seçin'}
                </p>
              </div>

              {/* Staff List */}
              <div className="flex-1 overflow-y-auto px-6 py-3 min-h-0">
                <div className="space-y-2">
                  {[
                    'Ahmet Yılmaz',
                    'Ayşe Demir',
                    'Fatma Öz',
                    'Mehmet Kaya',
                    'Zeynep Şahin',
                    'Ali Veli',
                    'Can Yücel',
                    'Deniz Kara',
                    'Elif Ak',
                    'Hasan Çelik',
                    'İrem Yıldız',
                    'Kemal Aydın',
                  ].map((staff) => {
                    const isSelected = selectedStaff.includes(staff);
                    return (
                      <button
                        key={staff}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedStaff(selectedStaff.filter(s => s !== staff));
                          } else {
                            setSelectedStaff([...selectedStaff, staff]);
                          }
                        }}
                        className={`w-full backdrop-blur-xl rounded-xl p-3 transition-all border ${
                          isSelected
                            ? 'bg-gradient-to-br from-[#9dd9ea]/20 to-[#7ec8dd]/10 border-[#9dd9ea]/40'
                            : 'bg-white/5 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                            isSelected 
                              ? 'bg-[#9dd9ea] border-[#9dd9ea]'
                              : 'border-white/30'
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-[#2d3748]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className={`font-semibold ${isSelected ? 'text-[#9dd9ea]' : 'text-white'}`}>
                            {staff}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Message Input */}
              <div className="px-6 py-3 border-t border-white/10 flex-shrink-0">
                <textarea
                  value={teamMessage}
                  onChange={(e) => setTeamMessage(e.target.value)}
                  placeholder="Mesajınızı yazın..."
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white placeholder:text-gray-400 focus:outline-none focus:border-[#9dd9ea] transition-all resize-none mb-2"
                  rows={2}
                />
                <button
                  onClick={() => {
                    if (selectedStaff.length > 0 && teamMessage.trim()) {
                      alert(`Mesaj ${selectedStaff.length} personele gönderildi!`);
                      setShowTeamModal(false);
                      setSelectedStaff([]);
                      setTeamMessage('');
                    }
                  }}
                  disabled={selectedStaff.length === 0 || !teamMessage.trim()}
                  className="w-full py-3 bg-gradient-to-r from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] rounded-xl font-bold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  Mesaj Gönder
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Navigation - Only for staff */}
        {userRole === 'staff' && (
          <NewBottomNav
            activeTab="messaging"
            onTabChange={onNavigate}
            userRole={userRole}
          />
        )}
      </div>
    );
  }

  const currentChannel = channels.find((c) => c.id === selectedChannel);
  const messages = getMessagesForChannel(selectedChannel || '');

  return (
    <div className="flex flex-col h-screen">
      {/* Chat Header */}
      <div className="px-6 py-4 backdrop-blur-xl bg-white/10 border-b border-white/20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedChannel(null)}
            className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            {currentChannel?.type === 'channel' || currentChannel?.type === 'project' ? (
              <>
                <div className="font-semibold text-white flex items-center gap-2">
                  <Hash className="w-4 h-4" />#{currentChannel.name}
                </div>
                <div className="text-xs text-gray-400">
                  {currentChannel.type === 'project' ? 'Mekan Satış Logları' : 'Ekip kanalı'}
                </div>
              </>
            ) : (
              <>
                <div className="font-semibold text-white">{currentChannel?.name}</div>
                <div className="text-xs text-[#a8e6cf] flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-[#a8e6cf]"></div>
                  Çevrimiçi
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-gradient-to-br from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439]">
        {messages.map((message) => (
          <div key={message.id} className={`group flex gap-3 ${message.isOwn ? 'flex-row-reverse' : ''}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] flex items-center justify-center text-xl flex-shrink-0 border-2 border-white shadow">
              {message.avatar}
            </div>
            <div className={`flex-1 max-w-[75%] ${message.isOwn ? 'flex flex-col items-end' : ''}`}>
              {!message.isOwn && !message.isSalesLog && (
                <div className="text-xs font-semibold text-white mb-1">{message.sender}</div>
              )}
              <div className="relative">
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    message.isSalesLog
                      ? 'bg-gradient-to-br from-[#ffd4a3]/20 to-[#ffc78f]/10 border border-[#ffd4a3]/30 text-white'
                      : message.isOwn
                      ? 'bg-gradient-to-r from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748]'
                      : 'bg-white/10 backdrop-blur-sm border border-white/20 text-white'
                  }`}
                >
                  <p className="text-sm whitespace-pre-line">{message.content}</p>
                </div>
                {/* Delete button - Only show for DM messages */}
                {currentChannel?.type === 'dm' && (
                  <button
                    onClick={() => handleDeleteMessage(message.id)}
                    className={`absolute top-1 ${message.isOwn ? 'left-1' : 'right-1'} opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-lg bg-red-500/80 hover:bg-red-600 flex items-center justify-center`}
                    title="Mesajı sil"
                  >
                    <Trash2 className="w-3 h-3 text-white" />
                  </button>
                )}
              </div>
              <div className="text-xs text-gray-400 mt-1">{message.timestamp}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Message Input */}
      {currentChannel?.type !== 'project' && !(currentChannel?.id === 'rotasyon' && userRole === 'staff') && (
        <div className="px-6 py-4 bg-gradient-to-br from-[#2a2a3a] to-[#3a3a4e] border-t border-white/10">
          <div className="flex gap-2">
            <button className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center hover:bg-accent transition-all">
              <Paperclip className="w-5 h-5 text-muted-foreground" />
            </button>
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Mesaj yaz..."
              className="flex-1 px-4 py-3 bg-muted border-2 border-transparent rounded-2xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:bg-white transition-all"
            />
            <button className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center hover:bg-accent transition-all">
              <Smile className="w-5 h-5 text-muted-foreground" />
            </button>
            <button
              onClick={handleSendMessage}
              disabled={!messageInput.trim()}
              className="px-6 py-3 bg-gradient-to-r from-primary to-[#a7c7e7] text-primary-foreground rounded-2xl font-semibold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Read-only notice for rotasyon channel for staff */}
      {currentChannel?.id === 'rotasyon' && userRole === 'staff' && (
        <div className="px-6 py-3 bg-gradient-to-br from-[#2a2a3a] to-[#3a3a4e] border-t border-white/10">
          <div className="backdrop-blur-xl bg-[#9dd9ea]/10 border border-[#9dd9ea]/30 rounded-xl p-3 flex items-center justify-center gap-2">
            <span className="text-2xl">🔒</span>
            <span className="text-sm text-gray-300">Bu kanal sadece yöneticiler tarafından yönetilir - salt okunur</span>
          </div>
        </div>
      )}

      {/* Read-only notice for project channels */}
      {currentChannel?.type === 'project' && (
        <div className="px-6 py-3 bg-gradient-to-br from-[#2a2a3a] to-[#3a3a4e] border-t border-white/10">
          <div className="backdrop-blur-xl bg-[#ffd4a3]/10 border border-[#ffd4a3]/30 rounded-xl p-3 flex items-center justify-center gap-2">
            <span className="text-2xl">📋</span>
            <span className="text-sm text-gray-300">Bu kanal sadece satış loglarını gösterir - salt okunur</span>
          </div>
        </div>
      )}
    </div>
  );
}