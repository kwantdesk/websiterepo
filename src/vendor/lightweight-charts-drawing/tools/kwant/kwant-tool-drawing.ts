import type { IPrimitivePaneView } from "lightweight-charts";

import { Drawing } from "../../core/drawing";
import type {
  Anchor,
  DrawingOptions,
  DrawingStyle,
  IDrawing,
  Point,
  Viewport,
} from "../../core/types";
import type { Geometry, LineGeometry, PolygonGeometry, TextGeometry } from "../../core/geometry";
import { distanceToLineSegment } from "../../core/geometry";
import { DrawingPaneView } from "../../rendering/drawing-pane-view";

export type KwantToolKind =
  | "price-channel"
  | "highlight-x"
  | "highlight-y"
  | "ruler"
  | "measure"
  | "fib-fan"
  | "elliott-impulse"
  | "elliott-correction"
  | "elliott-triangle"
  | "elliott-double-combo"
  | "elliott-triple-combo"
  | "label"
  | "right-price-label"
  | "left-price-label"
  | "dot"
  | "diamond"
  | "square"
  | "up-arrow"
  | "down-arrow"
  | "anchored-vwap"
  | "dynamic-poc"
  | "cvd-correlation"
  | "market-profile"
  | "fixed-market-profile"
  | "anchored-market-profile"
  | "zigzag-tpo-profile";

export interface KwantToolOptions extends DrawingOptions {
  text?: string;
  unavailableReason?: string;
  showLabels?: boolean;
}

export interface KwantAnalyticalBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  bidVolume?: number;
  askVolume?: number;
}

export interface KwantAnalyticalTrade {
  timestamp: number;
  price: number;
  volume: number;
  bidVolume: number;
  askVolume: number;
}

export interface KwantMarketDataSource {
  bars(): readonly KwantAnalyticalBar[];
  trades(): readonly KwantAnalyticalTrade[];
  tickSize: number;
}

const ELLIOTT_LABELS: Partial<Record<KwantToolKind, string[]>> = {
  "elliott-impulse": ["", "1", "2", "3", "4", "5"],
  "elliott-correction": ["", "A", "B", "C"],
  "elliott-triangle": ["", "A", "B", "C", "D", "E"],
  "elliott-double-combo": ["", "W", "X", "Y"],
  "elliott-triple-combo": ["", "W", "X", "Y", "X", "Z"],
};

const ANALYTICAL_TOOLS = new Set<KwantToolKind>([
  "anchored-vwap",
  "dynamic-poc",
  "cvd-correlation",
  "market-profile",
  "fixed-market-profile",
  "anchored-market-profile",
  "zigzag-tpo-profile",
]);

function polygon(points: Point[]): PolygonGeometry {
  return { type: "polygon", points, closed: true };
}

function line(start: Point, end: Point, extendLeft = false, extendRight = false): LineGeometry {
  return { type: "line", start, end, extendLeft, extendRight };
}

function text(position: Point, value: string, color?: string, align: CanvasTextAlign = "left"): TextGeometry {
  return {
    type: "text",
    position,
    text: value,
    color,
    align,
    baseline: "middle",
  };
}

/**
 * Compact implementation for the KwantDesk-only tools that are not supplied by
 * the vendored Lightweight Charts drawing package.  It deliberately renders
 * analytical tools as unavailable until a real market-data adapter is supplied;
 * no profile, CVD, POC or VWAP value is fabricated.
 */
export class KwantToolDrawing extends Drawing {
  readonly type: KwantToolKind;
  private readonly requiredAnchors: number;
  private kwantOptions: KwantToolOptions;
  private marketDataSource: KwantMarketDataSource | null = null;

  constructor(
    type: KwantToolKind,
    requiredAnchors: number,
    id: string,
    anchors: Anchor[] = [],
    style: Partial<DrawingStyle> = {},
    options: Partial<KwantToolOptions> = {},
  ) {
    super(id, anchors, style, options);
    this.type = type;
    this.requiredAnchors = requiredAnchors;
    this.kwantOptions = {
      ...this._options,
      text: options.text,
      unavailableReason: options.unavailableReason,
      showLabels: options.showLabels ?? true,
    };
  }

  isValid(): boolean {
    return this._anchors.length >= this.requiredAnchors;
  }

  paneViews(): IPrimitivePaneView[] {
    return [new DrawingPaneView(this)];
  }

  setMarketDataSource(source: KwantMarketDataSource | null): void {
    this.marketDataSource = source;
    this.requestUpdate();
  }

  private anchorSeconds(index: number): number {
    const value = this._anchors[index]?.time;
    return typeof value === "number" ? value : 0;
  }

  private analyticalGeometry(viewport: Viewport, p: Point[], color: string): Geometry[] {
    const source = this.marketDataSource;
    if (!source) return [text({ x: p[0].x + 8, y: p[0].y - 10 }, "Market data unavailable", color)];

    const startMs = this.anchorSeconds(0) * 1_000;
    const lastAnchorMs = this.anchorSeconds(Math.min(1, this._anchors.length - 1)) * 1_000;
    const endMs = this.type === "anchored-vwap" || this.type === "anchored-market-profile"
      ? Number.POSITIVE_INFINITY
      : Math.max(startMs, lastAnchorMs);
    const bars = source.bars().filter((bar) => bar.timestamp >= Math.min(startMs, endMs) && bar.timestamp <= endMs);
    const trades = source.trades().filter((trade) => trade.timestamp >= Math.min(startMs, endMs) && trade.timestamp <= endMs);

    if (this.type === "anchored-vwap") {
      let cumulativePriceVolume = 0;
      let cumulativeVolume = 0;
      const path: Point[] = [];
      for (const bar of bars) {
        const volume = Number(bar.volume);
        if (!(volume > 0)) continue;
        const typical = (bar.high + bar.low + bar.close) / 3;
        cumulativePriceVolume += typical * volume;
        cumulativeVolume += volume;
        const x = viewport.timeScale.timeToCoordinate(Math.floor(bar.timestamp / 1_000) as never);
        const y = viewport.priceScale.priceToCoordinate(cumulativePriceVolume / cumulativeVolume);
        if (x !== null && y !== null) path.push({ x, y });
      }
      return path.length >= 2
        ? [{ type: "polygon", points: path, closed: false }, text(path[path.length - 1], `VWAP ${(cumulativePriceVolume / cumulativeVolume).toFixed(2)}`, color, "right")]
        : [text({ x: p[0].x + 8, y: p[0].y - 10 }, "Real volume unavailable", color)];
    }

    if (this.type === "cvd-correlation") {
      const classified = bars.filter((bar) => Number.isFinite(bar.bidVolume) && Number.isFinite(bar.askVolume));
      if (classified.length < 2) {
        return [text({ x: p[0].x + 8, y: p[0].y - 10 }, "Classified bid/ask volume unavailable", color)];
      }
      let cvd = 0;
      const observations = classified.map((bar) => {
        cvd += Number(bar.askVolume) - Number(bar.bidVolume);
        return { bar, cvd };
      });
      const min = Math.min(...observations.map((entry) => entry.cvd));
      const max = Math.max(...observations.map((entry) => entry.cvd));
      const top = Math.min(p[0].y, p[1].y);
      const bottom = Math.max(p[0].y, p[1].y);
      const range = Math.max(1, max - min);
      const path = observations.flatMap(({ bar, cvd: value }) => {
        const x = viewport.timeScale.timeToCoordinate(Math.floor(bar.timestamp / 1_000) as never);
        return x === null ? [] : [{ x, y: bottom - ((value - min) / range) * (bottom - top) }];
      });
      return path.length >= 2
        ? [{ type: "polygon", points: path, closed: false }, text({ x: p[0].x + 5, y: top + 10 }, `CVD ${cvd >= 0 ? "+" : ""}${Math.round(cvd)}`, color)]
        : [];
    }

    if (!trades.length) {
      return [text({ x: p[0].x + 8, y: p[0].y - 10 }, "Price-level executions unavailable", color)];
    }

    const tickSize = Math.max(Number.EPSILON, source.tickSize);
    const rows = new Map<number, { volume: number; bid: number; ask: number; count: number }>();
    for (const trade of trades) {
      if (!(trade.volume > 0) || !Number.isFinite(trade.price)) continue;
      const tick = Math.round(trade.price / tickSize);
      const row = rows.get(tick) ?? { volume: 0, bid: 0, ask: 0, count: 0 };
      row.volume += trade.volume;
      row.bid += Math.max(0, trade.bidVolume);
      row.ask += Math.max(0, trade.askVolume);
      row.count += 1;
      rows.set(tick, row);
    }
    const ordered = [...rows.entries()].sort((a, b) => a[0] - b[0]);
    if (!ordered.length) return [text({ x: p[0].x + 8, y: p[0].y - 10 }, "Price-level executions unavailable", color)];
    const poc = ordered.reduce((best, entry) => entry[1].volume > best[1].volume ? entry : best);
    const pocPrice = poc[0] * tickSize;

    if (this.type === "dynamic-poc") {
      const y = viewport.priceScale.priceToCoordinate(pocPrice);
      return y === null ? [] : [line({ x: Math.min(p[0].x, p[1].x), y }, { x: Math.max(p[0].x, p[1].x), y }), text({ x: Math.max(p[0].x, p[1].x) - 4, y: y - 7 }, `POC ${pocPrice.toFixed(2)}`, color, "right")];
    }

    const maxVolume = Math.max(...ordered.map((entry) => entry[1].volume));
    const profileRight = this.type === "anchored-market-profile" ? viewport.width - 6 : Math.max(p[0].x, p[1]?.x ?? p[0].x);
    const profileWidth = Math.max(40, Math.min(180, Math.abs((p[1]?.x ?? profileRight - 120) - p[0].x)));
    const geometry: Geometry[] = [];
    for (const [tick, row] of ordered) {
      const y = viewport.priceScale.priceToCoordinate(tick * tickSize);
      if (y === null) continue;
      const width = Math.max(1, row.volume / maxVolume * profileWidth);
      geometry.push(line({ x: profileRight - width, y }, { x: profileRight, y }));
    }
    const pocY = viewport.priceScale.priceToCoordinate(pocPrice);
    if (pocY !== null) {
      geometry.push(line({ x: profileRight - profileWidth, y: pocY }, { x: profileRight, y: pocY }));
      geometry.push(text({ x: profileRight - 4, y: pocY - 7 }, `POC ${pocPrice.toFixed(2)}`, color, "right"));
    }
    if (this.type === "zigzag-tpo-profile") {
      const maxCount = Math.max(...ordered.map((entry) => entry[1].count));
      geometry.push(text({ x: profileRight - profileWidth, y: Math.min(p[0].y, p[1].y) - 8 }, `TPO ${maxCount} max prints`, color));
    }
    return geometry;
  }

  computeGeometry(viewport: Viewport): Geometry[] {
    if (!this.isValid()) return [];
    const points = this._anchors
      .slice(0, this.requiredAnchors)
      .map((anchor) => this.anchorToPixel(anchor, viewport));
    if (points.some((point) => point === null)) return [];
    const p = points as Point[];
    const color = this._style.labelColor ?? this._style.lineColor;

    if (this.type === "highlight-x") {
      const left = Math.min(p[0].x, p[1].x);
      const right = Math.max(p[0].x, p[1].x);
      return [polygon([{ x: left, y: 0 }, { x: right, y: 0 }, { x: right, y: viewport.height }, { x: left, y: viewport.height }])];
    }
    if (this.type === "highlight-y") {
      const top = Math.min(p[0].y, p[1].y);
      const bottom = Math.max(p[0].y, p[1].y);
      return [polygon([{ x: 0, y: top }, { x: viewport.width, y: top }, { x: viewport.width, y: bottom }, { x: 0, y: bottom }])];
    }
    if (this.type === "price-channel") {
      const baseline = line(p[0], p[1]);
      const dx = p[1].x - p[0].x;
      const dy = p[1].y - p[0].y;
      const length = Math.max(1, Math.hypot(dx, dy));
      const nx = -dy / length;
      const ny = dx / length;
      const offset = (p[2].x - p[0].x) * nx + (p[2].y - p[0].y) * ny;
      const a = { x: p[0].x + nx * offset, y: p[0].y + ny * offset };
      const b = { x: p[1].x + nx * offset, y: p[1].y + ny * offset };
      return [baseline, line(a, b), line({ x: (p[0].x + a.x) / 2, y: (p[0].y + a.y) / 2 }, { x: (p[1].x + b.x) / 2, y: (p[1].y + b.y) / 2 })];
    }
    if (this.type === "fib-fan") {
      const ratios = [0.382, 0.5, 0.618, 1];
      return ratios.flatMap((ratio) => {
        const target = { x: p[1].x, y: p[0].y + (p[1].y - p[0].y) * ratio };
        return [line(p[0], target, false, true), text({ x: target.x - 4, y: target.y - 7 }, `${ratio}`, color, "right")];
      });
    }
    if (this.type === "measure" || this.type === "ruler") {
      const a = p[0];
      const b = p[1];
      const priceChange = this._anchors[1].price - this._anchors[0].price;
      const percent = this._anchors[0].price === 0 ? 0 : (priceChange / this._anchors[0].price) * 100;
      const elapsed = typeof this._anchors[0].time === "number" && typeof this._anchors[1].time === "number"
        ? Math.abs(this._anchors[1].time - this._anchors[0].time)
        : 0;
      const labelAt = this.type === "ruler" && p[2] ? p[2] : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      return [
        polygon([{ x: a.x, y: a.y }, { x: b.x, y: a.y }, { x: b.x, y: b.y }, { x: a.x, y: b.y }]),
        line(a, b),
        text(labelAt, `${priceChange >= 0 ? "+" : ""}${priceChange.toFixed(2)} · ${percent.toFixed(2)}% · ${elapsed}s`, color, "center"),
      ];
    }
    if (ELLIOTT_LABELS[this.type]) {
      return [
        { type: "polygon", points: p, closed: false },
        ...p.slice(1).map((point, index) => text({ x: point.x, y: point.y - 10 }, ELLIOTT_LABELS[this.type]?.[index + 1] ?? "", color, "center")),
      ];
    }
    if (this.type === "dot") {
      return [{ type: "arc", center: p[0], radius: 3, startAngle: 0, endAngle: Math.PI * 2 }];
    }
    if (this.type === "diamond") {
      return [polygon([{ x: p[0].x, y: p[0].y - 6 }, { x: p[0].x + 6, y: p[0].y }, { x: p[0].x, y: p[0].y + 6 }, { x: p[0].x - 6, y: p[0].y }])];
    }
    if (this.type === "square") {
      return [polygon([{ x: p[0].x - 5, y: p[0].y - 5 }, { x: p[0].x + 5, y: p[0].y - 5 }, { x: p[0].x + 5, y: p[0].y + 5 }, { x: p[0].x - 5, y: p[0].y + 5 }])];
    }
    if (this.type === "up-arrow" || this.type === "down-arrow") {
      const direction = this.type === "up-arrow" ? -1 : 1;
      return [polygon([
        { x: p[0].x, y: p[0].y + direction * 8 },
        { x: p[0].x + 7, y: p[0].y - direction * 1 },
        { x: p[0].x + 3, y: p[0].y - direction * 1 },
        { x: p[0].x + 3, y: p[0].y - direction * 8 },
        { x: p[0].x - 3, y: p[0].y - direction * 8 },
        { x: p[0].x - 3, y: p[0].y - direction * 1 },
        { x: p[0].x - 7, y: p[0].y - direction * 1 },
      ])];
    }
    if (this.type === "label" || this.type === "right-price-label" || this.type === "left-price-label") {
      const value = this.kwantOptions.text?.trim() || this._anchors[0].price.toFixed(2);
      const offset = this.type === "left-price-label" ? -10 : 10;
      return [text({ x: p[0].x + offset, y: p[0].y }, value, color, this.type === "left-price-label" ? "right" : "left")];
    }
    if (ANALYTICAL_TOOLS.has(this.type)) {
      return this.analyticalGeometry(viewport, p, color);
    }
    return p.length > 1 ? [line(p[0], p[1])] : [];
  }

  testHit(point: Point, viewport: Viewport): boolean {
    const geometries = this.computeGeometry(viewport);
    for (const geometry of geometries) {
      if (geometry.type === "line" && distanceToLineSegment(point, geometry.start, geometry.end) <= 8) return true;
      if (geometry.type === "arc" && Math.abs(Math.hypot(point.x - geometry.center.x, point.y - geometry.center.y) - geometry.radius) <= 8) return true;
      if (geometry.type === "polygon" && geometry.points.length) {
        const xs = geometry.points.map((entry) => entry.x);
        const ys = geometry.points.map((entry) => entry.y);
        if (point.x >= Math.min(...xs) - 8 && point.x <= Math.max(...xs) + 8 && point.y >= Math.min(...ys) - 8 && point.y <= Math.max(...ys) + 8) return true;
      }
      if (geometry.type === "text" && Math.abs(point.x - geometry.position.x) <= 80 && Math.abs(point.y - geometry.position.y) <= 14) return true;
    }
    return false;
  }

  clone(newId: string): IDrawing {
    const clone = new KwantToolDrawing(this.type, this.requiredAnchors, newId, [...this._anchors], { ...this._style }, { ...this.kwantOptions });
    clone.setMarketDataSource(this.marketDataSource);
    return clone;
  }
}
