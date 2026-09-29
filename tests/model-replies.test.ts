import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import typography from '../packages/chat-typography/src/index';
import { typeset } from '../packages/chat-typography/src/static';

interface Entry {
  file: string;
  prompt: string;
  words: number;
}
interface TreeNode {
  type: string;
  value?: string;
  url?: string;
  children?: TreeNode[];
}

const corpus = new URL('../validation/model-replies/', import.meta.url);
const index = JSON.parse(readFileSync(new URL('index.json', corpus), 'utf8')) as Entry[];
const replies = index.map((entry) => ({
  ...entry,
  markdown: readFileSync(new URL(entry.file, corpus), 'utf8'),
}));

const NBSP = ' ';
const STRIDE = 61;
const complete = { target: 'markdown', locale: 'en', spacing: true } as const;
const allowed: Record<string, string> = {
  '"': '“”',
  "'": '‘’',
  ' ': NBSP,
};

const baseline = unified().use(remarkParse).use(remarkGfm);
const streaming = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(typography, { locale: 'en', spacing: true, phase: 'streaming' });

function collect(tree: TreeNode) {
  const texts: string[] = [];
  const protectedValues: string[] = [];
  (function walk(node: TreeNode) {
    if (node.type === 'text') texts.push(node.value ?? '');
    else if (node.type === 'inlineCode' || node.type === 'code') {
      protectedValues.push(`${node.type}:${node.value}`);
    } else if (node.type === 'link' || node.type === 'image' || node.type === 'definition') {
      protectedValues.push(`${node.type}.url:${node.url}`);
    }
    for (const child of node.children ?? []) walk(child);
  })(tree);
  return { texts, protectedValues };
}

function hex(ch: string) {
  return 'U+' + ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0');
}

function prefixViolations(markdown: string, n: number): string[] {
  const prefix = markdown.slice(0, n);
  const parsed = baseline.parse(prefix);
  const plain = collect(baseline.runSync(structuredClone(parsed), prefix) as TreeNode);
  const typeset_ = collect(streaming.runSync(parsed, prefix) as TreeNode);
  const found: string[] = [];
  if (plain.texts.length !== typeset_.texts.length) {
    found.push(
      `prefix ${n}: text node count expected ${plain.texts.length}, got ${typeset_.texts.length}`,
    );
    return found;
  }
  plain.texts.forEach((a, i) => {
    const b = typeset_.texts[i];
    if (a.length !== b.length) {
      found.push(`prefix ${n}, text ${i}: length expected ${a.length}, got ${b.length}`);
      return;
    }
    for (let j = 0; j < a.length; j++) {
      if (a[j] !== b[j] && !allowed[a[j]]?.includes(b[j])) {
        found.push(
          `prefix ${n}, text ${i}, offset ${j}: ${hex(a[j])} became ${hex(b[j])} in ${JSON.stringify(b.slice(Math.max(0, j - 20), j + 21))}`,
        );
      }
    }
  });
  if (JSON.stringify(plain.protectedValues) !== JSON.stringify(typeset_.protectedValues)) {
    const at = plain.protectedValues.findIndex((v, i) => v !== typeset_.protectedValues[i]);
    found.push(
      `prefix ${n}: protected value expected ${plain.protectedValues[at]}, got ${typeset_.protectedValues[at]}`,
    );
  }
  return found;
}

describe('model replies', () => {
  it('has a plausible corpus', () => {
    expect(replies.length).toBe(40);
    for (const reply of replies) {
      expect(reply.words).toBeGreaterThanOrEqual(150);
      expect(reply.words).toBeLessThanOrEqual(600);
    }
  });

  it.each(replies)('preserves UTF-16 length ($file)', async ({ markdown }) => {
    const output = await typeset(markdown, complete);
    expect(output.length).toBe(markdown.length);
  });

  it.each(replies)('streaming prefixes only curl quotes and add nbsp ($file)', ({ markdown }) => {
    const lengths: number[] = [];
    for (let n = 1; n <= markdown.length; n += STRIDE) lengths.push(n);
    if (lengths.at(-1) !== markdown.length) lengths.push(markdown.length);
    const violations = lengths.flatMap((n) => prefixViolations(markdown, n));
    expect(violations).toEqual([]);
  });

  it.each(replies)('is idempotent ($file)', async ({ markdown }) => {
    const once = await typeset(markdown, complete);
    const twice = await typeset(once, complete);
    expect(twice).toBe(once);
  });
});
