import { useRef, useState } from 'react';
import { X } from 'lucide-react';

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
  children: React.ReactNode;
}

export function PcWindow({ title, x, y, w, h, z, onClose, onFocus, onMove, children }: Props) {
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    onFocus();
    if ((e.target as HTMLElement).closest('[data-close]')) return;
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

  return (
    <div
      className="pc-window"
      onMouseDown={onFocus}
      style={{ position: 'fixed', left: x, top: y, width: w, height: h, zIndex: z }}
    >
      <div
        className="pc-window-header"
        onMouseDown={handleMouseDown}
        style={{ cursor: dragging ? 'grabbing' : 'grab' }}
      >
        <span className="pc-window-title">{title}</span>
        <button data-close onClick={onClose} className="pc-window-close" aria-label="Kapat">
          <X size={14} />
        </button>
      </div>
      <div className="pc-window-body">{children}</div>
    </div>
  );
}
