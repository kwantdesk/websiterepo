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
        if (candidate.id === entry.id || candidate.startMs < entry.endMs) continue;
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
  const weekly = { id: "w0", root: "NQ", startMs: T0, endMs: T0 + 5 * DAY };
  const nextWeekly = { id: "w1", root: "NQ", startMs: T0 + 7 * DAY, endMs: T0 + 12 * DAY };
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
assert.match(primitive, /candidate\.startMs < entry\.endMs/);
assert.match(primitive, /levelChainEndX/);

console.log("volume profile level chaining: 7/7 checks passed");
