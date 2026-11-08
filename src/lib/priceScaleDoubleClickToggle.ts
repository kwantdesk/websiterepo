import type { IChartApi } from "./lightweightChartsCompat";

/** A second right-axis double click releases the auto-fit selected by the first. */
export function installPriceScaleDoubleClickToggle(container: HTMLElement, chart: IChartApi): () => void {
  const handleScale = chart.options().handleScale;
  if (handleScale === false) return () => {};
  const setting = handleScale === true ? true : handleScale.axisDoubleClickReset;
  const original = typeof setting === "boolean" ? setting : { ...setting };
  const timeReset = typeof original === "boolean" ? original : original.time;
  // The engine recognises double clicks during mousedown, before DOM dblclick.
  // Disable only that native price reset so it cannot re-lock our second click.
  chart.applyOptions({ handleScale: { axisDoubleClickReset: { price: false, time: timeReset } } });
  let locked = false;
  const toggle = (event: MouseEvent) => {
    if (event.button !== 0) return;
    const rect = chart.chartElement().getBoundingClientRect();
    const scale = chart.priceScale("right");
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    if (scale.width() <= 0 || x < rect.width - scale.width() || x >= rect.width || y < 0 || y >= rect.height - chart.timeScale().height()) return;
    // A manual reset/viewport operation may have released a previous lock.
    const unlock = locked && scale.options().autoScale;
    locked = !unlock;
    scale.applyOptions({ autoScale: locked });
    event.preventDefault();
    event.stopPropagation();
  };
  container.addEventListener("dblclick", toggle, true);
  return () => {
    container.removeEventListener("dblclick", toggle, true);
    chart.applyOptions({ handleScale: { axisDoubleClickReset: original } });
  };
}
