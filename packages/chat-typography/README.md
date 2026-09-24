# @calebduren/typograph

Conservative English typography for AI-generated text: smart quotes and apostrophes, optional nonbreaking spaces, and optional hanging opening quotes. One engine powers three entry points:

- **Streaming chat:** a Remark plugin (the default export) that refines rendered prose as tokens arrive, while the app keeps the original model text.
- **Finished Markdown:** `typeset()` from `@calebduren/typograph/static` returns web HTML, email HTML, or typeset Markdown for artifacts such as a daily brief.
- **Plain strings:** `typesetText()` for titles, notifications, and other text that is not Markdown.

It adds no React, chat SDK, network service, or hosting requirement.

**English only, by design.** Multilingual typography is outside this product's scope. English locale variants share one house style; they do not select regional quotation conventions. Use the plugin only on responses known to be English.

ESM, Node 22+ for server use. Browser rendering and the local Cloudflare chat transport are checked by the integration fixture. No install scripts or telemetry.

## Install

```sh
npm install @calebduren/typograph
```

## Start with one stable preset

```tsx
import typography from '@calebduren/typograph';
import { Streamdown, defaultRemarkPlugins } from 'streamdown';

const remarkPlugins = [
  ...Object.values(defaultRemarkPlugins),
  [typography, { locale: 'en-US' }],
] satisfies NonNullable<React.ComponentProps<typeof Streamdown>['remarkPlugins']>;

// Inside the app's assistant text component:
<Streamdown remarkPlugins={remarkPlugins} isAnimating={streaming}>
  {part.text}
</Streamdown>;
```

Supply the known language of the **response**, not just the interface language. `en`, `en-US`, `en-GB`, and other valid English BCP 47 tags use the same English house style. Regional punctuation conventions are not implemented. Unknown, invalid, missing, or unsupported locales pass through. The plugin does not detect mixed-language passages.

The default changes quote marks and apostrophes; it leaves whitespace unchanged. To enable conservative nonbreaking pairs such as `30 min`, `Dr. Smith`, and `Fig. 2`, set `spacing: true`. This uses the credited [Typehug](https://github.com/alexszczurek/typehug) engine. Disabling spacing skips its analysis but does not remove it from the bundle.

Only pass assistant text parts through the prose renderer. Render tool results, JSON, citations, and other structured UI using their appropriate components. A generic Remark pipeline can use `.use(typography, options)` after parsing; pass the original Markdown as the VFile value so escaped punctuation and unfinished syntax can be protected.

## AI Elements, shadcn, and changing settings

The [runnable integration fixture](https://github.com/calebduren/typograph/blob/main/examples/chat-integration/README.md) uses the official AI Elements `MessageResponse`, with a small change to its copied source. It exercises both Vercel AI SDK's HTTP transport and Cloudflare Agents' WebSocket/persistence path. The typography configuration is identical for both.

With the tested AI Elements component and Streamdown 2.6.0, changing only `remarkPlugins` can be ignored by memo comparisons. In the owned `MessageResponse`:

1. Remove its custom comparator so React compares all props.
2. Preserve the existing `streamdownPlugins` and create this identity inside the component:

```tsx
const plugins = useMemo(
  () => ({ ...(props.plugins ?? streamdownPlugins) }),
  [props.plugins, props.remarkPlugins, props.rehypePlugins],
);

return <Streamdown {...props} plugins={plugins} />;
```

Keep the component's existing styling. Memoize the caller's `remarkPlugins` array on the locale and rule options, as in [TypographyResponse](https://github.com/calebduren/typograph/blob/main/examples/chat-integration/src/typography-response.tsx). This updates settings without remounting the message; the browser test checks that the existing paragraph DOM survives. These are version-specific integration details, not a new streaming protocol. Recheck them when upgrading Streamdown or regenerating the component.

A fixed preset requires no finish callbacks, per-message completion tracking, or changing React keys. The default remains conservative even after the reply ends.

## Contract

| Option        | Default     | Behavior                                                                                                       |
| ------------- | ----------- | -------------------------------------------------------------------------------------------------------------- |
| `locale`      | absent      | A valid English language tag enables transformations.                                                          |
| `phase`       | `streaming` | `complete` permits decisions at the final edge.                                                                |
| `punctuation` | `true`      | `false` disables it; `{ quotes, apostrophes }` controls each independently.                                    |
| `spacing`     | `false`     | `true` enables units, initials, and abbreviations. An object controls these plus `shortWords` and `lastWords`. |
| `skip`        | absent      | A predicate preserves a selected Markdown node and its descendants.                                            |

Short-word and paragraph-ending joins are off unless requested. `lastWords` also requires `phase: 'complete'`. If opting into completion refinements, track a successful finish for each message, exclude abort/disconnect/error, and decide which finish reasons qualify. A chat status of `ready` alone is insufficient. The default avoids this lifecycle bookkeeping.

Punctuation context crosses emphasis and link labels within a block. No-break spacing can cross emphasis but does not cross a link, code, math, or skipped subtree boundary. Code, math, raw HTML, link destinations, and syntax are preserved. Escaped quotes are protected when the original source is available. Bare URLs, email addresses, and unfinished backtick spans receive conservative protection. Unfinished inline code protection ends at the next blank line, so later paragraphs still receive typography.

Quote state resets at each block. A quotation that spans paragraphs can leave its final straight closing mark unchanged. An ambiguous inch mark inside an open quotation, such as `"Buy a 24" monitor," he said.`, can be interpreted as the closing quote. Write explicit prime characters (`24″`) or opt out when literal intent must be preserved. A matching closer can resolve an elision-like opening (`'Round the corner.'`) as a quotation; incomplete streams can revise that decision as the closer arrives. This is a conservative heuristic, not grammatical analysis.

To bound known expensive Typehug recognition, spacing passes through an entire prose run if any token exceeds **256 UTF-16 code units**. Punctuation still runs. A run is a contiguous span of prose that may include emphasis; links and protected content delimit it. This fallback deliberately forgoes some optional joins.

The core plugin's edits are length-preserving character substitutions in existing text nodes. The plugin is stateless between transformations; it does not mutate the SDK message, manage transport, throttle chunks, sanitize HTML, or replace the Markdown parser. The static `typeset` entry uses your installed unified and remark packages rather than bundling a parser. Incomplete Markdown can still change interpretation as more text arrives. Dashes, ellipses, primes, hyphenation, automatic language detection, and arbitrary-language typography are outside this package's scope. Running the plugin twice on the same parsed tree leaves it unchanged, and so does running it on text that already contains curly quotes and nonbreaking spaces. Serializing the tree back to Markdown can drop escapes, so a reparsed result is not covered by this guarantee.

## Plain strings

For AI-generated text that is not Markdown (titles, notifications, email subject lines, summaries stored in JSON), use the synchronous `typesetText` export. It needs no parser and adds no dependencies.

```ts
import { typesetText } from '@calebduren/typograph';

typesetText(`Bob's "weekly" brief takes 30 min`, { locale: 'en', spacing: true });
// → Bob’s “weekly” brief takes 30 min (with a nonbreaking space before “min”)
```

It accepts `locale`, `punctuation`, `spacing`, and `phase`, with the same meanings as above. `phase` defaults to `complete`; pass `streaming` for a string that is still arriving. Markdown syntax has no meaning here: `*`, `_`, `#`, and list markers are ordinary characters. Blank lines separate blocks, so quote state resets at each one. URLs, email addresses, backtick spans, and tag-like `<…>` runs keep their straight marks. Output length always equals input length in UTF-16 code units, so offsets computed on the input remain valid.

## Finished Markdown: web, email, and Markdown output

For text that is complete before anyone reads it, such as a daily brief written overnight by an agent, use `typeset` from `@calebduren/typograph/static`. It parses, typesets, and serializes in one call.

```sh
npm install @calebduren/typograph unified remark-parse remark-gfm remark-rehype rehype-stringify
```

```ts
import { typeset } from '@calebduren/typograph/static';

const html = await typeset(brief, { target: 'web', locale: 'en', spacing: true });
```

| `target`   | Returns                           | Hanging markup                        | Peers needed                                                                 |
| ---------- | --------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------- |
| `web`      | HTML fragment                     | on by default (`hanging: false` off)  | `unified`, `remark-parse`, `remark-gfm`, `remark-rehype`, `rehype-stringify` |
| `email`    | HTML fragment                     | never; email clients are not verified | same as `web`                                                                |
| `markdown` | typeset Markdown, same formatting | not applicable                        | `unified`, `remark-parse`, `remark-gfm`                                      |

`target` is required. Options otherwise match the plugin (`locale`, `punctuation`, `spacing`, `skip`), except that `phase` is always `complete`. The parser packages are optional peer dependencies, loaded only when `typeset` runs. If one is missing, `typeset` rejects with an error naming every package to install.

- **Syntax:** CommonMark plus GFM (tables, strikethrough, autolink literals, footnotes, task lists). Math is off by default because `remark-math` reads single dollars, which are usually currency, as inline math. Pass `math: true` (and install `remark-math`) to parse `$…$` and `$$…$$`; math is rendered as `remark-rehype`'s default `<code class="language-math">` markup, so bring your own TeX renderer.
- **Raw HTML** is dropped from `web` and `email` output, following `remark-rehype`'s defaults; sanitize and add it yourself if you need it. `markdown` output keeps it as written.
- **Hanging CSS:** `web` output with hanging markup needs `@calebduren/typograph/hanging.css`. `typeset` returns markup only.
- **`markdown` output** writes each change back into your original text, so emphasis markers, bullets, line wrapping, and escapes stay as they were. Backslash-escaped quotes stay straight. Quotes written as entities (`&quot;`) stay as entities, although `web` output curls them. Text containing a named entity other than `&amp; &lt; &gt; &quot; &apos; &nbsp;` keeps its original characters.
- **Idempotent:** typesetting the `markdown` output again returns it unchanged.

If your pipeline already has a Markdown renderer, the simplest option is to typeset the Markdown before it enters your HTML or email template. That covers text the model wrote, but not prose the template adds itself.

## Optional opening-quote hanging

Import `hangingPunctuation` from `@calebduren/typograph/hanging` and load `@calebduren/typograph/hanging.css` in your app's stylesheet/bundler entry. Add `[hangingPunctuation, { locale: 'en' }]` to your Rehype plugins **after existing sanitization**, retaining the renderer's defaults. See the [full integration example](https://typograph.dev/integration.md#optional-hanging-punctuation).

This independent layout helper hangs an opening straight or curly quote at the start of English, left-aligned paragraphs and headings outside lists, including quotes inside emphasis and links. It uses real text in two small spans, standard inline layout, and a transform based on the quote's own width. No native `hanging-punctuation` support, DOM measurements, React dependency, or resize observer is required. It is opt-in; importing the core plugin alone does not load the helper or stylesheet.

Ambiguous leading straight apostrophes, including `'em`, `'Tis`, and `'90s`, remain inside the reading edge when punctuation conversion is off. Curly opening quotes produced by the punctuation plugin can hang normally.

The isolated quote does not retain the font's pair kerning with the following letter. This can be noticeable with pairs such as `“A`, especially in large headings; the helper does not measure or compensate for individual font pairs.

Bulleted and numbered lists are skipped entirely, including paragraphs and headings nested inside list items, so quotes cannot crowd their markers. It does not hang punctuation at every wrapped line ending or handle full optical margin alignment. Provide a left gutter and preserve the generated classes/attributes in custom renderers. Opt out of RTL, vertical, centered, and right-aligned text. Code, math, tables, and unknown custom elements pass through. Raw HTML and escaped opening quotes are protected when original source positions are available. The helper supports `skip(node)` and the same explicit English-locale requirement as the core, but operates on HTML (HAST) nodes. Its span additions are separate from the core's text-only substitutions.

## Copy and persistence

For paragraph-ending orphan control, prefer progressive-enhancement CSS `text-wrap: pretty` on completed assistant prose paragraphs. Keep normal wrapping while streaming; browser support and the exact line breaks vary. This avoids adding characters to copied text and lets layout respond to the current width and font. See the [integration guide](https://typograph.dev/integration.md#paragraph-endings-css-first) for a scoped CSS example and completion handling, and [Chrome's explanation](https://developer.chrome.com/blog/css-text-wrap-pretty) for browser behavior.

`spacing.lastWords` remains opt-in and complete-phase only. Use it when a product explicitly wants to bind the final pair in eligible prose runs, accepting that long pairs can wrap awkwardly on narrow screens and nonbreaking spaces are included in displayed-text copying. Neither this rule nor CSS guarantees a specific final line across arbitrary Markdown boundaries and layouts.

Persist and copy the original `part.text` for a **Copy original** action. Browser selection of rendered prose includes curly punctuation and any nonbreaking spaces. Code copy should use the renderer's original code content. The fixture verifies raw text, clipboard output, and protected rendered content; full screen-reader and selection-copy evaluation remains separate work.

The runtime dependency is `@typehug/en` (which uses `@typehug/core`). `@types/mdast` and `@types/hast` supply the public TypeScript definitions and add no runtime code. License attribution is in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Verify

From the repository root:

```sh
npm ci
npm run check
npm run test:chat-integration
npm run bench:chat
```

Browser prerequisites and local startup are in the fixture README. The clean-package check installs the packed artifact into a temporary generic Remark consumer and checks public types without `skipLibCheck`. See [the hardening report](https://github.com/calebduren/typograph/blob/main/HARDENING_TEST.md) for measured results and remaining limits.
