import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

test("published business content follows mobile overrides and editor drafts stay authoritative", async () => {
  const phone = {};
  const listeners = {};
  const media = { matches: false, addEventListener: (_name, callback) => { listeners.resize = callback; } };
  const response = { data: { businessConfigured: true, business: { phone: "111", businessName: "Desktop" }, mobileBusiness: { phone: "222", businessName: "Mobile" } } };
  const window = { matchMedia: () => media, addEventListener: (name, callback) => { listeners[name] = callback; } };
  const document = { querySelectorAll: selector => selector === "[data-business-phone]" ? [phone] : [] };
  runInNewContext(readFileSync("scripts/integrations/showrunner/business.js", "utf8"), { window, document, location: { pathname: "/index.html" }, navigator: { userAgent: "" }, URL, fetch: async () => ({ ok: true, json: async () => response }) });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(phone.textContent, "111");
  media.matches = true; listeners.resize();
  assert.equal(phone.textContent, "222");
  media.matches = false; listeners.resize();
  assert.equal(phone.textContent, "111");
  listeners["showrunner:render"]({ detail: { blocks: [{ type: "business", payload: { phone: "draft" } }] } });
  media.matches = true; listeners.resize();
  assert.equal(phone.textContent, "draft");
});
