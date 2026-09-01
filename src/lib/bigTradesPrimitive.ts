import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "@/lib/lightweightChartsCompat";

export type BigTradePrimitiveMarker = {
  id: string;
  time: Time;
  price: number;
  volume: number;
  executions: number;
  side: "ASK" | "BID";
  radius: number;
  opacity: number;
  /*
   * Where this print's level stops, resolved against the candles by the
   * caller: the first later bar that CLOSED through the price. Undefined means
   * nothing has closed through it yet, so the level is still live and runs to
   * the right edge.
   */
  projectionEndTime?: Time | null;
};

export type BigTradesPrimitiveOptions = {
  askColor: string;
  bidColor: string;
  markerType: "circle" | "square" | "diamond" | "text";
  hollowFill: boolean;
  informationMode: "volume" | "side-volume" | "executions" | "full";
  showLabels: boolean;
  labelMinSize: number;
  textColor: string;
  backgroundColor: string;
  /*
   * A large print leaves a level, not just a dot.
   *
   * The study marked where size traded and stopped there, so the price it
   * happened at - the thing you actually trade against later - had to be eyed
   * off the marker. The level is projected forward from the print and stays on
   * the chart until a bar closes through it, at which point it has been
   * resolved and stops.
   */
  showProjection: boolean;
  projectionLineWidth: number;
  projectionLineStyle: "solid" | "dashed" | "dotted";
  projectionOpacity: number;
};

const DEFAULT_OPTIONS: BigTradesPrimitiveOptions = {
  askColor: "#B6FF00",
  bidColor: "#FFFFFF",
  markerType: "circle",
  hollowFill: false,
  informationMode: "volume",
  showLabels: true,
  labelMinSize: 1,
  textColor: "#F5F5F5",
  backgroundColor: "#000000",
  showProjection: false,
  projectionLineWidth: 1,
  projectionLineStyle: "dashed",
  projectionOpacity: 55,
};

function formatVolume(volume: number) {
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(volume >= 10_000 ? 0 : 1)}K`;
  return String(Math.round(volume));
}

function markerLabel(marker: BigTradePrimitiveMarker, mode: BigTradesPrimitiveOptions["informationMode"]) {
  const volume = formatVolume(marker.volume);
  if (mode === "side-volume") return `${marker.side} ${volume}`;
  if (mode === "executions") return `${marker.executions}x`;
  if (mode === "full") return `${marker.side} ${volume} · ${marker.executions}x`;
  return volume;
}

class BigTradesRenderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: BigTradesPrimitive) {}

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

      const markers = this.primitive.markers();
      const visibleRange = timeScale.getVisibleRange();
      let firstMarker = 0;
      let lastMarker = markers.length;
      if (
        visibleRange
        && typeof visibleRange.from === "number"
        && typeof visibleRange.to === "number"
      ) {
        let low = 0;
        let high = markers.length;
        while (low < high) {
          const middle = (low + high) >>> 1;
          if (Number(markers[middle].time) < visibleRange.from) low = middle + 1;
          else high = middle;
        }
        firstMarker = Math.max(0, low - 1);
        low = firstMarker;
        high = markers.length;
        while (low < high) {
          const middle = (low + high) >>> 1;
          if (Number(markers[middle].time) <= visibleRange.to) low = middle + 1;
          else high = middle;
        }
        lastMarker = Math.min(markers.length, low + 1);
      }

      if (options.showProjection) {
        /*
         * Levels are drawn in their own pass, under every marker, so a line
         * can never be painted over the print that created it.
         */
        context.save();
        context.lineWidth = Math.max(0.5, options.projectionLineWidth);
        context.setLineDash(
          options.projectionLineStyle === "dotted"
            ? [1, 3]
            : options.projectionLineStyle === "dashed"
              ? [5, 4]
              : [],
        );
        for (let markerIndex = firstMarker; markerIndex < lastMarker; markerIndex += 1) {
          const marker = markers[markerIndex];
          const startX = timeScale.timeToCoordinate(marker.time);
          const y = params.series.priceToCoordinate(marker.price);
          if (startX === null || y === null || y < 0 || y > mediaSize.height) continue;
          // No resolving bar yet means nothing has closed through it, so the
          // level is still live and runs to the edge of the chart.
          const endX = marker.projectionEndTime == null
            ? mediaSize.width
            : timeScale.timeToCoordinate(marker.projectionEndTime);
          if (endX === null) continue;
          const left = Math.min(startX, endX);
          const right = Math.max(startX, endX);
          if (right < 0 || left > mediaSize.width) continue;
          context.globalAlpha = marker.opacity * Math.max(0, Math.min(100, options.projectionOpacity)) / 100;
          context.strokeStyle = marker.side === "ASK" ? options.askColor : options.bidColor;
          context.beginPath();
          context.moveTo(left, y);
          context.lineTo(right, y);
          context.stroke();
        }
        context.restore();
      }

      for (let markerIndex = firstMarker; markerIndex < lastMarker; markerIndex += 1) {
        const marker = markers[markerIndex];
        // Resolve both coordinates inside the Lightweight Charts draw pass.
        // The marker therefore uses the exact same viewport snapshot as its
        // candle and cannot lag or float while the chart is panned/scaled.
        const x = timeScale.timeToCoordinate(marker.time);
        const y = params.series.priceToCoordinate(marker.price);
        if (
          x === null
          || y === null
          || x + marker.radius < 0
          || x - marker.radius > mediaSize.width
          || y + marker.radius < 0
          || y - marker.radius > mediaSize.height
        ) continue;

        const color = marker.side === "ASK" ? options.askColor : options.bidColor;
        const radius = marker.radius;
        const strokeWidth = Math.max(1, radius * 0.065);
        const showLabel = options.markerType === "text"
          || (options.showLabels && radius >= options.labelMinSize);

        context.save();
        if (!options.hollowFill && options.markerType !== "text") {
          context.globalAlpha = marker.opacity * 0.13;
          context.fillStyle = color;
          context.beginPath();
          context.arc(x, y, radius * 1.22, 0, Math.PI * 2);
          context.fill();
        }

        context.globalAlpha = marker.opacity;
        context.strokeStyle = color;
        context.lineWidth = strokeWidth;
        context.fillStyle = color;
        if (options.markerType === "square") {
          context.beginPath();
          context.roundRect(
            x - radius,
            y - radius,
            radius * 2,
            radius * 2,
            Math.max(1.5, radius * 0.15),
          );
          if (!options.hollowFill) {
            context.globalAlpha = marker.opacity * 0.6;
            context.fill();
            context.globalAlpha = marker.opacity;
          }
          context.stroke();
        } else if (options.markerType === "diamond") {
          context.beginPath();
          context.moveTo(x, y - radius);
          context.lineTo(x + radius, y);
          context.lineTo(x, y + radius);
          context.lineTo(x - radius, y);
          context.closePath();
          if (!options.hollowFill) {
            context.globalAlpha = marker.opacity * 0.6;
            context.fill();
            context.globalAlpha = marker.opacity;
          }
          context.stroke();
        } else if (options.markerType !== "text") {
          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          if (!options.hollowFill) {
            context.globalAlpha = marker.opacity * 0.58;
            context.fill();
            context.globalAlpha = marker.opacity;
          }
          context.stroke();
        }

        if (showLabel) {
          const fontSize = Math.max(7, Math.min(11, radius * 0.48));
          const text = markerLabel(marker, options.informationMode);
          context.globalAlpha = marker.opacity;
          context.font = `800 ${fontSize}px 'JetBrains Mono', monospace`;
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.lineJoin = "round";
          // A small marker cannot hold its own number, and dropping the number
          // is the wrong answer — the contract count is the reason the marker
          // is there. When the text will not fit inside the shape it is lifted
          // just above it, with the same halo, so shrinking the markers keeps
          // every number readable instead of erasing it.
          const textWidth = context.measureText(text).width;
          const fitsInside = textWidth + 2 <= radius * (options.markerType === "diamond" ? 1.4 : 1.9)
            && fontSize + 2 <= radius * 2;
          const labelY = fitsInside ? y : y - radius - fontSize * 0.75;
          context.strokeStyle = options.backgroundColor;
          context.lineWidth = 2.5;
          context.strokeText(text, x, labelY);
          context.fillStyle = options.textColor;
          context.fillText(text, x, labelY);
        }
        context.restore();
      }

      context.restore();
    });
  }
}

class BigTradesView implements ISeriesPrimitivePaneView {
  private readonly bigTradesRenderer: BigTradesRenderer;

  constructor(primitive: BigTradesPrimitive) {
    this.bigTradesRenderer = new BigTradesRenderer(primitive);
  }

  zOrder() {
    return "top" as const;
  }

  renderer() {
    return this.bigTradesRenderer;
  }
}

export class BigTradesPrimitive implements ISeriesPrimitive<Time> {
  private attachedParams: SeriesAttachedParameter<Time> | null = null;
  private renderMarkers: BigTradePrimitiveMarker[] = [];
  private renderOptions = DEFAULT_OPTIONS;
  private readonly paneView = new BigTradesView(this);

  attached(param: SeriesAttachedParameter<Time>) {
    this.attachedParams = param;
    param.requestUpdate();
  }

  detached() {
    this.attachedParams = null;
  }

  update(markers: BigTradePrimitiveMarker[], options: BigTradesPrimitiveOptions) {
    this.renderMarkers = markers;
    this.renderOptions = options;
    this.attachedParams?.requestUpdate();
  }

  params() {
    return this.attachedParams;
  }

  markers() {
    return this.renderMarkers;
  }

  options() {
    return this.renderOptions;
  }

  paneViews() {
    return [this.paneView];
  }
}
