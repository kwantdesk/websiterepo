type Plot = {
  clientHeight: number;
  getBoundingClientRect(): { top: number; height: number };
  setPointerCapture(id: number): void;
  hasPointerCapture(id: number): boolean;
  releasePointerCapture(id: number): void;
};
type PriceScale = { options(): { autoScale: boolean }; setAutoScale(value: boolean): void };
type PriceSeries = {
  coordinateToPrice(y: number): number | null;
  priceToCoordinate(price: number): number | null;
  priceScale(): PriceScale;
};

/** A price handle must use chart pixels, retain its grab offset, and own the
 * gesture independently of its moving label. Live data may continue flowing.
 */
export function beginPaperProtectionDrag<TScroll, TScale>(
  plot: Plot,
  chart: { options(): { handleScroll: TScroll; handleScale: TScale }; applyOptions(options: { handleScroll: TScroll | false; handleScale: TScale | false }): void },
  series: PriceSeries,
  pointerId: number,
  startClientY: number,
  anchorPrice: number,
) {
  const localY = (clientY: number) => {
    const bounds = plot.getBoundingClientRect();
    return (clientY - bounds.top) * (bounds.height > 0 ? plot.clientHeight / bounds.height : 1);
  };
  const grabOffset = (series.priceToCoordinate(anchorPrice) ?? localY(startClientY)) - localY(startClientY);
  const scale = series.priceScale();
  const autoScale = scale.options().autoScale;
  const options = chart.options();
  const handleScroll = options.handleScroll;
  const handleScale = options.handleScale;
  scale.setAutoScale(false);
  chart.applyOptions({ handleScroll: false, handleScale: false });
  plot.setPointerCapture(pointerId);
  let disposed = false;
  return {
    priceAt: (clientY: number) => series.coordinateToPrice(localY(clientY) + grabOffset),
    dispose() {
      if (disposed) return;
      disposed = true;
      if (plot.hasPointerCapture(pointerId)) plot.releasePointerCapture(pointerId);
      chart.applyOptions({ handleScroll, handleScale });
      scale.setAutoScale(autoScale);
    },
  };
}
