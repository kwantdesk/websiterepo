"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  Ban,
  CheckCircle2,
  Clock3,
  Database,
  Eye,
  FileCheck2,
  FlaskConical,
  LockKeyhole,
  RefreshCw,
  Route,
  ShieldAlert,
  Target,
} from "lucide-react";

import AppSidebar from "@/components/AppSidebar";
import LabSessionChart from "@/components/lab/LabSessionChart";
import {
  clampLabRefreshMs,
  isLabSnapshot,
  labClockPhase,
  labSnapshotFreshness,
  type LabCogStatus,
  type LabGateStatus,
  type LabLevelKind,
  type LabRoot,
  type LabSnapshot,
} from "@/lib/labSnapshot";

function Panel({ title, eyebrow, action, className = "", children }: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`min-w-0 border border-border bg-panel ${className}`}>
      <header className="flex min-h-10 items-center gap-3 border-b border-border px-3 py-2">
        <div className="min-w-0">
          {eyebrow ? <p className="text-[7px] font-semibold uppercase tracking-[0.16em] text-muted">{eyebrow}</p> : null}
          <h2 className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground">{title}</h2>
        </div>
        {action ? <div className="ml-auto shrink-0">{action}</div> : null}
      </header>
      {children}
    </section>
  );
}

function gateTone(status: LabGateStatus) {
  if (status === "PASS") return "border-primary/30 bg-primary/[0.06] text-primary";
  if (status === "STOP") return "border-danger/35 bg-danger/[0.08] text-danger";
  if (status === "WARN") return "border-accent/30 bg-accent/[0.06] text-accent";
  return "border-border bg-background text-muted";
}

function cogTone(status: LabCogStatus) {
  if (status === "LIVE") return "text-primary";
  if (status === "DOWN" || status === "STALE") return "text-danger";
  return "text-muted";
}

function levelTone(kind: LabLevelKind) {
  if (kind === "BUY" || kind === "TARGET") return "border-primary/25 text-primary";
  if (kind === "SELL" || kind === "NO_TRADE") return "border-danger/30 text-danger";
  return "border-border text-foreground";
}

function timeAgo(value: string | null, now: number) {
  if (!value) return "unknown";
  const age = Math.max(0, now - Date.parse(value));
  if (age < 60_000) return `${Math.floor(age / 1_000)}s ago`;
  if (age < 60 * 60_000) return `${Math.floor(age / 60_000)}m ago`;
  return `${Math.floor(age / 3_600_000)}h ago`;
}

function formatPrice(value: number | null) {
  return value === null ? "—" : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatCountdown(milliseconds: number) {
  const value = Math.max(0, milliseconds);
  const hours = Math.floor(value / 3_600_000);
  const minutes = Math.floor((value % 3_600_000) / 60_000);
  const seconds = Math.floor((value % 60_000) / 1_000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function EmptyRow({ children }: { children: ReactNode }) {
  return <div className="border border-dashed border-border bg-background/40 px-3 py-5 text-center text-[8px] leading-4 text-muted">{children}</div>;
}

export default function LabWorkspace() {
  const [root, setRoot] = useState<LabRoot>("NQ");
  const [snapshot, setSnapshot] = useState<LabSnapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const snapshotRef = useRef<LabSnapshot | null>(null);

  const loadSnapshot = useCallback(async (manual = false) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    if (manual) setRefreshing(true);
    else if (!snapshotRef.current) setLoading(true);
    try {
      const response = await fetch(`/api/lab/snapshot?root=${root}`, { cache: "no-store", signal: controller.signal });
      const body = await response.json().catch(() => ({})) as unknown;
      if (!response.ok) {
        const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
          ? body.error
          : "The VPS repository snapshot is unavailable.";
        throw new Error(message);
      }
      if (!isLabSnapshot(body)) throw new Error("The VPS repository returned an invalid August V1 snapshot.");
      snapshotRef.current = body;
      setSnapshot(body);
      setError("");
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "The VPS repository snapshot is unavailable.");
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [root]);

  useEffect(() => {
    snapshotRef.current = null;
    setSnapshot(null);
    setError("");
    void loadSnapshot();
    return () => requestRef.current?.abort();
  }, [loadSnapshot, root]);

  useEffect(() => {
    const delay = clampLabRefreshMs(snapshot?.refreshAfterMs ?? 15_000);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadSnapshot();
    }, delay);
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadSnapshot();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadSnapshot, snapshot?.refreshAfterMs]);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const currentTime = now ?? 0;
  const clock = labClockPhase(new Date(currentTime));
  const planAt = clock.open.getTime() - 30 * 60_000;
  const beforePlan = currentTime < planAt;
  const countdownTarget = beforePlan ? planAt : clock.open.getTime();
  const countdownLabel = beforePlan ? "Plan publication" : clock.phase === "PLAN_WINDOW" ? "New York wake" : "Session clock";
  const freshness = snapshot && now !== null ? labSnapshotFreshness(snapshot, now) : "MISSING";
  const currentSnapshot = snapshot?.root === root ? snapshot : null;
  const stoppedGate = currentSnapshot?.gates.find((gate) => gate.status === "STOP");
  const deadCog = currentSnapshot?.cogs.find((cog) => cog.status === "DOWN" || cog.status === "STALE");
  const filmBlocked = !currentSnapshot || currentSnapshot.film.status !== "READY";
  const modeBlocked = !currentSnapshot || currentSnapshot.mode.value === "UNRESOLVED";
  const freshnessBlocked = freshness === "STALE" || freshness === "MISSING";
  const clearToConsider = Boolean(currentSnapshot)
    && !stoppedGate
    && !deadCog
    && !filmBlocked
    && !modeBlocked
    && !freshnessBlocked
    && currentSnapshot?.trade.status === "ARMED";
  const spot = currentSnapshot?.mode.spot ?? null;
  const orderedLevels = useMemo(() => (currentSnapshot?.levels ?? [])
    .slice()
    .sort((left, right) => {
      if (spot === null) return right.strength - left.strength;
      const leftDistance = Math.min(Math.abs(left.low - spot), Math.abs(left.high - spot));
      const rightDistance = Math.min(Math.abs(right.low - spot), Math.abs(right.high - spot));
      return leftDistance - rightDistance;
    }), [currentSnapshot?.levels, spot]);

  const lockLab = async () => {
    await fetch("/api/lab/access", { method: "DELETE" }).catch(() => undefined);
    window.location.reload();
  };

  return (
    <main className="flex h-screen min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <AppSidebar activeItem="lab" orientation="horizontal" />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex min-h-[54px] shrink-0 items-center gap-3 border-b border-border bg-panel px-3">
          <div className="flex h-8 w-8 items-center justify-center border border-primary/30 bg-primary/[0.06] text-primary">
            <FlaskConical className="h-4 w-4" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[12px] font-semibold uppercase tracking-[0.12em]">THE LAB</h1>
              <span className="border border-border px-1.5 py-0.5 text-[6px] font-semibold uppercase tracking-[0.14em] text-muted">August V1</span>
              {currentSnapshot?.environment === "TEST" ? <span className="border border-danger/40 px-1.5 py-0.5 text-[6px] font-semibold uppercase tracking-[0.14em] text-danger">Test data · not for trading</span> : null}
            </div>
            <p className="mt-1 truncate text-[7px] uppercase tracking-[0.12em] text-muted">Plan → wake → Film → decision → journal → audit</p>
          </div>
          <div className="ml-2 flex items-center border border-border bg-background p-0.5">
            {(["NQ", "ES"] as LabRoot[]).map((item) => (
              <button key={item} type="button" onClick={() => setRoot(item)} className={`h-7 min-w-10 px-2 font-mono text-[9px] font-semibold ${root === item ? "bg-primary text-background" : "text-muted hover:text-foreground"}`}>{item}</button>
            ))}
          </div>
          <div className="ml-auto hidden items-center gap-5 xl:flex">
            <div><p className="text-[6px] uppercase tracking-[0.14em] text-muted">New York</p><p className="mt-1 font-mono text-[9px]">{now === null ? "--:--:--" : new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now)}</p></div>
            <div><p className="text-[6px] uppercase tracking-[0.14em] text-muted">{countdownLabel}</p><p className="mt-1 font-mono text-[9px]">{now === null ? "--:--:--" : clock.phase === "LIVE" ? "RTH ACTIVE" : formatCountdown(countdownTarget - now)}</p></div>
            <div><p className="text-[6px] uppercase tracking-[0.14em] text-muted">Repository receipt</p><p className={`mt-1 font-mono text-[9px] ${freshness === "CURRENT" ? "text-primary" : freshness === "STALE" || freshness === "MISSING" ? "text-danger" : "text-accent"}`}>{currentSnapshot ? `${freshness} · ${timeAgo(currentSnapshot.updatedAt, currentTime)}` : "MISSING"}</p></div>
          </div>
          <button type="button" onClick={() => void loadSnapshot(true)} className="ml-1 flex h-8 w-8 items-center justify-center border border-border text-muted hover:border-primary/30 hover:text-foreground" title="Refresh repository snapshot"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} strokeWidth={1.5} /></button>
          <button type="button" onClick={() => void lockLab()} className="flex h-8 w-8 items-center justify-center border border-border text-muted hover:border-danger/30 hover:text-danger" title="Lock THE LAB"><LockKeyhole className="h-3.5 w-3.5" strokeWidth={1.5} /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
          {error ? <div className="mb-2.5 flex items-start gap-3 border border-danger/35 bg-danger/[0.05] px-3 py-2.5"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" strokeWidth={1.5} /><div><p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-danger">No current desk-issued snapshot</p><p className="mt-1 text-[8px] leading-4 text-muted">{error} THE LAB will not substitute vendor calls or manufacture a plan. Price may remain visible, but trade permission is blocked.</p></div></div> : null}
          {loading && !currentSnapshot ? <div className="mb-2.5 border border-border bg-panel px-3 py-2 text-[8px] text-muted">Reading the latest August V1 repository receipt…</div> : null}

          <div className="grid grid-cols-12 gap-2.5">
            <Panel title={currentSnapshot?.mode.value ?? "No mode"} eyebrow="The mode word opens every call" className="col-span-12 xl:col-span-8" action={<span className={`border px-2 py-1 text-[7px] font-semibold uppercase tracking-[0.12em] ${clearToConsider ? "border-primary/30 text-primary" : "border-danger/35 text-danger"}`}>{clearToConsider ? "Clear to evaluate · announce still required" : "Do not click"}</span>}>
              <div className="grid min-h-[132px] grid-cols-1 gap-px bg-border lg:grid-cols-[180px_1fr_220px]">
                <div className="bg-background p-4"><p className={`font-mono text-[30px] font-semibold tracking-[-0.05em] ${currentSnapshot?.mode.value === "FOLLOW" ? "text-danger" : currentSnapshot?.mode.value === "FADE" ? "text-primary" : "text-muted"}`}>{currentSnapshot?.mode.value ?? "—"}</p><p className="mt-2 text-[8px] leading-4 text-muted">{currentSnapshot?.mode.reason ?? "Waiting for spot, zero-gamma flip, and a second frame."}</p><div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[9px]"><span>SPOT {formatPrice(currentSnapshot?.mode.spot ?? null)}</span><span>FLIP {formatPrice(currentSnapshot?.mode.flip ?? null)}</span></div></div>
                <div className="bg-panel p-4"><p className="text-[7px] font-semibold uppercase tracking-[0.14em] text-muted">Desk call</p><p className="mt-2 text-[15px] font-medium leading-6 text-foreground">{currentSnapshot?.summary.oneLiner ?? "No August V1 plan has been published for this session."}</p><p className="mt-2 text-[8px] leading-4 text-muted">KILL: {currentSnapshot?.summary.killCondition ?? "Any market call remains blocked until the repository receipt is current."}</p></div>
                <div className="bg-background p-4"><div className="flex items-center justify-between"><span className="text-[7px] uppercase tracking-[0.12em] text-muted">Confidence</span><span className="font-mono text-[14px]">{currentSnapshot?.summary.confidence ?? 0}%</span></div><div className="mt-2 h-1 bg-surface"><div className="h-full bg-primary" style={{ width: `${currentSnapshot?.summary.confidence ?? 0}%` }} /></div><div className="mt-4 grid grid-cols-2 gap-3 text-[7px]"><div><p className="uppercase tracking-[0.12em] text-muted">Grade</p><p className="mt-1 text-foreground">{currentSnapshot?.summary.evidenceGrade ?? "UNVERIFIED"}</p></div><div><p className="uppercase tracking-[0.12em] text-muted">Sample</p><p className="mt-1 font-mono text-foreground">n={currentSnapshot?.summary.sampleSize ?? 0}</p></div></div></div>
              </div>
            </Panel>

            <Panel title="Permission gate" eyebrow="Machine before narrative" className="col-span-12 xl:col-span-4">
              <div className="grid min-h-[132px] grid-cols-2 gap-px bg-border">
                {[["Receipt current", !freshnessBlocked, freshness], ["Mode resolved", !modeBlocked, currentSnapshot?.mode.value ?? "MISSING"], ["Film ready", !filmBlocked, currentSnapshot?.film.status ?? "MISSING"], ["Referees clear", !stoppedGate, stoppedGate?.label ?? "NO STOP"], ["Cogs usable", !deadCog, deadCog?.label ?? "NO DEAD COG"], ["Trade armed", currentSnapshot?.trade.status === "ARMED", currentSnapshot?.trade.status ?? "MISSING"]].map(([label, pass, detail]) => <div key={String(label)} className="bg-background p-3"><div className="flex items-center gap-2">{pass ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" strokeWidth={1.5} /> : <Ban className="h-3.5 w-3.5 text-danger" strokeWidth={1.5} />}<span className="text-[8px] font-medium">{label}</span></div><p className="mt-2 truncate font-mono text-[7px] text-muted">{String(detail)}</p></div>)}
              </div>
            </Panel>

            <div className="col-span-12 xl:col-span-8"><LabSessionChart root={root} mode={currentSnapshot?.mode.value ?? "UNRESOLVED"} levels={currentSnapshot?.levels ?? []} updates={currentSnapshot?.updates ?? []} /></div>

            <Panel title="Doors & condemned ground" eyebrow="Nearest first · source tagged" className="col-span-12 xl:col-span-4">
              <div className="max-h-[410px] overflow-y-auto p-2">
                {orderedLevels.length ? orderedLevels.map((level) => <article key={level.id} className="mb-1.5 border border-border bg-background p-2.5 last:mb-0"><div className="flex items-center gap-2"><span className={`border px-1.5 py-0.5 text-[6px] font-semibold uppercase tracking-[0.1em] ${levelTone(level.kind)}`}>{level.kind}</span><strong className="min-w-0 flex-1 truncate text-[9px]">{level.label}</strong><span className="font-mono text-[9px]">{level.low === level.high ? formatPrice(level.low) : `${formatPrice(level.low)}–${formatPrice(level.high)}`}</span></div><p className="mt-2 text-[8px] leading-4 text-foreground">{level.action}</p><p className="mt-1 text-[7px] leading-3 text-muted">Invalidation: {level.invalidation}</p><div className="mt-2 flex flex-wrap gap-1">{level.sources.slice(0, 5).map((source) => <span key={source} className="border border-border px-1 py-0.5 text-[6px] uppercase tracking-[0.08em] text-muted">{source}</span>)}</div></article>) : <EmptyRow>No repository-issued doors. No level is tradeable.</EmptyRow>}
                {(currentSnapshot?.noTrade.length ?? 0) > 0 ? <div className="mt-2 border-t border-border pt-2">{currentSnapshot?.noTrade.map((zone) => <div key={zone.id} className="mb-1.5 border border-danger/25 bg-danger/[0.04] p-2"><div className="flex items-center gap-2 text-danger"><Ban className="h-3 w-3" /><span className="text-[8px] font-semibold">{zone.label}</span></div><p className="mt-1 text-[7px] leading-3 text-muted">{zone.reason}</p></div>)}</div> : null}
              </div>
            </Panel>

            <Panel title="Film" eyebrow="Delta from the previous frame" className="col-span-12 lg:col-span-6 xl:col-span-4" action={<span className={`text-[7px] font-semibold ${currentSnapshot?.film.status === "READY" ? "text-primary" : "text-danger"}`}>{currentSnapshot?.film.status ?? "NO FILM"}</span>}>
              <div className="p-2">{currentSnapshot?.film.deltas.length ? currentSnapshot.film.deltas.map((delta) => <div key={delta.id} className="mb-1.5 grid grid-cols-[1fr_auto] gap-2 border border-border bg-background p-2 last:mb-0"><div><div className="flex items-center gap-2"><span className="text-[8px] font-semibold">{delta.label}</span><span className="text-[6px] uppercase tracking-[0.1em] text-muted">{delta.direction.replaceAll("_", " ")}</span></div><p className="mt-1 text-[7px] leading-3 text-muted">{delta.interpretation}</p></div><div className="text-right font-mono text-[8px]"><p>{formatPrice(delta.previous)} → {formatPrice(delta.current)}</p><p className={delta.delta !== null && delta.delta < 0 ? "mt-1 text-danger" : "mt-1 text-primary"}>{delta.delta === null ? "—" : `${delta.delta >= 0 ? "+" : ""}${delta.delta.toFixed(2)}`}</p></div></div>) : <EmptyRow>One frame means no Film. Pull again before any live call.</EmptyRow>}</div>
            </Panel>

            <Panel title="Referee gate" eyebrow="Current readings are required" className="col-span-12 lg:col-span-6 xl:col-span-4">
              <div className="p-2">{currentSnapshot?.gates.length ? currentSnapshot.gates.map((gate) => <div key={gate.id} className={`mb-1.5 border p-2 last:mb-0 ${gateTone(gate.status)}`}><div className="flex items-center gap-2"><span className="text-[8px] font-semibold">{gate.label}</span><span className="ml-auto font-mono text-[8px]">{gate.value}</span><span className="text-[6px] font-semibold">{gate.status}</span></div><p className="mt-1 text-[7px] leading-3 opacity-70">{gate.rule}</p></div>) : <EmptyRow>No current referee readings. The announce cannot pass.</EmptyRow>}</div>
            </Panel>

            <Panel title="The one trade" eyebrow="Deleted means deleted" className="col-span-12 xl:col-span-4" action={<span className={`text-[7px] font-semibold ${currentSnapshot?.trade.status === "ARMED" ? "text-primary" : "text-danger"}`}>{currentSnapshot?.trade.status ?? "NO TRADE"}</span>}>
              <div className="p-3"><div className="flex items-center gap-2"><Target className="h-4 w-4 text-primary" strokeWidth={1.5} /><strong className="text-[10px]">{currentSnapshot?.trade.name || "No setup issued"}</strong><span className="ml-auto text-[8px] text-muted">{currentSnapshot?.trade.side ?? "—"}</span></div><p className="mt-3 text-[8px] leading-4 text-foreground">{currentSnapshot?.trade.permission ?? "The desk has not issued permission."}</p><div className="mt-3 grid grid-cols-3 gap-px bg-border text-center"><div className="bg-background p-2"><p className="text-[6px] uppercase tracking-[0.1em] text-muted">Stop</p><p className="mt-1 font-mono text-[9px]">{formatPrice(currentSnapshot?.trade.stop ?? null)}</p></div><div className="bg-background p-2"><p className="text-[6px] uppercase tracking-[0.1em] text-muted">Core door</p><p className="mt-1 font-mono text-[9px]">{formatPrice(currentSnapshot?.trade.coreTarget ?? null)}</p></div><div className="bg-background p-2"><p className="text-[6px] uppercase tracking-[0.1em] text-muted">Runner</p><p className="mt-1 font-mono text-[9px]">{formatPrice(currentSnapshot?.trade.runnerTarget ?? null)}</p></div></div><p className="mt-3 text-[7px] leading-3 text-muted">Trigger: {currentSnapshot?.trade.entryTrigger || "Not issued"}</p><p className="mt-1 text-[7px] leading-3 text-danger">Invalidation: {currentSnapshot?.trade.invalidation || "Missing — do not trade"}</p></div>
            </Panel>

            <Panel title="Live desk thoughts" eyebrow="Timestamped · evidence separated from outcome" className="col-span-12 xl:col-span-8">
              <div className="max-h-[360px] overflow-y-auto p-3">{currentSnapshot?.updates.length ? currentSnapshot.updates.slice().reverse().map((update, index) => <article key={update.id} className="relative grid grid-cols-[72px_14px_1fr] gap-2 pb-4 last:pb-0"><time className="pt-0.5 font-mono text-[7px] text-muted">{new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false }).format(Date.parse(update.at))} NY</time><div className="relative"><span className={`relative z-10 block h-2.5 w-2.5 border ${index === 0 ? "border-primary bg-primary" : "border-border bg-panel"}`} />{index < currentSnapshot.updates.length - 1 ? <span className="absolute left-[4px] top-2 h-[calc(100%+8px)] w-px bg-border" /> : null}</div><div className="border border-border bg-background p-2.5"><div className="flex items-center gap-2"><span className="border border-border px-1 py-0.5 text-[6px] uppercase tracking-[0.1em] text-muted">{update.kind}</span><strong className="text-[9px]">{update.title}</strong>{update.price !== null ? <span className="ml-auto font-mono text-[8px]">{formatPrice(update.price)}</span> : null}</div><p className="mt-2 text-[8px] leading-4 text-foreground">{update.body}</p>{update.evidence.length ? <p className="mt-2 text-[7px] leading-3 text-muted">Evidence: {update.evidence.join(" · ")}</p> : null}</div></article>) : <EmptyRow>No desk thoughts have been published. Chat text is not desk memory.</EmptyRow>}</div>
            </Panel>

            <Panel title="Scenario board" eyebrow="Weights are evidence claims" className="col-span-12 xl:col-span-7">
              <div className="grid gap-2 p-3 md:grid-cols-2">{currentSnapshot?.scenarios.length ? currentSnapshot.scenarios.map((scenario) => <article key={scenario.id} className="border border-border bg-background p-3"><div className="flex items-center gap-2"><Route className="h-3.5 w-3.5 text-muted" strokeWidth={1.5} /><strong className="text-[9px]">{scenario.name}</strong><span className="ml-auto font-mono text-[10px]">{scenario.weight}%</span></div><div className="mt-2 h-1 bg-surface"><div className="h-full bg-primary" style={{ width: `${scenario.weight}%` }} /></div><p className="mt-3 text-[7px] leading-3 text-foreground">TRIGGER: {scenario.trigger}</p><p className="mt-1 text-[7px] leading-3 text-muted">PATH: {scenario.path.length ? scenario.path.map(formatPrice).join(" → ") : "Not issued"}</p><p className="mt-1 text-[7px] leading-3 text-danger">KILL: {scenario.kill}</p></article>) : <EmptyRow>No weighted scenarios have been issued.</EmptyRow>}</div>
            </Panel>

            <Panel title="Data cogs" eyebrow="A dead cog is announced" className="col-span-12 xl:col-span-5">
              <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2">{currentSnapshot?.cogs.length ? currentSnapshot.cogs.map((cog) => <div key={cog.id} className="bg-background p-3"><div className="flex items-center gap-2"><Database className={`h-3.5 w-3.5 ${cogTone(cog.status)}`} strokeWidth={1.5} /><strong className="text-[8px]">{cog.label}</strong><span className={`ml-auto text-[6px] font-semibold ${cogTone(cog.status)}`}>{cog.status}</span></div><p className="mt-2 truncate text-[7px] text-muted">{cog.source} · {timeAgo(cog.asOf, currentTime)}</p><p className="mt-1 text-[7px] leading-3 text-muted">{cog.detail}</p></div>) : <EmptyRow>No data-cog receipt exists.</EmptyRow>}</div>
            </Panel>
          </div>

          <footer className="mt-2.5 flex flex-wrap items-center gap-3 border border-border bg-panel px-3 py-2 text-[7px] text-muted"><span className="flex items-center gap-1.5"><FileCheck2 className="h-3 w-3" /> {currentSnapshot?.receipt.repository ?? "VPS repository"}</span><span className="flex items-center gap-1.5"><Activity className="h-3 w-3" /> {currentSnapshot?.receipt.commit ? currentSnapshot.receipt.commit.slice(0, 12) : "no commit receipt"}</span><span className="flex items-center gap-1.5"><Clock3 className="h-3 w-3" /> Plan due 09:00 New York · wake 09:30</span><span className="ml-auto flex items-center gap-1.5"><Eye className="h-3 w-3" /> Location + audit + enforced risk · not prediction</span></footer>
        </div>
      </div>
    </main>
  );
}
