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
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  GameplanEdition,
  GameplanPayload,
  GameplanRole,
  GameplanSession,
  GameplanTapeState,
} from "@/lib/gameplan";

type DetailMode = "beginner" | "standard" | "pro";
type Level = GameplanEdition["ladder"][number];

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
  mode,
  whatIf,
  setWhatIf,
  onGlossary,
}: {
  plan: GameplanEdition;
  currentPrice: number | null;
  mode: DetailMode;
  whatIf: boolean;
  setWhatIf: (value: boolean) => void;
  onGlossary: (term: string) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(0);
  const nearestIndex = useMemo(() => {
    if (currentPrice === null || !plan.ladder.length) return -1;
    return plan.ladder.reduce((best, level, index) => {
      const price = (level.zone[0] + level.zone[1]) / 2;
      const bestPrice = (plan.ladder[best].zone[0] + plan.ladder[best].zone[1]) / 2;
      return Math.abs(price - currentPrice) < Math.abs(bestPrice - currentPrice) ? index : best;
    }, 0);
  }, [currentPrice, plan.ladder]);

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
      <div className="relative px-3 py-3 lg:px-5">
        <div className="pointer-events-none absolute bottom-4 left-[91px] top-4 w-px bg-gradient-to-b from-transparent via-border to-transparent lg:left-[113px]" />
        {plan.ladder.map((level, index) => {
          const open = expanded === index;
          const approaching = nearestIndex === index;
          const belly = plan.belly_zones.find(([low, high]) => high <= level.zone[0] && index < plan.ladder.length - 1);
          return (
            <div key={`${level.name}-${level.zone[0]}`} className={`relative ${expanded !== null && !open ? "opacity-65" : "opacity-100"} transition-opacity`}>
              {currentPrice !== null && index === nearestIndex ? (
                <div className="relative z-10 mb-1 flex items-center gap-2 py-1.5">
                  <span className="w-[76px] text-right font-mono text-[10px] font-semibold text-primary lg:w-[98px]">{formatPrice(currentPrice)}</span>
                  <span className="h-2.5 w-2.5 rounded-full border-2 border-background bg-primary shadow-[0_0_12px_var(--primary)]" />
                  <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-[8px] font-bold uppercase tracking-[0.15em] text-primary">You are here</span>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setExpanded(open ? null : index)}
                aria-expanded={open}
                className={`relative z-[1] grid w-full grid-cols-[76px_18px_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border px-2 py-3 text-left transition-all lg:grid-cols-[98px_20px_minmax(0,1fr)_auto] lg:px-3 ${open ? "border-primary/30 bg-primary/[0.055]" : approaching ? "border-primary/20 bg-primary/[0.025] shadow-[0_0_22px_color-mix(in_srgb,var(--primary)_8%,transparent)]" : "border-transparent hover:border-border hover:bg-surface/40"}`}
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
  const [mode, setMode] = useState<DetailMode>("standard");
  const [whatIf, setWhatIf] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [glossaryTerm, setGlossaryTerm] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [copied, setCopied] = useState(false);
  const countdown = useCountdown(session);

  const loadPlan = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await fetch(`/api/gameplan?root=${root}&session=${session}`, { cache: "no-store" });
      const next = await response.json() as GameplanPayload & { error?: string };
      if (!response.ok) throw new Error(next.error || "Gameplan could not be loaded.");
      setPayload(next);
      setCurrentPrice(next.current_price);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gameplan could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [root, session]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPlan(), 0);
    return () => window.clearTimeout(timer);
  }, [loadPlan]);

  useEffect(() => {
    if (!payload) return;
    const source = root === "NQ" ? "NDX" : "SPX";
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/options-flow/market-data?symbol=${source}&priceMode=FUTURES`, { cache: "no-store" });
        const market = await response.json() as { marketData?: { lastPrice?: number | null }; refreshAfterMs?: number };
        if (!cancelled && response.ok && market.marketData?.lastPrice !== null && market.marketData?.lastPrice !== undefined) {
          setCurrentPrice(market.marketData.lastPrice);
        }
      } catch {}
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [payload, root]);

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
  const copyOneLiner = async () => {
    await navigator.clipboard.writeText(plan.one_liner);
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
                <span className="font-mono text-[9px] text-muted">{root} · {formatPrice(currentPrice)}</span>
              </div>
              <h1 className="mt-4 max-w-5xl text-[23px] font-semibold leading-[1.22] tracking-[-0.035em] text-foreground sm:text-[29px] lg:text-[35px]">{plan.one_liner}</h1>
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
            <Ladder plan={plan} currentPrice={currentPrice} mode={mode} whatIf={whatIf} setWhatIf={setWhatIf} onGlossary={setGlossaryTerm} />
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
