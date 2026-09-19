import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { example } from '../src/chat-preview';

const review = '../../.impeccable/review';

test('production links, metadata, and asset headers work', async ({ page }) => {
  const response = await page.goto('/');
  const csp = response!.headers()['content-security-policy'];
  expect(csp).toContain("style-src 'self';");
  expect(csp).toContain("style-src-attr 'unsafe-inline'");
  await expect(page).toHaveTitle('Typograph — Nicer typography for streaming AI.');
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    await page.title(),
  );
  const imageUrl = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(imageUrl).toBe('https://typograph.dev/social.png');
  const image = await page.request.get(new URL(imageUrl!).pathname);
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toContain('image/png');
  expect((await image.body()).subarray(1, 4).toString()).toBe('PNG');
  expect((await page.request.get('/.vite/manifest.json')).status()).toBe(404);
  const measurement = page.getByRole('link', { name: 'View the measurement' });
  await expect(measurement).toHaveAttribute('href', /^\/assets\/.*\.json$/);
  await measurement.click();
  await expect(page).toHaveURL(/\/assets\/.*\.json$/);
  const data = await page.request.get(page.url());
  expect(data.status()).toBe(200);
  expect((await data.json()).bundle.gzipBytes).toBeGreaterThan(0);
  expect(data.headers()['cache-control']).toContain('immutable');
  const font = await page.request.get('/fonts/InterVariable.woff2');
  expect(font.status()).toBe(200);
  expect(font.headers()['cache-control']).toContain('max-age=604800');
  const guide = await page.goto('/integration.md');
  expect(guide!.headers()['content-type']).toContain('text/plain');
  expect(guide!.headers()['content-disposition']).toBe('inline');
  await expect(page.locator('body')).toContainText('English-only');
});

test('the hero renders while the comparison bundle is still loading', async ({ page }) => {
  const manifest = JSON.parse(
    await readFile(new URL('../dist/.vite/manifest.json', import.meta.url), 'utf8'),
  );
  expect(manifest['index.html'].dynamicImports).toHaveLength(1);
  const comparisonBundle = manifest[manifest['index.html'].dynamicImports[0]].file;
  let requestBlocked = false;
  let release!: () => void;
  const loaded = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/${comparisonBundle}`, async (route) => {
    requestBlocked = true;
    await loaded;
    await route.continue();
  });
  try {
    await page.goto('/#demo', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => requestBlocked).toBe(true);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Nicer typography for streaming AI.',
    );
    await expect(page.getByRole('status')).toHaveText('Loading the comparison…');
  } finally {
    release();
  }
  await expect(page.getByTestId('formatted-response')).toBeVisible();
  expect(
    Math.abs(await page.locator('#demo').evaluate((node) => node.getBoundingClientRect().top)),
  ).toBeLessThan(2);
});

test('comparison uses the real plugin, preserves nodes, and supports native text copying', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Nicer typography for streaming AI.',
  );
  const original = page.getByTestId('original-response');
  const formatted = page.getByTestId('formatted-response');
  await expect(original).toContainText('"It\'s in the details,"');
  await expect(page.getByTestId('source-editor')).toBeHidden();
  await expect(formatted).toContainText('“It’s in the details,”');
  await mkdir(review, { recursive: true });
  await page.screenshot({ path: `${review}/desktop.png`, fullPage: true });
  await formatted
    .locator('p')
    .first()
    .evaluate((node) => node.setAttribute('data-retained', 'yes'));
  const highlightSwitch = page.getByRole('switch', { name: 'Show changes' });
  await expect(highlightSwitch).toHaveAttribute('aria-checked', 'false');
  await highlightSwitch.focus();
  await page.keyboard.press('Space');
  await expect(highlightSwitch).toHaveAttribute('aria-checked', 'true');
  await expect(formatted.locator('mark').first()).toBeVisible();
  await expect(original.locator('mark')).toHaveCount(0);
  await expect(formatted.locator('p').first()).toHaveAttribute('data-retained', 'yes');
  await formatted.evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  await page.keyboard.press('ControlOrMeta+C');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    '“It’s in the details,”',
  );
  await expect(formatted.locator('code').first()).toHaveText('const message = "It\'s ready.";');
  await expect(formatted.locator('pre')).toContainText('const duration = "30 min";');
  await expect(formatted).toContainText('"leave this alone"');
  await expect(formatted).toContainText('5\'10" tall');
  await expect(formatted.locator('ul')).toBeVisible();
  await expect(formatted.locator('ol')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Try an example' })).toHaveCount(0);
  await expect(formatted.getByRole('table')).toBeVisible();
  await expect(formatted.getByRole('link', { name: 'the guide' })).toHaveAttribute(
    'href',
    "https://example.com/it's-here",
  );
  expect(errors).toEqual([]);
});

test('playback pauses, scrubs, and resumes through an ambiguous prefix', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('group', { name: 'Original view' })
    .getByRole('button', { name: 'Markdown', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Original Markdown' })
    .fill('It took 30 million small decisions. Wait 30 min before leaving.');
  await page
    .getByRole('group', { name: 'Typography settings', exact: true })
    .getByRole('switch', { name: 'Non-breaking spaces' })
    .click();
  await expect(
    page
      .getByRole('group', { name: 'Typography settings', exact: true })
      .getByRole('switch', { name: 'Non-breaking spaces' }),
  ).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Replay stream' }).click();
  await expect(page.getByTestId('playback-state')).toHaveText('Streaming');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByTestId('playback-state')).toHaveText('Paused');
  const progress = page.getByRole('slider', { name: 'Stream progress' });
  await progress.fill('1');
  await expect(page.getByTestId('formatted-response')).toContainText('It took 30 m');
  expect(await page.getByTestId('formatted-response').textContent()).not.toContain('30\u00a0m');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByTestId('playback-state')).toHaveText('Complete', { timeout: 8000 });
  await expect(page.getByTestId('formatted-response')).toContainText('30 million');
  expect(await page.getByTestId('formatted-response').textContent()).toContain('30\u00a0min');
});

test('editing stays local, handles empty text, and retains a custom source', async ({
  page,
  baseURL,
}) => {
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== new URL(baseURL!).origin)
      externalRequests.push(request.url());
  });
  await page.goto('/');
  await page
    .getByRole('group', { name: 'Original view' })
    .getByRole('button', { name: 'Markdown', exact: true })
    .click();
  const editor = page.getByRole('textbox', { name: 'Original Markdown' });
  await expect(editor).toBeEditable();
  await editor.fill('"New words." ![A private image](https://example.com/private.png)');
  await expect(editor).toBeFocused();
  await expect(page.getByTestId('formatted-response')).toContainText('“New words.”');
  await expect(page.getByTestId('formatted-response')).toContainText('[Image: A private image]');
  expect(externalRequests).toEqual([]);
  await expect(editor).toHaveValue(
    '"New words." ![A private image](https://example.com/private.png)',
  );
  await page.getByRole('button', { name: 'Reset example' }).click();
  await expect(editor).toHaveValue(example.text);
  await expect(page.getByRole('button', { name: 'Reset example' })).toHaveCount(0);
  await editor.fill('');
  await expect(page.getByRole('button', { name: 'Replay stream' })).toBeDisabled();
  await expect(page.getByTestId('formatted-response')).toContainText(
    'Add some English text in Original to begin.',
  );
});

test('mobile keeps one reading area, preserves progress, and respects reduced motion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('playback-state')).toHaveText('Complete');
  await expect(page.getByTestId('formatted-response')).toBeVisible();
  await expect(page.getByTestId('original-response')).toBeHidden();
  await page.screenshot({ path: `${review}/mobile.png`, fullPage: true });
  await page.getByRole('slider', { name: 'Stream progress' }).fill('4');
  await page.getByRole('button', { name: 'Original', exact: true }).click();
  await expect(page.getByTestId('original-response')).toBeVisible();
  await expect(page.getByTestId('formatted-response')).toBeHidden();
  await expect(page.getByRole('slider', { name: 'Stream progress' })).toHaveValue('4');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('integration recipes, local guide, and keyboard entry work', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to the comparison' })).toBeFocused();
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('button', { name: 'Cloudflare', exact: true }).click();
  await expect(page.getByLabel('Cloudflare code example')).toContainText('useAgentChat');
  await page.getByRole('button', { name: 'Remark', exact: true }).click();
  await expect(page.getByLabel('Remark code example')).toContainText('processor.runSync');
  const guide = await page.request.get('/integration.md');
  expect(guide.status()).toBe(200);
  expect(await guide.text()).toContain('English-only');
});

test('agent prompts match the selected stack and offer a manual copy fallback', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  for (const [stack, expected] of [
    ['AI Elements', 'MessageResponse'],
    ['Cloudflare', 'useAgentChat'],
    ['Remark', 'processor.runSync'],
  ]) {
    await page.getByRole('button', { name: stack, exact: true }).click();
    const prompt = page.getByRole('region', { name: `${stack} agent prompt` });
    await expect(prompt).toContainText(expected);
    await page.getByRole('button', { name: 'Copy agent prompt' }).click();
    await expect(page.getByRole('button', { name: 'Copy agent prompt' })).toHaveText('Copied');
    await expect(page.locator('.recipe-status')).toHaveCount(0);
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(await prompt.textContent());
    expect(copied).toContain('English-only');
    expect(copied).toContain('npm install @calebduren/typograph');
    expect(copied).toContain('text-wrap: pretty');
  }
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('button', { name: 'Copy integration code' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('processor.runSync');
  await page.getByRole('button', { name: 'Agent prompt', exact: true }).click();
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: () => Promise.reject(new Error('Clipboard denied')),
    });
  });
  await page.getByRole('button', { name: 'Copy agent prompt' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Copy unavailable.' })).toContainText(
    'copy it manually',
  );
  await expect(page.getByRole('region', { name: 'Remark agent prompt' })).toBeVisible();
});

test('all typography combinations stay in sync with previews, prompts, and code', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  const settings = page.getByRole('group', { name: 'Typography settings', exact: true });
  await expect(settings.getByRole('switch')).toHaveCount(3);
  await expect(
    page.locator('.formatted-pane').getByRole('switch', { name: 'Show changes' }),
  ).toBeVisible();
  const original = await page.getByTestId('original-response').textContent();
  for (const punctuation of [true, false])
    for (const spacing of [false, true])
      for (const hanging of [false, true]) {
        await settings.getByRole('switch', { name: 'Smart punctuation' }).setChecked(punctuation);
        await settings.getByRole('switch', { name: 'Non-breaking spaces' }).setChecked(spacing);
        await settings.getByRole('switch', { name: 'Hanging punctuation' }).setChecked(hanging);
        const formatted = page.getByTestId('formatted-response');
        await expect(formatted).toContainText(
          punctuation ? '“It’s in the details' : '"It\'s in the details',
        );
        expect(await formatted.textContent()).toContain(spacing ? '30\u00a0min' : '30 min');
        expect((await formatted.locator('.typograph-opening').count()) > 0).toBe(hanging);
        expect(await page.getByTestId('original-response').textContent()).toBe(original);
        const prompt = page.getByRole('region', { name: 'AI Elements agent prompt' });
        await expect(prompt).toContainText(`punctuation: ${punctuation}, spacing: ${spacing}`);
        await expect(prompt).toContainText(`Hanging punctuation: ${hanging ? 'on' : 'off'}`);
        await page.getByRole('button', { name: 'Code', exact: true }).click();
        const code = page.getByLabel('AI Elements code example');
        await expect(code).toContainText(`punctuation: ${punctuation}, spacing: ${spacing}`);
        expect((await code.textContent())?.includes('@calebduren/typograph/hanging.css')).toBe(
          hanging,
        );
        await page.getByRole('button', { name: 'Agent prompt', exact: true }).click();
      }
  // Highlighting remains a local preview state, never part of a copied setup.
  const before = await page.getByRole('region', { name: 'AI Elements agent prompt' }).textContent();
  await page.getByRole('switch', { name: 'Show changes' }).click();
  expect(await page.getByRole('region', { name: 'AI Elements agent prompt' }).textContent()).toBe(
    before,
  );
  await page.getByRole('button', { name: 'Copy agent prompt' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(before);
  for (const stack of ['Cloudflare', 'Remark']) {
    await page.getByRole('button', { name: stack, exact: true }).click();
    await expect(page.getByRole('region', { name: `${stack} agent prompt` })).toContainText(
      'Hanging punctuation: on',
    );
    await page.getByRole('button', { name: 'Code', exact: true }).click();
    await expect(page.getByLabel(`${stack} code example`)).toContainText(
      '@calebduren/typograph/hanging.css',
    );
    await page.getByRole('button', { name: 'Agent prompt', exact: true }).click();
  }
});

test('hanging uses actual quote width, keeps text intact, and survives streaming and resizing', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  const formatted = page.getByTestId('formatted-response');
  const text = await formatted.textContent();
  await expect(formatted).toHaveAttribute('data-rulers', 'false');
  await page
    .getByRole('group', { name: 'Typography settings', exact: true })
    .getByRole('switch', { name: 'Hanging punctuation' })
    .click();
  await expect(formatted).toHaveAttribute('data-rulers', 'false');
  for (const width of ['28', '64']) {
    await page.getByRole('slider', { name: 'Reading width' }).fill(width);
    const geometry = await formatted
      .locator('p')
      .first()
      .evaluate((paragraph) => {
        const quote = paragraph.querySelector('.typograph-opening > span')!;
        const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
        walker.nextNode();
        const rest = walker.nextNode()!;
        const range = document.createRange();
        range.setStart(rest, 0);
        range.setEnd(rest, 1);
        return {
          paragraph: paragraph.getBoundingClientRect().left,
          quote: quote.getBoundingClientRect().left,
          quoteEnd: quote.getBoundingClientRect().right,
          letter: range.getBoundingClientRect().left,
        };
      });
    expect(geometry.quote).toBeLessThan(geometry.paragraph - 2);
    expect(Math.abs(geometry.quoteEnd - geometry.paragraph)).toBeLessThan(1);
    expect(Math.abs(geometry.letter - geometry.paragraph)).toBeLessThan(1);
  }
  expect(await formatted.textContent()).toBe(text);
  await page.getByRole('button', { name: 'Replay stream' }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const end = Number(
    await page.getByRole('slider', { name: 'Stream progress' }).getAttribute('max'),
  );
  await page.getByRole('slider', { name: 'Stream progress' }).fill(String(end - 1));
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByTestId('playback-state')).toHaveText('Complete');
  expect(await formatted.locator('.typograph-opening').count()).toBeGreaterThan(2);
  await page.getByRole('switch', { name: 'Show changes' }).click();
  expect(
    await formatted
      .locator('mark .typograph-opening > span')
      .first()
      .evaluate((node) => getComputedStyle(node, '::before').backgroundColor),
  ).toBe('rgb(232, 223, 243)');
  await expect(formatted).toHaveAttribute('data-rulers', 'true');
  expect(
    await formatted
      .locator('mark[data-typograph-change=punctuation]')
      .last()
      .evaluate((node) => getComputedStyle(node, '::before').backgroundColor),
  ).toBe('rgb(223, 234, 250)');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: `${review}/mobile-hanging.png`, fullPage: true });
  await page
    .getByRole('group', { name: 'Typography settings', exact: true })
    .getByRole('switch', { name: 'Hanging punctuation' })
    .click();
  await expect(formatted.locator('.typograph-opening')).toHaveCount(0);
  await expect(formatted).toHaveAttribute('data-rulers', 'false');
  expect(await formatted.textContent()).toBe(text);
  await page
    .getByRole('group', { name: 'Typography settings', exact: true })
    .getByRole('switch', { name: 'Non-breaking spaces' })
    .click();
  expect(
    await formatted
      .locator('mark[data-typograph-change=spacing]')
      .first()
      .evaluate((node) => getComputedStyle(node, '::before').backgroundColor),
  ).toBe('rgb(245, 232, 197)');
});

test('conversation replays a user message, pauses thinking, streams, and cancels on edit', async ({
  page,
}) => {
  await page.goto('/');
  const original = page.getByTestId('source-editor');
  const source = await original.inputValue();
  await page.getByRole('button', { name: 'AI Conversation', exact: true }).click();
  await expect(page.locator('.formatted-pane .chat-user')).toContainText(example.question);
  await expect(page.getByTestId('playback-state')).toHaveText('Complete');
  await expect(original).toHaveValue(example.text);
  await page
    .getByRole('group', { name: 'Preview mode' })
    .getByRole('button', { name: 'Text', exact: true })
    .click();
  await expect(original).toHaveValue(example.text);
  await page.getByRole('button', { name: 'AI Conversation', exact: true }).click();
  await page.getByRole('button', { name: 'Replay stream' }).click();
  await expect(page.getByTestId('playback-state')).toHaveText('Thinking');
  await expect(page.locator('.formatted-pane .thinking-note')).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.locator('.formatted-pane .chat-agent-label')).toContainText('Thinking paused');
  await expect(original).toHaveValue(source);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByTestId('playback-state')).toHaveText('Streaming', { timeout: 3000 });
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.locator('.formatted-pane .chat-agent-label')).toContainText('Writing paused');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const end = Number(
    await page.getByRole('slider', { name: 'Stream progress' }).getAttribute('max'),
  );
  await page.getByRole('slider', { name: 'Stream progress' }).fill(String(end - 12));
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const scrollArea = page.getByRole('region', { name: 'Text comparison' });
  await expect
    .poll(() =>
      scrollArea.evaluate((node) => node.scrollHeight - node.scrollTop - node.clientHeight),
    )
    .toBeLessThan(32);
  await scrollArea.evaluate((node) => {
    node.scrollTop = 0;
    node.dispatchEvent(new Event('scroll'));
  });
  await expect(page.getByTestId('playback-state')).toHaveText('Complete');
  expect(await scrollArea.evaluate((node) => node.scrollTop)).toBe(0);
  await expect(page.getByTestId('formatted-response')).toContainText('“It’s in the details,”');
  await page
    .getByRole('group', { name: 'Typography settings', exact: true })
    .getByRole('switch', { name: 'Hanging punctuation' })
    .click();
  await page.getByRole('switch', { name: 'Show changes' }).click();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: `${review}/conversation.png`, fullPage: true });
  await page.getByRole('button', { name: 'Replay stream' }).click();
  await page
    .getByRole('group', { name: 'Original view' })
    .getByRole('button', { name: 'Markdown', exact: true })
    .click();
  await original.fill('"A fresh answer."');
  await expect(page.getByTestId('playback-state')).toHaveText('Complete');
  await expect(page.getByTestId('formatted-response')).toHaveText('“A fresh answer.”');
  await expect(original).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.formatted-pane .conversation-context')).toHaveCSS(
    'min-height',
    '0px',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('records a browser performance probe under sixfold CPU throttling', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await expect(page.getByTestId('playback-state')).toHaveText('Complete');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await cdp.send('Performance.enable');
  await page.evaluate(() => {
    const state = window as unknown as Window & { __longTasks: number[] };
    state.__longTasks = [];
    new PerformanceObserver((list) => {
      state.__longTasks.push(...list.getEntries().map((entry) => entry.duration));
    }).observe({ type: 'longtask' });
  });
  const before = await cdp.send('Performance.getMetrics');
  await page.getByRole('button', { name: 'Replay stream' }).click();
  await expect(page.getByTestId('playback-state')).toHaveText('Streaming');
  await expect(page.getByTestId('playback-state')).toHaveText('Complete', { timeout: 45000 });
  const after = await cdp.send('Performance.getMetrics');
  const metric = (data: typeof before, name: string) =>
    data.metrics.find((entry) => entry.name === name)?.value ?? 0;
  const longTasks = await page.evaluate(
    () => (window as unknown as Window & { __longTasks: number[] }).__longTasks,
  );
  await writeFile(
    `${review}/browser-performance-viewport.json`,
    JSON.stringify(
      {
        note: 'Single local Chrome run, simulated 6x CPU slowdown; not a physical-device or production benchmark.',
        viewport: '1440 × 1000',
        sample: 'Studio review',
        sourceLength: example.text.length,
        renderers: 2,
        original: 'unprocessed rendered Markdown',
        highlight: false,
        spacing: false,
        taskTimeMs: Math.round(
          (metric(after, 'TaskDuration') - metric(before, 'TaskDuration')) * 1000,
        ),
        longTasks: longTasks.length,
        longestTaskMs: Math.max(0, ...longTasks),
      },
      null,
      2,
    ),
  );
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
});

test('highlight backgrounds sit beneath adjacent glyphs in the hero and response', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('switch', { name: 'Show changes' }).click();
  for (const selector of ['.proof-result', '.formatted-pane .response-prose']) {
    await expect(page.locator(selector)).toHaveCSS('isolation', 'isolate');
    const layers = await page.locator(`${selector} mark`).evaluateAll((marks) =>
      marks.map((mark) => ({
        background: getComputedStyle(mark).backgroundColor,
        layer: getComputedStyle(mark, '::before').zIndex,
        color: getComputedStyle(mark, '::before').backgroundColor,
      })),
    );
    expect(layers.length).toBeGreaterThan(0);
    expect(
      layers.every(
        (layer) =>
          layer.background === 'rgba(0, 0, 0, 0)' &&
          layer.layer === '-1' &&
          layer.color !== 'rgba(0, 0, 0, 0)',
      ),
    ).toBe(true);
  }
  await page.locator('.proof-result').screenshot({ path: `${review}/hero-highlights.png` });
  const viewport = page.getByRole('region', { name: 'Text comparison' });
  expect(await viewport.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
  await viewport.focus();
  await page.keyboard.press('ControlOrMeta+End');
  await expect(viewport).toBeFocused();
  await page.getByRole('switch', { name: 'Show changes' }).click();
  expect(
    await page
      .locator('.response-prose mark')
      .evaluateAll((marks) =>
        marks.every((mark) => getComputedStyle(mark, '::before').visibility === 'hidden'),
      ),
  ).toBe(true);
});

test('reflows at narrow, tablet, user, and enlarged-text sizes', async ({ page }) => {
  for (const width of [320, 768, 1301]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Nicer typography for streaming AI.',
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    if (width === 1301) await page.screenshot({ path: `${review}/user-1301.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '';
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: `${review}/dark.png`, fullPage: true });
});

test('vertical scroll fades follow both edges, resized content, and replaced prompts', async ({
  page,
}) => {
  await page.goto('/');
  const preview = page.getByRole('region', { name: 'Text comparison' });
  await expect
    .poll(() =>
      preview.evaluate((node) => getComputedStyle(node).getPropertyValue('--scroll-fade-bottom')),
    )
    .toBe('80px');
  await page
    .getByRole('group', { name: 'Original view' })
    .getByRole('button', { name: 'Markdown', exact: true })
    .click();
  const editor = page.getByRole('textbox', { name: 'Original Markdown' });
  const prompt = page.getByRole('region', { name: 'AI Elements agent prompt' });
  const edges = (area: typeof editor) =>
    area.evaluate((node) => ({
      top: getComputedStyle(node).getPropertyValue('--scroll-fade-top'),
      bottom: getComputedStyle(node).getPropertyValue('--scroll-fade-bottom'),
    }));
  for (const area of [preview, prompt]) {
    await expect.poll(() => edges(area)).toEqual({ top: '0px', bottom: '80px' });
    expect(await area.evaluate((node) => getComputedStyle(node).maskImage)).not.toBe('none');
    await area.evaluate((node) => {
      node.scrollTop = (node.scrollHeight - node.clientHeight) / 2;
    });
    await expect.poll(() => edges(area)).toEqual({ top: '80px', bottom: '80px' });
    await area.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await expect.poll(() => edges(area)).toEqual({ top: '80px', bottom: '0px' });
    await area.evaluate((node) => {
      node.scrollTop = 0;
    });
  }
  await page.screenshot({ path: `${review}/scroll-fades-desktop.png`, fullPage: true });
  await editor.fill('"A short response."');
  await expect.poll(() => edges(preview)).toEqual({ top: '0px', bottom: '0px' });
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('button', { name: 'Agent prompt', exact: true }).click();
  await page.getByRole('button', { name: 'Cloudflare', exact: true }).click();
  const replacement = page.getByRole('region', { name: 'Cloudflare agent prompt' });
  await expect.poll(() => edges(replacement)).toEqual({ top: '0px', bottom: '80px' });
  await replacement.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect.poll(() => edges(replacement)).toEqual({ top: '80px', bottom: '0px' });
  await page.getByRole('button', { name: 'Reset example' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Original', exact: true }).click();
  await expect.poll(() => edges(preview)).toEqual({ top: '0px', bottom: '80px' });
  await page.getByRole('button', { name: 'With Typograph', exact: true }).click();
  await expect.poll(() => edges(preview)).toEqual({ top: '0px', bottom: '80px' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: `${review}/scroll-fades-mobile-dark.png`, fullPage: true });
});

test('comparison fits the desktop viewport, sticks controls, and preserves editor changes across tabs', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const height of [900, 1100]) {
    await page.setViewportSize({ width: 1301, height });
    await page.goto('/');
    await expect(page.getByTestId('formatted-response')).toBeVisible();
    // Settle font substitution before measuring navigation and viewport geometry.
    // Initial fragments during lazy loading are covered by the hero-loading test.
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole('link', { name: 'Try it', exact: true }).click();
    await expect
      .poll(async () => Math.abs((await page.locator('#demo').boundingBox())?.y ?? Infinity))
      .toBeLessThan(1);
    const bounds = await page.locator('#demo').boundingBox();
    expect(Math.abs(bounds!.height - height)).toBeLessThan(1);
    expect(Math.abs(bounds!.y)).toBeLessThan(1);
    const reading = await page.getByRole('region', { name: 'Text comparison' }).boundingBox();
    expect(reading!.height).toBeGreaterThan(height * 0.5);
    await page.evaluate(() => window.scrollBy(0, 100));
    expect(Math.abs((await page.locator('.comparison-controls').boundingBox())!.y)).toBeLessThan(1);
  }
  await page.goto('/#demo');
  const originalView = page.getByRole('group', { name: 'Original view' });
  await originalView.getByRole('button', { name: 'Markdown', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Original Markdown' });
  await editor.fill('"Compare **these words**."');
  await originalView.getByRole('button', { name: 'Text', exact: true }).click();
  await expect(page.getByTestId('original-response')).toHaveText('"Compare these words."');
  await expect(
    page.getByTestId('original-response').locator('[data-streamdown="strong"]'),
  ).toHaveText('these words');
  await expect(page.getByTestId('formatted-response')).toHaveText('“Compare these words.”');
  await originalView.getByRole('button', { name: 'Markdown', exact: true }).click();
  await expect(editor).toHaveValue('"Compare **these words**."');
  await page.setViewportSize({ width: 390, height: 667 });
  expect((await page.locator('#demo').boundingBox())!.height).toBeGreaterThan(667);
  expect(
    (await page.getByRole('region', { name: 'Text comparison' }).boundingBox())!.height,
  ).toBeGreaterThan(300);
  await expect(page.getByRole('heading', { name: 'What it doesn’t do' })).toBeVisible();
  await expect(page.locator('.scope-details summary')).toHaveCount(0);
  await page.setViewportSize({ width: 1301, height: 901 });
  await page.goto('/');
  await expect(page.getByTestId('formatted-response')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('link', { name: 'Try it', exact: true }).click();
  await expect
    .poll(async () => Math.abs((await page.locator('#demo').boundingBox())?.y ?? Infinity))
    .toBeLessThan(1);
  await page.screenshot({ path: `${review}/viewport-comparison.png` });
});

test('both columns and the growing editor live in one native scroll container', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#demo');
  const viewport = page.getByRole('region', { name: 'Text comparison' });
  await expect(viewport).toBeVisible();
  const scrollContainers = () =>
    page.locator('.comparison-frame').evaluate((frame) =>
      [...frame.querySelectorAll('*')]
        .filter((node) => {
          const element = node as HTMLElement;
          return (
            /auto|scroll/.test(getComputedStyle(element).overflowY) &&
            element.scrollHeight > element.clientHeight
          );
        })
        .map((element) => element.className),
    );
  expect(await scrollContainers()).toEqual(['preview-scroll scroll-fade']);
  const positions = () =>
    page
      .locator('.comparison-columns')
      .evaluate((grid) => [...grid.children].map((child) => child.getBoundingClientRect().top));
  const before = await positions();
  await viewport.evaluate((node) => {
    node.scrollTop = 400;
  });
  await expect.poll(() => viewport.evaluate((node) => node.scrollTop)).toBe(400);
  const after = await positions();
  expect(before.map((top, i) => top - after[i]!)).toEqual([400, 400]);
  await page.screenshot({ path: `${review}/shared-scroll-desktop.png` });

  const sourceView = page.getByRole('group', { name: 'Original view' });
  await sourceView.getByRole('button', { name: 'Markdown', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Original Markdown' });
  await editor.fill((example.text + '\n').repeat(3));
  expect(
    await editor.evaluate((node) => node.scrollHeight - node.clientHeight),
  ).toBeLessThanOrEqual(1);
  expect(await scrollContainers()).toEqual(['preview-scroll scroll-fade']);
  await editor.press('ControlOrMeta+End');
  await editor.press('Enter');
  await editor.pressSequentially('A final line.');
  await expect(editor).toHaveValue((example.text + '\n').repeat(3) + '\nA final line.');
  expect(
    await editor.evaluate((node) => node.scrollHeight - node.clientHeight),
  ).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Reset example' }).click();
  await sourceView.getByRole('button', { name: 'Text', exact: true }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await viewport.evaluate((node) => {
    node.scrollTop = 400;
  });
  await page.getByRole('button', { name: 'Original', exact: true }).click();
  expect(await viewport.evaluate((node) => node.scrollTop)).toBe(400);
  await page.getByRole('button', { name: 'With Typograph', exact: true }).click();
  expect(await viewport.evaluate((node) => node.scrollTop)).toBe(400);
  expect(await scrollContainers()).toEqual(['preview-scroll scroll-fade']);
  await page.screenshot({ path: `${review}/shared-scroll-mobile.png` });
});

test('Show changes only paints annotations without changing glyph positions or the viewport', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [1301, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/#demo');
    await expect(page.getByTestId('formatted-response')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page
      .getByRole('group', { name: 'Typography settings', exact: true })
      .getByRole('switch', { name: 'Non-breaking spaces', exact: true })
      .click();
    await page
      .getByRole('group', { name: 'Typography settings', exact: true })
      .getByRole('switch', { name: 'Hanging punctuation', exact: true })
      .click();
    const viewport = page.getByRole('region', { name: 'Text comparison' });
    const geometry = () =>
      viewport.evaluate((area) => {
        const origin = area.getBoundingClientRect();
        const response = area.querySelector('[data-testid="formatted-response"]')!;
        const walker = document.createTreeWalker(response, NodeFilter.SHOW_TEXT);
        const glyphs = [];
        while (walker.nextNode()) {
          const text = walker.currentNode;
          for (let i = 0; i < text.textContent!.length; i++) {
            const range = document.createRange();
            range.setStart(text, i);
            range.setEnd(text, i + 1);
            const rect = range.getBoundingClientRect();
            glyphs.push([rect.x - origin.x, rect.y - origin.y, rect.width, rect.height]);
          }
        }
        return {
          glyphs,
          height: area.clientHeight,
          scrollHeight: area.scrollHeight,
          scrollTop: area.scrollTop,
        };
      });
    for (const top of [0, 400]) {
      await viewport.evaluate((node, y) => {
        node.scrollTop = y;
      }, top);
      const before = await geometry();
      await page.getByRole('switch', { name: 'Show changes', exact: true }).click();
      expect(await geometry()).toEqual(before);
      await page.getByRole('switch', { name: 'Show changes', exact: true }).click();
      expect(await geometry()).toEqual(before);
    }
  }
});

test('plain CSS styles Streamdown markup, code lines, and long blocks without Tailwind', async ({
  page,
}) => {
  await page.goto('/#demo');
  for (const pane of ['original-response', 'formatted-response']) {
    const response = page.getByTestId(pane);
    await expect(response.locator('[data-streamdown=strong]').first()).toHaveCSS(
      'font-weight',
      '600',
    );
    const lines = response.locator('[data-streamdown=code-block-body] pre > code > span');
    await expect(lines).toHaveCount(3);
    const boxes = await lines.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return {
          top: box.top,
          bottom: box.bottom,
          left: box.left,
          display: getComputedStyle(element).display,
        };
      }),
    );
    expect(boxes.every((box) => box.display === 'block')).toBe(true);
    expect(boxes[1]!.top).toBeGreaterThanOrEqual(boxes[0]!.bottom);
    expect(boxes[2]!.top).toBeGreaterThanOrEqual(boxes[1]!.bottom);
    expect(boxes.every((box) => box.left === boxes[0]!.left)).toBe(true);
    expect(await response.locator('pre').innerText()).toBe(
      'const message = "It\'s ready.";\nconst duration = "30 min";\nconst draft = { title: "Studio review", approved: false };',
    );
  }
  const viewport = page.getByRole('region', { name: 'Text comparison' });
  await viewport.evaluate((area) => {
    const code = area.querySelector('[data-streamdown=code-block]')!;
    area.scrollTop += code.getBoundingClientRect().top - area.getBoundingClientRect().top - 80;
  });
  await page.screenshot({ path: `${review}/renderer-css-desktop.png` });

  await page
    .getByRole('group', { name: 'Original view' })
    .getByRole('button', { name: 'Markdown', exact: true })
    .click();
  const source =
    '```js\n' +
    Array.from({ length: 120 }, (_, i) => `const item${i} = "Keep this literal.";`).join('\n') +
    '\n```';
  await page.getByRole('textbox', { name: 'Original Markdown' }).fill(source);
  await page.setViewportSize({ width: 390, height: 844 });
  const body = page.getByTestId('formatted-response').locator('[data-streamdown=code-block-body]');
  await expect(body).toHaveCSS('max-height', 'none');
  expect((await body.boundingBox())!.height).toBeGreaterThan(2000);
  expect(await body.evaluate((node) => node.scrollHeight - node.clientHeight)).toBeLessThanOrEqual(
    1,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await viewport.evaluate((area) => {
    area.scrollTop = 0;
  });
  await page.screenshot({ path: `${review}/renderer-css-mobile.png` });
});

test('integration switches share settings with the comparison and copied instructions', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  const preview = page.getByRole('group', { name: 'Typography settings', exact: true });
  const integration = page.getByRole('group', {
    name: 'Integration typography settings',
    exact: true,
  });
  await expect(integration.getByRole('switch')).toHaveCount(3);
  await integration.getByRole('switch', { name: 'Non-breaking spaces' }).click();
  await integration.getByRole('switch', { name: 'Smart punctuation' }).click();
  await expect(preview.getByRole('switch', { name: 'Non-breaking spaces' })).toBeChecked();
  await expect(preview.getByRole('switch', { name: 'Smart punctuation' })).not.toBeChecked();
  await expect(page.getByTestId('formatted-response')).toContainText('"It\'s in the details');
  expect(await page.getByTestId('formatted-response').textContent()).toContain('30\u00a0min');
  await preview.getByRole('switch', { name: 'Hanging punctuation' }).click();
  await expect(integration.getByRole('switch', { name: 'Hanging punctuation' })).toBeChecked();
  await page.getByRole('button', { name: 'Copy agent prompt' }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('punctuation: false, spacing: true');
  expect(copied).toContain('Hanging punctuation: on');
  await integration.getByRole('switch', { name: 'Hanging punctuation' }).click();
  await expect(page.getByRole('button', { name: 'Copy agent prompt' })).toHaveText('Copy prompt');
});

test('sliders preserve native keyboard input, clamp elastic dragging, and respect reduced motion', async ({
  page,
}) => {
  await page.goto('/#demo');
  const width = page.getByRole('slider', { name: 'Reading width' });
  await width.focus();
  await width.press('Home');
  await expect(width).toHaveValue('28');
  await width.press('End');
  await expect(width).toHaveValue('64');
  await width.press('ArrowLeft');
  await expect(width).toHaveValue('62');
  await expect(width).toHaveAttribute('aria-valuetext', '62 ch maximum');
  const visual = page.locator('.width-control .slider-visual');
  const bounds = (await width.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width + 80, bounds.y + bounds.height / 2);
  await expect(width).toHaveValue('64');
  expect(
    await visual.evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).a),
  ).toBeGreaterThan(1);
  await page.mouse.up();
  await expect(visual).toHaveCSS('transform', 'none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x - 80, bounds.y + bounds.height / 2);
  await expect(width).toHaveValue('28');
  await expect(visual).toHaveCSS('transform', 'none');
  await page.mouse.up();
  await page
    .getByRole('group', { name: 'Original view' })
    .getByRole('button', { name: 'Markdown', exact: true })
    .click();
  await page.getByRole('textbox', { name: 'Original Markdown' }).fill('');
  await expect(page.getByRole('slider', { name: 'Stream progress' })).toBeDisabled();
});
