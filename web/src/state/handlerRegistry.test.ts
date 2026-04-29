import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handlerRegistry } from './handlerRegistry';

beforeEach(() => handlerRegistry.reset());

describe('handlerRegistry — cursor', () => {
  it('is a no-op before any handler is registered', () => {
    expect(() => handlerRegistry.invokeCursor({ userId: 'u', name: 'n', x: 0, y: 0 })).not.toThrow();
  });

  it('invokes the registered handler with payload', () => {
    const fn = vi.fn();
    handlerRegistry.setCursorHandler(fn);
    handlerRegistry.invokeCursor({ userId: 'u1', name: 'Ana', x: 10, y: 20 });
    expect(fn).toHaveBeenCalledWith({ userId: 'u1', name: 'Ana', x: 10, y: 20 });
  });

  it('returns the previous handler when overwriting', () => {
    const a = vi.fn();
    const b = vi.fn();
    expect(handlerRegistry.setCursorHandler(a)).toBeNull();
    expect(handlerRegistry.setCursorHandler(b)).toBe(a);
  });

  it('null clears the handler', () => {
    const fn = vi.fn();
    handlerRegistry.setCursorHandler(fn);
    handlerRegistry.setCursorHandler(null);
    handlerRegistry.invokeCursor({ userId: 'u', name: 'n', x: 0, y: 0 });
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('handlerRegistry — reaction', () => {
  it('invokes the registered reaction handler', () => {
    const fn = vi.fn();
    handlerRegistry.setReactionHandler(fn);
    handlerRegistry.invokeReaction('🎉');
    expect(fn).toHaveBeenCalledWith('🎉');
  });

  it('reset() clears both handlers', () => {
    const cursor = vi.fn();
    const reaction = vi.fn();
    handlerRegistry.setCursorHandler(cursor);
    handlerRegistry.setReactionHandler(reaction);
    handlerRegistry.reset();
    handlerRegistry.invokeCursor({ userId: 'u', name: 'n', x: 0, y: 0 });
    handlerRegistry.invokeReaction('🎉');
    expect(cursor).not.toHaveBeenCalled();
    expect(reaction).not.toHaveBeenCalled();
  });
});
