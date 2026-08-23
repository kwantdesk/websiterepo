import assert from "node:assert/strict";
import { resetChartViewport } from "../src/lib/chartViewportReset.ts";

/**
 * The price scale must not be pinned before the chart has painted the range
 * it is being pinned to.
 *
 * The library recomputes the price range during its OWN render pass, not when
 * setVisibleLogicalRange is called. Pinning autoScale on the next animation
 * frame raced that render: win the race and the frozen range is the one
 * measured for the WHOLE loaded history, and with autoScale now off nothing
 * recovers it. On a five-day 5m NQ chart that is about ten times the span of
 * the 140 bars on screen - candles squashed into a band, profiles stretched
 * over the full pane.
 */
function harness({ fireRangeChange = true } = {}) {
  const frames = [];
  const calls = [];
  let handler = null;
  const timeScale = {
    fitContent: () => calls.push("fitContent"),
    setVisibleLogicalRange: (range) => {
      calls.push(`range:${range.from}-${range.to}`);
      // The library dispatches this from its render, never synchronously.
      if (fireRangeChange) frames.push(() => handler?.());
    },
    subscribeVisibleLogicalRangeChange: (fn) => { handler = fn; calls.push("subscribe"); },
    unsubscribeVisibleLogicalRangeChange: (fn) => {
      if (handler === fn) handler = null;
      calls.push("unsubscribe");
    },
  };
  const priceScale = { applyOptions: (o) => calls.push(`autoScale:${o.autoScale}`) };
  const requestFrame = (cb) => { frames.push(cb); return frames.length; };
  const cancelFrame = (h) => { frames[h - 1] = null; };
  const runFrames = (n) => {
    for (let i = 0; i < n; i += 1) {
      const pending = frames.splice(0, frames.length);
      pending.forEach((fn) => fn && fn());
    }
  };
  return { timeScale, priceScale, requestFrame, cancelFrame, runFrames, calls,
    get handlerAttached() { return handler !== null; } };
}

// --- autoscale is enabled first, and NOT pinned in the same frame ---
{
  const h = harness();
  let settled = false;
  resetChartViewport({
    timeScale: h.timeScale, priceScale: h.priceScale,
    candleCount: 1400, visibleCandleCount: 140, rightPadding: 8,
    onSettled: () => { settled = true; },
    requestFrame: h.requestFrame, cancelFrame: h.cancelFrame,
  });
  assert.equal(h.calls[0], "autoScale:true", "autoscale must be on before the range moves");
  assert.ok(h.calls.includes("range:1260-1408"), "the live edge window is applied");
  assert.ok(!h.calls.includes("autoScale:false"), "pinning must not happen synchronously");

  // One frame is where the old code pinned. It must still be unpinned here -
  // the range event has only just been dispatched.
  h.runFrames(1);
  assert.ok(!h.calls.includes("autoScale:false"), "one frame is too early; this was the bug");
  assert.equal(settled, false);

  // After the range lands and the library has had a frame to paint it.
  h.runFrames(3);
  assert.ok(h.calls.includes("autoScale:false"), "the scale is pinned once the range is painted");
  assert.equal(settled, true, "and the caller is told");
  assert.ok(h.calls.includes("unsubscribe"), "the listener is released");
  assert.equal(h.handlerAttached, false);
}

// --- a range that fires no event still settles, via the frame budget ---
{
  const h = harness({ fireRangeChange: false });
  let settled = false;
  resetChartViewport({
    timeScale: h.timeScale, priceScale: h.priceScale,
    candleCount: 1400, visibleCandleCount: 140, rightPadding: 8,
    onSettled: () => { settled = true; },
    requestFrame: h.requestFrame, cancelFrame: h.cancelFrame,
    settleFrameBudget: 4,
  });
  h.runFrames(10);
  assert.equal(settled, true, "an unchanged range must not leave the pin waiting forever");
  assert.ok(h.calls.includes("autoScale:false"));
}

// --- it pins exactly once ---
{
  const h = harness();
  let settleCount = 0;
  resetChartViewport({
    timeScale: h.timeScale, priceScale: h.priceScale,
    candleCount: 1400, visibleCandleCount: 140, rightPadding: 8,
    onSettled: () => { settleCount += 1 },
    requestFrame: h.requestFrame, cancelFrame: h.cancelFrame,
  });
  h.runFrames(12);
  assert.equal(settleCount, 1, "the budget and the range event must not both settle it");
  assert.equal(h.calls.filter((c) => c === "autoScale:false").length, 1);
}

// --- cancelling stops it pinning at all ---
{
  const h = harness();
  let settled = false;
  const cancel = resetChartViewport({
    timeScale: h.timeScale, priceScale: h.priceScale,
    candleCount: 1400, visibleCandleCount: 140, rightPadding: 8,
    onSettled: () => { settled = true; },
    requestFrame: h.requestFrame, cancelFrame: h.cancelFrame,
  });
  cancel();
  cancel();  // idempotent
  h.runFrames(10);
  assert.equal(settled, false, "a superseded reset must not pin the scale later");
  assert.ok(!h.calls.includes("autoScale:false"));
  assert.equal(h.handlerAttached, false, "and must release its listener");
}

// --- a short history fits instead of windowing ---
{
  const h = harness();
  resetChartViewport({
    timeScale: h.timeScale, priceScale: h.priceScale,
    candleCount: 40, visibleCandleCount: 140, rightPadding: 8,
    requestFrame: h.requestFrame, cancelFrame: h.cancelFrame,
  });
  assert.ok(h.calls.includes("fitContent"));
  assert.ok(!h.calls.some((c) => c.startsWith("range:")), "no window when everything fits");
  h.runFrames(6);
  assert.ok(h.calls.includes("autoScale:false"), "and it still settles");
}

// --- a disposed chart throwing on unsubscribe must not break the pin ---
{
  const h = harness();
  h.timeScale.unsubscribeVisibleLogicalRangeChange = () => { throw new Error("disposed"); };
  let settled = false;
  resetChartViewport({
    timeScale: h.timeScale, priceScale: h.priceScale,
    candleCount: 1400, visibleCandleCount: 140, rightPadding: 8,
    onSettled: () => { settled = true; },
    requestFrame: h.requestFrame, cancelFrame: h.cancelFrame,
  });
  h.runFrames(8);
  assert.equal(settled, true, "a disposed chart must not strand the caller");
}

console.log("Chart viewport reset tests passed.");
