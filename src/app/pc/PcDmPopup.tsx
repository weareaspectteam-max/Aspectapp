import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Zap } from 'lucide-react';
import { authHeaders } from '../lib/api';
import { projectId } from '../lib/supabase-info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  timestamp: string;
  urgent?: boolean;
}

interface Props {
  targetUserId: string;
  userId: string;
}

function timeShort(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
}

export function PcDmPopup({ targetUserId, userId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadMessages = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${SERVER}/mesajlar/dm/${targetUserId}`, { headers });
      if (res.ok) {
        const d = await res.json();
        setMessages(d.messages || []);
      }
    } catch (e) { console.error('[PcDmPopup] load:', e); }
    finally { setLoading(false); }
  }, [targetUserId]);

  useEffect(() => {
    loadMessages();
    pollRef.current = setInterval(() => loadMessages(true), 8_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (urgent: boolean) => {
    if (!msgInput.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`${SERVER}/mesajlar/dm/${targetUserId}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: msgInput.trim(), urgent }),
      });
      if (res.ok) {
        setMsgInput('');
        await loadMessages(true);
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Gönderilemedi');
      }
    } catch (e: any) {
      setError(e.message || 'Ağ hatası');
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {loading && messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 11, padding: 20 }}>Yükleniyor...</div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 11, padding: 20 }}>İlk mesajı sen at 👋</div>
        ) : messages.map(m => {
          const isMe = m.senderId === userId;
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
              {!isMe && <div style={{ fontSize: 10, color: '#9dd9ea', marginBottom: 2, marginLeft: 4 }}>{m.senderName}</div>}
              <div style={{
                maxWidth: '80%', padding: '8px 12px',
                background: m.urgent ? 'rgba(248,113,113,0.15)' : (isMe ? 'rgba(168,230,207,0.18)' : 'rgba(255,255,255,0.06)'),
                border: `1px solid ${m.urgent ? 'rgba(248,113,113,0.4)' : (isMe ? 'rgba(168,230,207,0.3)' : 'rgba(255,255,255,0.1)')}`,
                borderRadius: 10, fontSize: 12, color: '#fff', wordBreak: 'break-word', whiteSpace: 'pre-wrap',
              }}>
                {m.urgent && <span style={{ fontSize: 9, fontWeight: 700, color: '#f87171', marginRight: 6 }}>⚡ ACİL</span>}
                {m.content}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2, padding: '0 4px' }}>{timeShort(m.timestamp)}</div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {error && (
        <div style={{ padding: '6px 12px', fontSize: 11, color: '#f87171', background: 'rgba(248,113,113,0.1)' }}>{error}</div>
      )}
      <div style={{ padding: 10, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 6 }}>
        <input
          ref={inputRef}
          value={msgInput}
          onChange={e => setMsgInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(false); } }}
          placeholder="Mesaj yaz..."
          autoFocus
          style={{
            flex: 1, padding: '8px 12px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8, color: '#fff', fontSize: 12, outline: 'none',
          }}
        />
        <button
          onClick={() => send(false)}
          disabled={!msgInput.trim() || sending}
          title="Gönder"
          style={{
            padding: '8px 12px', background: 'rgba(168,230,207,0.2)', border: '1px solid rgba(168,230,207,0.4)',
            borderRadius: 8, color: '#a8e6cf', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            opacity: !msgInput.trim() || sending ? 0.5 : 1,
          }}
        >
          <Send size={12} />
        </button>
        <button
          onClick={() => send(true)}
          disabled={!msgInput.trim() || sending}
          title="Acil Gönder (mobilde popup olarak çıkar)"
          style={{
            padding: '8px 12px', background: 'rgba(248,113,113,0.18)', border: '1px solid rgba(248,113,113,0.45)',
            borderRadius: 8, color: '#f87171', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            opacity: !msgInput.trim() || sending ? 0.5 : 1, fontSize: 11,
          }}
        >
          <Zap size={12} /> Acil
        </button>
      </div>
    </div>
  );
}
