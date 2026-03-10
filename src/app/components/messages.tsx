import { useState } from 'react';
import { Send, Search, Clock, CheckCheck, Users, Trash2 } from 'lucide-react';
import { StaffTopBar } from './staff-top-bar';
import { NewBottomNav } from './new-bottom-nav';

interface Message {
  id: string;
  sender: string;
  senderRole: 'admin' | 'staff';
  content: string;
  timestamp: string;
  read: boolean;
}

interface Conversation {
  id: string;
  name: string;
  role: 'admin' | 'staff';
  lastMessage: string;
  timestamp: string;
  unread: number;
  avatar: string;
}

interface MessagesProps {
  currentUser: string;
  currentRole: 'admin' | 'staff';
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

export function Messages({ currentUser, currentRole, onLogout, onNavigate }: MessagesProps) {
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: '1',
      name: 'Ahmet Yılmaz',
      role: 'admin',
      lastMessage: 'ZOKA lokasyonunun bugünkü raporu hazır',
      timestamp: '14:32',
      unread: 2,
      avatar: '👨‍💼',
    },
    {
      id: '2',
      name: 'Ayşe Demir',
      role: 'staff',
      lastMessage: 'Yazıcı ribbonu değiştirildi',
      timestamp: '13:45',
      unread: 0,
      avatar: '👩',
    },
    {
      id: '3',
      name: 'Mehmet Kaya',
      role: 'staff',
      lastMessage: 'Balık Hali veri girişi tamamlandı',
      timestamp: '12:15',
      unread: 1,
      avatar: '👨',
    },
    {
      id: '4',
      name: 'Zeynep Şahin',
      role: 'staff',
      lastMessage: 'Bugünkü albüm satışları çok iyi',
      timestamp: 'Dün',
      unread: 0,
      avatar: '👩‍🦰',
    },
  ]);

  const chatMessages: Message[] = [
    {
      id: '1',
      sender: 'Ahmet Yılmaz',
      senderRole: 'admin',
      content: 'Merhaba, bugünkü ZOKA raporu nasıl gidiyor?',
      timestamp: '14:25',
      read: true,
    },
    {
      id: '2',
      sender: currentUser,
      senderRole: currentRole,
      content: 'Merhaba, çok iyi gidiyor. 38 albüm sattık bugün.',
      timestamp: '14:28',
      read: true,
    },
    {
      id: '3',
      sender: 'Ahmet Yılmaz',
      senderRole: 'admin',
      content: 'Harika! Raporu tamamlayınca bana bildir lütfen.',
      timestamp: '14:30',
      read: true,
    },
    {
      id: '4',
      sender: currentUser,
      senderRole: currentRole,
      content: 'Tamam, 30 dakikaya hazır olur.',
      timestamp: '14:32',
      read: false,
    },
  ];

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    // Message sending logic would go here
    setMessageInput('');
  };

  const filteredConversations = conversations.filter(conv =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const teamMembers = [
    { id: '1', name: 'Ali Veli', role: 'staff' as const, avatar: '👨', discount: '9%' },
    { id: '2', name: 'Ayşe Demir', role: 'staff' as const, avatar: '👩', discount: '11%' },
    { id: '3', name: 'Burak Yıldız', role: 'staff' as const, avatar: '👨', discount: '10%' },
    { id: '4', name: 'Can Öz', role: 'staff' as const, avatar: '👨‍🦱', discount: '15%' },
    { id: '5', name: 'Cem Beyaz', role: 'staff' as const, avatar: '👨', discount: '14%' },
    { id: '6', name: 'Deniz Kara', role: 'staff' as const, avatar: '👩', discount: '13%' },
    { id: '7', name: 'Ege Deniz', role: 'staff' as const, avatar: '👨', discount: '8%' },
    { id: '8', name: 'Fatma Nur', role: 'staff' as const, avatar: '👩', discount: '11%' },
    { id: '9', name: 'Mehmet Kaya', role: 'staff' as const, avatar: '👨', discount: '12%' },
    { id: '10', name: 'Merve Ak', role: 'staff' as const, avatar: '👩‍🦰', discount: '12%' },
    { id: '11', name: 'Selin Güneş', role: 'staff' as const, avatar: '👩', discount: '7%' },
    { id: '12', name: 'Zeynep Şahin', role: 'staff' as const, avatar: '👩‍🦰', discount: '10%' },
  ].sort((a, b) => a.name.localeCompare(b.name, 'tr')); // Alfabetik sıralama

  const toggleTeamMember = (id: string) => {
    setSelectedTeamMembers(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const deleteConversation = (e: React.MouseEvent, convId: string) => {
    e.stopPropagation(); // Prevent opening the chat
    setConversations(prev => prev.filter(conv => conv.id !== convId));
    if (selectedChat === convId) {
      setSelectedChat(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] relative pb-20">
      {/* Sticky Top Bar - Only for staff */}
      {currentRole === 'staff' && (
        <StaffTopBar
          userName={currentUser}
          userRole={currentRole}
          onLogout={onLogout}
          onNavigate={onNavigate}
          showBackButton={false}
        />
      )}

      <div className="flex flex-col min-h-[calc(100vh-140px)] pt-6">{/* Changed pt-4 to pt-6 */}
      {!selectedChat ? (
        // Conversations List
        <>
          <div className="px-6 pb-4 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Kişi ara..."
                className="w-full pl-10 pr-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9dd9ea]"
              />
            </div>
            
            {/* Team View Button */}
            <button
              onClick={() => setShowTeamModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-br from-[#ffd4a3] to-[#ffc78f] text-[#2d3748] rounded-xl font-bold hover:shadow-lg transition-all active:scale-[0.98]"
            >
              <Users className="w-5 h-5" />
              Ekip Görüntüle
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {filteredConversations.map((conv) => (
              <div
                key={conv.id}
                className="relative p-4 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl mb-3 transition-all active:scale-[0.98]"
              >
                {/* Delete Button - Top Right - ALWAYS VISIBLE */}
                <button
                  onClick={(e) => deleteConversation(e, conv.id)}
                  className="absolute top-2 right-2 w-9 h-9 rounded-xl bg-[#ff4757] flex items-center justify-center transition-all active:scale-90 z-50 shadow-lg"
                >
                  <Trash2 className="w-4 h-4 text-white" />
                </button>

                {/* Conversation Content */}
                <div 
                  className="flex items-center gap-3"
                  onClick={() => setSelectedChat(conv.id)}
                >
                  <div className="w-12 h-12 rounded-full bg-[#9dd9ea]/20 flex items-center justify-center text-2xl flex-shrink-0">
                    {conv.avatar}
                  </div>
                  
                  <div className="flex-1 min-w-0 pr-12">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-white">{conv.name}</h3>
                      <span className="text-xs text-gray-400">{conv.timestamp}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-400 truncate">{conv.lastMessage}</p>
                      {conv.unread > 0 && (
                        <div className="ml-2 w-5 h-5 rounded-full bg-[#9dd9ea] text-[#2d3748] text-xs flex items-center justify-center flex-shrink-0 font-semibold">
                          {conv.unread}
                        </div>
                      )}
                    </div>
                    <div className="mt-1">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] ${
                        conv.role === 'admin' 
                          ? 'bg-[#9dd9ea]/20 text-[#9dd9ea]' 
                          : 'bg-[#a8e6cf]/20 text-[#a8e6cf]'
                      }`}>
                        {conv.role === 'admin' ? 'Yönetici' : 'Personel'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        // Chat View
        <>
          <div className="px-6 py-4 border-b border-white/10">
            <button
              onClick={() => setSelectedChat(null)}
              className="text-[#9dd9ea] mb-2 flex items-center gap-1 text-sm hover:text-[#7ec8dd] transition-colors"
            >
              ← Geri
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#9dd9ea]/20 flex items-center justify-center text-xl">
                👨‍💼
              </div>
              <div>
                <h2 className="font-semibold text-white">Ahmet Yılmaz</h2>
                <p className="text-xs text-gray-400">Yönetici</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {chatMessages.map((msg) => {
              const isCurrentUser = msg.sender === currentUser;
              
              return (
                <div
                  key={msg.id}
                  className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[75%] ${isCurrentUser ? 'text-right' : 'text-left'}`}>
                    {!isCurrentUser && (
                      <div className="text-xs text-gray-400 mb-1">{msg.sender}</div>
                    )}
                    <div className={`inline-block rounded-2xl px-4 py-3 ${
                      isCurrentUser
                        ? 'bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748]'
                        : 'backdrop-blur-xl bg-white/10 border border-white/20 text-white'
                    }`}>
                      <p className="text-sm">{msg.content}</p>
                    </div>
                    <div className="flex items-center gap-1 justify-end mt-1">
                      <span className="text-xs text-gray-400">{msg.timestamp}</span>
                      {isCurrentUser && (
                        <CheckCheck className={`w-3 h-3 ${msg.read ? 'text-[#9dd9ea]' : 'text-gray-400'}`} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-6 py-4 border-t border-white/10">
            <div className="flex gap-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Mesaj yazın..."
                className="flex-1 px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9dd9ea]"
              />
              <button
                onClick={handleSendMessage}
                disabled={!messageInput.trim()}
                className="px-4 py-3 bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
          </div>
        </>
      )}
      </div>

      {/* Team Modal */}
      {showTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-gradient-to-b from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439] rounded-2xl shadow-2xl border border-white/10 overflow-hidden max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-white/10 bg-gradient-to-br from-white/5 to-white/0">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-black text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#ffd4a3]" />
                  Ekip {currentRole === 'admin' && '(İskonto Oranları)'}
                </h2>
                <button
                  onClick={() => {
                    setShowTeamModal(false);
                    setSelectedTeamMembers([]);
                  }}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center transition-all"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-gray-400">
                {selectedTeamMembers.length > 0 
                  ? `${selectedTeamMembers.length} kişi seçildi`
                  : 'Mesaj göndermek için ekip üyelerini seçin'}
              </p>
            </div>

            {/* Team Members List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {teamMembers.map((member) => {
                const isSelected = selectedTeamMembers.includes(member.id);
                return (
                  <button
                    key={member.id}
                    onClick={() => toggleTeamMember(member.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all active:scale-[0.98] ${
                      isSelected
                        ? 'bg-gradient-to-br from-[#9dd9ea]/20 to-[#9dd9ea]/10 border-[#9dd9ea]/50 shadow-lg'
                        : 'bg-white/10 border-white/20 hover:border-white/30'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-[#9dd9ea]/20 flex items-center justify-center text-xl flex-shrink-0">
                      {member.avatar}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-semibold text-white text-sm">{member.name}</div>
                      {currentRole === 'admin' && (
                        <div className="text-xs text-[#ffd4a3]">İskonto: {member.discount}</div>
                      )}
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-[#9dd9ea] flex items-center justify-center flex-shrink-0">
                        <CheckCheck className="w-4 h-4 text-[#2d3748]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer - Message Input */}
            {selectedTeamMembers.length > 0 && (
              <div className="p-4 border-t border-white/10 bg-gradient-to-br from-white/5 to-white/0 space-y-3">
                <textarea
                  placeholder="Toplu mesaj yazın..."
                  rows={3}
                  className="w-full px-4 py-3 backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#9dd9ea] resize-none"
                />
                <button
                  onClick={() => {
                    // Send message logic
                    setShowTeamModal(false);
                    setSelectedTeamMembers([]);
                  }}
                  className="w-full px-4 py-3 bg-gradient-to-br from-[#9dd9ea] to-[#7ec8dd] text-[#2d3748] rounded-xl font-bold hover:shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  Mesaj Gönder ({selectedTeamMembers.length} kişi)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Navigation - For both admin and staff */}
      <NewBottomNav
        activeTab="messages"
        onTabChange={onNavigate}
        userRole={currentRole}
      />
    </div>
  );
}
