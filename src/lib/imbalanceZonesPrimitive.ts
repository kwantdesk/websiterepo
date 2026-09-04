import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "@/lib/lightweightChartsCompat";
import { imbalanceZoneHorizontalBounds } from "@/lib/imbalanceZoneGeometry";

/**
 * One imbalance zone in PRICE/TIME space. The renderer projects it every frame
 * through the chart's own scales, so the zones stay welded to their candles
 * during a pan or zoom.
 *
 * The previous implementation positioned these zones in a React SVG keyed on a
 * throttled viewport counter: React repainted on its own schedule while the
 * candles moved at frame rate, so the boxes visibly swam around the chart
 * whenever the trader dragged it. A series primitive shares the chart's
 * transform and cannot drift.
 */
export type ImbalanceZoneModel = {
  id: string;
  /** Chart time of the bar that formed the zone. */
  startTime: Time;
  /** Chart time the zone runs to (extension, reset boundary or trigger). */
  endTime: Time;
  top: number;
  bottom: number;
  color: string;
  /** 0..1 — applied identically to every zone, fresh or triggered. */
  opacity: number;
  lineWidth: number;
  /** Configured extension that currently falls beyond the loaded series. */
  futureBars: number;
};

class ImbalanceZonesRenderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: ImbalanceZonesPrimitive) {}

  draw(target: CanvasRenderingTarget2D) {
    const chart = this.primitive.chart();
    const series = this.primitive.series();
    const zones = this.primitive.zones();
    if (!chart || !series || !zones.length) return;

    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const timeScale = chart.timeScale();
      context.save();
      context.beginPath();
      context.rect(0, 0, mediaSize.width, mediaSize.height);
      context.clip();

      for (const zone of zones) {
        const startX = timeScale.timeToCoordinate(zone.startTime);
        const endX = timeScale.timeToCoordinate(zone.endTime);
        const topY = series.priceToCoordinate(zone.top);
        const bottomY = series.priceToCoordinate(zone.bottom);
        if (startX === null || endX === null || topY === null || bottomY === null) continue;

        const { left, width } = imbalanceZoneHorizontalBounds(
          Number(startX),
          Number(endX),
          zone.futureBars,
          Number(timeScale.options().barSpacing ?? 1),
        );
        const top = Math.min(Number(topY), Number(bottomY));
        const height = Math.max(2, Math.abs(Number(bottomY) - Number(topY)));
        if (left > mediaSize.width || left + width < 0) continue;

        // Every zone is drawn identically — solid outline, same fill weight,
        // same opacity. Fresh and triggered differ ONLY by their configured
        // colour, never by a dashed stroke or a faded rectangle.
        // Deep Charts' opacity is the actual zone-fill opacity. The old
        // hidden 14% multiplier meant even a selected 100% rendered as 14%,
        // which made stock zones effectively invisible on several themes.
        context.globalAlpha = zone.opacity;
        context.fillStyle = zone.color;
        context.fillRect(left, top, width, height);

        context.globalAlpha = zone.opacity;
        context.strokeStyle = zone.color;
        context.lineWidth = zone.lineWidth;
        context.setLineDash([]);
        context.strokeRect(
          left + zone.lineWidth / 2,
          top + zone.lineWidth / 2,
          Math.max(1, width - zone.lineWidth),
          Math.max(1, height - zone.lineWidth),
        );
      }

      context.restore();
    });
  }
}

class ImbalanceZonesView implements ISeriesPrimitivePaneView {
  private readonly zonesRenderer: ImbalanceZonesRenderer;

  constructor(primitive: ImbalanceZonesPrimitive) {
    this.zonesRenderer = new ImbalanceZonesRenderer(primitive);
  }

  zOrder() {
    return "bottom" as const;
  }

  renderer() {
    return this.zonesRenderer;
  }
}

export class ImbalanceZonesPrimitive implements ISeriesPrimitive<Time> {
  private chartApi: SeriesAttachedParameter<Time>["chart"] | null = null;
  private candleSeries: SeriesAttachedParameter<Time>["series"] | null = null;
  private requestRedraw: (() => void) | null = null;
  private renderZones: ImbalanceZoneModel[] = [];
  private readonly zonesView = new ImbalanceZonesView(this);

  attached(param: SeriesAttachedParameter<Time>) {
    this.chartApi = param.chart;
    this.candleSeries = param.series;
    this.requestRedraw = param.requestUpdate;
  }

  detached() {
    this.chartApi = null;
    this.candleSeries = null;
    this.requestRedraw = null;
    this.renderZones = [];
  }

  update(zones: ImbalanceZoneModel[]) {
    this.renderZones = zones;
    this.requestRedraw?.();
  }

  chart() {
    return this.chartApi;
  }

  series() {
    return this.candleSeries;
  }

  zones() {
    return this.renderZones;
  }

  paneViews() {
    return [this.zonesView];
  }
}
