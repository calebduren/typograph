export type TypographySettings = { punctuation: boolean; spacing: boolean; hanging: boolean };
export const defaultSettings: TypographySettings = {
  punctuation: true,
  spacing: true,
  hanging: true,
};
export const integrationStacks = ['AI Elements', 'Cloudflare', 'Remark'] as const;
export type IntegrationStack = (typeof integrationStacks)[number];

export function settingsSummary(settings: TypographySettings): string {
  return (
    [
      settings.punctuation && 'Smart punctuation',
      settings.spacing && 'Non-breaking spaces',
      settings.hanging && 'Hanging punctuation',
    ]
      .filter(Boolean)
      .join(' · ') || 'All refinements off'
  );
}

export function pluginOptions(settings: TypographySettings): string {
  return `{ locale: 'en', punctuation: ${settings.punctuation}, spacing: ${settings.spacing} }`;
}

export function integrationCode(stack: IntegrationStack, settings: TypographySettings): string {
  const imports = `import typography from '@calebduren/typograph';${settings.hanging ? "\nimport hangingPunctuation from '@calebduren/typograph/hanging';\nimport '@calebduren/typograph/hanging.css';" : ''}`;
  if (stack === 'Remark') {
    return `import { unified } from 'unified';
import remarkParse from 'remark-parse';${settings.hanging ? "\nimport remarkRehype from 'remark-rehype';" : ''}
${imports}

const processor = unified()
  .use(remarkParse)
  .use(typography, ${pluginOptions(settings)})${
    settings.hanging
      ? `
  .use(remarkRehype)
  // Keep your existing sanitization before this layout plugin.
  .use(hangingPunctuation, { locale: 'en' })`
      : ''
  };

// Pass original Markdown to protect escaped punctuation.
const tree = processor.runSync(processor.parse(markdown), markdown);
// Continue through your existing renderer.${settings.hanging ? '\n// Leave room in the gutter for opening quotes.\n// Preserve generated span classes when rendering the HTML tree.' : ''}`;
  }
  const component = stack === 'AI Elements' ? 'MessageResponse' : 'Streamdown';
  return `${imports}
import { ${stack === 'Cloudflare' ? 'Streamdown, ' : ''}defaultRemarkPlugins, ${settings.hanging ? 'defaultRehypePlugins, ' : ''}type StreamdownProps } from 'streamdown';${stack === 'AI Elements' ? "\nimport { MessageResponse } from '@/components/ai-elements/message';" : ''}

// Keep any additional plugins your app already uses.
const remarkPlugins: StreamdownProps['remarkPlugins'] = [
  ...Object.values(defaultRemarkPlugins),
  [typography, ${pluginOptions(settings)}],
];${
    settings.hanging
      ? `
const rehypePlugins: StreamdownProps['rehypePlugins'] = [
  ...Object.values(defaultRehypePlugins),
  [hangingPunctuation, { locale: 'en' }],
];`
      : ''
  }

// ${stack === 'Cloudflare' ? 'Assistant text from useAgentChat; transport stays unchanged.' : 'In your assistant text renderer:'}
<${component} remarkPlugins={remarkPlugins}${settings.hanging ? ' rehypePlugins={rehypePlugins}' : ''} isAnimating={isStreaming}>
  {part.text}
</${component}>${settings.hanging ? '\n// Leave room in the gutter for opening quotes.' : ''}`;
}
