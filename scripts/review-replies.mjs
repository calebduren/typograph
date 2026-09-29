// Runs the built @calebduren/typograph package over the model-reply corpus in
// validation/model-replies and writes validation/model-replies/review.md.
//
// Usage: node scripts/review-replies.mjs
// Exits non-zero if any length, streaming, or idempotency check fails.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';

const root = fileURLToPath(new URL('..', import.meta.url));
const corpusDir = new URL('../validation/model-replies/', import.meta.url);
const distIndex = new URL('../packages/chat-typography/dist/index.js', import.meta.url);
const distStatic = new URL('../packages/chat-typography/dist/static.js', import.meta.url);

if (!existsSync(distIndex) || !existsSync(distStatic)) {
  console.log('dist is missing; running npm run build:chat');
  execFileSync('npm', ['run', 'build:chat'], { cwd: root, stdio: 'inherit' });
}
const { default: typography } = await import(distIndex.href);
const { typeset } = await import(distStatic.href);

const STRIDE = 3;
const CONTEXT = 30;
const OPTIONS = { locale: 'en', spacing: true };
const NBSP = ' ';

function show(ch) {
  if (ch === NBSP) return '⍽';
  if (ch === '\n') return '⏎';
  if (ch === '\t') return '⇥';
  return ch;
}

function contextLine(text, index, marked) {
  const before = [...text.slice(Math.max(0, index - CONTEXT), index)].map(show).join('');
  const after = [...text.slice(index + 1, index + 1 + CONTEXT)].map(show).join('');
  return `${before}[[${marked}]]${after}`;
}

function lineNumber(text, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

function name(ch) {
  return 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
}

function listChanges(input, output) {
  const changes = [];
  for (let i = 0; i < input.length; i++) {
    if (input[i] === output[i]) continue;
    changes.push({
      index: i,
      line: lineNumber(input, i),
      from: input[i],
      to: output[i],
      text: contextLine(output, i, output[i] === NBSP ? 'NBSP' : output[i]),
    });
  }
  return changes;
}

// Approximate the regions the plugin must never touch, so remaining straight
// marks in them are not reported as missed. Works on the typeset Markdown.
function maskProtected(text) {
  const mask = new Array(text.length).fill(false);
  const lines = text.split('\n');
  let offset = 0;
  let fence = null;
  for (const line of lines) {
    const end = offset + line.length;
    const match = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      for (let i = offset; i <= end && i < mask.length; i++) mask[i] = true;
      if (match && match[1][0] === fence.char && match[1].length >= fence.length) fence = null;
    } else if (match) {
      fence = { char: match[1][0], length: match[1].length };
      for (let i = offset; i <= end && i < mask.length; i++) mask[i] = true;
    }
    offset = end + 1;
  }
  // Inline code spans, never crossing a blank line, outside fences.
  const visible = [...text].map((ch, i) => (mask[i] ? '\u0000' : ch)).join('');
  const span = /(`+)(?!`)((?:(?!\n[ \t]*\n)[\s\S])*?)(?<!`)\1(?!`)/g;
  for (let m = span.exec(visible); m; m = span.exec(visible)) {
    if (m[0].includes('\u0000')) continue;
    for (let i = m.index; i < m.index + m[0].length; i++) mask[i] = true;
  }
  // Whitespace-delimited tokens that look like URLs, autolinks, or emails.
  const token = /\S+/g;
  for (let m = token.exec(text); m; m = token.exec(text)) {
    const value = m[0];
    if (value.includes('://') || value.includes('www.') || /[^\s@]+@[^\s@]+\.[^\s@]+/.test(value)) {
      for (let i = m.index; i < m.index + value.length; i++) mask[i] = true;
    }
  }
  return mask;
}

function listMissed(output) {
  const mask = maskProtected(output);
  const missed = [];
  for (let i = 0; i < output.length; i++) {
    const ch = output[i];
    if ((ch === '"' || ch === "'") && !mask[i]) {
      missed.push({
        index: i,
        line: lineNumber(output, i),
        char: ch,
        text: contextLine(output, i, ch),
      });
    }
  }
  return missed;
}

const streamingProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(typography, { ...OPTIONS, phase: 'streaming' });
const baselineProcessor = unified().use(remarkParse).use(remarkGfm);

function collect(tree) {
  const texts = [];
  const protectedValues = [];
  (function walk(node) {
    if (node.type === 'text') texts.push(node.value);
    else if (node.type === 'inlineCode' || node.type === 'code') {
      protectedValues.push(`${node.type}:${node.value}`);
    } else if (node.type === 'link' || node.type === 'image' || node.type === 'definition') {
      protectedValues.push(`${node.type}.url:${node.url}`);
    }
    for (const child of node.children ?? []) walk(child);
  })(tree);
  return { texts, protectedValues };
}

const allowed = {
  '"': new Set(['“', '”']),
  "'": new Set(['‘', '’']),
  ' ': new Set([NBSP]),
};

function checkPrefix(markdown, n) {
  const prefix = markdown.slice(0, n);
  const violations = [];
  const record = (kind, detail) => violations.push({ prefixLength: n, kind, ...detail });
  let plain;
  let typeset_;
  try {
    const parsed = baselineProcessor.parse(prefix);
    plain = collect(baselineProcessor.runSync(structuredClone(parsed), prefix));
    typeset_ = collect(streamingProcessor.runSync(parsed, prefix));
  } catch (error) {
    record('threw', { detail: String(error && error.stack ? error.stack : error) });
    return violations;
  }
  if (plain.texts.length !== typeset_.texts.length) {
    record('text-node-count', { expected: plain.texts.length, actual: typeset_.texts.length });
    return violations;
  }
  for (let i = 0; i < plain.texts.length; i++) {
    const a = plain.texts[i];
    const b = typeset_.texts[i];
    if (a.length !== b.length) {
      record('text-length', { node: i, expected: JSON.stringify(a), actual: JSON.stringify(b) });
      continue;
    }
    for (let j = 0; j < a.length; j++) {
      if (a[j] === b[j]) continue;
      if (!allowed[a[j]] || !allowed[a[j]].has(b[j])) {
        record('illegal-substitution', {
          node: i,
          offset: j,
          expected: `${name(a[j])} may only become ${[...(allowed[a[j]] ?? [])].map(name).join(' or ') || 'itself'}`,
          actual: `${name(a[j])} became ${name(b[j])}`,
          context: JSON.stringify(b.slice(Math.max(0, j - 20), j + 21)),
        });
      }
    }
  }
  if (JSON.stringify(plain.protectedValues) !== JSON.stringify(typeset_.protectedValues)) {
    const at = plain.protectedValues.findIndex((v, i) => v !== typeset_.protectedValues[i]);
    record('protected-value', {
      expected: plain.protectedValues[at],
      actual: typeset_.protectedValues[at],
    });
  }
  return violations;
}

function streamingPass(markdown) {
  const lengths = [];
  for (let n = 1; n <= markdown.length; n += STRIDE) lengths.push(n);
  if (lengths.at(-1) !== markdown.length) lengths.push(markdown.length);
  const violations = [];
  for (const n of lengths) violations.push(...checkPrefix(markdown, n));
  return { checked: lengths.length, violations };
}

const index = JSON.parse(readFileSync(new URL('index.json', corpusDir), 'utf8'));
const started = performance.now();
const results = [];
const failures = [];
for (const entry of index) {
  const markdown = readFileSync(new URL(entry.file, corpusDir), 'utf8');
  const label = entry.file.replace(/^replies\//, '');
  const output = await typeset(markdown, { target: 'markdown', ...OPTIONS });
  const lengthOk = output.length === markdown.length;
  if (!lengthOk) {
    failures.push(`${label}: length changed from ${markdown.length} to ${output.length}`);
  }
  const changes = lengthOk ? listChanges(markdown, output) : [];
  const missed = listMissed(output);
  const streaming = streamingPass(markdown);
  for (const v of streaming.violations) {
    failures.push(`${label}: streaming ${JSON.stringify(v)}`);
  }
  const again = await typeset(output, { target: 'markdown', ...OPTIONS });
  const idempotent = again === output;
  if (!idempotent) {
    let at = 0;
    while (at < output.length && output[at] === again[at]) at++;
    failures.push(
      `${label}: not idempotent at index ${at}: ${JSON.stringify(output.slice(Math.max(0, at - 30), at + 31))} became ${JSON.stringify(again.slice(Math.max(0, at - 30), at + 31))}`,
    );
  }
  results.push({ entry, label, changes, missed, streaming, lengthOk, idempotent });
  console.log(
    `${label}: ${changes.length} changes, ${missed.length} missed, ${streaming.checked} prefixes, ${streaming.violations.length} violations`,
  );
}

const date = new Date().toISOString().slice(0, 10);
const cell = (s) => String(s).replace(/\|/g, '\\|');
const out = [];
out.push('# Model reply review');
out.push('');
out.push(
  `> Generated by \`scripts/review-replies.mjs\` on ${date}. Do not edit by hand; rerun the script.`,
);
out.push('');
out.push(
  `Options: \`${JSON.stringify(OPTIONS)}\`, complete pass with \`target: 'markdown'\`; streaming pass with \`phase: 'streaming'\`, every ${STRIDE}rd prefix plus the full text. Context is 30 characters each side; the changed or missed character is wrapped in \`[[ ]]\`. In context, ⍽ is a nonbreaking space and ⏎ is a newline.`,
);
out.push('');
out.push(
  'Missed marks are straight `"` or `\'` left in the output outside fenced code, inline code, URL, autolink, and email regions (approximated by a text scan). Many are expected (inch marks, quotes in link titles); the list is for human review.',
);
out.push('');
out.push('## Summary');
out.push('');
out.push('| Reply | Words | Changes | Missed marks | Prefixes checked | Violations |');
out.push('| --- | ---: | ---: | ---: | ---: | ---: |');
const totals = { words: 0, changes: 0, missed: 0, prefixes: 0, violations: 0 };
for (const r of results) {
  const violations = r.streaming.violations.length + (r.lengthOk ? 0 : 1) + (r.idempotent ? 0 : 1);
  totals.words += r.entry.words;
  totals.changes += r.changes.length;
  totals.missed += r.missed.length;
  totals.prefixes += r.streaming.checked;
  totals.violations += violations;
  out.push(
    `| ${cell(r.label)} | ${r.entry.words} | ${r.changes.length} | ${r.missed.length} | ${r.streaming.checked} | ${violations} |`,
  );
}
out.push(
  `| **Total** | ${totals.words} | ${totals.changes} | ${totals.missed} | ${totals.prefixes} | ${totals.violations} |`,
);
out.push('');
for (const r of results) {
  out.push(`## ${r.label}`);
  out.push('');
  out.push(`**Prompt:** ${r.entry.prompt}`);
  out.push('');
  out.push(`### Changes (${r.changes.length})`);
  out.push('');
  if (r.changes.length === 0) out.push('None.');
  for (const c of r.changes) {
    out.push(`- L${c.line} \`${name(c.from)} → ${name(c.to)}\` \`${c.text.replace(/`/g, "'")}\``);
  }
  out.push('');
  out.push(`### Missed marks (${r.missed.length})`);
  out.push('');
  if (r.missed.length === 0) out.push('None.');
  for (const m of r.missed) {
    out.push(`- L${m.line} \`${m.text.replace(/`/g, "'")}\``);
  }
  out.push('');
}
writeFileSync(new URL('review.md', corpusDir), out.join('\n'));

const seconds = ((performance.now() - started) / 1000).toFixed(1);
console.log(
  `\n${results.length} replies, ${totals.words} words, ${totals.changes} changes, ${totals.missed} missed marks, ${totals.prefixes} prefixes, ${seconds}s`,
);
if (failures.length > 0) {
  console.error(`\n${failures.length} failure(s):`);
  for (const failure of failures.slice(0, 200)) console.error(`- ${failure}`);
  if (failures.length > 200) console.error(`... and ${failures.length - 200} more`);
  process.exit(1);
}
console.log('All length, streaming, and idempotency checks passed.');
