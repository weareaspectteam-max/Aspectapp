import { useRef, useState } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';

interface Props {
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  onClose: () => void;
  onFocus: () => void;
  onMove: (x: number, y: number) => void;
  onResize?: (w: number, h: number) => void;
  children: React.ReactNode;
}

const MIN_W = 320;
const MIN_H = 240;
const TOPBAR_H = 56;

export function PcWindow({ title, x, y, w, h, z, onClose, onFocus, onMove, onResize, children }: Props) {
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const dragOffset = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const resizeStart = useRef<{ startX: number; startY: number; startW: number; startH: number }>({ startX: 0, startY: 0, startW: 0, startH: 0 });
  const [maximized, setMaximized] = useState(false);
  const prevRect = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const toggleMaximize = () => {
    if (!onResize) return;
    if (maximized) {
      if (prevRect.current) {
        onMove(prevRect.current.x, prevRect.current.y);
        onResize(prevRect.current.w, prevRect.current.h);
      }
      setMaximized(false);
    } else {
      prevRect.current = { x, y, w, h };
      onMove(0, TOPBAR_H);
      onResize(window.innerWidth, window.innerHeight - TOPBAR_H);
      setMaximized(true);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    onFocus();
    if ((e.target as HTMLElement).closest('[data-close]')) return;
    if ((e.target as HTMLElement).closest('[data-max]')) return;
    if (maximized) return;
    dragOffset.current = { dx: e.clientX - x, dy: e.clientY - y };
    setDragging(true);
    const handleMove = (ev: MouseEvent) => {
      const nx = Math.max(0, Math.min(window.innerWidth - 100, ev.clientX - dragOffset.current.dx));
      const ny = Math.max(56, Math.min(window.innerHeight - 60, ev.clientY - dragOffset.current.dy));
      onMove(nx, ny);
    };
    const handleUp = () => {
      setDragging(false);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const startResize = (e: React.MouseEvent, dir: 'se' | 's' | 'e') => {
    e.stopPropagation();
    e.preventDefault();
    if (!onResize) return;
    onFocus();
    resizeStart.current = { startX: e.clientX, startY: e.clientY, startW: w, startH: h };
    setResizing(true);
    const handleMove = (ev: MouseEvent) => {
      const dx = ev.clientX - resizeStart.current.startX;
      const dy = ev.clientY - resizeStart.current.startY;
      let nw = resizeStart.current.startW;
      let nh = resizeStart.current.startH;
      if (dir === 'e' || dir === 'se') nw = Math.max(MIN_W, Math.min(window.innerWidth - x - 10, resizeStart.current.startW + dx));
      if (dir === 's' || dir === 'se') nh = Math.max(MIN_H, Math.min(window.innerHeight - y - 10, resizeStart.current.startH + dy));
      onResize(nw, nh);
    };
    const handleUp = () => {
      setResizing(false);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  return (
    <div
      className="pc-window"
      onMouseDown={onFocus}
      style={{ position: 'fixed', left: x, top: y, width: w, height: h, zIndex: z }}
    >
      <div
        className="pc-window-header"
        onMouseDown={handleMouseDown}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest('[data-close]')) return;
          if ((e.target as HTMLElement).closest('[data-max]')) return;
          toggleMaximize();
        }}
        style={{ cursor: maximized ? 'default' : (dragging ? 'grabbing' : 'grab') }}
      >
        <span className="pc-window-title">{title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {onResize && (
            <button
              data-max
              onClick={toggleMaximize}
              className="pc-window-close"
              aria-label={maximized ? 'Eski boyut' : 'Tam ekran'}
              title={maximized ? 'Eski boyuta dön' : 'Tam ekran yap'}
            >
              {maximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          )}
          <button data-close onClick={onClose} className="pc-window-close" aria-label="Kapat">
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="pc-window-body">{children}</div>
      {onResize && !maximized && (
        <>
          {/* Sağ kenar */}
          <div
            onMouseDown={(e) => startResize(e, 'e')}
            style={{
              position: 'absolute', top: 30, right: -2, bottom: 14, width: 6,
              cursor: 'ew-resize', userSelect: 'none', zIndex: 2,
            }}
          />
          {/* Alt kenar */}
          <div
            onMouseDown={(e) => startResize(e, 's')}
            style={{
              position: 'absolute', left: 14, right: 14, bottom: -2, height: 6,
              cursor: 'ns-resize', userSelect: 'none', zIndex: 2,
            }}
          />
          {/* Sağ-alt köşe */}
          <div
            onMouseDown={(e) => startResize(e, 'se')}
            title="Yeniden boyutlandır"
            style={{
              position: 'absolute', right: 0, bottom: 0, width: 18, height: 18,
              cursor: 'nwse-resize', userSelect: 'none', zIndex: 3,
              background: resizing ? 'rgba(168,230,207,0.25)' : 'transparent',
              borderRight: '2px solid rgba(255,255,255,0.25)',
              borderBottom: '2px solid rgba(255,255,255,0.25)',
              borderBottomRightRadius: 12,
            }}
          />
        </>
      )}
    </div>
  );
}
