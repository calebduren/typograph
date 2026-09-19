# Plan 004: Three small landing-page correctness fixes

| Field           | Value                                                               |
| --------------- | ------------------------------------------------------------------- |
| Status          | proposed                                                            |
| Written against | commit `cdb2842` plus the uncommitted working tree as of 2026-09-18 |
| Effort          | S (about 6 lines)                                                   |
| Risk of change  | low; Playwright suite covers the touched component                  |
| Depends on      | nothing (independent of 001–003)                                    |
| Blocks          | nothing                                                             |

## Why this matters

1. **Two `aria-label`s are on plain `<div>`s.** ARIA prohibits naming an element with the generic role; browsers drop the label, so the formatted pane's name "Response with Typograph" never reaches a screen reader, and the legend's "Highlight key" is likewise dead. The enclosing `role="region"` wrappers ("Original example" / "Formatted example") _are_ exposed and already distinguish the panes. The pending release checklist lists a screen-reader session; this is a cheap fix to land first.
2. **Copy drift.** When the Hanging punctuation switch is on, the control caption says the helper applies to "paragraphs and headings", but the helper now also handles list items and the scope sentence was updated in `main.tsx`, the agent prompt, the integration guide, and the package README. The one sentence the visitor sees on toggling is the stale one.
3. **An untyped state.** `useState('formatted')` infers `string`, so the two `aria-pressed` comparisons and the `data-view` attribute are unchecked against the `'original' | 'formatted'` union used by the CSS. Every other view state in the component is typed.

## Background the executor needs

- File: `apps/playground/src/ChatComparison.tsx` (460 lines). React 19, plain CSS, no Tailwind. Style: explicit union types on `useState` (see `sourceView` at line 118 and `mode` at line 125).
- Design constraints from `DESIGN.md` / `LANDING_PAGE_BRIEF.md`: no visual changes are wanted here; these are attribute and text fixes only.
- Verification: `npx tsc --noEmit` (root config includes `apps/`), `npm run test:landing` (builds, then runs 19 Playwright checks through the local Wrangler Worker on port 4174; needs Chrome on macOS or `npx playwright install --with-deps chromium` on Linux). No Playwright test references the two labels or the caption text being changed (verified by grep).

## Current state (excerpts)

`apps/playground/src/ChatComparison.tsx:124`:

```tsx
const [mobileView, setMobileView] = useState('formatted');
```

`apps/playground/src/ChatComparison.tsx:189-192`:

```tsx
<p>
  Your selection updates the preview, code, and agent prompts below.
  {settings.hanging && ' Hanging applies to opening quotes in paragraphs and headings.'}
</p>
```

`apps/playground/src/ChatComparison.tsx:342-347`:

```tsx
              <div
                className="reading response-reading"
                data-testid="formatted-response"
                aria-label="Response with Typograph"
                data-rulers={rulers}
              >
```

`apps/playground/src/ChatComparison.tsx:368-369`:

```tsx
        <div className="comparison-legend" aria-hidden={!highlight} data-visible={highlight}>
          <div className="change-key" aria-label="Highlight key">
```

The corrected wording already in use at `apps/playground/src/main.tsx:268`:

```tsx
                  ? 'Opening quotes sit just outside the first line of paragraphs, headings, and list items. …'
```

## Target state

- No `aria-label` on a role-less element in this component.
- Caption reads "Hanging applies to opening quotes in paragraphs, headings, and list items."
- `mobileView` is typed `'original' | 'formatted'`.

## Scope boundaries

**In scope:** `apps/playground/src/ChatComparison.tsx` only, plus `LANDING_PAGE_BRIEF.md` if it still says "paragraphs and headings" for the hanging helper (check with grep; update only the live brief, not the historical `HARDENING_TEST.md`/`LANDING_TEST.md` reports).

**Out of scope, do not touch:** `landing.css` (the `.change-key` selector and layout stay), the `title` tooltip on the measure control (a design decision), `Toggle.tsx`, any test file, the `role="region"` wrappers.

## Steps

### Step 0 — Baseline

```bash
cd /Users/caleb/Dev/typograph
grep -n 'aria-label="Response with Typograph"\|aria-label="Highlight key"\|paragraphs and headings\|useState('"'"'formatted'"'"')' apps/playground/src/ChatComparison.tsx
```

Expected: four lines (124, 191, 345, 369 or close). Otherwise STOP and report drift.

### Step 1 — Edits

1. Line 124: `const [mobileView, setMobileView] = useState<'original' | 'formatted'>('formatted');`
2. Line 191: replace the string with `' Hanging applies to opening quotes in paragraphs, headings, and list items.'`
3. Line 345: delete the `aria-label="Response with Typograph"` line.
4. Line 369: change to `<div className="change-key">`.
5. `grep -rn "paragraphs and headings" --include=*.md --include=*.ts --include=*.tsx . | grep -v node_modules | grep -v HARDENING_TEST | grep -v LANDING_TEST` — if `LANDING_PAGE_BRIEF.md` or any other live doc still describes the hanging helper this way, update that sentence to include list items.

### Step 2 — Verify

```bash
npx tsc --noEmit
npx prettier --check apps/playground/src/ChatComparison.tsx
npx oxlint --deny-warnings apps/playground/src
npm run test:landing
```

Expected: tsc, prettier, oxlint clean; Playwright `19 passed`.

## Done criteria

- `grep -c 'aria-label' apps/playground/src/ChatComparison.tsx` → `10` (was 12: the remaining ones are on the four `role="group"` controls, the three `role="region"` wrappers, the textarea, and the two range inputs).
- `grep -c "useState<'original' | 'formatted'>" apps/playground/src/ChatComparison.tsx` → `1`.
- `grep -c "paragraphs, headings, and list items" apps/playground/src/ChatComparison.tsx` → `1`.
- `npm run test:landing` → 19 passed.

## Escape hatches

- If `npm run test:landing` fails on a test unrelated to these lines (for example a timeout starting Wrangler), re-run once; if it fails the same way, report it as environmental and note that Plan 006 adds a longer `webServer` timeout.
- If removing the label breaks a test you did not find with grep, STOP and report the test name; do not reinstate the label on a `<div>`.

## Maintenance notes

- The hanging-scope sentence exists in five places (`ChatComparison.tsx`, `main.tsx`, `agent-prompts.ts`, `public/integration.md`, package README). A future change should export one constant from `integration-settings.ts` for the UI and prompt copies; that refactor is intentionally not part of this plan.
