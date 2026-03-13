/**
 * Messaging — Gerçek zamanlı mesajlaşma (Supabase KV backend)
 * Kanallar: general, rotasyon, mekan_* (admin/operasyon)
 * DM: tüm kullanıcılar arası
 * Polling: 10 sn
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Hash, User, ArrowLeft, Paperclip,
  Bell, Users, Lock, MessageSquare, ChevronRight,
  MapPin, X, Search, RefreshCw, Plus,
} from 'lucide-react';
import { NewBottomNav } from './new-bottom-nav';
import { authHeaders } from '../lib/api';
import { projectId } from '/utils/supabase/info';
import type { UserRole } from './login';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Channel {
  id: string;
  name: string;
  type: 'channel' | 'project';
  emoji?: string;
  isAdminOnly: boolean;
  lastMessage: string;
  lastMessageTime: string | null;
  unread: number;
}

interface DmConversation {
  userId: string;
  name: string;
  role: string;
  avatar: string;
  lastMessage: string;
  lastMessageTime: string | null;
  unread: number;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  timestamp: string;
}

interface AppUser {
  id: string;
  name: string;
  role: string;
  avatar: string;
}

interface MessagingProps {
  currentUser: string;
  userRole: UserRole;
  userId: string;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

// ─── Glassmorphism ────────────────────────────────────────────────────────────

const glass = {
  background: 'rgba(10,5,30,0.70)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
} as React.CSSProperties;

// ─── Yardımcı: avatar baş harfleri ───────────────────────────────────────────

function InitialAvatar({ name, size = 'md', color = 'violet' }: {
  name: string; size?: 'sm' | 'md' | 'lg'; color?: string;
}) {
  const sizeMap = { sm: 'w-8 h-8 text-xs', md: 'w-11 h-11 text-sm', lg: 'w-12 h-12 text-base' };
  const letters = name.split(' ').slice(0, 2).map(w => w[0] || '?').join('').toUpperCase();
  const bg =
    color === 'amber'   ? 'from-amber-500 to-orange-500' :
    color === 'teal'    ? 'from-teal-400 to-cyan-500'    :
    color === 'emerald' ? 'from-emerald-400 to-teal-500'  :
    color === 'rose'    ? 'from-rose-500 to-pink-600'    :
                          'from-violet-500 to-indigo-600';
  return (
    <div className={`${sizeMap[size]} rounded-2xl bg-gradient-to-br ${bg} flex items-center justify-center font-bold text-white shrink-0`}>
      {letters}
    </div>
  );
}

function roleColor(role: string) {
  return role === 'yonetici' || role === 'ust-mudur' ? 'violet'
    : role === 'mudur' ? 'rose'
    : role === 'operasyon' ? 'amber'
    : role === 'idari' ? 'emerald'
    : 'teal';
}

function formatTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60 * 60 * 1000) return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  if (diff < 24 * 60 * 60 * 1000) return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  return 'Dün';
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

function ChannelRow({ channel, onSelect }: { channel: Channel; onSelect: () => void }) {
  const isProject = channel.type === 'project';
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl border transition-all active:scale-[0.98] text-left
        ${isProject
          ? 'bg-amber-500/8 border-amber-500/20 hover:bg-amber-500/14 hover:border-amber-500/35'
          : 'bg-white/5 border-white/10 hover:bg-white/9 hover:border-white/18'
        }`}
    >
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0
        ${isProject
          ? 'bg-gradient-to-br from-amber-500 to-orange-500'
          : 'bg-gradient-to-br from-violet-500/80 to-indigo-600/80'
        }`}
      >
        {isProject && channel.emoji
          ? <span className="text-xl">{channel.emoji}</span>
          : <Hash className="w-5 h-5 text-white" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className={`text-sm font-semibold ${channel.unread > 0 ? 'text-white' : 'text-white/70'}`}>
            #{channel.name}
          </span>
          <span className="text-[11px] text-white/30 shrink-0 ml-2">
            {formatTime(channel.lastMessageTime)}
          </span>
        </div>
        <p className="text-xs text-white/40 truncate leading-relaxed">
          {channel.lastMessage || 'Henüz mesaj yok'}
        </p>
      </div>
      {channel.unread > 0 && (
        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black shrink-0
          ${isProject ? 'bg-amber-400 text-amber-900' : 'bg-violet-500 text-white'}`}>
          {channel.unread}
        </div>
      )}
      <ChevronRight className="w-3.5 h-3.5 text-white/15 shrink-0" />
    </button>
  );
}

// ─── DM Row ───────────────────────────────────────────────────────────────────

function DmRow({ conv, onSelect }: { conv: DmConversation; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/9 transition-all active:scale-[0.98] text-left"
    >
      <InitialAvatar name={conv.name} size="md" color={roleColor(conv.role)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className={`text-sm font-semibold ${conv.unread > 0 ? 'text-white' : 'text-white/70'}`}>
            {conv.name}
          </span>
          <span className="text-[11px] text-white/30 shrink-0 ml-2">
            {formatTime(conv.lastMessageTime)}
          </span>
        </div>
        <p className="text-xs text-white/40 truncate">{conv.lastMessage || 'Henüz mesaj yok'}</p>
      </div>
      {conv.unread > 0 && (
        <div className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center text-[11px] font-black text-white shrink-0">
          {conv.unread}
        </div>
      )}
      <ChevronRight className="w-3.5 h-3.5 text-white/15 shrink-0" />
    </button>
  );
}

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────

export function Messaging({ currentUser, userRole, userId, onLogout, onNavigate }: MessagingProps) {
  const isAdmin = ['yonetici', 'ust-mudur', 'mudur', 'idari', 'operasyon'].includes(userRole);

  // Liste görünümü state
  const [channels,     setChannels]     = useState<Channel[]>([]);
  const [dmConvs,      setDmConvs]      = useState<DmConversation[]>([]);
  const [listLoading,  setListLoading]  = useState(true);

  // Seçili kanal/DM
  const [selectedCh,   setSelectedCh]   = useState<Channel | null>(null);
  const [selectedDm,   setSelectedDm]   = useState<DmConversation | null>(null);

  // Chat mesajları
  const [messages,     setMessages]     = useState<ChatMessage[]>([]);
  const [msgLoading,   setMsgLoading]   = useState(false);
  const [msgInput,     setMsgInput]     = useState('');
  const [sending,      setSending]      = useState(false);

  // Yeni DM modal
  const [showNewDm,    setShowNewDm]    = useState(false);
  const [allUsers,     setAllUsers]     = useState<AppUser[]>([]);
  const [userSearch,   setUserSearch]   = useState('');

  const bottomRef    = useRef<HTMLDivElement>(null);
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Liste yükle ──────────────────────────────────────────────────

  const loadList = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const [chRes, dmRes] = await Promise.allSettled([
        fetch(`${SERVER}/mesajlar/kanallar`, { headers }),
        fetch(`${SERVER}/mesajlar/dm-list`,  { headers }),
      ]);
      if (chRes.status === 'fulfilled' && chRes.value.ok) {
        const d = await chRes.value.json();
        setChannels(d.channels || []);
      }
      if (dmRes.status === 'fulfilled' && dmRes.value.ok) {
        const d = await dmRes.value.json();
        setDmConvs(d.conversations || []);
      }
    } catch (e) {
      console.error('[Messaging] loadList error:', e);
    } finally {
      setListLoading(false);
    }
  }, []);

  // ── Mesaj yükle ──────────────────────────────────────────────────

  const loadMessages = useCallback(async (silent = false) => {
    if (!selectedCh && !selectedDm) return;
    if (!silent) setMsgLoading(true);
    try {
      const headers = await authHeaders();
      const url = selectedDm
        ? `${SERVER}/mesajlar/dm/${selectedDm.userId}`
        : `${SERVER}/mesajlar/kanallar/${selectedCh!.id}`;
      const res = await fetch(url, { headers });
      if (res.ok) {
        const d = await res.json();
        setMessages(d.messages || []);
      }
    } catch (e) {
      console.error('[Messaging] loadMessages error:', e);
    } finally {
      setMsgLoading(false);
    }
  }, [selectedCh, selectedDm]);

  // ── Effects ──────────────────────────────────────────────────────

  useEffect(() => {
    loadList();
    const iv = setInterval(loadList, 15_000);
    return () => clearInterval(iv);
  }, [loadList]);

  useEffect(() => {
    if (selectedCh || selectedDm) {
      loadMessages();
      pollInterval.current = setInterval(() => loadMessages(true), 8_000);
    }
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [selectedCh, selectedDm, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Mesaj gönder ─────────────────────────────────────────────────

  const handleSend = async () => {
    if (!msgInput.trim() || sending) return;
    if (!selectedCh && !selectedDm) return;
    setSending(true);
    try {
      const headers = await authHeaders();
      const url = selectedDm
        ? `${SERVER}/mesajlar/dm/${selectedDm.userId}`
        : `${SERVER}/mesajlar/kanallar/${selectedCh!.id}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: msgInput.trim() }),
      });
      if (res.ok) {
        setMsgInput('');
        await loadMessages(true);
      } else {
        const d = await res.json();
        console.error('[Messaging] send error:', d.error);
      }
    } catch (e) {
      console.error('[Messaging] handleSend error:', e);
    } finally {
      setSending(false);
    }
  };

  // ── Kullanıcı listesi yükle (yeni DM) ────────────────────────────

  const openNewDm = async () => {
    setShowNewDm(true);
    if (allUsers.length === 0) {
      try {
        const headers = await authHeaders();
        const res = await fetch(`${SERVER}/mesajlar/kullanicilar`, { headers });
        if (res.ok) {
          const d = await res.json();
          setAllUsers(d.users || []);
        }
      } catch (e) {
        console.error('[Messaging] openNewDm error:', e);
      }
    }
  };

  const startDm = async (u: AppUser) => {
    setShowNewDm(false);
    setUserSearch('');
    const conv: DmConversation = {
      userId: u.id,
      name: u.name,
      role: u.role,
      avatar: u.avatar,
      lastMessage: '',
      lastMessageTime: null,
      unread: 0,
    };
    setSelectedDm(conv);
    setSelectedCh(null);
  };

  // ─── Kanalda yazma izni ──────────────────────────────────────────
  const isReadonly = selectedCh?.type === 'project';

  // ════════════════════════════════════════════════════════════════
  // Sohbet görünümü
  // ════════════════════════════════════════════════════════════════

  if (selectedCh || selectedDm) {
    const title = selectedDm ? selectedDm.name : `#${selectedCh!.name}`;
    const subtitle = selectedDm
      ? selectedDm.role
      : selectedCh!.type === 'project'
        ? 'Salt okunur kanal'
        : 'Ekip kanalı';

    return (
      <div className="flex flex-col h-screen font-sans" style={{ background: 'linear-gradient(135deg,#0a051e 0%,#1a0a3c 50%,#0d0a2e 100%)' }}>

        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-white/10" style={glass}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSelectedCh(null); setSelectedDm(null); setMessages([]); loadList(); }}
              className="w-9 h-9 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center active:scale-90 transition-all"
            >
              <ArrowLeft className="w-4 h-4 text-white/70" />
            </button>

            {selectedDm
              ? <InitialAvatar name={selectedDm.name} size="sm" color={roleColor(selectedDm.role)} />
              : (
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                  ${selectedCh!.type === 'project'
                    ? 'bg-gradient-to-br from-amber-500 to-orange-500'
                    : 'bg-gradient-to-br from-violet-500 to-indigo-600'}`}
                >
                  {selectedCh!.type === 'project' && selectedCh!.emoji
                    ? <span className="text-base">{selectedCh!.emoji}</span>
                    : <Hash className="w-4 h-4 text-white" />
                  }
                </div>
              )
            }

            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{title}</p>
              <div className="flex items-center gap-1 text-[11px]" style={{ color: isReadonly ? '#fbbf24' : 'rgba(255,255,255,0.35)' }}>
                {isReadonly ? <><Lock className="w-3 h-3" /> Salt okunur</> : (
                  <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> {subtitle}</>
                )}
              </div>
            </div>

            <button
              onClick={() => loadMessages(true)}
              className="w-8 h-8 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center active:scale-90 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5 text-white/40" />
            </button>
          </div>
        </div>

        {/* Mesajlar */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {msgLoading && messages.length === 0 && (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 rounded-full animate-spin border-2 border-violet-500/30 border-t-violet-500" />
            </div>
          )}

          {!msgLoading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-white/20">
              <MessageSquare className="w-10 h-10 mb-3" />
              <p className="text-sm">Henüz mesaj yok</p>
            </div>
          )}

          {messages.map(msg => {
            const isOwn = msg.senderId === userId;
            return (
              <div key={msg.id} className={`group flex items-end gap-2.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
                {!isOwn && <InitialAvatar name={msg.senderName} size="sm" color={roleColor(msg.senderRole)} />}
                <div className={`max-w-[76%] ${isOwn ? 'items-end flex flex-col' : ''}`}>
                  {!isOwn && (
                    <span className="text-[11px] text-white/40 font-semibold ml-1 mb-1 block">
                      {msg.senderName}
                    </span>
                  )}
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                    ${isOwn
                      ? 'bg-gradient-to-br from-violet-600 to-indigo-700 text-white rounded-br-sm shadow-lg shadow-violet-900/30'
                      : 'bg-white/8 border border-white/12 text-white/90 rounded-bl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-white/20 mt-1 px-1">
                    {new Date(msg.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {isReadonly ? (
          <div className="px-4 pb-6 pt-3 shrink-0 border-t border-white/8" style={glass}>
            <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-white/5 border border-white/10">
              <Lock className="w-4 h-4 text-amber-400/70" />
              <span className="text-xs text-white/40">Bu kanal salt okunur — sadece satış logları gösterilir</span>
            </div>
          </div>
        ) : (
          <div className="px-4 pb-6 pt-3 shrink-0 border-t border-white/8" style={glass}>
            <div className="flex items-center gap-2 bg-white/5 border border-white/12 rounded-2xl px-3 py-2 focus-within:border-violet-500/40 transition-colors">
              <input
                type="text"
                value={msgInput}
                onChange={e => setMsgInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Mesaj yaz..."
                className="flex-1 bg-transparent text-sm text-white placeholder-white/25 outline-none"
              />
              <button
                onClick={handleSend}
                disabled={!msgInput.trim() || sending}
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

  // ════════════════════════════════════════════════════════════════
  // Liste görünümü
  // ════════════════════════════════════════════════════════════════

  const filteredUsers = allUsers.filter(u =>
    u.name.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen pb-24 font-sans" style={{ background: 'linear-gradient(135deg,#0a051e 0%,#1a0a3c 50%,#0d0a2e 100%)' }}>

      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10" style={glass}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-900/40">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Mesajlar</p>
              <p className="text-[10px] text-white/30">{isAdmin ? 'Tüm kanallar' : 'Genel kanallar'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadList}
              className="w-8 h-8 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center active:scale-90 transition-all"
            >
              <RefreshCw className="w-4 h-4 text-white/40" />
            </button>
          </div>
        </div>
      </div>

      {listLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full animate-spin border-2 border-violet-500/30 border-t-violet-500" />
        </div>
      ) : (
        <>
          {/* Kanallar */}
          <div className="px-4">
            <SectionHeader icon={<Hash className="w-3.5 h-3.5" />} label="Kanallar" />
            <div className="space-y-2">
              {channels.map(ch => (
                <ChannelRow
                  key={ch.id}
                  channel={ch}
                  onSelect={() => { setSelectedCh(ch); setSelectedDm(null); }}
                />
              ))}
            </div>
          </div>

          {/* Mekan Kanalları — sadece admin */}
          {/* (mekan kanalları artık channels içinde type=project olarak geliyor — aşağıda ayrıca render etmiyoruz) */}

          {/* Direkt Mesajlar */}
          <div className="px-4">
            <SectionHeader icon={<User className="w-3.5 h-3.5" />} label="Direkt Mesajlar" />
            <div className="space-y-2">
              {dmConvs.length === 0 && (
                <p className="text-xs text-white/30 px-3 py-2">Henüz DM konuşması yok</p>
              )}
              {dmConvs.map(conv => (
                <DmRow
                  key={conv.userId}
                  conv={conv}
                  onSelect={() => { setSelectedDm(conv); setSelectedCh(null); }}
                />
              ))}
            </div>

            {/* Yeni DM butonu */}
            <button
              onClick={openNewDm}
              className="w-full mt-4 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-violet-500/10 border border-violet-500/25 hover:bg-violet-500/18 transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4 text-violet-300" />
              <span className="text-sm font-semibold text-violet-300">Yeni Mesaj</span>
            </button>
          </div>
        </>
      )}

      {/* Yeni DM Modal */}
      {showNewDm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className="bg-[rgba(10,5,30,0.98)] border border-white/12 rounded-t-3xl w-full max-w-lg shadow-2xl max-h-[82vh] flex flex-col">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-violet-400" />
                  Yeni Mesaj
                </h2>
                <p className="text-xs text-white/30 mt-0.5">Mesaj göndermek istediğiniz kişiyi seçin</p>
              </div>
              <button
                onClick={() => { setShowNewDm(false); setUserSearch(''); }}
                className="w-8 h-8 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center active:scale-90 transition-all"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>

            {/* Arama */}
            <div className="px-4 pt-3 pb-2 shrink-0">
              <div className="flex items-center gap-2 bg-white/5 border border-white/12 rounded-xl px-3 py-2">
                <Search className="w-4 h-4 text-white/30 shrink-0" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="İsim ara..."
                  className="flex-1 bg-transparent text-sm text-white placeholder-white/25 outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5 min-h-0">
              {filteredUsers.length === 0 && (
                <p className="text-xs text-white/30 text-center py-8">Kullanıcı bulunamadı</p>
              )}
              {filteredUsers.map(u => (
                <button
                  key={u.id}
                  onClick={() => startDm(u)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/8 bg-white/4 hover:border-white/16 hover:bg-white/8 transition-all active:scale-[0.98]"
                >
                  <InitialAvatar name={u.name} size="sm" color={roleColor(u.role)} />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold text-white">{u.name}</p>
                    <p className="text-[11px] text-white/35 capitalize">{u.role}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <NewBottomNav activeTab="messaging" onTabChange={onNavigate} userRole={userRole} />
    </div>
  );
}
