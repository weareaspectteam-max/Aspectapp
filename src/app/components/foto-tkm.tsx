/**
 * Kare Coin & Fotoğraf TKM
 * 📷 Kamera (Taş) vs 🎞️ Film (Kağıt) vs ✂️ Makas
 * Sanal para: Kare (KR) — hoş geldin bonusu + günlük bonus + transfer + bahis
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, Coins, Send, Clock, Trophy, RefreshCw, Loader2,
  ChevronRight, Copy, Check, Zap, Plus, Users, LogIn,
  TrendingUp, TrendingDown, Minus, Gift,
} from 'lucide-react';
import { Camera, Aperture } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { authHeaders } from '../lib/api';
import { projectId } from '../lib/supabase-info';

const API = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

// ─── Types ─────────────────────────────────────────────────────────────────────
type MainTab  = 'game' | 'wallet' | 'scores';
type GameView = 'lobby' | 'solo' | 'multi-lobby' | 'multi-create' | 'multi-wait' | 'multi-join' | 'multi-play';
type Choice   = 'kamera' | 'film' | 'makas';

interface Wallet {
  balance: number;
  lastDailyBonus: number | null;
  canClaim: boolean;
  nextClaimMs: number;
}

interface TkmRoom {
  code: string;
  bet: number;
  hostId: string;
  hostName: string;
  hostCompanyId: string;
  hostChoice: string | null;
  guestId: string | null;
  guestName: string | null;
  guestCompanyId: string | null;
  guestChoice: string | null;
  status: 'waiting' | 'choosing' | 'finished';
  winner: 'host' | 'guest' | 'draw' | 'timeout' | null;
  pot: number;
}

interface Props {
  userName: string;
  userId: string;
  userCompanyId: string;
  accessToken: string;
  onBack: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
async function api(method: string, path: string, body?: any) {
  const headers = await authHeaders();
  const res = await fetch(`${API}${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

const fmt = (n: number) => n.toLocaleString('tr-TR');

// ─── Choice definitions ────────────────────────────────────────────────────────
const CHOICES: { id: Choice; emoji: string; label: string; beats: Choice; color: string }[] = [
  { id: 'kamera', emoji: '📷', label: 'Kamera',  beats: 'makas', color: '#9dd9ea' },
  { id: 'film',   emoji: '🎞️', label: 'Film',    beats: 'kamera', color: '#d4b5f7' },
  { id: 'makas',  emoji: '✂️', label: 'Makas',   beats: 'film',  color: '#ffd4a3' },
];

function choiceColor(c: Choice | null | string) {
  if (!c || c === '?') return 'rgba(255,255,255,0.3)';
  return CHOICES.find(x => x.id === c)?.color || '#fff';
}

function choiceEmoji(c: Choice | null | string) {
  if (!c) return '❓';
  if (c === '?') return '🎴';
  return CHOICES.find(x => x.id === c)?.emoji || '❓';
}

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  cyan:   '#9dd9ea',
  purple: '#d4b5f7',
  orange: '#ffd4a3',
  blue:   '#a7c7e7',
  green:  '#6ee7b7',
  red:    '#f87171',
  glass:  'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.10)',
};

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.glass,
      border: `1px solid ${C.border}`,
      backdropFilter: 'blur(20px)',
      borderRadius: 20,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function FotoTkm({ userName, userId, userCompanyId, accessToken, onBack }: Props) {
  const [tab, setTab]         = useState<MainTab>('game');
  const [gameView, setGameView] = useState<GameView>('lobby');
  const [wallet, setWallet]   = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [msg, setMsg]         = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Solo game (bahissiz — sadece istatistik)
  const [soloChoice, setSoloChoice]   = useState<Choice | null>(null);
  const [soloResult, setSoloResult]   = useState<any>(null);
  const [soloPlaying, setSoloPlaying] = useState(false);

  // Multiplayer
  const [room, setRoom]         = useState<TkmRoom | null>(null);
  const [myChoice, setMyChoice] = useState<Choice | null>(null);
  const [betAmount, setBetAmount] = useState(50);
  const [joinCode, setJoinCode] = useState('');
  const [openRooms, setOpenRooms] = useState<any[]>([]);
  const [copied, setCopied]     = useState(false);

  // Wallet
  const [companyUsers, setCompanyUsers]   = useState<any[]>([]);
  const [sendTo, setSendTo]               = useState<any>(null);
  const [sendAmount, setSendAmount]       = useState('');
  const [sendNote, setSendNote]           = useState('');
  const [history, setHistory]             = useState<any[]>([]);
  const [histLoading, setHistLoading]     = useState(false);
  const [claimLoading, setClaimLoading]   = useState(false);
  const [countdownStr, setCountdownStr]   = useState('');

  // Scores
  const [richlist, setRichlist]     = useState<any[]>([]);
  const [tkmLb, setTkmLb]           = useState<any[]>([]);
  const [scoresTab, setScoresTab]   = useState<'rich' | 'tkm'>('rich');
  const [lbLoading, setLbLoading]   = useState(false);

  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadWallet();
    return () => {
      clearPoll();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Countdown for daily bonus ────────────────────────────────────────────────
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!wallet?.nextClaimMs) { setCountdownStr(''); return; }
    const tick = () => {
      if (!wallet) return;
      const remaining = wallet.nextClaimMs - (Date.now() - (wallet.lastDailyBonus || Date.now()));
      if (remaining <= 0) { setCountdownStr(''); loadWallet(); return; }
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setCountdownStr(`${h}s ${m}d ${s}sn`);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [wallet?.nextClaimMs, wallet?.lastDailyBonus]);

  const clearPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  const loadWallet = async () => {
    try {
      const d = await api('GET', '/kare/wallet/me');
      if (d.ok) setWallet(d.wallet);
    } catch (e) { console.warn('[Kare] wallet load:', e); }
  };

  const startPolling = useCallback((code: string) => {
    clearPoll();
    pollRef.current = setInterval(async () => {
      try {
        const d = await api('GET', `/tkm/room/${code}`);
        if (d.ok && d.room) {
          setRoom(d.room);
          if (d.room.status === 'finished') {
            clearPoll();
            loadWallet(); // balance güncelle
          }
          if (d.room.status === 'choosing' && gameView === 'multi-wait') {
            setGameView('multi-play');
          }
        }
      } catch (e) { console.warn('[TKM] poll:', e); }
    }, 2000);
  }, [gameView]);

  const showMsg = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3500);
  };

  // ── Solo game ────────────────────────────────────────────────────────────────
  const handleSoloPlay = async (c: Choice) => {
    setSoloPlaying(true);
    setSoloResult(null);
    try {
      const d = await api('POST', '/tkm/solo', { choice: c, bet: 0 });
      if (!d.ok) { showMsg('err', d.error || 'Hata'); return; }
      setSoloResult(d);
      setSoloChoice(c);
      setGameView('solo');
    } catch (e) { showMsg('err', 'Bağlantı hatası'); }
    finally { setSoloPlaying(false); }
  };

  // ── Multiplayer ──────────────────────────────────────────────────────────────
  const handleCreateRoom = async () => {
    if (!wallet || wallet.balance < betAmount) { showMsg('err', 'Yetersiz Kare bakiyesi!'); return; }
    setLoading(true);
    try {
      const d = await api('POST', '/tkm/room/create', { bet: betAmount });
      if (!d.ok) { showMsg('err', d.error || 'Oda oluşturulamadı'); return; }
      setRoom(d.room);
      setMyChoice(null);
      setGameView('multi-wait');
      startPolling(d.room.code);
    } catch (e) { showMsg('err', 'Bağlantı hatası'); }
    finally { setLoading(false); }
  };

  const handleLoadOpenRooms = async () => {
    try {
      const d = await api('GET', '/tkm/rooms/open');
      if (d.ok) setOpenRooms(d.rooms || []);
    } catch (e) { console.warn('[TKM] open rooms:', e); }
  };

  const handleQuickMatch = async () => {
    if (!wallet || wallet.balance < betAmount) { showMsg('err', 'Yetersiz Kare bakiyesi!'); return; }
    setLoading(true);
    try {
      const rd = await api('GET', '/tkm/rooms/open');
      const rooms = rd.ok ? (rd.rooms || []) : [];
      const eligible = rooms.filter((r: any) => r.bet === betAmount);
      if (eligible.length > 0) {
        const target = eligible[0];
        const d = await api('POST', '/tkm/room/join', { code: target.code });
        if (!d.ok) { showMsg('err', d.error || 'Katılınamadı'); return; }
        setRoom(d.room);
        setMyChoice(null);
        setGameView('multi-play');
        startPolling(d.room.code);
        loadWallet();
      } else {
        const d = await api('POST', '/tkm/room/create', { bet: betAmount });
        if (!d.ok) { showMsg('err', d.error || 'Oda oluşturulamadı'); return; }
        setRoom(d.room);
        setMyChoice(null);
        setGameView('multi-wait');
        startPolling(d.room.code);
        showMsg('ok', 'Oda kuruldu! Rakip bekleniyor…');
      }
    } catch (e) { showMsg('err', 'Bağlantı hatası'); }
    finally { setLoading(false); }
  };

  const handleJoinRoom = async (code?: string) => {
    const c = (code || joinCode).toUpperCase().trim();
    if (!c) { showMsg('err', 'Oda kodu gerekli'); return; }
    setLoading(true);
    try {
      const d = await api('POST', '/tkm/room/join', { code: c });
      if (!d.ok) { showMsg('err', d.error || 'Katılınamadı'); return; }
      setRoom(d.room);
      setMyChoice(null);
      setGameView('multi-play');
      startPolling(d.room.code);
      loadWallet();
    } catch (e) { showMsg('err', 'Bağlantı hatası'); }
    finally { setLoading(false); }
  };

  const handleChoose = async (c: Choice) => {
    if (!room || myChoice) return;
    setMyChoice(c);
    try {
      const d = await api('POST', `/tkm/room/${room.code}/choose`, { choice: c });
      if (d.ok) setRoom(d.room);
    } catch (e) { console.warn('[TKM] choose:', e); }
  };

  const handleLeaveRoom = async () => {
    if (room) await api('POST', `/tkm/room/${room.code}/leave`).catch(() => {});
    clearPoll();
    setRoom(null);
    setMyChoice(null);
    loadWallet();
    setGameView('multi-lobby');
  };

  // ── Wallet ────────────────────────────────────────────────────────────────────
  const handleClaimBonus = async () => {
    setClaimLoading(true);
    try {
      const d = await api('POST', '/kare/wallet/claim');
      if (d.ok) {
        showMsg('ok', `+${fmt(d.amount)} KR kazandınız! ${d.isNew ? '🎉 Hoş geldiniz!' : '📅 Günlük bonus!'}`);
        loadWallet();
      } else {
        showMsg('err', d.error || 'Bonus alınamadı');
      }
    } catch (e) { showMsg('err', 'Bağlantı hatası'); }
    finally { setClaimLoading(false); }
  };

  const handleLoadCompanyUsers = async () => {
    try {
      const d = await api('GET', '/kare/wallet/company-users');
      if (d.ok) setCompanyUsers(d.users || []);
    } catch (e) { console.warn('[Kare] company users:', e); }
  };

  const handleSend = async () => {
    if (!sendTo || !sendAmount) { showMsg('err', 'Alıcı ve miktar gereklidir'); return; }
    const amount = parseInt(sendAmount);
    if (isNaN(amount) || amount < 1) { showMsg('err', 'Geçersiz miktar'); return; }
    if (!wallet || wallet.balance < amount) { showMsg('err', 'Yetersiz bakiye'); return; }
    setLoading(true);
    try {
      const d = await api('POST', '/kare/wallet/send', { toUserId: sendTo.userId, amount, note: sendNote });
      if (d.ok) {
        showMsg('ok', `✅ ${fmt(amount)} KR → ${sendTo.userName}`);
        setSendAmount(''); setSendNote(''); setSendTo(null);
        loadWallet();
        handleLoadCompanyUsers();
      } else {
        showMsg('err', d.error || 'Gönderme hatası');
      }
    } catch (e) { showMsg('err', 'Bağlantı hatası'); }
    finally { setLoading(false); }
  };

  const handleLoadHistory = async () => {
    setHistLoading(true);
    try {
      const d = await api('GET', '/kare/wallet/history');
      if (d.ok) setHistory(d.history || []);
    } catch (e) { console.warn('[Kare] history:', e); }
    finally { setHistLoading(false); }
  };

  const handleLoadScores = async () => {
    setLbLoading(true);
    try {
      const [r, l] = await Promise.all([
        api('GET', '/kare/richlist'),
        api('GET', '/tkm/leaderboard'),
      ]);
      if (r.ok) setRichlist(r.richlist || []);
      if (l.ok) setTkmLb(l.leaderboard || []);
    } catch (e) { console.warn('[Kare] scores:', e); }
    finally { setLbLoading(false); }
  };

  // Tab change effects
  useEffect(() => {
    if (tab === 'wallet') { handleLoadCompanyUsers(); handleLoadHistory(); }
    if (tab === 'scores') handleLoadScores();
    if (tab === 'game' && gameView === 'multi-lobby') handleLoadOpenRooms();
  }, [tab, gameView]);

  const isHost   = room?.hostId === userId;
  const oppName  = isHost
    ? (room?.guestCompanyId === userCompanyId ? room?.guestName : 'Gizemli Rakip') ?? 'Rakip'
    : (room?.hostCompanyId  === userCompanyId ? room?.hostName  : 'Gizemli Rakip') ?? 'Rakip';
  const myRoomChoice  = isHost ? room?.hostChoice  : room?.guestChoice;
  const oppRoomChoice = isHost ? room?.guestChoice : room?.hostChoice;
  const iWon = room?.winner === (isHost ? 'host' : 'guest');
  const isDraw = room?.winner === 'draw';
  const isTimeout = room?.winner === 'timeout';

  const txIcon = (type: string) => {
    if (type === 'bonus') return '🎁';
    if (type === 'receive') return '📥';
    if (type === 'send') return '📤';
    if (type === 'tkm_win') return '🏆';
    if (type === 'tkm_lose') return '💸';
    if (type === 'tkm_draw') return '🤝';
    return '💰';
  };

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'inherit',
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: '16px 16px 0',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button
            onClick={gameView !== 'lobby' && gameView !== 'solo' && tab === 'game'
              ? () => { clearPoll(); setRoom(null); setMyChoice(null); setSoloResult(null); setGameView('lobby'); }
              : onBack}
            style={{
              width: 36, height: 36, borderRadius: 12, flexShrink: 0,
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <ArrowLeft style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.7)' }} />
          </button>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 20 }}>📷✂️🎞️</span>
              <span style={{ color: '#fff', fontWeight: 900, fontSize: 16 }}>Foto TKM</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, margin: 0 }}>
              Kamera · Film · Makas — Kare Coin ile oyna
            </p>
          </div>

          {/* Wallet chip */}
          {wallet !== null && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 20,
              background: 'linear-gradient(135deg, rgba(255,212,163,0.2), rgba(255,212,163,0.08))',
              border: '1px solid rgba(255,212,163,0.35)',
            }}>
              <span style={{ fontSize: 14 }}>💰</span>
              <span style={{ color: C.orange, fontWeight: 900, fontSize: 14 }}>
                {fmt(wallet.balance)}
              </span>
              <span style={{ color: 'rgba(255,212,163,0.6)', fontSize: 10, fontWeight: 700 }}>KR</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {([
            { id: 'game' as MainTab,   label: '🎮 Oyun' },
            { id: 'wallet' as MainTab, label: '💰 Cüzdan' },
            { id: 'scores' as MainTab, label: '🏆 Skor' },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setError(null); }}
              style={{
                flex: 1, padding: '9px 4px', borderRadius: 12, cursor: 'pointer',
                background: tab === t.id ? 'rgba(157,217,234,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${tab === t.id ? 'rgba(157,217,234,0.4)' : 'rgba(255,255,255,0.08)'}`,
                color: tab === t.id ? C.cyan : 'rgba(255,255,255,0.4)',
                fontWeight: tab === t.id ? 800 : 500, fontSize: 13,
                transition: 'all 0.2s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toast message */}
      <AnimatePresence>
        {msg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{
              margin: '0 16px 8px', padding: '10px 16px', borderRadius: 12,
              background: msg.type === 'ok' ? 'rgba(110,231,183,0.15)' : 'rgba(248,113,113,0.15)',
              border: `1px solid ${msg.type === 'ok' ? 'rgba(110,231,183,0.35)' : 'rgba(248,113,113,0.35)'}`,
              color: msg.type === 'ok' ? C.green : C.red,
              fontSize: 13, fontWeight: 600, flexShrink: 0,
            }}
          >
            {msg.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 80px' }}>
        <AnimatePresence mode="wait">

          {/* ══ GAME TAB ══ */}
          {tab === 'game' && (
            <motion.div key={`game-${gameView}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

              {/* ── LOBBY ── */}
              {gameView === 'lobby' && (
                <>
                  {/* Rules card */}
                  <Card style={{ padding: 16, marginBottom: 14 }}>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, margin: '0 0 10px', letterSpacing: '0.1em' }}>KAZANMA KURALLARI</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[
                        { a: '📷', b: '✂️', label: 'Kamera > Makas' },
                        { a: '🎞️', b: '📷', label: 'Film > Kamera' },
                        { a: '✂️', b: '🎞️', label: 'Makas > Film' },
                      ].map(r => (
                        <div key={r.label} style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: 10, background: 'rgba(255,255,255,0.04)' }}>
                          <p style={{ margin: '0 0 4px', fontSize: 18 }}>{r.a} › {r.b}</p>
                          <p style={{ margin: 0, color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>{r.label}</p>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Mode selector */}
                  <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    {[
                      { icon: '🤖', label: 'Solo Oyna', sub: 'vs Bilgisayar · Anında', action: () => { setSoloResult(null); setSoloChoice(null); setGameView('solo'); } },
                      { icon: '👥', label: 'Rakip Bul', sub: 'Canlı Multiplayer', action: () => { handleLoadOpenRooms(); setGameView('multi-lobby'); } },
                    ].map(m => (
                      <motion.button
                        key={m.label}
                        onClick={m.action}
                        whileTap={{ scale: 0.96 }}
                        style={{
                          flex: 1, padding: '16px 12px', borderRadius: 16, cursor: 'pointer',
                          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                          textAlign: 'center',
                        }}
                      >
                        <div style={{ fontSize: 28, marginBottom: 6 }}>{m.icon}</div>
                        <p style={{ color: '#fff', fontWeight: 800, fontSize: 14, margin: '0 0 4px' }}>{m.label}</p>
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, margin: 0 }}>{m.sub}</p>
                      </motion.button>
                    ))}
                  </div>
                </>
              )}

              {/* ── SOLO ── */}
              {gameView === 'solo' && (
                <>
                  {/* Choice buttons */}
                  {!soloResult && (
                    <Card style={{ padding: 20, marginBottom: 14 }}>
                      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, margin: '0 0 16px', textAlign: 'center' }}>
                        {soloPlaying ? '🎲 Zar atılıyor...' : '📸 Seçimini Yap!'}
                      </p>
                      <div style={{ display: 'flex', gap: 12 }}>
                        {CHOICES.map(ch => (
                          <motion.button
                            key={ch.id}
                            onClick={() => !soloPlaying && handleSoloPlay(ch.id)}
                            whileTap={!soloPlaying ? { scale: 0.92 } : {}}
                            whileHover={!soloPlaying ? { scale: 1.05 } : {}}
                            disabled={soloPlaying}
                            style={{
                              flex: 1, padding: '20px 8px', borderRadius: 18, cursor: soloPlaying ? 'default' : 'pointer',
                              background: `linear-gradient(135deg, ${ch.color}18, ${ch.color}08)`,
                              border: `1px solid ${ch.color}35`,
                              textAlign: 'center', opacity: soloPlaying ? 0.5 : 1,
                            }}
                          >
                            <div style={{ fontSize: 36, marginBottom: 6 }}>{ch.emoji}</div>
                            <p style={{ color: ch.color, fontWeight: 700, fontSize: 13, margin: 0 }}>{ch.label}</p>
                          </motion.button>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* Solo Result */}
                  {soloResult && (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                      <Card style={{ padding: 24, marginBottom: 14, textAlign: 'center' }}>
                        {/* Versus display */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 20 }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 52 }}>{choiceEmoji(soloResult.playerChoice)}</div>
                            <p style={{ color: C.cyan, fontSize: 12, fontWeight: 700, margin: '6px 0 0' }}>Sen</p>
                          </div>
                          <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.2)', fontWeight: 900 }}>VS</div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 52 }}>{choiceEmoji(soloResult.computerChoice)}</div>
                            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 700, margin: '6px 0 0' }}>Bilgisayar</p>
                          </div>
                        </div>

                        {/* Result banner */}
                        <div style={{
                          padding: '14px 20px', borderRadius: 16, marginBottom: 16,
                          background: soloResult.result === 'win'
                            ? 'linear-gradient(135deg, rgba(110,231,183,0.2), rgba(110,231,183,0.08))'
                            : soloResult.result === 'lose'
                              ? 'linear-gradient(135deg, rgba(248,113,113,0.2), rgba(248,113,113,0.08))'
                              : 'rgba(255,255,255,0.07)',
                          border: `1px solid ${soloResult.result === 'win' ? 'rgba(110,231,183,0.4)' : soloResult.result === 'lose' ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.1)'}`,
                        }}>
                          <div style={{ fontSize: 32, marginBottom: 8 }}>
                            {soloResult.result === 'win' ? '🏆' : soloResult.result === 'lose' ? '😔' : '🤝'}
                          </div>
                          <p style={{
                            color: soloResult.result === 'win' ? C.green : soloResult.result === 'lose' ? C.red : '#fff',
                            fontWeight: 900, fontSize: 20, margin: 0,
                          }}>
                            {soloResult.result === 'win' ? 'Kare Senin! 🎯' : soloResult.result === 'lose' ? 'Rakip Kazandı' : 'Beraberlik 🤝'}
                          </p>
                        </div>

                        <div style={{ display: 'flex', gap: 10 }}>
                          <button
                            onClick={() => { setSoloResult(null); setSoloChoice(null); }}
                            style={{
                              flex: 1, padding: '12px', borderRadius: 14, cursor: 'pointer',
                              background: `linear-gradient(135deg, ${C.cyan}30, ${C.cyan}15)`,
                              border: `1px solid ${C.cyan}50`,
                              color: '#fff', fontWeight: 800, fontSize: 14,
                            }}
                          >
                            <RefreshCw style={{ width: 15, height: 15, display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                            Tekrar Oyna
                          </button>
                          <button
                            onClick={() => setGameView('lobby')}
                            style={{
                              padding: '12px 16px', borderRadius: 14, cursor: 'pointer',
                              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                              color: 'rgba(255,255,255,0.5)', fontWeight: 600, fontSize: 13,
                            }}
                          >
                            Çık
                          </button>
                        </div>
                      </Card>
                    </motion.div>
                  )}
                </>
              )}

              {/* ── MULTI LOBBY ── */}
              {gameView === 'multi-lobby' && (
                <>
                  {/* ── HIZLI EŞLEŞMEa ── */}
                  <Card style={{
                    padding: 20, marginBottom: 14,
                    background: 'linear-gradient(135deg, rgba(157,217,234,0.1), rgba(212,181,247,0.08))',
                    border: '1px solid rgba(157,217,234,0.25)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <span style={{ fontSize: 24 }}>⚡</span>
                      <div>
                        <p style={{ color: '#fff', fontWeight: 900, fontSize: 15, margin: 0 }}>Hızlı Eşleşme</p>
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, margin: 0 }}>
                          Seni otomatik rakiple eşleştirir — kod gerekmez!
                        </p>
                      </div>
                    </div>
                    {/* Bahis seçici */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                      {[25, 50, 100, 250, 500].map(b => {
                        const waiting = openRooms.filter((r: any) => r.bet === b).length;
                        return (
                          <button
                            key={b}
                            onClick={() => setBetAmount(b)}
                            style={{
                              flex: 1, padding: '8px 4px', borderRadius: 10, cursor: 'pointer',
                              background: betAmount === b ? `${C.cyan}25` : 'rgba(255,255,255,0.05)',
                              border: `1px solid ${betAmount === b ? C.cyan + '60' : 'rgba(255,255,255,0.1)'}`,
                              color: betAmount === b ? C.cyan : 'rgba(255,255,255,0.4)',
                              fontWeight: betAmount === b ? 800 : 500, fontSize: 12,
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                            }}
                          >
                            <span>{b}</span>
                            <span style={{
                              fontSize: 9, fontWeight: 700,
                              color: waiting > 0 ? '#6ee7b7' : 'rgba(255,255,255,0.2)',
                            }}>
                              {waiting > 0 ? `${waiting}⚡` : '—'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={handleQuickMatch}
                      disabled={loading}
                      style={{
                        width: '100%', padding: '14px', borderRadius: 14, cursor: loading ? 'default' : 'pointer',
                        background: loading ? 'rgba(255,255,255,0.05)' : `linear-gradient(135deg, ${C.cyan}40, ${C.purple}30)`,
                        border: `1px solid ${loading ? 'rgba(255,255,255,0.08)' : C.cyan + '50'}`,
                        color: loading ? 'rgba(255,255,255,0.4)' : '#fff',
                        fontWeight: 900, fontSize: 16,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      }}
                    >
                      {loading
                        ? <><Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> Bağlanıyor…</>
                        : <><span style={{ fontSize: 18 }}>⚡</span> Hızlı Eşleş — {fmt(betAmount)} KR</>}
                    </button>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, textAlign: 'center', margin: '10px 0 0' }}>
                      Uygun rakip yoksa oda kurulur ve beklenir 🕐
                    </p>
                  </Card>

                  {/* How-to card */}
                  <Card style={{ padding: 16, marginBottom: 14 }}>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, margin: '0 0 10px', letterSpacing: '0.1em' }}>YA DA ÖZEL ODA</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        { n: '1', icon: '🏠', text: 'Bahis miktarını seç ve "Oda Kur" a bas.' },
                        { n: '2', icon: '🔗', text: 'Rakibine 4 haneli oda kodunu gönder (mesaj, telefon…)' },
                        { n: '3', icon: '📷', text: "İkiniz de seçiminizi yapın — kazanan pot'u alır!" },
                        { n: '4', icon: '🎭', text: 'Başka şirketten rakipler "Gizemli Meslektaş" olarak görünür.' },
                      ].map(s => (
                        <div key={s.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: 8, flexShrink: 0, marginTop: 1,
                            background: 'rgba(212,181,247,0.15)', border: '1px solid rgba(212,181,247,0.25)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: C.purple, fontSize: 11, fontWeight: 800,
                          }}>{s.n}</div>
                          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                            <span style={{ marginRight: 4 }}>{s.icon}</span>{s.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* Özel Oda Kur */}
                  <Card style={{ padding: 16, marginBottom: 14 }}>
                    <button
                      onClick={handleCreateRoom}
                      disabled={loading}
                      style={{
                        width: '100%', padding: '12px', borderRadius: 14, cursor: loading ? 'default' : 'pointer',
                        background: `linear-gradient(135deg, ${C.purple}30, ${C.purple}15)`,
                        border: `1px solid ${C.purple}45`,
                        color: 'rgba(255,255,255,0.8)', fontWeight: 700, fontSize: 14,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      }}
                    >
                      {loading
                        ? <Loader2 style={{ width: 15, height: 15 }} className="animate-spin" />
                        : <Plus style={{ width: 15, height: 15 }} />}
                      Özel Oda Kur — {fmt(betAmount)} KR
                    </button>
                  </Card>

                  {/* Join by code */}
                  <Card style={{ padding: 18, marginBottom: 14 }}>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, margin: '0 0 10px' }}>KOD İLE KATIL</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        value={joinCode}
                        onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
                        placeholder="AX47"
                        maxLength={4}
                        style={{
                          flex: 1, padding: '12px 14px', borderRadius: 12,
                          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                          color: '#fff', fontSize: 20, fontWeight: 900, textAlign: 'center',
                          outline: 'none', letterSpacing: '0.3em',
                        }}
                      />
                      <button
                        onClick={() => handleJoinRoom()}
                        disabled={joinCode.length < 4 || loading}
                        style={{
                          padding: '12px 20px', borderRadius: 12, cursor: joinCode.length === 4 ? 'pointer' : 'default',
                          background: joinCode.length === 4 ? `${C.cyan}25` : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${joinCode.length === 4 ? C.cyan + '50' : 'rgba(255,255,255,0.1)'}`,
                          color: joinCode.length === 4 ? C.cyan : 'rgba(255,255,255,0.3)',
                          fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap',
                        }}
                      >
                        Katıl
                      </button>
                    </div>
                  </Card>

                  {/* Open rooms */}
                  {openRooms.length > 0 && (
                    <Card style={{ padding: 16 }}>
                      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, margin: '0 0 10px' }}>AÇIK ODALAR</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {openRooms.map(r => {
                          const isSameCompany = r.hostCompanyId === userCompanyId;
                          const displayHost = isSameCompany ? r.hostName : 'Gizemli Meslektaş';
                          return (
                          <div key={r.code} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 12px', borderRadius: 12,
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                          }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ color: C.cyan, fontWeight: 900, fontSize: 16, letterSpacing: '0.2em' }}>{r.code}</span>
                                <span style={{ fontSize: 10, color: isSameCompany ? 'rgba(157,217,234,0.6)' : 'rgba(212,181,247,0.5)', fontStyle: isSameCompany ? 'normal' : 'italic' }}>
                                  {isSameCompany ? '👤' : '🎭'} {displayHost}
                                </span>
                              </div>
                              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, margin: '2px 0 0' }}>
                                Bahis: <span style={{ color: C.orange, fontWeight: 700 }}>{fmt(r.bet)} KR</span>
                              </p>
                            </div>
                            <button
                              onClick={() => handleJoinRoom(r.code)}
                              style={{
                                padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
                                background: `${C.cyan}20`, border: `1px solid ${C.cyan}40`,
                                color: C.cyan, fontWeight: 700, fontSize: 13,
                              }}
                            >
                              Katıl
                            </button>
                          </div>
                          );
                        })}
                      </div>
                    </Card>
                  )}
                </>
              )}

              {/* ── MULTI WAIT ── */}
              {gameView === 'multi-wait' && room && (
                <Card style={{ padding: 28, textAlign: 'center' }}>
                  <motion.div
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    style={{ fontSize: 52, marginBottom: 14 }}
                  >
                    📷
                  </motion.div>
                  <h3 style={{ color: '#fff', fontWeight: 900, fontSize: 20, margin: '0 0 6px' }}>Rakip Bekleniyor...</h3>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 4 }}>
                    Hızlı eşleşme kullananlar otomatik gelir ⚡
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginBottom: 20 }}>
                    Ya da arkadaşına kodu ver
                  </p>
                  <div style={{
                    background: 'rgba(255,255,255,0.06)', borderRadius: 16,
                    border: `2px solid ${C.orange}40`, padding: '18px 24px', marginBottom: 12,
                  }}>
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', margin: '0 0 6px' }}>ODA KODU</p>
                    <p style={{ color: C.orange, fontSize: 40, fontWeight: 900, margin: '0 0 6px', letterSpacing: '0.4em' }}>{room.code}</p>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: 0 }}>
                      Bahis: <span style={{ color: C.orange, fontWeight: 700 }}>{fmt(room.bet)} KR</span> · Pot: {fmt(room.bet * 2)} KR
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
                    <Loader2 style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.3)' }} className="animate-spin" />
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Bağlantı bekleniyor...</span>
                  </div>
                  <button
                    onClick={handleLeaveRoom}
                    style={{
                      width: '100%', padding: '11px', borderRadius: 12, cursor: 'pointer',
                      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                      color: C.red, fontWeight: 700, fontSize: 14,
                    }}
                  >
                    İptal Et
                  </button>
                </Card>
              )}

              {/* ── MULTI PLAY ── */}
              {gameView === 'multi-play' && room && (
                <>
                  {/* Score */}
                  <Card style={{ padding: '12px 16px', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ color: C.cyan, fontSize: 11, fontWeight: 700, margin: '0 0 2px' }}>Sen</p>
                        <p style={{ color: '#fff', fontSize: 24, fontWeight: 900, margin: 0 }}>
                          {myRoomChoice ? (room.status === 'finished' ? choiceEmoji(myRoomChoice) : '🎴') : '❓'}
                        </p>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, margin: '0 0 2px' }}>BAHIS</p>
                        <p style={{ color: C.orange, fontWeight: 900, fontSize: 18, margin: 0 }}>{fmt(room.pot || room.bet * 2)} KR</p>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, margin: '0 0 2px' }}>{oppName}</p>
                        <p style={{ color: '#fff', fontSize: 24, fontWeight: 900, margin: 0 }}>
                          {oppRoomChoice ? (room.status === 'finished' ? choiceEmoji(oppRoomChoice) : '🎴') : '❓'}
                        </p>
                      </div>
                    </div>
                  </Card>

                  {/* Choosing */}
                  {room.status === 'choosing' && !myChoice && (
                    <Card style={{ padding: 20, marginBottom: 12 }}>
                      <p style={{ color: '#fff', fontWeight: 800, fontSize: 15, textAlign: 'center', margin: '0 0 16px' }}>
                        📸 Seçimini Yap!
                      </p>
                      <div style={{ display: 'flex', gap: 12 }}>
                        {CHOICES.map(ch => (
                          <motion.button
                            key={ch.id}
                            onClick={() => handleChoose(ch.id)}
                            whileTap={{ scale: 0.9 }}
                            whileHover={{ scale: 1.06 }}
                            style={{
                              flex: 1, padding: '20px 8px', borderRadius: 18, cursor: 'pointer',
                              background: `linear-gradient(135deg, ${ch.color}18, ${ch.color}08)`,
                              border: `1px solid ${ch.color}40`,
                              textAlign: 'center',
                            }}
                          >
                            <div style={{ fontSize: 38, marginBottom: 6 }}>{ch.emoji}</div>
                            <p style={{ color: ch.color, fontWeight: 700, fontSize: 13, margin: 0 }}>{ch.label}</p>
                          </motion.button>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* Waiting for opponent */}
                  {room.status === 'choosing' && myChoice && (
                    <Card style={{ padding: 24, textAlign: 'center', marginBottom: 12 }}>
                      <div style={{ fontSize: 48, marginBottom: 12 }}>{choiceEmoji(myChoice)}</div>
                      <p style={{ color: '#fff', fontWeight: 800, fontSize: 16, margin: '0 0 6px' }}>
                        {CHOICES.find(c => c.id === myChoice)?.label} seçildi!
                      </p>
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Rakip seçim yapıyor...</p>
                      <Loader2 style={{ width: 24, height: 24, color: C.purple, margin: '12px auto 0', display: 'block' }} className="animate-spin" />
                    </Card>
                  )}

                  {/* Result */}
                  {room.status === 'finished' && (
                    <motion.div initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }}>
                      <Card style={{
                        padding: 24, textAlign: 'center', marginBottom: 12,
                        border: `1px solid ${iWon ? 'rgba(110,231,183,0.4)' : isDraw ? 'rgba(255,255,255,0.15)' : 'rgba(248,113,113,0.3)'}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 20 }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 48 }}>{choiceEmoji(myRoomChoice)}</div>
                            <p style={{ color: C.cyan, fontSize: 11, fontWeight: 700, margin: '4px 0 0' }}>Sen</p>
                          </div>
                          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 22, fontWeight: 900 }}>VS</span>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 48 }}>{choiceEmoji(oppRoomChoice)}</div>
                            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, margin: '4px 0 0' }}>{oppName}</p>
                          </div>
                        </div>

                        <div style={{ fontSize: 36, marginBottom: 8 }}>
                          {isTimeout ? '⏱️' : iWon ? '🏆' : isDraw ? '🤝' : '😔'}
                        </div>
                        <p style={{
                          color: iWon ? C.green : isDraw ? '#fff' : C.red,
                          fontWeight: 900, fontSize: 22, margin: '0 0 6px',
                        }}>
                          {isTimeout ? 'Süre Doldu!' : iWon ? 'Kare Senin! 🎯' : isDraw ? 'Beraberlik 🤝' : 'Rakip Kazandı'}
                        </p>
                        {!isTimeout && (
                          <p style={{
                            color: iWon ? C.green : isDraw ? 'rgba(255,255,255,0.5)' : C.red,
                            fontSize: 20, fontWeight: 800, margin: '0 0 16px',
                          }}>
                            {iWon ? `+${fmt(room.bet)} KR` : isDraw ? '±0 KR' : `-${fmt(room.bet)} KR`}
                          </p>
                        )}

                        <div style={{ display: 'flex', gap: 10 }}>
                          <button
                            onClick={() => { clearPoll(); setMyChoice(null); handleLoadOpenRooms(); setGameView('multi-lobby'); }}
                            style={{
                              flex: 1, padding: '12px', borderRadius: 12, cursor: 'pointer',
                              background: `linear-gradient(135deg, ${C.cyan}25, ${C.cyan}12)`,
                              border: `1px solid ${C.cyan}45`,
                              color: '#fff', fontWeight: 800, fontSize: 14,
                            }}
                          >
                            Yeni Oyun
                          </button>
                          <button
                            onClick={() => { clearPoll(); setRoom(null); setMyChoice(null); setGameView('lobby'); }}
                            style={{
                              padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                              color: 'rgba(255,255,255,0.5)', fontWeight: 600, fontSize: 13,
                            }}
                          >
                            Çık
                          </button>
                        </div>
                      </Card>
                    </motion.div>
                  )}

                  {/* Leave button (while playing) */}
                  {room.status !== 'finished' && (
                    <button
                      onClick={handleLeaveRoom}
                      style={{
                        width: '100%', padding: '10px', borderRadius: 12, cursor: 'pointer',
                        background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)',
                        color: 'rgba(248,113,113,0.7)', fontWeight: 600, fontSize: 13,
                      }}
                    >
                      Odadan Ayrıl (bahis iade edilir)
                    </button>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* ══ WALLET TAB ══ */}
          {tab === 'wallet' && (
            <motion.div key="wallet" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

              {/* Balance card */}
              <div style={{
                padding: 24, borderRadius: 24, marginBottom: 16,
                background: 'linear-gradient(135deg, rgba(255,212,163,0.18), rgba(212,181,247,0.12))',
                border: '1px solid rgba(255,212,163,0.3)',
                backdropFilter: 'blur(20px)',
                textAlign: 'center',
              }}>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, margin: '0 0 8px', letterSpacing: '0.15em' }}>KARE BAKİYENİZ</p>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ color: C.orange, fontWeight: 900, fontSize: 46 }}>{fmt(wallet?.balance ?? 0)}</span>
                  <span style={{ color: 'rgba(255,212,163,0.6)', fontWeight: 700, fontSize: 18 }}>KR</span>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, margin: '0 0 16px' }}>💰 Kare Coin</p>

                {/* Claim button */}
                <button
                  onClick={handleClaimBonus}
                  disabled={claimLoading || (wallet?.canClaim === false)}
                  style={{
                    width: '100%', padding: '13px', borderRadius: 14, cursor: wallet?.canClaim !== false ? 'pointer' : 'default',
                    background: wallet?.canClaim !== false
                      ? 'linear-gradient(135deg, rgba(110,231,183,0.3), rgba(110,231,183,0.15))'
                      : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${wallet?.canClaim !== false ? 'rgba(110,231,183,0.5)' : 'rgba(255,255,255,0.1)'}`,
                    color: wallet?.canClaim !== false ? C.green : 'rgba(255,255,255,0.3)',
                    fontWeight: 800, fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {claimLoading
                    ? <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
                    : <Gift style={{ width: 16, height: 16 }} />}
                  {wallet?.canClaim !== false
                    ? (wallet?.lastDailyBonus == null ? '🎉 500 KR Hoş Geldin Bonusu Al!' : '📅 100 KR Günlük Bonus Al!')
                    : `⏳ Bir sonraki bonus: ${countdownStr || '...'}`}
                </button>
              </div>

              {/* Send money */}
              <Card style={{ padding: 18, marginBottom: 14 }}>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Send style={{ width: 12, height: 12 }} /> PARA GÖNDER (Aynı Şirket)
                </p>

                {/* Recipient selector */}
                {companyUsers.length === 0 ? (
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
                    Şirketinizde cüzdan açmış başka oyuncu yok
                  </p>
                ) : (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, maxHeight: 160, overflow: 'auto' }}>
                      {companyUsers.map(u => (
                        <button
                          key={u.userId}
                          onClick={() => setSendTo(sendTo?.userId === u.userId ? null : u)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                            background: sendTo?.userId === u.userId ? `${C.cyan}15` : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${sendTo?.userId === u.userId ? C.cyan + '45' : 'rgba(255,255,255,0.08)'}`,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 10, background: `${C.cyan}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>👤</div>
                            <div>
                              <p style={{ color: sendTo?.userId === u.userId ? C.cyan : '#fff', fontWeight: 700, fontSize: 13, margin: 0 }}>{u.userName}</p>
                              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, margin: 0 }}>{fmt(u.balance)} KR</p>
                            </div>
                          </div>
                          {sendTo?.userId === u.userId && <Check style={{ width: 14, height: 14, color: C.cyan }} />}
                        </button>
                      ))}
                    </div>

                    <AnimatePresence>
                      {sendTo && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                          <input
                            type="number"
                            value={sendAmount}
                            onChange={e => setSendAmount(e.target.value)}
                            placeholder={`Miktar (max ${fmt(wallet?.balance || 0)} KR)`}
                            style={{
                              width: '100%', padding: '11px 14px', borderRadius: 12, marginBottom: 8,
                              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                              color: '#fff', fontSize: 15, fontWeight: 700, outline: 'none', boxSizing: 'border-box',
                            }}
                          />
                          <input
                            value={sendNote}
                            onChange={e => setSendNote(e.target.value)}
                            placeholder="Not (opsiyonel)"
                            style={{
                              width: '100%', padding: '10px 14px', borderRadius: 12, marginBottom: 10,
                              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                              color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                            }}
                          />
                          <button
                            onClick={handleSend}
                            disabled={loading || !sendAmount}
                            style={{
                              width: '100%', padding: '12px', borderRadius: 12, cursor: 'pointer',
                              background: `linear-gradient(135deg, ${C.cyan}30, ${C.cyan}15)`,
                              border: `1px solid ${C.cyan}50`,
                              color: '#fff', fontWeight: 800, fontSize: 14,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            }}
                          >
                            {loading ? <Loader2 style={{ width: 15, height: 15 }} className="animate-spin" /> : <Send style={{ width: 15, height: 15 }} />}
                            {sendTo.userName}'a Gönder
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </Card>

              {/* Transaction history */}
              <Card style={{ padding: 16 }}>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock style={{ width: 12, height: 12 }} /> İŞLEM GEÇMİŞİ
                </p>
                {histLoading ? (
                  <div style={{ textAlign: 'center', padding: 20 }}>
                    <Loader2 style={{ width: 24, height: 24, color: C.cyan }} className="animate-spin" />
                  </div>
                ) : history.length === 0 ? (
                  <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>Henüz işlem yok</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {history.map((tx, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', borderRadius: 12,
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 20 }}>{txIcon(tx.type)}</span>
                          <div>
                            <p style={{ color: '#fff', fontWeight: 600, fontSize: 13, margin: 0 }}>{tx.note}</p>
                            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, margin: '2px 0 0' }}>
                              {new Date(tx.createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <span style={{
                          color: tx.delta > 0 ? C.green : tx.delta < 0 ? C.red : 'rgba(255,255,255,0.4)',
                          fontWeight: 800, fontSize: 15,
                        }}>
                          {tx.delta > 0 ? '+' : ''}{fmt(tx.delta)} KR
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </motion.div>
          )}

          {/* ══ SCORES TAB ══ */}
          {tab === 'scores' && (
            <motion.div key="scores" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

              {/* Sub-tabs */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {([
                  { id: 'rich' as const, label: '💰 En Zenginler' },
                  { id: 'tkm'  as const, label: '📷 TKM Sıralaması' },
                ]).map(t => (
                  <button
                    key={t.id}
                    onClick={() => setScoresTab(t.id)}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 12, cursor: 'pointer',
                      background: scoresTab === t.id ? `${C.orange}18` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${scoresTab === t.id ? C.orange + '45' : 'rgba(255,255,255,0.08)'}`,
                      color: scoresTab === t.id ? C.orange : 'rgba(255,255,255,0.4)',
                      fontWeight: scoresTab === t.id ? 800 : 500, fontSize: 13,
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {lbLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}>
                  <Loader2 style={{ width: 32, height: 32, color: C.orange }} className="animate-spin" />
                </div>
              ) : scoresTab === 'rich' ? (
                richlist.length === 0 ? (
                  <Card style={{ padding: 24, textAlign: 'center' }}>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>Henüz zengin yok 💸 İlk bonus al!</p>
                  </Card>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {richlist.map((entry, idx) => (
                      <Card key={entry.userId} style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                            background: idx === 0 ? 'linear-gradient(135deg,#fbbf24,#f59e0b)' : idx === 1 ? 'linear-gradient(135deg,#94a3b8,#64748b)' : idx === 2 ? 'linear-gradient(135deg,#b45309,#92400e)' : 'rgba(255,255,255,0.08)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: idx < 3 ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: 900, fontSize: 14,
                          }}>
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{
                              color: entry.isSameCompany ? '#fff' : 'rgba(255,255,255,0.4)',
                              fontWeight: entry.isSameCompany ? 700 : 400, fontSize: 14, margin: 0,
                              fontStyle: entry.isSameCompany ? 'normal' : 'italic',
                            }}>
                              {entry.isSameCompany ? '👤 ' : '🎭 '}{entry.displayName}
                            </p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ color: C.orange, fontWeight: 900, fontSize: 18, margin: 0 }}>{fmt(entry.balance)}</p>
                            <p style={{ color: 'rgba(255,212,163,0.5)', fontSize: 10, margin: 0, fontWeight: 700 }}>KR</p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )
              ) : (
                tkmLb.length === 0 ? (
                  <Card style={{ padding: 24, textAlign: 'center' }}>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>Henüz oyun oynayan yok. İlk sen ol! 📷</p>
                  </Card>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {tkmLb.map((entry, idx) => (
                      <Card key={entry.userId} style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                            background: idx === 0 ? 'linear-gradient(135deg,#fbbf24,#f59e0b)' : idx < 3 ? 'rgba(212,181,247,0.2)' : 'rgba(255,255,255,0.08)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: idx < 3 ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: 900, fontSize: 14,
                          }}>
                            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{
                              color: entry.isSameCompany ? '#fff' : 'rgba(255,255,255,0.4)',
                              fontWeight: entry.isSameCompany ? 700 : 400, fontSize: 14, margin: 0,
                              fontStyle: entry.isSameCompany ? 'normal' : 'italic',
                            }}>
                              {entry.isSameCompany ? '👤 ' : '🎭 '}{entry.displayName}
                            </p>
                            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, margin: '2px 0 0' }}>
                              {entry.losses}K · {entry.draws}B
                            </p>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <p style={{ color: C.green, fontWeight: 900, fontSize: 20, margin: 0 }}>{entry.wins}</p>
                            <p style={{ color: 'rgba(110,231,183,0.5)', fontSize: 10, margin: 0, fontWeight: 700 }}>GALİBİYET</p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
