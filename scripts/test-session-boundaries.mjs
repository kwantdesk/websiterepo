import assert from "node:assert/strict";

const { resolveSessionSegments, DESK_SESSIONS } =
  await import("../src/lib/volumeProfileSessions.ts");

/**
 * Our session windows are DeepChart's session windows.
 *
 * A profile is only comparable to DeepChart's if it covers the same tape, and
 * ours did not: Asia opened two hours after theirs and London and New York
 * both closed early. That is not a rounding difference - two windows over one
 * tape give two different value areas - and it is why the same settings on the
 * same instrument read a fixed distance apart.
 *
 * DeepChart's own defaults, read out of its Sessions Marker on 2026-08-31:
 * Asian 15:00-03:00, Europe 03:00-11:00, Usa 09:30-16:00, New York time. The
 * 09:30 cash open is what fixes the zone: no other reading makes that the US
 * session.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const chicago = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const wallClock = (ms) => chicago.format(new Date(ms));

// Four days from a Tuesday, well clear of any DST boundary, so every session
// occurs several times over and no assertion lands on a clipped end.
const FROM = Date.UTC(2026, 7, 25, 12, 0);
const TO = Date.UTC(2026, 7, 29, 12, 0);

const segments = resolveSessionSegments(FROM, TO, { mode: "triple", window: "rth" });
// The middle occurrence of each session, so neither end is clipped by the range.
const middleOf = (id) => {
  const found = segments.filter((segment) => segment.id === id);
  assert.ok(found.length >= 2, `${id} did not resolve inside the range`);
  return found[Math.floor(found.length / 2)];
};

check("Asia runs 19:00 to 02:00, closing with DeepChart's Asian", () => {
  /*
   * The close is theirs exactly. The open is not, and deliberately: DeepChart
   * runs one Asian window where we run Globex and Asia, so THEIR Asian is our
   * two together and neither of ours alone should be compared against it.
   */
  const asia = middleOf("asia");
  assert.equal(wallClock(asia.startMs), "19:00");
  assert.equal(wallClock(asia.endMs), "02:00");
});

check("London runs 02:00 to 10:00, matching DeepChart's Europe", () => {
  // 03:00-11:00 New York. It used to stop at the 08:30 cash open, cutting off
  // the hour and a half where Europe trades against the US open.
  const london = middleOf("london");
  assert.equal(wallClock(london.startMs), "02:00");
  assert.equal(wallClock(london.endMs), "10:00");
});

check("New York runs 08:30 to 15:00, matching DeepChart's Usa", () => {
  // 09:30-16:00 New York - the cash session. Ours ran to 15:15, the futures
  // close, which is fifteen minutes of tape DeepChart never counts.
  const newYork = middleOf("newyork");
  assert.equal(wallClock(newYork.startMs), "08:30");
  assert.equal(wallClock(newYork.endMs), "15:00");
});

check("Globex hands over to Asia rather than sitting on top of it", () => {
  /*
   * This is the regression this file exists to stop. Both once started at
   * 17:00, and a session profile is anchored at its own start - so the two
   * anchored at the same pixel and drew through each other, which is what
   * "profiles in random spots" was. They must tile.
   */
  const globex = middleOf("globex");
  assert.equal(wallClock(globex.startMs), "17:00");
  assert.equal(wallClock(globex.endMs), "19:00");
  const asia = middleOf("asia");
  assert.notEqual(globex.startMs, asia.startMs, "Globex and Asia anchor at the same instant again");
  assert.equal(globex.endMs, asia.startMs, "Globex no longer hands straight over to Asia");
});

check("no two desk sessions share a start", () => {
  /*
   * The level chain picks the profile in front with a strict "starts later"
   * test, which a tie can never satisfy: two tied profiles each believe
   * nothing is in front of them and run their POC and value area across each
   * other. Overlap is fine and DeepChart does it too - London and New York
   * still overlap here - but an exact tie is not.
   */
  const starts = new Map();
  for (const segment of segments) {
    const key = `${segment.startMs}`;
    const already = starts.get(key);
    assert.ok(
      !already,
      `${segment.id} and ${already} both start at ${wallClock(segment.startMs)}`,
    );
    starts.set(key, segment.id);
  }
});

check("every session still covers real time and is still switchable", () => {
  // A window with no duration draws an empty profile; a session with no flag
  // cannot be turned off. Both have happened here before.
  for (const session of DESK_SESSIONS) {
    const segment = middleOf(session.id);
    assert.ok(segment.endMs > segment.startMs, `${session.id} has no duration`);
    assert.ok(session.settingsKey, `${session.id} has no settings flag`);
  }
});

check("the day session and the overnight together leave no hole", () => {
  /*
   * Asia closes at 02:00 and London opens at 02:00; London runs past the 08:30
   * open and New York starts there. The tape between the bell and the cash
   * close belongs to at least one session at every moment.
   */
  const asia = segments.find(
    (segment) => segment.id === "asia" && wallClock(segment.startMs) === "19:00",
  );
  assert.ok(asia, "no unclipped Asia in the range");
  // The neighbours of that particular Asia, not the middle of their own runs -
  // the runs are staggered by a day, so the middles are not the same session.
  const london = segments.find((segment) => segment.id === "london" && segment.startMs >= asia.endMs);
  const newYork = segments.find((segment) => segment.id === "newyork" && segment.startMs >= asia.endMs);
  assert.ok(london && newYork, "Asia has no London or New York after it");
  assert.equal(asia.endMs, london.startMs, "there is a gap between Asia and London");
  assert.ok(newYork.startMs < london.endMs, "New York opens after London has already closed");
});

console.log(`\nsession boundaries: ${passed}/${passed} checks passed`);
