import typography from '@calebduren/typograph';
import type { Root } from 'mdast';
import { defaultRehypePlugins } from 'streamdown';
import type { Pluggable, Plugin } from 'unified';

// Explicit rehype arrays bypass Streamdown's allowedTags schema adjustment.
// Keep its security defaults, allowing only the demo's extra <mark> element.
const [sanitize, schema] = defaultRehypePlugins.sanitize as [
  Plugin,
  { tagNames?: string[]; attributes?: Record<string, unknown[]> },
];
export const previewRehypePlugins: Pluggable[] = Object.entries(defaultRehypePlugins).map(
  ([name, plugin]) =>
    name === 'sanitize'
      ? [
          sanitize,
          {
            ...schema,
            tagNames: [...(schema.tagNames ?? []), 'mark'],
            attributes: {
              ...schema.attributes,
              mark: [
                ...(schema.attributes?.mark ?? []),
                ['dataTypographChange', 'punctuation', 'spacing'],
              ],
            },
          },
        ]
      : plugin,
);

export const example = {
  question:
    'Can you help me write a thoughtful brief for our studio review, with a checklist and a small code example?',
  note: 'Quotes, apostrophes, related words, and literal details. Use Highlight changes to follow the refinements.',
  text: `"It's in the details," she said. "Give 'em a little room." That's a useful starting point for a studio review: make the work easy to read, then give people enough context to respond thoughtfully.

## "Room to think"

Start with the reader's questions. What's new? Why does it matter? What should happen next? The designers' notes don't need to become a pitch; they need to help someone understand the choices. A reference from the '90s can sit beside a new idea without either feeling out of place.

Maya put it this way: "When someone says 'it's ready,' ask what they've checked." Keep **the important words** clear, let *a quieter aside* stay quiet, and give each paragraph one useful job.

"Read [the guide](/integration.md) when you're ready." Quotation marks can span a link or **a change in emphasis** without losing their place. The words remain yours; only their presentation changes.

### Plan the review

Dr. Smith and J. R. Park have 30 min to review Fig. 2 before the rest of the team arrives. Bring a 12 kg sample, leave 20 cm between each piece, and keep the reference drawing within reach. Those small pairs are easier to read when their parts stay together.

- Open with the problem you're solving, not a tour of every screen.
- Set aside 15 min for questions and another 10 min for decisions.
- Compare the team's first sketches with the finished work; don't hide the useful detours.
- End with one owner and a clear next step, so nobody has to ask, "Who has this?"

> "Good feedback makes the next decision easier. It doesn't need to make every decision for you."

### Keep the exact details

Some characters carry instructions. Keep \`const message = "It's ready.";\` exactly as written, and leave \`"literal code"\` alone. A file path, an email address such as \`studio@example.com\`, and a URL like \`https://example.com/it's-here\` aren't prose to be rewritten.

\`\`\`js
const message = "It's ready.";
const duration = "30 min";
const draft = { title: "Studio review", approved: false };
\`\`\`

| In the brief | What to notice |
| --- | --- |
| "A considered answer" | Quotes in ordinary prose can change. |
| 12 kg and 20 cm | Related numbers and units can stay together. |
| \`"literal code"\` | Code keeps its original characters. |

A participant is 5'10" tall; the measurement should stay a measurement. A deliberately escaped quote, \\"leave this alone\\", should stay straight. And a pause written as "Wait... really?" keeps its three dots: this utility doesn't rewrite every mark.

### Give the words time to arrive

It took 30 million small decisions to get here. While that sentence streams, a partial "30 m" could still become "30 million"; wait for the rest before deciding which words belong together. The same patience helps when an opening quote or apostrophe arrives before its word.

1. Read the complete response once for meaning.
2. Check the links, numbers, and examples against the original.
3. "Leave a little room for the next idea."

"That's enough for today." Save the original, share the decisions, and let the next conversation begin.`,
} as const;

export function chunkEnds(source: string): number[] {
  const characters = Array.from(source);
  let offset = 0;
  return Array.from(
    { length: Math.ceil(characters.length / 12) },
    (_, index) => (offset += characters.slice(index * 12, index * 12 + 12).join('').length),
  );
}

type PreviewNode = {
  type: string;
  value?: string;
  children?: PreviewNode[];
  data?: unknown;
  position?: Root['position'];
};

/** Demo-only annotations. The distributed plugin never allocates these marks. */
export function remarkPreview({
  punctuation = true,
  spacing,
  highlight,
}: {
  punctuation?: boolean;
  spacing: boolean;
  highlight: boolean;
}) {
  const transform = typography({ locale: 'en', punctuation, spacing });
  return (tree: Root, file: { value: unknown }) => {
    const originals = new Map<PreviewNode, string>();
    const root = tree as unknown as PreviewNode;
    const stack = [root];
    while (stack.length) {
      const node = stack.pop()!;
      if (highlight && node.type === 'text' && node.value != null) originals.set(node, node.value);
      if (node.children) stack.push(...node.children);
    }
    transform(tree, file);
    if (!highlight) return;
    const parents = [root];
    while (parents.length) {
      const parent = parents.pop()!;
      if (!parent.children) continue;
      parent.children = parent.children.flatMap((node) => {
        if (node.children) parents.push(node);
        const before = originals.get(node);
        if (before == null || before === node.value) return [node];
        const after = node.value!;
        const pieces: PreviewNode[] = [];
        let start = 0;
        for (let i = 0; i < after.length; i++) {
          if (before[i] === after[i]) continue;
          if (i > start) pieces.push({ type: 'text', value: after.slice(start, i) });
          pieces.push({
            type: 'emphasis',
            data: {
              hName: 'mark',
              hProperties: {
                'data-typograph-change': after[i] === '\u00a0' ? 'spacing' : 'punctuation',
              },
            },
            children: [{ type: 'text', value: after[i] }],
          });
          start = i + 1;
        }
        if (start < after.length) pieces.push({ type: 'text', value: after.slice(start) });
        // Retain the initial source position for escaped-opening protection.
        if (pieces[0]) pieces[0].position = node.position;
        return pieces;
      });
    }
  };
}
