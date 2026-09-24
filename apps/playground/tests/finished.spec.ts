import { expect, test } from '@playwright/test';

const NBSP = String.fromCharCode(0xa0);

test('the hero streams a reply that the package typesets live', async ({ page }) => {
  await page.goto('/');
  const window = page.getByRole('group', { name: 'Streaming assistant reply' });
  const bubble = window.locator('.bubble-ai > [aria-hidden="true"]:not(.bubble-sizer)');
  // The reply streams in, and quotes curl as soon as they settle.
  await expect(bubble).toContainText('Here’s the recap', { timeout: 10_000 });
  await expect(bubble.locator('mark.flip').first()).toBeVisible();
  await expect(bubble).toContainText('then tell everyone.”', { timeout: 15_000 });
  await expect(window.locator('.window-foot')).toContainText("phase: 'complete'");
  const typeset = window.getByRole('switch', { name: 'Typograph' });
  await typeset.click();
  await expect(typeset).toHaveAttribute('aria-checked', 'false');
  await expect(bubble).toContainText(`Here's the recap: "Atlas"`);
  await expect(bubble.locator('mark.flip')).toHaveCount(0);
});

test('the reveal compares typeset and original without moving any text', async ({ page }) => {
  await page.goto('/');
  const slider = page.getByRole('slider', { name: 'Compare typeset and original' });
  await expect(
    page.getByLabel('Typeset: “It’s not what you say. It’s how it’s set.”'),
  ).toBeAttached();
  await expect(
    page.getByLabel(`Original: "It's not what you say. It's how it's set."`),
  ).toBeAttached();
  const box = (selector: string) =>
    page.locator(selector).evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return [Math.round(rect.width), Math.round(rect.height)];
    });
  // Both layers occupy the same box, so the clip reveals, rather than shifts, the text.
  expect(await box('.reveal-after')).toEqual(await box('.reveal-before'));
  await slider.fill('100');
  await expect(page.locator('.reveal-stage')).toHaveAttribute('style', /--split: 100%/);
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
