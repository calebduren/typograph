# Verification

This file records what was verified for the current release of `@calebduren/typograph`, and what was not. Each release updates it in the release commit. Earlier reports, from before the package was published, are kept in [docs/history](history/).

## 1.0.0 — 2026-09-29

### What 1.0.0 is

1.0.0 freezes the API and starts the versioning policy described at the top of the [changelog](../CHANGELOG.md). It adds no typography rules and changes no existing rule. Its behavior matches 0.4.1 except for two changes:

- **Renamed type and named export.** The options type `ChatTypographyOptions` is now `TypographyOptions`. The old name remains exported as a deprecated alias for all of 1.x and is removed in 2.0.0. The Remark plugin is still the default export and is also exported as `remarkTypography`.
- **Unsafe URLs in `web` and `email` output.** For Markdown input, `typeset` now removes a link `href` whose protocol is not `http`, `https`, `irc`, `ircs`, `mailto`, or `xmpp`, and an image `src` whose protocol is not `http` or `https`. Relative URLs are kept. The element and its text stay. This follows the CommonMark reference renderer. `markdown` output and HTML input are unchanged, and the package is still not a sanitizer.

### What ran

Run on 2026-09-29 from the release commit. Environment: macOS 26.6.2 on an Apple M3 Max, Node 26.7.0 (CI also runs Node 22 and 24), Playwright 1.63.0 with Google Chrome 154 for the Chromium runs.

| Check                     | Command                                                    | Result                                                                                                                                                            |
| ------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit and renderer tests   | `npm test`                                                 | 454 passed in 11 files                                                                                                                                            |
| Hydration                 | `tests/chat-hydration.test.tsx`, part of `npm test`        | passed; no recoverable errors, no console errors                                                                                                                  |
| Typecheck                 | `npm run typecheck`                                        | passed                                                                                                                                                            |
| Lint                      | `npm run lint`                                             | passed                                                                                                                                                            |
| Format                    | `npm run format:check`                                     | passed                                                                                                                                                            |
| Packed consumer           | `npm run check:package`                                    | passed; tarball `calebduren-typograph-1.0.0.tgz`                                                                                                                  |
| Landing page, Chromium    | `npm run test:landing`                                     | 17 passed                                                                                                                                                         |
| Integration, Chromium     | `npm run test:chat-integration`                            | 11 passed                                                                                                                                                         |
| Landing page, Firefox     | `PLAYWRIGHT_BROWSER=firefox npm run test:landing`          | 17 passed                                                                                                                                                         |
| Integration, Firefox      | `PLAYWRIGHT_BROWSER=firefox npm run test:chat-integration` | 11 passed                                                                                                                                                         |
| Landing page, WebKit      | `PLAYWRIGHT_BROWSER=webkit npm run test:landing`           | 17 passed                                                                                                                                                         |
| Integration, WebKit       | `PLAYWRIGHT_BROWSER=webkit npm run test:chat-integration`  | 11 passed                                                                                                                                                         |
| Engine benchmark and size | `npm run bench:chat`                                       | ordinary prose, 64,038 characters, spacing on: 12.0 ms median, 12.3 ms p95, against 12.3 / 13.1 ms recorded for 0.1.0; bundle unchanged apart from the URL filter |

The packed-consumer check installs the package archive into a fresh temporary project and checks its exports, declared dependencies, file allowlist, and public TypeScript types without `skipLibCheck`. Browser suites use local recorded responses; no model is called. Benchmark timings depend on the machine and do not predict an application's rendering time.

### Model-reply review

The corpus has 40 replies, generated on 2026-09-29 by a Claude Sonnet subagent answering realistic prompts as a chat assistant. They are not production traffic and contain no user data. The replies are in `validation/model-replies/`.

`tests/model-replies.test.ts` runs every reply through the plugin with `phase: 'complete'` and at streaming prefixes, and checks the documented guarantees on each: edits are length-preserving substitutions in text nodes, a second run leaves the output unchanged, and code, URLs, and link destinations stay as written. The hand review, prepared with `scripts/review-replies.mjs`, is recorded in `validation/model-replies/review.md`.

Findings: 14,980 words, 1,080 characters changed, 29,241 streaming prefixes checked, and no violation of any guarantee. Of the 93 straight marks left in prose, 80 are foot and inch marks such as `5'11"` and `24" x 96"`, which is the documented behavior. The rest fall under documented limits and none changes 1.0.0:

- Mathematical primes. `f'(x)` keeps its straight mark because the apostrophe is followed by `(`, while `y'` before a comma curls to `’`, so a reply that uses ASCII primes is typeset inconsistently. Primes are outside the package's scope, and the README asks for explicit prime characters.
- Mentioned quote characters. In `a single "` and `the inch mark (")`, a quotation mark that is being discussed rather than used is curled. The plugin has no way to tell the two apart; a code span protects a mentioned character.
- `'94` inside a quotation. `in '94," he said` keeps its straight apostrophe, while `'90s` curls, because a two-digit year after an opening single mark can also begin a quotation. This is the conservative side of the heuristic and a candidate for a minor release.
- `a.m.` and `p.m.` receive no nonbreaking space from Typehug, while `Dr.`, `Fig. 2`, and `30 min` do. Spacing is opt-in; this is a candidate for a Typehug upgrade in a minor release.

Firefox and WebKit surfaced no product defects. Two test-harness fixes were needed: the suites now stub the clipboard where those engines have no permission grant, and the keyboard-entry test does not expect Tab to focus a link in WebKit, which follows Safari.

### Accepted limitations

These are documented limits carried into 1.0, not bugs. A patch release does not change them.

- Quote state resets at each block, so a quotation that spans paragraphs can leave its final straight closing mark unchanged.
- An ambiguous inch mark inside an open quotation, such as `"Buy a 24" monitor," he said.`, can be read as the closing quote.
- A matching closer can resolve an elision-like opening, such as `'Round the corner.'`, as a quotation, and a streaming reply can revise that decision when the closer arrives.
- Dashes, ellipses, primes, hyphenation, language detection, and typography for languages other than English are outside the package's scope.
- The hanging helper does not compensate for the kerning lost between an isolated quote and the next letter, skips lists entirely, and does not support RTL, vertical, centered, or right-aligned text.

### Not verified for 1.0.0

- No screen-reader session.
- No profiling on a physical slow device.
- No corpus of production traffic. The model-reply corpus is generated, not collected from users.
- Hydration was checked only in jsdom, through Streamdown.
- Safari and Firefox were covered only through Playwright's WebKit and Firefox engines, not the shipping browsers.
