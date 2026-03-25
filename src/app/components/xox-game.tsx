/**
 * XOX Oyunu — Fotoğrafçılık temalı cross-company multiplayer Tic-tac-toe
 * 📷 (Camera) vs 🔆 (Aperture)
 * Glassmorphism stilinde, inline CSS, koyu mor tema
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera, Aperture, ArrowLeft, Plus, LogIn, Zap, Trophy,
  RefreshCw, Copy, Check, Eye, EyeOff, Loader2, X, Lock,
  Globe, Users, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { authHeaders } from '../lib/api';
import { projectId } from '../lib/supabase-info';

const API = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

// ─── Types ────────────────────────────────────────────────────────────────────
type View = 'lobby' | 'create' | 'waiting' | 'join' | 'quickmatch' | 'game' | 'leaderboard';

interface Room {
  code: string;
  type: 'open' | 'private';
  password?: string;
  hostId: string;
  hostName: string;
  hostCompanyId: string;
  guestId: string | null;
  guestName: string | null;
  guestCompanyId: string | null;
  status: 'waiting' | 'playing' | 'finished';
  board: string[];
  currentTurn: 'X' | 'O';
  winner: string | null;
  winLine: number[] | null;
  hostScore: number;
  guestScore: number;
  draws: number;
  rematchRequestBy: string | null;
  createdAt: number;
  lastMoveAt: number;
}

interface LeaderboardEntry {
  userId: string;
  displayName: string;
  companyId: string;
  isSameCompany: boolean;
  wins: number;
  losses: number;
  draws: number;
}

interface Props {
  userName: string;
  userId: string;
  userCompanyId: string;
  accessToken: string;
  onBack: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function apiCall(method: string, path: string, body?: any): Promise<any> {
  const headers = await authHeaders();
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// ─── Colour palette ──────────────────────────────────────────────────────────
const COL = {
  cyan:   '#9dd9ea',
  purple: '#d4b5f7',
  orange: '#ffd4a3',
  blue:   '#a7c7e7',
  glass:  'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.10)',
  glow:   (c: string, a = 0.35) => `0 0 20px ${c}${Math.round(a * 255).toString(16).padStart(2, '0')}`,
};

// ─── Cell Component ───────────────────────────────────────────────────────────
function Cell({
  value, index, onClick, isWinCell, disabled,
}: {
  value: string; index: number; onClick: () => void; isWinCell: boolean; disabled: boolean;
}) {
  const isEmpty = value === '';

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || !isEmpty}
      whileTap={isEmpty && !disabled ? { scale: 0.92 } : {}}
      whileHover={isEmpty && !disabled ? { scale: 1.05 } : {}}
      style={{
        width: '100%',
        aspectRatio: '1',
        borderRadius: 16,
        background: isWinCell
          ? `linear-gradient(135deg, ${COL.cyan}22, ${COL.purple}22)`
          : value === 'X'
            ? `rgba(157, 217, 234, 0.08)`
            : value === 'O'
              ? `rgba(212, 181, 247, 0.08)`
              : 'rgba(255,255,255,0.04)',
        border: isWinCell
          ? `2px solid ${value === 'X' ? COL.cyan : COL.purple}`
          : value === 'X'
            ? `1px solid rgba(157,217,234,0.35)`
            : value === 'O'
              ? `1px solid rgba(212,181,247,0.35)`
              : '1px solid rgba(255,255,255,0.08)',
        boxShadow: isWinCell
          ? `0 0 24px ${value === 'X' ? COL.cyan : COL.purple}55`
          : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isEmpty && !disabled ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
        transition: 'background 0.2s, border 0.2s, box-shadow 0.2s',
      }}
    >
      {/* Film frame corner marks */}
      {[
        { top: 4, left: 4 }, { top: 4, right: 4 },
        { bottom: 4, left: 4 }, { bottom: 4, right: 4 },
      ].map((pos, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: 6, height: 6,
            borderTop: i < 2 ? `1.5px solid rgba(255,255,255,0.15)` : 'none',
            borderBottom: i >= 2 ? `1.5px solid rgba(255,255,255,0.15)` : 'none',
            borderLeft: i % 2 === 0 ? `1.5px solid rgba(255,255,255,0.15)` : 'none',
            borderRight: i % 2 === 1 ? `1.5px solid rgba(255,255,255,0.15)` : 'none',
            ...pos,
          }}
        />
      ))}

      <AnimatePresence>
        {value === 'X' && (
          <motion.div
            initial={{ scale: 0, rotate: -30, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', damping: 14, stiffness: 300 }}
          >
            <Camera
              style={{
                width: 36, height: 36,
                color: isWinCell ? '#fff' : COL.cyan,
                filter: isWinCell ? `drop-shadow(0 0 8px ${COL.cyan})` : 'none',
              }}
              strokeWidth={1.6}
            />
          </motion.div>
        )}
        {value === 'O' && (
          <motion.div
            initial={{ scale: 0, rotate: 30, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', damping: 14, stiffness: 300 }}
          >
            <Aperture
              style={{
                width: 36, height: 36,
                color: isWinCell ? '#fff' : COL.purple,
                filter: isWinCell ? `drop-shadow(0 0 8px ${COL.purple})` : 'none',
              }}
              strokeWidth={1.6}
            />
          </motion.div>
        )}
        {isEmpty && !disabled && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }}
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ─── Glass Card ───────────────────────────────────────────────────────────────
function GlassCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: COL.glass,
      border: `1px solid ${COL.border}`,
      backdropFilter: 'blur(20px)',
      borderRadius: 20,
      padding: 20,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function XoxGame({ userName, userId, userCompanyId, accessToken, onBack }: Props) {
  const [view, setView]         = useState<View>('lobby');
  const [room, setRoom]         = useState<Room | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Create room form
  const [createType, setCreateType]     = useState<'open' | 'private'>('open');
  const [createPass, setCreatePass]     = useState('');
  const [showPass, setShowPass]         = useState(false);

  // Join form
  const [joinCode, setJoinCode]         = useState('');
  const [joinPass, setJoinPass]         = useState('');
  const [joinShowPass, setJoinShowPass] = useState(false);
  const [openRooms, setOpenRooms]       = useState<any[]>([]);

  // Leaderboard
  const [leaderboard, setLeaderboard]   = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading]       = useState(false);

  // Copy code
  const [copied, setCopied]             = useState(false);

  // Polling
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const roomCode = useRef<string | null>(null);

  const clearPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  // ── Polling loop ────────────────────────────────────────────────────────────
  const startPolling = useCallback((code: string) => {
    roomCode.current = code;
    clearPoll();
    pollRef.current = setInterval(async () => {
      try {
        const data = await apiCall('GET', `/xox/room/${code}`);
        if (data.ok && data.room) {
          setRoom(data.room);
          if (data.room.status === 'playing' || data.room.status === 'finished') {
            setView('game');
          }
        }
      } catch (e) {
        console.warn('[XOX] poll error:', e);
      }
    }, 2000);
  }, []);

  useEffect(() => () => clearPoll(), []);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const goLobby = () => {
    clearPoll();
    setRoom(null);
    setError(null);
    setView('lobby');
  };

  const handleCreateRoom = async () => {
    if (createType === 'private' && createPass.length < 2) {
      setError('Şifre en az 2 karakter olmalıdır');
      return;
    }
    setLoading(true); setError(null);
    try {
      const data = await apiCall('POST', '/xox/room/create', { type: createType, password: createPass });
      if (!data.ok) { setError(data.error || 'Oda oluşturulamadı'); return; }
      setRoom(data.room);
      startPolling(data.room.code);
      setView('waiting');
    } catch (e) { setError('Bağlantı hatası'); }
    finally { setLoading(false); }
  };

  const handleJoinRoom = async (code?: string, pass?: string) => {
    const c = (code || joinCode).toUpperCase().trim();
    const p = pass ?? joinPass;
    if (!c) { setError('Oda kodu gereklidir'); return; }
    setLoading(true); setError(null);
    try {
      const data = await apiCall('POST', '/xox/room/join', { code: c, password: p });
      if (!data.ok) { setError(data.error || 'Odaya katılınamadı'); return; }
      setRoom(data.room);
      startPolling(data.room.code);
      setView('game');
    } catch (e) { setError('Bağlantı hatası'); }
    finally { setLoading(false); }
  };

  const handleQuickMatch = async () => {
    setLoading(true); setError(null); setView('quickmatch');
    try {
      const data = await apiCall('POST', '/xox/quickmatch');
      if (!data.ok) { setError(data.error || 'Eşleşme hatası'); setView('lobby'); return; }
      setRoom(data.room);
      startPolling(data.room.code);
      if (data.action === 'joined') setView('game');
      else setView('waiting');
    } catch (e) { setError('Bağlantı hatası'); setView('lobby'); }
    finally { setLoading(false); }
  };

  const handleMove = async (cellIndex: number) => {
    if (!room) return;
    const mySymbol = room.hostId === userId ? 'X' : 'O';
    if (room.currentTurn !== mySymbol || room.status !== 'playing') return;
    if (room.board[cellIndex] !== '') return;

    // Optimistic update
    const newBoard = [...room.board];
    newBoard[cellIndex] = mySymbol;
    setRoom(prev => prev ? { ...prev, board: newBoard } : prev);

    try {
      const data = await apiCall('POST', `/xox/room/${room.code}/move`, { cellIndex });
      if (data.ok) setRoom(data.room);
    } catch (e) { console.warn('[XOX] move error:', e); }
  };

  const handleRematch = async () => {
    if (!room) return;
    try {
      const data = await apiCall('POST', `/xox/room/${room.code}/rematch`);
      if (data.ok) setRoom(data.room);
    } catch (e) { console.warn('[XOX] rematch error:', e); }
  };

  const handleLeave = async () => {
    if (room) {
      await apiCall('POST', `/xox/room/${room.code}/leave`).catch(() => {});
    }
    goLobby();
  };

  const handleLoadOpenRooms = async () => {
    try {
      const data = await apiCall('GET', '/xox/rooms/open');
      if (data.ok) setOpenRooms(data.rooms || []);
    } catch (e) { console.warn('[XOX] open rooms error:', e); }
  };

  const handleLoadLeaderboard = async () => {
    setLbLoading(true);
    try {
      const data = await apiCall('GET', '/xox/leaderboard');
      if (data.ok) setLeaderboard(data.leaderboard || []);
    } catch (e) { console.warn('[XOX] lb error:', e); }
    finally { setLbLoading(false); }
  };

  const copyCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Derived state ────────────────────────────────────────────────────────────
  const isHost    = room?.hostId === userId;
  const mySymbol  = isHost ? 'X' : 'O';
  const myName    = isHost ? room?.hostName : room?.guestName;
  const oppName   = isHost ? (room?.guestCompanyId === userCompanyId ? room?.guestName : 'Gizemli Rakip') : (room?.hostCompanyId === userCompanyId ? room?.hostName : 'Gizemli Rakip');
  const isMyTurn  = room?.currentTurn === mySymbol && room?.status === 'playing';
  const myScore   = isHost ? (room?.hostScore || 0) : (room?.guestScore || 0);
  const oppScore  = isHost ? (room?.guestScore || 0) : (room?.hostScore || 0);

  const winnerLabel = (() => {
    if (!room?.winner) return null;
    if (room.winner === 'draw') return 'Pozlama Dengesi ⚖️';
    if (room.winner === 'timeout') return 'Süre Doldu ⏱️';
    const winSym = room.winner;
    const iWon = winSym === mySymbol;
    return iWon ? 'Kare Senin! 🏆' : 'Rakip Kazandı 📸';
  })();

  const rematchRequested = room?.rematchRequestBy === userId;
  const rematchPending   = room?.rematchRequestBy && room.rematchRequestBy !== userId;

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%)',
      padding: '16px 16px 80px',
      fontFamily: 'inherit',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={view === 'lobby' ? onBack : (view === 'game' || view === 'waiting') ? handleLeave : goLobby}
          style={{
            width: 36, height: 36, borderRadius: 12,
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
        >
          <ArrowLeft style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.7)' }} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Camera style={{ width: 18, height: 18, color: COL.cyan }} strokeWidth={1.8} />
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: '0.02em' }}>
              Fotoğraf XOX
            </span>
            <Aperture style={{ width: 18, height: 18, color: COL.purple }} strokeWidth={1.8} />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>
            {view === 'lobby' ? 'Stüdyo seç veya oda kur' :
             view === 'waiting' ? `Oda: ${room?.code} · Fotoğrafçı aranıyor...` :
             view === 'game' ? `Oda: ${room?.code}` :
             view === 'leaderboard' ? 'Hall of Fame' :
             view === 'create' ? 'Yeni Stüdyo Aç' :
             view === 'join' ? 'Objektife Gir' : 'Hızlı Eşleşme'}
          </p>
        </div>
        {/* Error badge */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '4px 10px' }}>
            <span style={{ color: '#f87171', fontSize: 11 }}>{error}</span>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* ── LOBBY ── */}
        {view === 'lobby' && (
          <motion.div key="lobby" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            {/* Hero */}
            <GlassCard style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>📷</div>
              <h2 style={{ color: '#fff', fontWeight: 900, fontSize: 22, margin: 0 }}>Fotoğraf XOX</h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 6, marginBottom: 0 }}>
                Lens vs Kamera · Cross-company multiplayer
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 14 }}>
                <div style={{ textAlign: 'center' }}>
                  <Camera style={{ width: 22, height: 22, color: COL.cyan, margin: '0 auto 4px' }} strokeWidth={1.6} />
                  <span style={{ color: COL.cyan, fontSize: 11, fontWeight: 700 }}>📷 Sen</span>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 20, alignSelf: 'center' }}>vs</span>
                <div style={{ textAlign: 'center' }}>
                  <Aperture style={{ width: 22, height: 22, color: COL.purple, margin: '0 auto 4px' }} strokeWidth={1.6} />
                  <span style={{ color: COL.purple, fontSize: 11, fontWeight: 700 }}>Diyafram Rakip</span>
                </div>
              </div>
            </GlassCard>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: <Plus style={{ width: 18, height: 18 }} />, label: 'Stüdyo Aç 🎬', sub: 'Açık veya şifreli oda kur', color: COL.cyan, action: () => { setError(null); setView('create'); } },
                { icon: <LogIn style={{ width: 18, height: 18 }} />, label: 'Objektife Gir 📸', sub: 'Kod ile odaya katıl', color: COL.purple, action: () => { setError(null); handleLoadOpenRooms(); setView('join'); } },
                { icon: <Zap style={{ width: 18, height: 18 }} />, label: 'Fotoğrafçı Bul ⚡', sub: 'Anında rastgele eşleşme', color: COL.orange, action: handleQuickMatch },
                { icon: <Trophy style={{ width: 18, height: 18 }} />, label: 'Hall of Fame 🖼️', sub: 'Liderboard & istatistikler', color: COL.blue, action: () => { handleLoadLeaderboard(); setView('leaderboard'); } },
              ].map(({ icon, label, sub, color, action }) => (
                <motion.button
                  key={label}
                  onClick={action}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 16,
                    background: `linear-gradient(135deg, ${color}10, ${color}05)`,
                    border: `1px solid ${color}30`,
                    cursor: 'pointer', width: '100%', textAlign: 'left',
                  }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}18`, border: `1px solid ${color}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
                    {icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: '#fff', fontWeight: 700, fontSize: 14, margin: 0 }}>{label}</p>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '2px 0 0' }}>{sub}</p>
                  </div>
                  <ChevronRight style={{ width: 14, height: 14, color: `${color}60` }} />
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── CREATE ── */}
        {view === 'create' && (
          <motion.div key="create" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <GlassCard>
              <h3 style={{ color: '#fff', fontWeight: 800, fontSize: 17, margin: '0 0 20px' }}>🎬 Stüdyo Aç</h3>

              {/* Type Tabs */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {([
                  { type: 'open' as const, icon: <Globe style={{ width: 14, height: 14 }} />, label: 'Açık Stüdyo' },
                  { type: 'private' as const, icon: <Lock style={{ width: 14, height: 14 }} />, label: 'Özel Çekim' },
                ]).map(({ type, icon, label }) => (
                  <button
                    key={type}
                    onClick={() => setCreateType(type)}
                    style={{
                      flex: 1, padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                      background: createType === type ? `${COL.cyan}20` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${createType === type ? COL.cyan + '50' : 'rgba(255,255,255,0.1)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      color: createType === type ? COL.cyan : 'rgba(255,255,255,0.5)',
                      fontWeight: createType === type ? 700 : 500, fontSize: 13,
                      transition: 'all 0.2s',
                    }}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>

              {/* Password field */}
              <AnimatePresence>
                {createType === 'private' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ marginBottom: 20, overflow: 'hidden' }}
                  >
                    <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                      Şifre (Arkadaşlarınızla paylaşın)
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPass ? 'text' : 'password'}
                        value={createPass}
                        onChange={e => setCreatePass(e.target.value)}
                        placeholder="Özel çekim şifresi..."
                        style={{
                          width: '100%', padding: '12px 44px 12px 14px',
                          borderRadius: 12, background: 'rgba(255,255,255,0.07)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                        }}
                      />
                      <button
                        onClick={() => setShowPass(!showPass)}
                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}
                      >
                        {showPass ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Info */}
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '10px 14px', marginBottom: 20 }}>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, margin: 0 }}>
                  {createType === 'open'
                    ? '🌍 Açık Stüdyo — Herkes görebilir ve katılabilir. Rakibin kimliği gizli kalır.'
                    : '🔒 Özel Çekim — Sadece şifreyi bilenlere özel. 4 haneli oda kodu + şifre gerekir.'}
                </p>
              </div>

              {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</p>}

              <button
                onClick={handleCreateRoom}
                disabled={loading}
                style={{
                  width: '100%', padding: '14px', borderRadius: 14, cursor: loading ? 'default' : 'pointer',
                  background: `linear-gradient(135deg, ${COL.cyan}40, ${COL.cyan}20)`,
                  border: `1px solid ${COL.cyan}50`,
                  color: '#fff', fontWeight: 800, fontSize: 15,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {loading ? <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" /> : <Plus style={{ width: 18, height: 18 }} />}
                {loading ? 'Stüdyo Kuruluyor...' : 'Stüdyo Aç 🎬'}
              </button>
            </GlassCard>
          </motion.div>
        )}

        {/* ── JOIN ── */}
        {view === 'join' && (
          <motion.div key="join" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <GlassCard style={{ marginBottom: 16 }}>
              <h3 style={{ color: '#fff', fontWeight: 800, fontSize: 17, margin: '0 0 16px' }}>📸 Objektife Gir</h3>

              <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Oda Kodu</label>
              <input
                type="text"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
                placeholder="AX47"
                maxLength={4}
                style={{
                  width: '100%', padding: '14px', borderRadius: 12, marginBottom: 12,
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff', fontSize: 24, fontWeight: 900, textAlign: 'center',
                  outline: 'none', letterSpacing: '0.3em', boxSizing: 'border-box',
                }}
              />

              <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Şifre (varsa)</label>
              <div style={{ position: 'relative', marginBottom: 20 }}>
                <input
                  type={joinShowPass ? 'text' : 'password'}
                  value={joinPass}
                  onChange={e => setJoinPass(e.target.value)}
                  placeholder="Boş bırakın → açık oda"
                  style={{
                    width: '100%', padding: '12px 44px 12px 14px',
                    borderRadius: 12, background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                  }}
                />
                <button
                  onClick={() => setJoinShowPass(!joinShowPass)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}
                >
                  {joinShowPass ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                </button>
              </div>

              {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</p>}

              <button
                onClick={() => handleJoinRoom()}
                disabled={loading || joinCode.length < 4}
                style={{
                  width: '100%', padding: '14px', borderRadius: 14,
                  cursor: loading || joinCode.length < 4 ? 'default' : 'pointer',
                  background: joinCode.length === 4
                    ? `linear-gradient(135deg, ${COL.purple}40, ${COL.purple}20)`
                    : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${joinCode.length === 4 ? COL.purple + '50' : 'rgba(255,255,255,0.1)'}`,
                  color: joinCode.length === 4 ? '#fff' : 'rgba(255,255,255,0.3)',
                  fontWeight: 800, fontSize: 15,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" /> : <LogIn style={{ width: 18, height: 18 }} />}
                {loading ? 'Katılınıyor...' : 'Katıl 📸'}
              </button>
            </GlassCard>

            {/* Open rooms list */}
            {openRooms.length > 0 && (
              <GlassCard>
                <h4 style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 700, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Globe style={{ width: 14, height: 14, color: COL.cyan }} />
                  Açık Stüdyolar
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {openRooms.map(r => (
                    <div
                      key={r.code}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', borderRadius: 12,
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <div>
                        <span style={{ color: COL.cyan, fontWeight: 800, fontSize: 16, letterSpacing: '0.2em' }}>{r.code}</span>
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '2px 0 0' }}>Ev sahibi bekliyor...</p>
                      </div>
                      <button
                        onClick={() => handleJoinRoom(r.code, '')}
                        style={{
                          padding: '8px 16px', borderRadius: 10,
                          background: `${COL.cyan}20`, border: `1px solid ${COL.cyan}40`,
                          color: COL.cyan, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                        }}
                      >
                        Katıl
                      </button>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
          </motion.div>
        )}

        {/* ── QUICK MATCH WAITING ── */}
        {view === 'quickmatch' && (
          <motion.div key="quickmatch" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <GlassCard style={{ textAlign: 'center', padding: 40 }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                style={{ display: 'inline-block', marginBottom: 20 }}
              >
                <Aperture style={{ width: 48, height: 48, color: COL.orange }} strokeWidth={1.4} />
              </motion.div>
              <p style={{ color: '#fff', fontWeight: 800, fontSize: 17, margin: '0 0 8px' }}>Fotoğrafçı Aranıyor... ⚡</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Rakip bulunamazsa açık stüdyoya alınırsınız</p>
              {loading && <Loader2 style={{ width: 24, height: 24, color: COL.orange, margin: '16px auto 0' }} className="animate-spin" />}
            </GlassCard>
          </motion.div>
        )}

        {/* ── WAITING ROOM ── */}
        {view === 'waiting' && room && (
          <motion.div key="waiting" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <GlassCard style={{ textAlign: 'center', marginBottom: 16 }}>
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ fontSize: 48, marginBottom: 12 }}
              >
                📷
              </motion.div>
              <h3 style={{ color: '#fff', fontWeight: 800, fontSize: 18, margin: '0 0 6px' }}>
                Fotoğrafçı Aranıyor...
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 20 }}>
                Arkadaşını bu kodla çağır
              </p>

              {/* Big room code */}
              <div style={{
                background: 'rgba(255,255,255,0.06)', borderRadius: 16,
                border: `2px solid ${COL.cyan}40`, padding: '20px 24px', marginBottom: 16,
              }}>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, margin: '0 0 8px', letterSpacing: '0.15em' }}>ODA KODU</p>
                <p style={{ color: COL.cyan, fontSize: 42, fontWeight: 900, margin: 0, letterSpacing: '0.4em' }}>{room.code}</p>
                {room.type === 'private' && room.password && (
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, margin: '8px 0 0' }}>
                    🔒 Şifre: <span style={{ color: COL.orange, fontWeight: 700 }}>{room.password}</span>
                  </p>
                )}
              </div>

              <button
                onClick={copyCode}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, margin: '0 auto 20px',
                  padding: '8px 16px', borderRadius: 10,
                  background: copied ? `${COL.cyan}20` : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${copied ? COL.cyan + '50' : 'rgba(255,255,255,0.12)'}`,
                  color: copied ? COL.cyan : 'rgba(255,255,255,0.5)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {copied ? <Check style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}
                {copied ? 'Kopyalandı!' : 'Kodu Kopyala'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                <Loader2 style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.3)' }} className="animate-spin" />
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>Bağlantı bekleniyor...</span>
              </div>
            </GlassCard>

            <button
              onClick={handleLeave}
              style={{
                width: '100%', padding: '12px', borderRadius: 14,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                color: '#f87171', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}
            >
              İptal Et
            </button>
          </motion.div>
        )}

        {/* ── GAME ── */}
        {view === 'game' && room && (
          <motion.div key="game" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            {/* Score bar */}
            <GlassCard style={{ marginBottom: 14, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {/* My side */}
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
                    <Camera style={{ width: 14, height: 14, color: COL.cyan }} strokeWidth={1.8} />
                    <span style={{ color: COL.cyan, fontSize: 11, fontWeight: 700 }}>Sen ({mySymbol})</span>
                  </div>
                  <span style={{ color: '#fff', fontSize: 28, fontWeight: 900 }}>{myScore}</span>
                </div>
                {/* Middle */}
                <div style={{ textAlign: 'center', padding: '0 12px' }}>
                  <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, margin: '0 0 2px' }}>Beraberlik</p>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 20, fontWeight: 700 }}>{room.draws || 0}</span>
                </div>
                {/* Opp side */}
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
                    <Aperture style={{ width: 14, height: 14, color: COL.purple }} strokeWidth={1.8} />
                    <span style={{ color: COL.purple, fontSize: 11, fontWeight: 700 }}>{oppName} ({mySymbol === 'X' ? 'O' : 'X'})</span>
                  </div>
                  <span style={{ color: '#fff', fontSize: 28, fontWeight: 900 }}>{oppScore}</span>
                </div>
              </div>
            </GlassCard>

            {/* Turn indicator */}
            {room.status === 'playing' && (
              <div style={{
                textAlign: 'center', marginBottom: 14, padding: '8px 16px',
                borderRadius: 12,
                background: isMyTurn ? `${COL.cyan}15` : `${COL.purple}10`,
                border: `1px solid ${isMyTurn ? COL.cyan + '40' : COL.purple + '25'}`,
              }}>
                <span style={{
                  color: isMyTurn ? COL.cyan : 'rgba(255,255,255,0.4)',
                  fontSize: 13, fontWeight: 700,
                }}>
                  {isMyTurn ? '📷 Sıra Sende — Kareni Seç!' : '⏳ Rakip Düşünüyor...'}
                </span>
              </div>
            )}

            {/* Board */}
            <GlassCard style={{ marginBottom: 14, padding: 16 }}>
              {/* Film strip top */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 12, opacity: 0.2 }}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} style={{ flex: 1, height: 8, borderRadius: 2, background: '#fff' }} />
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {room.board.map((cell, i) => (
                  <Cell
                    key={i}
                    value={cell}
                    index={i}
                    onClick={() => handleMove(i)}
                    isWinCell={!!(room.winLine && room.winLine.includes(i))}
                    disabled={!isMyTurn || room.status !== 'playing'}
                  />
                ))}
              </div>

              {/* Film strip bottom */}
              <div style={{ display: 'flex', gap: 4, marginTop: 12, opacity: 0.2 }}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} style={{ flex: 1, height: 8, borderRadius: 2, background: '#fff' }} />
                ))}
              </div>
            </GlassCard>

            {/* Game Over overlay */}
            <AnimatePresence>
              {room.status === 'finished' && winnerLabel && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', damping: 14 }}
                >
                  <GlassCard style={{ textAlign: 'center', marginBottom: 12, border: `1px solid ${COL.cyan}40` }}>
                    <p style={{ fontSize: 36, margin: '0 0 8px' }}>
                      {winnerLabel.includes('Kare Senin') ? '🏆' : winnerLabel.includes('Pozlama') ? '⚖️' : '📸'}
                    </p>
                    <h3 style={{ color: '#fff', fontWeight: 900, fontSize: 20, margin: '0 0 6px' }}>{winnerLabel}</h3>
                    {room.winner !== 'timeout' && (
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: '0 0 16px' }}>
                        Toplam skor: Sen {myScore} — {oppName} {oppScore}
                      </p>
                    )}

                    {/* Rematch */}
                    <div style={{ display: 'flex', gap: 10 }}>
                      {!rematchRequested && !rematchPending && (
                        <button
                          onClick={handleRematch}
                          style={{
                            flex: 1, padding: '12px', borderRadius: 12,
                            background: `linear-gradient(135deg, ${COL.cyan}30, ${COL.cyan}15)`,
                            border: `1px solid ${COL.cyan}50`,
                            color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          }}
                        >
                          <RefreshCw style={{ width: 16, height: 16 }} /> Tekrar Oyna
                        </button>
                      )}
                      {rematchRequested && (
                        <div style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>⏳ Rakip bekleniyor...</span>
                        </div>
                      )}
                      {rematchPending && (
                        <button
                          onClick={handleRematch}
                          style={{
                            flex: 1, padding: '12px', borderRadius: 12,
                            background: `linear-gradient(135deg, ${COL.orange}30, ${COL.orange}15)`,
                            border: `1px solid ${COL.orange}50`,
                            color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          }}
                        >
                          <RefreshCw style={{ width: 16, height: 16 }} /> Kabul Et! ⚡
                        </button>
                      )}
                      <button
                        onClick={handleLeave}
                        style={{
                          padding: '12px 16px', borderRadius: 12,
                          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                          color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                        }}
                      >
                        Çık
                      </button>
                    </div>
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── LEADERBOARD ── */}
        {view === 'leaderboard' && (
          <motion.div key="leaderboard" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <GlassCard style={{ marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🖼️</div>
              <h3 style={{ color: '#fff', fontWeight: 900, fontSize: 20, margin: 0 }}>Hall of Fame</h3>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 4 }}>
                Aynı şirketten gerçek isim · Diğerleri → Gizemli Rakip
              </p>
            </GlassCard>

            {lbLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Loader2 style={{ width: 32, height: 32, color: COL.cyan, margin: '0 auto' }} className="animate-spin" />
              </div>
            ) : leaderboard.length === 0 ? (
              <GlassCard style={{ textAlign: 'center' }}>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Henüz oynayan yok. İlk kare sende olsun! 📷</p>
              </GlassCard>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {leaderboard.map((entry, idx) => (
                  <GlassCard key={entry.userId} style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* Rank */}
                      <div style={{
                        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                        background: idx === 0 ? 'linear-gradient(135deg,#fbbf24,#f59e0b)' : idx === 1 ? 'linear-gradient(135deg,#94a3b8,#64748b)' : idx === 2 ? 'linear-gradient(135deg,#b45309,#92400e)' : 'rgba(255,255,255,0.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: idx < 3 ? '#fff' : 'rgba(255,255,255,0.4)',
                        fontWeight: 900, fontSize: 14,
                      }}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                      </div>

                      {/* Name */}
                      <div style={{ flex: 1 }}>
                        <p style={{
                          color: entry.isSameCompany ? '#fff' : 'rgba(255,255,255,0.5)',
                          fontWeight: entry.isSameCompany ? 700 : 500,
                          fontSize: 14, margin: 0,
                          fontStyle: entry.isSameCompany ? 'normal' : 'italic',
                        }}>
                          {entry.isSameCompany ? '👤 ' : '🎭 '}{entry.displayName}
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, margin: '2px 0 0' }}>
                          {entry.losses}K · {entry.draws}B
                        </p>
                      </div>

                      {/* Wins */}
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ color: COL.cyan, fontWeight: 900, fontSize: 22, margin: 0 }}>{entry.wins}</p>
                        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, margin: 0 }}>GALİBİYET</p>
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
