import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { calculateVolumeProfileValueArea, STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT } =
  await import("../src/lib/volumeProfileMath.ts");
const { buildChartVolumeProfile } = await import("../src/lib/institutionalMarketData.ts");

/**
 * The trader's own value-area percentage, all the way to the screen.
 *
 * The server built the profile at the configured percentage and the live
 * top-up then recomputed it at the 70% convention on every batch - so a profile
 * asked for at 68% was correct until the first tick arrived and then quietly
 * widened. It also stamped `valueAreaPercent: 70` on the way out, so nothing
 * downstream could see the substitution had happened.
 *
 * POC does not move with the percentage, and the walk breaks ties upward, which
 * is why VAL and the POC agreed with DeepChart while only VAH drifted.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

/*
 * A broad, gently peaked profile.
 *
 * The walk widens two ticks at a time, so on a narrow profile a two-point
 * difference in percentage lands inside a single step and both answers agree.
 * Two hundred rows makes 2% of the total span several steps, which is where the
 * difference an intraday trader actually sees comes from.
 */
const levels = [];
for (let tick = 0; tick < 200; tick += 1) {
  const distance = Math.abs(tick - 90);
  levels.push({ price: 20000 + tick * 0.25, volume: Math.max(40, 300 - distance * 1.2) });
}

check("a wider percentage cannot narrow the value area", () => {
  const narrow = calculateVolumeProfileValueArea(levels, 0.25, 68);
  const wide = calculateVolumeProfileValueArea(levels, 0.25, 70);
  assert.ok(narrow.vah !== null && wide.vah !== null, "no value area was produced");
  assert.ok(wide.vah >= narrow.vah, "70% produced a lower VAH than 68%");
  assert.ok(wide.val <= narrow.val, "70% produced a higher VAL than 68%");
});

check("the percentage actually changes the answer", () => {
  /*
   * If it did not, the substitution would have been harmless and there would be
   * nothing to fix. It is not harmless.
   */
  const at68 = calculateVolumeProfileValueArea(levels, 0.25, 68);
  const at70 = calculateVolumeProfileValueArea(levels, 0.25, 70);
  assert.notDeepEqual(
    [at68.vah, at68.val],
    [at70.vah, at70.val],
    "68% and 70% produced an identical value area on a profile built to separate them",
  );
});

check("the POC is the same either way", () => {
  // Which is exactly why POC and VAL agreed while VAH did not.
  const at68 = calculateVolumeProfileValueArea(levels, 0.25, 68);
  const at70 = calculateVolumeProfileValueArea(levels, 0.25, 70);
  assert.equal(at68.poc, at70.poc);
});

check("the live top-up uses the profile's own percentage", () => {
  const source = readFileSync(
    new URL("../src/lib/institutionalMarketData.ts", import.meta.url), "utf8",
  );
  const start = source.indexOf("export function applyInstitutionalTradesToVolumeProfile");
  const body = source.slice(start, source.indexOf("\nexport ", start + 10));
  assert.match(
    body,
    /const activeValueAreaPercent = Number\(profile\.valueAreaPercent\) > 0/,
    "the top-up does not read the profile's configured percentage",
  );
  assert.match(body, /calculateVolumeProfileValueArea\(\s*\n\s*nextLevels,\s*\n\s*profile\.tickSize \* profile\.groupTicks,\s*\n\s*activeValueAreaPercent,/);
  assert.match(body, /valueAreaPercent: activeValueAreaPercent,/, "the profile still reports the standard");
  // The literal must not be what the recompute is driven by any more.
  const recompute = body.slice(body.indexOf("const valueArea = calculateVolumeProfileValueArea"));
  assert.ok(
    !recompute.slice(0, 260).includes("STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT"),
    "the recompute still passes the 70% convention",
  );
});

check("the fetch keeps the percentage the profile was built at", () => {
  /*
   * The fix above was defeated one layer up. The client asked the route for
   * 68%, got a profile computed at 68% back, then recomputed the value area at
   * the 70% constant and stamped 70 on the way out - so the setting was
   * discarded on arrival, and the live top-up read that stamp and carried the
   * substitution forward for the rest of the session.
   */
  const source = readFileSync(
    new URL("../src/lib/institutionalMarketData.ts", import.meta.url), "utf8",
  );
  const start = source.indexOf("export async function fetchInstitutionalVolumeProfile");
  assert.ok(start > 0, "the profile fetch is gone");
  const body = source.slice(start, source.indexOf(`${String.fromCharCode(10)}export `, start + 10));
  assert.match(
    body,
    /const responseValueAreaPercent = Number\(payload\.valueAreaPercent\) > 0/,
    "the fetch no longer reads the percentage the profile was built at",
  );
  assert.match(body, /valueAreaPercent: responseValueAreaPercent,/, "the response is stamped with the convention again");
  const recompute = body.slice(body.indexOf("const valueArea = calculateVolumeProfileValueArea"));
  assert.ok(
    !recompute.slice(0, 260).includes("STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT"),
    "the fetch still recomputes the value area at 70%",
  );
  // The request itself must still carry what the trader asked for.
  assert.match(body, /valueAreaPercent: String\(askedValueAreaPercent\)/, "the request no longer sends the setting");
});

check("the candle-volume fallback honours the configured percentage", () => {
  const profile = buildChartVolumeProfile({
    candles: [{
      timestamp: 1_000,
      open: 100,
      high: 104,
      low: 100,
      close: 103,
      volume: 100,
    }],
    root: "TEST",
    contractSymbol: "TEST",
    startMs: 0,
    endMs: 2_000,
    tickSize: 1,
    valueAreaPercent: 68,
  });
  assert.ok(profile);
  assert.equal(profile.valueAreaPercent, 68, "the fallback silently reset the trader to 70%");
});

check("an absent percentage still falls back to the convention", () => {
  // Old cached profiles carry no percentage; they must not compute at zero.
  assert.equal(STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT, 70);
  const source = readFileSync(
    new URL("../src/lib/institutionalMarketData.ts", import.meta.url), "utf8",
  );
  assert.match(source, /: STANDARD_VOLUME_PROFILE_VALUE_AREA_PERCENT;/, "there is no fallback");
});

console.log(`\nvalue area percent: ${passed}/${passed} checks passed`);
