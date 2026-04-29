/**
 * Selection drag — translate every selected item together by the
 * pointer's screen-space delta. Skips emit until the pointer has moved
 * past `DRAG_THRESHOLD` in screen pixels; this keeps a click-with-wobble
 * from broadcasting a move.
 *
 * Shape mirrors useImageResize: the caller invokes `start(snaps, e)` on
 * pointerdown, `onPointerMove(e)` and `onPointerUp()` on the board
 * pointer-move/up handlers.
 */
import { useCallback, useRef } from 'react';
import { zoomRef } from '../../zoomRef';
import type { BoardState } from '../../types';
import type { SelectedItem } from './useClipboard';

export const DRAG_THRESHOLD = 4;

/**
 * Snapshot the current positions of a list of selected items so a drag
 * can apply deltas to them. Skips items that no longer exist in state.
 */
export function snapshotSelection(items: SelectedItem[], state: BoardState): DragSnapItem[] {
  const out: DragSnapItem[] = [];
  for (const item of items) {
    if (item.type === 'postit') {
      const p = state.postIts[item.id];
      if (p) out.push({ type: 'postit', id: item.id, x: p.x, y: p.y });
    } else if (item.type === 'section') {
      const s = state.sections[item.id];
      if (s) out.push({ type: 'section', id: item.id, x: s.x, y: s.y });
    } else if (item.type === 'group') {
      const g = state.groups[item.id];
      if (g) out.push({ type: 'group', id: item.id, x: g.x, y: g.y });
    } else if (item.type === 'image') {
      const im = (state.images || {})[item.id];
      if (im) out.push({ type: 'image', id: item.id, x: im.x, y: im.y });
    }
  }
  return out;
}

export interface DragSnapItem {
  type: 'postit' | 'section' | 'group' | 'image';
  id: string;
  x: number;
  y: number;
}

interface DragState {
  startX: number;
  startY: number;
  moved: boolean;
  snaps: DragSnapItem[];
}

type Send = (type: string, payload: unknown) => void;

const MESSAGE_BY_TYPE: Record<DragSnapItem['type'], string> = {
  postit: 'move_postit',
  section: 'update_section',
  group: 'update_group',
  image: 'move_image',
};

export interface SelectionDragApi {
  /** Begin a drag from the supplied screen anchor with snapshotted positions. */
  start: (snaps: DragSnapItem[], e: { clientX: number; clientY: number }) => void;
  /** Handle a pointer-move while a drag is active. Returns true if handled. */
  onPointerMove: (e: { clientX: number; clientY: number }) => boolean;
  /** End the drag. Returns true if a drag was active. */
  onPointerUp: () => boolean;
  /** Whether a drag is currently in flight. */
  isActive: () => boolean;
  /** Whether the active drag has crossed the move threshold. */
  hasMoved: () => boolean;
}

export function useSelectionDrag(send: Send): SelectionDragApi {
  const ref = useRef<DragState | null>(null);

  const start = useCallback<SelectionDragApi['start']>((snaps, e) => {
    ref.current = { startX: e.clientX, startY: e.clientY, moved: false, snaps };
  }, []);

  const onPointerMove = useCallback<SelectionDragApi['onPointerMove']>((e) => {
    const r = ref.current;
    if (!r) return false;
    const sdx = e.clientX - r.startX;
    const sdy = e.clientY - r.startY;
    // Stay quiet until the pointer has actually moved beyond click-wobble.
    if (!r.moved && Math.abs(sdx) <= DRAG_THRESHOLD && Math.abs(sdy) <= DRAG_THRESHOLD) {
      return true; // we still own the event, just chose not to emit yet
    }
    r.moved = true;

    const z = zoomRef.current || 1;
    const dx = sdx / z;
    const dy = sdy / z;
    for (const snap of r.snaps) {
      send(MESSAGE_BY_TYPE[snap.type], { id: snap.id, x: snap.x + dx, y: snap.y + dy });
    }
    return true;
  }, [send]);

  const onPointerUp = useCallback<SelectionDragApi['onPointerUp']>(() => {
    if (!ref.current) return false;
    ref.current = null;
    return true;
  }, []);

  const isActive = useCallback(() => ref.current !== null, []);
  const hasMoved = useCallback(() => !!ref.current?.moved, []);

  return { start, onPointerMove, onPointerUp, isActive, hasMoved };
}
