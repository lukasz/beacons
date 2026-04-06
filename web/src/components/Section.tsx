import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useBoard } from '../hooks/useBoard';
import type { Section as SectionType } from '../types';
import { COLORS } from '../types';
import { zoomRef } from '../zoomRef';

function screenToCanvas(screenX: number, screenY: number, sectionX: number, sectionY: number, rect: DOMRect) {
  const z = zoomRef.current || 1;
  return {
    x: sectionX + (screenX - rect.left) / z,
    y: sectionY + (screenY - rect.top) / z,
  };
}

function ColorPicker({ current, onChange, onClose }: { current: number; onChange: (idx: number) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const raf = requestAnimationFrame(() => document.addEventListener('mousedown', handle));
    return () => { cancelAnimationFrame(raf); document.removeEventListener('mousedown', handle); };
  }, [onClose]);
  return (
    <div className="section-color-popup" ref={ref}>
      {COLORS.map((c, i) => (
        <button
          key={i}
          className={`section-color-dot ${current === i ? 'active' : ''}`}
          style={{ background: c }}
          onClick={(e) => { e.stopPropagation(); onChange(i); onClose(); }}
        />
      ))}
    </div>
  );
}

interface Props {
  section: SectionType;
  selected?: boolean;
  grabMode?: boolean;
}

export default function SectionComponent({ section, selected, grabMode }: Props) {
  const { state, send, userId } = useBoard();
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(section.title);
  const [colorOpen, setColorOpen] = useState(false);
  const mountedRef = useRef(false);

  // Auto-enter edit mode for new sections with default title
  useEffect(() => {
    if (!mountedRef.current && section.title === 'New Section') {
      setEditingTitle(true);
      setTitle(section.title);
    }
    mountedRef.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; childSnap: { id: string; x: number; y: number }[]; groupSnap: { id: string; x: number; y: number }[] } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);
  const lastSend = useRef(0);

  const color = COLORS[section.colorIdx] || COLORS[0];

  const sendUpdate = useCallback(
    (partial: Partial<SectionType>) => {
      send('update_section', {
        id: section.id,
        title: section.title,
        colorIdx: section.colorIdx,
        x: section.x,
        y: section.y,
        w: section.w,
        h: section.h,
        ...partial,
      });
    },
    [send, section],
  );

  // Drag header to move — also moves child post-its
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (editingTitle || selected || grabMode) return;
      e.preventDefault();
      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);

      // Snapshot positions of all post-its belonging to this section
      const sectionPostIts = Object.values(state.postIts)
        .filter((p) => p.sectionId === section.id);
      const childSnap = sectionPostIts.map((p) => ({ id: p.id, x: p.x, y: p.y }));

      // Snapshot groups that contain post-its in this section
      const groupIds = new Set(sectionPostIts.map((p) => p.groupId).filter(Boolean));
      const groupSnap = Object.values(state.groups)
        .filter((g) => groupIds.has(g.id))
        .map((g) => ({ id: g.id, x: g.x, y: g.y }));

      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: section.x,
        origY: section.y,
        childSnap,
        groupSnap,
      };
    },
    [editingTitle, selected, section.x, section.y, section.id, state.postIts, state.groups],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const now = Date.now();
      if (now - lastSend.current < 30) return;
      lastSend.current = now;

      const z = zoomRef.current || 1;
      const dx = (e.clientX - dragRef.current.startX) / z;
      const dy = (e.clientY - dragRef.current.startY) / z;

      sendUpdate({
        x: dragRef.current.origX + dx,
        y: dragRef.current.origY + dy,
      });

      // Move all child post-its by the same delta
      for (const child of dragRef.current.childSnap) {
        send('move_postit', { id: child.id, x: child.x + dx, y: child.y + dy });
      }

      // Move all child groups by the same delta
      for (const g of dragRef.current.groupSnap) {
        send('update_group', { id: g.id, x: g.x + dx, y: g.y + dy });
      }
    },
    [sendUpdate, send],
  );

  const handlePointerUp = useCallback(() => {
    // Final position sync — send one last update without throttle
    if (dragRef.current) {
      // Ensure children are at their final positions
      for (const child of dragRef.current.childSnap) {
        const p = state.postIts[child.id];
        if (p) {
          send('move_postit', { id: child.id, x: p.x, y: p.y });
        }
      }
      // Ensure groups are at their final positions
      for (const g of dragRef.current.groupSnap) {
        const grp = state.groups[g.id];
        if (grp) {
          send('update_group', { id: grp.id, x: grp.x, y: grp.y });
        }
      }
    }
    dragRef.current = null;
  }, [send, state.postIts, state.groups]);

  // Resize handle
  const handleResizeDown = useCallback(
    (e: React.PointerEvent) => {
      if (grabMode) return;
      e.preventDefault();
      e.stopPropagation();
      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origW: section.w,
        origH: section.h,
      };
    },
    [section.w, section.h],
  );

  const handleResizeMove = useCallback(
    (e: React.PointerEvent) => {
      if (!resizeRef.current) return;
      const z = zoomRef.current || 1;
      const dx = (e.clientX - resizeRef.current.startX) / z;
      const dy = (e.clientY - resizeRef.current.startY) / z;
      sendUpdate({
        w: Math.max(200, resizeRef.current.origW + dx),
        h: Math.max(150, resizeRef.current.origH + dy),
      });
    },
    [sendUpdate],
  );

  const handleResizeUp = useCallback(() => {
    resizeRef.current = null;
  }, []);

  // Double-click on section body creates a post-it
  const handleBodyDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation(); // prevent board from toggling grab mode
      if (grabMode) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const pos = screenToCanvas(e.clientX, e.clientY, section.x, section.y, rect);
      send('add_postit', {
        sectionId: section.id,
        authorId: userId,
        text: '',
        x: pos.x,
        y: pos.y + 40, // offset for header
      });
    },
    [send, section, userId],
  );

  return (
    <div
      className="section"
      style={{
        transform: `translate(${section.x}px, ${section.y}px)`,
        width: section.w,
        height: section.h,
        borderColor: color,
      }}
    >
      <div
        className="section-header"
        data-item-type="section"
        data-item-id={section.id}
        style={{ backgroundColor: color }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={(e) => { e.stopPropagation(); if (grabMode) return; setTitle(section.title); setEditingTitle(true); }}
      >
        {editingTitle ? (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              setEditingTitle(false);
              send('update_section', { ...section, title });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setEditingTitle(false);
                send('update_section', { ...section, title });
              }
            }}
            autoFocus
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span>{section.title}</span>
        )}
      </div>

      {/* Color picker button — top right corner */}
      <button
        className="section-color-btn"
        title="Change color"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); setColorOpen(!colorOpen); }}
        style={{ color }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" fill="currentColor"/>
        </svg>
      </button>
      {colorOpen && (
        <ColorPicker
          current={section.colorIdx}
          onChange={(idx) => sendUpdate({ colorIdx: idx })}
          onClose={() => setColorOpen(false)}
        />
      )}

      {/* Section body — double-click to create post-it */}
      <div
        className="section-body"
        onDoubleClick={handleBodyDoubleClick}
      />

      {/* Resize handle */}
      <div
        className="section-resize-handle"
        onPointerDown={handleResizeDown}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeUp}
      />
    </div>
  );
}
