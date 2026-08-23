/**
 * Point a chart at its live edge and then pin the price scale.
 *
 * The price range is recomputed by the charting library during its OWN render
 * pass, not synchronously when the visible range is set. Pinning autoScale on
 * the very next animation frame therefore RACED that render: when our frame
 * won, the range that got frozen was the one measured for the PREVIOUS
 * visible range - the entire loaded history - and because autoScale was now
 * off, nothing ever recovered it.
 *
 * On a five-day 5m NQ chart the loaded history spans roughly ten times the
 * price range of the 140 bars actually on screen, which is why the chart
 * opened with its candles squashed into a thin band and the volume profiles
 * stretched over the full pane height.
 *
 * The range change is awaited before pinning, with a frame budget so a range
 * that was already correct - which fires no event at all - still settles.
 */

export type ViewportTimeScale = {
  fitContent: () => void;
  setVisibleLogicalRange: (range: { from: number; to: number }) => void;
  subscribeVisibleLogicalRangeChange: (handler: () => void) => void;
  unsubscribeVisibleLogicalRangeChange: (handler: () => void) => void;
};

export type ViewportPriceScale = {
  applyOptions: (options: { autoScale: boolean }) => void;
};

export type ChartViewportResetArgs = {
  timeScale: ViewportTimeScale;
  priceScale: ViewportPriceScale;
  candleCount: number;
  visibleCandleCount: number;
  rightPadding: number;
  onSettled?: () => void;
  /** Injectable for tests; defaults to the browser's frame scheduler. */
  requestFrame?: (callback: () => void) => number;
  cancelFrame?: (handle: number) => void;
  /**
   * Frames to wait before pinning regardless. Four is past any single render
   * without being a delay anyone can see.
   */
  settleFrameBudget?: number;
};

/** Cancels an in-flight reset. Safe to call more than once. */
export type CancelViewportReset = () => void;

export function resetChartViewport(args: ChartViewportResetArgs): CancelViewportReset {
  const {
    timeScale,
    priceScale,
    candleCount,
    visibleCandleCount,
    rightPadding,
    onSettled,
    requestFrame = (callback: () => void) => window.requestAnimationFrame(callback),
    cancelFrame = (handle: number) => window.cancelAnimationFrame(handle),
    settleFrameBudget = 4,
  } = args;

  priceScale.applyOptions({ autoScale: true });

  let cancelled = false;
  let settled = false;
  let frame: number | null = null;

  const detach = () => {
    if (frame !== null) {
      cancelFrame(frame);
      frame = null;
    }
    try {
      timeScale.unsubscribeVisibleLogicalRangeChange(onRangeApplied);
    } catch {
      // The chart may already be disposed; there is nothing to detach from.
    }
  };

  const settle = () => {
    if (cancelled || settled) return;
    settled = true;
    detach();
    priceScale.applyOptions({ autoScale: false });
    onSettled?.();
  };

  // One frame AFTER the range lands, so the library has painted with it and
  // the price scale reflects the bars actually on screen.
  function onRangeApplied() {
    if (cancelled || settled) return;
    if (frame !== null) cancelFrame(frame);
    frame = requestFrame(() => {
      frame = requestFrame(settle);
    });
  }

  timeScale.subscribeVisibleLogicalRangeChange(onRangeApplied);

  if (candleCount <= visibleCandleCount) {
    timeScale.fitContent();
  } else {
    timeScale.setVisibleLogicalRange({
      from: Math.max(0, candleCount - visibleCandleCount),
      to: candleCount + rightPadding,
    });
  }

  // Setting a range identical to the current one fires nothing, so the pin
  // must not be left waiting on an event that will never arrive.
  let remaining = Math.max(1, Math.floor(settleFrameBudget));
  const guard = () => {
    if (cancelled || settled) return;
    remaining -= 1;
    if (remaining <= 0) {
      settle();
      return;
    }
    requestFrame(guard);
  };
  requestFrame(guard);

  return () => {
    if (cancelled) return;
    cancelled = true;
    detach();
  };
}
