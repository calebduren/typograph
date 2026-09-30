# Inter Variable

Inter 4.1, by Rasmus Andersson and The Inter Project Authors. The files here are Latin subsets of the WOFF2 files in the `web/` folder of the Inter 4.1 download (https://github.com/rsms/inter/releases/tag/v4.1), produced with fonttools 4.66.1 and brotli.

Source: https://github.com/rsms/inter/releases/tag/v4.1
Website: https://rsms.me/inter/
License: SIL Open Font License 1.1, included in `Inter-LICENSE.txt`. These assets retain their font license; Typograph’s code is MIT-licensed.

Both roman and italic faces keep the full variable axes: weight 100–900 and optical size 14–32. All OpenType layout features are kept (`--layout-features='*'`), but hinting is removed. The browser loads them only when earlier system faces in the font stack are unavailable and the text falls inside the `unicode-range` in `src/fonts.css`. Apple fonts are requested from the operating system and are not bundled.

Subset command, run once per file (source `Inter*.woff2` from the 4.1 download, output the same filename):

```sh
pyftsubset InterVariable.woff2 --flavor=woff2 --layout-features='*' --no-hinting \
  --unicodes='U+0020-007E,U+00A0-00FF,U+0100-017F,U+0192,U+0218-021B,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20A0-20CF,U+2100-214F,U+2190-21FF,U+2200-22FF,U+25A0-25FF,U+FEFF,U+FFFD' \
  --output-file=InterVariable.woff2
```

Repeat with `InterVariable-Italic.woff2`. Covered ranges: Basic Latin, Latin-1 Supplement, Latin Extended-A, a few Latin Extended-B letters (ƒ, Ș ș Ț ț), modifier letters (ʻ ʼ ˆ ˚ ˜), General Punctuation, Currency Symbols, Letterlike Symbols, Arrows, Mathematical Operators, Geometric Shapes, byte order mark, and the replacement character. Keep the `unicode-range` descriptors in `src/fonts.css` identical to this list.

These files are served with a one-year immutable cache. When their contents change, rename them (for example `InterVariable.v2.woff2`) and update `src/fonts.css`.

SHA-256:

- `InterVariable.woff2`: `8d0e2148588e356a7ebf6f14bcc465ceae7f89b515ba9b24b1b0588ae385e19b`
- `InterVariable-Italic.woff2`: `3f27cd3ff6789a9c9c2fc5df1c6d6046dc6a93a68c633eff8d5619d2cfb0051d`

# Hedvig Letters Serif

Hedvig Letters Serif 400, variable optical size (12–24), by Kanon Foundry (Alexander Örn and Tor Weibull) for The Hedvig Letters Project. Converted from the supplied `HedvigLettersSerif[opsz].ttf` to WOFF2 without subsetting. There is no italic; the site never synthesizes one. Used for display accents only.

Source: https://github.com/KanonFoundry/HedvigLetters
License: SIL Open Font License 1.1, included in `HedvigLettersSerif-LICENSE.txt`. “Hedvig” is a trademark of Hedvig AB.

SHA-256:

- `HedvigLettersSerif.woff2`: `62c21d63fbdc01edcefa7eaa2b1d8b3642e6a92201c84672f8a0649f0e630979`
