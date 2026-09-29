# Single quotes vs. double quotes in the shell

In bash and zsh, the two kinds of quotes look interchangeable and behave very differently.

## The short version

- **Single quotes** are literal. Nothing inside them is interpreted.
- **Double quotes** allow variable expansion, command substitution, and a few backslash escapes.

```bash
name="World"
echo 'Hello, $name'   # prints: Hello, $name
echo "Hello, $name"   # prints: Hello, World
```

## Why it matters

Suppose you want to search for a phrase containing a space. Without quotes, the shell splits it into two arguments:

```bash
grep hello world file.txt     # searches for "hello" in files named "world" and "file.txt"
grep "hello world" file.txt   # searches for the phrase
```

Use single quotes when the text contains `$`, backticks, or `!`, and you want them left alone:

```bash
grep '^\$[0-9]+' prices.txt
```

## Putting a single quote inside single quotes

You can't escape it inside single quotes. Instead, close the string, add an escaped quote, and reopen:

```bash
echo 'It'\''s fine'      # prints: It's fine
echo "It's fine"         # simpler: switch to double quotes
```

In bash you can also use ANSI-C quoting: `echo $'It\'s fine'`.

## Nesting

Quotes can be mixed as long as each pair is closed:

```bash
ssh server "echo 'the user is '\$USER"
```

Here the outer double quotes go to your local shell, and the escaped `\$USER` is expanded on the remote one. This is a common source of confusion, so when a command gets tricky, write it to a script file instead.

## Common gotchas

1. **Smart quotes from a document.** If you paste a command from a web page or chat and get "command not found," check for curly quotes. They aren't quotes to the shell.
2. **Spaces in filenames.** Always quote `"$file"`, even when you think it can't contain spaces.
3. **The `!` character.** In interactive bash, `!` triggers history expansion inside double quotes. Single quotes avoid it.
4. **Empty variables.** `[ $x = y ]` breaks if `$x` is empty; `[ "$x" = y ]` doesn't.

## Rule of thumb

Quote every variable expansion with double quotes, and use single quotes for fixed text that contains special characters. If you can't tell which you need, ask what should happen at the moment the shell reads the line.

Paste the command you're wrestling with and I'll show how the shell will split it.
