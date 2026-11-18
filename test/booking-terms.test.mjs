import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bookingTermsValues, plainTermsDocument, renderTermsDocument, renderTermsText } from '../scripts/booking/booking-terms.js';

const template = 'Session: [Session name] — Package: [Package name] — Duration: [Duration]';
test('plain and formatted terms resolve the selected session and package', () => {
  const values = bookingTermsValues({ serviceName: 'Wedding Photos', package: { name: 'Classic', durationMinutes: 120 } });
  const expected = 'Session: Wedding Photos — Package: Classic — Duration: 120 minutes';
  assert.equal(renderTermsText(template, values), expected);
  assert.equal(renderTermsDocument(plainTermsDocument(template), values).text, expected);
  const changed = bookingTermsValues({ serviceName: 'Wedding Photos', package: { name: 'Luxury', unlimitedDuration: true } });
  assert.equal(renderTermsText(template, changed), 'Session: Wedding Photos — Package: Luxury — Duration: Unlimited (rest of day reserved)');
});

test('replacement preserves missing fields and literal brackets and escapes formatted values', () => {
  assert.equal(renderTermsText('[Client name] [custom clause]'), '[Client name] [custom clause]');
  const values = { serviceName: '<script> [Duration]', duration: '60 minutes' };
  assert.equal(renderTermsText('[Session name]', values), '<script> [Duration]');
  assert.equal(renderTermsDocument(plainTermsDocument('[Session name]'), values).html, '<p>&lt;script&gt; [Duration]</p>');
});
