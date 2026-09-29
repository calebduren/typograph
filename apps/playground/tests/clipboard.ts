import type { BrowserContext, Page } from '@playwright/test';

/** Chromium grants clipboard permissions; Firefox and WebKit have none, so keep the copied text in the page. */
export async function allowClipboard(page: Page, context: BrowserContext, browserName: string) {
  if (browserName === 'chromium') {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    return;
  }
  await page.addInitScript(() => {
    let copied = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => void (copied = text),
        readText: async () => copied,
      },
    });
  });
}
