"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  subscribeMarketIndexSnapshot,
  type MarketIndexLiveSnapshot,
} from "@/lib/marketIndexLiveClient";

export type HomeLaunchPreview =
  | "home"
  | "chart"
  | "vue"
  | "calendar"
  | "flow"
  | "gamma"
  | "gexmap"
  | "liquidity"
  | "levels"
  | "gameplan"
  | "zyon"
  | "news"
  | "socials"
  | "journal"
  | "backtest"
  | "accounts";

export const HOME_LIVE_SYMBOLS = ["NDX", "SPX", "VIX"] as const;
export type HomeLiveSymbol = (typeof HOME_LIVE_SYMBOLS)[number];

export type HomeLiveQuote = {
  snapshot: MarketIndexLiveSnapshot;
  /** Real received last prices only — never interpolated or invented. */
  series: number[];
  receivedAt: number;
};

export type HomeLiveIndices = Partial<Record<HomeLiveSymbol, HomeLiveQuote>>;

const MAX_SERIES_POINTS = 160;
const FLUSH_MS = 450;
const FRESH_MS = 20_000;

/**
 * One shared home-page subscription per index symbol. The underlying client
 * already multiplexes every subscriber onto a single VPS SSE stream plus one
 * batched snapshot poll, so the whole launcher costs the same upstream work
 * as a single options chart. Buffered frames flush to React state at most
 * every FLUSH_MS so live ticks never rerender the grid per-frame.
 */
export function useHomeLiveIndices(): HomeLiveIndices {
  const [indices, setIndices] = useState<HomeLiveIndices>({});

  useEffect(() => {
    const buffers = new Map<HomeLiveSymbol, HomeLiveQuote>();
    let dirty = false;
    const unsubscribes = HOME_LIVE_SYMBOLS.map((symbol) =>
      subscribeMarketIndexSnapshot(symbol, (snapshot) => {
        const existing = buffers.get(symbol);
        const series = existing?.series ?? [];
        const isNewFrame = !existing
          || existing.snapshot.timestamp !== snapshot.timestamp
          || existing.snapshot.lastPrice !== snapshot.lastPrice;
        if (isNewFrame) {
          series.push(snapshot.lastPrice);
          if (series.length > MAX_SERIES_POINTS) series.splice(0, series.length - MAX_SERIES_POINTS);
        }
        buffers.set(symbol, { snapshot, series, receivedAt: Date.now() });
        dirty = true;
      }),
    );
    const flushTimer = window.setInterval(() => {
      if (!dirty) return;
      dirty = false;
      const next: HomeLiveIndices = {};
      buffers.forEach((quote, symbol) => {
        next[symbol] = { ...quote, series: [...quote.series] };
      });
      setIndices(next);
    }, FLUSH_MS);

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
      window.clearInterval(flushTimer);
    };
  }, []);

  return indices;
}

function formatIndexPrice(value: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function quoteChangePercent(snapshot: MarketIndexLiveSnapshot): number | undefined {
  if (typeof snapshot.changePercent === "number" && Number.isFinite(snapshot.changePercent)) {
    return snapshot.changePercent;
  }
  if (
    typeof snapshot.openPrice === "number"
    && Number.isFinite(snapshot.openPrice)
    && snapshot.openPrice > 0
  ) {
    return ((snapshot.lastPrice - snapshot.openPrice) / snapshot.openPrice) * 100;
  }
  return undefined;
}

function quoteStatus(quote: HomeLiveQuote) {
  const fresh = Date.now() - quote.receivedAt < FRESH_MS;
  if (!fresh) return "stale" as const;
  if (quote.snapshot.delayed) return "delayed" as const;
  if (!quote.snapshot.marketOpen) return "closed" as const;
  return "live" as const;
}

const STATUS_DOT_COLOR: Record<ReturnType<typeof quoteStatus>, string> = {
  live: "#22C55E",
  delayed: "#F59E0B",
  closed: "#71717A",
  stale: "#71717A",
};

/**
 * Compact real-quote readout. Renders nothing until an honest provider frame
 * has arrived — the chip never shows placeholder or invented values.
 */
export function LiveQuoteChip({ quote }: { quote: HomeLiveQuote | undefined }) {
  if (!quote) return null;
  const change = quoteChangePercent(quote.snapshot);
  const status = quoteStatus(quote);
  const changeColor = change === undefined || change === 0
    ? "#A1A1AA"
    : change > 0 ? "#22C55E" : "#EF4444";
  return (
    <span className="pointer-events-none absolute right-2 top-2 z-[2] flex h-[18px] items-center gap-1.5 rounded-[3px] border border-white/10 bg-black/62 px-1.5 backdrop-blur-md">
      <span
        className={status === "live" ? "kwant-home-live-dot h-1 w-1 rounded-full" : "h-1 w-1 rounded-full"}
        style={{ background: STATUS_DOT_COLOR[status] }}
      />
      <span className="text-[7px] font-semibold uppercase tracking-[0.14em] text-white/60">
        {quote.snapshot.symbol}
      </span>
      <span className="font-mono text-[8px] leading-none text-white/88">
        {formatIndexPrice(quote.snapshot.lastPrice)}
      </span>
      {change !== undefined && (
        <span className="font-mono text-[8px] leading-none" style={{ color: changeColor }}>
          {change > 0 ? "+" : ""}{change.toFixed(2)}%
        </span>
      )}
    </span>
  );
}

/** Three-row real index tape used on the Home tile. */
export function LiveIndexTape({ live }: { live: HomeLiveIndices }) {
  const rows = HOME_LIVE_SYMBOLS
    .map((symbol) => live[symbol])
    .filter((quote): quote is HomeLiveQuote => Boolean(quote));
  if (!rows.length) return null;
  return (
    <div className="pointer-events-none absolute inset-x-3 top-2.5 z-[2] flex flex-col gap-[5px]">
      {rows.map((quote) => {
        const change = quoteChangePercent(quote.snapshot);
        const status = quoteStatus(quote);
        const changeColor = change === undefined || change === 0
          ? "#A1A1AA"
          : change > 0 ? "#22C55E" : "#EF4444";
        return (
          <div
            key={quote.snapshot.symbol}
            className="flex h-[19px] items-center gap-2 rounded-[3px] border border-white/[0.09] bg-black/55 px-2 backdrop-blur-md"
          >
            <span
              className={status === "live" ? "kwant-home-live-dot h-1 w-1 rounded-full" : "h-1 w-1 rounded-full"}
              style={{ background: STATUS_DOT_COLOR[status] }}
            />
            <span className="w-7 text-[7px] font-semibold uppercase tracking-[0.16em] text-white/62">
              {quote.snapshot.symbol}
            </span>
            <span className="flex-1 text-right font-mono text-[8.5px] leading-none text-white/88">
              {formatIndexPrice(quote.snapshot.lastPrice)}
            </span>
            {change !== undefined && (
              <span className="w-11 text-right font-mono text-[8px] leading-none" style={{ color: changeColor }}>
                {change > 0 ? "+" : ""}{change.toFixed(2)}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

type SparklineGeometry = {
  linePath: string;
  areaPath: string;
  lastX: number;
  lastY: number;
};

function sparklineGeometry(
  series: number[],
  x: number,
  y: number,
  width: number,
  height: number,
): SparklineGeometry | null {
  if (series.length < 2) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const value of series) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const span = max - min || Math.max(Math.abs(max) * 0.0004, 1e-6);
  const pad = height * 0.16;
  const usable = height - pad * 2;
  const step = width / (series.length - 1);
  let linePath = "";
  let lastX = x;
  let lastY = y + height / 2;
  series.forEach((value, index) => {
    lastX = x + index * step;
    lastY = y + pad + usable * (1 - (value - min) / span);
    linePath += `${index === 0 ? "M" : "L"}${lastX.toFixed(2)} ${lastY.toFixed(2)} `;
  });
  const areaPath = `${linePath}L${(x + width).toFixed(2)} ${(y + height).toFixed(2)} L${x.toFixed(2)} ${(y + height).toFixed(2)} Z`;
  return { linePath: linePath.trim(), areaPath, lastX, lastY };
}

/**
 * Real-price sparkline drawn only from received provider frames. While the
 * first frames are still arriving it renders a quiet shimmer baseline —
 * never a synthetic price path.
 */
function LiveSparkline({
  quote,
  x = 0,
  y = 0,
  width = 176,
  height = 112,
  gradientId,
}: {
  quote: HomeLiveQuote | undefined;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  gradientId: string;
}) {
  const geometry = quote ? sparklineGeometry(quote.series, x, y, width, height) : null;
  if (!geometry) {
    return (
      <line
        className="kwant-home-shimmer"
        x1={x + width * 0.08}
        y1={y + height / 2}
        x2={x + width * 0.92}
        y2={y + height / 2}
        stroke="rgba(255,255,255,.22)"
        strokeWidth="1"
        strokeDasharray="3 4"
      />
    );
  }
  return (
    <g>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="var(--primary)" stopOpacity=".26" />
          <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={geometry.areaPath} fill={`url(#${gradientId})`} />
      <path d={geometry.linePath} fill="none" stroke="var(--primary)" strokeWidth="1.4" strokeLinejoin="round" />
      <circle
        className="kwant-home-live-dot"
        cx={geometry.lastX}
        cy={geometry.lastY}
        r="2.2"
        fill="var(--primary)"
      />
    </g>
  );
}

function PreviewGrid() {
  return (
    <g stroke="rgba(255,255,255,.07)" strokeWidth=".75">
      {[24, 48, 72, 96].map((y) => <line key={`y-${y}`} x1="0" y1={y} x2="176" y2={y} />)}
      {[35, 70, 105, 140].map((x) => <line key={`x-${x}`} x1={x} y1="0" x2={x} y2="112" />)}
    </g>
  );
}

const candleData = [
  [19, 42, 12, 49], [39, 33, 26, 45], [31, 55, 28, 59], [53, 47, 41, 58],
  [45, 63, 43, 68], [61, 57, 50, 65], [55, 72, 52, 76], [70, 66, 61, 75],
  [64, 79, 60, 82], [77, 69, 65, 81], [67, 84, 64, 88], [82, 76, 71, 87],
];

/** Decorative structural candle motif — illustration only, carries no labels. */
function CandleMotif({ compact = false }: { compact?: boolean }) {
  const scale = compact ? 0.72 : 1;
  return (
    <g transform={compact ? "translate(22 15) scale(.72)" : undefined} opacity=".82">
      {candleData.map(([open, close, low, high], index) => {
        const up = close >= open;
        const x = 13 + index * 13;
        const y = 92 - Math.max(open, close) * scale;
        const height = Math.max(3, Math.abs(close - open) * scale);
        return (
          <g key={x}>
            <line x1={x + 3} y1={92 - high * scale} x2={x + 3} y2={92 - low * scale} stroke={up ? "var(--primary)" : "rgba(255,255,255,.85)"} strokeWidth="1" />
            <rect x={x} y={y} width="6" height={height} fill={up ? "var(--primary)" : "rgba(255,255,255,.88)"} />
          </g>
        );
      })}
    </g>
  );
}

function pulseDelay(index: number, step = 0.35) {
  return { animationDelay: `${(index * step).toFixed(2)}s` };
}

export function HomeWorkspacePreview({
  type,
  live,
}: {
  type: HomeLaunchPreview;
  live: HomeLiveIndices;
}) {
  let content: ReactNode;

  switch (type) {
    case "home":
      content = (
        <>
          <path className="kwant-home-pulse-soft" d="M0 88 C28 83 35 61 63 71 S103 84 126 62 S157 57 176 66" fill="none" stroke="var(--primary)" strokeWidth="1.3" />
          <path className="kwant-home-pulse-soft" style={pulseDelay(3)} d="M0 97 C26 89 43 80 67 86 S112 97 137 80 S160 74 176 79" fill="none" stroke="rgba(255,255,255,.28)" />
        </>
      );
      break;
    case "chart":
      content = (
        <>
          <PreviewGrid />
          <LiveSparkline quote={live.NDX} gradientId="home-spark-chart" />
        </>
      );
      break;
    case "vue":
      content = (
        <>
          <rect x="6" y="7" width="101" height="98" fill="rgba(0,0,0,.2)" stroke="rgba(255,255,255,.1)" />
          <rect x="113" y="7" width="57" height="47" fill="rgba(0,0,0,.2)" stroke="rgba(255,255,255,.1)" />
          <rect x="113" y="58" width="57" height="47" fill="rgba(0,0,0,.2)" stroke="rgba(255,255,255,.1)" />
          <LiveSparkline quote={live.SPX} x={10} y={12} width={93} height={88} gradientId="home-spark-vue-main" />
          <LiveSparkline quote={live.NDX} x={117} y={11} width={49} height={39} gradientId="home-spark-vue-top" />
          <LiveSparkline quote={live.VIX} x={117} y={62} width={49} height={39} gradientId="home-spark-vue-bottom" />
        </>
      );
      break;
    case "calendar":
      content = (
        <>
          {[0, 1, 2, 3, 4].map((row) => [0, 1, 2, 3, 4, 5, 6].map((column) => {
            const active = (row * 5 + column * 3) % 7 < 3;
            return (
              <rect
                key={`${row}-${column}`}
                className={active ? "kwant-home-pulse" : undefined}
                style={active ? pulseDelay(row + column, 0.45) : undefined}
                x={8 + column * 24}
                y={8 + row * 20}
                width="19"
                height="15"
                fill={active ? "color-mix(in srgb, var(--primary) 45%, transparent)" : "rgba(255,255,255,.035)"}
                stroke={active ? "var(--primary)" : "rgba(255,255,255,.09)"}
                opacity={0.42 + ((row + column) % 3) * 0.2}
              />
            );
          }))}
        </>
      );
      break;
    case "flow":
      content = (
        <>
          <PreviewGrid />
          <path className="kwant-home-flow" d="M0 89 C21 82 24 49 49 57 S78 79 95 54 S127 31 176 22" fill="none" stroke="var(--primary)" strokeWidth="1.8" strokeDasharray="7 9" />
          <path className="kwant-home-flow" style={pulseDelay(4)} d="M0 71 C27 64 34 75 57 67 S92 37 111 49 S141 60 176 42" fill="none" stroke="rgba(255,255,255,.42)" strokeDasharray="5 11" />
          <g fill="var(--primary)">
            {[20, 48, 74, 98, 125, 150].map((x, index) => (
              <circle
                key={x}
                className="kwant-home-pulse"
                style={pulseDelay(index, 0.5)}
                cx={x}
                cy={78 - index * 8}
                r={2 + index * 0.35}
                opacity={0.4 + index * 0.1}
              />
            ))}
          </g>
        </>
      );
      break;
    case "gamma":
      content = (
        <>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((index) => {
            const width = [31, 49, 66, 91, 122, 103, 78, 51, 28][index];
            return (
              <g key={index}>
                <rect
                  className="kwant-home-pulse"
                  style={pulseDelay(index, 0.28)}
                  x={88 - width / 2}
                  y={8 + index * 11}
                  width={width}
                  height="6"
                  fill={index < 4 ? "rgba(255,255,255,.36)" : "var(--primary)"}
                  opacity={0.3 + index * 0.07}
                />
                <line x1="88" y1={6 + index * 11} x2="88" y2={17 + index * 11} stroke="rgba(255,255,255,.18)" />
              </g>
            );
          })}
        </>
      );
      break;
    case "gexmap":
      content = (
        <>
          {[0, 1, 2].map((panel) => (
            <g key={panel} transform={`translate(${4 + panel * 57} 5)`}>
              <rect width="53" height="102" fill="rgba(0,0,0,.2)" stroke="rgba(255,255,255,.1)" />
              {[0, 1, 2, 3, 4, 5, 6].map((row) => (
                <rect
                  key={row}
                  className="kwant-home-pulse"
                  style={pulseDelay(row + panel * 2, 0.3)}
                  x="4"
                  y={7 + row * 13}
                  width="45"
                  height="9"
                  fill={row === 4 ? "var(--primary)" : row % 2 ? "color-mix(in srgb, var(--primary) 32%, transparent)" : "rgba(255,255,255,.05)"}
                  opacity={row === 4 ? 0.8 : 0.65}
                />
              ))}
            </g>
          ))}
        </>
      );
      break;
    case "liquidity":
      content = (
        <>
          {[10, 22, 35, 49, 62, 76, 90, 103].map((y, index) => (
            <rect
              key={y}
              className="kwant-home-pulse"
              style={pulseDelay(index, 0.4)}
              x="0"
              y={y}
              width="176"
              height={index % 3 === 0 ? 7 : 4}
              fill="var(--primary)"
              opacity={[0.1, 0.28, 0.13, 0.55, 0.2, 0.38, 0.12, 0.22][index]}
            />
          ))}
          <LiveSparkline quote={live.NDX} gradientId="home-spark-liquidity" />
        </>
      );
      break;
    case "levels":
      content = (
        <>
          <PreviewGrid />
          <CandleMotif compact />
          {[[25, 0.3], [46, 0.7], [69, 0.4], [91, 0.85]].map(([y, opacity], index) => (
            <g key={y} className="kwant-home-pulse" style={pulseDelay(index, 0.6)}>
              <line x1="0" y1={y} x2="176" y2={y} stroke="var(--primary)" strokeWidth={opacity > 0.8 ? 2 : 1} opacity={opacity} strokeDasharray={opacity < 0.5 ? "3 3" : undefined} />
              <rect x="145" y={y - 4} width="27" height="8" fill="var(--primary)" opacity={opacity} />
            </g>
          ))}
        </>
      );
      break;
    case "gameplan":
      content = (
        <>
          {[0, 1, 2].map((column) => (
            <g key={column} transform={`translate(${6 + column * 57} 7)`}>
              <rect width="51" height="98" fill="rgba(255,255,255,.025)" stroke="rgba(255,255,255,.1)" />
              <rect x="6" y="8" width={26 + column * 5} height="3" fill="var(--primary)" />
              <rect x="6" y="19" width="38" height="2" fill="rgba(255,255,255,.25)" />
              {[34, 49, 64, 79].map((y, index) => (
                <rect
                  key={y}
                  className={index === column ? "kwant-home-pulse" : undefined}
                  style={index === column ? pulseDelay(column, 0.8) : undefined}
                  x="6"
                  y={y}
                  width={38 - index * 4}
                  height="6"
                  fill={index === column ? "color-mix(in srgb, var(--primary) 35%, transparent)" : "rgba(255,255,255,.06)"}
                />
              ))}
            </g>
          ))}
        </>
      );
      break;
    case "zyon":
      content = (
        <>
          <circle className="kwant-home-pulse-soft" cx="31" cy="29" r="13" fill="none" stroke="var(--primary)" strokeWidth="1.5" />
          <circle className="kwant-home-pulse" cx="31" cy="29" r="6" fill="var(--primary)" opacity=".5" />
          <rect x="53" y="14" width="108" height="25" rx="3" fill="rgba(255,255,255,.055)" stroke="rgba(255,255,255,.1)" />
          <rect x="15" y="51" width="124" height="22" rx="3" fill="color-mix(in srgb, var(--primary) 14%, transparent)" stroke="color-mix(in srgb, var(--primary) 35%, transparent)" />
          <rect x="42" y="84" width="119" height="18" rx="3" fill="rgba(255,255,255,.045)" />
          <g fill="rgba(255,255,255,.4)">
            <rect x="60" y="22" width="75" height="2" />
            <rect x="22" y="59" width="92" height="2" />
          </g>
          <g fill="rgba(255,255,255,.55)">
            {[0, 1, 2].map((index) => (
              <circle
                key={index}
                className="kwant-home-typing"
                style={pulseDelay(index, 0.22)}
                cx={54 + index * 8}
                cy="93"
                r="1.8"
              />
            ))}
          </g>
        </>
      );
      break;
    case "news":
      content = (
        <>
          {[0, 1, 2, 3].map((row) => (
            <g key={row} transform={`translate(7 ${8 + row * 25})`}>
              <rect width="162" height="20" fill="rgba(255,255,255,.025)" stroke="rgba(255,255,255,.08)" />
              <circle
                className={row === 1 ? "kwant-home-live-dot" : undefined}
                cx="10"
                cy="10"
                r="3"
                fill={row === 1 ? "var(--primary)" : "rgba(255,255,255,.28)"}
              />
              <rect x="20" y="6" width={54 + row * 12} height="3" fill="rgba(255,255,255,.42)" />
              <rect x="20" y="12" width="92" height="2" fill="rgba(255,255,255,.13)" />
              <rect
                className={row === 1 ? "kwant-home-pulse" : undefined}
                x="139"
                y="6"
                width="16"
                height="8"
                fill={row === 1 ? "var(--primary)" : "rgba(255,255,255,.08)"}
                opacity=".7"
              />
            </g>
          ))}
        </>
      );
      break;
    case "socials":
      content = (
        <>
          <rect x="8" y="7" width="102" height="98" fill="rgba(255,255,255,.025)" stroke="rgba(255,255,255,.1)" />
          <circle cx="22" cy="22" r="7" fill="var(--primary)" opacity=".55" />
          <rect x="34" y="17" width="47" height="3" fill="rgba(255,255,255,.45)" />
          <rect x="16" y="37" width="86" height="40" fill="color-mix(in srgb, var(--primary) 10%, transparent)" />
          <path className="kwant-home-draw" d="M20 68 L33 57 46 62 61 48 76 55 97 43" fill="none" stroke="var(--primary)" strokeDasharray="120" />
          <rect x="16" y="86" width="20" height="4" fill="rgba(255,255,255,.18)" />
          <rect x="44" y="86" width="20" height="4" fill="rgba(255,255,255,.18)" />
          <rect x="118" y="7" width="50" height="46" fill="rgba(255,255,255,.025)" stroke="rgba(255,255,255,.1)" />
          <rect x="118" y="59" width="50" height="46" fill="rgba(255,255,255,.025)" stroke="rgba(255,255,255,.1)" />
        </>
      );
      break;
    case "journal":
      content = (
        <>
          <PreviewGrid />
          <path
            className="kwant-home-draw"
            d="M6 86 L24 79 41 82 59 61 78 66 97 45 114 50 132 31 151 37 170 18"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2"
            strokeDasharray="260"
          />
          <path d="M6 86 L24 79 41 82 59 61 78 66 97 45 114 50 132 31 151 37 170 18 L170 106 L6 106 Z" fill="url(#homeJournalFade)" />
          <defs>
            <linearGradient id="homeJournalFade" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="var(--primary)" stopOpacity=".22" />
              <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
        </>
      );
      break;
    case "backtest":
      content = (
        <>
          <PreviewGrid />
          <CandleMotif />
          <g className="kwant-home-sweep">
            <line x1="20" y1="5" x2="20" y2="94" stroke="var(--primary)" strokeDasharray="3 3" />
            <circle cx="20" cy="48" r="4" fill="var(--primary)" />
          </g>
          <rect x="12" y="101" width="150" height="3" fill="rgba(255,255,255,.12)" />
          <rect className="kwant-home-progress" x="12" y="101" width="150" height="3" fill="var(--primary)" />
          <path d="M168 98 L174 102.5 168 107 Z" fill="var(--primary)" />
        </>
      );
      break;
    case "accounts":
      content = (
        <>
          {[0, 1, 2, 3].map((index) => (
            <g key={index} transform={`translate(${7 + (index % 2) * 84} ${7 + Math.floor(index / 2) * 52})`}>
              <rect width="78" height="45" fill="rgba(255,255,255,.025)" stroke="rgba(255,255,255,.1)" />
              <rect x="8" y="8" width="25" height="2" fill="rgba(255,255,255,.26)" />
              <rect
                className="kwant-home-pulse-soft"
                style={pulseDelay(index, 0.7)}
                x="8"
                y="18"
                width={42 + index * 4}
                height="6"
                fill={index === 0 || index === 3 ? "var(--primary)" : "rgba(255,255,255,.68)"}
                opacity=".75"
              />
              <path d={`M8 36 L22 ${34 - index * 2} 35 ${37 - index} 48 ${29 - index * 2} 68 ${25 - index}`} fill="none" stroke="var(--primary)" />
            </g>
          ))}
        </>
      );
      break;
  }

  return (
    <svg viewBox="0 0 176 112" preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
      {content}
    </svg>
  );
}

/** Which real index quote each launch tile surfaces in its corner chip. */
export const PREVIEW_QUOTE_SYMBOL: Partial<Record<HomeLaunchPreview, HomeLiveSymbol>> = {
  chart: "NDX",
  vue: "SPX",
  flow: "SPX",
  gamma: "VIX",
  gexmap: "SPX",
  liquidity: "NDX",
};
