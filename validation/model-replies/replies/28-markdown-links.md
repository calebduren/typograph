# Links and quotes in Markdown

Markdown links are simple, but their labels interact with quotes and brackets in ways that catch people out.

## The basic syntax

```markdown
[link text](https://example.com)
[link text](https://example.com 'Optional title')
```

The optional title, in quotes after the URL, shows up as a tooltip in most renderers.

## Quotes in the label

Labels can contain quotes without any escaping:

[The "Getting Started" guide](https://example.com/docs/getting-started)

[Read Sam's "quick tips" post](https://example.com/blog/quick-tips)

The label is ordinary inline text, so it can also contain emphasis and code, like [the `--force` flag](https://example.com/cli#force).

## Quotes in the title

Because the title is wrapped in quotes, a quote inside it needs an escape, or you can use single quotes or parentheses instead:

```markdown
[docs](https://example.com 'The "official" docs')
[docs](https://example.com 'The "official" docs')
[docs](https://example.com 'The "official" docs')
```

## Reference-style links

For long documents, reference links keep paragraphs readable:

```markdown
See the [style guide][style] and the [changelog][log].

[style]: https://example.com/style 'House style'
[log]: https://example.com/changelog
```

## Autolinks

Wrap a URL in angle brackets, `<https://example.com>`, and it becomes a link with the URL as its text. Many renderers also auto-link bare URLs, and email addresses like hello@example.com, though this is a GitHub Flavored Markdown extension rather than core Markdown.

## Common problems

1. **Parentheses in the URL.** Wikipedia links end with `)`, which closes the link early. Encode them as `%29`, or wrap the URL in angle brackets.
2. **Spaces in the URL.** Replace them with `%20`.
3. **Brackets in the label.** Escape them with a backslash: `\[` and `\]`.
4. **Smart quotes around the title.** Curly quotes aren't title delimiters, so the title becomes part of the URL.

## Accessibility tip

Avoid "click here." A label like "the pricing page" tells screen-reader users where the link goes, even when they navigate by a list of links.

Tell me which renderer you're using and I'll check your syntax against its rules.
