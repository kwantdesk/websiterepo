"use client";

import KwantSelect from "@/components/ui/KwantSelect";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BarChart3, Bot, CheckCircle2, Clock3, PlayCircle, SlidersHorizontal } from "lucide-react";
import { SectionCard } from "@/components/automation/AutomationPrimitives";
import { automations } from "@/components/automation/automationData";
import {
  appendJournalEvent,
  createBotId,
  createJournalId,
  loadSavedStrategiesRaw,
  loadAutomationBots,
  normalizeSavedStrategies,
  runtimeModeLabels,
  upsertAutomationBot,
  type AutomationBotDraft,
  type AutomationBotRuntime,
  type RuntimeMode,
  type StrategyDraft,
  type StrategyVersionBacktestEvidence,
  type StrategyVersionLearningNote,
} from "@/lib/automation";
import { getStrategyRuntimeProfileByIdOrSlug, strategyRuntimeProfiles } from "@/lib/automationProfiles";
import { buildChartBacktestHref, inferStrategyMetadata, strategyLaunchInstruments } from "@/lib/strategyMetadata";

type StrategyVersionOption = {
  strategyId: string;
  version: number;
  versionLabel: string;
  timestampLabel: string;
  backtestEvidence?: StrategyVersionBacktestEvidence;
  backtestHistory?: StrategyVersionBacktestEvidence[];
  learningJournal?: StrategyVersionLearningNote[];
};

type AutomationPreset = (typeof automations)[number];

function parseStrategyVersions(raw: string | null): StrategyVersionOption[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as StrategyDraft[];
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((strategy) => {
      const fallbackTimestamp = strategy.updatedAt ?? strategy.createdAt ?? new Date().toISOString();
      const fallbackVersion = strategy.currentVersion ?? 1;
      const versions =
        strategy.versions && strategy.versions.length > 0
          ? strategy.versions
          : [{ code: strategy.code, timestamp: fallbackTimestamp, version: fallbackVersion }];

      return versions.map((version) => ({
        strategyId: strategy.id,
        version: version.version,
        versionLabel: `v${version.version}`,
        timestampLabel: new Date(version.timestamp).toLocaleDateString(),
        backtestEvidence: version.backtestEvidence,
        backtestHistory: version.backtestHistory,
        learningJournal: version.learningJournal,
      }));
    });
  } catch {
    return [];
  }
}

function money(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  const sign = value >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function percent(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  return `${value.toFixed(1)}%`;
}

function ratio(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--";
  if (value >= 900) return "999";
  return value.toFixed(2);
}

function evidenceStamp(value?: string) {
  if (!value) return "not run";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function brokerToAccountId(broker: string) {
  if (broker === "OANDA") return "oanda-demo";
  if (broker === "Tradovate Sim") return "tradovate-sim";
  return "paper-router";
}

function modeToRuntimeMode(mode: string): RuntimeMode {
  if (mode === "Live") return "live";
  if (mode === "Paper") return "paper";
  if (mode === "Standby") return "demo";
  return "paper";
}

function draftFromStrategy(strategy: StrategyDraft | undefined, current: AutomationBotDraft): AutomationBotDraft {
  if (!strategy) return current;
  const meta = inferStrategyMetadata(strategy);
  return {
    ...current,
    strategyId: strategy.id,
    accountId: meta.accountId,
    instrument: meta.instrument,
    timeframe: meta.timeframe,
  };
}

export default function AutomationStrategiesPage() {
  const [savedStrategies, setSavedStrategies] = useState<ReturnType<typeof normalizeSavedStrategies>>([]);
  const [rawStrategies, setRawStrategies] = useState<StrategyDraft[]>([]);
  const [strategyVersions, setStrategyVersions] = useState<StrategyVersionOption[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState("");
  const [selectedVersion, setSelectedVersion] = useState("1");
  const [selectedPresetName, setSelectedPresetName] = useState(automations[0]?.name ?? "");
  const [savedBots, setSavedBots] = useState<AutomationBotRuntime[]>([]);
  const [toast, setToast] = useState("");
  const [botDraft, setBotDraft] = useState<AutomationBotDraft>({
    strategyId: "",
    accountId: "tradovate-sim",
    instrument: "MNQ SEP26",
    timeframe: "5m",
    mode: "paper",
    status: "ready",
  });

  useEffect(() => {
    const raw = loadSavedStrategiesRaw();
    let parsedStrategies: StrategyDraft[] = [];
    try {
      const parsed = JSON.parse(raw || "[]") as StrategyDraft[];
      parsedStrategies = Array.isArray(parsed) ? parsed : [];
      setRawStrategies(parsedStrategies);
    } catch {
      setRawStrategies([]);
    }
    const next = normalizeSavedStrategies(raw);
    const versions = parseStrategyVersions(raw);
    setSavedStrategies(next);
    setStrategyVersions(versions);
    setSavedBots(loadAutomationBots());

    if (next.length > 0) {
      setSelectedStrategyId(next[0].id);
      const firstVersion = versions.find((item) => item.strategyId === next[0].id);
      if (firstVersion) {
        setSelectedVersion(String(firstVersion.version));
      }
      const firstRawStrategy = parsedStrategies.find((item) => item.id === next[0].id);
      setBotDraft((current) => draftFromStrategy(firstRawStrategy, current));
    } else if (automations[0]) {
      setBotDraft((current) => ({
        ...current,
        strategyId: getStrategyRuntimeProfileByIdOrSlug("open_drive_0945_v8")?.id ?? "open_drive_0945_v8",
        accountId: brokerToAccountId(automations[0].broker),
        instrument: automations[0].market,
        mode: modeToRuntimeMode(automations[0].mode),
      }));
    }
  }, []);

  const selectedStrategy = useMemo(
    () => savedStrategies.find((item) => item.id === selectedStrategyId) ?? null,
    [savedStrategies, selectedStrategyId]
  );
  const selectedRawStrategy = useMemo(
    () => rawStrategies.find((item) => item.id === selectedStrategyId) ?? null,
    [rawStrategies, selectedStrategyId]
  );
  const selectedRuntimeProfile = useMemo(
    () => (selectedStrategy ? getStrategyRuntimeProfileByIdOrSlug(selectedStrategy.id) : null),
    [selectedStrategy]
  );
  const selectedPreset = useMemo<AutomationPreset | null>(
    () => automations.find((item) => item.name === selectedPresetName) ?? automations[0] ?? null,
    [selectedPresetName]
  );
  const selectedPresetRuntimeProfile = useMemo(
    () =>
      selectedPreset?.name === "MNQ Open Drive V8"
        ? getStrategyRuntimeProfileByIdOrSlug("open_drive_0945_v8")
        : null,
    [selectedPreset]
  );
  const selectedStrategyVersions = useMemo(
    () => strategyVersions.filter((version) => version.strategyId === selectedStrategyId),
    [selectedStrategyId, strategyVersions]
  );
  const selectedVersionOption = useMemo(
    () =>
      selectedStrategyVersions.find((item) => String(item.version) === selectedVersion) ??
      selectedStrategyVersions[0] ??
      null,
    [selectedStrategyVersions, selectedVersion]
  );
  const selectedVersionEvidence = selectedVersionOption?.backtestEvidence;
  const selectedVersionHistory = selectedVersionOption?.backtestHistory ?? [];
  const selectedLearningJournal = selectedVersionOption?.learningJournal ?? [];

  useEffect(() => {
    if (selectedStrategyVersions.length > 0 && !selectedStrategyVersions.some((item) => String(item.version) === selectedVersion)) {
      setSelectedVersion(String(selectedStrategyVersions[0].version));
    }
  }, [selectedStrategyVersions, selectedVersion]);

  const activeDraftSource = useMemo(
    () =>
      selectedStrategy
        ? {
            id: selectedStrategy.id,
            name: selectedStrategy.name,
            language: selectedStrategy.language,
            versionLabel: selectedVersionOption?.versionLabel ?? selectedStrategy.currentVersionLabel,
            updatedLabel: selectedStrategy.updatedLabel,
            runtimeProfile: selectedRuntimeProfile,
            hasSavedVersions: selectedStrategyVersions.length > 0,
          }
        : selectedPreset
          ? {
              id: selectedPresetRuntimeProfile?.id ?? selectedPreset.name.toLowerCase().replace(/\s+/g, "_"),
              name: selectedPreset.name,
              language: "Runtime preset",
              versionLabel: "V8 / calibrated",
              updatedLabel: selectedPreset.lastEvent,
              runtimeProfile: selectedPresetRuntimeProfile,
              hasSavedVersions: false,
            }
          : null,
    [selectedPreset, selectedPresetRuntimeProfile, selectedRuntimeProfile, selectedStrategy, selectedStrategyVersions.length, selectedVersionOption]
  );

  function setMode(mode: RuntimeMode) {
    setBotDraft((current) => ({ ...current, mode }));
  }

  function saveBot(status: AutomationBotRuntime["status"]) {
    if (!activeDraftSource) return;

    const now = new Date().toISOString();
    const bot: AutomationBotRuntime = {
      id: createBotId(),
      strategyId: activeDraftSource.id,
      strategyName: activeDraftSource.name,
      accountId: botDraft.accountId,
      instrument: botDraft.instrument,
      timeframe: botDraft.timeframe,
      mode: botDraft.mode,
      status,
      createdAt: now,
      updatedAt: now,
    };

    const nextBots = upsertAutomationBot(bot);
    setSavedBots(nextBots);

    appendJournalEvent({
      id: createJournalId(),
      time: now,
      bot: bot.strategyName,
      action: status === "armed" ? "Bot armed" : "Bot draft saved",
      reason: `${bot.instrument} | ${runtimeModeLabels[bot.mode]} | ${bot.accountId}`,
      level: status === "armed" ? "success" : "info",
    });

    setToast(status === "armed" ? "Bot armed for automation" : "Bot draft saved");
    window.setTimeout(() => setToast(""), 1800);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <SectionCard eyebrow="Runtime" title="Strategy Attach & Run">
        <div className="space-y-3">
          {savedStrategies.length > 0 && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Saved Strategies</div>
              <div className="mt-3 grid gap-3">
                {savedStrategies.map((strategy) => (
                  <button
                    key={strategy.id}
                    onClick={() => {
                      setSelectedStrategyId(strategy.id);
                      const firstVersion = strategyVersions.find((item) => item.strategyId === strategy.id);
                      if (firstVersion) {
                        setSelectedVersion(String(firstVersion.version));
                      }
                      const rawStrategy = rawStrategies.find((item) => item.id === strategy.id);
                      setBotDraft((current) => draftFromStrategy(rawStrategy, current));
                      setSelectedPresetName("");
                    }}
                    className={`rounded-2xl border p-4 text-left transition-colors ${
                      selectedStrategyId === strategy.id
                        ? "border-primary/40 bg-primary/10"
                        : "border-border bg-surface/60 hover:bg-surface"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[14px] font-semibold text-foreground">{strategy.name}</div>
                        <div className="mt-1 text-[12px] text-muted">
                          {strategy.language} | {strategy.currentVersionLabel} | updated {strategy.updatedLabel}
                        </div>
                      </div>
                      <div className="text-[12px] text-muted">{strategy.totalPnlLabel}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {automations.map((item) => {
            const runtimeProfile = getStrategyRuntimeProfileByIdOrSlug(item.name === "MNQ Open Drive V8" ? "open_drive_0945_v8" : "");
            return (
            <div key={item.name} className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[14px] font-semibold text-foreground">{item.name}</div>
                  <div className="mt-1 text-[12px] text-muted">
                    {item.market} | {item.broker} | {item.mode}
                  </div>
                </div>
                <div className={`rounded-full border border-border px-3 py-1 text-[11px] font-medium ${item.stateTone}`}>
                  {item.state}
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                {[
                  { icon: Bot, label: "Version", value: "V8 / calibrated" },
                  { icon: SlidersHorizontal, label: "Threshold", value: "0.62 long / 0.58 short" },
                  { icon: Clock3, label: "Schedule", value: "09:30 to 11:30 ET" },
                  { icon: PlayCircle, label: "Attach", value: "Chart + account binding" },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="rounded-xl border border-border bg-panel px-3 py-3">
                    <div className="flex items-center gap-2 text-muted">
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">{label}</span>
                    </div>
                    <div className="mt-3 text-[13px] text-foreground">{value}</div>
                  </div>
                ))}
              </div>
              {runtimeProfile ? (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => {
                      setSelectedPresetName(item.name);
                      setSelectedStrategyId("");
                      setSelectedVersion("1");
                      setBotDraft((current) => ({
                        ...current,
                        strategyId: runtimeProfile.id,
                        accountId: brokerToAccountId(item.broker),
                        instrument: item.market,
                        mode: modeToRuntimeMode(item.mode),
                      }));
                    }}
                    className="mr-2 inline-flex items-center gap-2 rounded-xl border border-border bg-panel px-3 py-2 text-[12px] font-medium text-foreground transition-colors hover:bg-surface"
                  >
                    Use Strategy
                  </button>
                  <Link
                    href={`/automation/strategies/${runtimeProfile.slug}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-[12px] font-medium text-primary transition-colors hover:bg-primary/15"
                  >
                    Open Runtime
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : null}
            </div>
          )})}
        </div>
      </SectionCard>

      <SectionCard eyebrow="Attach" title="Automation Draft">
        <div className="space-y-4">
          {activeDraftSource ? (
            <>
              <div className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Selected Strategy</div>
                <div className="mt-3 text-[15px] font-semibold text-foreground">{activeDraftSource.name}</div>
                <div className="mt-1 text-[12px] text-muted">
                  {activeDraftSource.language} | {activeDraftSource.versionLabel} | updated {activeDraftSource.updatedLabel}
                </div>
                {activeDraftSource.hasSavedVersions ? (
                  <label className="mt-4 block">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Version</div>
                    <KwantSelect
                      value={selectedVersion}
                      onChange={(event) => setSelectedVersion(event.target.value)}
                      className="mt-3 w-full rounded-xl border border-border bg-panel px-3 py-2 text-[13px] text-foreground outline-none"
                    >
                      {selectedStrategyVersions.map((version) => (
                        <option key={`${version.strategyId}-${version.version}`} value={String(version.version)}>
                          {version.versionLabel} | saved {version.timestampLabel}
                        </option>
                      ))}
                    </KwantSelect>
                  </label>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-border bg-panel px-4 py-3 text-[12px] text-muted">
                    This strategy is currently using the built-in runtime preset. Save it from the strategy builder to unlock version history and direct backtest population.
                  </div>
                )}
                {selectedRawStrategy?.strategyDossier ? (
                  <div className="mt-4 rounded-xl border border-border bg-panel p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Strategy Dossier</div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5 text-[12px] leading-6 text-muted">
                        <p><span className="text-foreground">Intent:</span> {selectedRawStrategy.strategyDossier.builderIntent ?? "Not captured"}</p>
                        <p><span className="text-foreground">Summary:</span> {selectedRawStrategy.strategyDossier.intakeSummary ?? "Not captured"}</p>
                        <p><span className="text-foreground">Instrument:</span> {selectedRawStrategy.strategyDossier.blueprint?.instrument ?? inferStrategyMetadata(selectedRawStrategy).instrument}</p>
                        <p><span className="text-foreground">Timeframe:</span> {selectedRawStrategy.strategyDossier.blueprint?.timeframe ?? inferStrategyMetadata(selectedRawStrategy).timeframe}</p>
                        <p><span className="text-foreground">Direction:</span> {selectedRawStrategy.strategyDossier.blueprint?.direction ?? "Unspecified"}</p>
                      </div>
                      <div className="space-y-1.5 text-[12px] leading-6 text-muted">
                        <p><span className="text-foreground">Entry model:</span> {selectedRawStrategy.strategyDossier.blueprint?.entryModel ?? "Not captured"}</p>
                        <p><span className="text-foreground">Risk model:</span> {selectedRawStrategy.strategyDossier.blueprint?.riskModel ?? "Not captured"}</p>
                        <p><span className="text-foreground">Stop / target:</span> {(selectedRawStrategy.strategyDossier.blueprint?.stopModel ?? "Not captured")} / {(selectedRawStrategy.strategyDossier.blueprint?.targetModel ?? "Not captured")}</p>
                        <p><span className="text-foreground">Verification:</span> {selectedRawStrategy.strategyDossier.verification?.passed ? "Passed runtime contract" : "Needs review"}</p>
                        <p><span className="text-foreground">Quality:</span> {selectedRawStrategy.strategyDossier.blueprint?.qualityNotes?.length ? selectedRawStrategy.strategyDossier.blueprint.qualityNotes.join(", ") : "Not captured"}</p>
                        <p><span className="text-foreground">Next test:</span> {selectedRawStrategy.strategyDossier.blueprint?.validationPlan?.length ? selectedRawStrategy.strategyDossier.blueprint.validationPlan.join(", ") : "Not captured"}</p>
                        <p><span className="text-foreground">Research:</span> {selectedRawStrategy.strategyDossier.research?.summary ?? "Not captured"}</p>
                        <p><span className="text-foreground">Critic:</span> {selectedRawStrategy.strategyDossier.critic?.summary ?? "Not captured"}</p>
                        <p><span className="text-foreground">Critic next:</span> {selectedRawStrategy.strategyDossier.critic?.nextExperiment ?? "Not captured"}</p>
                        <p><span className="text-foreground">Last improvement goal:</span> {selectedRawStrategy.strategyDossier.lastImprovementGoal ?? "None recorded"}</p>
                      </div>
                    </div>
                  </div>
                ) : null}
                {selectedVersionOption ? (
                  <div className="mt-4 rounded-xl border border-border bg-panel p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Backtest Evidence</div>
                      <div className="text-[11px] text-muted">
                        {selectedVersionEvidence
                          ? `${selectedVersionEvidence.instrument} | ${selectedVersionEvidence.timeframe} | ${evidenceStamp(selectedVersionEvidence.capturedAt)}`
                          : "No run attached"}
                      </div>
                    </div>
                    {selectedVersionEvidence ? (
                      <>
                        <div className="mt-3 grid gap-3 md:grid-cols-4">
                          {[
                            { label: "Net PnL", value: money(selectedVersionEvidence.totalPnL), tone: selectedVersionEvidence.totalPnL >= 0 ? "text-primary" : "text-danger" },
                            { label: "Win Rate", value: percent(selectedVersionEvidence.winRate), tone: "text-foreground" },
                            { label: "Profit Factor", value: ratio(selectedVersionEvidence.profitFactor), tone: "text-foreground" },
                            { label: "Max DD", value: money(-Math.abs(selectedVersionEvidence.maxDrawdown)), tone: "text-danger" },
                          ].map((item) => (
                            <div key={item.label} className="rounded-xl border border-border bg-surface/60 px-3 py-3">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">{item.label}</div>
                              <div className={`mt-2 text-[14px] font-semibold ${item.tone}`}>{item.value}</div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted">
                          <span className="rounded-full border border-border bg-surface/60 px-3 py-1">{selectedVersionEvidence.totalTrades} trades</span>
                          <span className="rounded-full border border-border bg-surface/60 px-3 py-1">{selectedVersionEvidence.rangeLabel ?? "saved range"}</span>
                          {typeof selectedVersionEvidence.sharpeRatio === "number" ? (
                            <span className="rounded-full border border-border bg-surface/60 px-3 py-1">Sharpe {ratio(selectedVersionEvidence.sharpeRatio)}</span>
                          ) : null}
                        </div>
                        {selectedVersionHistory.length > 1 ? (
                          <div className="mt-4">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Recent Evidence Trail</div>
                            <div className="mt-2 space-y-2">
                              {selectedVersionHistory.slice(0, 3).map((run) => (
                                <div key={run.runId ?? run.capturedAt} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface/50 px-3 py-2 text-[11px] text-muted">
                                  <span>{evidenceStamp(run.capturedAt)} | {run.instrument} {run.timeframe}</span>
                                  <span className={run.totalPnL >= 0 ? "text-primary" : "text-danger"}>{money(run.totalPnL)} | WR {percent(run.winRate)} | PF {ratio(run.profitFactor)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {selectedLearningJournal.length ? (
                          <div className="mt-4 rounded-xl border border-border bg-surface/50 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Learning Journal</div>
                              <div className="text-[11px] text-muted">
                                {selectedLearningJournal[0].verdict.replace("_", " ")} | score {selectedLearningJournal[0].score}
                              </div>
                            </div>
                            <p className="mt-2 text-[12px] leading-6 text-muted">{selectedLearningJournal[0].summary}</p>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <div>
                                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Good</div>
                                <div className="mt-1 space-y-1 text-[12px] leading-5 text-muted">
                                  {(selectedLearningJournal[0].strengths.length ? selectedLearningJournal[0].strengths : ["No strong evidence logged yet."]).slice(0, 3).map((item) => <p key={item}>{item}</p>)}
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-danger">Worries</div>
                                <div className="mt-1 space-y-1 text-[12px] leading-5 text-muted">
                                  {(selectedLearningJournal[0].worries.length ? selectedLearningJournal[0].worries : ["No major warning logged yet."]).slice(0, 3).map((item) => <p key={item}>{item}</p>)}
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 rounded-lg border border-border bg-panel px-3 py-2 text-[12px] leading-5 text-muted">
                              <span className="text-foreground">Next:</span> {selectedLearningJournal[0].nextExperiment}
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="mt-3 rounded-xl border border-dashed border-border bg-surface/40 px-4 py-3 text-[12px] leading-6 text-muted">
                        Run this saved version in Backtests to attach performance evidence before arming it for automation.
                      </div>
                    )}
                  </div>
                ) : null}
                {activeDraftSource.runtimeProfile || selectedVersionOption ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedVersionOption ? (
                      <Link
                        href={buildChartBacktestHref({
                          strategyId: activeDraftSource.id,
                          version: selectedVersionOption.version,
                          instrument: botDraft.instrument,
                          timeframe: botDraft.timeframe,
                          autoRun: false,
                        })}
                        className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-[12px] font-medium text-primary transition-colors hover:bg-primary/15"
                      >
                        Open On Chart
                        <BarChart3 className="h-4 w-4" />
                      </Link>
                    ) : activeDraftSource.runtimeProfile ? (
                      <Link
                        href={buildChartBacktestHref({
                          instrument: botDraft.instrument,
                          timeframe: botDraft.timeframe,
                          autoRun: false,
                        })}
                        className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-[12px] font-medium text-primary transition-colors hover:bg-primary/15"
                      >
                        Open On Chart
                        <BarChart3 className="h-4 w-4" />
                      </Link>
                    ) : null}
                    {activeDraftSource.runtimeProfile ? (
                      <Link
                        href={`/automation/strategies/${activeDraftSource.runtimeProfile.slug}`}
                        className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-[12px] font-medium text-primary transition-colors hover:bg-primary/15"
                      >
                        Open Strategy Runtime Page
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="rounded-2xl border border-border bg-surface/60 p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Account</div>
                  <KwantSelect
                    value={botDraft.accountId}
                    onChange={(event) => setBotDraft((current) => ({ ...current, accountId: event.target.value }))}
                    className="mt-3 w-full rounded-xl border border-border bg-panel px-3 py-2 text-[13px] text-foreground outline-none"
                  >
                    <option value="tradovate-sim">Tradovate Sim</option>
                    <option value="oanda-demo">OANDA Demo</option>
                    <option value="paper-router">Paper Router</option>
                  </KwantSelect>
                </label>

                <label className="rounded-2xl border border-border bg-surface/60 p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Instrument</div>
                  <KwantSelect
                    value={botDraft.instrument}
                    onChange={(event) => setBotDraft((current) => ({ ...current, instrument: event.target.value }))}
                    className="mt-3 w-full rounded-xl border border-border bg-panel px-3 py-2 text-[13px] text-foreground outline-none"
                  >
                    {strategyLaunchInstruments.map((instrument) => (
                      <option key={instrument} value={instrument}>
                        {instrument}
                      </option>
                    ))}
                  </KwantSelect>
                </label>

                <label className="rounded-2xl border border-border bg-surface/60 p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Timeframe</div>
                  <KwantSelect
                    value={botDraft.timeframe}
                    onChange={(event) => setBotDraft((current) => ({ ...current, timeframe: event.target.value }))}
                    className="mt-3 w-full rounded-xl border border-border bg-panel px-3 py-2 text-[13px] text-foreground outline-none"
                  >
                    <option value="1m">1m</option>
                    <option value="5m">5m</option>
                    <option value="15m">15m</option>
                    <option value="1h">1h</option>
                  </KwantSelect>
                </label>

                <div className="rounded-2xl border border-border bg-surface/60 p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Mode</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(["replay", "demo", "paper", "forward_test", "live"] as RuntimeMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setMode(mode)}
                        className={`rounded-xl px-3 py-2 text-[12px] font-medium transition-colors ${
                          botDraft.mode === mode
                            ? "bg-primary/10 text-primary"
                            : "border border-border bg-panel text-muted hover:text-foreground"
                        }`}
                      >
                        {runtimeModeLabels[mode]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-border bg-panel p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Current Draft</div>
                <div className="mt-3 text-[13px] leading-6 text-foreground">
                  {activeDraftSource.name} {" -> "} {botDraft.instrument} {" -> "} {botDraft.accountId} {" -> "} {runtimeModeLabels[botDraft.mode]}
                </div>
                <div className="mt-2 text-[12px] text-muted">
                  This is the shell that will later be backed by real runtime creation, bot attachment, and execution services.
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => saveBot("ready")}
                    className="rounded-xl border border-border bg-surface px-4 py-2 text-[12px] font-medium text-foreground"
                  >
                    Save Bot Draft
                  </button>
                  <button
                    onClick={() => saveBot("armed")}
                    className="rounded-xl bg-primary px-4 py-2 text-[12px] font-semibold text-background"
                  >
                    Arm Bot
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Saved Bots</div>
                <div className="mt-3 space-y-2">
                  {savedBots.length > 0 ? (
                    savedBots.map((bot) => (
                      <div key={bot.id} className="rounded-xl border border-border bg-panel px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[13px] font-semibold text-foreground">{bot.strategyName}</div>
                          <div className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-primary">
                            {bot.status}
                          </div>
                        </div>
                        <div className="mt-2 text-[12px] text-muted">
                          {bot.instrument} | {runtimeModeLabels[bot.mode]} | {bot.accountId}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-panel px-4 py-5 text-[12px] text-muted">
                      No automation bots saved yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">Runtime Pages</div>
                <div className="mt-3 space-y-2">
                  {strategyRuntimeProfiles.map((profile) => (
                    <Link
                      key={profile.id}
                      href={`/automation/strategies/${profile.slug}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-panel px-4 py-3 transition-colors hover:bg-surface"
                    >
                      <div>
                        <div className="text-[13px] font-semibold text-foreground">{profile.label}</div>
                        <div className="mt-1 text-[12px] text-muted">
                          {profile.market} | {profile.version} | imported runtime view
                        </div>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-primary" />
                    </Link>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-panel px-6 py-10 text-center">
              <div className="text-[14px] font-semibold text-foreground">No saved strategies found yet</div>
              <div className="mt-2 text-[12px] text-muted">
                Build or save a strategy from the chart strategy builder, then it will appear here for automation setup.
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-primary/20 bg-panel px-4 py-3 text-[13px] text-primary shadow-2xl shadow-black/40">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
