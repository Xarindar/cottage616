import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
const source = readFileSync(new URL('../scripts/integrations/showrunner/content.js', import.meta.url), 'utf8');
const card = runInNewContext(source.slice(source.indexOf('  function testimonialCard('), source.lastIndexOf('})();')) + '\ntestimonialCard;');
test('short reviews stay complete without an expansion control', () => {
  const html = card({authorName: 'Guest', quote: 'Loved the head spa!'});
  assert.ok(html.includes('Loved the head spa!'));
  assert.ok(!html.includes('<details'));
});
test('long reviews preserve full text and safely escape preview and expanded copy', () => {
  const quote = '<script>bad()</script> ' + 'Wonderful scalp care and relaxation. '.repeat(20);
  const html = card({authorName: 'Guest', quote});
  assert.ok(html.includes('<details'));
  assert.ok(html.includes('Read full review'));
  assert.ok(html.includes('Show less'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('…</span>'));
  assert.ok(html.includes(quote.replaceAll('<', '&lt;').replaceAll('>', '&gt;')));
});
