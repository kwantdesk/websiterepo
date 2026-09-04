import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "@/lib/lightweightChartsCompat";
import { chartCandleBodyWidth } from "@/lib/chartBarWidth";

export type BigBlockRenderZone = {
  id: string;
  startTime: Time;
  endTime: Time;
  top: number;
  bottom: number;
  side: "ASK" | "BID";
  /** Bars projected beyond the final time coordinate already on the chart. */
  extensionBars?: number;
};

export type BigBlocksPrimitiveOptions = {
  askColor: string;
  bidColor: string;
  opacity: number;
  lineWidth: number;
};

const DEFAULT_OPTIONS: BigBlocksPrimitiveOptions = {
  askColor: "#22C55E",
  bidColor: "#EF4444",
  opacity: 1,
  lineWidth: 1,
};

class BigBlocksRenderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: BigBlocksPrimitive) {}

  draw(target: CanvasRenderingTarget2D) {
    const params = this.primitive.params();
    if (!params) return;

    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const timeScale = params.chart.timeScale();
      const options = this.primitive.options();
      context.save();
      context.beginPath();
      context.rect(0, 0, mediaSize.width, mediaSize.height);
      context.clip();

      for (const zone of this.primitive.zones()) {
        const rawStartX = timeScale.timeToCoordinate(zone.startTime);
        const rawEndX = timeScale.timeToCoordinate(zone.endTime);
        const topY = params.series.priceToCoordinate(zone.top);
        const bottomY = params.series.priceToCoordinate(zone.bottom);
        if (rawStartX === null || rawEndX === null || topY === null || bottomY === null) continue;

        // A zone COVERS its bars; it does not run centre-to-centre.
        //
        // timeToCoordinate returns the MIDDLE of a bar, so a block that starts
        // and ends on the same bar — which every block does the moment it
        // prints — measured zero pixels wide and was clamped to a 2px sliver.
        // It then appeared to grow as the zone reached further bars. Widening
        // by half a candle body at each end gives a fresh block the full
        // standard bar width immediately, and a multi-bar block covers its
        // first and last bars completely instead of stopping at their centres.
        const bodyWidth = chartCandleBodyWidth(Number(timeScale.options().barSpacing));
        const halfBody = bodyWidth / 2;
        const left = Math.min(rawStartX, rawEndX) - halfBody;
        const right = Math.max(rawStartX, rawEndX) + halfBody
          + Math.max(0, Number(zone.extensionBars ?? 0)) * Number(timeScale.options().barSpacing);
        const top = Math.min(topY, bottomY);
        const bottom = Math.max(topY, bottomY);
        if (right < 0 || left > mediaSize.width || bottom < 0 || top > mediaSize.height) continue;

        const color = zone.side === "ASK" ? options.askColor : options.bidColor;
        // Never thinner than one candle: that is the standard width a block is
        // supposed to print at.
        const width = Math.max(bodyWidth, right - left);
        const height = Math.max(2, bottom - top);
        context.save();
        context.globalAlpha = options.opacity;
        context.fillStyle = color;
        context.fillRect(left, top, width, height);
        if (options.lineWidth > 0) {
          context.globalAlpha = Math.min(1, options.opacity + 0.35);
          context.strokeStyle = color;
          context.lineWidth = options.lineWidth;
          context.strokeRect(left + 0.5, top + 0.5, Math.max(1, width - 1), Math.max(1, height - 1));
        }
        context.restore();
      }

      context.restore();
    });
  }
}

class BigBlocksView implements ISeriesPrimitivePaneView {
  private readonly rendererInstance: BigBlocksRenderer;

  constructor(primitive: BigBlocksPrimitive) {
    this.rendererInstance = new BigBlocksRenderer(primitive);
  }

  zOrder() {
    // Native underlay: blocks are painted before the candlestick series.
    return "bottom" as const;
  }

  renderer() {
    return this.rendererInstance;
  }
}

export class BigBlocksPrimitive implements ISeriesPrimitive<Time> {
  private attachedParams: SeriesAttachedParameter<Time> | null = null;
  private renderZones: BigBlockRenderZone[] = [];
  private renderOptions = DEFAULT_OPTIONS;
  private readonly paneView = new BigBlocksView(this);

  attached(param: SeriesAttachedParameter<Time>) {
    this.attachedParams = param;
    param.requestUpdate();
  }

  detached() {
    this.attachedParams = null;
  }

  update(zones: BigBlockRenderZone[], options: BigBlocksPrimitiveOptions) {
    this.renderZones = zones;
    this.renderOptions = options;
    this.attachedParams?.requestUpdate();
  }

  params() {
    return this.attachedParams;
  }

  zones() {
    return this.renderZones;
  }

  options() {
    return this.renderOptions;
  }

  paneViews() {
    return [this.paneView];
  }
}
