import { expect, test, type Page } from '@playwright/test';
import { richChunks } from '../server/recorded-response';

declare global {
  interface Window {
    typographySamples: string[];
  }
}

async function openChat(page: Page, backend: string) {
  await page.goto(`/?backend=${backend}&room=test-${crypto.randomUUID()}`);
  await expect(page.getByTestId('connection')).toHaveText('connected');
  await expect(page.getByRole('button', { name: 'Run rich', exact: true })).toBeEnabled();
}

async function finish(page: Page) {
  await expect(page.getByTestId('status')).toHaveText('ready', { timeout: 15_000 });
}

for (const backend of ['ai-sdk', 'cloudflare']) {
  test.describe(backend, () => {
    test('streams rich Markdown, preserves code/math/URLs/tools, and copies the original', async ({
      page,
      context,
    }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await openChat(page, backend);
      await page.getByRole('button', { name: 'Run rich', exact: true }).click();
      const response = page.getByTestId('response');
      await expect(response).toContainText('“Hello,”');
      await finish(page);
      await expect(response).toContainText('Give ’em a chance.');
      await expect(response).toContainText('“Read the guide today.”');
      await response.getByRole('button', { name: 'the guide', exact: true }).click();
      await expect(page.getByText("https://example.com/it's-here", { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      await expect(response.locator('code').first()).toHaveText('const x = "hi"');
      await expect(response).toContainText('const y = "exact";');
      await expect(response.getByRole('table')).toContainText('“Ready”');
      await expect(response.locator('.katex').first()).toBeVisible();
      await expect(page.getByTestId('tool-result')).toContainText('\\"Do not transform\\"');
      await expect(page.getByTestId('original')).toHaveText(richChunks.join(''));
      await page.getByRole('button', { name: 'Copy original', exact: true }).click();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(richChunks.join(''));
      expect(errors).toEqual([]);
    });

    test('updates locale and spacing on unchanged text without remounting prose', async ({
      page,
    }) => {
      await openChat(page, backend);
      await page.getByRole('button', { name: 'Run rich', exact: true }).click();
      await finish(page);
      const response = page.getByTestId('response');
      const paragraph = response.locator('p').first();
      await paragraph.evaluate((element) => {
        element.setAttribute('data-retained', 'yes');
      });
      await page.getByRole('combobox', { name: 'Response language' }).selectOption('fr');
      await expect(response).toContainText('"Hello,"');
      await expect(paragraph).toHaveAttribute('data-retained', 'yes');
      await page.getByRole('combobox', { name: 'Response language' }).selectOption('en-US');
      await page.getByRole('checkbox', { name: 'No-break spacing' }).check();
      await expect.poll(() => paragraph.textContent()).toContain('30\u00a0min');
      await expect(paragraph).toHaveAttribute('data-retained', 'yes');
      await expect(page.getByTestId('original')).toHaveText(richChunks.join(''));
    });

    test('holds ambiguous streaming prefixes', async ({ page }) => {
      await page.addInitScript(() => {
        window.typographySamples = [];
        new MutationObserver(() => {
          const text = document.querySelector('[data-testid="response"]')?.textContent;
          if (text) window.typographySamples.push(text);
        }).observe(document, { childList: true, subtree: true, characterData: true });
      });
      await openChat(page, backend);
      await page.getByRole('checkbox', { name: 'No-break spacing' }).check();
      await page.getByRole('button', { name: 'Run boundary', exact: true }).click();
      const response = page.getByTestId('response');
      await expect(response).toHaveText('"');
      await expect(response).toContainText('It took 30 m');
      await finish(page);
      await expect(response).toContainText('It took 30 million years.');
      expect(await response.textContent()).not.toContain('30\u00a0million');
      const samples = await page.evaluate(() => window.typographySamples);
      expect(samples).toContain('"');
      expect(samples.some((text) => text.endsWith('It took 30 m'))).toBe(true);
      expect(samples.every((text) => !text.includes('It took 30\u00a0m'))).toBe(true);
    });

    test('stops a partial reply and regenerates without duplicating the answer', async ({
      page,
    }) => {
      await openChat(page, backend);
      await page.getByRole('button', { name: 'Run slow', exact: true }).click();
      await expect(page.getByTestId('response')).toContainText('“Start here.”');
      await page.getByRole('button', { name: 'Stop', exact: true }).click();
      await finish(page);
      expect(await page.getByTestId('original').textContent()).not.toContain('Finished.');
      await page.getByRole('button', { name: 'Regenerate', exact: true }).click();
      await expect(page.getByTestId('response')).toContainText('“Finished.”', { timeout: 15_000 });
      await finish(page);
      await expect(page.getByTestId('message')).toHaveCount(1);
    });

    test('preserves a failed partial answer and restores saved history', async ({ page }) => {
      await openChat(page, backend);
      await page.getByRole('button', { name: 'Run error', exact: true }).click();
      await expect(page.getByRole('alert')).toHaveText('Recorded stream failure');
      await expect(page.getByTestId('response')).toContainText('“Partial answer.”');
      expect(await page.getByTestId('response').textContent()).not.toContain('30\u00a0m');
      await page.reload();
      await expect(page.getByTestId('response')).toContainText('“Partial answer.”');
      await expect(page.getByTestId('original')).toHaveText('"Partial answer." Wait 30 m');
    });
  });
}

test('Cloudflare resumes an active stream after navigation disconnects the client', async ({
  page,
}) => {
  await openChat(page, 'cloudflare');
  const url = page.url();
  await page.getByRole('button', { name: 'Run slow', exact: true }).click();
  await expect(page.getByTestId('response')).toContainText('Step 1 is ready.');
  await page.goto('about:blank');
  await page.goto(url);
  await expect(page.getByTestId('connection')).toHaveText('connected');
  await expect(page.getByTestId('response')).toContainText('“Finished.”', { timeout: 15_000 });
  await finish(page);
  await expect(page.getByTestId('message')).toHaveCount(1);
  const original = await page.getByTestId('original').textContent();
  expect(original?.match(/Step 1 is ready\./g)).toHaveLength(1);
  expect(original?.match(/Step 24 is ready\./g)).toHaveLength(1);
});
