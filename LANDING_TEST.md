# Landing page verification

17 September 2026. The site demonstrates the English-only chat package described in [the landing-page brief](LANDING_PAGE_BRIEF.md). The package is private and unpublished; nothing was deployed.

## Current repository

The workspace has three packages: the typography utility, its React/Vite landing page, and the Vercel/Cloudflare compatibility fixture. The site mounts directly from `apps/playground/src/main.tsx`. The superseded toolkit, specimen route, duplicate stylesheet, generated downloads, portable skill, and exploratory comparison runners have been removed. Development and production builds use only the current chat package.

The [README](README.md), [contributing guide](CONTRIBUTING.md), and [release guide](docs/releasing.md) describe the remaining commands. Editorial fixtures and the engine measurements remain in `validation`; package and performance scripts remain in `scripts`.

## Checks after cleanup

- `npm run check` passed: package and both app builds, both TypeScript projects, **80 unit/renderer tests**, and packed-package installation in a fresh consumer.
- Type checking also passed after narrowing the root project to the remaining sources. Root tree-type versions match the package to avoid duplicate incompatible declarations.
- **All 17 landing-page Chrome checks passed** across the full run and a focused rerun. Two stale headline assertions were updated to the existing “Nicer typography” copy; the other 15 checks passed in the initial run.
- **All 11 SDK integration Chrome checks passed**, covering Vercel HTTP and Cloudflare Worker/WebSocket streaming, settings changes, literal content, clipboard copying, stop/regenerate, error/history, and reconnect.
- Desktop, mobile, and dark-mode captures were visually inspected.
- Local Markdown links and `git diff --check` passed. The production site contains no obsolete package downloads or specimen bundle.

Builds still report upstream bundler annotation and fixture chunk-size warnings. The fixture intentionally includes upstream code, math, and diagram renderers; its size is not the utility's size.

## Behavior covered

The comparison uses the same Streamdown renderer and source on both sides. Text and Conversation share one substantial example. The left pane defaults to rendered text and exposes an editable Markdown tab; editing cancels replay and retains the source across view changes. Remote Markdown images render descriptions without making requests.

Both columns and the growing editor use one native vertical scroll container. Mobile selects Original or With Typograph in that same reading area. There is no JavaScript scroll synchronization. Tests verify viewport fit, sticky controls, mobile reflow, enlarged text, endpoint-aware fades, and code blocks that do not introduce another vertical scrollbar.

The three global switches control the preview and generated setup instructions. Show changes controls only annotation paint and rulers. Tests compare glyph positions, scroll position, and viewport geometry before and after toggling it, and verify highlight layers sit beneath neighboring text. Hanging geometry and conditional rulers are checked at multiple widths and during streaming.

Other checks cover replay/pause/scrub/resume, scripted thinking, empty and custom input, literal code/table/link content, native selection copying, keyboard access, all eight refinement combinations, exact prompt/code clipboard contents, and the manual-copy fallback.

The landing page uses plain CSS targeting semantic elements and Streamdown data attributes. The compatibility fixture uses Tailwind with its shadcn components. Streamdown's emitted utility class names are not the landing page's styling contract.

## Performance observation

The cleanup run included the existing Chrome probe with simulated 6× CPU throttling: 9,172 ms of task time over the recorded replay, with no tasks reaching the probe's long-task threshold. It rendered the 3,086-character example twice, with spacing and highlights off. This is one local observation, not physical-device profiling or a production performance guarantee. Engine-only measurements are recorded separately in [the hardening report](HARDENING_TEST.md).

## Remaining release evaluation

Physical-device profiling, a screen-reader session, broader browser/zoom coverage, hydration, editorial review with anonymized model replies, and blind reading comparisons remain. Local Chrome checks do not establish those results. Public package installation, a shadcn registry recipe, and deployment are separate release work.
