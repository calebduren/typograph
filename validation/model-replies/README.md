# Model reply corpus

This corpus was generated on 2026-09-29 by a Claude Sonnet subagent in Claude Code answering the prompts in `index.json` as a chat assistant. It is real model output written for this review, not production traffic, and it contains no user data.

There are 40 replies in `replies/`, each 150 to 600 words of Markdown as chat models emit it: prose, headings, lists, tables, fenced code, links, block quotes, footnotes, and dialogue, across a range of domains and registers. Prose uses straight ASCII quotes and apostrophes, which is what the plugin converts. `index.json` lists each reply's file, the prompt it answers, and its word count.

The files were run through Prettier (`npm run format`), so Markdown emphasis is normalized (`_word_` rather than `*word*`).

## Running the review

From the repository root:

```sh
npm run build:chat
npm run review:replies
npx vitest run tests/model-replies.test.ts
```

`npm run review:replies` runs `scripts/review-replies.mjs` and then formats the report.

`scripts/review-replies.mjs` loads the built package from `packages/chat-typography/dist` (it runs `npm run build:chat` itself if `dist` is missing). For each reply it:

1. Typesets the Markdown with `typeset(markdown, { target: 'markdown', locale: 'en', spacing: true })`, asserts the output has the same UTF-16 length as the input, and lists every changed character with 30 characters of context.
2. Lists straight quotes still present in the output outside code, URLs, autolinks, and emails.
3. Parses every third prefix of the reply (plus the full text) with and without the plugin in `phase: 'streaming'`, and checks that only quotes and spaces changed, only into curly quotes and nonbreaking spaces, and that code, inline code, link, image, and definition values are untouched. The stride is 3 and the whole script takes well under three minutes, so it was not raised to 5.
4. Checks that typesetting the output again returns it unchanged.

It writes `review.md` (generated; do not edit by hand) and exits non-zero if any length, streaming, or idempotency check fails. The npm script formats it afterwards so `npm run format:check` stays clean.

`tests/model-replies.test.ts` runs the same length, streaming (prefix stride 61 to stay fast), and idempotency checks against the source package. It does not check missed marks.

## What the review report is for

`review.md` is for a human reviewer. The per-reply change lists show every character the plugin altered, so a reader can spot a wrong curl or an unwanted nonbreaking space. The missed-mark lists show straight quotes the plugin left in prose, such as inch marks or ambiguous apostrophes, so a reader can judge whether each was left on purpose or is a gap. Those lists are for judgment, not pass or fail: the script and the test enforce only the mechanical invariants.
