/**
 * Per-corner resize for board images. Owns the resize ref, computes
 * geometry per corner (preserves aspect ratio, anchors the opposite
 * corner), and broadcasts `move_image` while the user drags.
 *
 * Used by:
 *   - `<Board>` render tree — invokes `start(corner, img, e)` from each
 *     resize-handle's onPointerDown.
 *   - The board pointer-move/up handlers — call `onPointerMove(e)` and
 *     `onPointerUp()` to forward / clear the active resize.
 */
import { useCallback, useRef } from 'react';
import { zoomRef } from '../../zoomRef';

type Corner = 'nw' | 'ne' | 'sw' | 'se';

interface ResizeState {
  id: string;
  startX: number;
  startY: number;
  origW: number;
  origH: number;
  origX: number;
  origY: number;
  corner: Corner;
}

interface ImageRect { id: string; x: number; y: number; w: number; h: number }

type Send = (type: string, payload: unknown) => void;

const MIN_SIZE = 40;

export interface ImageResizeApi {
  /** Start a resize. Wire from each handle's onPointerDown. */
  start: (corner: Corner, img: ImageRect, e: { clientX: number; clientY: number }) => void;
  /** Forward a pointer-move while a resize is in flight. Returns true if the event was handled. */
  onPointerMove: (e: { clientX: number; clientY: number }) => boolean;
  /** End the resize. Returns true if a resize was active. */
  onPointerUp: () => boolean;
  /** Whether a resize is currently in flight. */
  isActive: () => boolean;
}

export function useImageResize(send: Send): ImageResizeApi {
  const ref = useRef<ResizeState | null>(null);

  const start = useCallback<ImageResizeApi['start']>((corner, img, e) => {
    ref.current = {
      id: img.id,
      startX: e.clientX,
      startY: e.clientY,
      origW: img.w,
      origH: img.h,
      origX: img.x,
      origY: img.y,
      corner,
    };
  }, []);

  const onPointerMove = useCallback<ImageResizeApi['onPointerMove']>((e) => {
    const r = ref.current;
    if (!r) return false;
    const z = zoomRef.current || 1;
    const dx = (e.clientX - r.startX) / z;
    const dy = (e.clientY - r.startY) / z;
    const aspect = r.origW / r.origH;
    let newW = r.origW;
    let newH = r.origH;
    let newX = r.origX;
    let newY = r.origY;
    switch (r.corner) {
      case 'se':
        newW = Math.max(MIN_SIZE, r.origW + dx);
        newH = newW / aspect;
        break;
      case 'sw':
        newW = Math.max(MIN_SIZE, r.origW - dx);
        newH = newW / aspect;
        newX = r.origX + r.origW - newW;
        break;
      case 'ne':
        newW = Math.max(MIN_SIZE, r.origW + dx);
        newH = newW / aspect;
        newY = r.origY + r.origH - newH;
        break;
      case 'nw':
        newW = Math.max(MIN_SIZE, r.origW - dx);
        newH = newW / aspect;
        newX = r.origX + r.origW - newW;
        newY = r.origY + r.origH - newH;
        break;
    }
    void dy; // dy is implied by aspect ratio; lint silencer.
    send('move_image', {
      id: r.id,
      x: Math.round(newX),
      y: Math.round(newY),
      w: Math.round(newW),
      h: Math.round(newH),
    });
    return true;
  }, [send]);

  const onPointerUp = useCallback<ImageResizeApi['onPointerUp']>(() => {
    if (!ref.current) return false;
    ref.current = null;
    return true;
  }, []);

  const isActive = useCallback(() => ref.current !== null, []);

  return { start, onPointerMove, onPointerUp, isActive };
}
