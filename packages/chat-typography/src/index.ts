import { analyze } from '@typehug/en';
import type { Root, Nodes } from 'mdast';
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

type TextNode = {
  type: 'text';
  value: string;
  position?: { start?: { offset?: number }; end?: { offset?: number } };
};
type Node = { type: string; value?: string; children?: Node[] };
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

function protectionMask(source: string, mask = new Uint8Array(source.length)): Uint8Array {
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
  nodes: TextNode[],
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
    if (digit.test(prev) && !state.singleOpen) continue; // Feet, minutes, and coordinates.
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

function formatInline(
  parent: Node,
  settings: ChatTypographyOptions,
  original?: string,
  sourceMask?: Uint8Array,
): void {
  // Punctuation sees the whole visible block; spacing remains local to prose
  // runs so a no-break pair cannot cross a link, code, or skipped subtree.
  const runs: { nodes: TextNode[]; literal?: boolean }[] = [];
  let run: TextNode[] = [];
  const flush = () => {
    if (run.length) runs.push({ nodes: run });
    run = [];
  };
  const stack: (Node | null)[] = [...(parent.children ?? [])].reverse();
  while (stack.length) {
    const node = stack.pop();
    if (!node) {
      flush();
      continue;
    }
    if (settings.skip?.(node as Nodes)) {
      flush();
      runs.push({ nodes: [{ type: 'text', value: '\ufffc' }], literal: true });
    } else if (node.type === 'text' && typeof node.value === 'string') {
      run.push(node as TextNode);
    } else if (['emphasis', 'strong', 'delete'].includes(node.type)) {
      const children = node.children ?? [];
      for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
    } else if (node.type === 'link' || node.type === 'linkReference') {
      flush();
      stack.push(null);
      const children = node.children ?? [];
      for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
    } else {
      flush();
      const value =
        node.type === 'html' ? '' : node.type === 'break' ? '\n' : (node.value ?? '\ufffc');
      runs.push({ nodes: [{ type: 'text', value }], literal: true });
    }
  }
  flush();

  const nodes = runs.flatMap((part) => part.nodes);
  const source = nodes.map((node) => node.value).join('');
  if (!source) return;
  const boundary = (nodes: TextNode[]) => {
    const end = nodes.at(-1)?.position?.end?.offset;
    return original != null && end != null && /\s/u.test(original[end] ?? '');
  };
  const mask = new Uint8Array(source.length);
  let offset = 0;
  for (const part of runs) {
    const length = part.nodes.reduce((total, node) => total + node.value.length, 0);
    if (part.literal) mask.fill(1, offset, offset + length);
    offset += length;
  }
  protectionMask(source, mask);
  protectSourceSyntax(mask, nodes, original, sourceMask);
  const punctuated = smartPunctuation(source, mask, settings, boundary(nodes), {
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
        boundary(part.nodes),
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

function visit(
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

/** Remark plugin for presentation-only typography in a parsed Markdown reply. */
export default function remarkChatTypography(options: ChatTypographyOptions = {}) {
  let english = false;
  try {
    english =
      options.locale != null && Intl.getCanonicalLocales(options.locale)[0]?.split('-')[0] === 'en';
  } catch {
    /* Invalid language tags pass through, just like unsupported ones. */
  }
  return (tree: Root, file?: { value: unknown }): void => {
    if (!english) return;
    const original = typeof file?.value === 'string' ? file.value : undefined;
    visit(
      tree as unknown as Node,
      options,
      original,
      original ? protectionMask(original) : undefined,
    );
  };
}

export type TypesetTextOptions = Pick<
  ChatTypographyOptions,
  'locale' | 'phase' | 'punctuation' | 'spacing'
>;

/** Typeset a plain string (no Markdown syntax). Output length always equals input length. */
export function typesetText(text: string, options: TypesetTextOptions = {}): string {
  // Blank lines separate blocks, so quote state resets as it does between paragraphs.
  const parts = text.split(/(\r?\n[ \t]*\r?\n)/);
  const blocks = parts.map((value): TextNode => ({ type: 'text', value }));
  const root = {
    type: 'root',
    children: blocks
      .filter((_, i) => i % 2 === 0)
      .map((node) => ({ type: 'paragraph', children: [node] })),
  };
  remarkChatTypography({ phase: 'complete', ...options })(root as unknown as Root);
  return blocks.map((node) => node.value).join('');
}
