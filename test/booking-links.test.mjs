import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

test('service links reuse the earliest-date search and stop when another selection supersedes it', async () => {
  const window = { BookingClientConfig: { schedule: { maxAdvanceDays: 3 } }, location: { search: '?service=head-spa&next=1' } };
  const source = readFileSync(new URL('../scripts/booking/app.js', import.meta.url), 'utf8').replace(/\}\)\(\);\s*$/, 'window.checkBooking = { findEarliestAvailableDate, setLoader: loader => { loadSlotsForDate = loader; } };})();');
  runInNewContext(source, { window, document: { addEventListener() {} }, URLSearchParams, console });
  const dates = [];
  window.checkBooking.setLoader(async (_service, date) => { dates.push(date); return dates.length === 2 ? [{ startsAt: `${date}T10:00:00` }] : []; });
  const result = await window.checkBooking.findEarliestAvailableDate({ maxAdvanceDays: 3 });
  assert.equal(result.date, dates[1]);
  assert.equal(dates.length, 2);
  let current = true, calls = 0;
  window.checkBooking.setLoader(async () => { calls++; current = false; return []; });
  assert.equal(await window.checkBooking.findEarliestAvailableDate({}, () => current), null);
  assert.equal(calls, 1);
});
