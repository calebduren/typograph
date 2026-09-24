import { expect, test } from '@playwright/test';

const NBSP = String.fromCharCode(0xa0);

test('the hero specimen is computed live by the package', async ({ page }) => {
  await page.goto('/');
  const proof = page.getByRole('figure', { name: 'Live specimen' });
  await expect(proof.locator('.proof-line')).toHaveAttribute(
    'aria-label',
    `“It’s ready in 30${NBSP}min.”`,
  );
  await expect(proof.locator('.proof-legend li')).toHaveCount(4);
  await expect(proof.locator('.proof-legend code')).toHaveText([
    'U+201C',
    'U+2019',
    'U+00A0',
    'U+201D',
  ]);
  await expect(proof.locator('.proof-foot')).toContainText(/4 changes in [\d.]+ µs per call/);
  await proof.getByRole('button', { name: 'Show original' }).click();
  await expect(proof.locator('.proof-line')).toHaveAttribute(
    'aria-label',
    `"It's ready in 30 min."`,
  );
  await proof.getByRole('button', { name: 'Show typeset' }).click();
  await expect(proof).toHaveAttribute('data-original', 'false');
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
