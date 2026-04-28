# Testing

Vitest + React Testing Library. Co-located tests. Pragmatic coverage.

## Tooling

- **Vitest** — runner. Same config style as Vite, instant cold start.
- **@testing-library/react** + **@testing-library/jest-dom** — DOM-shaped
  component tests.
- **jsdom** — DOM env in node.
- **msw** — mock the network for service tests.

Install (devDependencies):
```bash
npm i -D vitest @testing-library/react @testing-library/jest-dom \
        @testing-library/user-event jsdom msw @vitest/coverage-v8
```

`web/vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    coverage: {
      reporter: ['text', 'html'],
      thresholds: {
        lines: 50, functions: 50, branches: 40, statements: 50,
      },
    },
  },
});
```

`src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

`package.json` scripts:
```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

## File layout

Co-locate, don't ghetto-ise:

```
lib/
  storage.ts
  storage.test.ts        ← right next to it
services/
  boards.ts
  boards.test.ts
hooks/
  usePanZoom.ts
  usePanZoom.test.ts
components/
  PostIt.tsx
  PostIt.test.tsx
test/
  setup.ts               ← global setup
  utils.tsx              ← renderWithProviders, sample fixtures
  mocks/
    supabase.ts          ← shared Supabase stub
```

## What to test, by layer

### `lib/*` — pure functions

Always. They're cheap. Aim for ~80% coverage.

```ts
// lib/ranks.test.ts
import { describe, it, expect } from 'vitest';
import { ordinal } from './ranks';

describe('ordinal', () => {
  it.each([
    [1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'],
    [11, '11th'], [12, '12th'], [13, '13th'],
    [21, '21st'], [22, '22nd'], [101, '101st'],
  ])('ordinal(%i) === %s', (n, expected) => {
    expect(ordinal(n)).toBe(expected);
  });
});
```

### `services/*` — I/O wrappers

Mock the underlying client. Assert the call shape and the returned data
mapping. Cover happy + error path.

```ts
// services/boards.test.ts
import { vi, describe, it, expect } from 'vitest';

const supabaseMock = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data: [{ id: 'a', updated_at: '...' }], error: null }),
};
vi.mock('../supabaseClient', () => ({ supabase: supabaseMock }));

import { boards } from './boards';

describe('boards.list', () => {
  it('queries non-template, non-archived boards ordered by updated_at desc', async () => {
    const result = await boards.list();
    expect(supabaseMock.from).toHaveBeenCalledWith('boards');
    expect(supabaseMock.order).toHaveBeenCalledWith('updated_at', { ascending: false });
    expect(result).toHaveLength(1);
  });
});
```

For Linear / network-shaped services, prefer **msw** over hand-rolled
fetch mocks — closer to reality.

### `hooks/*` — stateful logic

Use `renderHook` from RTL. Test state transitions, returned handler
shape, cleanup.

```ts
// hooks/useLinearKey.test.ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useLinearKey } from './useLinearKey';

describe('useLinearKey', () => {
  it('reads the key from storage on mount', () => {
    localStorage.setItem('beacons-linear-key', 'lin_abc');
    const { result } = renderHook(() => useLinearKey());
    expect(result.current.apiKey).toBe('lin_abc');
  });

  it('clear() removes the key from storage and state', () => {
    localStorage.setItem('beacons-linear-key', 'lin_abc');
    const { result } = renderHook(() => useLinearKey());
    act(() => result.current.clear());
    expect(result.current.apiKey).toBeNull();
    expect(localStorage.getItem('beacons-linear-key')).toBeNull();
  });
});
```

### `components/*` — UI

**Smoke first**, depth where it pays off.

Smoke (cheap, prevents regressions like missing imports):
```tsx
// components/PostIt.test.tsx
import { render, screen } from '@testing-library/react';
import PostIt from './PostIt';

it('renders the post-it text', () => {
  render(<PostIt postIt={fixturePostIt('hello')} {...defaultProps} />);
  expect(screen.getByText('hello')).toBeInTheDocument();
});
```

Behavioural (when there's logic worth covering — votes, drag thresholds,
modals):
```tsx
import userEvent from '@testing-library/user-event';

it('clicking a votable post-it calls onVote', async () => {
  const onVote = vi.fn();
  render(<PostIt {...props} canVote onVote={onVote} />);
  await userEvent.click(screen.getByTestId(`postit-${props.postIt.id}`));
  expect(onVote).toHaveBeenCalledWith(props.postIt.id);
});
```

For components that consume the `BoardContext`, build a
`renderWithBoard(...)` helper in `test/utils.tsx`.

### Integration / e2e

Not in this phase. Once the unit suite is stable we can add Playwright
for a handful of journeys (sign-in → create board → add sticky → vote →
close). Plan goal, not a Phase 0 commitment.

## Coverage targets (pragmatic)

| Layer        | Lines | Why |
|--------------|------:|-----|
| `lib/`       | 80%   | Pure, free, regressions are usually subtle. |
| `services/`  | 70%   | Network shape changes break silently otherwise. |
| `hooks/`     | 60%   | State machines benefit; rendering is covered by component tests. |
| `components/`| 30%   | Smoke for everything; deep tests only where the logic earns it. |

We don't chase 100%. Tests exist to catch regressions and document intent,
not to pad a number.

## Test fixtures

Keep them in `test/fixtures.ts`. Centralised, typed, reusable.

```ts
// test/fixtures.ts
import type { PostIt, Section, Group, BoardState } from '../types';

export const fixturePostIt = (text = 'hello', overrides: Partial<PostIt> = {}): PostIt => ({
  id: 'p1', sectionId: 's1', authorId: 'u1', text,
  x: 0, y: 0, hidden: false, votes: 0, colorIdx: 0,
  ...overrides,
});

export const fixtureBoardState = (overrides: Partial<BoardState> = {}): BoardState => ({
  id: 'b1', sections: {}, postIts: {}, groups: {}, images: {},
  timer: { durationSec: 300, remainingSec: 300, running: false },
  voteHistory: [], users: {}, actions: {},
  sessionName: '', teamName: '', beatGoal: '', beatGoalHit: null,
  ...overrides,
});
```

## What not to test

- **Implementation details.** "It calls `useCallback`" — don't.
- **CSS.** Visual regression goes in a screenshot tool later, not unit tests.
- **The framework.** Don't write tests that assert React re-renders.
- **Trivial getters/setters.** A 1-line passthrough doesn't need a test.

## Running

```
npm test                  # one-shot, used in CI
npm run test:watch        # local, hot-reload
npm run test:coverage     # produces ./coverage/index.html
```

CI fails the PR on:
- Any failing test.
- Coverage falling below the configured thresholds.
- TypeScript errors.

## Maintaining the suite

- A flaky test is a broken test. Fix it or delete it; never `.skip` and
  forget.
- When a bug is fixed, add the failing-then-passing test in the same PR.
- When a feature is added, a smoke test ships with it.
- When a hook is extracted, its tests come from the original Board.tsx
  scope (that's a Phase 3 commit, not a follow-up).
