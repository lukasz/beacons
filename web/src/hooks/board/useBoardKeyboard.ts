/**
 * Top-level keyboard + paste subscriptions for the board:
 *
 *   - Escape: cancels (in priority order) creation mode, grab mode, then
 *     clears the active selection.
 *   - Delete / Backspace: deletes every selected item.
 *   - Cmd/Ctrl+C: copies the selection into the board clipboard.
 *   - Native `paste` event:
 *       • image URLs → add_image with constrained dimensions,
 *       • otherwise → internal paste from the board clipboard.
 *
 * The hook never reads or mutates state directly — callers wire the
 * effects of each keystroke via callbacks. That keeps the hook focused
 * on "which key did the user press, was anything selected, was the
 * focus inside an input?" and out of the application logic.
 */
import { useEffect } from 'react';

interface UseBoardKeyboardOptions {
  hasSelection: boolean;
  onEscape: () => void;
  onDelete: () => void;
  onCopy: () => void;
  /** Paste an image URL (already validated). */
  onPasteImageUrl: (url: string) => void;
  /** Internal board-clipboard paste — whatever was copied via Cmd/Ctrl+C. */
  onPasteInternal: () => void;
  /** True when there's something in the internal clipboard. */
  hasClipboard: () => boolean;
}

const IMAGE_URL_PATTERNS = [
  /^https?:\/\/.+\.(png|jpe?g|gif|webp|svg|bmp|ico)(\?.*)?$/i,
];

function looksLikeImageUrl(text: string): boolean {
  if (IMAGE_URL_PATTERNS[0].test(text)) return true;
  return /^https?:\/\/.+/i.test(text) && /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(text);
}

function isTypingTarget(t: EventTarget | null): boolean {
  return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;
}

export function useBoardKeyboard({
  hasSelection,
  onEscape,
  onDelete,
  onCopy,
  onPasteImageUrl,
  onPasteInternal,
  hasClipboard,
}: UseBoardKeyboardOptions): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscape();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && hasSelection && !isTypingTarget(e.target)) {
        e.preventDefault();
        onDelete();
        return;
      }
      if ((e.key === 'c' || e.key === 'C') && (e.metaKey || e.ctrlKey) && hasSelection && !isTypingTarget(e.target)) {
        e.preventDefault();
        onCopy();
      }
      // Paste is handled by the native 'paste' event below — don't
      // preventDefault here, so the system event still fires with
      // clipboardData populated.
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasSelection, onEscape, onDelete, onCopy]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const text = e.clipboardData?.getData('text/plain')?.trim() || '';
      if (looksLikeImageUrl(text)) {
        e.preventDefault();
        onPasteImageUrl(text);
      } else if (hasClipboard()) {
        e.preventDefault();
        onPasteInternal();
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onPasteImageUrl, onPasteInternal, hasClipboard]);
}
