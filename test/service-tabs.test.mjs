import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

test('service tabs switch panels by click, keyboard, and foot-spa links', () => {
  const panels = { 'head-spa-panel': { hidden: false }, 'other-services-panel': { hidden: true }, 'foot-spa': { scrollIntoView() { this.scrolled = true; } } };
  const tabs = ['head-spa-panel', 'other-services-panel'].map((id, index) => ({
    attributes: { 'aria-controls': id, 'aria-selected': String(index === 0) },
    handlers: {}, tabIndex: index === 0 ? 0 : -1,
    setAttribute(key, value) { this.attributes[key] = value; },
    getAttribute(key) { return this.attributes[key]; },
    addEventListener(key, handler) { this.handlers[key] = handler; },
    focus() { this.focused = true; }
  }));
  const location = { hash: '' };
  const listeners = {};
  const source = readFileSync(new URL('../scripts/site.js', import.meta.url), 'utf8');
  runInNewContext(source.slice(source.indexOf('const serviceTabs =')), {
    document: { querySelectorAll: () => tabs, getElementById: id => panels[id] },
    location, window: { addEventListener: (event, handler) => { listeners[event] = handler; } }
  });
  assert.equal(panels['head-spa-panel'].hidden, false);
  assert.equal(panels['other-services-panel'].hidden, true);
  tabs[1].handlers.click();
  assert.equal(panels['head-spa-panel'].hidden, true);
  assert.equal(panels['other-services-panel'].hidden, false);
  assert.equal(tabs[1].attributes['aria-selected'], 'true');
  let prevented = false;
  tabs[1].handlers.keydown({ key: 'ArrowRight', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(tabs[0].focused, true);
  assert.equal(tabs[0].tabIndex, 0);
  assert.equal(tabs[1].tabIndex, -1);
  assert.equal(panels['other-services-panel'].hidden, true);
  location.hash = '#foot-spa';
  listeners.hashchange();
  assert.equal(panels['other-services-panel'].hidden, false);
  assert.equal(panels['foot-spa'].scrolled, true);
});
