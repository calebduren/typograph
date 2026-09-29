# Changelog

Versions are releases of the npm package `@calebduren/typograph`. From 1.0.0 they follow semantic versioning. The public API is the exports, the option names and their defaults, and the documented guarantees: length-preserving character substitutions in text nodes, idempotency, protected content (code, math, URLs, link destinations, raw HTML, and escaped punctuation), and activation only for an English locale.

- A patch release fixes behavior that contradicts the documentation. It does not change output on input that was already handled as documented.
- A minor release adds an opt-in capability or refines a heuristic on input the documentation calls ambiguous. Its entry lists every change to rendered output.
- A major release changes a default, removes or renames an export, or changes an established rule.
- Which pairs `spacing` joins is decided by Typehug and is outside this promise: a Typehug upgrade that changes existing joins ships as a minor release that lists them.

Before 1.0.0, a minor version could change rendered output and a patch version did not; 0.1.1, which stopped hanging quotes in lists, was the one exception.

## 1.1.0 — 2026-09-29

- Add `@calebduren/typograph/markdown`: `typeset(markdown, { target })` for finished Markdown with `web`, `email`, and `markdown` targets, matching `/static` with Markdown input. It needs only `unified`, `remark-parse`, `remark-gfm`, `remark-rehype`, and `rehype-stringify`. To parse math, pass the plugin itself: `import remarkMath from 'remark-math'`, then `math: remarkMath`. `math: true` throws and says so, and `input: 'html'` throws and names the HTML entry. Its options type is `MarkdownOptions`.
- Add `@calebduren/typograph/html`: `typeset(html, { target })` for trusted HTML, matching `/static` with `input: 'html'`. It needs only `unified` and `rehype-parse`. Its options type is `HtmlOptions`.
- Both entries import their peers statically. `/static` loads its seven peers with dynamic imports so it can report a missing one at runtime, but a bundler that resolves imports at build time, such as Turbopack (the default in Next.js 16) or esbuild, fails on the ones that are not installed, so a project that imported `/static` only for Markdown still had to install `rehype-parse` and `remark-math`. The 1.0.0 README said the parser packages were loaded only when `typeset` runs; that held only in Node, outside a bundler.
- Keep `/static` unchanged in behavior. Its `math` option now accepts the `remark-math` plugin as well as `true`, typed as `boolean | MathPlugin`, with `MathPlugin` exported from `/static` and `/markdown`. Rendered output is unchanged for every entry.
- Extend `npm run check:package` to bundle every entry with esbuild in a clean consumer that has only that entry's documented peers, and to confirm that `/static` with only the Markdown peers fails to bundle.

## 1.0.0 — 2026-09-29

- Freeze the API. This release adds no typography rules; the two changes below are the only differences from 0.4.1.
- Rename the options type `ChatTypographyOptions` to `TypographyOptions`. `ChatTypographyOptions` remains exported as a deprecated alias for all of 1.x and is removed in 2.0.0. The Remark plugin is still the default export and is also exported as `remarkTypography`, alongside `rehypeTypography`.
- Drop unsafe URL protocols from `web` and `email` output for Markdown input. `typeset('[x](javascript:alert(1))', { target: 'web' })` returned `<p><a href="javascript:alert(1)">x</a></p>` and now returns `<p><a>x</a></p>`. Links keep `http`, `https`, `irc`, `ircs`, `mailto`, `xmpp`, and relative URLs; images keep `http`, `https`, and relative URLs. This matches the CommonMark reference renderer. The element and its text stay, and the text is still typeset; only the `href` or `src` attribute is removed. `markdown` output and HTML input are unchanged. This is not a sanitizer.
- Apply the semantic versioning policy above from this release on. Spacing joins are Typehug's and sit outside the output-stability promise; `@typehug/en` stays pinned to an exact version, and an upgrade that changes existing joins ships as a minor release that lists them.
- Record the 1.0.0 verification in `docs/verification.md`, including a review of model replies generated for this release. The replies are in `validation/model-replies/`, and `tests/model-replies.test.ts` checks each one for length preservation and idempotency when complete, and for text-only quote and space changes with untouched code and destinations at streaming prefixes.
- Tag each published version `typograph-v<version>` on its release commit, starting with `typograph-v1.0.0`. The `v1.0.0` and `v1.0.1` tags already mark the Curly releases described below.

## 0.4.1 — 2026-09-25

- Curl the apostrophe in possessives and plurals after a digit, such as `Q3's`, `2025's`, and `5's`, including with the apostrophes-only preset. Only `'s` followed by a space, punctuation, or the end of the text changes; foot and inch marks such as `5'11"`, `30' long`, and `6' rack` stay straight. While a reply streams, `Q3's` at the right edge waits for the next character.
- Pack release archives with `npm run pack:release`; `npm run check` now packs to `release/check/` and no longer overwrites a published version's tarball.

## 0.4.0 — 2026-09-25

- Keep quote context across raw HTML elements with their own content, such as `"frozen"<citation>x9</citation>`: the closing quote now curls. Inline formatting tags such as `<b>` still join the surrounding sentence; any other element, including custom ones, is preserved as a unit and its content receives no typography. While a reply streams, an element that has not closed yet stands alone and later text is still typeset.
- Document an apostrophes-only preset for products with no response-language signal, and note SMS and non-JavaScript email pipelines in the integration guidance.

## 0.3.0 — 2026-09-24

- Add HTML input: `typeset(html, { input: 'html', target })` returns trusted HTML with only typographic characters changed, including template-escaped quotes such as `&quot;`. `rehypeTypography` typesets hast in your own rehype pipeline, and `rehypeHangingPunctuation` gains `source: 'html'`. Adds `rehype-parse` as an optional peer.
- Export the HTML option types. `TypesetOptions` is now a union of `MarkdownTypesetOptions` and `HtmlTypesetOptions`, both exported from `@calebduren/typograph/static`, and `HtmlTypographyOptions` is exported from the root entry. HTML input takes `html: 'document'` to parse a full document and rejects `hanging: true` and `math`.
- Document that `email` output never includes hanging punctuation. Gmail and Apple Mail on iOS do not render any tested technique; smart quotes and nonbreaking spaces are unaffected.

## 0.2.0 — 2026-09-24

- Add `typesetText` for plain AI-generated strings such as titles and notifications. It is synchronous, parses no Markdown, and preserves string length. Its options type is `TypesetTextOptions`.
- Add `@calebduren/typograph/static` with `typeset(markdown, { target })` for finished text: `web` and `email` HTML, or `markdown` that keeps the original formatting. Parser packages are optional peer dependencies, loaded on demand.
- Accept `math: true` in `typeset` to parse `$…$` as math, off by default because single dollars are usually currency, and `hanging: false` to leave hanging markup out of `web` output. Raw HTML is dropped from `web` and `email` output. Options are typed as `TypesetOptions` and `TypesetTarget`.
- Document idempotency: running the plugin again on its own output, or on text that already has curly quotes and nonbreaking spaces, leaves it unchanged. Tests cover the whole corpus, including serializing and reparsing, where lost escapes put the result outside the guarantee.

## 0.1.1 — 2026-09-20

- Keep opening quotes inline throughout bulleted and numbered lists, including nested paragraphs and headings, so hanging punctuation cannot overlap list markers. This replaces the list support added in 0.1.0.
- Clarify the hanging helper's list exclusions and its effect on quote kerning in the package documentation.

## 0.1.0 — 2026-09-19

- Focus Typograph on English typography for streaming Markdown chat responses.
- Provide a Remark punctuation plugin, optional Typehug no-break spacing, and an optional Rehype opening-quote helper.
- Verify Vercel AI SDK and Cloudflare Agents integrations using local recorded streams.
- Remove the superseded general typography toolkit and its generated downloads, leaving one package.
- Handle adjacent nested quotes, quoted elisions, and quotes before footnotes while preserving measurements.
- Limit unfinished inline code protection to its paragraph and preserve literal delimiters inside completed code.
- Support hanging quotes in tight and nested lists, including hand-built elements without properties.

Published as `@calebduren/typograph`, the first version on npm.

## Before 0.1.0

- Build Curly (2026-09-10): a local engine for English smart quotes and apostrophes with optional primes and ellipses, remark and rehype adapters, a paragraph-buffered stream.
- Document the Curly design system and prepare its V1 distribution as `cowboy-curly` (2026-09-10).
- The `v1.0.0` and `v1.0.1` tags mark those Curly releases, not Typograph versions. They point at `f40d5f9` and `f7c1a3e`, and their GitHub releases attach `cowboy-curly-1.0.0.tgz` and `cowboy-curly-1.0.1.tgz` for installation by URL. `cowboy-curly` was never published to npm.
- Rebrand as Typograph (2026-09-11) and broaden into a general typography toolkit with reading styles, shared typography principles, an agent skill, and rhythm, hierarchy, and numeric specimens. That package, `@calebduren/typograph` 2.0.0-next.1, was distributed only as locally built archives.
- Move the work to a private `@typograph/chat` package (2026-09-17), tested against a recorded-stream chat integration. It was never published.
- Narrow the product to English typography for streaming Markdown chat and publish it as `@calebduren/typograph` 0.1.0 (2026-09-19), removing the general toolkit.
