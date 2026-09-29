# What a p-value does and doesn't tell you

A p-value is one of the most cited and most misunderstood numbers in statistics. Getting the definition right helps you avoid a lot of bad conclusions.

## The definition

The p-value is the probability of seeing data at least as extreme as yours, if the null hypothesis were true. That's all. It isn't the probability that the null is true, or the probability that your result is a fluke.

## A concrete example

Suppose you flip a coin 100 times and get 60 heads. The null hypothesis is that the coin is fair. The probability of 60 or more heads from a fair coin is about 0.028, so p is about 0.03 (one-sided). That says the result would be somewhat unusual under fairness. It doesn't say there's a 97% chance the coin is biased.

## Common mistakes

1. **"p < 0.05 means the effect is real."** It means the data would be unusual under the null. Real effects and lucky samples can both produce it.
2. **"p > 0.05 means there's no effect."** Absence of evidence isn't evidence of absence, especially with a small sample.
3. **Confusing significance with importance.** With enough data, a trivially small difference becomes "statistically significant."
4. **Testing many things.** Run 20 tests and one will cross 0.05 by chance alone. Adjust for multiple comparisons.
5. **Stopping when it looks good.** Peeking at results and stopping the moment p dips below 0.05 inflates false positives.

## What to report instead

- The **effect size**, such as the difference in means.
- A **confidence interval**, which shows the range of plausible values.
- The **sample size** and how you chose it.
- The exact p-value, not just "p < 0.05."

## A note on notation

Statisticians use a prime for a second sample or a transformed variable: if x is your original measurement, x' might be the rescaled one, and s' a pooled estimate. Check each paper's definitions, since conventions vary.

## Bayesian alternative

A Bayesian analysis gives you what people often assume a p-value provides: the probability of a hypothesis given the data. It requires a prior, which some consider a strength and others a liability.

## A practical checklist

| Question                  | Why it matters       |
| ------------------------- | -------------------- |
| How big is the effect?    | Practical importance |
| How wide is the interval? | Precision            |
| Was the test planned?     | Avoid cherry-picking |
| How many tests were run?  | Multiple comparisons |

If you share your study design, I can help you choose an appropriate test and think about what to report.
