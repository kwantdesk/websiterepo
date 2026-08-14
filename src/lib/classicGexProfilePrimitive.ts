import type {
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "@/lib/lightweightChartsCompat";
import type { ClassicGexHistorySnapshot, ClassicGexProfileRow } from "@/lib/classicGexProfile";

type CandleSeriesApi = SeriesAttachedParameter<Time, "Candlestick">["series"];

export type ClassicGexPrimitiveLine = {
  label: string;
  mappedPrice: number;
  color: string;
  dash: string;
};

export type ClassicGexPrimitiveData = {
  rows: ClassicGexProfileRow[];
  lines: ClassicGexPrimitiveLine[];
  historyTargets: Array<{ minutes: number; snapshot: ClassicGexHistorySnapshot }>;
  widthPercent: number;
  logarithmic: boolean;
  minBarWidth: number;
  maxMagnitude: number;
  contrast: number;
  right: boolean;
  showLookbackDots: boolean;
  showLabels: boolean;
  positiveColor: string;
  negativeColor: string;
  backgroundColor: string;
  foregroundColor: string;
  precision: number;
};

function dashPattern(value: string) {
  return value.split(/\s+/).map(Number).filter((entry) => Number.isFinite(entry) && entry > 0);
}

class ClassicGexProfileRenderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: ClassicGexProfilePrimitive) {}

  draw(target: Parameters<ISeriesPrimitivePaneRenderer["draw"]>[0]) {
    const series = this.primitive.series();
    const data = this.primitive.data();
    if (!series || !data) return;

    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      if (mediaSize.width < 160 || mediaSize.height < 80) return;
      const profileWidth = Math.min(
        mediaSize.width * 0.45,
        Math.max(90, mediaSize.width * data.widthPercent / 100),
      );
      const halfWidth = Math.max(42, profileWidth / 2);
      const spineX = data.right ? mediaSize.width - halfWidth - 5 : halfWidth + 5;
      const scale = (value: number) => {
        if (!value) return 0;
        const ratio = data.logarithmic
          ? Math.log1p(Math.abs(value)) / Math.log1p(data.maxMagnitude)
          : Math.abs(value) / data.maxMagnitude;
        return Math.max(data.minBarWidth, ratio * halfWidth);
      };
      const positioned = data.rows.flatMap((row) => {
        const y = series.priceToCoordinate(row.mappedPrice);
        return y === null || y < 2 || y > mediaSize.height - 2 ? [] : [{ row, y }];
      }).sort((left, right) => left.y - right.y);
      const minimumGap = positioned.reduce((gap, current, index) => {
        if (!index) return gap;
        return Math.min(gap, Math.abs(current.y - positioned[index - 1].y));
      }, 12);
      const rowHeight = Math.max(2, Math.min(10, minimumGap * 0.68));

      context.save();
      context.beginPath();
      context.rect(0, 0, mediaSize.width, mediaSize.height);
      context.clip();
      context.strokeStyle = data.foregroundColor;
      context.globalAlpha = 0.34;
      context.lineWidth = 1;
      context.setLineDash([]);
      context.beginPath();
      context.moveTo(spineX + 0.5, 0);
      context.lineTo(spineX + 0.5, mediaSize.height);
      context.stroke();

      for (const line of data.lines) {
        const y = series.priceToCoordinate(line.mappedPrice);
        if (y === null || y < 2 || y > mediaSize.height - 2) continue;
        context.globalAlpha = 0.72;
        context.strokeStyle = line.color;
        context.lineWidth = 1.2;
        context.setLineDash(dashPattern(line.dash));
        context.beginPath();
        context.moveTo(0, y + 0.5);
        context.lineTo(mediaSize.width, y + 0.5);
        context.stroke();
        if (data.showLabels) {
          const label = `${line.label} ${line.mappedPrice.toFixed(data.precision)}`;
          context.globalAlpha = 1;
          context.setLineDash([]);
          context.font = "800 8px 'JetBrains Mono', monospace";
          context.textBaseline = "alphabetic";
          context.textAlign = data.right ? "left" : "right";
          context.lineJoin = "round";
          context.strokeStyle = data.backgroundColor;
          context.lineWidth = 3;
          const x = data.right ? 7 : mediaSize.width - 7;
          const labelY = Math.max(10, y - 4);
          context.strokeText(label, x, labelY);
          context.fillStyle = line.color;
          context.fillText(label, x, labelY);
        }
      }

      context.setLineDash([]);
      for (const { row, y } of positioned) {
        const callWidth = scale(row.call);
        const putWidth = scale(row.put);
        context.globalAlpha = data.contrast;
        if (row.put !== 0) {
          context.fillStyle = data.negativeColor;
          context.beginPath();
          context.roundRect(spineX - putWidth, y - rowHeight / 2, putWidth, rowHeight, 1);
          context.fill();
        }
        if (row.call !== 0) {
          context.fillStyle = data.positiveColor;
          context.beginPath();
          context.roundRect(spineX, y - rowHeight / 2, callWidth, rowHeight, 1);
          context.fill();
        }
        if (!data.showLookbackDots) continue;
        for (const { minutes, snapshot } of data.historyTargets) {
          const historical = snapshot.rows.find((candidate) => candidate.strike === row.strike);
          if (!historical?.net) continue;
          const x = spineX + (historical.net > 0 ? 1 : -1) * scale(historical.net);
          context.globalAlpha = minutes === 1 ? 0.9 : 0.52;
          context.fillStyle = data.foregroundColor;
          context.strokeStyle = data.backgroundColor;
          context.lineWidth = 0.8;
          context.beginPath();
          context.arc(x, y, minutes === 1 ? 2.1 : 1.55, 0, Math.PI * 2);
          context.fill();
          context.stroke();
        }
      }
      context.restore();
    });
  }
}

class ClassicGexProfileView implements ISeriesPrimitivePaneView {
  private readonly paneRenderer: ClassicGexProfileRenderer;

  constructor(primitive: ClassicGexProfilePrimitive) {
    this.paneRenderer = new ClassicGexProfileRenderer(primitive);
  }

  zOrder() { return "top" as const; }
  renderer() { return this.paneRenderer; }
}

export class ClassicGexProfilePrimitive implements ISeriesPrimitive<Time> {
  private candleSeries: CandleSeriesApi | null = null;
  private requestRedraw: (() => void) | null = null;
  private renderData: ClassicGexPrimitiveData | null = null;
  private readonly paneView = new ClassicGexProfileView(this);

  attached(param: SeriesAttachedParameter<Time, "Candlestick">) {
    this.candleSeries = param.series;
    this.requestRedraw = param.requestUpdate;
  }

  detached() {
    this.candleSeries = null;
    this.requestRedraw = null;
  }

  update(data: ClassicGexPrimitiveData | null) {
    this.renderData = data;
    this.requestRedraw?.();
  }

  series() { return this.candleSeries; }
  data() { return this.renderData; }
  paneViews() { return [this.paneView]; }
}
