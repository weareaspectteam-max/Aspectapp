import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Bug, Wrench, Zap, ChevronDown, ChevronUp, Send, Loader2, Trash2, MessageSquare, AlertTriangle, Lightbulb } from 'lucide-react';
import { getToken, buildHeaders, appendGhostParam } from '../lib/api';
import { projectId } from '../lib/supabase-info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

// ── Güncelleme notları ──────────────────────────────────
// En yeni üstte. Yeni güncelleme eklerken dizinin başına ekle.
interface ChangelogEntry {
  version: string;
  date: string;        // YYYY-MM-DD
  title: string;
  changes: { type: 'new' | 'fix' | 'improve'; text: string }[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.0.1',
    date: '2026-03-29',
    title: 'Hakediş & Tema Güncellemesi',
    changes: [
      { type: 'new', text: 'Hakediş dahil/hariç sistemi — kişi bazlı yönetim, varsayılan hariç' },
      { type: 'new', text: 'Hakediş takip sayfası kişi bazlı gruplama' },
      { type: 'new', text: 'Kare İstatistikleri sayfası — personel bazlı kare analizi, mekan/tarih/personel filtresi, haftalık varsayılan görünüm' },
      { type: 'new', text: 'Güncelleme notları sayfası' },
      { type: 'improve', text: 'Tema renkleri tüm sayfalara uygulandı' },
      { type: 'improve', text: 'Kıdem çarpan ayarları açılır/kapanır panel' },
      { type: 'improve', text: 'Rotasyonda üst-müdür görev seçimi kısıtlaması kaldırıldı' },
      { type: 'fix', text: 'Sistem kararlılık iyileştirmeleri' },
      { type: 'fix', text: 'Hakediş tutarları artık kısaltmasız gösteriliyor' },
    ],
  },
  {
    version: '2.0.0',
    date: '2026-03-25',
    title: 'Bantlı Hakediş & Kıdem Sistemi',
    changes: [
      { type: 'new', text: 'Görev bazlı kişi sayısı bantları ile hakediş hesaplaması' },
      { type: 'new', text: 'Kıdem çarpanı sistemi (kıdemsiz, kıdemli, kıdemli+)' },
      { type: 'new', text: 'Gelişmiş yetki ve erişim kontrol sistemi' },
      { type: 'improve', text: 'Prim → Hakediş isimlendirme değişikliği' },
      { type: 'improve', text: 'Vardiya raporlarında hakediş detayları' },
    ],
  },
];

// ── Tip ikonu ve rengi ──────────────────────────────────
const TYPE_CONFIG = {
  new:     { icon: Sparkles, label: 'Yeni',       color: '#34d399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.25)' },
  fix:     { icon: Bug,      label: 'Düzeltme',   color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)' },
  improve: { icon: Zap,      label: 'İyileştirme', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.25)' },
};

// ── Bileşen ─────────────────────────────────────────────
interface GeriBildirim {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  tip: 'aksaklik' | 'talep';
  mesaj: string;
  tarih: string;
}

interface ChangelogProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  userRole?: string;
  userId?: string;
  isSuperAdmin?: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  yonetici: 'Yönetici', 'ust-mudur': 'Üst Müdür', mudur: 'Müdür',
  operasyon: 'Operasyon', personel: 'Personel', idari: 'İdari',
};

export function Changelog({ isOpen, onClose, userName, userRole, userId, isSuperAdmin }: ChangelogProps) {
  const [expandedVersions, setExpandedVersions] = React.useState<Set<string>>(
    new Set([CHANGELOG[0]?.version])
  );

  const toggleVersion = (v: string) => {
    setExpandedVersions(prev => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v); else next.add(v);
      return next;
    });
  };

  // ── Sekme ──
  const [activeTab, setActiveTab] = useState<'notlar' | 'bildirim'>('notlar');

  // ── Geri bildirim state ──
  const [fbTip, setFbTip] = useState<'aksaklik' | 'talep'>('aksaklik');
  const [fbMesaj, setFbMesaj] = useState('');
  const [fbSending, setFbSending] = useState(false);
  const [fbSuccess, setFbSuccess] = useState(false);
  const [fbError, setFbError] = useState('');

  // Superadmin: gelen bildirimler
  const [bildirimler, setBildirimler] = useState<GeriBildirim[]>([]);
  const [bildirimLoading, setBildirimLoading] = useState(false);
  const [bildirimAcik, setBildirimAcik] = useState(false);

  const fetchBildirimler = useCallback(async () => {
    if (!isSuperAdmin) return;
    setBildirimLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(appendGhostParam(`${API_BASE}/geri-bildirim`), { headers: buildHeaders(token) });
      const data = await res.json();
      if (res.ok && data.bildirimler) setBildirimler(data.bildirimler);
    } catch (e) {
      console.error('Bildirim yükleme hatası:', e);
    } finally {
      setBildirimLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (isOpen && isSuperAdmin) fetchBildirimler();
  }, [isOpen, isSuperAdmin, fetchBildirimler]);

  const handleSendFeedback = async () => {
    if (!fbMesaj.trim()) return;
    setFbSending(true);
    setFbError('');
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/geri-bildirim`, {
        method: 'POST',
        headers: buildHeaders(token),
        body: JSON.stringify({ tip: fbTip, mesaj: fbMesaj.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gönderilemedi');
      setFbMesaj('');
      setFbSuccess(true);
      setTimeout(() => setFbSuccess(false), 4000);
    } catch (e: any) {
      setFbError(e.message || 'Hata oluştu');
      setTimeout(() => setFbError(''), 4000);
    } finally {
      setFbSending(false);
    }
  };

  const handleDeleteFeedback = async (id: string) => {
    try {
      const token = await getToken();
      const res = await fetch(appendGhostParam(`${API_BASE}/geri-bildirim/${id}`), {
        method: 'DELETE',
        headers: buildHeaders(token),
      });
      if (res.ok) setBildirimler(prev => prev.filter(b => b.id !== id));
    } catch (e) {
      console.error('Bildirim silme hatası:', e);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 420, maxHeight: '80vh',
            background: 'var(--app-bg, linear-gradient(135deg, #0a051e 0%, #1a0a3c 50%, #0d0a2e 100%))',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 24,
            overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}
        >
          {/* Header + Tabs */}
          <div style={{ background: 'rgba(0,0,0,0.3)', flexShrink: 0 }}>
            <div style={{ padding: '14px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, margin: 0 }}>
                Aspect v{CHANGELOG[0]?.version}
              </p>
              <button
                onClick={onClose}
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'rgba(255,255,255,0.5)',
                }}
              >
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: 0, padding: '10px 20px 0' }}>
              {([
                { key: 'notlar' as const, label: 'Güncelleme Notları', icon: Sparkles },
                { key: 'bildirim' as const, label: 'Geri Bildirim', icon: MessageSquare },
              ]).map(tab => {
                const Icon = tab.icon;
                const active = activeTab === tab.key;
                return (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    style={{
                      flex: 1, padding: '10px 8px 8px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      background: 'none', border: 'none',
                      borderBottom: `2px solid ${active ? '#60a5fa' : 'transparent'}`,
                      color: active ? '#60a5fa' : 'rgba(255,255,255,0.35)',
                      fontSize: 12, fontWeight: active ? 800 : 600,
                      transition: 'all 0.2s',
                    }}>
                    <Icon style={{ width: 13, height: 13 }} />
                    {tab.label}
                    {tab.key === 'bildirim' && isSuperAdmin && bildirimler.length > 0 && (
                      <span style={{
                        fontSize: 8, padding: '0 5px', borderRadius: 99, fontWeight: 800,
                        background: 'rgba(248,113,113,0.2)', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171',
                        lineHeight: '14px',
                      }}>
                        {bildirimler.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* İçerik */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* ── TAB: Güncelleme Notları ── */}
            {activeTab === 'notlar' && CHANGELOG.map((entry, ei) => {
              const expanded = expandedVersions.has(entry.version);
              const isLatest = ei === 0;
              return (
                <div key={entry.version} style={{ marginBottom: 8 }}>
                  {/* Versiyon başlığı */}
                  <button
                    onClick={() => toggleVersion(entry.version)}
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: 14, cursor: 'pointer',
                      background: isLatest ? 'rgba(168,85,247,0.10)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isLatest ? 'rgba(168,85,247,0.25)' : 'rgba(255,255,255,0.08)'}`,
                      display: 'flex', alignItems: 'center', gap: 10,
                      textAlign: 'left',
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: isLatest
                        ? 'linear-gradient(135deg, rgba(168,85,247,0.3), rgba(139,92,246,0.15))'
                        : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${isLatest ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.1)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 900,
                      color: isLatest ? '#c4b5fd' : 'rgba(255,255,255,0.4)',
                    }}>
                      {isLatest ? <Sparkles style={{ width: 16, height: 16 }} /> : `v${entry.version.split('.')[0]}`}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>
                          v{entry.version}
                        </span>
                        {isLatest && (
                          <span style={{
                            fontSize: 8, padding: '1px 6px', borderRadius: 99, fontWeight: 800,
                            background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)',
                            color: '#34d399',
                          }}>
                            GÜNCEL
                          </span>
                        )}
                      </div>
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 1 }}>
                        {entry.title} — {new Date(entry.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {expanded ? <ChevronUp style={{ width: 16, height: 16 }} /> : <ChevronDown style={{ width: 16, height: 16 }} />}
                    </div>
                  </button>

                  {/* Değişiklik listesi */}
                  <AnimatePresence>
                    {expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{ padding: '8px 6px 4px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {entry.changes.map((ch, ci) => {
                            const cfg = TYPE_CONFIG[ch.type];
                            const Icon = cfg.icon;
                            return (
                              <div key={ci} style={{
                                display: 'flex', alignItems: 'flex-start', gap: 8,
                                padding: '6px 10px', borderRadius: 10,
                                background: cfg.bg, border: `1px solid ${cfg.border}`,
                              }}>
                                <Icon style={{ width: 12, height: 12, color: cfg.color, flexShrink: 0, marginTop: 1 }} />
                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
                                  {ch.text}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {/* ── TAB: Geri Bildirim ── */}
            {activeTab === 'bildirim' && <>

            {/* ── Superadmin: Gelen Bildirimler ── */}
            {isSuperAdmin && (
              <div style={{ marginTop: 4 }}>
                <button
                  onClick={() => { setBildirimAcik(v => !v); if (!bildirimAcik) fetchBildirimler(); }}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                    background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.20)',
                    display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                  }}
                >
                  <MessageSquare style={{ width: 14, height: 14, color: '#fbbf24' }} />
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>
                    Gelen Bildirimler
                  </span>
                  {bildirimler.length > 0 && (
                    <span style={{
                      fontSize: 9, padding: '1px 7px', borderRadius: 99, fontWeight: 800,
                      background: 'rgba(248,113,113,0.2)', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171',
                    }}>
                      {bildirimler.length}
                    </span>
                  )}
                  <div style={{ color: 'rgba(251,191,36,0.5)' }}>
                    {bildirimAcik ? <ChevronUp style={{ width: 14, height: 14 }} /> : <ChevronDown style={{ width: 14, height: 14 }} />}
                  </div>
                </button>

                <AnimatePresence>
                  {bildirimAcik && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {bildirimLoading && (
                          <div style={{ textAlign: 'center', padding: 12 }}>
                            <Loader2 style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.3)' }} className="animate-spin" />
                          </div>
                        )}
                        {!bildirimLoading && bildirimler.length === 0 && (
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: 12 }}>
                            Henüz bildirim yok
                          </p>
                        )}
                        {bildirimler.map(b => (
                          <div key={b.id} style={{
                            padding: '10px 12px', borderRadius: 10,
                            background: b.tip === 'aksaklik' ? 'rgba(248,113,113,0.06)' : 'rgba(52,211,153,0.06)',
                            border: `1px solid ${b.tip === 'aksaklik' ? 'rgba(248,113,113,0.15)' : 'rgba(52,211,153,0.15)'}`,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              {b.tip === 'aksaklik'
                                ? <AlertTriangle style={{ width: 11, height: 11, color: '#f87171' }} />
                                : <Lightbulb style={{ width: 11, height: 11, color: '#34d399' }} />
                              }
                              <span style={{ fontSize: 10, fontWeight: 700, color: b.tip === 'aksaklik' ? '#fca5a5' : '#6ee7b7' }}>
                                {b.tip === 'aksaklik' ? 'Aksaklık' : 'Talep'}
                              </span>
                              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>
                                {new Date(b.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <button
                                onClick={() => handleDeleteFeedback(b.id)}
                                style={{
                                  padding: '2px 4px', borderRadius: 5, cursor: 'pointer',
                                  background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)',
                                  color: '#f87171', display: 'flex', alignItems: 'center',
                                }}
                              >
                                <Trash2 style={{ width: 10, height: 10 }} />
                              </button>
                            </div>
                            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4, marginBottom: 4 }}>
                              {b.mesaj}
                            </p>
                            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>
                              — {b.userName} ({ROLE_LABELS[b.userRole] || b.userRole})
                            </p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* ── Geri Bildirim Formu ── */}
            <div style={{
              marginTop: 4, padding: '14px', borderRadius: 14,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>
                📬 Geri Bildirim Gönder
              </p>

              {/* Tip seçimi */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                {([
                  { key: 'aksaklik' as const, label: 'Aksaklık', icon: AlertTriangle, color: '#f87171' },
                  { key: 'talep' as const, label: 'Güncelleme Talebi', icon: Lightbulb, color: '#34d399' },
                ] as const).map(t => {
                  const Icon = t.icon;
                  const selected = fbTip === t.key;
                  return (
                    <button key={t.key} onClick={() => setFbTip(t.key)}
                      style={{
                        flex: 1, padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        background: selected ? `${t.color}15` : 'rgba(255,255,255,0.04)',
                        border: `1.5px solid ${selected ? `${t.color}40` : 'rgba(255,255,255,0.08)'}`,
                        color: selected ? t.color : 'rgba(255,255,255,0.35)',
                        fontSize: 11, fontWeight: selected ? 800 : 600,
                        transition: 'all 0.2s',
                      }}
                    >
                      <Icon style={{ width: 12, height: 12 }} />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {/* Mesaj */}
              <textarea
                value={fbMesaj}
                onChange={e => setFbMesaj(e.target.value)}
                placeholder={fbTip === 'aksaklik' ? 'Yaşadığınız sorunu anlatın...' : 'Ne eklenmesini istiyorsunuz...'}
                rows={3}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 12,
                  color: 'white', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
                  outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5,
                }}
              />

              {/* Gönder + durum */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <button
                  onClick={handleSendFeedback}
                  disabled={fbSending || !fbMesaj.trim()}
                  style={{
                    padding: '8px 16px', borderRadius: 10, cursor: fbMesaj.trim() ? 'pointer' : 'not-allowed',
                    background: fbMesaj.trim() ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${fbMesaj.trim() ? 'rgba(96,165,250,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    color: fbMesaj.trim() ? '#60a5fa' : 'rgba(255,255,255,0.2)',
                    fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
                    opacity: fbSending ? 0.6 : 1,
                  }}
                >
                  {fbSending ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> : <Send style={{ width: 13, height: 13 }} />}
                  Gönder
                </button>
                {fbSuccess && (
                  <span style={{ fontSize: 11, color: '#34d399', fontWeight: 700 }}>
                    ✓ Geri bildiriminiz iletildi
                  </span>
                )}
                {fbError && (
                  <span style={{ fontSize: 11, color: '#f87171', fontWeight: 700 }}>
                    ✕ {fbError}
                  </span>
                )}
              </div>
            </div>

            </>}

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
