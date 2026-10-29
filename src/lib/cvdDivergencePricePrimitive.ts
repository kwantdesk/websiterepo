import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { ISeriesPrimitive, ISeriesPrimitivePaneRenderer, ISeriesPrimitivePaneView, SeriesAttachedParameter, Time } from "@/lib/lightweightChartsCompat";
import type { CvdDivergenceSegment } from "@/lib/cvdDivergence";

export type CvdDivergencePriceModel = {
  segments: readonly CvdDivergenceSegment[];
  bullishColor: string;
  bearishColor: string;
  backgroundColor: string;
  lineWidth: number;
};

/** Projects immutable time/price anchors in the candle canvas's own paint pass. */
export class CvdDivergencePricePrimitive implements ISeriesPrimitive<Time> {
  private params: SeriesAttachedParameter<Time> | null = null;
  private models: readonly CvdDivergencePriceModel[] = [];
  private readonly renderer: ISeriesPrimitivePaneRenderer = { draw: target => this.draw(target) };
  private readonly view: ISeriesPrimitivePaneView = {
    zOrder: () => "top",
    renderer: () => this.renderer,
  };

  attached(params: SeriesAttachedParameter<Time>) { this.params = params; params.requestUpdate(); }
  detached() { this.params = null; }
  update(models: readonly CvdDivergencePriceModel[]) {
    this.models = models;
    this.params?.requestUpdate();
  }
  paneViews() { return this.models.some(model => model.segments.length) ? [this.view] : []; }

  private draw(target: CanvasRenderingTarget2D) {
    const params = this.params;
    if (!params) return;
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const scale = params.chart.timeScale();
      const visible = scale.getVisibleRange?.();
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, mediaSize.width, mediaSize.height);
      ctx.clip();
      for (const model of this.models) for (const segment of model.segments) {
        if (visible && typeof visible.from === "number" && typeof visible.to === "number"
          && (segment.toTime < visible.from || segment.fromTime > visible.to)) continue;
        const x1 = scale.timeToCoordinate(segment.fromTime as Time);
        const x2 = scale.timeToCoordinate(segment.toTime as Time);
        const y1 = params.series.priceToCoordinate(segment.fromPrice);
        const y2 = params.series.priceToCoordinate(segment.toPrice);
        if (x1 == null || x2 == null || y1 == null || y2 == null) continue;
        if (![x1, x2, y1, y2].every(Number.isFinite)) continue;
        if (Math.max(x1, x2) < 0 || Math.min(x1, x2) > mediaSize.width
          || Math.max(y1, y2) < 0 || Math.min(y1, y2) > mediaSize.height) continue;
        const color = segment.kind === "bullish" ? model.bullishColor : model.bearishColor;
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, Math.min(4, model.lineWidth));
        ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        for (const [x, y] of [[x1, y1], [x2, y2]]) {
          ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
        }
        const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
        ctx.fillStyle = model.backgroundColor;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(midX - 17, midY - 19, 34, 13, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = "700 8px 'Aleph', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillText("CVD", midX, midY - 9.5);
      }
      ctx.restore();
    });
  }
}
