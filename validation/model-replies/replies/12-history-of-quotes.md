# A short history of quotation marks

Quotation marks feel permanent, but they're a fairly recent invention, and they still vary by country.

## Before quote marks

Early manuscripts had no way to mark speech. Scribes sometimes wrote a marginal mark, a diple (>), next to lines quoted from another text. The mark was for scholars, not for dialogue, and it appeared in the margin rather than in the line.[^1]

## Printing and standardization

By the 1500s, printers were setting the diple inside the text, and the shape gradually turned into the paired marks we recognize. Two conventions emerged:

- **English-language books** settled on curved double quotes, "like this," with single quotes for a quotation inside a quotation in the United States. British publishers often reverse this.
- **Continental Europe** favored guillemets, so French uses « text » and German uses low-high marks.

## Why the keyboard has straight quotes

Typewriters had limited room for keys, so one straight mark had to do the work of opening and closing quotes, plus the apostrophe and the inch mark. That compromise survived into computing. ASCII, defined in the 1960s, included a single " and a single '. The curly versions arrived with Unicode, which is why software still has to turn straight quotes "smart"[^2] and why this problem isn't fully solved.

## What "smart quotes" actually do

A word processor looks at the character before the quote mark. After a space or an opening bracket, it produces an opening mark; after a letter, it produces a closing one. That rule works nearly all the time. It fails for cases like 'tis or the '90s, where an apostrophe stands for missing letters but follows a space.

## Practical advice

1. Use curly quotes in anything readers will see as typography, such as articles, slides, and books.
2. Keep straight quotes in code, configuration, and command lines, where a curly mark will break things.
3. Don't mix styles in one document.

## Further reading

Bringhurst's _The Elements of Typographic Style_ covers all of this in more depth, and the Unicode Standard's punctuation chapter lists every variant.

[^1]: The diple is still used in some critical editions, so you may see it in scholarly texts.

[^2]: Unicode also has separate code points for primes, so the inch mark (") and the double prime are different characters that look alike in many fonts.
