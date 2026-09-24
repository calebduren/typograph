# Plan 008: Idempotency across the corpus and serialized output

| Field           | Value                                                               |
| --------------- | ------------------------------------------------------------------- |
| Status          | not started                                                         |
| Written against | commit `504cc20` plus the uncommitted landing-page work, 2026-09-23 |
| Effort          | S (one new test file, one devDependency, one README sentence)       |
| Risk of change  | low; tests and docs only, no engine change                          |
| Depends on      | —                                                                   |
| Blocks          | 009 (its `markdown` target re-points the reparse test written here) |
| Source brief    | [007](007-static-artifact-typography.md), milestone M1              |

## Why this matters

Static artifacts get reprocessed: drafts are re-rendered, templates interpolate already-typeset fragments, mail is forwarded. Running Typograph on its own output must change nothing. Today that is tested for two inputs only. This plan extends it to the full corpus, both phases, both spacing profiles, already-typeset input, and the serialize → reparse path, and records one known loss that justifies plan 009's source-splice design.

## Background the executor needs

- Repo: `/Users/caleb/Dev/typograph`, npm workspaces, Node 22.12+, TypeScript strict, ESM. Prettier (`singleQuote`, `printWidth: 100`, `trailingComma: all`) and oxlint are enforced by `npm run check`.
- Engine: `packages/chat-typography/src/index.ts`. Tests import the **source**, so no build is needed.
- Corpus: `validation/cases.json`, 46 cases (`{ id, input, expected, locale? }`). The existing harness in `tests/chat-typography.test.ts:22-54` parses with `remark-parse` + `remark-math` + `remark-gfm`; reuse that exact plugin stack.
- Existing idempotency tests: `tests/chat-typography.test.ts:214` (one parsed tree, run twice) and `:285` (curly contractions nested in single quotes).
- Write a **new file** `tests/chat-idempotency.test.ts` rather than editing `chat-typography.test.ts`, so this plan does not conflict with plans 001 and 003, which edit that file.

## Findings from a prototype (2026-09-23, working tree)

Prototyped in a throwaway test file against the working tree:

1. **Tree-level idempotency holds** for all 46 cases × `phase` {`complete`, `streaming`} × spacing {`true`, `{ shortWords: true, lastWords: true }`}: running the plugin a second time on the same tree leaves `JSON.stringify(tree)` unchanged.
2. **Serialize → reparse loses escapes in exactly two cases:** `escaped-quote` and `escaped-after-entity`, in every phase/spacing combination. `remark-stringify` writes `\"` back as a bare `"` (the escape is not syntactically required), so the second pass curls a quote the author deliberately kept straight: `Say \"hello\".` → `Say “hello”.`. Every other case gives identical visible text after reparse.
3. **Already-typeset input is stable.** Expected outputs (`phase: 'complete'`, `spacing: true`), each unchanged by a second run:

| Input                                         | Output                                        |
| --------------------------------------------- | --------------------------------------------- |
| `“Hello,” she said. "Goodbye," he replied.`   | `“Hello,” she said. “Goodbye,” he replied.`   |
| `It’s 30\u00a0min and it's "fine."`           | `It’s 30\u00a0min and it’s “fine.”`           |
| `‘Quoted’ and 'quoted' with Bob’s and Bob's.` | `‘Quoted’ and ‘quoted’ with Bob’s and Bob’s.` |
| `J.\u00a0R. R. Tolkien wrote "it."`           | `J.\u00a0R.\u00a0R. Tolkien wrote “it.”`      |

(`\u00a0` is U+00A0; write it as the escape in test source.)

## Scope boundaries

- No engine changes. If any assertion other than the two known stringify losses fails, STOP (see escape hatches).
- Do not edit `validation/cases.json` or `tests/chat-typography.test.ts`.

## Steps

### Step 0 — Drift check and baseline

- `npx vitest run` → **114 passed** (5 files). If different, record the new baseline and continue only if nothing is failing.
- `python3 -c "import json;print(len(json.load(open('validation/cases.json'))))"` → `46`.
- `grep -n "is idempotent" tests/chat-typography.test.ts` → two matches (around lines 214 and 285).

### Step 1 — Declare `remark-stringify`

It is installed transitively (11.0.0 via `remark-gfm`) but not declared. Add `"remark-stringify": "^11.0.0"` to the root `package.json` `devDependencies` (alphabetical), then `npm install`. Do not add it to the published package.

### Step 2 — `tests/chat-idempotency.test.ts`

Structure (four blocks; test counts in brackets):

1. **Tree-level matrix** [4]: `it.each` over the four `{ phase, spacing }` combinations. Each test loops over all cases, runs the processor twice on one parsed tree (as `chat-typography.test.ts:214` does), collects the ids whose tree JSON changed, and asserts the list is `[]`. Collecting ids and asserting once gives a useful failure message instead of 184 separate tests.
2. **Serialize → reparse matrix** [4]: same combinations. For each case: parse, run, stringify with `unified().use(remarkMath).use(remarkGfm).use(remarkStringify)`, parse and run the result again, then compare visible text (reuse the `visible` helper shape from `chat-typography.test.ts:40-44`). Assert that the set of differing ids equals exactly `['escaped-after-entity', 'escaped-quote']`, sorted.
3. **Known stringify loss, pinned** [2]: `it.each(['escaped-quote', 'escaped-after-entity'])` asserting the reparsed text _does_ contain a curly quote the first pass did not. Comment: "remark-stringify drops the `\\\"` escape; the static `markdown` target splices into source instead (plan 009)." If a future `remark-stringify` keeps escapes, this test fails and block 2's exception list should shrink.
4. **Already-typeset input** [4]: `it.each` over the table above, asserting the exact output and that a second run returns it unchanged.

Expected: 14 new tests.

### Step 3 — README guarantee

In `packages/chat-typography/README.md`, "Contract" section, append to the paragraph that begins "The core plugin's edits are length-preserving…":

> Running the plugin twice on the same parsed tree leaves it unchanged, and so does running it on text that already contains curly quotes and nonbreaking spaces. Serializing the tree back to Markdown can drop escapes, so a reparsed result is not covered by this guarantee.

Do not mention `remark-stringify` in the README; plan 009 documents serialization for the static entry.

### Step 4 — Gate

`npx vitest run` → **128 passed**. Then `npx tsc --noEmit`, `npx oxlint --deny-warnings .`, `npx prettier --check .`.

## Done criteria

- `tests/chat-idempotency.test.ts` exists with 14 tests; `npx vitest run` → 128 passed.
- `git diff --stat` touches only `package.json`, `package-lock.json`, `tests/chat-idempotency.test.ts`, `packages/chat-typography/README.md`.
- `grep -c "\.only(" tests/*.ts tests/*.tsx` → `0`.

## Escape hatches — STOP and report instead of improvising if

- Any tree-level test (block 1) fails → engine idempotency bug; report the case id and config. Do not fix it in this plan.
- Block 2 differs from exactly the two known ids → report the extra or missing ids with before/after text.
- A fixture in block 4 produces different output than the table → report it; do not update the table to match without confirming the new output is correct typography.

## Maintenance notes

- When a corpus case is added, blocks 1 and 2 cover it automatically. If it contains a backslash escape, expect it to join block 2's exception list.
- When plan 009 lands, it adds a parallel reparse test through `typeset({ target: 'markdown' })`, where the exception list must be empty.
