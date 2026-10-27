// Delays public content responses to check reserved space and independent header loading.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
try {
  for (const path of ['/', '/the-hive.html']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    if (process.env.LOCAL_SOURCE) await context.route('**/*', route => {
      const file = new URL(route.request().url()).pathname.slice(1);
      if (['styles/site.css', 'scripts/integrations/showrunner/content.js', 'scripts/integrations/showrunner/business.js'].includes(file)) return route.fulfill({ path: fileURLToPath(new URL(`../${file}`, import.meta.url)), contentType: file.endsWith('.css') ? 'text/css' : 'text/javascript' });
      return route.continue();
    });
    let releaseProfile, releaseStudio, studioRequests = 0;
    const profileGate = new Promise(resolve => { releaseProfile = resolve; });
    const studioGate = new Promise(resolve => { releaseStudio = resolve; });
    await context.route('**/api/public/v1/content/profile?**', async route => {
      await profileGate;
      await route.fulfill({ json: { data: { hero: { hero: { editorId: 'test', backgrounds: [{ url: 'https://admin.cottage616.com/api/media/assets/probe?variant=HERO' }], canvasLayers: [{ type: 'text', role: 'headline', content: 'Venue' }, { type: 'button', content: 'Book', link: '/booking.html' }] } } } } });
    });
    await context.route('**/api/media/assets/probe?**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="1000"/>' }));
    await context.route('**/api/public/v1/content/studio?**', async route => { studioRequests++; await studioGate; await route.fulfill({ json: { data: { blocks: [] } } }); });
    const page = await context.newPage();
    await page.goto(new URL(path, process.env.BASE_URL || 'https://www.cottage616.com').href, { waitUntil: 'load' });
    const before = await page.locator('.hero').boundingBox();
    assert(before.height >= 320, 'header space is reserved before content arrives');
    releaseProfile();
    await page.locator('.sr-canvas-active').waitFor();
    assert.match(await page.locator('.sr-hero-bg img').evaluate(node => node.currentSrc), /variant=FULL/, 'unzoomed retina mobile headers avoid the desktop HERO download');
    const profileLoaded = await page.locator('.hero').boundingBox();
    assert(Math.abs(before.height - profileLoaded.height) < 1, 'header loading cannot move the section below');
    assert(await page.locator('.sr-content-loading').count(), 'profile renders while studio content is still pending');
    releaseStudio();
    await page.evaluate(() => window.showrunnerContentReady);
    assert.equal(studioRequests, 1, 'business info reuses the studio request');
    const after = await page.locator('.hero').boundingBox();
    assert(Math.abs(before.height - after.height) < 1, 'published content cannot move the section below');
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      for (const alignment of ['left', 'center', 'right']) {
        await page.evaluate(buttonAlignment => window.dispatchEvent(new CustomEvent('showrunner:render', { detail: { blocks: [{ type: 'slideshow', payload: { slides: [{ id: 'test', title: 'Venue', caption: '', buttonLabel: 'Book', buttonHref: '/booking.html', buttonAlignment }] } }] } })), alignment);
        const button = await page.locator('.sr-hero-cta').boundingBox();
        const layers = await page.locator('.sr-hero-layers').boundingBox();
        const inset = width <= 720 ? width * 0.05 : 0;
        const actual = alignment === 'left' ? button.x : alignment === 'right' ? button.x + button.width : button.x + button.width / 2;
        const expected = alignment === 'left' ? layers.x + inset : alignment === 'right' ? layers.x + layers.width - inset : layers.x + layers.width / 2;
        assert(Math.abs(actual - expected) < 2, `${alignment} button alignment at ${width}px`);
      }
    }
    console.log(`PASS: ${path} reserves ${after.height}px and renders the header before studio finishes`);
    await context.unrouteAll({ behavior: 'wait' });
    await context.close();
  }
} finally { await browser.close(); }
