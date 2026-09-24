// Names for the characters Typograph changes, in sentence case.
const names: Record<string, string> = {
  '“': 'left double quotation mark',
  '”': 'right double quotation mark',
  '‘': 'left single quotation mark',
  '’': 'right single quotation mark',
  '\u00a0': 'no-break space',
  '"': 'quotation mark',
  "'": 'apostrophe',
  ' ': 'space',
};
export const codePoint = (char: string) =>
  `U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`;
export const charName = (char: string) => names[char] ?? codePoint(char);
