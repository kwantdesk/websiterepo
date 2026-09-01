import assert from "node:assert/strict";

const { currentDeskSession } = await import("../src/lib/volumeProfileSessions.ts");

/**
 * The session the desk is in, right now, named correctly.
 *
 * The daily P&L said "New York" while the trader was in Asia, because the text
 * was hardcoded. A readout that names a session has to resolve one, and it has
 * to hand over in the right order: Globex at the 17:00 open, Asia, London,
 * New York, then nothing until the next open.
 *
 * Separate from the profile windows on purpose. Those overlap - London runs to
 * 10:00 to match DeepChart's Europe - and a clock cannot: at 09:00 the desk is
 * in New York, not in both.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

// Chicago is UTC-5 in September (CDT), so 17:00 CT is 22:00 UTC the same day.
// Tuesday 2026-09-01 through Wednesday 2026-09-02.
const at = (iso) => Date.parse(iso);
const id = (iso) => currentDeskSession(at(iso))?.id ?? null;

check("Globex opens the day at 17:00 Chicago", () => {
  assert.equal(id("2026-09-01T22:00:00Z"), "globex");  // 17:00 CT Tue
  assert.equal(id("2026-09-01T23:59:00Z"), "globex");  // 18:59 CT Tue
});

check("Asia takes over at 19:00", () => {
  assert.equal(id("2026-09-02T00:00:00Z"), "asia");    // 19:00 CT Tue
  assert.equal(id("2026-09-02T06:59:00Z"), "asia");    // 01:59 CT Wed
});

check("London takes over at 02:00", () => {
  assert.equal(id("2026-09-02T07:00:00Z"), "london");  // 02:00 CT Wed
  assert.equal(id("2026-09-02T13:29:00Z"), "london");  // 08:29 CT Wed
});

check("New York takes over at the 08:30 cash open", () => {
  /*
   * Not at 10:00, which is where the London PROFILE window ends to match
   * DeepChart. From the cash open the desk is trading New York.
   */
  assert.equal(id("2026-09-02T13:30:00Z"), "newyork"); // 08:30 CT Wed
  assert.equal(id("2026-09-02T19:59:00Z"), "newyork"); // 14:59 CT Wed
});

check("nothing is named between the close and the next open", () => {
  // 15:00 to 17:00 Chicago. Naming a session here would be worse than naming
  // none, so null is a real answer.
  assert.equal(id("2026-09-02T20:00:00Z"), null);      // 15:00 CT Wed
  assert.equal(id("2026-09-02T21:59:00Z"), null);      // 16:59 CT Wed
  assert.equal(id("2026-09-02T22:00:00Z"), "globex");  // 17:00 CT Wed, open again
});

check("the weekend is shut", () => {
  assert.equal(id("2026-09-04T20:30:00Z"), null);      // Fri 15:30 CT, after the close
  assert.equal(id("2026-09-05T12:00:00Z"), null);      // Sat
  assert.equal(id("2026-09-06T12:00:00Z"), null);      // Sun morning
  assert.equal(id("2026-09-06T22:00:00Z"), "globex");  // Sun 17:00 CT, the week opens
});

check("the four hand over with no gap and no overlap", () => {
  /*
   * Walked minute by minute across a whole trading day: every minute from the
   * open to the close belongs to exactly one session, and they arrive in order.
   */
  const start = at("2026-09-01T22:00:00Z");
  const seen = [];
  for (let minute = 0; minute < 22 * 60; minute += 1) {
    const session = currentDeskSession(start + minute * 60_000);
    if (!session) { seen.push(null); continue; }
    if (seen[seen.length - 1] !== session.id) seen.push(session.id);
  }
  assert.deepEqual(
    seen.filter(Boolean),
    ["globex", "asia", "london", "newyork"],
    `sessions did not hand over in order: ${seen.join(" -> ")}`,
  );
});

check("it counts down to the handover", () => {
  // So a readout can say how long is left rather than only what is running.
  const session = currentDeskSession(at("2026-09-01T22:00:00Z"));
  assert.equal(session.id, "globex");
  assert.equal(session.minutesRemaining, 120);
});

check("a nonsense timestamp names nothing", () => {
  assert.equal(currentDeskSession(Number.NaN), null);
});

console.log(`\ndesk session clock: ${passed}/${passed} checks passed`);
