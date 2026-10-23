import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

test('the legacy menu image yields to HTML typography while custom images remain editable', () => {
  const source = readFileSync(new URL('../scripts/integrations/showrunner/content.js', import.meta.url), 'utf8');
  const image = { src: '' };
  const applyStudio = runInNewContext(
    source.slice(source.indexOf('  function applyStudio('), source.indexOf('  function applyHiveMenu(')) + '\napplyStudio;',
    { document: { querySelector: () => image }, URL, location: { href: 'https://www.cottage616.com/the-hive.html' } }
  );
  for (const src of ['assets/hive/photos/treatments/head-spa-menu-banner-v1.png', 'https://www.cottage616.com/assets/hive/photos/treatments/head-spa-menu-banner-v1.png?v=1']) {
    image.src = src;
    applyStudio({ blocks: [{ id: 'hive-menu-photo' }] });
    assert.equal(image.src, 'assets/shared/textures/paper/natural-paper.png');
  }
  image.src = 'https://admin.cottage616.com/api/media/assets/custom-photo';
  applyStudio({ blocks: [{ id: 'hive-menu-photo' }] });
  assert.equal(image.src, 'https://admin.cottage616.com/api/media/assets/custom-photo');
});
