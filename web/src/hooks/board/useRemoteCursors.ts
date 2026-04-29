/**
 * Live presence cursors for the board.
 *
 * Owns:
 *   - the throttled outbound `send('cursor_move', ...)` (one per ~50ms),
 *   - the inbound cursor map updated by the registered handler, batched
 *     into React state via requestAnimationFrame to avoid re-render storms,
 *   - a 3-second sweep that drops cursors we haven't heard from in 5s.
 *
 * The inbound handler is registered with `handlerRegistry` so App.tsx
 * can dispatch `cursor_move` messages to it without crossing the
 * BoardUiProvider tree.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { handlerRegistry } from '../../state/handlerRegistry';

export interface RemoteCursor {
  userId: string;
  name: string;
  x: number;
  y: number;
  ts: number;
}

interface CursorMessage { userId: string; name: string; x: number; y: number }

type Send = (type: string, payload: unknown) => void;

const THROTTLE_MS = 50;
const STALE_MS = 5_000;
const SWEEP_MS = 3_000;

export interface RemoteCursorsApi {
  /** Cursors currently visible (excludes stale entries). */
  cursors: RemoteCursor[];
  /**
   * Hand a screen-mapped cursor event to the hook. The hook handles
   * throttling and the screen→canvas map is the caller's job.
   */
  trackLocal: (canvasX: number, canvasY: number) => void;
}

export function useRemoteCursors(send: Send): RemoteCursorsApi {
  const [cursors, setCursors] = useState<RemoteCursor[]>([]);
  const cursorMap = useRef<Map<string, RemoteCursor>>(new Map());
  const lastSendAt = useRef(0);
  const rafId = useRef(0);

  // Inbound cursor handler is registered via handlerRegistry so App's
  // WS dispatcher can find it without reaching across the React tree.
  useEffect(() => {
    const handler = (data: CursorMessage) => {
      cursorMap.current.set(data.userId, { ...data, ts: Date.now() });
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        setCursors(Array.from(cursorMap.current.values()));
      });
    };
    handlerRegistry.setCursorHandler(handler);

    // Sweep stale cursors every SWEEP_MS.
    const interval = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, c] of cursorMap.current) {
        if (now - c.ts > STALE_MS) {
          cursorMap.current.delete(id);
          changed = true;
        }
      }
      if (changed) setCursors(Array.from(cursorMap.current.values()));
    }, SWEEP_MS);

    return () => {
      handlerRegistry.setCursorHandler(null);
      clearInterval(interval);
      cancelAnimationFrame(rafId.current);
    };
  }, []);

  const trackLocal = useCallback((canvasX: number, canvasY: number) => {
    const now = Date.now();
    if (now - lastSendAt.current <= THROTTLE_MS) return;
    lastSendAt.current = now;
    send('cursor_move', { x: canvasX, y: canvasY });
  }, [send]);

  return { cursors, trackLocal };
}
