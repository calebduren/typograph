import { typesetText } from '@calebduren/typograph';

const sample = `"It's ready in 30 min," she said. Dr. Chen's team agreed.`;
const options = { locale: 'en', spacing: true } as const;
let measured: number | undefined;

/**
 * Microseconds per typesetText call, measured once in this browser. One call is faster than
 * the timer's resolution, so this times batches and takes the median.
 */
export function microsecondsPerCall(): number {
  if (measured != null) return measured;
  typesetText(sample, options);
  const batches: number[] = [];
  for (let batch = 0; batch < 9; batch++) {
    const start = performance.now();
    for (let i = 0; i < 100; i++) typesetText(sample, options);
    batches.push((performance.now() - start) / 100);
  }
  batches.sort((a, b) => a - b);
  return (measured = batches[4] * 1000);
}
