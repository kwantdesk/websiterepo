"use client";

import {
  CalendarClock,
  GitCompareArrows,
  Layers3,
  Pause,
  Play,
  Radio,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import KwantSelect from "@/components/ui/KwantSelect";
import type {
  GexDeskHistoryPayload,
  GexDeskOptionPrint,
  GexDeskPayload,
  GexDeskSourceSymbol,
} from "@/lib/gexDesk";

type SourceFilter = "COMBINED" | GexDeskSourceSymbol;
type ExpiryKey = "zero" | "one";
type MetricKey = "dex" | "gex" | "convexity";
type Aggregation = 5_000 | 15_000 | 30_000 | 60_000 | 300_000;
type GexUnit = "DOLLAR_1PCT" | "SHARE_POINT";
type Structure = "LONG_CALL" | "SHORT_PUT" | "LONG_PUT" | "SHORT_CALL";

type FlowValues = {
  dex: number;
  gex: number;
  convexity: number;
};

type FlowBucket = {
  timestamp: number;
  zero: FlowValues;
  one: FlowValues;
  price: number | null;
};

type Contribution = {
  id: string;
  timestamp: number;
  expiry: ExpiryKey;
  source: GexDeskSourceSymbol;
  strike: number;
  mappedPrice: number;
  confidence: number;
  structure: Structure;
  dex: number;
  gex: number;
  convexity: number;
};

const AGGREGATIONS: Array<{ value: Aggregation; label: string }> = [
  { value: 5_000, label: "5s" },
  { value: 15_000, label: "15s" },
  { value: 30_000, label: "30s" },
  { value: 60_000, label: "1m" },
  { value: 300_000, label: "5m" },
];
const METRICS: Array<{ key: MetricKey; label: string }> = [
  { key: "dex", label: "DEX" },
  { key: "gex", label: "GEX" },
  { key: "convexity", label: "CONVEXITY" },
];
const VISIBLE_BUCKETS = 54;
const SVG_WIDTH = 1_180;
const SVG_HEIGHT = 580;
const PRICE_LEFT = 54;
const PRICE_RIGHT = 1_126;
const PRICE_TOP = 26;
const PRICE_BOTTOM = 145;
const COLUMN_LEFTS = { zero: 54, one: 620 } as const;
const COLUMN_WIDTH = 506;
const ROW_TOPS = { dex: 180, gex: 302, convexity: 424 } as const;
const ROW_HEIGHT = 102;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function safeTimestamp(value: number) {
  if (!Number.isFinite(value) || value <= 0) return null;
  return value < 10_000_000_000 ? value * 1_000 : value;
}

function nextBusinessDate(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  do value.setUTCDate(value.getUTCDate() + 1);
  while (value.getUTCDay() === 0 || value.getUTCDay() === 6);
  return value.toISOString().slice(0, 10);
}

function expiryFor(
  print: GexDeskOptionPrint,
  sessionDate: string,
  nextListedExpiry: string,
): ExpiryKey | null {
  if (print.expiration === sessionDate) return "zero";
  if (print.expiration === nextListedExpiry) return "one";
  const dte = Number(print.dte);
  if (Number.isFinite(dte) && dte >= 0 && dte < 0.5) return "zero";
  if (Number.isFinite(dte) && dte >= 0.5 && dte < 1.5) return "one";
  return null;
}

function structureFor(print: GexDeskOptionPrint): Structure | null {
  if (print.side === "MID") return null;
  if (print.contractType === "CALL") return print.side === "BOUGHT" ? "LONG_CALL" : "SHORT_CALL";
  return print.side === "BOUGHT" ? "LONG_PUT" : "SHORT_PUT";
}

function directionalSign(structure: Structure) {
  return structure === "LONG_CALL" || structure === "SHORT_PUT" ? 1 : -1;
}

function emptyValues(): FlowValues {
  return { dex: 0, gex: 0, convexity: 0 };
}

function compact(value: number) {
  const absolute = Math.abs(value);
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  if (absolute >= 1_000_000_000) return `${sign}${(absolute / 1_000_000_000).toFixed(1)}B`;
  if (absolute >= 1_000_000) return `${sign}${(absolute / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `${sign}${(absolute / 1_000).toFixed(1)}K`;
  return `${sign}${absolute.toFixed(0)}`;
}

function priceLabel(value: number | null | undefined) {
  return Number.isFinite(Number(value))
    ? Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "—";
}

function timeLabel(timestamp: number, includeSeconds: boolean) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    second: includeSeconds ? "2-digit" : undefined,
    hour12: false,
  }).format(new Date(timestamp));
}

function nearestHistoryPrice(history: GexDeskHistoryPayload | null, timestamp: number) {
  if (!history?.timestamps.length || !history.nqPrices.length) return null;
  let low = 0;
  let high = history.timestamps.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const middleTime = safeTimestamp(Number(history.timestamps[middle])) ?? 0;
    if (middleTime < timestamp) low = middle + 1;
    else high = middle;
  }
  const candidates = [low, low - 1].filter((index) => index >= 0 && index < history.timestamps.length);
  const nearest = candidates.sort((left, right) => {
    const leftTime = safeTimestamp(Number(history.timestamps[left])) ?? 0;
    const rightTime = safeTimestamp(Number(history.timestamps[right])) ?? 0;
    return Math.abs(leftTime - timestamp) - Math.abs(rightTime - timestamp);
  })[0];
  const price = Number(history.nqPrices[nearest]);
  return Number.isFinite(price) ? price : null;
}

function linePath(points: Array<{ x: number; y: number | null }>) {
  let drawing = false;
  return points.map((point) => {
    if (point.y === null || !Number.isFinite(point.y)) {
      drawing = false;
      return "";
    }
    const command = drawing ? "L" : "M";
    drawing = true;
    return `${command}${point.x.toFixed(2)},${point.y.toFixed(2)}`;
  }).filter(Boolean).join(" ");
}

function relation(left: number, right: number) {
  if (left === 0 || right === 0) return "NO CONFIRMATION";
  if (Math.sign(left) === Math.sign(right)) return left > 0 ? "POSITIVE AGREEMENT" : "NEGATIVE AGREEMENT";
  return "DIVERGENT";
}

function structureLabel(dex: number, convexity: number) {
  if (dex === 0 || convexity === 0) return "Balanced";
  if (dex > 0 && convexity > 0) return "Long Call";
  if (dex > 0 && convexity < 0) return "Short Put";
  if (dex < 0 && convexity > 0) return "Long Put";
  return "Short Call";
}

function directionLabel(value: number) {
  return value > 0 ? "Bullish" : value < 0 ? "Bearish" : "Balanced";
}

function volatilityLabel(value: number) {
  return value > 0 ? "Long volatility" : value < 0 ? "Short volatility" : "Balanced";
}

function sessionPhase(marketOpen: boolean) {
  if (!marketOpen) return "Closed / EOD";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const total = hour * 60 + minute;
  if (total < 690) return "Early session";
  if (total < 870) return "Midday";
  return "Late day";
}

function MetricSummary({
  label,
  zero,
  one,
}: {
  label: string;
  zero: number;
  one: number;
}) {
  const gross = Math.abs(zero) + Math.abs(one);
  const zeroShare = gross > 0 ? Math.abs(zero) / gross : 0.5;
  return (
    <div className="rounded-xl border border-border bg-surface/55 p-2">
      <div className="flex items-center justify-between text-[6px] font-semibold uppercase tracking-[0.12em] text-muted">
        <span>{label}</span>
        <span className={relation(zero, one) === "DIVERGENT" ? "text-accent" : "text-primary"}>
          {relation(zero, one)}
        </span>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-2 font-mono text-[8px]">
        <span className="text-foreground">0DTE {compact(zero)}</span>
        <span className="text-muted">1DTE {compact(one)}</span>
      </div>
      <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-background">
        <span className="bg-primary" style={{ width: `${zeroShare * 100}%` }} />
        <span className="border-l border-foreground/25 bg-foreground/25" style={{ width: `${(1 - zeroShare) * 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[5.5px] text-muted">
        <span>0DTE {(zeroShare * 100).toFixed(0)}%</span>
        <span>1DTE {((1 - zeroShare) * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

export default function ExpiryOrderflowComparison({
  payload,
  history,
  livePrice,
  sourceFilter,
  onSourceFilterChange,
}: {
  payload: GexDeskPayload;
  history: GexDeskHistoryPayload | null;
  livePrice: number | null;
  sourceFilter: SourceFilter;
  onSourceFilterChange: (source: SourceFilter) => void;
}) {
  const [aggregation, setAggregation] = useState<Aggregation>(15_000);
  const [gexUnit, setGexUnit] = useState<GexUnit>("DOLLAR_1PCT");
  const [minimumConfidence, setMinimumConfidence] = useState("0.50");
  const [selectedIndex, setSelectedIndex] = useState(VISIBLE_BUCKETS - 1);
  const [playing, setPlaying] = useState(false);

  const contributions = useMemo(() => {
    const rows: Contribution[] = [];
    const minimum = Number(minimumConfidence);
    const nextListedExpiry = [...new Set(
      (payload.optionsTape ?? [])
        .map((print) => print.expiration)
        .filter((expiration): expiration is string => Boolean(expiration && expiration > payload.sessionDate)),
    )].sort()[0] ?? nextBusinessDate(payload.sessionDate);
    for (const print of payload.optionsTape ?? []) {
      if (sourceFilter !== "COMBINED" && print.source !== sourceFilter) continue;
      const expiry = expiryFor(print, payload.sessionDate, nextListedExpiry);
      const structure = structureFor(print);
      const timestamp = safeTimestamp(Number(print.timestamp));
      const contracts = Number(print.size);
      const confidence = clamp(Number(print.confidence) || 0, 0, 1);
      if (!expiry || !structure || timestamp === null || !Number.isFinite(contracts) || contracts <= 0) continue;
      if (confidence < minimum) continue;
      const delta = Number(print.optionDelta);
      const gamma = Number(print.optionGamma);
      const spot = Number(print.underlyingPrice);
      const validDelta = Number.isFinite(delta) && Math.abs(delta) > 0 && Math.abs(delta) <= 1.001;
      const validGamma = Number.isFinite(gamma) && gamma > 0;
      const shareGamma = validGamma ? gamma * contracts * 100 : 0;
      const dollarGamma = validGamma && Number.isFinite(spot) && spot > 0
        ? shareGamma * spot * spot * 0.01
        : 0;
      const gammaWeight = gexUnit === "DOLLAR_1PCT" ? dollarGamma : shareGamma;
      const direction = directionalSign(structure);
      const ownership = print.side === "BOUGHT" ? 1 : -1;
      rows.push({
        id: print.id,
        timestamp,
        expiry,
        source: print.source,
        strike: Number(print.strike),
        mappedPrice: Number(print.mappedPrice),
        confidence,
        structure,
        dex: validDelta ? Math.abs(delta) * contracts * 100 * direction : 0,
        gex: gammaWeight * direction,
        convexity: gammaWeight * ownership,
      });
    }
    return rows.sort((left, right) => left.timestamp - right.timestamp);
  }, [gexUnit, minimumConfidence, payload.optionsTape, payload.sessionDate, sourceFilter]);

  const buckets = useMemo(() => {
    const grouped = new Map<number, { zero: FlowValues; one: FlowValues }>();
    for (const row of contributions) {
      const timestamp = Math.floor(row.timestamp / aggregation) * aggregation;
      const bucket = grouped.get(timestamp) ?? { zero: emptyValues(), one: emptyValues() };
      bucket[row.expiry].dex += row.dex;
      bucket[row.expiry].gex += row.gex;
      bucket[row.expiry].convexity += row.convexity;
      grouped.set(timestamp, bucket);
    }
    const latestPrint = contributions.at(-1)?.timestamp ?? 0;
    const latestHistory = history?.timestamps.length
      ? safeTimestamp(Number(history.timestamps.at(-1))) ?? 0
      : 0;
    const end = Math.floor(Math.max(latestPrint, latestHistory, payload.marketOpen ? Date.now() : 0) / aggregation) * aggregation;
    const start = Math.max(0, end - (VISIBLE_BUCKETS - 1) * aggregation);
    return Array.from({ length: VISIBLE_BUCKETS }, (_, index): FlowBucket => {
      const timestamp = start + index * aggregation;
      const values = grouped.get(timestamp) ?? { zero: emptyValues(), one: emptyValues() };
      const historicalPrice = nearestHistoryPrice(history, timestamp + aggregation / 2);
      const price = index === VISIBLE_BUCKETS - 1 && livePrice !== null
        ? livePrice
        : historicalPrice ?? (index === VISIBLE_BUCKETS - 1 ? payload.nqPrice : null);
      return { timestamp, zero: values.zero, one: values.one, price };
    });
  }, [aggregation, contributions, history, livePrice, payload.marketOpen, payload.nqPrice]);

  useEffect(() => {
    if (!playing) setSelectedIndex(Math.max(0, buckets.length - 1));
  }, [aggregation, buckets.length, contributions.length, playing, sourceFilter]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setSelectedIndex((current) => {
        if (current >= buckets.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 450);
    return () => window.clearInterval(timer);
  }, [buckets.length, playing]);

  const selected = buckets[selectedIndex] ?? buckets.at(-1)!;
  const selectedTime = selected?.timestamp ?? Date.now();
  const valuesAt = (expiry: ExpiryKey, metric: MetricKey) => {
    for (let index = selectedIndex; index >= 0; index -= 1) {
      const value = buckets[index]?.[expiry][metric] ?? 0;
      if (value !== 0) return value;
    }
    return 0;
  };
  const current = {
    zero: {
      dex: valuesAt("zero", "dex"),
      gex: valuesAt("zero", "gex"),
      convexity: valuesAt("zero", "convexity"),
    },
    one: {
      dex: valuesAt("one", "dex"),
      gex: valuesAt("one", "gex"),
      convexity: valuesAt("one", "convexity"),
    },
  };
  const session = contributions
    .filter((row) => row.timestamp <= selectedTime)
    .reduce((result, row) => {
      result[row.expiry].dex += row.dex;
      result[row.expiry].gex += row.gex;
      result[row.expiry].convexity += row.convexity;
      return result;
    }, { zero: emptyValues(), one: emptyValues() });

  const maximums = METRICS.reduce((result, metric) => {
    result[metric.key] = Math.max(
      1,
      ...buckets.flatMap((bucket) => [
        Math.abs(bucket.zero[metric.key]),
        Math.abs(bucket.one[metric.key]),
      ]),
    );
    return result;
  }, emptyValues());
  const prices = buckets.flatMap((bucket) => bucket.price === null ? [] : [bucket.price]);
  const priceReference = livePrice ?? payload.nqPrice ?? prices.at(-1) ?? 0;
  const rawLow = prices.length ? Math.min(...prices) : priceReference - 1;
  const rawHigh = prices.length ? Math.max(...prices) : priceReference + 1;
  const padding = Math.max(4, (rawHigh - rawLow) * 0.18);
  const priceLow = rawLow - padding;
  const priceHigh = rawHigh + padding;
  const xForPrice = (index: number) => PRICE_LEFT + index / Math.max(1, buckets.length - 1) * (PRICE_RIGHT - PRICE_LEFT);
  const yForPrice = (price: number) => PRICE_TOP + 18
    + (priceHigh - price) / Math.max(1, priceHigh - priceLow) * (PRICE_BOTTOM - PRICE_TOP - 30);
  const pricePath = linePath(buckets.map((bucket, index) => ({
    x: xForPrice(index),
    y: bucket.price === null ? null : yForPrice(bucket.price),
  })));

  const majorLevels = (["zero", "one"] as ExpiryKey[]).map((expiry) => {
    const relevant = contributions
      .filter((row) => row.expiry === expiry && row.timestamp <= selectedTime && Number.isFinite(row.mappedPrice))
      .reduce((map, row) => {
        const key = Math.round(row.mappedPrice / 5) * 5;
        map.set(key, (map.get(key) ?? 0) + Math.abs(row.gex));
        return map;
      }, new Map<number, number>());
    const primary = [...relevant.entries()].sort((left, right) => right[1] - left[1])[0];
    return primary ? { expiry, price: primary[0], magnitude: primary[1] } : null;
  }).filter((row): row is { expiry: ExpiryKey; price: number; magnitude: number } => Boolean(row));

  const recentContributions = contributions.filter((row) => row.timestamp <= selectedTime && row.timestamp >= selectedTime - 300_000);
  const rollGroups = recentContributions.reduce((map, row) => {
    const threshold = row.source === "QQQ" ? 1 : 50;
    const strike = Math.round(row.strike / threshold) * threshold;
    const key = `${row.source}:${row.structure}:${strike}`;
    const group = map.get(key) ?? { zero: 0, one: 0, confidence: 0, count: 0, source: row.source, structure: row.structure, strike };
    group[row.expiry] += row.convexity;
    group.confidence += row.confidence;
    group.count += 1;
    map.set(key, group);
    return map;
  }, new Map<string, {
    zero: number;
    one: number;
    confidence: number;
    count: number;
    source: GexDeskSourceSymbol;
    structure: Structure;
    strike: number;
  }>());
  const roll = [...rollGroups.values()]
    .filter((row) => row.zero < 0 && row.one > 0)
    .map((row) => {
      const similarity = Math.min(Math.abs(row.zero), Math.abs(row.one))
        / Math.max(1, Math.max(Math.abs(row.zero), Math.abs(row.one)));
      return { ...row, score: similarity * (row.confidence / Math.max(1, row.count)) };
    })
    .sort((left, right) => right.score - left.score)[0] ?? null;

  const zeroState = `${directionLabel(current.zero.dex)} / ${volatilityLabel(current.zero.convexity)}`;
  const oneState = `${directionLabel(current.one.dex)} / ${volatilityLabel(current.one.convexity)}`;
  const overallRelationship = relation(current.zero.dex, current.one.dex) === "DIVERGENT"
    || relation(current.zero.gex, current.one.gex) === "DIVERGENT"
    ? "EXPIRY DIVERGENCE"
    : "FRONT-EXPIRY AGREEMENT";

  return (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      <div className="flex min-h-12 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.07] text-primary shadow-[0_0_22px_color-mix(in_srgb,var(--primary)_10%,transparent)]">
          <Layers3 className="h-3.5 w-3.5" />
        </span>
        <div className="hidden sm:block">
          <div className="text-[8px] font-semibold">0DTE / 1DTE Orderflow</div>
          <div className="text-[6px] uppercase tracking-[0.12em] text-muted">Current session vs next-session pressure</div>
        </div>

        <KwantSelect
          value={sourceFilter}
          onChange={(event) => onSourceFilterChange(event.target.value as SourceFilter)}
          menuLabel="Options source"
          className="h-8 min-w-24 rounded-xl border border-border bg-surface px-2.5 text-[7px] font-semibold"
        >
          <option value="COMBINED">NDX + QQQ</option>
          <option value="NDX">NDX only</option>
          <option value="QQQ">QQQ only</option>
        </KwantSelect>
        <KwantSelect
          value={String(aggregation)}
          onChange={(event) => setAggregation(Number(event.target.value) as Aggregation)}
          menuLabel="Flow interval"
          className="h-8 min-w-20 rounded-xl border border-border bg-surface px-2.5 text-[7px] font-semibold"
        >
          {AGGREGATIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </KwantSelect>
        <KwantSelect
          value={gexUnit}
          onChange={(event) => setGexUnit(event.target.value as GexUnit)}
          menuLabel="Gamma unit"
          className="h-8 min-w-32 rounded-xl border border-border bg-surface px-2.5 text-[7px] font-semibold"
        >
          <option value="DOLLAR_1PCT">Dollar GEX / 1%</option>
          <option value="SHARE_POINT">Share gamma / point</option>
        </KwantSelect>
        <KwantSelect
          value={minimumConfidence}
          onChange={(event) => setMinimumConfidence(event.target.value)}
          menuLabel="Classification confidence"
          className="h-8 min-w-28 rounded-xl border border-border bg-surface px-2.5 text-[7px] font-semibold"
        >
          <option value="0">All confidence</option>
          <option value="0.5">High + medium</option>
          <option value="0.85">High only</option>
        </KwantSelect>

        <div className="ml-auto flex items-center gap-1.5 rounded-xl border border-border bg-surface px-2 py-1.5 text-[6px] text-muted">
          <Radio className={`h-3 w-3 ${payload.marketOpen ? "text-primary" : "text-muted"}`} />
          {payload.marketOpen ? "LIVE" : "EOD"}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 p-2">
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="h-full w-full rounded-2xl border border-border bg-background/55"
          role="img"
          aria-label="Side-by-side 0DTE and 1DTE DEX, GEX and convexity orderflow comparison"
        >
          <defs>
            <pattern id="expiry-one-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--foreground)" strokeWidth="1.2" strokeOpacity="0.38" />
            </pattern>
            <linearGradient id="expiry-price-line" x1="0" x2="1">
              <stop offset="0" stopColor="var(--muted)" stopOpacity="0.35" />
              <stop offset="0.7" stopColor="var(--foreground)" stopOpacity="0.78" />
              <stop offset="1" stopColor="var(--primary)" />
            </linearGradient>
            <filter id="expiry-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <rect x={PRICE_LEFT} y={PRICE_TOP} width={PRICE_RIGHT - PRICE_LEFT} height={PRICE_BOTTOM - PRICE_TOP} rx="12" fill="var(--panel)" fillOpacity="0.36" />
          <text x={PRICE_LEFT + 12} y={PRICE_TOP + 18} fill="var(--muted)" fontSize="7" letterSpacing="1.2">SHARED NQ PRICE CONTEXT</text>
          <text x={PRICE_RIGHT - 12} y={PRICE_TOP + 18} textAnchor="end" fill="var(--foreground)" fontSize="9" fontFamily="monospace">
            {priceLabel(livePrice ?? selected.price ?? payload.nqPrice)}
          </text>
          {majorLevels.map((level) => {
            if (level.price < priceLow || level.price > priceHigh) return null;
            const y = yForPrice(level.price);
            const zero = level.expiry === "zero";
            return (
              <g key={level.expiry}>
                <line
                  x1={PRICE_LEFT}
                  x2={PRICE_RIGHT}
                  y1={y}
                  y2={y}
                  stroke={zero ? "var(--primary)" : "var(--foreground)"}
                  strokeOpacity={zero ? 0.42 : 0.26}
                  strokeWidth={zero ? 1.2 : 1}
                  strokeDasharray={zero ? undefined : "4 6"}
                />
                <text x={PRICE_RIGHT - 8} y={y - 3} textAnchor="end" fill={zero ? "var(--primary)" : "var(--muted)"} fontSize="5.5">
                  {zero ? "0DTE" : "1DTE"} MAJOR FLOW STRIKE · {priceLabel(level.price)}
                </text>
              </g>
            );
          })}
          {pricePath ? <path d={pricePath} fill="none" stroke="url(#expiry-price-line)" strokeWidth="2" /> : null}
          <line x1={xForPrice(selectedIndex)} x2={xForPrice(selectedIndex)} y1={PRICE_TOP + 24} y2={PRICE_BOTTOM - 6} stroke="var(--foreground)" strokeOpacity="0.24" strokeDasharray="3 5" />
          <circle cx={xForPrice(selectedIndex)} cy={selected.price === null ? PRICE_BOTTOM - 12 : yForPrice(selected.price)} r="3.4" fill="var(--primary)" filter="url(#expiry-glow)" />

          <text x={COLUMN_LEFTS.zero} y="166" fill="var(--primary)" fontSize="8" fontWeight="700" letterSpacing="1.4">0DTE · CURRENT SESSION</text>
          <text x={COLUMN_LEFTS.one} y="166" fill="var(--foreground)" fillOpacity="0.7" fontSize="8" fontWeight="700" letterSpacing="1.4">1DTE · NEXT SESSION</text>
          <line x1="590" x2="590" y1="158" y2="548" stroke="var(--border)" />

          {METRICS.flatMap((metric) => (["zero", "one"] as ExpiryKey[]).map((expiry) => {
            const left = COLUMN_LEFTS[expiry];
            const top = ROW_TOPS[metric.key];
            const zeroY = top + ROW_HEIGHT / 2;
            const maximum = maximums[metric.key];
            const cell = COLUMN_WIDTH / Math.max(1, buckets.length);
            const barWidth = Math.max(2, cell * 0.58);
            const currentValue = current[expiry][metric.key];
            return (
              <g key={`${expiry}-${metric.key}`}>
                <rect x={left} y={top} width={COLUMN_WIDTH} height={ROW_HEIGHT} rx="10" fill="var(--panel)" fillOpacity="0.32" />
                <text x={left + 10} y={top + 15} fill="var(--muted)" fontSize="6.5" letterSpacing="1.1">
                  {expiry === "zero" ? "0DTE" : "1DTE"} {metric.label}
                </text>
                <text x={left + COLUMN_WIDTH - 10} y={top + 15} textAnchor="end" fill={currentValue >= 0 ? "var(--primary)" : "var(--accent)"} fontSize="7.5" fontFamily="monospace">
                  {compact(currentValue)}
                </text>
                <line x1={left + 8} x2={left + COLUMN_WIDTH - 8} y1={zeroY} y2={zeroY} stroke="var(--foreground)" strokeOpacity="0.35" />
                {buckets.map((bucket, index) => {
                  const value = bucket[expiry][metric.key];
                  const x = left + index * cell + (cell - barWidth) / 2;
                  const height = Math.abs(value) / maximum * (ROW_HEIGHT / 2 - 20);
                  const y = value >= 0 ? zeroY - height : zeroY;
                  const positive = value >= 0;
                  return height > 0 ? (
                    <rect
                      key={bucket.timestamp}
                      x={x}
                      y={y}
                      width={barWidth}
                      height={height}
                      rx="1"
                      fill={expiry === "zero" ? (positive ? "var(--primary)" : "var(--accent)") : "url(#expiry-one-hatch)"}
                      fillOpacity={expiry === "zero" ? 0.88 : 0.58}
                      stroke={expiry === "one" ? (positive ? "var(--primary)" : "var(--accent)") : "none"}
                      strokeOpacity={expiry === "one" ? 0.58 : 0}
                      strokeWidth={expiry === "one" ? 0.8 : 0}
                    />
                  ) : null;
                })}
                <line
                  x1={left + selectedIndex * cell + cell / 2}
                  x2={left + selectedIndex * cell + cell / 2}
                  y1={top + 20}
                  y2={top + ROW_HEIGHT - 7}
                  stroke="var(--foreground)"
                  strokeOpacity="0.25"
                  strokeDasharray="2 4"
                />
                <text x={left + 6} y={top + 28} fill="var(--muted)" fontSize="5">+{compact(maximum).replace("+", "")}</text>
                <text x={left + 6} y={top + ROW_HEIGHT - 7} fill="var(--muted)" fontSize="5">−{compact(maximum).replace("+", "")}</text>
              </g>
            );
          }))}

          {[0, 1, 2, 3, 4, 5].map((index) => {
            const bucketIndex = Math.round(index / 5 * (buckets.length - 1));
            const x = PRICE_LEFT + index / 5 * (PRICE_RIGHT - PRICE_LEFT);
            return (
              <text
                key={index}
                x={x}
                y="563"
                textAnchor={index === 0 ? "start" : index === 5 ? "end" : "middle"}
                fill="var(--muted)"
                fontSize="6"
              >
                {timeLabel(buckets[bucketIndex]?.timestamp ?? Date.now(), aggregation < 60_000)}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="border-t border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (selectedIndex >= buckets.length - 1) setSelectedIndex(0);
              setPlaying((value) => !value);
            }}
            className="flex h-7 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-[6px] font-semibold text-muted transition hover:border-primary/30 hover:text-primary"
          >
            {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {playing ? "Pause" : "Playback"}
          </button>
          <input
            type="range"
            min="0"
            max={Math.max(0, buckets.length - 1)}
            value={selectedIndex}
            onChange={(event) => {
              setPlaying(false);
              setSelectedIndex(Number(event.target.value));
            }}
            className="h-1 min-w-0 flex-1 accent-[var(--primary)]"
            aria-label="Front-expiry flow playback time"
          />
          <span className="min-w-16 text-right font-mono text-[7px] text-foreground">
            {timeLabel(selectedTime, aggregation < 60_000)}
          </span>
        </div>

        <div className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-[1fr_1fr_1fr_1.08fr]">
          <MetricSummary label="DEX expiry share" zero={session.zero.dex} one={session.one.dex} />
          <MetricSummary label="GEX expiry share" zero={session.zero.gex} one={session.one.gex} />
          <MetricSummary label="Convexity share" zero={session.zero.convexity} one={session.one.convexity} />
          <div className="rounded-xl border border-border bg-surface/55 p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[6px] font-semibold uppercase tracking-[0.12em] text-muted">
                <GitCompareArrows className="h-3 w-3 text-primary" />
                Expiry state
              </div>
              <span className={`text-[6px] font-semibold ${overallRelationship.includes("DIVERGENCE") ? "text-accent" : "text-primary"}`}>
                {overallRelationship}
              </span>
            </div>
            <div className="mt-1.5 grid grid-cols-[52px_1fr] gap-x-2 gap-y-1 text-[6px]">
              <span className="text-primary">0DTE</span>
              <span className="text-foreground">{zeroState} · {structureLabel(current.zero.dex, current.zero.convexity)}</span>
              <span className="text-muted">1DTE</span>
              <span className="text-muted">{oneState} · {structureLabel(current.one.dex, current.one.convexity)}</span>
              <span className="text-muted">Phase</span>
              <span className="text-foreground">{sessionPhase(payload.marketOpen)}</span>
              <span className="text-muted">Roll</span>
              <span className={roll ? "text-primary" : "text-muted"}>
                {roll
                  ? `Possible ${roll.source} ${roll.strike.toLocaleString("en-US")} ${roll.structure.replaceAll("_", " ").toLowerCase()} · ${(roll.score * 100).toFixed(0)}%`
                  : "No defensible roll candidate"}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-3 text-[5.5px] leading-3 text-muted">
          <span>
            <strong className="text-primary">SOLID / BRIGHT</strong> 0DTE · <strong className="text-foreground">OUTLINED / DIM</strong> 1DTE · shared scale within each metric.
          </span>
          <span className="flex items-center gap-1">
            <CalendarClock className="h-2.5 w-2.5" />
            Roll labels are probabilistic; multi-leg intent and opening/closing status are not fully observable from the public tape.
          </span>
        </div>
      </div>
    </div>
  );
}
