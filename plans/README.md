# Improvement plans for Typograph

Written 2026-09-18 by an advisory audit (`/improve`, standard effort) against commit `cdb2842` **with the uncommitted working tree applied** (23 modified files, 1 untracked). Every plan's excerpts and line numbers reflect that working tree, not `HEAD`. An executor must start from a commit that contains the pending changes; check `git status --short` before beginning any plan and stop if the file shown in P0 below is still untracked.

The audit ran non-interactively (no maintainer available to pick findings), so plans were written for the top items by leverage. Add or drop plans as you see fit; keep numbering monotonic.

## Prerequisite P0 — track the new engine module before anything else

`packages/chat-typography/src/quote-context.ts` is **untracked** (`??` in `git status`) while `index.ts:3` and `hanging.ts:2` already import it. A `git commit -a` or `git add -u` of the pending work will land a tree where `npm run build:chat`, the playground build, the fixture, and CI all fail, even though every check passes locally. Run `git add packages/chat-typography/src/quote-context.ts` before committing the pending work. Every plan below assumes this is done.

## Recommended execution order

| #   | Plan                                                                                                                                                                                                                                           | Effort  | Risk   | Depends on           | Status                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------ | -------------------- | -------------------------- |
| P0  | Track `quote-context.ts` (see above)                                                                                                                                                                                                           | trivial | none   | —                    | not started                |
| 001 | [Fix three punctuation-engine defects](001-engine-protection-and-quote-context-fixes.md) — stray backtick silences the rest of a reply; quote before footnote/inline literal stays straight; uncommitted lookahead regresses `6'`-style primes | S–M     | low    | P0                   | not started                |
| 002 | [Hanging helper tolerates missing `properties`](002-hanging-helper-missing-properties.md) — one-line crash fix                                                                                                                                 | S       | low    | P0                   | not started                |
| 003 | [Broaden engine regression coverage](003-broaden-engine-regression-coverage.md) — corpus under the shipped default; headings/breaks/lists/blockquotes/HTML; block-level `skip`; spacing sub-rules; Worker URL normalisation                    | M       | low    | 001 (same test file) | not started                |
| 004 | [Three small landing-page fixes](004-landing-page-small-fixes.md) — dead `aria-label`s on `<div>`s, stale hanging-scope caption, untyped view state                                                                                            | S       | low    | —                    | not started                |
| 005 | [Dev server resolves the package from source](005-dev-server-resolves-package-source.md) — no more manual `build:chat` while editing the engine                                                                                                | M       | medium | —                    | not started                |
| 006 | [Fail-fast `check` and CI hygiene](006-fail-fast-check-and-ci-hygiene.md) — lint/format first, Node pins, Playwright cache, Wrangler timeout, keep `.vite/` off the site                                                                       | S       | low    | —                    | not started                |
| 007 | [Brief: typography for static AI artifacts](007-static-artifact-typography.md) — Markdown `typeset()` first, email spike, HTML input, CLI; reviewed                                                                                            | M–L     | medium | —                    | reviewed; questions closed |
| 008 | [Idempotency across the corpus and serialized output](008-idempotency-across-corpus.md) — brief 007 M1; tests only; pins the `remark-stringify` escape loss                                                                                    | S       | low    | —                    | done (e9599dc)             |
| 009 | [`typeset()` static entry for Markdown](009-static-typeset-markdown.md) — brief 007 M2; web/email/markdown targets, GFM syntax, opt-in math, lazy optional peers, source splice                                                                | M–L     | medium | 008                  | not started                |
| 010 | [`typesetText()` for plain strings](010-typeset-text-plain-strings.md) — sync, dependency-free root export for titles, notifications, and other non-Markdown AI text                                                                           | S       | low    | —                    | done                       |

Dependency graph:

```
P0 ──► 001 ──► 003
  └──► 002
007 (brief) ──► 008 ──► 009
010 is independent
004, 005, 006 are independent (005 and 006 both edit CONTRIBUTING.md; trivial merge)
```

Status values: `not started` · `in progress` · `done (<commit>)` · `stale` · `abandoned (<reason>)`. Executors should update this table.

## Verification commands (used as gates in every plan)

| Purpose                                                                      | Command                                                                | Expected today |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------- |
| Unit + renderer tests                                                        | `npx vitest run`                                                       | 105 passed     |
| Typecheck                                                                    | `npx tsc --noEmit && npm run typecheck -w @typograph/chat-integration` | clean          |
| Lint / format                                                                | `npx oxlint --deny-warnings . && npx prettier --check .`               | clean          |
| Full gate (needs network)                                                    | `npm run check`                                                        | exit 0         |
| Landing browser suite (builds first, serves through local Wrangler on :4174) | `npm run test:landing`                                                 | 19 passed      |
| SDK fixture browser suite                                                    | `npm run test:chat-integration`                                        | 11 passed      |

## Findings that were considered and not planned

Recorded so the next audit does not re-raise them.

**Rejected as by-design or mis-attributed**

- "The 161 KB gzip deferred chunk is Streamdown's Mermaid chunk, which the page never loads." Wrong: the chunk is _named_ after Mermaid's facade module but contains `ChatComparison` and Streamdown (verified by grepping the built asset for "Replay stream", "Show changes", `data-streamdown`). The `LANDING_TEST.md` measurement is correct. The Playwright test that picks `dynamicImports[0]` therefore blocks the right chunk today; it is brittle to a second lazy import but not wrong.
- "The reference integration never sets `phase: 'complete'`." By design: README and `HARDENING_TEST.md` recommend a fixed streaming preset that needs no finish callback.
- Replay re-renders both panes every 85 ms and forces layout each tick. Design decision recorded in `LANDING_PAGE_BRIEF.md`; profiling on real devices is already on the release list.
- Emoji or other non-word characters directly before a `"` leave it straight (`😀"Hi"😀`). Conservative pass-through, consistent with the documented policy.
- Fixture Worker accepts an unvalidated JSON body and an unauthenticated agent WebSocket. Local fixture with no deploy route; documented as "not a production chat starter".
- `@types/hast` / `@types/mdast` as runtime dependencies of the published package. Documented and machine-enforced in `scripts/check-chat-package.mjs`.
- CSP `style-src-attr 'unsafe-inline'`. Required for the `--reading-width` inline style; `style-src` itself is `'self'`.
- `oxlint` runs only the default `correctness` category. Opinion, not a defect; enabling `suspicious`/`perf` would surface triage work with unclear payoff.

**Deferred (real but low leverage; no plan written)**

- A literal `](` in prose with no later `)` protects the rest of its block (`index.ts:99-106`). Rare; inherent to protecting in-flight link destinations. Tightening (require a preceding unmatched `[`) is possible if it ever shows up in real replies.
- `before()` returns `''` for a lone low surrogate at index 1 (`index.ts:39-44`, `slice(-1, 1)`). Only reachable with malformed text; a `Math.max(0, end - 2)` clamp would fix it.
- Fixture bundles two different `cn` helpers (`cn@0.3.0` in shadcn components vs `clsx`+`tailwind-merge` in `lib/utils.ts`). Cosmetic, fixture-only.
- Playground uses ranges (`streamdown ^2.0.0`, `react ^19.1.0`) while the fixture pins exact versions; the lockfile currently dedupes to one copy of each. Align before publishing.
- `npm audit`: one low (esbuild dev-server advisory, reached only by the local benchmark script) and two moderate dev-only (vitest 3.x). Major-version lag: vitest 3→5, TypeScript 5→7, Vite 7→8. Batch when convenient.
- `HARDENING_TEST.md:73` says "70 chat-engine checks"; the file is now 88 and will grow. `CHANGELOG.md` does not mention the pending hardening work. Plans 001/002 add changelog bullets; the historical count can be left or footnoted.
- Public source maps (3.2 MB) are deployed under a one-year immutable cache. A maintainer decision, flagged in Plan 006.
- The hero specimen hand-writes the hanging helper's two-span DOM (`main.tsx:218-220`). Intentional coupling; a Playwright assertion comparing it to real helper output would be cheap insurance.

## Direction options (not planned; for the maintainer to weigh)

1. **Let the engine report what it changed.** The playground reconstructs edits by comparing text nodes character-by-character (`apps/playground/src/chat-preview.ts:136-138`), which silently breaks the moment any rule changes text length (ellipses, dashes, entities). An opt-in `onChange({ offset, before, after, rule })` or `file.data.typograph` list would delete that fragile diff, let "Show changes" say _why_, and give integrators a dev-mode assertion hook. Fits `PRODUCT.md`'s "make each change inspectable". Cost: a few bytes in the core unless tree-shakeable, and a stable rule-name vocabulary.
2. **Punctuation-only entry point before publication.** `HARDENING_TEST.md` records that Typehug (most of the 4.2 KB gzip) ships even when spacing is off, which is the landing page's own default. A `@typograph/chat/punctuation` export makes the default configuration smaller and gives the package a consistent core / spacing / hanging shape. Entry-point layout is the hardest thing to change after 1.0.
3. **A supported React binding instead of a prose workaround.** The "refresh plugin identity when settings change" fix exists in three shapes across the demo, the guide, and the fixture (and the fixture's copy does not refresh `plugins` at all). A `@typograph/chat/react` hook returning memoised `{ remarkPlugins, rehypePlugins, plugins }` would make the correct pattern the default and version it against Streamdown. Cost: a React-shaped surface on a framework-free package; gate behind an optional peer.
4. **Ship the corpus as a preflight.** The agent prompts end with an unverifiable VERIFY checklist. Exporting `validation/cases.json` plus a pure `assertUnchanged(input)` helper as `@typograph/chat/testing` turns that checklist into a pass/fail the integrator's agent can run.

## What was not audited

- `landing.css` was scanned for orphan selectors and spot-read, not reviewed line by line.
- `examples/chat-integration/src/components/**` (vendored shadcn / AI Elements source) was not reviewed beyond dependency usage.
- No Playwright suite was executed during the audit (only unit tests, typecheck, lint, and format); browser-level claims rely on `LANDING_TEST.md` and reading the specs.
- `.impeccable/` and `apps/playground/.local/` are gitignored design-agent artefacts and were skipped. Note: `.local/fonts/` holds trial and personal-use-licensed fonts; they are correctly ignored and must never be committed or referenced from tracked CSS.
- Dependency upgrades were inventoried, not attempted.
