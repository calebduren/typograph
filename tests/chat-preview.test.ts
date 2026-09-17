import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { chunkEnds, remarkPreview } from '../apps/playground/src/chat-preview';

describe('landing preview', () => {
  it('chunks Unicode and every line separator without losing the original source', () => {
    const source = '"Hello"\r\n😀 one\u2028two\u2029three';
    const ends = chunkEnds(source);
    expect(ends.at(-1)).toBe(source.length);
    expect(ends.every((end) => !/[\uD800-\uDBFF]$/.test(source.slice(0, end)))).toBe(true);
  });
  it('annotates actual prose changes while preserving code and destinations', () => {
    const source = '"Read [this](https://example.com/it\'s)." Keep `"code"`.';
    const processor = unified()
      .use(remarkParse)
      .use(remarkPreview, { spacing: false, highlight: true });
    const tree = processor.runSync(processor.parse(source), source);
    const json = JSON.stringify(tree);
    expect(json).toContain('"hName":"mark"');
    expect(json).toContain("https://example.com/it's");
    expect(json).toContain('"type":"inlineCode","value":"\\"code\\""');
  });
});
