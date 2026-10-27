// Read-only browser check. LOCAL_SOURCE=1 uses this checkout's CSS.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  if (process.env.LOCAL_SOURCE) await page.route('**/styles/site.css*', route => route.fulfill({ path: fileURLToPath(new URL('../styles/site.css', import.meta.url)), contentType: 'text/css' }));
  await page.goto(process.env.BASE_URL || 'https://www.cottage616.com', { waitUntil: 'load' });
  await page.evaluate(() => window.showrunnerContentReady);
  const cards = page.locator('.event-card');
  assert.equal(await cards.count(), 3);
  if (process.env.SCREENSHOT_DIR) await page.locator('.event-card-grid').screenshot({ path: `${process.env.SCREENSHOT_DIR}/mobile-event-card-frames.png` });
  for (const width of [320, 390, 720, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const card of await cards.all()) {
      const frame = card.locator('.event-card__media');
      const before = await frame.boundingBox();
      const cardBefore = await card.boundingBox();
      if (width <= 720) {
        assert(Math.abs(before.height - cardBefore.height) < 1, 'photo frame fills the mobile card with no seam below');
      } else assert(Math.abs(before.width / before.height - 1.1) < 0.01, 'desktop photo proportions stay fixed');
      const image = card.locator('img');
      for (const [w, h, zoom] of [[300, 900, 1], [900, 300, 2.5]]) {
        await image.evaluate((node, { w, h, zoom }) => {
          node.src = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="navy"/></svg>`)}`;
          node.style.transform = `scale(${zoom})`;
          node.style.objectPosition = '15% 80%';
        }, { w, h, zoom });
        await image.evaluate(node => node.decode());
        assert.deepEqual(await frame.boundingBox(), before, 'source proportions and crop cannot resize the photo frame');
        assert.deepEqual(await card.boundingBox(), cardBefore, 'source proportions and crop cannot resize the card');
      }
    }
    console.log(`PASS: event card frames at ${width}px`);
  }
} finally { await browser.close(); }
