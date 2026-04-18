import { useState, useEffect, useRef } from 'react';
import { useCanliFeed, FeedList, buildMekanOptions } from './PcDashboard';
import { PcSimpleDropdown } from '../PcSimpleDropdown';

interface Props {
  companyKey?: string;
}

type TypeFilter = 'all' | 'satis' | 'kare';

export function PcLiveFeed({ companyKey }: Props) {
  const { feed, loading } = useCanliFeed(companyKey, 15_000);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [mekanFilter, setMekanFilter] = useState<string>('all');
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const compute = (w: number) => {
      // 420px → 1.0  ;  900px → ~1.5 (lineer)
      const s = Math.max(1, Math.min(1.6, w / 420));
      setScale(s);
    };
    compute(el.clientWidth);
    const ro = new ResizeObserver(entries => {
      for (const e of entries) compute(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const mekanList = buildMekanOptions(feed);
  const typeOptions = [
    { value: 'all' as TypeFilter,   label: 'Tümü' },
    { value: 'satis' as TypeFilter, label: 'Sadece Satışlar', color: '#a8e6cf' },
    { value: 'kare' as TypeFilter,  label: 'Sadece Kareler',  color: '#c5a8f5' },
  ];
  const mekanOptions = [
    { value: 'all', label: 'Tüm Mekanlar' },
    ...mekanList.map(m => ({
      value: m.value.replace('mekan:', ''),
      label: `${m.emoji} ${m.label}`,
      color: m.color,
    })),
  ];

  const filtered = feed.filter(item => {
    if (typeFilter !== 'all' && item.type !== typeFilter) return false;
    if (mekanFilter !== 'all' && item.mekanId !== mekanFilter) return false;
    return true;
  });

  return (
    <div ref={wrapRef} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, padding: 12, gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexShrink: 0 }}>
        <PcSimpleDropdown
          options={typeOptions}
          value={typeFilter}
          onChange={setTypeFilter}
          align="left"
        />
        <PcSimpleDropdown
          options={mekanOptions}
          value={mekanFilter}
          onChange={setMekanFilter}
          align="right"
        />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {loading && feed.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
            Yükleniyor...
          </div>
        ) : (
          <FeedList items={filtered} emptyText="Bu filtrede kayıt yok" scale={scale} />
        )}
      </div>
    </div>
  );
}
