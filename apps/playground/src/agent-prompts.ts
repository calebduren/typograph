import { pluginOptions, settingsSummary, type TypographySettings } from './integration-settings';

export function agentPrompt(settings: TypographySettings): string {
  return `Integrate Typograph into this app's assistant responses. Inspect the framework, package manager, renderer, and installed versions first. Preserve the product's fonts, styling, components, and existing behavior.

SOURCE AND INSTALLATION
Source: https://github.com/calebduren/typograph
Install @calebduren/typograph using this app's package manager (npm install @calebduren/typograph for npm). Read the installed package's README and https://typograph.dev/integration.md. The package is ESM, runs in the browser, and requires Node 22+ for server use. Its source and integration fixture are in the repository above.

SELECTED SETTINGS
Smart punctuation: ${settings.punctuation ? 'on' : 'off'}
Non-breaking spaces: ${settings.spacing ? 'on' : 'off'}
Hanging punctuation: ${settings.hanging ? 'on (opening quotes only)' : 'off'}
Apply this exact configuration: ${settingsSummary(settings)}. Demo highlighting is not a product feature and must not be installed.

INTEGRATION
Choose the integration that matches the app's existing renderer. Add the Remark plugin once in the assistant text-part renderer, preserving default and app-specific plugins and sanitization. Typography belongs in the presentation layer; keep transports, tool components, and message storage unchanged.

If the app uses AI Elements, find its owned MessageResponse component. With Streamdown, use remarkPlugins and preserve its defaults. If rules can change at runtime, inspect the installed versions and check MessageResponse and Streamdown memoization against examples/chat-integration/src/typography-response.tsx in the source repository. Do not force React key remounts.

If the app uses Cloudflare Agents, find the renderer fed by useAgentChat. Keep the Worker, Durable Object, WebSocket transport, persistence, and reconnect behavior unchanged. The same renderer integration applies.

With unified, supply the original Markdown to the transformer: processor.runSync(processor.parse(markdown), markdown). This preserves escaped punctuation and unfinished syntax. If the app has no compatible Markdown pipeline, explain the smallest compatible integration before introducing a new renderer.

Import typography from '@calebduren/typograph' and register [typography, ${pluginOptions(settings)}] only for responses known to be English. This is English-only, with one house style and no language detection. Unknown, other-language, mixed-language, or verbatim responses should opt out. ${settings.spacing ? 'Enable conservative unit, initial, and abbreviation joins. Leave shortWords and lastWords off.' : 'Leave whitespace unchanged.'} Keep plugin configuration stable between renders and preserve the original Markdown source for the Remark transform.

${settings.hanging ? "Import hangingPunctuation from '@calebduren/typograph/hanging' and import '@calebduren/typograph/hanging.css'. Add [hangingPunctuation, { locale: 'en' }] to the existing rehype pipeline AFTER sanitization. In Streamdown, preserve ...Object.values(defaultRehypePlugins) before it. In unified, use the existing Remark-to-Rehype conversion before it. This helper hangs opening quotes at the start of English, left-aligned paragraphs and headings outside lists. Quotes in bulleted and numbered lists stay inline. Preserve its generated span classes and data-typograph-hanging attribute in custom components; reserve gutter space and avoid clipping. It uses real text and standard CSS, with no native hanging-punctuation dependency or DOM measurements. It does not hang marks at every wrapped line ending. Check renderer memoization if this setting can change at runtime." : 'Do not add the hanging-punctuation helper or its CSS.'}

Preserve raw SDK messages for storage, tool execution, and Copy original. Transform rendered prose only. Keep code, math, HTML, URLs, link destinations, and escaped punctuation protected. Retain the existing renderer's security settings; this plugin is not a sanitizer.

FINISHED TEXT
If the app also shows AI text that is complete before display (scheduled briefs, email, summaries, titles, notifications), typeset it once when it is finished. For Markdown, use typeset(markdown, { target, locale: 'en', punctuation: ${settings.punctuation}, spacing: ${settings.spacing} }) from '@calebduren/typograph/static'. Target 'web' returns HTML${settings.hanging ? ' with hanging markup that needs the same hanging.css' : ''}, 'email' returns HTML without hanging markup, and 'markdown' returns typeset Markdown with its formatting kept. Install the peers the README lists for the chosen target. For finished HTML, such as an email template that already contains the text, use typeset(html, { input: 'html', target: 'email', locale: 'en', punctuation: ${settings.punctuation}, spacing: ${settings.spacing} }); it returns the HTML with only typographic characters changed, curls template-escaped quotes such as &quot;, and needs unified and rehype-parse. For plain strings that are not Markdown, use the synchronous typesetText(text, { locale: 'en', punctuation: ${settings.punctuation}, spacing: ${settings.spacing} }) from '@calebduren/typograph'. Skip this section if the app has no such text.

PARAGRAPH ENDINGS
For orphan control, prefer progressive-enhancement CSS text-wrap: pretty on completed assistant prose paragraphs, leaving normal wrapping during streaming. Do not force nonbreaking spaces between the final two words. Keep spacing.lastWords off unless explicitly requested; it requires phase: 'complete' after a verified successful finish for that message, never simply status === 'ready'. Unsupported CSS should fall back to normal wrapping.

VERIFY
Check English quotes and apostrophes, links and emphasis, literal code and math, streaming prefixes, stop/error/retry, and original-text copying. Verify narrow screens and long replies. Run the app's relevant tests and typecheck, then summarize the changes, checks, and any limitations.`;
}
