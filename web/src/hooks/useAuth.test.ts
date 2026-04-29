import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { authMock } = vi.hoisted(() => ({
  authMock: {
    getCurrentUser: vi.fn(),
    onAuthChange: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  },
}));

vi.mock('../services/auth', () => ({ auth: authMock, toAuthUser: vi.fn() }));

import { useAuth } from './useAuth';

beforeEach(() => {
  authMock.getCurrentUser.mockReset().mockResolvedValue(null);
  authMock.onAuthChange.mockReset().mockReturnValue(() => {});
  authMock.signInWithGoogle.mockReset().mockResolvedValue(undefined);
  authMock.signOut.mockReset().mockResolvedValue(undefined);
});

describe('useAuth', () => {
  it('starts in loading state and resolves to null when no session', async () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(authMock.getCurrentUser).toHaveBeenCalled();
    expect(authMock.onAuthChange).toHaveBeenCalled();
  });

  it('exposes the resolved user when a session exists', async () => {
    authMock.getCurrentUser.mockResolvedValueOnce({ id: 'u1', name: 'Ana', avatarUrl: '' });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toEqual({ id: 'u1', name: 'Ana', avatarUrl: '' });
  });

  it('signIn delegates to auth.signInWithGoogle', () => {
    const { result } = renderHook(() => useAuth());
    act(() => result.current.signIn());
    expect(authMock.signInWithGoogle).toHaveBeenCalled();
  });

  it('signOut delegates to auth.signOut and clears the user', async () => {
    authMock.getCurrentUser.mockResolvedValueOnce({ id: 'u1', name: 'Ana', avatarUrl: '' });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.user?.id).toBe('u1'));
    await act(async () => { await result.current.signOut(); });
    expect(authMock.signOut).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
  });

  it('updates user when onAuthChange callback fires', async () => {
    let cb: ((u: { id: string; name: string; avatarUrl: string } | null) => void) | undefined;
    authMock.onAuthChange.mockImplementation((fn: (u: { id: string; name: string; avatarUrl: string } | null) => void) => {
      cb = fn;
      return () => {};
    });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => cb?.({ id: 'u2', name: 'Ben', avatarUrl: '' }));
    expect(result.current.user).toEqual({ id: 'u2', name: 'Ben', avatarUrl: '' });
  });
});
