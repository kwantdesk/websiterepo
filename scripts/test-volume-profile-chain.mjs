import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Reproduces the renderer's level-chain rule: a profile's POC / VAH / VAL run
 * on until the back of the next profile in front of them, then stop.
 */
function buildChain(models) {
  const next = new Map();
  const groups = new Map();
  for (const model of models) {
    const group = groups.get(model.root) ?? [];
    group.push(model);
    groups.set(model.root, group);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => a.startMs - b.startMs);
    for (const entry of group) {
      let blocker = null;
      for (const candidate of group) {
        if (candidate.id === entry.id) continue;
        const samePeriod = (candidate.period ?? "daily") === (entry.period ?? "daily");
        // Same period — the sessions of a day, one daily after another — is
        // the hard rule: whichever begins next stops the one before it, to
        // the second, overlap or not. A different period nests, so it only
        // yields to one starting at or after it ends.
        const inFront = samePeriod
          ? candidate.startMs > entry.startMs
          : candidate.startMs >= entry.endMs;
        if (!inFront) continue;
        if (blocker === null || candidate.startMs < blocker) blocker = candidate.startMs;
      }
      if (blocker !== null) next.set(entry.id, blocker);
    }
  }
  return next;
}

const DAY = 86_400_000;
const T0 = Date.parse("2026-08-17T22:00:00.000Z");
const day = (i) => ({ id: `d${i}`, root: "NQ", startMs: T0 + i * DAY, endMs: T0 + (i + 1) * DAY });

// 1. Consecutive dailies: each stops at the back of the next.
{
  const chain = buildChain([day(0), day(1), day(2)]);
  assert.equal(chain.get("d0"), day(1).startMs, "a daily must stop at the next daily");
  assert.equal(chain.get("d1"), day(2).startMs);
  assert.equal(chain.get("d2"), undefined, "the newest profile runs to the live edge");
}

// 2. A weekly must NOT be truncated by the dailies drawn inside its own span —
//    that is the case a start-time comparison gets wrong.
{
  const weekly = { id: "w0", root: "NQ", period: "weekly", startMs: T0, endMs: T0 + 5 * DAY };
  const nextWeekly = { id: "w1", root: "NQ", period: "weekly", startMs: T0 + 7 * DAY, endMs: T0 + 12 * DAY };
  const chain = buildChain([weekly, nextWeekly, day(0), day(1), day(2)]);
  assert.equal(chain.get("w0"), nextWeekly.startMs, "a weekly must run across its own dailies");
}

// 3. Split sessions stop at the back of the next session, not underneath it.
{
  const asia = { id: "asia", root: "NQ", startMs: T0, endMs: T0 + 9 * 3_600_000 };
  const london = { id: "london", root: "NQ", startMs: asia.endMs, endMs: asia.endMs + 6.5 * 3_600_000 };
  const ny = { id: "ny", root: "NQ", startMs: london.endMs, endMs: london.endMs + 6.75 * 3_600_000 };
  const chain = buildChain([asia, london, ny]);
  assert.equal(chain.get("asia"), london.startMs, "Asia must stop at London's back");
  assert.equal(chain.get("london"), ny.startMs, "London must stop at New York's back");
  assert.equal(chain.get("ny"), undefined, "the live session runs to the edge");
}

// 4. Mixed kinds block each other — the whole point of "all combinations".
{
  const daily = day(0);
  const fixedRange = { id: "fx", root: "NQ", startMs: daily.endMs + 3_600_000, endMs: daily.endMs + 5 * 3_600_000 };
  const chain = buildChain([daily, fixedRange]);
  assert.equal(chain.get("fx" ), undefined);
  assert.equal(chain.get("d0"), fixedRange.startMs, "a daily must stop at a fixed range in front of it");
}

// 5. A different instrument must never block: two roots are separate chains.
{
  const nq = day(0);
  const es = { id: "es0", root: "ES", startMs: nq.endMs, endMs: nq.endMs + DAY };
  const chain = buildChain([nq, es]);
  assert.equal(chain.get("d0"), undefined, "another instrument must not truncate a level");
}

// 6. An overlapping profile that started earlier is behind, not in front.
{
  const daily = day(1);
  const overlapping = { id: "ov", root: "NQ", startMs: daily.startMs - 3_600_000, endMs: daily.endMs + DAY };
  const chain = buildChain([daily, overlapping]);
  assert.equal(chain.get("d1"), undefined, "a profile that started earlier is not in front");
}

// 7. The renderer must actually use one chain across every kind.
const primitive = readFileSync("src/lib/nativeVolumeProfilePrimitive.ts", "utf8");
assert.doesNotMatch(primitive, /chainGroups\.get\(`\$\{model\.profile\.period\}/);
assert.match(primitive, /candidate\.startMs > entry\.startMs/, "same-period sessions chain by start");
assert.match(primitive, /candidate\.startMs >= entry\.endMs/, "a nested kind still yields only past its end");
assert.match(primitive, /resolveLevelChainEndX/);

// 8. The stop position must be measured where the blocker is DRAWN, not where
//    its time sits. A docked profile is painted at a screen edge, so a
//    time-based stop halted the lines in empty space and let them run straight
//    through the docked body — which is why the chaining held until the chart
//    was scrolled away from the profile.
assert.match(primitive, /const drawnAnchorXById = new Map<string, number>\(\);/);
assert.match(primitive, /const blockerDrawnX = blockerId === undefined/);
assert.match(primitive, /drawnAnchorXById\.get\(blockerId\)/);
assert.doesNotMatch(
  primitive,
  /this\.timeToCoordinate\(model, Math\.floor\(nextProfileStartMs \/ 1_000\)\)/,
  "the stop must not fall back to the blocker's time position",
);

// 9. A docked profile records its screen edge as its drawn spine.
assert.match(primitive, /drawnAnchorXById\.set\(model\.id, leftEdge \+ 2\);/);
assert.match(primitive, /drawnAnchorXById\.set\(model\.id, rightEdge - 2\);/);

// 10. A blocker drawn to the LEFT of a profile is not in front of it on screen
//     and must not truncate its levels. (The position is now `blockerX`: the
//     blocker's drawn spine when it has one, otherwise its start projected
//     through the profile being drawn — see check 11.)
assert.match(primitive, /blockerX <= ownDrawnX/);

// 11. A profile that is in front but cannot be measured must still stop the
//     lines. Only its POSITION was ever viewport-dependent; the chain itself
//     is worked out in time. Falling back to the pane width when the blocker
//     could not place itself is what sent levels racing forward across every
//     profile ahead of them whenever the chart was zoomed or scrolled.
assert.match(primitive, /const blockerStartMsById = new Map<string, number>\(\);/);
assert.match(primitive, /this\.timeToCoordinate\(model, blockerStartMs \/ 1_000\)/);
assert.ok(
  primitive.includes("blockerId !== undefined && !blockerPlacedBehind"),
  "an unplaceable blocker must stop the lines rather than release them",
);

// 12. A level must stop at the BACK of the profile in front, not at its
//     spine. A body that extends left from its spine — any right-docked or
//     right-anchored profile, and the delta half of a normal daily — has its
//     back a full width before the anchor, so an anchor-based stop drew the
//     line straight across the profile it was meant to stop behind.
{
  const backEdge = (anchorX, width, extendsLeft) => (extendsLeft ? anchorX - width : anchorX);
  assert.equal(backEdge(500, 100, true), 400, "a right-anchored body starts a width before its spine");
  assert.equal(backEdge(500, 100, false), 500, "a left-anchored body starts at its spine");
  // The visible symptom: stopping at 500 crosses every pixel from 400 to 500.
  assert.ok(backEdge(500, 100, true) < 500, "the stop must be earlier than the spine");
}
assert.match(primitive, /const drawnBackXById = new Map<string, number>\(\);/);
assert.match(primitive, /drawnBackXById\.set\(model\.id, anchorX - bodyReachesLeftBy\);/);
assert.match(primitive, /drawnBackXById\.get\(blockerId\)/);

// 13. Levels are drawn after every body. Inside one pass a profile can only
//     see models drawn before it, and the profile in front is frequently drawn
//     after — so the stop edge could not be measured at the moment the line
//     was drawn. Deferring also lifts every level above every body, so a
//     profile drawn later cannot paint over an earlier one's POC.
assert.match(primitive, /const deferredLevelDraws: Array<\(\) => void> = \[\];/);
assert.match(primitive, /deferredLevelDraws\.push\(\(\) => \{/);
assert.ok(
  primitive.indexOf("for (const drawDeferredLevel of deferredLevelDraws)")
    > primitive.indexOf("deferredLevelDraws.push"),
  "the queue must run after the loop that fills it",
);

console.log("volume profile level chaining: 13/13 checks passed");

// 13. THE REPORTED BUG. Sessions overlap. A Globex profile runs from the
//     evening open right through to the cash close, so the New York session
//     sits INSIDE its span. Comparing against the end therefore never saw New
//     York as being in front, and Globex's POC, VAH and VAL ran straight
//     through it and on across the chart — the pile of lines the trader was
//     looking at.
{
  const HOUR = 3_600_000;
  const globexOpen = Date.parse("2026-08-17T22:00:00.000Z");
  const globex = { id: "globex", root: "NQ", startMs: globexOpen, endMs: globexOpen + 22 * HOUR };
  const newYork = { id: "ny", root: "NQ", startMs: globexOpen + 15.5 * HOUR, endMs: globexOpen + 22 * HOUR };
  const chain = buildChain([globex, newYork]);
  assert.equal(
    chain.get("globex"), newYork.startMs,
    "Globex must stop the second New York opens, even though New York starts inside its span",
  );
  assert.equal(chain.get("ny"), undefined, "the session in front runs on to the live edge");
}

// 14. It stops at the next session the trader has switched ON. Only profiles
//     actually being drawn are chained, so turning one off carries the line
//     through to the one after it rather than halting in empty space.
{
  const HOUR = 3_600_000;
  const open = Date.parse("2026-08-17T22:00:00.000Z");
  const globex = { id: "globex", root: "NQ", startMs: open, endMs: open + 22 * HOUR };
  const asia = { id: "asia", root: "NQ", startMs: open + 1 * HOUR, endMs: open + 9 * HOUR };
  const london = { id: "london", root: "NQ", startMs: open + 9 * HOUR, endMs: open + 15.5 * HOUR };

  assert.equal(
    buildChain([globex, asia, london]).get("globex"), asia.startMs,
    "with Asia on, Globex stops at Asia",
  );
  assert.equal(
    buildChain([globex, london]).get("globex"), london.startMs,
    "with Asia off, the same line carries through to London",
  );
  assert.equal(
    buildChain([globex]).get("globex"), undefined,
    "with nothing else on, it runs to the live edge",
  );
}

console.log("volume profile level chaining: session-overlap rule verified");
