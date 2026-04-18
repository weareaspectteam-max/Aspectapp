import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Hash, MessageCircle, RefreshCw, Plus, X, Search } from 'lucide-react';
import { authHeaders, ghostParams } from '../../lib/api';
import { projectId } from '../../lib/supabase-info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

interface Channel {
  id: string;
  name: string;
  type: 'channel' | 'project';
  emoji?: string;
  lastMessage: string;
  lastMessageTime: string | null;
  unread: number;
}

interface DmConv {
  userId: string;
  name: string;
  role: string;
  avatar: string;
  lastMessage: string;
  lastMessageTime: string | null;
  unread: number;
}

interface Message {
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

interface Props {
  userId: string;
  initialDmUserId?: string;
}

function timeShort(ts: string | null) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
}

export function PcMesajlar({ userId, initialDmUserId }: Props) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [dmConvs, setDmConvs] = useState<DmConv[]>([]);
  const [selectedCh, setSelectedCh] = useState<Channel | null>(null);
  const [selectedDm, setSelectedDm] = useState<DmConv | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [sending, setSending] = useState(false);
  const [msgLoading, setMsgLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [showNewDm, setShowNewDm] = useState(false);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [userSearch, setUserSearch] = useState('');

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadList = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const [chRes, dmRes] = await Promise.allSettled([
        fetch(`${SERVER}/mesajlar/kanallar${ghostParams()}`, { headers }),
        fetch(`${SERVER}/mesajlar/dm-list${ghostParams()}`, { headers }),
      ]);
      if (chRes.status === 'fulfilled' && chRes.value.ok) {
        const d = await chRes.value.json();
        setChannels(d.channels || []);
      }
      if (dmRes.status === 'fulfilled' && dmRes.value.ok) {
        const d = await dmRes.value.json();
        setDmConvs(d.conversations || []);
      }
    } catch (e) { console.error('[PcMesajlar] loadList:', e); }
    finally { setListLoading(false); }
  }, []);

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
    } catch (e) { console.error('[PcMesajlar] loadMessages:', e); }
    finally { setMsgLoading(false); }
  }, [selectedCh, selectedDm]);

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

  // initialDmUserId verilmişse, o kişiyle DM'i otomatik aç
  useEffect(() => {
    if (initialDmUserId && dmConvs.length > 0 && !selectedDm && !selectedCh) {
      const conv = dmConvs.find(d => d.userId === initialDmUserId);
      if (conv) setSelectedDm(conv);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDmUserId, dmConvs]);

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
        loadList();
      }
    } catch (e) { console.error('[PcMesajlar] handleSend:', e); }
    finally {
      setSending(false);
      // Input'a tekrar odak ver
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const openNewDm = async () => {
    setShowNewDm(true);
    if (allUsers.length === 0) {
      try {
        const headers = await authHeaders();
        const res = await fetch(`${SERVER}/mesajlar/kullanicilar${ghostParams()}`, { headers });
        if (res.ok) { const d = await res.json(); setAllUsers(d.users || []); }
      } catch (e) { console.error('[PcMesajlar] openNewDm:', e); }
    }
  };

  const startDm = (u: AppUser) => {
    const existing = dmConvs.find(d => d.userId === u.id);
    if (existing) setSelectedDm(existing);
    else setSelectedDm({ userId: u.id, name: u.name, role: u.role, avatar: u.avatar, lastMessage: '', lastMessageTime: null, unread: 0 });
    setSelectedCh(null);
    setShowNewDm(false);
  };

  const titleHeader = selectedDm ? `💬 ${selectedDm.name}` : selectedCh ? `${selectedCh.emoji || '#'} ${selectedCh.name}` : '';

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {/* Sol liste */}
      <div style={{ width: 220, borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: 1 }}>SOHBETLER</span>
          <button onClick={loadList} title="Yenile" style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 2 }}>
            <RefreshCw size={12} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
          {/* KANALLAR */}
          <div style={{ fontSize: 9, fontWeight: 800, color: '#a855f7', letterSpacing: 1, padding: '6px 8px' }}>KANALLAR</div>
          {listLoading && channels.length === 0 ? (
            <div style={{ padding: 8, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>...</div>
          ) : channels.length === 0 ? (
            <div style={{ padding: 8, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>kanal yok</div>
          ) : channels.map(ch => (
            <button
              key={ch.id}
              onClick={() => { setSelectedCh(ch); setSelectedDm(null); }}
              style={{
                width: '100%', textAlign: 'left', padding: '7px 8px', background: selectedCh?.id === ch.id ? 'rgba(168,85,247,0.12)' : 'transparent',
                border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#fff', marginBottom: 2,
              }}
            >
              <Hash size={11} style={{ color: '#a855f7', flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{ch.name}</span>
              {ch.unread > 0 && <span style={{ fontSize: 9, fontWeight: 700, background: '#f87171', color: '#fff', padding: '1px 6px', borderRadius: 8 }}>{ch.unread}</span>}
            </button>
          ))}

          {/* DM */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, padding: '6px 8px' }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: '#9dd9ea', letterSpacing: 1 }}>DM'LER</span>
            <button onClick={openNewDm} title="Yeni DM" style={{ background: 'rgba(157,217,234,0.15)', border: 'none', color: '#9dd9ea', borderRadius: 4, cursor: 'pointer', padding: '2px 4px', display: 'flex' }}>
              <Plus size={11} />
            </button>
          </div>
          {dmConvs.length === 0 ? (
            <div style={{ padding: 8, fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>DM yok</div>
          ) : dmConvs.map(d => (
            <button
              key={d.userId}
              onClick={() => { setSelectedDm(d); setSelectedCh(null); }}
              style={{
                width: '100%', textAlign: 'left', padding: '7px 8px', background: selectedDm?.userId === d.userId ? 'rgba(157,217,234,0.12)' : 'transparent',
                border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#fff', marginBottom: 2,
              }}
            >
              <span style={{ fontSize: 12 }}>{d.avatar || '👤'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                {d.lastMessage && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.lastMessage}</div>}
              </div>
              {d.unread > 0 && <span style={{ fontSize: 9, fontWeight: 700, background: '#f87171', color: '#fff', padding: '1px 6px', borderRadius: 8 }}>{d.unread}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Sağ — sohbet alanı */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {(!selectedCh && !selectedDm) ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: 'rgba(255,255,255,0.4)' }}>
            <MessageCircle size={42} />
            <div style={{ fontSize: 13 }}>Bir sohbet seç</div>
          </div>
        ) : (
          <>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 13, fontWeight: 800, color: '#fff' }}>
              {titleHeader}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {msgLoading && messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 11, padding: 20 }}>Yükleniyor...</div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 11, padding: 20 }}>henüz mesaj yok</div>
              ) : messages.map(m => {
                const isMe = m.senderId === userId;
                return (
                  <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    {!isMe && <div style={{ fontSize: 10, color: '#9dd9ea', marginBottom: 2, marginLeft: 4 }}>{m.senderName}</div>}
                    <div style={{
                      maxWidth: '75%', padding: '8px 12px',
                      background: isMe ? 'rgba(168,230,207,0.18)' : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${isMe ? 'rgba(168,230,207,0.3)' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: 10, fontSize: 12, color: '#fff', wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                    }}>
                      {m.content}
                    </div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2, padding: '0 4px' }}>{timeShort(m.timestamp)}</div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
            <div style={{ padding: 10, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 8 }}>
              <input
                ref={inputRef}
                value={msgInput}
                onChange={e => setMsgInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Mesaj yaz..."
                autoFocus
                style={{
                  flex: 1, padding: '8px 12px',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8, color: '#fff', fontSize: 12, outline: 'none',
                }}
              />
              <button
                onClick={handleSend}
                disabled={!msgInput.trim() || sending}
                style={{
                  padding: '8px 14px', background: 'rgba(168,230,207,0.2)', border: '1px solid rgba(168,230,207,0.4)',
                  borderRadius: 8, color: '#a8e6cf', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                  opacity: !msgInput.trim() || sending ? 0.5 : 1,
                }}
              >
                <Send size={12} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Yeni DM modalı */}
      {showNewDm && (
        <div onClick={() => setShowNewDm(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 320, maxHeight: '80%', background: 'rgba(20,15,50,0.98)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 12, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Yeni DM</span>
              <button onClick={() => setShowNewDm(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}><X size={14} /></button>
            </div>
            <div style={{ padding: 10, position: 'relative' }}>
              <Search size={12} style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
              <input
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Personel ara..."
                style={{ width: '100%', padding: '6px 10px 6px 28px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: '#fff', fontSize: 11, outline: 'none' }}
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px 10px' }}>
              {allUsers.filter(u => u.id !== userId && (!userSearch || u.name.toLowerCase().includes(userSearch.toLowerCase()))).map(u => (
                <button key={u.id} onClick={() => startDm(u)} style={{ width: '100%', textAlign: 'left', padding: '8px 10px', background: 'transparent', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ fontSize: 14 }}>{u.avatar || '👤'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{u.name}</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{u.role}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
