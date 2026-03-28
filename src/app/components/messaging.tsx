/**
 * Messaging — Gerçek zamanlı mesajlaşma (Supabase KV backend)
 *
 * Görünürlük kuralları:
 *  - Statik kanallar (general, rotasyon)  : tüm roller
 *  - Mekan kanalları (project)            : yonetici + ust-mudur
 *  - Özel kanallar (custom_*)             : tüm aktif roller
 *  - Kanal oluşturma / silme             : yonetici + ust-mudur
 *
 * Layout: App.tsx → main(pt-[60px] pb-24) içinde render edilir.
 *   Chat görünümü height = calc(100vh - 60px - 96px)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Hash, User, ArrowLeft,
  Users, Lock, MessageSquare, ChevronRight,
  X, Search, RefreshCw, Plus, Trash2,
} from 'lucide-react';
import { authHeaders, ghostParams } from '../lib/api';
import { projectId } from '../lib/supabase-info';
import type { UserRole } from './login';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

// ─── Emoji seçenekleri (kanal oluşturma) ─────────────────────────────────────
const CHANNEL_EMOJIS = ['💬', '📢', '🎯', '📸', '🗂️', '💡', '🔔', '🎉', '📊', '🛠️', '🌟', '🔒'];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Channel {
  id: string;
  name: string;
  type: 'channel' | 'project';
  emoji?: string;
  isAdminOnly: boolean;
  deletable: boolean;
  createdBy?: string;
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

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

function roleColor(role: string): string {
  if (role === 'yonetici' || role === 'ust-mudur') return 'violet';
  if (role === 'mudur')     return 'rose';
  if (role === 'operasyon') return 'amber';
  if (role === 'idari')     return 'emerald';
  return 'teal';
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 24 * 60 * 60 * 1000)
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  return 'Dün';
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function InitialAvatar({ name, size = 'md', color = 'violet' }: {
  name: string; size?: 'sm' | 'md'; color?: string;
}) {
  const sizeMap = { sm: 'w-8 h-8 text-xs', md: 'w-11 h-11 text-sm' };
  const letters = name.split(' ').slice(0, 2).map(w => w[0] || '?').join('').toUpperCase();
  const bg =
    color === 'amber'   ? 'from-amber-500 to-orange-500'  :
    color === 'teal'    ? 'from-teal-400 to-cyan-500'     :
    color === 'emerald' ? 'from-emerald-400 to-teal-500'  :
    color === 'rose'    ? 'from-rose-500 to-pink-600'     :
                          'from-violet-500 to-indigo-600';
  return (
    <div className={`${sizeMap[size]} rounded-2xl bg-gradient-to-br ${bg} flex items-center justify-center font-bold text-white shrink-0`}>
      {letters}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ icon, label, badge }: {
  icon: React.ReactNode; label: string; badge?: string;
}) {
  return (
    <div className="flex items-center gap-2 pt-5 pb-2">
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

function ChannelRow({ channel, onSelect, onDelete, canDelete }: {
  channel: Channel;
  onSelect: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
}) {
  const isProject = channel.type === 'project';
  const showEmoji = isProject && channel.emoji;

  return (
    <div className="relative group">
      <button
        onClick={onSelect}
        className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl border transition-all active:scale-[0.98] text-left
          ${isProject
            ? 'bg-amber-500/8 border-amber-500/20 hover:bg-amber-500/14'
            : 'bg-white/5 border-white/10 hover:bg-white/9 hover:border-white/18'
          }
          ${canDelete && onDelete ? 'pr-14' : ''}`}
      >
        {/* İkon */}
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0
          ${isProject
            ? 'bg-gradient-to-br from-amber-500 to-orange-500'
            : 'bg-gradient-to-br from-violet-500/80 to-indigo-600/80'
          }`}
        >
          {channel.emoji && channel.emoji !== '#'
            ? <span className="text-xl">{channel.emoji}</span>
            : <Hash className="w-5 h-5 text-white" />
          }
        </div>

        {/* Metin */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className={`text-sm font-semibold ${channel.unread > 0 ? 'text-white' : 'text-white/70'}`}>
              {isProject ? channel.name : `#${channel.name}`}
            </span>
            <span className="text-[11px] text-white/30 shrink-0 ml-2">{formatTime(channel.lastMessageTime)}</span>
          </div>
          <p className="text-xs text-white/40 truncate">{channel.lastMessage || 'Henüz mesaj yok'}</p>
        </div>

        {/* Okunmamış rozeti */}
        {channel.unread > 0 && (
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black shrink-0
            ${isProject ? 'bg-amber-400 text-amber-900' : 'bg-violet-500 text-white'}`}>
            {channel.unread}
          </div>
        )}
        <ChevronRight className="w-3.5 h-3.5 text-white/15 shrink-0" />
      </button>

      {/* Sil butonu — sadece özel kanallar, sadece yetkili rol */}
      {canDelete && onDelete && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-red-500/80 hover:bg-red-600 flex items-center justify-center transition-all active:scale-90 opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-3.5 h-3.5 text-white" />
        </button>
      )}
    </div>
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
          <span className="text-[11px] text-white/30 shrink-0 ml-2">{formatTime(conv.lastMessageTime)}</span>
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

export function Messaging({ currentUser, userRole, userId, onNavigate }: MessagingProps) {
  // Rol yetki seviyeleri
  const canManageChannels = ['yonetici', 'ust-mudur'].includes(userRole);
  const canSeeMekan       = ['yonetici', 'ust-mudur'].includes(userRole);

  // Liste state
  const [channels,    setChannels]    = useState<Channel[]>([]);
  const [dmConvs,     setDmConvs]     = useState<DmConversation[]>([]);
  const [listLoading, setListLoading] = useState(true);

  // Chat state
  const [selectedCh,  setSelectedCh]  = useState<Channel | null>(null);
  const [selectedDm,  setSelectedDm]  = useState<DmConversation | null>(null);
  const [messages,    setMessages]    = useState<ChatMessage[]>([]);
  const [msgLoading,  setMsgLoading]  = useState(false);
  const [msgInput,    setMsgInput]    = useState('');
  const [sending,     setSending]     = useState(false);

  // Yeni DM modal
  const [showNewDm,   setShowNewDm]   = useState(false);
  const [allUsers,    setAllUsers]    = useState<AppUser[]>([]);
  const [userSearch,  setUserSearch]  = useState('');

  // Yeni Kanal modal (sadece yonetici + ust-mudur)
  const [showNewCh,   setShowNewCh]   = useState(false);
  const [newChName,   setNewChName]   = useState('');
  const [newChEmoji,  setNewChEmoji]  = useState('💬');
  const [chCreating,  setChCreating]  = useState(false);
  const [chError,     setChError]     = useState('');

  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Liste yükle ──────────────────────────────────────────────────

  const loadList = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const [chRes, dmRes] = await Promise.allSettled([
        fetch(`${SERVER}/mesajlar/kanallar${ghostParams()}`, { headers }),
        fetch(`${SERVER}/mesajlar/dm-list${ghostParams()}`,  { headers }),
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
      console.error('[Messaging] loadList:', e);
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
      console.error('[Messaging] loadMessages:', e);
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
      pollRef.current = setInterval(() => loadMessages(true), 8_000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedCh, selectedDm, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Mesaj gönder ─────────────────────────────────────────────────

  const handleSend = async () => {
    if (!msgInput.trim() || sending || (!selectedCh && !selectedDm)) return;
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
      console.error('[Messaging] handleSend:', e);
    } finally {
      setSending(false);
    }
  };

  // ── Kanal sil ────────────────────────────────────────────────────

  const handleDeleteChannel = async (ch: Channel) => {
    if (!ch.deletable || !canManageChannels) return;
    if (!confirm(`"#${ch.name}" kanalını silmek istediğinize emin misiniz? Tüm mesajlar kaybolacak.`)) return;
    try {
      const headers = await authHeaders();
      await fetch(`${SERVER}/mesajlar/ozel-kanal/${ch.id}`, { method: 'DELETE', headers });
      await loadList();
    } catch (e) {
      console.error('[Messaging] deleteChannel:', e);
    }
  };

  // ── Yeni DM ──────────────────────────────────────────────────────

  const openNewDm = async () => {
    setShowNewDm(true);
    if (allUsers.length === 0) {
      try {
        const headers = await authHeaders();
        const res = await fetch(`${SERVER}/mesajlar/kullanicilar${ghostParams()}`, { headers });
        if (res.ok) { const d = await res.json(); setAllUsers(d.users || []); }
      } catch (e) { console.error('[Messaging] openNewDm:', e); }
    }
  };

  const startDm = (u: AppUser) => {
    setShowNewDm(false);
    setUserSearch('');
    setSelectedDm({ userId: u.id, name: u.name, role: u.role, avatar: u.avatar, lastMessage: '', lastMessageTime: null, unread: 0 });
    setSelectedCh(null);
  };

  // ── Yeni Kanal ───────────────────────────────────────────────────

  const handleCreateChannel = async () => {
    if (!newChName.trim()) { setChError('Kanal adı boş olamaz.'); return; }
    setChCreating(true);
    setChError('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`${SERVER}/mesajlar/ozel-kanal`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newChName.trim(), emoji: newChEmoji }),
      });
      const d = await res.json();
      if (res.ok) {
        setShowNewCh(false);
        setNewChName('');
        setNewChEmoji('💬');
        await loadList();
      } else {
        setChError(d.error || 'Kanal oluşturulamadı.');
      }
    } catch (e) {
      setChError('Sunucu hatası.');
      console.error('[Messaging] createChannel:', e);
    } finally {
      setChCreating(false);
    }
  };

  const goBack = () => {
    setSelectedCh(null);
    setSelectedDm(null);
    setMessages([]);
    loadList();
  };

  const isReadonly = selectedCh?.type === 'project';

  // Kanal grupları
  const staticChannels = channels.filter(c => c.type === 'channel' && !c.deletable);
  const customChannels  = channels.filter(c => c.type === 'channel' && c.deletable);
  const mekanChannels   = channels.filter(c => c.type === 'project');

  // ════════════════════════════════════════════════════════════════
  // Chat görünümü
  // ════════════════════════════════════════════════════════════════

  if (selectedCh || selectedDm) {
    const title = selectedDm ? selectedDm.name : selectedCh!.type === 'project' ? selectedCh!.name : `#${selectedCh!.name}`;
    const isProject = selectedCh?.type === 'project';

    return (
      <div className="flex flex-col" style={{ height: 'calc(100vh - 60px - 96px)' }}>

        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-white/10"
          style={{ background: 'rgba(10,5,30,0.85)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-3">
            <button onClick={goBack}
              className="w-9 h-9 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center active:scale-90 transition-all">
              <ArrowLeft className="w-4 h-4 text-white/70" />
            </button>

            {selectedDm ? (
              <InitialAvatar name={selectedDm.name} size="sm" color={roleColor(selectedDm.role)} />
            ) : (
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                ${isProject ? 'bg-gradient-to-br from-amber-500 to-orange-500' : 'bg-gradient-to-br from-violet-500 to-indigo-600'}`}>
                {selectedCh!.emoji && selectedCh!.emoji !== '#'
                  ? <span className="text-base">{selectedCh!.emoji}</span>
                  : <Hash className="w-4 h-4 text-white" />}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{title}</p>
              <div className={`flex items-center gap-1 text-[11px] ${isReadonly ? 'text-amber-400/70' : 'text-white/35'}`}>
                {isReadonly
                  ? <><Lock className="w-3 h-3" /> Salt okunur</>
                  : selectedDm
                    ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> Çevrimiçi</>
                    : 'Ekip kanalı'
                }
              </div>
            </div>

            <button onClick={() => loadMessages(true)}
              className="w-8 h-8 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center active:scale-90 transition-all">
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
              <div key={msg.id} className={`flex items-end gap-2.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
                {!isOwn && <InitialAvatar name={msg.senderName} size="sm" color={roleColor(msg.senderRole)} />}
                <div className={`max-w-[76%] ${isOwn ? 'items-end flex flex-col' : ''}`}>
                  {!isOwn && (
                    <span className="text-[11px] text-white/40 font-semibold ml-1 mb-1 block">{msg.senderName}</span>
                  )}
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                    ${isOwn
                      ? 'bg-gradient-to-br from-violet-600 to-indigo-700 text-white rounded-br-sm shadow-lg shadow-violet-900/30'
                      : 'bg-white/8 border border-white/12 text-white/90 rounded-bl-sm'
                    }`}>
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
        <div className="shrink-0 px-4 py-3 border-t border-white/8"
          style={{ background: 'rgba(10,5,30,0.85)', backdropFilter: 'blur(20px)' }}>
          {isReadonly ? (
            <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-white/5 border border-white/10">
              <Lock className="w-4 h-4 text-amber-400/70" />
              <span className="text-xs text-white/40">Bu kanal salt okunur — sadece satış logları gösterilir</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-white/5 border border-white/12 rounded-2xl px-3 py-2 focus-within:border-violet-500/40 transition-colors">
              <input
                type="text"
                value={msgInput}
                onChange={e => setMsgInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Mesaj yaz..."
                className="flex-1 bg-transparent text-sm text-white placeholder-white/25 outline-none"
                autoFocus
              />
              <button
                onClick={handleSend}
                disabled={!msgInput.trim() || sending}
                className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center shrink-0 active:scale-90 disabled:opacity-40 transition-all shadow-lg"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          )}
        </div>
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
    <div className="px-4 pb-4">

      {/* Başlık */}
      <div className="flex items-center justify-between pt-2 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-900/40">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Mesajlar</p>
            <p className="text-[10px] text-white/30">
              {canManageChannels ? 'Tüm kanallar · Kanal yöneticisi' : 'Genel kanallar'}
            </p>
          </div>
        </div>
        <button onClick={loadList}
          className="w-8 h-8 rounded-xl bg-white/6 border border-white/10 flex items-center justify-center active:scale-90 transition-all">
          <RefreshCw className="w-4 h-4 text-white/40" />
        </button>
      </div>

      {listLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full animate-spin border-2 border-violet-500/30 border-t-violet-500" />
        </div>
      ) : (
        <>
          {/* ── Sabit Kanallar ── */}
          <SectionHeader icon={<Hash className="w-3.5 h-3.5" />} label="Kanallar" />
          <div className="space-y-2">
            {staticChannels.map(ch => (
              <ChannelRow key={ch.id} channel={ch}
                onSelect={() => { setSelectedCh(ch); setSelectedDm(null); }} />
            ))}
          </div>

          {/* ── Özel Kanallar ── */}
          {(customChannels.length > 0 || canManageChannels) && (
            <>
              <div className="flex items-center gap-2 pt-5 pb-2">
                <span className="text-white/30"><Hash className="w-3.5 h-3.5" /></span>
                <span className="text-[11px] font-bold text-white/40 tracking-widest uppercase">Özel Kanallar</span>
                {canManageChannels && (
                  <button
                    onClick={() => setShowNewCh(true)}
                    className="ml-auto flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-300 hover:bg-violet-500/25 transition-all active:scale-95"
                  >
                    <Plus className="w-3 h-3" /> Yeni Kanal
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {customChannels.length === 0 && (
                  <p className="text-xs text-white/25 px-3 py-2">Henüz özel kanal yok</p>
                )}
                {customChannels.map(ch => (
                  <ChannelRow
                    key={ch.id}
                    channel={ch}
                    onSelect={() => { setSelectedCh(ch); setSelectedDm(null); }}
                    onDelete={canManageChannels ? () => handleDeleteChannel(ch) : undefined}
                    canDelete={canManageChannels}
                  />
                ))}
              </div>
            </>
          )}

          {/* ── Mekan Kanalları — sadece yonetici + ust-mudur ── */}
          {canSeeMekan && mekanChannels.length > 0 && (
            <>
              <SectionHeader icon={<Hash className="w-3.5 h-3.5" />} label="Mekan Kanalları" badge="Gizli" />
              <div className="space-y-2">
                {mekanChannels.map(ch => (
                  <ChannelRow key={ch.id} channel={ch}
                    onSelect={() => { setSelectedCh(ch); setSelectedDm(null); }} />
                ))}
              </div>
            </>
          )}

          {/* ── Direkt Mesajlar ── */}
          <SectionHeader icon={<User className="w-3.5 h-3.5" />} label="Direkt Mesajlar" />
          <div className="space-y-2">
            {dmConvs.length === 0 && (
              <p className="text-xs text-white/30 px-3 py-2">Henüz DM konuşması yok</p>
            )}
            {dmConvs.map(conv => (
              <DmRow key={conv.userId} conv={conv}
                onSelect={() => { setSelectedDm(conv); setSelectedCh(null); }} />
            ))}
          </div>

          <button onClick={openNewDm}
            className="w-full mt-4 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-violet-500/10 border border-violet-500/25 hover:bg-violet-500/18 transition-all active:scale-[0.98]">
            <Plus className="w-4 h-4 text-violet-300" />
            <span className="text-sm font-semibold text-violet-300">Yeni Mesaj</span>
          </button>
        </>
      )}

      {/* ── Yeni DM Modal ── */}
      {showNewDm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className="bg-[rgba(10,5,30,0.98)] border border-white/12 rounded-t-3xl w-full max-w-lg shadow-2xl max-h-[82vh] flex flex-col">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-violet-400" /> Yeni Mesaj
                </h2>
                <p className="text-xs text-white/30 mt-0.5">Mesaj göndermek istediğiniz kişiyi seçin</p>
              </div>
              <button onClick={() => { setShowNewDm(false); setUserSearch(''); }}
                className="w-8 h-8 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center active:scale-90 transition-all">
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>
            <div className="px-4 pt-3 pb-2 shrink-0">
              <div className="flex items-center gap-2 bg-white/5 border border-white/12 rounded-xl px-3 py-2">
                <Search className="w-4 h-4 text-white/30 shrink-0" />
                <input type="text" value={userSearch} onChange={e => setUserSearch(e.target.value)}
                  placeholder="İsim ara..."
                  className="flex-1 bg-transparent text-sm text-white placeholder-white/25 outline-none" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5 min-h-0">
              {filteredUsers.length === 0 && (
                <p className="text-xs text-white/30 text-center py-8">Kullanıcı bulunamadı</p>
              )}
              {filteredUsers.map(u => (
                <button key={u.id} onClick={() => startDm(u)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/8 bg-white/4 hover:border-white/16 hover:bg-white/8 transition-all active:scale-[0.98]">
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

      {/* ── Yeni Kanal Modal (yonetici + ust-mudur) ── */}
      {showNewCh && canManageChannels && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center">
          <div className="bg-[rgba(10,5,30,0.98)] border border-white/12 rounded-t-3xl w-full max-w-lg shadow-2xl">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Hash className="w-4 h-4 text-violet-400" /> Yeni Kanal Oluştur
                </h2>
                <p className="text-xs text-white/30 mt-0.5">Tüm ekip üyeleri bu kanalı görebilir</p>
              </div>
              <button onClick={() => { setShowNewCh(false); setNewChName(''); setChError(''); }}
                className="w-8 h-8 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center active:scale-90 transition-all">
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4">
              {/* Kanal Adı */}
              <div>
                <label className="text-xs font-bold text-white/50 uppercase tracking-widest mb-2 block">
                  Kanal Adı
                </label>
                <div className="flex items-center gap-2 bg-white/5 border border-white/12 rounded-xl px-3 py-3 focus-within:border-violet-500/50 transition-colors">
                  <Hash className="w-4 h-4 text-white/25 shrink-0" />
                  <input
                    type="text"
                    value={newChName}
                    onChange={e => { setNewChName(e.target.value); setChError(''); }}
                    placeholder="örn: duyurular, sohbet..."
                    maxLength={32}
                    className="flex-1 bg-transparent text-sm text-white placeholder-white/25 outline-none"
                    autoFocus
                  />
                  <span className="text-[11px] text-white/20 shrink-0">{newChName.length}/32</span>
                </div>
              </div>

              {/* Emoji Seçimi */}
              <div>
                <label className="text-xs font-bold text-white/50 uppercase tracking-widest mb-2 block">
                  Kanal Simgesi
                </label>
                <div className="flex flex-wrap gap-2">
                  {CHANNEL_EMOJIS.map(e => (
                    <button
                      key={e}
                      onClick={() => setNewChEmoji(e)}
                      className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all active:scale-90
                        ${newChEmoji === e
                          ? 'bg-violet-500/25 border-2 border-violet-500/60 shadow-lg shadow-violet-900/30'
                          : 'bg-white/5 border border-white/10 hover:border-white/20'
                        }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* Önizleme */}
              <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/4 border border-white/8">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/80 to-indigo-600/80 flex items-center justify-center shrink-0">
                  <span className="text-base">{newChEmoji}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    #{newChName || 'kanal-adı'}
                  </p>
                  <p className="text-[11px] text-white/30">Ekip kanalı</p>
                </div>
              </div>

              {/* Hata */}
              {chError && (
                <p className="text-xs text-red-400 text-center">{chError}</p>
              )}

              {/* Butonlar */}
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowNewCh(false); setNewChName(''); setChError(''); }}
                  className="flex-1 py-3 rounded-xl border border-white/12 text-white/50 text-sm font-semibold active:scale-[0.98] transition-all"
                >
                  İptal
                </button>
                <button
                  onClick={handleCreateChannel}
                  disabled={!newChName.trim() || chCreating}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-all shadow-lg shadow-violet-900/40"
                >
                  {chCreating
                    ? <div className="w-4 h-4 rounded-full animate-spin border-2 border-white/30 border-t-white" />
                    : <><Plus className="w-4 h-4" /> Kanal Oluştur</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
