/**
 * NotificationsPanel — Bildirim paneli (Glassmorphism)
 * Yönetici: sadece izin_talebi
 * Diğer tüm roller: rotation_assigned, rotation_changed, rotation_removed,
 *   izinli_atandi, izin_onaylandi, izin_reddedildi, prim_guncellendi
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Bell, BellOff, CheckCheck, Trash2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { UserRole } from './login';
import { projectId, publicAnonKey } from '../lib/supabase-info';

const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  meta?: any;
}

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  accessToken: string;
  userRole: UserRole;
  onUnreadCountChange: (count: number) => void;
}

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  rotation_assigned: { icon: '📍', color: '#9dd9ea', bg: 'rgba(157,217,234,0.12)' },
  rotation_changed:  { icon: '🔄', color: '#ffd4a3', bg: 'rgba(255,212,163,0.12)' },
  rotation_removed:  { icon: '❌', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  izinli_atandi:     { icon: '🏖️', color: '#a7c7e7', bg: 'rgba(167,199,231,0.12)' },
  izin_onaylandi:    { icon: '✅', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  izin_reddedildi:   { icon: '🚫', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  prim_guncellendi:  { icon: '💰', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  izin_talebi:       { icon: '📋', color: '#d4b5f7', bg: 'rgba(212,181,247,0.12)' },
  siparis_yeni:      { icon: '📦', color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  siparis_onaylandi: { icon: '✅', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  siparis_iptal:     { icon: '🚫', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  teslimat_beklemede:{ icon: '🚚', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  teslimat_onaylandi:{ icon: '✅', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  teslimat_reddedildi:{ icon: '❌', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  odeme_yapildi:     { icon: '💰', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
};

function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'şimdi';
  if (mins < 60) return `${mins}dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}sa önce`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}g önce`;
  return new Date(isoStr).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

export function NotificationsPanel({
  isOpen,
  onClose,
  accessToken,
  userRole,
  onUnreadCountChange,
}: NotificationsPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${publicAnonKey}`,
    'X-Access-Token': accessToken,
  };

  const fetchNotifications = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch(`${SERVER}/bildirimler`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      const notifs: Notification[] = data.notifications || [];
      setNotifications(notifs);
      onUnreadCountChange(data.unreadCount || 0);
    } catch {
      // sessiz hata
    }
  }, [accessToken]);

  // Panel açıkken fetch, yoksa da 30s polling
  useEffect(() => {
    if (!accessToken) return;
    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchNotifications]);

  useEffect(() => {
    if (isOpen) fetchNotifications();
  }, [isOpen]);

  const markAsRead = async (notifId: string) => {
    try {
      await fetch(`${SERVER}/bildirimler/${encodeURIComponent(notifId)}/oku`, {
        method: 'PUT', headers,
      });
      setNotifications(prev =>
        prev.map(n => n.id === notifId ? { ...n, read: true } : n)
      );
      const unread = notifications.filter(n => !n.read && n.id !== notifId).length;
      onUnreadCountChange(unread);
    } catch {}
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await fetch(`${SERVER}/bildirimler/hepsini-oku`, { method: 'PUT', headers });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      onUnreadCountChange(0);
    } catch {}
    setMarkingAll(false);
  };

  const deleteNotif = async (notifId: string) => {
    try {
      await fetch(`${SERVER}/bildirimler/${encodeURIComponent(notifId)}`, {
        method: 'DELETE', headers,
      });
      setNotifications(prev => prev.filter(n => n.id !== notifId));
      const unread = notifications.filter(n => !n.read && n.id !== notifId).length;
      onUnreadCountChange(unread);
    } catch {}
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 200,
              background: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(2px)',
            }}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            style={{
              position: 'fixed',
              top: 70,
              right: 12,
              left: 12,
              maxWidth: 420,
              marginLeft: 'auto',
              zIndex: 201,
              background: 'rgba(18,12,40,0.97)',
              border: '1px solid rgba(157,217,234,0.18)',
              borderRadius: 20,
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: 'calc(100vh - 90px)',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 16px 12px',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(157,217,234,0.12)',
                  border: '1px solid rgba(157,217,234,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Bell size={16} style={{ color: '#9dd9ea' }} />
                </div>
                <div>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>
                    Bildirimler
                  </div>
                  {unreadCount > 0 && (
                    <div style={{ color: '#9dd9ea', fontSize: 11, fontWeight: 500 }}>
                      {unreadCount} okunmamış
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    disabled={markingAll}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '5px 10px',
                      borderRadius: 8,
                      background: 'rgba(157,217,234,0.1)',
                      border: '1px solid rgba(157,217,234,0.2)',
                      color: '#9dd9ea',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      opacity: markingAll ? 0.6 : 1,
                    }}
                  >
                    <CheckCheck size={12} />
                    Tümü Okundu
                  </button>
                )}
                <button
                  onClick={() => { setLoading(true); fetchNotifications().finally(() => setLoading(false)); }}
                  style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'rgba(255,255,255,0.5)',
                  }}
                >
                  <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                </button>
                <button
                  onClick={onClose}
                  style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'rgba(255,255,255,0.5)',
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Notification List */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {notifications.length === 0 ? (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', padding: '48px 24px', gap: 12,
                }}>
                  <BellOff size={36} style={{ color: 'rgba(255,255,255,0.15)' }} />
                  <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, margin: 0 }}>
                    Henüz bildiriminiz yok
                  </p>
                </div>
              ) : (
                <div style={{ padding: '8px 8px' }}>
                  {notifications.map((notif) => {
                    const cfg = TYPE_CONFIG[notif.type] || { icon: '🔔', color: '#9dd9ea', bg: 'rgba(157,217,234,0.08)' };
                    return (
                      <motion.div
                        key={notif.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        style={{
                          display: 'flex',
                          gap: 10,
                          padding: '10px 12px',
                          borderRadius: 12,
                          marginBottom: 4,
                          background: notif.read ? 'transparent' : cfg.bg,
                          border: `1px solid ${notif.read ? 'transparent' : `${cfg.color}20`}`,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          position: 'relative',
                        }}
                        onClick={() => !notif.read && markAsRead(notif.id)}
                      >
                        {/* Unread dot */}
                        {!notif.read && (
                          <div style={{
                            position: 'absolute',
                            top: 12, left: 6,
                            width: 6, height: 6,
                            borderRadius: '50%',
                            background: cfg.color,
                            boxShadow: `0 0 6px ${cfg.color}`,
                          }} />
                        )}

                        {/* Icon */}
                        <div style={{
                          width: 36, height: 36,
                          borderRadius: 10,
                          background: cfg.bg,
                          border: `1px solid ${cfg.color}30`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 16,
                          flexShrink: 0,
                          marginLeft: 8,
                        }}>
                          {cfg.icon}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            color: notif.read ? 'rgba(255,255,255,0.6)' : '#fff',
                            fontWeight: notif.read ? 500 : 700,
                            fontSize: 13,
                            lineHeight: 1.3,
                            marginBottom: 2,
                          }}>
                            {notif.title}
                          </div>
                          <div style={{
                            color: 'rgba(255,255,255,0.45)',
                            fontSize: 11.5,
                            lineHeight: 1.4,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}>
                            {notif.body}
                          </div>
                          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, marginTop: 4 }}>
                            {timeAgo(notif.created_at)}
                          </div>
                        </div>

                        {/* Delete button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteNotif(notif.id); }}
                          style={{
                            width: 24, height: 24,
                            borderRadius: 6,
                            background: 'transparent',
                            border: 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'rgba(255,255,255,0.2)',
                            flexShrink: 0,
                            alignSelf: 'flex-start',
                            marginTop: 4,
                            transition: 'color 0.2s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
                        >
                          <Trash2 size={11} />
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div style={{
                padding: '10px 16px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                flexShrink: 0,
                display: 'flex',
                justifyContent: 'center',
              }}>
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>
                  {notifications.length} bildirim • Son 24 saat
                </span>
              </div>
            )}
          </motion.div>

          <style>{`
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          `}</style>
        </>
      )}
    </AnimatePresence>
  );
}

// Bildirim sayısını takip eden hook (App.tsx'te kullanılır)
export function useNotificationCount(accessToken: string) {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-4da0b637/bildirimler`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Access-Token': accessToken,
        },
      });
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCount(data.unreadCount || 0);
    } catch {}
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) { setUnreadCount(0); return; }
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  return { unreadCount, setUnreadCount, refetch: fetchCount };
}
