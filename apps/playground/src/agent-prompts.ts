import {
  pluginOptions,
  settingsSummary,
  type IntegrationStack,
  type TypographySettings,
} from './integration-settings';

const stackInstructions = {
  'AI Elements': `This app uses Vercel AI SDK, AI Elements, or shadcn. Find the assistant text-part renderer and its owned MessageResponse component. Add the Remark plugin there, preserving Streamdown's default plugins and any app-specific plugins. Keep useChat, transport, tool components, and message storage unchanged. Inspect the installed versions: if rules can change at runtime, check MessageResponse and Streamdown memoization against examples/chat-integration/src/typography-response.tsx in the source repository. Do not force React key remounts.`,
  Cloudflare: `This app uses Cloudflare Agents. Find the assistant text-part renderer fed by useAgentChat. Add the Remark plugin to its existing Markdown renderer; use Streamdown's remarkPlugins if that is already installed. Preserve default and app-specific plugins. Keep the Worker, Durable Object, WebSocket transport, persistence, and reconnect behavior unchanged. Typography belongs in the presentation layer.`,
  Remark: `Find this app's existing Remark or unified Markdown pipeline and add the plugin once, preserving all existing plugins and sanitization. With unified, supply the original Markdown to the transformer: processor.runSync(processor.parse(markdown), markdown). This preserves escaped punctuation and unfinished syntax. If the app has no compatible Markdown pipeline, explain the smallest compatible integration before introducing a new renderer.`,
};

export function agentPrompt(stack: IntegrationStack, settings: TypographySettings): string {
  return `Integrate Typograph into this app's assistant responses. Inspect the framework, package manager, renderer, and installed versions first. Preserve the product's fonts, styling, components, and existing behavior.

SOURCE AND INSTALLATION
Source: https://github.com/calebduren/typograph
The candidate is packages/chat-typography; read its README and apps/playground/public/integration.md. This is a pre-release: @typograph/chat is not published on npm. Use a supplied checkout containing the candidate, or verify it exists in the source repository. With Node 22+, run npm ci, npm run build:chat, and npm pack -w @typograph/chat in that checkout; install the resulting .tgz in this app using its package manager. If the candidate is unavailable, report what is missing. Do not invent a public install command.

SELECTED SETTINGS
Smart punctuation: ${settings.punctuation ? 'on' : 'off'}
Non-breaking spaces: ${settings.spacing ? 'on' : 'off'}
Hanging punctuation: ${settings.hanging ? 'on (opening quotes only)' : 'off'}
Apply this exact configuration: ${settingsSummary(settings)}. Demo highlighting is not a product feature and must not be installed.

INTEGRATION
${stackInstructions[stack]}

Import typography from '@typograph/chat' and register [typography, ${pluginOptions(settings)}] only for responses known to be English. This is English-only, with one house style and no language detection. Unknown, other-language, mixed-language, or verbatim responses should opt out. ${settings.spacing ? 'Enable conservative unit, initial, and abbreviation joins. Leave shortWords and lastWords off.' : 'Leave whitespace unchanged.'} Keep plugin configuration stable between renders and preserve the original Markdown source for the Remark transform.

${settings.hanging ? "Import hangingPunctuation from '@typograph/chat/hanging' and import '@typograph/chat/hanging.css'. Add [hangingPunctuation, { locale: 'en' }] to the existing rehype pipeline AFTER sanitization. In Streamdown, preserve ...Object.values(defaultRehypePlugins) before it. In unified, use the existing Remark-to-Rehype conversion before it. This helper hangs opening quotes at the start of English, left-aligned paragraphs and headings. Preserve its generated span classes and data-typograph-hanging attribute in custom components; reserve gutter space and avoid clipping. It uses real text and standard CSS, with no native hanging-punctuation dependency or DOM measurements. It does not hang marks at every wrapped line ending. Check renderer memoization if this setting can change at runtime." : 'Do not add the hanging-punctuation helper or its CSS.'}

Preserve raw SDK messages for storage, tool execution, and Copy original. Transform rendered prose only. Keep code, math, HTML, URLs, link destinations, and escaped punctuation protected. Retain the existing renderer's security settings; this plugin is not a sanitizer.

PARAGRAPH ENDINGS
For orphan control, prefer progressive-enhancement CSS text-wrap: pretty on completed assistant prose paragraphs, leaving normal wrapping during streaming. Do not force nonbreaking spaces between the final two words. Keep spacing.lastWords off unless explicitly requested; it requires phase: 'complete' after a verified successful finish for that message, never simply status === 'ready'. Unsupported CSS should fall back to normal wrapping.

VERIFY
Check English quotes and apostrophes, links and emphasis, literal code and math, streaming prefixes, stop/error/retry, and original-text copying. Verify narrow screens and long replies. Run the app's relevant tests and typecheck, then summarize the changes, checks, and any limitations.`;
}
