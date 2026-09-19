# Plan 005: Let the playground dev server resolve `@typograph/chat` from source

| Field           | Value                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| Status          | proposed                                                                                                            |
| Written against | commit `cdb2842` plus the uncommitted working tree as of 2026-09-18                                                 |
| Effort          | M (about 25 lines of config, two doc edits, manual verification)                                                    |
| Risk of change  | medium — must not leak into the production build, which is what the bundle-size claims and Playwright suite measure |
| Depends on      | nothing                                                                                                             |
| Blocks          | nothing. Touches `CONTRIBUTING.md`, as does Plan 006; land them in either order and resolve the trivial conflict.   |

## Why this matters

The landing page consumes `@typograph/chat` through the workspace symlink, whose `exports` point at the built, minified `dist/`. Every engine edit therefore needs a manual `npm run build:chat` and a full reload; HMR otherwise silently serves stale plugin code, and exceptions inside the plugin surface in minified code with no source map. `npm run dev -w @typograph/playground` fails outright on a fresh clone. The landing page is the surface on which the engine is exercised most often, so this is real friction. Aliasing the package to its TypeScript source **only when Vite runs as a dev server** removes the rebuild step while leaving `vite build`, the Playwright suite, the benchmark, and the packed-package check exactly as they are.

## Background the executor needs

- `apps/playground/vite.config.ts` (current, whole file):

  ```ts
  import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react';

  export default defineConfig({
    plugins: [react()],
    base: '/',
    resolve: { dedupe: ['react', 'react-dom'] },
    optimizeDeps: { include: ['streamdown'] },
    build: { sourcemap: true, manifest: true },
    server: { port: 4173 },
  });
  ```

- Package exports in `packages/chat-typography/package.json`:

  ```json
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./hanging": { "types": "./dist/hanging.d.ts", "import": "./dist/hanging.js" },
    "./hanging.css": "./dist/hanging.css"
  }
  ```

- Import sites in the playground: `apps/playground/src/chat-preview.ts:1` (`import typography from '@typograph/chat'`), `apps/playground/src/ChatComparison.tsx:12` (`import hangingPunctuation from '@typograph/chat/hanging'`), `apps/playground/src/main.tsx:15` (`import '@typograph/chat/hanging.css'`).
- Root scripts (`package.json`): `"dev": "npm run build:chat && npm run dev -w @typograph/playground"`. `CONTRIBUTING.md:14` says "Rebuild package changes with `npm run build:chat`; site changes reload automatically."
- The engine's only runtime dependency, `@typehug/en`, is hoisted to the root `node_modules`, so Vite can resolve it from the package source directory.
- Vite `defineConfig` accepts a function `({ command, mode }) => config`; `command` is `'serve'` for `vite`/`vite dev` and `'build'` for `vite build`. `vite preview` also reports `'serve'` but serves the built `dist/`, so the alias is inert there.
- Alias entries are matched in order; more specific patterns must come first.

## Target state

- `npm run dev -w @typograph/playground` works on a fresh clone without a prior build and hot-reloads engine edits.
- `npm run build`, `npm run test:landing`, `npm run bench:chat`, `npm run check:package` behave exactly as today and never see the `src/` path.

## Scope boundaries

**In scope:** `apps/playground/vite.config.ts`, root `package.json` (the `dev` script only), `CONTRIBUTING.md` (one paragraph).

**Out of scope, do not touch:** `packages/chat-typography/package.json` (do not add a `development` export condition; keep the published manifest unchanged), `tsconfig.json`, `examples/**`, the fixture's Vite config, `vitest.config.ts`.

## Steps

### Step 0 — Baseline

```bash
cd /Users/caleb/Dev/typograph
npm run build
grep -c "chat-typography/src" apps/playground/dist/.vite/manifest.json
```

Expected: build succeeds; grep → `0`. Record this: it is the invariant the build must keep.

### Step 1 — Config

Replace `apps/playground/vite.config.ts` with:

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const packageSource = (file: string) =>
  fileURLToPath(new URL(`../../packages/chat-typography/src/${file}`, import.meta.url));

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: '/',
  resolve: {
    dedupe: ['react', 'react-dom'],
    // The dev server edits the engine in place; builds keep the published dist entry points.
    alias:
      command === 'serve'
        ? [
            { find: /^@typograph\/chat\/hanging\.css$/, replacement: packageSource('hanging.css') },
            { find: /^@typograph\/chat\/hanging$/, replacement: packageSource('hanging.ts') },
            { find: /^@typograph\/chat$/, replacement: packageSource('index.ts') },
          ]
        : [],
  },
  optimizeDeps: { include: ['streamdown'] },
  build: { sourcemap: true, manifest: true },
  server: { port: 4173 },
}));
```

### Step 2 — Script and docs

1. Root `package.json`: change `"dev"` to `"npm run dev -w @typograph/playground"`. Keep `build:chat` as its own script.
2. `CONTRIBUTING.md:14`: replace "The dev command builds the chat package before starting Vite. Rebuild package changes with `npm run build:chat`; site changes reload automatically." with "The dev server resolves `@typograph/chat` from `packages/chat-typography/src`, so engine and site changes both reload automatically. Production builds, tests, and benchmarks use the built package; run `npm run build:chat` before `npm run bench:chat` or `npm run check:package`."
3. Check `README.md` "Try it locally" still reads correctly (it says `npm run dev`; no change needed unless it mentions the pre-build).

### Step 3 — Verify the dev path

Run in the background, then probe:

```bash
(npx vite --host 127.0.0.1 --config apps/playground/vite.config.ts apps/playground > /tmp/typograph-vite.log 2>&1 &) ; sleep 4
curl -s http://127.0.0.1:4173/src/chat-preview.ts | grep -o '/@fs[^"]*chat-typography/src/index.ts' | head -1
curl -s http://127.0.0.1:4173/src/main.tsx | grep -o '/@fs[^"]*chat-typography/src/hanging.css' | head -1
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4173/
```

Expected: first two greps each print one `/@fs/…/packages/chat-typography/src/…` path; the third prints `200`. Then stop the server (`pkill -f "vite --host 127.0.0.1"`). If the greps print nothing, inspect `/tmp/typograph-vite.log` for a resolution error and STOP if `@typehug/en` cannot be resolved from the package directory.

Then prove hot reload picks up the source: temporarily add `console.log('probe')` at the top of `packages/chat-typography/src/index.ts`, curl `/@fs/…/index.ts` (use the path from the grep) and confirm the string appears, then **revert the probe edit**.

### Step 4 — Verify the build path is untouched

```bash
npm run build
grep -c "chat-typography/src" apps/playground/dist/.vite/manifest.json
npm run test:landing
```

Expected: grep → `0` (same as Step 0); Playwright `19 passed`.

### Step 5 — Gate

```bash
npx tsc --noEmit
npx prettier --check .
npx oxlint --deny-warnings .
```

## Done criteria

- `grep -c "command === 'serve'" apps/playground/vite.config.ts` → `1`.
- `node -e "console.log(require('./package.json').scripts.dev)"` → `npm run dev -w @typograph/playground`.
- Step 3 greps succeed; Step 4 grep is `0`; `npm run test:landing` → 19 passed.

## Escape hatches

- If Vite refuses to serve files under `packages/` because of `server.fs.allow`, add `server: { port: 4173, fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] } }` and note it. Do not set `fs.strict: false`.
- If `tests/chat-renderer.test.tsx` or `vitest` behaviour changes (they should not — vitest uses the root `vitest.config.ts`, not this file), STOP and report.
- If the Step 4 grep is non-zero, the alias leaked into the build: revert and report; do not ship.

## Maintenance notes

- Adding a new package entry point (for example a future `@typograph/chat/punctuation`) requires a matching alias line here, most specific first.
- If the package ever gains a `development` export condition, prefer that over this alias and delete the alias block.
