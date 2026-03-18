import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CheckCircle2, AlertCircle,
  LogIn, LogOut, Bell, X, Loader2, Timer,
} from 'lucide-react';
import { buildHeaders, getToken } from '../lib/api';
import { projectId } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

/* ── Türkiye saati ── */
function trNow() {
  return new Date(Date.now() + 3 * 60 * 60 * 1000);
}
function todayStr() {
  return trNow().toISOString().split('T')[0];
}

/* ── "HH:MM" → bugünkü Date (TR saati) ── */
function timeToTodayDate(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = trNow();
  // UTC cinsinden bugün başlangıcı (TR = UTC+3, yani UTC'de -3)
  const base = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h - 3, m, 0));
  return base;
}

/* ── Saniye → "HH:SS:ss" ── */
function fmtCountdown(sec: number): string {
  const absS = Math.abs(sec);
  const h = Math.floor(absS / 3600);
  const m = Math.floor((absS % 3600) / 60);
  const s = absS % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/* ── Dakika → "Xsa Ydk" ── */
function fmtMin(min: number): string {
  if (min < 60) return `${min}dk`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}sa ${m}dk` : `${h}sa`;
}

/* ── "HH:MM" saat string'i (TR saati) ── */
function nowTimeStr(): string {
  const d = trNow();
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/* ── ISO → "HH:MM" TR saati ── */
function isoToTrTime(iso: string): string {
  const d = new Date(iso);
  const tr = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  return `${String(tr.getUTCHours()).padStart(2, '0')}:${String(tr.getUTCMinutes()).padStart(2, '0')}`;
}

interface ShiftTask {
  id: string;
  location: string;
  locationIcon: string;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  date: string;      // "YYYY-MM-DD"
}

interface CheckInData {
  checkInTime: string;
  plannedStart: string;
  plannedEnd: string;
  location: string;
  locationIcon: string;
  taskId: string;
  lateMin: number;
}

interface CheckOutData {
  checkOutTime: string;
  plannedEnd: string;
}

interface LateNoticeData {
  sentAt: string;
  delayMin: number;
  reason: string;
  plannedStart: string;
  location: string;
}

type ShiftState =
  | 'loading'
  | 'no-shift'
  | 'waiting'
  | 'grace'
  | 'late-no-checkin'
  | 'active-ontime'
  | 'active-late'
  | 'overtime'
  | 'completed-ontime'
  | 'completed-late';

interface Props {
  userId: string;
  userName: string;
  accessToken: string;
  tasks: ShiftTask[];   // rotasyon görevleri (dışarıdan geliyor)
  tasksLoading: boolean;
}

/* ══════════════════════════════════════════════════════════════
   Ana Bileşen
══════════════════════════════════════════════════════════════ */
export function ShiftCheckInCard({ userId, userName, accessToken, tasks, tasksLoading }: Props) {
  const [checkin, setCheckin] = useState<CheckInData | null>(null);
  const [checkout, setCheckout] = useState<CheckOutData | null>(null);
  const [lateNotice, setLateNotice] = useState<LateNoticeData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const [, setRefreshTick] = useState(0); // saniye sayacı — her tick render tetikler
  const [actionLoading, setActionLoading] = useState(false);
  const [showLateModal, setShowLateModal] = useState(false);
  const [lateDelayMin, setLateDelayMin] = useState('');
  const [lateReason, setLateReason] = useState('Trafik');
  const [lateError, setLateError] = useState('');

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Saniye tik ── */
  useEffect(() => {
    tickRef.current = setInterval(() => setRefreshTick(t => t + 1), 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  /* ── Bugünkü check-in durumu çek ── */
  const fetchStatus = useCallback(async () => {
    if (!userId) { setDataLoading(false); return; }
    setDataLoading(true);
    try {
      const token = accessToken || await getToken();
      const res = await fetch(`${API_BASE}/vardiya/bugun`, { headers: buildHeaders(token) });
      if (!res.ok) { console.error('[ShiftCard] bugun fetch error:', res.status); return; }
      const data = await res.json();
      setCheckin(data.checkin);
      setCheckout(data.checkout);
      setLateNotice(data.lateNotice);
    } catch (e) {
      console.error('[ShiftCard] fetchStatus error:', e);
    } finally {
      setDataLoading(false);
    }
  }, [userId, accessToken]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  /* ── Bugünün görevi ── */
  const todayTask = tasks.find(t => t.date === todayStr());

  /* ── Durum hesapla ── */
  const computeState = (): ShiftState => {
    if (dataLoading || tasksLoading) return 'loading';
    if (!todayTask) return 'no-shift';

    const now = trNow();
    const startDate = timeToTodayDate(todayTask.startTime);
    const endDate = timeToTodayDate(todayTask.endTime);
    const nowMs = now.getTime();
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();
    const diffFromStartSec = Math.floor((nowMs - startMs) / 1000);
    const GRACE_SEC = 5 * 60; // 5 dakika grace

    if (checkout) {
      // Tamamlandı
      return checkin?.lateMin && checkin.lateMin > 0 ? 'completed-late' : 'completed-ontime';
    }
    if (checkin) {
      // Check-in yapılmış
      if (nowMs > endMs) return 'overtime';
      return checkin.lateMin > 0 ? 'active-late' : 'active-ontime';
    }
    // Check-in yok
    if (nowMs < startMs) return 'waiting';                        // Henüz gelmedi
    if (diffFromStartSec <= GRACE_SEC) return 'grace';             // 5dk grace
    return 'late-no-checkin';                                      // Geç kalıyor
  };

  const state = computeState();

  /* ── Check-in ── */
  const handleCheckIn = async () => {
    if (!todayTask) return;
    setActionLoading(true);
    try {
      const token = accessToken || await getToken();
      const res = await fetch(`${API_BASE}/vardiya/checkin`, {
        method: 'POST',
        headers: buildHeaders(token),
        body: JSON.stringify({
          plannedStart: todayTask.startTime,
          plannedEnd: todayTask.endTime,
          location: todayTask.location,
          locationIcon: todayTask.locationIcon,
          taskId: todayTask.id,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        console.error('[ShiftCard] checkin error:', err);
        return;
      }
      await fetchStatus();
    } catch (e) {
      console.error('[ShiftCard] handleCheckIn error:', e);
    } finally {
      setActionLoading(false);
    }
  };

  /* ── Check-out ── */
  const handleCheckOut = async () => {
    if (!todayTask) return;
    setActionLoading(true);
    try {
      const token = accessToken || await getToken();
      const res = await fetch(`${API_BASE}/vardiya/checkout`, {
        method: 'POST',
        headers: buildHeaders(token),
        body: JSON.stringify({ plannedEnd: todayTask.endTime }),
      });
      if (!res.ok) {
        const err = await res.json();
        console.error('[ShiftCard] checkout error:', err);
        return;
      }
      await fetchStatus();
    } catch (e) {
      console.error('[ShiftCard] handleCheckOut error:', e);
    } finally {
      setActionLoading(false);
    }
  };

  /* ── Geç bildirim gönder ── */
  const handleLateNotice = async () => {
    if (!lateDelayMin || isNaN(parseInt(lateDelayMin))) {
      setLateError('Lütfen geçerli bir dakika girin.');
      return;
    }
    setLateError('');
    setActionLoading(true);
    try {
      const token = accessToken || await getToken();
      const res = await fetch(`${API_BASE}/vardiya/gec-bildir`, {
        method: 'POST',
        headers: buildHeaders(token),
        body: JSON.stringify({
          delayMin: parseInt(lateDelayMin),
          reason: lateReason,
          plannedStart: todayTask?.startTime,
          location: todayTask?.location,
          locationIcon: todayTask?.locationIcon,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        console.error('[ShiftCard] late notice error:', err);
        return;
      }
      await fetchStatus();
      setShowLateModal(false);
      setLateDelayMin('');
    } catch (e) {
      console.error('[ShiftCard] handleLateNotice error:', e);
    } finally {
      setActionLoading(false);
    }
  };

  /* ── Progress bar hesapla ── */
  const computeProgress = () => {
    if (!todayTask) return { missedPct: 0, workedPct: 0, remainPct: 100, markerPct: 0 };
    const now = trNow();
    const startMs = timeToTodayDate(todayTask.startTime).getTime();
    const endMs = timeToTodayDate(todayTask.endTime).getTime();
    const totalMs = endMs - startMs;
    const nowMs = now.getTime();

    if (!checkin) {
      // Check-in yok — bar tamamen boş
      return { missedPct: 0, workedPct: 0, remainPct: 100, markerPct: 0 };
    }

    const checkInMs = new Date(checkin.checkInTime).getTime();
    const checkInMsFromStart = checkInMs - startMs;
    const missedPct = Math.min(100, Math.max(0, (checkInMsFromStart / totalMs) * 100));

    let workedEndMs = checkout ? new Date(checkout.checkOutTime).getTime() : nowMs;
    workedEndMs = Math.min(workedEndMs, endMs + 2 * 3600000); // max +2sa overtime
    const workedMs = Math.max(0, workedEndMs - checkInMs);
    const workedPct = Math.min(100 - missedPct, (workedMs / totalMs) * 100);
    const remainPct = Math.max(0, 100 - missedPct - workedPct);

    return { missedPct, workedPct, remainPct, markerPct: missedPct };
  };

  /* ── Geri sayaç (bitiş için kalan saniye) ── */
  const computeCountdown = (): number => {
    if (!todayTask) return 0;
    const endMs = timeToTodayDate(todayTask.endTime).getTime();
    return Math.floor((endMs - trNow().getTime()) / 1000);
  };

  /* ── Başlamasına kalan saniye ── */
  const computeUntilStart = (): number => {
    if (!todayTask) return 0;
    const startMs = timeToTodayDate(todayTask.startTime).getTime();
    return Math.floor((startMs - trNow().getTime()) / 1000);
  };

  /* ── Gecikme sayacı (vardiyadayım ama gelmedi — kaç saniyedir geç) ── */
  const computeLateElapsed = (): number => {
    if (!todayTask) return 0;
    const startMs = timeToTodayDate(todayTask.startTime).getTime();
    return Math.floor((trNow().getTime() - startMs) / 1000);
  };

  /* ── Fazla mesai sayacı ── */
  const computeOvertime = (): number => {
    if (!todayTask) return 0;
    const endMs = timeToTodayDate(todayTask.endTime).getTime();
    return Math.floor((trNow().getTime() - endMs) / 1000);
  };

  const { missedPct, workedPct, remainPct, markerPct } = computeProgress();
  const countdown = computeCountdown();
  const untilStart = computeUntilStart();
  const lateElapsed = computeLateElapsed();
  const overtime = computeOvertime();

  /* ══ Badge ══ */
  const badgeMap: Record<ShiftState, { label: string; color: string; bg: string; border: string; blink?: boolean }> = {
    loading:         { label: '...', color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.10)' },
    'no-shift':      { label: '', color: '', bg: '', border: '' },
    waiting:         { label: '⏳ Bekliyor', color: '#ffd4a3', bg: 'rgba(255,212,163,0.12)', border: 'rgba(255,212,163,0.30)' },
    grace:           { label: '🟡 Başladı', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.30)' },
    'late-no-checkin': { label: '🔴 Geç Kalıyor', color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.35)', blink: true },
    'active-ontime': { label: '🟢 Aktif', color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.30)' },
    'active-late':   { label: '🟠 Geç Katıldı', color: '#fb923c', bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.30)' },
    overtime:        { label: '⚠️ Çıkış Yapılmadı', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.35)', blink: true },
    'completed-ontime': { label: '✅ Tamamlandı', color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.25)' },
    'completed-late':   { label: '✅ Tamamlandı', color: '#4ade80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.25)' },
  };

  const badge = badgeMap[state];

  /* ── Card içeriği ── */
  const renderContent = () => {
    /* LOADING */
    if (state === 'loading') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 0', gap: 10 }}>
          <Loader2 style={{ width: 20, height: 20, color: '#9dd9ea', animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)' }}>Vardiya bilgisi yükleniyor…</span>
        </div>
      );
    }

    /* NO SHIFT */
    if (state === 'no-shift') {
      return (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🌙</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.70)' }}>Bugün rotasyonda görev yok</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>İyi dinlenmeler!</div>
        </div>
      );
    }

    const task = todayTask!;

    return (
      <>
        {/* Lokasyon + Saat Satırı */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>{task.locationIcon || '📍'}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'white', lineHeight: 1.2 }}>{task.location}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                {task.startTime} → {task.endTime}
              </div>
            </div>
          </div>
          {/* Sağ taraf: check-in saati veya giriş etiketi */}
          {checkin && !checkout && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)' }}>Giriş</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: checkin.lateMin > 0 ? '#fb923c' : '#4ade80' }}>
                {isoToTrTime(checkin.checkInTime)}
                {checkin.lateMin > 0 && <span style={{ fontSize: 10, marginLeft: 4 }}>⚠️{checkin.lateMin}dk geç</span>}
              </div>
            </div>
          )}
          {checkout && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)' }}>Çıkış</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#4ade80' }}>{isoToTrTime(checkout.checkOutTime)}</div>
            </div>
          )}
        </div>

        {/* ANA SAYAÇ ALANI */}
        {(state === 'active-ontime' || state === 'active-late') && countdown > 0 && (
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 34, fontWeight: 900, color: '#9dd9ea', letterSpacing: '-1px', fontVariantNumeric: 'tabular-nums' }}>
              {fmtCountdown(countdown)}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>kaldı</div>
          </div>
        )}

        {state === 'late-no-checkin' && (
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#f87171', letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums',
              animation: 'pulse 2s ease-in-out infinite' }}>
              +{fmtCountdown(lateElapsed)}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(248,113,113,0.70)', marginTop: 2 }}>geçiyor…</div>
          </div>
        )}

        {state === 'waiting' && (
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#ffd4a3', letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>
              {fmtCountdown(untilStart)}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,212,163,0.60)', marginTop: 2 }}>başlamasına kaldı</div>
          </div>
        )}

        {state === 'overtime' && (
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#fbbf24', letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums',
              animation: 'pulse 1.5s ease-in-out infinite' }}>
              +{fmtCountdown(overtime)}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(251,191,36,0.70)', marginTop: 2 }}>fazla mesai</div>
          </div>
        )}

        {/* TAMAMLANDI ÖZETİ */}
        {(state === 'completed-ontime' || state === 'completed-late') && checkin && checkout && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <div style={{
                flex: 1, borderRadius: 10, padding: '8px 10px', textAlign: 'center',
                background: checkin.lateMin > 0 ? 'rgba(251,146,60,0.10)' : 'rgba(74,222,128,0.10)',
                border: `1px solid ${checkin.lateMin > 0 ? 'rgba(251,146,60,0.25)' : 'rgba(74,222,128,0.25)'}`,
              }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)', marginBottom: 2 }}>Giriş</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: checkin.lateMin > 0 ? '#fb923c' : '#4ade80' }}>
                  {isoToTrTime(checkin.checkInTime)}
                </div>
                {checkin.lateMin > 0 && (
                  <div style={{ fontSize: 9, color: '#fb923c', marginTop: 2 }}>⚠️ {checkin.lateMin}dk geç</div>
                )}
              </div>
              <div style={{
                flex: 1, borderRadius: 10, padding: '8px 10px', textAlign: 'center',
                background: 'rgba(74,222,128,0.10)',
                border: '1px solid rgba(74,222,128,0.25)',
              }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.40)', marginBottom: 2 }}>Çıkış</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#4ade80' }}>
                  {isoToTrTime(checkout.checkOutTime)}
                </div>
              </div>
            </div>
            {(() => {
              const ciMs = new Date(checkin.checkInTime).getTime();
              const coMs = new Date(checkout.checkOutTime).getTime();
              const totalMin = Math.round((coMs - ciMs) / 60000);
              return (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', textAlign: 'center' }}>
                  Çalışılan: <span style={{ color: 'white', fontWeight: 700 }}>{fmtMin(totalMin)}</span>
                  {checkin.lateMin > 0 && (
                    <> · Eksik: <span style={{ color: '#fb923c', fontWeight: 700 }}>{checkin.lateMin}dk</span></>
                  )}
                  {state === 'completed-ontime' && <> · <span style={{ color: '#4ade80' }}>Harika iş! 🎉</span></>}
                </div>
              );
            })()}
          </div>
        )}

        {/* PROGRESS BAR */}
        <ProgressBar
          state={state}
          missedPct={missedPct}
          workedPct={workedPct}
          remainPct={remainPct}
          markerPct={markerPct}
          startTime={task.startTime}
          endTime={task.endTime}
          checkinTime={checkin ? isoToTrTime(checkin.checkInTime) : undefined}
        />

        {/* BUTONLAR */}
        <div style={{ marginTop: 14 }}>
          {/* Vardiyayı Başlat */}
          {(state === 'waiting' || state === 'grace' || state === 'late-no-checkin') && (
            <button
              onClick={handleCheckIn}
              disabled={actionLoading}
              style={{
                width: '100%', padding: '13px', borderRadius: 14, border: 'none',
                background: 'linear-gradient(135deg,#22c55e,#16a34a)',
                color: 'white', fontSize: 14, fontWeight: 800, cursor: actionLoading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 16px rgba(34,197,94,0.30)',
                opacity: actionLoading ? 0.7 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {actionLoading
                ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                : <LogIn style={{ width: 16, height: 16 }} />}
              {state === 'waiting' ? 'Erken Başlat' : 'Vardiyamı Başlat'}
            </button>
          )}

          {/* Vardiyayı Bitir */}
          {(state === 'active-ontime' || state === 'active-late' || state === 'overtime') && (
            <button
              onClick={handleCheckOut}
              disabled={actionLoading}
              style={{
                width: '100%', padding: '13px', borderRadius: 14, border: 'none',
                background: state === 'overtime'
                  ? 'linear-gradient(135deg,#f59e0b,#d97706)'
                  : 'linear-gradient(135deg,#ef4444,#dc2626)',
                color: 'white', fontSize: 14, fontWeight: 800, cursor: actionLoading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: state === 'overtime'
                  ? '0 4px 16px rgba(245,158,11,0.30)'
                  : '0 4px 16px rgba(239,68,68,0.30)',
                opacity: actionLoading ? 0.7 : 1,
                transition: 'opacity 0.2s',
                animation: state === 'overtime' ? 'pulse 2s ease-in-out infinite' : 'none',
              }}
            >
              {actionLoading
                ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                : <LogOut style={{ width: 16, height: 16 }} />}
              Vardiyamı Bitir
            </button>
          )}
        </div>

        {/* GEÇ BILDIR SATIRI */}
        {(state === 'grace' || state === 'late-no-checkin') && !lateNotice && (
          <button
            onClick={() => setShowLateModal(true)}
            style={{
              marginTop: 10, width: '100%', padding: '9px 14px', borderRadius: 10,
              border: state === 'late-no-checkin'
                ? '1px solid rgba(248,113,113,0.40)'
                : '1px solid rgba(255,212,163,0.25)',
              background: state === 'late-no-checkin'
                ? 'rgba(248,113,113,0.10)'
                : 'rgba(255,255,255,0.04)',
              color: state === 'late-no-checkin' ? '#f87171' : 'rgba(255,255,255,0.55)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Bell style={{ width: 13, height: 13 }} />
            Geç mi kalıyorsun? → Bildir
          </button>
        )}

        {/* Bildirim gönderildi etiketi */}
        {lateNotice && (state === 'grace' || state === 'late-no-checkin') && (
          <div style={{
            marginTop: 10, padding: '8px 14px', borderRadius: 10,
            background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.20)',
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 11, color: '#4ade80', fontWeight: 700,
          }}>
            <CheckCircle2 style={{ width: 13, height: 13 }} />
            Geç kalma bildirimi gönderildi · {lateNotice.delayMin}dk · {lateNotice.reason}
          </div>
        )}
      </>
    );
  };

  return (
    <>
      {/* KART */}
      <div style={{
        position: 'relative', overflow: 'hidden', borderRadius: 24,
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(20px)',
      }}>
        {/* İç parıltı */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(135deg,rgba(157,217,234,0.08),transparent,rgba(167,139,250,0.06))',
        }} />
        {/* Üst ince çizgi */}
        <div style={{
          position: 'absolute', top: 0, left: 32, right: 32, height: 1,
          background: 'linear-gradient(to right,transparent,rgba(255,255,255,0.25),transparent)',
        }} />

        <div style={{ position: 'relative', padding: 20 }}>
          {/* Başlık */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 11,
                background: 'linear-gradient(135deg,rgba(157,217,234,0.30),rgba(167,139,250,0.25))',
                border: '1px solid rgba(157,217,234,0.30)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Timer style={{ width: 18, height: 18, color: '#9dd9ea' }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 900, color: 'white' }}>Anlık Durum</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Vardiya Takibi</div>
              </div>
            </div>
            {/* Badge */}
            {badge.label && (
              <div style={{
                fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 8,
                color: badge.color, background: badge.bg, border: `1px solid ${badge.border}`,
                animation: badge.blink ? 'pulse 2s ease-in-out infinite' : 'none',
                whiteSpace: 'nowrap',
              }}>
                {badge.label}
              </div>
            )}
          </div>

          {renderContent()}
        </div>
      </div>

      {/* GEÇ BILDIRIM MODALI */}
      {showLateModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(10,5,30,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowLateModal(false); }}
        >
          <div style={{
            width: '100%', maxWidth: 480,
            background: 'linear-gradient(160deg,#1a0a3c,#0d0a2e)',
            borderRadius: '24px 24px 0 0',
            border: '1px solid rgba(255,255,255,0.12)',
            padding: '24px 20px 36px',
            backdropFilter: 'blur(20px)',
          }}>
            {/* Modal başlık */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 11,
                  background: 'rgba(248,113,113,0.18)', border: '1px solid rgba(248,113,113,0.30)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <AlertCircle style={{ width: 18, height: 18, color: '#f87171' }} />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: 'white' }}>Geç Kalma Bildirimi</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)' }}>Yöneticiye Telegram ile iletilecek</div>
                </div>
              </div>
              <button onClick={() => setShowLateModal(false)} style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}>
                <X style={{ width: 15, height: 15, color: 'rgba(255,255,255,0.60)' }} />
              </button>
            </div>

            {/* Tahmini gecikme */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Tahmini Gecikme (dakika)
              </label>
              <input
                type="number"
                min="1"
                max="240"
                placeholder="Örn: 20"
                value={lateDelayMin}
                onChange={(e) => setLateDelayMin(e.target.value)}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)',
                  color: 'white', fontSize: 16, fontWeight: 700,
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
              {lateError && <div style={{ fontSize: 11, color: '#f87171', marginTop: 6 }}>{lateError}</div>}
            </div>

            {/* Sebep */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Sebep
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['Trafik', 'Ulaşım', 'Diğer'].map((r) => (
                  <button
                    key={r}
                    onClick={() => setLateReason(r)}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid',
                      borderColor: lateReason === r ? 'rgba(248,113,113,0.50)' : 'rgba(255,255,255,0.12)',
                      background: lateReason === r ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.05)',
                      color: lateReason === r ? '#f87171' : 'rgba(255,255,255,0.55)',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {r === 'Trafik' ? '🚗 Trafik' : r === 'Ulaşım' ? '🚌 Ulaşım' : '💬 Diğer'}
                  </button>
                ))}
              </div>
            </div>

            {/* Gönder butonu */}
            <button
              onClick={handleLateNotice}
              disabled={actionLoading}
              style={{
                width: '100%', padding: '14px', borderRadius: 14, border: 'none',
                background: 'linear-gradient(135deg,#ef4444,#dc2626)',
                color: 'white', fontSize: 14, fontWeight: 800, cursor: actionLoading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 20px rgba(239,68,68,0.35)',
                opacity: actionLoading ? 0.7 : 1,
              }}
            >
              {actionLoading
                ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                : <Bell style={{ width: 16, height: 16 }} />}
              Bildirimi Gönder
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   Progress Bar Alt Bileşeni
══════════════════════════════════════════════════════════════ */
interface ProgressBarProps {
  state: ShiftState;
  missedPct: number;
  workedPct: number;
  remainPct: number;
  markerPct: number;
  startTime: string;
  endTime: string;
  checkinTime?: string;
}

function ProgressBar({ state, missedPct, workedPct, remainPct, markerPct, startTime, endTime, checkinTime }: ProgressBarProps) {
  if (state === 'no-shift' || state === 'loading') return null;

  const showBar = !['no-shift', 'loading'].includes(state);
  if (!showBar) return null;

  /* Tamamlandı → %100 yeşil veya kırmızı+yeşil */
  const isCompleted = state === 'completed-ontime' || state === 'completed-late';

  return (
    <div style={{ marginBottom: 4 }}>
      {/* Bar */}
      <div style={{
        position: 'relative',
        height: 8, borderRadius: 9999,
        background: 'rgba(255,255,255,0.07)',
        overflow: 'visible',
        display: 'flex',
      }}>
        {/* Kırmızı: kaçırılan süre */}
        {missedPct > 0 && (
          <div style={{
            width: `${missedPct}%`, height: '100%',
            background: 'linear-gradient(to right,#ef4444,#f87171)',
            borderRadius: markerPct >= 99 ? 9999 : '9999px 0 0 9999px',
            flexShrink: 0,
          }} />
        )}

        {/* Yeşil: çalışılan süre */}
        {workedPct > 0 && (
          <div style={{
            width: `${workedPct}%`, height: '100%',
            background: isCompleted && missedPct === 0
              ? 'linear-gradient(to right,#22c55e,#4ade80)'
              : 'linear-gradient(to right,#16a34a,#4ade80)',
            borderRadius: remainPct < 0.5 && missedPct < 0.5 ? 9999
              : remainPct < 0.5 ? '0 9999px 9999px 0'
              : missedPct < 0.5 ? '9999px 0 0 9999px'
              : 0,
            flexShrink: 0,
          }} />
        )}

        {/* Gri: kalan süre */}
        {remainPct > 0.5 && (
          <div style={{
            width: `${remainPct}%`, height: '100%',
            background: 'rgba(255,255,255,0.07)',
            borderRadius: '0 9999px 9999px 0',
            flexShrink: 0,
          }} />
        )}

        {/* Katılım noktası işaretçisi */}
        {missedPct > 0.5 && missedPct < 99 && (
          <div style={{
            position: 'absolute',
            left: `${markerPct}%`,
            top: '50%',
            transform: 'translate(-50%,-50%)',
            width: 3,
            height: 16,
            background: 'white',
            borderRadius: 2,
            boxShadow: '0 0 6px rgba(255,255,255,0.80)',
            zIndex: 2,
          }} />
        )}
      </div>

      {/* Alt etiketler */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, position: 'relative' }}>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.30)', fontWeight: 600 }}>{startTime}</span>
        {checkinTime && missedPct > 2 && (
          <span style={{
            position: 'absolute',
            left: `${markerPct}%`,
            transform: 'translateX(-50%)',
            fontSize: 9, color: '#fb923c', fontWeight: 700,
          }}>↑{checkinTime}</span>
        )}
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.30)', fontWeight: 600 }}>{endTime}</span>
      </div>
    </div>
  );
}