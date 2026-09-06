import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { ISeriesPrimitive, ISeriesPrimitivePaneView, SeriesAttachedParameter, Time } from "@/lib/lightweightChartsCompat";
import type { ShiftCandlePrimitiveModel } from "@/lib/shiftCandle";

export class ShiftCandlePrimitive implements ISeriesPrimitive<Time> {
  private attachment: SeriesAttachedParameter<Time> | null = null;
  private model: ShiftCandlePrimitiveModel | null = null;
  private readonly view: ISeriesPrimitivePaneView = {
    zOrder: () => "top",
    renderer: () => ({ draw: (target) => this.draw(target) }),
  };

  attached(attachment: SeriesAttachedParameter<Time>) { this.attachment = attachment; }
  detached() { this.attachment = null; this.model = null; }
  paneViews() { return [this.view]; }
  update(model: ShiftCandlePrimitiveModel) { this.model = model; this.attachment?.requestUpdate(); }

  private draw(target: CanvasRenderingTarget2D) {
    const attachment = this.attachment;
    const model = this.model;
    if (!attachment || !model?.signals.length) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      context.save();
      try {
        context.beginPath(); context.rect(0, 0, mediaSize.width, mediaSize.height); context.clip();
        context.lineWidth = model.lineWidth;
        for (const signal of model.signals) {
          const x = attachment.chart.timeScale().timeToCoordinate(signal.time as Time);
          const y = attachment.series.priceToCoordinate(signal.price);
          if (x === null || y === null || !Number.isFinite(x) || !Number.isFinite(y)) continue;
          const size = Math.max(3, model.lineWidth * 2 + 2);
          context.strokeStyle = signal.direction === "buy" ? model.buyColor : model.sellColor;
          context.fillStyle = signal.direction === "buy" ? model.buyColor : model.sellColor;
          context.beginPath();
          if (model.shape === "circle") context.arc(x, y, size, 0, Math.PI * 2);
          else if (model.shape === "diamond") { context.moveTo(x, y - size); context.lineTo(x + size, y); context.lineTo(x, y + size); context.lineTo(x - size, y); context.closePath(); }
          else context.rect(x - size, y - size, size * 2, size * 2);
          context.fill(); context.stroke();
        }
      } finally { context.restore(); }
    });
  }
}
