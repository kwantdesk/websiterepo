import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { ISeriesPrimitive, ISeriesPrimitivePaneView, SeriesAttachedParameter, Time, Logical } from "./lightweightChartsCompat";
import type { AuctionGapPlotModel } from "./auctionGapPlot";

/** Chart-owned projection on every draw: no React viewport timer or DOM overlay. */
export class AuctionGapPrimitive implements ISeriesPrimitive<Time> {
  private attachment: SeriesAttachedParameter<Time> | null = null;
  private models: readonly AuctionGapPlotModel[] = [];
  private readonly views: ISeriesPrimitivePaneView[] = [
    { zOrder: () => "bottom", renderer: () => ({ draw: target => this.draw(target, false) }) },
    { zOrder: () => "top", renderer: () => ({ draw: target => this.draw(target, true) }) },
  ];
  attached(attachment: SeriesAttachedParameter<Time>) { this.attachment = attachment; }
  detached() { this.attachment = null; this.models = []; }
  update(models: readonly AuctionGapPlotModel[]) { this.models = models; this.attachment?.requestUpdate(); }
  paneViews() { return this.views; }
  private draw(target: CanvasRenderingTarget2D, markers: boolean) {
    const attachment = this.attachment;
    if (!attachment || !this.models.length) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const scale = attachment.chart.timeScale();
      context.save();
      try {
        context.beginPath(); context.rect(0, 0, mediaSize.width, mediaSize.height); context.clip();
        for (const model of this.models) {
          if (markers ? !model.showMarker : !model.showZone) continue;
          const x = scale.logicalToCoordinate(model.startLogical as Logical);
          if (x === null || !Number.isFinite(x)) continue;
          context.globalAlpha = model.opacity; context.strokeStyle = model.color;
          context.fillStyle = model.color; context.lineWidth = model.lineWidth; context.setLineDash([]);
          if (markers) {
            const y = attachment.series.priceToCoordinate(model.markerPrice), r = model.markerSize / 2;
            if (y === null || !Number.isFinite(y) || x + r < 0 || x - r > mediaSize.width) continue;
            context.beginPath(); context.moveTo(x, y - r); context.lineTo(x + r, y);
            context.lineTo(x, y + r); context.lineTo(x - r, y); context.closePath(); context.fill();
          } else {
            const right = scale.logicalToCoordinate(model.endLogical as Logical);
            const high = attachment.series.priceToCoordinate(model.high), low = attachment.series.priceToCoordinate(model.low);
            if (right === null || high === null || low === null || ![right, high, low].every(Number.isFinite)) continue;
            const left = Math.min(x, right), width = Math.max(model.lineWidth, Math.abs(right - x));
            if (left + width < 0 || left > mediaSize.width) continue;
            const top = Math.min(high, low), height = Math.max(model.lineWidth, Math.abs(low - high));
            context.fillRect(left, top, width, height); context.strokeRect(left, top, width, height);
          }
        }
      } finally { context.restore(); }
    });
  }
}
