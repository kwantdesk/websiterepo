import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesAttachedParameter,
  Time,
} from "@/lib/lightweightChartsCompat";

/**
 * The Buy/Sell calculator, drawn inside the chart's own paint pass.
 *
 * It used to be an SVG overlay whose geometry was computed during a React
 * render. Those coordinates were correct at the instant they were produced,
 * but the render itself sat behind a throttle, a low-priority transition and a
 * very large component, so the drawing was always at least a frame — usually
 * several — behind the candles. Panning or zooming therefore showed the boxes
 * sliding around against the price action, and no amount of tuning the refresh
 * trigger could close that gap: the overlay is structurally late.
 *
 * Resolving both coordinates here means the calculator uses the exact same
 * viewport snapshot as the bar it is anchored to, so it cannot drift at all.
 */

export type PositionCalculatorModel = {
  id: string;
  /** Anchor times in seconds, matching the chart's own time scale. */
  startTime: number;
  endTime: number;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  selected: boolean;
  showLabels: boolean;
  targetText: string;
  stopText: string;
  rewardRiskText: string;
  profitColor: string;
  lossColor: string;
  entryLineColor: string;
  labelTextColor: string;
  handleFill: string;
  handleStroke: string;
  fillOpacity: number;
  borderOpacity: number;
  lineWidth: number;
  lineDash: number[] | null;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function withAlpha(color: string, alpha: number) {
  const trimmed = color.trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(trimmed);
  if (hex) {
    const value = Number.parseInt(hex[1], 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
  }
  // Theme tokens and rgb()/hsl() strings cannot be re-encoded safely, so the
  // canvas alpha is used instead of rewriting the colour.
  return trimmed;
}

export class PositionCalculatorPrimitive implements ISeriesPrimitive<Time> {
  private attachedParams: SeriesAttachedParameter<Time> | null = null;
  private models: PositionCalculatorModel[] = [];
  private readonly paneView: ISeriesPrimitivePaneView;

  constructor() {
    const renderer: ISeriesPrimitivePaneRenderer = {
      draw: (target: CanvasRenderingTarget2D) => this.draw(target),
    };
    this.paneView = {
      zOrder: () => "top" as const,
      renderer: () => renderer,
    };
  }

  setModels(models: PositionCalculatorModel[]) {
    this.models = models;
    this.attachedParams?.requestUpdate();
  }

  attached(param: SeriesAttachedParameter<Time>) {
    this.attachedParams = param;
  }

  detached() {
    this.attachedParams = null;
    this.models = [];
  }

  paneViews() {
    return [this.paneView];
  }

  private draw(target: CanvasRenderingTarget2D) {
    const params = this.attachedParams;
    if (!params || !this.models.length) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      const timeScale = params.chart.timeScale();
      for (const model of this.models) {
        const ax = timeScale.timeToCoordinate(model.startTime as Time);
        const bx = timeScale.timeToCoordinate(model.endTime as Time);
        const entryY = params.series.priceToCoordinate(model.entryPrice);
        const stopY = params.series.priceToCoordinate(model.stopPrice);
        const targetY = params.series.priceToCoordinate(model.targetPrice);
        if (ax == null || bx == null || entryY == null || stopY == null || targetY == null) continue;

        const x = Math.min(ax, bx);
        // Matches the chart's own geometry: no pixel floor, so the handles
        // stay on the true corners while the calculator is dragged narrow.
        const boxWidth = Math.abs(bx - ax);
        if (x + boxWidth < 0 || x > mediaSize.width) continue;

        const isLong = model.targetPrice >= model.entryPrice;
        const profitTop = Math.min(isLong ? targetY : entryY, isLong ? entryY : targetY);
        const profitHeight = Math.abs(entryY - targetY);
        const riskTop = Math.min(isLong ? entryY : stopY, isLong ? stopY : entryY);
        const riskHeight = Math.abs(entryY - stopY);

        context.save();
        context.lineWidth = model.lineWidth;

        context.globalAlpha = model.fillOpacity;
        context.fillStyle = withAlpha(model.profitColor, 1);
        context.fillRect(x, profitTop, boxWidth, profitHeight);
        context.fillStyle = withAlpha(model.lossColor, 1);
        context.fillRect(x, riskTop, boxWidth, riskHeight);

        context.globalAlpha = model.borderOpacity;
        context.setLineDash(model.lineDash ?? []);
        context.strokeStyle = model.profitColor;
        context.strokeRect(x, profitTop, boxWidth, profitHeight);
        context.strokeStyle = model.lossColor;
        context.strokeRect(x, riskTop, boxWidth, riskHeight);

        const rule = (y: number, color: string, dash: number[]) => {
          context.strokeStyle = color;
          context.setLineDash(dash);
          context.beginPath();
          context.moveTo(x, y);
          context.lineTo(x + boxWidth, y);
          context.stroke();
        };
        context.globalAlpha = 1;
        rule(targetY, model.profitColor, model.lineDash ?? []);
        rule(stopY, model.lossColor, model.lineDash ?? []);
        context.globalAlpha = model.borderOpacity;
        rule(entryY, model.entryLineColor, model.lineDash ?? [4, 3]);

        // The readout belongs to the calculator being worked on; deselected,
        // the tool is just its two boxes.
        if (model.selected && model.showLabels) {
          context.globalAlpha = 1;
          context.setLineDash([]);
          context.font = "650 10px 'JetBrains Mono', monospace";
          context.textAlign = "center";
          context.textBaseline = "middle";
          const pill = (y: number, text: string, background: string, bold: boolean) => {
            context.font = `${bold ? 700 : 650} 10px 'JetBrains Mono', monospace`;
            const width = Math.max(76, context.measureText(text).width + 18);
            const left = clamp(
              x + boxWidth / 2 - width / 2,
              4,
              Math.max(4, mediaSize.width - width - 4),
            );
            const top = clamp(y - 10.5, 4, Math.max(4, mediaSize.height - 25));
            context.fillStyle = background;
            context.beginPath();
            context.roundRect(left, top, width, 21, 10.5);
            context.fill();
            context.fillStyle = model.labelTextColor;
            context.fillText(text, left + width / 2, top + 11);
          };
          pill(targetY, model.targetText, model.profitColor, false);
          pill(stopY, model.stopText, model.lossColor, false);
          pill(entryY, model.rewardRiskText, model.entryLineColor, true);
        }

        if (model.selected) {
          context.globalAlpha = 1;
          context.setLineDash([]);
          context.lineWidth = 1.5;
          context.fillStyle = model.handleFill;
          context.strokeStyle = model.handleStroke;
          for (const handle of [
            { x, y: targetY },
            { x: x + boxWidth, y: targetY },
            { x, y: stopY },
            { x: x + boxWidth, y: stopY },
          ]) {
            context.beginPath();
            context.roundRect(handle.x - 4.5, handle.y - 4.5, 9, 9, 2);
            context.fill();
            context.stroke();
          }
        }

        context.restore();
      }
    });
  }
}
