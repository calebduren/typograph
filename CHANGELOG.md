# Changelog

## 0.3.0 — 2026-09-25

- Add HTML input: `typeset(html, { input: 'html', target })` returns trusted HTML with only typographic characters changed, including template-escaped quotes such as `&quot;`. `rehypeTypography` typesets hast in your own rehype pipeline, and `rehypeHangingPunctuation` gains `source: 'html'`. Adds `rehype-parse` as an optional peer.
- Document that `email` output never includes hanging punctuation. Gmail and Apple Mail on iOS do not render any tested technique; smart quotes and nonbreaking spaces are unaffected.

## 0.2.0 — 2026-09-24

- Add `typesetText` for plain AI-generated strings such as titles and notifications. It is synchronous, parses no Markdown, and preserves string length.
- Add `@calebduren/typograph/static` with `typeset(markdown, { target })` for finished text: `web` and `email` HTML, or `markdown` that keeps the original formatting. Parser packages are optional peer dependencies, loaded on demand.
- Test idempotency across the whole corpus, including after serializing and reparsing.

## 0.1.1 — 2026-09-20

- Keep opening quotes inline throughout bulleted and numbered lists, including nested paragraphs and headings, so hanging punctuation cannot overlap list markers.
- Clarify the hanging helper's list exclusions and its effect on quote kerning in the package documentation.
- Update the website's hero to demonstrate a non-breaking space and distinguish spacing highlights with diagonal red stripes.

## 0.1.0 — 2026-09-19

- Focus Typograph on English typography for streaming Markdown chat responses.
- Provide a Remark punctuation plugin, optional Typehug no-break spacing, and an optional Rehype opening-quote helper.
- Include an editable landing-page comparison, recorded conversation replay, and copyable integration prompts.
- Verify Vercel AI SDK and Cloudflare Agents integrations using local recorded streams.
- Remove the superseded general typography toolkit, specimen site, generated downloads, and comparison experiments. Use one package and one landing-page entry point.

- Handle adjacent nested quotes, quoted elisions, and quotes before footnotes while preserving measurements.
- Limit unfinished inline code protection to its paragraph and preserve literal delimiters inside completed code.
- Support hanging quotes in tight and nested lists, including hand-built elements without properties.

Published as `@calebduren/typograph`. Earlier implementation history is available in Git.
