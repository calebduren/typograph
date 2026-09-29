# Quoting strings in JavaScript

JavaScript gives you three ways to write a string, and they aren't interchangeable.

## The three forms

```js
const a = 'single quotes';
const b = 'double quotes';
const c = `template literal`;
```

Single and double quotes behave identically. Pick one and let a formatter enforce it. Prettier defaults to double quotes; many teams switch it to single quotes with `singleQuote: true`.

## Escaping

If the string contains the same quote character that delimits it, you have to escape it or choose a different delimiter:

```js
const greeting = "It's a nice day"; // works, but ugly
const better = "It's a nice day"; // no escaping needed
const html = '<a href="/home">Home</a>'; // double quotes inside single
```

The rule of thumb is to choose the delimiter that needs the fewest backslashes. Writing `const s = "hi"` is fine, but `const s = "she said \"hi\""` invites mistakes.

## Template literals

Backticks let you embed expressions and span lines:

```js
const name = 'Ada';
const message = `Hello, ${name}! You've got ${3 + 2} new messages.`;
console.log(message); // Hello, Ada! You've got 5 new messages.
```

Both `'` and `"` can appear freely inside a template literal, so they're handy when building strings with mixed quotes. You only need to escape a backtick or `${`.

## JSON is stricter

JSON only allows double quotes. This is a common source of bugs when you paste an object literal into a `.json` file:

```json
{ "name": "Ada", "role": "engineer" }
```

`{ 'name': 'Ada' }` is valid JavaScript and invalid JSON. If you need to build JSON, use `JSON.stringify(obj)` rather than concatenating strings, because it handles escaping of quotes and newlines for you.

## Quick checklist

1. Prefer one quote style per project and automate it.
2. Use template literals when you need interpolation or multi-line text.
3. Never build JSON or SQL by string concatenation.
4. Watch for smart quotes if you copy code from a document or chat window: a curly `"` is not a valid delimiter, and the error message can be confusing.

If you paste the exact error you're seeing, I can tell you which of these it is.
