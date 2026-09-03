"use client";

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AppSidebar from "@/components/AppSidebar";
import {
  loadAutomationBacktest,
  loadSavedStrategiesRaw,
  saveSavedStrategiesRaw,
  type StrategyDraftDossier,
  type StrategyVersionRecord,
  type AutomationBacktestSnapshot,
} from "@/lib/automation";
import {
  LOCAL_STRATEGY_BUILDER_ACCOUNT_ID,
  createStrategyBuilderThread,
  loadStrategyBuilderWorkspace,
  saveStrategyBuilderWorkspace,
  updateStrategyBuilderThread,
  type StrategyBuilderMode,
  type StrategyBuilderThread,
} from "@/lib/strategyBuilder";
import { createClient } from "@/lib/supabase";
import {
  formatAttachmentProfilesForPrompt,
  profileStrategyBuilderFile,
  type StrategyBuilderAttachmentProfile,
} from "@/lib/strategyBuilderAttachments";
import { buildChartBacktestHref, buildInferredStrategyDossier, inferStrategyMetadata } from "@/lib/strategyMetadata";
import type { UsageSnapshot } from "@/lib/usagePlans";
import {
  ArrowUp,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FlaskConical,
  Folder,
  FolderPlus,
  FolderGit2,
  GitBranch,
  Menu,
  Mic,
  Minus,
  MoreHorizontal,
  PanelLeft,
  Paperclip,
  Play,
  Plus,
  Repeat,
  Search,
  Settings,
  Sparkles,
  Square,
  Star,
  Store,
  Trophy,
  User,
  Wallet,
  X,
} from "lucide-react";

type ImprovementMeta = {
  goal: ImprovementGoal;
  previousCode: string;
};

type StrategyChangeSummary = {
  title: string;
  bullets: string[];
};

type StrategyComparisonStats = {
  previousName: string;
  nextName: string;
  previousLines: number;
  nextLines: number;
  previousLongs: number;
  nextLongs: number;
  previousShorts: number;
  nextShorts: number;
};

type BuilderIntent = "clarify" | "build" | "improve" | "out_of_scope";

type StrategyBlueprint = {
  strategyName: string;
  objective: string;
  instrument: string;
  timeframe: string;
  direction: "long" | "short" | "both" | "unspecified";
  maxTradesPerDay: string;
  sessionFilter: string;
  entryModel: string;
  entryTriggers: string[];
  confirmationFilters: string[];
  stopModel: string;
  targetModel: string;
  riskModel: string;
  noGoConditions: string[];
  propConstraints: string[];
  qualityNotes?: string[];
  validationPlan?: string[];
  improvementGoal: string;
  outputLanguage: string;
};

type IntakeResult = {
  decision: BuilderIntent;
  summary: string;
  missingInfo: string[];
  questions: string[];
  researchNeeded?: boolean;
  researchTopics?: string[];
  reason: string;
};

type ResearchBrief = {
  needed: boolean;
  summary: string;
  facts: string[];
  assumptions: string[];
  openQuestions: string[];
  strategyImplications: string[];
  sources: string[];
};

type VerificationResult = {
  passed: boolean;
  issues: string[];
  warnings: string[];
  code: string | null;
};

type StrategyCriticResult = {
  passed: boolean;
  score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  failureModes: string[];
  nextExperiment: string;
  automationReadiness: "not_ready" | "backtest_first" | "paper_only" | "ready_for_paper";
};

type BuilderAction = {
  id: string;
  label: string;
  description: string;
  kind: "save_strategy" | "run_backtest" | "improve_from_evidence" | "attach_automation" | "review_issues";
  priority: "high" | "medium" | "low";
};

type Message = {
  role: "user" | "assistant";
  content: string;
  meta?: {
    improvement?: ImprovementMeta;
    changeSummary?: StrategyChangeSummary | null;
    intake?: IntakeResult;
    research?: ResearchBrief | null;
    blueprint?: StrategyBlueprint;
    verification?: VerificationResult;
    critic?: StrategyCriticResult | null;
    actions?: BuilderAction[];
    attachments?: StrategyBuilderAttachmentProfile[];
  };
};
type Chat = { id: string; title: string; preview: string; date: string };

const TYPEWRITER_CHUNK_SIZE = 3;
const TYPEWRITER_DELAY_MS = 14;

function getTypewriterPlan(content: string) {
  const hasCode = content.includes("```");
  if (hasCode || content.length > 2400) {
    return { chunkSize: 48, delayMs: 5 };
  }
  if (content.length > 1200) {
    return { chunkSize: 18, delayMs: 8 };
  }
  return { chunkSize: TYPEWRITER_CHUNK_SIZE, delayMs: TYPEWRITER_DELAY_MS };
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

type ImprovementGoal =
  | "general"
  | "win_rate"
  | "drawdown"
  | "trade_count"
  | "profit_factor"
  | "prop_safety"
  | "live_robustness";
type SavedStrategy = {
  id: string;
  name: string;
  code: string;
  language: string;
  versions: StrategyVersionRecord[];
  currentVersion: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  strategyDossier?: StrategyDraftDossier;
};

const PENDING_BUILDER_ANALYSIS_KEY = "strategy-builder-pending-analysis";
const BUILDER_WORKSPACE_CONTEXT_KEY = "kwantify-strategy-builder-workspace-context";

type BuilderWorkspaceContext = {
  type: "none" | "github";
  label: string;
};

function toChatItems(threads: StrategyBuilderThread[]): Chat[] {
  return [...threads]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((thread) => ({
      id: thread.id,
      title: thread.title,
      preview: thread.preview,
      date: new Date(thread.updatedAt).toLocaleDateString(),
    }));
}

function sortThreadsNewestFirst(threads: StrategyBuilderThread[]) {
  return [...threads].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function Sidebar() {
  return <AppSidebar activeItem="ai" />;
}

function getStrategyName(code: string) {
  return code.match(/\/\/\s*Strategy:\s*(.+)/)?.[1]?.trim() || "Untitled Strategy";
}

function formatEvidenceForContext(version?: StrategyVersionRecord) {
  const evidence = version?.backtestEvidence;
  if (!evidence) return "no version evidence yet";
  const net = `${evidence.totalPnL >= 0 ? "+" : "-"}$${Math.abs(evidence.totalPnL).toFixed(2)}`;
  return `${evidence.instrument} ${evidence.timeframe}, ${evidence.totalTrades} trades, WR ${evidence.winRate.toFixed(2)}%, PF ${evidence.profitFactor.toFixed(2)}, net ${net}, max DD ${Math.abs(evidence.maxDrawdown).toFixed(2)}`;
}

function extractCodeBlock(content: string) {
  const match = content.match(/```(?:\w+)?\s*([\s\S]*?)```/);
  return match?.[1]?.trim() ?? null;
}

function countMatches(source: string, pattern: RegExp) {
  return (source.match(pattern) || []).length;
}

function summarizeStrategyChanges(
  previousCode: string,
  nextContent: string,
  goal: ImprovementGoal,
): StrategyChangeSummary {
  const nextCode = extractCodeBlock(nextContent);
  const title = `Improvement target: ${getImprovementGoalLabel(goal)}`;

  if (!nextCode) {
    return {
      title,
      bullets: [
        "The builder returned analysis but no fresh code block yet.",
        "Run another pass after API billing is active so we can compare the strategy logic properly.",
      ],
    };
  }

  const previousName = getStrategyName(previousCode);
  const nextName = getStrategyName(nextCode);
  const previousLines = previousCode.split("\n");
  const nextLines = nextCode.split("\n");
  const changedLineCount = nextLines.reduce((count, line, index) => {
    return count + (line !== previousLines[index] ? 1 : 0);
  }, Math.abs(nextLines.length - previousLines.length));

  const bullets: string[] = [];

  if (previousName !== nextName) {
    bullets.push(`Strategy identity changed from "${previousName}" to "${nextName}".`);
  } else {
    bullets.push(`Strategy identity stayed on "${nextName}".`);
  }

  bullets.push(
    changedLineCount > 0
      ? `Roughly ${changedLineCount} code lines changed in this iteration.`
      : "The code structure barely changed, so this pass is mostly explanation or parameter polish.",
  );

  const previousLongs = countMatches(previousCode, /action:\s*"LONG"/g);
  const nextLongs = countMatches(nextCode, /action:\s*"LONG"/g);
  const previousShorts = countMatches(previousCode, /action:\s*"SHORT"/g);
  const nextShorts = countMatches(nextCode, /action:\s*"SHORT"/g);
  if (previousLongs !== nextLongs || previousShorts !== nextShorts) {
    bullets.push(
      `Directional logic shifted from ${previousLongs} long / ${previousShorts} short signal branches to ${nextLongs} long / ${nextShorts} short branches.`,
    );
  }

  const previousSession = /getSession\s*\(/.test(previousCode);
  const nextSession = /getSession\s*\(/.test(nextCode);
  if (previousSession !== nextSession) {
    bullets.push(nextSession ? "A session filter was added to tighten when trades are allowed." : "A session filter was removed to open the strategy up across more market hours.");
  }

  const previousAtr = /atr14/.test(previousCode);
  const nextAtr = /atr14/.test(nextCode);
  if (previousAtr !== nextAtr) {
    bullets.push(nextAtr ? "ATR-based risk logic was added for more adaptive stops or targets." : "ATR-based risk logic was removed or replaced.");
  }

  const previousRiskValues = Array.from(previousCode.matchAll(/riskPercent:\s*([0-9.]+)/g)).map((match) => match[1]);
  const nextRiskValues = Array.from(nextCode.matchAll(/riskPercent:\s*([0-9.]+)/g)).map((match) => match[1]);
  if (previousRiskValues.join(",") !== nextRiskValues.join(",")) {
    bullets.push(
      `Risk sizing changed from ${previousRiskValues.join(", ") || "no explicit values found"} to ${nextRiskValues.join(", ") || "no explicit values found"}.`,
    );
  }

  if (!bullets.some((bullet) => bullet.toLowerCase().includes("risk")) && /stopLoss|takeProfit/.test(nextCode)) {
    bullets.push("Stop-loss and take-profit logic are still present, so the strategy remains backtester-compatible after the rewrite.");
  }

  return { title, bullets: bullets.slice(0, 5) };
}

function buildStrategyComparisonStats(previousCode: string, nextContent: string): StrategyComparisonStats | null {
  const nextCode = extractCodeBlock(nextContent);
  if (!nextCode) {
    return null;
  }

  return {
    previousName: getStrategyName(previousCode),
    nextName: getStrategyName(nextCode),
    previousLines: previousCode.split("\n").length,
    nextLines: nextCode.split("\n").length,
    previousLongs: countMatches(previousCode, /action:\s*"LONG"/g),
    nextLongs: countMatches(nextCode, /action:\s*"LONG"/g),
    previousShorts: countMatches(previousCode, /action:\s*"SHORT"/g),
    nextShorts: countMatches(nextCode, /action:\s*"SHORT"/g),
  };
}

function getImprovementGoalLabel(goal: ImprovementGoal) {
  switch (goal) {
    case "win_rate":
      return "Improve win rate";
    case "drawdown":
      return "Reduce drawdown";
    case "trade_count":
      return "Reduce trades";
    case "profit_factor":
      return "Improve profit factor";
    case "prop_safety":
      return "Make it prop-firm safer";
    case "live_robustness":
      return "Make it more robust live";
    default:
      return "General improvement";
  }
}

function buildStrategyDossier(options: {
  intake?: IntakeResult;
  research?: ResearchBrief | null;
  blueprint?: StrategyBlueprint;
  verification?: VerificationResult;
  critic?: StrategyCriticResult | null;
  improvement?: ImprovementMeta;
  currentThreadId?: string | null;
}): StrategyDraftDossier {
  return {
    source: "ai_builder",
    sourceThreadId: options.currentThreadId ?? null,
    savedFromMessageAt: new Date().toISOString(),
    builderIntent: options.intake?.decision,
    intakeSummary: options.intake?.summary,
    missingInfo: options.intake?.missingInfo ?? [],
    blueprint: options.blueprint
      ? {
          strategyName: options.blueprint.strategyName,
          objective: options.blueprint.objective,
          instrument: options.blueprint.instrument,
          timeframe: options.blueprint.timeframe,
          direction: options.blueprint.direction,
          maxTradesPerDay: options.blueprint.maxTradesPerDay,
          sessionFilter: options.blueprint.sessionFilter,
          entryModel: options.blueprint.entryModel,
          entryTriggers: options.blueprint.entryTriggers,
          confirmationFilters: options.blueprint.confirmationFilters,
          stopModel: options.blueprint.stopModel,
          targetModel: options.blueprint.targetModel,
          riskModel: options.blueprint.riskModel,
          noGoConditions: options.blueprint.noGoConditions,
          propConstraints: options.blueprint.propConstraints,
          qualityNotes: options.blueprint.qualityNotes ?? [],
          validationPlan: options.blueprint.validationPlan ?? [],
          improvementGoal: options.blueprint.improvementGoal,
          outputLanguage: options.blueprint.outputLanguage,
        }
      : undefined,
    verification: options.verification
      ? {
          passed: options.verification.passed,
          warnings: options.verification.warnings,
          issues: options.verification.issues,
        }
      : undefined,
    research: options.research
      ? {
          needed: options.research.needed,
          summary: options.research.summary,
          facts: options.research.facts,
          assumptions: options.research.assumptions,
          openQuestions: options.research.openQuestions,
          strategyImplications: options.research.strategyImplications,
          sources: options.research.sources,
        }
      : undefined,
    critic: options.critic
      ? {
          passed: options.critic.passed,
          score: options.critic.score,
          summary: options.critic.summary,
          strengths: options.critic.strengths,
          weaknesses: options.critic.weaknesses,
          failureModes: options.critic.failureModes,
          nextExperiment: options.critic.nextExperiment,
          automationReadiness: options.critic.automationReadiness,
        }
      : undefined,
    lastImprovementGoal: options.improvement ? getImprovementGoalLabel(options.improvement.goal) : undefined,
  };
}

function buildBacktestImprovementPrompt(
  code: string,
  snapshot: AutomationBacktestSnapshot,
  goal: ImprovementGoal,
) {
  const longSummary = snapshot.longTrades
    ? `Long side -> trades: ${snapshot.longTrades.totalTrades}, win rate: ${snapshot.longTrades.winRate.toFixed(2)}%, PF: ${snapshot.longTrades.profitFactor.toFixed(2)}, net PnL: ${snapshot.longTrades.totalPnL.toFixed(2)}`
    : "Long side summary unavailable";
  const shortSummary = snapshot.shortTrades
    ? `Short side -> trades: ${snapshot.shortTrades.totalTrades}, win rate: ${snapshot.shortTrades.winRate.toFixed(2)}%, PF: ${snapshot.shortTrades.profitFactor.toFixed(2)}, net PnL: ${snapshot.shortTrades.totalPnL.toFixed(2)}`
    : "Short side summary unavailable";
  const recentTrades = snapshot.trades
    .slice(-5)
    .map(
      (trade, index) =>
        `${index + 1}. ${trade.direction} | pnl ${trade.pnlPoints.toFixed(2)} | r ${trade.rMultiple.toFixed(2)} | duration ${trade.durationBars} bars | result ${trade.result}`,
    )
    .join("\n");
  const goalLabel = getImprovementGoalLabel(goal);

  return `Improve this Kwantify JavaScript trading strategy using the latest backtest results below.

Goals:
- keep the same general idea unless the data proves it is weak
- reduce obvious weakness and improve live robustness
- preserve Kwantify runtime compatibility
- explain what changed and why
- primary improvement goal: ${goalLabel}

Backtest summary:
- Strategy: ${snapshot.strategyName}${snapshot.strategyVersionLabel ? ` ${snapshot.strategyVersionLabel}` : ""}
- Instrument: ${snapshot.instrument}
- Timeframe: ${snapshot.timeframe}
- Total trades: ${snapshot.totalTrades}
- Win rate: ${snapshot.winRate.toFixed(2)}%
- Profit factor: ${snapshot.profitFactor.toFixed(2)}
- Net PnL: ${snapshot.totalPnL.toFixed(2)}
- Max drawdown: ${snapshot.maxDrawdown.toFixed(2)}
- Average R multiple: ${(snapshot.averageRMultiple ?? 0).toFixed(2)}
- Sharpe ratio: ${(snapshot.sharpeRatio ?? 0).toFixed(2)}
- Sortino ratio: ${(snapshot.sortinoRatio ?? 0).toFixed(2)}

Directional breakdown:
${longSummary}
${shortSummary}

Recent trade sample:
${recentTrades || "No trade sample available"}

Code to improve:
\`\`\`javascript
${code}
\`\`\`

Give me the full improved strategy code and then explain the changes, the edge, the risks, and what metric you targeted.`;
}

function CodeBlock({
  code,
  copied,
  onCopy,
  onSave,
  onRun,
  improvementMenuOpen,
  onToggleImproveMenu,
  onImprove,
}: {
  code: string;
  copied: boolean;
  onCopy: () => void;
  onSave: () => void;
  onRun: () => void;
  improvementMenuOpen: boolean;
  onToggleImproveMenu: () => void;
  onImprove: (goal: ImprovementGoal) => void;
}) {
  const improvementOptions: ImprovementGoal[] = [
    "general",
    "win_rate",
    "drawdown",
    "trade_count",
    "profit_factor",
    "prop_safety",
    "live_robustness",
  ];

  return (
    <div className="my-4">
      <div className="group relative overflow-hidden rounded-xl border border-border bg-background">
        <button onClick={onCopy} className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-muted opacity-0 transition group-hover:opacity-100">
          {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
        </button>
        <pre className="overflow-x-auto p-4 pr-14 font-mono text-[13px] leading-6">
          <code>{code.split("\n").map((line, i) => <span key={i} className={line.trim().startsWith("#") || line.trim().startsWith("//") ? "text-muted" : "text-primary/90"}>{line}{"\n"}</span>)}</code>
        </pre>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={onSave} className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-[12px] font-medium text-primary"><FolderPlus className="h-3.5 w-3.5" />Save to Strategies</button>
        <button onClick={onRun} className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-[12px] font-medium text-muted hover:text-foreground"><Play className="h-3.5 w-3.5 text-primary" />Run Backtest</button>
        <button onClick={onToggleImproveMenu} className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-[12px] font-medium text-muted hover:text-foreground"><Sparkles className="h-3.5 w-3.5 text-primary" />Improve from Latest Backtest</button>
      </div>
      {improvementMenuOpen ? (
        <div className="mt-3 rounded-xl border border-border bg-surface/60 p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Choose improvement goal</div>
          <div className="flex flex-wrap gap-2">
            {improvementOptions.map((goal) => (
              <button
                key={goal}
                onClick={() => onImprove(goal)}
                className="rounded-lg border border-border bg-panel px-3 py-2 text-[11px] font-medium text-muted transition hover:text-foreground"
              >
                {getImprovementGoalLabel(goal)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChangeSummaryCard({ summary }: { summary: StrategyChangeSummary }) {
  return (
    <div className="mb-4 rounded-xl border border-primary/15 bg-primary/8 p-4">
      <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-primary">
        <Repeat className="h-3.5 w-3.5" />
        {summary.title}
      </div>
      <div className="space-y-2">
        {summary.bullets.map((bullet) => (
          <p key={bullet} className="text-[13px] leading-6 text-muted">
            {bullet}
          </p>
        ))}
      </div>
    </div>
  );
}

function StrategyCompareCard({
  previousCode,
  nextContent,
  onAccept,
  onAcceptAndBacktest,
}: {
  previousCode: string;
  nextContent: string;
  onAccept: (code: string, previousCode: string) => void;
  onAcceptAndBacktest: (code: string, previousCode: string) => void;
}) {
  const nextCode = extractCodeBlock(nextContent);
  const stats = buildStrategyComparisonStats(previousCode, nextContent);

  if (!nextCode || !stats) {
    return null;
  }

  return (
    <details className="mb-4 rounded-xl border border-border bg-surface/70 p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-medium text-foreground">
        <span className="flex items-center gap-2">
          <Repeat className="h-3.5 w-3.5 text-primary" />
          Version comparison
        </span>
        <span className="text-[11px] uppercase tracking-[0.14em] text-muted">Before / after</span>
      </summary>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-panel p-3 text-[13px] leading-6 text-muted">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Previous version</div>
          <p><span className="text-foreground">Name:</span> {stats.previousName}</p>
          <p><span className="text-foreground">Lines:</span> {stats.previousLines}</p>
          <p><span className="text-foreground">Long branches:</span> {stats.previousLongs}</p>
          <p><span className="text-foreground">Short branches:</span> {stats.previousShorts}</p>
        </div>
        <div className="rounded-lg border border-border bg-panel p-3 text-[13px] leading-6 text-muted">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">New version</div>
          <p><span className="text-foreground">Name:</span> {stats.nextName}</p>
          <p><span className="text-foreground">Lines:</span> {stats.nextLines}</p>
          <p><span className="text-foreground">Long branches:</span> {stats.nextLongs}</p>
          <p><span className="text-foreground">Short branches:</span> {stats.nextShorts}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Before</div>
          <pre className="max-h-[280px] overflow-auto rounded-lg border border-border bg-background p-3 font-mono text-[12px] leading-6 text-muted">
            <code>{previousCode}</code>
          </pre>
        </div>
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">After</div>
          <pre className="max-h-[280px] overflow-auto rounded-lg border border-border bg-background p-3 font-mono text-[12px] leading-6 text-muted">
            <code>{nextCode}</code>
          </pre>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => onAccept(nextCode, previousCode)}
          className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-[12px] font-medium text-primary"
        >
          Accept as next version
        </button>
        <button
          onClick={() => onAcceptAndBacktest(nextCode, previousCode)}
          className="rounded-xl border border-border bg-panel px-4 py-2 text-[12px] font-medium text-foreground"
        >
          Accept and run backtest
        </button>
      </div>
    </details>
  );
}

function StrategyReasoningCard({
  research,
  blueprint,
  verification,
  critic,
}: {
  intake?: IntakeResult;
  research?: ResearchBrief | null;
  blueprint?: StrategyBlueprint;
  verification?: VerificationResult;
  critic?: StrategyCriticResult | null;
}) {
  if (!blueprint && !verification && !research && !critic) {
    return null;
  }

  return (
    <div className="mb-4 rounded-xl border border-border bg-surface/70 p-4">
      <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-primary">
        <BrainCircuit className="h-3.5 w-3.5" />
        Strategy reasoning
      </div>

      {blueprint ? (
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-panel p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Blueprint</div>
            <div className="space-y-1.5 text-[13px] leading-6 text-muted">
              <p><span className="text-foreground">Market:</span> {blueprint.instrument}</p>
              <p><span className="text-foreground">Timeframe:</span> {blueprint.timeframe}</p>
              <p><span className="text-foreground">Direction:</span> {blueprint.direction}</p>
              <p><span className="text-foreground">Trades/day:</span> {blueprint.maxTradesPerDay}</p>
              <p><span className="text-foreground">Session:</span> {blueprint.sessionFilter}</p>
              <p><span className="text-foreground">Stop / target:</span> {blueprint.stopModel} / {blueprint.targetModel}</p>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-panel p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Edge context</div>
            <div className="space-y-2 text-[13px] leading-6 text-muted">
              <p><span className="text-foreground">Objective:</span> {blueprint.objective}</p>
              <p><span className="text-foreground">Entry model:</span> {blueprint.entryModel}</p>
              {blueprint.noGoConditions.length ? (
                <p><span className="text-foreground">Avoid:</span> {blueprint.noGoConditions.join(", ")}</p>
              ) : null}
              {blueprint.propConstraints.length ? (
                <p><span className="text-foreground">Prop limits:</span> {blueprint.propConstraints.join(", ")}</p>
              ) : null}
              {blueprint.qualityNotes?.length ? (
                <p><span className="text-foreground">Quality:</span> {blueprint.qualityNotes.join(", ")}</p>
              ) : null}
              {blueprint.validationPlan?.length ? (
                <p><span className="text-foreground">Next test:</span> {blueprint.validationPlan.join(", ")}</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {verification ? (
        <div className="rounded-lg border border-border bg-panel p-3">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            <Check className={`h-3.5 w-3.5 ${verification.passed ? "text-primary" : "text-yellow-500"}`} />
            Verification
          </div>
          <div className="space-y-1.5 text-[13px] leading-6 text-muted">
            <p>
              <span className="text-foreground">Runtime contract:</span>{" "}
              {verification.passed ? "Passed" : "Needs review"}
            </p>
            {verification.warnings?.length ? (
              <p><span className="text-foreground">Warnings:</span> {verification.warnings.join(" | ")}</p>
            ) : (
              <p><span className="text-foreground">Warnings:</span> None flagged in the verifier.</p>
            )}
            {verification.issues?.length ? (
              <p><span className="text-foreground">Issues:</span> {verification.issues.join(" | ")}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {research ? (
        <div className="mt-3 rounded-lg border border-border bg-panel p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Research brief</div>
          <div className="space-y-1.5 text-[13px] leading-6 text-muted">
            <p><span className="text-foreground">Summary:</span> {research.summary || "No research summary captured."}</p>
            {research.facts?.length ? <p><span className="text-foreground">Facts:</span> {research.facts.join(" | ")}</p> : null}
            {research.assumptions?.length ? <p><span className="text-foreground">Assumptions:</span> {research.assumptions.join(" | ")}</p> : null}
            {research.openQuestions?.length ? <p><span className="text-foreground">Open questions:</span> {research.openQuestions.join(" | ")}</p> : null}
          </div>
        </div>
      ) : null}

      {critic ? (
        <div className="mt-3 rounded-lg border border-border bg-panel p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Strategy critic</div>
          <div className="space-y-1.5 text-[13px] leading-6 text-muted">
            <p><span className="text-foreground">Score:</span> {critic.score}/100 | {critic.automationReadiness.replace(/_/g, " ")}</p>
            <p><span className="text-foreground">Verdict:</span> {critic.summary}</p>
            {critic.weaknesses?.length ? <p><span className="text-foreground">Weaknesses:</span> {critic.weaknesses.join(" | ")}</p> : null}
            {critic.failureModes?.length ? <p><span className="text-foreground">Failure modes:</span> {critic.failureModes.join(" | ")}</p> : null}
            <p><span className="text-foreground">Next experiment:</span> {critic.nextExperiment}</p>
          </div>
        </div>
      ) : null}

    </div>
  );
}

function ActionPlanCard({
  actions,
  code,
  dossier,
  onSave,
  onRun,
  onImprove,
}: {
  actions?: BuilderAction[];
  code: string | null;
  dossier?: StrategyDraftDossier;
  onSave: (code: string, dossier?: StrategyDraftDossier) => void;
  onRun: (code: string, dossier?: StrategyDraftDossier) => void;
  onImprove: (code: string, goal: ImprovementGoal) => void;
}) {
  if (!actions?.length) return null;

  function runAction(action: BuilderAction) {
    if (!code) return;
    if (action.kind === "save_strategy") onSave(code, dossier);
    if (action.kind === "run_backtest") onRun(code, dossier);
    if (action.kind === "improve_from_evidence") onImprove(code, "general");
    if (action.kind === "attach_automation") {
      onSave(code, dossier);
      onRun(code, dossier);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-primary/20 bg-primary/8 p-4">
      <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-primary">Recommended actions</div>
      <div className="grid gap-2">
        {actions.map((action) => {
          const executable = Boolean(code) && action.kind !== "review_issues";
          return (
            <button
              key={action.id}
              onClick={() => runAction(action)}
              disabled={!executable}
              className={`rounded-xl border px-3 py-3 text-left transition ${
                executable
                  ? "border-border bg-panel text-foreground hover:border-primary/30"
                  : "border-border bg-surface/50 text-muted"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold">{action.label}</span>
                <span className="text-[10px] uppercase tracking-[0.16em] text-muted">{action.priority}</span>
              </div>
              <div className="mt-1 text-[12px] leading-5 text-muted">{action.description}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AIMessage({
  content,
  changeSummary,
  improvement,
  intake,
  research,
  blueprint,
  verification,
  critic,
  actions,
  currentThreadId,
  onCopy,
  onSave,
  onAcceptImproved,
  onAcceptAndBacktestImproved,
  onRun,
  activeImproveKey,
  onToggleImproveMenu,
  onImprove,
  copiedKey,
}: {
  content: string;
  changeSummary?: StrategyChangeSummary | null;
  improvement?: ImprovementMeta;
  intake?: IntakeResult;
  research?: ResearchBrief | null;
  blueprint?: StrategyBlueprint;
  verification?: VerificationResult;
  critic?: StrategyCriticResult | null;
  actions?: BuilderAction[];
  currentThreadId?: string | null;
  onCopy: (code: string, key: string) => void;
  onSave: (code: string, dossier?: StrategyDraftDossier) => void;
  onAcceptImproved: (code: string, previousCode: string, dossier?: StrategyDraftDossier) => void;
  onAcceptAndBacktestImproved: (code: string, previousCode: string, dossier?: StrategyDraftDossier) => void;
  onRun: (code: string, dossier?: StrategyDraftDossier) => void;
  activeImproveKey: string | null;
  onToggleImproveMenu: (key: string) => void;
  onImprove: (code: string, goal: ImprovementGoal) => void;
  copiedKey: string | null;
}) {
  let idx = 0;
  const hasWarning = /⚠️|\b(error|issue|issues)\b/i.test(content);
  const dossier = buildStrategyDossier({
    intake,
    research,
    blueprint,
    verification,
    critic,
    improvement,
    currentThreadId,
  });
  const firstCode = extractCodeBlock(content);
  return (
    <>
      {changeSummary ? <ChangeSummaryCard summary={changeSummary} /> : null}
      {improvement ? (
        <StrategyCompareCard
          previousCode={improvement.previousCode}
          nextContent={content}
          onAccept={(code, previousCode) => onAcceptImproved(code, previousCode, dossier)}
          onAcceptAndBacktest={(code, previousCode) => onAcceptAndBacktestImproved(code, previousCode, dossier)}
        />
      ) : null}
      <StrategyReasoningCard intake={intake} research={research} blueprint={blueprint} verification={verification} critic={critic} />
      <ActionPlanCard actions={actions} code={firstCode} dossier={dossier} onSave={onSave} onRun={onRun} onImprove={onImprove} />
      {content.split(/(```[\w]*[\s\S]*?```)/g).map((part, i) => {
        if (!part.startsWith("```")) return <p key={i} className="max-w-[86%] whitespace-pre-wrap break-words rounded-2xl rounded-tl-md border border-primary/20 bg-primary/[0.08] px-4 py-3 text-[14px] leading-7 text-foreground/90 shadow-lg shadow-black/10">{part}</p>;
        const lang = part.match(/^```(\w+)/)?.[1]?.toLowerCase() ?? "";
        const code = part.replace(/```\w*\n?/, "").replace(/\n?```$/, "");
        const key = `code-${idx++}`;
        const executable = lang === "typescript" || lang === "python";
        return (
          <div key={i}>
            {hasWarning && <div className="mb-3 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-3 text-[12px] text-yellow-500">⚠️ Review this generated strategy before live deployment. The response mentions a potential warning, error, or issue.</div>}
            {executable ? (
              <CodeBlock
                code={code}
                copied={copiedKey === key}
                onCopy={() => onCopy(code, key)}
                onSave={() => onSave(code, dossier)}
                onRun={() => onRun(code, dossier)}
                improvementMenuOpen={activeImproveKey === key}
                onToggleImproveMenu={() => onToggleImproveMenu(key)}
                onImprove={(goal) => onImprove(code, goal)}
              />
            ) : (
              <CodeBlock
                code={code}
                copied={copiedKey === key}
                onCopy={() => onCopy(code, key)}
                onSave={() => onSave(code, dossier)}
                onRun={() => onRun(code)}
                improvementMenuOpen={activeImproveKey === key}
                onToggleImproveMenu={() => onToggleImproveMenu(key)}
                onImprove={(goal) => onImprove(code, goal)}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

function AttachmentSummaryList({ attachments }: { attachments?: StrategyBuilderAttachmentProfile[] }) {
  if (!attachments?.length) return null;

  return (
    <div className="mt-3 grid gap-2">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="rounded-xl border border-border bg-panel px-3 py-2 text-[11px] leading-5 text-muted">
          <div className="font-semibold text-foreground">{attachment.name}</div>
          <div>{attachment.summary}</div>
          {attachment.issues?.length ? <div className="text-yellow-500">{attachment.issues.join(" | ")}</div> : null}
        </div>
      ))}
    </div>
  );
}

function UserMessageBubble({ message }: { message: Message }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[70%] rounded-2xl bg-surface px-4 py-3 text-[14px] leading-7">
        {message.content}
        <AttachmentSummaryList attachments={message.meta?.attachments} />
      </div>
    </div>
  );
}

function formatResetLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "soon";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function UsageMeter({ usage }: { usage: UsageSnapshot | null }) {
  if (!usage) {
    return <div className="rounded-xl border border-border bg-surface px-3 py-2 text-[11px] text-muted shadow-xl">Usage loading...</div>;
  }

  const fiveHourPct = Math.min(100, Math.round((usage.windows.fiveHour.used / usage.windows.fiveHour.limit) * 100));
  const monthlyPct = Math.min(100, Math.round((usage.windows.monthly.used / usage.windows.monthly.limit) * 100));

  return (
    <div className="min-w-[260px] rounded-xl border border-border bg-surface px-3 py-2 shadow-xl">
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="font-medium text-foreground">{usage.plan.name} usage</span>
        {!usage.configured ? <span className="text-muted">setup needed</span> : <span className="text-muted">AI credits</span>}
      </div>
      <div className="grid gap-1.5">
        <div>
          <div className="mb-1 flex justify-between text-[10px] text-muted">
            <span>5hr</span>
            <span>{usage.windows.fiveHour.used}/{usage.windows.fiveHour.limit}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-background">
            <div className="h-full rounded-full bg-primary" style={{ width: `${fiveHourPct}%` }} />
          </div>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-[10px] text-muted">
            <span>Monthly</span>
            <span>{usage.windows.monthly.used}/{usage.windows.monthly.limit}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-background">
            <div className="h-full rounded-full bg-primary/70" style={{ width: `${monthlyPct}%` }} />
          </div>
        </div>
      </div>
      <div className="mt-1 text-[10px] text-muted">Monthly resets {formatResetLabel(usage.windows.monthly.resetsAt)}</div>
    </div>
  );
}

export default function AIPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>("");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeImproveKey, setActiveImproveKey] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [model, setModel] = useState<StrategyBuilderMode>("research");
  const [openChatMenu, setOpenChatMenu] = useState<string | null>(null);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [toast, setToast] = useState("");
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [accountId, setAccountId] = useState(LOCAL_STRATEGY_BUILDER_ACCOUNT_ID);
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const chatMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const threadsRef = useRef<StrategyBuilderThread[]>([]);
  const activeThreadIdRef = useRef<string | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<StrategyBuilderAttachmentProfile[]>([]);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [builderWorkspaceContext, setBuilderWorkspaceContext] = useState<BuilderWorkspaceContext>({ type: "none", label: "Connect GitHub repo" });

  const results = useMemo(() => query ? chats.filter((c) => `${c.title} ${c.preview}`.toLowerCase().includes(query.toLowerCase())) : chats, [chats, query]);

  async function refreshUsage(nextAccountId = accountId) {
    try {
      const res = await fetch(`/api/usage?accountId=${encodeURIComponent(nextAccountId)}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.usage) setUsage(data.usage as UsageSnapshot);
    } catch {
      setUsage(null);
    }
  }

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      void refreshUsage(LOCAL_STRATEGY_BUILDER_ACCOUNT_ID);
      return;
    }

    void supabase.auth.getUser().then((result: { data?: { user?: { id?: string } | null } }) => {
      const nextAccountId = result.data?.user?.id ?? LOCAL_STRATEGY_BUILDER_ACCOUNT_ID;
      setAccountId(nextAccountId);
      void refreshUsage(nextAccountId);
    });
  }, []);

  useEffect(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(BUILDER_WORKSPACE_CONTEXT_KEY) || "null") as { type?: string; label?: string } | null;
      if (parsed?.type === "github") {
        setBuilderWorkspaceContext({
          type: parsed.type,
          label: typeof parsed.label === "string" && parsed.label.trim() ? parsed.label : "Connected workspace",
        });
      } else if (parsed?.type === "local") {
        window.localStorage.removeItem(BUILDER_WORKSPACE_CONTEXT_KEY);
        setBuilderWorkspaceContext({ type: "none", label: "Connect GitHub repo" });
      }
    } catch {
      setBuilderWorkspaceContext({ type: "none", label: "Connect GitHub repo" });
    }
  }, []);

  useEffect(() => {
    async function loadGithubWorkspaceConnection() {
      try {
        const response = await fetch("/api/strategy-builder/github/connection", { cache: "no-store" });
        if (!response.ok) return;

        const data = (await response.json()) as {
          connected?: boolean;
          connection?: { repoFullName?: string } | null;
        };
        const repoFullName = data.connection?.repoFullName?.trim();
        if (data.connected && repoFullName) {
          persistBuilderWorkspaceContext({ type: "github", label: repoFullName });
        }
      } catch {
        // Connection status is helpful context, not a blocker for opening the builder.
      }
    }

    void loadGithubWorkspaceConnection();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const githubWorkspace = url.searchParams.get("githubWorkspace");
    const repo = url.searchParams.get("repo");
    const message = url.searchParams.get("message");

    if (githubWorkspace === "connected" && repo) {
      persistBuilderWorkspaceContext({ type: "github", label: repo });
      showToast(`${repo} connected`);
    } else if (githubWorkspace === "error") {
      showToast(message || "GitHub workspace connection failed.");
    }

    if (githubWorkspace) {
      url.searchParams.delete("githubWorkspace");
      url.searchParams.delete("repo");
      url.searchParams.delete("message");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const builderContext = useMemo(() => {
    const saved = (() => {
      try {
        return JSON.parse(loadSavedStrategiesRaw() || "[]") as SavedStrategy[];
      } catch {
        return [];
      }
    })();
    const latestBacktest = loadAutomationBacktest();
    const strategySummary = saved
      .slice(0, 8)
      .map((strategy) => {
        const versionLabel = strategy.currentVersion ? `v${strategy.currentVersion}` : "v1";
        const currentVersion = (strategy.versions ?? []).find((version) => version.version === strategy.currentVersion) ?? (strategy.versions ?? [])[0];
        return `${strategy.name} (${versionLabel}; ${formatEvidenceForContext(currentVersion)})`;
      })
      .join("; ");

    return [
      `Builder account scope: ${LOCAL_STRATEGY_BUILDER_ACCOUNT_ID}`,
      `Current thread id: ${currentChatId ?? "none"}`,
      `Connected workspace: ${
        builderWorkspaceContext.type === "none"
          ? "none"
          : `GitHub repo - ${builderWorkspaceContext.label}`
      }`,
      `Saved strategy count: ${saved.length}`,
      `Recent strategy library: ${strategySummary || "No saved strategies yet."}`,
      latestBacktest
        ? `Latest backtest: ${latestBacktest.strategyName}${latestBacktest.strategyVersionLabel ? ` ${latestBacktest.strategyVersionLabel}` : ""} on ${latestBacktest.instrument} ${latestBacktest.timeframe} | trades ${latestBacktest.totalTrades} | win rate ${latestBacktest.winRate.toFixed(2)}% | PF ${latestBacktest.profitFactor.toFixed(2)} | net ${latestBacktest.totalPnL.toFixed(2)}`
        : "Latest backtest: none saved yet.",
    ].join("\n");
  }, [builderWorkspaceContext, currentChatId, messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, loadingStatus, elapsedTime]);

  useEffect(() => {
    const workspace = loadStrategyBuilderWorkspace(LOCAL_STRATEGY_BUILDER_ACCOUNT_ID);
    if (workspace && workspace.threads.length > 0) {
      const savedActiveThread = workspace.threads.find((thread) => thread.id === workspace.currentThreadId);
      const existingBlankThread =
        savedActiveThread?.messages.length === 0
          ? savedActiveThread
          : workspace.threads.find((thread) => thread.messages.length === 0);
      const activeThread = existingBlankThread ?? createStrategyBuilderThread("research");
      const nextThreads = existingBlankThread
        ? workspace.threads
        : sortThreadsNewestFirst([activeThread, ...workspace.threads]);

      threadsRef.current = nextThreads;
      setChats(toChatItems(nextThreads));
      activeThreadIdRef.current = activeThread.id;
      setCurrentChatId(activeThread.id);
      setMessages(activeThread.messages as Message[]);
      setModel(activeThread.model);
      saveStrategyBuilderWorkspace(
        {
          currentThreadId: activeThread.id,
          threads: nextThreads,
        },
        LOCAL_STRATEGY_BUILDER_ACCOUNT_ID,
      );
    } else {
      const thread = createStrategyBuilderThread("research");
      threadsRef.current = [thread];
      setChats(toChatItems([thread]));
      activeThreadIdRef.current = thread.id;
      setCurrentChatId(thread.id);
      setMessages([]);
      setModel("research");
    }
    setWorkspaceReady(true);
  }, []);

  useEffect(() => {
    if (!workspaceReady || !currentChatId) return;

    const targetThreadId = activeThreadIdRef.current;
    if (!targetThreadId || targetThreadId !== currentChatId) return;

    const nextThreads = updateStrategyBuilderThread(
      threadsRef.current,
      targetThreadId,
      messages as StrategyBuilderThread["messages"],
      model,
    );
    threadsRef.current = nextThreads;
    setChats(toChatItems(nextThreads));
    saveStrategyBuilderWorkspace(
      {
        currentThreadId: currentChatId,
        threads: nextThreads,
      },
      LOCAL_STRATEGY_BUILDER_ACCOUNT_ID,
    );
  }, [currentChatId, messages, model, workspaceReady]);

  useEffect(() => {
    if (!workspaceReady || loading || typeof window === "undefined") return;

    const raw = window.sessionStorage.getItem(PENDING_BUILDER_ANALYSIS_KEY);
    if (!raw) return;

    try {
      const pending = JSON.parse(raw) as { prompt?: string; code?: string };
      window.sessionStorage.removeItem(PENDING_BUILDER_ANALYSIS_KEY);
      if (typeof pending.prompt === "string" && pending.prompt.trim()) {
        void send(pending.prompt, pending.code ? { improvement: { goal: "general", previousCode: pending.code } } : undefined);
      }
    } catch {
      window.sessionStorage.removeItem(PENDING_BUILDER_ANALYSIS_KEY);
    }
  }, [workspaceReady, loading]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 0);
  }, [searchOpen]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!chatMenuRef.current?.contains(event.target as Node)) setOpenChatMenu(null);
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  async function send(overrideInput?: string, meta?: Message["meta"]) {
    const activeAttachments = meta?.attachments ?? pendingAttachments;
    const prompt = ((overrideInput ?? input) || (inputRef.current?.value ?? "")).trim() || (activeAttachments.length ? "Analyze the attached file context and help me use it for the strategy builder." : "");
    if (!prompt || loading || typing) return;
    const researchStatuses = [
      "Reading your strategy brief...",
      "Checking the market and session context...",
      "Looking for missing risk and execution details...",
      "Deciding whether to ask questions or build...",
      "Preparing the next best response...",
    ];
    const proStatuses = [
      "Reading your strategy brief...",
      "Thinking through the trading edge...",
      "Checking market structure and risk context...",
      "Planning the safest next step...",
      "Preparing the next best response...",
    ];
    const fastStatuses = [
      "Reading your strategy brief...",
      "Checking what matters for the first test...",
      "Preparing the next best response...",
    ];
    const statusMessages = researchStatuses;
    let statusIndex = 0;
    let statusInterval: ReturnType<typeof setInterval> | null = null;
    let timerInterval: ReturnType<typeof setInterval> | null = null;
    const userMeta = activeAttachments.length ? { ...meta, attachments: activeAttachments } : meta;
    const next = [...messages, { role: "user" as const, content: prompt, meta: userMeta }];
    const attachmentContext = formatAttachmentProfilesForPrompt(activeAttachments);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setMessages(next);
    setActiveImproveKey(null);
    if (!overrideInput) {
      setInput("");
      setPendingAttachments([]);
    }
    setLoading(true);
    setLoadingStatus(statusMessages[0]);
    setElapsedTime(0);
    statusInterval = setInterval(() => {
      statusIndex = Math.min(statusIndex + 1, statusMessages.length - 1);
      setLoadingStatus(statusMessages[statusIndex]);
    }, 3000);
    timerInterval = setInterval(() => setElapsedTime((prev) => prev + 1), 1000);
    try {
      const startedAt = Date.now();
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId, context: builderContext, attachmentContext, messages: next, model: "research" }), signal: controller.signal });
      const data = await res.json();
      const elapsedMs = Date.now() - startedAt;
      const minimumThinkingMs = data.intake?.decision === "clarify" ? 3200 : 1200;
      if (elapsedMs < minimumThinkingMs) {
        await new Promise((resolve) => setTimeout(resolve, minimumThinkingMs - elapsedMs));
      }
      if (controller.signal.aborted) return;
      if (data.usage) setUsage(data.usage as UsageSnapshot);
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : `Strategy builder failed with status ${res.status}`);
      }
      const assistantContent = data.response ?? "I could not generate a strategy.";
      const changeSummary = meta?.improvement
        ? summarizeStrategyChanges(meta.improvement.previousCode, assistantContent, meta.improvement.goal)
        : null;
      const assistantMeta: Message["meta"] = {
        ...(meta?.improvement ? { improvement: meta.improvement } : {}),
        ...(changeSummary ? { changeSummary } : {}),
        ...(data.intake ? { intake: data.intake as IntakeResult } : {}),
        ...(data.research ? { research: data.research as ResearchBrief } : {}),
        ...(data.blueprint ? { blueprint: data.blueprint as StrategyBlueprint } : {}),
        ...(data.verification ? { verification: data.verification as VerificationResult } : {}),
        ...(data.critic ? { critic: data.critic as StrategyCriticResult } : {}),
        ...(Array.isArray(data.actions) ? { actions: data.actions as BuilderAction[] } : {}),
      };
      if (statusInterval) {
        clearInterval(statusInterval);
        statusInterval = null;
      }
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      setLoading(false);
      setLoadingStatus("");
      setTyping(true);
      setMessages([...next, { role: "assistant", content: "" }]);
      const typewriterPlan = getTypewriterPlan(assistantContent);
      for (let cursor = typewriterPlan.chunkSize; cursor < assistantContent.length; cursor += typewriterPlan.chunkSize) {
        if (controller.signal.aborted) return;
        const partial = assistantContent.slice(0, cursor);
        setMessages([...next, { role: "assistant", content: partial }]);
        await sleep(typewriterPlan.delayMs);
      }
      if (controller.signal.aborted) return;
      setMessages([...next, { role: "assistant", content: assistantContent, meta: assistantMeta }]);
    } catch (err: any) {
      if (err.name === "AbortError") return;
      const errorContent = err instanceof Error ? err.message : "I could not generate a strategy.";
      if (statusInterval) {
        clearInterval(statusInterval);
        statusInterval = null;
      }
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      setLoading(false);
      setLoadingStatus("");
      setTyping(true);
      setMessages([...next, { role: "assistant", content: "" }]);
      const errorTypewriterPlan = getTypewriterPlan(errorContent);
      for (let cursor = errorTypewriterPlan.chunkSize; cursor < errorContent.length; cursor += errorTypewriterPlan.chunkSize) {
        if (controller.signal.aborted) return;
        setMessages([...next, { role: "assistant", content: errorContent.slice(0, cursor) }]);
        await sleep(errorTypewriterPlan.delayMs);
      }
      if (controller.signal.aborted) return;
      setMessages([...next, { role: "assistant", content: errorContent }]);
    } finally {
      if (statusInterval) clearInterval(statusInterval);
      if (timerInterval) clearInterval(timerInterval);
      abortControllerRef.current = null;
      setLoading(false);
      setTyping(false);
      setLoadingStatus("");
    }
  }

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setTyping(false);
    setLoadingStatus("");
  };

  async function copy(code: string, key: string) {
    await navigator.clipboard.writeText(code);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1200);
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2000);
  }

  async function handleAttachmentFiles(files: FileList | null) {
    if (!files?.length) return;

    try {
      const profiles = await Promise.all(Array.from(files).slice(0, 4).map((file) => profileStrategyBuilderFile(file)));
      setPendingAttachments((current) => [...current, ...profiles].slice(0, 6));
      showToast(`${profiles.length} attachment${profiles.length === 1 ? "" : "s"} added`);
    } catch (error) {
      showToast((error as Error).message || "Could not read attachment");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removePendingAttachment(id: string) {
    setPendingAttachments((current) => current.filter((attachment) => attachment.id !== id));
  }

  function persistBuilderWorkspaceContext(nextContext: BuilderWorkspaceContext) {
    setBuilderWorkspaceContext(nextContext);
    try {
      window.localStorage.setItem(BUILDER_WORKSPACE_CONTEXT_KEY, JSON.stringify(nextContext));
    } catch {
      // Non-blocking: the selected context still updates for this session.
    }
  }

  function connectExistingGithubRepo() {
    setWorkspaceMenuOpen(false);
    const repoUrl = window.prompt("Paste the GitHub repo URL you want this builder to use:");
    if (!repoUrl?.trim()) return;

    const normalizedRepoUrl = repoUrl.trim().replace(/\.git$/, "");
    const match = normalizedRepoUrl.match(/^https:\/\/github\.com\/([^/\s]+)\/([^/\s?#]+)(?:[/?#].*)?$/i);
    if (!match) {
      showToast("Paste a valid GitHub repo URL.");
      return;
    }

    const repoLabel = `${match[1]}/${match[2]}`;
    window.location.href = `/api/strategy-builder/github/start?action=connect&repo=${encodeURIComponent(repoLabel)}&redirectTo=${encodeURIComponent("/ai")}`;
  }

  function createGithubRepo() {
    setWorkspaceMenuOpen(false);
    const repoName = window.prompt("Name the private GitHub repo for this Strategy Builder memory:", "kwantify-strategy-memory");
    if (!repoName?.trim()) return;
    window.location.href = `/api/strategy-builder/github/start?action=create&repoName=${encodeURIComponent(repoName.trim())}&redirectTo=${encodeURIComponent("/ai")}`;
  }

  function clearBuilderWorkspaceContext() {
    setWorkspaceMenuOpen(false);
    persistBuilderWorkspaceContext({ type: "none", label: "Connect GitHub repo" });
    showToast("Workspace context cleared");
  }

  function startNewChat() {
    if (loading) {
      showToast("Stop the current response before switching chats.");
      return;
    }
    const thread = createStrategyBuilderThread("research");
    threadsRef.current = sortThreadsNewestFirst([thread, ...threadsRef.current.filter((item) => item.id !== thread.id)]);
    activeThreadIdRef.current = thread.id;
    setCurrentChatId(thread.id);
    setMessages([]);
    setInput("");
    setQuery("");
    setOpenChatMenu(null);
    setChats(toChatItems(threadsRef.current));
    saveStrategyBuilderWorkspace(
      {
        currentThreadId: thread.id,
        threads: threadsRef.current,
      },
      LOCAL_STRATEGY_BUILDER_ACCOUNT_ID,
    );
  }

  function openChatThread(threadId: string) {
    if (loading) {
      showToast("Stop the current response before switching chats.");
      return;
    }
    const thread = threadsRef.current.find((item) => item.id === threadId);
    if (!thread) return;
    activeThreadIdRef.current = thread.id;
    setCurrentChatId(thread.id);
    setMessages(thread.messages as Message[]);
    setModel("research");
    setOpenChatMenu(null);
    setSearchOpen(false);
  }

  function deleteChatThread(threadId: string) {
    if (loading) {
      showToast("Stop the current response before deleting chats.");
      return;
    }
    const remainingThreads = sortThreadsNewestFirst(threadsRef.current.filter((item) => item.id !== threadId));

    if (remainingThreads.length === 0) {
      const replacement = createStrategyBuilderThread("research");
      threadsRef.current = [replacement];
      activeThreadIdRef.current = replacement.id;
      setCurrentChatId(replacement.id);
      setMessages([]);
      setModel(replacement.model);
      setChats(toChatItems([replacement]));
      saveStrategyBuilderWorkspace(
        {
          currentThreadId: replacement.id,
          threads: [replacement],
        },
        LOCAL_STRATEGY_BUILDER_ACCOUNT_ID,
      );
      showToast("Chat deleted");
      return;
    }

    threadsRef.current = remainingThreads;
    const nextCurrentThread = remainingThreads.find((item) => item.id === currentChatId) ? currentChatId : remainingThreads[0].id;
    const activeThread = remainingThreads.find((item) => item.id === nextCurrentThread) ?? remainingThreads[0];
    activeThreadIdRef.current = activeThread.id;
    setCurrentChatId(activeThread.id);
    setMessages(activeThread.messages as Message[]);
    setModel("research");
    setChats(toChatItems(remainingThreads));
    setOpenChatMenu(null);
    saveStrategyBuilderWorkspace(
      {
        currentThreadId: activeThread.id,
        threads: remainingThreads,
      },
      LOCAL_STRATEGY_BUILDER_ACCOUNT_ID,
    );
    showToast("Chat deleted");
  }

  function saveToStrategies(code: string, dossier?: StrategyDraftDossier) {
    const now = new Date();
    const name = getStrategyName(code);
    const saved = JSON.parse(loadSavedStrategiesRaw() || "[]") as SavedStrategy[];
    const existing = saved.find((strategy) => strategy.name.toLowerCase() === name.toLowerCase());
    const nextDossier = buildInferredStrategyDossier(code, currentChatId, dossier ?? existing?.strategyDossier);
    if (existing?.code === code) {
      saveSavedStrategiesRaw(
        JSON.stringify(saved.map((strategy) => (strategy.id === existing.id ? { ...strategy, strategyDossier: nextDossier } : strategy))),
      );
      return {
        strategyId: existing.id,
        strategyName: existing.name,
        versionLabel: `v${existing.currentVersion ?? 1}`,
        version: existing.currentVersion ?? 1,
      };
    }
    const nextVersion = existing ? (existing.currentVersion ?? existing.versions.length) + 1 : 1;
    const strategyId = existing?.id ?? crypto.randomUUID();
    const nextStrategies = existing
      ? saved.map((strategy) => {
          if (strategy.id !== existing.id) return strategy;
          return {
            ...strategy,
            code,
            language: "JavaScript",
            versions: [...(strategy.versions ?? []), { code, timestamp: now, version: nextVersion }],
            currentVersion: nextVersion,
            updatedAt: now,
            strategyDossier: nextDossier,
          };
        })
      : [
          ...saved,
          {
            id: strategyId,
            name,
            code,
            language: "JavaScript",
            versions: [{ code, timestamp: now, version: 1 }],
            currentVersion: 1,
            createdAt: now,
            updatedAt: now,
            strategyDossier: nextDossier,
          },
        ];

    saveSavedStrategiesRaw(JSON.stringify(nextStrategies));
    showToast("Strategy saved!");
    return {
      strategyId,
      strategyName: existing?.name ?? name,
      versionLabel: `v${nextVersion}`,
      version: nextVersion,
    };
  }

  function saveStrategyVersion(code: string, previousCode?: string, dossier?: StrategyDraftDossier) {
    const now = new Date();
    const targetName = previousCode ? getStrategyName(previousCode) : getStrategyName(code);
    const saved = JSON.parse(loadSavedStrategiesRaw() || "[]") as SavedStrategy[];
    const existing = saved.find((strategy) => strategy.name.toLowerCase() === targetName.toLowerCase());

    if (!existing) {
      return saveToStrategies(code, dossier);
    }

    const nextDossier = buildInferredStrategyDossier(code, currentChatId, dossier ?? existing.strategyDossier);
    const nextVersion = (existing.currentVersion ?? existing.versions.length) + 1;
    const nextName = existing.name;
    const nextStrategies = saved.map((strategy) => {
      if (strategy.id !== existing.id) return strategy;
      return {
        ...strategy,
        name: nextName,
        code,
        language: "JavaScript",
        versions: [...(strategy.versions ?? []), { code, timestamp: now, version: nextVersion }],
        currentVersion: nextVersion,
        updatedAt: now,
        strategyDossier: nextDossier,
      };
    });

    saveSavedStrategiesRaw(JSON.stringify(nextStrategies));
    return {
      strategyId: existing.id,
      strategyName: nextName,
      versionLabel: `v${nextVersion}`,
      version: nextVersion,
    };
  }

  function acceptImprovedVersion(code: string, previousCode: string, dossier?: StrategyDraftDossier) {
    const saved = saveStrategyVersion(code, previousCode, dossier);
    showToast(`Accepted into ${saved.strategyName} ${saved.versionLabel}`);
  }

  function acceptImprovedVersionAndBacktest(code: string, previousCode: string, dossier?: StrategyDraftDossier) {
    const saved = saveStrategyVersion(code, previousCode, dossier);
    const meta = inferStrategyMetadata({ code, strategyDossier: dossier });
    window.location.href = buildChartBacktestHref({
      strategyId: saved.strategyId,
      version: saved.version,
      instrument: meta.instrument,
      timeframe: meta.timeframe,
      autoRun: true,
      analyze: true,
    });
  }

  function runGeneratedBacktest(code: string, dossier?: StrategyDraftDossier) {
    const saved = saveToStrategies(code, dossier);
    const meta = inferStrategyMetadata({ code, strategyDossier: dossier });
    window.location.href = buildChartBacktestHref({
      strategyId: saved.strategyId,
      version: saved.version,
      instrument: meta.instrument,
      timeframe: meta.timeframe,
      autoRun: true,
      analyze: true,
    });
  }

  function improveFromLatestBacktest(code: string, goal: ImprovementGoal) {
    const snapshot = loadAutomationBacktest();
    if (!snapshot) {
      showToast("Run a backtest first so the builder has real results to improve from.");
      return;
    }

    const prompt = buildBacktestImprovementPrompt(code, snapshot, goal);
    setActiveImproveKey(null);
    void send(prompt, {
      improvement: {
        goal,
        previousCode: code,
      },
    });
  }

  function minimizeToWidget() {
    sessionStorage.setItem("ai-messages", JSON.stringify(messages));
    sessionStorage.setItem("ai-minimized", "true");
    sessionStorage.setItem("ai-expanded", "true");
    window.location.href = "/";
  }

  function keyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const isEmptyThread = messages.length === 0 && !loading && !typing;
  const composerCanSend = Boolean(input.trim() || pendingAttachments.length);

  function renderStrategyComposer(hero = false) {
    return (
      <div
        className={`mx-auto w-full max-w-4xl rounded-[28px] border p-3 shadow-2xl shadow-black/30 ${
          hero ? "min-h-[150px]" : ""
        }`}
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--surface) 84%, var(--primary) 16%), color-mix(in srgb, var(--panel) 88%, var(--primary) 12%))",
          borderColor: "color-mix(in srgb, var(--border) 72%, var(--primary) 28%)",
        }}
      >
        {pendingAttachments.length ? (
          <div className="mb-2 grid gap-2 px-2">
            <AttachmentSummaryList attachments={pendingAttachments} />
            {pendingAttachments.map((attachment) => (
              <button
                key={attachment.id}
                onClick={() => removePendingAttachment(attachment.id)}
                className="w-fit rounded-lg border border-primary/15 px-2 py-1 text-[11px] text-muted hover:text-foreground"
              >
                Remove {attachment.name}
              </button>
            ))}
          </div>
        ) : null}
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={keyDown}
          placeholder={hero ? "Do anything" : "Describe your trading strategy..."}
          rows={hero ? 4 : 3}
          className="max-h-[220px] w-full resize-none bg-transparent px-2 py-2 text-[15px] leading-6 outline-none placeholder:text-primary/50"
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".csv,.json,.txt,.md,.markdown,.xls,.xlsx,text/csv,application/json,text/plain,text/markdown"
          onChange={(event) => void handleAttachmentFiles(event.target.files)}
          className="hidden"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-primary transition hover:bg-primary/10"
            title="Attach file"
          >
            <Plus className="h-5 w-5" />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-primary/85 transition hover:bg-primary/10"
            title="Attach CSV, JSON, TXT, Markdown, or spreadsheet"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <div className="relative">
            <button
              onClick={() => setWorkspaceMenuOpen((current) => !current)}
              className="flex h-9 items-center gap-2 rounded-xl px-3 text-[13px] font-medium text-primary transition hover:bg-primary/10"
            >
              {builderWorkspaceContext.type === "github" ? <FolderGit2 className="h-4 w-4" /> : <Folder className="h-4 w-4" />}
              <span className="max-w-[220px] truncate">{builderWorkspaceContext.label}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {workspaceMenuOpen ? (
              <div className="absolute bottom-11 left-0 z-30 w-[280px] overflow-hidden rounded-2xl border border-primary/15 bg-panel shadow-2xl">
                <button
                  onClick={connectExistingGithubRepo}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-surface"
                >
                  <FolderGit2 className="mt-0.5 h-4 w-4 text-primary" />
                  <span>
                    <span className="block text-[13px] font-semibold text-foreground">Select existing GitHub repo</span>
                    <span className="block text-[11px] leading-5 text-muted">Paste an existing GitHub repo URL.</span>
                  </span>
                </button>
                <button
                  onClick={createGithubRepo}
                  className="flex w-full items-start gap-3 border-t border-border px-4 py-3 text-left transition hover:bg-surface"
                >
                  <GitBranch className="mt-0.5 h-4 w-4 text-primary" />
                  <span>
                    <span className="block text-[13px] font-semibold text-foreground">Create new GitHub repo</span>
                    <span className="block text-[11px] leading-5 text-muted">Start a fresh repo for this strategy workspace.</span>
                  </span>
                </button>
                {builderWorkspaceContext.type !== "none" ? (
                  <button
                    onClick={clearBuilderWorkspaceContext}
                    className="flex w-full items-center gap-3 border-t border-border px-4 py-3 text-left text-[13px] text-muted transition hover:bg-surface hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                    Clear workspace
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="flex h-9 items-center rounded-xl px-2 text-[11px] font-medium uppercase tracking-wider text-muted">
            Powered by Claude
          </div>
          <div className="flex-1" />
          <button className="flex h-9 items-center gap-2 rounded-xl px-3 text-[13px] font-medium text-primary/90 transition hover:bg-primary/10">
            <BrainCircuit className="h-4 w-4" />
            Claude Research
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button className="flex h-9 w-9 items-center justify-center rounded-xl text-primary/85 transition hover:bg-primary/10" title="Voice input">
            <Mic className="h-4 w-4" />
          </button>
          {loading || typing ? (
            <button
              onClick={handleCancel}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-danger/20 transition hover:bg-danger/30"
              title="Stop generating"
            >
              <Square className="h-4 w-4 fill-danger text-danger" />
            </button>
          ) : (
            <button
              onClick={() => void send()}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
                composerCanSend ? "bg-primary text-on-primary hover:bg-primary/90" : "bg-primary/20 text-primary/60 hover:bg-primary/25"
              }`}
              title="Send"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar />
      {sidebarOpen && (
        <aside className="w-[260px] shrink-0 border-r border-border bg-panel p-4 overflow-y-auto">
          <button onClick={startNewChat} className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-[13px] font-semibold text-on-primary"><Plus className="h-4 w-4" />New Chat</button>
          <div className="mb-4 rounded-xl border border-border bg-surface px-3 py-2 flex items-center gap-2"><Search className="h-4 w-4 text-muted" /><input placeholder="Search chats..." className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted" /></div>
          <button onClick={() => setFoldersOpen(!foldersOpen)} className="mb-2 flex w-full items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-muted">{foldersOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}Folders</button>
          {foldersOpen && <div className="mb-5 space-y-1">{[["All Chats", 0], ["Favourites", 0]].map(([name, count]) => <button key={name} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] text-muted hover:bg-surface hover:text-foreground"><span className="flex items-center gap-2"><Folder className="h-4 w-4" />{name}</span><span>{count}</span></button>)}</div>}
          <div className="space-y-2">{chats.map((chat) => <div key={chat.id} onClick={() => openChatThread(chat.id)} className={`group cursor-pointer rounded-xl p-3 hover:bg-surface ${currentChatId === chat.id ? "bg-surface" : ""}`}><div className="flex justify-between gap-2"><div className="min-w-0"><div className="truncate text-[13px] font-medium">{chat.title}</div><div className="truncate text-[12px] text-muted">{chat.preview}</div><div className="mt-1 text-[11px] text-muted">{chat.date}</div></div><div className="relative" ref={openChatMenu === chat.id ? chatMenuRef : undefined}><button onClick={(event) => { event.stopPropagation(); setOpenChatMenu((current) => current === chat.id ? null : chat.id); }} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted opacity-0 transition-opacity hover:bg-card hover:text-foreground group-hover:opacity-100"><MoreHorizontal className="h-4 w-4" /></button>{openChatMenu === chat.id && <div className="absolute right-0 top-8 z-20 w-44 rounded-xl border border-border bg-panel py-1 shadow-xl"><button className="flex w-full items-center gap-2 px-4 py-2 text-left text-[13px] text-muted hover:bg-surface">Rename</button><button className="flex w-full items-center gap-2 px-4 py-2 text-left text-[13px] text-muted hover:bg-surface"><Star className="h-3.5 w-3.5" />Add to Favourites</button><button className="flex w-full items-center gap-2 px-4 py-2 text-left text-[13px] text-muted hover:bg-surface"><FolderPlus className="h-3.5 w-3.5" />Move to Folder</button><button className="flex w-full items-center gap-2 px-4 py-2 text-left text-[13px] text-muted hover:bg-surface"><Copy className="h-3.5 w-3.5" />Duplicate</button><button onClick={(event) => { event.stopPropagation(); deleteChatThread(chat.id); }} className="flex w-full items-center gap-2 px-4 py-2 text-left text-[13px] text-danger hover:bg-surface">Delete</button></div>}</div></div></div>)}</div>
        </aside>
      )}
      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="h-[56px] border-b border-border bg-panel flex items-center justify-between px-5">
          <div className="flex items-center gap-2"><button onClick={() => setSidebarOpen(!sidebarOpen)} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted hover:bg-surface hover:text-foreground">{sidebarOpen ? <PanelLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}</button><button onClick={() => setSearchOpen(true)} className="h-8 w-8 rounded-lg flex items-center justify-center text-muted hover:bg-surface hover:text-foreground"><Search className="h-4 w-4" /></button><Sparkles className="h-4 w-4 text-primary" /><h1 className="text-[15px] font-semibold">Strategy Builder</h1></div>
          <div className="flex items-center gap-3"><button onClick={startNewChat} className="rounded-xl border border-border bg-surface px-4 py-2 text-[13px] hover:bg-card">New Chat</button><button onClick={minimizeToWidget} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-surface transition-colors" title="Minimize"><Minus className="h-4 w-4" /></button><div className="h-9 w-9 rounded-full border border-border bg-surface flex items-center justify-center"><User className="h-4 w-4 text-muted" /></div></div>
        </header>
        <div className="absolute right-6 top-[72px] z-20 hidden md:block">
          <UsageMeter usage={usage} />
        </div>
        <section className={`flex-1 overflow-y-auto px-6 ${isEmptyThread ? "pb-8" : "pb-[180px]"}`}>
          {isEmptyThread ? (
            <div className="mx-auto flex min-h-full max-w-5xl flex-col items-center justify-center py-16 text-center">
              <h2 className="mb-10 text-4xl font-medium tracking-normal text-primary md:text-5xl">
                What should we build?
              </h2>
              {renderStrategyComposer(true)}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[12px] text-muted">
                <span className="flex items-center gap-1.5 rounded-full border border-border bg-surface/50 px-3 py-1.5">
                  <GitBranch className="h-3.5 w-3.5 text-primary" />
                  KWANT workspace
                </span>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-4xl space-y-8 py-8">{messages.map((m, i) => m.role === "user" ? <UserMessageBubble key={i} message={m} /> : <div key={i} className="flex gap-3"><div className="mt-1 h-8 w-8 rounded-full border border-primary/20 bg-primary/10 flex items-center justify-center"><Bot className="h-4 w-4 text-primary" /></div><div className="min-w-0 flex-1"><div className="mb-2 text-[12px] font-semibold">Kwantify AI</div><AIMessage content={m.content} changeSummary={m.meta?.changeSummary} improvement={m.meta?.improvement} intake={m.meta?.intake} research={m.meta?.research} blueprint={m.meta?.blueprint} verification={m.meta?.verification} critic={m.meta?.critic} actions={m.meta?.actions} currentThreadId={currentChatId} onCopy={copy} onSave={saveToStrategies} onAcceptImproved={acceptImprovedVersion} onAcceptAndBacktestImproved={acceptImprovedVersionAndBacktest} onRun={runGeneratedBacktest} activeImproveKey={activeImproveKey} onToggleImproveMenu={(key) => setActiveImproveKey((current) => current === key ? null : key)} onImprove={improveFromLatestBacktest} copiedKey={copiedKey} /></div></div>)}{loading && <div className="flex items-start gap-3 px-6 py-4"><div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0"><Sparkles className="w-4 h-4 text-primary animate-pulse" /></div><div className="flex flex-col gap-1.5"><span className="text-[13px] font-medium text-foreground">Kwantify AI</span><div className="flex items-center gap-2"><div className="flex gap-1"><div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} /><div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} /><div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} /></div><span className="text-[12px] text-muted animate-pulse">{loadingStatus}</span><span className="text-[10px] text-muted/50">{elapsedTime}s</span></div></div><button onClick={handleCancel} className="ml-auto text-[11px] text-muted hover:text-danger transition-colors px-2 py-1 rounded-lg hover:bg-danger/10">Stop</button></div>}<div ref={endRef} /></div>
          )}
        </section>
        {!isEmptyThread ? (
          <div className="absolute bottom-0 left-0 right-0 bg-background/95 px-6 pb-5 pt-3">
            {renderStrategyComposer(false)}
            <p className="mt-2 text-center text-[11px] text-muted">Kwantify AI can make mistakes. Verify strategy logic before live deployment.</p>
          </div>
        ) : null}
      </main>
      {toast && <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-primary/20 bg-panel px-4 py-3 text-[13px] font-medium text-primary shadow-2xl">{toast}</div>}
      {searchOpen && <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-[20vh]" onClick={() => setSearchOpen(false)}><div className="w-[560px] overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="flex items-center gap-3 border-b border-border px-5 py-4"><Search className="h-4 w-4 text-muted" /><input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search conversations..." className="flex-1 bg-transparent text-[15px] outline-none" /><button onClick={() => setSearchOpen(false)}><X className="h-4 w-4 text-muted" /></button></div><div className="max-h-[400px] overflow-y-auto py-2"><div className="px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{query ? "Results" : "Recent chats"}</div>{results.map((r) => <button key={r.id} onClick={() => openChatThread(r.id)} className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-surface"><div className="min-w-0"><div className="truncate text-[14px]">{r.title}</div><div className="truncate text-[12px] text-muted">{r.preview}</div></div><span className="text-[11px] text-muted">{r.date}</span></button>)}{results.length === 0 && <div className="py-12 text-center text-muted">No results found</div>}</div><div className="border-t border-border py-2 text-center text-[11px] text-muted">Tip: Use Ctrl+K to search anytime</div></div></div>}
    </div>
  );
}
