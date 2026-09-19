# Contributing to Typograph

Bring an exact input, expected result, and reason a change helps. Use invented examples instead of private text.

## Work locally

Use Node 22.12+ and npm:

```sh
npm ci
npm run dev
```

The landing page runs at <http://127.0.0.1:4173/>. The dev command builds the chat package before starting Vite. Rebuild package changes with `npm run build:chat`; site changes reload automatically.

CI runs the checks on Node 22 and 24. The package supports Node 22+ at runtime; the repository tools require Node 22.12+.

The main implementation paths are:

- `packages/chat-typography/src/index.ts`: English punctuation and optional no-break spacing.
- `packages/chat-typography/src/hanging.ts` and `hanging.css`: optional opening-quote layout.
- `apps/playground/src/main.tsx`: landing page and integration UI.
- `apps/playground/src/ChatComparison.tsx`: editable comparison and recorded replay.
- `examples/chat-integration`: real SDK transport fixture and browser checks.

## Check changes

```sh
npm run check
npm run test:landing
npm run test:chat-integration
```

The first command builds the package and both apps, checks types, runs unit/renderer tests, and validates the packed package in a clean consumer. The landing command rebuilds the site and serves its production assets through the local Cloudflare Worker on port 4174, including the configured headers. It never reuses the Vite development server. The SDK suite covers local Vercel/Cloudflare flows. See the [fixture README](examples/chat-integration/README.md) for browser prerequisites and local servers.

Punctuation changes need meaningful examples, preservation checks for neighboring syntax, and incomplete-stream coverage. Editorial examples live in `validation/cases.json`; tests live in `tests/chat-*.test.*`. Keep locale opt-outs, code, math, URLs, and original messages intact. Integration changes must preserve the renderer's sanitization and defaults.

For UI changes, preserve one native comparison scroller, keyboard access, narrow-screen reflow, and stable text geometry when highlighting changes. The landing page styles Streamdown's semantic elements and data attributes with plain CSS; emitted Tailwind class names are not its styling API.

Use `npm run bench:chat` for engine changes and `npm run bench` for server-render comparisons after building the package. Do not turn machine-dependent timings into a universal performance claim.

## Attribution and releases

Keep the Typehug notice with the package, AI Elements/shadcn attribution in the fixture, and font licenses beside the site assets. Integrations preserve the host's fonts and components. See [release preparation](docs/releasing.md). Contributions are MIT licensed.

`PRODUCT.md` is intentionally ignored local design-agent context. Keep shared product and design decisions in the tracked `DESIGN.md` and `LANDING_PAGE_BRIEF.md`; required setup belongs in the README and this guide.
