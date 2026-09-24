# Email rendering spike (brief 007, M3)

**Outcome (2026-09-24): hanging punctuation is abandoned for email.** No variant hung in Gmail web or Apple Mail on iOS, so testing stopped there. `typeset({ target: 'email' })` keeps smart quotes and nonbreaking spaces, which are plain characters and render everywhere, and never emits hanging markup. The files below remain as the record.

Decides whether `typeset({ target: 'email' })` may ever emit hanging punctuation. Until a variant passes, email output has no hanging markup.

`spike.html` is one message with five variants. Rebuild it with `npm run build:chat && node validation/email-spike/build.mjs`. Each variant sits beside a dashed red guide at the text edge.

| Variant | Technique                                                                                 |
| ------- | ----------------------------------------------------------------------------------------- |
| A       | Control: current `email` output, no hanging markup                                        |
| B       | Current web markup, `hanging.css` inlined (zero-width inline-block + `translateX(-100%)`) |
| C       | `margin-left: -0.42em` on the quote span                                                  |
| D       | `text-indent: -0.42em` on the paragraph                                                   |
| E       | Native `hanging-punctuation: first` (WebKit only)                                         |

## Decision rule

A variant ships for email only if, in **every** client below, it either hangs correctly (quote left of the guide, words on it) or degrades to A (ordinary quote at the guide). A clipped, overlapping, or shifted-paragraph result in any client fails the variant.

Record each cell as **hangs**, **as A**, or **fails: …** with a screenshot in `screenshots/<client>-<variant>.png`.

## Results

| Client                      | A   | B       | C       | D       | E       |
| --------------------------- | --- | ------- | ------- | ------- | ------- |
| Chromium (browser baseline) | ok  | hangs   | hangs   | hangs   | as A    |
| Apple Mail, macOS           |     |         |         |         |         |
| Apple Mail, iOS             | ok  | no hang | no hang | no hang | no hang |
| Gmail web                   | ok  | no hang | no hang | no hang | no hang |
| Gmail iOS / Android         |     |         |         |         |         |
| Outlook desktop (Windows)   |     |         |         |         |         |
| Outlook web / new Outlook   |     |         |         |         |         |

The Chromium row is a browser render of the file, not an email client. D's negative indent moves only the first line, so wrapped lines stay on the guide. C depends on whether the client keeps negative margins, and B on inline-block and transform support.
