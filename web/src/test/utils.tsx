/**
 * Shared render helpers. Use these from component tests so we keep the
 * provider stack consistent.
 */
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { BoardContext, type BoardContextValue } from '../hooks/useBoard';
import type { BoardState } from '../types';
import { fixtureBoardState } from './fixtures';

export function renderWithProviders(
  ui: ReactElement,
  options?: RenderOptions,
): RenderResult {
  // Future: wrap in BoardUiContext / Theme providers as those land. For
  // now this is a thin pass-through so tests can switch to it without
  // churn later.
  return render(ui, options);
}

interface RenderWithBoardOptions extends RenderOptions {
  state?: Partial<BoardState>;
  context?: Partial<BoardContextValue>;
}

/**
 * Render a component that consumes BoardContext. Pass `state` to override
 * fields on the default fixture board, and `context` to override anything
 * else on the context value (userId, send, dispatch, templateMode…).
 *
 * Returns the RenderResult plus the `send` and `dispatch` mocks for
 * assertions like `expect(send).toHaveBeenCalledWith('vote_cast', ...)`.
 */
export function renderWithBoard(
  ui: ReactElement,
  options: RenderWithBoardOptions = {},
) {
  const { state, context, ...renderOptions } = options;
  const send = context?.send ?? vi.fn();
  const dispatch = context?.dispatch ?? vi.fn();
  const value: BoardContextValue = {
    state: { ...fixtureBoardState(), ...state },
    send,
    dispatch,
    userId: context?.userId ?? 'u1',
    onLeave: context?.onLeave,
    templateMode: context?.templateMode,
    isGuest: context?.isGuest,
  };
  const result = render(
    <BoardContext.Provider value={value}>{ui}</BoardContext.Provider>,
    renderOptions,
  );
  return { ...result, send, dispatch, contextValue: value };
}

export * from '@testing-library/react';
