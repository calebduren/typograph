import { typesetText } from '@calebduren/typograph';
import { typeset } from '@calebduren/typograph/static';
import type { TypographySettings } from './integration-settings';
export { charName, codePoint } from './glyphs';

export type InputKind = 'text' | 'markdown' | 'html';
export type MarkdownTarget = 'web' | 'email' | 'markdown';
export type ChangeKind = 'quote' | 'apostrophe' | 'space' | 'hanging';

export interface Change {
  before: string;
  after: string;
  kind: ChangeKind;
  /** The typeset text around the change, split at the changed character. */
  context: [before: string, after: string];
}

export interface Run {
  /** The exact string the package returned. */
  output: string;
  /** Sanitized HTML for the preview, with each change wrapped in a mark. */
  preview: string;
  changes: Change[];
  /** Milliseconds spent inside the package call, measured in this browser. */
  ms: number;
  /** The call that produced `output`, for display. */
  call: string;
}

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The preview renders the user's own HTML. Scripts are already blocked by the page's CSP;
// this removes active content and anything that would load or navigate.
const blocked = 'script,style,link,meta,base,iframe,frame,object,embed,form,noscript,template';
function sanitize(root: ParentNode) {
  for (const element of root.querySelectorAll(blocked)) element.remove();
  // Links in the preview are the user's content; never let them replace the demo.
  for (const link of root.querySelectorAll('a[href]')) {
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  }
  for (const element of root.querySelectorAll('*')) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      if (
        name.startsWith('on') ||
        name === 'srcset' ||
        ((name === 'href' || name === 'src' || name === 'action') &&
          /^\s*(?:javascript|data|vbscript):/i.test(attribute.value))
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  }
}

function parse(html: string): HTMLElement {
  const document = new DOMParser().parseFromString(html, 'text/html');
  sanitize(document);
  return document.body;
}

function textNodes(root: Node): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  return nodes;
}

function kindOf(before: string, after: string, text: string, index: number): ChangeKind {
  if (before === ' ' || after === '\u00a0') return 'space';
  if (after !== '’') return 'quote';
  // Contractions sit between letters; elisions like ’Til and ’90s start a word.
  const letter = /[\p{L}\p{N}]/u;
  const next = letter.test(text[index + 1] ?? '');
  return next && (letter.test(text[index - 1] ?? '') || !/\S/u.test(text[index - 1] ?? ' '))
    ? 'apostrophe'
    : 'quote';
}

function excerpt(text: string, index: number): [string, string] {
  const tidy = (value: string) => value.replace(/[ \t\r\n]+/g, ' ');
  const start = Math.max(0, index - 22);
  const end = Math.min(text.length, index + 23);
  return [
    `${start > 0 ? '…' : ''}${tidy(text.slice(start, index)).trimStart()}`,
    `${tidy(text.slice(index + 1, end)).trimEnd()}${end < text.length ? '…' : ''}`,
  ];
}

function wrap(node: Text, index: number, kind: ChangeKind) {
  const mark = document.createElement('mark');
  mark.dataset.typographChange = kind === 'space' ? 'spacing' : 'punctuation';
  const rest = node.splitText(index);
  rest.splitText(1);
  rest.parentNode!.replaceChild(mark, rest);
  mark.append(rest);
}

/**
 * Walk the untypeset and typeset renderings together, text node by text node, to find
 * every changed character. A hanging quote moves the first character of a text node into
 * its own span, which the walk accounts for.
 */
function annotate(baselineHtml: string, resultHtml: string): { html: string; changes: Change[] } {
  const baseline = textNodes(parse(baselineHtml));
  const body = parse(resultHtml);
  const changes: Change[] = [];
  const edits: [Text, number, ChangeKind][] = [];
  let index = 0;
  let offset = 0;
  for (const node of textNodes(body)) {
    const source = baseline[index];
    if (!source) break;
    if (node.parentElement?.closest('.typograph-opening')) {
      const before = source.data[offset];
      changes.push({
        before,
        after: node.data,
        kind: 'hanging',
        context: excerpt(
          node.parentElement.closest('p,h1,h2,h3,h4,h5,h6,li,td')?.textContent ?? '',
          0,
        ),
      });
      (node.parentElement as HTMLElement).dataset.change = 'hanging';
      offset++;
      if (offset >= source.data.length) {
        index++;
        offset = 0;
      }
      continue;
    }
    const before = source.data.slice(offset);
    index++;
    offset = 0;
    // Structure differs here (it should not); leave this node unannotated rather than guess.
    if (before.length !== node.data.length) continue;
    for (let i = 0; i < before.length; i++) {
      if (before[i] === node.data[i]) continue;
      const kind = kindOf(before[i], node.data[i], node.data, i);
      changes.push({
        before: before[i],
        after: node.data[i],
        kind,
        context: excerpt(node.data, i),
      });
      edits.push([node, i, kind]);
    }
  }
  // Wrap from the end so earlier indices stay valid within each node.
  for (const [node, i, kind] of edits.reverse()) wrap(node, i, kind);
  return { html: body.innerHTML, changes };
}

// The first typeset() call loads its parser packages. Load them once up front so the
// reported time measures typesetting, not downloading.
let warm: Promise<unknown> | undefined;
const ready = () =>
  (warm ??= Promise.all([
    typeset('', { target: 'markdown' }),
    typeset('', { target: 'web' }),
    typeset('', { input: 'html', target: 'email' }),
  ]));

async function timed<T>(run: () => T | Promise<T>): Promise<[T, number]> {
  await ready();
  const start = performance.now();
  const value = await run();
  return [value, performance.now() - start];
}

const literal = (value: string) => `'${value}'`;

export async function runDemo(
  input: string,
  kind: InputKind,
  target: MarkdownTarget,
  settings: TypographySettings,
): Promise<Run> {
  const rules = { locale: 'en', punctuation: settings.punctuation, spacing: settings.spacing };
  const shown = `locale: 'en', punctuation: ${settings.punctuation}, spacing: ${settings.spacing}`;
  if (kind === 'text') {
    const [output, ms] = await timed(() => typesetText(input, rules));
    const { html, changes } = annotate(`<p>${escape(input)}</p>`, `<p>${escape(output)}</p>`);
    return { output, preview: html, changes, ms, call: `typesetText(input, { ${shown} })` };
  }
  if (kind === 'html') {
    const html = /^\s*(?:<!--[\s\S]*?-->\s*)*(?:<!doctype|<html)/i.test(input)
      ? 'document'
      : 'fragment';
    const [output, ms] = await timed(() =>
      typeset(input, { input: 'html', target: 'email', html, ...rules }),
    );
    const annotated = annotate(input, output);
    return {
      output,
      preview: annotated.html,
      changes: annotated.changes,
      ms,
      call: `await typeset(input, { input: 'html', target: 'email', html: ${literal(html)}, ${shown} })`,
    };
  }
  if (target === 'markdown') {
    const [output, ms] = await timed(() => typeset(input, { target: 'markdown', ...rules }));
    // Render both Markdown strings without typography to compare what readers see.
    const [before, after] = await Promise.all([
      typeset(input, { target: 'web', hanging: false }),
      typeset(output, { target: 'web', hanging: false }),
    ]);
    const annotated = annotate(before, after);
    return {
      output,
      preview: annotated.html,
      changes: annotated.changes,
      ms,
      call: `await typeset(input, { target: 'markdown', ${shown} })`,
    };
  }
  const hanging = target === 'web' && settings.hanging;
  const [output, ms] = await timed(() => typeset(input, { target, ...rules, hanging }));
  const baseline = await typeset(input, { target, hanging: false });
  const annotated = annotate(baseline, output);
  return {
    output,
    preview: annotated.html,
    changes: annotated.changes,
    ms,
    call: `await typeset(input, { target: ${literal(target)}, ${shown}${target === 'web' ? `, hanging: ${hanging}` : ''} })`,
  };
}
