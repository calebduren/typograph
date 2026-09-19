# Plan 006: Fail-fast `check`, Node version pins, and CI hygiene

| Field           | Value                                                                            |
| --------------- | -------------------------------------------------------------------------------- |
| Status          | proposed                                                                         |
| Written against | commit `cdb2842` plus the uncommitted working tree as of 2026-09-18              |
| Effort          | S (config only)                                                                  |
| Risk of change  | low; behaviour of every individual check is unchanged, only ordering and caching |
| Depends on      | nothing. Touches `CONTRIBUTING.md`, as does Plan 005.                            |
| Blocks          | nothing                                                                          |

## Why this matters

- `npm run check` runs lint and format **last**, after two Vite builds and a real `npm install` into a temp directory (`scripts/check-chat-package.mjs:39-50`). A stray unformatted file costs a full build cycle, locally and on both CI matrix legs.
- CI downloads Chromium and its system deps on every run for both Node versions; nothing caches `~/.cache/ms-playwright`.
- No root `engines` field and no `.nvmrc`, although README/CONTRIBUTING say Node 22.12+ and CI tests 22 and 24. Version managers have nothing to read.
- The landing Playwright `webServer` starts a cold `wrangler dev` with `reuseExistingServer: false` and no explicit `timeout` (default 60 s); the fixture's config sets 60 s explicitly. A slow runner shows up as a confusing test failure.
- `build.manifest: true` writes `dist/.vite/manifest.json`, which Workers Assets uploads and serves. It is needed on disk for a Playwright test but has no business on the live site.
- The single documented verification command needs network access and nobody says so.

## Background the executor needs

- Root `package.json` scripts (working tree):

  ```json
  "test": "vitest run",
  "typecheck": "tsc --noEmit && npm run typecheck -w @typograph/chat-integration",
  "check": "npm run build && npm run build:chat-integration && npm run typecheck && npm test && npm run check:package && npm run format:check && npm run lint"
  ```

- **Ordering constraint you must respect:** `tests/chat-renderer.test.tsx` and `apps/playground/src/chat-preview.ts` import `@typograph/chat`, which resolves through the workspace symlink to `packages/chat-typography/dist`. On a fresh checkout `dist/` does not exist, so `typecheck` and `test` **must run after `build:chat`**. Only lint and format may move ahead of the package build.
- `.github/workflows/check.yml:14-24`:

  ```yaml
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node }}
        cache: npm
    - run: npm ci
    - run: npm run check
    - run: npx playwright install --with-deps chromium
    - run: npm run test:landing
    - run: npm run test:chat-integration
  ```

- `@playwright/test` is pinned to `1.63.0` in both browser workspaces, so a cache key on that version is stable.
- `apps/playground/playwright.config.ts:13-19` (`webServer` block) has `command`, `url`, `reuseExistingServer: false`, `env`, and no `timeout`.
- Vite copies everything in `apps/playground/public/` to `dist/` root. Wrangler honours a `.assetsignore` file at the assets directory root (gitignore syntax) and skips listed paths when uploading.
- Local Wrangler for verification: `npx wrangler dev --config wrangler.jsonc --local --port 4174` serves `apps/playground/dist`.

## Target state

- `check` fails within seconds on lint/format problems; everything else runs in a dependency-respecting order.
- CI restores Playwright browsers from cache.
- Root `engines.node` is `>=22.12` and `.nvmrc` says `22`.
- Landing `webServer.timeout` is 120 000 ms.
- `.vite/` is not uploaded to Workers Assets.
- CONTRIBUTING mentions the network requirement of `check`.

## Scope boundaries

**In scope:** root `package.json` (`check` script, `engines`), new `.nvmrc`, `.github/workflows/check.yml`, `apps/playground/playwright.config.ts`, new `apps/playground/public/.assetsignore`, `CONTRIBUTING.md`.

**Out of scope, do not touch:** the individual check scripts' contents, `scripts/check-chat-package.mjs`, `vite.config.ts` (`manifest: true` stays; the test needs it on disk), source-map emission (`build.sourcemap: true` deploys about 3.2 MB of `.map` files under a one-year immutable cache header; whether to keep public source maps is a maintainer decision, so leave it and mention it in your report), oxlint rule categories, dependency upgrades.

## Steps

### Step 0 — Baseline

```bash
cd /Users/caleb/Dev/typograph
node -e "console.log(require('./package.json').scripts.check)"
ls .nvmrc 2>&1; node -e "console.log(require('./package.json').engines ?? 'no engines')"
```

Expected: the current `check` string above; `.nvmrc` missing; `no engines`.

### Step 1 — Reorder `check`

Set:

```json
"check": "npm run lint && npm run format:check && npm run build:chat && npm run typecheck && npm test && npm run build && npm run build:chat-integration && npm run check:package"
```

(`npm run build` re-runs `build:chat`; it is a two-second tsup build, acceptable for clarity.)

Verify on a clean state: `rm -rf packages/chat-typography/dist && npm run check` → exit 0. This proves the ordering constraint is respected.

### Step 2 — Node pins

- Root `package.json`: add `"engines": { "node": ">=22.12" }` after `"private": true`.
- Create `.nvmrc` containing `22` and a trailing newline.
- Verify: `npm ls >/dev/null && echo ok` (engines does not block installs without `engine-strict`, so this only confirms the manifest still parses); `cat .nvmrc` → `22`.

### Step 3 — CI browser cache

In `.github/workflows/check.yml`, insert before the `npx playwright install` step:

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ runner.os }}-1.63.0
```

Keep `npx playwright install --with-deps chromium` as is; with a warm cache it only installs OS deps. Verify the YAML parses: `node -e "require('yaml')"` is not available, so use `npx --yes js-yaml .github/workflows/check.yml >/dev/null && echo yaml-ok` (read-only, downloads a small package into the npx cache).

### Step 4 — Playwright server timeout

In `apps/playground/playwright.config.ts` add `timeout: 120_000,` inside the `webServer` object, after `reuseExistingServer: false,`.

### Step 5 — Keep build metadata off the live site

1. Create `apps/playground/public/.assetsignore` containing:

   ```
   .vite/
   ```

2. Verify it is copied and honoured:

   ```bash
   npm run build
   ls -a apps/playground/dist/.assetsignore apps/playground/dist/.vite/manifest.json
   (npx wrangler dev --config wrangler.jsonc --local --port 4174 > /tmp/typograph-wrangler.log 2>&1 &) ; sleep 8
   curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4174/.vite/manifest.json
   curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4174/
   pkill -f "wrangler dev --config wrangler.jsonc"
   ```

   Expected: both files listed; first curl `404`; second `200`. If the first curl returns `200`, Wrangler ignored the file — check `/tmp/typograph-wrangler.log` for a warning and consult `npx wrangler --version`; `.assetsignore` requires Wrangler 3.83+ (root has `^4.0.0`). If it still serves, STOP and report rather than moving `manifest.json` (the Playwright test reads it from disk).

3. `npm run test:landing` → 19 passed (the test reads the manifest from the filesystem, so it is unaffected).

### Step 6 — CONTRIBUTING

In the "Check changes" section, after the sentence that begins "The first command builds the package and both apps…", add: "The packed-package step installs real dependencies into a temporary directory and therefore needs network access. Lint and format run first so cheap problems fail fast."

### Step 7 — Gate

```bash
npm run check
```

Expected: exit 0.

## Done criteria

- `node -e "console.log(require('./package.json').scripts.check.startsWith('npm run lint && npm run format:check && npm run build:chat && npm run typecheck'))"` → `true`.
- `cat .nvmrc` → `22`; `node -e "console.log(require('./package.json').engines.node)"` → `>=22.12`.
- `grep -c "ms-playwright" .github/workflows/check.yml` → `1`.
- `grep -c "timeout: 120_000" apps/playground/playwright.config.ts` → `1`.
- `cat apps/playground/public/.assetsignore` → `.vite/`.
- Step 5 curl returns `404` for `/.vite/manifest.json` and `200` for `/`.

## Escape hatches

- If `rm -rf packages/chat-typography/dist && npm run check` fails at `typecheck` or `test`, the ordering constraint was violated — fix the order; do not add `skipLibCheck` tricks or `|| true`.
- If the `.assetsignore` is not honoured locally, leave the file in place (harmless) and report; do not touch `vite.config.ts`.
- Do not change the CI matrix, permissions, or artifact upload steps.

## Maintenance notes

- Bumping `@playwright/test` requires updating the cache key in Step 3 (or derive it from `package-lock.json` with `hashFiles` if you prefer automatic invalidation).
- When the Node floor moves, update `engines`, `.nvmrc`, README, CONTRIBUTING, and the CI matrix together.
