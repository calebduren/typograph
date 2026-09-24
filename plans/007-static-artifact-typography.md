# Brief 007: Typography for static AI-generated artifacts

| Field           | Value                                                                              |
| --------------- | ---------------------------------------------------------------------------------- |
| Status          | reviewed twice (2026-09-23); all questions closed; ready for implementation plans  |
| Kind            | product + technical brief (not an executable plan yet)                             |
| Written against | commit `504cc20` plus the uncommitted landing-page work, 2026-09-23                |
| Scope           | `packages/chat-typography` API surface, new entry points, docs; no playground work |

## Why this matters

Typograph so far solves typography for **streamed chat**: Markdown arriving token by token, where every decision at the right edge may be revised. A growing share of AI text is not streamed at all. An agent writes a daily brief overnight; it arrives as an email, a page in a web app, a Slack post, or a PDF. The artifact is finished and static, yet it has the same defects as chat output: straight quotes, breakable spaces inside `7 km` or `J. R. R.`, and opening quotes that indent the first line.

The static case is _easier_ for the engine — full context, no lookahead, no lifecycle bookkeeping — but _harder_ for delivery: the output must survive several media with very different rendering capabilities. The goal is to make Typograph the obvious last step in any AI text pipeline, not only a chat renderer plugin.

**Principle carried over from chat:** the model writes plain text; a deterministic pass does typography. We do not prompt models to emit curly quotes or U+00A0. That is unreliable, costs tokens, and cannot be tested.

## What exists today (verified)

- `remarkChatTypography` (`packages/chat-typography/src/index.ts:467`) already accepts `phase: 'complete'`, which enables final-edge apostrophes (`index.ts:254`) and `spacing.lastWords` (`index.ts:287`). A static pipeline can use it unmodified.
- Every edit is a **length-preserving character substitution** in existing mdast text nodes (README "scope" paragraph). The spacing pass emits only **U+00A0** (`index.ts:359`); there is no U+202F / thin-space output, so no email-specific space fallback is needed.
- `rehypeHangingPunctuation` (`src/hanging.ts`) is a hast plugin that wraps a leading quote in `span.typograph-opening`; layout depends on `src/hanging.css` (`inline-block`, `inline-size: 0`, `transform: translateX(-100%)`).
- **The hanging helper skips parsed HTML.** Its source-position guard (`hanging.ts:27`) treats any element whose source begins with `<` as raw HTML and skips the subtree. That is correct for Markdown with embedded HTML, but an HTML-input pipeline cannot promise hanging punctuation until the guard changes.
- **Idempotency is partly tested.** `tests/chat-typography.test.ts:214` runs the plugin twice on one parsed tree, and `:285` does the same for nested curly contractions. What is missing is coverage across the whole corpus, with spacing enabled, and through serialize → reparse. A manual spot check of that path (remark-parse → plugin → remark-stringify, twice, `phase: 'complete'`, `spacing: { lastWords: true }`) gave the same output both times on a mixed sample.
- Out of scope per README and kept out here: dashes, ellipses, primes, hyphenation, language detection.
- README already prefers CSS `text-wrap: pretty` over `lastWords` for web; `lastWords` bakes NBSPs into copied text.

## Delivery media and what survives

| Medium                      | Character fixes (quotes, apostrophes, U+00A0) | Hanging punctuation                        | Notes                                                   |
| --------------------------- | --------------------------------------------- | ------------------------------------------ | ------------------------------------------------------- |
| Own web app (static HTML)   | yes                                           | yes, existing CSS                          | Also `text-wrap: pretty`; `lastWords` optional          |
| HTML email                  | yes                                           | **omitted** until the rendering spike (M3) | CSS must be inlined; Outlook desktop uses Word renderer |
| Plain-text email part / SMS | yes                                           | no (layout-only)                           | Consumer derives plain text; see `markdown` target      |
| Slack / chat platforms      | yes                                           | no                                         | Platform owns layout; mrkdwn is not CommonMark          |
| PDF (via HTML → print)      | yes                                           | yes if the renderer supports the CSS       | `hanging-punctuation` native in WebKit                  |

Character fixes are portable because they are just Unicode. Hanging punctuation is a layout feature and must degrade to a normal, correctly placed quote everywhere it is unsupported.

## Decisions from review

| #   | Question                        | Decision                                                                                                                                                          |
| --- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Packaging                       | `static` subpath of the existing package. A separate package adds release and versioning work before demand exists. Dependency isolation specified in M2.         |
| 2   | Order                           | Markdown string API first (existing engine path, early usable result). HTML input is a separate, later milestone.                                                 |
| 3   | HTML engine shape               | Extract a neutral inline-run engine when HTML input is built. Adapting hast to mdast node shapes would tangle traversal with source-protection rules.             |
| 4   | Configuration                   | `target` selects **output format and markup only**. Punctuation and spacing rules keep their individual options and behave identically across targets.            |
| 5   | Phase                           | Static entry fixes `phase: 'complete'`. The chat entry keeps its `streaming` default.                                                                             |
| 6   | Email hanging punctuation       | No known failure from code review, but the zero-width wrapper and transform are reason enough to omit hanging markup from email until the spike proves a variant. |
| 7   | Lighter path                    | Yes: document "typeset the Markdown before templating". It covers Markdown-origin briefs but not prose the HTML template adds itself. Ship it alongside M2.       |
| —   | Old `text` target (review note) | Renamed `markdown`: returns typeset Markdown, not plain text. Links, lists, and code differ between the two; plain-text derivation stays the consumer's job.      |
| 8   | `markdown` output mechanism     | Source splicing only, never `remark-stringify` (see M2).                                                                                                          |
| 9   | Return type                     | A string for every target. Callers load the existing `./hanging.css` export themselves. A CSS helper waits for a real pipeline that needs it bundled.             |
| 10  | Hanging guard location          | Change the existing `./hanging` entry in M4 behind an explicit HTML-source option; Markdown behavior stays the default.                                           |

## Milestones

Each milestone ships on its own. M1 comes first; M2 and the M2 docs recipe are the first user-visible release.

### M1. Idempotency across the corpus and serialized output

Static content gets reprocessed: re-rendered drafts, templates that interpolate already-typeset fragments, forwarded mail. Extend the existing tree-level tests (`chat-typography.test.ts:214`, `:285`) with:

- `f(f(x)) === f(x)` over the full test corpus, with `spacing: true` and `spacing: { shortWords: true, lastWords: true }`.
- The serialize → reparse path: typeset, stringify, reparse, typeset again, and compare.
- Input that already contains `“ ” ‘ ’` and U+00A0, mixed with straight marks.

Document the guarantee in README.

### M2. `typeset()` for Markdown

```ts
import { typeset } from '@calebduren/typograph/static';

const html = await typeset(markdown, {
  locale: 'en',
  target: 'web', // 'web' | 'email' | 'markdown'
  spacing: true,
  hanging: true, // honoured only where the target supports it
});
```

**Target defaults.** Punctuation and spacing are identical in every column. Only output format and markup differ.

| Setting                       | `web`                                                   | `email`                   | `markdown`                |
| ----------------------------- | ------------------------------------------------------- | ------------------------- | ------------------------- |
| Output                        | HTML fragment                                           | HTML fragment             | typeset Markdown          |
| `phase`                       | `complete`                                              | `complete`                | `complete`                |
| `punctuation`                 | on                                                      | on                        | on                        |
| `spacing` (incl. `lastWords`) | as passed; off by default                               | as passed; off by default | as passed; off by default |
| Hanging markup (`hanging`)    | default on                                              | ignored until M3 passes   | n/a                       |
| CSS                           | none emitted; load `./hanging.css` when `hanging` is on | none                      | none                      |

**Return value.** `typeset()` returns a string for every target. It emits no CSS. Docs state that web HTML with `hanging` on requires the existing `@calebduren/typograph/hanging.css` export. Email emits no hanging markup before M3, so it needs no stylesheet.

**`markdown` output preserves author formatting by source splicing.** Round-tripping through `remark-stringify` would rewrite emphasis markers, escapes, list bullets, and line wrapping, so it is never used, not even as a fallback. Every engine edit is a length-preserving substitution, so the splice writes each changed character back into the original Markdown string at its source offset. The rule:

- Apply an edit only when the text character maps unambiguously to one source offset and the source character there equals the pre-edit text character.
- When the mapping is uncertain (backslash escapes such as `\"`, entities such as `&quot;`, or any node whose decoded length differs from its source span), leave that character in its original syntax. It stays straight in the output; this is a deliberate, documented miss, not an error.
- Tests: emphasis markers, list bullets, and line wrapping are byte-identical outside edited characters; escaped and entity quotes are unchanged; `markdown` output reparsed and rendered as `web` matches direct `web` output wherever the mapping was unambiguous.

**Dependency isolation, stated precisely.** An exported subpath does not isolate dependencies: anything in `dependencies` is installed for every consumer of the package. So:

- `unified`, `remark-parse`, `remark-rehype`, and `rehype-stringify` become **optional peer dependencies** (`peerDependenciesMeta: { optional: true }`), imported only by `dist/static.js`.
- The root entry (`.`) and `./hanging` must never import them. Extend `scripts/check-chat-package.mjs` to fail the check if they do.
- If a peer is missing, `typeset()` throws an error that names the packages to install. **This forces lazy loading:** a top-level `import` of an absent peer in `dist/static.js` fails at module load, before `typeset()` can run. So the parser modules are loaded with dynamic `import()` inside `typeset()` (which is why it is `async`), and only missing-module errors for those specific peers (`ERR_MODULE_NOT_FOUND` naming the peer) are translated. Every other error propagates unchanged. Make sure the bundler (`tsup`) keeps these imports external and dynamic.
- Load only what the target needs: `markdown` needs `unified` and `remark-parse`; `web` and `email` also need `remark-rehype` and `rehype-stringify`.
- Pin tested peer version ranges and document them.

**Scope tension.** README says the package "does not replace the Markdown parser". The wrapper uses the consumer's installed parser rather than replacing it; update the README wording to make that explicit.

**Lighter path, shipped with M2.** Integration-guide recipe: "run Typograph on the Markdown before it enters your HTML/email template." It needs no new API and covers most agent-written briefs.

### M3. Email rendering spike

**Outcome (2026-09-24): abandoned.** No variant hung in Gmail web or Apple Mail on iOS. Email output keeps quotes and nonbreaking spaces and never emits hanging markup. See `validation/email-spike/README.md`.

Test the current hanging markup and at least one alternative (negative `margin-left` on the quote span; `text-indent` on the block) across Apple Mail, Gmail web/iOS/Android, and Outlook desktop/web, using a rendering service or real accounts. Record the matrix and screenshots in `validation/`.

Decision rule: turn on an email hanging variant only if it degrades to an unshifted quote (never a clipped or overlapping glyph) in every client that does not support it. Otherwise `target: 'email'` keeps ignoring `hanging`. Docs make no claims about email hanging support until this matrix exists.

### M4. HTML input (`rehypeTypography`)

**Planned in [011](011-html-input.md) (2026-09-25).** A prototype changed two points below: HTML output is spliced into the source rather than re-serialized, and template-escaped entity quotes are replaced.

For briefs whose prose lives in HTML templates, not Markdown.

- **Engine refactor first.** Extract a neutral inline-run abstraction from `formatInline`: a run of text segments with protected placeholders and block boundaries, independent of mdast or hast. The remark plugin and the new rehype plugin both feed it. The existing test suite must pass unchanged before any HTML work lands.
- **Traversal.** Join inline runs across `em/strong/b/i/a/span/mark`. Block boundaries at `p`, `li`, `td`, `th`, headings, `blockquote`, and `div`s with only inline children.
- **Protection.** Skip `code`, `pre`, `kbd`, `samp`, `script`, `style`, `textarea`, comments, and conditional Outlook comments (`<!--[if mso]>`). Never touch attribute values. Protect URLs inside text. Respect `skip` and a `data-typograph="off"` opt-out attribute.
- **Hanging guard.** Change the existing `./hanging` entry: add an explicit option (for example `source: 'html'`) that makes HTML-origin elements eligible by disabling the `<` check at `hanging.ts:27`. The default stays Markdown behavior. Do **not** infer HTML input from a missing `file.value`: callers can omit the source today, and their behavior must not change.
- **Adversarial corpus.** Entities (`&quot;`, `&#39;`), attributes containing quotes, inline code in templates, nested inline elements, and interpolated fragments that are already typeset.
- Once done, `typeset()` can accept `{ input: 'html' }`.

### M5. CLI and agent recipe

- `npx @calebduren/typograph brief.md > brief.html` (and stdin), wrapping `typeset()`.
- Document a post-processing recipe for agent frameworks (a final pipeline step, or an MCP tool that returns typeset text). Keep it a recipe, not a maintained integration, until demand is clear.

### Docs (with M2, updated per milestone)

A "Static artifacts" section in README and the integration guide: pipeline diagram, the per-medium table above, `text-wrap: pretty` vs `lastWords` guidance for static pages, and an explicit note that hanging punctuation is progressive enhancement.

## Non-goals

- Prompting or fine-tuning models to emit typographic characters.
- Dashes, ellipses, primes (unchanged scope; revisit separately if static users ask).
- Plain-text output (consumers derive it from HTML or Markdown), HTML sanitization, CSS inlining for email (users bring `juice` or their ESP), Slack mrkdwn conversion.
- Non-English locales.

## Risks

- **Scope creep** from a focused remark plugin into a general typesetter. Mitigation: subpath export, optional peers enforced by the package check, one shared engine.
- **HTML traversal correctness** (M4) is a new surface for "never corrupt literal content" violations. Gated by the engine refactor passing the existing suite and by the adversarial corpus.
- **Markdown output fidelity** (M2): stringify round-trips can silently reformat author Markdown. Gated by the source-splice decision and snapshot tests.
- **Email claims** are easy to overstate. Nothing is asserted until M3's matrix exists.
- **Copy/paste**: baked-in U+00A0 travels into copied text and plain-text search. Already documented for chat; restate for static.

## Verification

- Existing gates from `plans/README.md` (`npx vitest run`, typecheck, lint/format, `npm run check`).
- M1: corpus-wide idempotency, including serialize → reparse.
- M2: snapshot tests per target; the package check fails if the root entry imports a peer; importing `@calebduren/typograph/static` succeeds with peers absent, and `typeset()` then throws the named-peer error; non-missing-module errors are not rewritten; splice tests from the `markdown` rule above.
- M3: rendering matrix in `validation/`.
- M4: existing suite green after the engine refactor, before HTML work; HTML adversarial corpus; hanging tests for HTML-origin trees with the new option, plus unchanged behavior for Markdown-embedded HTML and for callers that pass no source.
- Worked example: one realistic daily brief rendered as `web` and `email` HTML and as `markdown`, committed under `examples/` and checked by a test.

## Open questions

None. M1 and M2 are now executable plans: [008](008-idempotency-across-corpus.md) and [009](009-static-typeset-markdown.md). Plan 009 also defines the static entry's supported Markdown syntax (CommonMark + GFM always, math opt-in).
