import { buildExecutedVolumeProfile, calculateAnchoredVwap, calculateTradeRisk, clamp, extendRay, fibPrice } from "./math";
import { objectScreenAnchors, tradeCalculatorResizeHandles } from "./hitTesting";
import type { PrecisionChartAdapter, PrecisionMetrics, PrecisionObject, PrecisionScreenPoint, PrecisionTheme } from "./types";

const analyticalProfileCache = new Map<string, { key: string; value: ReturnType<typeof buildExecutedVolumeProfile> }>();
const anchoredVwapCache = new Map<string, { key: string; value: ReturnType<typeof calculateAnchoredVwap> }>();

function boundedCacheSet<T>(cache: Map<string, T>, key: string, value: T): void {
  cache.set(key, value);
  if (cache.size > 256) cache.delete(cache.keys().next().value as string);
}

function dash(style: PrecisionObject["style"]["lineStyle"]): number[] {
  return style === "dashed" ? [7, 5] : style === "dotted" ? [2, 4] : [];
}

function setStroke(ctx: CanvasRenderingContext2D, object: PrecisionObject): void {
  ctx.globalAlpha = clamp(object.style.opacity, 0, 1);
  ctx.strokeStyle = object.style.stroke;
  ctx.lineWidth = object.style.strokeWidth;
  ctx.setLineDash(dash(object.style.lineStyle));
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function line(ctx: CanvasRenderingContext2D, a: PrecisionScreenPoint, b: PrecisionScreenPoint): void {
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}

function label(ctx: CanvasRenderingContext2D, object: PrecisionObject, x: number, y: number, text: string, align: CanvasTextAlign = "left"): void {
  if (!object.labels.visible || !text) return;
  ctx.save();
  ctx.font = `${object.style.fontWeight} ${object.style.fontSize}px ${object.style.fontFamily}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  const metrics = ctx.measureText(text);
  const left = align === "right" ? x - metrics.width - 8 : align === "center" ? x - metrics.width / 2 - 4 : x - 4;
  ctx.fillStyle = object.style.backgroundColor;
  ctx.strokeStyle = object.style.borderColor;
  ctx.lineWidth = 1;
  ctx.fillRect(left, y - object.style.fontSize, metrics.width + 8, object.style.fontSize + 7);
  ctx.strokeRect(left + 0.5, y - object.style.fontSize + 0.5, metrics.width + 7, object.style.fontSize + 6);
  ctx.fillStyle = object.style.textColor;
  ctx.fillText(text, x, y - 1);
  ctx.restore();
}

function positionLabel(
  ctx: CanvasRenderingContext2D,
  object: PrecisionObject,
  theme: PrecisionTheme,
  centerX: number,
  centerY: number,
  text: string,
  accent: string,
  maxWidth: number,
): void {
  if (!object.labels.visible || !text) return;
  ctx.save();
  const fontSize = Math.max(8, Math.min(11, object.style.fontSize));
  ctx.font = `${Math.max(600, object.style.fontWeight)} ${fontSize}px ${object.style.fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const width = Math.ceil(ctx.measureText(text).width) + 16;
  const height = fontSize + 10;
  const x = clamp(centerX - width / 2, 4, Math.max(4, maxWidth - width - 4));
  const y = centerY - height / 2;
  ctx.globalAlpha = 0.96;
  ctx.fillStyle = theme.panel;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  ctx.fillRect(x, y, width, height);
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  ctx.fillStyle = theme.foreground;
  ctx.fillText(text, x + width / 2, y + height / 2 + 0.5);
  ctx.restore();
}

function formatPrice(value: number, adapter: PrecisionChartAdapter): string {
  return value.toFixed(adapter.precision);
}

function shapeHandles(a: PrecisionScreenPoint, b: PrecisionScreenPoint): PrecisionScreenPoint[] {
  const left = Math.min(a.x, b.x), right = Math.max(a.x, b.x), top = Math.min(a.y, b.y), bottom = Math.max(a.y, b.y);
  return [{ x: left, y: top }, { x: (left + right) / 2, y: top }, { x: right, y: top }, { x: right, y: (top + bottom) / 2 }, { x: right, y: bottom }, { x: (left + right) / 2, y: bottom }, { x: left, y: bottom }, { x: left, y: (top + bottom) / 2 }];
}

function drawHandles(ctx: CanvasRenderingContext2D, points: PrecisionScreenPoint[], theme: PrecisionTheme): void {
  ctx.save(); ctx.setLineDash([]); ctx.lineWidth = 1.25; ctx.strokeStyle = theme.primary; ctx.fillStyle = theme.background;
  points.forEach((point) => { ctx.beginPath(); ctx.rect(point.x - 3.5, point.y - 3.5, 7, 7); ctx.fill(); ctx.stroke(); });
  ctx.restore();
}

function visibleCandles(adapter: PrecisionChartAdapter, start: number, end: number) {
  return adapter.candles.filter((candle) => candle.timestamp >= start && candle.timestamp <= end);
}

export function objectMetrics(object: PrecisionObject, adapter: PrecisionChartAdapter): PrecisionMetrics | null {
  if (object.toolId === "precision-ruler" && object.anchors.length >= 2) {
    const [a, b] = object.anchors;
    const delta = b.price - a.price;
    const ticks = delta / adapter.minMove;
    const percent = a.price ? delta / a.price * 100 : 0;
    const bars = Math.round(Math.abs(b.logicalIndex - a.logicalIndex));
    return { title: "Ruler", lines: [`${delta >= 0 ? "+" : ""}${formatPrice(delta, adapter)} · ${ticks.toFixed(0)} ticks · ${percent.toFixed(2)}%`, `${bars} bars · ${Math.abs(b.time - a.time) >= 60_000 ? `${(Math.abs(b.time - a.time) / 60_000).toFixed(1)} min` : `${Math.abs(b.time - a.time) / 1000}s`}`] };
  }
  if ((object.toolId === "precision-buy-calculator" || object.toolId === "precision-sell-calculator") && object.anchors.length >= 3) {
    const result = calculateTradeRisk(object, adapter.minMove, adapter.pointValue);
    const monetary = result.monetaryAvailable ? `risk $${result.totalRisk.toFixed(2)} · reward $${result.totalReward.toFixed(2)}` : "monetary values unavailable";
    return { title: `${result.direction} calculator`, lines: result.valid ? [`${result.quantity} · ${monetary}`, `${result.rMultiple.toFixed(2)}R · ${result.riskTicks.toFixed(0)} / ${result.rewardTicks.toFixed(0)} ticks`] : [], warning: result.warning };
  }
  return null;
}

function renderObject(ctx: CanvasRenderingContext2D, object: PrecisionObject, adapter: PrecisionChartAdapter, theme: PrecisionTheme): void {
  if (!object.visibility.visible || (object.visibility.timeframes.length && !object.visibility.timeframes.includes(adapter.timeframe))) return;
  if (object.visibility.minZoom != null && adapter.pixelsPerBar < object.visibility.minZoom) return;
  if (object.visibility.maxZoom != null && adapter.pixelsPerBar > object.visibility.maxZoom) return;
  const a = objectScreenAnchors(object, adapter);
  if (!a.length && !object.path?.length) return;
  ctx.save(); setStroke(ctx, object);
  const plotWidth = Math.max(0, adapter.width - adapter.priceScaleWidth);
  const plotHeight = Math.max(0, adapter.height - adapter.timeScaleHeight);

  switch (object.toolId) {
    case "precision-line": if (a[1]) line(ctx, a[0], a[1]); break;
    case "precision-ray": if (a[1]) line(ctx, a[0], extendRay(a[0], a[1], plotWidth, plotHeight)); break;
    case "precision-horizontal-line":
      line(ctx, { x: 0, y: a[0].y }, { x: plotWidth, y: a[0].y });
      label(ctx, object, plotWidth - 6, a[0].y - 5, object.labels.text || formatPrice(object.anchors[0].price, adapter), "right");
      break;
    case "precision-vertical-line":
      line(ctx, { x: a[0].x, y: 0 }, { x: a[0].x, y: plotHeight });
      label(ctx, object, a[0].x + 5, 18, object.labels.text || new Date(object.anchors[0].time).toLocaleString());
      break;
    case "precision-parallel-line":
      if (a[1]) line(ctx, a[0], a[1]);
      if (a[1] && a[2]) { const translated = { x: a[1].x + a[2].x - a[0].x, y: a[1].y + a[2].y - a[0].y }; line(ctx, a[2], translated); }
      break;
    case "precision-rectangle":
    case "precision-ellipse":
      if (a[1]) {
        const left = Math.min(a[0].x, a[1].x), top = Math.min(a[0].y, a[1].y), width = Math.abs(a[1].x - a[0].x), height = Math.abs(a[1].y - a[0].y);
        ctx.fillStyle = object.style.fill; ctx.globalAlpha = object.style.fillOpacity;
        ctx.beginPath(); object.toolId === "precision-rectangle" ? ctx.rect(left, top, width, height) : ctx.ellipse(left + width / 2, top + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2); ctx.fill();
        setStroke(ctx, object); ctx.stroke();
      }
      break;
    case "precision-text":
      label(ctx, { ...object, labels: { ...object.labels, visible: true } }, a[0].x, a[0].y, object.text || "Text");
      break;
    case "precision-pencil": {
      const path = (object.path ?? []).map((anchor) => ({ x: adapter.timeToX(anchor.time, anchor.logicalIndex) ?? NaN, y: adapter.priceToY(anchor.price) ?? NaN })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
      if (path.length > 1) { ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y); path.slice(1).forEach((point) => ctx.lineTo(point.x, point.y)); ctx.stroke(); }
      break;
    }
    case "precision-fibonacci-retracement":
    case "precision-fibonacci-projection": {
      if (!a[1]) break;
      const levels = object.options.levels as number[] ?? [];
      const x1 = Math.min(a[0].x, a[1].x), x2 = object.options.extendRight ? plotWidth : Math.max(a[0].x, a[1].x);
      const reverse = Boolean(object.options.reverse);
      const baseStart = object.toolId === "precision-fibonacci-projection" && object.anchors[2] ? object.anchors[2].price : object.anchors[0].price;
      const baseEnd = object.toolId === "precision-fibonacci-projection" && object.anchors[2] ? object.anchors[2].price + (object.anchors[1].price - object.anchors[0].price) : object.anchors[1].price;
      levels.forEach((ratio) => {
        const price = fibPrice(baseStart, baseEnd, ratio, reverse); const y = adapter.priceToY(price); if (y == null) return;
        ctx.globalAlpha = object.style.fillOpacity * 0.65; ctx.fillStyle = ratio === 0.5 || ratio === 0.618 ? object.style.fill : theme.surface; ctx.fillRect(x1, y - 8, Math.max(0, x2 - x1), 16);
        setStroke(ctx, object); line(ctx, { x: x1, y }, { x: x2, y }); label(ctx, object, x2 - 4, y - 5, `${ratio} · ${formatPrice(price, adapter)}`, "right");
      });
      break;
    }
    case "precision-fibonacci-fan":
      if (a[1]) (object.options.levels as number[] ?? []).forEach((ratio) => { const target = { x: a[1].x, y: a[0].y + (a[1].y - a[0].y) * ratio }; line(ctx, a[0], extendRay(a[0], target, plotWidth, plotHeight)); label(ctx, object, target.x, target.y, String(ratio)); });
      break;
    case "precision-ruler":
      if (a[1]) { line(ctx, a[0], a[1]); const metrics = objectMetrics(object, adapter); if (metrics) label(ctx, object, (a[0].x + a[1].x) / 2, (a[0].y + a[1].y) / 2 - 8, metrics.lines.join(" · "), "center"); }
      break;
    case "precision-volume-profile": {
      if (!a[1]) break;
      const start = Math.min(object.anchors[0].time, object.anchors[1].time), end = Math.max(object.anchors[0].time, object.anchors[1].time);
      const manualTicks = object.options.automaticTickGrouping === false ? Number(object.options.manualTicksPerRow ?? 1) : 0;
      const automaticRows = Math.round(48 / Math.max(0.25, Number(object.options.automaticGroupingFactor ?? 1)));
      const profileKey = `${start}:${end}:${adapter.minMove}:${automaticRows}:${manualTicks}:${object.options.valueAreaPercent}:${adapter.trades.length}:${adapter.trades.at(-1)?.timestamp ?? 0}`;
      let profile = analyticalProfileCache.get(object.id)?.key === profileKey ? analyticalProfileCache.get(object.id)!.value : null;
      if (!profile) { profile = buildExecutedVolumeProfile(adapter.trades, start, end, adapter.minMove, automaticRows, Number(object.options.valueAreaPercent ?? 68), manualTicks); boundedCacheSet(analyticalProfileCache, object.id, { key: profileKey, value: profile }); }
      const left = Math.min(a[0].x, a[1].x), right = Math.max(a[0].x, a[1].x), profileWidth = Math.max(40, (right - left) * clamp(Number(object.options.widthPercent ?? 28) / 100, 0.1, 1));
      if (profile.source === "unavailable") { label(ctx, object, right, Math.min(a[0].y, a[1].y), "Executed volume-at-price data is required.", "right"); break; }
      const lowerPrice = Math.min(object.anchors[0].price, object.anchors[1].price);
      const upperPrice = Math.max(object.anchors[0].price, object.anchors[1].price);
      const rows = profile.rows.filter((row) => row.price >= lowerPrice && row.price <= upperPrice);
      const mode = String(object.options.mode ?? "volume-and-delta");
      const maxVolume = Math.max(...rows.map((row) => row.volume), 1);
      const maxSide = Math.max(...rows.flatMap((row) => [row.bidVolume, row.askVolume, Math.abs(row.delta)]), 1);
      const baseX = object.options.side === "left" ? left : right;
      rows.forEach((row) => {
        const y = adapter.priceToY(row.price);
        const nextY = adapter.priceToY(row.price + adapter.minMove) ?? ((y ?? 0) - 2);
        if (y == null) return;
        const height = Math.max(1, Math.abs(nextY - y));
        ctx.globalAlpha = row.inValueArea ? 0.76 : 0.38;
        if (mode === "bid-ask") {
          const centre = object.options.side === "left" ? left + profileWidth / 2 : right - profileWidth / 2;
          const bidWidth = row.bidVolume / maxSide * profileWidth / 2;
          const askWidth = row.askVolume / maxSide * profileWidth / 2;
          ctx.fillStyle = object.style.negativeColor; ctx.fillRect(centre - bidWidth, y - height / 2, bidWidth, height);
          ctx.fillStyle = object.style.positiveColor; ctx.fillRect(centre, y - height / 2, askWidth, height);
        } else if (mode === "delta") {
          const width = Math.abs(row.delta) / maxSide * profileWidth;
          ctx.fillStyle = row.delta >= 0 ? object.style.positiveColor : object.style.negativeColor;
          ctx.fillRect(row.delta >= 0 ? baseX : baseX - width, y - height / 2, width, height);
        } else {
          const width = row.volume / maxVolume * profileWidth;
          const x = object.options.side === "left" ? left : right - width;
          ctx.fillStyle = object.style.valueAreaColor; ctx.fillRect(x, y - height / 2, width, height);
          if (mode === "volume-and-delta") {
            const overlay = Math.abs(row.delta) / maxSide * width;
            ctx.fillStyle = row.delta >= 0 ? object.style.positiveColor : object.style.negativeColor;
            ctx.globalAlpha = row.inValueArea ? 0.92 : 0.62;
            ctx.fillRect(row.delta >= 0 ? x + width - overlay : x, y - height / 2, overlay, height);
          }
        }
        if (object.options.showValues) label(ctx, object, object.options.side === "left" ? left : right, y, String(Math.round(row.volume)), object.options.side === "left" ? "left" : "right");
      });
      if (object.options.showValueArea !== false && object.options.valueAreaLines !== false) {
        [profile.vah, profile.val].forEach((price) => { const y = price == null ? null : adapter.priceToY(price); if (y != null) { ctx.strokeStyle = object.style.valueAreaColor; ctx.lineWidth = 1; line(ctx, { x: left, y }, { x: right, y }); } });
      }
      if (object.options.showPoc !== false && profile.poc != null) { const y = adapter.priceToY(profile.poc); if (y != null) { ctx.strokeStyle = object.style.pocColor; ctx.lineWidth = 1.5; line(ctx, { x: left, y }, { x: right, y }); if (object.options.displayPocValue !== false) label(ctx, object, right, y - 4, `POC ${formatPrice(profile.poc, adapter)}`, "right"); } }
      break;
    }
    case "precision-anchored-vwap": {
      const fixedEnd = Number(object.options.fixedEndTime ?? 0);
      const endTime = object.options.extendToLive === false && fixedEnd > 0 ? fixedEnd : Infinity;
      const vwapKey = `${object.anchors[0].time}:${endTime}:${object.options.source}:${adapter.candles.length}:${adapter.candles.at(-1)?.timestamp ?? 0}:${adapter.candles.at(-1)?.volume ?? 0}`;
      let calculated = anchoredVwapCache.get(object.id)?.key === vwapKey ? anchoredVwapCache.get(object.id)!.value : null;
      if (!calculated) { calculated = calculateAnchoredVwap(adapter.candles, object.anchors[0].time, String(object.options.source ?? "hlc3"), endTime); boundedCacheSet(anchoredVwapCache, object.id, { key: vwapKey, value: calculated }); }
      const points = calculated.map((point) => ({ ...point, x: adapter.timeToX(point.time) ?? NaN, y: adapter.priceToY(point.value) ?? NaN })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
      if (!points.length) { label(ctx, object, a[0].x, a[0].y, "VWAP requires bar volume"); break; }
      ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y); points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y)); ctx.stroke();
      [1, 2, 3, 4, 5].forEach((band) => {
        if (object.options[`band${band}Enabled`] !== true) return;
        const multiplier = Number(object.options[`band${band}Multiplier`] ?? band);
        ctx.globalAlpha = 0.42;
        [-1, 1].forEach((side) => { ctx.beginPath(); points.forEach((point, index) => { const y = adapter.priceToY(point.value + side * point.deviation * multiplier); if (y == null) return; index ? ctx.lineTo(point.x, y) : ctx.moveTo(point.x, y); }); ctx.stroke(); });
      });
      break;
    }
    case "precision-buy-calculator":
    case "precision-sell-calculator": {
      if (a.length < 3) break;
      const result = calculateTradeRisk(object, adapter.minMove, adapter.pointValue);
      const left = Math.min(...a.map((point) => point.x)), right = Math.max(...a.map((point) => point.x), left + 80);
      const entryY = a[0].y, stopY = a[1].y, targetY = a[2].y;
      const boxWidth = Math.max(1, right - left);
      const fillOpacity = object.options.backgroundEnabled === false ? 0 : clamp(Math.max(0.12, object.style.fillOpacity), 0, 0.42);
      ctx.globalAlpha = fillOpacity;
      ctx.fillStyle = object.style.positiveColor;
      ctx.fillRect(left, Math.min(entryY, targetY), boxWidth, Math.abs(targetY - entryY));
      ctx.fillStyle = object.style.negativeColor;
      ctx.fillRect(left, Math.min(entryY, stopY), boxWidth, Math.abs(stopY - entryY));
      ctx.globalAlpha = 0.82;
      ctx.strokeStyle = object.style.positiveColor;
      ctx.strokeRect(left + 0.5, Math.min(entryY, targetY) + 0.5, Math.max(0, boxWidth - 1), Math.max(0, Math.abs(targetY - entryY) - 1));
      ctx.strokeStyle = object.style.negativeColor;
      ctx.strokeRect(left + 0.5, Math.min(entryY, stopY) + 0.5, Math.max(0, boxWidth - 1), Math.max(0, Math.abs(stopY - entryY) - 1));
      ctx.globalAlpha = 1;
      ctx.strokeStyle = object.style.positiveColor;
      line(ctx, { x: left, y: targetY }, { x: right, y: targetY });
      ctx.strokeStyle = object.style.neutralColor;
      ctx.setLineDash(object.style.lineStyle === "solid" ? [4, 3] : dash(object.style.lineStyle));
      line(ctx, { x: left, y: entryY }, { x: right, y: entryY });
      ctx.setLineDash(dash(object.style.lineStyle));
      ctx.strokeStyle = object.style.negativeColor;
      line(ctx, { x: left, y: stopY }, { x: right, y: stopY });

      if (result.valid) {
        const precision = adapter.precision;
        const rewardMoney = result.monetaryAvailable && object.options.showPnl !== false ? ` · +$${result.totalReward.toFixed(0)}` : "";
        const riskMoney = result.monetaryAvailable && object.options.showPnl !== false ? ` · -$${result.totalRisk.toFixed(0)}` : "";
        const targetText = `TP · +${result.rewardPoints.toFixed(precision)} PTS · ${Math.round(result.rewardTicks)} TICKS${rewardMoney}`;
        const stopText = `SL · -${result.riskPoints.toFixed(precision)} PTS · ${Math.round(result.riskTicks)} TICKS${riskMoney}`;
        const ratio = result.rMultiple.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
        const entryText = `${result.direction} · ${result.quantity} · R:R 1:${ratio}`;
        const centerX = left + boxWidth / 2;
        positionLabel(ctx, object, theme, centerX, targetY, targetText, object.style.positiveColor, plotWidth);
        positionLabel(ctx, object, theme, centerX, stopY, stopText, object.style.negativeColor, plotWidth);
        if (object.options.showRiskReward !== false) positionLabel(ctx, object, theme, centerX, entryY, entryText, object.style.neutralColor, plotWidth);
      } else {
        positionLabel(ctx, object, theme, left + boxWidth / 2, entryY, result.warning ?? "INVALID SETUP", object.style.negativeColor, plotWidth);
      }
      break;
    }
  }
  ctx.restore();
}

export function renderPrecisionCanvas(
  ctx: CanvasRenderingContext2D,
  objects: PrecisionObject[],
  draft: PrecisionObject | null,
  selectedIds: string[],
  adapter: PrecisionChartAdapter,
  theme: PrecisionTheme,
): void {
  ctx.clearRect(0, 0, adapter.width, adapter.height);
  [...objects, ...(draft ? [draft] : [])].sort((a, b) => a.zIndex - b.zIndex).forEach((object) => renderObject(ctx, object, adapter, theme));
  objects.filter((object) => selectedIds.includes(object.id) && object.visibility.visible).forEach((object) => {
    const anchors = objectScreenAnchors(object, adapter);
    const isTradeCalculator = object.toolId === "precision-buy-calculator" || object.toolId === "precision-sell-calculator";
    const handles = isTradeCalculator
      ? tradeCalculatorResizeHandles(anchors)
      : (object.toolId === "precision-rectangle" || object.toolId === "precision-ellipse") && anchors.length >= 2
        ? shapeHandles(anchors[0], anchors[1])
        : anchors;
    drawHandles(ctx, handles, theme);
  });
}

export function renderPrecisionInteractionCanvas(
  ctx: CanvasRenderingContext2D,
  adapter: PrecisionChartAdapter,
  pointer: PrecisionScreenPoint | null,
  active: boolean,
  theme: PrecisionTheme,
): void {
  ctx.clearRect(0, 0, adapter.width, adapter.height);
  if (!pointer || !active) return;
  ctx.save(); ctx.strokeStyle = theme.primary; ctx.globalAlpha = 0.36; ctx.lineWidth = 1; ctx.setLineDash([2, 5]);
  line(ctx, { x: 0, y: pointer.y }, { x: adapter.width - adapter.priceScaleWidth, y: pointer.y });
  line(ctx, { x: pointer.x, y: 0 }, { x: pointer.x, y: adapter.height - adapter.timeScaleHeight });
  ctx.restore();
}
