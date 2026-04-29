# Frontend refactor plan

Eight phases, each a self-contained PR. Order matters — earlier phases land
the scaffolding the later ones depend on. After every phase, the app should
build, type-check, and pass the test suite. No phase rewrites everything; we
take chips off the block.

The end-state targets:

- `Board.tsx` and `Dashboard.tsx` both under **400 lines**.
- Every other file under **300 lines** unless it's a single cohesive feature.
- Zero `localStorage.*` outside `src/lib/storage.ts`.
- Zero `supabase.*` and zero `fetch('/api/*')` outside `src/services/`.
- Zero `window.dispatchEvent(new CustomEvent(...))` for cross-component IPC.
- Test coverage thresholds: **lib 80% / services 70% / hooks 60% / components 30% (smoke)**.

---

## Phase 0 — Test scaffolding

Lands first so every later phase has a safety net.

**Add:**
- `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `msw` (devDependencies).
- `web/vite.config.ts` — wire `test` block, jsdom env, setup file.
- `web/src/test/setup.ts` — RTL + jest-dom matchers.
- `web/src/test/mocks/supabase.ts` — minimal stub returning `{ data, error }` shapes.
- `npm test`, `npm run test:watch`, `npm run test:coverage` scripts.

**Initial tests** (one smoke test per top-level surface, just to prove the harness works):
- `App.test.tsx` — renders SignIn when unauthenticated.
- `Landing.test.tsx` — shows "Create New Board" / "Join existing".
- `TadaLanding.test.tsx` — renders the hero + tour without crashing.

**Acceptance:**
- `npm test` runs and reports green.
- Coverage report is produced.
- CI fails the PR if any test fails.

---

## Phase 1 — `lib/` extraction

Pure helpers. Mechanical, low risk. Removes duplication so later phases shrink.

**Create:**
```
src/lib/
  storage.ts       # typed key constants + read/write/clear helpers
  hash.ts          # hashCode (currently in Board.tsx, Toolbar.tsx, Dashboard.tsx as hashStr)
  ranks.ts         # RANK_MEDALS + ordinal() (currently 3× duplicated)
  time.ts          # timeAgo (currently in Dashboard.tsx)
  buildMarkdown.ts # lifted from Board.tsx top, made pure
```

`storage.ts` shape:
```ts
export const STORAGE_KEYS = {
  theme: 'beacons-theme',
  cursors: 'beacons-cursors',
  linearApiKey: 'beacons-linear-key',
  teamTabSelected: 'beacons-team-tab-selected',
  guestUser: 'beacons-guest',
} as const;
export const storage = {
  read<T>(key: keyof typeof STORAGE_KEYS): T | null,
  write<T>(key: keyof typeof STORAGE_KEYS, val: T): void,
  clear(key: keyof typeof STORAGE_KEYS): void,
}
```

**Migrate callsites** so every component imports from `lib/storage` instead
of touching `localStorage` directly.

**Tests:**
- `lib/storage.test.ts` — round-trip, missing key, JSON parse failure.
- `lib/hash.test.ts` — known-input determinism.
- `lib/ranks.test.ts` — `ordinal(1) === '1st'`, `ordinal(11) === '11th'`, etc.
- `lib/time.test.ts` — fixed `Date.now()` and assert formatting bands.
- `lib/buildMarkdown.test.ts` — snapshot a small representative board state.

**Acceptance:**
- `grep -r 'localStorage' src/` returns hits only inside `lib/storage.ts`.
- All pre-existing duplicate `RANK_MEDALS`, `hashCode`, `hashStr` declarations deleted.
- Tests above all pass.

---

## Phase 2 — `services/` data layer

Pull every Supabase call and every `/api/*` fetch out of components.

**Create:**
```
src/services/
  boards.ts      # list, get, create, update, archive, restore, delete, attachToTeam
  actions.ts    # forBoard, previousForTeam, updateLinearLink
  teams.ts      # list, create, update, delete, members.ensureMembership
  linear.ts     # wraps linearClient with auth-aware retry + 401 → clearKey
  http.ts       # tiny fetch wrapper that adds X-Forwarded-Proto guard, json parse, error normalisation
```

Each service exports plain async functions returning typed results. They never
read React state, never touch the DOM, never throw raw fetch errors — they
return tagged results or throw `ServiceError` instances callers can switch on.

**Migrate** every `supabase.from(...)` and every `fetch('/api/...')` from
components into the matching service. Components use `boards.list()`,
`teams.create({ name })`, etc.

**Tests:**
- `services/boards.test.ts` — mock Supabase client; assert correct query
  shape (filters, columns) and result mapping.
- `services/actions.test.ts` — `previousForTeam` returns only unfinished
  actions, sorted, capped at 10.
- `services/teams.test.ts` — auto-membership ensure path.
- `services/linear.test.ts` — 401 path clears the key and rethrows
  `LinearAuthError`.

**Acceptance:**
- `grep -r 'supabase\.' src/components/` returns 0 results.
- `grep -r "fetch('/api" src/components/` returns 0 results.
- Service tests cover the happy and error path of each public function.

---

## Phase 3 — Custom hooks (first wave)

Slice `Board.tsx` into focused hooks. Each hook owns its refs, effects, and
returns a stable handler shape.

**Created in Phase 3:**
```
src/hooks/board/
  useVoteUI.ts          # myVoteCount, hasRemainingVotes, rankMap, getEffectiveVoteCount, getEffectiveRank
                        # (also imported by VotePanel — kills the duplicated derivation)
  useClipboard.ts       # copyItems, pasteItems, hasItems
  useRemoteCursors.ts   # cursors state, send throttle, RAF batching, stale sweep
  usePanZoom.ts         # transform ref, zoomTo, screenToCanvas, wheel + space-key
  useBoardKeyboard.ts   # escape/delete/copy + native paste (image URL or internal)
```

Each hook has its own test file (`*.test.ts`) with stubbed refs + simulated
events.

**Acceptance (Phase 3):**
- `VotePanel.tsx` and `Board.tsx` both consume `useVoteUI` — no duplicated
  `myVoteCount`/`rankMap`.
- Each new hook's public surface is unit-tested against state transitions
  and edge cases (zoom clamp, drag threshold, paste-with-empty-clipboard…).
- Total test count strictly increased.

`Board.tsx` is **still ~1450 lines** after Phase 3. Hitting the < 400-line
target requires splitting the pointer-handler tree and the render tree —
both are large enough to warrant their own PR.

## Phase 3.5 — Pointer hooks + render canvas split

Three new pointer hooks plus a presentation component to split the
render tree from Board.tsx.

**Created in Phase 3.5:**
- `useImageResize` — imgResize ref + per-corner geometry, broadcasts
  `move_image` while dragging.
- `useSelectionDrag` — selDrag ref + drag-broadcast-with-threshold;
  exports a `snapshotSelection` helper for the dispatch site.
- `useMarqueeSelection` — marqueeRef + live `marquee` shape +
  `commit()` that hit-tests the canvas into a `SelectedItem[]`.
- `useRadialMenuItems` — the 190-line context-menu builder.
- `lib/organizeBoard.ts` — pure geometry for the OCD button.
- `<BoardCanvas>` — pure-render sub-component for the transformed
  canvas (groups, sections, post-its, images, cursors, ghost,
  selection outlines).

**Result:** `Board.tsx` 1465 → 756 lines (-48%). All extracted hooks
unit-tested.

## Phase 3.6 — final Board.tsx slim-down

To hit the original < 400-line target, the remaining work is:
- Extract `handleBoardPointerDown` (~100 lines of dispatch logic) into
  a `useBoardPointerDispatch` hook.
- Pull the JSX footer (FloatingMenu / Timer / GiphyPicker / RadialMenu
  / creation-mode banners / bottom-controls) into a `<BoardChrome>`
  sub-component.
- Move the remaining `vote-view-change` / `vote-ranks-visibility` /
  `cursors-toggle` event-bus state into BoardUiContext as part of
  Phase 4 (which kills the global event bus anyway).

---

## Phase 4 — Replace the global event bus

Delete every `window.dispatchEvent(new CustomEvent(...))` used as IPC
between sibling components, and the runtime-installed
`window.__triggerReactionRain` / `__handleCursorMove` globals.

**Create:**
```
src/state/
  BoardUiContext.tsx
```

Holds the UI-only state currently bus-coupled:
- `votePanelOpen`, `viewingHistoryId`, `ranksVisible`, `cursorsEnabled`,
  `timerOpen` (already board-state, stays put), reaction trigger.

`useBoardUi()` returns these plus their setters. `useReactionTrigger()` returns
a function callers invoke directly; `ReactionRain` registers via the same
context, no globals.

**Migrate** `Board.tsx`, `VotePanel.tsx`, `Toolbar.tsx`, `FloatingMenu.tsx`,
`ReactionRain.tsx`, `ActionsPanel.tsx` to consume the context.

**Tests:**
- `BoardUiContext.test.tsx` — provider wires setters; multiple consumers see
  updates; reaction trigger invokes registered callback.

**Acceptance:**
- `grep -r 'window.dispatchEvent' src/` returns 0 results.
- `grep -r 'window.__' src/` returns 0 results.
- All five existing custom events (`vote-panel-visibility`, `vote-view-change`,
  `vote-ranks-visibility`, `toggle-vote-panel`, `cursors-toggle`) are gone.

---

## Phase 5a — Lift standalone helpers + modals

**Created in Phase 5a:**
```
src/pages/dashboard/
  teams/
    TeamManager.tsx          # lifted from Dashboard.tsx
    TeamTabCreateModal.tsx   # lifted
    TeamTabSelector.tsx      # lifted
    TeamMultiSelect.tsx      # lifted
  modals/
    NewBoardModal.tsx        # extracted from inline render tree
    TemplatePickerModal.tsx  # extracted from inline render tree
```

**Result:** Dashboard.tsx 2451 → ~2000 lines (-18%). Six new files,
each with focused responsibility. Tests added for the four most
testable ones (NewBoardModal, TemplatePickerModal, TeamMultiSelect,
TeamTabSelector).

## Phase 5b — Tab content split

The three tab branches (boards / actions / teams) make up ~1300 lines
of the remaining Dashboard.tsx render tree. Each one threads 30+
state values and handlers through, so a clean split needs careful
prop design.

**Plan:**
- `pages/dashboard/BoardsTab.tsx` (~165 lines lifted)
- `pages/dashboard/ActionsTab.tsx` (~280 lines lifted)
- `pages/dashboard/TeamsTab.tsx` (~780 lines lifted) — also pulls in
  `useTeamPageFilters` reducer to collapse the 8-setter cluster on
  the team-tab `onSelect`.
- `pages/dashboard/Dashboard.tsx` (~250 lines: layout, tab routing,
  modal dispatch).

**Acceptance:**
- `Dashboard.tsx` < 400 lines.
- Each tab is self-contained — its props are an enumerated set of
  data + callbacks, not the whole world.
- BoardsTab and TeamsTab have smoke + behavioural tests.
- `useTeamPageFilters` reducer has unit tests covering each
  transition.

---

## Phase 6 — Split `FeatureTour.tsx`

10 demos in one file.

**Create:**
```
src/pages/tada/
  TadaLanding.tsx          # already exists, keep
  FeatureTour.tsx          # ~80 lines: layout + features list + dispatch
  features.ts              # the FEATURES array
  demos/
    DemoBoard.tsx
    DemoVote.tsx
    DemoTimer.tsx
    DemoHide.tsx
    DemoLinear.tsx
    DemoOCD.tsx
    DemoActions.tsx
    DemoMarkdown.tsx
    DemoReactionRain.tsx
    DemoNewBoard.tsx
  demoShell.tsx            # shared chrome + sticky styling
```

All demos import `RANK_MEDALS` / `ordinal` from `lib/ranks` (added in Phase 1).

**Tests:**
- One smoke test per demo: `render(<DemoTimer />)` + assert the start button
  exists.

**Acceptance:**
- `FeatureTour.tsx` < 200 lines.
- No demo file > 200 lines.

---

## Phase 7 — Trim Toolbar, ActionsPanel, LinearSync

**Toolbar.tsx** → split into:
- `Toolbar.tsx` (top-level layout)
- `toolbar/SessionMeta.tsx` (name + team + access edit)
- `toolbar/BoardSettings.tsx` (the cog menu)
- `toolbar/UsersIndicator.tsx`

**ActionsPanel.tsx** → split into:
- `ActionsPanel.tsx` (the panel itself)
- `actions/PreviousActions.tsx`
- `actions/CreateLinearIssue.tsx` (lifts the inline modal)
- `services/actions.ts` already owns `previousForTeam`.

**LinearSync.tsx** — keep as one feature but extract:
- `linear/ConnectStep.tsx`
- `linear/ChooseStep.tsx`
- `linear/CycleList.tsx`, `linear/ProjectList.tsx`

**Acceptance:**
- Toolbar.tsx < 200 lines, ActionsPanel.tsx < 250 lines, LinearSync.tsx < 350 lines.

---

## Phase 8 — CSS split

`web/src/styles/index.css` is ~7000 lines. Vite handles `@import` cleanly.

**Create:**
```
src/styles/
  index.css            # only @import lines + variables block
  base.css             # body, html, scrollbars, theme variables
  buttons.css
  landing.css
  signin.css
  tada.css
  dashboard.css
  board.css
  postit.css
  section.css
  vote.css
  timer.css
  actions.css
  cyclestats.css
  giphy.css
  rice.css
  feature-tour/
    index.css
    demos.css
    rain.css
```

No CSS rules change; only physical layout.

**Acceptance:**
- `index.css` is < 200 lines (mostly imports + tokens).
- Visual diff against pre-split deploy: zero pixel changes (eyeballed).

---

## Sequencing rules

- One phase per PR.
- Each PR ships green tests, type-check, build.
- Each PR includes a one-line entry in `docs/CHANGELOG.md` (create on first PR).
- Don't combine phases. The point is bisectability if something regresses.
- If a phase is large, split it into sub-PRs (e.g. Phase 5 could be one PR per tab) but keep the dependency order.

## Per-phase test-coverage rule

Every phase must ship tests for **what it changed**, not just for the new
modules it added. The phase isn't done until the answer to "what would
break if this regressed?" is "the test that lives next to it."

For each phase, the PR description must list:

1. **New code** — every new module/file gets unit tests at the
   coverage target for its layer (lib 80%, services 70%, hooks 60%,
   components 30% smoke).
2. **Migrated callsites** — every callsite touched by the phase needs at
   least one assertion proving the behaviour is preserved. Either:
   - a direct behavioural test (a component test that exercises the
     callsite — preferred where reasonable), or
   - a test on the abstraction the callsite was migrated to, **plus** a
     smoke test that proves the migrated file still renders and wires
     through to the abstraction.
3. **Bug fixes discovered along the way** — pinned by a regression test
   in the same PR.

Acceptance gate per phase:

- `npm test` green.
- `npm run build` clean.
- Total test count strictly increased over the previous phase.
- Coverage report does not drop on any layer (compare against the prior
  phase's report).
- The PR description lists every callsite migrated and the test that
  defends it (one line per file, "X migrated, defended by Y").

If the right test is *prohibitively expensive* in this phase (e.g.
covering App's guest-flow before App splits), that's allowed but you
must:

- File a follow-up under `docs/CHANGELOG.md` referencing the missing
  coverage and the phase that will land it.
- The relevant abstraction (e.g. `storage.writeJson`) must still be
  unit-tested.

---

## What we're not doing (and why)

- **Not introducing Redux/Zustand.** The board's reducer over the WS stream is
  fine; UI-only state goes into `BoardUiContext`. Adding a third store layer
  for ~10k lines is overkill.
- **Not switching CSS to CSS-in-JS / Tailwind.** Beacons has a working theme
  system; rewriting it to match a different paradigm is a year of paper-cuts
  for no user-visible benefit.
- **Not adding e2e (Playwright) yet.** Vitest + RTL covers the units; e2e is
  Phase 9+ once the unit suite stabilises.
- **Not refactoring the server.** That's a separate audit.
