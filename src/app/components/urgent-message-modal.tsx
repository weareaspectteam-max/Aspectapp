import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Send, Zap } from 'lucide-react';
import { authHeaders, ghostParams } from '../lib/api';
import { projectId } from '../lib/supabase-info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;
const POLL_MS = 5_000;

interface UrgentMsg {
  id: string;
  fromUserId: string;
  fromName: string;
  fromRole?: string;
  content: string;
  timestamp: string;
}

interface Props {
  isLoggedIn: boolean;
}

export function UrgentMessageModal({ isLoggedIn }: Props) {
  const [urgent, setUrgent] = useState<UrgentMsg | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkUrgent = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${SERVER}/mesajlar/acil${ghostParams()}`, { headers });
      if (res.ok) {
        const d = await res.json();
        setUrgent(prev => {
          const next = d.message || null;
          if (!next) return null;
          if (!prev || prev.id !== next.id) return next;
          return prev;
        });
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!isLoggedIn) { setUrgent(null); return; }
    checkUrgent();
    pollRef.current = setInterval(checkUrgent, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isLoggedIn, checkUrgent]);

  const markRead = useCallback(async () => {
    try {
      const headers = await authHeaders();
      await fetch(`${SERVER}/mesajlar/acil/okundu`, { method: 'POST', headers });
    } catch {}
    setUrgent(null);
    setReply('');
    setError('');
  }, []);

  const handleClose = () => { markRead(); };

  const handleReply = async (replyUrgent: boolean) => {
    if (!reply.trim() || !urgent || sending) return;
    setSending(true);
    setError('');
    try {
      const headers = await authHeaders();
      const res = await fetch(`${SERVER}/mesajlar/dm/${urgent.fromUserId}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: reply.trim(), urgent: replyUrgent }),
      });
      if (res.ok) {
        await markRead();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Gönderilemedi');
      }
    } catch (e: any) {
      setError(e.message || 'Ağ hatası');
    } finally {
      setSending(false);
    }
  };

  if (!urgent) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(15, 5, 30, 0.92)', backdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'rgba(30, 10, 40, 0.98)', border: '2px solid rgba(248,113,113,0.5)',
        borderRadius: 20, boxShadow: '0 20px 80px rgba(248,113,113,0.3)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(248,113,113,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(248,113,113,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={18} color="#f87171" />
            <span style={{ fontSize: 14, fontWeight: 800, color: '#f87171', letterSpacing: 1 }}>ACİL MESAJ</span>
          </div>
          <button onClick={handleClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 20px' }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
            Gönderen: <b style={{ color: '#fff' }}>{urgent.fromName}</b>
          </div>
          <div style={{
            padding: 14, borderRadius: 10,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            fontSize: 15, color: '#fff', fontWeight: 500, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {urgent.content}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 6, textAlign: 'right' }}>
            {new Date(urgent.timestamp).toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
          </div>
        </div>

        {/* Reply */}
        <div style={{ padding: '12px 20px 18px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontWeight: 600 }}>Cevap:</div>
          <textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(false); } }}
            placeholder="Cevap yaz..."
            rows={2}
            style={{
              width: '100%', padding: 10,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none', resize: 'none', fontFamily: 'inherit',
            }}
          />
          {error && <div style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              onClick={() => handleReply(false)}
              disabled={!reply.trim() || sending}
              style={{
                flex: 1, padding: '10px 12px',
                background: 'rgba(168,230,207,0.2)', border: '1px solid rgba(168,230,207,0.4)',
                borderRadius: 10, color: '#a8e6cf', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                opacity: !reply.trim() || sending ? 0.5 : 1,
              }}
            >
              <Send size={13} /> Gönder
            </button>
            <button
              onClick={() => handleReply(true)}
              disabled={!reply.trim() || sending}
              title="Acil cevap (karşı tarafa popup çıkarır)"
              style={{
                padding: '10px 14px',
                background: 'rgba(248,113,113,0.2)', border: '1px solid rgba(248,113,113,0.5)',
                borderRadius: 10, color: '#f87171', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                opacity: !reply.trim() || sending ? 0.5 : 1,
              }}
            >
              <Zap size={13} /> Acil
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
