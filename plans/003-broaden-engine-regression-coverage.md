# Plan 003: Broaden engine regression coverage to the shipped default and untested node types

| Field           | Value                                                                              |
| --------------- | ---------------------------------------------------------------------------------- |
| Status          | proposed                                                                           |
| Written against | commit `cdb2842` plus the uncommitted working tree as of 2026-09-18                |
| Effort          | M (tests only, about 120 lines)                                                    |
| Risk of change  | low — no source changes; a failing new test means a real finding, not a plan error |
| Depends on      | Plan 001 (same test file; land 001 first to avoid conflicts). Prerequisite P0.     |
| Blocks          | nothing; strongly recommended before any further engine work                       |

## Why this matters

The 46-case editorial corpus in `validation/cases.json` is the project's stated contract, but it runs in exactly one configuration: `phase: 'complete', spacing: true`. The shipped default (`phase` streaming, `spacing` off) is what every recipe on the landing page emits, and it is covered only by about ten hand-written prefix assertions. Several engine branches have zero tests: `heading`, `break`, `html` inline nodes, list and blockquote children, block-level `skip`, and four of the five `spacing` sub-switches. The Worker redirect's port and protocol normalisation is also untested even though the Playwright suite now runs the Worker on a non-standard port.

Gaps were confirmed by reading `tests/chat-typography.test.ts` and `tests/worker.test.ts` line by line and by running the corpus in the other configurations (results below).

## Background the executor needs

- Engine tests: `tests/chat-typography.test.ts`. Its `render(input, options)` helper (lines 22–54) parses with `remark-parse` + `remark-math` + `remark-gfm`, runs the plugin with the original text as the VFile value, and returns `{ text, links, html, originalLinks, originalHtml, tree }`. `text` joins root-level blocks with `\n\n` and inline content with nothing, and renders `break` as `\n`.
- Corpus loader at lines 12–20; the existing corpus test at lines 56–66.
- Worker tests: `tests/worker.test.ts` (37 lines), using `vi.fn()` for the `ASSETS` binding.
- Run: `npx vitest run` (105 passing before Plan 001; 108 after).
- Verified corpus behaviour under other configurations (working tree engine):
  - `{ locale, spacing: false }` (streaming default): all 46 outputs equal `expected` **after replacing every ` ` in `expected` with a normal space**. The only differing cases are the six that contain a no-break space (`units`, `initial`, `figure`, `bold-cross-unit`, `bold-cross-name`, `citation-link`).
  - `{ locale, spacing: true }` (streaming with spacing): 45 of 46 match; `citation-link` differs because a join inside a link label at the stream edge is deliberately withheld while streaming.
- Verified outputs for the new node-type cases (working tree engine, via `render()` semantics):
  - `## "A little room"` → `“A little room”`
  - `Say "hi"  \nthen "bye"` (two trailing spaces = hard break) → `Say “hi”\nthen “bye”`
  - `Say "hi" <b>bold</b> "bye"` → `Say “hi” bold “bye”`, with `html` values unchanged
  - `> "Quoted."\n\n- "Item one"\n- It's fine` → text contains `“Quoted.”`, `“Item one”`, `It’s fine`

## Current state (excerpts)

`tests/chat-typography.test.ts:56-66`:

```ts
describe('chat typography candidate', () => {
  it.each(cases)('$id', (fixture) => {
    const result = render(fixture.input, {
      locale: fixture.locale ?? 'en',
      phase: 'complete',
      spacing: true,
    });
    expect(result.text).toBe(fixture.expected);
    expect(result.links).toEqual(result.originalLinks);
    expect(result.html).toEqual(result.originalHtml);
  });
```

`tests/chat-typography.test.ts:243-249` — the only `skip` test, which skips an inline node, never a block:

```ts
it('lets applications preserve a subtree without losing surrounding quote context', () => {
  const result = render('"Keep **straight \'quotes\'** here."', {
    locale: 'en',
    skip: (node) => node.type === 'strong',
  });
  expect(result.text).toBe("“Keep straight 'quotes' here.”");
});
```

`packages/chat-typography/src/index.ts:331-340` — spacing sub-rules, note the inverted default on `shortWords`:

```ts
const rules = typeof spacing === 'object' ? spacing : {};
const result = analyze(source, {
  rules: {
    units: rules.units !== false,
    initials: rules.initials !== false,
    abbreviations: rules.abbreviations !== false,
    shortWords: rules.shortWords === true,
    lastWords: settings.phase === 'complete' && rules.lastWords === true,
  },
});
```

`worker/index.ts:9-14`:

```ts
if (url.hostname === 'typograph.ing') {
  url.hostname = 'typograph.dev';
  url.protocol = 'https:';
  url.port = '';
  return Response.redirect(url.toString(), 308);
}
```

## Target state

Every corpus case is also asserted under the shipped default; each untested node type and option has at least one assertion; the Worker's three URL mutations are each covered.

## Scope boundaries

**In scope:** `tests/chat-typography.test.ts`, `tests/worker.test.ts`. Optionally `CONTRIBUTING.md` (one sentence noting the corpus now runs in two configurations).

**Out of scope, do not touch:** any file under `packages/`, `worker/`, `apps/`, `examples/`; `validation/cases.json` (do not add or edit cases in this plan; if you find a case whose _expected_ string looks wrong, report it). Do not weaken or delete any existing assertion.

## Steps

### Step 0 — Baseline

```bash
cd /Users/caleb/Dev/typograph
npx vitest run
grep -c "it.each(cases)" tests/chat-typography.test.ts
```

Expected: all tests pass; grep → `1`.

### Step 1 — Corpus under the shipped default

Directly after the existing `it.each(cases)` block add:

```ts
it.each(cases)('$id under the default streaming preset', (fixture) => {
  const result = render(fixture.input, { locale: fixture.locale ?? 'en' });
  expect(result.text).toBe(fixture.expected.replaceAll(' ', ' '));
  expect(result.links).toEqual(result.originalLinks);
  expect(result.html).toEqual(result.originalHtml);
});
```

Verify: `npx vitest run tests/chat-typography.test.ts` → 46 new passing tests. If any case fails, STOP: that is a genuine streaming-vs-complete divergence in the corpus; report the case id and both strings.

### Step 2 — Node types the engine dispatches on

Add one test:

```ts
it('formats headings, hard breaks, list items, and blockquotes, and passes raw HTML through', () => {
  expect(render('## "A little room"', { locale: 'en' }).text).toBe('“A little room”');
  expect(render('Say "hi"  \nthen "bye"', { locale: 'en' }).text).toBe('Say “hi”\nthen “bye”');
  const html = render('Say "hi" <b>bold</b> "bye"', { locale: 'en' });
  expect(html.text).toBe('Say “hi” bold “bye”');
  expect(html.html).toEqual(['<b>', '</b>']);
  const blocks = render('> "Quoted."\n\n- "Item one"\n- It\'s fine', { locale: 'en' }).text;
  expect(blocks).toContain('“Quoted.”');
  expect(blocks).toContain('“Item one”');
  expect(blocks).toContain('It’s fine');
});
```

If `html.html` comes back with different tokenisation (for example `['<b>', '</b>']` vs one string), adjust that single expectation to what `originalHtml` reports — the invariant being tested is that `html` equals `originalHtml`, which the corpus test already asserts. Prefer asserting `expect(html.html).toEqual(html.originalHtml)` if in doubt.

### Step 3 — Block-level `skip`

```ts
it('skips a whole block when the predicate matches it', () => {
  const result = render('> "Quoted."\n\n"Prose."', {
    locale: 'en',
    skip: (node) => node.type === 'blockquote',
  });
  expect(result.text).toBe('"Quoted."\n\n“Prose.”');
});
```

### Step 4 — Spacing sub-rules

Typehug decides which rule a pair belongs to, so first probe which sentence each rule affects. Write the probe as a temporary `it.only` inside `tests/chat-typography.test.ts`, run `npx vitest run tests/chat-typography.test.ts`, read the console output, then replace it with the real test. Probe body:

```ts
it.only('probe', () => {
  for (const rule of ['units', 'initials', 'abbreviations'] as const) {
    const off = { locale: 'en', spacing: { [rule]: false } };
    console.log(
      rule,
      JSON.stringify(render('Wait 30 min. Dr. Smith and J. R. Park saw Fig. 2.', off).text),
    );
  }
  console.log(
    'shortWords',
    JSON.stringify(
      render('It is a test of the rule.', { locale: 'en', spacing: { shortWords: true } }).text,
    ),
  );
  console.log(
    'default',
    JSON.stringify(render('It is a test of the rule.', { locale: 'en', spacing: true }).text),
  );
});
```

Then write the real test so that, for each of `units`, `initials`, `abbreviations`, disabling that rule removes **exactly** the join the probe showed it owns while the others remain, and so that `shortWords: true` adds at least one ` ` that `spacing: true` alone does not. Use `toContain` / `not.toContain` on specific pairs (for example `'30 min'`). Remove the `it.only` probe before committing. The whole file must have no `.only` left: `grep -c "\.only(" tests/chat-typography.test.ts` → `0`.

### Step 5 — Worker URL normalisation

Add to `tests/worker.test.ts`:

```ts
it('normalises protocol and port when redirecting the secondary domain', async () => {
  const assets = { fetch: vi.fn<(request: Request) => Promise<Response>>() };
  const response = await worker.fetch(new Request('http://typograph.ing:8080/a/b?c=1#frag'), {
    ASSETS: assets,
  });
  expect(response.status).toBe(308);
  expect(response.headers.get('location')).toBe('https://typograph.dev/a/b?c=1');
  expect(assets.fetch).not.toHaveBeenCalled();
});

it('leaves other hostnames, including subdomains, to the asset binding', async () => {
  const assets = {
    fetch: vi.fn<(request: Request) => Promise<Response>>(async () => new Response('asset')),
  };
  for (const url of [
    'https://www.typograph.ing/',
    'http://127.0.0.1:4174/',
    'https://typograph.dev/',
  ]) {
    const request = new Request(url);
    await worker.fetch(request, { ASSETS: assets });
    expect(assets.fetch).toHaveBeenLastCalledWith(request);
  }
});
```

Note: the fragment is dropped by `new Request()`; the first test's expected `location` therefore has no `#frag`. If `Response.redirect` in the Node version rejects the URL, report the error rather than changing the Worker.

Verify: `npx vitest run tests/worker.test.ts` → `5 passed`.

### Step 6 — Docs and gate

- `CONTRIBUTING.md`, in the "Check changes" section after "Editorial examples live in `validation/cases.json`; tests live in `tests/chat-*.test.*`.", add: "The corpus runs both as `phase: 'complete', spacing: true` and under the default streaming preset."
- `npx prettier --check .` and `npx oxlint --deny-warnings .` → clean.
- `npx vitest run` → all pass. Expected total: 105 + 5 (Plan 001) + 1 (Plan 002) + 46 + 1 + 1 + 1 + 2 = 162, give or take the sub-rule test count.

## Done criteria

- `grep -c "it.each(cases)" tests/chat-typography.test.ts` → `2`.
- `grep -c "\.only(" tests/*.ts tests/*.tsx` → `0`.
- `npx vitest run tests/worker.test.ts` → `5 passed`.
- No file outside `tests/` and `CONTRIBUTING.md` changed: `git diff --stat -- . ':!tests' ':!CONTRIBUTING.md'` is empty.

## Escape hatches

- Any new corpus assertion in Step 1 fails → STOP and report the case id; do not normalise further or edit the corpus.
- The block-`skip` test fails → STOP; that is an engine bug worth its own plan.
- A spacing sub-rule cannot be isolated because Typehug assigns the pair to a different rule than expected → pick a different sentence; do not touch the engine. If no sentence isolates a rule after two tries, assert only that the rule _can_ be disabled without throwing and note it in the test name.

## Maintenance notes

- When a corpus case legitimately differs between streaming and complete, add an optional `expectedStreaming` field to that case in `validation/cases.json` and teach the Step 1 test to prefer it. Do not do this pre-emptively.
- Keep the `replaceAll(' ', ' ')` normalisation; it encodes the contract that spacing off never changes whitespace.
