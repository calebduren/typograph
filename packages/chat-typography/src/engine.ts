// Internal engine shared by the Markdown, plain-string, and HTML entry points.
import { analyze } from '@typehug/en';
import type { Nodes } from 'mdast';
import { transparent } from './html-elements';
import { elisions, openingContext, closingContext } from './quote-context';

type Phase = 'streaming' | 'complete';

export interface ChatTypographyOptions {
  /** Required for transformations. Unsupported or missing locales pass through. */
  locale?: string;
  /** Defaults to streaming, including conservative lookahead at the right edge. */
  phase?: Phase;
  punctuation?: boolean | { quotes?: boolean; apostrophes?: boolean };
  /** Opt-in. Omitted spacing leaves whitespace unchanged. */
  spacing?:
    | boolean
    | {
        units?: boolean;
        initials?: boolean;
        abbreviations?: boolean;
        shortWords?: boolean;
        /** Applied only when phase is complete. Disabled by default. */
        lastWords?: boolean;
      };
  /** Leave an application-defined node and its descendants unchanged. */
  skip?: (node: Readonly<Nodes>) => boolean;
}

export type TextNode = {
  type: 'text';
  value: string;
  position?: { start?: { offset?: number }; end?: { offset?: number } };
};
export type Node = { type: string; value?: string; children?: Node[] };
const letter = /[\p{L}\p{M}]/u;
const word = /[\p{L}\p{M}\p{N}]/u;
const digit = /\p{N}/u;
const blankLine = /\r?\n[ \t]*\r?\n/g;
type QuoteState = { doubleOpen: boolean; singleOpen: boolean };

function before(source: string, index: number): string {
  if (index === 0) return '';
  const end = index;
  const low = source.charCodeAt(index - 1);
  return low >= 0xdc00 && low <= 0xdfff ? source.slice(end - 2, end) : source[end - 1];
}

function after(source: string, index: number): string {
  return index >= source.length ? '' : String.fromCodePoint(source.codePointAt(index)!);
}

export function protectionMask(source: string, mask = new Uint8Array(source.length)): Uint8Array {
  const protect = (start: number, end: number) => mask.fill(1, start, end);
  // Bare URLs and email addresses may still be prose nodes without remark-gfm.
  // Inspect each whitespace-delimited token once. An unanchored email regex can
  // retry a long word at every character, even when there is no @ in the input.
  for (const match of source.matchAll(/\S+/gu)) {
    const url = /(?:https?:\/\/|www\.)/i.exec(match[0]);
    if (url) {
      const end = /[<>"`)]/.exec(match[0].slice(url.index));
      protect(
        match.index + url.index,
        match.index + (end ? url.index + end.index : match[0].length),
      );
    }
    for (let at = match[0].indexOf('@'); at >= 0; at = match[0].indexOf('@', at + 1)) {
      let start = match.index + at;
      let end = start + 1;
      while (/[\p{L}\p{N}._%+'-]/u.test(before(source, start)))
        start -= before(source, start).length;
      while (/[\p{L}\p{N}.-]/u.test(after(source, end))) end += after(source, end).length;
      protect(start, end);
    }
  }
  // An unfinished inline code span is plain text until its closing backtick arrives.
  // Scan each paragraph boundary once, even when it contains many code spans.
  let paragraphEnd = 0;
  for (let index = 0; index < source.length;) {
    if (source[index] !== '`' || mask[index]) {
      index++;
      continue;
    }
    let end = index + 1;
    while (source[end] === '`' && !mask[end]) end++;
    if (index >= paragraphEnd) {
      blankLine.lastIndex = end;
      paragraphEnd = blankLine.exec(source)?.index ?? source.length;
    }
    const width = end - index;
    let close = end;
    while (close < paragraphEnd) {
      if (source[close] !== '`' || mask[close]) {
        close++;
        continue;
      }
      let next = close + 1;
      while (source[next] === '`' && !mask[next]) next++;
      if (next - close === width) {
        close = next;
        break;
      }
      close = next;
    }
    protect(index, close);
    index = close;
  }
  let destination = source.lastIndexOf('](');
  while (destination >= 0 && mask[destination]) {
    destination = destination === 0 ? -1 : source.lastIndexOf('](', destination - 1);
  }
  if (destination >= 0) {
    const tail = source.slice(destination + 2);
    if (!/[\n)]/.test(tail)) protect(destination + 1, source.length);
  }
  return mask;
}

function protectSourceSyntax(
  mask: Uint8Array,
  nodes: Writable[],
  original?: string,
  sourceMask?: Uint8Array,
): void {
  if (original == null) return;
  let runOffset = 0;
  for (const node of nodes) {
    const start = node.position?.start?.offset;
    const end = node.position?.end?.offset;
    if (start != null && end != null) {
      const raw = original.slice(start, end);
      if (raw.length === node.value.length && sourceMask) {
        for (let index = 0; index < raw.length; index++) {
          if (sourceMask[start + index]) mask[runOffset + index] = 1;
        }
      }
      let rawIndex = 0;
      let valueIndex = 0;
      while (rawIndex < raw.length && valueIndex < node.value.length) {
        if (raw[rawIndex] === '\\' && raw[rawIndex + 1] === node.value[valueIndex]) {
          if (node.value[valueIndex] === '"' || node.value[valueIndex] === "'") {
            mask[runOffset + valueIndex] = 1;
          }
          rawIndex += 2;
          valueIndex++;
        } else if (raw[rawIndex] === node.value[valueIndex]) {
          rawIndex++;
          valueIndex++;
        } else {
          // Entity decoding can change lengths. If an escape also exists later,
          // leave all quotes in this node alone instead of guessing its offset.
          if (/\\["']/u.test(raw)) {
            for (let index = 0; index < node.value.length; index++) {
              if (node.value[index] === '"' || node.value[index] === "'")
                mask[runOffset + index] = 1;
            }
          }
          break;
        }
      }
    }
    runOffset += node.value.length;
  }
}

function wordEnd(source: string, start: number): number {
  let end = start;
  while (end < source.length) {
    const next = after(source, end);
    if (!word.test(next)) break;
    end += next.length;
  }
  return end;
}

function rockElision(source: string, index: number): boolean {
  if (source.slice(index + 1, index + 3).toLowerCase() !== "n'") return false;
  let end = index + 3;
  while (/\s/u.test(source[end] ?? '')) end++;
  return (
    end > index + 3 &&
    source.slice(end, end + 4).toLowerCase() === 'roll' &&
    !word.test(after(source, end + 4))
  );
}

function inchesAfterFeet(source: string, index: number): boolean {
  let start = index;
  while (digit.test(before(source, start))) start -= before(source, start).length;
  while (/\s/u.test(before(source, start))) start -= before(source, start).length;
  return /['′]/u.test(before(source, start)) && digit.test(before(source, start - 1));
}

function smartPunctuation(
  source: string,
  mask: Uint8Array,
  settings: ChatTypographyOptions,
  terminalBoundary: boolean,
  state: QuoteState,
): string {
  const chars = source.split('');
  const punctuation = settings.punctuation;
  const quotes =
    punctuation !== false &&
    (punctuation === true || punctuation == null || punctuation.quotes !== false);
  const apostrophes =
    punctuation !== false &&
    (punctuation === true || punctuation == null || punctuation.apostrophes !== false);
  // Advance this lookahead only forwards, including in elision-heavy paragraphs.
  let nextSingleQuote = 0;
  for (let index = 0; index < source.length; index++) {
    const current = source[index];
    if (mask[index] || !/['"“”‘’]/u.test(current)) continue;
    const prev = before(source, index);
    const next = after(source, index + 1);
    if (current === '“') {
      state.doubleOpen = true;
      continue;
    }
    if (current === '”') {
      state.doubleOpen = false;
      continue;
    }
    if (current === '‘') {
      state.singleOpen = true;
      continue;
    }
    if (current === '’') {
      if (!next || closingContext.test(next)) state.singleOpen = false;
      continue;
    }
    if (current === '"' && quotes) {
      if (prev === '"' || next === '"') continue; // Empty/adjacent marks are ambiguous.
      if (digit.test(prev) && inchesAfterFeet(source, index)) continue;
      if (digit.test(prev) && !state.doubleOpen) continue; // Inch mark or coordinate: do not guess.
      if (!next && !state.doubleOpen) continue; // An isolated mark has no reliable direction.
      if (state.doubleOpen && (!next || closingContext.test(next))) {
        chars[index] = '”';
        state.doubleOpen = false;
      } else if ((!prev || openingContext.test(prev) || /[:;—–]/u.test(prev)) && next) {
        chars[index] = '“';
        state.doubleOpen = true;
      } else if (word.test(prev) && (!next || closingContext.test(next))) {
        if (state.doubleOpen) {
          chars[index] = '”';
          state.doubleOpen = false;
        }
      }
      continue;
    }
    if (current !== "'") continue;
    if (digit.test(prev)) {
      // A digit, then 's and a word boundary (Q3's, 2025's, 1990's) is a possessive
      // or plural, never a prime. The final edge waits, as elisions do, while streaming.
      if (/[sS]/u.test(next) && !mask[index + 1]) {
        const following = after(source, index + 2);
        if (following ? !word.test(following) : terminalBoundary || settings.phase === 'complete') {
          if (apostrophes) chars[index] = '’';
          continue;
        }
      }
      if (!state.singleOpen) continue; // Feet, minutes, and coordinates.
    }
    if (letter.test(prev) && letter.test(next)) {
      if (apostrophes) chars[index] = '’';
      continue;
    }
    if (letter.test(prev) && next === '(') continue; // f'(x) is not a possessive.
    if (state.singleOpen && (closingContext.test(next) || !next)) {
      if (quotes) chars[index] = '’';
      state.singleOpen = false;
      continue;
    }
    if (letter.test(prev) && (!next || closingContext.test(next))) {
      if (apostrophes) chars[index] = '’';
      continue;
    }
    const opening = !prev || openingContext.test(prev) || /[:;—–]/u.test(prev);
    if (!opening || !next) continue;
    const end = wordEnd(source, index + 1);
    // Elision words are at most five characters. Never lowercase the suffix.
    const token = source.slice(index + 1, Math.min(end, index + 7)).toLowerCase();
    const rock = rockElision(source, index);
    if (
      end > index + 1 &&
      source[end] === "'" &&
      (!source[end + 1] || closingContext.test(source[end + 1])) &&
      !rock
    ) {
      if (quotes) chars[index] = '‘';
      state.singleOpen = true;
      continue;
    }
    const elision = /^\d{2}s$/i.test(token) || (token === 'n' ? rock : elisions.includes(token));
    if (elision) {
      if (!rock) {
        if (nextSingleQuote <= index) {
          nextSingleQuote = index + 1;
          while (nextSingleQuote < source.length) {
            if (!mask[nextSingleQuote] && /['’]/u.test(source[nextSingleQuote])) {
              const preceding = before(source, nextSingleQuote);
              const following = after(source, nextSingleQuote + 1);
              // Contractions, likely plural possessives, and measurements do not close the phrase.
              if (
                !(letter.test(preceding) && letter.test(following)) &&
                !(preceding.toLowerCase() === 's' && /\s/u.test(following)) &&
                !digit.test(preceding)
              )
                break;
            }
            nextSingleQuote++;
          }
        }
        const following = after(source, nextSingleQuote + 1);
        if (
          nextSingleQuote < source.length &&
          !openingContext.test(before(source, nextSingleQuote)) &&
          (!following || closingContext.test(following))
        ) {
          if (quotes) chars[index] = '‘';
          state.singleOpen = true;
          continue;
        }
      }
      const boundary = after(source, end) || (terminalBoundary ? ' ' : '');
      if (apostrophes && (settings.phase === 'complete' || boundary)) chars[index] = '’';
    } else if (
      (!(/^\d{0,2}$/.test(token) || elisions.some((candidate) => candidate.startsWith(token))) &&
        word.test(next)) ||
      (/["“]/u.test(next) && word.test(after(source, index + 2)))
    ) {
      if (quotes) chars[index] = '‘';
      state.singleOpen = true;
    }
  }
  return chars.join('');
}

function applySpacing(
  source: string,
  mask: Uint8Array,
  settings: ChatTypographyOptions,
  terminalBoundary: boolean,
): string {
  const spacing = settings.spacing;
  if (!spacing) return source;
  // Typehug 0.2's URL/email recognizers retry within long tokens. Skip this
  // optional refinement for the entire run rather than block a streaming UI.
  for (const match of source.matchAll(/[^\s\u0085]+/gu)) {
    if (match[0].length > 256) return source;
  }
  const rules = typeof spacing === 'object' ? spacing : {};
  const result = analyze(source, {
    rules: {
      units: rules.units !== false,
      initials: rules.initials !== false,
      abbreviations: rules.abbreviations !== false,
      shortWords: rules.shortWords === true,
      lastWords: settings.phase === 'complete' && rules.lastWords === true,
    },
  });
  if (result.changes.length === 0) return source;
  const chars = source.split('');
  for (const change of result.changes) {
    const position = change.start;
    if (mask[position] || mask[position + 1]) continue;
    if (settings.phase !== 'complete') {
      // A candidate ending at the current right edge may still grow into another word.
      const suffix = source.slice(position + 1);
      if (!terminalBoundary && /^[\p{L}\p{N}]+$/u.test(suffix)) continue;
    }
    chars[position] = '\u00a0';
  }
  return chars.join('');
}

/** A text value the core may rewrite, with its source position when known. */
export type Writable = {
  value: string;
  position?: { start?: { offset?: number }; end?: { offset?: number } };
};
/**
 * The core's input: real text in document order, literal stand-ins for protected
 * content, and boundaries that end a spacing run while punctuation context continues.
 */
export type Segment =
  { kind: 'text'; node: Writable } | { kind: 'literal'; value: string } | { kind: 'boundary' };
export interface CoreHooks {
  /** Extra protection after the string-level mask; receives every node, literals included. */
  protect?(mask: Uint8Array, nodes: Writable[]): void;
  /** Whether the text after these nodes is known to end at a word boundary. */
  boundary(nodes: Writable[]): boolean;
}

// Void elements never have content; any other element may wrap its own.
const voidElements = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);
// One raw inline HTML tag. Comments, processing instructions, and declarations do not match.
const htmlTag = /^<(\/?)([A-Za-z][A-Za-z0-9-]*)(?:[\s/][\s\S]*)?>$/;

type Collected = Segment | { kind: 'open'; name: string } | { kind: 'close'; name: string };

/**
 * Classify a raw inline HTML node the way the rehype entry point treats the element:
 * inline formatting is invisible, links end a spacing run, and anything else is opaque.
 */
function htmlSegment(value: string): Collected {
  const match = htmlTag.exec(value);
  const name = match?.[2].toLowerCase();
  if (!match || !name || transparent.has(name)) return { kind: 'literal', value: '' };
  if (name === 'a') return { kind: 'boundary' };
  if (name === 'br') return { kind: 'literal', value: '\n' };
  if (name === 'wbr') return { kind: 'literal', value: '' };
  if (match[1]) return { kind: 'close', name };
  if (value.endsWith('/>') || voidElements.has(name)) return { kind: 'literal', value: '\ufffc' };
  return { kind: 'open', name };
}

/**
 * A matched open/close pair and everything between them become one protected
 * stand-in. Matching runs on the flattened stream, so it crosses emphasis and
 * links; a stack per name pairs nested elements of the same name. An unmatched
 * tag, such as a streaming partial, stands alone and later text stays prose.
 */
function resolveElements(items: Collected[]): Segment[] {
  const closeAt = new Map<number, number>();
  const pending = new Map<string, number[]>();
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (item.kind === 'open') {
      const opens = pending.get(item.name);
      if (opens) opens.push(index);
      else pending.set(item.name, [index]);
    } else if (item.kind === 'close') {
      const start = pending.get(item.name)?.pop();
      if (start != null) closeAt.set(start, index);
    }
  }
  const segments: Segment[] = [];
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (item.kind === 'open' || item.kind === 'close') {
      segments.push({ kind: 'literal', value: '\ufffc' });
      index = closeAt.get(index) ?? index;
    } else {
      segments.push(item);
    }
  }
  return segments;
}

function collectMdastSegments(parent: Node, settings: ChatTypographyOptions): Segment[] {
  const items: Collected[] = [];
  let elements = false;
  const stack: (Node | null)[] = [...(parent.children ?? [])].reverse();
  while (stack.length) {
    const node = stack.pop();
    if (!node) {
      items.push({ kind: 'boundary' });
    } else if (settings.skip?.(node as Nodes)) {
      items.push({ kind: 'literal', value: '\ufffc' });
    } else if (node.type === 'text' && typeof node.value === 'string') {
      items.push({ kind: 'text', node: node as TextNode });
    } else if (['emphasis', 'strong', 'delete'].includes(node.type)) {
      const children = node.children ?? [];
      for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
    } else if (node.type === 'link' || node.type === 'linkReference') {
      items.push({ kind: 'boundary' });
      stack.push(null);
      const children = node.children ?? [];
      for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
    } else if (node.type === 'html') {
      const item = htmlSegment(node.value ?? '');
      if (item.kind === 'open' || item.kind === 'close') elements = true;
      items.push(item);
    } else {
      const value = node.type === 'break' ? '\n' : (node.value ?? '\ufffc');
      items.push({ kind: 'literal', value });
    }
  }
  return elements ? resolveElements(items) : (items as Segment[]);
}

export function typesetSegments(
  segments: Segment[],
  settings: ChatTypographyOptions,
  hooks: CoreHooks,
): void {
  // Punctuation sees the whole visible block; spacing remains local to prose
  // runs so a no-break pair cannot cross a link, code, or skipped subtree.
  const runs: { nodes: Writable[]; literal?: boolean }[] = [];
  let run: Writable[] = [];
  const flush = () => {
    if (run.length) runs.push({ nodes: run });
    run = [];
  };
  for (const segment of segments) {
    if (segment.kind === 'text') {
      run.push(segment.node);
    } else {
      flush();
      if (segment.kind === 'literal')
        runs.push({ nodes: [{ value: segment.value }], literal: true });
    }
  }
  flush();

  const nodes = runs.flatMap((part) => part.nodes);
  const source = nodes.map((node) => node.value).join('');
  if (!source) return;
  const mask = new Uint8Array(source.length);
  let offset = 0;
  for (const part of runs) {
    const length = part.nodes.reduce((total, node) => total + node.value.length, 0);
    if (part.literal) mask.fill(1, offset, offset + length);
    offset += length;
  }
  protectionMask(source, mask);
  hooks.protect?.(mask, nodes);
  const punctuated = smartPunctuation(source, mask, settings, hooks.boundary(nodes), {
    doubleOpen: false,
    singleOpen: false,
  });
  offset = 0;
  for (const part of runs) {
    const length = part.nodes.reduce((total, node) => total + node.value.length, 0);
    if (!part.literal) {
      const transformed = applySpacing(
        punctuated.slice(offset, offset + length),
        mask.subarray(offset, offset + length),
        settings,
        hooks.boundary(part.nodes),
      );
      let local = 0;
      for (const node of part.nodes) {
        node.value = transformed.slice(local, local + node.value.length);
        local += node.value.length;
      }
    }
    offset += length;
  }
}

function formatInline(
  parent: Node,
  settings: ChatTypographyOptions,
  original?: string,
  sourceMask?: Uint8Array,
): void {
  typesetSegments(collectMdastSegments(parent, settings), settings, {
    protect: (mask, nodes) => protectSourceSyntax(mask, nodes, original, sourceMask),
    boundary: (nodes) => {
      const end = nodes.at(-1)?.position?.end?.offset;
      return original != null && end != null && /\s/u.test(original[end] ?? '');
    },
  });
}

export function visit(
  root: Node,
  settings: ChatTypographyOptions,
  original?: string,
  sourceMask?: Uint8Array,
): void {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop()!;
    if (settings.skip?.(node as Nodes)) continue;
    if (['paragraph', 'heading', 'tableCell'].includes(node.type)) {
      formatInline(node, settings, original, sourceMask);
    } else {
      const children = node.children ?? [];
      for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
    }
  }
}
