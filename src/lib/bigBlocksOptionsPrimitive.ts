import type { ISeriesPrimitive, ISeriesPrimitivePaneRenderer, ISeriesPrimitivePaneView, SeriesAttachedParameter, Time } from "./lightweightChartsCompat";
import type { BigOptionsLevel, BigOptionsSettings } from "./bigBlocksOptions";

export type BigOptionsFrame = { levels: BigOptionsLevel[]; settings: BigOptionsSettings; callColor: string; putColor: string; textColor: string; fontFamily: string; status: string };
// Native primitives repaint on every pan sample; never construct Intl in draw.
const compactFormatter = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
export function bigOptionsBarLayout(frame: BigOptionsFrame, width: number, height: number, coordinate: (price: number) => number | null) {
  const mapped = frame.levels.map(level => ({ level, y: coordinate(level.price) }))
    .filter((entry): entry is { level: BigOptionsLevel; y: number } => entry.y !== null && entry.y >= 0 && entry.y <= height);
  const maximum = Math.max(1, ...mapped.flatMap(({ level }) => [level.call, level.put]));
  const capacity = Math.min(frame.settings.widthPx, Math.max(0, width - 16));
  mapped.sort((a, b) => a.y - b.y);
  return mapped.map(({ level, y }, index) => {
    const gap = Math.min(index ? y - mapped[index - 1].y : Infinity,
      index + 1 < mapped.length ? mapped[index + 1].y - y : Infinity);
    return { level, y, height: Math.max(1, Math.min(frame.settings.barHeight, gap * 0.8)), right: width - 4,
      callWidth: capacity * level.call / maximum, putWidth: capacity * level.put / maximum };
  });
}
class Renderer implements ISeriesPrimitivePaneRenderer {
  private primitive: BigBlocksOptionsPrimitive;
  constructor(primitive: BigBlocksOptionsPrimitive) { this.primitive = primitive; }
  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const frame = this.primitive.frame;
    const params = this.primitive.params;
    if (!frame || !params) return;
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, mediaSize.width, mediaSize.height); ctx.clip();
      ctx.font = `10px ${frame.fontFamily}`;
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      for (const bar of bigOptionsBarLayout(frame, mediaSize.width, mediaSize.height, price => params.series.priceToCoordinate(price))) {
        const half = bar.height / 2;
        ctx.globalAlpha = frame.settings.opacity / 100;
        ctx.fillStyle = frame.callColor;
        if (bar.callWidth > 0) ctx.fillRect(bar.right - bar.callWidth, bar.y - half, bar.callWidth, Math.max(0.5, half - 0.5));
        ctx.fillStyle = frame.putColor;
        if (bar.putWidth > 0) ctx.fillRect(bar.right - bar.putWidth, bar.y + 0.5, bar.putWidth, Math.max(0.5, half - 0.5));
        if (frame.settings.showValues && bar.height >= 10) {
          ctx.globalAlpha = 1; ctx.fillStyle = frame.textColor;
          const compact = (value: number) => compactFormatter.format(value);
          const prefix = frame.settings.sizeByPremium ? "$" : "";
          const label = [bar.level.call ? `C ${prefix}${compact(bar.level.call)}` : "", bar.level.put ? `P ${prefix}${compact(bar.level.put)}` : ""].filter(Boolean).join(" · ");
          ctx.fillText(label, bar.right - Math.max(bar.callWidth, bar.putWidth) - 5, bar.y);
        }
      }
      // Disclosure remains visible even when no qualifying executions exist.
      ctx.globalAlpha = 1; ctx.fillStyle = frame.textColor; ctx.textBaseline = "bottom";
      ctx.fillText(`Big Blocks (Options) · ${frame.status}`, mediaSize.width - 8, mediaSize.height - 8, Math.max(1, mediaSize.width - 16));
      ctx.restore();
    });
  }
}
class View implements ISeriesPrimitivePaneView {
  private rendererInstance: Renderer;
  constructor(primitive: BigBlocksOptionsPrimitive) { this.rendererInstance = new Renderer(primitive); }
  zOrder() { return "top" as const; }
  renderer() { return this.rendererInstance; }
}
export class BigBlocksOptionsPrimitive implements ISeriesPrimitive<Time> {
  params: SeriesAttachedParameter<Time> | null = null;
  frame: BigOptionsFrame | null = null;
  private view = new View(this);
  attached(params: SeriesAttachedParameter<Time>) { this.params = params; params.requestUpdate(); }
  detached() { this.params = null; this.frame = null; }
  update(frame: BigOptionsFrame) { this.frame = frame; this.params?.requestUpdate(); }
  paneViews() { return this.frame ? [this.view] : []; }
}
