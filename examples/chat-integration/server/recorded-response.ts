import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from 'ai';

export const richChunks = [
  '"',
  'Hello',
  '," she said. ',
  "Give '",
  'em a chance. ',
  'It took 30 m',
  'illion to finish. Wait 30 ',
  '**min** before leaving.\n\n',
  '"Read [',
  "the guide](https://example.com/it's-here)",
  ' today." ',
  'Keep `const x = "hi"` intact.\n\n',
  '```js\nconst y = "exact";\n```\n\n',
  '| Heading | Result |\n| --- | --- |\n| "Ready" | `5 ft` |\n\n',
  'Compute:\n\n$$\nf\'(x)\n$$\n\nThen say "done".\n\n',
  'The design needs a careful review before we share the first version with the whole team.',
];

/** Real AI SDK protocol, deterministic recorded content; no model or API key. */
export function recordedResponse(messages: UIMessage[], signal?: AbortSignal): Response {
  const lastUser = messages.filter((message) => message.role === 'user').at(-1);
  const scenario = lastUser?.parts.find((part) => part.type === 'text')?.text ?? 'rich';
  const chunks =
    scenario === 'boundary'
      ? ['"', 'Hello', '," she said. It took 30 m', 'illion years. Wait 30 min.']
      : scenario === 'slow'
        ? [
            '"Start here." ',
            ...Array.from({ length: 24 }, (_, i) => `Step ${i + 1} is ready. `),
            '"Finished."',
          ]
        : scenario === 'error'
          ? ['"Partial answer." ', 'Wait 30 m']
          : richChunks;
  const stream = createUIMessageStream({
    originalMessages: messages,
    async execute({ writer }) {
      writer.write({ type: 'start' });
      writer.write({ type: 'text-start', id: 'answer' });
      for (const delta of chunks) {
        await new Promise((resolve) => setTimeout(resolve, scenario === 'rich' ? 80 : 240));
        if (signal?.aborted) {
          writer.write({ type: 'abort' });
          return;
        }
        writer.write({ type: 'text-delta', id: 'answer', delta });
      }
      if (scenario === 'error') {
        writer.write({ type: 'error', errorText: 'Recorded stream failure' });
        return;
      }
      writer.write({ type: 'text-end', id: 'answer' });
      if (scenario === 'rich') {
        writer.write({
          type: 'tool-input-available',
          toolCallId: 'literal',
          toolName: 'inspect',
          input: { query: '"exact"' },
        });
        writer.write({
          type: 'tool-output-available',
          toolCallId: 'literal',
          output: { text: '"Do not transform"' },
        });
      }
      writer.write({ type: 'finish', finishReason: 'stop' });
    },
  });
  return createUIMessageStreamResponse({ stream });
}
