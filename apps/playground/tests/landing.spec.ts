import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const review = '../../.impeccable/review';

test('production links, metadata, and asset headers work', async ({ page }) => {
  const response = await page.goto('/');
  const csp = response!.headers()['content-security-policy'];
  expect(csp).toContain("style-src 'self';");
  expect(csp).toContain("style-src-attr 'unsafe-inline'");
  await expect(page).toHaveTitle('Typograph — Better typography for AI-generated text.');
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    await page.title(),
  );
  const imageUrl = await page.locator('meta[property="og:image"]').first().getAttribute('content');
  expect(imageUrl).toBe('https://typograph.dev/social.png');
  await expect(page.locator('meta[property="og:image"]').nth(1)).toHaveAttribute(
    'content',
    'https://typograph.dev/social-square.png',
  );
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', imageUrl!);
  const expectPng = async (path: string, width: number, height: number) => {
    const response = await page.request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
    const bytes = await response.body();
    expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(bytes.readUInt32BE(16)).toBe(width);
    expect(bytes.readUInt32BE(20)).toBe(height);
  };
  await expectPng('/social.png', 1200, 630);
  await expectPng('/social-square.png', 1200, 1200);
  await expectPng('/brand/avatar.png', 512, 512);
  for (const size of [16, 32, 48]) {
    await expect(page.locator(`link[rel="icon"][sizes="${size}x${size}"]`)).toHaveAttribute(
      'href',
      `/favicon-${size}.png`,
    );
    await expectPng(`/favicon-${size}.png`, size, size);
  }
  await expect(page.locator('link[rel="icon"][type="image/svg+xml"]')).toHaveAttribute(
    'href',
    '/favicon.svg',
  );
  const vectorIcon = await page.request.get('/favicon.svg');
  expect(vectorIcon.status()).toBe(200);
  expect(vectorIcon.headers()['content-type']).toContain('image/svg+xml');
  const favicon = await page.request.get('/favicon.ico');
  expect(favicon.status()).toBe(200);
  expect((await favicon.body()).subarray(0, 6)).toEqual(Buffer.from([0, 0, 1, 0, 3, 0]));
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    'href',
    '/apple-touch-icon.png',
  );
  await expectPng('/apple-touch-icon.png', 180, 180);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/site.webmanifest');
  const manifestResponse = await page.request.get('/site.webmanifest');
  expect(manifestResponse.status()).toBe(200);
  expect(manifestResponse.headers()['content-type']).toContain('application/manifest+json');
  const webManifest = await manifestResponse.json();
  expect(webManifest.name).toBe('Typograph');
  expect(webManifest.icons).toHaveLength(3);
  expect(
    webManifest.icons.filter((icon: { purpose: string }) => icon.purpose === 'maskable'),
  ).toHaveLength(1);
  for (const icon of webManifest.icons) {
    const [width, height] = icon.sizes.split('x').map(Number);
    await expectPng(icon.src, width, height);
  }
  expect((await page.request.get('/.vite/manifest.json')).status()).toBe(404);
  const measurement = page.getByRole('link', { name: 'View the measurement' });
  await expect(measurement).toHaveAttribute('href', /^\/assets\/.*\.json$/);
  for (const link of await page.locator('a[href^="http"]').all()) {
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
  for (const link of await page.locator('a[href^="#"]').all()) {
    const target = await link.getAttribute('href');
    await expect(page.locator(target!)).toHaveCount(1);
    expect(await link.getAttribute('target')).toBeNull();
  }
  await expect(
    page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Specimen' }),
  ).toHaveCount(0);
  const [measurementTab] = await Promise.all([page.waitForEvent('popup'), measurement.click()]);
  await expect(measurementTab).toHaveURL(/\/assets\/.*\.json$/);
  const data = await page.request.get(measurementTab.url());
  await measurementTab.close();
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

test('the hero renders while the workbench bundle is still loading', async ({ page }) => {
  const manifest = JSON.parse(
    await readFile(new URL('../dist/.vite/manifest.json', import.meta.url), 'utf8'),
  );
  const workbenchImport = manifest['index.html'].dynamicImports.find((entry: string) =>
    entry.endsWith('FinishedDemo.tsx'),
  );
  expect(workbenchImport).toBeDefined();
  const workbenchBundle = manifest[workbenchImport!].file;
  let requestBlocked = false;
  let release!: () => void;
  const loaded = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/${workbenchBundle}`, async (route) => {
    requestBlocked = true;
    await loaded;
    await route.continue();
  });
  try {
    await page.goto('/#finished', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => requestBlocked).toBe(true);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Your AI writes, typograph polishes',
    );
    await expect(
      page.getByRole('status').filter({ hasText: 'Loading the workbench…' }),
    ).toBeVisible();
  } finally {
    release();
  }
  await expect(page.getByTestId('bench-summary')).toBeVisible();
  expect(
    Math.abs(await page.locator('#finished').evaluate((node) => node.getBoundingClientRect().top)),
  ).toBeLessThan(2);
});

test('the specimen is a direct, live typography route', async ({ page }) => {
  await page.goto('/specimen');
  await expect(page.getByRole('heading', { name: /At the edge of the olive grove/ })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Smart punctuation' })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Non-breaking spaces' })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Hanging punctuation' })).toBeChecked();
  await expect(page.getByRole('group', { name: 'Typeface' })).toHaveCount(0);
  await expect(page.getByText('Every switch touches the copy.')).toHaveCount(0);
  expect(await page.locator('.specimen-prose mark').count()).toBeGreaterThan(0);
});

test('integration recipes, local guide, and keyboard entry work', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to the demo' })).toBeFocused();
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('button', { name: 'Cloudflare', exact: true }).click();
  await expect(page.getByLabel('Cloudflare code example')).toContainText('useAgentChat');
  await page.getByRole('button', { name: 'Remark', exact: true }).click();
  await expect(page.getByLabel('Remark code example')).toContainText('processor.runSync');
  const guide = await page.request.get('/integration.md');
  expect(guide.status()).toBe(200);
  expect(await guide.text()).toContain('English-only');
});

test('one agent prompt covers every stack and code alone exposes stack selection', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  const examples = page.getByRole('group', { name: 'Integration examples' });
  const prompt = page.getByRole('region', { name: 'Typography agent prompt' });
  await expect(examples).toHaveCount(0);
  for (const expected of ['MessageResponse', 'useAgentChat', 'processor.runSync', 'typesetText(']) {
    await expect(prompt).toContainText(expected);
  }
  const originalPrompt = await prompt.textContent();
  await page.getByRole('button', { name: 'Copy agent prompt' }).click();
  await expect(page.getByRole('button', { name: 'Copy agent prompt' })).toHaveText('Copied');
  await expect(page.locator('.recipe-status')).toHaveCount(0);
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(originalPrompt);
  expect(copied).toContain('English-only');
  expect(copied).toContain('npm install @calebduren/typograph');
  expect(copied).toContain('text-wrap: pretty');

  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await expect(examples).toBeVisible();
  const formatBounds = await page.getByRole('group', { name: 'Integration format' }).boundingBox();
  expect((await examples.boundingBox())!.y).toBeGreaterThan(formatBounds!.y + formatBounds!.height);
  for (const [stack, expected] of [
    ['AI Elements', 'MessageResponse'],
    ['Cloudflare', 'useAgentChat'],
    ['Remark', 'processor.runSync'],
    ['Finished text', 'typesetText(generatedTitle'],
  ]) {
    await examples.getByRole('button', { name: stack, exact: true }).click();
    const code = page.getByLabel(`${stack} code example`);
    await expect(code).toContainText(expected);
    await page.getByRole('button', { name: 'Copy integration code' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      await code.textContent(),
    );
  }
  await page.getByRole('button', { name: 'Agent prompt', exact: true }).click();
  await expect(examples).toHaveCount(0);
  expect(await prompt.textContent()).toBe(originalPrompt);
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await expect(
    examples.getByRole('button', { name: 'Finished text', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
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
  await expect(prompt).toBeVisible();
});

test('all typography combinations stay in sync with prompts and code', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  const settings = page.getByRole('group', {
    name: 'Integration typography settings',
    exact: true,
  });
  await expect(settings.getByRole('switch')).toHaveCount(3);
  for (const punctuation of [true, false])
    for (const spacing of [false, true])
      for (const hanging of [false, true]) {
        await settings.getByRole('switch', { name: 'Smart punctuation' }).setChecked(punctuation);
        await settings.getByRole('switch', { name: 'Non-breaking spaces' }).setChecked(spacing);
        await settings.getByRole('switch', { name: 'Hanging punctuation' }).setChecked(hanging);
        const prompt = page.getByRole('region', { name: 'Typography agent prompt' });
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
  const before = await page.getByRole('region', { name: 'Typography agent prompt' }).textContent();
  await page.getByRole('button', { name: 'Copy agent prompt' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(before);
  for (const stack of ['Cloudflare', 'Remark']) {
    await page.getByRole('button', { name: 'Code', exact: true }).click();
    await page.getByRole('button', { name: stack, exact: true }).click();
    await expect(page.getByLabel(`${stack} code example`)).toContainText(
      '@calebduren/typograph/hanging.css',
    );
    await page.getByRole('button', { name: 'Agent prompt', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Typography agent prompt' })).toContainText(
      'Hanging punctuation: on',
    );
  }
});

test('highlight backgrounds sit beneath adjacent glyphs in the workbench', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.bench-preview mark').first()).toBeVisible();
  for (const selector of ['.bench-preview']) {
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
  await page.locator('.story-hero').screenshot({ path: `${review}/hero.png` });
});

test('reflows at narrow, tablet, user, and enlarged-text sizes', async ({ page }) => {
  for (const width of [320, 390, 520, 768, 1301]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Your AI writes, typograph polishes',
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    if (width <= 800) {
      await expect(page.getByRole('link', { name: 'GitHub', exact: true })).toBeVisible();
      for (const control of await page.locator('button:visible, .site-header a:visible').all()) {
        // Compact mobile targets; still above the WCAG 2.2 AA 24px minimum.
        expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(36);
      }
      await page.getByRole('button', { name: 'Code', exact: true }).click();
      for (const stack of ['AI Elements', 'Cloudflare', 'Remark']) {
        await page.getByRole('button', { name: stack, exact: true }).click();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
      }
      await page.screenshot({ path: `${review}/mobile-${width}.png`, fullPage: true });
    }
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

test('the agent prompt scroll fades follow both edges and restored prompts', async ({ page }) => {
  await page.goto('/');
  const prompt = page.getByRole('region', { name: 'Typography agent prompt' });
  const edges = (area: typeof prompt) =>
    area.evaluate((node) => ({
      top: getComputedStyle(node).getPropertyValue('--scroll-fade-top'),
      bottom: getComputedStyle(node).getPropertyValue('--scroll-fade-bottom'),
    }));
  await expect.poll(() => edges(prompt)).toEqual({ top: '0px', bottom: '96px' });
  expect(await prompt.evaluate((node) => getComputedStyle(node).maskImage)).not.toBe('none');
  await prompt.evaluate((node) => {
    node.scrollTop = (node.scrollHeight - node.clientHeight) / 2;
  });
  await expect.poll(() => edges(prompt)).toEqual({ top: '96px', bottom: '96px' });
  await prompt.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect.poll(() => edges(prompt)).toEqual({ top: '96px', bottom: '0px' });
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('button', { name: 'Cloudflare', exact: true }).click();
  await page.getByRole('button', { name: 'Agent prompt', exact: true }).click();
  const replacement = page.getByRole('region', { name: 'Typography agent prompt' });
  await expect.poll(() => edges(replacement)).toEqual({ top: '0px', bottom: '96px' });
  await replacement.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect.poll(() => edges(replacement)).toEqual({ top: '96px', bottom: '0px' });
});

test('integration switches share settings with the workbench and copied instructions', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  const workbench = page.getByRole('group', { name: 'Finished text settings' });
  const integration = page.getByRole('group', {
    name: 'Integration typography settings',
    exact: true,
  });
  await expect(integration.getByRole('switch')).toHaveCount(3);
  await integration.getByRole('switch', { name: 'Non-breaking spaces' }).setChecked(false);
  await expect(workbench.getByRole('switch', { name: 'Non-breaking spaces' })).not.toBeChecked();
  await integration.getByRole('switch', { name: 'Non-breaking spaces' }).setChecked(true);
  await integration.getByRole('switch', { name: 'Smart punctuation' }).click();
  await expect(workbench.getByRole('switch', { name: 'Smart punctuation' })).not.toBeChecked();
  await workbench.getByRole('switch', { name: 'Hanging punctuation' }).setChecked(true);
  await expect(integration.getByRole('switch', { name: 'Hanging punctuation' })).toBeChecked();
  await page.getByRole('button', { name: 'Copy agent prompt' }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('punctuation: false, spacing: true');
  expect(copied).toContain('Hanging punctuation: on');
  await integration.getByRole('switch', { name: 'Hanging punctuation' }).click();
  await expect(page.getByRole('button', { name: 'Copy agent prompt' })).toHaveText('Copy prompt');
});
