# Changelog

Versions are releases of the npm package `@calebduren/typograph`. While it is at 0.x, a minor version can change rendered output and a patch version does not; 0.1.1, which stopped hanging quotes in lists, is the one exception.

The site at typograph.dev deploys separately from the same repository. Site changes are noted where they matter to its readers.

## Site — 2026-09-25

- Redesign typograph.dev in warm paper and olive ink, with Hedvig for headings and Inter for text. Below the hero, a model reply streams into two columns as you scroll, raw on the left and through `typesetText` on the right, with hanging opening quotes.
- Add this changelog at typograph.dev/changelog, typeset by the package, and restyle the specimen page.
- Remove the replayable streaming comparison; the scroll demo covers streaming, and the workbench remains the place to try your own text.

## 0.4.1 — 2026-09-25

- Curl the apostrophe in possessives and plurals after a digit, such as `Q3's`, `2025's`, and `5's`, including with the apostrophes-only preset. Only `'s` followed by a space, punctuation, or the end of the text changes; foot and inch marks such as `5'11"`, `30' long`, and `6' rack` stay straight. While a reply streams, `Q3's` at the right edge waits for the next character.
- Pack release archives with `npm run pack:release`; `npm run check` now packs to `release/check/` and no longer overwrites a published version's tarball.

## 0.4.0 — 2026-09-25

- Keep quote context across raw HTML elements with their own content, such as `"frozen"<citation>x9</citation>`: the closing quote now curls. Inline formatting tags such as `<b>` still join the surrounding sentence; any other element, including custom ones, is preserved as a unit and its content receives no typography. While a reply streams, an element that has not closed yet stands alone and later text is still typeset.
- Document an apostrophes-only preset for products with no response-language signal, and note SMS and non-JavaScript email pipelines in the integration guidance.
- Redesign typograph.dev as a product site. The hero streams an assistant reply through `typesetText` token by token, with a switch to compare the original, and every example on the page, including the per-call timing, is computed by the published package in your browser.
- Add a workbench to typograph.dev that runs the published package on your own plain text, Markdown, or HTML email and shows a marked preview, a table of every change, the exact output, and the call that produced it. Nothing leaves the page.
- Show each entry point on typograph.dev with its call and a live example for chat, email, UI strings, and HTML templates, and state what Typograph never changes and its known limits.

## 0.3.0 — 2026-09-24

- Add HTML input: `typeset(html, { input: 'html', target })` returns trusted HTML with only typographic characters changed, including template-escaped quotes such as `&quot;`. `rehypeTypography` typesets hast in your own rehype pipeline, and `rehypeHangingPunctuation` gains `source: 'html'`. Adds `rehype-parse` as an optional peer.
- Export the HTML option types. `TypesetOptions` is now a union of `MarkdownTypesetOptions` and `HtmlTypesetOptions`, both exported from `@calebduren/typograph/static`, and `HtmlTypographyOptions` is exported from the root entry. HTML input takes `html: 'document'` to parse a full document and rejects `hanging: true` and `math`.
- Document that `email` output never includes hanging punctuation. Gmail and Apple Mail on iOS do not render any tested technique; smart quotes and nonbreaking spaces are unaffected.
- Broaden the website to all AI-generated text, with a new headline, a Finished text integration recipe for `typeset()` and `typesetText()`, a Highlight changes toggle in place of Show changes, and the install command first in the integration section.

## 0.2.0 — 2026-09-24

- Add `typesetText` for plain AI-generated strings such as titles and notifications. It is synchronous, parses no Markdown, and preserves string length. Its options type is `TypesetTextOptions`.
- Add `@calebduren/typograph/static` with `typeset(markdown, { target })` for finished text: `web` and `email` HTML, or `markdown` that keeps the original formatting. Parser packages are optional peer dependencies, loaded on demand.
- Accept `math: true` in `typeset` to parse `$…$` as math, off by default because single dollars are usually currency, and `hanging: false` to leave hanging markup out of `web` output. Raw HTML is dropped from `web` and `email` output. Options are typed as `TypesetOptions` and `TypesetTarget`.
- Document idempotency: running the plugin again on its own output, or on text that already has curly quotes and nonbreaking spaces, leaves it unchanged. Tests cover the whole corpus, including serializing and reparsing, where lost escapes put the result outside the guarantee.

## 0.1.1 — 2026-09-20

- Keep opening quotes inline throughout bulleted and numbered lists, including nested paragraphs and headings, so hanging punctuation cannot overlap list markers. This replaces the list support added in 0.1.0.
- Clarify the hanging helper's list exclusions and its effect on quote kerning in the package documentation.
- Update the website's hero to demonstrate a non-breaking space and distinguish spacing highlights with diagonal red stripes.
- Start the website demo with all three refinements on, and add app icons, a web app manifest, and new social preview images.

## 0.1.0 — 2026-09-19

- Focus Typograph on English typography for streaming Markdown chat responses.
- Provide a Remark punctuation plugin, optional Typehug no-break spacing, and an optional Rehype opening-quote helper.
- Include an editable landing-page comparison, recorded conversation replay, and copyable integration prompts.
- Verify Vercel AI SDK and Cloudflare Agents integrations using local recorded streams.
- Remove the superseded general typography toolkit, specimen site, generated downloads, and comparison experiments. Use one package and one landing-page entry point.
- Handle adjacent nested quotes, quoted elisions, and quotes before footnotes while preserving measurements.
- Limit unfinished inline code protection to its paragraph and preserve literal delimiters inside completed code.
- Support hanging quotes in tight and nested lists, including hand-built elements without properties.

Published as `@calebduren/typograph`, the first version on npm.

## Before 0.1.0

- Build Curly (2026-09-10): a local engine for English smart quotes and apostrophes with optional primes and ellipses, remark and rehype adapters, a paragraph-buffered stream, and a browser playground that explains each decision.
- Document the Curly design system and prepare its V1 distribution as `cowboy-curly`, with the playground hosted on Cloudflare (2026-09-10).
- The `v1.0.0` and `v1.0.1` tags mark those Curly releases, not Typograph versions. They point at `f40d5f9` and `f7c1a3e`, and their GitHub releases attach `cowboy-curly-1.0.0.tgz` and `cowboy-curly-1.0.1.tgz` for installation by URL. `cowboy-curly` was never published to npm.
- Rebrand as Typograph (2026-09-11) and broaden into a general typography toolkit with reading styles, shared typography principles, an agent skill, and rhythm, hierarchy, and numeric specimens. That package, `@calebduren/typograph` 2.0.0-next.1, was distributed only as locally built archives.
- Rebuild the playground around a streaming chat comparison (2026-09-17) and add project quality checks: oxlint, Prettier, and Playwright tests for the landing page and a recorded-stream chat integration in CI. Work moves to a private `@typograph/chat` package that was never published.
- Narrow the product to English typography for streaming Markdown chat and publish it as `@calebduren/typograph` 0.1.0 (2026-09-19), removing the general toolkit.
