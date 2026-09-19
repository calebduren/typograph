# @calebduren/typograph

Conservative English typography for streamed Markdown. This Remark plugin changes rendered prose while the app keeps the original model text. It adds no React, chat SDK, network service, or hosting requirement.

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

The core plugin's edits are length-preserving character substitutions in existing text nodes. The plugin is stateless between transformations; it does not mutate the SDK message, manage transport, throttle chunks, sanitize HTML, or replace the Markdown parser. Incomplete Markdown can still change interpretation as more text arrives. Dashes, ellipses, primes, hyphenation, automatic language detection, and arbitrary-language typography are outside this package's scope.

## Optional opening-quote hanging

Import `hangingPunctuation` from `@calebduren/typograph/hanging` and load `@calebduren/typograph/hanging.css` in your app's stylesheet/bundler entry. Add `[hangingPunctuation, { locale: 'en' }]` to your Rehype plugins **after existing sanitization**, retaining the renderer's defaults. See the [full integration example](https://typograph.dev/integration.md#optional-hanging-punctuation).

This independent layout helper hangs an opening straight or curly quote at the start of English, left-aligned paragraphs, headings, and list items, including quotes inside emphasis and links. It uses real text in two small spans, standard inline layout, and a transform based on the quote's own width. No native `hanging-punctuation` support, DOM measurements, React dependency, or resize observer is required. It is opt-in; importing the core plugin alone does not load the helper or stylesheet.

Ambiguous leading straight apostrophes, including `'em`, `'Tis`, and `'90s`, remain inside the reading edge when punctuation conversion is off. Curly opening quotes produced by the punctuation plugin can hang normally.

The isolated quote does not retain the font's pair kerning with the following letter. This can be noticeable with pairs such as `“A`, especially in large headings; the helper does not measure or compensate for individual font pairs.

It does not hang punctuation at every wrapped line ending or handle full optical margin alignment. Provide a left gutter and preserve the generated classes/attributes in custom renderers. Opt out of RTL, vertical, centered, and right-aligned text. Code, math, tables, and unknown custom elements pass through. Raw HTML and escaped opening quotes are protected when original source positions are available. The helper supports `skip(node)` and the same explicit English-locale requirement as the core, but operates on HTML (HAST) nodes. Its span additions are separate from the core's text-only substitutions.

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
