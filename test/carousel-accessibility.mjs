// Read-only browser check. PLAYWRIGHT_MODULE can point to an installed Playwright;
// LOCAL_SOURCE=1 tests this checkout against the beta website's real content.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true});
try {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({viewport: {width: 390, height: 844}, reducedMotion});
    if (process.env.LOCAL_SOURCE) await context.route('https://cottage616-production.up.railway.app/**', route => {
      const file = new URL(route.request().url()).pathname.slice(1);
      if (['scripts/site.js', 'scripts/integrations/showrunner/content.js', 'styles/site.css'].includes(file)) return route.fulfill({path: fileURLToPath(new URL(`../${file}`, import.meta.url)), contentType: file.endsWith('.js') ? 'text/javascript' : 'text/css'});
      return route.continue();
    });
    const page = await context.newPage();
    await page.goto(process.env.BASE_URL || 'https://cottage616-production.up.railway.app/', {waitUntil: 'load'});
    await page.evaluate(() => window.showrunnerContentReady);
    assert.ok(await page.locator('.sr-hero-screen:not(.is-active)').evaluateAll(nodes => nodes.every(node => node.inert && node.getAttribute('aria-hidden') === 'true')));
    if (await page.locator('.sr-hero-nav-dot').count() > 1) {
      await page.locator('.sr-hero-nav-dot').nth(1).click();
      assert.equal(await page.locator('.sr-hero-screen').nth(1).evaluate(node => node.inert), false);
      assert.equal(await page.locator('.sr-hero-screen').first().evaluate(node => node.inert), true);
      if (reducedMotion === 'no-preference') {
        await page.getByRole('button', {name: 'Play slideshow', exact: true}).click();
        await page.getByRole('button', {name: 'Pause slideshow', exact: true}).click();
        assert.equal(await page.getByRole('button', {name: 'Play slideshow', exact: true}).count(), 1);
      } else assert.equal(await page.locator('[data-slideshow-pause]').count(), 0);
    }
    await page.locator('.menu-toggle').click();
    await page.locator('.menu-toggle').press('Escape');
    assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'false');
    await context.close();
  }
  console.log('PASS: inactive slide isolation, slide selection, pause/play, reduced motion, and mobile Escape.');
} finally { await browser.close(); }
