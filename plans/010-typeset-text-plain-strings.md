# Plan 010: `typesetText()` for plain AI-generated strings

| Field           | Value                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------- |
| Status          | done                                                                                            |
| Written against | commit `e9599dc`, 2026-09-24                                                                    |
| Effort          | S (~25 lines of engine glue, one test file, package check, docs)                                |
| Risk of change  | low; additive named export, no engine change, no new dependency                                 |
| Depends on      | —                                                                                               |
| Source          | Packaging decision of 2026-09-24: one package, entries for streaming chat and for finished text |

## Why this matters

"Any time AI generates text in your product" mostly means **plain strings**: titles, toast and notification copy, email subject lines, summaries in JSON fields, button labels. Parsing those as Markdown is wrong (`*`, `_`, `1.` and `#` would gain meaning), and plan 009's `typeset()` is async and needs parser peers. `typesetText(text, options) → string` runs the existing engine directly on a string: synchronous, dependency-free, from the root entry.

## Design (prototyped 2026-09-24)

- Split the string on blank lines (`/(\r?\n[ \t]*\r?\n)/`, the engine's own paragraph boundary), wrap each chunk as `paragraph > text` in a synthetic mdast root, run `remarkChatTypography(options)` on it, and rejoin with the original separators. Quote state resets per paragraph, as it does in Markdown.
- No source string is passed to the transformer, so there is no Markdown source-syntax protection. The engine's own string-level protection still applies: URLs, email addresses, and backtick spans are left unchanged, and tag-like `<…>` runs stay straight.
- `phase` defaults to `'complete'` (finished strings are the common case). It can be set to `'streaming'` for a live status line.
- **Output length always equals input length** (UTF-16 code units), because every engine edit is a single-unit substitution. Document it: offsets computed on the input stay valid on the output.
- No locale, or a non-English one → the input is returned unchanged.

Prototype results (`locale: 'en'`, `spacing: true`):

| Input                                                          | Output                                                                   |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `Bob's "weekly" brief is ready`                                | `Bob’s “weekly” brief is ready`                                          |
| `with J. R. R. — it's "urgent."\n\n"Second" paragraph's quote` | `with J.\u00a0R.\u00a0R. — it’s “urgent.”\n\n“Second” paragraph’s quote` |
| ``Run `it's` then "go"``                                       | ``Run `it's` then “go”``                                                 |
| `See https://example.com/it's-here or bob's.name@example.com`  | unchanged                                                                |
| `*Not* markdown: "a" _b_ 1. item`                              | `*Not* markdown: “a” _b_ 1. item`                                        |

## API

Named export from `packages/chat-typography/src/index.ts` (root entry; the default export stays the remark plugin):

```ts
export type TypesetTextOptions = Pick<
  ChatTypographyOptions,
  'locale' | 'phase' | 'punctuation' | 'spacing'
>;
export function typesetText(text: string, options?: TypesetTextOptions): string;
```

`skip` is omitted: there are no nodes to skip.

## Steps

1. Implement `typesetText` at the end of `index.ts`, following the design above.
2. `tests/chat-text.test.ts`: the prototype table; length preservation over the whole corpus (`validation/cases.json` inputs as plain strings); no-locale and `fr` passthrough; idempotency over the corpus; CRLF blank lines kept byte-for-byte; `phase: 'streaming'` keeps a trailing lone `"` straight; `punctuation: false` with `spacing: true` changes only spaces.
3. `scripts/check-chat-package.mjs`: smoke-test `typesetText` in `consumer.mjs`, and type-check `TypesetTextOptions` in `consumer.mts`.
4. README: a "Plain strings" section after "Contract".
5. Gate: `npm run check`.

## Done criteria

- `import { typesetText } from '@calebduren/typograph'` works from the packed tarball, with `dependencies` unchanged.
- `npm run check` exits 0.

## Escape hatches

- A corpus input changes length → engine invariant broken; STOP and report.
- Idempotency fails for a plain-string input that passes as Markdown → report; do not special-case it in `typesetText`.
