# Plan 002: Make the hanging helper tolerate hast elements without `properties`

| Field           | Value                                                               |
| --------------- | ------------------------------------------------------------------- |
| Status          | proposed                                                            |
| Written against | commit `cdb2842` plus the uncommitted working tree as of 2026-09-18 |
| Effort          | S (one line of source, one test, one doc sentence)                  |
| Risk of change  | low                                                                 |
| Depends on      | Prerequisite P0 in `plans/README.md`                                |
| Blocks          | nothing                                                             |

## Why this matters

`rehypeHangingPunctuation` writes `node.properties['data-typograph-hanging'] = ''` on every block it decorates. `@types/hast` declares `properties` as required, so TypeScript is silent, but hand-built trees and several rehype producers omit the field. Verified: a `p` element with no `properties` and text `"Hi" there` makes the plugin throw `TypeError: Cannot set properties of undefined`, which aborts the whole rehype run and blanks the message. The core punctuation plugin never throws on malformed input; the helper should match that standard.

## Background the executor needs

- File: `packages/chat-typography/src/hanging.ts` (82 lines). Tests: `tests/chat-hanging.test.ts` (108 lines), which build hast trees with small helpers `element()`, `text()`, `root()`, `content()` defined at the top of the file. Tests import the source directly; no build needed.
- Run: `npx vitest run tests/chat-hanging.test.ts` (10 tests today).
- Style: match the existing terse comments; the file has zero dependencies beyond `./quote-context`.

## Current state

`packages/chat-typography/src/hanging.ts:76-78`:

```ts
first.value = first.value.slice(1);
parent.children.splice(0, 1, quote, ...(first.value ? [first] : []));
node.properties['data-typograph-hanging'] = '';
```

Test helper in `tests/chat-hanging.test.ts:5-12`:

```ts
const element = (tagName: string, children: Element['children']): Element => ({
  type: 'element',
  tagName,
  properties: {},
  children,
});
const text = (value: string): { type: 'text'; value: string } => ({ type: 'text', value });
const root = (...children: RootContent[]): Root => ({ type: 'root', children });
```

## Target state

The attribute write initialises `properties` when absent. Everything else is unchanged.

## Scope boundaries

**In scope:** `packages/chat-typography/src/hanging.ts` (line 78 only), `tests/chat-hanging.test.ts` (one new test), `packages/chat-typography/README.md` (optional one clause), `CHANGELOG.md` (one bullet).

**Out of scope:** the `properties` access on `first`/`parent` (those are read-only and safe), `index.ts`, `hanging.css`, the playground.

## Steps

### Step 0 — Baseline

```bash
cd /Users/caleb/Dev/typograph
grep -n "node.properties\['data-typograph-hanging'\] = '';" packages/chat-typography/src/hanging.ts
npx vitest run tests/chat-hanging.test.ts
```

Expected: one match (line 78); `10 passed`. Otherwise STOP and report drift.

### Step 1 — Source

Replace line 78 with:

```ts
(node.properties ??= {})['data-typograph-hanging'] = '';
```

`??=` is ES2021; the package targets ES2022 via tsup, so no transpile concern.

### Step 2 — Test

Add to the `describe('optional hanging punctuation')` block in `tests/chat-hanging.test.ts`:

```ts
it('decorates an element that was built without properties', () => {
  const paragraph = {
    type: 'element',
    tagName: 'p',
    children: [text('"Hi" there')],
  } as unknown as Element;
  const tree = root(paragraph);
  hanging({ locale: 'en' })(tree);
  expect(paragraph.properties).toEqual({ 'data-typograph-hanging': '' });
  expect(content(tree)).toBe('"Hi" there');
  expect(JSON.stringify(tree).match(/typograph-opening/g)).toHaveLength(1);
});
```

Run it once **before** Step 1 to confirm it throws, then after: `npx vitest run tests/chat-hanging.test.ts` → `11 passed`.

### Step 3 — Docs

- `CHANGELOG.md` → `## Unreleased`: `- Hanging helper no longer throws when a block element has no properties object.`
- Optional, `packages/chat-typography/README.md:78` paragraph: append "Elements without a `properties` object are decorated safely." Skip if it reads awkwardly.

### Step 4 — Gate

```bash
npx vitest run
npx prettier --check .
npx tsc --noEmit
```

Expected: 106 (or 111 if Plan 001 landed first) passing; prettier and tsc clean.

## Done criteria

- `grep -c "node.properties ??= {}" packages/chat-typography/src/hanging.ts` → `1`.
- `npx vitest run tests/chat-hanging.test.ts` → `11 passed`.
- `npx tsc --noEmit` → exit 0.

## Escape hatches

- If TypeScript rejects `??=` on `node.properties` (it should not — `Element.properties` is `Properties`, non-optional, so the compiler may flag the `??=` as unnecessary under some lint rules but not as an error), do **not** cast `node`; instead write `if (!node.properties) node.properties = {};` on the line before and report which form you used.
- If oxlint flags the new line, report the rule name rather than disabling it.

## Maintenance notes

- Any future attribute or class write in this helper must go through the same guard. Consider a tiny `decorate(node)` helper if a second write is ever added.
