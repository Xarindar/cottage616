import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../scripts/integrations/showrunner/content.js', import.meta.url), 'utf8');
const functions = source.slice(source.indexOf('  function headerFraming('), source.indexOf('  function buildLayer('));
const { headerFraming, headerImageSources } = runInNewContext(functions + '\n({ headerFraming, headerImageSources })', { URL, location: { href: 'https://www.cottage616.com/' } });

test('header rendering preserves legacy centering and bounds saved framing', () => {
  assert.equal(JSON.stringify(headerFraming({})), JSON.stringify({ x: 50, y: 50, zoom: 1 }));
  assert.equal(JSON.stringify(headerFraming({ imagePositionX: -10, imagePositionY: 90, imageZoom: 2 })), JSON.stringify({ x: 0, y: 90, zoom: 2 }));
});
test('large headers use the refreshed high-resolution variant while signed and external URLs stay intact', () => {
  const result = headerImageSources('https://admin.cottage616.com/api/media/assets/photo?variant=HERO');
  assert.equal(new URL(result.full).searchParams.get('v'), 'header-3840-q88');
  assert.equal(new URL(result.standard).searchParams.get('variant'), 'FULL');
  for (const url of ['https://cdn.example/photo.jpg', 'https://admin.cottage616.com/api/media/assets/photo?variant=HERO&signature=abc']) {
    assert.equal(headerImageSources(url).full, url);
    assert.equal(headerImageSources(url).standard, undefined);
  }
});
