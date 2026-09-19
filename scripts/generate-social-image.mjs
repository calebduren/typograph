import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

// Static artwork from the landing page's existing type, copy, and annotation palette.
// Run from the repository root after changing this composition or the bundled font.
const font = readFileSync('apps/playground/public/fonts/InterVariable.woff2').toString('base64');
const browser = await chromium.launch({
  channel: process.platform === 'darwin' ? 'chrome' : undefined,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.setContent(`<!doctype html>
    <html lang="en"><meta charset="utf-8"><title>Typograph social preview</title>
    <style>
      @font-face { font-family: Inter; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 100 900; }
      * { box-sizing: border-box; }
      body { margin: 0; width: 1200px; height: 630px; padding: 56px 72px; background: #fcfcfc; color: #242424; font-family: Inter, sans-serif; }
      header { display: flex; justify-content: space-between; align-items: baseline; padding-bottom: 32px; border-bottom: 1px solid #d8d8d8; }
      .wordmark { font-size: 32px; font-weight: 500; letter-spacing: -.025em; color: red; }
      .domain { color: #666; font-size: 22px; }
      main { display: grid; grid-template-columns: 1fr 1fr; align-items: center; gap: 72px; height: 376px; }
      h1 { margin: 0; font-size: 44px; font-weight: 500; line-height: 1.18; letter-spacing: -.015em; }
      figure { position: relative; isolation: isolate; margin: 0; font-size: 60px; font-weight: 450; line-height: 1.17; letter-spacing: -.025em; }
      figure::before, figure::after { content: ''; position: absolute; top: -12px; bottom: -12px; width: 1px; background: rgb(36 36 36 / .12); z-index: -2; }
      figure::before { left: 0; } figure::after { right: 0; }
      mark { position: relative; background: none; color: inherit; }
      mark::before { content: ''; position: absolute; inset: -.025em -.025em; background: #dfeafa; z-index: -1; border-radius: 2px; }
      .opening { position: absolute; right: 100%; }
      .opening::before { background: #e8dff3; }
      footer { padding-top: 28px; border-top: 1px solid #d8d8d8; font-size: 20px; color: #666; }
    </style>
    <header><span class="wordmark">typograph</span><span class="domain">typograph.dev</span></header>
    <main>
      <h1>Nicer typography<br>for streaming AI.</h1>
      <figure><mark class="opening">“</mark>The quick<br>brown fox says,<br><mark>‘</mark>Let<mark>’</mark>s go!<mark>’”</mark></figure>
    </main>
    <footer>English only &nbsp;·&nbsp; Open source &nbsp;·&nbsp; Runs locally</footer>
    </html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'apps/playground/public/social.png' });
} finally {
  await browser.close();
}
