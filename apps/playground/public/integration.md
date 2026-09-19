# Typograph: integration guide

English-only typography for streaming AI responses. Typograph refines rendered prose while your app keeps the original messages.

## Install

```sh
npm install @calebduren/typograph
```

Use your app's package manager. The package is ESM and requires Node 22+ for server use; it also runs in the browser. It adds no React or chat SDK dependency.

## Run from source

```sh
git clone https://github.com/calebduren/typograph.git
cd typograph
npm ci
npm run build:chat
npm run dev -w @typograph/playground
```

Use Node 22.12+ for repository development. No API key is needed for the comparison. To test local package changes in another app, run `npm pack -w @calebduren/typograph` after building, then install the resulting archive in that app.

## Add the plugin where assistant text is rendered

```tsx
import typography from '@calebduren/typograph';
import { Streamdown, defaultRemarkPlugins, type StreamdownProps } from 'streamdown';

const remarkPlugins: StreamdownProps['remarkPlugins'] = [
  ...Object.values(defaultRemarkPlugins),
  [typography, { locale: 'en' }],
];

// Inside the host app's assistant text renderer:
<Streamdown remarkPlugins={remarkPlugins} isAnimating={streaming}>
  {part.text}
</Streamdown>;
```

Use a known response language, not the interface language. English tags such as `en-US` and `en-GB` use the same house style, not separate regional conventions. Missing, invalid, or unsupported languages pass through. There is no automatic language detection; opt out of mixed-language or verbatim content as appropriate.

The default changes quotation marks and apostrophes. Add `spacing: true` to enable conservative no-break pairs such as `30 min`, `Dr. Smith`, and `Fig. 2`. Spacing uses Typehug. All processing is local, and the SDK's original message is unchanged.

The landing-page demo starts with smart punctuation, non-breaking spaces, hanging punctuation, and Show changes enabled. Its generated code and agent prompt include the selected settings; those demo defaults do not change the package defaults above.

The landing page's **Smart punctuation**, **Non-breaking spaces**, and **Hanging punctuation** switches share one configuration. The formatted preview, code recipes, and copied agent prompts all use those settings. The original preview remains a reference. **Show changes** belongs only to the formatted preview and is never installed in your app. You can disable smart punctuation with `punctuation: false` while keeping the other refinements enabled.

Only assistant text parts belong in the prose renderer. Structured tool output should keep its own UI. Persist the original `part.text`, and use it for a clearly labeled Copy original action. Browser selection or copying rendered text includes curly punctuation and nonbreaking spaces.

### Keep the renderer's styling configured

Typograph transforms prose; it does not supply your Markdown renderer's layout or theme. Keep your existing renderer styles when adding the plugin. Streamdown emits Tailwind utilities by default: a Tailwind app must include Streamdown's package files in its source/content configuration and define its theme tokens. A plain-CSS app can instead style its documented `data-streamdown` hooks. The playground uses that approach in `apps/playground/src/landing.css`, including explicit bold weight and block layout for code lines. Importing `streamdown/styles.css` alone does not generate those utilities; in the installed 2.6.0 release that file supplies animation styles.

Check actual rendered bold text, code line breaks, tables, and overflow when integrating or upgrading the renderer. See [Streamdown's styling guide](https://streamdown.ai/docs/styling).

## AI Elements and shadcn

Pass the same `remarkPlugins` to your owned AI Elements `MessageResponse`. The fixed preset above needs no finish callbacks or message remounts.

If settings change at runtime, the tested AI Elements component and Streamdown 2.6.0 need an adjustment. Remove MessageResponse's custom memo comparator, retaining normal React prop comparison. Inside it, refresh the `plugins` identity when parser configuration changes:

```tsx
const plugins = useMemo(
  () => ({ ...(props.plugins ?? streamdownPlugins) }),
  [props.plugins, props.remarkPlugins, props.rehypePlugins],
);

return <Streamdown {...props} plugins={plugins} />;
```

Preserve your component's styling and existing `streamdownPlugins`. Memoize the caller's Remark configuration on its locale and rule settings. This avoids a changing React key and keeps existing message DOM in place. Recheck this version-specific behavior when upgrading Streamdown or regenerating the AI Elements source.

The complete version is in `examples/chat-integration/src/typography-response.tsx` and its owned Message component. The landing demo uses the same configuration strategy, with optional demonstration-only highlights.

## Cloudflare Agents

Keep `useAgentChat` and its transport unchanged. Apply the same plugin to each assistant text part in the renderer. Typography does not run over stored messages or manage reconnects. The local fixture in `examples/chat-integration` tests actual AI SDK HTTP streaming and Cloudflare Worker/Durable Object streaming, persistence, stop, error, regeneration, and reconnect behavior with recorded responses.

```sh
npm run worker -w @typograph/chat-integration
# In another terminal:
npm run dev -w @typograph/chat-integration
```

Open http://127.0.0.1:4175 and select either backend. No model calls or cloud account are required.

## Other Remark renderers

```ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import typography from '@calebduren/typograph';

const processor = unified().use(remarkParse).use(typography, { locale: 'en' });

const tree = processor.runSync(processor.parse(markdown), markdown);
// Continue through your existing renderer.
```

Passing the original source lets the plugin protect escaped punctuation and unfinished syntax. Preserve your renderer's existing plugins when adding this one.

## Optional hanging punctuation

Native CSS `hanging-punctuation` is still unavailable in Chrome and Firefox according to [MDN's compatibility data](https://github.com/mdn/browser-compat-data/blob/main/css/properties/hanging-punctuation.json). The optional `@calebduren/typograph/hanging` Rehype helper uses ordinary inline layout and transforms instead. It hangs the opening quote at the beginning of a paragraph, heading, or list item in English, left-aligned, left-to-right prose. It does **not** hang punctuation at every wrapped line ending or implement full optical margin alignment.

```tsx
import hangingPunctuation from '@calebduren/typograph/hanging';
import '@calebduren/typograph/hanging.css';
import { Streamdown, defaultRehypePlugins, type StreamdownProps } from 'streamdown';

const rehypePlugins: StreamdownProps['rehypePlugins'] = [
  ...Object.values(defaultRehypePlugins),
  [hangingPunctuation, { locale: 'en' }],
];

<Streamdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
  {part.text}
</Streamdown>;
```

In AI Elements, pass these props to `MessageResponse`. In other pipelines, add the helper after Remark-to-Rehype conversion and **after the app's existing sanitization**. Retain all existing security plugins. The helper adds only known span wrappers and layout attributes; it never parses raw HTML or inserts a string as HTML. The helper and stylesheet are separate optional exports, so the core punctuation import does not load them. Load the CSS in your app's stylesheet or bundler entry; it is not a Node runtime module.

Opening straight and curly quotes remain real text, exactly once, for selection, copying, and accessibility. The browser shifts the quote by its own width; there is no canvas measurement, DOM read, resize observer, or per-token layout measurement. Existing emphasis and links can wrap the leading quote. Code, math, tables, and unknown custom elements are skipped; raw HTML and escaped opening quotes are skipped when their original source positions are available. Supply the original Markdown to unified's transform, as with the core plugin. Missing or unsupported locales pass through. Use `skip: node => ...` for extra application-specific exclusions.

Leave enough space in the left gutter and avoid clipping overflow. Custom renderers must preserve the generated `.typograph-opening` spans and `data-typograph-hanging` attribute. The stylesheet disables native hanging on affected blocks to prevent Safari hanging the quote twice. It does not set your font, line height, paragraph width, or alignment; opt out of centered, right-aligned, RTL, and vertical text. This is a small layout helper, not a full CSS-property polyfill. Use the memoization guidance above if toggling it at runtime.

The quote's separate inline block does not preserve pair kerning with the next letter. Pairs such as `“A` can look more open, especially at heading sizes. The helper does not measure fonts or add manual spacing corrections; check your chosen font and opt out where this tradeoff is undesirable.

## Instructions for your coding agent

The landing page's Integration section has one copyable, self-contained agent prompt. Set the three typography switches above the preview or in Integration, leave **Agent prompt** selected, and use **Copy prompt**. Paste it into the agent working in your app's repository. The prompt asks the agent to inspect the existing renderer and choose the appropriate integration, including guidance for AI Elements/shadcn, Cloudflare Agents, and other Remark renderers. It covers package installation, the exact selected settings, preservation of your app's design and raw messages, and verification. Select **Code** to reveal the stack buttons and choose a shorter manual configuration for the same settings.

## Paragraph endings: CSS first

For short final lines, prefer CSS `text-wrap: pretty` on completed prose. This lets the browser choose line breaks for the actual font and available width without inserting characters into the text. It is a progressive enhancement: support and wrapping choices vary by browser, and it does not guarantee a particular number of words on the last line.

```css
.assistant-prose p {
  text-wrap: wrap;
}

.assistant-prose[data-complete='true'] p {
  text-wrap: pretty;
}
```

Set `data-complete` on the wrapper for that message only after a verified successful finish. Keep normal wrapping while text streams to avoid repeatedly optimizing the changing final line. This is our recommended default for chat; profile long responses in the actual app. Reserve `text-wrap: balance` for short headings. CSS `orphans` controls lines across page or column breaks, not a lone final word.

Keep `spacing.lastWords` off by default. If a product specifically needs a no-break pair, it can opt into `{ locale: 'en', phase: 'complete', spacing: { lastWords: true } }` after that message finishes successfully. This joins words in eligible prose runs, not across every Markdown boundary; it can produce awkward spacing or long unbreakable groups at narrow widths. Nonbreaking spaces also appear when users select or copy rendered text. A stopped or failed stream becoming `ready` is not a successful finish.

References: [Chrome's explanation of pretty wrapping](https://developer.chrome.com/blog/css-text-wrap-pretty) and [MDN's text-wrap-style documentation](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-wrap-style).

## Scope and limits

- English only. Multilingual support is not promised.
- Code, math, raw HTML, link destinations, and literal content are protected.
- Use `skip: node => ...` to leave an application-selected subtree unchanged.
- Spacing is off by default. A token over 256 UTF-16 code units skips optional spacing for that prose run.
- The conservative streaming preset also works after completion. Advanced final-only rules require a verified successful finish, not merely `status === 'ready'`.
- No automatic dashes, ellipses, primes, hyphenation, or language detection.
- The plugin is not an HTML sanitizer. Retain your renderer's normal security configuration.
- The measured utility bundle is approximately 4 KB gzip, including Typehug. This excludes the host renderer, UI, fonts, and chat SDK.

## Verification and attribution

From the repository root: `npm run check`, `npm run test:chat-integration`, and `npm run bench:chat`. The browser fixture uses installed Chrome on macOS or Playwright Chromium on Linux. See the fixture README for browser installation.

MIT licensed. Optional no-break spacing uses Typehug: https://typehug.aliszu.com/ and https://github.com/alexszczurek/typehug. Third-party license notices ship with the package.
