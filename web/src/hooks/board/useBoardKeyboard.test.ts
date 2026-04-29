import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBoardKeyboard } from './useBoardKeyboard';

interface Cbs {
  hasSelection: boolean;
  onEscape: ReturnType<typeof vi.fn>;
  onDelete: ReturnType<typeof vi.fn>;
  onCopy: ReturnType<typeof vi.fn>;
  onPasteImageUrl: ReturnType<typeof vi.fn>;
  onPasteInternal: ReturnType<typeof vi.fn>;
  hasClipboard: ReturnType<typeof vi.fn>;
}

let cbs: Cbs;

function setup(overrides: Partial<Cbs> = {}) {
  cbs = {
    hasSelection: false,
    onEscape: vi.fn(),
    onDelete: vi.fn(),
    onCopy: vi.fn(),
    onPasteImageUrl: vi.fn(),
    onPasteInternal: vi.fn(),
    hasClipboard: vi.fn().mockReturnValue(false),
    ...overrides,
  };
  return renderHook((props: Cbs) => useBoardKeyboard(props), { initialProps: cbs });
}

beforeEach(() => {
  document.body.innerHTML = '';
});

function dispatchKey(key: string, init: KeyboardEventInit = {}) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, ...init, bubbles: true }));
  });
}

function dispatchPaste(text: string) {
  // jsdom doesn't ship DataTransfer; build a minimal stub the handler can read.
  const ev = new Event('paste', { bubbles: true }) as ClipboardEvent;
  Object.defineProperty(ev, 'clipboardData', {
    value: { getData: (type: string) => (type === 'text/plain' ? text : '') },
  });
  act(() => { window.dispatchEvent(ev); });
}

describe('useBoardKeyboard — Escape', () => {
  it('always invokes onEscape', () => {
    setup();
    dispatchKey('Escape');
    expect(cbs.onEscape).toHaveBeenCalled();
  });
});

describe('useBoardKeyboard — Delete/Backspace', () => {
  it('invokes onDelete when there is a selection', () => {
    setup({ hasSelection: true });
    dispatchKey('Delete');
    expect(cbs.onDelete).toHaveBeenCalled();
  });

  it('does nothing when there is no selection', () => {
    setup();
    dispatchKey('Delete');
    expect(cbs.onDelete).not.toHaveBeenCalled();
  });

  it('does nothing while focused inside an input', () => {
    setup({ hasSelection: true });
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    });
    expect(cbs.onDelete).not.toHaveBeenCalled();
  });
});

describe('useBoardKeyboard — Copy', () => {
  it('invokes onCopy on Cmd+C with a selection', () => {
    setup({ hasSelection: true });
    dispatchKey('c', { metaKey: true });
    expect(cbs.onCopy).toHaveBeenCalled();
  });

  it('also fires for ctrl+C', () => {
    setup({ hasSelection: true });
    dispatchKey('C', { ctrlKey: true });
    expect(cbs.onCopy).toHaveBeenCalled();
  });

  it('ignores plain "c" without a modifier', () => {
    setup({ hasSelection: true });
    dispatchKey('c');
    expect(cbs.onCopy).not.toHaveBeenCalled();
  });
});

describe('useBoardKeyboard — Paste', () => {
  it('routes image URLs to onPasteImageUrl', () => {
    setup();
    dispatchPaste('https://example.com/cat.png');
    expect(cbs.onPasteImageUrl).toHaveBeenCalledWith('https://example.com/cat.png');
    expect(cbs.onPasteInternal).not.toHaveBeenCalled();
  });

  it('routes internal paste when nothing else matches and clipboard has items', () => {
    cbs = {
      hasSelection: false,
      onEscape: vi.fn(),
      onDelete: vi.fn(),
      onCopy: vi.fn(),
      onPasteImageUrl: vi.fn(),
      onPasteInternal: vi.fn(),
      hasClipboard: vi.fn().mockReturnValue(true),
    };
    renderHook(() => useBoardKeyboard(cbs));
    dispatchPaste('not-an-image-just-text');
    expect(cbs.onPasteInternal).toHaveBeenCalled();
    expect(cbs.onPasteImageUrl).not.toHaveBeenCalled();
  });

  it('does nothing when clipboard is empty and pasted text is not an image url', () => {
    setup();
    dispatchPaste('plain text');
    expect(cbs.onPasteInternal).not.toHaveBeenCalled();
    expect(cbs.onPasteImageUrl).not.toHaveBeenCalled();
  });
});
