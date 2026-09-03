import assert from "node:assert/strict";

import {
  buildMagnetCandles,
  createMagnetResolver,
  magnetRadiusPx,
  nearestCandleMagnetCandidate,
} from "../src/lib/chartMagnet.ts";

const candle = (time, o, h, l, c, x, yFor) => ([
  { key: `${time}:open`, time, price: o, x, y: yFor(o) },
  { key: `${time}:high`, time, price: h, x, y: yFor(h) },
  { key: `${time}:low`, time, price: l, x, y: yFor(l) },
  { key: `${time}:close`, time, price: c, x, y: yFor(c) },
]);

// Price 100 -> y 300, price 110 -> y 200 (10px per point, inverted).
const yFor = (price) => 300 - (price - 100) * 10;
const candidates = [
  ...candle(1, 101, 110, 100, 109, 100, yFor),
  ...candle(2, 104, 106, 103, 105, 140, yFor),
  // Tight body: open 105 (y 250) and close 106 (y 240) sit 10px apart, the
  // near-tie that used to make anchors flip on sub-pixel movement.
  ...candle(3, 105, 107, 104, 106, 200, yFor),
];

const highY = yFor(110); // 200
const lowY = yFor(100); // 300

// --- placement: a click near a high locks to that high ---
{
  const magnet = createMagnetResolver();
  const hit = magnet.resolve({
    x: 102, y: highY + 3, timestampMs: 0, mode: "medium", intent: "place", candidates,
  });
  assert.ok(hit, "a click within the radius must lock");
  assert.equal(hit.price, 110, "click near the high locks to the high");

  const low = magnet.resolve({
    x: 101, y: lowY - 2, timestampMs: 10, mode: "medium", intent: "place", candidates,
  });
  assert.equal(low.price, 100, "a following click near the low locks to the low");
}

// --- placement out of range follows the pointer ---
{
  const magnet = createMagnetResolver();
  const miss = magnet.resolve({
    x: 100, y: 250, timestampMs: 0, mode: "medium", intent: "place", candidates,
  });
  assert.equal(miss, null, "a click far from every candidate must not snap");
}

// --- magnet off never snaps ---
{
  const magnet = createMagnetResolver();
  assert.equal(
    magnet.resolve({ x: 100, y: highY, timestampMs: 0, mode: "off", intent: "place", candidates }),
    null,
    "mode off never snaps",
  );
}

// --- fast drag runs free, slowing down locks ---
{
  const magnet = createMagnetResolver();
  let t = 0;
  let x = 400;
  // Sweep in fast (40px per 8ms = 5 px/ms) toward the high.
  let last = null;
  for (let i = 0; i < 8; i += 1) {
    x -= 40;
    t += 8;
    last = magnet.resolve({ x, y: highY + 4, timestampMs: t, mode: "medium", intent: "drag", candidates });
  }
  assert.equal(last, null, "a fast drag must follow the pointer, not snap");

  // Ease off: 1px per 20ms = 0.05 px/ms, right beside the high.
  let slow = null;
  for (let i = 0; i < 8; i += 1) {
    t += 20;
    slow = magnet.resolve({ x: 101, y: highY + 4, timestampMs: t, mode: "medium", intent: "drag", candidates });
  }
  assert.ok(slow, "slowing down near a candidate must lock");
  assert.equal(slow.price, 110, "the slow drag locks to the high it settled on");
}

// --- stickiness: jitter around a lock must not flip to a rival candidate ---
{
  const magnet = createMagnetResolver();
  const openY = yFor(105); // 250
  // Place on the OPEN of the tight-bodied candle; close is only 10px away.
  const first = magnet.resolve({
    x: 200, y: openY + 1, timestampMs: 0, mode: "medium", intent: "place", candidates,
  });
  assert.equal(first.price, 105, "locks to the open it was placed on");

  // Drift slowly toward the close. Without stickiness the anchor flips as soon
  // as the pointer passes the midpoint; it must hold until clearly closer.
  let t = 0;
  let held = first;
  for (let dy = 0; dy <= 4; dy += 1) {
    t += 40; // slow enough to stay in aiming mode
    held = magnet.resolve({
      x: 200, y: openY - dy, timestampMs: t, mode: "medium", intent: "drag", candidates,
    });
  }
  assert.equal(held.price, 105, "small jitter must not flip the locked anchor");

  // Committing to the close does move the lock.
  for (let dy = 5; dy <= 9; dy += 1) {
    t += 40;
    held = magnet.resolve({
      x: 200, y: openY - dy, timestampMs: t, mode: "medium", intent: "drag", candidates,
    });
  }
  assert.equal(held.price, 106, "a decisive move still hands the lock to the rival");
}

// --- reset clears the lock ---
{
  const magnet = createMagnetResolver();
  magnet.resolve({ x: 100, y: highY, timestampMs: 0, mode: "medium", intent: "place", candidates });
  magnet.reset();
  const after = magnet.resolve({
    x: 100, y: highY + 200, timestampMs: 0, mode: "medium", intent: "place", candidates,
  });
  assert.equal(after, null, "reset drops the held lock");
}

// --- radii are ordered by strength ---
assert.ok(magnetRadiusPx("weak") < magnetRadiusPx("medium"));
assert.ok(magnetRadiusPx("medium") < magnetRadiusPx("strong"));

// --- each placement click resolves afresh instead of inheriting a stale lock ---
{
  const magnet = createMagnetResolver();
  const closeTargets = [
    { key: "left:high", time: 1, price: 110, x: 100, y: highY },
    { key: "right:high", time: 2, price: 110, x: 110, y: highY },
  ];
  const first = magnet.resolve({
    x: 100, y: highY, timestampMs: 0, mode: "medium", intent: "place", candidates: closeTargets,
  });
  assert.equal(first.key, "left:high");
  const second = magnet.resolve({
    x: 106, y: highY, timestampMs: 10, mode: "medium", intent: "place", candidates: closeTargets,
  });
  assert.equal(second.key, "right:high", "a new click must choose its own nearest candle level");
}

// --- visually nearest adjacent wick wins, not merely nearest timestamp ---
{
  const compressed = [
    { time: 10, open: 100, high: 102, low: 98, close: 101, volume: 1 },
    { time: 11, open: 109, high: 110, low: 108, close: 109, volume: 1 },
  ];
  const hit = nearestCandleMagnetCandidate({
    candles: compressed,
    pointerTime: 10,
    x: 108,
    y: yFor(110),
    radiusPx: 18,
    toX: (time) => time === 10 ? 100 : 110,
    toY: yFor,
  });
  assert.equal(hit?.key, "11:high", "the closest wick on screen must win across neighbouring bars");
}

// --- event bars sharing one source second keep distinct display columns ---
{
  const source = [100, 350, 900].map((offset, index) => ({
    timestamp: 1_000_000 + offset,
    open: 100 + index,
    high: 101 + index,
    low: 99 + index,
    close: 100.5 + index,
    volume: 10,
  }));
  assert.deepEqual(
    buildMagnetCandles(source, true).map((entry) => entry.time),
    [1000, 1001, 1002],
    "event-bar magnet coordinates must match the chart's unique monotonic times",
  );
  assert.deepEqual(
    buildMagnetCandles(source, false).map((entry) => entry.time),
    [1000, 1000, 1000],
    "ordinary time bars retain their natural timestamp mapping",
  );
}

console.log("Chart magnet snap, multi-candle accuracy, event timing and stickiness tests passed.");
