import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from './useTheme';
import { storage } from '../lib/storage';

beforeEach(() => {
  // Detach any data-theme set by a previous test.
  document.documentElement.removeAttribute('data-theme');
});

describe('useTheme', () => {
  it('defaults to dark when nothing is stored', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
  });

  it('reads the stored theme on mount', () => {
    storage.write('theme', 'light');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
  });

  it('persists toggled theme to storage', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('light');
    expect(storage.read('theme')).toBe('light');
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('dark');
    expect(storage.read('theme')).toBe('dark');
  });

  it('reflects the active theme on the documentElement', () => {
    const { result } = renderHook(() => useTheme());
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    act(() => result.current.toggleTheme());
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('ignores unrecognised stored values and falls back to dark', () => {
    storage.write('theme', 'sepia');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
  });
});
