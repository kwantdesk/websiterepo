import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const chart = readFileSync(new URL("../src/components/Chart.tsx", import.meta.url), "utf8");

/**
 * The footprint does not paint until its executions have actually arrived.
 *
 * The gate was `liveFootprintRenderBars.some((bar) => bar.hasPriceLevelFlow)`,
 * so the FIRST bar to receive price-level flow painted the whole footprint.
 * Every bar still waiting rendered as bare numbers with no cell boxes, and
 * their footers collided, because a bar with no rows never claims its width.
 * It corrected itself once the tape finished - the twenty seconds of glitching
 * that was reported.
 *
 * The repair is a coverage threshold, and the trap inside the repair is the
 * DENOMINATOR. A footprint bar builds its volume out of the executions it
 * received, so a bar still waiting for flow reports zero volume and looks
 * exactly like a bar that never traded. Measuring coverage against the
 * footprint bar therefore asks the missing data whether it is missing and
 * scores every window a perfect one - a gate that reads as strict and is
 * looser than the `.some` it replaced. Coverage is measured against the
 * CANDLE, which knows the bar traded.
 *
 * The gate lives inside a 16k-line component, so the memo body is lifted out
 * and executed here rather than asserted against as text: a source match would
 * have passed the vacuous version too.
 */

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

const THRESHOLD = (() => {
  const match = chart.match(/const FOOTPRINT_MINIMUM_FLOW_COVERAGE = ([\d.]+);/);
  assert.ok(match, "the footprint coverage threshold is gone");
  return Number(match[1]);
})();

const gate = (() => {
  const open = "const footprintHasPriceLevelFlow = useMemo(() => {";
  const start = chart.indexOf(open);
  assert.ok(start > 0, "the footprint flow gate is gone");
  const close = "\n  }, [footprintSourceCandles, liveFootprintRenderBars]);";
  const end = chart.indexOf(close, start);
  assert.ok(end > start, "the gate no longer reads the source candles");
  const body = chart
    .slice(start + open.length, end)
    // The one piece of TypeScript in the body.
    .replace(/new Map<[^>]*>\(\)/g, "new Map()");
  const fn = new Function(
    "liveFootprintRenderBars", "footprintSourceCandles", "FOOTPRINT_MINIMUM_FLOW_COVERAGE", body,
  );
  return (bars, candles) => fn(bars, candles, THRESHOLD);
})();

const T0 = 1_788_000_000_000;
/*
 * A bar with flow carries the volume of its own executions; a bar without flow
 * carries none. That is the real shape of the data and the whole reason the
 * first repair was vacuous.
 */
const bar = (minute, flow) => ({
  timestamp: T0 + minute * 60_000,
  hasPriceLevelFlow: flow,
  totalVolume: flow ? 900 : 0,
  volume: flow ? 900 : 0,
});
const candle = (minute, volume = 900) => ({ timestamp: T0 + minute * 60_000, volume });

const window = (flags, volumes) => [
  flags.map((flow, index) => bar(index, flow)),
  flags.map((_, index) => candle(index, volumes ? volumes[index] : 900)),
];

check("one bar with flow does not paint the whole footprint", () => {
  // The reported bug, exactly: twenty bars traded, one has arrived.
  const flags = Array.from({ length: 20 }, (_, index) => index === 0);
  assert.equal(gate(...window(flags)), false);
});

check("a bar still waiting for flow counts as a gap", () => {
  /*
   * The trap. These bars report zero volume because their executions have not
   * landed - the candle is the only witness that they traded. A gate that
   * measures against the footprint bar returns true here.
   */
  const [bars, candles] = window([true, true, false, false, false, false]);
  for (const empty of bars.filter((entry) => !entry.hasPriceLevelFlow)) {
    assert.equal(empty.totalVolume, 0, "the fixture no longer reproduces the trap");
  }
  assert.equal(gate(bars, candles), false, "a half-arrived footprint still paints");
});

check("a fully arrived window paints", () => {
  assert.equal(gate(...window(Array.from({ length: 12 }, () => true))), true);
});

check("a candle that never traded is not a gap", () => {
  /*
   * Quiet bars are legitimately empty. Counting them would force a threshold
   * loose enough to let a half-built chart through, which is the failure this
   * whole gate exists to stop.
   */
  const flags = [true, true, true, false, false];
  const volumes = [900, 900, 900, 0, 0];
  assert.equal(gate(...window(flags, volumes)), true);
});

check("the threshold is the thing being tested", () => {
  assert.ok(THRESHOLD > 0.5 && THRESHOLD < 1, `implausible threshold ${THRESHOLD}`);
  const size = 100;
  const atOrOver = Math.ceil(THRESHOLD * size);
  const under = atOrOver - 1;
  const flags = (covered) => Array.from({ length: size }, (_, index) => index < covered);
  assert.equal(gate(...window(flags(atOrOver))), true, "the threshold itself does not pass");
  assert.equal(gate(...window(flags(under))), false, "one bar under the threshold still paints");
});

check("nothing to draw is not readiness", () => {
  assert.equal(gate([], []), false);
});

check("with no volume anywhere it falls back to the old test", () => {
  /*
   * An instrument that publishes no volume, or history that arrived without
   * it. There is nothing to measure against, so the gate must not invent a
   * verdict in either direction.
   */
  const noVolume = (flags) => [
    flags.map((flow, index) => ({ ...bar(index, flow), totalVolume: 0, volume: 0 })),
    flags.map((_, index) => candle(index, 0)),
  ];
  assert.equal(gate(...noVolume([false, false, false])), false);
  assert.equal(gate(...noVolume([false, true, false])), true);
});

check("candles outside the footprint's window are not its gaps", () => {
  /*
   * The candle series can run wider than the bars the footprint built. Those
   * extra candles have no bar to answer for them and must not be scored.
   */
  const [bars, candles] = window(Array.from({ length: 10 }, () => true));
  const wider = [...candles, candle(50), candle(51), candle(52), candle(53)];
  assert.equal(gate(bars, wider), true, "unbuilt candles are being counted against coverage");
});

check("the gate is not the old existence test", () => {
  const source = chart.slice(chart.indexOf("const footprintHasPriceLevelFlow = useMemo"));
  assert.ok(
    !/^const footprintHasPriceLevelFlow = liveFootprintRenderBars\.some/m.test(chart),
    "the footprint gate is back to painting on the first bar that arrives",
  );
  assert.match(source.slice(0, 1400), /for \(const candle of footprintSourceCandles\)/);
});

console.log(`\nfootprint flow coverage: ${passed}/${passed} checks passed`);
