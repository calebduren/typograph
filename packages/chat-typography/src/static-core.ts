import type { Root } from 'mdast';
import remarkChatTypography, { type ChatTypographyOptions } from './index';
import rehypeHangingPunctuation from './hanging';

export type TypesetTarget = 'web' | 'email' | 'markdown';

export interface TypesetOptions {
  /** Required. 'web' and 'email' return an HTML fragment; 'markdown' returns typeset Markdown. */
  target: TypesetTarget;
  /** A valid English language tag enables typography; otherwise text passes through. */
  locale?: string;
  punctuation?: ChatTypographyOptions['punctuation'];
  spacing?: ChatTypographyOptions['spacing'];
  skip?: ChatTypographyOptions['skip'];
  /** Parse `$…$` and `$$…$$` as math. Off by default: single dollars are usually currency. */
  math?: boolean;
  /** Opening-quote hanging markup for 'web' (default true). Ignored for 'email' and 'markdown'. */
  hanging?: boolean;
}

export type PeerName =
  'unified' | 'remark-parse' | 'remark-gfm' | 'remark-math' | 'remark-rehype' | 'rehype-stringify';
export type Peers = Record<PeerName, () => Promise<unknown>>;

interface Processor {
  use(plugin: unknown, options?: unknown): Processor;
  parse(value: string): unknown;
  process(value: string): Promise<{ toString(): string }>;
}
type Modules = Partial<Record<PeerName, { default?: unknown; unified?: () => Processor }>>;
type TextNode = { type: 'text'; value: string; position?: { start: Pos; end: Pos } };
type Pos = { offset?: number };
type Node = TextNode | { type: string; children?: Node[] };

const targets = new Set<TypesetTarget>(['web', 'email', 'markdown']);
// Only entities that model output plausibly contains; others abort the node's edits.
const entities: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
};

function isMissing(error: unknown, name: string): boolean {
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
  // A missing transitive dependency names a different package and propagates as is.
  return (
    code === 'ERR_MODULE_NOT_FOUND' && typeof message === 'string' && message.includes(`'${name}'`)
  );
}

function decode(reference: string): string | undefined {
  const body = reference.slice(1, -1);
  if (body[0] !== '#') return entities[body];
  const hex = body[1] === 'x' || body[1] === 'X';
  const point = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
  return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : undefined;
}

/**
 * Map each character of a text node's value to its source offset, or -1 when the
 * character came from an escape or entity. Returns undefined when alignment fails.
 */
function align(source: string, start: number, end: number, value: string): number[] | undefined {
  const map: number[] = [];
  let i = start;
  let j = 0;
  while (j < value.length) {
    if (i >= end) return undefined;
    if (source[i] === '&') {
      const match = /^&(?:#\d{1,7}|#[xX][\da-fA-F]{1,6}|[a-zA-Z][a-zA-Z\d]*);/.exec(
        source.slice(i, end),
      );
      if (match) {
        const decoded = decode(match[0]);
        if (decoded == null || !value.startsWith(decoded, j)) return undefined;
        for (let k = 0; k < decoded.length; k++) map.push(-1);
        i += match[0].length;
        j += decoded.length;
        continue;
      }
    }
    if (source[i] === value[j]) {
      map.push(i++);
      // Continuation indentation and blockquote markers are absent from the value.
      if (value[j++] === '\n') {
        while (i < end && /[ \t>]/.test(source[i]) && source[i] !== value[j]) i++;
      }
      continue;
    }
    if (source[i] === '\\' && source[i + 1] === value[j]) {
      map.push(-1);
      i += 2;
      j++;
      continue;
    }
    return undefined;
  }
  return i === end ? map : undefined;
}

function texts(root: Node): TextNode[] {
  const found: TextNode[] = [];
  const stack = [root];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.type === 'text') found.push(node as TextNode);
    const children = 'children' in node ? (node.children ?? []) : [];
    for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
  }
  return found;
}

/** Write the engine's length-preserving edits back into the original Markdown. */
function splice(source: string, root: Node, transform: (tree: Node) => void): string {
  const nodes = texts(root);
  const before = nodes.map((node) => node.value);
  transform(root);
  const chars = source.split('');
  nodes.forEach((node, index) => {
    const original = before[index];
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (node.value === original || start == null || end == null) return;
    const map = align(source, start, end, original);
    if (!map) return;
    for (let j = 0; j < node.value.length; j++) {
      const offset = map[j];
      if (node.value[j] !== original[j] && offset >= 0 && chars[offset] === original[j]) {
        chars[offset] = node.value[j];
      }
    }
  });
  return chars.join('');
}

export function createTypeset(peers: Peers) {
  const cache = new Map<PeerName, Promise<unknown>>();
  const load = (name: PeerName) => {
    let loading = cache.get(name);
    if (!loading) {
      loading = peers[name]();
      cache.set(name, loading);
      // Evict failures so a later install can succeed in a long-lived process.
      loading.catch(() => cache.delete(name));
    }
    return loading;
  };

  async function modules(names: PeerName[], target: TypesetTarget): Promise<Modules> {
    const results = await Promise.allSettled(names.map(load));
    const missing = names.filter(
      (name, i) => results[i].status === 'rejected' && isMissing(results[i].reason, name),
    );
    const failed = results.find((result) => result.status === 'rejected');
    if (failed && missing.length === 0) throw failed.reason;
    if (missing.length) {
      throw new Error(
        `@calebduren/typograph/static needs these packages for target "${target}": ${missing.join(', ')}. Install them alongside @calebduren/typograph.`,
        { cause: (failed as PromiseRejectedResult).reason },
      );
    }
    return Object.fromEntries(
      names.map((name, i) => [name, (results[i] as PromiseFulfilledResult<unknown>).value]),
    ) as Modules;
  }

  /** Typeset finished Markdown for the web, email, or back into Markdown. */
  return async function typeset(markdown: string, options: TypesetOptions): Promise<string> {
    const target = options?.target;
    if (!targets.has(target)) {
      throw new TypeError('typeset() needs a target: "web", "email", or "markdown".');
    }
    const names: PeerName[] = ['unified', 'remark-parse', 'remark-gfm'];
    if (options.math) names.push('remark-math');
    if (target !== 'markdown') names.push('remark-rehype', 'rehype-stringify');
    const loaded = await modules(names, target);

    let processor = loaded.unified!.unified!()
      .use(loaded['remark-parse']!.default)
      .use(loaded['remark-gfm']!.default);
    if (options.math) processor = processor.use(loaded['remark-math']!.default);
    const settings: ChatTypographyOptions = {
      locale: options.locale,
      phase: 'complete',
      punctuation: options.punctuation,
      spacing: options.spacing,
      skip: options.skip,
    };

    if (target === 'markdown') {
      const tree = processor.parse(markdown) as Node;
      const transform = remarkChatTypography(settings);
      return splice(markdown, tree, (root) => transform(root as Root, { value: markdown }));
    }
    processor = processor.use(remarkChatTypography, settings).use(loaded['remark-rehype']!.default);
    if (target === 'web' && options.hanging !== false) {
      processor = processor.use(rehypeHangingPunctuation, { locale: options.locale });
    }
    processor = processor.use(loaded['rehype-stringify']!.default);
    return String(await processor.process(markdown));
  };
}
