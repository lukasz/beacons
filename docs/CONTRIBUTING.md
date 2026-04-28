# Beacons — how we write code here

Short rules. They exist so we keep moving fast without making the codebase
worse on the way.

## Repo layout

```
web/src/
  App.tsx                 # routing + auth gate
  main.tsx                # bootstrap
  lib/                    # pure helpers — no React, no I/O, no DOM
  services/               # I/O — Supabase, Linear, /api fetches
  hooks/                  # reusable React hooks (some shared, some board-only)
  state/                  # React contexts that aren't board-state
  pages/                  # top-level surfaces (dashboard, tada, board, rice)
  components/             # reusable UI (cards, panels, dialogs)
  styles/                 # CSS, split by domain
  types.ts                # shared types
```

If a file doesn't fit one of these, ask which one it should fit before adding
a new bucket.

## File size

Soft limits; treat as smell when exceeded:
- **Component file**: 300 lines.
- **Hook file**: 150 lines.
- **Service file**: 250 lines.
- **Lib file**: 100 lines.

If a file is over the limit, you have a separation-of-concerns problem, not a
formatting problem. Split it.

## Where things live

These are not suggestions:

| If it...                                            | Goes in            |
|-----------------------------------------------------|--------------------|
| reads/writes `localStorage` / `sessionStorage`      | `lib/storage.ts`   |
| calls `supabase.*` or `fetch('/api/*')`             | `services/*`       |
| is a pure function (no React, no I/O)               | `lib/*`            |
| is a reusable piece of stateful logic               | `hooks/*`          |
| is UI-only state shared between sibling components  | `state/*` context  |
| is the canvas/board state synced over WS            | the existing reducer |
| is a top-level page/route                           | `pages/*`          |
| renders a piece of UI                               | `components/*`     |

## Don't

- **Don't** import `localStorage` outside `lib/storage.ts`. Use the typed
  helpers.
- **Don't** import `supabase` outside `services/*`. Components consume
  service functions.
- **Don't** use `window.dispatchEvent(new CustomEvent(...))` for IPC between
  React components. Put the state in context.
- **Don't** stash globals on `window` (e.g. `window.__triggerX`). Use a
  context-registered callback or a hook returning a function.
- **Don't** duplicate types or constants between `lib/` and a component;
  import from `lib/`.
- **Don't** re-implement `hashCode`, `ordinal`, `RANK_MEDALS`, `timeAgo`,
  `buildMarkdown`. They live in `lib/`.
- **Don't** mix concerns inside a single useEffect. One effect, one job.
- **Don't** silently swallow errors. Either handle, log, or rethrow with
  context.
- **Don't** add inline `style={{ ... }}` blocks bigger than ~3 properties.
  Use a class.

## Do

- **Do** colocate tests with the file they test (`foo.ts` + `foo.test.ts`).
- **Do** prefer `useCallback`/`useMemo` only when the dependency stability
  matters; over-memoising adds noise.
- **Do** name hooks `useX` where X is a noun for state or a verb for an
  action (`usePanZoom`, `useReactionTrigger`).
- **Do** name service functions in `verbResource` form (`boards.list`,
  `actions.previousForTeam`, `teams.create`).
- **Do** keep service functions returning typed results, not raw responses.
- **Do** keep components stateless where possible; push state up to the
  smallest common ancestor.
- **Do** use `var(--bg)`, `var(--text)`, etc. — never hard-code colours
  outside `styles/base.css`'s tokens block.
- **Do** add a one-line `docs/CHANGELOG.md` entry on every PR.

## React rules of thumb

- **One concern per file.** A component that fetches data, manages drag,
  and renders a panel is three components.
- **Lift state up to the smallest scope that needs it.** Not the page, not
  global context — just the component that owns the feature.
- **Effects run on a schedule.** If you find yourself reading a ref inside
  an effect to "stop it from running", you wanted a `useMemo` or a state
  variable.
- **Refs are for imperative escape hatches.** If you're using a ref to
  synchronise two pieces of state, you wanted one piece of state.

## Tests

- **Pure functions get unit tests.** Always. They're free.
- **Services get unit tests with the Supabase/fetch client mocked.**
  Cover happy path, error path, edge case.
- **Hooks get tests with `renderHook`** (RTL) — at minimum, state
  transitions and the public handler shape.
- **Components get a smoke test.** "Renders without throwing, primary
  CTA exists." Add deeper tests when behaviour gets non-trivial.
- **No `any`.** If TypeScript can't infer it, you can spell it.
- **No `as unknown as Foo` casts** to bypass type errors. Fix the types.

### When you change something, prove it still works

Before committing, the answer to "what would break if this regressed?"
must be "the test that lives next to it." If you migrated a callsite,
either add a behavioural test that exercises it, or rely on a tested
abstraction **and** a smoke test that proves the migrated file still
renders. A bug fix is committed with its regression test.

The whole `npm test` suite must pass and the total count must strictly
increase whenever you remove a duplication or change behaviour. If you
can't, file a follow-up entry in `docs/CHANGELOG.md` saying so.

See `docs/TESTING.md` for tooling and concrete patterns.

## Commits & PRs

- One concern per PR. If the diff has two reasons in it, split it.
- Commit message: short imperative line, then a paragraph of *why*. The
  *what* is in the diff.
- Don't commit secrets, build artefacts, or `.env` files.
- Run `npm run build && npm test` before opening the PR.
- If the PR touches refactor-plan phases, mention which phase.

## When you're tempted to break a rule

The rules above are guard-rails, not laws. Break them when there's a
clear reason. Document the reason in a comment **at the break point**, not
in the PR description. Future-you and future-readers don't read PR
descriptions, but they do read the code.

## Notes for AI assistants editing this repo

- Read this file before non-trivial edits.
- When adding a new file, place it according to "Where things live" above.
  If the right bucket isn't obvious, surface that uncertainty rather than
  guessing.
- When asked to "fix" something, look for whether the fix recreates a
  pattern this file rules out (e.g. another component reaching for
  `localStorage`). If so, route through `lib/`/`services/` instead.
- When a refactor is requested, follow `docs/REFACTOR-PLAN.md` phase order.
- Keep edits in the smallest scope that solves the problem.
