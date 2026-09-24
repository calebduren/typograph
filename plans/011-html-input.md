# Plan 011: HTML input — `rehypeTypography` and `typeset({ input: 'html' })`

| Field           | Value                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------ |
| Status          | proposed                                                                                         |
| Written against | commit `8494382` (0.2.0 published and deployed), 2026-09-25                                      |
| Effort          | L (engine refactor, hast run collector, HTML splice, hanging option, tests, package check, docs) |
| Risk of change  | medium. The engine refactor touches every existing path, gated by the unchanged 219-test suite   |
| Depends on      | —                                                                                                |
| Source brief    | [007](007-static-artifact-typography.md), milestone M4                                           |

## Why this matters

A lot of AI text reaches users inside HTML the product owns: an email template with the brief interpolated into it, a CMS field, a server-rendered page. Today Typograph handles Markdown (`typeset`) and plain strings (`typesetText`). Prose that is already HTML, or that the template itself adds, gets nothing. The brief's lighter path ("typeset the Markdown before templating") does not cover it.

## Findings from a prototype (2026-09-25)

The prototype adapted `hast-util-from-html` output to mdast shapes so the current plugin could run on it, then spliced the edits back into the source. That adapter is not the design (brief 007, decision 3). On an email template with a doctype, CRLF line endings, `<head>` with `<title>` and `<style>`, a table layout, inline code, a link with apostrophes in `href` and `title`, an Outlook conditional comment, `lang="fr"`, `data-typograph="off"`, and a quote spanning `<b>`:

1. **Splicing into the source works for HTML.** The output was byte-identical to the input except for 13 typographic characters. No node aborted. Attributes, comments, the doctype, `<head>`, and CRLF line endings were untouched. Splicing avoids re-serializing (`hast-util-to-html` rewrites attribute quoting and entities), which matters most for fragile email templates.
2. **Template-escaped quotes are the common case, not the exception.** Template engines HTML-escape interpolated text, so model output often arrives as `&quot;`, `&#34;`, `&#39;`, or `&#x27;`. The Markdown splice rule leaves entity quotes as written; applied to HTML, it would miss most quotes in real templates (the prototype left `Next &quot;line&quot;` straight). **HTML mode must replace the whole entity span with the curly character.** HTML output has no length-preservation requirement.
3. **CRLF:** the parser normalizes `\r\n` to `\n` in text values. The aligner must treat a source `\r\n` as one value `\n`.
4. **Whitespace split across source lines is never joined.** `30\n      min` gets no nonbreaking space, because only single spaces are candidates. This is conservative and correct (whitespace length is preserved). Document it as a limitation.
5. Conditional comments are hast `comment` nodes and are never visited. `<script>`, `<style>`, and `<title>` content are text nodes and must be skipped explicitly.

## Design

### A. Engine refactor: a neutral inline-run core

Split `formatInline` (`src/index.ts`) into:

- `collectMdastRuns(parent, settings) → Run[]`: the current mdast traversal (text, emphasis/strong/delete transparent, link as a spacing boundary, other nodes as literal placeholders, `skip`).
- `typesetRuns(runs, settings, hooks)`: everything after collection: joined source, literal mask, `protectionMask`, the optional `hooks.protect(mask, nodes)` (the remark plugin passes `protectSourceSyntax`), punctuation across the block, spacing per run, and write-back.

`Run = { nodes: { value: string; position? }[]; literal?: boolean }`. `hooks.boundary(nodes)` supplies the right-edge test. **Gate: this step lands alone, with no behavior change, and the existing 219 tests pass unmodified.**

### B. `rehypeTypography` (root export)

A rehype plugin that mutates hast text nodes in place, for apps that already have a rehype pipeline. Named export from `@calebduren/typograph`. No new dependencies (`@types/hast` is already one).

Options: `locale`, `phase`, `punctuation`, `spacing`, and `skip(node: hast Node)`. Same meanings as the remark plugin.

Traversal (`collectHastRuns`):

| Kind             | Elements                                                                                                                                                                         | Treatment                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Skipped subtree  | `code kbd samp var pre script style textarea template svg math head title`, plus `data-typograph="off"`, `translate="no"`, a `lang` whose primary subtag is not `en`, and `skip` | one literal placeholder; never edited                                   |
| Literal inline   | `img input button select iframe object video audio canvas`                                                                                                                       | literal placeholder                                                     |
| Line break       | `br`                                                                                                                                                                             | literal `\n`, as mdast `break`                                          |
| Transparent      | `em strong b i u s del ins mark small sub sup span font abbr cite dfn q time data bdi bdo label`                                                                                 | children join the current run                                           |
| Spacing boundary | `a`                                                                                                                                                                              | flush the spacing run; punctuation context continues, as mdast links do |
| Block            | every other element                                                                                                                                                              | flush the block and recurse; quote state resets                         |

Consecutive inline children of any element form one block, so text directly inside `<td>`, `<div>`, or `<li>` is typeset, even when block siblings surround it. Comments and doctypes are never visited. The engine's string-level protection (URLs, email addresses, backtick spans) still applies. There is no Markdown source-syntax hook: HTML has no backslash escapes.

### C. Hanging for rehype users

Add `source?: 'markdown' | 'html'` to `rehypeHangingPunctuation`, defaulting to `'markdown'`. With `'html'`, the `<`-at-source-offset guard (`hanging.ts:27`) is disabled, so HTML-origin elements become eligible. Never infer HTML from a missing `file.value`: callers can omit it today (brief 007, decision 10).

### D. `typeset(html, { input: 'html', target })`

- `input?: 'markdown' | 'html'`, default `'markdown'`. With `'html'`, `target` must be `'web'` or `'email'`; `'markdown'` throws a `TypeError`.
- Peers: `unified` and `rehype-parse` (add `rehype-parse ^9.0.1` as an optional peer; it is not currently installed). Lazy-loaded and error-translated as in plan 009.
- Document mode when the input starts (after whitespace) with `<!doctype` or `<html`; fragment mode otherwise.
- Output is the **input with edits spliced in**; nothing is re-serialized. `web` and `email` return the same string.
- `hanging: true` with HTML input throws a `TypeError` ("hanging punctuation needs markup changes; use rehypeTypography with rehypeHangingPunctuation({ source: 'html' })"). Silently ignoring it on `web` would surprise callers.
- **HTML splice rules** (extend `align` in `static-core.ts` with an HTML mode):
  - A source `\r\n` maps to one value `\n`.
  - Named and numeric references decode with a full HTML entity table. Use `decode-named-character-reference`, which `remark-parse` and `rehype-parse` both already depend on; declare it as an optional peer, or vendor the decode through the parser. Pick one and document it. Each decoded character maps to its **whole source span**.
  - When a changed character maps to a span, replace the entire span with the new character (`&quot;` → `“`, `&#39;` → `’`). When it maps to one source character, replace that character.
  - Any other mismatch (for example a legacy entity without a semicolon) aborts that text node, which keeps its original characters.
  - Edits are written as literal UTF-8 characters. Document that the result must be served or sent as UTF-8.

## Steps

0. **Baseline:** `npm run check` → 219 tests passing, clean.
1. **Refactor (A):** `collectMdastRuns` + `typesetRuns`. Run the full suite with no test edits → still 219. Commit on its own.
2. **Hast collector and plugin (B):** `src/html.ts` with `collectHastRuns` and `rehypeTypography`, exported from `index.ts`.
3. **Hanging option (C)** in `hanging.ts`, with tests: HTML-origin elements hang with `source: 'html'`; default behavior unchanged for Markdown-embedded raw HTML and for callers that pass no source.
4. **Static HTML input (D)** in `static-core.ts`: an `input` option, the HTML aligner mode, span replacement, document/fragment detection, a new peer, error text.
5. **Tests:** `tests/chat-html.test.ts`:
   - The prototype template, with an exact expected output.
   - **Byte-identity:** outside edited spans, output equals input. Every edited span in the input is `"`, `'`, a single space, or an entity decoding to `"`/`'`.
   - **Template escaping:** `&quot;`, `&#34;`, `&#39;`, `&#x27;`, and a mixed straight/entity sentence.
   - **Skips:** each skipped-subtree kind, `lang="fr"` (and `lang="en-GB"` still typeset), `translate="no"`, `data-typograph="off"`, `skip`.
   - **Structure:** text directly in `td` and `div` with block siblings; `br`; a quote spanning `<b>`; `a` as a spacing boundary; nested inline elements.
   - **Documents:** a doctype document keeps `<head>` untouched; a fragment; CRLF; a legacy entity without a semicolon aborts only its node.
   - **Parity:** for every corpus case, render the Markdown to HTML with remark-rehype (no typography), `typeset` it as HTML, and compare visible text with the Markdown engine's output. Expected differences, by explicit id list: `escaped-quote` and `escaped-after-entity` (HTML has no escape syntax, so those quotes curl), plus any case whose difference is explained by one row of the traversal table. Report the list in the test.
   - **Idempotency** across the corpus-as-HTML.
   - **rehypeTypography** in a unified pipeline, with `rehypeHangingPunctuation({ source: 'html' })`.
   - **Errors:** `target: 'markdown'` and `hanging: true` with HTML input throw; a missing `rehype-parse` names it.
6. **Package check:** peerless consumer message for HTML input; smoke test `rehypeTypography` and `typeset({ input: 'html' })` from the tarball; add `rehype-parse@9.0.1` to the exact install list; assert the new optional peer.
7. **Docs:** a README "HTML input" section (both APIs, the traversal table in brief, entity replacement, UTF-8, the whitespace limitation, hanging only via the rehype pair); the integration guide's finished-text section; the CHANGELOG; the landing "Finished text" recipe gets an HTML line.
8. **Gate:** `npm run check`, `npm run test:landing`, `npm run test:chat-integration`.

## Done criteria

- Step 1 lands as its own commit with an unchanged, passing suite.
- The prototype template round-trips with byte-identity outside edited spans, and its template-escaped quotes are curled.
- Every parity difference is on the named list.
- `npm run check` exits 0; the landing and integration suites pass.

## Escape hatches — STOP and report instead of improvising if

- The refactor changes any existing test result.
- A parity difference appears that no row of the traversal table explains.
- Byte-identity fails outside an edited span.
- Entity decoding requires a dependency that is not already transitively present, and neither declaring a peer nor vendoring is acceptable.

## Out of scope

- Hanging punctuation through `typeset({ input: 'html' })`. It needs markup insertion, not character edits; use the rehype pair.
- Joining whitespace that spans source lines (finding 4).
- Encoding output as entities for non-UTF-8 transports.
- Sanitizing HTML.
