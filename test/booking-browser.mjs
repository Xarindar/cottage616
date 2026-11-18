// PLAYWRIGHT_MODULE points to an existing Playwright install. API fixtures never create real bookings.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const base = process.env.BOOKING_TEST_URL || 'http://127.0.0.1:8083/cottage616/';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Tokyo' });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const pack = (id, priceCents, durationMinutes) => ({ id, name: id, priceCents, durationMinutes, coverage: ['Venue hire'], deliverables: { finalPhotos: 10, locations: 2 }, addOns: [{ id: 'chairs', name: 'Extra chairs', priceCents: 500, pricingType: 'PER_UNIT', deliverables: { finalPhotos: 1 } }] });
const service = {
  id: 'fixture-event', slug: 'celebration', name: 'Celebration', categoryId: 'events', categoryName: 'Events',
  durationMinutes: 60, priceCents: 10000, maxAdvanceDays: 3, minimumNoticeHours: 0,
  staff: [{ id: 'host', name: 'Host' }], serviceRevision: 'service-v1',
  packages: [pack('Standard', 10000, 60), pack('Extended', 18000, 120)],
  requirePolicy: true, policyText: 'Booking: [Session name], [Package name], [Booking total]',
  bookingTermsTitle: 'Venue terms', bookingFormTitle: 'Event details', bookingRequirementsRevision: 'requirements-v1',
  bookingRules: [{ id: 'guests', kind: 'intake', category: 'Event', label: 'Guest count', type: 'TEXT', required: true }]
};
let submitted, reject = true, mode = 'catalog';
const availability = [];
await page.route('**/api/public/v1/**', async route => {
  const request = route.request(), url = new URL(request.url());
  if (url.pathname.endsWith('/services')) return route.fulfill({ status: mode === 'error' ? 503 : 200, json: mode === 'error' ? { error: 'Services unavailable' } : { data: { packageFields: [], categories: [{ id: 'events', name: 'Events' }, { id: 'the-hive', name: 'The Hive' }], services: mode === 'empty' ? [] : [service, { ...service, id: 'fixture-hive', slug: 'head-spa', categoryId: 'the-hive', categoryName: 'The Hive', name: 'Head spa', packages: [], addOns: [] }] } } });
  if (url.pathname.endsWith('/availability')) {
    availability.push(Object.fromEntries(url.searchParams));
    const date = url.searchParams.get('date');
    const slots = [{ startsAt: `${date}T15:00:00Z`, endsAt: `${date}T17:00:00Z`, staffId: 'host' }];
    return route.fulfill({ json: { data: url.searchParams.has('days') ? { nextAvailable: { date, slots } } : { diagnostics: { slots } } } });
  }
  if (url.pathname.endsWith('/bookings')) {
    submitted = request.postDataJSON();
    return route.fulfill({ status: reject ? 409 : 201, json: reject ? { error: 'That time is no longer available.' } : { data: { booking: { id: 'fixture-only', status: 'PENDING' } } } });
  }
  return route.fulfill({ json: { data: {} } });
});
mkdirSync('.tmp/booking-review', { recursive: true });
try {
  await page.goto(`${base}booking.html?profile=cottage616&service=celebration&next=1`);
  await page.locator('[data-package-id=Extended]:visible').waitFor();
  assert.doesNotMatch(await page.locator('[data-package-list]').innerText(), /Edited photos|Locations/);
  assert.equal(await page.locator('[data-category-id="the-hive"]').count(), 0);
  await page.screenshot({ path: '.tmp/booking-review/desktop-packages.png', fullPage: true });
  await page.locator('[data-package-id=Extended]:visible').click();
  await page.locator('[data-slot-index]').first().click();
  assert.match(await page.locator('[data-slot-index]').first().innerText(), /9:00 AM/);
  assert(availability.some(query => query.tierId === 'Extended' && query.days), 'Service links search bounded availability for the selected package');
  await page.locator('[data-review-booking]').click();
  await page.locator('[data-extra-id=chairs]').check();
  assert.doesNotMatch(await page.locator('[data-extra-list]').innerText(), /photo|location/i);
  await page.locator('[data-extra-quantity=chairs]').fill('3');
  assert.match(await page.locator('[data-extras-total]').innerText(), /195/);
  await page.screenshot({ path: '.tmp/booking-review/desktop-extras.png', fullPage: true });
  await page.locator('[data-continue-extras]').click();
  assert.match(await page.locator('[data-policy-text]').innerText(), /Celebration, Extended, \$195\.00/);
  await page.getByRole('button', { name: 'Agree and continue' }).click();
  assert.equal(await page.locator('[data-step-panel=confirm]').isVisible(), false);
  await page.locator('[name=policyAccepted]').check();
  await page.getByRole('button', { name: 'Agree and continue' }).click();
  await page.locator('[name=customerName]').fill('Test Guest');
  await page.locator('[name=customerEmail]').fill('guest@example.com');
  await page.locator('[data-submit-booking]').click();
  assert.equal(submitted, undefined, 'Missing required contact and intake data blocks submission');
  await page.locator('[name=customerPhone]').fill('555-123-4567');
  await page.locator('[name="bookingRule:guests"]').fill('20');
  await page.locator('[data-submit-booking]').click();
  await page.getByText('That time is no longer available.', { exact: true }).waitFor();
  assert.equal(await page.locator('[name=customerName]').inputValue(), 'Test Guest');
  assert.equal(submitted.tierId, 'Extended');
  assert.deepEqual(submitted.addOnQuantities, { chairs: 3 });
  assert.equal(submitted.intakeAnswers.guests, '20');
  assert.equal(submitted.bookingRequirementsRevision, 'requirements-v1');
  assert.equal(submitted.serviceRevision, 'service-v1');
  assert.equal(submitted.policyAccepted, true);
  assert.equal(submitted.photoMarketingConsent, undefined);
  reject = false;
  await page.locator('[data-submit-booking]').click();
  await page.locator('[data-step-panel=success]').waitFor();
  assert.equal(await page.locator('#success-title').innerText(), 'Request received');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}booking.html?service=celebration&next=1`);
  await page.locator('[data-package-stack] [data-package-id=Standard]').waitFor();
  await page.screenshot({ path: '.tmp/booking-review/mobile-packages.png', fullPage: true });
  assert(await page.locator('body').evaluate(el => el.scrollWidth <= innerWidth));
  await page.locator('[data-package-stack] [data-package-id=Standard]').click();
  await page.locator('[data-slot-index]').first().click();
  await page.locator('[data-review-booking]').click();
  await page.locator('[data-continue-extras]').click();
  await page.screenshot({ path: '.tmp/booking-review/mobile-terms.png', fullPage: true });
  await page.goto(`${base}booking.html?profile=the-hive&service=head-spa&next=1`);
  await page.locator('[data-slot-index]').first().waitFor();
  assert.equal(await page.title(), 'The Hive | Booking');
  assert.equal(await page.locator('[data-booking-home]').getAttribute('href'), 'the-hive.html');
  assert.equal(await page.locator('[data-category-id=events]').count(), 0);
  for (const value of ['empty', 'error']) {
    mode = value;
    await page.goto(`${base}booking.html`);
    if (mode === 'empty') await page.getByText('No services are currently available for booking.', { exact: true }).waitFor();
    else await page.locator('[data-catalog-status].is-error').waitFor();
  }
  assert.deepEqual(errors, []);
  console.log('Passed desktop/mobile packages, extras, terms, required forms, revisions, failed retry, request-only success, profile routing, empty/error states. No real bookings created.');
} catch (error) {
  await page.screenshot({ path: '.tmp/booking-review/failure.png', fullPage: true });
  console.error(errors);
  throw error;
} finally { await browser.close(); }
