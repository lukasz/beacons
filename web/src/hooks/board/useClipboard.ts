/**
 * Board clipboard — copy a selection of items, paste them at a target
 * canvas position. State lives in a `useRef` so we don't re-render the
 * board when the clipboard changes; callers read `hasItems()` on
 * demand (e.g. when building a context menu).
 */
import { useCallback, useRef } from 'react';
import type { BoardState } from '../../types';

export interface SelectedItem {
  type: 'postit' | 'group' | 'section' | 'image';
  id: string;
}

type ClipItem =
  | { type: 'postit'; data: { text: string; colorIdx: number; sectionId: string; groupId?: string }; dx: number; dy: number }
  | { type: 'group';  data: { label: string; w: number; h: number }; dx: number; dy: number }
  | { type: 'section'; data: { title: string; colorIdx: number; w: number; h: number }; dx: number; dy: number };

interface ClipboardData { items: ClipItem[] }

type Send = (type: string, payload: unknown) => void;

export interface ClipboardApi {
  /** Snapshot the selected items into the clipboard. No-op if empty. */
  copyItems: (items: SelectedItem[]) => void;
  /** Paste at the given canvas anchor — first item lands at (anchorX, anchorY). */
  pasteItems: (anchorX: number, anchorY: number) => void;
  /** Whether anything is currently in the clipboard. Read on demand. */
  hasItems: () => boolean;
}

export function useClipboard(state: BoardState, send: Send, userId: string): ClipboardApi {
  const clipboardRef = useRef<ClipboardData | null>(null);

  const copyItems = useCallback(
    (items: SelectedItem[]) => {
      if (items.length === 0) return;
      // Compute anchor (top-left of bounding box) so we can re-anchor on paste.
      let minX = Infinity;
      let minY = Infinity;
      const raw: { item: SelectedItem; x: number; y: number }[] = [];
      for (const item of items) {
        if (item.type === 'postit') {
          const p = state.postIts[item.id];
          if (!p) continue;
          raw.push({ item, x: p.x, y: p.y });
        } else if (item.type === 'group') {
          const g = state.groups[item.id];
          if (!g) continue;
          raw.push({ item, x: g.x, y: g.y });
        } else if (item.type === 'section') {
          const s = state.sections[item.id];
          if (!s) continue;
          raw.push({ item, x: s.x, y: s.y });
        }
      }
      for (const r of raw) {
        if (r.x < minX) minX = r.x;
        if (r.y < minY) minY = r.y;
      }
      const clipItems: ClipItem[] = [];
      for (const { item, x, y } of raw) {
        const dx = x - minX;
        const dy = y - minY;
        if (item.type === 'postit') {
          const p = state.postIts[item.id]!;
          clipItems.push({ type: 'postit', data: { text: p.text, colorIdx: p.colorIdx ?? 0, sectionId: p.sectionId, groupId: p.groupId }, dx, dy });
        } else if (item.type === 'group') {
          const g = state.groups[item.id]!;
          clipItems.push({ type: 'group', data: { label: g.label, w: g.w, h: g.h }, dx, dy });
        } else if (item.type === 'section') {
          const s = state.sections[item.id]!;
          clipItems.push({ type: 'section', data: { title: s.title, colorIdx: s.colorIdx, w: s.w, h: s.h }, dx, dy });
        }
      }
      if (clipItems.length > 0) {
        clipboardRef.current = { items: clipItems };
      }
    },
    [state.postIts, state.groups, state.sections],
  );

  const pasteItems = useCallback(
    (anchorX: number, anchorY: number) => {
      const clip = clipboardRef.current;
      if (!clip || clip.items.length === 0) return;
      for (const item of clip.items) {
        const px = anchorX + item.dx;
        const py = anchorY + item.dy;
        if (item.type === 'postit') {
          send('add_postit', {
            sectionId: '',
            authorId: userId,
            text: item.data.text,
            x: px,
            y: py,
            colorIdx: item.data.colorIdx,
          });
        } else if (item.type === 'group') {
          send('add_group', {
            label: item.data.label,
            x: px,
            y: py,
            w: item.data.w,
            h: item.data.h,
          });
        } else if (item.type === 'section') {
          send('add_section', {
            title: item.data.title,
            colorIdx: item.data.colorIdx,
            x: px,
            y: py,
            w: item.data.w,
            h: item.data.h,
          });
        }
      }
    },
    [send, userId],
  );

  const hasItems = useCallback(() => !!clipboardRef.current?.items.length, []);

  return { copyItems, pasteItems, hasItems };
}
