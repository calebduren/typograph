# Reading f'(x), y', and x' in calculus

Prime notation is shorthand for "the derivative of," and it shows up in slightly different forms depending on the textbook.

## The main forms

If you have a function f, then f' (read "f prime") is its derivative, and f'' is the derivative of the derivative. For a curve written as y = x^2, you can write y' = 2x. Here's the same idea in three notations:

| Notation | Reads as       | Example                     |
| -------- | -------------- | --------------------------- |
| f'(x)    | "f prime of x" | f(x) = x^2 gives f'(x) = 2x |
| dy/dx    | "dee y dee x"  | y = x^2 gives dy/dx = 2x    |
| Dx       | "D sub x"      | Dx[x^2] = 2x                |

They mean the same thing. Leibniz's dy/dx is handy when you're changing variables; Lagrange's f' is compact for one-variable work.

## When x' means something else

In physics, x' often means the derivative of position with respect to time, so x' is velocity. Some authors use a dot instead (a dotted x), and in linear algebra a prime can also mean a transpose, or simply a second variable, as in "x and x'". Always check the first page of the chapter to see which convention it uses.

## A worked example

Suppose f(x) = 3x^2 + 5x - 2.

1. Apply the power rule to each term: the derivative of 3x^2 is 6x.
2. The derivative of 5x is 5.
3. The derivative of a constant is 0.

So f'(x) = 6x + 5. At x = 2, f'(2) = 17, which is the slope of the tangent line at that point.

## Common slips

- Writing f'(x) when you mean f(x)'. The parenthesis position matters if you're differentiating a composite.
- Forgetting the chain rule: if f(x) = (3x + 1)^2, then f'(x) = 6(3x + 1), not 2(3x + 1).
- Confusing the prime with an inch mark or a closing quote in typed text. Use a proper prime symbol in written work if you can.

If you paste a problem you're stuck on, I'll walk through it step by step and flag which rule applies at each stage.
