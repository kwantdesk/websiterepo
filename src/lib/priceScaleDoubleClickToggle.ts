import type { IChartApi } from "./lightweightChartsCompat";

/** Fit the visible candles once, then immediately return to manual price panning. */
export function installPriceScaleDoubleClickToggle(container: HTMLElement, chart: IChartApi, centerPrice?: () => {
  price: number;
  topInset: number;
  bottomInset: number;
  coordinateToPrice: (y: number) => number | null;
} | null): () => void {
  const handleScale = chart.options().handleScale;
  if (handleScale === false) return () => {};
  const setting = handleScale === true ? true : handleScale.axisDoubleClickReset;
  const original = typeof setting === "boolean" ? setting : { ...setting };
  const timeReset = typeof original === "boolean" ? original : original.time;
  // The engine recognises double clicks during mousedown, before DOM dblclick.
  // Disable only that native price reset: its persistent autoscale locks panning.
  chart.applyOptions({ handleScale: { axisDoubleClickReset: { price: false, time: timeReset } } });
  const view = container.ownerDocument.defaultView!;
  let fitFrame: number | null = null;
  const releaseFit = () => {
    if (fitFrame === null) return;
    view.cancelAnimationFrame(fitFrame);
    fitFrame = null;
    chart.priceScale("right").applyOptions({ autoScale: false });
  };
  const toggle = (event: MouseEvent) => {
    if (event.button !== 0) return;
    const rect = chart.chartElement().getBoundingClientRect();
    const scale = chart.priceScale("right");
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    if (scale.width() <= 0 || x < rect.width - scale.width() || x >= rect.width || y < 0 || y >= rect.height - chart.timeScale().height()) return;
    releaseFit();
    scale.applyOptions({ autoScale: true });
    // The library calculates its fitted range during its own render. Let that
    // paint land before retaining the fitted range with autoscale disabled.
    fitFrame = view.requestAnimationFrame(() => {
      fitFrame = view.requestAnimationFrame(() => {
        releaseFit();
        const anchor = centerPrice?.();
        const range = scale.getVisibleRange();
        if (!anchor || !range || !Number.isFinite(anchor.price)) return;
        // Use the current price-pane geometry, not the full chart element:
        // the time axis and docked studies are not part of the footprint.
        const plotBottom = chart.paneSize().height - anchor.bottomInset;
        if (plotBottom <= anchor.topInset) return;
        const middlePrice = anchor.coordinateToPrice((anchor.topInset + plotBottom) / 2);
        if (middlePrice === null || !Number.isFinite(middlePrice)) return;
        const delta = anchor.price - middlePrice;
        const logarithmic = scale.options().mode === 1;
        const ratio = anchor.price / middlePrice;
        if (logarithmic && (!(ratio > 0) || !Number.isFinite(ratio))) return;
        scale.setVisibleRange(logarithmic
          ? { from: range.from * ratio, to: range.to * ratio }
          : { from: range.from + delta, to: range.to + delta });
      });
    });
    event.preventDefault();
    event.stopPropagation();
  };
  container.addEventListener("dblclick", toggle, true);
  container.addEventListener("pointerdown", releaseFit, true);
  container.addEventListener("mousedown", releaseFit, true);
  container.addEventListener("wheel", releaseFit, true);
  return () => {
    releaseFit();
    container.removeEventListener("dblclick", toggle, true);
    container.removeEventListener("pointerdown", releaseFit, true);
    container.removeEventListener("mousedown", releaseFit, true);
    container.removeEventListener("wheel", releaseFit, true);
    chart.applyOptions({ handleScale: { axisDoubleClickReset: original } });
  };
}
