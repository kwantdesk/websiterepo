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
            className="flex h-[19px] items-center gap-2 rounded-[3px] border border-[color-mix(in_srgb,var(--foreground)_10%,transparent)] bg-[color-mix(in_srgb,var(--background)_62%,transparent)] px-2 backdrop-blur-md"
          >
            <span
              className={status === "live" ? "kwant-home-live-dot h-1 w-1 rounded-full" : "h-1 w-1 rounded-full"}
              style={{ background: STATUS_DOT_COLOR[status] }}
            />
            <span className="w-7 text-[7px] font-semibold uppercase tracking-[0.16em] text-[color-mix(in_srgb,var(--foreground)_62%,transparent)]">
              {quote.snapshot.symbol}
            </span>
            <span className="flex-1 text-right font-mono text-[8.5px] leading-none text-[color-mix(in_srgb,var(--foreground)_88%,transparent)]">
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
        stroke="color-mix(in srgb, var(--foreground) 22%, transparent)"
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

const candleData = [
  [19, 42, 12, 49], [39, 33, 26, 45], [31, 55, 28, 59], [53, 47, 41, 58],
  [45, 63, 43, 68], [61, 57, 50, 65], [55, 72, 52, 76], [70, 66, 61, 75],
  [64, 79, 60, 82], [77, 69, 65, 81], [67, 84, 64, 88], [82, 76, 71, 87],
];

/** Structural candle illustration — carries no symbol or price labels. */
function CandleMotif({
  x = 0,
  y = 0,
  scale = 1,
}: {
  x?: number;
  y?: number;
  scale?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity=".85">
      {candleData.map(([open, close, low, high], index) => {
        const up = close >= open;
        const cx = 13 + index * 13;
        const top = 92 - Math.max(open, close);
        const height = Math.max(3, Math.abs(close - open));
        return (
          <g key={cx}>
            <line x1={cx + 3} y1={92 - high} x2={cx + 3} y2={92 - low} stroke={up ? "var(--candle-up)" : "var(--candle-down)"} strokeWidth="1" />
            <rect x={cx} y={top} width="6" height={height} fill={up ? "var(--candle-up)" : "var(--candle-down)"} />
          </g>
        );
      })}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Shared page-chrome pieces for the 3D lookalike renders               */
/* ------------------------------------------------------------------ */

/** Dense rows of muted text bars — reads as data without inventing values. */
function UiRows({
  x,
  y,
  width,
  count,
  gap = 6,
  height = 2,
  color = "color-mix(in srgb, var(--foreground) 15%, transparent)",
}: {
  x: number;
  y: number;
  width: number;
  count: number;
  gap?: number;
  height?: number;
  color?: string;
}) {
  return (
    <g fill={color}>
      {Array.from({ length: count }, (_, index) => (
        <rect
          key={index}
          x={x}
          y={y + index * gap}
          width={width * (0.55 + ((index * 37) % 45) / 100)}
          height={height}
        />
      ))}
    </g>
  );
}

/** Application chrome: top command bar, tab strip, and right-side rail. */
function PageChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <rect x="0" y="0" width="176" height="112" fill="var(--chart-background)" />
      <rect x="0" y="0" width="176" height="11" fill="var(--panel)" />
      <line x1="0" y1="11.4" x2="176" y2="11.4" stroke="color-mix(in srgb, var(--foreground) 9%, transparent)" strokeWidth=".8" />
      <circle cx="6" cy="5.5" r="1.3" fill="color-mix(in srgb, var(--foreground) 26%, transparent)" />
      <circle cx="11" cy="5.5" r="1.3" fill="color-mix(in srgb, var(--foreground) 18%, transparent)" />
      <circle cx="16" cy="5.5" r="1.3" fill="color-mix(in srgb, var(--foreground) 12%, transparent)" />
      <rect x="26" y="3" width="22" height="5" rx="1" fill="color-mix(in srgb, var(--primary) 32%, transparent)" />
      <rect x="52" y="3" width="17" height="5" rx="1" fill="color-mix(in srgb, var(--foreground) 8%, transparent)" />
      <rect x="73" y="3" width="17" height="5" rx="1" fill="color-mix(in srgb, var(--foreground) 8%, transparent)" />
      <rect x="94" y="3" width="17" height="5" rx="1" fill="color-mix(in srgb, var(--foreground) 8%, transparent)" />
      <rect x="157" y="3" width="13" height="5" rx="1" fill="color-mix(in srgb, var(--foreground) 13%, transparent)" />
      <rect x="166" y="12" width="10" height="100" fill="var(--panel)" />
      <line x1="166" y1="12" x2="166" y2="112" stroke="color-mix(in srgb, var(--foreground) 7%, transparent)" strokeWidth=".8" />
      {[18, 30, 42, 54, 66].map((y, index) => (
        <rect
          key={y}
          x="168.5"
          y={y}
          width="5"
          height="5"
          rx="1"
          fill={index === 0 ? "var(--primary)" : "color-mix(in srgb, var(--foreground) 16%, transparent)"}
          opacity={index === 0 ? 0.85 : 1}
        />
      ))}
      {children}
    </>
  );
}

function ChartAxes({ bottom = 104 }: { bottom?: number }) {
  return (
    <g>
      <line x1="152" y1="14" x2="152" y2={bottom} stroke="color-mix(in srgb, var(--foreground) 10%, transparent)" strokeWidth=".8" />
      {[22, 36, 50, 64, 78, 92].map((y) => (
        <g key={y}>
          <line x1="2" y1={y} x2="152" y2={y} stroke="var(--grid-color)" strokeWidth=".7" opacity=".55" />
          <rect x="155" y={y - 1.5} width="8" height="3" fill="color-mix(in srgb, var(--foreground) 14%, transparent)" />
        </g>
      ))}
      {[18, 46, 74, 102, 130].map((x) => (
        <rect key={x} x={x} y={bottom + 2} width="10" height="2.6" fill="color-mix(in srgb, var(--foreground) 12%, transparent)" />
      ))}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Per-page lookalike bodies                                           */
/* ------------------------------------------------------------------ */

function PageArt({ type, live }: { type: HomeLaunchPreview; live: HomeLiveIndices }) {
  switch (type) {
    case "home":
      return (
        <>
          <rect x="0" y="0" width="176" height="112" fill="var(--background)" />
          <path className="kwant-home-pulse-soft" d="M0 78 C28 72 42 52 66 62 S104 76 128 56 S158 50 176 58" fill="none" stroke="var(--primary)" strokeWidth="1.3" />
          <path className="kwant-home-pulse-soft" style={{ animationDelay: "1.4s" }} d="M0 90 C26 82 44 74 68 80 S112 90 138 74 S162 68 176 73" fill="none" stroke="color-mix(in srgb, var(--foreground) 24%, transparent)" />
          <path className="kwant-home-pulse-soft" style={{ animationDelay: "2.8s" }} d="M0 100 C30 94 48 88 72 92 S118 100 144 88 S166 82 176 85" fill="none" stroke="color-mix(in srgb, var(--foreground) 12%, transparent)" />
        </>
      );
    case "chart":
      return (
        <PageChrome>
          <ChartAxes />
          <rect x="4" y="15" width="14" height="4" rx="1" fill="color-mix(in srgb, var(--primary) 45%, transparent)" />
          <rect x="21" y="15" width="11" height="4" rx="1" fill="color-mix(in srgb, var(--foreground) 10%, transparent)" />
          <rect x="35" y="15" width="11" height="4" rx="1" fill="color-mix(in srgb, var(--foreground) 10%, transparent)" />
          {Array.from({ length: 30 }, (_, index) => (
            <rect
              key={index}
              x={4 + index * 5}
              y={104 - 2 - ((index * 29) % 9)}
              width="3.4"
              height={2 + ((index * 29) % 9)}
              fill={index % 3 ? "color-mix(in srgb, var(--foreground) 10%, transparent)" : "color-mix(in srgb, var(--primary) 30%, transparent)"}
            />
          ))}
          <LiveSparkline quote={live.NDX} x={4} y={22} width={146} height={68} gradientId="home3d-chart" />
        </PageChrome>
      );
    case "vue":
      return (
        <PageChrome>
          {[
            { x: 2, y: 14, w: 80, h: 48 },
            { x: 84, y: 14, w: 80, h: 48 },
            { x: 2, y: 64, w: 80, h: 46 },
            { x: 84, y: 64, w: 80, h: 46 },
          ].map((panel, index) => (
            <g key={index}>
              <rect x={panel.x} y={panel.y} width={panel.w} height={panel.h} fill="color-mix(in srgb, var(--background) 28%, transparent)" stroke="color-mix(in srgb, var(--foreground) 10%, transparent)" strokeWidth=".8" />
              <rect x={panel.x + 3} y={panel.y + 3} width="16" height="3" rx="1" fill={index === 0 ? "color-mix(in srgb, var(--primary) 45%, transparent)" : "color-mix(in srgb, var(--foreground) 14%, transparent)"} />
            </g>
          ))}
          <LiveSparkline quote={live.SPX} x={5} y={22} width={74} height={37} gradientId="home3d-vue-a" />
          <LiveSparkline quote={live.NDX} x={87} y={22} width={74} height={37} gradientId="home3d-vue-b" />
          <LiveSparkline quote={live.VIX} x={5} y={72} width={74} height={35} gradientId="home3d-vue-c" />
          <path d="M89 96 L98 90 106 93 116 84 126 88 138 78 150 82 160 74" fill="none" stroke="color-mix(in srgb, var(--foreground) 35%, transparent)" strokeWidth="1.1" />
        </PageChrome>
      );
    case "calendar":
      return (
        <PageChrome>
          {[0, 1, 2, 3, 4, 5, 6].map((column) => (
            <rect key={column} x={4 + column * 23} y="15" width="14" height="2.6" fill="color-mix(in srgb, var(--foreground) 18%, transparent)" />
          ))}
          {[0, 1, 2, 3].map((row) => [0, 1, 2, 3, 4, 5, 6].map((column) => {
            const accent = column === 3 || (row * 7 + column) % 9 === 4;
            return (
              <g key={`${row}-${column}`}>
                <rect
                  x={4 + column * 23}
                  y={21 + row * 22}
                  width="21"
                  height="20"
                  fill={accent ? "color-mix(in srgb, var(--primary) 16%, color-mix(in srgb, var(--foreground) 2%, transparent))" : "color-mix(in srgb, var(--foreground) 2%, transparent)"}
                  stroke={accent ? "color-mix(in srgb, var(--primary) 45%, transparent)" : "color-mix(in srgb, var(--foreground) 8%, transparent)"}
                  strokeWidth=".7"
                />
                <rect x={6 + column * 23} y={24 + row * 22} width="6" height="2" fill="color-mix(in srgb, var(--foreground) 22%, transparent)" />
                <rect
                  className={accent ? "kwant-home-pulse" : undefined}
                  x={6 + column * 23}
                  y={30 + row * 22}
                  width={8 + ((row * 7 + column) * 13) % 9}
                  height="3.4"
                  fill={accent ? "var(--primary)" : "color-mix(in srgb, var(--foreground) 14%, transparent)"}
                  opacity={accent ? 0.75 : 1}
                />
                {(row * 5 + column) % 4 === 1 && (
                  <rect x={6 + column * 23} y={35.4 + row * 22} width={5 + ((row + column) * 11) % 7} height="2.6" fill="color-mix(in srgb, var(--foreground) 10%, transparent)" />
                )}
              </g>
            );
          }))}
        </PageChrome>
      );
    case "flow":
      return (
        <PageChrome>
          <ChartAxes bottom={102} />
          <path d="M2 96 C22 90 34 62 56 68 S90 84 108 62 S140 36 152 30 L152 104 L2 104 Z" fill="color-mix(in srgb, var(--primary) 14%, transparent)" />
          <path className="kwant-home-flow" d="M2 96 C22 90 34 62 56 68 S90 84 108 62 S140 36 152 30" fill="none" stroke="var(--primary)" strokeWidth="1.6" strokeDasharray="7 9" />
          <path d="M2 78 C26 72 40 82 62 74 S96 46 116 56 S142 64 152 50" fill="none" stroke="color-mix(in srgb, var(--foreground) 40%, transparent)" strokeWidth="1" />
          <path d="M2 60 C28 56 46 64 70 58 S108 34 130 42 S148 48 152 40" fill="none" stroke="color-mix(in srgb, var(--foreground) 18%, transparent)" strokeWidth="1" />
          {[24, 52, 80, 108, 134].map((x, index) => (
            <circle key={x} className="kwant-home-pulse" style={{ animationDelay: `${index * 0.45}s` }} cx={x} cy={88 - index * 11} r={1.8 + index * 0.3} fill="var(--primary)" opacity=".7" />
          ))}
        </PageChrome>
      );
    case "gamma":
      return (
        <PageChrome>
          <line x1="82" y1="14" x2="82" y2="106" stroke="color-mix(in srgb, var(--foreground) 22%, transparent)" strokeWidth=".9" />
          {Array.from({ length: 12 }, (_, index) => {
            const width = [12, 20, 31, 44, 58, 66, 61, 49, 38, 27, 18, 10][index];
            const positive = index >= 5;
            return (
              <rect
                key={index}
                className="kwant-home-pulse"
                style={{ animationDelay: `${index * 0.22}s` }}
                x={positive ? 82 : 82 - width}
                y={15 + index * 7.6}
                width={width}
                height="5.2"
                fill={positive ? "var(--primary)" : "color-mix(in srgb, var(--foreground) 32%, transparent)"}
                opacity={0.42 + (width / 66) * 0.5}
              />
            );
          })}
          <path d="M30 104 C48 96 60 62 82 58 S128 40 148 22" fill="none" stroke="color-mix(in srgb, var(--primary) 70%, var(--foreground))" strokeWidth="1.2" opacity=".8" />
          <UiRows x={140} y={16} width={22} count={6} gap={5.4} />
        </PageChrome>
      );
    case "gexmap":
      return (
        <PageChrome>
          {[0, 1, 2].map((panel) => (
            <g key={panel} transform={`translate(${2 + panel * 55} 14)`}>
              <rect width="53" height="96" fill="color-mix(in srgb, var(--background) 26%, transparent)" stroke="color-mix(in srgb, var(--foreground) 9%, transparent)" strokeWidth=".8" />
              <rect x="3" y="3" width="20" height="3.4" rx="1" fill={panel === 0 ? "color-mix(in srgb, var(--primary) 50%, transparent)" : "color-mix(in srgb, var(--foreground) 14%, transparent)"} />
              {Array.from({ length: 10 }, (_, row) => {
                const center = row === 5;
                const width = center ? 45 : 12 + ((row * 17 + panel * 7) % 30);
                return (
                  <g key={row}>
                    <rect x="3" y={10 + row * 8.6} width="10" height="2.6" fill="color-mix(in srgb, var(--foreground) 16%, transparent)" />
                    <rect
                      className={center ? "kwant-home-pulse" : undefined}
                      x="15"
                      y={9 + row * 8.6}
                      width={Math.min(width, 35)}
                      height="5"
                      fill={center ? "var(--primary)" : row % 2 ? "color-mix(in srgb, var(--primary) 34%, transparent)" : "color-mix(in srgb, var(--foreground) 10%, transparent)"}
                      opacity={center ? 0.85 : 0.72}
                    />
                  </g>
                );
              })}
            </g>
          ))}
        </PageChrome>
      );
    case "liquidity":
      return (
        <PageChrome>
          {Array.from({ length: 11 }, (_, index) => (
            <rect
              key={index}
              className="kwant-home-pulse-soft"
              style={{ animationDelay: `${index * 0.3}s` }}
              x="2"
              y={14 + index * 8.8}
              width="162"
              height={index % 4 === 0 ? 6.4 : 3.6}
              fill="var(--primary)"
              opacity={[0.08, 0.2, 0.1, 0.42, 0.14, 0.3, 0.09, 0.24, 0.12, 0.34, 0.1][index]}
            />
          ))}
          <path d="M2 70 L20 64 38 68 54 54 72 58 92 44 112 49 130 34 146 40 164 28" fill="none" stroke="color-mix(in srgb, var(--foreground) 85%, transparent)" strokeWidth="1.4" />
          {[[34, 66, 4], [76, 55, 7], [116, 46, 3.6], [146, 38, 8.5]].map(([x, y, r]) => (
            <circle key={x} cx={x} cy={y} r={r} fill="var(--primary)" opacity=".62" stroke="color-mix(in srgb, var(--foreground) 50%, transparent)" strokeWidth=".8" />
          ))}
        </PageChrome>
      );
    case "levels":
      return (
        <PageChrome>
          <ChartAxes />
          <CandleMotif x={16} y={12} scale={0.78} />
          {[[26, 0.35], [48, 0.75], [70, 0.45], [92, 0.9]].map(([y, opacity], index) => (
            <g key={y} className="kwant-home-pulse" style={{ animationDelay: `${index * 0.55}s` }}>
              <line x1="2" y1={y} x2="150" y2={y} stroke="var(--primary)" strokeWidth={opacity > 0.8 ? 1.6 : 1} opacity={opacity} strokeDasharray={opacity < 0.5 ? "3 3" : undefined} />
              <rect x="128" y={y - 4} width="22" height="8" rx="1" fill="var(--primary)" opacity={opacity} />
              <rect x="131" y={y - 1.4} width="16" height="2.6" fill="color-mix(in srgb, var(--background) 55%, transparent)" />
            </g>
          ))}
        </PageChrome>
      );
    case "gameplan":
      return (
        <PageChrome>
          {[0, 1, 2].map((column) => (
            <g key={column} transform={`translate(${3 + column * 54} 14)`}>
              <rect width="51" height="96" fill="color-mix(in srgb, var(--foreground) 2%, transparent)" stroke="color-mix(in srgb, var(--foreground) 9%, transparent)" strokeWidth=".8" />
              <rect x="4" y="4" width={24 + column * 5} height="3.4" fill="var(--primary)" opacity=".8" />
              <rect x="4" y="12" width="40" height="2" fill="color-mix(in srgb, var(--foreground) 20%, transparent)" />
              {[19, 44, 69].map((cardY, cardIndex) => {
                const active = cardIndex === column;
                return (
                  <g key={cardY}>
                    <rect
                      x="4"
                      y={cardY}
                      width="43"
                      height="21"
                      rx="1.5"
                      fill={active ? "color-mix(in srgb, var(--primary) 14%, color-mix(in srgb, var(--foreground) 2%, transparent))" : "color-mix(in srgb, var(--foreground) 4%, transparent)"}
                      stroke={active ? "color-mix(in srgb, var(--primary) 45%, transparent)" : "color-mix(in srgb, var(--foreground) 8%, transparent)"}
                      strokeWidth=".7"
                    />
                    <circle cx="10" cy={cardY + 6} r="2.2" fill="none" stroke={active ? "var(--primary)" : "color-mix(in srgb, var(--foreground) 30%, transparent)"} strokeWidth=".9" />
                    {active && <path d={`M8.8 ${cardY + 6} l1 1.2 2-2.6`} fill="none" stroke="var(--primary)" strokeWidth=".9" />}
                    <rect x="15" y={cardY + 4.4} width={26 - cardIndex * 4} height="2.4" fill="color-mix(in srgb, var(--foreground) 32%, transparent)" />
                    <rect x="8" y={cardY + 11} width="33" height="2" fill="color-mix(in srgb, var(--foreground) 14%, transparent)" />
                    <rect x="8" y={cardY + 15.4} width={22 + cardIndex * 4} height="2" fill="color-mix(in srgb, var(--foreground) 10%, transparent)" />
                  </g>
                );
              })}
            </g>
          ))}
        </PageChrome>
      );
    case "zyon":
      return (
        <PageChrome>
          <rect x="96" y="14" width="68" height="96" fill="color-mix(in srgb, var(--background) 24%, transparent)" stroke="color-mix(in srgb, var(--foreground) 8%, transparent)" strokeWidth=".8" />
          <path d="M100 52 C110 48 116 34 126 38 S146 46 160 32" fill="none" stroke="var(--primary)" strokeWidth="1.1" opacity=".8" />
          <UiRows x={100} y={60} width={58} count={7} gap={6.4} />
          <circle className="kwant-home-pulse-soft" cx="16" cy="26" r="9" fill="none" stroke="var(--primary)" strokeWidth="1.2" />
          <circle className="kwant-home-pulse" cx="16" cy="26" r="4" fill="var(--primary)" opacity=".5" />
          <rect x="30" y="17" width="60" height="17" rx="2.5" fill="color-mix(in srgb, var(--foreground) 5%, transparent)" stroke="color-mix(in srgb, var(--foreground) 9%, transparent)" strokeWidth=".7" />
          <rect x="34" y="22" width="49" height="2.2" fill="color-mix(in srgb, var(--foreground) 34%, transparent)" />
          <rect x="34" y="27" width="38" height="2" fill="color-mix(in srgb, var(--foreground) 16%, transparent)" />
          <rect x="6" y="44" width="72" height="20" rx="2.5" fill="color-mix(in srgb, var(--primary) 13%, transparent)" stroke="color-mix(in srgb, var(--primary) 36%, transparent)" strokeWidth=".7" />
          <rect x="11" y="49" width="58" height="2.2" fill="color-mix(in srgb, var(--foreground) 40%, transparent)" />
          <rect x="11" y="54" width="45" height="2" fill="color-mix(in srgb, var(--foreground) 20%, transparent)" />
          <rect x="30" y="74" width="60" height="15" rx="2.5" fill="color-mix(in srgb, var(--foreground) 4%, transparent)" />
          <rect x="34" y="79" width="43" height="2.2" fill="color-mix(in srgb, var(--foreground) 30%, transparent)" />
          {[0, 1, 2].map((index) => (
            <circle key={index} className="kwant-home-typing" style={{ animationDelay: `${index * 0.22}s` }} cx={14 + index * 7} cy="100" r="1.7" fill="color-mix(in srgb, var(--foreground) 55%, transparent)" />
          ))}
        </PageChrome>
      );
    case "news":
      return (
        <PageChrome>
          {[0, 1, 2, 3, 4].map((row) => {
            const hot = row === 1;
            return (
              <g key={row} transform={`translate(3 ${14 + row * 19.4})`}>
                <rect width="161" height="17.4" fill={hot ? "color-mix(in srgb, var(--primary) 8%, color-mix(in srgb, var(--foreground) 2%, transparent))" : "color-mix(in srgb, var(--foreground) 2%, transparent)"} stroke={hot ? "color-mix(in srgb, var(--primary) 35%, transparent)" : "color-mix(in srgb, var(--foreground) 7%, transparent)"} strokeWidth=".7" />
                <rect x="4" y="5" width="12" height="3" fill="color-mix(in srgb, var(--foreground) 24%, transparent)" />
                <circle className={hot ? "kwant-home-live-dot" : undefined} cx="24" cy="8.7" r="2.4" fill={hot ? "var(--primary)" : "color-mix(in srgb, var(--foreground) 20%, transparent)"} />
                <rect x="31" y="4" width={62 + (row * 23) % 40} height="2.6" fill="color-mix(in srgb, var(--foreground) 40%, transparent)" />
                <rect x="31" y="10" width="84" height="2" fill="color-mix(in srgb, var(--foreground) 13%, transparent)" />
                <rect x="141" y="4.6" width="15" height="7.4" rx="1" fill={hot ? "var(--primary)" : "color-mix(in srgb, var(--foreground) 8%, transparent)"} opacity={hot ? 0.75 : 1} />
              </g>
            );
          })}
        </PageChrome>
      );
    case "socials":
      return (
        <PageChrome>
          <rect x="3" y="14" width="102" height="96" fill="color-mix(in srgb, var(--foreground) 2%, transparent)" stroke="color-mix(in srgb, var(--foreground) 9%, transparent)" strokeWidth=".8" />
          <circle cx="14" cy="26" r="6" fill="var(--primary)" opacity=".55" />
          <rect x="24" y="21" width="38" height="3" fill="color-mix(in srgb, var(--foreground) 40%, transparent)" />
          <rect x="24" y="27" width="24" height="2.2" fill="color-mix(in srgb, var(--foreground) 16%, transparent)" />
          <rect x="9" y="38" width="90" height="42" fill="color-mix(in srgb, var(--primary) 9%, transparent)" stroke="color-mix(in srgb, var(--foreground) 6%, transparent)" strokeWidth=".7" />
          <path className="kwant-home-draw" d="M14 72 L28 60 42 65 58 48 74 55 94 42" fill="none" stroke="var(--primary)" strokeWidth="1.3" strokeDasharray="120" />
          <rect x="9" y="86" width="18" height="4" rx="1" fill="color-mix(in srgb, var(--foreground) 14%, transparent)" />
          <rect x="31" y="86" width="18" height="4" rx="1" fill="color-mix(in srgb, var(--foreground) 14%, transparent)" />
          <rect x="53" y="86" width="18" height="4" rx="1" fill="color-mix(in srgb, var(--foreground) 14%, transparent)" />
          <UiRows x={9} y={96} width={86} count={2} gap={5.6} />
          {[14, 64].map((y, index) => (
            <g key={y}>
              <rect x="109" y={y} width="55" height="46" fill="color-mix(in srgb, var(--foreground) 2%, transparent)" stroke="color-mix(in srgb, var(--foreground) 9%, transparent)" strokeWidth=".8" />
              <circle cx="118" cy={y + 9} r="4" fill={index === 0 ? "var(--primary)" : "color-mix(in srgb, var(--foreground) 30%, transparent)"} opacity=".6" />
              <rect x="126" y={y + 7} width="26" height="2.6" fill="color-mix(in srgb, var(--foreground) 32%, transparent)" />
              <UiRows x={113} y={y + 18} width={46} count={4} gap={6.4} />
            </g>
          ))}
        </PageChrome>
      );
    case "journal":
      return (
        <PageChrome>
          {[0, 1, 2, 3].map((index) => (
            <g key={index} transform={`translate(${3 + index * 41} 14)`}>
              <rect width="38" height="20" fill="color-mix(in srgb, var(--foreground) 2%, transparent)" stroke="color-mix(in srgb, var(--foreground) 8%, transparent)" strokeWidth=".7" />
              <rect x="4" y="4" width="16" height="2.2" fill="color-mix(in srgb, var(--foreground) 22%, transparent)" />
              <rect x="4" y="10" width={20 + (index * 7) % 12} height="4.6" fill={index % 2 ? "color-mix(in srgb, var(--foreground) 50%, transparent)" : "var(--primary)"} opacity=".75" />
            </g>
          ))}
          <ChartAxes bottom={106} />
          <path
            className="kwant-home-draw"
            d="M4 100 L20 92 36 95 52 76 68 80 84 60 100 65 116 45 132 50 150 30"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="1.8"
            strokeDasharray="260"
          />
          <path d="M4 100 L20 92 36 95 52 76 68 80 84 60 100 65 116 45 132 50 150 30 L150 106 L4 106 Z" fill="url(#home3dJournalFade)" />
          <defs>
            <linearGradient id="home3dJournalFade" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="var(--primary)" stopOpacity=".2" />
              <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
        </PageChrome>
      );
    case "backtest":
      return (
        <PageChrome>
          <ChartAxes bottom={92} />
          <CandleMotif x={10} y={6} scale={0.82} />
          <g className="kwant-home-sweep">
            <line x1="18" y1="14" x2="18" y2="90" stroke="var(--primary)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx="18" cy="50" r="3.2" fill="var(--primary)" />
          </g>
          <rect x="3" y="98" width="161" height="10" rx="1.5" fill="color-mix(in srgb, var(--foreground) 3%, transparent)" stroke="color-mix(in srgb, var(--foreground) 8%, transparent)" strokeWidth=".7" />
          <path d="M9 100.6 L14 103 9 105.4 Z" fill="var(--primary)" />
          <rect x="19" y="102" width="120" height="2.4" fill="color-mix(in srgb, var(--foreground) 12%, transparent)" />
          <rect className="kwant-home-progress" x="19" y="102" width="120" height="2.4" fill="var(--primary)" />
          <rect x="144" y="100.6" width="8" height="4.8" rx="1" fill="color-mix(in srgb, var(--foreground) 14%, transparent)" />
          <rect x="154" y="100.6" width="8" height="4.8" rx="1" fill="color-mix(in srgb, var(--foreground) 14%, transparent)" />
        </PageChrome>
      );
    case "accounts":
      return (
        <PageChrome>
          {[0, 1, 2, 3].map((index) => (
            <g key={index} transform={`translate(${3 + (index % 2) * 82} ${14 + Math.floor(index / 2) * 49})`}>
              <rect width="79" height="46" fill="color-mix(in srgb, var(--foreground) 2%, transparent)" stroke="color-mix(in srgb, var(--foreground) 9%, transparent)" strokeWidth=".8" />
              <rect x="5" y="5" width="22" height="2.4" fill="color-mix(in srgb, var(--foreground) 24%, transparent)" />
              <rect x="60" y="4" width="14" height="5" rx="1" fill={index === 0 ? "color-mix(in srgb, var(--primary) 45%, transparent)" : "color-mix(in srgb, var(--foreground) 8%, transparent)"} />
              <rect
                className="kwant-home-pulse-soft"
                style={{ animationDelay: `${index * 0.6}s` }}
                x="5"
                y="13"
                width={36 + index * 4}
                height="6"
                fill={index === 0 || index === 3 ? "var(--primary)" : "color-mix(in srgb, var(--foreground) 60%, transparent)"}
                opacity=".75"
              />
              <path d={`M5 38 L20 ${35 - index * 2} 34 ${39 - index} 48 ${31 - index * 2} 62 ${33 - index} 74 ${26 - index}`} fill="none" stroke="var(--primary)" strokeWidth="1" opacity=".8" />
              <line x1="5" y1="41.5" x2="74" y2="41.5" stroke="color-mix(in srgb, var(--foreground) 8%, transparent)" strokeWidth=".7" />
            </g>
          ))}
        </PageChrome>
      );
  }
}

/* ------------------------------------------------------------------ */
/* Floating detail card per page                                       */
/* ------------------------------------------------------------------ */

function FloatArt({ type }: { type: HomeLaunchPreview }) {
  switch (type) {
    case "home":
      return null;
    case "chart":
      return (
        <>
          {[[6, 14, 26, 10], [16, 24, 34, 18], [26, 18, 30, 12], [36, 10, 22, 6], [46, 16, 28, 9]].map(([x, top, low, bodyTop]) => (
            <g key={x}>
              <line x1={x + 2.5} y1={top} x2={x + 2.5} y2={low} stroke="var(--primary)" strokeWidth=".9" />
              <rect x={x} y={bodyTop + 4} width="5" height="9" fill={x % 20 === 6 ? "var(--primary)" : "color-mix(in srgb, var(--foreground) 82%, transparent)"} />
            </g>
          ))}
          <line x1="2" y1="20" x2="62" y2="20" stroke="color-mix(in srgb, var(--foreground) 25%, transparent)" strokeWidth=".6" strokeDasharray="2 2" />
          <line x1="41" y1="4" x2="41" y2="40" stroke="color-mix(in srgb, var(--foreground) 25%, transparent)" strokeWidth=".6" strokeDasharray="2 2" />
        </>
      );
    case "vue":
      return (
        <>
          <rect x="3" y="4" width="58" height="17" rx="1.5" fill="color-mix(in srgb, var(--background) 30%, transparent)" stroke="color-mix(in srgb, var(--foreground) 12%, transparent)" strokeWidth=".7" />
          <path d="M6 17 L15 11 24 14 33 8 42 11 51 6 58 8" fill="none" stroke="var(--primary)" strokeWidth="1.1" />
          <rect x="3" y="24" width="58" height="16" rx="1.5" fill="color-mix(in srgb, var(--background) 30%, transparent)" stroke="color-mix(in srgb, var(--foreground) 12%, transparent)" strokeWidth=".7" />
          <path d="M6 36 L15 32 24 34 33 28 42 31 51 26 58 28" fill="none" stroke="color-mix(in srgb, var(--foreground) 50%, transparent)" strokeWidth="1" />
        </>
      );
    case "calendar":
      return (
        <>
          <rect x="8" y="6" width="48" height="32" rx="2" fill="color-mix(in srgb, var(--primary) 12%, transparent)" stroke="color-mix(in srgb, var(--primary) 50%, transparent)" strokeWidth=".8" />
          <rect x="13" y="11" width="12" height="3" fill="color-mix(in srgb, var(--foreground) 40%, transparent)" />
          <rect x="13" y="19" width="26" height="5" fill="var(--primary)" opacity=".8" />
          <rect x="13" y="28" width="18" height="3" fill="color-mix(in srgb, var(--foreground) 20%, transparent)" />
          <circle cx="48" cy="13" r="2.4" fill="var(--primary)" className="kwant-home-live-dot" />
        </>
      );
    case "flow":
      return (
        <>
          <path d="M6 36 C18 32 24 16 38 20 S52 26 56 12" fill="none" stroke="var(--primary)" strokeWidth="1.6" />
          <path d="M56 12 l-4.6 1 2.6 4z" fill="var(--primary)" />
          <path d="M6 28 C20 24 30 30 42 24" fill="none" stroke="color-mix(in srgb, var(--foreground) 40%, transparent)" strokeWidth="1" />
        </>
      );
    case "gamma":
      return (
        <>
          <line x1="32" y1="4" x2="32" y2="40" stroke="color-mix(in srgb, var(--foreground) 30%, transparent)" strokeWidth=".8" />
          {[[10, 6], [16, 12], [26, 18], [22, 24], [14, 30]].map(([width, y], index) => (
            <rect key={y} x={index < 2 ? 32 - width : 32} y={y} width={width} height="4.4" fill={index < 2 ? "color-mix(in srgb, var(--foreground) 40%, transparent)" : "var(--primary)"} opacity=".85" />
          ))}
        </>
      );
    case "gexmap":
      return (
        <>
          {[6, 14, 22, 30].map((y, index) => (
            <g key={y}>
              <rect x="6" y={y} width="9" height="3" fill="color-mix(in srgb, var(--foreground) 30%, transparent)" />
              <rect x="18" y={y - 1} width={index === 2 ? 40 : 14 + index * 6} height="5.4" fill={index === 2 ? "var(--primary)" : "color-mix(in srgb, var(--primary) 35%, transparent)"} opacity={index === 2 ? 0.9 : 0.7} />
            </g>
          ))}
        </>
      );
    case "liquidity":
      return (
        <>
          <circle cx="32" cy="22" r="13" fill="var(--primary)" opacity=".28" />
          <circle cx="32" cy="22" r="8" fill="var(--primary)" opacity=".5" />
          <circle cx="32" cy="22" r="3.4" fill="var(--primary)" />
          <circle className="kwant-home-pulse-soft" cx="32" cy="22" r="16.5" fill="none" stroke="var(--primary)" strokeWidth=".8" />
        </>
      );
    case "levels":
      return (
        <>
          <line x1="4" y1="22" x2="60" y2="22" stroke="var(--primary)" strokeWidth="1.4" />
          <rect x="36" y="14" width="24" height="12" rx="1.5" fill="var(--primary)" opacity=".9" />
          <rect x="40" y="18.5" width="16" height="3" fill="color-mix(in srgb, var(--background) 55%, transparent)" />
          <line x1="4" y1="34" x2="60" y2="34" stroke="color-mix(in srgb, var(--foreground) 35%, transparent)" strokeWidth=".9" strokeDasharray="3 3" />
        </>
      );
    case "gameplan":
      return (
        <>
          {[7, 19, 31].map((y, index) => (
            <g key={y}>
              <circle cx="10" cy={y + 3} r="3" fill="none" stroke={index < 2 ? "var(--primary)" : "color-mix(in srgb, var(--foreground) 30%, transparent)"} strokeWidth="1" />
              {index < 2 && <path d={`M8.4 ${y + 3} l1.3 1.5 2.6-3.2`} fill="none" stroke="var(--primary)" strokeWidth="1" />}
              <rect x="18" y={y + 1} width={38 - index * 8} height="3.4" fill={index < 2 ? "color-mix(in srgb, var(--foreground) 45%, transparent)" : "color-mix(in srgb, var(--foreground) 20%, transparent)"} />
            </g>
          ))}
        </>
      );
    case "zyon":
      return (
        <>
          <rect x="6" y="8" width="52" height="22" rx="4" fill="color-mix(in srgb, var(--primary) 16%, transparent)" stroke="color-mix(in srgb, var(--primary) 45%, transparent)" strokeWidth=".8" />
          <path d="M14 30 L14 36 22 30" fill="color-mix(in srgb, var(--primary) 16%, transparent)" stroke="color-mix(in srgb, var(--primary) 45%, transparent)" strokeWidth=".8" />
          {[0, 1, 2].map((index) => (
            <circle key={index} className="kwant-home-typing" style={{ animationDelay: `${index * 0.22}s` }} cx={24 + index * 8} cy="19" r="2" fill="color-mix(in srgb, var(--foreground) 70%, transparent)" />
          ))}
        </>
      );
    case "news":
      return (
        <>
          <circle className="kwant-home-live-dot" cx="10" cy="10" r="3.4" fill="var(--primary)" />
          <rect x="18" y="7.4" width="38" height="4.6" fill="color-mix(in srgb, var(--foreground) 50%, transparent)" />
          <rect x="8" y="20" width="48" height="3" fill="color-mix(in srgb, var(--foreground) 25%, transparent)" />
          <rect x="8" y="27" width="40" height="3" fill="color-mix(in srgb, var(--foreground) 16%, transparent)" />
          <rect x="8" y="34" width="30" height="3" fill="color-mix(in srgb, var(--foreground) 10%, transparent)" />
        </>
      );
    case "socials":
      return (
        <>
          <circle cx="13" cy="12" r="5.4" fill="var(--primary)" opacity=".6" />
          <rect x="22" y="8" width="28" height="3.4" fill="color-mix(in srgb, var(--foreground) 40%, transparent)" />
          <rect x="22" y="14" width="18" height="2.6" fill="color-mix(in srgb, var(--foreground) 20%, transparent)" />
          <path d="M8 34 L20 27 30 30 42 22 54 26" fill="none" stroke="var(--primary)" strokeWidth="1.3" />
        </>
      );
    case "journal":
      return (
        <>
          <path d="M6 36 L18 30 28 32 40 20 50 23 58 10" fill="none" stroke="var(--primary)" strokeWidth="1.6" />
          <circle className="kwant-home-live-dot" cx="58" cy="10" r="2.6" fill="var(--primary)" />
          <rect x="6" y="4" width="18" height="4" fill="color-mix(in srgb, var(--foreground) 30%, transparent)" />
        </>
      );
    case "backtest":
      return (
        <>
          <path d="M22 12 L36 20 22 28 Z" fill="var(--primary)" />
          <circle cx="28" cy="20" r="13.5" fill="none" stroke="color-mix(in srgb, var(--primary) 55%, transparent)" strokeWidth="1.2" />
          <rect x="44" y="18" width="14" height="3.4" fill="color-mix(in srgb, var(--foreground) 30%, transparent)" />
        </>
      );
    case "accounts":
      return (
        <>
          <rect x="6" y="8" width="26" height="6" fill="var(--primary)" opacity=".8" />
          <rect x="6" y="18" width="18" height="3" fill="color-mix(in srgb, var(--foreground) 28%, transparent)" />
          <path d="M6 34 L18 30 28 32 40 25 52 28 58 22" fill="none" stroke="var(--primary)" strokeWidth="1.2" />
        </>
      );
  }
}

/**
 * Professional 3D lookalike render of a workspace page: a perspective-tilted
 * page plane with dense UI chrome, a floating detail card lifted above it,
 * and a floor glow. Chart tiles embed the real shared-index sparklines, so
 * the render is both an illustration and genuinely live.
 */
export function HomeWorkspacePreview({
  type,
  live,
}: {
  type: HomeLaunchPreview;
  live: HomeLiveIndices;
}) {
  const floatContent = FloatArt({ type });
  return (
    <div className="kwant-home-scene" aria-hidden="true">
      <div className="kwant-home-scene-glow" />
      <div className="kwant-home-plane-base">
        <svg viewBox="0 0 176 112" preserveAspectRatio="none" className="h-full w-full">
          <PageArt type={type} live={live} />
        </svg>
      </div>
      {floatContent && (
        <div className="kwant-home-plane-float">
          <svg viewBox="0 0 64 44" preserveAspectRatio="xMidYMid meet" className="h-full w-full">
            {floatContent}
          </svg>
        </div>
      )}
    </div>
  );
}
