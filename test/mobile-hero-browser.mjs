// Read-only browser check. LOCAL_SOURCE=1 uses this checkout's CSS.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
try {
  for (const path of ['/', '/the-hive.html']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const url = new URL(path, process.env.BASE_URL || 'https://www.cottage616.com');
    await page.goto(url.href, { waitUntil: 'load' });
    await page.evaluate(() => window.showrunnerContentReady);
    const desktopBefore = await page.locator('.hero').boundingBox();
    if (process.env.LOCAL_SOURCE) await context.route('**/styles/site.css*', route => route.fulfill({ path: fileURLToPath(new URL('../styles/site.css', import.meta.url)), contentType: 'text/css' }));
    await page.reload({ waitUntil: 'load' });
    await page.evaluate(() => window.showrunnerContentReady);
    assert.equal((await page.locator('.hero').boundingBox()).height, desktopBefore.height, 'desktop hero height is unchanged');
    for (const width of [320, 390, 720]) {
      await page.setViewportSize({ width, height: 844 });
      const hero = await page.locator('.hero').boundingBox();
      assert(hero.height < 844 * 0.65, `${path} at ${width}px leaves room for page content`);
      const layers = page.locator('.sr-hero-screen.is-active .sr-hero-layer');
      assert(await layers.count(), 'real header content rendered');
      for (const layer of await layers.all()) {
        const bounds = await layer.boundingBox();
        assert(bounds.y >= hero.y && bounds.y + bounds.height <= hero.y + hero.height, 'header copy and actions fit');
        assert(bounds.x >= 0 && bounds.x + bounds.width <= width, 'header copy does not overflow horizontally');
      }
      console.log(`${path} ${width}px: hero ${Math.round(hero.height)}px`);
      if (width === 390 && process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/${path === '/' ? 'cottage' : 'hive'}-mobile-header.png` });
    }
    await context.close();
  }
} finally { await browser.close(); }
