"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarRange,
  Crosshair,
  Eye,
  Flame,
  GitCompareArrows,
  Gauge,
  History,
  Layers3,
  Map,
  Radio,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Waves,
} from "lucide-react";
import KwantLoader from "@/components/KwantLoader";
import KwantSelect from "@/components/ui/KwantSelect";
import WorkspaceSubnav from "@/components/ui/WorkspaceSubnav";
import GexDeskDepthPanels, {
  type GexDeskPanel,
} from "@/components/gexdesk/GexDeskDepthPanels";
import GexDeskHeatmapBoundary from "@/components/gexdesk/GexDeskHeatmapBoundary";
import GexDeskOptionsHeatmap from "@/components/gexdesk/GexDeskOptionsHeatmap";
import GexViewWorkspace from "@/components/gexdesk/GexViewWorkspace";
import {
  DATABENTO_LIVE_STATUS_EVENT,
  DATABENTO_LIVE_TICK_EVENT,
  type DatabentoLiveStatus,
} from "@/lib/chartLiveEvents";
import type {
  GexDeskBehaviour,
  GexDeskHistoryPayload,
  GexDeskPayload,
  GexDeskRailPoint,
  GexDeskSourceSymbol,
  GexDeskZone,
} from "@/lib/gexDesk";
import {
  fetchWorkspaceData,
  gexdeskHistoryCacheKey,
  readWorkspaceData,
  writeWorkspaceData,
} from "@/lib/workspaceDataCache";

type SourceFilter = "COMBINED" | GexDeskSourceSymbol;
type ExpiryFilter = "ALL" | "0DTE";
type CompositeMode = "ECONOMIC" | "AGREEMENT";
type ViewMode = "SIMPLE" | "ANALYST";
type TapeTick = { price: number; delta: number; timestamp: number };

const DISPLAY_HEIGHT = 570;
const DISPLAY_TOP = 34;
const DISPLAY_BOTTOM = 532;

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

function formatNumber(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatCompact(value: number) {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (absolute >= 1_000_000_000) return `${sign}${(absolute / 1_000_000_000).toFixed(2)}B`;
  if (absolute >= 1_000_000) return `${sign}${(absolute / 1_000_000).toFixed(2)}M`;
  if (absolute >= 1_000) return `${sign}${(absolute / 1_000).toFixed(1)}K`;
  return `${sign}${absolute.toFixed(0)}`;
}

function formatPercent(value: number, digits = 0) {
  return `${(value * 100).toFixed(digits)}%`;
}

function timeAgo(value: string | null | undefined, now: number) {
  if (!value) return "unavailable";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "unavailable";
  const seconds = Math.max(0, Math.round((now - timestamp) / 1_000));
  if (seconds < 5) return "now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

function behaviourTone(behaviour: GexDeskBehaviour) {
  if (behaviour === "STABILISING") {
    return {
      text: "text-primary",
      border: "border-primary/25",
      background: "bg-primary/[0.07]",
      color: "var(--primary)",
      label: "Stabilising",
    };
  }
  if (behaviour === "AMPLIFYING") {
    return {
      text: "text-accent",
      border: "border-accent/25",
      background: "bg-accent/[0.07]",
      color: "var(--accent)",
      label: "Amplifying",
    };
  }
  return {
    text: "text-foreground",
    border: "border-border",
    background: "bg-surface/45",
    color: "var(--foreground)",
    label: "Transition",
  };
}

function filteredRailRow(
  row: GexDeskRailPoint,
  source: SourceFilter,
  expiry: ExpiryFilter,
): { net: number; gross: number } {
  const net = source === "NDX" ? row.ndxNet : source === "QQQ" ? row.qqqNet : row.net;
  const gross = source === "NDX" ? row.ndxGross : source === "QQQ" ? row.qqqGross : row.gross;
  if (expiry === "ALL") return { net, gross };
  const zeroShare = row.gross > 0 ? clamp(row.zeroDteGross / row.gross, 0, 1) : 0;
  return { net: net * zeroShare, gross: gross * zeroShare };
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "text-primary",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
  tone?: string;
}) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl border border-border bg-panel px-3.5 py-3">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="flex items-center gap-2 text-[7px] font-semibold uppercase tracking-[0.15em] text-muted">
        <Icon className={`h-3.5 w-3.5 ${tone}`} />
        {label}
      </div>
      <div className={`mt-2 truncate font-mono text-[17px] font-semibold tracking-[-0.03em] ${tone}`}>{value}</div>
      <div className="mt-1 truncate text-[7px] text-muted">{detail}</div>
    </div>
  );
}

function ZoneFocus({
  zone,
  livePrice,
}: {
  zone: GexDeskZone | null;
  livePrice: number | null;
}) {
  if (!zone) {
    return (
      <div className="flex h-full min-h-64 items-center justify-center rounded-2xl border border-dashed border-border bg-panel/55 p-6 text-center">
        <div>
          <Crosshair className="mx-auto h-6 w-6 text-muted" />
          <div className="mt-3 text-[10px] font-semibold">Select a behavioural zone</div>
          <p className="mx-auto mt-2 max-w-xs text-[8px] leading-5 text-muted">Choose a highlighted zone on the rail to inspect its positioning, expected behaviour, tape condition and invalidation.</p>
        </div>
      </div>
    );
  }
  const tone = behaviourTone(zone.behaviour);
  const inside = livePrice !== null && livePrice >= zone.low && livePrice <= zone.high;
  return (
    <div className={`h-full min-h-0 overflow-y-auto rounded-2xl border bg-panel ${tone.border}`}>
      <div className={`border-b px-4 py-3 ${tone.border} ${tone.background}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className={`text-[7px] font-semibold uppercase tracking-[0.15em] ${tone.text}`}>Level focus · {tone.label}</div>
            <div className="mt-1 font-mono text-[18px] font-semibold">{formatNumber(zone.center, 0)}</div>
          </div>
          <span className={`rounded-xl border px-2.5 py-1.5 text-[7px] font-semibold ${inside ? `${tone.border} ${tone.background} ${tone.text}` : "border-border bg-background text-muted"}`}>
            {inside ? "PRICE INSIDE" : `${Math.abs(zone.distancePoints).toFixed(0)} PTS AWAY`}
          </span>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Strength", `${zone.strength}`],
            ["Priority", `${zone.priority}`],
            ["0DTE", formatPercent(zone.zeroDteShare)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-border bg-background/35 p-2.5">
              <div className="text-[6px] uppercase tracking-[0.12em] text-muted">{label}</div>
              <div className={`mt-1 font-mono text-[11px] font-semibold ${tone.text}`}>{value}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-border bg-background/30 p-3">
            <div className="flex items-center justify-between text-[6px] uppercase tracking-[0.12em] text-muted"><span>Calls</span><span>Puts</span></div>
            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-surface">
              <div className="bg-foreground/75" style={{ width: `${zone.callShare * 100}%` }} />
              <div className="bg-muted/45" style={{ width: `${(1 - zone.callShare) * 100}%` }} />
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-[6px] text-muted"><span>{formatPercent(zone.callShare)}</span><span>{formatPercent(1 - zone.callShare)}</span></div>
          </div>
          <div className="rounded-xl border border-border bg-background/30 p-3">
            <div className="text-[6px] uppercase tracking-[0.12em] text-muted">Snapshot state</div>
            <div className={`mt-2 text-[9px] font-semibold ${zone.state === "BUILDING" ? "text-primary" : zone.state === "WEAKENING" ? "text-accent" : "text-foreground"}`}>{zone.state}</div>
            <div className="mt-1 text-[6px] text-muted">{formatCompact(zone.gross)} gross exposure</div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-background/30 p-3">
          <div className="text-[6px] font-semibold uppercase tracking-[0.13em] text-muted">Why it matters</div>
          <p className="mt-2 text-[8px] leading-5 text-foreground">{zone.explanation}</p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/[0.035] p-3">
          <div className="flex items-center gap-1.5 text-[6px] font-semibold uppercase tracking-[0.13em] text-primary"><Activity className="h-3 w-3" />Tape watch</div>
          <p className="mt-2 text-[8px] leading-5 text-foreground">{zone.tapeWatch}</p>
        </div>
        <div className="rounded-xl border border-accent/20 bg-accent/[0.035] p-3">
          <div className="flex items-center gap-1.5 text-[6px] font-semibold uppercase tracking-[0.13em] text-accent"><AlertTriangle className="h-3 w-3" />Invalidation</div>
          <p className="mt-2 text-[8px] leading-5 text-foreground">{zone.invalidation}</p>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between text-[6px] uppercase tracking-[0.12em] text-muted"><span>Source contribution</span><span>{zone.sourceAgreement.toFixed(0)}% local agreement</span></div>
          <div className="flex h-2 overflow-hidden rounded-full bg-surface">
            <div className="bg-primary" style={{ width: `${zone.ndxShare * 100}%` }} />
            <div className="bg-accent" style={{ width: `${zone.qqqShare * 100}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[6px] text-muted"><span>NDX {formatPercent(zone.ndxShare)}</span><span>QQQ {formatPercent(zone.qqqShare)}</span></div>
        </div>
        <div className="rounded-xl border border-border bg-background/30 p-3">
          <div className="text-[6px] font-semibold uppercase tracking-[0.13em] text-muted">Original mapped strikes</div>
          <div className="mt-2 space-y-1.5 text-[7px]">
            <div><span className="mr-2 text-primary">NDX</span><span className="font-mono text-muted">{zone.ndxStrikes.length ? zone.ndxStrikes.map((value) => value.toFixed(0)).join(", ") : "No local contribution"}</span></div>
            <div><span className="mr-2 text-accent">QQQ</span><span className="font-mono text-muted">{zone.qqqStrikes.length ? zone.qqqStrikes.map((value) => value.toFixed(1)).join(", ") : "No local contribution"}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GexDeskWorkspace() {
  const initialPayloadRef = useRef(readWorkspaceData<GexDeskPayload>("gexdesk:map"));
  const initialPayload = initialPayloadRef.current;
  const [payload, setPayload] = useState<GexDeskPayload | null>(initialPayload);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("COMBINED");
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>("ALL");
  const [compositeMode, setCompositeMode] = useState<CompositeMode>("ECONOMIC");
  const [viewMode, setViewMode] = useState<ViewMode>("SIMPLE");
  const [activePanel, setActivePanel] = useState<GexDeskPanel>("MAP");
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [history, setHistory] = useState<GexDeskHistoryPayload | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [feedStatus, setFeedStatus] = useState<DatabentoLiveStatus>("connecting");
  const [liveInstrument, setLiveInstrument] = useState<"MNQ" | "NQ">("MNQ");
  const [lastTickAt, setLastTickAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const tickBufferRef = useRef<TapeTick[]>([]);
  const heatPriceTicksRef = useRef<TapeTick[]>([]);
  const livePriceRef = useRef<number | null>(null);
  const liveInstrumentRef = useRef<"MNQ" | "NQ">("MNQ");
  const preferredMnqAtRef = useRef(0);
  const uiTickTimerRef = useRef<number | null>(null);
  const lastUiTickRef = useRef(0);
  const latestTickTimestampRef = useRef(0);
  const requestRef = useRef<AbortController | null>(null);
  const historyRequestRef = useRef<AbortController | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const result = await fetchWorkspaceData<GexDeskPayload>(
        "gexdesk:map",
        "/api/gexdesk",
        { force: true },
      );
      if (controller.signal.aborted) return;
      setPayload((current) => {
        const optionsById = new globalThis.Map(
          [...(current?.optionsTape ?? []), ...(result.optionsTape ?? [])]
            .map((print) => [print.id, print]),
        );
        const optionsTape = [...optionsById.values()]
          .filter((print) => Date.now() - print.timestamp <= 6 * 60 * 60_000)
          .sort((left, right) => left.timestamp - right.timestamp)
          .slice(-2_500);
        const nextPayload: GexDeskPayload = {
          ...result,
          optionsTape,
          zones: result.zones.map((zone) => {
            const previous = current?.zones.find((candidate) => Math.abs(candidate.center - zone.center) <= Math.max(5, zone.high - zone.low));
            if (!previous || previous.gross <= 0) return zone;
            const change = zone.gross / previous.gross - 1;
            return {
              ...zone,
              state: change >= 0.04 ? "BUILDING" : change <= -0.04 ? "WEAKENING" : "STABLE",
            };
          }),
        };
        writeWorkspaceData("gexdesk:map", nextPayload);
        return nextPayload;
      });
      setError("");
      if (livePriceRef.current === null && result.nqPrice) {
        livePriceRef.current = result.nqPrice;
        setLivePrice(result.nqPrice);
      }
      setSelectedZoneId((current) => current && result.zones.some((zone) => zone.id === current)
        ? current
        : result.zones[0]?.id ?? "");
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "Gexdesk is temporarily unavailable.");
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(Boolean(initialPayload));
    return () => requestRef.current?.abort();
  }, [load]);

  const loadHistory = useCallback(async (silent = false) => {
    if (!silent) setHistoryLoading(true);
    historyRequestRef.current?.abort();
    const controller = new AbortController();
    historyRequestRef.current = controller;
    try {
      const result = await fetchWorkspaceData<GexDeskHistoryPayload>(
        gexdeskHistoryCacheKey(sourceFilter),
        `/api/gexdesk/history?source=${sourceFilter}`,
        { force: true },
      );
      if (controller.signal.aborted) return;
      setHistory(result);
      setHistoryError("");
    } catch (historyLoadError) {
      if (historyLoadError instanceof Error && historyLoadError.name === "AbortError") return;
      setHistoryError(historyLoadError instanceof Error ? historyLoadError.message : "Intraday gamma evolution is temporarily unavailable.");
    } finally {
      if (!silent) setHistoryLoading(false);
    }
  }, [sourceFilter]);

  useEffect(() => {
    if (activePanel !== "EVOLUTION" && activePanel !== "HEATMAP" && activePanel !== "GEX_VIEW") return;
    const cached = readWorkspaceData<GexDeskHistoryPayload>(gexdeskHistoryCacheKey(sourceFilter));
    setHistory(cached);
    void loadHistory(Boolean(cached));
    const interval = payload?.marketOpen
      ? window.setInterval(() => {
          if (document.visibilityState === "visible") void loadHistory(true);
        }, 30_000)
      : null;
    return () => {
      if (interval !== null) window.clearInterval(interval);
      historyRequestRef.current?.abort();
    };
  }, [activePanel, loadHistory, payload?.marketOpen]);

  useEffect(() => {
    if (!payload?.marketOpen) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, payload.refreshAfterMs);
    return () => window.clearInterval(interval);
  }, [load, payload?.marketOpen, payload?.refreshAfterMs]);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    const receiveTick = (event: Event) => {
      const tick = (event as CustomEvent<{
        instrument?: string;
        mid?: number;
        delta?: number;
        size?: number;
        timestamp?: string | number;
      }>).detail;
      const instrument = String(tick?.instrument ?? "").toUpperCase();
      const isMnq = instrument.startsWith("MNQ");
      const isNq = instrument.startsWith("NQ");
      if (!isMnq && !isNq) return;
      const price = Number(tick.mid);
      if (!Number.isFinite(price) || price <= 0) return;
      const parsedTimestamp = typeof tick.timestamp === "string" ? Date.parse(tick.timestamp) : Number(tick.timestamp);
      const timestamp = Number.isFinite(parsedTimestamp) && parsedTimestamp > 0
        ? parsedTimestamp < 10_000_000_000 ? parsedTimestamp * 1_000 : parsedTimestamp
        : Date.now();
      const delta = Number.isFinite(Number(tick.delta))
        ? Number(tick.delta)
        : Number.isFinite(Number(tick.size))
          ? Number(tick.size)
          : 0;
      if (isMnq) {
        preferredMnqAtRef.current = timestamp;
      } else if (timestamp - preferredMnqAtRef.current < 5_000) {
        return;
      }
      const nextInstrument = isMnq ? "MNQ" : "NQ";
      if (liveInstrumentRef.current !== nextInstrument) {
        liveInstrumentRef.current = nextInstrument;
        setLiveInstrument(nextInstrument);
      }
      livePriceRef.current = price;
      tickBufferRef.current = [...tickBufferRef.current, { price, delta, timestamp }]
        .filter((row) => timestamp - row.timestamp <= 30_000)
        .slice(-600);
      const heatTicks = heatPriceTicksRef.current;
      const latestHeatTick = heatTicks.at(-1);
      const nextHeatTick = { price, delta, timestamp };
      if (latestHeatTick && Math.floor(latestHeatTick.timestamp / 1_000) === Math.floor(timestamp / 1_000)) {
        heatTicks[heatTicks.length - 1] = nextHeatTick;
      } else {
        heatTicks.push(nextHeatTick);
      }
      const heatCutoff = timestamp - 2 * 60 * 60_000;
      while (heatTicks.length && heatTicks[0].timestamp < heatCutoff) heatTicks.shift();
      if (heatTicks.length > 2_500) heatTicks.splice(0, heatTicks.length - 2_500);
      latestTickTimestampRef.current = timestamp;
      if (uiTickTimerRef.current !== null) return;
      const delay = Math.max(0, 100 - (Date.now() - lastUiTickRef.current));
      uiTickTimerRef.current = window.setTimeout(() => {
        uiTickTimerRef.current = null;
        lastUiTickRef.current = Date.now();
        setLivePrice(livePriceRef.current);
        setLastTickAt(latestTickTimestampRef.current);
        setFeedStatus("live");
      }, delay);
    };
    const receiveStatus = (event: Event) => {
      setFeedStatus((event as CustomEvent<DatabentoLiveStatus>).detail);
    };
    window.addEventListener(DATABENTO_LIVE_TICK_EVENT, receiveTick);
    window.addEventListener(DATABENTO_LIVE_STATUS_EVENT, receiveStatus);
    return () => {
      window.removeEventListener(DATABENTO_LIVE_TICK_EVENT, receiveTick);
      window.removeEventListener(DATABENTO_LIVE_STATUS_EVENT, receiveStatus);
      if (uiTickTimerRef.current !== null) window.clearTimeout(uiTickTimerRef.current);
    };
  }, []);

  const selectedZone = useMemo(
    () => payload?.zones.find((zone) => zone.id === selectedZoneId) ?? payload?.zones[0] ?? null,
    [payload, selectedZoneId],
  );
  const displayRail = useMemo(() => {
    if (!payload) return [];
    return payload.rail.map((row) => ({ row, values: filteredRailRow(row, sourceFilter, expiryFilter) }));
  }, [expiryFilter, payload, sourceFilter]);
  const railRange = useMemo(() => {
    const price = livePrice ?? payload?.nqPrice ?? 0;
    const zonePrices = payload?.zones.flatMap((zone) => [zone.low, zone.high]) ?? [];
    const halfSpan = Math.max(price * 0.018, 300);
    const low = Math.min(price - halfSpan, ...zonePrices);
    const high = Math.max(price + halfSpan, ...zonePrices);
    return { low, high: high > low ? high : low + 1 };
  }, [livePrice, payload]);
  const visibleRail = useMemo(
    () => displayRail.filter(({ row }) => row.price >= railRange.low && row.price <= railRange.high),
    [displayRail, railRange],
  );
  const maximumRailGross = Math.max(...visibleRail.map(({ values }) => values.gross), 1);
  const yForPrice = (price: number) => DISPLAY_TOP + (railRange.high - price) / (railRange.high - railRange.low) * (DISPLAY_BOTTOM - DISPLAY_TOP);

  const tape = useMemo(() => {
    const ticks = tickBufferRef.current;
    if (ticks.length < 2) return { delta: 0, velocity: 0, state: "WAITING" as const, detail: "Waiting for shared NQ prints." };
    const first = ticks[0];
    const last = ticks[ticks.length - 1];
    const seconds = Math.max(1, (last.timestamp - first.timestamp) / 1_000);
    const velocity = (last.price - first.price) / seconds;
    const delta = ticks.reduce((sum, tick) => sum + tick.delta, 0);
    if (!selectedZone || livePrice === null) return { delta, velocity, state: "NEUTRAL" as const, detail: "No behavioural zone is selected." };
    const zoneWidth = Math.max(1, selectedZone.high - selectedZone.low);
    const nearZone = livePrice >= selectedZone.low - zoneWidth && livePrice <= selectedZone.high + zoneWidth;
    if (!nearZone) return { delta, velocity, state: "NEUTRAL" as const, detail: "NQ is not interacting with the selected zone." };
    const direction = livePrice >= selectedZone.center ? 1 : -1;
    if (selectedZone.behaviour === "STABILISING") {
      const confirming = Math.abs(velocity) < 0.35 || Math.sign(delta) === -direction;
      return confirming
        ? { delta, velocity, state: "CONFIRMING" as const, detail: "Velocity is slowing or trade delta is opposing the move at the stabilising zone." }
        : { delta, velocity, state: "DIVERGING" as const, detail: "NQ is accepting through the zone with same-direction pressure." };
    }
    if (selectedZone.behaviour === "AMPLIFYING") {
      const confirming = Math.sign(velocity) === direction && (Math.sign(delta) === direction || Math.abs(delta) < 1);
      return confirming
        ? { delta, velocity, state: "CONFIRMING" as const, detail: "Price velocity and trade delta support expansion away from the zone." }
        : { delta, velocity, state: "DIVERGING" as const, detail: "The futures tape is not confirming expansion from this zone." };
    }
    return { delta, velocity, state: "NEUTRAL" as const, detail: "Transition positioning requires a clearer tape response." };
  }, [lastTickAt, livePrice, selectedZone]);

  if (!payload && !error) {
    return (
      <KwantLoader
        className="h-full min-h-0"
        icon={Layers3}
        title="Opening Gexdesk"
        detail="Mapping NDX and QQQ positioning onto live NQ."
      />
    );
  }

  if (!payload) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-3xl border border-danger/25 bg-panel p-6 text-center">
          <AlertTriangle className="mx-auto h-7 w-7 text-danger" />
          <h2 className="mt-4 text-[13px] font-semibold">Gexdesk could not open</h2>
          <p className="mt-2 text-[9px] leading-5 text-muted">{error}</p>
          <button type="button" onClick={() => void load()} className="mt-5 inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[8px] font-semibold text-background"><RefreshCw className="h-3.5 w-3.5" />Retry</button>
        </div>
      </div>
    );
  }

  const regimeTone = behaviourTone(payload.regime.behaviour);
  const pressureTone = payload.pressure.score > 12 ? "text-primary" : payload.pressure.score < -12 ? "text-accent" : "text-foreground";
  const tapeTone = tape.state === "CONFIRMING" ? "text-primary" : tape.state === "DIVERGING" ? "text-accent" : "text-muted";
  const panelItems: Array<{
    id: GexDeskPanel;
    label: string;
    description: string;
    icon: typeof Activity;
    analyst: boolean;
  }> = [
    { id: "GEX_VIEW", label: "Gex View", description: "Visual exposure terminal", icon: Eye, analyst: false },
    { id: "MAP", label: "Map", description: "Positioning by strike", icon: Map, analyst: false },
    { id: "HEATMAP", label: "Heatmap", description: "Call and put activity", icon: Flame, analyst: false },
    { id: "EVOLUTION", label: "Evolution", description: "Exposure through time", icon: History, analyst: true },
    { id: "EXPIRIES", label: "Expiries", description: "Term structure", icon: CalendarRange, analyst: true },
    { id: "FLOW", label: "Flow & Tape", description: "Live options pressure", icon: Waves, analyst: true },
    { id: "SOURCES", label: "Sources", description: "Cross-source evidence", icon: GitCompareArrows, analyst: true },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-panel px-3 py-2">
        <div className="mr-2 flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary"><Layers3 className="h-4 w-4" /></span>
          <div className="min-w-0">
            <div className="truncate text-[10px] font-semibold">Gexdesk</div>
            <div className="truncate text-[6px] uppercase tracking-[0.14em] text-muted">NQ positioning intelligence</div>
          </div>
        </div>
        {activePanel !== "GEX_VIEW" ? (
          <>
            <KwantSelect value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as SourceFilter)} menuLabel="Positioning source" className="h-8 min-w-28 rounded-xl border border-border bg-surface px-2.5 text-[8px]">
              <option value="COMBINED">Combined · NDX + QQQ</option>
              <option value="NDX">NDX / NDXP</option>
              <option value="QQQ">QQQ</option>
            </KwantSelect>
            <KwantSelect value={expiryFilter} onChange={(event) => setExpiryFilter(event.target.value as ExpiryFilter)} menuLabel="Expiry scope" className="h-8 min-w-24 rounded-xl border border-border bg-surface px-2.5 text-[8px]">
              <option value="ALL">All expiries</option>
              <option value="0DTE">0DTE</option>
            </KwantSelect>
            <KwantSelect value={compositeMode} onChange={(event) => setCompositeMode(event.target.value as CompositeMode)} menuLabel="Composite mode" className="h-8 min-w-24 rounded-xl border border-border bg-surface px-2.5 text-[8px]">
              <option value="ECONOMIC">Economic strength</option>
              <option value="AGREEMENT">Source agreement</option>
            </KwantSelect>
            <KwantSelect
              value={viewMode}
              onChange={(event) => {
                const nextMode = event.target.value as ViewMode;
                setViewMode(nextMode);
                if (nextMode === "SIMPLE") setActivePanel("MAP");
              }}
              menuLabel="Workspace depth"
              className="h-8 min-w-24 rounded-xl border border-border bg-surface px-2.5 text-[8px]"
            >
              <option value="SIMPLE">Simple view</option>
              <option value="ANALYST">Analyst view</option>
            </KwantSelect>
          </>
        ) : null}
        {activePanel !== "GEX_VIEW" ? <div className="ml-auto flex items-center gap-2">
          <span className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[7px] font-semibold ${feedStatus === "live" ? "border-primary/25 bg-primary/[0.06] text-primary" : "border-border bg-surface text-muted"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${feedStatus === "live" ? "animate-pulse bg-primary shadow-[0_0_8px_var(--primary)]" : "bg-muted"}`} />
            {liveInstrument} TAPE {feedStatus.toUpperCase()}
          </span>
          <button type="button" onClick={() => void load()} disabled={refreshing} className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-surface text-muted hover:text-foreground disabled:opacity-40" title="Refresh positioning map"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /></button>
        </div> : null}
      </div>

      <WorkspaceSubnav
        items={panelItems}
        value={activePanel}
        onChange={(id) => {
          setActivePanel(id);
          if (panelItems.find((item) => item.id === id)?.analyst) setViewMode("ANALYST");
        }}
        ariaLabel="Gexdesk sections"
        trailing={(
          <span className="hidden text-[6px] text-muted xl:block">
            MAP = positioning · HEATMAP = call / put activity · TAPE = observed {liveInstrument}
          </span>
        )}
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mx-auto max-w-[1680px] space-y-3">
          {error && activePanel !== "GEX_VIEW" ? <div className="flex items-center gap-2 rounded-xl border border-warning/25 bg-warning/[0.05] px-3 py-2 text-[7px] text-warning"><AlertTriangle className="h-3.5 w-3.5" />Refresh failed; the last successful Gexdesk map remains visible. {error}</div> : null}
          {activePanel !== "GEX_VIEW" ? <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Environment" value={regimeTone.label} detail={`Net / gross ${payload.regime.ratio >= 0 ? "+" : ""}${payload.regime.ratio.toFixed(3)}`} icon={Gauge} tone={regimeTone.text} />
            <MetricCard label="NQ futures" value={formatNumber(livePrice ?? payload.nqPrice)} detail={lastTickAt ? `Tick ${timeAgo(new Date(lastTickAt).toISOString(), now)}` : `Snapshot ${timeAgo(payload.asOf, now)}`} icon={Radio} />
            <MetricCard label="0DTE concentration" value={formatPercent(payload.regime.zeroDteShare)} detail={`${formatCompact(payload.regime.gross)} gross mapped GEX`} icon={Activity} />
            <MetricCard label="Source agreement" value={`${payload.agreement.score}% · ${payload.agreement.label}`} detail={`${payload.agreement.regimeAligned ? "Regimes align" : "Regimes differ"} · corr ${payload.agreement.profileCorrelation.toFixed(2)}`} icon={ShieldCheck} />
            <MetricCard label="Options pressure" value={`${payload.pressure.score >= 0 ? "+" : ""}${payload.pressure.score.toFixed(0)}`} detail={`${payload.pressure.state.replace("_", " ")} · ${payload.pressure.persistence}`} icon={Waves} tone={pressureTone} />
          </section> : null}

          {activePanel === "GEX_VIEW" ? (
            <GexViewWorkspace
              payload={payload}
              history={history}
              historyLoading={historyLoading}
              historyError={historyError}
              livePrice={livePrice}
              sourceFilter={sourceFilter}
              onSourceFilterChange={setSourceFilter}
            />
          ) : activePanel === "MAP" ? (
            <>
          <section className="grid min-h-[610px] gap-3 xl:grid-cols-[minmax(0,1fr)_350px]">
            <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-panel">
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                <div>
                  <div className="flex items-center gap-2 text-[9px] font-semibold"><ScanLine className="h-3.5 w-3.5 text-primary" />MAP · NQ behavioural gamma rail</div>
                  <div className="mt-1 text-[7px] text-muted">{sourceFilter === "COMBINED" ? "NDX/NDXP and QQQ mapped into NQ price" : `${sourceFilter} mapped into NQ price`} · {expiryFilter === "0DTE" ? "same-day concentration" : "all expiries"}</div>
                </div>
                <div className="ml-auto flex items-center gap-3 text-[6px] uppercase tracking-[0.1em] text-muted">
                  <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-primary" />Positive / stabilising</span>
                  <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-accent" />Negative / amplifying</span>
                </div>
              </div>
              <div className="relative h-[570px] overflow-hidden bg-[radial-gradient(circle_at_50%_48%,color-mix(in_srgb,var(--primary)_5%,transparent),transparent_42%)]">
                <svg className="h-full w-full" viewBox={`0 0 1000 ${DISPLAY_HEIGHT}`} preserveAspectRatio="none" role="img" aria-label="NQ mapped options positioning rail">
                  <defs>
                    <linearGradient id="gexdesk-positive" x1="0" x2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.9" />
                    </linearGradient>
                    <linearGradient id="gexdesk-negative" x1="1" x2="0">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.9" />
                    </linearGradient>
                  </defs>
                  {Array.from({ length: 9 }, (_, index) => {
                    const y = DISPLAY_TOP + index / 8 * (DISPLAY_BOTTOM - DISPLAY_TOP);
                    const price = railRange.high - index / 8 * (railRange.high - railRange.low);
                    return (
                      <g key={index}>
                        <line x1="72" x2="936" y1={y} y2={y} stroke="var(--border)" strokeOpacity="0.45" strokeWidth="1" />
                        <text x="944" y={y + 3} fill="var(--muted)" fontSize="10" fontFamily="monospace">{formatNumber(price, 0)}</text>
                      </g>
                    );
                  })}
                  <line x1="500" x2="500" y1={DISPLAY_TOP} y2={DISPLAY_BOTTOM} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 5" />
                  {payload.zones.map((zone) => {
                    const highY = yForPrice(zone.high);
                    const lowY = yForPrice(zone.low);
                    const tone = behaviourTone(zone.behaviour);
                    const active = zone.id === selectedZone?.id;
                    return (
                      <g key={zone.id} onClick={() => setSelectedZoneId(zone.id)} className="cursor-pointer">
                        <rect x="72" y={Math.min(highY, lowY)} width="864" height={Math.max(4, Math.abs(lowY - highY))} fill={tone.color} fillOpacity={active ? 0.12 : 0.055} stroke={tone.color} strokeOpacity={active ? 0.75 : 0.28} strokeWidth={active ? 1.4 : 1} rx="5" />
                        <text x="84" y={yForPrice(zone.center) + 3} fill={tone.color} fontSize="9" fontFamily="monospace" fontWeight="600">{tone.label.toUpperCase()} · {formatNumber(zone.center, 0)} · P{zone.priority}</text>
                      </g>
                    );
                  })}
                  {visibleRail.map(({ row, values }) => {
                    if (values.gross <= 0) return null;
                    const normalized = compositeMode === "AGREEMENT"
                      ? row.sourceAgreement / 100
                      : values.gross / maximumRailGross;
                    const width = Math.max(2, normalized * 330);
                    const positive = values.net >= 0;
                    const y = yForPrice(row.price);
                    return (
                      <rect
                        key={row.price}
                        x={positive ? 500 : 500 - width}
                        y={y - 2.25}
                        width={width}
                        height="4.5"
                        rx="2.25"
                        fill={positive ? "url(#gexdesk-positive)" : "url(#gexdesk-negative)"}
                        opacity={0.38 + normalized * 0.62}
                      />
                    );
                  })}
                  {livePrice !== null ? (
                    <g className="gexdesk-live-price">
                      <line x1="60" x2="942" y1={yForPrice(livePrice)} y2={yForPrice(livePrice)} stroke="var(--foreground)" strokeWidth="1.2" />
                      <circle cx="500" cy={yForPrice(livePrice)} r="5" fill="var(--background)" stroke="var(--primary)" strokeWidth="2" />
                      <rect x="840" y={yForPrice(livePrice) - 11} width="100" height="22" rx="6" fill="var(--primary)" />
                      <text x="890" y={yForPrice(livePrice) + 3.5} textAnchor="middle" fill="var(--background)" fontSize="10" fontFamily="monospace" fontWeight="700">NQ {formatNumber(livePrice)}</text>
                    </g>
                  ) : null}
                  <text x="485" y="20" textAnchor="end" fill="var(--muted)" fontSize="8">AMPLIFYING / NEGATIVE</text>
                  <text x="515" y="20" fill="var(--muted)" fontSize="8">STABILISING / POSITIVE</text>
                </svg>
              </div>
            </div>
            <ZoneFocus zone={selectedZone} livePrice={livePrice} />
          </section>

          <section className="grid gap-3 xl:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-border bg-panel">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3"><Waves className="h-3.5 w-3.5 text-primary" /><span className="text-[9px] font-semibold">PRESSURE · changing options activity</span><span className="ml-auto text-[6px] uppercase tracking-[0.12em] text-muted">Estimated relative index</span></div>
              <div className="p-4">
                <div className="relative h-3 overflow-hidden rounded-full bg-surface">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-foreground/35" />
                  <div
                    className={`absolute inset-y-0 rounded-full ${payload.pressure.score >= 0 ? "left-1/2 bg-primary" : "right-1/2 bg-accent"}`}
                    style={{ width: `${Math.abs(payload.pressure.score) / 2}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between font-mono text-[7px] text-muted"><span>PUT −100</span><span className={pressureTone}>{payload.pressure.score >= 0 ? "+" : ""}{payload.pressure.score.toFixed(1)}</span><span>+100 CALL</span></div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {payload.pressure.sources.map((source) => (
                    <div key={source.symbol} className="rounded-xl border border-border bg-background/30 p-3">
                      <div className="flex items-center justify-between"><span className="text-[8px] font-semibold">{source.symbol}</span><span className={`font-mono text-[10px] font-semibold ${source.score >= 0 ? "text-primary" : "text-accent"}`}>{source.score >= 0 ? "+" : ""}{source.score.toFixed(0)}</span></div>
                      <div className="mt-2 text-[6px] text-muted">{source.tradeCount} prints · {formatPercent(source.confidence)} classification confidence · {formatPercent(source.callShare)} calls</div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[7px] leading-4 text-muted">{payload.pressure.method}.</p>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-panel">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3"><Activity className="h-3.5 w-3.5 text-primary" /><span className="text-[9px] font-semibold">TAPE · observed NQ confirmation</span><span className={`ml-auto text-[7px] font-semibold ${tapeTone}`}>{tape.state}</span></div>
              <div className="grid gap-2 p-4 sm:grid-cols-[120px_120px_1fr]">
                <div className="rounded-xl border border-border bg-background/30 p-3"><div className="text-[6px] uppercase tracking-[0.12em] text-muted">30s delta</div><div className={`mt-2 font-mono text-[13px] font-semibold ${tape.delta >= 0 ? "text-primary" : "text-accent"}`}>{tape.delta >= 0 ? "+" : ""}{tape.delta.toFixed(0)}</div></div>
                <div className="rounded-xl border border-border bg-background/30 p-3"><div className="text-[6px] uppercase tracking-[0.12em] text-muted">Velocity</div><div className={`mt-2 font-mono text-[13px] font-semibold ${tape.velocity >= 0 ? "text-primary" : "text-accent"}`}>{tape.velocity >= 0 ? "+" : ""}{tape.velocity.toFixed(2)} <span className="text-[6px] text-muted">pt/s</span></div></div>
                <div className="rounded-xl border border-border bg-background/30 p-3"><div className="text-[6px] uppercase tracking-[0.12em] text-muted">Read</div><p className="mt-2 text-[8px] leading-5 text-foreground">{tape.detail}</p></div>
              </div>
            </div>
          </section>

          {viewMode === "ANALYST" ? (
            <section className="grid gap-3 xl:grid-cols-[1.2fr_1fr]">
              <div className="overflow-hidden rounded-2xl border border-border bg-panel">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3"><BarChart3 className="h-3.5 w-3.5 text-primary" /><span className="text-[9px] font-semibold">Expiration structure</span></div>
                <div className="max-h-64 overflow-y-auto">
                  <div className="grid grid-cols-[100px_70px_1fr_90px] border-b border-border px-4 py-2 text-[6px] uppercase tracking-[0.11em] text-muted"><span>Expiry</span><span>Source</span><span>Balance</span><span className="text-right">Gross</span></div>
                  {payload.expiries.slice(0, 18).map((row) => {
                    const ratio = row.gross > 0 ? clamp(row.net / row.gross, -1, 1) : 0;
                    return (
                      <div key={`${row.source}:${row.expiration}`} className="grid grid-cols-[100px_70px_1fr_90px] items-center border-b border-border/45 px-4 py-2 text-[7px]">
                        <span className="font-mono">{row.expiration}</span>
                        <span className="text-muted">{row.source}</span>
                        <div className="relative h-1.5 rounded-full bg-surface"><div className={`absolute inset-y-0 rounded-full ${ratio >= 0 ? "left-1/2 bg-primary" : "right-1/2 bg-accent"}`} style={{ width: `${Math.abs(ratio) * 50}%` }} /></div>
                        <span className="text-right font-mono text-muted">{formatCompact(row.gross)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-panel p-4">
                <div className="flex items-center gap-2 text-[9px] font-semibold"><ShieldCheck className="h-3.5 w-3.5 text-primary" />Source integrity</div>
                <div className="mt-4 space-y-2">
                  {payload.sources.map((source) => (
                    <div key={source.symbol} className="flex items-center gap-3 rounded-xl border border-border bg-background/30 p-3">
                      <span className={`h-2 w-2 rounded-full ${source.status === "LIVE" ? "bg-primary shadow-[0_0_8px_var(--primary)]" : source.status === "LAST_GOOD" ? "bg-warning" : "bg-danger"}`} />
                      <div className="min-w-0 flex-1"><div className="text-[8px] font-semibold">{source.symbol} positioning</div><div className="mt-1 truncate text-[6px] text-muted">{source.error || `${formatNumber(source.spot)} source spot · ${timeAgo(source.asOf, now)}`}</div></div>
                      <span className="text-[6px] font-semibold uppercase tracking-[0.1em] text-muted">{source.status.replace("_", " ")}</span>
                    </div>
                  ))}
                </div>
                {payload.errors.length ? <div className="mt-3 rounded-xl border border-warning/20 bg-warning/[0.04] p-3 text-[7px] leading-4 text-warning">{payload.errors.join(" · ")}</div> : null}
              </div>
            </section>
          ) : null}
            </>
          ) : activePanel === "HEATMAP" ? (
            <GexDeskHeatmapBoundary key={`${payload.sessionDate}:${sourceFilter}`}>
              <GexDeskOptionsHeatmap
                payload={payload}
                history={history}
                historyLoading={historyLoading}
                historyError={historyError}
                livePrice={livePrice}
                priceTicks={heatPriceTicksRef.current}
                feedStatus={feedStatus}
                liveInstrument={liveInstrument}
              />
            </GexDeskHeatmapBoundary>
          ) : (
            <GexDeskDepthPanels
              panel={activePanel}
              payload={payload}
              history={history}
              historyLoading={historyLoading}
              historyError={historyError}
              sourceFilter={sourceFilter}
              livePrice={livePrice}
              selectedZone={selectedZone}
              tapeTicks={tickBufferRef.current}
              feedStatus={feedStatus}
            />
          )}

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-panel px-3 py-2 text-[6px] leading-4 text-muted">
            <AlertTriangle className="h-3 w-3 shrink-0 text-warning" />
            <span>{payload.disclosure}</span>
            <span className="ml-auto">Kwant Data proprietary positioning model · NQ tape via CME · snapshot {timeAgo(payload.asOf, now)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
