import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "lightweight-charts";

export type BigTradePrimitiveMarker = {
  id: string;
  time: Time;
  price: number;
  volume: number;
  executions: number;
  side: "ASK" | "BID";
  radius: number;
  opacity: number;
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
};

const DEFAULT_OPTIONS: BigTradesPrimitiveOptions = {
  askColor: "#B6FF00",
  bidColor: "#FFFFFF",
  markerType: "circle",
  hollowFill: false,
  informationMode: "volume",
  showLabels: true,
  labelMinSize: 14,
  textColor: "#F5F5F5",
  backgroundColor: "#000000",
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
          context.strokeStyle = options.backgroundColor;
          context.lineWidth = 2.5;
          context.strokeText(text, x, y);
          context.fillStyle = options.textColor;
          context.fillText(text, x, y);
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
