// PLAYWRIGHT_MODULE points to an existing Playwright install. API fixtures never create real bookings.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const base = process.env.BOOKING_TEST_URL || 'http://127.0.0.1:8083/cottage616/';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Tokyo' });
if (process.env.BOOKING_PREVIEW_PASSWORD) {
  const login = await page.request.post(new URL('__preview/login', base).href, { headers: { Origin: new URL(base).origin }, form: { password: process.env.BOOKING_PREVIEW_PASSWORD, next: new URL(base).pathname }, maxRedirects: 0 });
  assert.equal(login.status(), 303);
}
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
let submitted, reject = true, mode = 'catalog', hostedPayment = false, invalidBooking = '';
const returnFixture = process.env.BOOKING_TEST_RETURN_FIXTURE
  ? JSON.parse(readFileSync(process.env.BOOKING_TEST_RETURN_FIXTURE, 'utf8')) : null;
const paymentUrl = 'https://www.sandbox.paypal.com/checkoutnow?token=synthetic';
const calendarUrl = 'https://admin.cottage616.com/api/calendar/booking.ics?bookingId=fixture-only&token=synthetic';
let confirmed = false;
await page.route(calendarUrl, async route => returnFixture ? route.fulfill({
  response: await route.fetch({ url: returnFixture.paid.calendarUrl })
}) : route.fulfill({
  contentType: 'text/calendar', headers: { 'content-disposition': 'attachment; filename="calendar.ics"' }, body: 'BEGIN:VCALENDAR\nEND:VCALENDAR'
}));
await page.route(paymentUrl, route => route.fulfill({
  contentType: 'text/html',
  body: returnFixture ? [
    ['cancel', returnFixture.pending.billingUrl + '?checkout=cancel'],
    ['waiting', returnFixture.pending.billingUrl + '?checkout=success'],
    ['paid', returnFixture.paid.billingUrl + '?checkout=success']
  ].map(([label, href]) => '<a id="' + label + '" href="' + href + '">' + label + '</a>').join(' ') : 'Booking payment'
}));
const availability = [];
await page.route('**/api/public/v1/**', async route => {
  const request = route.request(), url = new URL(request.url());
  if (url.pathname.endsWith('/services')) return route.fulfill({ status: mode === 'error' ? 503 : 200, json: mode === 'error' ? { error: 'Services unavailable' } : { data: { onlineBookingEnabled: mode !== 'blocked', packageFields: [], categories: [{ id: 'events', name: 'Events' }, { id: 'the-hive', name: 'The Hive' }], services: mode === 'empty' ? [] : [service, { ...service, id: 'fixture-hive', slug: 'head-spa', categoryId: 'the-hive', categoryName: 'The Hive', name: 'Head spa', packages: [], addOns: [] }] } } });
  if (url.pathname.endsWith('/availability')) {
    availability.push(Object.fromEntries(url.searchParams));
    const date = url.searchParams.get('date');
    const slots = [{ startsAt: `${date}T15:00:00Z`, endsAt: `${date}T17:00:00Z`, staffId: 'host' }];
    return route.fulfill({ json: { data: url.searchParams.has('days') ? { nextAvailable: { date, slots } } : { diagnostics: { slots } } } });
  }
  if (url.pathname.endsWith('/bookings')) {
    submitted = request.postDataJSON();
    if (invalidBooking === 'invalid-json') return route.fulfill({ status: 201, body: '{' });
    if (invalidBooking === 'no-booking') return route.fulfill({ status: 201, json: { data: { ok: true } } });
    if (invalidBooking === 'invalid-handoff') return route.fulfill({ status: 201, json: { data: { ok: true, paymentUrl: 'https://checkout.stripe.com.invalid/checkout' } } });
    const booking = confirmed ? { id: 'fixture-only', status: 'CONFIRMED', calendarUrl, manageUrl: 'https://example.invalid' } : { id: 'fixture-only', status: 'PENDING' };
    return route.fulfill({ status: reject ? 409 : 201, json: reject ? { error: 'That time is no longer available.' } : { data: hostedPayment ? { ok: true, paymentUrl } : { ok: true, booking } } });
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
  const requestKey = submitted.submissionKey;
  assert.match(requestKey, /^[a-f\d-]{36}$/i);
  reject = false;
  await page.locator('[data-submit-booking]').click();
  await page.locator('[data-step-panel=success]').waitFor();
  assert.equal(submitted.submissionKey, requestKey);
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
  service.policyText = 'I agree to the hourly booking terms.';
  service.packages = [{ ...pack('Hourly', 10000, 60), pricingType: 'HOURLY', hourlyRateCents: 10000,
    addOns: [{ id: 'assistant', name: 'Event assistant', pricingType: 'HOURLY', priceCents: 2000, hourlyRateCents: 2000 }] }];
  const previousRequests = availability.length;
  await page.goto(`${base}booking.html?service=celebration&next=1`);
  await page.locator('[data-step-panel=duration]').waitFor();
  assert.equal(availability.length, previousRequests, 'Hourly bookings ask for duration before fetching slots');
  await page.locator('[data-duration-form] [name=hours]').fill('2');
  await page.locator('[data-duration-form] [name=minutes]').fill('30');
  assert.match(await page.locator('[data-duration-total]').innerText(), /250\.00/);
  await page.screenshot({ path: '.tmp/booking-review/mobile-hourly-duration.png', fullPage: true });
  await page.getByRole('button', { name: 'See available times' }).click();
  await page.locator('[data-slot-index]').first().click();
  assert(availability.slice(previousRequests).every(query => query.durationMinutes === '150'));
  await page.locator('[data-review-booking]').click();
  assert.match(await page.locator('[data-extra-list]').innerText(), /50\.00/);
  await page.locator('[data-extra-id=assistant]').check();
  assert.match(await page.locator('[data-extras-total]').innerText(), /300\.00/);
  await page.locator('[data-continue-extras]').click();
  assert.match(await page.locator('[data-policy-text]').innerText(), /hourly booking terms/);
  await page.locator('[name=policyAccepted]').check();
  await page.locator('[data-back-from-terms]').click();
  await page.locator('[data-back-from-extras]').click();
  await page.locator('[data-back-to-services]').click();
  await page.locator('[data-duration-form] [name=hours]').fill('3');
  await page.locator('[data-duration-form] [name=minutes]').fill('0');
  await page.getByRole('button', { name: 'See available times' }).click();
  assert(await page.locator('[data-review-booking]').isDisabled(), 'Changing duration clears the previous slot');
  await page.locator('[data-slot-index]').first().click();
  await page.locator('[data-review-booking]').click();
  assert.match(await page.locator('[data-extras-total]').innerText(), /360\.00/);
  await page.locator('[data-continue-extras]').click();
  assert.equal(await page.locator('[name=policyAccepted]').isChecked(), false, 'Changing duration renews acceptance even for static terms');
  await page.locator('[name=policyAccepted]').check();
  await page.getByRole('button', { name: 'Agree and continue' }).click();
  await page.locator('[name=customerName]').fill('Hourly Guest');
  await page.locator('[name=customerEmail]').fill('hourly@example.com');
  await page.locator('[name=customerPhone]').fill('555-123-4567');
  await page.locator('[name="bookingRule:guests"]').fill('20');
  hostedPayment = true;
  assert.equal(await page.locator('[data-submit-booking]').innerText(), 'Continue to payment');
  for (const invalid of ['invalid-json', 'no-booking', 'invalid-handoff']) {
    invalidBooking = invalid;
    const response = page.waitForResponse(result => result.request().method() === 'POST' && new URL(result.url()).pathname.endsWith('/bookings'));
    await page.locator('[data-submit-booking]').click();
    await response;
    await page.getByText('We couldn’t verify the booking response.', { exact: false }).waitFor();
    assert((await page.locator('[name=customerName]').inputValue()).length > 0);
  }
  invalidBooking = '';
  await page.locator('[data-submit-booking]').click();
  await page.waitForURL(paymentUrl);
  if (returnFixture) {
    await page.locator('#cancel').click();
    await page.getByText('Checkout was canceled.', { exact: false }).waitFor();
    await page.goto(paymentUrl);
    await page.locator('#waiting').click();
    await page.getByText('We’re waiting for payment confirmation.', { exact: false }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Add to calendar' }).count(), 0);
    await page.goto(paymentUrl);
    await page.locator('#paid').click();
    await page.getByRole('heading', { name: 'Booking confirmed' }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Manage booking' }).count(), 0);
    const calendar = await page.getByRole('link', { name: 'Add to calendar' }).getAttribute('href');
    const signed = new URL(calendar, page.url());
    const response = await page.request.get(signed.href);
    assert.equal(response.status(), 200);
    assert.match(response.headers()['content-type'], /text\/calendar/);
    assert.match(await response.text(), /BEGIN:VCALENDAR/);
    signed.searchParams.set('token', 'invalid');
    assert.equal((await page.request.get(signed.href)).status(), 401);
  }
  assert.equal(submitted.checkoutSupported, true);
  assert.equal(submitted.durationMinutes, 180);
  assert.deepEqual(submitted.addOnIds, ['assistant']);
  hostedPayment = false;
  confirmed = true;
  Object.assign(service, { bookingRules: [], requirePolicy: false, policyText: '', packages: [] });
  await page.goto(`${base}booking.html?profile=the-hive&service=head-spa&next=1`);
  await page.locator('[data-slot-index]').first().click();
  await page.locator('[data-review-booking]').click();
  await page.locator('[name=customerName]').fill('Calendar Fixture');
  await page.locator('[name=customerEmail]').fill('calendar@example.test');
  await page.locator('[name=customerPhone]').fill('5551234567');
  await page.locator('[data-submit-booking]').click();
  await page.getByRole('heading', { name: "You're booked" }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Manage booking' }).count(), 0);
  const calendarLink = page.getByRole('link', { name: 'Add to calendar' });
  assert.equal(await calendarLink.getAttribute('href'), calendarUrl);
  const responsePromise = page.waitForResponse(response => response.url() === calendarUrl);
  const downloadPromise = page.waitForEvent('download');
  await calendarLink.click();
  const file = await responsePromise;
  assert.equal(file.status(), 200);
  assert.match(file.headers()['content-type'], /text\/calendar/);
  assert.match(readFileSync(await (await downloadPromise).path(), 'utf8'), /BEGIN:VCALENDAR/);
  mode = 'blocked';
  const lastAvailabilityCount = availability.length;
  await page.goto(`${base}booking.html?service=celebration&next=1`);
  await page.getByText('Online booking is unavailable. Contact us to schedule.', { exact: true }).waitFor();
  assert.equal(availability.length, lastAvailabilityCount);
  assert.equal(await page.locator('[data-step-panel=duration]').isVisible(), false);
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
