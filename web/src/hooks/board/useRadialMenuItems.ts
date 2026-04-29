/**
 * Build the items shown by the radial context menu, given the current
 * board state, what was right-clicked, and what's already selected.
 *
 * Three branches:
 *   - multi-selection → bulk copy / delete / "turn N into actions"
 *   - clicked item    → item-specific copy / delete (+ "turn into action" for stickies)
 *   - empty area      → creation menu (sticky / section / group), plus
 *                       paste when the clipboard has items, plus the
 *                       voting toggle.
 */
import { useMemo } from 'react';
import type { BoardState } from '../../types';
import type { RadialMenuItem } from '../../components/RadialMenu';

export interface RadialMenuTarget {
  type: 'postit' | 'group' | 'section' | 'image';
  id: string;
}

interface ScreenPoint { x: number; y: number }

interface SelectedItem { type: 'postit' | 'group' | 'section' | 'image'; id: string }

interface UseRadialMenuItemsOptions {
  state: BoardState;
  userId: string;
  selection: SelectedItem[];
  /** Where the radial menu opened (for empty-area creation actions). */
  radialMenu: { x: number; y: number; target: RadialMenuTarget | null; parentSectionId?: string | null } | null;
  /** Sticky default colour from the floating menu. */
  ctxPostItColor: number;
  /** Section default colour from the floating menu. */
  ctxSectionColor: number;
  /** True while a vote is in flight; toggles the Start/End Vote item. */
  votingActive: boolean;
  /** Convert a screen point to canvas coords (from usePanZoom). */
  screenToCanvas: (sx: number, sy: number) => ScreenPoint;
  /** Whether the board clipboard has anything to paste. */
  hasClipboard: () => boolean;
  send: (type: string, payload: unknown) => void;
  copyItems: (items: SelectedItem[]) => void;
  pasteItems: (x: number, y: number) => void;
  /** Caller-provided selection clear (used by bulk-delete). */
  clearSelection: () => void;
  /**
   * Caller-provided "export Markdown" handler. Receives a Set of item
   * ids to filter the export by; pass undefined to export the whole
   * board.
   */
  onExportMarkdown: (ids?: Set<string>) => void;
}

const DELETE_MSG: Record<string, string> = {
  postit: 'delete_postit',
  group: 'delete_group',
  section: 'delete_section',
  image: 'delete_image',
};

const LABEL_FOR: Record<string, string> = {
  postit: 'sticky',
  group: 'group',
  section: 'section',
  image: 'image',
};

export function useRadialMenuItems(opts: UseRadialMenuItemsOptions): RadialMenuItem[] {
  const {
    state, userId, selection, radialMenu,
    ctxPostItColor, ctxSectionColor, votingActive,
    screenToCanvas, hasClipboard,
    send, copyItems, pasteItems, clearSelection, onExportMarkdown,
  } = opts;

  return useMemo<RadialMenuItem[]>(() => {
    const items: RadialMenuItem[] = [];
    const target = radialMenu?.target ?? null;
    const parentSectionId = radialMenu?.parentSectionId ?? null;
    const userName = state.users[userId]?.name ?? 'Unknown';

    // ── Multi-selection ─────────────────────────────────────────
    if (selection.length > 1) {
      const selectedPostIts = selection.filter((s) => s.type === 'postit');
      const stickiesWithText = selectedPostIts.filter((s) => state.postIts[s.id]?.text);

      if (stickiesWithText.length > 0) {
        items.push({
          label: `Turn ${stickiesWithText.length} into actions`,
          icon: '⚡',
          action: () => {
            for (const s of stickiesWithText) {
              const p = state.postIts[s.id];
              if (!p?.text) continue;
              send('add_action', {
                text: p.text.slice(0, 128),
                done: false,
                authorId: userId,
                authorName: userName,
                createdAt: Date.now(),
              });
            }
          },
        });
      }

      items.push({
        label: `Copy ${selection.length} items`,
        icon: '📋',
        action: () => copyItems(selection),
      });
      items.push({
        label: 'Copy as Markdown',
        icon: '📝',
        action: () => onExportMarkdown(new Set(selection.map((s) => s.id))),
      });
      items.push({
        label: `Delete ${selection.length} items`,
        icon: '🗑️',
        variant: 'danger',
        action: () => {
          for (const item of selection) send(DELETE_MSG[item.type], { id: item.id });
          clearSelection();
        },
      });
      return items;
    }

    // ── Item-specific menu ──────────────────────────────────────
    if (target) {
      if (target.type === 'postit') {
        const p = state.postIts[target.id];
        if (p?.text) {
          items.push({
            label: 'Turn into action',
            icon: '⚡',
            action: () => send('add_action', {
              text: p.text.slice(0, 128),
              done: false,
              authorId: userId,
              authorName: userName,
              createdAt: Date.now(),
            }),
          });
        }
      }
      items.push({
        label: `Copy ${LABEL_FOR[target.type]}`,
        icon: '📋',
        action: () => copyItems([target]),
      });
      items.push({
        label: `Delete ${LABEL_FOR[target.type]}`,
        icon: '🗑️',
        variant: 'danger',
        action: () => send(DELETE_MSG[target.type], { id: target.id }),
      });
      return items;
    }

    // ── Empty-area creation menu ────────────────────────────────
    const pos = radialMenu ? screenToCanvas(radialMenu.x, radialMenu.y) : { x: 200, y: 200 };
    const stickyColor = parentSectionId
      ? (state.sections[parentSectionId]?.colorIdx ?? 0)
      : ctxPostItColor;

    items.push({
      label: 'New Sticky',
      icon: '📝',
      action: () => send('add_postit', {
        sectionId: parentSectionId ?? '',
        authorId: userId,
        text: '',
        x: pos.x,
        y: pos.y,
        colorIdx: stickyColor,
      }),
    });
    items.push({
      label: 'New Section',
      icon: '📋',
      action: () => send('add_section', {
        title: 'New Section',
        colorIdx: ctxSectionColor,
        x: pos.x,
        y: pos.y,
        w: 500,
        h: 400,
      }),
    });
    items.push({
      label: 'New Group',
      icon: '📂',
      action: () => send('add_group', {
        label: 'Group',
        x: pos.x,
        y: pos.y,
        w: 200,
        h: 40,
      }),
    });
    if (hasClipboard()) {
      items.push({
        label: 'Paste',
        icon: '📌',
        action: () => pasteItems(pos.x, pos.y),
      });
    }
    items.push({
      label: votingActive ? 'End Vote' : 'Start Vote',
      icon: votingActive ? '🏁' : '🗳️',
      action: () => {
        if (votingActive) send('vote_close', {});
        else window.dispatchEvent(new CustomEvent('toggle-vote-panel'));
      },
    });
    return items;
  }, [
    radialMenu, screenToCanvas, send, userId, votingActive,
    ctxPostItColor, ctxSectionColor,
    state.sections, state.postIts, state.users,
    selection, copyItems, pasteItems, hasClipboard,
    clearSelection, onExportMarkdown,
  ]);
}
