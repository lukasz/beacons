/**
 * Inbound-message handler registry.
 *
 * App.tsx receives WS messages outside the BoardUiProvider tree, so it
 * can't read context to dispatch them. Instead, components register
 * their handler here on mount, and App.tsx invokes the registered
 * handler when the relevant message arrives.
 *
 * This module replaces the old `window.__handleCursorMove` and
 * `window.__triggerReactionRain` globals — same shape, no global
 * pollution, and statically typed.
 *
 * Each setter returns the previous handler (mostly useful for tests).
 */

export interface CursorMoveData {
  userId: string;
  name: string;
  x: number;
  y: number;
}

type CursorHandler = (data: CursorMoveData) => void;
type ReactionHandler = (emoji: string) => void;

let cursorHandler: CursorHandler | null = null;
let reactionHandler: ReactionHandler | null = null;

export const handlerRegistry = {
  /** Register the cursor-move handler. Returns the previous one (or null). */
  setCursorHandler(fn: CursorHandler | null): CursorHandler | null {
    const prev = cursorHandler;
    cursorHandler = fn;
    return prev;
  },
  /** Invoke the registered cursor-move handler. No-op when none is registered. */
  invokeCursor(data: CursorMoveData): void {
    cursorHandler?.(data);
  },

  /** Register the reaction trigger. Returns the previous one (or null). */
  setReactionHandler(fn: ReactionHandler | null): ReactionHandler | null {
    const prev = reactionHandler;
    reactionHandler = fn;
    return prev;
  },
  /** Trigger an emoji rain. No-op when no handler is registered. */
  invokeReaction(emoji: string): void {
    reactionHandler?.(emoji);
  },

  /** Reset both handlers — useful between tests. */
  reset(): void {
    cursorHandler = null;
    reactionHandler = null;
  },
};
