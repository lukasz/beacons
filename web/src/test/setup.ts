import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// React Testing Library doesn't auto-cleanup with vitest's globals mode.
afterEach(() => {
  cleanup();
  // Reset DOM-side state that bleeds between tests.
  localStorage.clear();
  sessionStorage.clear();
});
