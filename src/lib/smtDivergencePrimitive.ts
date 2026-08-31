import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "@/lib/lightweightChartsCompat";
import type { SmtDivergenceSignal } from "@/lib/smtDivergence";

export type SmtDivergencePrimitiveOptions = {
  bullishColor: string;
  bearishColor: string;
  lineWidth: number;
  opacity: number;
  showLabels: boolean;
  showPivotDots: boolean;
  labelFontSize: number;
  dashedLines: boolean;
};

const DEFAULT_OPTIONS: SmtDivergencePrimitiveOptions = {
  bullishColor: "#22C55E",
  bearishColor: "#EF4444",
  lineWidth: 2,
  opacity: 1,
  showLabels: true,
  showPivotDots: true,
  labelFontSize: 10,
  dashedLines: false,
};

class SmtDivergenceRenderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly primitive: SmtDivergencePrimitive) {}

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
      context.globalAlpha = Math.max(0.08, Math.min(1, options.opacity));
      context.lineCap = "round";
      context.lineJoin = "round";
      context.font = `${Math.max(8, options.labelFontSize)}px 'JetBrains Mono', monospace`;

      for (const signal of this.primitive.signals()) {
        const startX = timeScale.timeToCoordinate(Math.floor(signal.startTime / 1_000) as Time);
        const endX = timeScale.timeToCoordinate(Math.floor(signal.endTime / 1_000) as Time);
        const startY = params.series.priceToCoordinate(signal.startPrice);
        const endY = params.series.priceToCoordinate(signal.endPrice);
        if (startX === null || endX === null || startY === null || endY === null) continue;
        if (Math.max(startX, endX) < 0 || Math.min(startX, endX) > mediaSize.width) continue;
        if (Math.max(startY, endY) < 0 || Math.min(startY, endY) > mediaSize.height) continue;

        const color = signal.kind === "bullish" ? options.bullishColor : options.bearishColor;
        context.strokeStyle = color;
        context.fillStyle = color;
        context.lineWidth = Math.max(1, options.lineWidth);
        context.setLineDash(options.dashedLines ? [6, 4] : []);
        context.beginPath();
        context.moveTo(startX, startY);
        context.lineTo(endX, endY);
        context.stroke();

        if (options.showPivotDots) {
          context.setLineDash([]);
          for (const [x, y] of [[startX, startY], [endX, endY]] as const) {
            context.beginPath();
            context.arc(x, y, Math.max(2.5, options.lineWidth + 1.25), 0, Math.PI * 2);
            context.fill();
          }
        }

        if (options.showLabels) {
          const paddingX = 6;
          const labelHeight = Math.max(17, options.labelFontSize + 8);
          const labelWidth = context.measureText(signal.label).width + paddingX * 2;
          const labelX = Math.max(2, Math.min(mediaSize.width - labelWidth - 2, endX + 7));
          const preferredY = signal.kind === "bearish" ? endY - labelHeight - 6 : endY + 6;
          const labelY = Math.max(2, Math.min(mediaSize.height - labelHeight - 2, preferredY));
          context.save();
          context.globalAlpha = 0.94;
          context.fillStyle = "rgba(4, 6, 9, 0.90)";
          context.fillRect(labelX, labelY, labelWidth, labelHeight);
          context.strokeStyle = color;
          context.lineWidth = 1;
          context.strokeRect(labelX + 0.5, labelY + 0.5, labelWidth - 1, labelHeight - 1);
          context.fillStyle = color;
          context.textBaseline = "middle";
          context.fillText(signal.label, labelX + paddingX, labelY + labelHeight / 2);
          context.restore();
        }
      }
      context.restore();
    });
  }
}

class SmtDivergenceView implements ISeriesPrimitivePaneView {
  private readonly rendererInstance: SmtDivergenceRenderer;

  constructor(primitive: SmtDivergencePrimitive) {
    this.rendererInstance = new SmtDivergenceRenderer(primitive);
  }

  zOrder() {
    return "top" as const;
  }

  renderer() {
    return this.rendererInstance;
  }
}

export class SmtDivergencePrimitive implements ISeriesPrimitive<Time> {
  private attachedParams: SeriesAttachedParameter<Time> | null = null;
  private renderSignals: SmtDivergenceSignal[] = [];
  private renderOptions = DEFAULT_OPTIONS;
  private readonly paneView = new SmtDivergenceView(this);

  attached(param: SeriesAttachedParameter<Time>) {
    this.attachedParams = param;
    param.requestUpdate();
  }

  detached() {
    this.attachedParams = null;
  }

  update(signals: SmtDivergenceSignal[], options: SmtDivergencePrimitiveOptions) {
    this.renderSignals = signals;
    this.renderOptions = options;
    this.attachedParams?.requestUpdate();
  }

  params() {
    return this.attachedParams;
  }

  signals() {
    return this.renderSignals;
  }

  options() {
    return this.renderOptions;
  }

  paneViews() {
    return [this.paneView];
  }
}
