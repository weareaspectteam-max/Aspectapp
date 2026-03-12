import { useState, useRef, useEffect } from 'react';
import {
  Send, Hash, User, ArrowLeft, Smile, Paperclip, Trash2,
  Bell, Menu, Users, Lock, MessageSquare, ChevronRight,
  MapPin, X
} from 'lucide-react';
import { NewBottomNav } from './new-bottom-nav';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  userRole: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

// ─── Static Data ──────────────────────────────────────────────────────────────

const CHANNELS: Channel[] = [
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

const DEMO_MESSAGES: Record<string, Message[]> = {
  general: [
    { id: '1', sender: 'Ahmet Yılmaz', content: 'Günaydın ekip! Bugün harika bir gün olacak 🌞', timestamp: '08:15', isOwn: false, avatar: '👨‍💼' },
    { id: '2', sender: 'Mehmet Kaya', content: 'Günaydın! ZOKA lokasyonunda hazırız', timestamp: '08:18', isOwn: false, avatar: '👨' },
    { id: '3', sender: '__self__', content: 'Harika! Balık Halinde de her şey hazır', timestamp: '08:20', isOwn: true, avatar: '👤' },
    { id: '4', sender: 'Ayşe Demir', content: 'Yazıcı kontrollerini yaptım, sorun yok 👍', timestamp: '08:25', isOwn: false, avatar: '👩' },
    { id: '5', sender: '__self__', content: 'Bugün çok iyi satış yapıyoruz!', timestamp: '10:24', isOwn: true, avatar: '👤' },
  ],
  rotasyon: [],
  'project-zoka': [
    { id: 'z1', sender: 'SATIŞ SİSTEMİ', content: '🎯 Mehmet Kaya - 09:30\n5\'li Albüm (1000 TL)\nToplam: 1000 TL', timestamp: '09:30', isOwn: false, avatar: '💰', isSalesLog: true },
    { id: 'z2', sender: 'SATIŞ SİSTEMİ', content: '📸 Ayşe Demir - 10:15\n3\'lü Albüm (600 TL) + Paspartu (200 TL)\n%10 İskonto (-80 TL)\nToplam: 720 TL', timestamp: '10:15', isOwn: false, avatar: '💰', isSalesLog: true },
    { id: 'z3', sender: 'SATIŞ SİSTEMİ', content: '🎯 Mehmet Kaya - 11:45\n7\'li Albüm (1400 TL)\nToplam: 1400 TL', timestamp: '11:45', isOwn: false, avatar: '💰', isSalesLog: true },
    { id: 'z4', sender: 'SATIŞ SİSTEMİ', content: '📸 Fatma Öz - 13:20\n5\'li Albüm (1000 TL)\n%15 İskonto (-150 TL)\nToplam: 850 TL', timestamp: '13:20', isOwn: false, avatar: '💰', isSalesLog: true },
    { id: 'z5', sender: 'SATIŞ SİSTEMİ', content: '🎯 Mehmet Kaya - 14:30\n5\'li Albüm (1000 TL)\nToplam: 1000 TL', timestamp: '14:30', isOwn: false, avatar: '💰', isSalesLog: true },
  ],
  'project-balikhali': [
    { id: 'b1', sender: 'SATIŞ SİSTEMİ', content: '📸 Ali Veli - 09:00\n3\'lü Albüm (600 TL)\nToplam: 600 TL', timestamp: '09:00', isOwn: false, avatar: '💰', isSalesLog: true },
    { id: 'b2', sender: 'SATIŞ SİSTEMİ', content: '🎯 Ayşe Demir - 13:15\n3\'lü Albüm (600 TL) + Paspartu (200 TL)\nToplam: 800 TL', timestamp: '13:15', isOwn: false, avatar: '💰', isSalesLog: true },
  ],
  'project-hayalkahvesi': [
    { id: 'h1', sender: 'SATIŞ SİSTEMİ', content: '🎯 Fatma Öz - 12:00\n7\'li Albüm (1400 TL)\nToplam: 1400 TL', timestamp: '12:00', isOwn: false, avatar: '💰', isSalesLog: true },
  ],
  'dm-ahmet': [
    { id: 'da1', sender: 'Ahmet Yılmaz', content: 'Merhaba! Bugünkü satışları nasıl buluyorsun?', timestamp: '10:30', isOwn: false, avatar: '👨‍💼' },
    { id: 'da2', sender: '__self__', content: 'Harika gidiyor! 5 satış yaptım şimdiye kadar', timestamp: '10:32', isOwn: true, avatar: '👤' },
    { id: 'da3', sender: 'Ahmet Yılmaz', content: 'Raporu paylaştım', timestamp: '11:15', isOwn: false, avatar: '👨‍💼' },
  ],
  'dm-mehmet': [
    { id: 'dm1', sender: '__self__', content: 'Mehmet, yazıcı kağıdı bitmiş mi kontrol eder misin?', timestamp: '08:15', isOwn: true, avatar: '👤' },
    { id: 'dm2', sender: 'Mehmet Kaya', content: 'Tamam, teşekkürler', timestamp: '08:30', isOwn: false, avatar: '👨' },
  ],
};

const STAFF_LIST = [
  'Ahmet Yılmaz', 'Ayşe Demir', 'Fatma Öz', 'Mehmet Kaya',
  'Zeynep Şahin', 'Ali Veli', 'Can Yücel', 'Deniz Kara',
  'Elif Ak', 'Hasan Çelik', 'İrem Yıldız', 'Kemal Aydın',
];

// ─── Helper: first letter avatar ─────────────────────────────────────────────

function InitialAvatar({ name, size = 'md', color = 'violet' }: { name: string; size?: 'sm' | 'md' | 'lg'; color?: string }) {
  const sizeMap = { sm: 'w-8 h-8 text-xs', md: 'w-11 h-11 text-sm', lg: 'w-12 h-12 text-base' };
  const colorMap: Record<string, string> = {
    violet: 'from-violet-500 to-indigo-600',
    amber:  'from-amber-500 to-orange-500',
    teal:   'from-teal-400 to-cyan-500',
    rose:   'from-rose-500 to-pink-600',
    emerald:'from-emerald-400 to-teal-500',
  };
  const letters = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <div className={`${sizeMap[size]} rounded-2xl bg-gradient-to-br ${colorMap[color] ?? colorMap.violet} flex items-center justify-center font-bold text-white shrink-0 shadow-lg`}>
      {letters}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ icon, label, badge }: { icon: React.ReactNode; label: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2 px-4 pt-5 pb-2">
      <span className="text-white/30">{icon}</span>
      <span className="text-[11px] font-bold text-white/40 tracking-widest uppercase">{label}</span>
      {badge && (
        <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300">
          {badge}
        </span>
      )}
    </div>
  );
}

// ─── Channel Row ──────────────────────────────────────────────────────────────

function ChannelRow({
  channel,
  onSelect,
  onDelete,
}: {
  channel: Channel;
  onSelect: () => void;
  onDelete?: (e: React.MouseEvent) => void;
}) {
  const isProject = channel.type === 'project';
  const isDM      = channel.type === 'dm';

  return (
    <div className="relative group">
      <button
        onClick={onSelect}
        className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl border transition-all active:scale-[0.98] text-left
          ${isProject
            ? 'bg-amber-500/8 border-amber-500/20 hover:bg-amber-500/14 hover:border-amber-500/35'
            : 'bg-white/5 border-white/10 hover:bg-white/9 hover:border-white/18'
          }
          ${onDelete ? 'pr-14' : ''}
        `}
      >
        {/* Icon */}
        {isDM ? (
          <InitialAvatar name={channel.name} size="md" color="teal" />
        ) : (
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-lg
            ${isProject
              ? 'bg-gradient-to-br from-amber-500 to-orange-500'
              : 'bg-gradient-to-br from-violet-500/80 to-indigo-600/80'
            }`}
          >
            <Hash className="w-5 h-5 text-white" />
          </div>
        )}

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className={`text-sm font-semibold ${channel.unread > 0 ? 'text-white' : 'text-white/70'}`}>
              {isDM ? channel.name : `#${channel.name}`}
            </span>
            <span className="text-[11px] text-white/30 shrink-0 ml-2">{channel.timestamp}</span>
          </div>
          <p className="text-xs text-white/40 truncate leading-relaxed">{channel.lastMessage}</p>
        </div>

        {/* Unread badge */}
        {channel.unread > 0 && (
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black shrink-0
            ${isProject ? 'bg-amber-400 text-amber-900' : 'bg-violet-500 text-white'}`}
          >
            {channel.unread}
          </div>
        )}

        <ChevronRight className="w-3.5 h-3.5 text-white/15 shrink-0" />
      </button>

      {/* Delete button */}
      {onDelete && (
        <button
          onClick={onDelete}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-red-500/80 hover:bg-red-600 flex items-center justify-center transition-all active:scale-90 shadow-lg"
        >
          <Trash2 className="w-3.5 h-3.5 text-white" />
        </button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Messaging({ currentUser, userRole, onLogout, onNavigate }: MessagingProps) {
  const isAdmin = ['yonetici', 'ust-mudur', 'mudur', 'idari'].includes(userRole);

  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [teamMessage, setTeamMessage] = useState('');
  const [deletedChannels, setDeletedChannels] = useState<string[]>([]);
  const [liveMessages, setLiveMessages] = useState<Record<string, Message[]>>({});

  const bottomRef = useRef<HTMLDivElement>(null);

  const getMessages = (channelId: string): Message[] => {
    if (liveMessages[channelId]) return liveMessages[channelId];
    const base = DEMO_MESSAGES[channelId] ?? [];
    return base.map(m => ({ ...m, sender: m.isOwn ? currentUser : m.sender }));
  };

  const handleSend = () => {
    if (!messageInput.trim() || !selectedChannel) return;
    const newMsg: Message = {
      id: Date.now().toString(),
      sender: currentUser,
      content: messageInput.trim(),
      timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      isOwn: true,
      avatar: '👤',
    };
    const prev = getMessages(selectedChannel);
    setLiveMessages(s => ({ ...s, [selectedChannel]: [...prev, newMsg] }));
    setMessageInput('');
  };

  const handleDeleteMessage = (msgId: string) => {
    if (!selectedChannel) return;
    const prev = getMessages(selectedChannel);
    setLiveMessages(s => ({ ...s, [selectedChannel]: prev.filter(m => m.id !== msgId) }));
  };

  const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletedChannels(d => [...d, id]);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveMessages, selectedChannel]);

  const currentChannel = CHANNELS.find(c => c.id === selectedChannel);
  const messages = selectedChannel ? getMessages(selectedChannel) : [];
  const isReadonly = currentChannel?.type === 'project' ||
    (currentChannel?.id === 'rotasyon' && !isAdmin);

  // ── Channel List View ──────────────────────────────────────────────────────
  if (!selectedChannel) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a051e] via-[#120830] to-[#1a0a3c] pb-24 font-sans">

        {/* ── HEADER ── */}
        <div className="bg-[rgba(10,5,30,0.92)] backdrop-blur-xl border-b border-white/10 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-900/40">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">Mesajlar</div>
                <div className="text-[10px] text-white/30">
                  {isAdmin ? 'Tüm kanallar' : 'Genel kanallar'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="w-8 h-8 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center active:scale-90 transition-all">
                <Bell className="w-4 h-4 text-white/40" />
              </button>
              <button className="w-8 h-8 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center active:scale-90 transition-all">
                <Menu className="w-4 h-4 text-white/40" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Kanallar ── */}
        <div className="px-4">
          <SectionHeader icon={<Hash className="w-3.5 h-3.5" />} label="Kanallar" />
          <div className="space-y-2">
            {CHANNELS
              .filter(c => c.type === 'channel')
              .map(ch => (
                <ChannelRow key={ch.id} channel={ch} onSelect={() => setSelectedChannel(ch.id)} />
              ))}
          </div>
        </div>

        {/* ── Mekan Kanalları (Admin only) ── */}
        {isAdmin && (
          <div className="px-4">
            <SectionHeader icon={<MapPin className="w-3.5 h-3.5" />} label="Mekan Kanalları" badge="Sadece Yönetici" />
            <div className="space-y-2">
              {CHANNELS
                .filter(c => c.type === 'project')
                .map(ch => (
                  <ChannelRow key={ch.id} channel={ch} onSelect={() => setSelectedChannel(ch.id)} />
                ))}
            </div>
          </div>
        )}

        {/* ── Direkt Mesajlar ── */}
        <div className="px-4">
          <SectionHeader icon={<User className="w-3.5 h-3.5" />} label="Direkt Mesajlar" />
          <div className="space-y-2">
            {CHANNELS
              .filter(c => c.type === 'dm' && !deletedChannels.includes(c.id))
              .map(ch => (
                <ChannelRow
                  key={ch.id}
                  channel={ch}
                  onSelect={() => setSelectedChannel(ch.id)}
                  onDelete={(e) => handleDeleteConversation(ch.id, e)}
                />
              ))}
          </div>

          {/* Personel Listesi butonu */}
          <button
            onClick={() => setShowTeamModal(true)}
            className="w-full mt-4 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-violet-500/10 border border-violet-500/25 hover:bg-violet-500/18 transition-all active:scale-[0.98]"
          >
            <Users className="w-4 h-4 text-violet-300" />
            <span className="text-sm font-semibold text-violet-300">Personel Listesi</span>
          </button>
        </div>

        {/* ── Team Modal ── */}
        {showTeamModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center">
            <div className="bg-[rgba(10,5,30,0.98)] border border-white/12 rounded-t-3xl w-full max-w-lg shadow-2xl max-h-[82vh] flex flex-col">
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-violet-400" />
                    Personel Listesi
                  </h2>
                  <p className="text-xs text-white/30 mt-0.5">
                    {selectedStaff.length > 0 ? `${selectedStaff.length} kişi seçildi` : 'Mesaj göndermek için seçin'}
                  </p>
                </div>
                <button
                  onClick={() => { setShowTeamModal(false); setSelectedStaff([]); setTeamMessage(''); }}
                  className="w-8 h-8 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center active:scale-90 transition-all"
                >
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>

              {/* Staff List */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5 min-h-0">
                {STAFF_LIST.map(staff => {
                  const selected = selectedStaff.includes(staff);
                  return (
                    <button
                      key={staff}
                      onClick={() => setSelectedStaff(s => selected ? s.filter(x => x !== staff) : [...s, staff])}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all
                        ${selected
                          ? 'bg-violet-500/15 border-violet-500/35'
                          : 'bg-white/4 border-white/8 hover:border-white/16'
                        }`}
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0
                        ${selected ? 'bg-violet-500 border-violet-500' : 'border-white/25'}`}
                      >
                        {selected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <InitialAvatar name={staff} size="sm" color={selected ? 'violet' : 'teal'} />
                      <span className={`text-sm font-semibold ${selected ? 'text-violet-300' : 'text-white/80'}`}>{staff}</span>
                    </button>
                  );
                })}
              </div>

              {/* Message Input */}
              <div className="px-4 py-3 border-t border-white/10 shrink-0 space-y-2">
                <textarea
                  value={teamMessage}
                  onChange={e => setTeamMessage(e.target.value)}
                  placeholder="Mesajınızı yazın..."
                  rows={2}
                  className="w-full px-4 py-3 bg-white/5 border border-white/12 rounded-xl text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/50 resize-none transition-colors"
                />
                <button
                  onClick={() => {
                    if (selectedStaff.length > 0 && teamMessage.trim()) {
                      setShowTeamModal(false);
                      setSelectedStaff([]);
                      setTeamMessage('');
                    }
                  }}
                  disabled={selectedStaff.length === 0 || !teamMessage.trim()}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all shadow-lg shadow-violet-900/40"
                >
                  <Send className="w-4 h-4" />
                  Mesaj Gönder
                </button>
              </div>
            </div>
          </div>
        )}

        <NewBottomNav activeTab="messaging" onTabChange={onNavigate} userRole={userRole} />
      </div>
    );
  }

  // ── Chat View ──────────────────────────────────────────────────────────────

  const isProjectCh = currentChannel?.type === 'project';
  const isDMCh      = currentChannel?.type === 'dm';

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-[#0a051e] via-[#120830] to-[#1a0a3c] font-sans">

      {/* Chat Header */}
      <div className="bg-[rgba(10,5,30,0.92)] backdrop-blur-xl border-b border-white/10 px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedChannel(null)}
            className="w-9 h-9 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center hover:bg-white/12 transition-all active:scale-90"
          >
            <ArrowLeft className="w-4 h-4 text-white/70" />
          </button>

          {isDMCh ? (
            <InitialAvatar name={currentChannel?.name ?? ''} size="md" color="teal" />
          ) : (
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
              ${isProjectCh ? 'bg-gradient-to-br from-amber-500 to-orange-500' : 'bg-gradient-to-br from-violet-500 to-indigo-600'}`}
            >
              <Hash className="w-4 h-4 text-white" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white truncate">
              {isDMCh ? currentChannel?.name : `#${currentChannel?.name}`}
            </div>
            <div className={`text-[11px] flex items-center gap-1 ${isReadonly ? 'text-amber-400/70' : 'text-white/35'}`}>
              {isReadonly
                ? <><Lock className="w-3 h-3" /> Salt okunur</>
                : isDMCh
                  ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> Çevrimiçi</>
                  : 'Ekip kanalı'
              }
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-white/20">
            <MessageSquare className="w-10 h-10 mb-3" />
            <p className="text-sm">Henüz mesaj yok</p>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`group flex items-end gap-2.5 ${msg.isOwn ? 'flex-row-reverse' : ''}`}>
            {/* Avatar */}
            {!msg.isOwn && (
              msg.isSalesLog
                ? <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-lg shrink-0">💰</div>
                : <InitialAvatar name={msg.sender} size="sm" color="teal" />
            )}

            <div className={`max-w-[76%] ${msg.isOwn ? 'items-end flex flex-col' : ''}`}>
              {!msg.isOwn && !msg.isSalesLog && (
                <span className="text-[11px] text-white/40 font-semibold ml-1 mb-1 block">{msg.sender}</span>
              )}

              <div className="relative">
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line
                  ${msg.isSalesLog
                    ? 'bg-amber-500/10 border border-amber-500/25 text-white/90 rounded-bl-sm'
                    : msg.isOwn
                      ? 'bg-gradient-to-br from-violet-600 to-indigo-700 text-white rounded-br-sm shadow-lg shadow-violet-900/30'
                      : 'bg-white/8 border border-white/12 text-white/90 rounded-bl-sm backdrop-blur-sm'
                  }`}
                >
                  {msg.content}
                </div>

                {/* Delete (DM only) */}
                {isDMCh && (
                  <button
                    onClick={() => handleDeleteMessage(msg.id)}
                    className={`absolute top-1 ${msg.isOwn ? '-left-8' : '-right-8'} opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg bg-red-500/80 hover:bg-red-600 flex items-center justify-center transition-all`}
                  >
                    <Trash2 className="w-3 h-3 text-white" />
                  </button>
                )}
              </div>

              <span className="text-[10px] text-white/20 mt-1 px-1">{msg.timestamp}</span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input / Readonly notice */}
      {isReadonly ? (
        <div className="px-4 pb-6 pt-3 bg-[rgba(10,5,30,0.92)] border-t border-white/8 shrink-0">
          <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-white/5 border border-white/10">
            <Lock className="w-4 h-4 text-amber-400/70" />
            <span className="text-xs text-white/40">
              {isProjectCh ? 'Satış log kanalı — salt okunur' : 'Bu kanal yöneticiler tarafından yönetilir'}
            </span>
          </div>
        </div>
      ) : (
        <div className="px-4 pb-6 pt-3 bg-[rgba(10,5,30,0.92)] border-t border-white/8 shrink-0">
          <div className="flex items-center gap-2 bg-white/5 border border-white/12 rounded-2xl px-3 py-2 focus-within:border-violet-500/40 transition-colors">
            <button className="w-8 h-8 rounded-xl bg-white/6 flex items-center justify-center shrink-0 active:scale-90 transition-all">
              <Paperclip className="w-3.5 h-3.5 text-white/35" />
            </button>
            <input
              type="text"
              value={messageInput}
              onChange={e => setMessageInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Mesaj yaz..."
              className="flex-1 bg-transparent text-sm text-white placeholder-white/25 outline-none"
            />
            <button className="w-8 h-8 rounded-xl bg-white/6 flex items-center justify-center shrink-0 active:scale-90 transition-all">
              <Smile className="w-3.5 h-3.5 text-white/35" />
            </button>
            <button
              onClick={handleSend}
              disabled={!messageInput.trim()}
              className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center shrink-0 active:scale-90 disabled:opacity-40 transition-all shadow-lg shadow-violet-900/30"
            >
              <Send className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
