import { useState } from 'react';
import { DollarSign, ShoppingBag, Camera, AlertTriangle, Clock, RefreshCw, ChevronDown, Columns2, Square, Play, Pause, EyeOff, X, TrendingUp, TrendingDown, Minus, Package, Film } from 'lucide-react';
import { authHeaders, ghostParams } from '../../lib/api';
import { projectId } from '../../lib/supabase-info';
import { useCallback, useEffect } from 'react';
import type { PcDashboardData } from '../usePcDashboard';
import { PcSimpleDropdown } from '../PcSimpleDropdown';
import { PcRotasyonAtama } from './PcRotasyonAtama';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4da0b637`;

function formatTL(val: number): string {
  if (val >= 1_000_000) return `₺${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000)     return `₺${(val / 1_000).toFixed(1)}B`;
  return `₺${val.toLocaleString('tr-TR')}`;
}

// ─── Canlı Feed ───────────────────────────────────────────────
export interface FeedItem {
  type: 'satis' | 'kare';
  id: string;
  timestamp: string;
  kaydeden?: string;
  mekanAdi: string;
  mekanEmoji: string;
  mekanColor?: string;
  items?: { product: string; quantity: number; dijital?: boolean }[];
  totalPrice?: number;
  discount?: number;
  finalPrice?: number;
  paymentMethod?: 'cash' | 'iban' | 'card';
  iptal?: boolean;
  gerekce?: string;
  photographerName?: string;
  frameCount?: number;
}

function FeedRow({ item, scale = 1 }: { item: FeedItem; scale?: number }) {
  const mekanColor = item.mekanColor || '#9dd9ea';
  const time = new Date(item.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const fs = (n: number) => Math.round(n * scale);

  if (item.type === 'kare') {
    const kareColor = '#c5a8f5';
    return (
      <div style={{
        padding: '10px 12px 10px 14px', borderRadius: 8,
        background: `${kareColor}10`, border: `1px solid ${kareColor}30`, borderLeft: `3px solid ${kareColor}`,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Camera size={fs(15)} style={{ color: kareColor, flexShrink: 0 }} />
            <span style={{ color: kareColor, fontWeight: 700, fontSize: fs(15) }}>{item.frameCount} kare</span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: fs(12) }}>{time}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: fs(12) }}>
          <span style={{ color: mekanColor, fontWeight: 700 }}>{item.mekanEmoji} {item.mekanAdi}</span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
          <span style={{ color: 'rgba(255,255,255,0.65)' }}>{item.photographerName}</span>
        </div>
      </div>
    );
  }

  const payColor = item.paymentMethod === 'cash' ? '#34d399' : item.paymentMethod === 'card' ? '#60a5fa' : '#ffd4a3';
  const payLabel = item.paymentMethod === 'cash' ? 'NAKİT' : item.paymentMethod === 'card' ? 'KART' : item.paymentMethod === 'iban' ? 'IBAN' : '';
  const disc = item.discount || 0;
  const hasGerekce = !!item.gerekce;
  const originalPrice = disc !== 0 ? (item.finalPrice || 0) + disc : null;
  const discPct = originalPrice ? Math.round((Math.abs(disc) / originalPrice) * 100) : 0;
  const isZam = disc < 0;
  const discColor = isZam ? '#c5a8f5' : '#ffd4a3';
  const discSign = isZam ? '+' : '-';

  return (
    <div style={{
      padding: '10px 12px 10px 14px', borderRadius: 8,
      background: item.iptal ? 'rgba(248,113,113,0.08)' : `${mekanColor}10`,
      border: `1px solid ${item.iptal ? 'rgba(248,113,113,0.3)' : `${mekanColor}30`}`,
      borderLeft: `3px solid ${item.iptal ? '#f87171' : mekanColor}`,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          <span style={{ fontWeight: 700, color: '#fff', fontSize: fs(15), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.items?.map(i => (i.quantity > 1 ? `${i.quantity}× ` : '') + i.product).join(' + ') || '-'}
          </span>
          {item.iptal && <span style={{ fontSize: fs(11), color: '#f87171', border: '1px solid rgba(248,113,113,0.4)', padding: '1px 6px', borderRadius: 3, fontWeight: 700, flexShrink: 0 }}>İPTAL</span>}
          {hasGerekce && !item.iptal && <span style={{ fontSize: fs(11), color: '#fbbf24', border: '1px solid rgba(251,191,36,0.4)', padding: '1px 6px', borderRadius: 3, fontWeight: 700, flexShrink: 0 }} title={item.gerekce}>GRK</span>}
        </div>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: fs(12) }}>{time}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, fontSize: fs(12) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ color: mekanColor, fontWeight: 700 }}>{item.mekanEmoji} {item.mekanAdi}</span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
          <span style={{ color: 'rgba(255,255,255,0.65)' }}>{item.kaydeden}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {disc !== 0 && (
            <span style={{ color: discColor, fontWeight: 700, fontSize: fs(11), background: `${discColor}15`, border: `1px solid ${discColor}40`, padding: '1px 6px', borderRadius: 4 }}>
              %{discPct} {discSign}₺{Math.abs(disc).toLocaleString('tr-TR')}
            </span>
          )}
          <span style={{ fontSize: fs(16), fontWeight: 900, color: '#fff' }}>₺{(item.finalPrice || 0).toLocaleString('tr-TR')}</span>
          {payLabel && <span style={{ fontSize: fs(11), color: payColor, border: `1px solid ${payColor}40`, padding: '1px 6px', borderRadius: 3, fontWeight: 700 }}>{payLabel}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Feed filter ───────────────────────────────────────────────
type FeedFilter = 'all' | 'satis' | 'kare' | string; // mekan:<id> formatında

function applyFilter(feed: FeedItem[], filter: FeedFilter): FeedItem[] {
  if (filter === 'all') return feed;
  if (filter === 'satis') return feed.filter(i => i.type === 'satis');
  if (filter === 'kare') return feed.filter(i => i.type === 'kare');
  if (filter.startsWith('mekan:')) {
    const id = filter.slice(6);
    return feed.filter(i => (i as any).mekanId === id || i.mekanAdi === id);
  }
  return feed;
}

export function buildMekanOptions(feed: FeedItem[]): Array<{ value: string; label: string; emoji: string; color: string }> {
  const map = new Map<string, { value: string; label: string; emoji: string; color: string }>();
  for (const it of feed) {
    const id = (it as any).mekanId || it.mekanAdi;
    if (!map.has(id)) {
      map.set(id, {
        value: `mekan:${id}`,
        label: it.mekanAdi,
        emoji: it.mekanEmoji,
        color: it.mekanColor || '#9dd9ea',
      });
    }
  }
  return Array.from(map.values());
}

function FeedFilterDropdown({ value, onChange, mekanOptions }: { value: FeedFilter; onChange: (v: FeedFilter) => void; mekanOptions: Array<{ value: string; label: string; emoji: string; color: string }> }) {
  const [open, setOpen] = useState(false);
  const baseOptions = [
    { value: 'all',   label: 'Tümü',            color: '#fff' },
    { value: 'satis', label: 'Sadece Satışlar', color: '#a8e6cf' },
    { value: 'kare',  label: 'Sadece Kareler',  color: '#c5a8f5' },
  ];
  const currentLabel = (() => {
    if (value === 'all') return 'Tümü';
    if (value === 'satis') return 'Satışlar';
    if (value === 'kare') return 'Kareler';
    if (value.startsWith('mekan:')) {
      const opt = mekanOptions.find(m => m.value === value);
      return opt ? `${opt.emoji} ${opt.label}` : 'Mekan';
    }
    return 'Tümü';
  })();

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer',
        }}
      >
        <span>{currentLabel}</span>
        <ChevronDown size={11} />
      </button>
      {open && (
        <div
          onMouseLeave={() => setOpen(false)}
          style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4,
            background: 'rgba(20, 15, 50, 0.98)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8, padding: 4, zIndex: 20, minWidth: 180, maxHeight: 320, overflowY: 'auto',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          {baseOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value as FeedFilter); setOpen(false); }}
              style={{
                width: '100%', textAlign: 'left', padding: '6px 10px',
                background: value === opt.value ? 'rgba(168,230,207,0.12)' : 'transparent',
                border: 'none', borderRadius: 5, color: opt.color, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
          {mekanOptions.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', margin: '4px 0' }} />
          )}
          {mekanOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value as FeedFilter); setOpen(false); }}
              style={{
                width: '100%', textAlign: 'left', padding: '6px 10px',
                background: value === opt.value ? `${opt.color}20` : 'transparent',
                border: 'none', borderRadius: 5, color: opt.color, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {opt.emoji} {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function useCanliFeed(companyKey?: string) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/stok/canli-satis${ghostParams()}`, { headers });
      const data = await res.json();
      if (res.ok) setFeed(data.feed || data.satislar || []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchFeed();
    // Dışarıdan tetikleme için global ref
    triggerFeedRefresh = fetchFeed;
    return () => { if (triggerFeedRefresh === fetchFeed) triggerFeedRefresh = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchFeed, companyKey]);

  return { feed, loading };
}

export function FeedList({ items, emptyText, scale = 1 }: { items: FeedItem[]; emptyText: string; scale?: number }) {
  if (items.length === 0) {
    return <div className="pc-empty" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{emptyText}</div>;
  }
  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4, minHeight: 0 }}>
      {items.slice(0, 80).map(item => <FeedRow key={item.id} item={item} scale={scale} />)}
    </div>
  );
}

type TypeF = 'all' | 'satis' | 'kare';

function applyTypeAndMekanFilter(feed: FeedItem[], type: TypeF, mekan: string): FeedItem[] {
  return feed.filter(item => {
    if (type !== 'all' && item.type !== type) return false;
    if (mekan !== 'all' && item.mekanId !== mekan) return false;
    return true;
  });
}

function ColDropdowns({
  typeVal, onType, mekanVal, onMekan, mekanList,
}: {
  typeVal: TypeF; onType: (v: TypeF) => void;
  mekanVal: string; onMekan: (v: string) => void;
  mekanList: Array<{ value: string; label: string; emoji: string; color: string }>;
}) {
  const typeOpts = [
    { value: 'all' as TypeF,   label: 'Tümü' },
    { value: 'satis' as TypeF, label: 'Satışlar', color: '#a8e6cf' },
    { value: 'kare' as TypeF,  label: 'Kareler',  color: '#c5a8f5' },
  ];
  const mekanOpts = [
    { value: 'all', label: 'Tüm Mekanlar' },
    ...mekanList.map(m => ({
      value: m.value.replace('mekan:', ''),
      label: `${m.emoji} ${m.label}`,
      color: m.color,
    })),
  ];
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <PcSimpleDropdown options={typeOpts} value={typeVal} onChange={onType} size="sm" />
      <PcSimpleDropdown options={mekanOpts} value={mekanVal} onChange={onMekan} size="sm" align="right" />
    </div>
  );
}

export function CanliFeedPanel({ split, companyKey }: { split: boolean; companyKey?: string }) {
  const { feed, loading } = useCanliFeed(companyKey);
  const [singleType, setSingleType] = useState<TypeF>('all');
  const [singleMekan, setSingleMekan] = useState<string>('all');
  const [leftType, setLeftType] = useState<TypeF>('satis');
  const [leftMekan, setLeftMekan] = useState<string>('all');
  const [rightType, setRightType] = useState<TypeF>('kare');
  const [rightMekan, setRightMekan] = useState<string>('all');

  const mekanList = buildMekanOptions(feed);

  if (loading && feed.length === 0) {
    return <div className="pc-empty" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Yükleniyor...</div>;
  }

  if (!split) {
    return (
      <>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <ColDropdowns
            typeVal={singleType} onType={setSingleType}
            mekanVal={singleMekan} onMekan={setSingleMekan}
            mekanList={mekanList}
          />
        </div>
        <FeedList items={applyTypeAndMekanFilter(feed, singleType, singleMekan)} emptyText="Bu filtrede kayıt yok" />
      </>
    );
  }

  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, minHeight: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid rgba(168,230,207,0.2)' }}>
          <ColDropdowns
            typeVal={leftType} onType={setLeftType}
            mekanVal={leftMekan} onMekan={setLeftMekan}
            mekanList={mekanList}
          />
        </div>
        <FeedList items={applyTypeAndMekanFilter(feed, leftType, leftMekan)} emptyText="Bu filtrede kayıt yok" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid rgba(197,168,245,0.2)' }}>
          <ColDropdowns
            typeVal={rightType} onType={setRightType}
            mekanVal={rightMekan} onMekan={setRightMekan}
            mekanList={mekanList}
          />
        </div>
        <FeedList items={applyTypeAndMekanFilter(feed, rightType, rightMekan)} emptyText="Bu filtrede kayıt yok" />
      </div>
    </div>
  );
}

// ─── Rotasyon ───────────────────────────────────────────────
interface Task {
  id: string;
  location: string;
  locationIcon: string;
  date: string;
  status: string;
  personnel: { id: string; name: string }[];
}

function todayTR() {
  const trMs = Date.now() + 3 * 60 * 60 * 1000;
  const trHour = new Date(trMs).getUTCHours();
  if (trHour < 7) return new Date(trMs - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return new Date(trMs).toISOString().split('T')[0];
}

function RotasyonPanel({ aktifPersonel }: { aktifPersonel: { name: string; mekan?: string; checkinZamani?: string }[] }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch(`${API_BASE}/rotasyon/gorevler${ghostParams()}`, { headers });
        const data = await res.json();
        if (res.ok && !cancelled) {
          const today = todayTR();
          const filtered = (data.tasks || []).filter((t: Task) => t.date === today && t.status !== 'cancelled');
          setTasks(filtered);
        }
      } catch {}
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="pc-empty" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Yükleniyor...</div>;
  if (tasks.length === 0) return <div className="pc-empty" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Bugün için rotasyon yok</div>;

  const byLocation: Record<string, { location: string; icon: string; personnel: { id: string; name: string }[] }> = {};
  for (const t of tasks) {
    const key = t.location;
    if (!byLocation[key]) byLocation[key] = { location: t.location, icon: t.locationIcon || '📍', personnel: [] };
    for (const p of (t.personnel || [])) {
      if (!byLocation[key].personnel.find(x => x.id === p.id)) byLocation[key].personnel.push(p);
    }
  }

  const checkedInNames = new Set((aktifPersonel || []).map(p => p.name.toLowerCase().trim()));

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4, minHeight: 0 }}>
      {Object.values(byLocation).map(loc => (
        <div key={loc.location} style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#fff' }}>
            <span>{loc.icon}</span>
            <span>{loc.location}</span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>· {loc.personnel.length} kişi</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {loc.personnel.map(p => {
              const isIn = checkedInNames.has(p.name.toLowerCase().trim());
              const info = (aktifPersonel || []).find(x => x.name.toLowerCase().trim() === p.name.toLowerCase().trim());
              const time = info?.checkinZamani ? new Date(info.checkinZamani).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';
              return (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 8px', borderRadius: 6, fontSize: 11,
                  background: isIn ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isIn ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  color: isIn ? '#a8e6cf' : 'rgba(255,255,255,0.7)',
                }}>
                  {isIn && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d399' }} />}
                  <span style={{ fontWeight: 700 }}>{p.name}</span>
                  {isIn && <span style={{ fontSize: 9, color: 'rgba(52,211,153,0.8)' }}>içeride {time}</span>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────
export type CenterView = 'feed' | 'rotasyon' | 'rotasyon-atama';

interface PcDashboardProps {
  data: PcDashboardData | null;
  loading: boolean;
  lastRefresh: Date | null;
  onRefresh: () => void;
  onLockScreen?: () => void;
  companyKey?: string;
  ghostCompanyName?: string | null;
  onExitGhost?: () => void;
  centerView?: CenterView;
  onCenterViewChange?: (v: CenterView) => void;
}

// Canlı feed ref — dashboard yenile butonuna basınca feed de yenilensin
let triggerFeedRefresh: (() => void) | null = null;

export function PcDashboard({ data, loading, lastRefresh, onRefresh, onLockScreen, companyKey, ghostCompanyName, onExitGhost, centerView: centerViewProp, onCenterViewChange }: PcDashboardProps) {
  const [autoRefresh, setAutoRefresh] = useState(false);

  const handleRefreshAll = () => {
    onRefresh();
    if (triggerFeedRefresh) triggerFeedRefresh();
  };

  // Otomatik yenileme (15 sn) — kullanıcı toggle ile açar
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      onRefresh();
      if (triggerFeedRefresh) triggerFeedRefresh();
    }, 15_000);
    return () => clearInterval(id);
  }, [autoRefresh, onRefresh]);
  const [internalCenterView, setInternalCenterView] = useState<CenterView>('feed');
  const centerView = centerViewProp ?? internalCenterView;
  const setCenterView = (v: CenterView) => {
    if (onCenterViewChange) onCenterViewChange(v);
    else setInternalCenterView(v);
  };
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [feedSplit, setFeedSplit] = useState(false);
  const [salesMekanFilter, setSalesMekanFilter] = useState<string>('all');

  const anomali = data?.anomaliSayisi ?? 0;
  const gecGiris = data?.gecGirisSayisi ?? 0;
  const viewLabel = centerView === 'feed' ? 'Canlı Feed'
    : centerView === 'rotasyon' ? 'Rotasyon Bilgileri'
    : 'Rotasyon Atama';

  return (
    <>
      <div className="pc-dash-header">
        <div>
          <div className="pc-dash-title">Dashboard</div>
          <div className="pc-dash-sub">
            {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}
            {lastRefresh && ` · ${lastRefresh.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {ghostCompanyName && onExitGhost && (
            <button
              onClick={onExitGhost}
              title={`Analizi kapat (${ghostCompanyName})`}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px',
                background: 'rgba(251,191,36,0.12)',
                border: '1px solid rgba(251,191,36,0.35)',
                borderRadius: 8, color: '#fbbf24',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              <X size={12} />
              📊 {ghostCompanyName}
            </button>
          )}
          {onLockScreen && (
            <button
              onClick={onLockScreen}
              title="Ekranı gizle (PC başından kalkınca)"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px',
                background: 'rgba(255,180,50,0.1)',
                border: '1px solid rgba(255,180,50,0.3)',
                borderRadius: 8, color: '#fbbf24',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}
            >
              <EyeOff size={12} />
              Gizle
            </button>
          )}
          <button
            onClick={() => setAutoRefresh(v => !v)}
            title={autoRefresh ? 'Otomatik yenileme aktif (15sn)' : 'Otomatik yenilemeyi başlat'}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px',
              background: autoRefresh ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${autoRefresh ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 8,
              color: autoRefresh ? '#34d399' : 'rgba(255,255,255,0.7)',
              fontSize: 12, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {autoRefresh ? <Pause size={12} /> : <Play size={12} />}
            {autoRefresh ? 'Oto · 15sn' : 'Otomatik'}
            {autoRefresh && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d399', marginLeft: 2 }} />}
          </button>
          <button onClick={handleRefreshAll} disabled={loading} title="Sayfayı yenile"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px',
              background: 'rgba(168,230,207,0.12)',
              border: '1px solid rgba(168,230,207,0.3)',
              borderRadius: 8,
              color: '#a8e6cf',
              fontSize: 12, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
            }}>
            <RefreshCw size={13} style={loading ? { animation: 'pc-spin 0.8s linear infinite' } : undefined} />
            Yenile
          </button>
        </div>
      </div>

      {/* Üst 3 kart */}
      <div className="pc-stat-grid">
        <div className="pc-stat-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'stretch', height: '100%', minWidth: 0 }}>
            {/* Sol: Toplam Ciro (orijinal) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, flex: '0 0 180px' }}>
              <div className="pc-stat-card-icon" style={{ background: 'rgba(168,230,207,0.15)', border: '1px solid rgba(168,230,207,0.3)', flexShrink: 0 }}>
                <DollarSign size={16} color="#a8e6cf" />
              </div>
              <div>
                <div className="pc-stat-card-label">Toplam Ciro</div>
                <div className="pc-stat-card-value">{loading && !data ? '—' : formatTL(data?.toplamCiro ?? 0)}</div>
              </div>
            </div>
            {/* Sağ: Ödeme Dağılımı stacked bar — tam yükseklik */}
            {(() => {
              const od = data?.odemeDagilimi || { nakit: 0, kart: 0, iban: 0 };
              const total = od.nakit + od.kart + od.iban;
              if (total === 0) {
                return (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 11, padding: 12 }}>
                    Henüz ödeme yok
                  </div>
                );
              }
              const segments = [
                { key: 'nakit', label: 'NAKİT', emoji: '💵', val: od.nakit, color: 'rgba(52,211,153,0.18)',  border: 'rgba(52,211,153,0.35)',  textColor: '#a8e6cf' },
                { key: 'kart',  label: 'KART',  emoji: '💳', val: od.kart,  color: 'rgba(249,168,212,0.16)', border: 'rgba(249,168,212,0.3)',  textColor: '#f9a8d4' },
                { key: 'iban',  label: 'İBAN',  emoji: '🏦', val: od.iban,  color: 'rgba(96,165,250,0.16)',  border: 'rgba(96,165,250,0.3)',   textColor: '#93c5fd' },
              ].filter(s => s.val > 0);
              return (
                <div style={{ flex: 1, display: 'flex', alignItems: 'stretch' }}>
                  {segments.map((s, idx) => {
                    const pct = (s.val / total) * 100;
                    const isWide = pct > 18;
                    const isMedium = pct > 10;
                    return (
                      <div
                        key={s.key}
                        style={{
                          flex: `${pct} 0 0`,
                          background: s.color,
                          color: s.textColor,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          padding: '4px 6px', minWidth: 0,
                          borderLeft: idx > 0 ? '1px solid rgba(255,255,255,0.08)' : undefined,
                          borderTopRightRadius: idx === segments.length - 1 ? 12 : 0,
                          borderBottomRightRadius: idx === segments.length - 1 ? 12 : 0,
                          overflow: 'hidden',
                          textAlign: 'center',
                        }}
                        title={`${s.label}: ${formatTL(s.val)} (${Math.round(pct)}%)`}
                      >
                        {isWide ? (
                          <>
                            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5 }}>{s.emoji} {s.label}</div>
                            <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.1 }}>{formatTL(s.val)}</div>
                            <div style={{ fontSize: 10, opacity: 0.7 }}>%{Math.round(pct)}</div>
                          </>
                        ) : isMedium ? (
                          <>
                            <div style={{ fontSize: 14 }}>{s.emoji}</div>
                            <div style={{ fontSize: 12, fontWeight: 900 }}>{formatTL(s.val)}</div>
                          </>
                        ) : (
                          <div style={{ fontSize: 12 }}>{s.emoji}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
        {(() => {
          const palette = [
            { bg: 'rgba(168,230,207,0.18)', border: 'rgba(168,230,207,0.35)', text: '#a8e6cf' },
            { bg: 'rgba(157,217,234,0.18)', border: 'rgba(157,217,234,0.35)', text: '#9dd9ea' },
            { bg: 'rgba(197,168,245,0.18)', border: 'rgba(197,168,245,0.35)', text: '#c5a8f5' },
            { bg: 'rgba(251,191,36,0.18)',  border: 'rgba(251,191,36,0.35)',  text: '#fbbf24' },
            { bg: 'rgba(249,168,212,0.18)', border: 'rgba(249,168,212,0.35)', text: '#f9a8d4' },
            { bg: 'rgba(251,146,60,0.18)',  border: 'rgba(251,146,60,0.35)',  text: '#fb923c' },
          ];
          const mekanlar = (data?.mekanCiroList || []).filter(m => (m.urunDagilimi || []).length > 0);
          const validIds = new Set(['all', ...mekanlar.map(m => m.id)]);
          const activeFilter = validIds.has(salesMekanFilter) ? salesMekanFilter : 'all';
          let albums: { tip: string; adet: number }[];
          let displayCount: number;
          if (activeFilter === 'all') {
            albums = data?.albumDagilimi || [];
            displayCount = data?.toplamAdet ?? 0;
          } else {
            const m = mekanlar.find(x => x.id === activeFilter);
            albums = m?.urunDagilimi || [];
            displayCount = m?.adet ?? 0;
          }
          // 2 satıra böl (yarıya, top-half üstte, alt-half altta)
          const mid = Math.ceil(albums.length / 2);
          const row1 = albums.slice(0, mid);
          const row2 = albums.slice(mid);
          const renderChip = (a: { tip: string; adet: number }, idx: number, offset: number) => {
            const p = palette[(idx + offset) % palette.length];
            return (
              <div
                key={a.tip + idx + offset}
                title={`${a.tip}: ${a.adet}`}
                style={{
                  flex: '0 0 auto',
                  background: p.bg,
                  border: `1px solid ${p.border}`,
                  borderRadius: 7,
                  padding: '2px 8px',
                  display: 'flex', alignItems: 'center', gap: 4,
                  color: p.text,
                  whiteSpace: 'nowrap',
                  lineHeight: 1.2,
                }}
              >
                <span style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.95 }}>{a.tip}</span>
                <span style={{ fontSize: 12, fontWeight: 900 }}>×{a.adet}</span>
              </div>
            );
          };
          return (
            <div className="pc-stat-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'stretch', height: '100%', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 8px 10px', flex: '0 0 130px' }}>
                  <div className="pc-stat-card-icon" style={{ background: 'rgba(157,217,234,0.15)', border: '1px solid rgba(157,217,234,0.3)', flexShrink: 0 }}>
                    <ShoppingBag size={16} color="#9dd9ea" />
                  </div>
                  <div>
                    <div className="pc-stat-card-label">Satış Adedi</div>
                    <div className="pc-stat-card-value">{loading && !data ? '—' : displayCount.toLocaleString('tr-TR')}</div>
                  </div>
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0, gap: 6, padding: '0 8px 0 0' }}>
                  <div
                    style={{
                      flex: 1, display: 'flex', flexDirection: 'column',
                      justifyContent: 'center', gap: 3, minWidth: 0, overflow: 'hidden', padding: '4px 0',
                    }}
                  >
                    {albums.length === 0 ? (
                      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, paddingLeft: 4 }}>Satış yok</div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', gap: 4, overflow: 'hidden' }}>
                          {row1.map((a, idx) => renderChip(a, idx, 0))}
                        </div>
                        {row2.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, overflow: 'hidden' }}>
                            {row2.map((a, idx) => renderChip(a, idx, mid))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {mekanlar.length > 0 && (
                    <select
                      value={activeFilter}
                      onChange={e => setSalesMekanFilter(e.target.value)}
                      title="Mekan filtrele"
                      style={{
                        flex: '0 0 auto',
                        background: 'rgba(157,217,234,0.12)',
                        border: '1px solid rgba(157,217,234,0.3)',
                        borderRadius: 6,
                        color: '#9dd9ea',
                        fontSize: 11, fontWeight: 700,
                        padding: '6px 10px',
                        outline: 'none', cursor: 'pointer',
                        minWidth: 130, maxWidth: 170,
                      }}
                    >
                      <option value="all" style={{ background: '#1a1530', color: '#9dd9ea' }}>Tümü</option>
                      {mekanlar.map(m => (
                        <option key={m.id} value={m.id} style={{ background: '#1a1530', color: '#fff' }}>{m.emoji} {m.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
        <div className="pc-stat-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'stretch', height: '100%', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, flex: '0 0 180px' }}>
              <div className="pc-stat-card-icon" style={{ background: 'rgba(197,168,245,0.15)', border: '1px solid rgba(197,168,245,0.3)', flexShrink: 0 }}>
                <Camera size={16} color="#c5a8f5" />
              </div>
              <div>
                <div className="pc-stat-card-label">Toplam Kare</div>
                <div className="pc-stat-card-value">{loading && !data ? '—' : (data?.toplamKare ?? 0).toLocaleString('tr-TR')}</div>
              </div>
            </div>
            {(() => {
              const satilan = data?.toplamBasilan ?? 0;
              const iade = data?.toplamIadeFoto ?? 0;
              if (satilan === 0 && iade === 0) {
                return (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 11, padding: 12 }}>
                    Henüz kapanış yok
                  </div>
                );
              }
              return (
                <div style={{ flex: 1, display: 'flex', alignItems: 'stretch' }}>
                  <div
                    style={{
                      flex: 1,
                      background: 'rgba(52,211,153,0.15)',
                      borderLeft: '1px solid rgba(52,211,153,0.25)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      padding: '4px 6px', minWidth: 0, gap: 2,
                    }}
                    title={`Satılan: ${satilan.toLocaleString('tr-TR')}`}
                  >
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, color: '#34d399' }}>✅ SATILAN</div>
                    <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.1, color: '#a8e6cf' }}>{satilan.toLocaleString('tr-TR')}</div>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      background: 'rgba(248,113,113,0.13)',
                      borderLeft: '1px solid rgba(248,113,113,0.25)',
                      borderTopRightRadius: 12,
                      borderBottomRightRadius: 12,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      padding: '4px 6px', minWidth: 0, gap: 2,
                    }}
                    title={`İade: ${iade.toLocaleString('tr-TR')}`}
                  >
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, color: '#f87171' }}>↩️ İADE</div>
                    <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.1, color: '#fca5a5' }}>{iade.toLocaleString('tr-TR')}</div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Orta: Canlı Feed (dropdown'lu) + Mekan Ciro */}
      <div className={`pc-middle-row ${centerView === 'rotasyon-atama' ? 'pc-middle-row-fullwidth' : ''}`}>
        <div className="pc-card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, marginBottom: 8, position: 'relative' }}>
            {centerView === 'feed' && (
              <button
                onClick={() => setFeedSplit(v => !v)}
                title={feedSplit ? 'Tek sütuna al' : '3 sütuna böl'}
                style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: feedSplit ? 'rgba(168,230,207,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${feedSplit ? 'rgba(168,230,207,0.3)' : 'rgba(255,255,255,0.1)'}`,
                  color: feedSplit ? '#a8e6cf' : 'rgba(255,255,255,0.7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
              >
                {feedSplit ? <Square size={13} /> : <Columns2 size={13} />}
              </button>
            )}
            <button
              onClick={() => setDropdownOpen(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer',
              }}
            >
              <span>{viewLabel}</span>
              <ChevronDown size={12} />
            </button>
            {dropdownOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                background: 'rgba(20, 15, 50, 0.98)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10, padding: 4, zIndex: 10, minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                {[
                  { k: 'feed' as const, label: 'Canlı Feed' },
                  { k: 'rotasyon' as const, label: 'Rotasyon Bilgileri' },
                  { k: 'rotasyon-atama' as const, label: 'Rotasyon Atama' },
                ].map(opt => (
                  <button
                    key={opt.k}
                    onClick={() => { setCenterView(opt.k); setDropdownOpen(false); }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '8px 10px',
                      background: centerView === opt.k ? 'rgba(168,230,207,0.12)' : 'transparent',
                      border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {centerView === 'feed' && <CanliFeedPanel split={feedSplit} companyKey={companyKey} />}
          {centerView === 'rotasyon' && <RotasyonPanel aktifPersonel={data?.aktifPersonelDetay ?? []} />}
          {centerView === 'rotasyon-atama' && <PcRotasyonAtama companyKey={companyKey} />}
        </div>

        {/* Sağ: Mekanlar — kart formatı, aktif/aktif değil ayrımlı; atama modunda gizli */}
        {centerView !== 'rotasyon-atama' && <div className="pc-card" style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 13, fontWeight: 800, color: '#fff' }}>
            Günlük Mekan Özet Raporu <span style={{ fontSize: 10, color: '#34d399', marginLeft: 6 }}>(Canlı)</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(data?.mekanCiroList ?? []).length === 0 ? (
              <div className="pc-empty" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>mekan yok</div>
            ) : (() => {
              const all = data?.mekanCiroList ?? [];
              const aktif = all.filter(m => m.acik);
              const pasif = all.filter(m => !m.acik);
              const renderCard = (m: typeof all[0]) => (
                <div key={m.id} style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: m.acik ? (m.color + '10') : 'rgba(255,255,255,0.02)',
                  border: '1px solid ' + (m.acik ? (m.color + '30') : 'rgba(255,255,255,0.06)'),
                  borderLeft: '3px solid ' + (m.acik ? m.color : 'rgba(255,255,255,0.15)'),
                  opacity: m.acik ? 1 : 0.55,
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 20 }}>{m.emoji}</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: m.acik ? m.color : 'rgba(255,255,255,0.6)', letterSpacing: -0.2 }}>{m.name}</span>
                    </div>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{m.adet} satış</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
                    {/* Sol: CİRO büyük */}
                    <div style={{ flex: '0 0 48%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4px 6px' }}>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600, letterSpacing: 0.5 }}>CİRO</span>
                      <span style={{ fontSize: 22, fontWeight: 900, color: '#a8e6cf', lineHeight: 1.1 }}>
                        {formatTL(m.ciro)}
                      </span>
                    </div>
                    {/* Dikey ayırıcı */}
                    <div style={{ width: 1, background: 'rgba(255,255,255,0.1)', margin: '4px 8px' }} />
                    {/* Sağ: KARE + İSKONTO */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>KARE</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: (m.kare || 0) > 0 ? '#c5a8f5' : 'rgba(255,255,255,0.35)' }}>
                          {(m.kare || 0).toLocaleString('tr-TR')}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>İSKONTO</span>
                        <span style={{ fontSize: 13, fontWeight: 800, color: (m.iskonto || 0) > 0 ? '#ffd4a3' : 'rgba(255,255,255,0.35)' }}>
                          {(m.iskonto || 0) > 0 ? `-${formatTL(m.iskonto || 0)}` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
              return (
                <>
                  {aktif.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px 4px', fontSize: 9, fontWeight: 800, color: '#34d399', letterSpacing: 1 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d399' }} />
                      AKTİF
                      <span style={{ flex: 1, height: 1, background: 'rgba(52,211,153,0.2)' }} />
                    </div>
                  )}
                  {aktif.map(renderCard)}
                  {pasif.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 4px 4px', fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.35)', letterSpacing: 1 }}>
                      AKTİF DEĞİL
                      <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
                    </div>
                  )}
                  {pasif.map(renderCard)}
                </>
              );
            })()}
          </div>
        </div>}
      </div>

      {/* Alt: 3 mini kart — Aktif Mekan | Combo (Anomali+Geç Giriş) | (yeni) */}
      <div className="pc-mini-row pc-mini-row-3col">
        {(() => {
          const bugun = data?.toplamCiro ?? 0;
          const dunSaatlik = data?.dunCiroSaatlik ?? 0;
          const dunGunluk = data?.dunCiroGunluk ?? 0;
          const formatTLShort = (n: number) => {
            const abs = Math.abs(n);
            if (abs >= 1_000_000) return `₺${(n / 1_000_000).toFixed(1)}M`;
            if (abs >= 1_000) return `₺${(n / 1_000).toFixed(1)}K`;
            return `₺${Math.round(n)}`;
          };
          const calc = (dun: number) => {
            const fark = bugun - dun;
            let pct: number | null = null;
            if (dun > 0) pct = (fark / dun) * 100;
            const isUp = fark > 0;
            const isDown = fark < 0;
            const color = isUp ? '#34d399' : isDown ? '#f87171' : 'rgba(255,255,255,0.6)';
            const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
            const pctText = dun === 0 && bugun === 0 ? '—' : pct === null ? 'İlk gün' : `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
            const hintText = pct === null ? (dun === 0 ? 'dün veri yok' : '—') : `${fark >= 0 ? '+' : '−'}${formatTLShort(Math.abs(fark))}`;
            return { fark, pct, color, Icon, pctText, hintText };
          };
          const saatlik = calc(dunSaatlik);
          const gunluk = calc(dunGunluk);
          // Border rengi: saatlik önceliği
          const borderC = saatlik.fark > 0 ? 'rgba(52,211,153,0.3)'
            : saatlik.fark < 0 ? 'rgba(248,113,113,0.3)'
            : undefined;
          return (
            <div className="pc-mini-card" style={{ padding: 0, display: 'flex', borderColor: borderC }}>
              {/* Sol: Saatlik */}
              <div style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <saatlik.Icon size={10} color={saatlik.color} /> Saatlik
                </div>
                <div style={{ fontSize: 16, fontWeight: 900, color: saatlik.color, lineHeight: 1.1 }}>{saatlik.pctText}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>{saatlik.hintText}</div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />
              {/* Sağ: Günlük */}
              <div style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <gunluk.Icon size={10} color={gunluk.color} /> Günlük
                </div>
                <div style={{ fontSize: 16, fontWeight: 900, color: gunluk.color, lineHeight: 1.1 }}>{gunluk.pctText}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>{gunluk.hintText}</div>
              </div>
            </div>
          );
        })()}
        {/* Combo: Anomali + Geç Giriş (mobil mantık) */}
        <div
          className="pc-mini-card"
          style={{
            padding: 0,
            display: 'flex',
            borderColor: anomali > 0 ? 'rgba(248,113,113,0.3)' : gecGiris > 0 ? 'rgba(255,180,50,0.3)' : undefined,
          }}
        >
          <div style={{ flex: 1, padding: '10px 12px' }}>
            <div className="pc-mini-card-label"><AlertTriangle size={12} color={anomali > 0 ? '#f87171' : 'rgba(255,255,255,0.5)'} /> Anomali</div>
            <div className="pc-mini-card-value" style={{ color: anomali > 0 ? '#f87171' : '#fff' }}>{anomali}</div>
            <div className="pc-mini-card-hint">{anomali > 0 ? 'dikkat' : 'yok'}</div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />
          <div style={{ flex: 1, padding: '10px 12px' }}>
            <div className="pc-mini-card-label"><Clock size={12} color={gecGiris > 0 ? '#fbbf24' : 'rgba(255,255,255,0.5)'} /> Geç Giriş</div>
            <div className="pc-mini-card-value" style={{ color: gecGiris > 0 ? '#fbbf24' : '#fff' }}>{gecGiris}</div>
            <div className="pc-mini-card-hint">{gecGiris > 0 ? 'bugün' : 'yok'}</div>
          </div>
        </div>
        {/* Genel Stok — sol: toplam albüm, sağ: ribon */}
        {(() => {
          const gs = data?.genelStok || { albumToplam: 0, ribon: 0, paspartu: 0 };
          const formatShort = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;
          const ribonKritik = gs.ribon <= 3;
          const borderC = ribonKritik && gs.ribon > 0 ? 'rgba(251,146,60,0.3)' : undefined;
          return (
            <div className="pc-mini-card" style={{ padding: 0, display: 'flex', borderColor: borderC }}>
              <div style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Package size={10} color="#a8e6cf" /> Genel Stok
                </div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#a8e6cf', lineHeight: 1.1 }}>{formatShort(gs.albumToplam)}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>albüm · {gs.paspartu} pasp.</div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />
              <div style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Film size={10} color={ribonKritik && gs.ribon > 0 ? '#fb923c' : '#c5a8f5'} /> Ribon
                </div>
                <div style={{ fontSize: 16, fontWeight: 900, color: ribonKritik && gs.ribon > 0 ? '#fb923c' : '#c5a8f5', lineHeight: 1.1 }}>{gs.ribon}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>{gs.ribon === 0 ? 'stok yok' : ribonKritik ? 'az kaldı' : 'takım'}</div>
              </div>
            </div>
          );
        })()}
      </div>
    </>
  );
}
