# Chat typography hardening and integration pass

Tested 17 September 2026. This records the focused engine-hardening and reproducible SDK-fixture work. The package remains private and unpublished.

## What changed

- Quotes retain context across links, reference links, emphasis, and protected inline content. Code and link destinations remain unchanged.
- Single/double quote conversion and apostrophe conversion can be switched independently.
- Valid English BCP 47 tags, including `en-US` and `en-GB`, enable the same documented house style. Invalid, missing, and unsupported locales pass through.
- Spacing is opt-in. The usual integration uses one conservative streaming preset and requires no finish callback or changing React key.
- An application can opt out a subtree with `skip`.
- Repeated suffix lowercasing and unbounded email recognition were removed from the plugin. Iterative traversal handles the tested 20,000-level inline tree without recursive stack overflow.
- Stress work found another expensive recognizer inside Typehug 0.2. Spacing now passes through a whole prose run if a token exceeds 256 UTF-16 code units; punctuation still runs. Boundary tests cover 256 and 257, plus a 64,000-character token.
- The public Markdown type dependency is declared explicitly and verified outside the workspace.

## Reproducible integrations

The [fixture](examples/chat-integration/README.md) is checked into the repository and uses the official AI Elements Message component plus shadcn components. One UI runs either Vercel AI SDK HTTP streaming or Cloudflare Agents through a local Worker/Durable Object. Responses use the actual AI SDK UI-message protocol with deterministic chunks, rather than a paid model.

AI Elements and Streamdown 2.6.0 both memoize away some changes to parser configuration. The owned MessageResponse uses normal React prop comparison and changes its renderer-plugin identity only when configuration changes. Browser tests verify a locale/spacing update without replacing the existing paragraph DOM. This supersedes the earlier keyed-remount recipe.

The 11 browser tests cover:

- Rich streaming Markdown and preserved code, math, table, URL, and tool content through each SDK.
- Exact original message text and raw clipboard copying.
- Locale/spacing changes while text is unchanged, without remounting prose.
- Isolated quote and incomplete unit boundaries during streaming.
- Stop and regenerate without duplicate answers.
- Failed partial answers and history restored after reload.
- Cloudflare disconnect/reconnect during an active response, followed by the complete answer with no duplicated numbered steps.

The AI SDK fixture saves settled raw messages in sessionStorage. Active resumption is tested on the Cloudflare path only. The Cloudflare fixture proves client integration with a local Worker transport; it does not establish server-side execution of the typography plugin in every edge runtime.

## Performance

Apple M3 Max, macOS, Node 22.19.0. Three warmups and 40 measured iterations per scenario, fresh text tree each time. Timed work is the plugin transformation, including protection scanning; tree construction, Markdown parsing, React rendering, and layout are excluded. Values below are milliseconds.

Measurements refreshed after the audit fixes, including the new elision lookahead.

| Input             | Characters | Spacing      | Median |    p95 |
| ----------------- | ---------: | ------------ | -----: | -----: |
| Dense apostrophes |      4,002 | off          |  0.355 |  0.692 |
| Dense apostrophes |     16,002 | off          |  1.335 |  1.497 |
| Dense apostrophes |     64,002 | off          |  5.433 |  6.050 |
| Dense apostrophes |     64,002 | on           | 11.270 | 11.835 |
| Dense elisions    |      4,004 | off          |  0.288 |  0.664 |
| Dense elisions    |     16,016 | off          |  1.093 |  1.301 |
| Dense elisions    |     64,012 | off          |  4.892 |  5.205 |
| One long token    |     64,000 | on, fallback |  1.594 |  1.821 |
| Ordinary prose    |      4,056 | off          |  0.267 |  0.580 |
| Ordinary prose    |     64,038 | off          |  4.218 |  4.541 |
| Ordinary prose    |     64,038 | on           | 12.319 | 13.100 |

The prior diagnostic measured 1,653.95 ms at 64,002 characters for dense apostrophes with spacing off, using the same machine/Node version and three warmups but seven samples. The new measurement demonstrates the removed pathological behavior; it is not a universal 300× application-speed claim.

The minified ESM browser bundle, including Typehug, is **10,446 bytes / 4,250 bytes gzip**. The audit and launch fixes add 208 compressed bytes over the previous 4,042-byte hardening measurement. The fixture's full application is much larger because it includes chat SDKs, UI components, and upstream rendering plugins; do not use its app bundle as the utility's size.

Run `npm run build:chat && npm run bench:chat`. The [script](scripts/benchmark-chat-engine.mjs) and [complete measured results](validation/chat-hardening-benchmark.json) are included. No timing threshold is asserted in CI: results depend on the machine, and real client-update budgets still need profiling.

## Audit follow-up

Adjacent nested quotes now establish quote context. Completed literal code spans are masked before unfinished-syntax detection, so embedded backticks and `](` cannot suppress typography in later prose. Elision-like quoted phrases can use a later closing mark while ignoring contractions and likely plural possessives; lookahead advances forwards rather than rescanning each suffix. New regressions cover both streaming and complete modes, independent rule switches, idempotence, and relevant stream prefixes.

The optional hanging helper supports tight and nested list items as well as loose paragraphs. It leaves ambiguous leading straight apostrophes inside the margin when punctuation conversion is off. Cross-paragraph quote state and ambiguous inch marks remain explicit limitations in the package README.

The complete core still includes Typehug even when spacing is off. At 4,250 gzip bytes, retaining the existing single-plugin configuration is the current tradeoff; a separate spacing entry point remains optional future API work.

## Verification at the hardening checkpoint

These historical totals include the superseded toolkit, which has since been removed. Current repository verification is recorded in [LANDING_TEST.md](LANDING_TEST.md).

- Full workspace build, fixture production build, and both TypeScript projects passed. Vite reports upstream `use client`/annotation and large-chunk warnings; these do not prevent the builds.
- Final unit/renderer suite: **230 passed**, including 70 chat-engine checks and one Streamdown server-render check. The 46 editorial corpus cases are included in the engine tests with spacing explicitly enabled.
- Final browser suite: **11 passed** in Chrome against the local servers.
- Packed package installed in a fresh temporary consumer with actual published dependencies. Generic Remark transformation, protected URL, exports, package file allowlist, and public TypeScript declarations without `skipLibCheck` passed.
- CI now runs the fixture build/typecheck, installs Chromium, executes the browser suite, and retains failure traces. The updated GitHub workflow has not yet run remotely.

## Remaining release work

This is a narrow English typography policy, not universal editorial correctness. Real anonymized model replies, editorial review, mixed-language decisions, narrow-screen/zoom comparisons, selection-copy and screen-reader checks, hydration, and slower-device browser profiling remain. The fixture is local; nothing was deployed or published. A shadcn registry entry and a public install command should follow those checks, not precede them.

The controlled before/after streaming comparison is now implemented in the [landing page](LANDING_PAGE_BRIEF.md), using the tested engine and renderer integration.

## Launch candidate checks (2026-09-19)

The 0.1.0 candidate limits unfinished backtick protection to the current paragraph (including CRLF and whitespace-only blank lines), resolves quotes before footnotes, and excludes numeric measurements from elision lookahead. The hanging helper initializes missing properties on hand-built elements. All 113 unit/renderer checks pass, including eight new regressions that failed against the prior implementation.

The paragraph-boundary scan is cached within a protection pass to avoid rescanning long paragraphs for each code span. The new dense-code-spans probe measures 0.386 / 0.793 / 3.456 ms at 4K / 16K / 64K characters with spacing off. See the recorded JSON for the complete environment and samples. These measurements are local and do not predict an application’s complete rendering time.
