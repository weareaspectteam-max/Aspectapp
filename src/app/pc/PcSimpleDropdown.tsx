import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

interface Option<T extends string> {
  value: T;
  label: string;
  color?: string;
}

interface Props<T extends string> {
  options: Array<Option<T>>;
  value: T;
  onChange: (v: T) => void;
  align?: 'left' | 'right';
  size?: 'sm' | 'md';
}

export function PcSimpleDropdown<T extends string>({
  options,
  value,
  onChange,
  align = 'left',
  size = 'md',
}: Props<T>) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left?: number; right?: number; width: number } | null>(null);

  const current = options.find(o => o.value === value);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setCoords({
        top: r.bottom + 4,
        left: align === 'left' ? r.left : undefined,
        right: align === 'right' ? window.innerWidth - r.right : undefined,
        width: Math.max(r.width, 140),
      });
    }
    setOpen(v => !v);
  };

  const btnPadding = size === 'sm' ? '4px 8px' : '6px 10px';
  const btnFont = size === 'sm' ? 11 : 12;
  const btnMinWidth = size === 'sm' ? 110 : 140;

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: btnPadding,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8, color: current?.color || '#fff', fontSize: btnFont, fontWeight: 700, cursor: 'pointer',
          minWidth: btnMinWidth,
        }}
      >
        <span style={{ flex: 1, textAlign: 'left' }}>{current?.label || value}</span>
        <ChevronDown size={11} />
      </button>
      {open && coords && createPortal(
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
          />
          <div
            style={{
              position: 'fixed', top: coords.top,
              left: coords.left, right: coords.right,
              minWidth: coords.width, maxHeight: 320, overflowY: 'auto',
              background: 'rgba(20, 15, 50, 0.98)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8, padding: 4, zIndex: 9999,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
          >
            {options.map(opt => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                style={{
                  width: '100%', textAlign: 'left', padding: '7px 10px',
                  background: value === opt.value ? 'rgba(168,230,207,0.12)' : 'transparent',
                  border: 'none', borderRadius: 5,
                  color: opt.color || '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'block',
                }}
                onMouseEnter={e => { if (value !== opt.value) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { if (value !== opt.value) e.currentTarget.style.background = 'transparent'; }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  );
}
