/**
 * Marquee (rubber-band) selection. Tracks the in-flight marquee
 * rectangle in board-relative coordinates, exposes the live `marquee`
 * shape for the render layer to draw, and on pointer-up hit-tests the
 * board's items into a fresh `SelectedItem[]`.
 *
 * The hook does not own React's selection state — it returns a
 * `commit()` that the caller passes its `setSelection` to, or it can
 * read the selection back via the `commitWithItems` helper.
 *
 * Coordinates:
 *   - marquee corners are stored in *board-relative* px (the rect
 *     overlay sits in screen space, not canvas space).
 *   - hit-testing converts to canvas coords using the supplied
 *     `transform` ref before checking item bounds.
 */
import { useCallback, useRef, useState } from 'react';
import type { BoardState } from '../../types';
import type { SelectedItem } from './useClipboard';

const DRAG_THRESHOLD = 4;
const POSTIT_W = 160;
const POSTIT_H = 100;

interface MarqueeAnchor {
  boardX: number;
  boardY: number;
  screenStartX: number;
  screenStartY: number;
}

export interface MarqueeRect { sx: number; sy: number; ex: number; ey: number }

export interface MarqueeSelectionApi {
  /** Live marquee rectangle for the render layer (null when idle). */
  marquee: MarqueeRect | null;
  /** Begin a marquee at the given screen point (board-relative coords inside). */
  start: (e: { clientX: number; clientY: number }, boardRect: { left: number; top: number }) => void;
  /** Update the marquee while dragging. Returns true if handled. */
  onPointerMove: (e: { clientX: number; clientY: number }) => boolean;
  /**
   * Commit the marquee — clears state and returns the resulting
   * `SelectedItem[]`. If the user clicked without dragging the array
   * is empty (caller should treat as "clear selection").
   * Returns `null` if no marquee was in flight.
   */
  commit: (transform: { x: number; y: number; z: number }, state: BoardState) => SelectedItem[] | null;
  /** Whether a marquee is currently in flight. */
  isActive: () => boolean;
}

export function useMarqueeSelection(): MarqueeSelectionApi {
  const anchor = useRef<MarqueeAnchor | null>(null);
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);

  const start = useCallback<MarqueeSelectionApi['start']>((e, boardRect) => {
    anchor.current = {
      boardX: e.clientX - boardRect.left,
      boardY: e.clientY - boardRect.top,
      screenStartX: e.clientX,
      screenStartY: e.clientY,
    };
  }, []);

  const onPointerMove = useCallback<MarqueeSelectionApi['onPointerMove']>((e) => {
    const a = anchor.current;
    if (!a) return false;
    const dx = e.clientX - a.screenStartX;
    const dy = e.clientY - a.screenStartY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      setMarquee({
        sx: a.boardX,
        sy: a.boardY,
        ex: a.boardX + dx,
        ey: a.boardY + dy,
      });
    }
    return true;
  }, []);

  const commit = useCallback<MarqueeSelectionApi['commit']>((t, state) => {
    if (!anchor.current) return null;
    const rect = marquee;
    anchor.current = null;
    setMarquee(null);
    if (!rect) return [];
    // Board-relative → canvas: (boardPos - pan) / zoom.
    const c1 = { x: (rect.sx - t.x) / t.z, y: (rect.sy - t.y) / t.z };
    const c2 = { x: (rect.ex - t.x) / t.z, y: (rect.ey - t.y) / t.z };
    const minX = Math.min(c1.x, c2.x);
    const maxX = Math.max(c1.x, c2.x);
    const minY = Math.min(c1.y, c2.y);
    const maxY = Math.max(c1.y, c2.y);

    const out: SelectedItem[] = [];
    for (const p of Object.values(state.postIts)) {
      if (p.x + POSTIT_W > minX && p.x < maxX && p.y + POSTIT_H > minY && p.y < maxY) {
        out.push({ type: 'postit', id: p.id });
      }
    }
    for (const g of Object.values(state.groups)) {
      if (g.x + g.w > minX && g.x < maxX && g.y + g.h > minY && g.y < maxY) {
        out.push({ type: 'group', id: g.id });
      }
    }
    for (const img of Object.values(state.images || {})) {
      if (img.x + img.w > minX && img.x < maxX && img.y + img.h > minY && img.y < maxY) {
        out.push({ type: 'image', id: img.id });
      }
    }
    return out;
  }, [marquee]);

  const isActive = useCallback(() => anchor.current !== null, []);

  return { marquee, start, onPointerMove, commit, isActive };
}
