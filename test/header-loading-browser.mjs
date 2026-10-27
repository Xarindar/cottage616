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
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      const render = (buttonAlignment, caption) => page.evaluate(({ buttonAlignment, caption }) => window.dispatchEvent(new CustomEvent('showrunner:render', { detail: { blocks: [{ type: 'slideshow', payload: { slides: [{ id: 'test', title: 'Venue', caption, buttonLabel: 'Book', buttonHref: '/booking.html', buttonAlignment }] } }] } })), { buttonAlignment, caption });
      for (const alignment of ['', 'left', 'center', 'right']) {
        await render(alignment, 'First line\nSecond line');
        const button = await page.locator('.sr-hero-cta').boundingBox();
        const layers = await page.locator('.sr-hero-layers').boundingBox();
        const inset = await page.locator('.sr-hero-layers').evaluate(node => parseFloat(getComputedStyle(node).paddingLeft));
        const actual = alignment === 'left' ? button.x : alignment === 'right' ? button.x + button.width : button.x + button.width / 2;
        const expected = alignment === 'left' ? layers.x + inset : alignment === 'right' ? layers.x + layers.width - inset : layers.x + layers.width / 2;
        if (alignment) assert(Math.abs(actual - expected) < 2, `${alignment} button alignment at ${width}px`);
        else assert(Math.abs(button.x + button.width - (layers.x + layers.width - inset)) < 2, 'CTA defaults to the right');
        const caption = await page.locator('.sr-hero-caption').boundingBox();
        assert(Math.abs(button.y + button.height / 2 - caption.y - caption.height / 2) < 2, 'CTA is vertically aligned with the caption');
        assert.equal(await page.locator('.sr-hero-caption').innerText(), 'First line\nSecond line');
      }
      const titleBefore = await page.locator('.sr-hero-headline').boundingBox();
      await render('', 'First line\nSecond line\nThird line\nFourth line');
      const titleAfter = await page.locator('.sr-hero-headline').boundingBox();
      assert(titleAfter.y < titleBefore.y, 'adding caption lines immediately repositions the heading');
      const captionAfter = await page.locator('.sr-hero-caption').boundingBox();
      const lineHeight = await page.locator('.sr-hero-caption').evaluate(node => parseFloat(getComputedStyle(node).lineHeight));
      assert(captionAfter.height >= lineHeight * 4 - 1, 'all four authored caption lines render on separate lines');
      const heroAfter = await page.locator('.hero').boundingBox();
      assert(Math.abs((titleAfter.y + captionAfter.y + captionAfter.height) / 2 - heroAfter.y - heroAfter.height / 2) < 2, 'headline and caption remain vertically centered together');
    }
    console.log(`PASS: ${path} reserves ${after.height}px and renders the header before studio finishes`);
    await context.unrouteAll({ behavior: 'wait' });
    await context.close();
  }
} finally { await browser.close(); }
