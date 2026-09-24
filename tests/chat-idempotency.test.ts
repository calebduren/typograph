import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import type { Root } from 'mdast';
import remarkChatTypography, {
  type ChatTypographyOptions,
} from '../packages/chat-typography/src/index';

interface Case {
  id: string;
  input: string;
  locale?: string;
}
const cases = JSON.parse(
  readFileSync(new URL('../validation/cases.json', import.meta.url), 'utf8'),
) as Case[];

const configs: { name: string; options: ChatTypographyOptions }[] = [
  { name: 'complete, default spacing', options: { phase: 'complete', spacing: true } },
  { name: 'streaming, default spacing', options: { phase: 'streaming', spacing: true } },
  {
    name: 'complete, all spacing',
    options: { phase: 'complete', spacing: { shortWords: true, lastWords: true } },
  },
  {
    name: 'streaming, all spacing',
    options: { phase: 'streaming', spacing: { shortWords: true, lastWords: true } },
  },
];

// remark-stringify writes `\"` back as a bare quote, so the second pass curls it.
// The static `markdown` target splices into the source instead (plan 009).
const stringifyLosses = ['escaped-after-entity', 'escaped-quote'];

const processor = (options: ChatTypographyOptions) =>
  unified().use(remarkParse).use(remarkMath).use(remarkGfm).use(remarkChatTypography, options);

const visible = (node: any): string => {
  if (['text', 'inlineCode', 'code', 'math', 'inlineMath'].includes(node.type)) return node.value;
  if (node.type === 'break') return '\n';
  return (node.children ?? []).map(visible).join(node.type === 'root' ? '\n\n' : '');
};

function typeset(input: string, options: ChatTypographyOptions): Root {
  const run = processor(options);
  return run.runSync(run.parse(input), input) as Root;
}

function reparse(fixture: Case, options: ChatTypographyOptions) {
  const settings = { locale: fixture.locale ?? 'en', ...options };
  const first = typeset(fixture.input, settings);
  const markdown = unified().use(remarkMath).use(remarkGfm).use(remarkStringify).stringify(first);
  return { first: visible(first), second: visible(typeset(markdown, settings)) };
}

describe('idempotency', () => {
  it.each(configs)('leaves a typeset tree unchanged on a second run ($name)', ({ options }) => {
    const changed = cases.filter((fixture) => {
      const input = fixture.input;
      const run = processor({ locale: fixture.locale ?? 'en', ...options });
      const tree = run.parse(input);
      run.runSync(tree, input);
      const once = JSON.stringify(tree);
      run.runSync(tree, input);
      return JSON.stringify(tree) !== once;
    });
    expect(changed.map((fixture) => fixture.id)).toEqual([]);
  });

  it.each(configs)('survives serialize and reparse, except known losses ($name)', ({ options }) => {
    const changed = cases.filter((fixture) => {
      const { first, second } = reparse(fixture, options);
      return first !== second;
    });
    expect(changed.map((fixture) => fixture.id).sort()).toEqual(stringifyLosses);
  });

  it.each(stringifyLosses)('pins the remark-stringify escape loss for %s', (id) => {
    const { first, second } = reparse(
      cases.find((fixture) => fixture.id === id)!,
      {
        phase: 'complete',
        spacing: true,
      },
    );
    expect(first).not.toMatch(/[“”]/);
    expect(second).toMatch(/[“”]/);
  });

  it.each([
    ['“Hello,” she said. "Goodbye," he replied.', '“Hello,” she said. “Goodbye,” he replied.'],
    ['It’s 30\u00a0min and it\'s "fine."', 'It’s 30\u00a0min and it’s “fine.”'],
    ["‘Quoted’ and 'quoted' with Bob’s and Bob's.", '‘Quoted’ and ‘quoted’ with Bob’s and Bob’s.'],
    ['J.\u00a0R. R. Tolkien wrote "it."', 'J.\u00a0R.\u00a0R. Tolkien wrote “it.”'],
  ])('keeps already-typeset input stable: %s', (input, expected) => {
    const options: ChatTypographyOptions = { locale: 'en', phase: 'complete', spacing: true };
    const once = visible(typeset(input, options));
    expect(once).toBe(expected);
    expect(visible(typeset(once, options))).toBe(once);
  });
});
