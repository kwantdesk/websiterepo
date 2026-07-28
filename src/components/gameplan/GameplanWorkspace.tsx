"use client";

import {
  Activity,
  AlarmClock,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  CircleGauge,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  Gauge,
  GitCompareArrows,
  Info,
  Layers3,
  Loader2,
  Map,
  Pin,
  RefreshCw,
  Route,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  GameplanEdition,
  GameplanPayload,
  GameplanRole,
  GameplanSession,
  GameplanTapeState,
} from "@/lib/gameplan";
import {
  GAMEPLAN_CHART_OVERLAYS_EVENT,
  createGameplanChartOverlay,
  loadGameplanChartOverlays,
  saveGameplanChartOverlay,
} from "@/lib/gameplanChartOverlay";

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
  const easternParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(easternParts.map((part) => [part.type, part.value]));
  const hour = session === "newyork" ? 9 : 18;
  const minute = session === "newyork" ? 30 : 0;
  const utcGuess = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), hour, minute);
  let target = utcGuess - timeZoneOffset(new Date(utcGuess), "America/New_York");
  if (target <= now.getTime()) {
    const tomorrowGuess = utcGuess + 86_400_000;
    target = tomorrowGuess - timeZoneOffset(new Date(tomorrowGuess), "America/New_York");
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

function GaugeCard({
  icon: Icon,
  label,
  value,
  detail,
  progress,
  danger = false,
  open,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  progress: number;
  danger?: boolean;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={`w-full rounded-xl border p-3.5 text-left transition-all ${open ? "border-primary/30 bg-primary/[0.045]" : "border-border bg-card hover:border-primary/20"}`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${danger ? "text-danger" : "text-primary"}`} />
        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</span>
        <ChevronDown className={`ml-auto h-3.5 w-3.5 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      <div className={`mt-2 text-[13px] font-semibold ${danger ? "text-danger" : "text-foreground"}`}>{value}</div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface">
        <div className={`h-full rounded-full ${danger ? "bg-danger" : "bg-primary"}`} style={{ width: `${Math.max(3, Math.min(100, progress))}%` }} />
      </div>
      <p className={`overflow-hidden text-[10px] leading-4 text-muted transition-all ${open ? "mt-3 max-h-28 opacity-100" : "max-h-0 opacity-0"}`}>{detail}</p>
    </button>
  );
}

function Environment({ plan }: { plan: GameplanEdition }) {
  const [open, setOpen] = useState<string | null>("tape");
  const tape = plan.environment.tape;
  const cards = [
    {
      id: "tape",
      icon: Activity,
      label: "Tape type",
      value: tape.state === "calm" ? "CALM" : tape.state === "snowball" ? "SNOWBALL" : "MIXED",
      detail: tape.plain,
      progress: tape.state === "calm" ? 30 : tape.state === "snowball" ? 88 : 55,
      danger: tape.state === "snowball",
    },
    {
      id: "fear",
      icon: ShieldAlert,
      label: "Fear gauge",
      value: `${plan.environment.fear.ratio.toFixed(1)}× insurance / movement`,
      detail: plan.environment.fear.plain,
      progress: Math.min(100, plan.environment.fear.ratio * 45),
      danger: plan.environment.fear.ratio > 1.4,
    },
    {
      id: "flow",
      icon: TrendingUp,
      label: "Money-flow lean",
      value: Math.abs(plan.environment.flow.lean) < 0.2 ? "BALANCED" : plan.environment.flow.lean > 0 ? "CALL LEAN" : "PUT LEAN",
      detail: plan.environment.flow.plain,
      progress: (plan.environment.flow.lean + 1) * 50,
      danger: plan.environment.flow.lean < -0.2,
    },
    {
      id: "expiry",
      icon: Clock3,
      label: "Expiry pressure",
      value: plan.environment.expiry.relevant ? "ACTIVE TODAY" : "NOT ELEVATED",
      detail: plan.environment.expiry.plain,
      progress: plan.environment.expiry.relevant ? 82 : 22,
      danger: false,
    },
  ];

  return (
    <Panel className="overflow-hidden">
      <SectionHeading icon={CircleGauge} eyebrow="How to trade the map" title="Market environment" />
      <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-1">
        {cards.map((card) => (
          <GaugeCard key={card.id} {...card} open={open === card.id} onClick={() => setOpen(open === card.id ? null : card.id)} />
        ))}
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

function OneTrade({ plan, onGlossary }: { plan: GameplanEdition; onGlossary: (term: string) => void }) {
  const [side, setSide] = useState<"long" | "short">("long");
  const selected = side === "long" ? plan.one_trade.long_side : plan.one_trade.short_side;
  const [checks, setChecks] = useState([false, false, false]);
  return (
    <Panel className="overflow-hidden border-primary/25 bg-[radial-gradient(circle_at_85%_0%,color-mix(in_srgb,var(--color-primary)_10%,transparent),transparent_38%)]">
      <SectionHeading
        icon={Target}
        eyebrow="The highest-quality location"
        title="The One Trade"
        trailing={<span className="rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1 font-mono text-[10px] font-semibold text-primary">{formatZone(plan.one_trade.zone)}</span>}
      />
      <div className="p-4 lg:p-5">
        <div className="mb-4 inline-flex rounded-xl border border-border bg-surface p-1">
          {(["long", "short"] as const).map((item) => (
            <button key={item} type="button" onClick={() => setSide(item)} className={`rounded-lg px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] ${side === item ? item === "long" ? "bg-primary text-background" : "bg-danger text-white" : "text-muted"}`}>
              {item} side
            </button>
          ))}
        </div>
        <div className="grid gap-3 xl:grid-cols-[1.35fr_.65fr]">
          <div className="rounded-xl border border-border bg-card p-4">
            <Eyebrow>The permission</Eyebrow>
            <p className="mt-2 text-[12px] leading-5 text-foreground">{selected.permission}</p>
            <p className="mt-3 text-[10px] leading-4 text-muted">
              Divergence = get ready. Only the <TermButton term="print" onClick={() => onGlossary("Print")} /> = go.
            </p>
            <div className="mt-4 space-y-2">
              {["At the planned level?", "Aggression failing to make progress?", "Counter-side takes control and leaves?"].map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setChecks((current) => current.map((value, checkIndex) => checkIndex === index ? !value : value))}
                  className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-surface/60 px-3 py-2 text-left text-[10px] text-muted hover:text-foreground"
                >
                  <span className={`flex h-4 w-4 items-center justify-center rounded border ${checks[index] ? "border-primary bg-primary text-background" : "border-muted/50"}`}>
                    {checks[index] ? <Check className="h-3 w-3" /> : null}
                  </span>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-xl border border-border bg-card p-4">
              <Eyebrow>Idea is wrong below / above</Eyebrow>
              <div className="mt-2 font-mono text-[17px] font-semibold text-danger">{formatPrice(selected.stop)}</div>
              <p className="mt-1 text-[9px] text-muted">The stop belongs where the thesis is invalid, not where the loss feels comfortable.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <Eyebrow>Pay yourself at the levels</Eyebrow>
              <div className="mt-2 flex flex-wrap gap-2">
                {selected.targets.map((target, index) => (
                  <span key={target} className="rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-primary">T{index + 1} {formatPrice(target)}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-danger/20 bg-danger/[0.055] px-4 py-3">
          <X className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <p className="text-[10px] leading-5 text-muted"><strong className="mr-1 text-danger">NOT A TRADE:</strong>{plan.one_trade.not_a_trade_if}</p>
        </div>
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
    <div className="flex h-full min-h-[500px] items-center justify-center bg-background">
      <div className="text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <Loader2 className="h-5 w-5 animate-spin" />
        </span>
        <div className="mt-4 text-[13px] font-semibold text-foreground">Building today&apos;s level map</div>
        <div className="mt-1 text-[10px] text-muted">Positioning, volatility, flow and futures translation</div>
      </div>
    </div>
  );
}

export default function GameplanWorkspace({ initialInstrument = "NQ" }: { initialInstrument?: string }) {
  const initialRoot = initialInstrument.toUpperCase().startsWith("ES") || initialInstrument.toUpperCase().startsWith("MES") ? "ES" : "NQ";
  const [root, setRoot] = useState<"NQ" | "ES">(initialRoot);
  const [session, setSession] = useState<GameplanSession>("newyork");
  const [payload, setPayload] = useState<GameplanPayload | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [oneLinerSnapshot, setOneLinerSnapshot] = useState<OneLinerSnapshot | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [priceTick, setPriceTick] = useState<"up" | "down" | "flat">("flat");
  const [liveFeedState, setLiveFeedState] = useState<"connecting" | "live" | "fallback">("connecting");
  const [mode, setMode] = useState<DetailMode>("standard");
  const [whatIf, setWhatIf] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [glossaryTerm, setGlossaryTerm] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [copied, setCopied] = useState(false);
  const [addedToChartKey, setAddedToChartKey] = useState<string | null>(null);
  const previousPriceRef = useRef<number | null>(null);
  const lastNativeTickAtRef = useRef(0);
  const priceTickTimerRef = useRef<number | null>(null);
  const planRequestRef = useRef(0);
  const planRefreshDelayRef = useRef(5_000);
  const latestPayloadRef = useRef<GameplanPayload | null>(null);
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

  useEffect(() => () => {
    if (priceTickTimerRef.current !== null) window.clearTimeout(priceTickTimerRef.current);
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
      const response = await fetch(`/api/gameplan?root=${root}&session=${session}`, { cache: "no-store" });
      const next = await response.json() as GameplanPayload & { error?: string };
      if (!response.ok) throw new Error(next.error || "Gameplan could not be loaded.");
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
    const run = async (background: boolean) => {
      await loadPlan(false, background);
      if (!disposed) timer = window.setTimeout(() => void run(true), planRefreshDelayRef.current);
    };
    timer = window.setTimeout(() => void run(false), 0);
    return () => {
      disposed = true;
      planRequestRef.current += 1;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [loadPlan]);

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
    setLiveFeedState("connecting");
    lastNativeTickAtRef.current = 0;
    const live = new EventSource(`/api/databento/live?symbols=${encodeURIComponent(`${root}.v.0`)}`);
    live.addEventListener("status", () => setLiveFeedState("live"));
    live.onmessage = (event) => {
      try {
        const tick = JSON.parse(event.data) as { instrument?: string; mid?: number };
        if (tick.instrument !== `${root}.v.0`) return;
        const nextPrice = Number(tick.mid);
        if (!Number.isFinite(nextPrice) || nextPrice <= 0) return;
        lastNativeTickAtRef.current = Date.now();
        setLiveFeedState("live");
        updateLivePrice(nextPrice);
      } catch {}
    };
    live.addEventListener("feed-error", () => setLiveFeedState("fallback"));
    live.onerror = () => setLiveFeedState("fallback");
    return () => live.close();
  }, [payload?.instrument, root, updateLivePrice]);

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
          && Date.now() - lastNativeTickAtRef.current > 3_000
        ) {
          setLiveFeedState("fallback");
          updateLivePrice(market.marketData.lastPrice);
        }
      } catch {}
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [payload?.instrument, root, updateLivePrice]);

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
        <div className="flex rounded-xl border border-border bg-surface p-1">
          {([
            ["globex", "Globex"],
            ["newyork", "New York"],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setSession(id)} className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold ${session === id ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}>{label}</button>
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
              <Eyebrow>{session === "globex" ? "Globex edition" : "New York edition"}</Eyebrow>
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
            {session === "newyork" ? (
              <button type="button" onClick={() => setShowDiff(!showDiff)} className={`flex h-full items-center gap-2 rounded-xl border px-3 py-2 text-[9px] font-semibold ${showDiff ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-panel text-muted hover:text-foreground"}`}>
                <GitCompareArrows className="h-3.5 w-3.5" /> What changed?
              </button>
            ) : null}
          </div>

          {showDiff ? (
            <div className="mb-3 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.045] px-4 py-3">
              <GitCompareArrows className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <div className="text-[10px] font-semibold text-foreground">New York edition delta</div>
                <p className="mt-1 text-[10px] leading-5 text-muted">The map has been recomputed from the latest overnight positioning and futures price. A stored field-by-field Globex comparison will appear here when the edition publisher begins saving both daily snapshots.</p>
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
            <Environment plan={plan} />
          </div>

          <div className="mb-3"><ScenarioRoads plan={plan} /></div>
          <div className="mb-3 grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,.65fr)]">
            <OneTrade plan={plan} onGlossary={setGlossaryTerm} />
            <Receipts plan={plan} />
          </div>

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
