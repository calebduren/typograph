# Plan 009: `typeset()` static entry for Markdown input

| Field           | Value                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| Status          | done                                                                                                    |
| Written against | commit `504cc20` plus the uncommitted landing-page work, 2026-09-23                                     |
| Effort          | M–L (new entry ~200 lines, splice aligner, tests, package check, docs)                                  |
| Risk of change  | medium; new public API and package manifest changes. The core engine and existing entries do not change |
| Depends on      | 008 (reuses its reparse harness; the `markdown` target must pass where `remark-stringify` could not)    |
| Source brief    | [007](007-static-artifact-typography.md), milestone M2 and the "typeset before templating" recipe       |

## Why this matters

A scheduled agent that writes a daily brief should be able to typeset it in one call, without assembling a unified pipeline. `@calebduren/typograph/static` exports `typeset(markdown, options) → Promise<string>` with three output targets: `web` HTML, `email` HTML, and `markdown`, which preserves the author's formatting. The decisions behind every choice here are recorded in brief 007's "Decisions from review" table; this plan does not reopen them.

## Background the executor needs

- Read brief 007 fully first, and plan 008's "Findings" section.
- Repo conventions as in plan 008. Package root: `packages/chat-typography`. Build: `tsup src/index.ts src/hanging.ts --format esm --dts --minify --clean` (`package.json:31`). tsup externalizes `dependencies` and `peerDependencies` automatically.
- `remarkChatTypography` (`src/index.ts:467`) reads the original source from `file.value` to protect escapes. `rehypeHangingPunctuation` (`src/hanging.ts`) reads `file.value` for its raw-HTML guard. Both work unchanged when run inside one `unified().process(markdown)` call.
- `scripts/check-chat-package.mjs` packs the package, installs it into a clean temp consumer with exact `unified@11.0.5` and `remark-parse@11.0.0`, runs a smoke script and a strict TypeScript check, and asserts `dependencies` is exactly `['@typehug/en', '@types/hast', '@types/mdast']`.

## Supported Markdown syntax (decided here)

The test harness parses with `remark-parse` + `remark-gfm` + `remark-math` (`tests/chat-typography.test.ts:23-26`). `typeset()` must declare its own syntax rather than inherit that silently. A prototype on 2026-09-23 compared the three stacks:

| Input                                | CommonMark only                            | + GFM                        | + GFM + math                                                     |
| ------------------------------------ | ------------------------------------------ | ---------------------------- | ---------------------------------------------------------------- |
| `~~"old"~~ and "new"[^1]`            | `~~"old"~~ and “new"[^1]` (pairing broken) | `“old” and “new”` + footnote | same as GFM                                                      |
| GFM table with `"Acme"` in a cell    | pipes stay as prose text                   | real table, `“Acme”`         | same                                                             |
| `- [ ] "Call" Bob's team`            | `[ ]` stays literal                        | task item                    | same                                                             |
| `Revenue hit $5 and costs $10 today` | unchanged                                  | unchanged                    | **`Revenue hit 5 and costs 10`**: the dollars become inline math |
| `$f'(x)$`                            | prime left straight (by luck of context)   | same                         | protected as math                                                |

Decision:

- **CommonMark + GFM, always.** Tables, strikethrough, autolink literals, footnotes, and task lists are standard in model output, and without GFM the engine sees `~~` and `[^1]` as prose and mispairs quotes. `remark-gfm` is loaded for every target.
- **Math is opt-in: `math: true`, default `false`.** `remark-math` treats single dollars as inline math by default, which silently corrupts currency. Briefs mention money far more often than they contain TeX. With `math: false`, `$…$` is ordinary prose. Document that TeX in prose may then receive apostrophe conversion, and that `math: true` uses `remark-math` defaults (single-dollar inline math), matching the test harness.
- **Raw HTML:** `web` and `email` use `remark-rehype` defaults, which **drop** raw HTML nodes. Sanitization stays a non-goal, so the static entry does not pass untrusted HTML through. `markdown` output keeps raw HTML byte-for-byte. Document both. There is no `allowHtml` option in this plan.
- Directives, frontmatter, MDX, and wiki links are unsupported: they parse as whatever CommonMark + GFM makes of them.

## API

`packages/chat-typography/src/static.ts`:

```ts
import type { ChatTypographyOptions } from './index';

export type TypesetTarget = 'web' | 'email' | 'markdown';

export interface TypesetOptions {
  /** Required. 'web' and 'email' return an HTML fragment; 'markdown' returns typeset Markdown. */
  target: TypesetTarget;
  /** Same contract as the core plugin: a valid English tag enables typography; otherwise text passes through. */
  locale?: string;
  punctuation?: ChatTypographyOptions['punctuation'];
  spacing?: ChatTypographyOptions['spacing'];
  skip?: ChatTypographyOptions['skip'];
  /** Parse $…$ and $$…$$ as math. Default false; see "Supported Markdown syntax". */
  math?: boolean;
  /** Opening-quote hanging markup. Default true for 'web'. Ignored for 'email' (until brief 007 M3) and 'markdown'. */
  hanging?: boolean;
}

export function typeset(markdown: string, options: TypesetOptions): Promise<string>;
```

- `phase` is not an option: it is always `'complete'`.
- `target` is required. There is no default, so output format is always explicit.
- Punctuation and spacing behave identically across targets (brief 007, decision 4). The only intended difference: `web`/`email` curl quotes that come from entities (`&quot;`), while `markdown` leaves entity syntax as written (see splice rules).
- The function emits no CSS. Web output with hanging requires `@calebduren/typograph/hanging.css`.

### Pipelines

| Target     | Pipeline                                                                                                                                             |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web`      | `unified` → `remark-parse` → `remark-gfm` → [`remark-math`] → core plugin → `remark-rehype` → [hanging, if `hanging !== false`] → `rehype-stringify` |
| `email`    | same, never hanging                                                                                                                                  |
| `markdown` | `unified` → `remark-parse` → `remark-gfm` → [`remark-math`] → core plugin → **source splice** (no stringify)                                         |

`math: true` without `remark-rehype` extras renders math as `remark-rehype`'s default markup (`<code class="language-math math-inline">`). Rendering TeX (KaTeX etc.) is the consumer's job; say so in docs.

## Lazy peer loading

A top-level import of an absent optional peer fails when `dist/static.js` loads, before `typeset()` can throw anything helpful. So:

- `src/static.ts` holds a **literal** importer table (bundlers need literal specifiers):
  ```ts
  const peers = {
    unified: () => import('unified'),
    'remark-parse': () => import('remark-parse'),
    'remark-gfm': () => import('remark-gfm'),
    'remark-math': () => import('remark-math'),
    'remark-rehype': () => import('remark-rehype'),
    'rehype-stringify': () => import('rehype-stringify'),
  } as const;
  ```
- Put the logic in `src/static-core.ts` as `createTypeset(peers)`; `static.ts` exports `typeset = createTypeset(peers)`. Tests import `createTypeset` from source with fake importers. `static-core.ts` is not a package export.
- Load only the peers the call needs: `unified`, `remark-parse`, `remark-gfm` always; `remark-math` when `math`; `remark-rehype` and `rehype-stringify` for `web`/`email`. Use `Promise.allSettled` and report **all** missing peers in one error.
- A rejection counts as a missing peer only if `error.code === 'ERR_MODULE_NOT_FOUND'` **and** the message contains `'<peer name>'` in quotes (Node: `Cannot find package 'remark-gfm' imported from …`). A missing _transitive_ dependency names a different package, so it is not rewritten. Every other error propagates unchanged, including errors from bundlers, which normally fail at build time.
- Error: `new Error('@calebduren/typograph/static needs these packages for target "web": remark-rehype, rehype-stringify. Install them alongside @calebduren/typograph.', { cause })`, with the first underlying error as `cause`.
- Cache loaded modules per peer (a module-level `Map<string, Promise<unknown>>`) so repeated calls do not re-import. Evict an entry whose promise rejected, so a later install can succeed in a long-lived process.
- After `npm run build:chat`, verify `dist/static.js` contains `import("remark-gfm")` (or equivalent) as a dynamic import, and that `dist/index.js` and `dist/hanging.js`, plus any shared chunk they import, contain none of the six peer names. If tsup hoists the imports, STOP (escape hatches).

## Source splice for `markdown`

The engine mutates mdast `text` node values in place with length-preserving substitutions (all replacement characters are single UTF-16 code units). A 2026-09-23 prototype of the algorithm below reproduced the engine's visible output exactly, after reparse, on all 46 corpus cases plus 8 extra inputs (blockquotes, lazy list continuations, backslash escapes, `&amp;`, tables, emphasis, ordered lists), × two spacing profiles. The only divergence was `&quot;`-derived quotes, which is the intended miss.

1. Parse, collect every `text` node with its original `value`, run the core plugin, and diff each node's new value against the original by index.
2. For a changed node, align the original value to its source span `[position.start.offset, position.end.offset)`, walking source index `i` and value index `j` together:
   - `src[i] === val[j]` → map `j → i`. If that character is `\n`, then skip source characters matching `[ \t>]` until `src[i] === val[j]`. Continuation-line indentation and blockquote markers are absent from the value.
   - `src[i] === '\\'` and `src[i+1] === val[j]` → `j` is **unmapped**; `i += 2`.
   - `src[i] === '&'` starting a numeric reference (`&#123;`, `&#x1F600;`, decoded with `String.fromCodePoint`) or one of `&amp; &lt; &gt; &quot; &apos; &nbsp;`, and the decoded text appears at `val[j]` → every decoded code unit is **unmapped**; advance past both.
   - Any other named entity, or any other mismatch, or the walk not ending exactly at the span end → **abort the node**: apply none of its edits. (No entity-table dependency. Other named entities are rare in model output, and aborting is the conservative choice.)
3. For each changed index `j` in a mapped node, write the new character at `map[j]` only if `map[j]` is mapped **and** `source[map[j]]` equals the original character. Otherwise skip it silently.
4. Return the spliced source. Never call `remark-stringify`.

Consequences to document: escaped quotes (`\"`) stay straight (they did in the tree too); entity quotes (`&quot;`) stay as entities, while `web` curls them; a text node containing an unlisted named entity keeps all of its original characters.

## Package changes

`packages/chat-typography/package.json`:

- `exports["./static"] = { "types": "./dist/static.d.ts", "import": "./dist/static.js" }`.
- Build script: add `src/static.ts` to the tsup entries.
- `peerDependencies`: `unified ^11.0.5`, `remark-parse ^11.0.0`, `remark-gfm ^4.0.1`, `remark-math ^6.0.0`, `remark-rehype ^11.1.2`, `rehype-stringify ^10.0.1` (the latest versions on 2026-09-23; these are the tested floor).
- `peerDependenciesMeta`: every one of them `{ "optional": true }`.
- `dependencies` unchanged.

Root `package.json` `devDependencies`: add `remark-rehype ^11.1.2` and `rehype-stringify ^10.0.1` (`remark-rehype` is currently only transitive, via streamdown).

`scripts/check-chat-package.mjs`:

- Keep the existing consumer. Add the four missing peers to its exact install list (`remark-gfm@4.0.1`, `remark-math@6.0.0`, `remark-rehype@11.1.2`, `rehype-stringify@10.0.1`), and extend `consumer.mjs` to smoke-test `typeset()` with each target: web contains `<p>` and `“`; email contains no `typograph-opening`; markdown equals an expected string.
- Add a **second clean consumer** that installs only the tarball, with no peers. Assert that `import('@calebduren/typograph')`, `…/hanging`, and `…/static` all succeed, and that `typeset('"Hi"', { target: 'web', locale: 'en' })` rejects with a message naming all five non-math peers.
- Extend `consumer.mts` with `TypesetOptions` usage so the strict TypeScript check covers the new types.
- Assert `manifest.peerDependenciesMeta` marks all six as optional. Add `'static entry'` and `'optional peers'` to the `checks` array.

## Steps

### Step 0 — Drift check and baseline

- Plan 008 is done: `npx vitest run` → 128 passed.
- `grep -n '"build"' packages/chat-typography/package.json` still shows the two-entry tsup command.
- `npm run check:package` passes before any change.

### Step 1 — Core and pipelines

Write `src/static-core.ts` (`createTypeset`, peer loading, pipelines, splice) and `src/static.ts` (importer table, `typeset` export, re-exported types). Follow the engine's style: small pure functions, terse "why" comments, no new runtime dependency.

### Step 2 — Tests: `tests/chat-static.test.ts`

1. **Targets:** snapshot-free exact assertions for a short brief (heading, paragraph with quotes/units/initials, GFM table, footnote, task list, fenced code, link with an apostrophe in the URL):
   - `web`: HTML contains `typograph-opening` on a leading-quote paragraph and curly quotes; code block, link `href`, and table cell text are intact.
   - `email`: identical to `web` output with the hanging spans and the `data-typograph-hanging` attribute removed. Assert no `typograph-opening`.
   - `markdown`: exact expected string.
2. **Syntax contract:** one test per row of the syntax table above, asserting the "+ GFM" column by default and the "+ GFM + math" column with `math: true`. Include `$5 and $10` staying intact by default.
3. **Protected content**, `markdown` target, byte-identical outside edited characters: fenced and inline code, math with `math: true`, link and image destinations, autolink literals, raw HTML blocks and inline tags, footnote definitions' labels, table delimiter rows, emphasis markers (`*` vs `_`), list bullets (`-` vs `*`), hard-wrapped lines, blockquote markers. Assert: for every index where output differs from input, the input character was `"`, `'`, or a space, and the output is one of `“ ” ‘ ’ U+00A0`.
4. **Splice rules:** escaped quotes unchanged; `&quot;` unchanged in `markdown` and curled in `web`; `&amp;` in a sentence with quotes still gets curly quotes (numeric/listed entity path); an unlisted named entity (`&hellip;`) aborts only its own text node.
5. **Reparse parity:** for every corpus case plus the splice fixtures from test 4, `typeset(input, { target: 'markdown', … })` reparsed with the same stack and rendered to visible text equals the engine's visible text, **except** inputs whose quotes come from entities (`&quot;`, `&#34;`, `&#39;`, `&apos;`, `&#x22;`, `&#x27;`) or sit in a node aborted by an unlisted named entity. Those are the splice contract's deliberate misses. Select the expected differences with an explicit list of fixture ids, not a regex over the input, and assert that each one differs only at those entity positions. The current corpus contains no entity quotes, so its expected-difference list is empty today; `escaped-quote` and `escaped-after-entity` (plan 008's `remark-stringify` exceptions) must reach parity.
6. **Idempotency:** `typeset(typeset(x, markdown), markdown) === typeset(x, markdown)` across the corpus.
7. **Peer loading** via `createTypeset` with fake importers: missing single peer; multiple missing peers reported together; a transitive `ERR_MODULE_NOT_FOUND` naming another package propagates unchanged; a non-module error propagates unchanged; a rejected load is evicted from the cache and retried on the next call; `markdown` never requests `remark-rehype` or `rehype-stringify`; `math: false` never requests `remark-math`.
8. **Options:** no locale → Markdown still renders (web) or returns unchanged (markdown); `hanging: false` on web emits no hanging markup; `hanging: true` on email is ignored.

### Step 3 — Build and package check

`npm run build:chat`, run the dist checks from "Lazy peer loading", then `npm run check:package`.

### Step 4 — Docs

- `packages/chat-typography/README.md`: a "Static artifacts" section with install line (package + peers per target), the API, the three targets, supported syntax, math and raw-HTML behavior, the `hanging.css` requirement, splice consequences, and the copy/paste note for U+00A0. Adjust the "does not … replace the Markdown parser" sentence: `typeset()` uses the consumer's installed unified/remark packages.
- Integration guide (`apps/playground/public/integration.md`, served as `typograph.dev/integration.md`): the "typeset Markdown before templating" recipe, stating that it does not cover prose the HTML template adds itself.
- `CHANGELOG.md`: an unreleased entry.

### Step 5 — Full gate

`npm run check` → exit 0. `npx vitest run` → 128 + the new tests, all passing.

## Done criteria

- `import { typeset } from '@calebduren/typograph/static'` works from the packed tarball, and all three targets pass the smoke test.
- The peerless consumer imports all three entries, and `typeset()` rejects with the named-peer message.
- `dist/index.js` and `dist/hanging.js` reference no peer names.
- `manifest.dependencies` is unchanged; all six peers are optional.
- Plan 008's reparse exceptions (`escaped-quote`, `escaped-after-entity`) reach parity through the `markdown` target; the only parity differences are the named entity-quote fixtures.
- `npm run check` exits 0.

## Escape hatches — STOP and report instead of improvising if

- tsup rewrites the dynamic imports into static ones or bundles a peer → report the build output; do not switch to `new Function('return import(x)')` or similar tricks.
- The splice's reparse-parity test fails for a corpus case other than those involving `&quot;`-style entities → report the case with input, output, and engine text.
- Protected-content test 3 finds a changed byte outside `" ' space` → a splice or alignment bug; report it.
- Making the package check pass requires changing `dependencies` → stop; that contradicts brief 007's decision 1.
- `remark-rehype` output differs by version in a way that breaks exact `web` assertions → assert on parsed structure (with `hast-util-from-html`) rather than widening the peer range.

## Implementation notes (2026-09-24)

- The worked example is the `brief` fixture in `tests/chat-static.test.ts`, which is checked for all three targets, rather than a separate directory under `examples/`.
- The tsup build now emits shared chunks (`dist/chunk-*.js`). Only `static.js` references the peers, and only through dynamic `import()`.
- Adding the two devDependencies made npm 11 rewrite dev/peer metadata flags in `package-lock.json`. Those lockfile changes are mechanical.

## Maintenance notes

- Adding syntax (for example directives) means adding a peer, a row in the syntax table, and a protected-content test. Never enable syntax implicitly.
- The alignment rules in "Source splice" are the contract for `markdown` output. If `remark-parse` changes how it strips container prefixes, the reparse-parity test is the tripwire.
- Brief 007 M3 (email spike) is the only thing that may turn on hanging for `email`. M4 (HTML input) adds `input: 'html'` to the same function.
