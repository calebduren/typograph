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

  describe('apostrophes after digits', () => {
    const presets = {
      default: { locale: 'en' },
      'apostrophes-only': { locale: 'en', punctuation: { quotes: false, apostrophes: true } },
    } as const;

    it.each(Object.entries(presets))('curls digit possessives under the %s preset', (_, preset) => {
      expect(typesetText("Q3's", preset)).toBe('Q3’s');
      expect(typesetText("2025's numbers", preset)).toBe('2025’s numbers');
      expect(typesetText("Q3'S, 5's and 6's.", preset)).toBe('Q3’S, 5’s and 6’s.');
      expect(
        typesetText(`The CFO's 'soft no' means we're 'round the corner from Q3's close.`, preset),
      ).toContain('CFO’s ');
      expect(
        typesetText(`The CFO's 'soft no' means we're 'round the corner from Q3's close.`, preset),
      ).toContain(' Q3’s close.');
    });

    it.each(Object.entries(presets))('keeps primes straight under the %s preset', (_, preset) => {
      for (const text of [
        `She is 5'11" tall.`,
        "It is 30' long.",
        "A 6' rack.",
        'A 24" monitor.',
        "Room 12'Sam.",
        "Q3'",
      ]) {
        expect(typesetText(text, preset)).toBe(text);
      }
      expect(typesetText("The '90s and rock 'n' roll.", preset)).toBe(
        'The ’90s and rock ’n’ roll.',
      );
    });

    it('leaves a trailing plural possessive to the letter rule', () => {
      expect(typesetText("the 1990s' fashion", { locale: 'en' })).toBe('the 1990s’ fashion');
    });

    it('holds a digit possessive at the streaming edge and curls it at a complete edge', () => {
      const streaming = { locale: 'en', phase: 'streaming' } as const;
      expect(typesetText("Q3'", streaming)).toBe("Q3'");
      expect(typesetText("Q3's", streaming)).toBe("Q3's");
      expect(typesetText("Q3's ", streaming)).toBe('Q3’s ');
      expect(typesetText("Q3's", { locale: 'en', phase: 'complete' })).toBe('Q3’s');
    });

    it('curls a digit possessive inside a quotation', () => {
      expect(typesetText(`"Q3's numbers," she said.`, { locale: 'en' })).toBe(
        '“Q3’s numbers,” she said.',
      );
      expect(typesetText(`'Q3's close' he said.`, { locale: 'en' })).toBe('‘Q3’s close’ he said.');
    });
  });

  it('changes only spaces when punctuation is off', () => {
    expect(typesetText(`J. R. R. said "it's 30 min"`, { ...options, punctuation: false })).toBe(
      `J.${nbsp}R.${nbsp}R. said "it's 30${nbsp}min"`,
    );
  });
});
