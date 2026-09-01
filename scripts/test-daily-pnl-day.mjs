import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { paperPnlDayKey } = await import("../src/lib/paperTrading.ts");
const workspace = readFileSync(
  new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8",
);

/**
 * The daily P&L covers a TRADING day, and says so.
 *
 * It drew a New York midnight-to-midnight boundary. Trading the Asia session
 * at 20:00 New York put those fills in the same "today" as that morning's cash
 * session - nine hours and one trading day apart - so the figure lumped the
 * session just opened together with the one already closed. The caption also
 * read "New York" while the trader was in Asia, which is how it surfaced.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

// Monday 2026-08-31, in New York terms.
const nyCashSession = Date.parse("2026-08-31T14:00:00.000Z");   // 10:00 ET Monday
const asiaThatEvening = Date.parse("2026-09-01T00:00:00.000Z"); // 20:00 ET Monday
const beforeTheOpen = Date.parse("2026-08-31T20:30:00.000Z");   // 16:30 ET Monday, between close and open

check("the Asia session is a different trading day from that morning", () => {
  /*
   * This is the bug. Both are "Monday" on a calendar, and they are different
   * CME days - the 17:00 open rolls between them.
   */
  const morning = paperPnlDayKey(nyCashSession);
  const evening = paperPnlDayKey(asiaThatEvening);
  assert.ok(morning, "the morning session resolved to no day");
  assert.ok(evening, "the Asia session resolved to no day");
  assert.notEqual(evening, morning, "Asia is still counted with the previous cash session");
});

check("the evening belongs to the day the open started", () => {
  // 20:00 ET Monday is Tuesday's CME session.
  assert.equal(paperPnlDayKey(asiaThatEvening), "2026-09-01");
});

check("the morning belongs to its own date", () => {
  assert.equal(paperPnlDayKey(nyCashSession), "2026-08-31");
});

check("the gap between the close and the open still resolves", () => {
  // 16:30 ET is after the cash close and before the 17:00 open. It must not
  // return an empty key, which would silently drop a fill from every total.
  assert.ok(paperPnlDayKey(beforeTheOpen), "a fill between close and open has no day");
});

check("a nonsense timestamp is refused, not guessed", () => {
  assert.equal(paperPnlDayKey(Number.NaN), "");
  assert.equal(paperPnlDayKey(Number.POSITIVE_INFINITY), "");
});

check("the readout names the session it is in, and it ticks", () => {
  /*
   * Hardcoded words cannot be right twice a day. The caption resolves the
   * session and re-resolves it on a timer, so it hands over Globex -> Asia ->
   * London -> New York rather than claiming one of them all day.
   */
  assert.match(workspace, /function LiveDeskSession\(\)/, "the live session readout is gone");
  assert.match(workspace, /setSession\(currentDeskSession\(\)\)/, "it no longer resolves the session");
  assert.match(workspace, /window\.setInterval\(tick, 60_000\)/, "it no longer ticks");
  assert.match(workspace, /Closed this trading day · <LiveDeskSession \/>/, "the caption is not wired to it");
  assert.match(workspace, /"Market closed"/, "there is no closed state between sessions");
});

check("the readout no longer calls itself New York", () => {
  /*
   * The figure was right for a calendar day and the words described a session.
   * Naming the boundary is the difference between a label and a guess.
   */
  assert.ok(
    !workspace.includes("Closed today · New York"),
    "the daily P&L still reads as the New York session",
  );
  assert.ok(
    !workspace.includes("Closed this trading day · from the 17:00 CT open"),
    "the caption is a fixed string again",
  );
});

console.log(`\ndaily pnl day: ${passed}/${passed} checks passed`);
