# Writing commit messages people will actually read

A commit message is a note to whoever runs `git blame` on this line in two years. That person is often you, and you'll have forgotten everything.

## The format

```text
Short summary in the imperative mood (50 chars or fewer)

A blank line, then a body wrapped at about 72 characters that
explains why the change was made, not just what changed.
```

Use the imperative: "Fix login redirect," not "Fixed" or "Fixes." A useful test is to complete the sentence "If applied, this commit will ___."

## What goes in the body

- **The problem.** What was wrong, or what was missing?
- **The reasoning.** Why this approach and not the obvious alternative?
- **Side effects.** Anything reviewers should double-check?

Skip a play-by-play of the diff. The diff already shows what changed.

## Examples

Weak:

```text
fix bug
```

Better:

```text
Fix double-submit on the "Save" button

Clicking twice within 200 ms sent two POST requests, creating
duplicate records. Disable the button on first click and re-enable
it when the request settles.

Fixes #482
```

## Things to avoid

1. Vague words such as "stuff," "updates," or "misc."
2. Mixing unrelated changes into one commit. If you need "and" in the summary, consider splitting it.
3. Apologies or feelings ("finally got this working!"). Save those for chat.
4. Referring to things the reader can't see: "as discussed yesterday" means nothing in a year.

## Conventional Commits

Some teams add a prefix, like `feat:`, `fix:`, or `docs:`, so tools can generate changelogs. It's useful when a team adopts it consistently and a nuisance when only one person follows it. Follow whatever your repository already does.

## Squashing

If your history is full of "wip" and "oops" commits, squash them before merging so the final message tells the real story. Use `git rebase -i` locally, or the squash option on your hosting platform.

## Shell tip

When passing a message on the command line, use single quotes if it contains `$` or backticks: `git commit -m 'Handle $PATH edge case'`. Otherwise, the shell will try to expand it.

If you paste your diff, I'll draft a message for it.
