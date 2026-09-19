# Landing page verification

17 September 2026. The site demonstrates the English-only chat package described in [the landing-page brief](LANDING_PAGE_BRIEF.md). The package is private and unpublished; nothing was deployed.

## Current repository

The workspace has three packages: the typography utility, its React/Vite landing page, and the Vercel/Cloudflare compatibility fixture. The site mounts directly from `apps/playground/src/main.tsx`. The superseded toolkit, specimen route, duplicate stylesheet, generated downloads, portable skill, and exploratory comparison runners have been removed. Development and production builds use only the current chat package.

The [README](README.md), [contributing guide](CONTRIBUTING.md), and [release guide](docs/releasing.md) describe the remaining commands. Editorial fixtures and the engine measurements remain in `validation`; package and performance scripts remain in `scripts`.

## Checks after the audit fixes

- `npm run check` passed: package and both app builds, both TypeScript projects, **105 unit/renderer tests**, and packed-package installation in a fresh consumer.
- Local verification used Node 22.19.0. CI now has Node 22 and 24 jobs with separate browser trace artifacts; the updated workflow has not run remotely yet.
- **All 19 landing-page Chrome checks passed** against built assets through the local Cloudflare Worker, including its real `_headers` configuration. Eighteen passed in the full run; the local-editing check passed after its hard-coded development origin was changed to the configured test origin.
- **All 11 SDK integration Chrome checks passed**, covering Vercel HTTP and Cloudflare Worker/WebSocket streaming, settings changes, literal content, clipboard copying, stop/regenerate, error/history, and reconnect.
- Desktop, mobile, and dark-mode captures were visually inspected.
- Local Markdown links and `git diff --check` passed. The production site contains no obsolete package downloads or specimen bundle.

Builds still report upstream bundler annotation and fixture chunk-size warnings. The fixture intentionally includes upstream code, math, and diagram renderers; its size is not the utility's size.

## Production fixes

The measurement JSON uses an explicit [non-inline Vite asset import](https://vite.dev/guide/assets#explicit-inline-handling), retaining one source file and producing a navigable hashed HTTP URL. A browser test actually follows the link and reads the measurement. The guide is served as inline plain text, font responses cache for seven days, and inline style permission is limited to style attributes. Tests verify those headers through the local Worker. A deployed host still needs its own smoke test.

The document title and OpenGraph title match the existing “Nicer typography” hero. The footer retains “Consider the details.” as a separate sign-off; the design north star is not required to repeat the page title. Social-preview artwork and `og:image` remain launch preparation.

The heavy comparison renderer loads separately from the page shell. Its heading and viewport remain mounted, preserving fragment navigation and layout while loading. A test holds the actual deferred bundle identified by Vite's build manifest, verifies the hero and loading state, and then releases it to confirm the comparison works.

## Behavior covered

The comparison uses the same Streamdown renderer and source on both sides. Text and Conversation share one substantial example. The left pane defaults to rendered text and exposes an editable Markdown tab; editing cancels replay and retains the source across view changes. Remote Markdown images render descriptions without making requests.

Both columns and the growing editor use one native vertical scroll container. Mobile selects Original or With Typograph in that same reading area. There is no JavaScript scroll synchronization. Tests verify viewport fit, sticky controls, mobile reflow, enlarged text, endpoint-aware fades, and code blocks that do not introduce another vertical scrollbar.

The three global switches control the preview and generated setup instructions. Show changes controls only annotation paint and rulers. Tests compare glyph positions, scroll position, and viewport geometry before and after toggling it, and verify highlight layers sit beneath neighboring text. Hanging geometry and conditional rulers are checked at multiple widths and during streaming.

Other checks cover replay/pause/scrub/resume, scripted thinking, empty and custom input, literal code/table/link content, native selection copying, keyboard access, all eight refinement combinations, exact prompt/code clipboard contents, and the manual-copy fallback.

The landing page uses plain CSS targeting semantic elements and Streamdown data attributes. The compatibility fixture uses Tailwind with its shadcn components. Streamdown's emitted utility class names are not the landing page's styling contract.

## Performance observation

The production-build run included the existing Chrome probe with simulated 6× CPU throttling: 4,143 ms of task time over the recorded replay, with no tasks reaching the probe's long-task threshold. It rendered the 3,086-character example twice, with spacing and highlights off. This is one local observation, not physical-device profiling or a production performance guarantee. This is not directly comparable to earlier development-server probes. The main JavaScript chunk is about 76.5 KB gzip; the deferred comparison chunk is about 161 KB gzip. The overall download is similar, but the comparison no longer blocks the hero from rendering. Engine-only measurements are recorded separately in [the hardening report](HARDENING_TEST.md).

## Remaining release evaluation

Physical-device profiling, a screen-reader session, broader browser/zoom coverage, hydration, editorial review with anonymized model replies, and blind reading comparisons remain. Local Chrome checks do not establish those results. Public package installation, a shadcn registry recipe, and deployment are separate release work.
