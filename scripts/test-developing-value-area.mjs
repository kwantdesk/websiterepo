import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { applyInstitutionalTradesToVolumeProfile } =
  await import("../src/lib/institutionalMarketData.ts");
const { defaultIndicatorSettings } = await import("../src/lib/chartIndicatorConfig.ts");

const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");
const primitive = readFileSync(
  new URL("../src/lib/nativeVolumeProfilePrimitive.ts", import.meta.url), "utf8",
);

/**
 * The Value Area tab's "Developing" control draws something.
 *
 * It had been stored and migrated since the tab was built and read by nothing:
 * the dropdown remembered dash or solid across reloads and the chart drew
 * neither. The value area's edges were never recorded as they widened either,
 * so there was nothing for it to draw even if it had been wired.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const START = 1_700_000_000_000;

// A "custom" window, so the top-up's eligibility check is the plain one: after
// the coverage watermark and inside the window. Daily and weekly additionally
// compare CME trading dates, which is a different thing to test.
const baseProfile = () => ({
  symbol: "NQ", period: "custom", startMs: START, endMs: START + 3_600_000,
  coverageStartMs: START, coverageEndMs: START - 1,
  tickSize: 0.25, groupTicks: 4, valueAreaPercent: 68,
  minTradeVolume: 0, maxTradeVolume: 0,
  totalVolume: 0, bidVolume: 0, askVolume: 0, delta: 0, trades: 0,
  poc: null, vah: null, val: null, vwap: null, standardDeviation: 0,
  levels: [], developingPoc: [], asOf: new Date(START).toISOString(),
});

let recordIndex = 0;
const tradesAt = (minute, prices) => prices.map((price, index) => ({
  recordIndex: recordIndex += 1,
  timestamp: START + minute * 60_000 + index,
  open: price, high: price, low: price, close: price,
  trades: 1,
  volume: 10,
  bidVolume: index % 2 ? 0 : 10,
  askVolume: index % 2 ? 10 : 0,
  delta: index % 2 ? 10 : -10,
  aggressor: index % 2 ? "BUY" : "SELL",
}));

check("the widening edges are recorded minute by minute", () => {
  let profile = applyInstitutionalTradesToVolumeProfile(
    baseProfile(), tradesAt(0, [20000, 20000.25, 20000.5, 20000.25, 20000]),
  );
  const first = profile.developingValueArea;
  assert.ok(Array.isArray(first) && first.length === 1, "the first minute recorded nothing");
  assert.ok(first[0].vah >= first[0].val, "the edges came out inverted");

  profile = applyInstitutionalTradesToVolumeProfile(
    profile, tradesAt(1, [20010, 20010.25, 19990, 19990.25, 20000]),
  );
  assert.equal(profile.developingValueArea.length, 2, "the second minute did not add a sample");
  const [before, after] = profile.developingValueArea;
  assert.ok(after.timestamp > before.timestamp, "the samples are out of order");
  assert.ok(
    after.vah - after.val >= before.vah - before.val,
    "the value area narrowed as volume was added",
  );
});

check("the same minute replaces rather than stacks", () => {
  /*
   * A live batch can arrive several times inside one minute. Pushing each one
   * would grow the trail by however often the tape happened to be flushed,
   * which is a rate, not a market observation.
   */
  let profile = applyInstitutionalTradesToVolumeProfile(baseProfile(), tradesAt(0, [20000, 20000.25]));
  const firstLength = profile.developingValueArea.length;
  profile = applyInstitutionalTradesToVolumeProfile(profile, tradesAt(0, [20001, 20001.25]));
  assert.equal(profile.developingValueArea.length, firstLength, "a second flush stacked a point");
});

check("a profile that recorded nothing draws nothing", () => {
  // Historical-only profiles carry no trail. Drawing one would mean inventing
  // a shape from the finished value area.
  const profile = baseProfile();
  assert.equal(profile.developingValueArea, undefined);
  assert.match(
    primitive,
    /&& \(profile\.developingValueArea\?\.length \?\? 0\) > 1/,
    "the renderer no longer guards on an absent trail",
  );
});

check("the stored setting reaches the renderer", () => {
  assert.match(
    chart,
    /developingValueArea: String\(profileSettings\.valueAreaDeveloping\) === "dash"/,
    "the chart no longer passes the setting through",
  );
  assert.match(
    primitive,
    /const dash = style\.developingValueArea === "dash" \? \[3, 3\] : \[\];/,
    "dash and solid render the same",
  );
});

check("both edges are drawn, not just one", () => {
  // A single edge is not a value area.
  assert.match(primitive, /for \(const edge of \["vah", "val"\] as const\)/, "only one edge is drawn");
});

check("it stays off until asked for", () => {
  for (const id of ["kwant-profile", "weekly-volume-profile"]) {
    assert.equal(defaultIndicatorSettings(id)?.valueAreaDeveloping, "no", `${id} turns it on by default`);
  }
});

console.log(`\ndeveloping value area: ${passed}/${passed} checks passed`);
