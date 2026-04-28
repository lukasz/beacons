# Beacons — instructions for Claude

Read these three docs before making non-trivial edits:

1. **[`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md)** — repo layout, where
   things live, do/don't list. The rules in here are not suggestions.
2. **[`docs/REFACTOR-PLAN.md`](docs/REFACTOR-PLAN.md)** — the refactor we're
   working through. If a task fits a phase, do it as that phase.
3. **[`docs/TESTING.md`](docs/TESTING.md)** — how we test, what to test,
   coverage targets.

## Quick rules

- Pure helpers → `web/src/lib/`. No React, no I/O.
- Network → `web/src/services/`. No `supabase.*` or `fetch('/api/*')` outside this folder.
- `localStorage` → `web/src/lib/storage.ts`. Nowhere else.
- Cross-component UI state → `web/src/state/` (React context). Not `window.dispatchEvent`.
- Tests live next to the file they test (`foo.ts` + `foo.test.ts`).
- Files over the soft size cap (300 lines for components) are a smell, not a feature.

## Deploy

Commits to `main` are deployed manually via Docker on the EC2 host
(13.61.55.121, `~/beacons`). Standard flow:

```
git pull && \
docker build --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_ANON_KEY=... \
             --build-arg VITE_GIPHY_API_KEY=... -t beacons . && \
docker stop $(docker ps -q) && docker rm $(docker ps -aq) && \
docker run -d -p 80:8080 --restart unless-stopped \
  -e SUPABASE_PROJECT_REF=... -e SUPABASE_ANON_KEY=... \
  -e LINEAR_OAUTH_CLIENT_ID=... -e LINEAR_OAUTH_CLIENT_SECRET=... \
  beacons
```

Avoid `--no-cache`; the disk fills up after a handful of clean rebuilds.

## When in doubt

Surface the uncertainty rather than guessing. The conventions in
`docs/CONTRIBUTING.md` exist precisely so the answer is usually obvious — if
it isn't, the user wants to be asked.
