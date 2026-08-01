"use client";

import {
  Activity,
  AlarmClock,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bell,
  Bot,
  BrainCircuit,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileDown,
  Gauge,
  GitCompareArrows,
  History,
  Info,
  Layers3,
  ListChecks,
  Loader2,
  Map,
  Pin,
  Radio,
  RefreshCw,
  Route,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import KwantLoader from "@/components/KwantLoader";
import {
  GAMEPLAN_SESSIONS,
  gameplanSessionConfig,
  gameplanSessionLabel,
  type GameplanEdition,
  type GameplanPayload,
  type GameplanRole,
  type GameplanSession,
  type GameplanTapeState,
} from "@/lib/gameplan";
import {
  GAMEPLAN_CHART_OVERLAYS_EVENT,
  createGameplanChartOverlay,
  loadGameplanChartOverlays,
  saveGameplanChartOverlay,
} from "@/lib/gameplanChartOverlay";
import {
  calculateVolatilitySnapshot,
  type VolatilityCandle,
  type VolatilitySnapshot,
} from "@/lib/volatilityRegime";
import {
  calculateVolumeIntelligence,
  type VolumeIntelligenceSnapshot,
} from "@/lib/volumeIntelligence";
import {
  analystPublishReason,
  buildLiveAnalystSnapshot,
  createLiveAnalystEntry,
  isLiveAnalystEntry,
  reviewLiveAnalystEntry,
  type LiveAnalystEntry,
  type LiveAnalystSnapshot,
} from "@/lib/gameplanLiveAnalyst";
import {
  GAMEPLAN_TIMEFRAMES,
  buildGameplanTimeframeContexts,
  isGameplanTimeframeContext,
  type GameplanTimeframeContext,
  type GameplanTimeframeId,
} from "@/lib/gameplanTimeframeAnalysis";
import {
  DATABENTO_LIVE_STATUS_EVENT,
  DATABENTO_LIVE_TICK_EVENT,
  type DatabentoLiveStatus,
} from "@/lib/chartLiveEvents";
import { zyonGameplanLaunchHref } from "@/lib/zyonGameplanLaunch";
import {
  fetchWorkspaceData,
  gameplanCacheKey,
  readWorkspaceData,
} from "@/lib/workspaceDataCache";
import GameplanRecordsWorkspace, { type GameplanRecordTab } from "@/components/gameplan/GameplanRecordsWorkspace";

type DetailMode = "beginner" | "standard" | "pro";
type Level = GameplanEdition["ladder"][number];
type OneLinerSnapshot = {
  instrument: "NQ" | "ES";
  session: GameplanSession;
  text: string;
  price: number | null;
  updatedAt: string;
};

const ONE_LINER_REFRESH_MS = 5 * 60_000;
const LIVE_FEED_FAILURE_GRACE_MS = 60_000;

const ROLE_COPY: Record<GameplanRole, string> = {
  magnet: "Price is pulled here and can stick. Consolidation is more likely than immediate travel.",
  wall: "Approaches can stall because active positioning is likely to defend this area.",
  accelerant: "Once accepted through, there is less positioning behind it and price can travel quickly.",
  decision: "Two different session paths split here. The side that earns acceptance controls the next move.",
};

const GLOSSARY: Record<string, string> = {
  Acceptance: "Price does more than touch a level: it spends time and completes trade on the other side. Acceptance is what turns a break into information.",
  Magnet: "A positioning concentration that repeatedly pulls price back toward it. Magnets often create sticky, two-way trade.",
  Wall: "A level where positioning can force defensive orders into the market. The first approach often slows or reacts.",
  Accelerant: "A boundary with comparatively little positioning behind it. Accepted breaks can travel faster through the air pocket.",
  Print: "The live behaviour at the level: whether aggressive orders make progress and whether price can actually leave. The print is permission; the map alone is not.",
  Flip: "A level where the options environment changes character. Above and below it, dealer hedging can affect market movement differently.",
  Belly: "The low-edge space between important levels. It is usually where traders get chopped up by taking a trade without location.",
};

function formatPrice(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

function formatZone(zone: [number, number]) {
  return zone[0] === zone[1] ? formatPrice(zone[0]) : `${formatPrice(zone[0])}–${formatPrice(zone[1])}`;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", timeZone: "Australia/Brisbane" });
}

function formatLiveTimestamp(value: string | null) {
  if (!value) return "Waiting for live price";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Waiting for live price";
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "America/New_York",
    timeZoneName: "short",
  });
}

function formatUpdateAge(value: string | null, now: number) {
  if (!value) return "";
  const updatedAt = new Date(value).getTime();
  if (!Number.isFinite(updatedAt)) return "";
  const seconds = Math.max(0, Math.floor((now - updatedAt) / 1_000));
  if (seconds < 2) return "live";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

function distanceFromZone(price: number, zone: [number, number]) {
  if (price < zone[0]) return zone[0] - price;
  if (price > zone[1]) return price - zone[1];
  return 0;
}

function buildLiveOneLiner(plan: GameplanEdition, root: "NQ" | "ES", currentPrice: number | null) {
  if (currentPrice === null || !Number.isFinite(currentPrice) || !plan.ladder.length) return plan.one_liner;

  const levels = [...plan.ladder].sort((a, b) => a.zone[0] - b.zone[0]);
  const inside = levels.find((level) => currentPrice >= level.zone[0] && currentPrice <= level.zone[1]);
  const closest = levels.reduce((best, level) => (
    distanceFromZone(currentPrice, level.zone) < distanceFromZone(currentPrice, best.zone) ? level : best
  ), levels[0]);
  const closestDistance = distanceFromZone(currentPrice, closest.zone);
  const approachDistance = root === "NQ" ? 35 : 10;
  const tapeCopy = plan.environment.tape.state === "snowball"
    ? "An accepted break can accelerate, so do not fade it until price proves failure."
    : plan.environment.tape.state === "calm"
      ? "The first clean defence favours rotation; repeated tests weaken it."
      : "Wait for a clean hold or accepted break before choosing the next path.";

  if (inside) {
    return `${root} at ${formatPrice(currentPrice)} is trading inside ${inside.name} ${formatZone(inside.zone)}; this is the live decision point. ${tapeCopy}`;
  }

  const side = currentPrice < closest.zone[0] ? "below" : "above";
  if (closestDistance <= approachDistance) {
    return `${root} at ${formatPrice(currentPrice)} is ${formatPrice(closestDistance)} points ${side} ${closest.name} ${formatZone(closest.zone)}; prepare for the first reaction. ${tapeCopy}`;
  }

  const below = [...levels].reverse().find((level) => level.zone[1] < currentPrice);
  const above = levels.find((level) => level.zone[0] > currentPrice);
  if (below && above) {
    return `${root} at ${formatPrice(currentPrice)} is rotating between ${below.name} ${formatZone(below.zone)} and ${above.name} ${formatZone(above.zone)}; ${closest.name} is closest, ${formatPrice(closestDistance)} points away, so avoid chasing the middle.`;
  }

  return `${root} at ${formatPrice(currentPrice)} is outside the mapped ladder and ${formatPrice(closestDistance)} points ${side} ${closest.name} ${formatZone(closest.zone)}; wait for acceptance or a decisive return into the map.`;
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function timeZoneOffset(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return asUtc - date.getTime();
}

function nextOpen(session: GameplanSession) {
  const now = new Date();
  const config = gameplanSessionConfig(session);
  const sessionDateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: config.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(sessionDateParts.map((part) => [part.type, part.value]));
  const utcGuess = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    config.openHour,
    config.openMinute,
  );
  let target = utcGuess - timeZoneOffset(new Date(utcGuess), config.timeZone);
  if (target <= now.getTime()) {
    const tomorrowGuess = utcGuess + 86_400_000;
    target = tomorrowGuess - timeZoneOffset(new Date(tomorrowGuess), config.timeZone);
  }
  return target;
}

function useCountdown(session: GameplanSession) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, nextOpen(session) - Date.now()));
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [session]);
  const totalSeconds = Math.floor(remaining / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`rounded-2xl border border-border bg-panel ${className}`}>{children}</section>;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-muted">{children}</div>;
}

function SectionHeading({
  icon: Icon,
  eyebrow,
  title,
  trailing,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3.5 lg:px-5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="mt-0.5 truncate text-[14px] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
      </div>
      {trailing ? <div className="ml-auto">{trailing}</div> : null}
    </div>
  );
}

function TapeBadge({ state }: { state: GameplanTapeState }) {
  const label = state === "calm" ? "CALM TAPE" : state === "snowball" ? "SNOWBALL TAPE" : "MIXED TAPE";
  const sub = state === "calm" ? "positive gamma" : state === "snowball" ? "negative gamma" : "balanced gamma";
  return (
    <div className={`rounded-xl border px-3 py-2 ${state === "snowball" ? "border-danger/25 bg-danger/10" : "border-primary/25 bg-primary/10"}`}>
      <div className={`text-[10px] font-bold tracking-[0.12em] ${state === "snowball" ? "text-danger" : "text-primary"}`}>{label}</div>
      <div className="mt-0.5 text-[9px] text-muted">{sub} · {state === "calm" ? "moves stall" : state === "snowball" ? "moves run" : "levels decide"}</div>
    </div>
  );
}

function Strength({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`Strength ${value} of 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={`h-1.5 w-4 rounded-full ${index < value ? "bg-primary" : "bg-surface"}`} />
      ))}
    </div>
  );
}

function TermButton({ term, onClick }: { term: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="border-b border-dotted border-muted/50 text-inherit hover:border-primary hover:text-primary">
      {term}
    </button>
  );
}

function LevelCard({
  level,
  mode,
  walkthrough,
  onGlossary,
}: {
  level: Level;
  mode: DetailMode;
  walkthrough: boolean;
  onGlossary: (term: string) => void;
}) {
  return (
    <div className="border-t border-border bg-background/35 px-4 pb-5 pt-4 lg:px-5">
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-3.5 lg:col-span-2">
          <Eyebrow>Why this level exists</Eyebrow>
          <p className="mt-2 text-[12px] leading-5 text-foreground">{level.why}</p>
          {mode !== "beginner" ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {level.sources.map((source) => (
                <span key={source} className="rounded-md border border-border bg-surface px-2 py-1 text-[9px] font-medium text-muted">
                  {source}
                </span>
              ))}
              {level.sources.length > 1 ? <span className="px-1 py-1 text-[9px] text-primary">{level.sources.length} methods agree</span> : null}
            </div>
          ) : null}
        </div>
        <div className="rounded-xl border border-border bg-card p-3.5">
          <Eyebrow>Expected behaviour</Eyebrow>
          <button type="button" onClick={() => onGlossary(level.role[0].toUpperCase() + level.role.slice(1))} className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-primary">
            {level.role}
          </button>
          <p className="mt-1.5 text-[10px] leading-4 text-muted">{ROLE_COPY[level.role]}</p>
        </div>
      </div>

      {walkthrough ? (
        <div className="mt-3 rounded-xl border border-primary/20 bg-primary/[0.045] p-4">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
            <Route className="h-3.5 w-3.5" /> What if we get there?
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
            {[
              ["01 · Approach", level.if_visit],
              ["02 · Holds", level.if_hold],
              ["03 · Breaks + stays broken", level.if_break],
            ].map(([label, copy], index) => (
              <div key={label} className="contents">
                <div className="rounded-xl border border-border bg-panel p-3">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</div>
                  <p className="mt-2 text-[11px] leading-5 text-foreground">{copy}</p>
                </div>
                {index < 2 ? <ArrowRight className="mx-auto hidden h-4 w-4 self-center text-primary/60 md:block" /> : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {[
            ["If we get there", level.if_visit, Target],
            ["If it holds", level.if_hold, ArrowUp],
            ["If it breaks + accepts", level.if_break, ArrowDown],
          ].map(([title, copy, Icon]) => {
            const StepIcon = Icon as LucideIcon;
            return (
              <div key={title as string} className="rounded-xl border border-border bg-card p-3.5">
                <div className="flex items-center gap-2 text-[10px] font-semibold text-foreground">
                  <StepIcon className="h-3.5 w-3.5 text-primary" /> {title as string}
                </div>
                <p className="mt-2 text-[10px] leading-[1.65] text-muted">{copy as string}</p>
              </div>
            );
          })}
        </div>
      )}

      {mode !== "beginner" ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-3.5">
            <div className="flex items-center justify-between">
              <Eyebrow>Order character</Eyebrow>
              <span className="text-[9px] text-muted">{level.order_character.balance > 0 ? "buyer defence" : level.order_character.balance < 0 ? "seller defence" : "balanced"}</span>
            </div>
            <div className="relative mt-3 h-1.5 rounded-full bg-surface">
              <div className="absolute left-1/2 top-[-3px] h-3 w-px bg-muted/60" />
              <div
                className={`absolute top-0 h-1.5 rounded-full ${level.order_character.balance >= 0 ? "left-1/2 bg-primary" : "right-1/2 bg-danger"}`}
                style={{ width: `${Math.abs(level.order_character.balance) * 50}%` }}
              />
            </div>
            <p className="mt-3 text-[10px] leading-4 text-muted">{level.order_character.plain}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3.5">
            <Eyebrow>Consolidation or travel?</Eyebrow>
            <div className="mt-2 flex items-center gap-2">
              {level.terrain === "sticky" ? <Layers3 className="h-4 w-4 text-primary" /> : <Zap className="h-4 w-4 text-primary" />}
              <span className="text-[11px] font-semibold text-foreground">{level.terrain === "sticky" ? "Sticky zone" : "Air pocket"}</span>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-muted">
              {level.terrain === "sticky" ? "Expect chop and repeated orders filling around the level." : "Few orders are expected behind the boundary; accepted price can cross quickly."}
            </p>
          </div>
        </div>
      ) : null}

      {mode === "pro" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-[9px] text-muted">
          <span>Zone midpoint <strong className="font-mono text-foreground">{formatPrice((level.zone[0] + level.zone[1]) / 2)}</strong></span>
          <span>·</span>
          <span>Source count <strong className="font-mono text-foreground">{level.sources.length}</strong></span>
          <span>·</span>
          <span>Raw strength <strong className="font-mono text-foreground">{level.strength}/5</strong></span>
        </div>
      ) : null}
    </div>
  );
}

function Ladder({
  plan,
  currentPrice,
  priceTick,
  feedState,
  mode,
  whatIf,
  setWhatIf,
  onGlossary,
}: {
  plan: GameplanEdition;
  currentPrice: number | null;
  priceTick: "up" | "down" | "flat";
  feedState: "connecting" | "live" | "fallback";
  mode: DetailMode;
  whatIf: boolean;
  setWhatIf: (value: boolean) => void;
  onGlossary: (term: string) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(0);
  const ladderBodyRef = useRef<HTMLDivElement>(null);
  const levelRowRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [markerTop, setMarkerTop] = useState<number | null>(null);
  const nearestIndex = useMemo(() => {
    if (currentPrice === null || !plan.ladder.length) return -1;
    return plan.ladder.reduce((best, level, index) => {
      const price = (level.zone[0] + level.zone[1]) / 2;
      const bestPrice = (plan.ladder[best].zone[0] + plan.ladder[best].zone[1]) / 2;
      return Math.abs(price - currentPrice) < Math.abs(bestPrice - currentPrice) ? index : best;
    }, 0);
  }, [currentPrice, plan.ladder]);

  useEffect(() => {
    const ladderBody = ladderBodyRef.current;
    if (!ladderBody || currentPrice === null || !plan.ladder.length) {
      setMarkerTop(null);
      return;
    }

    const positionMarker = () => {
      const bodyRect = ladderBody.getBoundingClientRect();
      const points = plan.ladder.flatMap((level, index) => {
        const row = levelRowRefs.current[index];
        if (!row) return [];
        const rect = row.getBoundingClientRect();
        return [{
          price: (level.zone[0] + level.zone[1]) / 2,
          y: rect.top - bodyRect.top + rect.height / 2,
        }];
      });
      if (!points.length) return;

      let nextTop = points[0].y;
      if (currentPrice >= points[0].price) {
        const second = points[1];
        const pixelsPerPoint = second
          ? Math.abs((second.y - points[0].y) / Math.max(1, points[0].price - second.price))
          : 0;
        nextTop = points[0].y - Math.min(34, (currentPrice - points[0].price) * pixelsPerPoint);
      } else if (currentPrice <= points[points.length - 1].price) {
        const last = points[points.length - 1];
        const previous = points[points.length - 2];
        const pixelsPerPoint = previous
          ? Math.abs((last.y - previous.y) / Math.max(1, previous.price - last.price))
          : 0;
        nextTop = last.y + Math.min(34, (last.price - currentPrice) * pixelsPerPoint);
      } else {
        for (let index = 0; index < points.length - 1; index += 1) {
          const upper = points[index];
          const lower = points[index + 1];
          if (currentPrice <= upper.price && currentPrice >= lower.price) {
            const progress = (upper.price - currentPrice) / Math.max(0.0001, upper.price - lower.price);
            nextTop = upper.y + (lower.y - upper.y) * progress;
            break;
          }
        }
      }
      setMarkerTop(Math.max(14, Math.min(ladderBody.clientHeight - 14, nextTop)));
    };

    const frame = window.requestAnimationFrame(positionMarker);
    const observer = new ResizeObserver(positionMarker);
    observer.observe(ladderBody);
    levelRowRefs.current.forEach((row) => {
      if (row) observer.observe(row);
    });
    window.addEventListener("resize", positionMarker);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", positionMarker);
    };
  }, [currentPrice, expanded, plan.ladder]);

  return (
    <Panel className="overflow-hidden">
      <SectionHeading
        icon={Map}
        eyebrow="The levels that matter"
        title="Session ladder"
        trailing={(
          <button
            type="button"
            onClick={() => setWhatIf(!whatIf)}
            className={`flex h-8 items-center gap-2 rounded-xl border px-3 text-[10px] font-semibold transition-colors ${whatIf ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-surface text-muted hover:text-foreground"}`}
          >
            <Sparkles className="h-3.5 w-3.5" /> What if?
          </button>
        )}
      />
      <div ref={ladderBodyRef} className="relative px-3 py-3 lg:px-5">
        <div className="pointer-events-none absolute bottom-4 left-[91px] top-4 w-px bg-gradient-to-b from-transparent via-border to-transparent lg:left-[113px]" />
        {currentPrice !== null && markerTop !== null ? (
          <div
            className="pointer-events-none absolute inset-x-3 z-20 flex -translate-y-1/2 items-center transition-[top] duration-200 ease-out lg:inset-x-5"
            style={{ top: markerTop }}
            aria-live="polite"
          >
            <span className={`w-[76px] shrink-0 rounded-md border bg-panel/95 px-1.5 py-1 text-right font-mono text-[10px] font-semibold shadow-lg backdrop-blur transition-colors lg:w-[98px] ${
              priceTick === "up"
                ? "border-primary/50 text-primary"
                : priceTick === "down"
                  ? "border-danger/50 text-danger"
                  : "border-primary/25 text-primary"
            }`}>
              {formatPrice(currentPrice)}
            </span>
            <span className={`ml-2 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-background transition-all ${
              priceTick === "up"
                ? "scale-125 bg-primary shadow-[0_0_15px_var(--primary)]"
                : priceTick === "down"
                  ? "scale-125 bg-danger shadow-[0_0_15px_var(--danger)]"
                  : "bg-primary shadow-[0_0_10px_var(--primary)]"
            }`} />
            <span className={`h-px min-w-3 flex-1 ${priceTick === "down" ? "bg-danger/45" : "bg-primary/45"}`} />
            <span className={`flex shrink-0 items-center gap-1.5 rounded-md border bg-panel/95 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.15em] shadow-lg backdrop-blur ${
              priceTick === "down" ? "border-danger/30 text-danger" : "border-primary/30 text-primary"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${feedState === "live" ? "animate-pulse bg-primary" : "bg-muted"}`} />
              You are here
            </span>
          </div>
        ) : null}
        {plan.ladder.map((level, index) => {
          const open = expanded === index;
          const approaching = nearestIndex === index;
          const belly = plan.belly_zones.find(([low, high]) => high <= level.zone[0] && index < plan.ladder.length - 1);
          return (
            <div key={`${level.name}-${level.zone[0]}`} className={`relative ${expanded !== null && !open ? "opacity-65" : "opacity-100"} transition-opacity`}>
              <button
                ref={(node) => {
                  levelRowRefs.current[index] = node;
                }}
                type="button"
                onClick={() => setExpanded(open ? null : index)}
                aria-expanded={open}
                className={`relative z-[1] grid w-full grid-cols-[76px_18px_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border px-2 py-3 text-left transition-all lg:grid-cols-[98px_20px_minmax(0,1fr)_auto] lg:px-3 ${open ? "border-primary/30 bg-primary/[0.055]" : approaching ? "border-primary/20 bg-primary/[0.025]" : "border-transparent hover:border-border hover:bg-surface/40"} ${approaching ? "gameplan-current-level" : ""}`}
              >
                <span className="text-right font-mono text-[11px] font-semibold text-foreground lg:text-[12px]">{formatZone(level.zone)}</span>
                <span className={`mx-auto h-2.5 w-2.5 rounded-full border-2 border-background ${open || approaching ? "bg-primary shadow-[0_0_9px_var(--primary)]" : "bg-muted"}`} />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[11px] font-bold tracking-[0.04em] text-foreground lg:text-[12px]">{level.name}</span>
                    <span className="rounded-md bg-surface px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">
                      {level.role}
                    </span>
                  </span>
                  <span className="mt-1 block text-[9px] leading-4 text-muted">
                    {mode === "beginner" ? ROLE_COPY[level.role] : level.why}
                  </span>
                </span>
                <span className="flex items-center gap-3 pl-2">
                  <span className="hidden sm:block"><Strength value={level.strength} /></span>
                  <ChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? "rotate-180 text-primary" : ""}`} />
                </span>
              </button>
              {open ? <LevelCard level={level} mode={mode} walkthrough={whatIf} onGlossary={onGlossary} /> : null}
              {belly ? (
                <div className="relative z-0 my-1 ml-[94px] flex min-h-9 items-center rounded-lg border border-dashed border-border/70 bg-[repeating-linear-gradient(-45deg,transparent,transparent_7px,color-mix(in_srgb,var(--color-surface)_45%,transparent)_7px,color-mix(in_srgb,var(--color-surface)_45%,transparent)_8px)] px-3 lg:ml-[119px]">
                  <span className="text-[8px] font-semibold uppercase tracking-[0.15em] text-muted">
                    No-man&apos;s land · {formatZone(belly)} · no edge here
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function Environment({
  plan,
  snapshot,
  loading,
  error,
  feedState,
}: {
  plan: GameplanEdition;
  snapshot: VolatilitySnapshot | null;
  loading: boolean;
  error: string | null;
  feedState: "connecting" | "live" | "fallback";
}) {
  const elevated = (snapshot?.score ?? 0) >= 60;
  const regimeTone = elevated ? "text-danger" : "text-primary";
  const markerTone = elevated
    ? "bg-danger shadow-[0_0_14px_var(--danger)]"
    : "bg-primary shadow-[0_0_14px_var(--primary)]";
  const tapeLabel = plan.environment.tape.state === "calm"
    ? "CALM TAPE"
    : plan.environment.tape.state === "snowball"
      ? "SNOWBALL TAPE"
      : "MIXED TAPE";

  return (
    <Panel className="overflow-hidden">
      <SectionHeading
        icon={Gauge}
        eyebrow="How to trade the map"
        title="Volatility calculator"
        trailing={(
          <span className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 font-mono text-[8px] font-semibold ${
            feedState === "live"
              ? "border-primary/20 bg-primary/10 text-primary"
              : "border-border bg-surface text-muted"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${feedState === "live" ? "animate-pulse bg-primary" : "bg-muted"}`} />
            {feedState === "live" ? "LIVE" : feedState === "connecting" ? "CONNECTING" : "CME FALLBACK"}
          </span>
        )}
      />

      {loading && !snapshot ? (
        <div className="space-y-3 p-4">
          <div className="h-20 animate-pulse rounded-xl bg-surface" />
          <div className="grid grid-cols-3 gap-2">
            <div className="h-14 animate-pulse rounded-xl bg-surface" />
            <div className="h-14 animate-pulse rounded-xl bg-surface" />
            <div className="h-14 animate-pulse rounded-xl bg-surface" />
          </div>
        </div>
      ) : !snapshot ? (
        <div className="p-4">
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <Gauge className="mx-auto h-5 w-5 text-muted" />
            <div className="mt-2 text-[11px] font-semibold text-foreground">Building the volatility baseline</div>
            <p className="mt-1 text-[9px] leading-4 text-muted">
              {error ?? "Waiting for enough verified five-minute CME history to rank the current market."}
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4">
          <div className="flex items-end gap-3">
            <div className={`text-[28px] font-semibold leading-none tracking-[-0.04em] ${regimeTone}`}>{snapshot.regime}</div>
            <div className="font-mono text-[12px] text-muted">{snapshot.score}<span className="text-[9px]"> / 100</span></div>
            <span className={`ml-auto rounded-md border px-2 py-1 font-mono text-[8px] font-semibold ${
              snapshot.trend === "RISING"
                ? "border-danger/20 bg-danger/10 text-danger"
                : snapshot.trend === "EASING"
                  ? "border-primary/20 bg-primary/10 text-primary"
                  : "border-border bg-surface text-muted"
            }`}>{snapshot.trend}</span>
          </div>

          <div className="relative mt-4">
            <div
              className="h-2 rounded-full"
              style={{
                background: "linear-gradient(90deg, color-mix(in srgb, var(--primary) 18%, var(--surface)) 0%, var(--primary) 50%, var(--danger) 100%)",
              }}
            />
            <span
              className={`absolute top-1/2 h-3.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background ${markerTone}`}
              style={{ left: `${snapshot.score}%` }}
            />
            <div className="mt-2 flex justify-between font-mono text-[7px] uppercase tracking-[0.08em] text-muted">
              <span>Low</span><span>Quiet</span><span>Normal</span><span>High</span><span>Extreme</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[8px] uppercase tracking-[0.12em] text-muted">Realised pace</div>
              <div className="mt-1 font-mono text-[12px] font-semibold text-foreground">{snapshot.paceRatio.toFixed(2)}×</div>
              <div className="mt-1 text-[8px] text-muted">{snapshot.pacePercentile}th percentile</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[8px] uppercase tracking-[0.12em] text-muted">60m range</div>
              <div className="mt-1 font-mono text-[12px] font-semibold text-foreground">{formatPrice(snapshot.currentRange)}</div>
              <div className="mt-1 text-[8px] text-muted">Typical {formatPrice(snapshot.typicalRange)}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[8px] uppercase tracking-[0.12em] text-muted">Impulse</div>
              <div className="mt-1 font-mono text-[12px] font-semibold text-foreground">{snapshot.impulsePercentile}th</div>
              <div className="mt-1 text-[8px] text-muted">Range {snapshot.rangePercentile}th pct</div>
            </div>
          </div>

          <div className={`mt-3 rounded-xl border p-3 ${
            elevated ? "border-danger/20 bg-danger/[0.055]" : "border-primary/20 bg-primary/[0.045]"
          }`}>
            <div className={`text-[8px] font-semibold uppercase tracking-[0.14em] ${regimeTone}`}>Map adjustment</div>
            <p className="mt-1.5 text-[9px] leading-4 text-muted">{snapshot.guidance}</p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[8px] text-muted">
            <span className="rounded-md border border-border bg-surface px-2 py-1">{tapeLabel}</span>
            <span className="rounded-md border border-border bg-surface px-2 py-1">{plan.environment.fear.ratio.toFixed(2)}× IV / realised</span>
            <span className="rounded-md border border-border bg-surface px-2 py-1">{snapshot.sampleCount} windows / {snapshot.historyDays}D</span>
            <span className="ml-auto font-mono">{formatLiveTimestamp(snapshot.updatedAt)}</span>
          </div>
        </div>
      )}
    </Panel>
  );
}

const VOLUME_FORMATTER = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatVolume(value: number | null | undefined) {
  return value && Number.isFinite(value) ? VOLUME_FORMATTER.format(value) : "—";
}

function VolumeIntelligence({
  snapshot,
  loading,
  error,
  feedState,
}: {
  snapshot: VolumeIntelligenceSnapshot | null;
  loading: boolean;
  error: string | null;
  feedState: "connecting" | "live" | "fallback";
}) {
  const activeTone = snapshot?.paceLabel === "HEAVY" || snapshot?.paceLabel === "ACTIVE";

  return (
    <Panel className="overflow-hidden">
      <SectionHeading
        icon={Activity}
        eyebrow="Participation and session pace"
        title="Volume intelligence"
        trailing={(
          <span className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 font-mono text-[8px] font-semibold ${
            feedState === "live"
              ? "border-primary/20 bg-primary/10 text-primary"
              : "border-border bg-surface text-muted"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${feedState === "live" ? "animate-pulse bg-primary" : "bg-muted"}`} />
            {feedState === "live" ? "LIVE CME VOLUME" : feedState === "connecting" ? "CONNECTING" : "LAST VERIFIED"}
          </span>
        )}
      />

      {loading && !snapshot ? (
        <div className="space-y-3 p-4">
          <div className="h-20 animate-pulse rounded-xl bg-surface" />
          <div className="grid grid-cols-3 gap-2">
            <div className="h-24 animate-pulse rounded-xl bg-surface" />
            <div className="h-24 animate-pulse rounded-xl bg-surface" />
            <div className="h-24 animate-pulse rounded-xl bg-surface" />
          </div>
        </div>
      ) : !snapshot ? (
        <div className="p-4">
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <Activity className="mx-auto h-5 w-5 text-muted" />
            <div className="mt-2 text-[11px] font-semibold text-foreground">Building the session-volume baseline</div>
            <p className="mt-1 text-[9px] leading-4 text-muted">
              {error ?? "Waiting for enough verified CME volume to compare Asia, London, and New York."}
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4">
          <div className="flex items-end gap-3">
            <div className={`text-[28px] font-semibold leading-none tracking-[-0.04em] ${activeTone ? "text-primary" : "text-foreground"}`}>
              {snapshot.paceLabel}
            </div>
            <div className="font-mono text-[12px] text-muted">
              {snapshot.paceScore}<span className="text-[9px]"> / 100</span>
            </div>
            <span className={`ml-auto rounded-md border px-2 py-1 font-mono text-[8px] font-semibold ${
              snapshot.trend === "RISING"
                ? "border-primary/25 bg-primary/10 text-primary"
                : "border-border bg-surface text-muted"
            }`}>
              {snapshot.trend}
            </span>
          </div>

          <div className="relative mt-4">
            <div
              className="h-2 rounded-full"
              style={{
                background: "linear-gradient(90deg, var(--surface) 0%, color-mix(in srgb, var(--primary) 45%, var(--surface)) 50%, var(--primary) 100%)",
              }}
            />
            <span
              className="absolute top-1/2 h-3.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-background bg-primary shadow-[0_0_14px_var(--primary)]"
              style={{ left: `${snapshot.paceScore}%` }}
            />
            <div className="mt-2 flex justify-between font-mono text-[7px] uppercase tracking-[0.08em] text-muted">
              <span>Quiet</span><span>Normal</span><span>Heavy</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[8px] uppercase tracking-[0.12em] text-muted">{snapshot.rollingWindowMinutes}m average</div>
              <div className="mt-1 font-mono text-[13px] font-semibold text-foreground">{formatVolume(snapshot.rollingAverageVolume)}</div>
              <div className="mt-1 text-[8px] text-muted">contracts per 5m bar</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[8px] uppercase tracking-[0.12em] text-muted">Relative pace</div>
              <div className="mt-1 font-mono text-[13px] font-semibold text-primary">{snapshot.paceRatio.toFixed(2)}×</div>
              <div className="mt-1 text-[8px] text-muted">same-phase baseline</div>
            </div>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            {snapshot.sessions.map((sessionVolume) => {
              const comparisonPercent = Math.round(sessionVolume.comparisonRatio * 100);
              const scalePosition = Math.max(2, Math.min(100, sessionVolume.comparisonRatio * 50));
              return (
                <div
                  key={sessionVolume.id}
                  className={`rounded-xl border p-3 ${
                    sessionVolume.active
                      ? "border-primary/30 bg-primary/[0.055] shadow-[0_0_22px_color-mix(in_srgb,var(--primary)_7%,transparent)]"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${sessionVolume.active ? "animate-pulse bg-primary shadow-[0_0_7px_var(--primary)]" : "bg-muted/60"}`} />
                    <span className="text-[9px] font-semibold text-foreground">{sessionVolume.label}</span>
                    <span className="ml-auto font-mono text-[7px] text-muted">{sessionVolume.active ? "ACTIVE" : "LAST"}</span>
                  </div>
                  <div className="mt-1 font-mono text-[7px] text-muted">{sessionVolume.windowLabel}</div>
                  <div className="mt-3 text-[7px] uppercase tracking-[0.1em] text-muted">
                    {sessionVolume.active ? "Projected close" : "Previous session"}
                  </div>
                  <div className="mt-0.5 flex items-baseline gap-1.5">
                    <span className="font-mono text-[12px] font-semibold text-foreground">
                      {formatVolume(sessionVolume.projectedVolume ?? sessionVolume.previousVolume)}
                    </span>
                    <span className={`font-mono text-[7px] ${comparisonPercent >= 100 ? "text-primary" : "text-muted"}`}>
                      {comparisonPercent}%
                    </span>
                  </div>
                  <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
                    <span className="absolute inset-y-0 left-1/2 w-px bg-foreground/35" />
                    <span
                      className="block h-full rounded-full bg-primary transition-[width] duration-700"
                      style={{ width: `${scalePosition}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between font-mono text-[7px] text-muted">
                    <span>Avg {formatVolume(sessionVolume.averageVolume)}</span>
                    <span>{sessionVolume.sampleCount} sessions</span>
                  </div>
                  {sessionVolume.active ? (
                    <div className="mt-1.5 flex items-center justify-between font-mono text-[7px] text-muted">
                      <span>Now {formatVolume(sessionVolume.currentVolume)}</span>
                      <span>{Math.round(sessionVolume.elapsedPercent ?? 0)}% elapsed</span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="mt-3 rounded-xl border border-primary/20 bg-primary/[0.045] p-3">
            <div className="text-[8px] font-semibold uppercase tracking-[0.14em] text-primary">Participation read</div>
            <p className="mt-1.5 text-[9px] leading-4 text-muted">{snapshot.summary}</p>
          </div>

          <div className="mt-3 flex items-center gap-2 text-[8px] text-muted">
            <span>Smoothed to suppress single-print noise</span>
            <span className="ml-auto font-mono">{formatLiveTimestamp(snapshot.updatedAt)}</span>
          </div>
        </div>
      )}
    </Panel>
  );
}

type AnalystView = "live" | "timeframes" | "log" | "reviews";
type AnalystArchiveState = "syncing" | "cloud" | "local";

function liveAnalystStorageKey(root: "NQ" | "ES") {
  return `kwantdesk:gameplan-live-analyst:${root.toLowerCase()}:v1`;
}

function mergeLiveAnalystEntries(...collections: LiveAnalystEntry[][]) {
  const merged = new globalThis.Map<string, LiveAnalystEntry>();
  for (const collection of collections) {
    for (const entry of collection) {
      const existing = merged.get(entry.id);
      if (!existing || (!existing.review && entry.review)) merged.set(entry.id, entry);
    }
  }
  return [...merged.values()]
    .sort((left, right) => Date.parse(right.generatedAt) - Date.parse(left.generatedAt))
    .slice(0, 240);
}

function readLocalAnalystEntries(root: "NQ" | "ES") {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(liveAnalystStorageKey(root)) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter(isLiveAnalystEntry) : [];
  } catch {
    return [];
  }
}

function writeLocalAnalystEntries(root: "NQ" | "ES", entries: LiveAnalystEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(liveAnalystStorageKey(root), JSON.stringify(entries.slice(0, 240)));
  } catch {
    // The private cloud archive remains the primary durable store.
  }
}

function timeframeAnalysisStorageKey(root: "NQ" | "ES") {
  return `kwantdesk:gameplan-timeframe-analysis:${root.toLowerCase()}:v1`;
}

function readLocalTimeframeContexts(root: "NQ" | "ES") {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(timeframeAnalysisStorageKey(root)) ?? "[]") as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(isGameplanTimeframeContext).filter((context) => context.root === root)
      : [];
  } catch {
    return [];
  }
}

function writeLocalTimeframeContexts(root: "NQ" | "ES", contexts: GameplanTimeframeContext[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(timeframeAnalysisStorageKey(root), JSON.stringify(contexts));
  } catch {
    // The current completed-window analysis can always be rebuilt from CME history.
  }
}

function formatContextWindow(context: GameplanTimeframeContext) {
  const start = new Date(context.windowStart);
  const end = new Date(context.windowEnd);
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: context.timeframe === "1d" || context.timeframe === "1w" ? "short" : undefined,
    day: context.timeframe === "1d" || context.timeframe === "1w" ? "2-digit" : undefined,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${format.format(start)}-${format.format(end)} ET`;
}

function formatNextContextUpdate(value: string, now: number) {
  const remaining = Math.max(0, Date.parse(value) - now);
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function analystMemoryRecord(entry: LiveAnalystEntry) {
  return {
    id: entry.id,
    root: entry.root,
    type: "context",
    createdAt: entry.generatedAt,
    price: entry.price,
    levelId: entry.nearestLevel.id,
    levelName: entry.nearestLevel.name,
    zone: entry.nearestLevel.zone,
    reasoning: entry.thesis,
    detail: "Kwant Desk Gameplan Live Market Analyst",
    analyst: entry,
  };
}

function trendTone(trend: LiveAnalystSnapshot["timeframe"]["fifteenMinute"]) {
  if (trend === "UP") return "border-primary/25 bg-primary/10 text-primary";
  if (trend === "DOWN") return "border-danger/25 bg-danger/10 text-danger";
  return "border-border bg-surface text-muted";
}

function controlTone(control: LiveAnalystSnapshot["control"]) {
  if (control === "BUYERS") return "text-primary";
  if (control === "SELLERS") return "text-danger";
  return "text-foreground";
}

function phaseLabel(phase: LiveAnalystSnapshot["phase"]) {
  if (phase === "TESTING") return "LEVEL TEST";
  if (phase === "APPROACH") return "LEVEL APPROACH";
  if (phase === "EXPANSION") return "STRUCTURAL EXPANSION";
  if (phase === "ROTATION") return "ROTATION";
  return "OBSERVING";
}

function LiveMarketAnalyst({
  root,
  session,
  plan,
  currentPrice,
  candles,
  volatility,
  feedState,
}: {
  root: "NQ" | "ES";
  session: GameplanSession;
  plan: GameplanEdition;
  currentPrice: number | null;
  candles: VolatilityCandle[];
  volatility: VolatilitySnapshot | null;
  feedState: "connecting" | "live" | "fallback";
}) {
  const [view, setView] = useState<AnalystView>("live");
  const [entries, setEntries] = useState<LiveAnalystEntry[]>([]);
  const [archiveState, setArchiveState] = useState<AnalystArchiveState>("syncing");
  const [archiveReady, setArchiveReady] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<GameplanTimeframeId>("15m");
  const [timeframeContexts, setTimeframeContexts] = useState<GameplanTimeframeContext[]>([]);
  const [analystClock, setAnalystClock] = useState(() => Date.now());
  const entriesRef = useRef<LiveAnalystEntry[]>([]);
  const snapshotRef = useRef<LiveAnalystSnapshot | null>(null);
  const candlesRef = useRef<VolatilityCandle[]>(candles);
  const currentPriceRef = useRef<number | null>(currentPrice);

  useEffect(() => {
    const timer = window.setInterval(() => setAnalystClock(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  useEffect(() => {
    setTimeframeContexts(readLocalTimeframeContexts(root));
  }, [root]);

  useEffect(() => {
    candlesRef.current = candles;
    currentPriceRef.current = currentPrice;
  }, [candles, currentPrice]);

  useEffect(() => {
    let active = true;
    const local = readLocalAnalystEntries(root);
    entriesRef.current = local;
    setEntries(local);
    setArchiveReady(false);
    setArchiveState("syncing");

    void fetch(`/api/kwantbot/archive?root=${root}`, {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => {
        const payload = await response.json() as {
          memory?: Array<{ analyst?: unknown }>;
        };
        if (!response.ok) throw new Error("Archive unavailable");
        const remote = (payload.memory ?? [])
          .map((record) => record.analyst)
          .filter(isLiveAnalystEntry);
        if (!active) return;
        const next = mergeLiveAnalystEntries(local, remote);
        entriesRef.current = next;
        setEntries(next);
        writeLocalAnalystEntries(root, next);
        setArchiveState("cloud");
      })
      .catch(() => {
        if (active) setArchiveState("local");
      })
      .finally(() => {
        if (active) setArchiveReady(true);
      });

    return () => {
      active = false;
    };
  }, [root]);

  const baseSnapshot = useMemo(
    () => buildLiveAnalystSnapshot({
      root,
      session,
      plan,
      currentPrice,
      candles,
      volatility,
      now: analystClock,
    }),
    [analystClock, candles, currentPrice, plan, root, session, volatility],
  );

  const timeframeCandidates = useMemo(
    () => buildGameplanTimeframeContexts({
      root,
      session,
      plan,
      candles,
      now: analystClock,
    }),
    [analystClock, candles, plan, root, session],
  );

  useEffect(() => {
    if (!timeframeCandidates.length) return;
    setTimeframeContexts((current) => {
      const next = GAMEPLAN_TIMEFRAMES.flatMap((timeframe) => {
        const candidate = timeframeCandidates.find((context) => context.timeframe === timeframe.id);
        const existing = current.find((context) => (
          context.root === root
          && context.timeframe === timeframe.id
          && context.periodKey === candidate?.periodKey
        ));
        return existing ? [existing] : candidate ? [candidate] : [];
      });
      writeLocalTimeframeContexts(root, next);
      return next;
    });
  }, [root, timeframeCandidates]);

  const snapshot = useMemo(() => {
    if (!baseSnapshot) return null;
    const reviewedAtLevel = entries.find((entry) =>
      entry.nearestLevel.id === baseSnapshot.nearestLevel.id
      && entry.review);
    const previous = entries.find((entry) =>
      entry.session === session
      && entry.sessionDate === plan.edition.date);
    const memoryCopy = reviewedAtLevel?.review
      ? reviewedAtLevel.review.verdict === "SUPPORTED"
        ? ` Memory check: the most recent completed read at this level was supported with a ${reviewedAtLevel.review.reasoningScore}% reasoning score, but today still requires fresh confirmation.`
        : reviewedAtLevel.review.verdict === "FAILED"
          ? ` Memory check: the prior read at this level failed review, so this version requires stronger acceptance before assigning continuation.`
          : " Memory check: the prior read at this level remained inconclusive, so no historical directional weight is being added."
      : "";
    const revisionCopy = previous && previous.control !== baseSnapshot.control
      ? ` This revises the previous ${previous.control.toLowerCase()} read because the current timeframe evidence now favours ${baseSnapshot.control.toLowerCase()}.`
      : "";
    return {
      ...baseSnapshot,
      thesis: `${baseSnapshot.thesis}${revisionCopy}${memoryCopy}`,
    };
  }, [baseSnapshot, entries, plan.edition.date, session]);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const persistEntries = useCallback((records: LiveAnalystEntry[]) => {
    if (!records.length) return;
    const next = mergeLiveAnalystEntries(entriesRef.current, records);
    entriesRef.current = next;
    setEntries(next);
    writeLocalAnalystEntries(root, next);
    setArchiveState((current) => current === "cloud" ? "cloud" : "syncing");
    void fetch("/api/kwantbot/archive", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memory: records.map(analystMemoryRecord) }),
    })
      .then((response) => {
        if (!response.ok) throw new Error("Archive unavailable");
        setArchiveState("cloud");
      })
      .catch(() => setArchiveState("local"));
  }, [root]);

  useEffect(() => {
    if (!archiveReady) return;
    const evaluate = () => {
      const current = snapshotRef.current;
      const livePrice = currentPriceRef.current;
      if (!current || livePrice === null) return;
      const now = Date.now();
      const reviewed = entriesRef.current
        .filter((entry) => !entry.review)
        .slice(0, 16)
        .flatMap((entry) => {
          const updated = reviewLiveAnalystEntry({
            entry,
            candles: candlesRef.current,
            currentPrice: livePrice,
            now,
          });
          return updated ? [updated] : [];
        });
      const entriesWithReviews = mergeLiveAnalystEntries(entriesRef.current, reviewed);
      const previous = entriesWithReviews.find((entry) =>
        entry.root === current.root
        && entry.session === current.session
        && entry.sessionDate === current.sessionDate) ?? null;
      const reason = analystPublishReason(previous, current, now);
      const nextEntry = reason ? createLiveAnalystEntry(current, reason) : null;
      persistEntries(nextEntry ? [...reviewed, nextEntry] : reviewed);
    };
    evaluate();
    const timer = window.setInterval(evaluate, 10_000);
    return () => window.clearInterval(timer);
  }, [archiveReady, persistEntries, root, session]);

  const currentEntries = entries.filter((entry) =>
    entry.sessionDate === plan.edition.date
    && entry.session === session);
  const reviewedEntries = entries.filter((entry) => entry.review);
  const averageReviewScore = reviewedEntries.length
    ? Math.round(reviewedEntries.reduce((sum, entry) => sum + (entry.review?.reasoningScore ?? 0), 0) / reviewedEntries.length)
    : null;
  const lastLogged = currentEntries[0] ?? null;
  const timeframeAligned = Boolean(
    snapshot
    && snapshot.timeframe.fifteenMinute !== "FLAT"
    && snapshot.timeframe.fifteenMinute === snapshot.timeframe.oneHour,
  );
  const levelEngaged = snapshot?.phase === "TESTING" || snapshot?.phase === "APPROACH";
  const acceptancePresent = snapshot?.phase === "EXPANSION" && timeframeAligned;
  const selectedContext = timeframeContexts.find((context) => context.timeframe === selectedTimeframe) ?? null;
  const buyerContexts = timeframeContexts.filter((context) => context.control === "BUYERS").length;
  const sellerContexts = timeframeContexts.filter((context) => context.control === "SELLERS").length;
  const balancedContexts = timeframeContexts.filter((context) => context.control === "BALANCED").length;

  return (
    <Panel className="overflow-hidden">
      <SectionHeading
        icon={BrainCircuit}
        eyebrow="Structured market reasoning"
        title="Live Market Analyst"
        trailing={(
          <span className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 font-mono text-[8px] font-semibold ${
            feedState === "live"
              ? "border-primary/20 bg-primary/10 text-primary"
              : "border-border bg-surface text-muted"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${feedState === "live" ? "animate-pulse bg-primary" : "bg-muted"}`} />
            {feedState === "live" ? "ANALYSING LIVE" : "RETAINING LAST READ"}
          </span>
        )}
      />

      <div className="flex border-b border-border bg-background/25 px-3">
        {([
          ["live", "Live read", Radio],
          ["timeframes", "Timeframe analysis", Bot],
          ["log", "Decision log", History],
          ["reviews", "Reasoning reviews", Scale],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`relative flex h-10 items-center gap-1.5 px-2.5 text-[8px] font-semibold transition-colors ${
              view === id ? "text-primary" : "text-muted hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {view === id ? <span className="absolute inset-x-2 bottom-0 h-px bg-primary shadow-[0_0_9px_var(--primary)]" /> : null}
          </button>
        ))}
      </div>

      {view === "live" ? (
        !snapshot ? (
          <div className="p-4">
            <div className="rounded-xl border border-border bg-card p-5 text-center">
              <BrainCircuit className="mx-auto h-5 w-5 text-muted" />
              <div className="mt-2 text-[11px] font-semibold text-foreground">Building the first market read</div>
              <p className="mt-1 text-[9px] leading-4 text-muted">Waiting for live price, named Gameplan levels, and enough five-minute structure.</p>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.13em] text-primary">{phaseLabel(snapshot.phase)}</span>
              <span className={`text-[13px] font-semibold ${controlTone(snapshot.control)}`}>{snapshot.control} IN CONTROL</span>
              <span className="ml-auto font-mono text-[10px] text-muted">{snapshot.confidence}% confidence</span>
            </div>

            <div className="mt-3 rounded-2xl border border-primary/20 bg-[radial-gradient(circle_at_90%_0%,color-mix(in_srgb,var(--primary)_10%,transparent),transparent_48%)] p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <BrainCircuit className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold text-foreground">{root} {formatPrice(snapshot.price)}</span>
                    <span className="text-[8px] text-muted">{snapshot.nearestLevel.name} · {formatZone(snapshot.nearestLevel.zone)}</span>
                  </div>
                  <p className="mt-2 text-[10px] leading-5 text-foreground/90">{snapshot.thesis}</p>
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {([
                ["15M", snapshot.timeframe.fifteenMinute, snapshot.timeframe.fifteenMinuteMove],
                ["1H", snapshot.timeframe.oneHour, snapshot.timeframe.oneHourMove],
                ["4H", snapshot.timeframe.fourHour, snapshot.timeframe.fourHourMove],
              ] as const).map(([label, trend, move]) => (
                <div key={label} className={`rounded-xl border p-2.5 ${trendTone(trend)}`}>
                  <div className="text-[7px] font-semibold uppercase tracking-[0.12em] opacity-70">{label} structure</div>
                  <div className="mt-1 flex items-end justify-between gap-1">
                    <span className="text-[10px] font-semibold">{trend}</span>
                    <span className="font-mono text-[8px]">{move >= 0 ? "+" : ""}{formatPrice(move)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-xl border border-border bg-card/55 p-3">
              <div className="flex items-center gap-2 text-[8px] font-semibold text-foreground"><ListChecks className="h-3.5 w-3.5 text-primary" />Evidence gates</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  ["Location mapped", true],
                  ["Level engaged", levelEngaged],
                  ["15M / 1H aligned", timeframeAligned],
                  ["Acceptance present", acceptancePresent],
                ].map(([label, complete]) => (
                  <div key={String(label)} className="flex items-center gap-2 text-[8px] text-muted">
                    <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${complete ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-surface text-muted"}`}>
                      {complete ? <Check className="h-2.5 w-2.5" /> : <span className="h-1 w-1 rounded-full bg-muted" />}
                    </span>
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <div className="rounded-xl border border-primary/20 bg-primary/[0.045] p-3">
                <div className="text-[7px] font-bold uppercase tracking-[0.14em] text-primary">Confirmation</div>
                <p className="mt-1.5 text-[9px] leading-4 text-muted">{snapshot.confirmation}</p>
              </div>
              <div className="rounded-xl border border-danger/20 bg-danger/[0.04] p-3">
                <div className="text-[7px] font-bold uppercase tracking-[0.14em] text-danger">Invalidation</div>
                <p className="mt-1.5 text-[9px] leading-4 text-muted">{snapshot.invalidation}</p>
              </div>
              <div className="rounded-xl border border-border bg-surface/35 p-3">
                <div className="text-[7px] font-bold uppercase tracking-[0.14em] text-foreground">What matters next</div>
                <p className="mt-1.5 text-[9px] leading-4 text-muted">{snapshot.nextEvidence}</p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[7px] text-muted">
              <span className="rounded-md border border-border bg-surface px-2 py-1">{snapshot.options.coverage === "FULL" ? "US OPTIONS ACTIVE" : "OPTIONS MAP / THIN LIVE FLOW"}</span>
              <span className="rounded-md border border-border bg-surface px-2 py-1">{snapshot.options.tape.toUpperCase()} TAPE</span>
              <span className="rounded-md border border-border bg-surface px-2 py-1">{snapshot.volatility.regime} VOL · {snapshot.volatility.trend}</span>
              <span className="ml-auto flex items-center gap-1 font-mono">
                <Database className="h-3 w-3 text-primary" />
                {archiveState === "cloud" ? "PRIVATE CLOUD MEMORY" : archiveState === "syncing" ? "SYNCING MEMORY" : "LOCAL MEMORY"}
              </span>
            </div>
          </div>
        )
      ) : null}

      {view === "log" ? (
        <div className="max-h-[520px] space-y-2 overflow-y-auto p-3">
          {currentEntries.length ? currentEntries.slice(0, 40).map((entry) => (
            <div key={entry.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.12em] text-primary">{entry.reason}</span>
                <span className={`text-[8px] font-semibold ${controlTone(entry.control)}`}>{entry.control}</span>
                <span className="font-mono text-[8px] text-muted">{formatPrice(entry.price)}</span>
                <span className="ml-auto font-mono text-[7px] text-muted">{formatLiveTimestamp(entry.generatedAt)}</span>
              </div>
              <p className="mt-2 text-[9px] leading-4 text-muted">{entry.thesis}</p>
              <div className="mt-2 flex items-center gap-2 border-t border-border/70 pt-2 text-[7px] text-muted">
                <span>{entry.nearestLevel.name} · {formatZone(entry.nearestLevel.zone)}</span>
                <span className="ml-auto">Process score <strong className="text-foreground">{entry.processScore}%</strong></span>
                {entry.review ? <span className={entry.review.verdict === "SUPPORTED" ? "text-primary" : entry.review.verdict === "FAILED" ? "text-danger" : "text-muted"}>{entry.review.verdict}</span> : <span>Review pending</span>}
              </div>
            </div>
          )) : (
            <div className="rounded-xl border border-border bg-card p-5 text-center">
              <History className="mx-auto h-5 w-5 text-muted" />
              <div className="mt-2 text-[10px] font-semibold text-foreground">The decision log is building</div>
              <p className="mt-1 text-[8px] text-muted">The first entry appears after live price and the current Gameplan are aligned.</p>
            </div>
          )}
        </div>
      ) : null}

      {view === "timeframes" ? (
        <div className="p-3">
          <div className="rounded-xl border border-border bg-card/60 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div>
                <div className="text-[7px] font-bold uppercase tracking-[0.16em] text-primary">{root} completed-window context</div>
                <div className="mt-1 text-[10px] font-semibold text-foreground">Seven stable timeframe analysts</div>
              </div>
              <div className="ml-auto flex items-center gap-1.5 text-[7px]">
                <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-primary">{buyerContexts} buyer</span>
                <span className="rounded-md border border-danger/20 bg-danger/[0.06] px-2 py-1 text-danger">{sellerContexts} seller</span>
                <span className="rounded-md border border-border bg-surface px-2 py-1 text-muted">{balancedContexts} balanced</span>
              </div>
            </div>
            <p className="mt-2 max-w-2xl text-[8px] leading-4 text-muted">
              Each analyst speaks from its last completed window. Live ticks cannot rewrite the narrative; it only changes when that timeframe closes and the next evidence set is complete.
            </p>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 rounded-xl border border-border bg-background/40 p-1">
            {GAMEPLAN_TIMEFRAMES.map((timeframe) => {
              const context = timeframeContexts.find((item) => item.timeframe === timeframe.id);
              return (
                <button
                  key={timeframe.id}
                  type="button"
                  onClick={() => setSelectedTimeframe(timeframe.id)}
                  className={`relative min-w-0 rounded-lg px-1 py-2 text-center transition-colors ${
                    selectedTimeframe === timeframe.id
                      ? "bg-primary/12 text-primary"
                      : "text-muted hover:bg-surface hover:text-foreground"
                  }`}
                >
                  <span className="block font-mono text-[9px] font-semibold">{timeframe.label}</span>
                  <span className={`mx-auto mt-1 block h-1 w-1 rounded-full ${
                    context?.control === "BUYERS"
                      ? "bg-primary"
                      : context?.control === "SELLERS"
                        ? "bg-danger"
                        : "bg-muted"
                  }`} />
                  {selectedTimeframe === timeframe.id ? <span className="absolute inset-x-2 bottom-0 h-px bg-primary shadow-[0_0_8px_var(--primary)]" /> : null}
                </button>
              );
            })}
          </div>

          {selectedContext ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-primary/20 bg-[radial-gradient(circle_at_90%_0%,color-mix(in_srgb,var(--primary)_9%,transparent),transparent_46%)]">
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <Bot className="h-4 w-4" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[12px] font-semibold text-foreground">{root} {selectedContext.label}</span>
                    <span className={`text-[8px] font-semibold ${controlTone(selectedContext.control)}`}>{selectedContext.control}</span>
                  </div>
                  <div className="mt-0.5 font-mono text-[7px] text-muted">{formatContextWindow(selectedContext)}</div>
                </div>
                <div className="ml-auto text-right">
                  <div className="font-mono text-[10px] font-semibold text-foreground">{selectedContext.confidence}%</div>
                  <div className="text-[7px] uppercase tracking-[0.1em] text-muted">context quality</div>
                </div>
              </div>

              <div className="grid gap-3 p-4 lg:grid-cols-[1fr_.72fr]">
                <div className="space-y-3">
                  <div>
                    <div className="text-[7px] font-bold uppercase tracking-[0.15em] text-primary">What happened</div>
                    <p className="mt-1.5 text-[10px] leading-5 text-foreground/90">{selectedContext.whatHappened}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card/65 p-3">
                    <div className="text-[7px] font-bold uppercase tracking-[0.15em] text-foreground">Level context</div>
                    <p className="mt-1.5 text-[9px] leading-4 text-muted">{selectedContext.levelContext}</p>
                  </div>
                  <div className="rounded-xl border border-primary/20 bg-primary/[0.045] p-3">
                    <div className="text-[7px] font-bold uppercase tracking-[0.15em] text-primary">Stable context hypothesis</div>
                    <p className="mt-1.5 text-[9px] leading-4 text-foreground/85">{selectedContext.hypothesis}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-surface/35 p-3">
                    <div className="flex items-center gap-1.5 text-[7px] font-bold uppercase tracking-[0.15em] text-muted">
                      <Layers3 className="h-3 w-3 text-primary" />
                      Futures + options context
                    </div>
                    <p className="mt-1.5 text-[9px] leading-4 text-muted">{selectedContext.optionsContext}</p>
                  </div>
                </div>

                <div className="grid content-start grid-cols-2 gap-2">
                  {[
                    ["Open", formatPrice(selectedContext.open)],
                    ["Close", formatPrice(selectedContext.close)],
                    ["High", formatPrice(selectedContext.high)],
                    ["Low", formatPrice(selectedContext.low)],
                    ["Net move", `${selectedContext.move >= 0 ? "+" : ""}${formatPrice(selectedContext.move)}`],
                    ["Range", formatPrice(selectedContext.range)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-border bg-card p-2.5">
                      <div className="text-[7px] uppercase tracking-[0.12em] text-muted">{label}</div>
                      <div className="mt-1 font-mono text-[10px] font-semibold text-foreground">{value}</div>
                    </div>
                  ))}
                  <div className="col-span-2 rounded-xl border border-border bg-card p-3">
                    <div className="flex items-center justify-between text-[7px] uppercase tracking-[0.12em] text-muted">
                      <span>Close location</span>
                      <span className="font-mono text-foreground">{selectedContext.closeLocation}% of range</span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${selectedContext.closeLocation}%` }} />
                    </div>
                  </div>
                  <div className="col-span-2 rounded-xl border border-border bg-card p-3">
                    <div className="flex items-center gap-2 text-[7px] text-muted">
                      <Clock3 className="h-3 w-3 text-primary" />
                      <span>Next locked update</span>
                      <span className="ml-auto font-mono text-foreground">{formatNextContextUpdate(selectedContext.nextUpdateAt, analystClock)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[7px] text-muted">
                      <Database className="h-3 w-3 text-primary" />
                      <span>{selectedContext.sampleBars} completed 5M bars</span>
                      <span className="ml-auto font-mono">{Math.round(selectedContext.coverage * 100)}% window coverage</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-border bg-card p-5 text-center">
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
              <div className="mt-2 text-[10px] font-semibold text-foreground">Building {root} {selectedTimeframe.toUpperCase()} context</div>
              <p className="mt-1 text-[8px] text-muted">Waiting for enough completed CME history to lock this timeframe.</p>
            </div>
          )}
        </div>
      ) : null}

      {view === "reviews" ? (
        <div className="p-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-border bg-card p-3"><div className="text-[7px] uppercase tracking-[0.12em] text-muted">Reviewed</div><div className="mt-1 font-mono text-[16px] font-semibold text-foreground">{reviewedEntries.length}</div></div>
            <div className="rounded-xl border border-border bg-card p-3"><div className="text-[7px] uppercase tracking-[0.12em] text-muted">Reasoning</div><div className="mt-1 font-mono text-[16px] font-semibold text-primary">{averageReviewScore ?? "—"}{averageReviewScore !== null ? "%" : ""}</div></div>
            <div className="rounded-xl border border-border bg-card p-3"><div className="text-[7px] uppercase tracking-[0.12em] text-muted">Window</div><div className="mt-1 font-mono text-[16px] font-semibold text-foreground">15M</div></div>
          </div>
          <div className="mt-3 max-h-[430px] space-y-2 overflow-y-auto">
            {reviewedEntries.length ? reviewedEntries.slice(0, 30).map((entry) => (
              <div key={entry.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className={`h-3.5 w-3.5 ${entry.review?.verdict === "SUPPORTED" ? "text-primary" : entry.review?.verdict === "FAILED" ? "text-danger" : "text-muted"}`} />
                  <span className="text-[8px] font-semibold text-foreground">{entry.review?.verdict}</span>
                  <span className="text-[7px] text-muted">{entry.reason} · {entry.nearestLevel.name}</span>
                  <span className="ml-auto font-mono text-[10px] font-semibold text-primary">{entry.review?.reasoningScore}%</span>
                </div>
                <p className="mt-2 text-[9px] leading-4 text-muted">{entry.review?.note}</p>
                <div className="mt-2 text-[7px] text-muted">Original process {entry.processScore}% · move {entry.review && entry.review.move >= 0 ? "+" : ""}{formatPrice(entry.review?.move ?? 0)} · reviewed {formatLiveTimestamp(entry.review?.reviewedAt ?? null)}</div>
              </div>
            )) : (
              <div className="rounded-xl border border-border bg-card p-5 text-center">
                <Scale className="mx-auto h-5 w-5 text-muted" />
                <div className="mt-2 text-[10px] font-semibold text-foreground">No completed reasoning reviews yet</div>
                <p className="mt-1 text-[8px] leading-4 text-muted">Each material read is reviewed after 15 minutes. Unproven is recorded as inconclusive—not forced into right or wrong.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-2 border-t border-border bg-background/25 px-4 py-2 text-[7px] text-muted">
        <ShieldCheck className="h-3 w-3 text-primary" />
        Deterministic evidence model · no generative opinion · material changes only
        <span className="ml-auto font-mono">{lastLogged ? `Last log ${formatUpdateAge(lastLogged.generatedAt, analystClock)}` : "Initialising log"}</span>
      </div>
    </Panel>
  );
}

function ScenarioRoads({ plan }: { plan: GameplanEdition }) {
  return (
    <Panel className="overflow-hidden">
      <SectionHeading
        icon={Route}
        eyebrow="The three roads"
        title="How this session can unfold"
        trailing={<span className="hidden text-[9px] text-muted sm:block">Weights are desk leans, not promises</span>}
      />
      <div className="grid gap-3 p-3 lg:grid-cols-3 lg:p-4">
        {plan.scenarios.map((scenario, index) => (
          <div key={scenario.name} className="relative overflow-hidden rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 font-mono text-[10px] font-semibold text-primary">0{index + 1}</span>
              <div className="min-w-0">
                <h3 className="text-[12px] font-semibold text-foreground">{scenario.name}</h3>
                <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-muted">Only if</p>
                <p className="mt-1 text-[10px] leading-4 text-foreground">{scenario.trigger}</p>
              </div>
            </div>
            <div className="my-4 flex items-center">
              {scenario.path.map((price, pathIndex) => (
                <div key={`${price}-${pathIndex}`} className="contents">
                  <div className="relative flex h-8 min-w-0 flex-1 items-center justify-center rounded-lg border border-border bg-surface px-1 font-mono text-[9px] text-foreground">
                    {formatPrice(price)}
                  </div>
                  {pathIndex < scenario.path.length - 1 ? <div className="h-px w-3 bg-primary/60" /> : null}
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-danger/20 bg-danger/[0.055] px-3 py-2 text-[9px] leading-4 text-danger">
              <strong className="mr-1 uppercase tracking-[0.12em]">Road dead</strong> {scenario.kill}
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-[9px] text-muted">
                <span>Desk lean</span>
                <span className="font-mono text-foreground">{Math.round(scenario.weight * 100)}%</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface">
                <div className="h-full rounded-full bg-primary" style={{ width: `${scenario.weight * 100}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function APlusTradeCard({
  setup,
  tone,
  fallbackZone,
  onGlossary,
}: {
  setup: GameplanEdition["one_trade"]["long_side"];
  tone: "long" | "short";
  fallbackZone: [number, number];
  onGlossary: (term: string) => void;
}) {
  const long = tone === "long";
  const zone = Array.isArray(setup.zone) && setup.zone.length === 2
    ? setup.zone
    : fallbackZone;
  const entryReference = Number.isFinite(setup.entry_reference)
    ? setup.entry_reference
    : long ? zone[1] : zone[0];
  const risk = Math.max(0.25, Math.abs(entryReference - setup.stop));
  const legacyTargets = setup.targets.map((price, index) => ({
    price,
    level: `Target ${index + 1}`,
    reason: "Verified session-ladder target.",
    risk_reward: Number((Math.abs(price - entryReference) / risk).toFixed(2)),
    pay_percent: setup.targets.length === 1 ? 100 : index === 0 ? 60 : 40,
  }));
  const targets = setup.target_details?.length ? setup.target_details : legacyTargets;
  const reasoning = setup.reasoning?.length
    ? setup.reasoning
    : ["This is the highest-ranked verified location for this side of the current session map."];
  const bestRiskReward = Number.isFinite(setup.best_risk_reward)
    ? setup.best_risk_reward
    : targets.reduce((best, target) => Math.max(best, target.risk_reward), 0);
  return (
    <div className={`overflow-hidden rounded-2xl border bg-card ${long ? "border-primary/25" : "border-danger/25"}`}>
      <div className={`border-b px-4 py-3 ${long ? "border-primary/20 bg-primary/[0.055]" : "border-danger/20 bg-danger/[0.045]"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className={`text-[8px] font-bold uppercase tracking-[0.16em] ${long ? "text-primary" : "text-danger"}`}>
              {long ? "Long-side" : "Short-side"} A+ trade of the day
            </div>
            <h3 className="mt-1 text-[14px] font-semibold text-foreground">{setup.setup_name || `${setup.level_name || "Highest-ranked level"} ${long ? "defence" : "rejection"}`}</h3>
            <div className="mt-1 text-[8px] text-muted">Highest-ranked {long ? "support" : "resistance"} location &middot; live confirmation required</div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-lg border px-2 py-1 font-mono text-[10px] font-bold ${long ? "border-primary/25 bg-primary/10 text-primary" : "border-danger/25 bg-danger/10 text-danger"}`}>
              {setup.quality_grade || "A+"} &middot; {setup.quality_score ?? "Pending"}{Number.isFinite(setup.quality_score) ? "/100" : ""}
            </span>
            <span className="rounded-lg border border-border bg-background/45 px-2 py-1 font-mono text-[10px] text-foreground">{formatZone(zone)}</span>
          </div>
        </div>
      </div>
      <div className="grid gap-3 p-4 xl:grid-cols-[1.12fr_.88fr]">
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-background/30 p-3.5">
            <Eyebrow>Why this location earns A+ consideration</Eyebrow>
            <div className="mt-2.5 space-y-2">
              {reasoning.map((reason, index) => (
                <div key={`${index}:${reason}`} className="flex items-start gap-2 text-[9px] leading-4 text-muted">
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${long ? "bg-primary" : "bg-danger"}`} />
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          </div>
          <div className={`rounded-xl border p-3.5 ${long ? "border-primary/20 bg-primary/[0.035]" : "border-danger/20 bg-danger/[0.03]"}`}>
            <Eyebrow>Options-flow alignment</Eyebrow>
            <p className="mt-2 text-[9px] leading-4 text-foreground/90">{setup.options_alignment || "Wait for classified options flow to confirm or stop opposing the planned direction."}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/30 p-3.5">
            <Eyebrow>Permission to execute</Eyebrow>
            <p className="mt-2 text-[10px] leading-5 text-foreground">{setup.permission}</p>
            <p className="mt-2 text-[9px] text-muted">Location creates interest. Only the <TermButton term="print" onClick={() => onGlossary("Print")} /> creates permission.</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border bg-background/30 p-3">
              <Eyebrow>Entry reference</Eyebrow>
              <div className="mt-2 font-mono text-[15px] font-semibold text-foreground">{formatPrice(entryReference)}</div>
            </div>
            <div className="rounded-xl border border-danger/20 bg-danger/[0.045] p-3">
              <Eyebrow>Thesis stop</Eyebrow>
              <div className="mt-2 font-mono text-[15px] font-semibold text-danger">{formatPrice(setup.stop)}</div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-background/30 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <Eyebrow>Pay yourself at verified levels</Eyebrow>
              <span className={`rounded-md px-1.5 py-0.5 font-mono text-[8px] ${long ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger"}`}>
                Best R:R 1:{bestRiskReward.toFixed(2)}
              </span>
            </div>
            <div className="mt-2.5 space-y-2">
              {targets.length ? targets.map((target, index) => (
                <div key={`${target.price}:${target.level}`} className="rounded-lg border border-border bg-surface/45 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 font-mono text-[8px] font-bold ${long ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger"}`}>T{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-[9px] font-semibold text-foreground">{target.level}</span>
                    <span className="font-mono text-[10px] font-semibold text-foreground">{formatPrice(target.price)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[7px] text-muted">
                    <span>Pay {target.pay_percent}%</span>
                    <span>&middot;</span>
                    <span>R:R 1:{target.risk_reward.toFixed(2)}</span>
                  </div>
                  <p className="mt-1 text-[8px] leading-3 text-muted">{target.reason}</p>
                </div>
              )) : (
                <p className="rounded-lg border border-dashed border-border p-3 text-center text-[8px] text-muted">No verified target exists beyond this location yet.</p>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-danger/20 bg-danger/[0.045] p-3.5">
            <Eyebrow>Invalidation</Eyebrow>
            <p className="mt-2 text-[9px] leading-4 text-muted">{setup.invalidation || `The thesis is invalid beyond ${formatPrice(setup.stop)} or when live options flow materially opposes the setup.`}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function APlusTrades({ plan, onGlossary }: { plan: GameplanEdition; onGlossary: (term: string) => void }) {
  return (
    <Panel className="overflow-hidden border-primary/20 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--color-primary)_8%,transparent),transparent_36%)]">
      <SectionHeading
        icon={Target}
        eyebrow="The day's highest-ranked asymmetric locations"
        title="A+ Long & Short Trades of the Day"
        trailing={<span className="hidden text-[8px] text-muted lg:block">Structure + options flow + confirmation + target R:R</span>}
      />
      <div className="grid gap-3 p-3 lg:grid-cols-2 lg:p-4">
        <APlusTradeCard setup={plan.one_trade.long_side} tone="long" fallbackZone={plan.one_trade.zone} onGlossary={onGlossary} />
        <APlusTradeCard setup={plan.one_trade.short_side} tone="short" fallbackZone={plan.one_trade.zone} onGlossary={onGlossary} />
      </div>
      <div className="mx-3 mb-3 flex items-start gap-2 rounded-xl border border-danger/20 bg-danger/[0.045] px-4 py-3 lg:mx-4 lg:mb-4">
        <X className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
        <p className="text-[9px] leading-4 text-muted"><strong className="mr-1 text-danger">STAND DOWN:</strong>{plan.one_trade.not_a_trade_if}</p>
      </div>
    </Panel>
  );
}

function Receipts({ plan }: { plan: GameplanEdition }) {
  const hasLevels = plan.receipts.levels.length > 0;
  return (
    <Panel className="overflow-hidden">
      <SectionHeading
        icon={Check}
        eyebrow="Yesterday, graded"
        title="Receipts"
        trailing={<span className="font-mono text-[9px] text-muted">{plan.receipts.date}</span>}
      />
      <div className="p-4">
        {hasLevels ? (
          <div className="flex flex-wrap gap-2">
            {plan.receipts.levels.map((level) => (
              <div key={`${level.zone[0]}-${level.zone[1]}`} className="rounded-xl border border-border bg-card px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${level.verdict === "held" ? "bg-primary/15 text-primary" : level.verdict === "broke" ? "bg-danger/15 text-danger" : "bg-surface text-muted"}`}>
                    {level.verdict === "held" ? "✓" : level.verdict === "broke" ? "×" : "—"}
                  </span>
                  <span className="font-mono text-[10px] text-foreground">{formatZone(level.zone)}</span>
                </div>
                <p className="mt-1.5 text-[9px] text-muted">{level.note}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card px-4 py-5 text-center">
            <div className="text-[11px] font-semibold text-foreground">{plan.receipts.one_trade_outcome}</div>
            <p className="mx-auto mt-2 max-w-xl text-[10px] leading-5 text-muted">{plan.receipts.honest_note}</p>
          </div>
        )}
        <button type="button" className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-primary">
          Open full journal archive <ExternalLink className="h-3 w-3" />
        </button>
      </div>
    </Panel>
  );
}

function GlossaryDrawer({ term, onClose }: { term: string | null; onClose: () => void }) {
  if (!term) return null;
  return (
    <>
      <button type="button" aria-label="Close glossary" onClick={onClose} className="fixed inset-0 z-[180] bg-black/45 backdrop-blur-[2px]" />
      <aside className="fixed bottom-0 right-0 top-0 z-[190] flex w-full max-w-[390px] flex-col border-l border-border bg-panel shadow-[-30px_0_90px_rgba(0,0,0,.45)]">
        <div className="flex h-14 items-center border-b border-border px-5">
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="ml-2 text-[12px] font-semibold">Plain-English glossary</span>
          <button type="button" onClick={onClose} className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <Eyebrow>Current term</Eyebrow>
          <h3 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-foreground">{term}</h3>
          <p className="mt-3 text-[12px] leading-6 text-muted">{GLOSSARY[term] ?? "This term will be defined by the desk before the edition is published."}</p>
          <div className="mt-8 border-t border-border pt-4">
            <Eyebrow>All terms</Eyebrow>
            <div className="mt-2 space-y-1">
              {Object.entries(GLOSSARY).map(([label, copy]) => (
                <div key={label} className="rounded-xl border border-border/70 bg-card p-3">
                  <div className="text-[11px] font-semibold text-foreground">{label}</div>
                  <p className="mt-1 text-[9px] leading-4 text-muted">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function LoadingState() {
  return (
    <KwantLoader
      className="h-full min-h-[500px]"
      icon={Map}
      title="Building today's level map"
      detail="Positioning, volatility, flow and futures translation"
    />
  );
}

function GameplanLiveWorkspace({ initialInstrument = "NQ" }: { initialInstrument?: string }) {
  const router = useRouter();
  const initialRoot = initialInstrument.toUpperCase().startsWith("ES") || initialInstrument.toUpperCase().startsWith("MES") ? "ES" : "NQ";
  const initialPayloadRef = useRef(
    readWorkspaceData<GameplanPayload>(gameplanCacheKey(initialRoot, "newyork")),
  );
  const initialPayload = initialPayloadRef.current;
  const [root, setRoot] = useState<"NQ" | "ES">(initialRoot);
  const [session, setSession] = useState<GameplanSession>("newyork");
  const [payload, setPayload] = useState<GameplanPayload | null>(initialPayload);
  const [currentPrice, setCurrentPrice] = useState<number | null>(initialPayload?.current_price ?? null);
  const [volatilityCandles, setVolatilityCandles] = useState<VolatilityCandle[]>([]);
  const [volatilityLoading, setVolatilityLoading] = useState(true);
  const [volatilityError, setVolatilityError] = useState<string | null>(null);
  const [oneLinerSnapshot, setOneLinerSnapshot] = useState<OneLinerSnapshot | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [priceTick, setPriceTick] = useState<"up" | "down" | "flat">("flat");
  const [liveFeedState, setLiveFeedState] = useState<"connecting" | "live" | "fallback">("live");
  const [mode, setMode] = useState<DetailMode>("standard");
  const [whatIf, setWhatIf] = useState(false);
  const [loading, setLoading] = useState(!initialPayload);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [glossaryTerm, setGlossaryTerm] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [copied, setCopied] = useState(false);
  const [addedToChartKey, setAddedToChartKey] = useState<string | null>(null);
  const previousPriceRef = useRef<number | null>(initialPayload?.current_price ?? null);
  const lastNativeTickAtRef = useRef(0);
  const lastFeedSuccessAtRef = useRef(Date.now());
  const feedFailureTimerRef = useRef<number | null>(null);
  const priceTickTimerRef = useRef<number | null>(null);
  const planRequestRef = useRef(0);
  const planRefreshDelayRef = useRef(5_000);
  const latestPayloadRef = useRef<GameplanPayload | null>(initialPayload);
  const countdown = useCountdown(session);

  const updateLivePrice = useCallback((nextPrice: number) => {
    if (!Number.isFinite(nextPrice) || nextPrice <= 0) return;
    const previous = previousPriceRef.current;
    previousPriceRef.current = nextPrice;
    if (previous !== null && nextPrice !== previous) {
      setPriceTick(nextPrice > previous ? "up" : "down");
      if (priceTickTimerRef.current !== null) window.clearTimeout(priceTickTimerRef.current);
      priceTickTimerRef.current = window.setTimeout(() => setPriceTick("flat"), 420);
    }
    setCurrentPrice(nextPrice);
  }, []);

  const markFeedHealthy = useCallback(() => {
    lastFeedSuccessAtRef.current = Date.now();
    if (feedFailureTimerRef.current !== null) {
      window.clearTimeout(feedFailureTimerRef.current);
      feedFailureTimerRef.current = null;
    }
    setLiveFeedState("live");
  }, []);

  const deferFeedFailure = useCallback(() => {
    if (feedFailureTimerRef.current !== null) return;
    const checkFailure = () => {
      const healthyAge = Date.now() - lastFeedSuccessAtRef.current;
      if (healthyAge < LIVE_FEED_FAILURE_GRACE_MS) {
        feedFailureTimerRef.current = window.setTimeout(
          checkFailure,
          LIVE_FEED_FAILURE_GRACE_MS - healthyAge,
        );
        return;
      }
      feedFailureTimerRef.current = null;
      setLiveFeedState("fallback");
    };
    feedFailureTimerRef.current = window.setTimeout(checkFailure, LIVE_FEED_FAILURE_GRACE_MS);
  }, []);

  useEffect(() => () => {
    if (priceTickTimerRef.current !== null) window.clearTimeout(priceTickTimerRef.current);
    if (feedFailureTimerRef.current !== null) window.clearTimeout(feedFailureTimerRef.current);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const loadPlan = useCallback(async (manual = false, background = false) => {
    const requestId = ++planRequestRef.current;
    if (manual) setRefreshing(true);
    else if (!background) setLoading(true);
    try {
      const next = await fetchWorkspaceData<GameplanPayload>(
        gameplanCacheKey(root, session),
        `/api/gameplan?root=${root}&session=${session}`,
        { force: true },
      );
      if (requestId !== planRequestRef.current) return;
      setPayload(next);
      latestPayloadRef.current = next;
      planRefreshDelayRef.current = Math.max(5_000, Math.min(60_000, next.refresh_after_ms));
      setOneLinerSnapshot((current) => {
        if (
          !manual
          && current?.instrument === next.instrument
          && current.session === next.plan.edition.session
        ) return current;
        return {
          instrument: next.instrument,
          session: next.plan.edition.session,
          text: buildLiveOneLiner(next.plan, next.instrument, next.current_price),
          price: next.current_price,
          updatedAt: next.generated_at,
        };
      });
      if (
        next.current_price !== null
        && (previousPriceRef.current === null || Date.now() - lastNativeTickAtRef.current > 3_000)
      ) updateLivePrice(next.current_price);
      setError(null);
    } catch (loadError) {
      if (requestId !== planRequestRef.current) return;
      setError(loadError instanceof Error ? loadError.message : "Gameplan could not be loaded.");
    } finally {
      if (requestId !== planRequestRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [root, session, updateLivePrice]);

  useEffect(() => {
    let disposed = false;
    let timer: number | null = null;
    const cached = readWorkspaceData<GameplanPayload>(gameplanCacheKey(root, session));
    if (cached) {
      setPayload(cached);
      latestPayloadRef.current = cached;
      setLoading(false);
      setError(null);
      if (cached.current_price !== null) updateLivePrice(cached.current_price);
    } else {
      setPayload(null);
    }
    const run = async (background: boolean) => {
      await loadPlan(false, background);
      if (!disposed) timer = window.setTimeout(() => void run(true), planRefreshDelayRef.current);
    };
    timer = window.setTimeout(() => void run(Boolean(cached)), 0);
    return () => {
      disposed = true;
      planRequestRef.current += 1;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [loadPlan, root, session, updateLivePrice]);

  useEffect(() => {
    const refreshOneLiner = () => {
      const latest = latestPayloadRef.current;
      if (
        !latest
        || latest.instrument !== root
        || latest.plan.edition.session !== session
      ) return;
      const price = previousPriceRef.current ?? latest.current_price;
      setOneLinerSnapshot({
        instrument: root,
        session,
        text: buildLiveOneLiner(latest.plan, root, price),
        price,
        updatedAt: new Date().toISOString(),
      });
    };
    const timer = window.setInterval(refreshOneLiner, ONE_LINER_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [root, session]);

  useEffect(() => {
    const syncAddedState = () => {
      if (!payload) {
        setAddedToChartKey(null);
        return;
      }
      const plan = payload.plan;
      if (payload.instrument !== root || plan.edition.session !== session) {
        setAddedToChartKey(null);
        return;
      }
      const existing = loadGameplanChartOverlays()[root];
      const planKey = `${root}:${plan.edition.date}:${plan.edition.session}:${plan.edition.published_at}`;
      setAddedToChartKey(
        existing
        && existing.editionDate === plan.edition.date
        && existing.session === plan.edition.session
        && existing.publishedAt === plan.edition.published_at
          ? planKey
          : null,
      );
    };
    syncAddedState();
    window.addEventListener(GAMEPLAN_CHART_OVERLAYS_EVENT, syncAddedState);
    return () => window.removeEventListener(GAMEPLAN_CHART_OVERLAYS_EVENT, syncAddedState);
  }, [payload, root, session]);

  useEffect(() => {
    if (!payload) return;
    markFeedHealthy();
    lastNativeTickAtRef.current = 0;
    const receiveTick = (event: Event) => {
      try {
        const tick = (event as CustomEvent<{ instrument?: string; mid?: number }>).detail;
        if (!String(tick?.instrument ?? "").toUpperCase().startsWith(root)) return;
        const nextPrice = Number(tick.mid);
        if (!Number.isFinite(nextPrice) || nextPrice <= 0) return;
        lastNativeTickAtRef.current = Date.now();
        markFeedHealthy();
        updateLivePrice(nextPrice);
      } catch {}
    };
    const receiveStatus = (event: Event) => {
      const status = (event as CustomEvent<DatabentoLiveStatus>).detail;
      if (status === "live") markFeedHealthy();
      else if (status === "reconnecting") deferFeedFailure();
    };
    window.addEventListener(DATABENTO_LIVE_TICK_EVENT, receiveTick);
    window.addEventListener(DATABENTO_LIVE_STATUS_EVENT, receiveStatus);
    return () => {
      window.removeEventListener(DATABENTO_LIVE_TICK_EVENT, receiveTick);
      window.removeEventListener(DATABENTO_LIVE_STATUS_EVENT, receiveStatus);
    };
  }, [deferFeedFailure, markFeedHealthy, payload?.instrument, root, updateLivePrice]);

  useEffect(() => {
    if (!payload) return;
    const source = root === "NQ" ? "NDX" : "SPX";
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/options-flow/market-data?symbol=${source}&priceMode=FUTURES`, { cache: "no-store" });
        const market = await response.json() as { marketData?: { lastPrice?: number | null }; refreshAfterMs?: number };
        if (
          !cancelled
          && response.ok
          && market.marketData?.lastPrice !== null
          && market.marketData?.lastPrice !== undefined
        ) {
          markFeedHealthy();
          if (Date.now() - lastNativeTickAtRef.current > 3_000) {
            updateLivePrice(market.marketData.lastPrice);
          }
        } else if (!cancelled) {
          deferFeedFailure();
        }
      } catch {
        if (!cancelled) deferFeedFailure();
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [deferFeedFailure, markFeedHealthy, payload?.instrument, root, updateLivePrice]);

  useEffect(() => {
    let disposed = false;
    let timer: number | null = null;
    setVolatilityCandles([]);
    setVolatilityLoading(true);
    setVolatilityError(null);

    const loadVolatilityHistory = async () => {
      try {
        const response = await fetch(
          `/api/databento/market?symbol=${encodeURIComponent(`${root}.v.0`)}&timeframe=5m&days=10`,
          { cache: "no-store" },
        );
        const result = await response.json() as { candles?: VolatilityCandle[]; error?: string };
        if (!response.ok) throw new Error(result.error ?? "CME volatility history is unavailable.");
        if (!disposed && Array.isArray(result.candles) && result.candles.length) {
          setVolatilityCandles(result.candles);
          setVolatilityError(null);
        }
      } catch (historyError) {
        if (!disposed) {
          setVolatilityError(
            historyError instanceof Error
              ? historyError.message
              : "CME volatility history is unavailable.",
          );
        }
      } finally {
        if (!disposed) {
          setVolatilityLoading(false);
          timer = window.setTimeout(() => void loadVolatilityHistory(), 30_000);
        }
      }
    };

    void loadVolatilityHistory();
    return () => {
      disposed = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [root]);

  const volatilitySnapshot = useMemo(
    () => calculateVolatilitySnapshot(volatilityCandles, currentPrice),
    [currentPrice, volatilityCandles],
  );
  const volumeSnapshot = useMemo(
    () => calculateVolumeIntelligence(volatilityCandles),
    [volatilityCandles],
  );

  if (loading && !payload) return <LoadingState />;
  if (!payload) {
    return (
      <div className="flex h-full items-center justify-center bg-background p-6">
        <Panel className="max-w-md p-6 text-center">
          <ShieldAlert className="mx-auto h-6 w-6 text-danger" />
          <h2 className="mt-3 text-[15px] font-semibold">Gameplan feed unavailable</h2>
          <p className="mt-2 text-[11px] leading-5 text-muted">{error}</p>
          <button type="button" onClick={() => void loadPlan()} className="mt-4 rounded-xl bg-primary px-4 py-2 text-[11px] font-semibold text-background">Try again</button>
        </Panel>
      </div>
    );
  }

  const plan = payload.plan;
  const snapshotMatchesSelection =
    oneLinerSnapshot?.instrument === root
    && oneLinerSnapshot.session === session;
  const displayedOneLiner = snapshotMatchesSelection
    ? oneLinerSnapshot.text
    : buildLiveOneLiner(plan, root, payload.current_price);
  const displayedOneLinerPrice = snapshotMatchesSelection
    ? oneLinerSnapshot.price
    : payload.current_price;
  const displayedOneLinerUpdatedAt = snapshotMatchesSelection
    ? oneLinerSnapshot.updatedAt
    : payload.generated_at;
  const currentPlanKey = `${root}:${plan.edition.date}:${plan.edition.session}:${plan.edition.published_at}`;
  const planMatchesSelection = payload.instrument === root && plan.edition.session === session;
  const copyOneLiner = async () => {
    await navigator.clipboard.writeText(displayedOneLiner);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_600);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="flex min-h-[58px] shrink-0 flex-wrap items-center gap-2 border-b border-border bg-panel px-3 py-2 lg:px-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <Map className="h-[17px] w-[17px]" />
        </span>
        <div className="mr-2 min-w-0">
          <div className="text-[12px] font-semibold">Kwant Desk Gameplan</div>
          <div className="text-[9px] text-muted">Pre-session decision map</div>
        </div>
        <div className="flex rounded-xl border border-border bg-surface p-1">
          {(["NQ", "ES"] as const).map((item) => (
            <button key={item} type="button" onClick={() => setRoot(item)} className={`rounded-lg px-3 py-1.5 font-mono text-[10px] font-semibold ${root === item ? "bg-primary text-background" : "text-muted hover:text-foreground"}`}>{item}</button>
          ))}
        </div>
        <div className="flex max-w-full overflow-x-auto rounded-xl border border-border bg-surface p-1">
          {GAMEPLAN_SESSIONS.map(({ id, label }) => (
            <button key={id} type="button" onClick={() => setSession(id)} className={`shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-semibold ${session === id ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}>{label}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!planMatchesSelection) return;
              saveGameplanChartOverlay(createGameplanChartOverlay(root, plan));
              setAddedToChartKey(currentPlanKey);
            }}
            disabled={!planMatchesSelection}
            className={`flex h-9 items-center gap-2 rounded-xl border px-3 text-[10px] font-bold tracking-[0.08em] transition-colors ${
              addedToChartKey === currentPlanKey
                ? "border-primary/35 bg-primary/15 text-primary"
                : "border-primary/25 bg-primary/10 text-primary hover:border-primary/45 hover:bg-primary/15 disabled:cursor-wait disabled:opacity-45"
            }`}
            title={`Add this ${root} Gameplan to every matching chart`}
          >
            {addedToChartKey === currentPlanKey ? <Check className="h-3.5 w-3.5" /> : <Layers3 className="h-3.5 w-3.5" />}
            {!planMatchesSelection ? "SYNCING PLAN" : addedToChartKey === currentPlanKey ? "ADDED TO CHART" : "ADD TO CHART"}
          </button>
          <button
            type="button"
            onClick={() => router.push(zyonGameplanLaunchHref())}
            className="flex h-9 items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 text-[10px] font-bold tracking-[0.08em] text-primary transition-colors hover:border-primary/45 hover:bg-primary/15"
            title="Start building a Gameplan with ZYON"
          >
            <Sparkles className="h-3.5 w-3.5" />
            MAKE GAMEPLAN
          </button>
          <div className="hidden items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 md:flex">
            <AlarmClock className="h-3.5 w-3.5 text-primary" />
            <span className="text-[9px] text-muted">Open in</span>
            <span className="font-mono text-[10px] font-semibold text-foreground">{countdown}</span>
          </div>
          <button type="button" onClick={() => void loadPlan(true)} disabled={refreshing} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted hover:text-foreground disabled:opacity-50" aria-label="Refresh Gameplan">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <div className="sticky top-0 z-30 border-b border-danger/20 bg-danger/10 px-4 py-2 text-center text-[10px] text-danger">
            Refresh delayed: {error}. Showing the last good edition.
          </div>
        ) : null}
        <div className="mx-auto max-w-[1680px] p-3 lg:p-4 xl:p-5">
          <div className="mb-3 grid gap-2 md:grid-cols-[auto_auto_1fr_auto] md:items-center">
            <div className="rounded-xl border border-border bg-panel px-3 py-2">
              <Eyebrow>{gameplanSessionLabel(session)} edition</Eyebrow>
              <div className="mt-1 text-[11px] font-semibold text-foreground">{formatDate(plan.edition.date)}</div>
            </div>
            <TapeBadge state={plan.environment.tape.state} />
            <div className="rounded-xl border border-border bg-panel px-3 py-2">
              <div className="flex items-center gap-2 text-[9px] text-muted">
                <Clock3 className="h-3 w-3 text-primary" />
                <span>{plan.edition.freshness_note}</span>
                <span className={`ml-auto rounded-md px-1.5 py-0.5 font-semibold ${payload.status === "LIVE" ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger"}`}>{payload.status}</span>
              </div>
            </div>
            {session !== "globex" ? (
              <button type="button" onClick={() => setShowDiff(!showDiff)} className={`flex h-full items-center gap-2 rounded-xl border px-3 py-2 text-[9px] font-semibold ${showDiff ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-panel text-muted hover:text-foreground"}`}>
                <GitCompareArrows className="h-3.5 w-3.5" /> What changed?
              </button>
            ) : null}
          </div>

          {showDiff ? (
            <div className="mb-3 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.045] px-4 py-3">
              <GitCompareArrows className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <div className="text-[10px] font-semibold text-foreground">{gameplanSessionLabel(session)} edition delta</div>
                <p className="mt-1 text-[10px] leading-5 text-muted">The map has been recomputed from the latest positioning and futures price. A stored field-by-field comparison with the prior session will appear here when the edition publisher begins saving each daily snapshot.</p>
              </div>
            </div>
          ) : null}

          <Panel className="relative mb-3 overflow-hidden border-primary/20 bg-[radial-gradient(circle_at_88%_12%,color-mix(in_srgb,var(--color-primary)_14%,transparent),transparent_36%)]">
            <div className="relative px-5 py-6 sm:px-7 sm:py-8 lg:px-9">
              <div className="flex items-center gap-2">
                <span className="rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-primary">The one-liner</span>
                <span className="rounded-md px-1.5 py-0.5 font-mono text-[9px] text-muted">
                  {root} · {formatPrice(displayedOneLinerPrice)}
                </span>
                <span className="ml-auto flex items-center gap-1.5 font-mono text-[9px] text-muted">
                  <Clock3 className="h-3 w-3 text-primary" />
                  Last updated {formatLiveTimestamp(displayedOneLinerUpdatedAt)}
                  <span className="text-primary">{formatUpdateAge(displayedOneLinerUpdatedAt, clockNow)}</span>
                </span>
              </div>
              <h1 className="mt-4 max-w-5xl text-[23px] font-semibold leading-[1.22] tracking-[-0.035em] text-foreground sm:text-[29px] lg:text-[35px]">{displayedOneLiner}</h1>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <p className="max-w-3xl text-[10px] leading-5 text-muted">The plan earns nothing until a level prints its reaction — the map is the map, the print is the permission.</p>
                <div className="ml-auto flex gap-2">
                  <button type="button" className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-[9px] text-muted hover:text-foreground"><Pin className="h-3 w-3" /> Pin</button>
                  <button type="button" onClick={() => void copyOneLiner()} className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-[9px] text-muted hover:text-foreground">{copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}{copied ? "Copied" : "Copy"}</button>
                </div>
              </div>
            </div>
          </Panel>

          <div className="mb-3 grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,.55fr)]">
            <Ladder
              plan={plan}
              currentPrice={currentPrice}
              priceTick={priceTick}
              feedState={liveFeedState}
              mode={mode}
              whatIf={whatIf}
              setWhatIf={setWhatIf}
              onGlossary={setGlossaryTerm}
            />
            <div className="space-y-3">
              <LiveMarketAnalyst
                root={root}
                session={session}
                plan={plan}
                currentPrice={currentPrice}
                candles={volatilityCandles}
                volatility={volatilitySnapshot}
                feedState={liveFeedState}
              />
              <Environment
                plan={plan}
                snapshot={volatilitySnapshot}
                loading={volatilityLoading}
                error={volatilityError}
                feedState={liveFeedState}
              />
              <VolumeIntelligence
                snapshot={volumeSnapshot}
                loading={volatilityLoading}
                error={volatilityError}
                feedState={liveFeedState}
              />
            </div>
          </div>

          <div className="mb-3"><ScenarioRoads plan={plan} /></div>
          <div className="mb-3"><APlusTrades plan={plan} onGlossary={setGlossaryTerm} /></div>
          <div className="mb-3"><Receipts plan={plan} /></div>

          <Panel className="mb-3 overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 p-3 lg:px-4">
              <div className="flex items-center gap-2">
                <FileDown className="h-4 w-4 text-primary" />
                <span className="text-[11px] font-semibold">Take the map with you</span>
              </div>
              <button type="button" disabled={!plan.downloads.deepchart_xml} className="flex h-8 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-[9px] text-muted enabled:hover:text-foreground disabled:opacity-40"><Download className="h-3 w-3" /> DeepChart XML</button>
              <button type="button" disabled={!plan.downloads.sierra_csv} className="flex h-8 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-[9px] text-muted enabled:hover:text-foreground disabled:opacity-40"><Download className="h-3 w-3" /> Sierra CSV</button>
              <button type="button" className="flex h-8 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-[9px] text-muted hover:text-foreground"><Bell className="h-3 w-3" /> Level alerts <span className="rounded bg-card px-1 text-[8px]">soon</span></button>
              <button type="button" onClick={() => setGlossaryTerm("Acceptance")} className="flex h-8 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-[9px] text-muted hover:text-foreground"><BookOpen className="h-3 w-3" /> Glossary</button>
              <div className="ml-auto flex rounded-xl border border-border bg-surface p-1">
                {(["beginner", "standard", "pro"] as const).map((item) => (
                  <button key={item} type="button" onClick={() => setMode(item)} className={`rounded-lg px-3 py-1.5 text-[9px] font-semibold capitalize ${mode === item ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}>{item}</button>
                ))}
              </div>
            </div>
          </Panel>

          <div className="flex flex-col gap-2 border-t border-border px-2 py-5 text-[9px] leading-5 text-muted sm:flex-row sm:items-start sm:justify-between">
            <p className="max-w-4xl">The plan earns nothing until a level prints its reaction — the map is the map, the print is the permission. Market positioning is a decision aid, not a guarantee. Futures and options involve substantial risk; use independent judgement and predefined risk.</p>
            <div className="flex shrink-0 items-center gap-2 font-mono">
              <Info className="h-3 w-3" />
              Published {formatTime(plan.edition.published_at)} AEST · {plan.edition.data_basis}
            </div>
          </div>
        </div>
      </div>
      <GlossaryDrawer term={glossaryTerm} onClose={() => setGlossaryTerm(null)} />
    </div>
  );
}

type GameplanPageTab = "gameplan" | GameplanRecordTab;

const GAMEPLAN_PAGE_TABS: Array<{
  id: GameplanPageTab;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "gameplan", label: "GAME PLAN", icon: Map },
  { id: "scoring", label: "SCORING", icon: Scale },
  { id: "previous", label: "PREVIOUS GAME PLANS", icon: History },
];

export default function GameplanWorkspace({ initialInstrument = "NQ" }: { initialInstrument?: string }) {
  const [pageTab, setPageTab] = useState<GameplanPageTab>("gameplan");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab")
      ?? window.localStorage.getItem("kwantdesk:gameplan-page-tab");
    if (requested === "scoring" || requested === "previous") setPageTab(requested);
    window.localStorage.removeItem("kwantdesk:gameplan-page-tab");
    const openScoring = () => setPageTab("scoring");
    window.addEventListener("kwantdesk:gameplan-locked", openScoring);
    return () => window.removeEventListener("kwantdesk:gameplan-locked", openScoring);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <nav className="relative z-40 flex min-h-[48px] shrink-0 items-stretch gap-1 overflow-x-auto border-b border-border bg-panel px-3 sm:px-4" aria-label="Gameplan sections">
        {GAMEPLAN_PAGE_TABS.map(({ id, label, icon: Icon }) => {
          const active = pageTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setPageTab(id)}
              className={`group relative flex shrink-0 items-center gap-2 px-3.5 text-[9px] font-semibold tracking-[0.08em] transition-colors ${active ? "text-primary" : "text-muted hover:text-foreground"}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon className={`h-3.5 w-3.5 transition-colors ${active ? "text-primary" : "text-muted group-hover:text-foreground"}`} />
              {label}
              <span className={`absolute inset-x-2 bottom-0 h-px origin-center bg-primary transition-transform ${active ? "scale-x-100 shadow-[0_0_12px_var(--color-primary)]" : "scale-x-0"}`} />
            </button>
          );
        })}
      </nav>

      <div className={`min-h-0 flex-1 ${pageTab === "gameplan" ? "block" : "hidden"}`}>
        <GameplanLiveWorkspace initialInstrument={initialInstrument} />
      </div>
      {pageTab !== "gameplan" ? (
        <div className="min-h-0 flex-1">
          <GameplanRecordsWorkspace tab={pageTab} />
        </div>
      ) : null}
    </div>
  );
}
