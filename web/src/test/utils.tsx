/**
 * Shared render helpers. Use these from component tests so we keep the
 * provider stack consistent.
 */
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';

export function renderWithProviders(
  ui: ReactElement,
  options?: RenderOptions,
): RenderResult {
  // Future: wrap in BoardContext / BoardUiContext / Theme providers as
  // those land. For now this is a thin pass-through so tests can switch
  // to it without churn later.
  return render(ui, options);
}

export * from '@testing-library/react';
