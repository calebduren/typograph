# Plan 011: HTML input — `rehypeTypography` and `typeset({ input: 'html' })`

| Field           | Value                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| Status          | reviewed (2026-09-25); revised; ready to execute                                                              |
| Written against | commit `3a452cf` (0.2.0 published and deployed), 2026-09-25                                                   |
| Effort          | L (engine refactor, hast collector, HTML aligner and splice, hanging option, tests, package check, docs)      |
| Risk of change  | medium. The engine refactor touches every existing path, gated by the unchanged 219-test suite                |
| Depends on      | —                                                                                                             |
| Source brief    | [007](007-static-artifact-typography.md), milestone M4 (this plan revises two of its points; see "Decisions") |

## Why this matters

A lot of AI text reaches users inside HTML the product owns: an email template with the brief interpolated into it, a CMS field, a server-rendered page. Today Typograph handles Markdown (`typeset`) and plain strings (`typesetText`). Prose that is already HTML, or that the template itself adds, gets nothing. The brief's lighter path ("typeset the Markdown before templating") does not cover it.

## Findings (prototypes of 2026-09-25)

The prototypes adapted `hast-util-from-html` output to mdast shapes so the current plugin could run, then spliced edits into the source. That adapter is not the design (brief 007, decision 3).

1. **Splicing works on a clean email template.** A doctype document with CRLF line endings, `<head>`/`<title>`/`<style>`, a layout table, inline code, a link with apostrophes in `href` and `title`, an Outlook conditional comment, `lang="fr"`, `data-typograph="off"`, and a quote spanning `<b>` came out byte-identical except for 13 typographic characters. No node aborted.
2. **Template-escaped quotes are the common case.** Template engines HTML-escape interpolated text, so model quotes arrive as `&quot;`, `&#34;`, `&#39;`, or `&#x27;`. Leaving entity quotes as written (the Markdown rule) would miss most quotes in real templates.
3. **Parser positions are source ranges, not always text ranges.** `<table>before<tr><td>cell</td></tr>after</table>` produces one foster-parented text node, value `beforeafter`, whose span (offsets 7–40) contains the row's tags. Only a strict, complete alignment may license edits.
4. The parser normalizes `\r\n` and lone `\r` to `\n` in text values.
5. Whitespace split across source lines (`30\n      min`) is never joined: only single spaces are candidates. This is conservative. Document it.
6. **Parity baseline.** Rendering every corpus case from Markdown to HTML (remark-rehype, no typography) and typesetting that HTML yields the same sequence of typographic characters as the Markdown engine, except in exactly `escaped-quote` and `escaped-after-entity`. HTML has no escape syntax, so those quotes curl.

## Decisions (including revisions to brief 007 M4)

| #   | Topic            | Decision                                                                                                                                                                                                                                                       |
| --- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | Output mechanism | Splice into the source; never re-serialize. **Revises M4**, which assumed a rehype round trip.                                                                                                                                                                 |
| H2  | Entity quotes    | In HTML mode, replace the whole reference span with the typographic character. **Diverges from the Markdown target on purpose:** rendered Markdown `web` output already curls entity quotes (`tests/chat-static.test.ts:180`), and HTML text is rendered text. |
| H3  | Element policy   | An explicit content policy (below). Unknown elements, including custom elements, are **blocks**: a block boundary can only cause a miss (a quote left straight), never a wrong curl. **Revises M4's** narrower block list.                                     |
| H4  | Inheritance      | `lang` and `translate` resolve while descending, with nested overrides. `data-typograph="off"` and `skip` are hard subtree stops.                                                                                                                              |
| H5  | Parse mode       | Explicit: `html: 'fragment'` (default) or `'document'`. No detection heuristic.                                                                                                                                                                                |
| H6  | Trust            | HTML input is trusted and returned unsanitized, byte for byte outside edits. (Markdown input drops raw HTML; HTML input cannot.)                                                                                                                               |
| H7  | Hanging          | Not available through `typeset({ input: 'html' })`: it needs markup insertion. Available through `rehypeTypography` plus `rehypeHangingPunctuation({ source: 'html' })`, which honors the same policy.                                                         |
| H8  | Markdown splice  | Untouched. HTML gets its own aligner.                                                                                                                                                                                                                          |

## Design

### A. Engine refactor: a neutral inline-run core

Split `formatInline` (`src/index.ts:364`) into a collector and a core, with explicit contracts:

```ts
type Writable = {
  value: string;
  position?: { start?: { offset?: number }; end?: { offset?: number } };
};
type Run =
  | { kind: 'prose'; nodes: Writable[] } // real text nodes; the core writes results back
  | { kind: 'literal'; value: string }; // synthetic: '\ufffc' placeholder, '\n' break, or '' for inline HTML
type Segment = Run | { kind: 'boundary' }; // flushes the spacing run; punctuation context continues (mdast links)

interface CoreHooks {
  /** Extra protection after protectionMask, e.g. protectSourceSyntax(mask, nodes, original, sourceMask). */
  protect?(mask: Uint8Array, nodes: Writable[]): void;
  /** Right-edge test for a prose run; the remark plugin checks the source char after the last node's end offset. */
  boundary(nodes: Writable[]): boolean;
}
function typesetSegments(
  segments: Segment[],
  settings: ChatTypographyOptions,
  hooks: CoreHooks,
): void;
```

- `collectMdastRuns(parent, settings)` keeps today's traversal exactly: `skip` checked in the inline walk (the outer `visit` keeps its own check), emphasis/strong/delete transparent, `link`/`linkReference` as a `boundary` before and after, `html` as literal `''`, `break` as literal `'\n'`, others as literal node value or `'\ufffc'`.
- `typesetSegments` holds everything after collection: joined source, literal mask, `protectionMask`, `hooks.protect`, whole-block punctuation, per-prose-run spacing with `hooks.boundary`, and write-back to `Writable` nodes only.
- **Gate:** step 1 lands alone. The 219 existing tests pass with no test edits.

### B. `rehypeTypography` and the HTML content policy

A rehype plugin, a named export from `@calebduren/typograph`, that mutates hast text nodes in place. Options: `locale`, `phase`, `punctuation`, `spacing`, `skip(node: hast Nodes)`. No new dependencies.

Content policy (`collectHastRuns`), evaluated per element:

| Kind                 | Rule                                                                                                       | Treatment                                                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hard stop            | `skip(node)` true, or `data-typograph="off"`                                                               | literal `'\ufffc'`; no nested override                                                                                                                      |
| Non-prose subtree    | `code kbd samp var pre script style textarea template svg math head title noscript rt rp`                  | literal `'\ufffc'`                                                                                                                                          |
| Language / translate | effective `lang` not English, or effective `translate="no"`                                                | subtree not typeset, but descend: a nested `lang="en…"` or `translate="yes"` re-enables prose                                                               |
| Literal inline       | `img input button select iframe object embed video audio canvas wbr`                                       | literal (`wbr` as `''`)                                                                                                                                     |
| Line break           | `br`                                                                                                       | literal `'\n'`                                                                                                                                              |
| Transparent inline   | `em strong b i u s del ins mark small sub sup span font abbr cite dfn q time data bdi bdo label nobr ruby` | children join the current run, **unless** its inline `style` sets `display` to anything but `inline`/`inline-block`/`contents`, in which case it is a block |
| Spacing boundary     | `a`                                                                                                        | `boundary` before and after; punctuation continues                                                                                                          |
| Block                | everything else, including `p div center table tbody tr td th li` and all unknown or custom elements       | flush the block, recurse; quote state resets                                                                                                                |

- **Effective language:** start from `options.locale`, which is still required and must be English. An element's `lang` overrides it for its subtree; `lang=""` means unknown and is not English. `<html lang>` is honored like any other element.
- **Styles:** only the inline `style` attribute is read. Class-based and stylesheet display rules are invisible; document this. `display:none` elements (such as email preheaders) are typeset as their own block, not skipped, because inbox previews show them.
- Consecutive inline children of any element form one block, so text directly inside `<td>` or `<div>` next to block siblings is typeset.
- The engine's string-level protection (URLs, email addresses, backtick spans) still applies. There is no Markdown source-syntax hook.

### C. Hanging for rehype users

`rehypeHangingPunctuation` gains `source?: 'markdown' | 'html'`, default `'markdown'`, with unchanged behavior. With `'html'`:

- The `<`-at-source-offset guard (`hanging.ts:27–31`) is off.
- Blocks follow B's policy for eligibility: hard stops, non-prose subtrees, effective language/translate, and styled display.

It never infers HTML from a missing `file.value`.

### D. `typeset(html, { input: 'html', … })`

Types become a discriminated union:

```ts
type MarkdownTypesetOptions = { input?: 'markdown'; target: 'web' | 'email' | 'markdown'; math?: boolean; hanging?: boolean; skip?: (node: MdastNodes) => boolean; … };
type HtmlTypesetOptions = { input: 'html'; target: 'web' | 'email'; html?: 'fragment' | 'document'; skip?: (node: HastNodes) => boolean; … };
export type TypesetOptions = MarkdownTypesetOptions | HtmlTypesetOptions; // shared: locale, punctuation, spacing
```

- For HTML input, `target: 'markdown'`, `math`, and `hanging` are compile-time errors, and also throw a `TypeError` at runtime. `hanging: false` is accepted as a no-op. `web` and `email` return identical output; document that HTML input makes character edits only.
- Peers: `unified` and `rehype-parse` (new optional peer, `^9.0.1`), lazy-loaded with missing-peer errors as in plan 009.

**HTML aligner** (new, separate from the Markdown `align`). For each text node with a start and end offset, walk the source span and the original value together:

- A source char equal to the value char maps 1:1.
- A source `\r\n` maps to one value `\n`, and a lone `\r` to `\n`.
- A source `&` begins a character reference. Decode it **with the loaded parser**, which is parser-equivalent by construction and adds no decoder dependency. Take the longest `&[#A-Za-z0-9]+;?` token, parse it alone as fragment text, and derive how many source characters were consumed: literal characters after the reference pass through unchanged. The decoded code units map to the whole consumed span, marked as a span.
- A token that decodes to itself (not a reference) maps character by character. `&amp;quot;` decodes to `&` plus the literal `quot;`, so it is never a quote. There is no recursive decoding.
- Any other mismatch (a `<` inside the span, as with foster parenting, or leftover source) **aborts the node**: none of its edits apply.
- Record `[start, end)` source ranges claimed by each node. If two nodes' ranges overlap, abort both.

**Splice:** for each changed value index, if it maps to a single source character equal to the original character, replace that character. If it maps to a reference span that decodes to exactly the original character, replace the whole span with the new character. Otherwise skip. Apply replacements from the end of the source toward the start. Output is literal UTF-8; document that it must be served or sent as UTF-8.

## Steps

0. **Baseline:** `npm run check` → 219 passing.
1. **Refactor (A):** collector plus core. The full suite passes unmodified. Commit alone.
2. **Policy and plugin (B):** `src/html.ts` (`collectHastRuns`, `rehypeTypography`), exported from `index.ts`.
3. **Hanging option (C)** with tests: HTML-origin blocks hang with `source: 'html'` and respect the policy. Default behavior is unchanged for Markdown-embedded raw HTML and for callers without a source.
4. **HTML input (D):** union types, the aligner, the splice, parse modes, the peer, errors. Leave the Markdown splice untouched.
5. **Tests** (`tests/chat-html.test.ts`):
   - The finding-1 template, with an exact expected output and byte-identity outside edited spans.
   - **References:** `&quot;` `&#34;` `&#39;` `&#x27;` curl; `&amp;quot;` is unchanged; legacy `&amp` without a semicolon is consumed as the parser does; numeric references outside the BMP; references next to links, code, and skipped nodes.
   - **Alignment aborts:** foster-parented `before`/`after` text around a table row; malformed and misplaced `html`/`head`/`body` tokens; overlapping spans.
   - **CR:** lone CR and CRLF in text.
   - **Policy:**
     - Every table row in section B.
     - `display:block` and `display:none` spans; a custom element breaking a quoted phrase (a documented miss).
     - Nested `lang="fr"` inside `lang="en"`, and `lang="en"` inside `lang="fr"`.
     - `translate="no"` / `translate="yes"`; `lang=""`; `data-typograph="off"` with a nested `lang="en"` staying off.
   - **Content policy, not a splice failure:** attribute-like text in prose (`title="it's"` written as text) is typeset like any prose.
   - **Modes:** the same input in `fragment` and `document` modes.
   - **Parity:** for every corpus case, compare the sequence of `“ ” ‘ ’ U+00A0` in document order between the Markdown engine's `web` output and HTML-input output on remark-rehype's rendering of the same Markdown. The difference list is exactly `['escaped-after-entity', 'escaped-quote']`. **Changing it requires review.**
   - **Idempotency** over the corpus-as-HTML.
   - **Pipeline:** `rehypeTypography` with `rehypeHangingPunctuation({ source: 'html' })` in unified.
   - **Errors:** `target: 'markdown'`, `math`, or `hanging: true` with HTML input throw; a missing `rehype-parse` is named.
6. **Package check:**
   - Add `rehype-parse@9.0.1` to the exact install list.
   - Smoke-test `rehypeTypography` and `typeset({ input: 'html' })`.
   - Extend the strict TypeScript sample (`check-chat-package.mjs:93`) with `HtmlTypesetOptions`, including a `// @ts-expect-error` for `hanging` with HTML input.
   - Extend the peerless consumer (`:145`) with the HTML branch's error message.
   - Assert the new optional peer.
7. **Docs:**
   - A README "HTML input" section covering both APIs, the policy table, entity replacement, trust and no sanitization, UTF-8, only inline `style` being read, the whitespace limitation, and hanging only via the rehype pair.
   - The integration guide.
   - The CHANGELOG.
   - The landing page is **not** part of this gate.
8. **Gate:** `npm run check`, `npm run test:landing`, `npm run test:chat-integration`.

## Done criteria

- Step 1 is its own commit with an unmodified, passing suite.
- The finding-1 template is byte-identical outside edited spans, with its template-escaped quotes curled.
- Foster-parented text aborts; `&amp;quot;` is unchanged.
- The parity difference list is exactly `['escaped-after-entity', 'escaped-quote']`.
- `npm run check` exits 0; the landing and integration suites pass.

## Escape hatches — STOP and report instead of improvising if

- The refactor changes any existing test result.
- The parity list changes.
- Byte-identity fails outside an edited span.
- Parser-based reference decoding cannot determine the consumed length for some token class. Report the class; do not add a heuristic decoder.

## Out of scope

- Hanging through `typeset({ input: 'html' })`.
- Joining whitespace that spans source lines.
- Entity-encoded output for non-UTF-8 transports.
- Reading class-based or stylesheet `display` rules.
- Sanitization.
- Landing-page copy.
