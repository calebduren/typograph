# Plan 001: Fix three punctuation-engine defects in `@typograph/chat`

| Field           | Value                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------- |
| Status          | proposed                                                                                    |
| Written against | commit `cdb2842` **plus the uncommitted working tree as of 2026-09-18** (see "Drift check") |
| Effort          | S–M (about 60 lines of code and tests)                                                      |
| Risk of change  | low; every change is guarded by a new regression test and the existing 105-test suite       |
| Depends on      | Prerequisite P0 in `plans/README.md` (`quote-context.ts` must be tracked/committed)         |
| Blocks          | 003 (adds more tests to the same test file; land this first to avoid merge conflicts)       |

## Why this matters

The package's whole promise is "conservative typography that never breaks literal content". Three verified defects undercut that:

1. **One stray backtick silences the rest of a reply.** In `"Press the ` key.\n\n\"Hello,\" she said."`the second paragraph keeps straight quotes, in both`streaming`and`complete`phase. Coding assistants write "the` character" constantly. Root cause: the document-level protection mask extends an unfinished code span to end of file instead of stopping at the paragraph boundary, and that mask is copied into every later paragraph.
2. **A closing quote followed by a footnote reference stays straight.** `Say "hi"[^1].` renders as `Say “hi".` because the placeholder character the engine substitutes for inline literal nodes is not treated as closing context.
3. **The uncommitted elision lookahead regressed primes.** At `HEAD`, `Back in the '90s, a 6' fence was normal.` correctly yields `’90s … 6'`. The working tree yields `‘90s … 6’`: the new lookahead treats the foot mark after `6` as a candidate closing quote. Same for `12'`, `40'`. This must be fixed before the pending work is committed.

All three were reproduced by running the engine directly; the fixes below were prototyped on a scratch copy and pass all 100 engine/hanging/preview unit tests plus the new cases.

## Background the executor needs

- Repo: `/Users/caleb/Dev/typograph`, npm workspaces, Node 22.12+, TypeScript strict, ESM. Prettier (`singleQuote`, `printWidth: 100`, `trailingComma: all`) and oxlint are enforced by `npm run check`.
- The engine is one file: `packages/chat-typography/src/index.ts` (477 lines). Shared regexes live in `packages/chat-typography/src/quote-context.ts` (4 lines). Unit tests are in `tests/chat-typography.test.ts` and import the **source** directly, so no build is needed to run them.
- Run the engine tests: `npx vitest run tests/chat-typography.test.ts`. Run everything: `npx vitest run` (expects 105 passing before you start).
- Code style: small pure functions, terse comments that explain _why_, no external deps beyond `@typehug/en`. Match the existing comment voice (see `index.ts:52-54`).
- The plugin operates in two passes: `protectionMask(source)` marks byte ranges that must not change (URLs, emails, unfinished code spans, unfinished link destinations); `smartPunctuation()` then converts quotes only where `mask[index] === 0`. It is called twice: once per block on the block's visible text, and once on the _whole raw Markdown_ (`index.ts:474`) to produce `sourceMask`, which `protectSourceSyntax` (`index.ts:110-155`) copies into each block's mask when the raw and decoded lengths agree (`index.ts:123-127`).
- Inline nodes that are not prose (inline code, math, footnote references, images, `skip`ped subtrees) are replaced in the joined block text by the single placeholder character `￼` (`index.ts:379`, `:393`). `html` nodes contribute an empty string on purpose so `<b>` wrappers stay transparent. Do not change that.

## Current state (excerpts from the working tree)

`packages/chat-typography/src/index.ts:73-98` — unfinished code-span protection runs to end of string:

```ts
// An unfinished inline code span is plain text until its closing backtick arrives.
for (let index = 0; index < source.length;) {
  if (source[index] !== '`' || mask[index]) {
    index++;
    continue;
  }
  let end = index + 1;
  while (source[end] === '`' && !mask[end]) end++;
  const width = end - index;
  let close = end;
  while (close < source.length) {
    if (source[close] !== '`' || mask[close]) {
      close++;
      continue;
    }
    let next = close + 1;
    while (source[next] === '`' && !mask[next]) next++;
    if (next - close === width) {
      close = next;
      break;
    }
    close = next;
  }
  protect(index, close < source.length ? close : source.length);
  index = close;
}
```

`packages/chat-typography/src/index.ts:34-36` — module constants where a new regex belongs:

```ts
const letter = /[\p{L}\p{M}]/u;
const word = /[\p{L}\p{M}\p{N}]/u;
const digit = /\p{N}/u;
```

`packages/chat-typography/src/quote-context.ts` (whole file):

```ts
// Shared by the text transform and the independent hanging helper.
export const elisions = ['em', 'twas', 'tis', 'cause', 'bout', 'round', 'til', 'n'];
export const openingContext = /[\s([{—–"'“‘]/u;
export const closingContext = /[\s)\]},.!?;:—–"'”’]/u;
```

`packages/chat-typography/src/index.ts:275-292` — the elision lookahead added in the working tree:

```ts
    if (elision) {
      if (!rock) {
        if (nextSingleQuote <= index) {
          nextSingleQuote = index + 1;
          while (nextSingleQuote < source.length) {
            if (!mask[nextSingleQuote] && /['’]/u.test(source[nextSingleQuote])) {
              const preceding = before(source, nextSingleQuote);
              const following = after(source, nextSingleQuote + 1);
              // Contractions and likely plural possessives do not close the phrase.
              if (
                !(letter.test(preceding) && letter.test(following)) &&
                !(preceding.toLowerCase() === 's' && /\s/u.test(following))
              )
                break;
            }
            nextSingleQuote++;
          }
        }
```

Note the explicit prime guard a few lines earlier at `index.ts:243`:

```ts
if (digit.test(prev) && !state.singleOpen) continue; // Feet, minutes, and coordinates.
```

The lookahead defeats this guard by setting `state.singleOpen = true` when it wrongly picks `6'` as the closer.

## Target state

- An unfinished code span protects only up to the next blank line (CommonMark code spans cannot contain a blank line). The last paragraph of a stream can still be unfinished and protected.
- `￼` counts as opening and closing context, so quotes adjacent to inline code, math, images, footnote references, or skipped subtrees resolve.
- A single quote preceded by a digit is never a candidate closer in the elision lookahead.
- Docs stop over-claiming and state the paragraph-boundary rule.

## Scope boundaries

**In scope:** `packages/chat-typography/src/index.ts`, `packages/chat-typography/src/quote-context.ts`, `tests/chat-typography.test.ts`, `packages/chat-typography/README.md` (one sentence), `HARDENING_TEST.md` (one sentence), `CHANGELOG.md` (three bullets).

**Out of scope, do not touch:** `hanging.ts` (Plan 002), `apps/**`, `examples/**`, `validation/cases.json` (Plan 003 extends the corpus), the `](` link-destination heuristic at `index.ts:99-106` (a literal `](` with no later `)` still protects the rest of its block; that is accepted conservatism and is logged in `plans/README.md` as deferred), the `html`-node empty-string behaviour, `before()`/`after()`.

## Steps

Work on a branch. Make one commit per step so each fix bisects cleanly.

### Step 0 — Drift check and baseline

```bash
cd /Users/caleb/Dev/typograph
git status --short packages/chat-typography/src
```

Expected: `quote-context.ts` is **tracked** (no `??` line). If it shows `??`, STOP — Prerequisite P0 in `plans/README.md` has not been done.

```bash
grep -n "let nextSingleQuote = 0" packages/chat-typography/src/index.ts
grep -n "protect(index, close < source.length ? close : source.length)" packages/chat-typography/src/index.ts
npx vitest run
```

Expected: both greps return one line each (approx. 201 and 96); vitest reports `Tests  105 passed`. If either grep returns nothing, the file has drifted — STOP and report.

### Step 1 — Limit unfinished code spans to the paragraph

1. After `const digit = /\p{N}/u;` add:

   ```ts
   // A code span cannot contain a blank line, so an unfinished span ends at the paragraph.
   const blankLine = /\n[ \t]*\n/g;
   ```

2. Replace the `let close = end;` … `index = close;` section shown above with:

   ```ts
   blankLine.lastIndex = end;
   const limit = blankLine.exec(source)?.index ?? source.length;
   let close = end;
   let closed = false;
   while (close < limit) {
     if (source[close] !== '`' || mask[close]) {
       close++;
       continue;
     }
     let next = close + 1;
     while (source[next] === '`' && !mask[next]) next++;
     if (next - close === width) {
       close = next;
       closed = true;
       break;
     }
     close = next;
   }
   protect(index, closed ? close : limit);
   index = closed ? close : limit;
   ```

   Keep the existing comment above the loop. `blankLine` is module-level with the `g` flag; always set `lastIndex` before `exec` as shown.

3. Add this test inside the top-level `describe` in `tests/chat-typography.test.ts` (place it after the existing `'holds unfinished inline code and link destinations intact'` test at about line 110). Follow the file's `render()` helper exactly as used there:

   ````ts
   it('limits an unfinished code span to its own paragraph', () => {
     for (const phase of ['streaming', 'complete'] as const) {
       expect(render('Press the ` key.\n\n"Hello," she said.', { locale: 'en', phase }).text).toBe(
         'Press the ` key.\n\n“Hello,” she said.',
       );
     }
     expect(render('Type ``` to start.\n\n"Hello," she said.', { locale: 'en' }).text).toBe(
       'Type ``` to start.\n\n“Hello,” she said.',
     );
     // The final paragraph of a stream can still be unfinished.
     expect(render('Say "hello". `const x = "hi"', { locale: 'en' }).text).toBe(
       'Say “hello”. `const x = "hi"',
     );
   });
   ````

4. Verify: `npx vitest run tests/chat-typography.test.ts` → all pass (89 tests). Before your source change this new test must fail on the first assertion; confirm that by running it once before editing `index.ts` if you want proof of coverage.

### Step 2 — Treat the literal placeholder as quote context

1. In `quote-context.ts` change both regexes:

   ```ts
   export const openingContext = /[\s([{—–"'“‘￼]/u;
   export const closingContext = /[\s)\]},.!?;:—–"'”’￼]/u;
   ```

   Add above them: `// ￼ stands in for inline code, math, images, footnotes, and skipped nodes.`

2. Add a test (uses the GFM footnote syntax already enabled by `remarkGfm` in `render()`):

   ```ts
   it('closes a quotation that ends at an inline literal', () => {
     expect(render('Say "hi"[^1].\n\n[^1]: "Note" here.', { locale: 'en' }).text).toBe(
       'Say “hi”.\n\n“Note” here.',
     );
     expect(render('"Keep `x`." Next', { locale: 'en' }).text).toBe('“Keep x.” Next');
   });
   ```

   If the second assertion fails only because the existing behaviour already produced the expected string, keep it anyway — it pins the invariant.

3. Verify: `npx vitest run` → all pass. Also re-run `npx vitest run tests/chat-hanging.test.ts` explicitly: `hanging.ts` imports `elisions` from the same module and must be unaffected (10 passed).

### Step 3 — Keep primes out of the elision lookahead

1. In the lookahead candidate filter (excerpt above), extend the condition:

   ```ts
   // Contractions, likely plural possessives, and primes after a
   // number (a 6' fence) do not close the phrase.
   if (
     !(letter.test(preceding) && letter.test(following)) &&
     !(preceding.toLowerCase() === 's' && /\s/u.test(following)) &&
     !digit.test(preceding)
   )
     break;
   ```

2. Add a table test next to the existing `'keeps a deliberate interpretation of the stream prefix'` test:

   ```ts
   it.each([
     ["Back in the '90s, a 6' fence was normal.", "Back in the ’90s, a 6' fence was normal."],
     ["It's 'bout 12' wide.", "It’s ’bout 12' wide."],
     ["Wait 'til the 40' mark.", "Wait ’til the 40' mark."],
   ])('keeps a prime after a number out of the elision lookahead: %s', (input, expected) => {
     for (const phase of ['streaming', 'complete'] as const) {
       expect(render(input, { locale: 'en', phase }).text).toBe(expected);
     }
   });
   ```

3. Verify: `npx vitest run` → all pass. The existing `'Round the reader's desk.'` → `‘Round the reader’s desk.’` expectations at lines 117 and 155 must still pass; they prove the lookahead still works when the closer is legitimate.

### Step 4 — Docs

1. `packages/chat-typography/README.md:66`: change "Bare URLs, email addresses, and unfinished backtick spans receive conservative protection." to "Bare URLs, email addresses, and unfinished backtick spans receive conservative protection; an unfinished span is protected only up to the next blank line."
2. `HARDENING_TEST.md:62`: after "…cannot suppress typography in later prose." append " An unfinished backtick span ends at the paragraph boundary, so a stray backtick in one paragraph no longer affects the next."
3. `CHANGELOG.md` under `## Unreleased`, add:
   - `- Limit unfinished inline-code protection to the current paragraph.`
   - `- Treat inline code, math, images, footnote references, and skipped nodes as quote boundaries.`
   - `- Keep a prime after a number (6') out of the elision quote lookahead.`
4. Verify: `npx prettier --check .` → clean.

### Step 5 — Full gate

```bash
npm run check
```

Expected: exits 0. Includes build, typecheck, 110 unit tests, packed-package consumer check, prettier, oxlint. Requires network for the consumer install (see Plan 006 note).

## Test plan

New tests: three blocks in `tests/chat-typography.test.ts` (Steps 1–3), modelled on the existing `it.each` tables at lines 112–131 and 148–158. Step 3's table has three rows, so total engine tests go from 88 to 93; whole suite from 105 to 110. No Playwright changes are needed; `npm run test:landing` is optional but should stay green because the landing example text contains no stray backticks.

## Done criteria

- `npx vitest run` → `Tests  110 passed`.
- `git diff --stat` touches only the six files listed in scope.
- `grep -c '\\ufffc' packages/chat-typography/src/quote-context.ts` → `2`.
- `grep -c 'blankLine' packages/chat-typography/src/index.ts` → `3` (declaration, `lastIndex`, `exec`).
- `npm run check` → exit 0.
- Manual probe (optional): `node -e` is not needed; the three new tests are the probe.

## Escape hatches — STOP and report instead of improvising if

- Step 0 greps fail or the suite is not at 105 passing before you start.
- Any _existing_ test changes expectation after your edit. Do not edit an existing expectation to make it pass; the fix is wrong.
- The Step 2 regex change makes any `tests/chat-hanging.test.ts` case fail.
- `npm run check` fails inside `check:package` for network reasons — report it as environmental, not as a plan failure.

## Maintenance notes

- Anything that adds new placeholder characters or changes `￼` handling in `formatInline` must update `quote-context.ts` in step.
- `blankLine` deliberately allows spaces/tabs on the blank line, matching CommonMark. A future "protect unfinished fenced code" rule should reuse the same limit.
- The `Wait 'til Marx' turn.` case (elision followed by a singular possessive ending in `x`) is still resolved as a quotation by the lookahead. It is ambiguous; leave it, but do not add a test asserting either output.
