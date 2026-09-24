import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { typesetText } from '../packages/chat-typography/src/index';

const cases = JSON.parse(
  readFileSync(new URL('../validation/cases.json', import.meta.url), 'utf8'),
) as { id: string; input: string; locale?: string }[];
const options = { locale: 'en', spacing: true } as const;
const nbsp = '\u00a0';

describe('plain-string typography', () => {
  it.each([
    [`Bob's "weekly" brief is ready`, 'Bob’s “weekly” brief is ready'],
    [
      `with J. R. R. — it's "urgent."\n\n"Second" paragraph's quote`,
      `with J.${nbsp}R.${nbsp}R. — it’s “urgent.”\n\n“Second” paragraph’s quote`,
    ],
    ['Run `it\'s` then "go"', "Run `it's` then “go”"],
    [
      "See https://example.com/it's-here or bob's.name@example.com",
      "See https://example.com/it's-here or bob's.name@example.com",
    ],
    ['*Not* markdown: "a" _b_ 1. item', '*Not* markdown: “a” _b_ 1. item'],
  ])('typesets %j', (input, expected) => {
    expect(typesetText(input, options)).toBe(expected);
  });

  it('preserves length and is idempotent across the corpus', () => {
    const changed = cases.filter((fixture) => {
      const settings = { ...options, locale: fixture.locale ?? 'en' };
      const once = typesetText(fixture.input, settings);
      return once.length !== fixture.input.length || typesetText(once, settings) !== once;
    });
    expect(changed.map((fixture) => fixture.id)).toEqual([]);
  });

  it('passes through without a supported locale', () => {
    expect(typesetText('"Hello"')).toBe('"Hello"');
    expect(typesetText('"Bonjour"', { locale: 'fr' })).toBe('"Bonjour"');
  });

  it('keeps CRLF blank lines and resets quote state per block', () => {
    expect(typesetText('"One\r\n\r\ntwo"', options)).toBe('“One\r\n\r\ntwo"');
  });

  it('holds the right edge while streaming', () => {
    const streaming = { ...options, phase: 'streaming' } as const;
    expect(typesetText('Wait 30 min', streaming)).toBe('Wait 30 min');
    expect(typesetText('Wait 30 min', options)).toBe(`Wait 30${nbsp}min`);
  });

  it('changes only spaces when punctuation is off', () => {
    expect(typesetText(`J. R. R. said "it's 30 min"`, { ...options, punctuation: false })).toBe(
      `J.${nbsp}R.${nbsp}R. said "it's 30${nbsp}min"`,
    );
  });
});
