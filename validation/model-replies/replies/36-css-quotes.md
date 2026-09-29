# Typographic quotes in CSS and HTML

Browsers can generate quotation marks for you, and that's usually better than typing them by hand.

## The `<q>` element

Wrap short inline quotations in `<q>`, and the browser adds the correct marks for the page language:

```html
<p>As Ada put it, <q>the engine might compose elaborate music.</q></p>
```

In English it renders with curly double quotes. A `<q>` nested inside another gets single quotes automatically. For longer passages, use `<blockquote>`, which has no built-in marks.

## Controlling the marks with CSS

The `quotes` property lets you choose which characters to use:

```css
q {
  quotes: '\201C' '\201D' '\2018' '\2019';
}

q::before {
  content: open-quote;
}
q::after {
  content: close-quote;
}
```

The four pairs are outer-open, outer-close, inner-open, and inner-close. The escapes are the Unicode code points for the curly marks. For French text, you might write `quotes: "\00AB\00A0" "\00A0\00BB"`, which adds a nonbreaking space inside the guillemets.

## Language-specific defaults

```css
:lang(de) > q {
  quotes: '\201E' '\201C' '\201A' '\2018';
}
:lang(fr) > q {
  quotes: '\00AB\00A0' '\00A0\00BB';
}
```

If your page sets `lang` correctly, the browser handles most of this without any CSS.

## Hanging punctuation

For pull quotes, you can push the opening mark into the margin so the text lines up:

```css
blockquote p:first-child::before {
  content: '\201C';
  margin-left: -0.4em;
}
```

Safari supports `hanging-punctuation: first`, but other browsers don't, so a manual offset is the practical route.

## Pitfalls

1. **Don't type straight quotes in body copy.** They look like typewriter marks.
2. **Don't use `<q>` for a whole paragraph.** Use `<blockquote>`.
3. **Check screen readers.** Generated content is read aloud in most cases, but behavior varies.
4. **Copying text.** Generated quotes aren't part of the selectable text in some browsers, which surprises people when they copy a quotation.

## Quick recommendation

Use `<q>` and `lang` for short quotes, `<blockquote>` for long ones, and only override `quotes` when your brand style requires a specific look. Paste your markup if something isn't rendering the way you expect.
