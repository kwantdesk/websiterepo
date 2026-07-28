"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Cloud,
  CloudOff,
  Database,
  Download,
  Eye,
  FileClock,
  Gauge,
  GraduationCap,
  History,
  Layers3,
  ListChecks,
  NotebookTabs,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Waypoints,
  Zap,
} from "lucide-react";
import type { UseKwantBotInterpreterResult } from "@/hooks/useKwantBotInterpreter";
import {
  formatKwantBotPrice,
  type KwantBotInterpreterMessage,
  type KwantBotLevel,
  type KwantBotMarketRoot,
  type KwantBotMemoryEvent,
  type KwantBotMessageKind,
} from "@/lib/kwantBotInterpreter";
import type { KwantBotLearningReview } from "@/lib/kwantBotLearning";

type WorkspaceView = "command" | "journal" | "levels" | "learning";
type JournalFilter = "all" | "briefing" | "level" | "options" | "outcome";

const ROOT_DETAILS: Record<KwantBotMarketRoot, { name: string; contract: string }> = {
  NQ: { name: "Nasdaq-100 Futures", contract: "CME · NQ" },
  ES: { name: "S&P 500 Futures", contract: "CME · ES" },
};

const VIEW_ITEMS: Array<{
  id: WorkspaceView;
  label: string;
  icon: typeof BrainCircuit;
}> = [
  { id: "command", label: "Command Centre", icon: BrainCircuit },
  { id: "journal", label: "Running Journal", icon: NotebookTabs },
  { id: "levels", label: "Level Memory", icon: Waypoints },
  { id: "learning", label: "Machine Learning", icon: GraduationCap },
];

const JOURNAL_FILTERS: Array<{ id: JournalFilter; label: string }> = [
  { id: "all", label: "All notes" },
  { id: "briefing", label: "Market reads" },
  { id: "level", label: "Level reactions" },
  { id: "options", label: "Options" },
  { id: "outcome", label: "Outcomes" },
];

function distanceToZone(price: number, zone: [number, number]) {
  if (price < zone[0]) return zone[0] - price;
  if (price > zone[1]) return price - zone[1];
  return 0;
}

function zoneMid(zone: [number, number]) {
  return (zone[0] + zone[1]) / 2;
}

function formatZone(root: KwantBotMarketRoot, zone: [number, number]) {
  return `${formatKwantBotPrice(root, zone[0])}–${formatKwantBotPrice(root, zone[1])}`;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function relativeTime(value: string | number | null, now: number) {
  if (!value) return "waiting";
  const timestamp = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(timestamp)) return "waiting";
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1_000));
  if (seconds < 5) return "now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function compactMoney(value: number) {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "−" : value > 0 ? "+" : "";
  if (absolute >= 1_000_000_000) return `${sign}$${(absolute / 1_000_000_000).toFixed(2)}B`;
  if (absolute >= 1_000_000) return `${sign}$${(absolute / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `${sign}$${(absolute / 1_000).toFixed(0)}K`;
  return `${sign}$${absolute.toFixed(0)}`;
}

function messageLabel(kind: KwantBotMessageKind) {
  switch (kind) {
    case "briefing": return "Market read";
    case "approach": return "Preparing for level";
    case "touch": return "Level contact";
    case "rejection": return "Rejection observed";
    case "acceptance": return "Acceptance observed";
    case "outcome": return "Outcome review";
    case "options": return "Options environment";
    default: return "System note";
  }
}

function messageTone(kind: KwantBotMessageKind) {
  if (kind === "rejection") return "border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-400";
  if (kind === "acceptance") return "border-amber-400/30 bg-amber-400/[0.06] text-amber-400";
  if (kind === "touch") return "border-primary/35 bg-primary/[0.07] text-primary";
  if (kind === "outcome") return "border-violet-400/30 bg-violet-400/[0.06] text-violet-400";
  if (kind === "options") return "border-sky-400/30 bg-sky-400/[0.06] text-sky-400";
  return "border-border bg-surface/70 text-muted";
}

function eventLabel(type: KwantBotMemoryEvent["type"]) {
  switch (type) {
    case "context": return "Context";
    case "approach": return "Approach";
    case "touch": return "Touch";
    case "rejection": return "Rejection";
    case "acceptance": return "Acceptance";
    case "outcome": return "Outcome";
    default: return "Price";
  }
}

function matchesLevel(
  root: KwantBotMarketRoot,
  event: KwantBotMemoryEvent,
  level: KwantBotLevel,
) {
  if (event.levelId === level.id) return true;
  if (event.levelName !== level.name || !event.zone) return false;
  const tolerance = root === "NQ" ? 40 : 10;
  return Math.abs(zoneMid(event.zone) - zoneMid(level.zone)) <= tolerance;
}

function messageMatchesFilter(message: KwantBotInterpreterMessage, filter: JournalFilter) {
  if (filter === "all") return true;
  if (filter === "briefing") return message.kind === "briefing" || message.kind === "system";
  if (filter === "options") return message.kind === "options";
  if (filter === "outcome") return message.kind === "outcome";
  return ["approach", "touch", "rejection", "acceptance"].includes(message.kind);
}

function lifecycleIndex(events: KwantBotMemoryEvent[]) {
  const latest = [...events].reverse().find((event) => event.type !== "price" && event.type !== "context");
  if (!latest) return 0;
  if (latest.type === "approach") return 1;
  if (latest.type === "touch") return 2;
  if (latest.type === "rejection" || latest.type === "acceptance") return 3;
  if (latest.type === "outcome") return 4;
  return 0;
}

function reviewTone(review: KwantBotLearningReview) {
  if (review.score >= 72) return "border-primary/30 bg-primary/[0.07] text-primary";
  if (review.score >= 52) return "border-amber-400/30 bg-amber-400/[0.06] text-amber-400";
  return "border-danger/30 bg-danger/[0.06] text-danger";
}

function formatReviewDuration(milliseconds: number | null) {
  if (milliseconds === null) return "not measured";
  const seconds = Math.max(0, Math.round(milliseconds / 1_000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function BotAvatar() {
  return (
    <div className="relative h-14 w-14 shrink-0">
      <div className="absolute inset-1 rounded-full bg-primary/15 blur-xl" />
      <Image
        src="/images/kwantbot-avatar.png"
        alt="Kwant Bot"
        width={72}
        height={72}
        priority
        className="relative h-full w-full object-contain grayscale contrast-[1.12] drop-shadow-[0_10px_14px_rgba(0,0,0,0.45)]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          background: "var(--primary)",
          WebkitMaskImage: "url('/images/kwantbot-avatar.png')",
          WebkitMaskPosition: "center",
          WebkitMaskRepeat: "no-repeat",
          WebkitMaskSize: "contain",
          maskImage: "url('/images/kwantbot-avatar.png')",
          maskPosition: "center",
          maskRepeat: "no-repeat",
          maskSize: "contain",
        }}
      />
      <span className="absolute bottom-1 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-panel bg-primary shadow-[0_0_9px_var(--primary)]" />
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  eyebrow,
  title,
  detail,
  trailing,
}: {
  icon: typeof Activity;
  eyebrow: string;
  title: string;
  detail?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <div className="text-[8px] font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</div>
          <h2 className="mt-0.5 truncate text-[13px] font-semibold text-foreground">{title}</h2>
          {detail ? <p className="mt-0.5 text-[9px] leading-4 text-muted">{detail}</p> : null}
        </div>
      </div>
      {trailing}
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  active = false,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
  active?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-3 ${active ? "border-primary/30 bg-primary/[0.06]" : "border-border bg-surface/50"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[8px] font-semibold uppercase tracking-[0.13em] text-muted">{label}</span>
        <Icon className={`h-3.5 w-3.5 ${active ? "text-primary" : "text-muted"}`} />
      </div>
      <div className="mt-2 truncate font-mono text-[15px] font-semibold text-foreground">{value}</div>
      <div className="mt-1 truncate text-[8px] text-muted">{detail}</div>
    </div>
  );
}

export default function KwantBotIntelligenceWorkspace({
  interpreter,
}: {
  interpreter: UseKwantBotInterpreterResult;
}) {
  const {
    selectedRoot,
    selectRoot,
    messages,
    memory,
    learningReviews,
    learningSyncState,
    archiveSyncState,
    contexts,
    contextStates,
    contextErrors,
    livePrices,
    lastTickAt,
    feedState,
    requestBrief,
  } = interpreter;
  const [view, setView] = useState<WorkspaceView>("command");
  const [journalFilter, setJournalFilter] = useState<JournalFilter>("all");
  const [journalSearch, setJournalSearch] = useState("");
  const [now, setNow] = useState(Date.now());
  const [archiveExporting, setArchiveExporting] = useState(false);

  const context = contexts[selectedRoot];
  const rootMessages = messages[selectedRoot];
  const rootMemory = memory[selectedRoot];
  const price = livePrices[selectedRoot] ?? context?.currentPrice ?? null;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const levels = useMemo(() => {
    if (!context || price === null) return context?.levels ?? [];
    return [...context.levels].sort(
      (left, right) => distanceToZone(price, left.zone) - distanceToZone(price, right.zone),
    );
  }, [context, price]);
  const nearest = levels[0] ?? null;
  const nearestDistance = nearest && price !== null ? distanceToZone(price, nearest.zone) : null;
  const nearestEvents = useMemo(
    () => nearest ? rootMemory.filter((event) => matchesLevel(selectedRoot, event, nearest)) : [],
    [nearest, rootMemory, selectedRoot],
  );
  const nearestMessages = useMemo(
    () => nearest ? rootMessages.filter((item) => item.levelId === nearest.id) : [],
    [nearest, rootMessages],
  );
  const lifecycle = lifecycleIndex(nearestEvents);
  const touches = nearestEvents.filter((event) => event.type === "touch");
  const outcomes = nearestEvents.filter((event) => event.type === "outcome");
  const confirmedOutcomes = outcomes.filter((event) => event.detail?.includes("follow-through"));
  const previousLevelNote = nearestMessages.length > 1 ? nearestMessages[nearestMessages.length - 2] : null;

  const evidenceCoverage = useMemo(() => {
    if (!context || !nearest || price === null) return 0;
    let score = 28;
    score += Math.min(25, nearest.strength * 5);
    if (contextStates[selectedRoot] === "live") score += 15;
    if (context.options.recentFlow.length) score += 8;
    if (context.options.gammaChange.length) score += 7;
    if (touches.length) score += 7;
    if (outcomes.length) score += 5;
    return Math.min(95, score);
  }, [context, contextStates, nearest, outcomes.length, price, selectedRoot, touches.length]);

  const activeState = useMemo(() => {
    if (!context || !nearest || price === null) {
      return {
        label: "Building evidence",
        headline: "Waiting for a complete market state",
        thesis: "KwantBot will form a conditional view after live price, Gameplan levels, and options positioning are all present.",
        validation: "No decision is valid until the required feeds agree.",
        invalidation: "No active hypothesis.",
      };
    }
    const inside = price >= nearest.zone[0] && price <= nearest.zone[1];
    const approachThreshold = selectedRoot === "NQ" ? 30 : 8;
    const gammaText = context.options.gammaRegime === "POSITIVE"
      ? "Positive gamma supports a more rotational first response"
      : context.options.gammaRegime === "NEGATIVE"
        ? "Negative gamma increases the risk that an accepted break travels"
        : "Gamma is balanced, so price confirmation carries more weight than the options backdrop";
    const memoryText = outcomes.length
      ? `${confirmedOutcomes.length} of ${outcomes.length} completed reads at this stored area produced confirmed distance`
      : "this area has no completed stored result yet";
    if (inside) {
      return {
        label: "Reaction under review",
        headline: `${nearest.name} is being tested now`,
        thesis: `${gammaText}. KwantBot is withholding direction while price remains inside ${formatZone(selectedRoot, nearest.zone)}; ${memoryText}.`,
        validation: nearest.ifHold,
        invalidation: nearest.ifBreak,
      };
    }
    if (nearestDistance !== null && nearestDistance <= approachThreshold) {
      return {
        label: "Active preparation",
        headline: `${nearest.name} is the next decision`,
        thesis: `${gammaText}. Price is ${nearestDistance.toFixed(2)} points from the zone; ${memoryText}. The first clean response decides whether the prior note remains valid.`,
        validation: nearest.ifVisit,
        invalidation: nearest.ifBreak,
      };
    }
    return {
      label: "Monitoring",
      headline: `Tracking price toward ${nearest.name}`,
      thesis: `${gammaText}. The level is ${nearestDistance?.toFixed(2) ?? "—"} points away, so the current job is observation rather than forcing a setup. ${memoryText}.`,
      validation: nearest.ifVisit,
      invalidation: nearest.ifBreak,
    };
  }, [confirmedOutcomes.length, context, nearest, nearestDistance, outcomes.length, price, selectedRoot]);

  const filteredJournal = useMemo(() => {
    const query = journalSearch.trim().toLowerCase();
    return [...rootMessages]
      .reverse()
      .filter((item) => messageMatchesFilter(item, journalFilter))
      .filter((item) => !query || item.text.toLowerCase().includes(query) || messageLabel(item.kind).toLowerCase().includes(query));
  }, [journalFilter, journalSearch, rootMessages]);

  const significantMemory = useMemo(
    () => rootMemory.filter((event) => event.type !== "price").slice().reverse(),
    [rootMemory],
  );

  const downloadArchive = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportJournal = async () => {
    setArchiveExporting(true);
    const filename = `kwantbot-${selectedRoot.toLowerCase()}-archive-${new Date().toISOString().slice(0, 10)}.json`;
    try {
      const response = await fetch(`/api/kwantbot/archive?root=${selectedRoot}&download=1`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("Cloud archive unavailable.");
      downloadArchive(await response.blob(), filename);
    } catch {
      const payload = {
        format: "kwantdesk-kwantbot-intelligence-v1",
        storage: "local-fallback",
        instrument: selectedRoot,
        exportedAt: new Date().toISOString(),
        currentPrice: price,
        context,
        analysisNotes: [...rootMessages],
        evidenceJournal: [...rootMemory],
      };
      downloadArchive(
        new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
        filename,
      );
    } finally {
      setArchiveExporting(false);
    }
  };

  const visibleLevels = useMemo(() => levels.slice(0, 8), [levels]);
  const recentAnalysis = useMemo(() => rootMessages.slice(-7).reverse(), [rootMessages]);
  const liveFlow = context?.options.recentFlow ?? [];
  const bullishFlow = liveFlow.filter((row) => row.sentiment === "BULLISH").length;
  const bearishFlow = liveFlow.filter((row) => row.sentiment === "BEARISH").length;
  const latestGammaChange = context?.options.gammaChange[0] ?? null;
  const rootLearningReviews = useMemo(
    () => learningReviews
      .filter((review) => review.root === selectedRoot)
      .sort((left, right) => Date.parse(right.reviewedAt) - Date.parse(left.reviewedAt)),
    [learningReviews, selectedRoot],
  );
  const latestLearningReview = rootLearningReviews[0] ?? null;
  const averageLearningScore = rootLearningReviews.length
    ? Math.round(rootLearningReviews.reduce((total, review) => total + review.score, 0) / rootLearningReviews.length)
    : null;
  const confirmedLearningReviews = rootLearningReviews.filter((review) => review.verdict === "CONFIRMED").length;
  const failedLearningReviews = rootLearningReviews.filter((review) => review.verdict === "FAILED").length;
  const recentLearningAverage = rootLearningReviews.length
    ? rootLearningReviews.slice(0, 10).reduce((total, review) => total + review.score, 0)
      / Math.min(10, rootLearningReviews.length)
    : null;
  const previousLearningWindow = rootLearningReviews.slice(10, 20);
  const previousLearningAverage = previousLearningWindow.length
    ? previousLearningWindow.reduce((total, review) => total + review.score, 0) / previousLearningWindow.length
    : null;
  const learningTrend = recentLearningAverage !== null && previousLearningAverage !== null
    ? Math.round(recentLearningAverage - previousLearningAverage)
    : null;
  const blindSpots = useMemo(() => {
    const counts = new Map<string, number>();
    rootLearningReviews.forEach((review) => {
      review.blindSpotTags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
    });
    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6);
  }, [rootLearningReviews]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="relative shrink-0 overflow-hidden border-b border-border bg-panel">
        <div className="pointer-events-none absolute -left-8 -top-20 h-52 w-52 rounded-full bg-primary/[0.07] blur-3xl" />
        <div className="relative flex min-h-[76px] items-center gap-4 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <BotAvatar />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-[16px] font-semibold tracking-[-0.02em] text-foreground">KwantBot Intelligence</h1>
                <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.14em] text-primary">
                  Evidence engine
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[9px] text-muted">
                <span className={`h-1.5 w-1.5 rounded-full ${feedState === "live" ? "animate-pulse bg-primary shadow-[0_0_8px_var(--primary)]" : "bg-amber-400"}`} />
                Watching {ROOT_DETAILS[selectedRoot].name} · tick {relativeTime(lastTickAt[selectedRoot], now)} · {archiveSyncState === "synced" ? "archive synced" : archiveSyncState === "syncing" ? "archiving" : "local safety copy"}
              </div>
            </div>
          </div>

          <div className="ml-3 flex items-center gap-1 rounded-xl border border-border bg-background/60 p-1">
            {(["NQ", "ES"] as KwantBotMarketRoot[]).map((root) => (
              <button
                key={root}
                type="button"
                onClick={() => selectRoot(root)}
                className={`min-w-16 rounded-lg px-3 py-1.5 text-left transition-all ${selectedRoot === root ? "bg-primary text-background shadow-[0_0_16px_color-mix(in_srgb,var(--primary)_18%,transparent)]" : "text-muted hover:bg-surface hover:text-foreground"}`}
              >
                <span className="block text-[10px] font-semibold">{root}</span>
                <span className={`block font-mono text-[7px] ${selectedRoot === root ? "text-background/70" : "text-muted"}`}>
                  {livePrices[root] === null ? "WAITING" : formatKwantBotPrice(root, livePrices[root] as number)}
                </span>
              </button>
            ))}
          </div>

          <div className="min-w-0 flex-1" />
          <div className="hidden text-right lg:block">
            <div className="font-mono text-[17px] font-semibold text-foreground">
              {price === null ? "—" : formatKwantBotPrice(selectedRoot, price)}
            </div>
            <div className="mt-0.5 text-[8px] uppercase tracking-[0.12em] text-muted">{ROOT_DETAILS[selectedRoot].contract}</div>
          </div>
          <button
            type="button"
            onClick={() => requestBrief(selectedRoot)}
            disabled={!context || price === null}
            className="flex h-9 items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 text-[9px] font-semibold uppercase tracking-[0.1em] text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Analyse now
          </button>
        </div>

        <nav className="relative flex h-10 items-center gap-1 border-t border-border/70 px-5" aria-label="KwantBot intelligence views">
          {VIEW_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={`relative flex h-8 items-center gap-2 rounded-lg px-3 text-[10px] font-semibold transition-colors ${active ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface hover:text-foreground"}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
                {active ? <span className="absolute inset-x-3 -bottom-[5px] h-0.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" /> : null}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2 text-[8px] uppercase tracking-[0.11em] text-muted">
            <ShieldCheck className="h-3 w-3 text-primary" />
            Every claim keeps its evidence trail
          </div>
        </nav>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {view === "command" ? (
          <div className="mx-auto max-w-[1680px] space-y-4">
            {contextErrors[selectedRoot] ? (
              <div className="rounded-xl border border-danger/20 bg-danger/[0.06] px-4 py-2.5 text-[10px] text-danger">
                {contextErrors[selectedRoot]} Stored journal evidence remains available while live context reconnects.
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatCard
                label="Live price"
                value={price === null ? "Waiting" : formatKwantBotPrice(selectedRoot, price)}
                detail={`CME feed ${feedState} · ${relativeTime(lastTickAt[selectedRoot], now)}`}
                icon={Radio}
                active={feedState === "live"}
              />
              <StatCard
                label="Nearest decision"
                value={nearest?.name ?? "Loading"}
                detail={nearest && nearestDistance !== null ? `${formatZone(selectedRoot, nearest.zone)} · ${nearestDistance.toFixed(2)} pts` : "Waiting for Gameplan"}
                icon={Target}
              />
              <StatCard
                label="Options regime"
                value={context?.options.gammaRegime ?? "Loading"}
                detail={context?.options.gammaStateLabel ?? "Waiting for options positioning"}
                icon={Layers3}
                active={context?.options.gammaRegime === "NEGATIVE"}
              />
              <StatCard
                label="Recorded memory"
                value={`${significantMemory.length} events`}
                detail={`${rootMemory.filter((event) => event.type === "price").length} one-minute samples · journal live`}
                icon={Database}
              />
            </div>

            <div className="grid min-h-[440px] grid-cols-1 gap-4 xl:grid-cols-12">
              <section className="overflow-hidden rounded-2xl border border-border bg-panel xl:col-span-7">
                <SectionTitle
                  icon={Activity}
                  eyebrow="Live reasoning stream"
                  title={`${selectedRoot} analysis as the market changes`}
                  detail="New notes are written from price, Gameplan, options positioning, prior notes, and confirmed outcomes."
                  trailing={(
                    <span className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-primary">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                      Live
                    </span>
                  )}
                />
                <div className="max-h-[560px] overflow-y-auto p-4">
                  {!recentAnalysis.length ? (
                    <div className="flex min-h-72 flex-col items-center justify-center text-center">
                      <Bot className="mb-3 h-6 w-6 text-primary" />
                      <div className="text-[12px] font-semibold text-foreground">Building the first evidence chain</div>
                      <p className="mt-1 max-w-sm text-[9px] leading-4 text-muted">The first market read appears after live price and context are both available.</p>
                    </div>
                  ) : (
                    <div className="relative space-y-3 pl-5 before:absolute before:bottom-5 before:left-[5px] before:top-5 before:w-px before:bg-border">
                      {recentAnalysis.map((note, index) => {
                        const priorReferences = note.levelId
                          ? rootMessages.filter((candidate) =>
                            candidate.levelId === note.levelId
                            && Date.parse(candidate.createdAt) < Date.parse(note.createdAt)).length
                          : 0;
                        return (
                          <article key={note.id} className="relative rounded-2xl border border-border bg-surface/55 p-4">
                            <span className={`absolute -left-[21px] top-5 h-2.5 w-2.5 rounded-full border-2 border-panel ${index === 0 ? "animate-pulse bg-primary shadow-[0_0_9px_var(--primary)]" : "bg-muted"}`} />
                            <div className="mb-2 flex items-start justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className={`rounded-full border px-2 py-1 text-[7px] font-semibold uppercase tracking-[0.11em] ${messageTone(note.kind)}`}>
                                  {messageLabel(note.kind)}
                                </span>
                                {priorReferences ? (
                                  <span className="flex items-center gap-1 text-[7px] text-muted">
                                    <History className="h-2.5 w-2.5" />
                                    checked {priorReferences} prior note{priorReferences === 1 ? "" : "s"}
                                  </span>
                                ) : null}
                              </div>
                              <time className="shrink-0 font-mono text-[8px] text-muted">{formatTime(note.createdAt)}</time>
                            </div>
                            <p className="whitespace-pre-wrap text-[10px] leading-[1.65] text-foreground">{note.text}</p>
                            <div className="mt-3 flex items-center gap-3 border-t border-border/60 pt-2 text-[7px] uppercase tracking-[0.1em] text-muted">
                              {typeof note.price === "number" ? <span className="font-mono">Price {formatKwantBotPrice(selectedRoot, note.price)}</span> : null}
                              <span>Journaled {relativeTime(note.createdAt, now)}</span>
                              <span className="ml-auto flex items-center gap-1 text-primary"><CheckCircle2 className="h-2.5 w-2.5" /> evidence retained</span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              <div className="space-y-4 xl:col-span-5">
                <section className="overflow-hidden rounded-2xl border border-primary/25 bg-[linear-gradient(145deg,color-mix(in_srgb,var(--primary)_7%,var(--panel)),var(--panel))]">
                  <SectionTitle
                    icon={BrainCircuit}
                    eyebrow="Active hypothesis"
                    title={activeState.headline}
                    detail="Conditional analysis—not a forced directional call."
                    trailing={(
                      <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-primary">
                        {activeState.label}
                      </span>
                    )}
                  />
                  <div className="space-y-4 p-4">
                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">
                        <span>Evidence coverage</span>
                        <span className="font-mono text-primary">{evidenceCoverage}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-background">
                        <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${evidenceCoverage}%` }} />
                      </div>
                    </div>
                    <p className="text-[10px] leading-[1.65] text-foreground">{activeState.thesis}</p>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] p-3">
                        <div className="mb-1 flex items-center gap-1.5 text-[7px] font-semibold uppercase tracking-[0.12em] text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Valid if
                        </div>
                        <p className="text-[8px] leading-4 text-muted">{activeState.validation}</p>
                      </div>
                      <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-3">
                        <div className="mb-1 flex items-center gap-1.5 text-[7px] font-semibold uppercase tracking-[0.12em] text-amber-400">
                          <Eye className="h-3 w-3" />
                          Reassess if
                        </div>
                        <p className="text-[8px] leading-4 text-muted">{activeState.invalidation}</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-border bg-panel">
                  <SectionTitle
                    icon={Waypoints}
                    eyebrow="Decision lifecycle"
                    title={nearest ? nearest.name : "Waiting for nearest level"}
                    detail={nearest ? `${formatZone(selectedRoot, nearest.zone)} · ${nearest.role}` : "Gameplan context is loading"}
                  />
                  <div className="p-4">
                    <div className="grid grid-cols-5 gap-1">
                      {["Observed", "Prepared", "Contact", "Reaction", "Outcome"].map((label, index) => (
                        <div key={label} className="min-w-0 text-center">
                          <div className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full border text-[8px] font-semibold ${index <= lifecycle ? "border-primary/40 bg-primary/15 text-primary" : "border-border bg-background text-muted"}`}>
                            {index < lifecycle ? <CheckCircle2 className="h-3 w-3" /> : index + 1}
                          </div>
                          <div className={`mt-1 truncate text-[7px] ${index <= lifecycle ? "text-foreground" : "text-muted"}`}>{label}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-xl border border-border bg-background/45 p-3">
                      <div className="mb-1 flex items-center gap-1.5 text-[7px] font-semibold uppercase tracking-[0.12em] text-primary">
                        <History className="h-3 w-3" />
                        Previous-note check
                      </div>
                      {previousLevelNote ? (
                        <>
                          <div className="text-[8px] text-muted">{formatDateTime(previousLevelNote.createdAt)}</div>
                          <p className="mt-1 line-clamp-3 text-[9px] leading-4 text-foreground">{previousLevelNote.text}</p>
                          <div className="mt-2 text-[8px] font-medium text-primary">
                            Rechecked against the current price and options environment.
                          </div>
                        </>
                      ) : (
                        <p className="text-[9px] leading-4 text-muted">No earlier note exists for this exact level area. KwantBot will treat the first reaction as new evidence.</p>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
              <section className="overflow-hidden rounded-2xl border border-border bg-panel xl:col-span-7">
                <SectionTitle
                  icon={ShieldCheck}
                  eyebrow="Evidence checked"
                  title="What the current view is using"
                  detail="Every source can change the hypothesis; none can confirm a trade by itself."
                />
                <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2">
                  {[
                    {
                      icon: Radio,
                      title: "Live futures price",
                      value: price === null ? "Waiting" : `${formatKwantBotPrice(selectedRoot, price)} · ${relativeTime(lastTickAt[selectedRoot], now)}`,
                      ready: Boolean(lastTickAt[selectedRoot]),
                    },
                    {
                      icon: Target,
                      title: "Gameplan map",
                      value: nearest ? `${nearest.name} · strength ${nearest.strength}/5` : "Loading",
                      ready: Boolean(nearest),
                    },
                    {
                      icon: Layers3,
                      title: "Options positioning",
                      value: context ? `${context.options.gammaStateLabel} · ${compactMoney(context.options.netPremium)}` : "Loading",
                      ready: Boolean(context),
                    },
                    {
                      icon: History,
                      title: "Historical level memory",
                      value: `${touches.length} touches · ${outcomes.length} reviewed outcomes`,
                      ready: nearestEvents.length > 0,
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.title} className="flex items-center gap-3 bg-panel p-4">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${item.ready ? "border-primary/20 bg-primary/10 text-primary" : "border-border bg-surface text-muted"}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[8px] font-semibold uppercase tracking-[0.11em] text-muted">{item.title}</div>
                          <div className="mt-1 truncate text-[9px] text-foreground">{item.value}</div>
                        </div>
                        <span className={`ml-auto h-1.5 w-1.5 rounded-full ${item.ready ? "bg-primary shadow-[0_0_7px_var(--primary)]" : "bg-muted/50"}`} />
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-border bg-panel xl:col-span-5">
                <SectionTitle
                  icon={Zap}
                  eyebrow="Live environment"
                  title="Options and flow backdrop"
                  detail={`Updated ${relativeTime(context?.options.asOf ?? null, now)}`}
                />
                <div className="grid grid-cols-2 gap-2 p-4">
                  <div className="rounded-xl border border-border bg-surface/55 p-3">
                    <div className="text-[7px] uppercase tracking-[0.12em] text-muted">Premium lean</div>
                    <div className="mt-1 font-mono text-[12px] text-foreground">
                      {context?.options.bullishShare === null || context?.options.bullishShare === undefined
                        ? "Balanced"
                        : `${Math.round(context.options.bullishShare * 100)}% bullish`}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-surface/55 p-3">
                    <div className="text-[7px] uppercase tracking-[0.12em] text-muted">Recent tape</div>
                    <div className="mt-1 flex items-center gap-2 font-mono text-[10px]">
                      <span className="text-primary">{bullishFlow} BULL</span>
                      <span className="text-danger">{bearishFlow} BEAR</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-surface/55 p-3">
                    <div className="text-[7px] uppercase tracking-[0.12em] text-muted">Gamma change</div>
                    <div className="mt-1 truncate font-mono text-[10px] text-foreground">
                      {latestGammaChange ? `${latestGammaChange.minutes}m · ${latestGammaChange.change >= 0 ? "+" : ""}${latestGammaChange.change.toFixed(1)}` : "No fresh change"}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-surface/55 p-3">
                    <div className="text-[7px] uppercase tracking-[0.12em] text-muted">Context state</div>
                    <div className={`mt-1 text-[10px] font-semibold uppercase ${contextStates[selectedRoot] === "live" ? "text-primary" : "text-amber-400"}`}>
                      {contextStates[selectedRoot]}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        ) : null}

        {view === "journal" ? (
          <div className="mx-auto grid max-w-[1680px] grid-cols-1 gap-4 xl:grid-cols-12">
            <section className="overflow-hidden rounded-2xl border border-border bg-panel xl:col-span-8">
              <SectionTitle
                icon={NotebookTabs}
                eyebrow="Running journal"
                title={`${selectedRoot} analysis record`}
                detail="Every published thought is timestamped, retained, searchable, and linked back to prior evidence."
                trailing={(
                  <button
                    type="button"
                    onClick={exportJournal}
                    disabled={archiveExporting}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-[8px] font-semibold uppercase tracking-[0.09em] text-muted transition-colors hover:border-primary/30 hover:text-primary"
                  >
                    <Download className={`h-3 w-3 ${archiveExporting ? "animate-pulse" : ""}`} />
                    {archiveExporting ? "Preparing" : "Export"}
                  </button>
                )}
              />
              <div className="border-b border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[200px] flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                    <input
                      value={journalSearch}
                      onChange={(event) => setJournalSearch(event.target.value)}
                      placeholder="Search the reasoning journal"
                      className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-[10px] text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-primary/40"
                    />
                  </div>
                  {JOURNAL_FILTERS.map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setJournalFilter(filter.id)}
                      className={`h-8 rounded-lg border px-2.5 text-[8px] font-semibold uppercase tracking-[0.08em] transition-colors ${journalFilter === filter.id ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-surface text-muted hover:text-foreground"}`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="max-h-[calc(100vh-250px)] min-h-[520px] overflow-y-auto p-4">
                {!filteredJournal.length ? (
                  <div className="flex min-h-96 flex-col items-center justify-center text-center">
                    <FileClock className="mb-3 h-6 w-6 text-primary" />
                    <div className="text-[12px] font-semibold text-foreground">No matching journal notes</div>
                    <p className="mt-1 text-[9px] text-muted">Change the filter or wait for the next live analysis.</p>
                  </div>
                ) : (
                  <div className="relative space-y-3 pl-6 before:absolute before:bottom-4 before:left-[7px] before:top-4 before:w-px before:bg-border">
                    {filteredJournal.map((note) => {
                      const priorNotes = note.levelId
                        ? rootMessages.filter((candidate) =>
                          candidate.levelId === note.levelId
                          && Date.parse(candidate.createdAt) < Date.parse(note.createdAt))
                        : [];
                      return (
                        <article key={note.id} className="relative rounded-2xl border border-border bg-surface/55 p-4">
                          <span className="absolute -left-[23px] top-5 h-3 w-3 rounded-full border-[3px] border-panel bg-primary shadow-[0_0_8px_color-mix(in_srgb,var(--primary)_45%,transparent)]" />
                          <div className="mb-3 flex items-start justify-between gap-4">
                            <div>
                              <div className={`inline-flex rounded-full border px-2 py-1 text-[7px] font-semibold uppercase tracking-[0.11em] ${messageTone(note.kind)}`}>
                                {messageLabel(note.kind)}
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-[8px] text-muted">
                                <time>{formatDateTime(note.createdAt)}</time>
                                {typeof note.price === "number" ? <span className="font-mono">PRICE {formatKwantBotPrice(selectedRoot, note.price)}</span> : null}
                              </div>
                            </div>
                            <span className="flex shrink-0 items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[7px] font-semibold uppercase tracking-[0.1em] text-primary">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Recorded
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap text-[10px] leading-[1.7] text-foreground">{note.text}</p>
                          {priorNotes.length ? (
                            <div className="mt-3 rounded-xl border border-border bg-background/45 p-3">
                              <div className="mb-1 flex items-center gap-1.5 text-[7px] font-semibold uppercase tracking-[0.12em] text-primary">
                                <History className="h-3 w-3" />
                                Memory check completed
                              </div>
                              <p className="line-clamp-2 text-[8px] leading-4 text-muted">
                                Referred to {priorNotes.length} earlier note{priorNotes.length === 1 ? "" : "s"} for this level. Latest: “{priorNotes[priorNotes.length - 1].text.slice(0, 180)}…”
                              </p>
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            <aside className="space-y-4 xl:col-span-4">
              <section className="overflow-hidden rounded-2xl border border-border bg-panel">
                <SectionTitle
                  icon={Database}
                  eyebrow="Evidence tape"
                  title="Underlying machine record"
                  detail="The compact events used to verify what the bot said and what happened next."
                />
                <div className="max-h-[440px] overflow-y-auto p-3">
                  <div className="space-y-2">
                    {significantMemory.slice(0, 30).map((event) => (
                      <div key={event.id} className="rounded-xl border border-border bg-surface/50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[7px] font-semibold uppercase tracking-[0.11em] text-primary">{eventLabel(event.type)}</span>
                          <time className="font-mono text-[7px] text-muted">{formatTime(event.createdAt)}</time>
                        </div>
                        <div className="mt-1.5 truncate text-[9px] font-semibold text-foreground">{event.levelName ?? "Market context"}</div>
                        {event.zone ? <div className="mt-1 font-mono text-[8px] text-muted">{formatZone(selectedRoot, event.zone)}</div> : null}
                        {event.detail ? <p className="mt-1.5 text-[8px] leading-4 text-muted">{event.detail}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
              <section className="rounded-2xl border border-primary/20 bg-primary/[0.05] p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <div className="text-[9px] font-semibold text-foreground">Journal discipline</div>
                    <p className="mt-1 text-[8px] leading-4 text-muted">
                      A forecast is never overwritten. The next note records whether it remained valid, changed, failed, or produced confirmed distance.
                    </p>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        ) : null}

        {view === "learning" ? (
          <div className="mx-auto max-w-[1680px] space-y-4">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatCard
                label="Reasoning quality"
                value={averageLearningScore === null ? "Awaiting review" : `${averageLearningScore}%`}
                detail="Average across completed, evidence-scored cycles"
                icon={Gauge}
                active={averageLearningScore !== null && averageLearningScore >= 72}
              />
              <StatCard
                label="Reviewed outcomes"
                value={`${rootLearningReviews.length}`}
                detail={`${confirmedLearningReviews} confirmed · ${failedLearningReviews} failed`}
                icon={ListChecks}
              />
              <StatCard
                label="Calibration trend"
                value={learningTrend === null ? "Building sample" : `${learningTrend >= 0 ? "+" : ""}${learningTrend} pts`}
                detail="Latest 10 reviews versus the previous 10"
                icon={learningTrend !== null && learningTrend < 0 ? TrendingDown : TrendingUp}
                active={learningTrend !== null && learningTrend > 0}
              />
              <StatCard
                label="Learning memory"
                value={learningSyncState === "synced" ? "Cloud synced" : learningSyncState === "syncing" ? "Syncing" : "Local retained"}
                detail={learningSyncState === "synced" ? "Authenticated Supabase journal" : "Safe on this device; cloud table pending"}
                icon={learningSyncState === "synced" ? Cloud : CloudOff}
                active={learningSyncState === "synced"}
              />
            </div>

            {!latestLearningReview ? (
              <section className="overflow-hidden rounded-2xl border border-border bg-panel">
                <SectionTitle
                  icon={GraduationCap}
                  eyebrow="Post-outcome reviewer"
                  title={`Machine Learning is watching ${selectedRoot}`}
                  detail="The first review appears after a mapped level completes preparation, contact, reaction, and outcome."
                />
                <div className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
                    <BrainCircuit className="h-7 w-7" />
                  </div>
                  <h3 className="mt-5 text-[15px] font-semibold text-foreground">Waiting for a completed evidence chain</h3>
                  <p className="mt-2 max-w-lg text-[9px] leading-5 text-muted">
                    KwantBot will not invent a score from an unfinished call. Once an outcome is measured, this page preserves the original wording, compares it with what happened, scores the reasoning, and writes a reusable improvement rule.
                  </p>
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[8px] uppercase tracking-[0.1em] text-muted">
                    {["Prepare", "Touch", "React", "Measure", "Review", "Remember"].map((label, index) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className="rounded-lg border border-border bg-surface px-2.5 py-1.5">{label}</span>
                        {index < 5 ? <ArrowRight className="h-3 w-3 text-primary/60" /> : null}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                  <section className="overflow-hidden rounded-2xl border border-primary/25 bg-[linear-gradient(145deg,color-mix(in_srgb,var(--primary)_6%,var(--panel)),var(--panel))] xl:col-span-8">
                    <SectionTitle
                      icon={GraduationCap}
                      eyebrow="Latest self-review"
                      title={`${latestLearningReview.levelName} · ${latestLearningReview.verdict.toLowerCase()}`}
                      detail={`Reviewed ${formatDateTime(latestLearningReview.reviewedAt)} after a ${formatReviewDuration(latestLearningReview.evidence.timeToOutcomeMs)} measured cycle.`}
                      trailing={(
                        <span className={`rounded-full border px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] ${reviewTone(latestLearningReview)}`}>
                          {latestLearningReview.grade}
                        </span>
                      )}
                    />
                    <div className="space-y-4 p-4">
                      <div className="rounded-2xl border border-border bg-background/45 p-4">
                        <div className="flex items-end justify-between gap-4">
                          <div>
                            <div className="text-[8px] font-semibold uppercase tracking-[0.14em] text-muted">Reasoning quality</div>
                            <div className="mt-1 font-mono text-[28px] font-semibold leading-none text-foreground">{latestLearningReview.score}%</div>
                          </div>
                          <div className="text-right text-[8px] leading-4 text-muted">
                            Evidence completeness + reaction classification + measured follow-through
                            <div className="font-semibold text-primary">Not a win probability</div>
                          </div>
                        </div>
                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface">
                          <div
                            className="h-full rounded-full bg-primary shadow-[0_0_12px_color-mix(in_srgb,var(--primary)_35%,transparent)] transition-[width] duration-700"
                            style={{ width: `${latestLearningReview.score}%` }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        <div className="rounded-2xl border border-border bg-surface/55 p-4">
                          <div className="mb-2 flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.12em] text-primary">
                            <Eye className="h-3 w-3" />
                            What KwantBot said
                          </div>
                          <p className="text-[9px] leading-[1.7] text-foreground">{latestLearningReview.originalExpectation}</p>
                        </div>
                        <div className="rounded-2xl border border-border bg-surface/55 p-4">
                          <div className="mb-2 flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.12em] text-primary">
                            <CheckCircle2 className="h-3 w-3" />
                            What actually happened
                          </div>
                          <p className="text-[9px] leading-[1.7] text-foreground">{latestLearningReview.actualOutcome}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] p-4">
                          <div className="mb-2 text-[8px] font-semibold uppercase tracking-[0.12em] text-emerald-400">Reasoning that held up</div>
                          <div className="space-y-2">
                            {latestLearningReview.whatWorked.map((item) => (
                              <div key={item} className="flex gap-2 text-[8px] leading-4 text-muted">
                                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-4">
                          <div className="mb-2 text-[8px] font-semibold uppercase tracking-[0.12em] text-amber-400">What was missed</div>
                          <div className="space-y-2">
                            {latestLearningReview.whatMissed.length ? latestLearningReview.whatMissed.map((item) => (
                              <div key={item} className="flex gap-2 text-[8px] leading-4 text-muted">
                                <Eye className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
                                <span>{item}</span>
                              </div>
                            )) : <p className="text-[8px] leading-4 text-muted">No material reasoning gap was found in the retained evidence chain.</p>}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4">
                          <div className="mb-2 text-[8px] font-semibold uppercase tracking-[0.12em] text-primary">Improvement rules written to memory</div>
                          <div className="space-y-2">
                            {latestLearningReview.improvements.map((item) => (
                              <div key={item} className="flex gap-2 text-[8px] leading-4 text-muted">
                                <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-border bg-surface/55 p-4">
                          <div className="mb-2 text-[8px] font-semibold uppercase tracking-[0.12em] text-foreground">Checks for the next encounter</div>
                          <div className="space-y-2">
                            {latestLearningReview.nextChecks.map((item) => (
                              <div key={item} className="flex gap-2 text-[8px] leading-4 text-muted">
                                <ListChecks className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  <aside className="space-y-4 xl:col-span-4">
                    <section className="overflow-hidden rounded-2xl border border-border bg-panel">
                      <SectionTitle
                        icon={Gauge}
                        eyebrow="Calibration"
                        title="Is the reasoning improving?"
                        detail="Scores compare review quality across completed cycles, not market direction accuracy alone."
                      />
                      <div className="space-y-2 p-4">
                        {rootLearningReviews.slice(0, 12).reverse().map((review) => (
                          <div key={review.id} className="grid grid-cols-[64px_1fr_34px] items-center gap-2">
                            <div className="truncate text-[7px] font-semibold text-muted">{review.levelName}</div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-background">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${review.score}%` }} />
                            </div>
                            <div className="text-right font-mono text-[8px] text-foreground">{review.score}</div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="overflow-hidden rounded-2xl border border-border bg-panel">
                      <SectionTitle
                        icon={BrainCircuit}
                        eyebrow="Recurring blind spots"
                        title="What deserves more attention"
                        detail="Repeated weaknesses are counted across the retained review journal."
                      />
                      <div className="space-y-2 p-4">
                        {blindSpots.length ? blindSpots.map(([tag, count]) => (
                          <div key={tag} className="flex items-center justify-between rounded-xl border border-border bg-surface/50 p-3">
                            <div className="text-[8px] font-semibold uppercase tracking-[0.08em] text-muted">{tag.replaceAll("-", " ")}</div>
                            <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-[8px] text-primary">{count}</span>
                          </div>
                        )) : (
                          <p className="rounded-xl border border-border bg-surface/50 p-3 text-[8px] leading-4 text-muted">
                            No recurring blind spot has enough evidence yet. The reviewer will count repeated failures without turning a single event into a rule.
                          </p>
                        )}
                      </div>
                    </section>

                    <section className={`rounded-2xl border p-4 ${learningSyncState === "synced" ? "border-primary/20 bg-primary/[0.05]" : "border-border bg-panel"}`}>
                      <div className="flex items-start gap-3">
                        {learningSyncState === "synced"
                          ? <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          : <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-muted" />}
                        <div>
                          <div className="text-[9px] font-semibold text-foreground">
                            {learningSyncState === "synced" ? "Learning journal cloud synced" : "Learning journal retained locally"}
                          </div>
                          <p className="mt-1 text-[8px] leading-4 text-muted">
                            {learningSyncState === "synced"
                              ? "Authenticated reviews are stored per user in Supabase and merged with this device journal."
                              : "Reviews remain available on this device. Cloud sync activates when the KwantBot learning table is available."}
                          </p>
                        </div>
                      </div>
                    </section>
                  </aside>
                </div>

                <section className="overflow-hidden rounded-2xl border border-border bg-panel">
                  <SectionTitle
                    icon={NotebookTabs}
                    eyebrow="Learning journal"
                    title={`${selectedRoot} post-outcome review history`}
                    detail="The original call is immutable; later reviews add measured evidence and reusable correction rules."
                  />
                  <div className="max-h-[560px] overflow-y-auto p-4">
                    <div className="relative space-y-3 pl-6 before:absolute before:bottom-4 before:left-[7px] before:top-4 before:w-px before:bg-border">
                      {rootLearningReviews.map((review) => (
                        <article key={review.id} className="relative rounded-2xl border border-border bg-surface/55 p-4">
                          <span className="absolute -left-[23px] top-5 h-3 w-3 rounded-full border-[3px] border-panel bg-primary" />
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-[11px] font-semibold text-foreground">{review.levelName}</h3>
                                <span className={`rounded-full border px-2 py-0.5 text-[7px] font-semibold uppercase tracking-[0.1em] ${reviewTone(review)}`}>
                                  {review.verdict}
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[7px] text-muted">
                                <time>{formatDateTime(review.reviewedAt)}</time>
                                <span>{review.reactionType} {review.direction}</span>
                                <span>{formatReviewDuration(review.evidence.timeToOutcomeMs)}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono text-[18px] font-semibold text-foreground">{review.score}%</div>
                              <div className="text-[7px] uppercase tracking-[0.1em] text-muted">reasoning quality</div>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                            <div className="rounded-xl border border-border bg-background/45 p-3">
                              <div className="text-[7px] font-semibold uppercase tracking-[0.11em] text-primary">Original reasoning</div>
                              <p className="mt-1 line-clamp-3 text-[8px] leading-4 text-muted">{review.originalExpectation}</p>
                            </div>
                            <div className="rounded-xl border border-border bg-background/45 p-3">
                              <div className="text-[7px] font-semibold uppercase tracking-[0.11em] text-primary">Review conclusion</div>
                              <p className="mt-1 line-clamp-3 text-[8px] leading-4 text-muted">{review.actualOutcome}</p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {review.blindSpotTags.map((tag) => (
                              <span key={tag} className="rounded-full border border-border bg-background px-2 py-1 text-[7px] uppercase tracking-[0.08em] text-muted">
                                {tag.replaceAll("-", " ")}
                              </span>
                            ))}
                            <span className="ml-auto flex items-center gap-1 text-[7px] uppercase tracking-[0.09em] text-primary">
                              <Database className="h-2.5 w-2.5" />
                              {review.syncState === "synced" ? "cloud retained" : "device retained"}
                            </span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>
        ) : null}

        {view === "levels" ? (
          <div className="mx-auto max-w-[1680px] space-y-4">
            <section className="overflow-hidden rounded-2xl border border-border bg-panel">
              <SectionTitle
                icon={Waypoints}
                eyebrow="Level memory"
                title={`${selectedRoot} historical decision areas`}
                detail="Current Gameplan levels matched against stored touches, reactions, and reviewed outcomes."
              />
              <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
                {visibleLevels.map((level, index) => {
                  const events = rootMemory.filter((event) => matchesLevel(selectedRoot, event, level));
                  const levelTouches = events.filter((event) => event.type === "touch");
                  const levelOutcomes = events.filter((event) => event.type === "outcome");
                  const confirmed = levelOutcomes.filter((event) => event.detail?.includes("follow-through"));
                  const latest = events[events.length - 1];
                  const distance = price === null ? null : distanceToZone(price, level.zone);
                  return (
                    <article key={level.id} className={`rounded-2xl border p-4 ${index === 0 ? "border-primary/35 bg-primary/[0.06]" : "border-border bg-surface/50"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className={`text-[8px] font-semibold uppercase tracking-[0.12em] ${index === 0 ? "text-primary" : "text-muted"}`}>
                            {index === 0 ? "Nearest decision" : level.role}
                          </div>
                          <h3 className="mt-1 truncate text-[12px] font-semibold text-foreground">{level.name}</h3>
                        </div>
                        <span className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, dot) => (
                            <span key={dot} className={`h-1.5 w-1.5 rounded-full ${dot < level.strength ? "bg-primary" : "bg-border"}`} />
                          ))}
                        </span>
                      </div>
                      <div className="mt-3 font-mono text-[12px] text-foreground">{formatZone(selectedRoot, level.zone)}</div>
                      <div className="mt-1 text-[8px] text-muted">{distance === null ? "Waiting for price" : distance === 0 ? "Price is inside the zone" : `${distance.toFixed(2)} points away`}</div>
                      <div className="my-3 h-px bg-border" />
                      <div className="grid grid-cols-3 gap-2">
                        <div><div className="font-mono text-[11px] text-foreground">{levelTouches.length}</div><div className="text-[7px] uppercase text-muted">Touches</div></div>
                        <div><div className="font-mono text-[11px] text-primary">{confirmed.length}</div><div className="text-[7px] uppercase text-muted">Confirmed</div></div>
                        <div><div className="font-mono text-[11px] text-foreground">{levelOutcomes.length}</div><div className="text-[7px] uppercase text-muted">Reviewed</div></div>
                      </div>
                      <div className="mt-3 rounded-xl border border-border bg-background/45 p-2.5">
                        <div className="text-[7px] font-semibold uppercase tracking-[0.11em] text-primary">Last stored read</div>
                        <p className="mt-1 line-clamp-2 text-[8px] leading-4 text-muted">
                          {latest ? `${eventLabel(latest.type)} · ${latest.detail ?? latest.reasoning ?? "evidence recorded"}` : "No historical response stored for this area yet."}
                        </p>
                        {latest ? <div className="mt-1 text-[7px] text-muted/70">{formatDateTime(latest.createdAt)}</div> : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <section className="overflow-hidden rounded-2xl border border-border bg-panel">
                <SectionTitle
                  icon={History}
                  eyebrow="Reaction statistics"
                  title="What the stored sample actually says"
                  detail="Counts are observations from this device journal, not backtested probabilities."
                />
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border bg-surface/55 p-4">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <div className="mt-3 font-mono text-[18px] text-foreground">
                        {significantMemory.filter((event) => event.type === "rejection" && event.detail?.includes("up")).length}
                      </div>
                      <div className="mt-1 text-[8px] uppercase tracking-[0.1em] text-muted">Upward rejections</div>
                    </div>
                    <div className="rounded-xl border border-border bg-surface/55 p-4">
                      <TrendingDown className="h-4 w-4 text-danger" />
                      <div className="mt-3 font-mono text-[18px] text-foreground">
                        {significantMemory.filter((event) => event.type === "rejection" && event.detail?.includes("down")).length}
                      </div>
                      <div className="mt-1 text-[8px] uppercase tracking-[0.1em] text-muted">Downward rejections</div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-border bg-panel">
                <SectionTitle
                  icon={Sparkles}
                  eyebrow="Adaptation rule"
                  title="How KwantBot changes its mind"
                  detail="The bot moves from forecast to observation to reviewed outcome."
                />
                <div className="space-y-2 p-4">
                  {[
                    "Prepare: map the next level and check all matching historical notes.",
                    "Observe: withhold direction while price trades inside the decision zone.",
                    "Confirm: record rejection or acceptance only after price leaves the zone.",
                    "Review: measure follow-through, failure, or a return into the zone.",
                    "Adapt: carry the reviewed outcome into the next encounter.",
                  ].map((text, index) => (
                    <div key={text} className="flex items-center gap-3 rounded-xl border border-border bg-surface/50 p-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-[8px] font-semibold text-primary">{index + 1}</span>
                      <p className="text-[9px] leading-4 text-muted">{text}</p>
                      {index < 4 ? <ArrowRight className="ml-auto h-3 w-3 shrink-0 text-muted/50" /> : <CheckCircle2 className="ml-auto h-3 w-3 shrink-0 text-primary" />}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
