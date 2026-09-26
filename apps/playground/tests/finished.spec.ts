import { expect, test } from '@playwright/test';

const NBSP = String.fromCharCode(0xa0);

/** Scroll the stream track from just below the viewport (0) to just above it (1). */
async function scrollStream(page: import('@playwright/test').Page, fraction: number) {
  await page.evaluate((fraction) => {
    const track = document.querySelector<HTMLElement>('.stream-track')!;
    const top = track.getBoundingClientRect().top + window.scrollY;
    const travel = innerHeight + track.offsetHeight;
    window.scrollTo({ top: top - innerHeight + travel * fraction, behavior: 'instant' });
  }, fraction);
}

test('scrolling streams the reply, and the package typesets it live', async ({ page }) => {
  await page.goto('/');
  const raw = page.locator('.stream-column[data-side="raw"] .stream-live');
  const typeset = page.locator('.stream-column[data-side="typeset"] .stream-live');
  await expect(typeset).toHaveText('');
  await scrollStream(page, 0.25);
  await expect(typeset).toContainText('Here’s the launch note for Friday’s');
  await expect(raw).toContainText("Here's the launch note for Friday's");
  await expect(typeset.locator('mark.m-typeset').first()).toBeVisible();
  // The raw pane marks the same characters, so each fix lines up with its original.
  const [rawMarks, typesetMarks] = await page.evaluate(() =>
    ['raw', 'typeset'].map(
      (side) => document.querySelectorAll(`[data-side="${side}"] .stream-live mark`).length,
    ),
  );
  expect(rawMarks).toBe(typesetMarks);
  expect(rawMarks).toBeGreaterThan(0);
  // The pinned hero recedes behind the stream.
  await expect(page.locator('.story-hero')).toHaveCSS('filter', /blur/);

  await scrollStream(page, 1);
  await expect(typeset).toContainText('nothing you’ve written will change.');
  await expect(typeset).toContainText(`says ‘final.’”`);
  // Paragraphs that open with a quote hang it in the margin, in the typeset column only.
  await expect(typeset.locator('.typograph-opening')).toHaveCount(2);
  await expect(raw.locator('.typograph-opening')).toHaveCount(0);
  await expect(typeset).toContainText(`30${NBSP}min`);
  await expect(raw).toContainText(`says 'final.'"`);

  // Scrolling back rewinds the stream.
  await scrollStream(page, 0);
  await expect(typeset).toHaveText('');
});

test('reduced motion shows the finished reply without pinning or zoom', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const typeset = page.locator('.stream-column[data-side="typeset"] .stream-live');
  await expect(typeset).toContainText('nothing you’ve written will change.');
  await expect(page.locator('.story-hero')).toHaveCSS('position', 'relative');
  await expect(page.locator('.stream-stage')).toHaveCSS('position', 'relative');
});

test('the changelog is typeset by the package and linked from every page', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Changelog' })
    .click();
  await expect(page).toHaveURL(/\/changelog$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Changelog');
  await expect(page.getByRole('heading', { level: 2, name: /^0\.4\.1/ })).toBeVisible();
  await expect(page.locator('.changelog-body')).toContainText('site at typograph.dev');
  await expect(page.locator('.changelog-body')).toContainText('a published version’s tarball');
  await expect(page.getByRole('link', { name: 'Typograph home' })).toHaveAttribute('href', '/');
});

test('the workbench typesets your own text with the real package', async ({ page }) => {
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:4174')) foreign.push(request.url());
  });
  await page.goto('/#finished');
  const summary = page.getByTestId('bench-summary');
  await expect(summary).toContainText(/\d+ changes/);
  await expect(page.locator('.bench-call')).toHaveText(
    "await typeset(input, { target: 'web', locale: 'en', punctuation: true, spacing: true, hanging: true })",
  );

  const input = page.getByRole('textbox', { name: 'Input text' });
  await page
    .getByRole('group', { name: 'Input' })
    .getByRole('button', { name: 'Plain text' })
    .click();
  await input.fill(`She said "it's 30 min" and left.`);
  await expect(summary).toContainText('4 changes');
  await expect(summary).toContainText('2 quotes · 1 apostrophe · 1 no-break space');
  await page.getByRole('button', { name: /^Output$/ }).click();
  await expect(page.getByLabel('Package output')).toHaveText(
    `She said “it’s 30${NBSP}min” and left.`,
  );
  await page.getByRole('button', { name: /^Changes 4$/ }).click();
  await expect(
    page.getByRole('region', { name: 'Changes', exact: true }).locator('tbody tr'),
  ).toHaveCount(4);
  await expect(page.getByRole('region', { name: 'Changes', exact: true })).toContainText('U+201C');

  await page
    .getByRole('group', { name: 'Input' })
    .getByRole('button', { name: 'HTML email' })
    .click();
  await page.getByRole('button', { name: 'Preview' }).click();
  const preview = page.getByRole('region', { name: 'Preview' });
  await expect(preview).toContainText('“Good morning,” Sam');
  await expect(preview).toContainText('"Bonne journée"');
  await expect(preview).not.toContainText('Shown only in Outlook');
  await expect(preview.locator('a')).toHaveAttribute('target', '_blank');
  await expect(preview.locator('a')).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(page.locator('.bench-call')).toContainText("input: 'html'");

  await page
    .getByRole('group', { name: 'Input' })
    .getByRole('button', { name: 'Markdown' })
    .click();
  await page
    .getByRole('group', { name: 'Output' })
    .getByRole('button', { name: 'Markdown' })
    .click();
  await page.getByRole('button', { name: /^Output$/ }).click();
  await expect(page.getByLabel('Package output')).toContainText('# Thursday brief');
  await expect(page.getByLabel('Package output')).toContainText('“Good morning.”');

  await page
    .getByRole('group', { name: 'Finished text settings' })
    .getByRole('switch', { name: 'Smart punctuation' })
    .setChecked(false);
  await expect(page.getByLabel('Package output')).not.toContainText('“');
  expect(foreign).toEqual([]);
});

test('the workbench fits a phone without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#finished');
  await expect(page.getByTestId('bench-summary')).toContainText(/\d+ changes/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page.getByRole('textbox', { name: 'Input text' })).toBeVisible();
});

test('lede terms preview their fix, and segmented thumbs follow the selection', async ({
  page,
}) => {
  await page.goto('/');
  const term = page.locator('.term').filter({ hasText: 'straight quotes' });
  await term.hover();
  await expect(page.getByRole('tooltip').filter({ hasText: '“Atlas”' })).toBeVisible();
  await page.goto('/#finished');
  const control = page.getByRole('group', { name: 'Input' });
  await expect(control).toHaveAttribute('data-thumb', 'ready');
  const thumb = () =>
    control.evaluate((node) => [
      node.style.getPropertyValue('--thumb-x'),
      node.style.getPropertyValue('--thumb-w'),
    ]);
  const markdown = await control
    .getByRole('button', { name: 'Markdown' })
    .evaluate((node) => [
      `${(node as HTMLElement).offsetLeft}px`,
      `${(node as HTMLElement).offsetWidth}px`,
    ]);
  expect(await thumb()).toEqual(markdown);
  const html = control.getByRole('button', { name: 'HTML email' });
  await html.click();
  const target = await html.evaluate((node) => [
    `${(node as HTMLElement).offsetLeft}px`,
    `${(node as HTMLElement).offsetWidth}px`,
  ]);
  await expect.poll(thumb).toEqual(target);
});
