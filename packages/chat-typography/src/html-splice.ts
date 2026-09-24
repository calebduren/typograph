// Writes typeset HTML text back into the original source. Separate from the
// Markdown splice: HTML has character references and no backslash escapes.

type Position = { start?: { offset?: number }; end?: { offset?: number } };
export type HtmlText = { type: 'text'; value: string; position?: Position };
/** One value code unit's source range; `span` marks a character reference or CRLF. */
type Mapping = { start: number; end: number; span: boolean };

const reference = /^&[#A-Za-z0-9]+;?/;

/**
 * How many characters of `token` the parser consumes as one reference, or 'literal' when
 * the `&` is ordinary text. `decode` is the parser itself, so this is parser-equivalent.
 * Anything the parser does not settle unambiguously is 'abort'.
 */
export function consumedLength(
  token: string,
  decode: (value: string) => string,
): number | 'literal' | 'abort' {
  const whole = decode(token);
  if (whole === token) return 'literal';
  if (token.length > 40) return 'abort';
  const lengths: number[] = [];
  for (let k = 2; k <= token.length; k++) {
    const head = token.slice(0, k);
    const decoded = decode(head);
    // A decoding that ends with the head's last character passed that character through.
    if (decoded === head || [...decoded].length > 2 || decoded.endsWith(head[k - 1])) continue;
    if (decoded + token.slice(k) === whole) lengths.push(k);
  }
  return lengths.length === 1 ? lengths[0] : 'abort';
}

function align(
  source: string,
  start: number,
  end: number,
  value: string,
  decode: (value: string) => string,
): Mapping[] | undefined {
  const map: Mapping[] = [];
  let i = start;
  let j = 0;
  while (j < value.length) {
    if (i >= end) return undefined;
    if (source[i] === '\r' && value[j] === '\n') {
      const length = source[i + 1] === '\n' ? 2 : 1;
      map.push({ start: i, end: i + length, span: true });
      i += length;
      j++;
      continue;
    }
    if (source[i] === '&') {
      const token = reference.exec(source.slice(i, Math.min(end, i + 64)))?.[0];
      const consumed = token ? consumedLength(token, decode) : 'literal';
      if (consumed === 'abort') return undefined;
      if (consumed !== 'literal') {
        const decoded = decode(token!.slice(0, consumed));
        if (decoded.includes('\ufffd') || !value.startsWith(decoded, j)) return undefined;
        for (let k = 0; k < decoded.length; k++) {
          map.push({ start: i, end: i + consumed, span: true });
        }
        i += consumed;
        j += decoded.length;
        continue;
      }
    }
    if (source[i] !== value[j]) return undefined;
    map.push({ start: i, end: i + 1, span: false });
    i++;
    j++;
  }
  return i === end ? map : undefined;
}

/** Nodes whose source ranges intersect another node's cannot be proven, so they are never edited. */
function overlapping(nodes: HtmlText[]): Set<HtmlText> {
  const ranged = nodes
    .filter((node) => node.position?.start?.offset != null && node.position?.end?.offset != null)
    .sort((a, b) => a.position!.start!.offset! - b.position!.start!.offset!);
  const found = new Set<HtmlText>();
  let reach = -1;
  let owner: HtmlText | undefined;
  for (const node of ranged) {
    const start = node.position!.start!.offset!;
    const end = node.position!.end!.offset!;
    if (start < reach) {
      found.add(node);
      found.add(owner!);
    }
    if (end > reach) {
      reach = end;
      owner = node;
    }
  }
  return found;
}

/**
 * Apply the engine's edits (captured as before/after values per text node) to the source.
 * A node is edited only when every character aligns to a proven source range.
 */
export function spliceHtml(
  source: string,
  nodes: HtmlText[],
  before: string[],
  decode: (value: string) => string,
): string {
  const unsafe = overlapping(nodes);
  const edits: { start: number; end: number; text: string }[] = [];
  nodes.forEach((node, index) => {
    const original = before[index];
    const start = node.position?.start?.offset;
    const end = node.position?.end?.offset;
    if (node.value === original || start == null || end == null || unsafe.has(node)) return;
    const map = align(source, start, end, original, decode);
    if (!map) return;
    for (let j = 0; j < node.value.length; j++) {
      if (node.value[j] === original[j]) continue;
      const { start: from, end: to, span } = map[j];
      // A reference span is replaced whole, but only when it decoded to this one character.
      const single = span
        ? decode(source.slice(from, to)) === original[j]
        : source[from] === original[j];
      if (single) edits.push({ start: from, end: to, text: node.value[j] });
    }
  });
  let output = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
  }
  return output;
}
