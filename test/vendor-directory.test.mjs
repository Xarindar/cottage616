import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../scripts/integrations/showrunner/content.js', import.meta.url), 'utf8');
const list = { innerHTML: '' };
const { vendorGroups, applyVendorDirectory } = runInNewContext(
  source.slice(source.indexOf('  function applyVendorDirectory('), source.lastIndexOf('})();'))
    + '\n({ vendorGroups, applyVendorDirectory });',
  { document: { querySelector: () => list } }
);

test('guest offers come first and only qualifying vendors receive a crown and image', () => {
  const html = vendorGroups([
    { name: 'General vendor', offer: '   ', imageUrl: 'general.jpg', phone: 'tel:123' },
    { name: 'Discount partner', offer: '15% off for Cottage guests', imageUrl: 'discount.jpg', phone: 'tel:456' },
    { name: 'Delivery partner', offer: 'Free delivery for Cottage guests', imageUrl: 'delivery.jpg' }
  ]);
  assert.ok(html.indexOf('Discount partner') < html.indexOf('Delivery partner'));
  assert.ok(html.indexOf('Delivery partner') < html.indexOf('General vendor'));
  assert.equal((html.match(/class="vendor-partner-badge"/g) || []).length, 2);
  assert.equal((html.match(/class="vendor-entry__image"/g) || []).length, 2);
  assert.ok(!html.includes('general.jpg'));
  assert.ok(html.includes('15% off for Cottage guests'));
  assert.ok(html.includes('data-contact-target="showrunner-vendor-2"'));
  assert.ok(html.includes('id="showrunner-vendor-2"'));
  assert.ok(html.includes('href="tel:456"'));
});

test('editing away an offer removes featured placement and empty updates clear old listings', () => {
  const vendor = { name: 'A vendor', offer: 'Free delivery', phone: 'tel:123' };
  applyVendorDirectory({ items: [vendor] });
  assert.ok(list.innerHTML.includes('vendor-partner-badge'));
  applyVendorDirectory({ items: [{ ...vendor, offer: '' }] });
  assert.ok(!list.innerHTML.includes('vendor-partner-badge'));
  assert.ok(!list.innerHTML.includes('id="guest-offers"'));
  assert.ok(list.innerHTML.includes('A vendor'));
  applyVendorDirectory({ items: [] });
  assert.ok(list.innerHTML.includes('vendors-empty'));
  assert.ok(!list.innerHTML.includes('A vendor'));
});

test('vendor names and guest offers render as text', () => {
  const html = vendorGroups([{ name: '<img onerror="bad()">', offer: '<script>bad()</script>' }]);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&lt;img onerror=&quot;bad()&quot;&gt;'));
});
