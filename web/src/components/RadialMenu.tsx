import { useCallback, useEffect, useRef } from 'react';

export interface RadialMenuItem {
  label: string;
  icon: string;
  action: () => void;
  variant?: 'danger';
}

interface Props {
  x: number;
  y: number;
  items: RadialMenuItem[];
  onClose: () => void;
}

export default function RadialMenu({ x, y, items, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on any click outside or scroll
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handle);
    }, 10);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', handle);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [onClose]);

  const handleItemClick = useCallback(
    (action: () => void) => {
      action();
      onClose();
    },
    [onClose],
  );

  return (
    <div
      className="context-menu"
      ref={menuRef}
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) => (
        <button
          key={item.label}
          className={`context-menu-item ${item.variant || ''}`}
          style={{ animationDelay: `${i * 0.03}s` }}
          onClick={() => handleItemClick(item.action)}
        >
          <span className="context-menu-icon">{item.icon}</span>
          <span className="context-menu-label">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
