"use client";

import Image from "next/image";
import {
  resolveOutcomeColors,
  SEMANTIC_WIN,
  SEMANTIC_LOSS,
  type OutcomeColors,
} from "@/lib/outcomeColors";
import {
  Activity,
  ArchiveRestore,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BrainCircuit,
  BookPlus,
  BookOpen,
  Bot,
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Download,
  Eye,
  FileJson,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderArchive,
  GripVertical,
  ImageIcon,
  Import,
  Layers3,
  LineChart,
  Mic,
  NotebookPen,
  MoreVertical,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Save,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Tags,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import KwantLoader from "@/components/KwantLoader";
import WorkspaceSubnav from "@/components/ui/WorkspaceSubnav";
import {
  calculateJournalAdvancedStats,
  calculateJournalStats,
  EMPTY_JOURNAL_STATE,
  isZyonJournalAccountName,
  journalTradesToCsv,
  mergeJournalImportTrades,
  parseJournalTextFile,
  ZYON_JOURNAL_ACCOUNT,
  zyonOutcomesToJournalTrades,
  type JournalAccount,
  type JournalEvidence,
  type JournalImportBatch,
  type JournalParseResult,
  type JournalState,
  type JournalTrade,
  type JournalTradingAccountType,
} from "@/lib/journal";
import { loadJournalState, saveJournalState } from "@/lib/journalStore";
import {
  buildJournalAnalysisEvidence,
  type JournalAnalysisFinding,
  type JournalAnalysisLeak,
  type JournalQuantAnalysis,
} from "@/lib/journalAnalysis";
import KwantSelect from "@/components/ui/KwantSelect";
import { usePersistentFieldDictation } from "@/hooks/usePersistentFieldDictation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type CSSProperties } from "react";

type JournalTab = "pulse" | "calendar" | "trades" | "edgebook" | "analysis" | "evidence" | "imports";
type OutcomeFilter = "all" | "wins" | "losses" | "breakeven" | "needs-review";
type SortKey = "closedAt" | "netPnl" | "rMultiple" | "quantity" | "symbol";

type JournalCloudState = "loading" | "cloud" | "local" | "error";
type AccountCreationMode = "manual" | "import";
type ImportDialogPurpose = "add-account" | "append-trades";

type JournalMemoryCacheEntry = {
  state: JournalState;
  zyonTrades: JournalTrade[];
  cloudState: JournalCloudState;
  tab: JournalTab;
  accountFilter: string;
  updatedAt: number;
};

const JOURNAL_MEMORY_CACHE = new Map<string, JournalMemoryCacheEntry>();

type ManualTradeDraft = {
  name: string;
  symbol: string;
  side: "" | "LONG" | "SHORT";
  contractClass: "" | "MICRO" | "MINI" | "OTHER";
  quantity: string;
  openedAt: string;
  closedAt: string;
  entryPrice: string;
  exitPrice: string;
  stopPrice: string;
  targetPrice: string;
  plannedRiskReward: string;
  initialRisk: string;
  netPnl: string;
  fees: string;
  tags: string;
  notes: string;
  improvements: string;
  tradingAccountName: string;
  tradingAccountType: "" | JournalTradingAccountType;
  accountSize: string;
  rating: number | null;
};

type ManualTradeDictationField = Exclude<keyof ManualTradeDraft, "rating">;

const MANUAL_TRADE_DICTATION_LABELS: Record<ManualTradeDictationField, string> = {
  name: "Trade / setup name",
  symbol: "Instrument",
  side: "Direction",
  contractClass: "Contract class",
  quantity: "Contracts",
  openedAt: "Entry time",
  closedAt: "Exit time",
  entryPrice: "Entry price",
  exitPrice: "Exit price",
  stopPrice: "Stop price",
  targetPrice: "Target price",
  plannedRiskReward: "Planned risk : reward",
  initialRisk: "Initial risk",
  netPnl: "Net profit / loss",
  fees: "Fees",
  tags: "Tags",
  notes: "Notes",
  improvements: "How can I do better next time?",
  tradingAccountName: "Account / provider",
  tradingAccountType: "Account type",
  accountSize: "Account size",
};

const MANUAL_TRADE_NUMBER_FIELDS = new Set<ManualTradeDictationField>([
  "quantity",
  "entryPrice",
  "exitPrice",
  "stopPrice",
  "targetPrice",
  "plannedRiskReward",
  "initialRisk",
  "netPnl",
  "fees",
  "accountSize",
]);

type SocialJournalResponse = {
  viewerId?: string;
  objects?: Array<{
    id: string;
    userId: string;
    objectType: string;
    parentId: string | null;
    payload: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  }>;
};

type CloudJournalResponse = {
  cloud?: boolean;
  accounts?: JournalAccount[];
  trades?: JournalTrade[];
  imports?: JournalImportBatch[];
  evidence?: JournalEvidence[];
};

type JournalAnalysisResponse = {
  analysis?: JournalQuantAnalysis | null;
  fingerprint?: string;
  cloud?: boolean;
  error?: string;
  elapsedMs?: number;
};

const JOURNAL_TABS: Array<{ id: JournalTab; label: string; description: string; icon: typeof Activity }> = [
  { id: "pulse", label: "Pulse", description: "Account overview", icon: Activity },
  { id: "calendar", label: "Calendar", description: "Performance by day", icon: CalendarDays },
  { id: "trades", label: "Trade Log", description: "Every recorded trade", icon: FileSpreadsheet },
  { id: "edgebook", label: "Edgebook", description: "Repeatable patterns", icon: Sparkles },
  { id: "analysis", label: "Analysis", description: "Quant mentor review", icon: BrainCircuit },
  { id: "evidence", label: "Evidence", description: "Screenshots and notes", icon: ImageIcon },
  { id: "imports", label: "Imports", description: "Source file history", icon: FolderArchive },
];

const ACCEPTED_FILES = ".xlsx,.xls,.xlsm,.xlsb,.ods,.fods,.xml,.html,.htm,.csv,.tsv,.txt,.json,.md,.png,.jpg,.jpeg,.webp,.gif";
const SPREADSHEET_EXTENSIONS = new Set(["xlsx", "xls", "xlsm", "xlsb", "ods", "fods", "xml", "html", "htm"]);
const TABULAR_TEXT_EXTENSIONS = new Set(["csv", "tsv", "txt", "json"]);
const MAX_EVIDENCE_BYTES = 8_000_000;
const MAX_WORKBOOK_BYTES = 75_000_000;
const MAX_MANUAL_IMAGE_BYTES = 20_000_000;
const MAX_CLOUD_IMAGE_BYTES = 1_800_000;

function localDateTimeInput(date = new Date()) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function newManualTradeDraft(): ManualTradeDraft {
  return {
    name: "",
    symbol: "",
    side: "",
    contractClass: "",
    quantity: "",
    openedAt: "",
    closedAt: "",
    entryPrice: "",
    exitPrice: "",
    stopPrice: "",
    targetPrice: "",
    plannedRiskReward: "",
    initialRisk: "",
    netPnl: "",
    fees: "",
    tags: "",
    notes: "",
    improvements: "",
    tradingAccountName: "Prop firm",
    tradingAccountType: "",
    accountSize: "",
    rating: null,
  };
}

function manualTradeDraftFromTrade(trade: JournalTrade): ManualTradeDraft {
  const numberText = (value: number | null | undefined) => value === null || value === undefined ? "" : String(value);
  const validLocalTime = (value: string | null, known: boolean | undefined) => {
    if (!value || known === false) return "";
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? localDateTimeInput(new Date(timestamp)) : "";
  };
  return {
    name: trade.setup,
    symbol: trade.symbol,
    side: trade.side === "LONG" || trade.side === "SHORT" ? trade.side : "",
    contractClass: trade.contractClass ?? "",
    quantity: numberText(trade.quantity),
    openedAt: validLocalTime(trade.openedAt, trade.entryTimeKnown),
    closedAt: validLocalTime(trade.closedAt, trade.exitTimeKnown),
    entryPrice: numberText(trade.entryPrice),
    exitPrice: numberText(trade.exitPrice),
    stopPrice: numberText(trade.stopPrice),
    targetPrice: numberText(trade.targetPrice),
    plannedRiskReward: numberText(trade.plannedRiskReward),
    initialRisk: numberText(trade.initialRisk),
    netPnl: numberText(trade.netPnl),
    fees: trade.feesKnown === false ? "" : numberText(trade.fees),
    tags: trade.tags.join(", "),
    notes: trade.notes,
    improvements: trade.improvements ?? "",
    tradingAccountName: trade.tradingAccountName ?? "",
    tradingAccountType: trade.tradingAccountType ?? "",
    accountSize: numberText(trade.accountSize),
    rating: trade.rating,
  };
}

function appendDictatedText(current: string, transcript: string, separator = " ") {
  const spoken = transcript.trim();
  if (!spoken) return current;
  const existing = current.trimEnd();
  return `${existing}${existing ? separator : ""}${spoken}`;
}

function parseSpokenNumber(transcript: string) {
  const normalized = transcript
    .toLowerCase()
    .replace(/[$,%]/g, "")
    .replace(/,/g, "")
    .replace(/\bminus\b/g, "-")
    .trim();
  const digitMatch = normalized.match(/-?\d+(?:\.\d+)?/);
  if (digitMatch) return digitMatch[0];

  const small: Record<string, number> = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
    seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
    sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  };
  const words = normalized.replace(/-/g, " ").split(/\s+/).filter(Boolean);
  let total = 0;
  let group = 0;
  let negative = false;
  let recognized = false;
  let decimal = "";
  let readingDecimal = false;

  for (const word of words) {
    if (word === "negative" || word === "-") {
      negative = true;
      continue;
    }
    if (word === "point" || word === "dot") {
      readingDecimal = true;
      recognized = true;
      continue;
    }
    const value = small[word];
    if (readingDecimal) {
      if (value !== undefined && value >= 0 && value <= 9) decimal += String(value);
      continue;
    }
    if (value !== undefined) {
      group += value;
      recognized = true;
    } else if (word === "hundred") {
      group = Math.max(1, group) * 100;
      recognized = true;
    } else if (word === "thousand") {
      total += Math.max(1, group) * 1_000;
      group = 0;
      recognized = true;
    } else if (word === "million") {
      total += Math.max(1, group) * 1_000_000;
      group = 0;
      recognized = true;
    }
  }

  if (!recognized) return null;
  const value = (total + group) * (negative ? -1 : 1);
  return `${value}${decimal ? `.${decimal}` : ""}`;
}

function parseDictatedDateTime(transcript: string, current: string) {
  const normalized = transcript
    .replace(/(\d+)(st|nd|rd|th)\b/gi, "$1")
    .replace(/\b(at|on)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const hasDate = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|\d{4}|\d{1,2}[/-]\d{1,2}/i.test(normalized);
  const baseDate = current.slice(0, 10) || localDateTimeInput().slice(0, 10);
  const parsed = Date.parse(hasDate ? normalized : `${baseDate} ${normalized}`);
  return Number.isFinite(parsed) ? localDateTimeInput(new Date(parsed)) : null;
}

async function prepareManualEvidence(file: File) {
  if (!file.type.startsWith("image/") || file.size > MAX_MANUAL_IMAGE_BYTES) {
    throw new Error(`${file.name} must be an image smaller than 20 MB.`);
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    if (file.size <= MAX_CLOUD_IMAGE_BYTES) {
      return { name: file.name, mimeType: file.type, size: file.size, dataUrl: await fileToDataUrl(file) };
    }
    throw new Error(`${file.name} could not be prepared.`);
  }
  const scale = Math.min(1, 1_920 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error(`${file.name} could not be prepared.`);
  }
  context.fillStyle = "#000000";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let blob: Blob | null = null;
  for (const quality of [0.92, 0.86, 0.8, 0.72]) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= MAX_CLOUD_IMAGE_BYTES) break;
  }
  if (!blob || blob.size > MAX_CLOUD_IMAGE_BYTES) throw new Error(`${file.name} is still too large after high-quality compression.`);
  const prepared = new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  return { name: prepared.name, mimeType: prepared.type, size: prepared.size, dataUrl: await fileToDataUrl(prepared) };
}

function money(value: number | null, signed = true) {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = signed ? value > 0 ? "+" : value < 0 ? "−" : "" : value < 0 ? "−" : "";
  return `${sign}$${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function percent(value: number | null, digits = 1) {
  return value === null || !Number.isFinite(value) ? "—" : `${(value * 100).toFixed(digits)}%`;
}

function ratio(value: number | null) {
  if (value === Number.POSITIVE_INFINITY) return "∞";
  return value === null || !Number.isFinite(value) ? "—" : value.toFixed(2);
}

function riskReward(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  const reward = value < 0 ? `−${Math.abs(value).toFixed(2)}` : value.toFixed(2);
  return `1 : ${reward}`;
}

function tradingAccountTypeLabel(value: JournalTradingAccountType | undefined) {
  if (value === "LIVE_CAPITAL") return "Live capital";
  if (value === "EVALUATION") return "Evaluation";
  if (value === "FUNDED") return "Funded account";
  return "Not recorded";
}

function compact(value: number) {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "−" : value > 0 ? "+" : "";
  const formatMagnitude = (magnitude: number) => magnitude.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: magnitude >= 100 ? 0 : magnitude >= 10 ? 1 : 2,
  });
  if (absolute >= 1_000_000) return `${sign}$${formatMagnitude(absolute / 1_000_000)}M`;
  if (absolute >= 1_000) return `${sign}$${formatMagnitude(absolute / 1_000)}K`;
  return `${sign}$${absolute.toFixed(0)}`;
}

function formatDate(value: string | null, includeTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-AU", includeTime
    ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "short", year: "numeric" });
}

function formatDuration(durationMs: number | null) {
  if (durationMs === null || !Number.isFinite(durationMs)) return "—";
  const totalMinutes = Math.max(0, Math.round(durationMs / 60_000));
  if (totalMinutes < 60) return `${totalMinutes}m`;
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
}

function localDateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read the file."));
    reader.readAsDataURL(file);
  });
}

function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border bg-panel ${className}`}>{children}</div>;
}

function ResponsiveMetricValue({
  value,
  compactValue,
  className,
}: {
  value: string;
  compactValue?: string;
  className: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fullValueProbeRef = useRef<HTMLSpanElement>(null);
  const [showCompact, setShowCompact] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const fullValueProbe = fullValueProbeRef.current;
    if (!container || !fullValueProbe || !compactValue || compactValue === value) {
      setShowCompact(false);
      return;
    }

    const measure = () => {
      setShowCompact(fullValueProbe.scrollWidth > container.clientWidth);
    };
    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(fullValueProbe);
    return () => observer.disconnect();
  }, [compactValue, value]);

  return (
    <div ref={containerRef} className={`relative min-w-0 overflow-hidden ${className}`} title={value}>
      <span ref={fullValueProbeRef} aria-hidden="true" className="pointer-events-none invisible absolute whitespace-nowrap">{value}</span>
      <span className="block truncate whitespace-nowrap">{showCompact && compactValue ? compactValue : value}</span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  compactValue,
  detail,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  compactValue?: string;
  detail: string;
  icon: typeof Activity;
  tone?: "positive" | "negative" | "neutral";
}) {
  return (
    <Card className="min-w-0 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</span>
        <Icon className={`h-3.5 w-3.5 ${tone === "positive" ? "text-[var(--journal-win)]" : tone === "negative" ? "text-[var(--journal-loss)]" : "text-muted"}`} />
      </div>
      <ResponsiveMetricValue
        value={value}
        compactValue={compactValue}
        className={`mt-3 font-mono text-[22px] font-semibold ${tone === "positive" ? "text-[var(--journal-win)]" : tone === "negative" ? "text-[var(--journal-loss)]" : "text-foreground"}`}
      />
      <div className="mt-1 truncate text-[9px] text-muted">{detail}</div>
    </Card>
  );
}
function EquityCurve({ trades }: { trades: JournalTrade[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const geometry = useMemo(() => {
    const ordered = [...trades].sort((left, right) => Date.parse(left.closedAt ?? left.openedAt) - Date.parse(right.closedAt ?? right.openedAt));
    const oneAccount = new Set(ordered.map((trade) => trade.account)).size === 1;
    const recordedStartingBalance = oneAccount
      ? ordered.find((trade) => typeof trade.accountSize === "number" && trade.accountSize > 0)?.accountSize ?? null
      : null;
    const startingValue = recordedStartingBalance ?? 0;
    let cumulativePnl = 0;
    const points = [{
      index: 0,
      trade: null as JournalTrade | null,
      value: startingValue,
      cumulativePnl: 0,
      timestamp: ordered[0]?.openedAt ?? "",
    }, ...ordered.map((trade, index) => {
      cumulativePnl += trade.netPnl;
      return {
        index: index + 1,
        trade,
        value: startingValue + cumulativePnl,
        cumulativePnl,
        timestamp: trade.closedAt ?? trade.openedAt,
      };
    })];
    const width = 860;
    const height = 260;
    const left = 72;
    const right = 18;
    const top = 18;
    const bottom = 40;
    const values = points.map((point) => point.value);
    // Account-equity curves must scale around the recorded balance and actual
    // trade path. Including $0 beside a $50k account crushes every win/loss
    // into a visually flat line that no longer represents the trades.
    const minimum = recordedStartingBalance === null ? Math.min(0, ...values) : Math.min(...values);
    const maximum = recordedStartingBalance === null ? Math.max(0, ...values) : Math.max(...values);
    const rawSpan = Math.max(1, maximum - minimum);
    const padding = Math.max(rawSpan * 0.08, 1);
    const chartMinimum = minimum - padding;
    const chartMaximum = maximum + padding;
    const span = chartMaximum - chartMinimum;
    const x = (index: number) => left + index / Math.max(1, points.length - 1) * (width - left - right);
    const y = (value: number) => top + (chartMaximum - value) / span * (height - top - bottom);
    const baselineY = y(startingValue);
    const plottedPoints = points.map((point) => ({ ...point, x: x(point.index), y: y(point.value) }));
    const path = plottedPoints.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
    const yTicks = Array.from({ length: 5 }, (_, index) => {
      const ratio = index / 4;
      const value = chartMaximum - ratio * span;
      return { value, y: top + ratio * (height - top - bottom) };
    });
    const xTickCount = Math.min(6, Math.max(2, plottedPoints.length));
    const xTickIndexes = [...new Set(Array.from({ length: xTickCount }, (_, index) => (
      Math.round(index / Math.max(1, xTickCount - 1) * (plottedPoints.length - 1))
    )))];
    const xTicks = xTickIndexes.map((index) => plottedPoints[index]);
    return {
      width,
      height,
      left,
      right,
      top,
      bottom,
      path,
      area: `${path} L${width - right},${baselineY} L${left},${baselineY} Z`,
      zeroY: y(0),
      baselineY,
      final: points.at(-1)?.value ?? 0,
      finalPnl: points.at(-1)?.cumulativePnl ?? 0,
      points: plottedPoints,
      xTicks,
      yTicks,
      hasStartingBalance: recordedStartingBalance !== null,
    };
  }, [trades]);

  useEffect(() => setHoveredIndex(null), [trades]);

  if (!trades.length) return <div className="flex h-[260px] items-center justify-center text-[10px] text-muted">Import trades to build the equity curve.</div>;
  const hovered = hoveredIndex === null ? null : geometry.points[hoveredIndex] ?? null;
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const plotLeft = geometry.left / geometry.width * rect.width;
    const plotRight = geometry.right / geometry.width * rect.width;
    const plotWidth = Math.max(1, rect.width - plotLeft - plotRight);
    const relativeX = Math.max(0, Math.min(plotWidth, event.clientX - rect.left - plotLeft));
    setHoveredIndex(Math.round(relativeX / plotWidth * Math.max(0, geometry.points.length - 1)));
  };
  return (
    <div
      className="relative h-[260px] touch-none select-none"
      onPointerMove={onPointerMove}
      onPointerLeave={() => setHoveredIndex(null)}
      role="figure"
      aria-label="Interactive trade-by-trade equity curve"
    >
      <svg viewBox={`0 0 ${geometry.width} ${geometry.height}`} className="h-full w-full" preserveAspectRatio="none" role="img" aria-label="Cumulative imported net profit and loss by trade">
        <defs>
          <linearGradient id="journal-equity-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity=".24" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {geometry.yTicks.map((tick) => <line key={tick.y} x1={geometry.left} x2={geometry.width - geometry.right} y1={tick.y} y2={tick.y} stroke="var(--grid-color)" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
        {geometry.xTicks.map((tick) => <line key={tick.index} x1={tick.x} x2={tick.x} y1={geometry.top} y2={geometry.height - geometry.bottom} stroke="var(--grid-color)" strokeOpacity=".5" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
        <line x1={geometry.left} x2={geometry.width - geometry.right} y1={geometry.height - geometry.bottom} y2={geometry.height - geometry.bottom} stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <line x1={geometry.left} x2={geometry.left} y1={geometry.top} y2={geometry.height - geometry.bottom} stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <line x1={geometry.left} x2={geometry.width - geometry.right} y1={geometry.hasStartingBalance ? geometry.baselineY : geometry.zeroY} y2={geometry.hasStartingBalance ? geometry.baselineY : geometry.zeroY} stroke="var(--muted)" strokeOpacity=".45" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
        <path d={geometry.area} fill="url(#journal-equity-fill)" />
        <path d={geometry.path} fill="none" stroke={geometry.finalPnl >= 0 ? "var(--journal-win)" : "var(--journal-loss)"} strokeWidth="2.25" vectorEffect="non-scaling-stroke" />
        {hovered ? <>
          <line x1={hovered.x} x2={hovered.x} y1={geometry.top} y2={geometry.height - geometry.bottom} stroke="var(--foreground)" strokeOpacity=".45" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          <line x1={geometry.left} x2={geometry.width - geometry.right} y1={hovered.y} y2={hovered.y} stroke="var(--foreground)" strokeOpacity=".28" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          <circle cx={hovered.x} cy={hovered.y} r="4.5" fill="var(--background)" stroke="var(--primary)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </> : null}
      </svg>
      {geometry.yTicks.map((tick) => <span key={tick.y} className="pointer-events-none absolute left-0 w-[64px] -translate-y-1/2 text-right font-mono text-[7px] text-muted" style={{ top: `${tick.y / geometry.height * 100}%` }}>{compact(tick.value)}</span>)}
      {geometry.xTicks.map((tick) => <span key={tick.index} className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap font-mono text-[7px] text-muted" style={{ left: `${tick.x / geometry.width * 100}%`, bottom: 3 }}>{tick.index === 0 ? "START" : new Date(tick.timestamp).toLocaleDateString("en-AU", { day: "2-digit", month: "short" })}</span>)}
      <span className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">Trade sequence / close date</span>
      <span className="pointer-events-none absolute left-[-17px] top-1/2 -rotate-90 text-[7px] font-semibold uppercase tracking-[0.12em] text-muted">{geometry.hasStartingBalance ? "Account equity" : "Cumulative P&L"}</span>
      <span className={`absolute right-2 top-2 rounded-lg border border-border bg-background/85 px-2 py-1 font-mono text-[10px] backdrop-blur ${geometry.finalPnl >= 0 ? "text-[var(--journal-win)]" : "text-[var(--journal-loss)]"}`}>{geometry.hasStartingBalance ? money(geometry.final) : compact(geometry.finalPnl)}</span>
      {hovered ? <div
        className="pointer-events-none absolute z-10 min-w-[188px] rounded-xl border border-border bg-background/95 p-3 shadow-2xl backdrop-blur-xl"
        style={{
          left: `${hovered.x / geometry.width * 100}%`,
          top: `${Math.max(8, Math.min(66, hovered.y / geometry.height * 100))}%`,
          transform: hovered.x > geometry.width * 0.7 ? "translate(-105%, -50%)" : "translate(12px, -50%)",
        }}
      >
        {hovered.trade ? <>
          <div className="flex items-center justify-between gap-3"><span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">Trade #{hovered.index}</span><span className={`font-mono text-[10px] font-semibold ${hovered.trade.netPnl >= 0 ? "text-[var(--journal-win)]" : "text-[var(--journal-loss)]"}`}>{money(hovered.trade.netPnl)}</span></div>
          <div className="mt-2 text-[10px] font-semibold text-foreground">{hovered.trade.symbol} · {hovered.trade.side} · {hovered.trade.quantity} contract{hovered.trade.quantity === 1 ? "" : "s"}</div>
          <div className="mt-1 font-mono text-[8px] text-muted">{hovered.trade.entryPrice ?? "—"} → {hovered.trade.exitPrice ?? "—"}</div>
          <div className="mt-1 text-[8px] text-muted">{new Date(hovered.timestamp).toLocaleString("en-AU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
          <div className="mt-2 border-t border-border pt-2 text-[8px] text-muted"><span>{geometry.hasStartingBalance ? "Account equity" : "Cumulative P&L"}</span><span className="float-right font-mono text-foreground">{money(hovered.value)}</span></div>
        </> : <><div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">Starting point</div><div className="mt-2 font-mono text-[11px] font-semibold text-foreground">{money(hovered.value)}</div></>}
      </div> : null}
    </div>
  );
}
function DailyBars({ trades }: { trades: JournalTrade[] }) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const days = useMemo(() => {
    const grouped = new Map<string, number>();
    trades.forEach((trade) => {
      const key = localDateKey(trade.closedAt ?? trade.openedAt);
      if (key) grouped.set(key, (grouped.get(key) ?? 0) + trade.netPnl);
    });
    return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).slice(-18);
  }, [trades]);
  const maximum = Math.max(1, ...days.map(([, value]) => Math.abs(value)));
  const hovered = hoveredDate ? days.find(([date]) => date === hoveredDate) ?? null : null;
  if (!days.length) return <div className="flex h-[176px] items-center justify-center text-[10px] text-muted">Daily performance appears after import.</div>;
  return (
    <div
      className="relative h-[196px] select-none pt-4"
      role="figure"
      aria-label="Daily profit and loss around a zero-dollar baseline"
      onPointerLeave={() => setHoveredDate(null)}
    >
      <div className="pointer-events-none absolute right-2 top-2 z-10 rounded-lg border border-border bg-background/90 px-2 py-1 font-mono text-[8px] shadow-lg backdrop-blur">
        {hovered
          ? <><span className="mr-2 text-muted">{new Date(`${hovered[0]}T12:00:00`).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}</span><span className={hovered[1] >= 0 ? "text-[var(--journal-win)]" : "text-[var(--journal-loss)]"}>{money(hovered[1])}</span></>
          : <span className="text-muted">Hover a traded day</span>}
      </div>

      <div className="absolute inset-x-2 bottom-7 top-7 pl-12">
        <div className="pointer-events-none absolute bottom-1/2 left-12 right-0 border-t border-foreground/35" />
        <div className="pointer-events-none absolute left-12 right-0 top-0 border-t border-border/35" />
        <div className="pointer-events-none absolute bottom-0 left-12 right-0 border-t border-border/35" />
        <span className="pointer-events-none absolute left-0 top-0 -translate-y-1/2 font-mono text-[7px] text-primary">{compact(maximum)}</span>
        <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 font-mono text-[7px] text-foreground/70">$0</span>
        <span className="pointer-events-none absolute bottom-0 left-0 translate-y-1/2 font-mono text-[7px] text-danger">{compact(-maximum)}</span>

        <div className="absolute inset-y-0 left-12 right-0 grid items-stretch gap-1.5" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map(([date, value]) => {
            const magnitude = Math.abs(value) / maximum * 50;
            const isPositive = value >= 0;
            return (
              <button
                key={date}
                type="button"
                className="group relative min-w-0 outline-none"
                title={`${date}: ${money(value)}`}
                aria-label={`${date}: ${money(value)}`}
                onPointerEnter={() => setHoveredDate(date)}
                onFocus={() => setHoveredDate(date)}
                onBlur={() => setHoveredDate(null)}
              >
                <span
                  className={`absolute left-1/2 w-[72%] max-w-6 -translate-x-1/2 transition-[filter,opacity] duration-150 group-hover:brightness-125 group-focus-visible:ring-1 group-focus-visible:ring-foreground ${isPositive ? "bottom-1/2 rounded-t-md bg-primary" : "top-1/2 rounded-b-md bg-danger"}`}
                  style={{ height: `${Math.max(value === 0 ? 1.5 : 3, magnitude)}%` }}
                />
                <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 -rotate-45 whitespace-nowrap font-mono text-[7px] text-muted group-hover:text-foreground">{date.slice(5)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
function groupPerformance(trades: JournalTrade[], key: (trade: JournalTrade) => string) {
  const groups = new Map<string, JournalTrade[]>();
  for (const trade of trades) {
    const label = key(trade) || "Unclassified";
    groups.set(label, [...(groups.get(label) ?? []), trade]);
  }
  return [...groups.entries()].map(([label, rows]) => {
    const stats = calculateJournalStats(rows);
    return { label, rows, ...stats };
  }).sort((left, right) => right.netPnl - left.netPnl);
}

function PerformanceList({ title, rows }: { title: string; rows: ReturnType<typeof groupPerformance> }) {
  const maximum = Math.max(1, ...rows.map((row) => Math.abs(row.netPnl)));
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-[11px] font-semibold text-foreground">{title}</h3>
        <p className="mt-0.5 text-[8px] text-muted">Imported net P&amp;L with sample size and win rate</p>
      </div>
      <div className="divide-y divide-border/65">
        {rows.slice(0, 12).map((row) => (
          <div key={row.label} className="grid grid-cols-[110px_minmax(80px,1fr)_76px_54px] items-center gap-3 px-4 py-2.5 text-[9px]">
            <span className="truncate font-semibold text-foreground" title={row.label}>{row.label}</span>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface">
              <div className={`h-full rounded-full ${row.netPnl >= 0 ? "bg-[var(--journal-win)]" : "bg-[var(--journal-loss)]"}`} style={{ width: `${Math.max(3, Math.abs(row.netPnl) / maximum * 100)}%` }} />
            </div>
            <span className={`text-right font-mono font-semibold ${row.netPnl >= 0 ? "text-[var(--journal-win)]" : "text-[var(--journal-loss)]"}`}>{compact(row.netPnl)}</span>
            <span className="text-right font-mono text-muted">{row.tradeCount} · {percent(row.winRate, 0)}</span>
          </div>
        ))}
        {!rows.length ? <div className="px-4 py-10 text-center text-[10px] text-muted">No qualifying trades.</div> : null}
      </div>
    </Card>
  );
}

function AnalysisConfidenceBadge({ value }: { value: JournalQuantAnalysis["confidence"] }) {
  const tone = value === "HIGH"
    ? "border-primary/25 bg-primary/10 text-primary"
    : value === "MODERATE"
      ? "border-warning/25 bg-warning/10 text-warning"
      : "border-border bg-surface text-muted";
  return <span className={`rounded-full border px-2 py-1 text-[7px] font-semibold tracking-[0.1em] ${tone}`}>{value} CONFIDENCE</span>;
}

function AnalysisFindingCard({
  finding,
  kind,
}: {
  finding: JournalAnalysisFinding | JournalAnalysisLeak;
  kind: "strength" | "edge" | "leak";
}) {
  const tone = kind === "leak" ? "text-danger" : kind === "edge" ? "text-accent" : "text-primary";
  const Icon = kind === "leak" ? CircleAlert : kind === "edge" ? Target : TrendingUp;
  return (
    <div className="rounded-2xl border border-border bg-background/35 p-4">
      <div className="flex items-start gap-2.5">
        <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-surface ${tone}`}><Icon className="h-3.5 w-3.5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-[10px] font-semibold text-foreground">{finding.title}</h4>
            <AnalysisConfidenceBadge value={finding.confidence} />
          </div>
          <div className="mt-2 rounded-xl border border-border/70 bg-panel px-3 py-2 font-mono text-[8px] leading-4 text-muted">{finding.evidence}</div>
          <p className="mt-2 text-[9px] leading-[1.55] text-muted">{finding.interpretation}</p>
          {"correction" in finding ? (
            <div className="mt-3 border-l-2 border-primary/55 pl-3">
              <div className="text-[7px] font-semibold uppercase tracking-[0.14em] text-primary">Correction</div>
              <p className="mt-1 text-[9px] leading-[1.55] text-foreground/90">{finding.correction}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
/**
 * The journal's win and loss colours, from whatever theme is on.
 *
 * Read from the CSS variables the theme actually applied rather than from a
 * stored preset, so this cannot disagree with what is on screen, and refreshed
 * on the same event every other themed surface listens to.
 */
function useOutcomeColors(): OutcomeColors {
  const [colors, setColors] = useState<OutcomeColors>(() => ({
    win: SEMANTIC_WIN,
    loss: SEMANTIC_LOSS,
    winSoft: `color-mix(in srgb, ${SEMANTIC_WIN} 8%, transparent)`,
    lossSoft: `color-mix(in srgb, ${SEMANTIC_LOSS} 8%, transparent)`,
  }));
  useEffect(() => {
    const read = () => {
      const style = getComputedStyle(document.documentElement);
      const value = (name: string) => style.getPropertyValue(name).trim();
      setColors(resolveOutcomeColors({
        up: value("--candle-up"),
        upOutline: value("--candle-up-border"),
        down: value("--candle-down"),
        downOutline: value("--candle-down-border"),
        primary: value("--primary"),
        accent: value("--accent"),
        danger: value("--danger"),
        background: value("--background"),
      }));
    };
    read();
    window.addEventListener("kwantdesk:theme-change", read);
    return () => window.removeEventListener("kwantdesk:theme-change", read);
  }, []);
  return colors;
}

export default function JournalWorkspace({ accountKey }: { accountKey: string }) {
  const outcomeColors = useOutcomeColors();
  const resolvedAccountKey = accountKey || "local";
  const initialMemory = JOURNAL_MEMORY_CACHE.get(resolvedAccountKey);
  const [state, setState] = useState<JournalState>(() => initialMemory?.state ?? EMPTY_JOURNAL_STATE);
  const [zyonTrades, setZyonTrades] = useState<JournalTrade[]>(() => initialMemory?.zyonTrades ?? []);
  const [zyonLoading, setZyonLoading] = useState(() => !initialMemory);
  const [ready, setReady] = useState(() => Boolean(initialMemory));
  const [saveStatus, setSaveStatus] = useState<"loading" | "saved" | "error">(() => initialMemory ? "saved" : "loading");
  const [cloudState, setCloudState] = useState<JournalCloudState>(() => initialMemory?.cloudState ?? "loading");
  const [tab, setTab] = useState<JournalTab>(() => initialMemory?.tab ?? "pulse");
  const [journalAnalysis, setJournalAnalysis] = useState<JournalQuantAnalysis | null>(null);
  const [analysisLoadedAccount, setAnalysisLoadedAccount] = useState("");
  const [analysisStatus, setAnalysisStatus] = useState<"idle" | "loading" | "generating" | "ready" | "error">("idle");
  const [analysisError, setAnalysisError] = useState("");
  const [analysisElapsedSeconds, setAnalysisElapsedSeconds] = useState(0);
  const [showImport, setShowImport] = useState(false);
  const [accountCreationMode, setAccountCreationMode] = useState<AccountCreationMode>("manual");
  const [importDialogPurpose, setImportDialogPurpose] = useState<ImportDialogPurpose>("add-account");
  const [importAccount, setImportAccount] = useState("Imported account");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [importDragging, setImportDragging] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [showManualTrade, setShowManualTrade] = useState(false);
  const [manualTrade, setManualTrade] = useState<ManualTradeDraft>(() => newManualTradeDraft());
  const [manualEvidenceFiles, setManualEvidenceFiles] = useState<File[]>([]);
  const [manualEvidenceDragging, setManualEvidenceDragging] = useState(false);
  const [manualTradeError, setManualTradeError] = useState("");
  const [manualTradeSaving, setManualTradeSaving] = useState(false);
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [tradeMenuId, setTradeMenuId] = useState<{ tradeId: string; x: number; y: number } | null>(null);
  const [deleteTradeTargetId, setDeleteTradeTargetId] = useState<string | null>(null);
  const [tradeMutationError, setTradeMutationError] = useState("");
  const [showTradePost, setShowTradePost] = useState(false);
  const [postTradeId, setPostTradeId] = useState("");
  const [postTradeCaption, setPostTradeCaption] = useState("");
  const [postTradeSaving, setPostTradeSaving] = useState(false);
  const [postTradeError, setPostTradeError] = useState("");
  const [accountMenu, setAccountMenu] = useState<{ account: string; x: number; y: number } | null>(null);
  const [renameJournalTarget, setRenameJournalTarget] = useState<string | null>(null);
  const [renameJournalDraft, setRenameJournalDraft] = useState("");
  const [renameJournalError, setRenameJournalError] = useState("");
  const [draggedJournal, setDraggedJournal] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [deleteJournalTarget, setDeleteJournalTarget] = useState<string | null>(null);
  const [journalLifecycleBusy, setJournalLifecycleBusy] = useState<string | null>(null);
  const [journalLifecycleMessage, setJournalLifecycleMessage] = useState("");
  const [query, setQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState(() => initialMemory?.accountFilter ?? "all");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("closedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const manualEvidenceInputRef = useRef<HTMLInputElement>(null);
  const manualTradeTouchedRef = useRef(new Set<keyof ManualTradeDraft>());
  const analysisRequestRef = useRef(0);
  const analysisAbortRef = useRef<AbortController | null>(null);

  const applyManualTradeTranscript = useCallback((field: ManualTradeDictationField, transcript: string) => {
    manualTradeTouchedRef.current.add(field);
    setManualTradeError("");
    setManualTrade((current) => {
      let value = current[field];
      if (MANUAL_TRADE_NUMBER_FIELDS.has(field)) {
        const parsed = parseSpokenNumber(transcript);
        if (parsed === null) return current;
        value = parsed;
      } else if (field === "openedAt" || field === "closedAt") {
        const parsed = parseDictatedDateTime(transcript, current[field]);
        if (!parsed) return current;
        value = parsed;
      } else if (field === "side") {
        const normalized = transcript.toLowerCase();
        if (/\b(long|buy|bought)\b/.test(normalized)) value = "LONG";
        else if (/\b(short|sell|sold)\b/.test(normalized)) value = "SHORT";
        else return current;
      } else if (field === "contractClass") {
        const normalized = transcript.toLowerCase();
        if (/\bmicro\b/.test(normalized)) value = "MICRO";
        else if (/\bmini\b/.test(normalized)) value = "MINI";
        else if (/\bother\b/.test(normalized)) value = "OTHER";
        else return current;
      } else if (field === "tradingAccountType") {
        const normalized = transcript.toLowerCase();
        if (/\b(live|personal|capital)\b/.test(normalized)) value = "LIVE_CAPITAL";
        else if (/\b(eval|evaluation|challenge)\b/.test(normalized)) value = "EVALUATION";
        else if (/\b(funded|funding)\b/.test(normalized)) value = "FUNDED";
        else return current;
      } else if (field === "symbol") {
        value = transcript.toUpperCase().replace(/[^A-Z0-9._-]/g, "").slice(0, 32);
      } else if (field === "tags") {
        value = appendDictatedText(current.tags, transcript, ", ");
      } else {
        value = appendDictatedText(current[field], transcript);
      }
      return { ...current, [field]: value };
    });
  }, []);

  const manualDictation = usePersistentFieldDictation<ManualTradeDictationField>({
    initialField: "name",
    onTranscript: applyManualTradeTranscript,
    disabled: !showManualTrade || manualTradeSaving,
  });

  const zyonJournalSelected = accountFilter === ZYON_JOURNAL_ACCOUNT;
  const importTargetsZyon = isZyonJournalAccountName(importAccount);

  useEffect(() => {
    let active = true;
    const memory = JOURNAL_MEMORY_CACHE.get(resolvedAccountKey);
    if (memory) {
      setState(memory.state);
      setZyonTrades(memory.zyonTrades);
      setZyonLoading(false);
      setCloudState(memory.cloudState);
      setTab(memory.tab);
      setAccountFilter(memory.accountFilter);
      setReady(true);
      setSaveStatus("saved");
    } else {
      setReady(false);
      setSaveStatus("loading");
    }
    Promise.all([
      loadJournalState(resolvedAccountKey),
      fetch("/api/journal", { cache: "no-store" })
        .then(async (response): Promise<CloudJournalResponse> => response.ok ? response.json() as Promise<CloudJournalResponse> : { cloud: false })
        .catch((): CloudJournalResponse => ({ cloud: false })),
    ]).then(([stored, cloud]) => {
      if (!active) return;
      const cloudAccounts = Array.isArray(cloud.accounts) ? cloud.accounts : [];
      const cloudTrades = Array.isArray(cloud.trades) ? cloud.trades : [];
      const cloudImports = Array.isArray(cloud.imports) ? cloud.imports : [];
      const cloudEvidence = Array.isArray(cloud.evidence) ? cloud.evidence : [];
      const accounts = new Map(stored.accounts.map((account) => [account.id, account]));
      memory?.state.accounts.forEach((account) => accounts.set(account.id, account));
      cloudAccounts.forEach((account) => accounts.set(account.id, account));
      const trades = new Map(stored.trades.map((trade) => [trade.id, trade]));
      memory?.state.trades.forEach((trade) => trades.set(trade.id, trade));
      cloudTrades.forEach((trade) => trades.set(trade.id, trade));
      const imports = new Map(stored.imports.map((batch) => [batch.id, batch]));
      memory?.state.imports.forEach((batch) => imports.set(batch.id, batch));
      cloudImports.forEach((batch) => imports.set(batch.id, batch));
      const evidence = new Map(stored.evidence.map((item) => [item.id, item]));
      memory?.state.evidence.forEach((item) => evidence.set(item.id, item));
      cloudEvidence.forEach((item) => evidence.set(item.id, item));
      const merged = {
        ...stored,
        accounts: [...accounts.values()],
        trades: [...trades.values()],
        evidence: [...evidence.values()],
        imports: [...imports.values()],
      };
      setState(merged);
      setCloudState(cloud.cloud ? "cloud" : "local");
      setReady(true);
      setSaveStatus("saved");
      JOURNAL_MEMORY_CACHE.set(resolvedAccountKey, {
        state: merged,
        zyonTrades: memory?.zyonTrades ?? [],
        cloudState: cloud.cloud ? "cloud" : "local",
        tab: memory?.tab ?? "pulse",
        accountFilter: memory?.accountFilter ?? "all",
        updatedAt: Date.now(),
      });

      if (cloud.cloud && (stored.trades.length || stored.imports.length)) {
        const accountNames = [...new Set([
          ...stored.trades.map((trade) => trade.account),
          ...stored.imports.map((batch) => batch.account),
        ].filter((name) => name && !isZyonJournalAccountName(name)))];
        accountNames.forEach((account) => {
          void fetch("/api/journal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "sync",
              account,
              accountId: stored.accounts.find((candidate) => candidate.name === account)?.id,
              trades: stored.trades.filter((trade) => trade.account === account),
              imports: stored.imports.filter((batch) => batch.account === account),
            }),
          });
        });
      }
    }).catch(() => {
      if (!active) return;
      setReady(true);
      setSaveStatus("error");
      if (!memory) setCloudState("local");
    });
    return () => {
      active = false;
    };
  }, [resolvedAccountKey]);

  useEffect(() => {
    if (!ready) return;
    JOURNAL_MEMORY_CACHE.set(resolvedAccountKey, {
      state,
      zyonTrades,
      cloudState,
      tab,
      accountFilter,
      updatedAt: Date.now(),
    });
  }, [accountFilter, cloudState, ready, resolvedAccountKey, state, tab, zyonTrades]);

  const loadZyonOutcomes = useCallback(async () => {
    try {
      const response = await fetch("/api/socials?mine=1&types=precord,receipt", { cache: "no-store" });
      if (!response.ok) throw new Error("ZYON outcomes could not be loaded.");
      const data = await response.json() as SocialJournalResponse;
      if (!data.viewerId || !Array.isArray(data.objects)) throw new Error("ZYON outcome storage is unavailable.");
      setZyonTrades(zyonOutcomesToJournalTrades(data.objects, data.viewerId));
    } catch {
      setZyonTrades([]);
    } finally {
      setZyonLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadZyonOutcomes();
    const refresh = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadZyonOutcomes();
    }, 30_000);
    const onFocus = () => void loadZyonOutcomes();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(refresh);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadZyonOutcomes]);

  useEffect(() => {
    if (!ready) return;
    setSaveStatus("loading");
    const timer = window.setTimeout(() => {
      void saveJournalState(resolvedAccountKey, state).then((saved) => setSaveStatus(saved ? "saved" : "error"));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [ready, resolvedAccountKey, state]);

  const archivedAccountNames = useMemo(
    () => new Set(state.accounts.filter((account) => Boolean(account.archivedAt)).map((account) => account.name)),
    [state.accounts],
  );
  const archivedAccounts = useMemo(
    () => state.accounts.filter((account) => Boolean(account.archivedAt)).sort((left, right) => Date.parse(right.archivedAt ?? "") - Date.parse(left.archivedAt ?? "")),
    [state.accounts],
  );
  const customAccounts = useMemo(() => {
    const activeAccounts = state.accounts
      .filter((account) => account.name && !isZyonJournalAccountName(account.name) && !account.archivedAt)
      .map((account, index) => ({ account, index }))
      .sort((left, right) => {
        const leftOrder = left.account.sortOrder;
        const rightOrder = right.account.sortOrder;
        if (leftOrder !== null && leftOrder !== undefined && rightOrder !== null && rightOrder !== undefined && leftOrder !== rightOrder) return leftOrder - rightOrder;
        if (leftOrder !== null && leftOrder !== undefined) return -1;
        if (rightOrder !== null && rightOrder !== undefined) return 1;
        return left.index - right.index;
      })
      .map(({ account }) => account.name);
    const known = new Set(activeAccounts);
    const orphaned = [
      ...state.trades.map((trade) => trade.account),
      ...state.evidence.map((item) => item.account),
      ...state.imports.map((item) => item.account),
    ].filter((account) => account && !known.has(account) && !isZyonJournalAccountName(account) && !archivedAccountNames.has(account));
    return [...activeAccounts, ...new Set(orphaned)];
  }, [archivedAccountNames, state.accounts, state.evidence, state.imports, state.trades]);
  const accounts = useMemo(() => [ZYON_JOURNAL_ACCOUNT, ...customAccounts], [customAccounts]);
  const accountSource = useMemo(() => new Map(state.accounts.map((account) => [account.name, account.source])), [state.accounts]);
  const accountRecord = useMemo(() => new Map(state.accounts.map((account) => [account.name, account])), [state.accounts]);
  const allTrades = useMemo(
    () => [...zyonTrades, ...state.trades.filter((trade) => !isZyonJournalAccountName(trade.account) && !archivedAccountNames.has(trade.account))],
    [archivedAccountNames, state.trades, zyonTrades],
  );
  const accountViews = useMemo(() => [
    {
      id: "all",
      label: "Overall Journal",
      detail: "Every connected account",
      stats: calculateJournalStats(allTrades),
      icon: BookOpen,
    },
    ...accounts.map((account) => {
      const accountTrades = allTrades.filter((trade) => trade.account === account);
      return {
        id: account,
        label: account,
        detail: account === ZYON_JOURNAL_ACCOUNT
          ? "Reviewed ZYON Gameplans"
          : accountSource.get(account) === "manual"
            ? "Native KwantDesk Journal"
          : `${accountTrades.length} imported trade${accountTrades.length === 1 ? "" : "s"}`,
        stats: calculateJournalStats(accountTrades),
        icon: account === ZYON_JOURNAL_ACCOUNT ? Bot : accountSource.get(account) === "manual" ? NotebookPen : FileSpreadsheet,
      };
    }),
  ], [accountSource, accounts, allTrades]);
  const archivedAccountViews = useMemo(() => archivedAccounts.map((account) => ({
    ...account,
    stats: calculateJournalStats(state.trades.filter((trade) => trade.account === account.name)),
  })), [archivedAccounts, state.trades]);

  const filteredTrades = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = allTrades.filter((trade) => {
      if (accountFilter !== "all" && trade.account !== accountFilter) return false;
      if (outcomeFilter === "wins" && trade.netPnl <= 0) return false;
      if (outcomeFilter === "losses" && trade.netPnl >= 0) return false;
      if (outcomeFilter === "breakeven" && trade.netPnl !== 0) return false;
      if (outcomeFilter === "needs-review" && trade.reviewedAt) return false;
      if (normalizedQuery && ![
        trade.symbol,
        trade.account,
        trade.setup,
        trade.notes,
        trade.improvements ?? "",
        trade.sourceFile,
        ...trade.tags,
      ].some((value) => value.toLowerCase().includes(normalizedQuery))) return false;
      return true;
    });
    return filtered.sort((left, right) => {
      let comparison = 0;
      if (sortKey === "closedAt") comparison = Date.parse(left.closedAt ?? left.openedAt) - Date.parse(right.closedAt ?? right.openedAt);
      if (sortKey === "netPnl") comparison = left.netPnl - right.netPnl;
      if (sortKey === "rMultiple") comparison = (left.rMultiple ?? Number.NEGATIVE_INFINITY) - (right.rMultiple ?? Number.NEGATIVE_INFINITY);
      if (sortKey === "quantity") comparison = left.quantity - right.quantity;
      if (sortKey === "symbol") comparison = left.symbol.localeCompare(right.symbol);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [accountFilter, allTrades, outcomeFilter, query, sortDirection, sortKey]);
  const postableTrades = useMemo(
    () => allTrades
      .filter((trade) => (accountFilter === "all" || trade.account === accountFilter) && trade.entryPrice !== null && trade.exitPrice !== null)
      .sort((left, right) => Date.parse(right.closedAt ?? right.openedAt) - Date.parse(left.closedAt ?? left.openedAt)),
    [accountFilter, allTrades],
  );

  const filteredEvidence = useMemo(
    () => state.evidence.filter((item) => !isZyonJournalAccountName(item.account) && !archivedAccountNames.has(item.account) && (accountFilter === "all" || item.account === accountFilter)),
    [accountFilter, archivedAccountNames, state.evidence],
  );
  const filteredImports = useMemo(
    () => state.imports.filter((item) => !archivedAccountNames.has(item.account) && (accountFilter === "all" || item.account === accountFilter)),
    [accountFilter, archivedAccountNames, state.imports],
  );
  const analysisAccount = accountFilter === "all" ? "Overall Journal" : accountFilter;
  const analysisTrades = useMemo(
    () => allTrades.filter((trade) => accountFilter === "all" || trade.account === accountFilter),
    [accountFilter, allTrades],
  );
  const analysisEvidenceItems = useMemo(
    () => state.evidence.filter((item) => !archivedAccountNames.has(item.account) && (accountFilter === "all" || item.account === accountFilter)),
    [accountFilter, archivedAccountNames, state.evidence],
  );
  const analysisEvidence = useMemo(
    () => buildJournalAnalysisEvidence(analysisAccount, analysisTrades, analysisEvidenceItems),
    [analysisAccount, analysisEvidenceItems, analysisTrades],
  );
  const stats = useMemo(() => calculateJournalStats(filteredTrades, filteredEvidence), [filteredEvidence, filteredTrades]);
  const advancedStats = useMemo(() => calculateJournalAdvancedStats(filteredTrades), [filteredTrades]);
  const selectedTrade = allTrades.find((trade) => trade.id === selectedTradeId) ?? null;
  const editingTrade = allTrades.find((trade) => trade.id === editingTradeId) ?? null;
  const deleteTradeTarget = allTrades.find((trade) => trade.id === deleteTradeTargetId) ?? null;
  const tradeMenuTarget = allTrades.find((trade) => trade.id === tradeMenuId?.tradeId) ?? null;
  const postTrade = postableTrades.find((trade) => trade.id === postTradeId) ?? null;
  const selectedTradeIsZyon = Boolean(selectedTrade?.sourceImportId.startsWith("zyon:"));
  const selectedEvidence = state.evidence.find((item) => item.id === selectedEvidenceId) ?? null;
  const selectedAccountIsManual = accountFilter !== "all" && accountSource.get(accountFilter) === "manual";
  const entryExitComplete = stats.tradeCount
    ? filteredTrades.filter((trade) => trade.entryPrice !== null && trade.exitPrice !== null && trade.side !== "UNKNOWN").length / stats.tradeCount
    : null;
  const riskComplete = stats.tradeCount
    ? filteredTrades.filter((trade) => trade.initialRisk !== null || trade.rMultiple !== null).length / stats.tradeCount
    : null;
  const evidencePercent = stats.tradeCount ? stats.evidenceLinkedCount / stats.tradeCount : null;
  const reviewIntegrity = stats.tradeCount
    ? Math.round(((entryExitComplete ?? 0) * 0.45 + (stats.reviewedPercent ?? 0) * 0.4 + (evidencePercent ?? 0) * 0.15) * 100)
    : 0;
  const unreviewed = filteredTrades.filter((trade) => !trade.reviewedAt);
  const analysisIsStale = Boolean(journalAnalysis && journalAnalysis.fingerprint !== analysisEvidence.fingerprint);
  const analysisProgress = analysisElapsedSeconds < 4
    ? { title: "Validating journal evidence", detail: "Locking the account sample, calculations and data-quality limits" }
    : analysisElapsedSeconds < 11
      ? { title: "Testing the performance structure", detail: "Expectancy, payoff shape, drawdown, loss concentration and risk consistency" }
      : analysisElapsedSeconds < 21
        ? { title: "Separating edge from concentration", detail: "Comparing setups, symbols, direction, timing and recent-versus-prior behaviour" }
        : analysisElapsedSeconds < 48
          ? { title: "Writing the mentor report", detail: "Ranking evidence-cited strengths, leaks and measurable interventions" }
          : { title: "Verifying every conclusion", detail: "Checking samples, confidence labels and the final structured report before release" };

  useEffect(() => {
    if (analysisStatus !== "generating") {
      setAnalysisElapsedSeconds(0);
      return;
    }
    const startedAt = Date.now();
    setAnalysisElapsedSeconds(0);
    const interval = window.setInterval(() => {
      setAnalysisElapsedSeconds(Math.floor((Date.now() - startedAt) / 1_000));
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [analysisStatus]);

  useEffect(() => () => analysisAbortRef.current?.abort(), []);

  useEffect(() => {
    if (!tradeMenuId) return;
    const close = () => setTradeMenuId(null);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [tradeMenuId]);

  useEffect(() => {
    if (tab !== "analysis") return;
    if (analysisLoadedAccount === analysisAccount) return;
    const controller = new AbortController();
    const requestId = ++analysisRequestRef.current;
    setAnalysisStatus("loading");
    setAnalysisError("");
    setJournalAnalysis(null);
    void fetch(`/api/journal/analysis?account=${encodeURIComponent(analysisAccount)}`, {
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      const result = await response.json() as JournalAnalysisResponse;
      if (!response.ok) throw new Error(result.error || "The saved analysis could not be loaded.");
      if (controller.signal.aborted || requestId !== analysisRequestRef.current) return;
      setJournalAnalysis(result.analysis ?? null);
      setAnalysisLoadedAccount(analysisAccount);
      setAnalysisStatus("ready");
    }).catch((error: unknown) => {
      if (controller.signal.aborted || requestId !== analysisRequestRef.current) return;
      setAnalysisStatus("error");
      setAnalysisError(error instanceof Error ? error.message : "The saved analysis could not be loaded.");
    });
    return () => controller.abort();
  }, [analysisAccount, analysisLoadedAccount, tab]);

  const runJournalAnalysis = useCallback(async () => {
    if (analysisEvidence.performance.trades < 3) {
      setAnalysisError("Add at least three closed trades before running a quantitative review.");
      return;
    }
    setAnalysisStatus("generating");
    setAnalysisError("");
    const requestId = ++analysisRequestRef.current;
    analysisAbortRef.current?.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 88_000);
    try {
      const response = await fetch("/api/journal/analysis", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: analysisAccount, evidence: analysisEvidence }),
      });
      const result = await response.json() as JournalAnalysisResponse;
      if (!response.ok || !result.analysis) throw new Error(result.error || "The mentor could not complete this analysis.");
      if (requestId === analysisRequestRef.current) {
        setJournalAnalysis(result.analysis);
        setAnalysisLoadedAccount(analysisAccount);
        setAnalysisStatus("ready");
      }
    } catch (error) {
      if (requestId !== analysisRequestRef.current) return;
      setAnalysisStatus("error");
      setAnalysisError(error instanceof DOMException && error.name === "AbortError"
        ? "The quantitative mentor exceeded 88 seconds. Your journal is safe; run the analysis again."
        : error instanceof Error ? error.message : "The mentor could not complete this analysis.");
    } finally {
      window.clearTimeout(timeout);
      if (analysisAbortRef.current === controller) analysisAbortRef.current = null;
    }
  }, [analysisAccount, analysisEvidence]);

  const openAddAccountDialog = useCallback(() => {
    setImportDialogPurpose("add-account");
    setAccountCreationMode("manual");
    setImportAccount("My KwantDesk Journal");
    setPendingFiles([]);
    setImportMessage("");
    setShowImport(true);
  }, []);

  const openImportIntoJournal = useCallback((account: string) => {
    const target = account.trim();
    if (!target || target === "all" || isZyonJournalAccountName(target)) return;
    setImportDialogPurpose("append-trades");
    setAccountCreationMode("import");
    setImportAccount(target);
    setPendingFiles([]);
    setImportMessage("");
    setShowImport(true);
  }, []);

  const openImportDialog = useCallback(() => {
    if (accountFilter !== "all" && !isZyonJournalAccountName(accountFilter)) {
      openImportIntoJournal(accountFilter);
      return;
    }
    setImportDialogPurpose("add-account");
    setAccountCreationMode("import");
    setImportAccount("Imported account");
    setPendingFiles([]);
    setImportMessage("");
    setShowImport(true);
  }, [accountFilter, openImportIntoJournal]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const selected = [...files];
    const firstFileName = selected[0]?.name.trim() ?? "";
    if (firstFileName && importDialogPurpose === "add-account") {
      const extensionIndex = firstFileName.lastIndexOf(".");
      const accountName = (
        extensionIndex > 0 ? firstFileName.slice(0, extensionIndex) : firstFileName
      ).trim().slice(0, 80);
      setImportAccount(accountName || "Imported account");
    }
    setPendingFiles((current) => {
      const known = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
      return [...current, ...selected.filter((file) => !known.has(`${file.name}:${file.size}:${file.lastModified}`))].slice(0, 30);
    });
    setImportMessage("");
  }, [importDialogPurpose]);

  const syncCloudAccount = useCallback(async (
    account: string,
    trades: JournalTrade[],
    imports: JournalImportBatch[],
  ) => {
    if (!account || isZyonJournalAccountName(account)) return false;
    try {
      const chunks = trades.length
        ? Array.from({ length: Math.ceil(trades.length / 1_000) }, (_, index) => trades.slice(index * 1_000, (index + 1) * 1_000))
        : [[]];
      for (let index = 0; index < chunks.length; index += 1) {
        const response = await fetch("/api/journal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "sync",
            account,
            accountId: accountRecord.get(account)?.id,
            trades: chunks[index],
            imports: index === 0 ? imports : [],
          }),
        });
        const result = await response.json() as { cloud?: boolean; accountId?: string };
        if (!response.ok || !result.cloud) {
          setCloudState("local");
          return false;
        }
        if (result.accountId) {
          setState((current) => current.accounts.some((candidate) => candidate.id === result.accountId)
            ? current
            : {
                ...current,
                accounts: [...current.accounts, {
                  id: result.accountId as string,
                  name: account,
                  source: "import",
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  archivedAt: null,
                  sortOrder: null,
                }],
              });
        }
      }
      setCloudState("cloud");
      return true;
    } catch {
      setCloudState("error");
      return false;
    }
  }, [accountRecord]);

  const createNativeJournal = async () => {
    const account = importAccount.trim().slice(0, 80);
    if (!account || isZyonJournalAccountName(account)) {
      setImportMessage("Give the KwantDesk Journal a unique account name.");
      return;
    }
    const normalized = account.normalize("NFKC").toLowerCase();
    if (customAccounts.some((candidate) => candidate.normalize("NFKC").toLowerCase() === normalized)) {
      setImportMessage("A Journal with that name already exists.");
      return;
    }
    setImporting(true);
    setImportMessage("");
    try {
      const response = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create-account", account }),
      });
      const result = await response.json() as { cloud?: boolean; account?: JournalAccount; error?: string };
      if (!response.ok || !result.account) throw new Error(result.error || "The KwantDesk Journal could not be created.");
      setState((current) => ({
        ...current,
        accounts: [...current.accounts.filter((candidate) => candidate.id !== result.account?.id), result.account as JournalAccount],
      }));
      setCloudState(result.cloud ? "cloud" : "local");
      setAccountFilter(account);
      setTab("pulse");
      setShowImport(false);
      setImportAccount("Imported account");
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "The KwantDesk Journal could not be created.");
    } finally {
      setImporting(false);
    }
  };

  const openManualTrade = () => {
    manualTradeTouchedRef.current.clear();
    manualDictation.activate("name");
    manualDictation.clearError();
    setEditingTradeId(null);
    setManualTrade(newManualTradeDraft());
    setManualEvidenceFiles([]);
    setManualEvidenceDragging(false);
    setManualTradeError("");
    setShowManualTrade(true);
  };

  const closeManualTrade = () => {
    if (manualTradeSaving) return;
    manualDictation.stop();
    setShowManualTrade(false);
    setEditingTradeId(null);
    setManualEvidenceFiles([]);
    setManualTradeError("");
  };

  const openTradeEditor = (trade: JournalTrade) => {
    if (isZyonJournalAccountName(trade.account) || trade.sourceImportId.startsWith("zyon:")) return;
    manualTradeTouchedRef.current.clear();
    manualDictation.stop();
    manualDictation.activate("name");
    manualDictation.clearError();
    setEditingTradeId(trade.id);
    setManualTrade(manualTradeDraftFromTrade(trade));
    setManualEvidenceFiles([]);
    setManualEvidenceDragging(false);
    setManualTradeError("");
    setTradeMutationError("");
    setTradeMenuId(null);
    setSelectedTradeId(null);
    setShowManualTrade(true);
  };

  const openTradePost = (tradeId?: string) => {
    const requestedTrade = tradeId ? postableTrades.find((trade) => trade.id === tradeId) : null;
    setPostTradeId(requestedTrade?.id ?? postableTrades[0]?.id ?? "");
    setPostTradeCaption("");
    setPostTradeError("");
    setShowTradePost(true);
  };

  const publishTradePost = async () => {
    if (!postTrade || postTradeSaving) return;
    setPostTradeSaving(true);
    setPostTradeError("");
    try {
      const response = await fetch("/api/socials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          object: {
            objectType: "post",
            scope: "community",
            authorLabel: "Kwant Trader",
            payload: {
              kind: "TRADE",
              instrument: postTrade.symbol,
              title: `${postTrade.symbol} trade`,
              body: postTradeCaption.trim().slice(0, 2_000),
              context: "",
              condition: "",
              invalidation: "",
              relatedPrecordId: null,
              observedAt: new Date().toISOString(),
              trade: {
                journalTradeId: postTrade.id,
                instrument: postTrade.symbol,
                side: postTrade.side,
                entryPrice: postTrade.entryPrice,
                exitPrice: postTrade.exitPrice,
                openedAt: postTrade.openedAt,
                closedAt: postTrade.closedAt,
                entryTimeKnown: postTrade.entryTimeKnown !== false,
                exitTimeKnown: postTrade.exitTimeKnown !== false && Boolean(postTrade.closedAt),
                netPnl: postTrade.netPnl,
                initialRisk: postTrade.initialRisk,
                rMultiple: postTrade.rMultiple,
              },
            },
          },
        }),
      });
      const result = await response.json() as { object?: unknown; error?: string };
      if (!response.ok || !result.object) throw new Error(result.error || "The trade could not be posted.");
      setShowTradePost(false);
      setPostTradeId("");
      setPostTradeCaption("");
      setJournalLifecycleMessage("Trade posted to Socials. Your private journal notes and screenshots were not shared.");
      window.dispatchEvent(new CustomEvent("kwantdesk:social-post-created"));
    } catch (error) {
      setPostTradeError(error instanceof Error ? error.message : "The trade could not be posted.");
    } finally {
      setPostTradeSaving(false);
    }
  };

  function updateManualTradeField<K extends keyof ManualTradeDraft>(field: K, value: ManualTradeDraft[K]) {
    manualTradeTouchedRef.current.add(field);
    setManualTradeError("");
    setManualTrade((current) => ({ ...current, [field]: value }));
  }

  function toggleManualDictationField(field: ManualTradeDictationField) {
    if (manualDictation.enabled && manualDictation.activeField === field) manualDictation.stop();
    else manualDictation.activate(field, true);
  }

  const addManualEvidence = (files: File[]) => {
    const accepted = files
      .filter((file) => file.type.startsWith("image/") && file.size <= MAX_MANUAL_IMAGE_BYTES)
      .slice(0, 8);
    if (!accepted.length) {
      setManualTradeError("Add a PNG, JPG, WEBP or GIF image smaller than 20 MB.");
      return;
    }
    setManualTradeError("");
    setManualEvidenceFiles((current) => [...current, ...accepted].slice(0, 8));
  };

  const persistEvidence = useCallback(async (evidence: JournalEvidence) => {
    try {
      const response = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save-evidence", account: evidence.account, evidence }),
      });
      const result = await response.json() as { cloud?: boolean };
      if (!response.ok || !result.cloud) throw new Error("Evidence save failed.");
      setCloudState("cloud");
      return true;
    } catch {
      setCloudState("local");
      return false;
    }
  }, []);

  const submitManualTrade = async () => {
    if ((!selectedAccountIsManual && !editingTrade) || manualTradeSaving) return;
    const entryTimeKnown = Boolean(manualTrade.openedAt.trim());
    const exitTimeKnown = Boolean(manualTrade.closedAt.trim());
    const openedAt = entryTimeKnown ? Date.parse(manualTrade.openedAt) : Date.now();
    const closedAt = exitTimeKnown ? Date.parse(manualTrade.closedAt) : null;
    const quantity = manualTrade.quantity.trim() ? Number(manualTrade.quantity) : 1;
    const entryPrice = manualTrade.entryPrice.trim() ? Number(manualTrade.entryPrice) : null;
    const exitPrice = manualTrade.exitPrice.trim() ? Number(manualTrade.exitPrice) : null;
    const initialRisk = manualTrade.initialRisk.trim() ? Number(manualTrade.initialRisk) : null;
    const netPnl = Number(manualTrade.netPnl);
    const fees = Number(manualTrade.fees || 0);
    const stopPrice = manualTrade.stopPrice.trim() ? Number(manualTrade.stopPrice) : null;
    const targetPrice = manualTrade.targetPrice.trim() ? Number(manualTrade.targetPrice) : null;
    const plannedRiskReward = manualTrade.plannedRiskReward.trim() ? Number(manualTrade.plannedRiskReward) : null;
    const accountSize = manualTrade.accountSize.trim() ? Number(manualTrade.accountSize) : null;
    const missingCoreFields = [
      !manualTrade.symbol.trim() ? "instrument" : "",
      !manualTrade.side ? "direction" : "",
      !manualTrade.entryPrice.trim() ? "entry price" : "",
      !manualTrade.exitPrice.trim() ? "exit price" : "",
      !manualTrade.netPnl.trim() ? "profit/loss" : "",
    ].filter(Boolean);
    if (missingCoreFields.length) {
      setManualTradeError(`Add ${missingCoreFields.join(", ")}. Everything else can be left blank.`);
      return;
    }
    if (![openedAt, quantity, netPnl, fees].every(Number.isFinite) || quantity <= 0) {
      setManualTradeError("Check the entry time, contract quantity and profit/loss values.");
      return;
    }
    if ([entryPrice, exitPrice].some((value) => value !== null && (!Number.isFinite(value) || value <= 0))) {
      setManualTradeError("Entry and exit prices must be positive numbers when supplied.");
      return;
    }
    if (initialRisk !== null && (!Number.isFinite(initialRisk) || initialRisk <= 0)) {
      setManualTradeError("Initial risk must be a positive number when supplied.");
      return;
    }
    if (closedAt !== null && (!Number.isFinite(closedAt) || closedAt < openedAt)) {
      setManualTradeError("Exit time cannot be before entry time.");
      return;
    }
    if ([stopPrice, targetPrice, plannedRiskReward].some((value) => value !== null && (!Number.isFinite(value) || value <= 0))) {
      setManualTradeError("Stop, target and planned risk : reward must be positive numbers when supplied.");
      return;
    }
    if (accountSize !== null && (!Number.isFinite(accountSize) || accountSize <= 0)) {
      setManualTradeError("Account size must be a positive number when supplied.");
      return;
    }
    setManualTradeSaving(true);
    setManualTradeError("");
    try {
      const preparedEvidence = await Promise.all(manualEvidenceFiles.map(prepareManualEvidence));
      const id = editingTrade?.id ?? crypto.randomUUID();
      const sourceImportId = editingTrade?.sourceImportId ?? `manual:${id}`;
      const tradeAccount = editingTrade?.account ?? accountFilter;
      const now = new Date().toISOString();
      const trade: JournalTrade = {
        id,
        account: tradeAccount,
        openedAt: new Date(openedAt).toISOString(),
        closedAt: closedAt === null ? null : new Date(closedAt).toISOString(),
        entryTimeKnown,
        exitTimeKnown,
        symbol: manualTrade.symbol.trim().toUpperCase().slice(0, 32),
        side: manualTrade.side === "LONG" ? "LONG" : "SHORT",
        quantity,
        entryPrice,
        exitPrice,
        stopPrice,
        targetPrice,
        plannedRiskReward,
        grossPnl: netPnl + Math.max(0, fees),
        fees: Math.max(0, fees),
        feesKnown: Boolean(manualTrade.fees.trim()),
        netPnl,
        initialRisk,
        rMultiple: initialRisk === null ? null : netPnl / initialRisk,
        durationMs: closedAt === null ? null : closedAt - openedAt,
        setup: manualTrade.name.trim().slice(0, 160) || `${manualTrade.symbol.trim().toUpperCase()} ${manualTrade.side.toLowerCase()} trade`,
        tags: [...new Set(manualTrade.tags.split(",").map((tag) => tag.trim()).filter(Boolean))].slice(0, 24),
        notes: manualTrade.notes.trim().slice(0, 8_000),
        improvements: manualTrade.improvements.trim().slice(0, 8_000),
        contractClass: manualTrade.contractClass || "OTHER",
        tradingAccountName: manualTrade.tradingAccountName.trim().slice(0, 120) || undefined,
        tradingAccountType: manualTrade.tradingAccountType || undefined,
        accountSize,
        rating: manualTrade.rating,
        reviewedAt: manualTrade.notes.trim() || manualTrade.improvements.trim() || manualTrade.rating ? editingTrade?.reviewedAt ?? now : null,
        sourceImportId,
        sourceFile: editingTrade?.sourceFile ?? "KwantDesk Manual",
        sourceSheet: editingTrade?.sourceSheet,
        sourceRows: editingTrade?.sourceRows ?? [],
        fingerprint: editingTrade?.fingerprint ?? sourceImportId,
      };
      const evidence: JournalEvidence[] = preparedEvidence.map((item) => ({
        id: crypto.randomUUID(),
        account: tradeAccount,
        name: item.name,
        mimeType: item.mimeType,
        size: item.size,
        importedAt: now,
        sourceImportId,
        tradeId: id,
        dataUrl: item.dataUrl,
        caption: "",
      }));
      const response = await fetch("/api/journal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingTrade
            ? { action: "update", trade }
            : { action: "create-trade", account: tradeAccount, accountId: accountRecord.get(tradeAccount)?.id, trade }),
        });
      const result = await response.json() as { cloud?: boolean; error?: string; linkedPostsUpdated?: number };
      if (!response.ok || !result.cloud) throw new Error(result.error || "Trade save failed.");
      await Promise.all(evidence.map(async (item) => {
          if (!await persistEvidence(item)) throw new Error("Evidence save failed.");
          return true;
        }));
      setState((current) => ({
        ...current,
        trades: editingTrade
          ? current.trades.map((candidate) => candidate.id === trade.id ? trade : candidate)
          : [...current.trades, trade].slice(-50_000),
        evidence: [...evidence, ...current.evidence].slice(0, 500),
      }));
      setCloudState("cloud");
      setShowManualTrade(false);
      setEditingTradeId(null);
      setSelectedTradeId(id);
      setManualEvidenceFiles([]);
      setManualTrade(newManualTradeDraft());
      if (editingTrade) {
        setJournalLifecycleMessage(result.linkedPostsUpdated
          ? `Trade updated. ${result.linkedPostsUpdated} linked Socials post${result.linkedPostsUpdated === 1 ? "" : "s"} refreshed automatically.`
          : "Trade updated.");
        window.dispatchEvent(new CustomEvent("kwantdesk:social-post-created"));
      }
    } catch (error) {
      setManualTradeError(error instanceof Error ? error.message : "The manual trade could not be prepared.");
    } finally {
      setManualTradeSaving(false);
    }
  };

  const runImport = async () => {
    if (!pendingFiles.length || importing) return;
    const account = importAccount.trim() || "Imported account";
    const appendingToExistingJournal = importDialogPurpose === "append-trades";
    if (isZyonJournalAccountName(account)) {
      setImportMessage("ZYON Journal is automatic-only. Choose a different account name for imports.");
      return;
    }
    setImporting(true);
    setImportMessage("");
    const acceptedFingerprints = new Set<string>();
    const newTrades: JournalTrade[] = [];
    const newEvidence: JournalEvidence[] = [];
    const newImports: JournalImportBatch[] = [];
    let duplicates = 0;

    for (const file of pendingFiles) {
      const importId = crypto.randomUUID();
      const importedAt = new Date().toISOString();
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      const isImage = file.type.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(extension);

      if (isImage) {
        if (file.size > MAX_EVIDENCE_BYTES) {
          newImports.push({
            id: importId,
            account,
            fileName: file.name,
            fileType: file.type || extension,
            fileSize: file.size,
            importedAt,
            detectedSchema: "evidence",
            sourceRows: 0,
            acceptedTrades: 0,
            rejectedRows: 0,
            duplicateTrades: 0,
            evidenceCount: 0,
            warnings: ["Image exceeds the 8 MB evidence limit."],
          });
          continue;
        }
        try {
          const dataUrl = await fileToDataUrl(file);
          newEvidence.push({
            id: crypto.randomUUID(),
            account,
            name: file.name,
            mimeType: file.type || `image/${extension}`,
            size: file.size,
            importedAt,
            sourceImportId: importId,
            tradeId: null,
            dataUrl,
            caption: "",
          });
          newImports.push({
            id: importId,
            account,
            fileName: file.name,
            fileType: file.type || extension,
            fileSize: file.size,
            importedAt,
            detectedSchema: "evidence",
            sourceRows: 0,
            acceptedTrades: 0,
            rejectedRows: 0,
            duplicateTrades: 0,
            evidenceCount: 1,
            warnings: [],
          });
        } catch {
          newImports.push({
            id: importId,
            account,
            fileName: file.name,
            fileType: file.type || extension,
            fileSize: file.size,
            importedAt,
            detectedSchema: "evidence",
            sourceRows: 0,
            acceptedTrades: 0,
            rejectedRows: 0,
            duplicateTrades: 0,
            evidenceCount: 0,
            warnings: ["Image could not be read."],
          });
        }
        continue;
      }

      let parsed: JournalParseResult;
      if (SPREADSHEET_EXTENSIONS.has(extension)) {
        if (file.size > MAX_WORKBOOK_BYTES) {
          parsed = {
            trades: [],
            detectedSchema: "workbook",
            sourceRows: 0,
            rejectedRows: 0,
            warnings: ["Workbook exceeds the 75 MB browser import limit. Export the trade sheet as CSV or split the workbook into smaller files."],
          };
        } else {
          try {
            const { parseJournalSpreadsheetFile } = await import("@/lib/journalSpreadsheet");
            parsed = await parseJournalSpreadsheetFile(file.name, await file.arrayBuffer(), account, importId);
          } catch {
            parsed = {
              trades: [],
              detectedSchema: "workbook",
              sourceRows: 0,
              rejectedRows: 0,
              warnings: ["The workbook importer could not read this file. Check that it is not password protected or damaged."],
            };
          }
        }
      } else {
        if (extension !== "md" && !TABULAR_TEXT_EXTENSIONS.has(extension)) {
          newImports.push({
            id: importId,
            account,
            fileName: file.name,
            fileType: file.type || extension,
            fileSize: file.size,
            importedAt,
            detectedSchema: "unknown",
            sourceRows: 0,
            acceptedTrades: 0,
            rejectedRows: 0,
            duplicateTrades: 0,
            evidenceCount: 0,
            warnings: ["Unsupported file type. Use a workbook, delimited trade export, JSON, HTML/XML table, note, or image."],
          });
          continue;
        }
        const text = await file.text();
        const importSample = text.split(/\r?\n/).slice(0, 25).join("\n").toLowerCase();
        const looksLikeTradeTable = /[,;\t]/.test(importSample)
          && /(symbol|instrument|ticker|contract|market|product|trade)/.test(importSample)
          && /(pnl|p\/l|profit|result|price|entry|exit|fill|side|direction|action|type)/.test(importSample);
        const isNote = extension === "md" || (extension === "txt" && !looksLikeTradeTable);
        if (isNote) {
          const dataUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;
          newEvidence.push({
            id: crypto.randomUUID(),
            account,
            name: file.name,
            mimeType: file.type || "text/plain",
            size: file.size,
            importedAt,
            sourceImportId: importId,
            tradeId: null,
            dataUrl,
            textContent: text.slice(0, 100_000),
            caption: "",
          });
          newImports.push({
            id: importId,
            account,
            fileName: file.name,
            fileType: file.type || extension,
            fileSize: file.size,
            importedAt,
            detectedSchema: "notes",
            sourceRows: text.split(/\r?\n/).length,
            acceptedTrades: 0,
            rejectedRows: 0,
            duplicateTrades: 0,
            evidenceCount: 1,
            warnings: [],
          });
          continue;
        }
        parsed = parseJournalTextFile(file.name, text, account, importId);
      }

      const candidateTrades = parsed.trades.filter((trade) => {
        if (acceptedFingerprints.has(trade.fingerprint)) return false;
        acceptedFingerprints.add(trade.fingerprint);
        return true;
      });
      const merged = mergeJournalImportTrades(state.trades, candidateTrades, account);
      const fileDuplicates = parsed.trades.length - candidateTrades.length + merged.duplicateTrades;
      const accepted = merged.added;
      duplicates += fileDuplicates;
      newTrades.push(...accepted);
      newImports.push({
        id: importId,
        account,
        fileName: file.name,
        fileType: file.type || extension,
        fileSize: file.size,
        importedAt,
        detectedSchema: parsed.detectedSchema,
        sourceRows: parsed.sourceRows,
        acceptedTrades: accepted.length,
        rejectedRows: parsed.rejectedRows,
        duplicateTrades: fileDuplicates,
        evidenceCount: 0,
        warnings: parsed.warnings,
      });
    }

    setState((current) => ({
      version: 1,
      accounts: current.accounts,
      trades: [...current.trades, ...newTrades].slice(-50_000),
      evidence: [...newEvidence, ...current.evidence].slice(0, 500),
      imports: [...newImports, ...current.imports].slice(0, 500),
    }));
    setPendingFiles([]);
    setImporting(false);
    setImportMessage(`${newTrades.length} trade${newTrades.length === 1 ? "" : "s"} and ${newEvidence.length} evidence file${newEvidence.length === 1 ? "" : "s"} imported${duplicates ? ` · ${duplicates} duplicate${duplicates === 1 ? "" : "s"} skipped` : ""}.`);
    if (newTrades.length || newEvidence.length) {
      setAccountFilter(account);
      setTab(appendingToExistingJournal ? "trades" : "pulse");
      setShowImport(false);
      if (appendingToExistingJournal) {
        setJournalLifecycleMessage(
          `${newTrades.length} trade${newTrades.length === 1 ? "" : "s"} imported into ${account}${duplicates ? ` · ${duplicates} duplicate${duplicates === 1 ? "" : "s"} skipped` : ""}. Open any trade to add risk, contract class, notes, screenshots, or corrections.`,
        );
      }
      void syncCloudAccount(account, newTrades, newImports);
    } else if (newImports.length) {
      const firstWarning = newImports.flatMap((batch) => batch.warnings)[0];
      setImportMessage(duplicates
        ? `No new trades found · ${duplicates} existing trade${duplicates === 1 ? " was" : "s were"} already synced. Nothing was removed or duplicated.`
        : `No trades were added.${firstWarning ? ` ${firstWarning}` : " Check that the file includes a date, instrument, and either P&L or entry/exit prices."}`);
      void syncCloudAccount(account, [], newImports);
    }
  };

  const runJournalLifecycle = async (action: "archive-account" | "restore-account" | "delete-account", account: string) => {
    const accountId = accountRecord.get(account)?.id;
    const response = await fetch("/api/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, account, accountId }),
    });
    const result = await response.json() as { cloud?: boolean; error?: string; account?: JournalAccount };
    if (!response.ok || !result.cloud) throw new Error(result.error || "The Journal could not be updated.");
    return result;
  };

  const renameJournal = async () => {
    const account = renameJournalTarget;
    const nextName = renameJournalDraft.replace(/\s+/g, " ").trim().slice(0, 80);
    if (!account || journalLifecycleBusy) return;
    if (!nextName || isZyonJournalAccountName(nextName)) {
      setRenameJournalError("Choose a valid custom Journal name.");
      return;
    }
    if (nextName === account) {
      setRenameJournalTarget(null);
      return;
    }
    const normalized = nextName.normalize("NFKC").toLowerCase();
    if (state.accounts.some((candidate) => candidate.name !== account && candidate.name.normalize("NFKC").toLowerCase() === normalized)) {
      setRenameJournalError("A Journal with that name already exists.");
      return;
    }
    const target = accountRecord.get(account);
    if (!target) {
      setRenameJournalError("That Journal account could not be found.");
      return;
    }

    const snapshot = state;
    setRenameJournalError("");
    setJournalLifecycleBusy(account);
    setState((current) => ({
      ...current,
      accounts: current.accounts.map((candidate) => candidate.id === target.id ? { ...candidate, name: nextName, updatedAt: new Date().toISOString() } : candidate),
      trades: current.trades.map((trade) => trade.account === account ? { ...trade, account: nextName } : trade),
      evidence: current.evidence.map((item) => item.account === account ? { ...item, account: nextName } : item),
      imports: current.imports.map((item) => item.account === account ? { ...item, account: nextName } : item),
    }));
    if (accountFilter === account) setAccountFilter(nextName);
    try {
      const response = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rename-account", accountId: target.id, newName: nextName }),
      });
      const result = await response.json() as { cloud?: boolean; error?: string; account?: JournalAccount };
      if (!response.ok || !result.cloud) throw new Error(result.error || "The Journal could not be renamed.");
      setRenameJournalTarget(null);
      setJournalLifecycleMessage(`${account} renamed to ${nextName}.`);
      setCloudState("cloud");
    } catch (error) {
      setState(snapshot);
      if (accountFilter === nextName) setAccountFilter(account);
      setRenameJournalError(error instanceof Error ? error.message : "The Journal could not be renamed.");
    } finally {
      setJournalLifecycleBusy(null);
    }
  };

  const reorderJournals = async (source: string, target: string, placeAfter: boolean) => {
    if (source === target || journalLifecycleBusy) return;
    const previousAccounts = state.accounts;
    const nextNames = [...customAccounts];
    const sourceIndex = nextNames.indexOf(source);
    if (sourceIndex < 0 || !nextNames.includes(target)) return;
    nextNames.splice(sourceIndex, 1);
    const targetIndex = nextNames.indexOf(target);
    nextNames.splice(targetIndex + (placeAfter ? 1 : 0), 0, source);
    const order = new Map(nextNames.map((name, index) => [name, index]));
    const accountIds = nextNames.map((name) => accountRecord.get(name)?.id).filter((id): id is string => Boolean(id));
    if (accountIds.length !== nextNames.length) return;

    setState((current) => ({
      ...current,
      accounts: current.accounts.map((account) => order.has(account.name) ? { ...account, sortOrder: order.get(account.name) } : account),
    }));
    setDraggedJournal(null);
    try {
      const response = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorder-accounts", accountIds }),
      });
      const result = await response.json() as { cloud?: boolean; error?: string };
      if (!response.ok || !result.cloud) throw new Error(result.error || "Journal order could not be saved.");
      setCloudState("cloud");
    } catch (error) {
      setState((current) => ({ ...current, accounts: previousAccounts }));
      setJournalLifecycleMessage(error instanceof Error ? error.message : "Journal order could not be saved.");
    }
  };

  const archiveJournal = async (account: string) => {
    if (isZyonJournalAccountName(account) || journalLifecycleBusy) return;
    const previous = state.accounts.find((candidate) => candidate.name === account)?.archivedAt ?? null;
    const archivedAt = new Date().toISOString();
    setAccountMenu(null);
    setJournalLifecycleBusy(account);
    setJournalLifecycleMessage("");
    setState((current) => ({
      ...current,
      accounts: current.accounts.map((candidate) => candidate.name === account ? { ...candidate, archivedAt } : candidate),
    }));
    if (accountFilter === account) setAccountFilter("all");
    try {
      const result = await runJournalLifecycle("archive-account", account);
      setState((current) => ({
        ...current,
        accounts: current.accounts.map((candidate) => candidate.name === account ? { ...candidate, archivedAt: result.account?.archivedAt ?? archivedAt } : candidate),
      }));
      setJournalLifecycleMessage(`${account} moved to Archive.`);
    } catch (error) {
      setState((current) => ({
        ...current,
        accounts: current.accounts.map((candidate) => candidate.name === account ? { ...candidate, archivedAt: previous } : candidate),
      }));
      setJournalLifecycleMessage(error instanceof Error ? error.message : "The Journal could not be archived.");
    } finally {
      setJournalLifecycleBusy(null);
    }
  };

  const restoreJournal = async (account: string) => {
    if (isZyonJournalAccountName(account) || journalLifecycleBusy) return;
    const previous = state.accounts.find((candidate) => candidate.name === account)?.archivedAt ?? new Date().toISOString();
    setJournalLifecycleBusy(account);
    setJournalLifecycleMessage("");
    setState((current) => ({
      ...current,
      accounts: current.accounts.map((candidate) => candidate.name === account ? { ...candidate, archivedAt: null } : candidate),
    }));
    try {
      await runJournalLifecycle("restore-account", account);
      setJournalLifecycleMessage(`${account} restored to active Journals.`);
    } catch (error) {
      setState((current) => ({
        ...current,
        accounts: current.accounts.map((candidate) => candidate.name === account ? { ...candidate, archivedAt: previous } : candidate),
      }));
      setJournalLifecycleMessage(error instanceof Error ? error.message : "The Journal could not be restored.");
    } finally {
      setJournalLifecycleBusy(null);
    }
  };

  const deleteJournalForever = async (account: string) => {
    if (isZyonJournalAccountName(account) || journalLifecycleBusy) return;
    const snapshot = state;
    setDeleteJournalTarget(null);
    setAccountMenu(null);
    setJournalLifecycleBusy(account);
    setJournalLifecycleMessage("");
    setState((current) => ({
      ...current,
      accounts: current.accounts.filter((candidate) => candidate.name !== account),
      trades: current.trades.filter((trade) => trade.account !== account),
      evidence: current.evidence.filter((item) => item.account !== account),
      imports: current.imports.filter((item) => item.account !== account),
    }));
    if (accountFilter === account) setAccountFilter("all");
    try {
      await runJournalLifecycle("delete-account", account);
      setJournalLifecycleMessage(`${account} was permanently deleted.`);
    } catch (error) {
      setState(snapshot);
      setJournalLifecycleMessage(error instanceof Error ? error.message : "The Journal could not be deleted.");
    } finally {
      setJournalLifecycleBusy(null);
    }
  };

  const updateTrade = (tradeId: string, patch: Partial<JournalTrade>) => {
    const currentTrade = allTrades.find((trade) => trade.id === tradeId);
    if (!currentTrade || isZyonJournalAccountName(currentTrade.account) || currentTrade.sourceImportId.startsWith("zyon:")) return;
    const updatedTrade = { ...currentTrade, ...patch };
    setState((current) => ({
      ...current,
      trades: current.trades.map((trade) => trade.id === tradeId ? { ...trade, ...patch } : trade),
    }));
    void fetch("/api/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", trade: updatedTrade }),
    }).then(async (response) => {
      const result = await response.json() as { cloud?: boolean };
      setCloudState(response.ok && result.cloud ? "cloud" : "local");
    }).catch(() => setCloudState("error"));
  };

  const updateEvidence = (evidenceId: string, patch: Partial<JournalEvidence>) => {
    const currentEvidence = state.evidence.find((item) => item.id === evidenceId);
    if (!currentEvidence) return;
    const updatedEvidence = { ...currentEvidence, ...patch };
    setState((current) => ({
      ...current,
      evidence: current.evidence.map((item) => item.id === evidenceId ? { ...item, ...patch } : item),
    }));
    void persistEvidence(updatedEvidence);
  };

  const deleteImport = (batch: JournalImportBatch) => {
    if (isZyonJournalAccountName(batch.account)) return;
    if (!window.confirm(`Remove "${batch.fileName}" and every Journal record created by this import?`)) return;
    setState((current) => ({
      ...current,
      trades: current.trades.filter((trade) => trade.sourceImportId !== batch.id),
      evidence: current.evidence.filter((item) => item.sourceImportId !== batch.id),
      imports: current.imports.filter((item) => item.id !== batch.id),
    }));
    void fetch(`/api/journal?importId=${encodeURIComponent(batch.id)}`, {
      method: "DELETE",
    }).then(async (response) => {
      const result = await response.json() as { cloud?: boolean };
      setCloudState(response.ok && result.cloud ? "cloud" : "local");
    }).catch(() => setCloudState("error"));
  };

  const deleteTrade = async (trade: JournalTrade) => {
    if (isZyonJournalAccountName(trade.account) || trade.sourceImportId.startsWith("zyon:") || manualTradeSaving) return;
    const snapshot = state;
    setDeleteTradeTargetId(null);
    setTradeMenuId(null);
    setTradeMutationError("");
    setState((current) => ({
      ...current,
      trades: current.trades.filter((candidate) => candidate.id !== trade.id),
    }));
    if (selectedTradeId === trade.id) setSelectedTradeId(null);
    try {
      const response = await fetch(`/api/journal?tradeId=${encodeURIComponent(trade.id)}`, { method: "DELETE" });
      const result = await response.json() as { cloud?: boolean; error?: string; linkedPostsDeleted?: number };
      if (!response.ok || !result.cloud) throw new Error(result.error || "The trade could not be deleted.");
      setCloudState("cloud");
      setJournalLifecycleMessage(result.linkedPostsDeleted
        ? `Trade deleted with ${result.linkedPostsDeleted} linked Socials post${result.linkedPostsDeleted === 1 ? "" : "s"}.`
        : "Trade deleted.");
      window.dispatchEvent(new CustomEvent("kwantdesk:social-post-created"));
    } catch (error) {
      setState(snapshot);
      setCloudState("error");
      setTradeMutationError(error instanceof Error ? error.message : "The trade could not be deleted.");
    }
  };

  const exportJournal = (format: "csv" | "json") => {
    if (format === "csv") {
      downloadBlob("kwantdesk-journal-trades.csv", new Blob([journalTradesToCsv(filteredTrades)], { type: "text/csv;charset=utf-8" }));
      return;
    }
    downloadBlob("kwantdesk-journal-backup.json", new Blob([JSON.stringify({
      format: "kwantdesk-journal",
      version: 1,
      exportedAt: new Date().toISOString(),
      accountFilter,
      accounts: state.accounts,
      trades: filteredTrades,
      evidence: filteredEvidence,
      imports: state.imports,
    }, null, 2)], { type: "application/json" }));
  };

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstOffset = new Date(year, month, 1).getDay();
    const count = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: 42 }, (_, index) => {
      const day = index - firstOffset + 1;
      if (day < 1 || day > count) return null;
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayTrades = filteredTrades.filter((trade) => localDateKey(trade.closedAt ?? trade.openedAt) === dateKey);
      const pnl = dayTrades.reduce((sum, trade) => sum + trade.netPnl, 0);
      const evidence = filteredEvidence.filter((item) => localDateKey(item.importedAt) === dateKey).length;
      return { day, dateKey, trades: dayTrades, pnl, evidence, reviewed: dayTrades.filter((trade) => trade.reviewedAt).length };
    });
  }, [calendarMonth, filteredEvidence, filteredTrades]);

  const selectedDayTrades = selectedDay
    ? filteredTrades.filter((trade) => localDateKey(trade.closedAt ?? trade.openedAt) === selectedDay)
    : [];
  const bySymbol = useMemo(() => groupPerformance(filteredTrades, (trade) => trade.symbol), [filteredTrades]);
  const byAccount = useMemo(() => groupPerformance(filteredTrades, (trade) => trade.account), [filteredTrades]);
  const bySide = useMemo(() => groupPerformance(filteredTrades, (trade) => trade.side), [filteredTrades]);
  const byWeekday = useMemo(() => groupPerformance(filteredTrades, (trade) => new Date(trade.openedAt).toLocaleDateString("en-AU", { weekday: "long" })), [filteredTrades]);
  const byHour = useMemo(() => groupPerformance(filteredTrades, (trade) => `${String(new Date(trade.openedAt).getHours()).padStart(2, "0")}:00`), [filteredTrades]);
  const bySetup = useMemo(() => groupPerformance(filteredTrades, (trade) => trade.setup || trade.tags[0] || "Unclassified"), [filteredTrades]);

  if (!ready) {
    return (
      <KwantLoader
        className="h-full"
        icon={NotebookPen}
        title="Loading Journal memory"
        detail="Restoring accounts, records and saved evidence"
      />
    );
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col bg-background text-foreground"
      // Set once here rather than threaded through fifty-six call sites, so
      // every figure, bar, curve and calendar cell moves with the theme
      // together.
      style={{
        "--journal-win": outcomeColors.win,
        "--journal-loss": outcomeColors.loss,
        "--journal-win-soft": outcomeColors.winSoft,
        "--journal-loss-soft": outcomeColors.lossSoft,
      } as CSSProperties}
    >
      <header className="shrink-0 bg-panel">
        <div className="flex min-h-[64px] flex-wrap items-center gap-3 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><NotebookPen className="h-4 w-4" /></span>
          <div className="min-w-0">
            <h1 className="text-[14px] font-semibold tracking-[-0.01em] text-foreground">{accountFilter === "all" ? "Overall Journal" : accountFilter}</h1>
            <p className="mt-0.5 text-[9px] text-muted">{accountFilter === "all" ? "Consolidated performance across every journal account" : accountFilter === "ZYON Journal" ? "Personal outcomes created from reviewed ZYON Gameplans" : "Imported performance · review evidence · measurable edge"}</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className={`flex h-8 items-center gap-1.5 rounded-xl border border-border bg-surface px-2.5 text-[9px] ${saveStatus === "error" ? "text-danger" : "text-muted"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${cloudState === "cloud" ? "bg-primary" : cloudState === "error" || saveStatus === "error" ? "bg-danger" : cloudState === "loading" || saveStatus === "loading" ? "animate-pulse bg-warning" : "bg-muted"}`} />
              {cloudState === "cloud" ? "Account saved" : cloudState === "loading" ? "Connecting" : cloudState === "error" || saveStatus === "error" ? "Save interrupted" : "Local until connected"}
            </span>
            {selectedAccountIsManual ? <button type="button" onClick={openManualTrade} className="flex h-8 items-center gap-1.5 rounded-xl bg-primary px-3 text-[9px] font-semibold text-background hover:brightness-110"><Plus className="h-3.5 w-3.5" />Add trade</button> : null}
            {accountFilter !== "all" && !isZyonJournalAccountName(accountFilter) ? <button type="button" onClick={() => openImportIntoJournal(accountFilter)} className="flex h-8 items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/[0.06] px-3 text-[9px] font-semibold text-primary hover:bg-primary/[0.11]"><Upload className="h-3.5 w-3.5" />Import</button> : null}
            <button type="button" onClick={() => openTradePost()} disabled={!postableTrades.length} className="flex h-8 items-center gap-1.5 rounded-xl bg-primary px-3 text-[9px] font-semibold text-background hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"><Share2 className="h-3.5 w-3.5" />Post trade</button>
            <button type="button" onClick={() => setShowArchive(true)} className="relative flex h-8 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-[9px] font-semibold text-muted hover:text-foreground"><FolderArchive className="h-3.5 w-3.5" />Archive{archivedAccounts.length ? <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[7px] font-semibold text-background">{archivedAccounts.length}</span> : null}</button>
            <button type="button" onClick={() => exportJournal("json")} disabled={!allTrades.length && !state.evidence.length} className="flex h-8 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-[9px] font-semibold text-muted hover:text-foreground disabled:opacity-35"><Download className="h-3.5 w-3.5" />Backup</button>
            <button type="button" onClick={openAddAccountDialog} className="flex h-8 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-[9px] font-semibold text-muted hover:text-foreground"><BookPlus className="h-3.5 w-3.5" />Add account</button>
          </div>
        </div>
        {journalLifecycleMessage ? <div className="mx-4 mb-2 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/[0.06] px-3 py-2 text-[8px] text-muted"><Check className="h-3.5 w-3.5 shrink-0 text-primary" /><span className="min-w-0 flex-1 truncate">{journalLifecycleMessage}</span><button type="button" onClick={() => setJournalLifecycleMessage("")} className="text-muted hover:text-foreground"><X className="h-3.5 w-3.5" /></button></div> : null}
        <div className="border-t border-border/70 px-3 py-2">
          <div className="flex items-stretch gap-2 overflow-x-auto pb-1" aria-label="Journal accounts">
            {accountViews.map(({ id, label, detail, stats: accountStats, icon: Icon }) => {
              const active = accountFilter === id;
              return (
                <div
                  key={id}
                  role="button"
                  tabIndex={0}
                  draggable={id !== "all" && id !== ZYON_JOURNAL_ACCOUNT}
                  onDragStart={(event) => {
                    if (id === "all" || id === ZYON_JOURNAL_ACCOUNT) return;
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", id);
                    setDraggedJournal(id);
                  }}
                  onDragOver={(event) => {
                    if (!draggedJournal || id === "all" || id === ZYON_JOURNAL_ACCOUNT) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(event) => {
                    if (!draggedJournal || id === "all" || id === ZYON_JOURNAL_ACCOUNT) return;
                    event.preventDefault();
                    const bounds = event.currentTarget.getBoundingClientRect();
                    void reorderJournals(draggedJournal, id, event.clientX > bounds.left + bounds.width / 2);
                  }}
                  onDragEnd={() => setDraggedJournal(null)}
                  onClick={() => {
                    const nextAnalysisAccount = id === "all" ? "Overall Journal" : id;
                    if (nextAnalysisAccount !== analysisLoadedAccount) {
                      analysisRequestRef.current += 1;
                      analysisAbortRef.current?.abort();
                      setJournalAnalysis(null);
                      setAnalysisLoadedAccount("");
                      setAnalysisStatus("idle");
                      setAnalysisError("");
                    }
                    setAccountFilter(id);
                    if (id === ZYON_JOURNAL_ACCOUNT && tab === "imports") setTab("pulse");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") event.currentTarget.click();
                  }}
                  onContextMenu={(event) => {
                    if (id === "all" || id === ZYON_JOURNAL_ACCOUNT) return;
                    event.preventDefault();
                    setAccountMenu({ account: id, x: Math.max(8, Math.min(event.clientX, window.innerWidth - 210)), y: Math.max(8, Math.min(event.clientY, window.innerHeight - 170)) });
                  }}
                  className={`group min-w-[190px] shrink-0 rounded-2xl border px-3 py-2.5 text-left transition-all ${id !== "all" && id !== ZYON_JOURNAL_ACCOUNT ? "cursor-grab active:cursor-grabbing" : ""} ${draggedJournal === id ? "scale-[0.98] opacity-45" : "opacity-100"} ${active ? "border-primary/45 bg-primary/[0.09] shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_10%,transparent)]" : "border-border bg-background/30 hover:border-primary/25 hover:bg-surface/55"}`}
                >
                  <div className="flex items-start gap-2.5">
                    {id !== "all" && id !== ZYON_JOURNAL_ACCOUNT ? <span title="Drag to reorder Journals" className="-ml-1 flex h-8 w-3 shrink-0 items-center justify-center text-muted/50 group-hover:text-muted"><GripVertical className="h-3.5 w-3.5" /></span> : null}
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${active ? "border-primary/25 bg-primary/12 text-primary" : "border-border bg-surface text-muted group-hover:text-foreground"}`}><Icon className="h-3.5 w-3.5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[10px] font-semibold ${active ? "text-primary" : "text-foreground"}`}>{label}</span>
                      <span className="mt-0.5 block truncate text-[7px] text-muted">{detail}</span>
                    </span>
                    <span className={`font-mono text-[9px] font-semibold ${accountStats.netPnl > 0 ? "text-[var(--journal-win)]" : accountStats.netPnl < 0 ? "text-[var(--journal-loss)]" : "text-muted"}`}>{compact(accountStats.netPnl)}</span>
                    {id !== "all" && id !== ZYON_JOURNAL_ACCOUNT ? <button type="button" aria-label={`Manage ${label}`} onClick={(event) => { event.stopPropagation(); const bounds = event.currentTarget.getBoundingClientRect(); setAccountMenu({ account: id, x: Math.max(8, Math.min(bounds.right, window.innerWidth - 210)), y: Math.max(8, Math.min(bounds.bottom + 4, window.innerHeight - 170)) }); }} className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-muted opacity-60 hover:bg-surface hover:text-foreground group-hover:opacity-100"><MoreVertical className="h-3.5 w-3.5" /></button> : null}
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-2 text-[7px] text-muted">
                    <span>{accountStats.tradeCount} outcome{accountStats.tradeCount === 1 ? "" : "s"}</span>
                    <span>{percent(accountStats.winRate, 0)} win</span>
                  </div>
                </div>
              );
            })}
            <button type="button" onClick={openAddAccountDialog} className="flex min-w-[150px] shrink-0 items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-background/20 px-4 text-[9px] font-semibold text-muted transition-colors hover:border-primary/35 hover:bg-primary/[0.05] hover:text-primary"><Plus className="h-3.5 w-3.5" />Add account</button>
          </div>
        </div>
        <WorkspaceSubnav
          items={JOURNAL_TABS.filter(({ id }) => !zyonJournalSelected || id !== "imports")}
          value={tab}
          onChange={setTab}
          ariaLabel="Journal views"
        />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!filteredTrades.length && tab !== "analysis" && tab !== "evidence" && tab !== "imports" ? (
          <div className="mx-auto flex min-h-full max-w-5xl items-center justify-center p-6">
            <div className="relative w-full overflow-hidden rounded-3xl border border-border bg-panel p-8 text-center shadow-2xl shadow-black/20">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,color-mix(in_srgb,var(--primary)_10%,transparent),transparent_42%)]" />
              <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">{accountFilter === "ZYON Journal" ? <Bot className={`h-6 w-6 ${zyonLoading ? "animate-pulse" : ""}`} /> : <Import className="h-6 w-6" />}</div>
              <h2 className="relative mt-5 text-[22px] font-semibold tracking-[-0.03em] text-foreground">{accountFilter === "ZYON Journal" ? zyonLoading ? "Loading your ZYON outcomes…" : "Your first reviewed Gameplan starts this Journal." : selectedAccountIsManual ? "Document your first trade." : accountFilter === "all" ? "Build your consolidated trading record." : `${accountFilter} is ready for its first import.`}</h2>
              <p className="relative mx-auto mt-2 max-w-xl text-[11px] leading-5 text-muted">{accountFilter === "ZYON Journal" ? "When a ZYON Gameplan completes its outcome review, it appears here automatically with its execution, P&L, reasoning score, timestamps, and review." : selectedAccountIsManual ? "Record the setup, entry, exit, risk, outcome, screenshots and an optional honest review. The trade will flow into every Journal view automatically." : "Import closed trades, executions, screenshots, or notes. Overall Journal combines every account while each account keeps its own statistics."}</p>
              {accountFilter === "ZYON Journal"
                ? <button type="button" onClick={() => { window.location.href = "/zyon"; }} className="relative mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-[10px] font-semibold text-background"><Bot className="h-4 w-4" />Open ZYON</button>
                : selectedAccountIsManual
                  ? <button type="button" onClick={openManualTrade} className="relative mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-[10px] font-semibold text-background"><Plus className="h-4 w-4" />Add manual trade</button>
                  : <button type="button" onClick={openAddAccountDialog} className="relative mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-[10px] font-semibold text-background"><Plus className="h-4 w-4" />Add account</button>}
              <div className="relative mx-auto mt-7 grid max-w-3xl gap-2 sm:grid-cols-3">
                {[
                  [FileSpreadsheet, "Trades", "TradingView XLSX, broker workbooks, CSV, TSV and JSON exports"],
                  [ImageIcon, "Evidence", "PNG, JPG, WEBP and GIF screenshots"],
                  [FileText, "Notes", "Markdown and text research files"],
                ].map(([Icon, label, detail]) => (
                  <div key={String(label)} className="rounded-2xl border border-border bg-background/40 p-4 text-left">
                    <Icon className="h-4 w-4 text-primary" />
                    <div className="mt-3 text-[10px] font-semibold text-foreground">{String(label)}</div>
                    <div className="mt-1 text-[8px] leading-4 text-muted">{String(detail)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {filteredTrades.length && tab === "pulse" ? (
          <div className="space-y-3 p-3">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
              <MetricCard label="Net P&L" value={money(stats.netPnl)} compactValue={compact(stats.netPnl)} detail={`${stats.tradeCount} imported trades`} icon={stats.netPnl >= 0 ? TrendingUp : TrendingDown} tone={stats.netPnl >= 0 ? "positive" : "negative"} />
              <MetricCard label="Win rate" value={percent(stats.winRate)} detail={`${filteredTrades.filter((trade) => trade.netPnl > 0).length} wins · ${filteredTrades.filter((trade) => trade.netPnl < 0).length} losses`} icon={Activity} />
              <MetricCard label="Profit factor" value={ratio(stats.profitFactor)} detail={`${money(stats.grossProfit, false)} / ${money(stats.grossLoss, false)}`} icon={BarChart3} />
              <MetricCard label="Expectancy" value={money(stats.expectancy)} compactValue={stats.expectancy === null ? undefined : compact(stats.expectancy)} detail="Average net result per trade" icon={Sparkles} tone={(stats.expectancy ?? 0) >= 0 ? "positive" : "negative"} />
              <MetricCard label="Avg risk : reward" value={riskReward(stats.averageR)} detail={`${filteredTrades.filter((trade) => trade.rMultiple !== null).length} risk-complete trades`} icon={Layers3} />
              <MetricCard label="Max drawdown" value={money(-stats.maxDrawdown)} compactValue={compact(-stats.maxDrawdown)} detail="Peak-to-trough imported P&L" icon={TrendingDown} tone="negative" />
              <MetricCard label="Review integrity" value={`${reviewIntegrity}%`} detail="Source 45% · review 40% · evidence 15%" icon={ShieldCheck} tone={reviewIntegrity >= 80 ? "positive" : "neutral"} />
              <MetricCard label="Open reviews" value={String(unreviewed.length)} detail={`${stats.reviewedCount} marked reviewed`} icon={CircleAlert} tone={unreviewed.length ? "negative" : "positive"} />
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
              <MetricCard label="Winning days rate" value={percent(advancedStats.winningDayRate)} detail={`${advancedStats.winningDays} winning · ${advancedStats.losingDays} losing days`} icon={CalendarDays} tone={(advancedStats.winningDayRate ?? 0) >= 0.5 ? "positive" : "negative"} />
              <MetricCard label="Avg winning day" value={money(advancedStats.averageWinningDay)} compactValue={advancedStats.averageWinningDay === null ? undefined : compact(advancedStats.averageWinningDay)} detail="Mean P&L across green days" icon={TrendingUp} tone="positive" />
              <MetricCard label="Avg losing day" value={money(advancedStats.averageLosingDay)} compactValue={advancedStats.averageLosingDay === null ? undefined : compact(advancedStats.averageLosingDay)} detail="Mean P&L across red days" icon={TrendingDown} tone="negative" />
              <MetricCard label="Best day" value={money(advancedStats.bestDay)} compactValue={advancedStats.bestDay === null ? undefined : compact(advancedStats.bestDay)} detail={`Across ${advancedStats.tradedDays} traded days`} icon={Star} tone="positive" />
              <MetricCard label="Worst day" value={money(advancedStats.worstDay)} compactValue={advancedStats.worstDay === null ? undefined : compact(advancedStats.worstDay)} detail="Largest daily loss" icon={CircleAlert} tone="negative" />
              <MetricCard label="Payoff ratio" value={ratio(advancedStats.payoffRatio)} detail="Average winner / average loser" icon={Target} tone={(advancedStats.payoffRatio ?? 0) >= 1 ? "positive" : "negative"} />
              <MetricCard label="Current streak" value={stats.currentStreak ? `${stats.currentStreak}${stats.currentStreakKind === "WIN" ? "W" : "L"}` : "—"} detail="Consecutive non-breakeven trades" icon={Activity} tone={stats.currentStreakKind === "WIN" ? "positive" : stats.currentStreakKind === "LOSS" ? "negative" : "neutral"} />
              <MetricCard label="Recovery factor" value={ratio(advancedStats.recoveryFactor)} detail="Net P&L / max drawdown" icon={ShieldCheck} tone={(advancedStats.recoveryFactor ?? 0) >= 1 ? "positive" : "neutral"} />
            </div>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,.75fr)]">
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div><h3 className="text-[11px] font-semibold text-foreground">Equity path</h3><p className="mt-0.5 text-[8px] text-muted">Cumulative imported net P&amp;L in chronological order</p></div>
                  <LineChart className="h-4 w-4 text-primary" />
                </div>
                <div className="p-3"><EquityCurve trades={filteredTrades} /></div>
              </Card>
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div><h3 className="text-[11px] font-semibold text-foreground">Daily outcomes</h3><p className="mt-0.5 text-[8px] text-muted">Last 18 traded days</p></div>
                  <BarChart3 className="h-4 w-4 text-muted" />
                </div>
                <div className="px-3 pb-3"><DailyBars trades={filteredTrades} /></div>
              </Card>
            </div>

            {accountFilter === "all" ? (
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,.75fr)]">
                <PerformanceList title="Account performance" rows={byAccount} />
                <Card className="p-4">
                  <div className="flex items-center gap-2"><Layers3 className="h-4 w-4 text-primary" /><h3 className="text-[11px] font-semibold text-foreground">Consolidated record</h3></div>
                  <p className="mt-2 text-[9px] leading-4 text-muted">Overall Journal combines every connected account without merging their source records. Select any account above to isolate its P&amp;L, calendar, trades, evidence, and edge statistics.</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-border bg-background/35 p-3"><div className="text-[7px] uppercase tracking-[0.12em] text-muted">Accounts</div><div className="mt-1 font-mono text-[18px] font-semibold text-foreground">{accounts.length}</div></div>
                    <div className="rounded-xl border border-border bg-background/35 p-3"><div className="text-[7px] uppercase tracking-[0.12em] text-muted">ZYON outcomes</div><div className="mt-1 font-mono text-[18px] font-semibold text-primary">{zyonTrades.length}</div></div>
                  </div>
                </Card>
              </div>
            ) : null}

            <div className="grid gap-3 xl:grid-cols-3">
              <Card className="overflow-hidden xl:col-span-2">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div><h3 className="text-[11px] font-semibold text-foreground">Review queue</h3><p className="mt-0.5 text-[8px] text-muted">Imported truth becomes useful when context and evidence are attached</p></div>
                  <button type="button" onClick={() => { setOutcomeFilter("needs-review"); setTab("trades"); }} className="text-[8px] font-semibold text-primary">VIEW ALL</button>
                </div>
                <div className="divide-y divide-border/60">
                  {unreviewed.slice(0, 6).map((trade) => (
                    <button key={trade.id} type="button" onClick={() => setSelectedTradeId(trade.id)} className="grid w-full grid-cols-[90px_70px_minmax(90px,1fr)_86px_22px] items-center gap-3 px-4 py-2.5 text-left text-[9px] hover:bg-surface/50">
                      <span className="font-mono text-muted">{formatDate(trade.closedAt ?? trade.openedAt)}</span>
                      <span className="font-semibold text-foreground">{trade.symbol}</span>
                      <span className="truncate text-muted">{trade.setup || trade.tags.join(", ") || "No setup classified"}</span>
                      <span className={`text-right font-mono font-semibold ${trade.netPnl >= 0 ? "text-[var(--journal-win)]" : "text-[var(--journal-loss)]"}`}>{money(trade.netPnl)}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted" />
                    </button>
                  ))}
                  {!unreviewed.length ? <div className="flex items-center justify-center gap-2 px-4 py-10 text-[10px] text-primary"><Check className="h-4 w-4" />Every visible trade is reviewed.</div> : null}
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /><h3 className="text-[11px] font-semibold text-foreground">Data integrity</h3></div>
                <div className="mt-4 space-y-4">
                  {[
                    ["Entry, exit and side", entryExitComplete],
                    ["Risk / R data", riskComplete],
                    ["Trade reviewed", stats.reviewedPercent],
                    ["Evidence linked", evidencePercent],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <div className="mb-1.5 flex justify-between text-[8px]"><span className="text-muted">{String(label)}</span><span className="font-mono text-foreground">{percent(value as number | null, 0)}</span></div>
                      <div className="h-1.5 rounded-full bg-surface"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, Number(value ?? 0) * 100))}%` }} /></div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-xl border border-border bg-background/40 p-3 text-[8px] leading-4 text-muted">Review Integrity measures record completeness, completed review, and attached evidence. It does not predict profitability.</div>
              </Card>
            </div>
          </div>
        ) : null}

        {filteredTrades.length && tab === "calendar" ? (
          <div className="space-y-3 p-3">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <button type="button" onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button>
                <div className="text-center"><h2 className="text-[13px] font-semibold text-foreground">{calendarMonth.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}</h2><p className="mt-0.5 text-[8px] text-muted">Select a day to inspect its imported trades</p></div>
                <button type="button" onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><ChevronRight className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-7 border-b border-border bg-surface/25">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="px-2 py-2 text-center text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">{day}</div>)}
              </div>
              <div className="grid grid-cols-7">
                {calendarDays.map((day, index) => day ? (
                  <button key={day.dateKey} type="button" onClick={() => setSelectedDay(day.dateKey)} className={`group min-h-[108px] border-b border-r border-border p-2 text-left transition-colors hover:bg-surface/60 ${selectedDay === day.dateKey ? "bg-primary/[0.07] shadow-[inset_0_0_0_1px_var(--primary)]" : day.trades.length ? day.pnl >= 0 ? "bg-[var(--journal-win-soft)]" : "bg-[var(--journal-loss-soft)]" : "bg-background/20"}`}>
                    <div className="flex items-start justify-between gap-1"><span className="font-mono text-[9px] text-muted">{day.day}</span>{day.evidence ? <Paperclip className="h-3 w-3 text-accent" /> : null}</div>
                    {day.trades.length ? <><div className={`mt-4 font-mono text-[11px] font-semibold ${day.pnl >= 0 ? "text-[var(--journal-win)]" : "text-[var(--journal-loss)]"}`}>{money(day.pnl)}</div><div className="mt-1 text-[8px] text-muted">{day.trades.length} trade{day.trades.length === 1 ? "" : "s"}</div><div className="mt-2 h-1 rounded-full bg-surface"><div className="h-full rounded-full bg-primary" style={{ width: `${day.trades.length ? day.reviewed / day.trades.length * 100 : 0}%` }} /></div></> : null}
                  </button>
                ) : <div key={`blank-${index}`} className="min-h-[108px] border-b border-r border-border bg-background/10" />)}
              </div>
            </Card>
            {selectedDay ? (
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-border px-4 py-3"><div><h3 className="text-[11px] font-semibold text-foreground">{formatDate(`${selectedDay}T12:00:00`)}</h3><p className="mt-0.5 text-[8px] text-muted">{selectedDayTrades.length} imported trades · {money(selectedDayTrades.reduce((sum, trade) => sum + trade.netPnl, 0))}</p></div><button type="button" onClick={() => setSelectedDay("")} className="text-muted hover:text-foreground"><X className="h-4 w-4" /></button></div>
                <div className="divide-y divide-border/60">{selectedDayTrades.map((trade) => <button key={trade.id} type="button" onClick={() => setSelectedTradeId(trade.id)} className="grid w-full grid-cols-[74px_70px_64px_minmax(80px,1fr)_90px] items-center gap-3 px-4 py-3 text-left text-[9px] hover:bg-surface/40"><span className="font-mono text-muted">{new Date(trade.openedAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}</span><span className="font-semibold">{trade.symbol}</span><span className={trade.side === "LONG" ? "text-[var(--journal-win)]" : "text-[var(--journal-loss)]"}>{trade.side}</span><span className="truncate text-muted">{trade.setup || trade.tags.join(", ") || "Unclassified"}</span><span className={`text-right font-mono font-semibold ${trade.netPnl >= 0 ? "text-[var(--journal-win)]" : "text-[var(--journal-loss)]"}`}>{money(trade.netPnl)}</span></button>)}</div>
              </Card>
            ) : null}
          </div>
        ) : null}

        {filteredTrades.length && tab === "trades" ? (
          <div className="space-y-3 p-3">
            <Card className="flex flex-wrap items-center gap-2 p-3">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search symbol, setup, tag, note or source file" className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-[9px] text-foreground outline-none focus:border-primary/45" />
              </div>
              <KwantSelect value={outcomeFilter} onChange={(event) => setOutcomeFilter(event.target.value as OutcomeFilter)} className="h-9 rounded-xl border border-border bg-background px-3 text-[9px] text-foreground outline-none">
                <option value="all">All outcomes</option><option value="wins">Wins</option><option value="losses">Losses</option><option value="breakeven">Breakeven</option><option value="needs-review">Needs review</option>
              </KwantSelect>
              <KwantSelect value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} className="h-9 rounded-xl border border-border bg-background px-3 text-[9px] text-foreground outline-none">
                <option value="closedAt">Sort: Date</option><option value="netPnl">Sort: Net P&amp;L</option><option value="rMultiple">Sort: R</option><option value="quantity">Sort: Size</option><option value="symbol">Sort: Symbol</option>
              </KwantSelect>
              <button type="button" onClick={() => setSortDirection((current) => current === "desc" ? "asc" : "desc")} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-muted hover:text-foreground" title="Reverse sort">{sortDirection === "desc" ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</button>
              <button type="button" onClick={() => exportJournal("csv")} className="flex h-9 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-[9px] font-semibold text-muted hover:text-foreground"><Download className="h-3.5 w-3.5" />CSV</button>
            </Card>
            {tradeMutationError ? <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/[0.07] px-3 py-2 text-[9px] text-danger"><CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />{tradeMutationError}</div> : null}
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] border-collapse text-[9px]">
                  <thead className="bg-surface/45 text-muted">
                    <tr>{["Date / time", "Account", "Symbol", "Side", "Qty", "Entry", "Exit", "Net P&L", "R", "Duration", "Setup / tags", "Review", ""].map((header, index) => <th key={`${header}:${index}`} className="border-b border-border px-3 py-2.5 text-left font-semibold uppercase tracking-[0.08em]">{header}</th>)}</tr>
                  </thead>
                  <tbody>
                    {filteredTrades.map((trade) => (
                      <tr key={trade.id} onClick={() => setSelectedTradeId(trade.id)} className="cursor-pointer border-b border-border/55 transition-colors hover:bg-surface/45">
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-muted">{formatDate(trade.closedAt ?? trade.openedAt, true)}</td>
                        <td className="max-w-[140px] truncate px-3 py-2.5 text-muted" title={trade.account}>{trade.account}</td>
                        <td className="px-3 py-2.5 font-semibold text-foreground">{trade.symbol}</td>
                        <td className={`px-3 py-2.5 font-semibold ${trade.side === "LONG" ? "text-[var(--journal-win)]" : trade.side === "SHORT" ? "text-[var(--journal-loss)]" : "text-muted"}`}>{trade.side}</td>
                        <td className="px-3 py-2.5 font-mono">{trade.quantity.toLocaleString()}</td>
                        <td className="px-3 py-2.5 font-mono">{trade.entryPrice?.toLocaleString("en-US", { maximumFractionDigits: 6 }) ?? "—"}</td>
                        <td className="px-3 py-2.5 font-mono">{trade.exitPrice?.toLocaleString("en-US", { maximumFractionDigits: 6 }) ?? "—"}</td>
                        <td className={`px-3 py-2.5 font-mono font-semibold ${trade.netPnl >= 0 ? "text-[var(--journal-win)]" : "text-[var(--journal-loss)]"}`}>{money(trade.netPnl)}</td>
                        <td className="px-3 py-2.5 font-mono">{trade.rMultiple === null ? "—" : `${trade.rMultiple.toFixed(2)}R`}</td>
                        <td className="px-3 py-2.5 text-muted">{formatDuration(trade.durationMs)}</td>
                        <td className="max-w-[220px] truncate px-3 py-2.5 text-muted">{trade.setup || trade.tags.join(", ") || "—"}</td>
                        <td className="px-3 py-2.5">{trade.reviewedAt ? <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-primary"><Check className="h-2.5 w-2.5" />Reviewed</span> : <span className="rounded-full bg-warning/10 px-2 py-1 text-warning">Pending</span>}</td>
                        <td className="relative w-12 px-2 py-2.5 text-right" onClick={(event) => event.stopPropagation()}>
                          <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { const bounds = event.currentTarget.getBoundingClientRect(); setTradeMenuId((current) => current?.tradeId === trade.id ? null : { tradeId: trade.id, x: Math.max(12, Math.min(window.innerWidth - 172, bounds.right - 160)), y: Math.max(12, Math.min(window.innerHeight - 134, bounds.bottom + 6)) }); }} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground" aria-label={`${trade.symbol} trade options`}><MoreVertical className="h-4 w-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filteredTrades.length ? <div className="px-6 py-16 text-center text-[10px] text-muted">No trades match these filters.</div> : null}
              </div>
            </Card>
          </div>
        ) : null}

        {filteredTrades.length && tab === "edgebook" ? (
          <div className="space-y-3 p-3">
            <div className="grid gap-3 xl:grid-cols-2">
              <PerformanceList title="Instrument edge" rows={bySymbol} />
              <PerformanceList title="Setup and tag edge" rows={bySetup} />
              <PerformanceList title="Day-of-week edge" rows={byWeekday} />
              <PerformanceList title="Entry-hour edge" rows={byHour} />
            </div>
            <Card className="p-4">
              <div className="flex items-center gap-2"><Tags className="h-4 w-4 text-primary" /><h3 className="text-[11px] font-semibold text-foreground">Direction comparison</h3></div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {bySide.map((row) => <div key={row.label} className="rounded-xl border border-border bg-background/35 p-3"><div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">{row.label}</div><div className={`mt-2 font-mono text-[18px] font-semibold ${row.netPnl >= 0 ? "text-[var(--journal-win)]" : "text-[var(--journal-loss)]"}`}>{money(row.netPnl)}</div><div className="mt-1 text-[8px] text-muted">{row.tradeCount} trades · {percent(row.winRate)} win · {ratio(row.profitFactor)} PF</div></div>)}
              </div>
              <p className="mt-3 text-[8px] leading-4 text-muted">Edgebook ranks only the selected imported population. Treat small samples as questions to investigate, not proof of a repeatable edge.</p>
            </Card>
          </div>
        ) : null}

        {tab === "analysis" ? (
          <div className="space-y-3 p-3">
            <Card className="relative overflow-hidden p-4">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,color-mix(in_srgb,var(--primary)_11%,transparent),transparent_36%)]" />
              <div className="relative flex flex-wrap items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary"><BrainCircuit className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">Quant mentor analysis</h2>
                    {journalAnalysis ? <AnalysisConfidenceBadge value={journalAnalysis.confidence} /> : null}
                    {analysisIsStale ? <span className="rounded-full border border-warning/25 bg-warning/10 px-2 py-1 text-[7px] font-semibold text-warning">NEW JOURNAL DATA</span> : null}
                  </div>
                  <p className="mt-1 max-w-3xl text-[9px] leading-4 text-muted">A per-account review grounded in recorded expectancy, risk, drawdown, setups, timing, process quality and recent change. The model interprets fixed calculations; it cannot invent the evidence.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void runJournalAnalysis()}
                  disabled={analysisEvidence.performance.trades < 3 || analysisStatus === "generating"}
                  className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[9px] font-semibold text-background transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${analysisStatus === "generating" ? "animate-spin" : ""}`} />
                  {analysisStatus === "generating" ? `Analyzing · ${analysisElapsedSeconds}s` : journalAnalysis ? "Refresh analysis" : "Run analysis"}
                </button>
              </div>
            </Card>

            {analysisStatus === "generating" ? (
              <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/[0.055] px-4 py-3">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_50%,color-mix(in_srgb,var(--primary)_12%,transparent),transparent_34%)]" />
                <div className="relative flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary"><BrainCircuit className="h-4 w-4 animate-pulse" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3"><span className="text-[9px] font-semibold text-foreground">{analysisProgress.title}</span><span className="font-mono text-[8px] text-primary">{analysisElapsedSeconds}s</span></div>
                    <div className="mt-1 text-[8px] leading-4 text-muted">{analysisProgress.detail}</div>
                    <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-primary transition-[width] duration-1000" style={{ width: `${Math.min(94, 10 + analysisElapsedSeconds * 2)}%` }} /></div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              <MetricCard label="Evidence window" value={`${analysisEvidence.performance.trades}`} detail={`${analysisEvidence.window.tradedDays} traded days · ${formatDate(analysisEvidence.window.firstTradeAt)} to ${formatDate(analysisEvidence.window.lastTradeAt)}`} icon={FileSpreadsheet} />
              <MetricCard label="Expectancy" value={money(analysisEvidence.performance.expectancy)} detail="Deterministic net result per trade" icon={Sparkles} tone={(analysisEvidence.performance.expectancy ?? 0) >= 0 ? "positive" : "negative"} />
              <MetricCard label="Profit factor" value={analysisEvidence.performance.profitFactorState === "NO LOSSES" ? "No losses" : ratio(analysisEvidence.performance.profitFactor)} detail={`${money(analysisEvidence.performance.grossProfit, false)} gross profit · ${money(analysisEvidence.performance.grossLoss, false)} gross loss`} icon={BarChart3} />
              <MetricCard label="Max drawdown" value={money(-analysisEvidence.performance.maxDrawdown)} detail="Peak-to-trough recorded P&L" icon={TrendingDown} tone="negative" />
              <MetricCard label="Review integrity" value={`${analysisEvidence.dataQuality.reviewIntegrityScore}%`} detail={`${analysisEvidence.dataQuality.reviewedPercent}% reviewed · ${analysisEvidence.dataQuality.riskCompletePercent}% risk-complete`} icon={ShieldCheck} tone={analysisEvidence.dataQuality.reviewIntegrityScore >= 80 ? "positive" : "neutral"} />
            </div>

            {analysisError ? (
              <div className="flex items-start gap-2 rounded-2xl border border-danger/25 bg-danger/[0.07] px-4 py-3 text-[9px] leading-4 text-danger"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{analysisError}</div>
            ) : null}

            {analysisEvidence.performance.trades < 3 ? (
              <Card className="flex min-h-[330px] flex-col items-center justify-center border-dashed px-6 py-16 text-center">
                <BrainCircuit className="h-8 w-8 text-muted" />
                <h3 className="mt-4 text-[13px] font-semibold text-foreground">The mentor needs a minimum defensible sample.</h3>
                <p className="mt-2 max-w-lg text-[9px] leading-4 text-muted">Add at least three closed trades to begin. Confidence remains explicitly low on small samples, and no setup is called an edge until the data can support it.</p>
              </Card>
            ) : null}

            {analysisEvidence.performance.trades >= 3 && (analysisStatus === "loading" || analysisStatus === "idle") && !journalAnalysis ? (
              <Card className="min-h-[330px] overflow-hidden"><KwantLoader className="min-h-[330px]" icon={BrainCircuit} title="Loading mentor memory" detail={`Restoring the last evidence-backed review for ${analysisAccount}`} /></Card>
            ) : null}

            {analysisEvidence.performance.trades >= 3 && analysisStatus === "generating" && !journalAnalysis ? (
              <Card className="min-h-[360px] overflow-hidden"><KwantLoader className="min-h-[360px]" icon={BrainCircuit} title={analysisProgress.title} detail={analysisProgress.detail} /></Card>
            ) : null}

            {analysisEvidence.performance.trades >= 3 && analysisStatus !== "loading" && analysisStatus !== "idle" && !journalAnalysis && analysisStatus !== "generating" ? (
              <Card className="relative overflow-hidden px-6 py-16 text-center">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,color-mix(in_srgb,var(--primary)_9%,transparent),transparent_38%)]" />
                <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary"><BrainCircuit className="h-6 w-6" /></span>
                <h3 className="relative mt-5 text-[18px] font-semibold tracking-[-0.025em] text-foreground">Turn the record into a measurable operating plan.</h3>
                <p className="relative mx-auto mt-2 max-w-2xl text-[10px] leading-5 text-muted">The review will identify supported strengths, probable leaks, conditional edges and the three highest-value improvements. Every claim carries its sample and confidence.</p>
                <button type="button" onClick={() => void runJournalAnalysis()} className="relative mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-[10px] font-semibold text-background hover:brightness-110"><BrainCircuit className="h-4 w-4" />Run evidence-backed analysis</button>
              </Card>
            ) : null}

            {journalAnalysis ? (
              <>
                {analysisIsStale ? (
                  <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-warning/25 bg-warning/[0.06] px-4 py-3">
                    <RefreshCw className="h-4 w-4 text-warning" />
                    <div className="min-w-0 flex-1"><div className="text-[9px] font-semibold text-warning">This analysis predates the current journal record.</div><div className="mt-0.5 text-[8px] text-muted">The saved review stays visible until you choose to refresh it.</div></div>
                    <button type="button" onClick={() => void runJournalAnalysis()} disabled={analysisStatus === "generating"} className="rounded-lg border border-warning/30 px-3 py-1.5 text-[8px] font-semibold text-warning disabled:opacity-40">REFRESH NOW</button>
                  </div>
                ) : null}

                <Card className="relative overflow-hidden p-5">
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,color-mix(in_srgb,var(--primary)_7%,transparent),transparent_48%)]" />
                  <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,.6fr)]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-[7px] font-semibold uppercase tracking-[0.14em] text-primary"><BrainCircuit className="h-3.5 w-3.5" />Quantitative read · {formatDate(journalAnalysis.generatedAt, true)}</div>
                      <h3 className="mt-3 max-w-4xl text-[20px] font-semibold leading-tight tracking-[-0.03em] text-foreground">{journalAnalysis.headline}</h3>
                      <p className="mt-3 max-w-4xl text-[10px] leading-[1.75] text-foreground/85">{journalAnalysis.executiveRead}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-background/45 p-4">
                      <div className="text-[7px] font-semibold uppercase tracking-[0.14em] text-muted">Trader profile · evidence only</div>
                      <p className="mt-2 text-[9px] leading-[1.65] text-muted">{journalAnalysis.traderProfile}</p>
                      <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-3 text-[7px] text-muted"><span>{journalAnalysis.model}</span><AnalysisConfidenceBadge value={journalAnalysis.confidence} /></div>
                    </div>
                  </div>
                </Card>

                <div className="grid gap-3 xl:grid-cols-2">
                  <Card className="overflow-hidden">
                    <div className="flex items-center gap-2 border-b border-border px-4 py-3"><TrendingUp className="h-4 w-4 text-primary" /><div><h3 className="text-[11px] font-semibold text-foreground">What is working</h3><p className="mt-0.5 text-[8px] text-muted">Strengths supported by the selected record</p></div></div>
                    <div className="space-y-2 p-3">{journalAnalysis.strengths.map((finding, index) => <AnalysisFindingCard key={`${finding.title}-${index}`} finding={finding} kind="strength" />)}</div>
                  </Card>
                  <Card className="overflow-hidden">
                    <div className="flex items-center gap-2 border-b border-border px-4 py-3"><Target className="h-4 w-4 text-accent" /><div><h3 className="text-[11px] font-semibold text-foreground">Where the edge may live</h3><p className="mt-0.5 text-[8px] text-muted">Conditional advantages, separated from small-sample noise</p></div></div>
                    <div className="space-y-2 p-3">
                      {journalAnalysis.edges.map((finding, index) => <AnalysisFindingCard key={`${finding.title}-${index}`} finding={finding} kind="edge" />)}
                      {!journalAnalysis.edges.length ? <div className="rounded-2xl border border-dashed border-border px-5 py-12 text-center text-[9px] leading-4 text-muted">No repeatable edge can be defended from the present sample yet. That is a valid analytical result.</div> : null}
                    </div>
                  </Card>
                </div>

                <Card className="overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-border px-4 py-3"><CircleAlert className="h-4 w-4 text-danger" /><div><h3 className="text-[11px] font-semibold text-foreground">Leaks and critique</h3><p className="mt-0.5 text-[8px] text-muted">Direct criticism tied to quantified cost, inconsistency or missing process evidence</p></div></div>
                  <div className="grid gap-2 p-3 xl:grid-cols-2">{journalAnalysis.leaks.map((finding, index) => <AnalysisFindingCard key={`${finding.title}-${index}`} finding={finding} kind="leak" />)}</div>
                </Card>

                <Card className="overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-border px-4 py-3"><Target className="h-4 w-4 text-primary" /><div><h3 className="text-[11px] font-semibold text-foreground">Three-priority operating plan</h3><p className="mt-0.5 text-[8px] text-muted">Measurable corrections ranked by expected decision value</p></div></div>
                  <div className="grid gap-2 p-3 xl:grid-cols-3">
                    {journalAnalysis.priorities.map((priority) => (
                      <div key={`${priority.rank}-${priority.action}`} className="rounded-2xl border border-border bg-background/35 p-4">
                        <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-[10px] font-bold text-background">{priority.rank}</span><h4 className="text-[10px] font-semibold leading-4 text-foreground">{priority.action}</h4></div>
                        <div className="mt-3 space-y-2 text-[8px] leading-4">
                          <div><span className="font-semibold uppercase tracking-[0.1em] text-muted">Measure</span><p className="mt-0.5 text-foreground/85">{priority.measurement}</p></div>
                          <div><span className="font-semibold uppercase tracking-[0.1em] text-muted">Target</span><p className="mt-0.5 font-mono text-primary">{priority.target}</p></div>
                          <p className="border-t border-border/70 pt-2 text-muted">{priority.rationale}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <div className="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,.75fr)]">
                  <Card className="p-5">
                    <div className="flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.14em] text-primary"><Bot className="h-4 w-4" />Mentor note</div>
                    <p className="mt-3 text-[10px] leading-[1.8] text-foreground/90">{journalAnalysis.mentorNote}</p>
                  </Card>
                  <Card className="p-5">
                    <div className="text-[8px] font-semibold uppercase tracking-[0.14em] text-muted">Limits of this read</div>
                    <ul className="mt-3 space-y-2">{journalAnalysis.caveats.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2 text-[8px] leading-4 text-muted"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-warning" />{item}</li>)}</ul>
                    <p className="mt-4 border-t border-border/70 pt-3 text-[7px] leading-4 text-muted">Performance analysis and educational decision support only. It is not financial advice and does not predict future results.</p>
                  </Card>
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        {tab === "evidence" ? (
          <div className="space-y-3 p-3">
            <Card className="flex flex-wrap items-center gap-3 p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><ImageIcon className="h-4 w-4" /></span>
              <div><h2 className="text-[11px] font-semibold text-foreground">Evidence library</h2><p className="mt-0.5 text-[8px] text-muted">{filteredEvidence.length} screenshots and notes · attach evidence inside any trade review</p></div>
              {zyonJournalSelected
                ? <span className="ml-auto rounded-xl border border-primary/20 bg-primary/[0.07] px-3 py-2 text-[8px] font-semibold text-primary">Automatic from ZYON</span>
                : <button type="button" onClick={openImportDialog} className="ml-auto flex h-8 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-[9px] font-semibold text-muted hover:text-foreground"><Upload className="h-3.5 w-3.5" />Add evidence</button>}
            </Card>
            {filteredEvidence.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
                {filteredEvidence.map((item) => (
                  <Card key={item.id} className="group overflow-hidden">
                    <button type="button" onClick={() => setSelectedEvidenceId(item.id)} className="block w-full text-left">
                      {item.mimeType.startsWith("image/") ? (
                        <Image src={item.dataUrl} alt={item.name} width={520} height={320} unoptimized className="h-44 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
                      ) : (
                        <div className="flex h-44 items-center justify-center bg-surface/35"><FileText className="h-8 w-8 text-muted" /></div>
                      )}
                      <div className="p-3">
                        <div className="truncate text-[9px] font-semibold text-foreground" title={item.name}>{item.name}</div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-[8px] text-muted"><span>{formatDate(item.importedAt)}</span><span>{item.tradeId ? "Attached" : "Unattached"}</span></div>
                      </div>
                    </button>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="flex flex-col items-center justify-center border-dashed px-6 py-20 text-center"><ImageIcon className="h-8 w-8 text-muted" /><div className="mt-4 text-[11px] font-semibold text-foreground">{zyonJournalSelected ? "No ZYON evidence yet" : "No evidence imported"}</div><div className="mt-1 max-w-md text-[9px] leading-4 text-muted">{zyonJournalSelected ? "Evidence is added automatically when a ZYON Gameplan completes its outcome review." : "Import chart screenshots, research images, Markdown, or text notes. Evidence can then be attached to a trade review."}</div></Card>
            )}
          </div>
        ) : null}

        {tab === "imports" ? (
          <div className="space-y-3 p-3">
            <Card className="flex flex-wrap items-center gap-3 p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><FolderArchive className="h-4 w-4" /></span>
              <div><h2 className="text-[11px] font-semibold text-foreground">Import lineage</h2><p className="mt-0.5 text-[8px] text-muted">Every source stays visible, including rejected rows, duplicates, and parsing warnings</p></div>
              <button type="button" onClick={openImportDialog} className="ml-auto flex h-8 items-center gap-1.5 rounded-xl bg-primary px-3 text-[9px] font-semibold text-background"><Upload className="h-3.5 w-3.5" />New import</button>
            </Card>
            <div className="space-y-2">
              {filteredImports.map((batch) => (
                <Card key={batch.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-muted">{batch.detectedSchema === "json" ? <FileJson className="h-4 w-4" /> : batch.detectedSchema === "evidence" ? <ImageIcon className="h-4 w-4" /> : batch.detectedSchema === "notes" ? <FileText className="h-4 w-4" /> : <FileSpreadsheet className="h-4 w-4" />}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="truncate text-[10px] font-semibold text-foreground">{batch.fileName}</span><span className="rounded-md border border-border bg-surface px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.1em] text-muted">{batch.detectedSchema}</span></div>
                      <div className="mt-1 text-[8px] text-muted">{batch.account} · {formatDate(batch.importedAt, true)} · {Math.max(1, Math.round(batch.fileSize / 1024))} KB</div>
                      <div className="mt-3 flex flex-wrap gap-2 text-[8px]">
                        <span className="rounded-lg bg-primary/10 px-2 py-1 text-primary">{batch.acceptedTrades} trades</span>
                        <span className="rounded-lg bg-accent/10 px-2 py-1 text-accent">{batch.evidenceCount} evidence</span>
                        {batch.duplicateTrades ? <span className="rounded-lg bg-warning/10 px-2 py-1 text-warning">{batch.duplicateTrades} duplicates</span> : null}
                        {batch.rejectedRows ? <span className="rounded-lg bg-danger/10 px-2 py-1 text-danger">{batch.rejectedRows} rejected/open rows</span> : null}
                      </div>
                      {batch.warnings.length ? <div className="mt-3 space-y-1">{batch.warnings.map((warning) => <div key={warning} className="flex items-start gap-1.5 text-[8px] leading-4 text-warning"><CircleAlert className="mt-0.5 h-3 w-3 shrink-0" />{warning}</div>)}</div> : null}
                    </div>
                    <button type="button" onClick={() => deleteImport(batch)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger" title="Remove this import"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </Card>
              ))}
              {!filteredImports.length ? <Card className="border-dashed px-6 py-20 text-center text-[10px] text-muted">No import history yet.</Card> : null}
            </div>
          </div>
        ) : null}
      </div>

      {accountMenu ? (
        <div className="fixed inset-0 z-[1150]" onMouseDown={() => setAccountMenu(null)} onContextMenu={(event) => { event.preventDefault(); setAccountMenu(null); }}>
          <div className="fixed w-[200px] overflow-hidden rounded-2xl border border-border bg-panel p-1.5 shadow-2xl shadow-black/70" style={{ left: accountMenu.x, top: accountMenu.y }} onMouseDown={(event) => event.stopPropagation()}>
            <div className="truncate border-b border-border px-3 py-2 text-[8px] font-semibold text-foreground">{accountMenu.account}</div>
            <button type="button" onClick={() => { setRenameJournalTarget(accountMenu.account); setRenameJournalDraft(accountMenu.account); setRenameJournalError(""); setAccountMenu(null); }} disabled={Boolean(journalLifecycleBusy)} className="mt-1 flex h-9 w-full items-center gap-2 rounded-xl px-3 text-left text-[9px] font-semibold text-muted hover:bg-primary/[0.08] hover:text-primary disabled:opacity-40"><Pencil className="h-3.5 w-3.5" />Rename Journal</button>
            <button type="button" onClick={() => void archiveJournal(accountMenu.account)} disabled={Boolean(journalLifecycleBusy)} className="flex h-9 w-full items-center gap-2 rounded-xl px-3 text-left text-[9px] font-semibold text-muted hover:bg-primary/[0.08] hover:text-primary disabled:opacity-40"><FolderArchive className="h-3.5 w-3.5" />Archive Journal</button>
            <button type="button" onClick={() => { setDeleteJournalTarget(accountMenu.account); setAccountMenu(null); }} disabled={Boolean(journalLifecycleBusy)} className="flex h-9 w-full items-center gap-2 rounded-xl px-3 text-left text-[9px] font-semibold text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" />Delete permanently</button>
          </div>
        </div>
      ) : null}

      {renameJournalTarget ? (
        <div className="fixed inset-0 z-[1160] flex items-center justify-center bg-black/72 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !journalLifecycleBusy) setRenameJournalTarget(null); }}>
          <form onSubmit={(event) => { event.preventDefault(); void renameJournal(); }} className="w-full max-w-[440px] overflow-hidden rounded-3xl border border-border bg-panel shadow-2xl shadow-black/70">
            <div className="flex items-start gap-3 border-b border-border px-5 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Pencil className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1"><h2 className="text-[14px] font-semibold text-foreground">Rename Journal</h2><p className="mt-1 text-[9px] leading-4 text-muted">The new name will follow this Journal, its trades and evidence on every device.</p></div>
              <button type="button" disabled={Boolean(journalLifecycleBusy)} onClick={() => setRenameJournalTarget(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground disabled:opacity-40"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5">
              <label className="block text-[8px] font-semibold uppercase tracking-[0.14em] text-muted">Journal name</label>
              <input autoFocus value={renameJournalDraft} maxLength={80} onChange={(event) => { setRenameJournalDraft(event.target.value); setRenameJournalError(""); }} className="mt-2 h-12 w-full rounded-2xl border border-border bg-background px-4 text-[11px] font-semibold text-foreground outline-none transition-colors placeholder:text-muted/55 focus:border-primary/45" placeholder="My KwantDesk Journal" />
              {renameJournalError ? <div className="mt-3 flex items-start gap-2 rounded-xl border border-danger/20 bg-danger/[0.06] px-3 py-2 text-[8px] leading-4 text-danger"><CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />{renameJournalError}</div> : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <button type="button" disabled={Boolean(journalLifecycleBusy)} onClick={() => setRenameJournalTarget(null)} className="h-10 rounded-xl border border-border px-4 text-[9px] font-semibold text-muted hover:bg-surface hover:text-foreground disabled:opacity-40">Cancel</button>
              <button type="submit" disabled={Boolean(journalLifecycleBusy) || !renameJournalDraft.trim()} className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-[9px] font-bold text-primary-foreground hover:brightness-110 disabled:opacity-40">{journalLifecycleBusy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Save name</button>
            </div>
          </form>
        </div>
      ) : null}

      {showArchive ? (
        <div className="fixed inset-0 z-[1050] flex items-center justify-center bg-black/72 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !journalLifecycleBusy) setShowArchive(false); }}>
          <div className="flex max-h-[82vh] w-full max-w-[720px] flex-col overflow-hidden rounded-3xl border border-border bg-panel shadow-2xl shadow-black/70">
            <div className="flex items-start gap-3 border-b border-border px-5 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><FolderArchive className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1"><h2 className="text-[14px] font-semibold text-foreground">Archived Journals</h2><p className="mt-1 text-[9px] leading-4 text-muted">Archived accounts keep every trade, screenshot, import and analysis, but stay out of your active Journal and consolidated statistics.</p></div>
              <button type="button" disabled={Boolean(journalLifecycleBusy)} onClick={() => setShowArchive(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground disabled:opacity-40"><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
              {archivedAccountViews.map((account) => (
                <div key={account.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-background/35 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-muted">{account.source === "manual" ? <NotebookPen className="h-4 w-4" /> : <FileSpreadsheet className="h-4 w-4" />}</span>
                  <div className="min-w-[180px] flex-1"><div className="truncate text-[10px] font-semibold text-foreground">{account.name}</div><div className="mt-1 text-[8px] text-muted">Archived {formatDate(account.archivedAt ?? account.updatedAt, true)} · {account.stats.tradeCount} trades · {money(account.stats.netPnl)}</div></div>
                  <button type="button" onClick={() => void restoreJournal(account.name)} disabled={Boolean(journalLifecycleBusy)} className="flex h-9 items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.07] px-3 text-[9px] font-semibold text-primary hover:bg-primary/[0.12] disabled:opacity-40">{journalLifecycleBusy === account.name ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ArchiveRestore className="h-3.5 w-3.5" />}Restore</button>
                  <button type="button" onClick={() => setDeleteJournalTarget(account.name)} disabled={Boolean(journalLifecycleBusy)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted hover:border-danger/25 hover:bg-danger/10 hover:text-danger disabled:opacity-40" title="Delete Journal permanently"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              {!archivedAccountViews.length ? <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 text-center"><FolderArchive className="h-7 w-7 text-muted" /><h3 className="mt-4 text-[12px] font-semibold text-foreground">Archive is empty</h3><p className="mt-2 max-w-sm text-[9px] leading-4 text-muted">Right-click a Journal account or use its three-dot menu to archive it without losing its record.</p></div> : null}
            </div>
          </div>
        </div>
      ) : null}

      {deleteJournalTarget ? (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !journalLifecycleBusy) setDeleteJournalTarget(null); }}>
          <div className="w-full max-w-[470px] overflow-hidden rounded-3xl border border-danger/25 bg-panel shadow-2xl shadow-black/80">
            <div className="p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-danger/25 bg-danger/10 text-danger"><Trash2 className="h-5 w-5" /></span>
              <h2 className="mt-5 text-[17px] font-semibold tracking-[-0.02em] text-foreground">Delete “{deleteJournalTarget}”?</h2>
              <p className="mt-2 text-[9px] leading-5 text-muted">This permanently removes the Journal account, its trades, imports, screenshots and saved analysis. This action cannot be undone. Archive it instead if you may need the record later.</p>
              <div className="mt-4 rounded-2xl border border-danger/20 bg-danger/[0.05] p-3 text-[8px] text-danger">You are deleting {state.trades.filter((trade) => trade.account === deleteJournalTarget).length} recorded trade{state.trades.filter((trade) => trade.account === deleteJournalTarget).length === 1 ? "" : "s"} and {state.evidence.filter((item) => item.account === deleteJournalTarget).length} evidence file{state.evidence.filter((item) => item.account === deleteJournalTarget).length === 1 ? "" : "s"}.</div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border bg-background/20 px-5 py-4">
              <button type="button" disabled={Boolean(journalLifecycleBusy)} onClick={() => setDeleteJournalTarget(null)} className="h-9 rounded-xl border border-border px-4 text-[9px] font-semibold text-muted hover:bg-surface hover:text-foreground disabled:opacity-40">Cancel</button>
              <button type="button" disabled={Boolean(journalLifecycleBusy)} onClick={() => void deleteJournalForever(deleteJournalTarget)} className="flex h-9 items-center gap-2 rounded-xl bg-danger px-4 text-[9px] font-semibold text-white hover:brightness-110 disabled:opacity-40">{journalLifecycleBusy === deleteJournalTarget ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}Delete Journal forever</button>
            </div>
          </div>
        </div>
      ) : null}

      {showImport ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowImport(false); }}>
          <div className="w-full max-w-[650px] overflow-hidden rounded-3xl border border-border bg-panel shadow-2xl shadow-black/60">
            <div className="flex items-start gap-3 border-b border-border px-5 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{importDialogPurpose === "append-trades" ? <Upload className="h-4 w-4" /> : <BookPlus className="h-4 w-4" />}</span>
              <div><h2 className="text-[14px] font-semibold text-foreground">{importDialogPurpose === "append-trades" ? `Import into ${importAccount}` : "Add journal account"}</h2><p className="mt-1 text-[9px] leading-4 text-muted">{importDialogPurpose === "append-trades" ? "Add closed trades or executions to this Journal. Imported records flow into Trade Log, Calendar, Pulse, Edgebook and Analysis, and remain fully editable." : "Create a native KwantDesk Journal for manual documentation, or connect an account from exported trade files."}</p></div>
              <button type="button" onClick={() => setShowImport(false)} className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4 p-5">
              {importDialogPurpose === "add-account" ? <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => { setAccountCreationMode("manual"); setImportAccount("My KwantDesk Journal"); setPendingFiles([]); setImportMessage(""); }} className={`rounded-2xl border p-4 text-left transition-all ${accountCreationMode === "manual" ? "border-primary/45 bg-primary/[0.08] shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_8%,transparent)]" : "border-border bg-background/30 hover:border-primary/25"}`}>
                  <BookPlus className={`h-5 w-5 ${accountCreationMode === "manual" ? "text-primary" : "text-muted"}`} />
                  <div className="mt-3 text-[10px] font-semibold text-foreground">KwantDesk Journal</div>
                  <div className="mt-1 text-[8px] leading-4 text-muted">Document trades manually with risk, outcome, screenshots and honest review notes.</div>
                </button>
                <button type="button" onClick={() => { setAccountCreationMode("import"); setImportAccount("Imported account"); setImportMessage(""); }} className={`rounded-2xl border p-4 text-left transition-all ${accountCreationMode === "import" ? "border-primary/45 bg-primary/[0.08] shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_8%,transparent)]" : "border-border bg-background/30 hover:border-primary/25"}`}>
                  <Upload className={`h-5 w-5 ${accountCreationMode === "import" ? "text-primary" : "text-muted"}`} />
                  <div className="mt-3 text-[10px] font-semibold text-foreground">Import account</div>
                  <div className="mt-1 text-[8px] leading-4 text-muted">Upload broker, TradingView, spreadsheet, CSV, JSON and evidence exports.</div>
                </button>
              </div> : (
                <div className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/[0.06] p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary"><FileSpreadsheet className="h-4 w-4" /></span>
                  <div className="min-w-0"><div className="truncate text-[10px] font-semibold text-foreground">{importAccount}</div><div className="mt-1 text-[8px] leading-4 text-muted">Trades are appended to this existing Journal. The source filename and row numbers remain attached to every record.</div></div>
                </div>
              )}
              {importDialogPurpose === "add-account" ? <div>
                <label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">{accountCreationMode === "manual" ? "KwantDesk Journal name" : "Imported account name"}</label>
                <input value={importAccount} onChange={(event) => { setImportAccount(event.target.value); setImportMessage(""); }} aria-invalid={importTargetsZyon} className={`h-10 w-full rounded-xl border bg-background px-3 text-[10px] text-foreground outline-none ${importTargetsZyon ? "border-danger/70 focus:border-danger" : "border-border focus:border-primary/45"}`} placeholder="e.g. Apex NQ Evaluation" />
                {importTargetsZyon ? <p className="mt-1.5 text-[8px] leading-4 text-danger">ZYON Journal is automatic-only and cannot receive imported trades, files, or evidence.</p> : null}
              </div> : null}
              {accountCreationMode === "import" ? (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDragEnter={(event) => { event.preventDefault(); setImportDragging(true); }}
                    onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setImportDragging(true); }}
                    onDragLeave={() => setImportDragging(false)}
                    onDrop={(event) => { event.preventDefault(); setImportDragging(false); addFiles(event.dataTransfer.files); }}
                    className={`flex min-h-[150px] w-full flex-col items-center justify-center rounded-2xl border border-dashed px-6 text-center transition-colors ${importDragging ? "border-primary bg-primary/10" : "border-border bg-background/35 hover:border-primary/45"}`}
                  >
                    <Import className="h-7 w-7 text-primary" />
                    <span className="mt-3 text-[11px] font-semibold text-foreground">Drop files here or browse</span>
                    <span className="mt-1 max-w-[500px] text-[8px] leading-4 text-muted">XLSX · XLS · XLSM · XLSB · ODS · XML/HTML · CSV · TSV · JSON · images · notes</span>
                    <span className="mt-2 text-[8px] text-muted">Workbooks up to 75 MB · images up to 8 MB · maximum 30 files</span>
                  </button>
                  <input ref={fileInputRef} type="file" accept={ACCEPTED_FILES} multiple className="hidden" onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.currentTarget.value = ""; }} />
                  {pendingFiles.length ? (
                    <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-border bg-background/25 p-2">
                      {pendingFiles.map((file) => <div key={`${file.name}:${file.size}:${file.lastModified}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[8px] hover:bg-surface"><FileText className="h-3.5 w-3.5 text-muted" /><span className="min-w-0 flex-1 truncate text-foreground">{file.name}</span><span className="font-mono text-muted">{Math.max(1, Math.round(file.size / 1024))} KB</span><button type="button" onClick={() => setPendingFiles((current) => current.filter((candidate) => candidate !== file))} className="text-muted hover:text-danger"><X className="h-3.5 w-3.5" /></button></div>)}
                    </div>
                  ) : null}
                  <div className="rounded-xl border border-border bg-surface/35 p-3 text-[8px] leading-4 text-muted"><strong className="text-foreground">Source-first import:</strong> every workbook sheet is checked, TradingView entry/exit rows are paired, duplicates are skipped, unmatched rows stay visible as warnings, and accepted records retain their source file, sheet, and row numbers.</div>
                </>
              ) : (
                <div className="rounded-2xl border border-border bg-background/30 p-4">
                  <div className="flex items-center gap-2 text-[9px] font-semibold text-foreground"><NotebookPen className="h-4 w-4 text-primary" />Native manual record</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {["Entry, exit, risk and P&L", "Micro, mini or other contracts", "Optional screenshots and evidence", "Review and improvement notes"].map((item) => <div key={item} className="flex items-center gap-2 rounded-xl border border-border/70 bg-panel px-3 py-2 text-[8px] text-muted"><Check className="h-3 w-3 text-primary" />{item}</div>)}
                  </div>
                  <p className="mt-3 text-[8px] leading-4 text-muted">Once created, use <strong className="text-foreground">Add trade</strong> inside this account. Every manual record will populate Calendar, Trade Log, Edgebook and Analysis.</p>
                </div>
              )}
              {importMessage ? <div className="rounded-xl border border-primary/20 bg-primary/[0.07] px-3 py-2 text-[9px] text-primary">{importMessage}</div> : null}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border bg-background/20 px-5 py-4">
              <button type="button" onClick={() => setShowImport(false)} className="h-9 rounded-xl border border-border px-4 text-[9px] font-semibold text-muted hover:bg-surface hover:text-foreground">Close</button>
              <button type="button" onClick={accountCreationMode === "manual" ? createNativeJournal : runImport} disabled={importing || importTargetsZyon || (accountCreationMode === "import" && !pendingFiles.length) || !importAccount.trim()} className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[9px] font-semibold text-background disabled:opacity-40">{importing ? <span className="h-3 w-3 animate-spin rounded-full border border-background/30 border-t-background" /> : accountCreationMode === "manual" ? <BookPlus className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}{importing ? (importDialogPurpose === "append-trades" ? "Importing trades" : "Creating account") : accountCreationMode === "manual" ? "Create KwantDesk Journal" : importDialogPurpose === "append-trades" ? `Import ${pendingFiles.length || ""}` : `Create & import ${pendingFiles.length || ""}`}</button>
            </div>
          </div>
        </div>
      ) : null}

      {tradeMenuId && tradeMenuTarget ? (
        <div
          onPointerDown={(event) => event.stopPropagation()}
          className="fixed z-[1180] w-40 overflow-hidden rounded-xl border border-border bg-panel p-1 text-left shadow-2xl shadow-black/60"
          style={{ left: tradeMenuId.x, top: tradeMenuId.y }}
        >
          <button type="button" onClick={() => { setTradeMenuId(null); setSelectedTradeId(tradeMenuTarget.id); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[8px] text-muted hover:bg-surface hover:text-foreground"><Eye className="h-3.5 w-3.5" />View details</button>
          {!isZyonJournalAccountName(tradeMenuTarget.account) && !tradeMenuTarget.sourceImportId.startsWith("zyon:") ? <button type="button" onClick={() => openTradeEditor(tradeMenuTarget)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[8px] text-muted hover:bg-surface hover:text-foreground"><Pencil className="h-3.5 w-3.5" />Edit trade</button> : null}
          {!isZyonJournalAccountName(tradeMenuTarget.account) && !tradeMenuTarget.sourceImportId.startsWith("zyon:") ? <button type="button" onClick={() => { setTradeMenuId(null); setDeleteTradeTargetId(tradeMenuTarget.id); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[8px] text-danger hover:bg-danger/10"><Trash2 className="h-3.5 w-3.5" />Delete trade</button> : null}
        </div>
      ) : null}

      {showTradePost ? (
        <div className="fixed inset-0 z-[1080] flex items-center justify-center bg-black/74 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !postTradeSaving) setShowTradePost(false); }}>
          <div className="flex max-h-[92vh] w-full max-w-[900px] flex-col overflow-hidden rounded-3xl border border-border bg-panel shadow-2xl shadow-black/70">
            <div className="flex items-start gap-3 border-b border-border px-5 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary"><Share2 className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1"><h2 className="text-[14px] font-semibold text-foreground">Post a journal trade</h2><p className="mt-1 text-[9px] leading-4 text-muted">Choose a completed trade and add a public caption. Private notes, improvements, screenshots and account details stay inside your Journal.</p></div>
              <button type="button" disabled={postTradeSaving} onClick={() => setShowTradePost(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground disabled:opacity-40"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,.95fr)]">
              <section className="min-h-0">
                <div className="mb-2 flex items-center justify-between"><div><h3 className="text-[10px] font-semibold text-foreground">Trade log</h3><p className="mt-0.5 text-[8px] text-muted">{postableTrades.length} completed trade{postableTrades.length === 1 ? "" : "s"} in this Journal</p></div><span className="rounded-lg border border-border bg-surface px-2 py-1 font-mono text-[7px] text-muted">SELECT ONE</span></div>
                <div className="max-h-[480px] space-y-1.5 overflow-y-auto pr-1">
                  {postableTrades.map((trade) => {
                    const active = trade.id === postTradeId;
                    return <button key={trade.id} type="button" onClick={() => { setPostTradeId(trade.id); setPostTradeError(""); }} className={`w-full rounded-2xl border p-3 text-left transition ${active ? "border-primary/45 bg-primary/[0.09] shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_10%,transparent)]" : "border-border bg-background/30 hover:border-primary/25 hover:bg-surface/55"}`}>
                      <div className="flex items-center gap-2"><span className={`flex h-8 w-8 items-center justify-center rounded-xl ${trade.side === "LONG" ? "bg-[var(--journal-win)]/10 text-[var(--journal-win)]" : "bg-[var(--journal-loss)]/10 text-[var(--journal-loss)]"}`}>{trade.side === "LONG" ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-[9px] font-semibold text-foreground">{trade.symbol} · {trade.setup || "Journal trade"}</span><span className="mt-0.5 block text-[7px] text-muted">{formatDate(trade.openedAt, true)} · {trade.side} · {trade.quantity} contract{trade.quantity === 1 ? "" : "s"}</span></span><span className={`font-mono text-[11px] font-semibold ${trade.netPnl >= 0 ? "text-[var(--journal-win)]" : "text-[var(--journal-loss)]"}`}>{money(trade.netPnl)}</span></div>
                    </button>;
                  })}
                </div>
              </section>
              <section className="flex min-h-[360px] flex-col rounded-2xl border border-border bg-background/30 p-4">
                {postTrade ? <>
                  <div className="flex items-start gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${postTrade.side === "LONG" ? "bg-[var(--journal-win)]/10 text-[var(--journal-win)]" : "bg-[var(--journal-loss)]/10 text-[var(--journal-loss)]"}`}>{postTrade.side === "LONG" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}</span><div className="min-w-0"><div className="text-[12px] font-semibold text-foreground">{postTrade.symbol} {postTrade.side}</div><div className="mt-1 truncate text-[8px] text-muted">{postTrade.setup || "Journal trade"}</div></div><div className={`ml-auto font-mono text-[18px] font-semibold ${postTrade.netPnl >= 0 ? "text-[var(--journal-win)]" : "text-[var(--journal-loss)]"}`}>{money(postTrade.netPnl)}</div></div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {[["Entry", postTrade.entryPrice?.toLocaleString("en-US", { maximumFractionDigits: 6 }) ?? "—"], ["Exit", postTrade.exitPrice?.toLocaleString("en-US", { maximumFractionDigits: 6 }) ?? "—"], ["Risk", postTrade.initialRisk === null ? "Not recorded" : money(postTrade.initialRisk, false)], ["Result", postTrade.rMultiple === null ? "Not recorded" : `${postTrade.rMultiple.toFixed(2)}R`]].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-panel/70 p-3"><div className="text-[7px] uppercase tracking-[0.12em] text-muted">{label}</div><div className="mt-1 font-mono text-[10px] text-foreground">{value}</div></div>)}
                  </div>
                  <label className="mt-4 text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">Public caption <span className="font-normal normal-case tracking-normal">· optional</span></label>
                  <textarea value={postTradeCaption} onChange={(event) => setPostTradeCaption(event.target.value.slice(0, 2_000))} rows={7} placeholder="What do you want people to know about this trade?" className="mt-2 min-h-[130px] w-full resize-y rounded-2xl border border-border bg-panel p-3 text-[10px] leading-5 text-foreground outline-none placeholder:text-muted/55 focus:border-primary/45" />
                  <div className="mt-1 text-right font-mono text-[7px] text-muted">{postTradeCaption.length}/2000</div>
                  <div className="mt-auto rounded-xl border border-primary/15 bg-primary/[0.055] p-3 text-[8px] leading-4 text-muted"><strong className="text-foreground">Public snapshot only:</strong> instrument, direction, entry, exit, P&amp;L, recorded risk, timestamps and the caption above.</div>
                </> : <div className="m-auto text-center"><CircleAlert className="mx-auto h-6 w-6 text-muted" /><div className="mt-3 text-[10px] font-semibold text-foreground">Choose a completed trade</div><p className="mt-1 text-[8px] text-muted">A trade needs recorded entry and exit prices before it can be posted.</p></div>}
              </section>
            </div>
            {postTradeError ? <div className="mx-5 mb-3 flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/[0.07] px-3 py-2 text-[9px] text-danger"><CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />{postTradeError}</div> : null}
            <div className="flex items-center gap-2 border-t border-border bg-background/20 px-5 py-4"><span className="mr-auto flex items-center gap-1.5 text-[8px] text-muted"><Eye className="h-3.5 w-3.5 text-primary" />Publishes to the Socials community feed</span><button type="button" disabled={postTradeSaving} onClick={() => setShowTradePost(false)} className="h-9 rounded-xl border border-border px-4 text-[9px] font-semibold text-muted hover:bg-surface hover:text-foreground disabled:opacity-40">Cancel</button><button type="button" disabled={!postTrade || postTradeSaving} onClick={() => void publishTradePost()} className="flex h-9 items-center gap-2 rounded-xl bg-primary px-5 text-[9px] font-semibold text-background hover:brightness-110 disabled:opacity-40">{postTradeSaving ? <span className="h-3 w-3 animate-spin rounded-full border border-background/30 border-t-background" /> : <Share2 className="h-3.5 w-3.5" />}{postTradeSaving ? "Posting trade" : "Post trade"}</button></div>
          </div>
        </div>
      ) : null}

      {showManualTrade && (selectedAccountIsManual || editingTrade) ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/72 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) closeManualTrade(); }}>
          <div className="flex max-h-[94vh] w-full max-w-[880px] flex-col overflow-hidden rounded-3xl border border-border bg-panel shadow-2xl shadow-black/65">
            <div className="relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-border px-5 py-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary"><NotebookPen className="h-4 w-4" /></span>
                <div className="min-w-0"><h2 className="text-[14px] font-semibold text-foreground">{editingTrade ? "Edit trade" : "Document a trade"}</h2><p className="mt-1 truncate text-[9px] text-muted">{editingTrade?.account ?? accountFilter} · {editingTrade ? "linked posts update automatically" : "native KwantDesk Journal"}</p></div>
              </div>
              <button
                type="button"
                disabled={!manualDictation.supported || manualTradeSaving}
                onClick={manualDictation.toggle}
                aria-pressed={manualDictation.enabled}
                aria-label={manualDictation.enabled ? "Stop persistent trade dictation" : "Start persistent trade dictation"}
                title={!manualDictation.supported ? "Speech input is not supported by this browser" : manualDictation.enabled ? "Stop dictation" : "Start dictation, then click any field to speak into it"}
                className={`flex h-9 max-w-[270px] items-center gap-2 rounded-xl border px-3 text-[8px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${manualDictation.enabled ? "border-primary/40 bg-primary/12 text-primary shadow-[0_0_20px_color-mix(in_srgb,var(--primary)_13%,transparent)]" : "border-border bg-background text-muted hover:border-primary/35 hover:text-primary"}`}
              >
                <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                  {manualDictation.listening ? <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" /> : null}
                  <Mic className="relative h-3.5 w-3.5" />
                </span>
                <span className="truncate">{manualDictation.enabled ? `Listening · ${MANUAL_TRADE_DICTATION_LABELS[manualDictation.activeField]}` : "Dictate fields"}</span>
              </button>
              <button type="button" disabled={manualTradeSaving} onClick={closeManualTrade} className="flex h-8 w-8 items-center justify-center justify-self-end rounded-lg text-muted hover:bg-surface hover:text-foreground disabled:opacity-40"><X className="h-4 w-4" /></button>
            </div>
            {manualDictation.enabled || manualDictation.error ? <div className={`border-b px-5 py-2 text-center text-[8px] ${manualDictation.error ? "border-danger/20 bg-danger/[0.06] text-danger" : "border-primary/15 bg-primary/[0.045] text-primary"}`}>{manualDictation.error || `Mic stays on while you move between fields · Speaking into ${MANUAL_TRADE_DICTATION_LABELS[manualDictation.activeField]}`}</div> : null}
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
              <section>
                <div className="mb-3"><h3 className="text-[10px] font-semibold text-foreground">Trade identity</h3><p className="mt-0.5 text-[8px] text-muted">Only instrument and direction are essential here. A setup name is generated if left blank.</p></div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="sm:col-span-2"><label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">Trade / setup name</label><input value={manualTrade.name} onFocus={() => manualDictation.activate("name")} onChange={(event) => updateManualTradeField("name", event.target.value)} placeholder="Generated automatically when blank" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] text-foreground outline-none focus:border-primary/45" /></div>
                  <div><label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">Instrument *</label><input value={manualTrade.symbol} onFocus={() => manualDictation.activate("symbol")} onChange={(event) => updateManualTradeField("symbol", event.target.value.toUpperCase())} placeholder="NQ" className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-[9px] text-foreground outline-none focus:border-primary/45" /></div>
                  <div><label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">Direction *</label><KwantSelect value={manualTrade.side} onFocus={() => manualDictation.activate("side")} onChange={(event) => updateManualTradeField("side", event.target.value as ManualTradeDraft["side"])} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] text-foreground outline-none"><option value="" disabled>Select direction</option><option value="LONG">Long</option><option value="SHORT">Short</option></KwantSelect></div>
                  <div><label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">Contract class</label><KwantSelect value={manualTrade.contractClass} onFocus={() => manualDictation.activate("contractClass")} onChange={(event) => updateManualTradeField("contractClass", event.target.value as ManualTradeDraft["contractClass"])} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] text-foreground outline-none"><option value="">Not specified</option><option value="MICRO">Micro</option><option value="MINI">Mini</option><option value="OTHER">Other</option></KwantSelect></div>
                  <div><label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">Contracts</label><input type="number" min="0.01" step="0.01" value={manualTrade.quantity} onFocus={() => manualDictation.activate("quantity")} onChange={(event) => updateManualTradeField("quantity", event.target.value)} placeholder="Defaults to 1" className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-[9px] text-foreground outline-none focus:border-primary/45" /></div>
                  <div className="sm:col-span-2"><label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">Tags</label><input value={manualTrade.tags} onFocus={() => manualDictation.activate("tags")} onChange={(event) => updateManualTradeField("tags", event.target.value)} placeholder="reclaim, patient, New York" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] text-foreground outline-none focus:border-primary/45" /></div>
                </div>
              </section>

              <section className="border-t border-border pt-5">
                <div className="mb-3"><h3 className="text-[10px] font-semibold text-foreground">Trading account <span className="font-normal text-muted">· optional</span></h3><p className="mt-0.5 text-[8px] text-muted">Record the prop firm or capital account, its stage, and the account size.</p></div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div><label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">Account / provider</label><input value={manualTrade.tradingAccountName} onFocus={() => manualDictation.activate("tradingAccountName")} onChange={(event) => updateManualTradeField("tradingAccountName", event.target.value)} placeholder="Prop firm or brokerage" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] text-foreground outline-none focus:border-primary/45" /></div>
                  <div><label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">Account type</label><KwantSelect value={manualTrade.tradingAccountType} onFocus={() => manualDictation.activate("tradingAccountType")} onChange={(event) => updateManualTradeField("tradingAccountType", event.target.value as ManualTradeDraft["tradingAccountType"])} menuLabel="Account type" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] text-foreground outline-none"><option value="">Select account type</option><option value="LIVE_CAPITAL">Live capital</option><option value="EVALUATION">Evaluation</option><option value="FUNDED">Funded account</option></KwantSelect></div>
                  <div><label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">Account size</label><div className="flex h-10 items-center rounded-xl border border-border bg-background px-3 focus-within:border-primary/45"><span className="font-mono text-[9px] text-muted">$</span><input type="number" min="0" step="any" value={manualTrade.accountSize} onFocus={() => manualDictation.activate("accountSize")} onChange={(event) => updateManualTradeField("accountSize", event.target.value)} placeholder="50,000" className="h-full min-w-0 flex-1 bg-transparent pl-2 font-mono text-[9px] text-foreground outline-none" /></div></div>
                </div>
              </section>

              <section className="border-t border-border pt-5">
                <div className="mb-3"><h3 className="text-[10px] font-semibold text-foreground">Execution and risk</h3><p className="mt-0.5 text-[8px] text-muted">Only entry price, exit price and P&amp;L are required. Contracts default to one and the remaining context can stay blank.</p></div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="lg:col-span-2"><label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">Entry time</label><input type="datetime-local" value={manualTrade.openedAt} onFocus={() => manualDictation.activate("openedAt")} onChange={(event) => updateManualTradeField("openedAt", event.target.value)} className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-[9px] text-foreground outline-none focus:border-primary/45" /></div>
                  <div className="lg:col-span-2"><label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">Exit time</label><input type="datetime-local" value={manualTrade.closedAt} onFocus={() => manualDictation.activate("closedAt")} onChange={(event) => updateManualTradeField("closedAt", event.target.value)} className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-[9px] text-foreground outline-none focus:border-primary/45" /></div>
                  <div><label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">Entry price *</label><input type="number" step="any" value={manualTrade.entryPrice} onFocus={() => manualDictation.activate("entryPrice")} onChange={(event) => updateManualTradeField("entryPrice", event.target.value)} placeholder="0.00" className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-[9px] text-foreground outline-none focus:border-primary/45" /></div>
                  <div><label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">Exit price *</label><input type="number" step="any" value={manualTrade.exitPrice} onFocus={() => manualDictation.activate("exitPrice")} onChange={(event) => updateManualTradeField("exitPrice", event.target.value)} placeholder="0.00" className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-[9px] text-foreground outline-none focus:border-primary/45" /></div>
                  <div><label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">Stop price</label><input type="number" step="any" value={manualTrade.stopPrice} onFocus={() => manualDictation.activate("stopPrice")} onChange={(event) => updateManualTradeField("stopPrice", event.target.value)} placeholder="Only if known" className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-[9px] text-foreground outline-none focus:border-primary/45" /></div>
                  <div><label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">Target price</label><input type="number" step="any" value={manualTrade.targetPrice} onFocus={() => manualDictation.activate("targetPrice")} onChange={(event) => updateManualTradeField("targetPrice", event.target.value)} placeholder="Only if known" className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-[9px] text-foreground outline-none focus:border-primary/45" /></div>
                  <div><label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">Initial risk ($)</label><input type="number" min="0" step="0.01" value={manualTrade.initialRisk} onFocus={() => manualDictation.activate("initialRisk")} onChange={(event) => updateManualTradeField("initialRisk", event.target.value)} placeholder="250.00" className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-[9px] text-foreground outline-none focus:border-primary/45" /></div>
                  <div><label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">Net profit / loss ($) *</label><input type="number" step="0.01" value={manualTrade.netPnl} onFocus={() => manualDictation.activate("netPnl")} onChange={(event) => updateManualTradeField("netPnl", event.target.value)} placeholder="Use minus for a loss" className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-[9px] text-foreground outline-none focus:border-primary/45" /></div>
                  <div><label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">Fees ($)</label><input type="number" min="0" step="0.01" value={manualTrade.fees} onFocus={() => manualDictation.activate("fees")} onChange={(event) => updateManualTradeField("fees", event.target.value)} placeholder="Leave blank if unknown" className="h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-[9px] text-foreground outline-none focus:border-primary/45" /></div>
                  <div><label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">Planned risk : reward</label><div className="flex h-10 items-center rounded-xl border border-border bg-background px-3 focus-within:border-primary/45"><span className="font-mono text-[9px] text-muted">1 :</span><input type="number" min="0" step="0.01" value={manualTrade.plannedRiskReward} onFocus={() => manualDictation.activate("plannedRiskReward")} onChange={(event) => updateManualTradeField("plannedRiskReward", event.target.value)} placeholder="3.00" className="h-full min-w-0 flex-1 bg-transparent pl-2 font-mono text-[9px] text-foreground outline-none" /></div></div>
                  <div className="sm:col-span-2 lg:col-span-4"><label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">Realized risk : reward</label><div className="flex h-10 items-center rounded-xl border border-border bg-surface/45 px-3 font-mono text-[11px] font-semibold text-primary">{Number(manualTrade.initialRisk) > 0 && Number.isFinite(Number(manualTrade.netPnl)) ? riskReward(Number(manualTrade.netPnl) / Number(manualTrade.initialRisk)) : "1 : —"}</div></div>
                </div>
              </section>

              <section className="border-t border-border pt-5">
                <div className="mb-3"><h3 className="text-[10px] font-semibold text-foreground">Review notes <span className="font-normal text-muted">· optional</span></h3><p className="mt-0.5 text-[8px] text-muted">Write honestly. Both fields can be left blank and the trade will still submit.</p></div>
                <div className="grid gap-3 lg:grid-cols-2">
                  <div>
                    <div className="mb-1.5 flex items-center gap-2"><label className="text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">Notes</label><button type="button" disabled={!manualDictation.supported || manualTradeSaving} onClick={() => toggleManualDictationField("notes")} aria-label={manualDictation.enabled && manualDictation.activeField === "notes" ? "Stop dictating notes" : "Dictate notes"} aria-pressed={manualDictation.enabled && manualDictation.activeField === "notes"} className={`ml-auto flex h-7 w-7 items-center justify-center rounded-lg border transition disabled:opacity-30 ${manualDictation.enabled && manualDictation.activeField === "notes" ? "border-primary/40 bg-primary/12 text-primary" : "border-border bg-background text-muted hover:border-primary/35 hover:text-primary"}`}><span className="relative flex h-3.5 w-3.5 items-center justify-center">{manualDictation.listening && manualDictation.activeField === "notes" ? <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" /> : null}<Mic className="relative h-3 w-3" /></span></button></div>
                    <textarea value={manualTrade.notes} onFocus={() => manualDictation.activate("notes")} onChange={(event) => updateManualTradeField("notes", event.target.value)} rows={6} placeholder="What happened? What were you thinking? Were you patient, emotional, early or late?" className="w-full resize-y rounded-xl border border-border bg-background p-3 text-[9px] leading-5 text-foreground outline-none focus:border-primary/45" />
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center gap-2"><label className="text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">How can I do better next time?</label><button type="button" disabled={!manualDictation.supported || manualTradeSaving} onClick={() => toggleManualDictationField("improvements")} aria-label={manualDictation.enabled && manualDictation.activeField === "improvements" ? "Stop dictating improvements" : "Dictate what to improve"} aria-pressed={manualDictation.enabled && manualDictation.activeField === "improvements"} className={`ml-auto flex h-7 w-7 items-center justify-center rounded-lg border transition disabled:opacity-30 ${manualDictation.enabled && manualDictation.activeField === "improvements" ? "border-primary/40 bg-primary/12 text-primary" : "border-border bg-background text-muted hover:border-primary/35 hover:text-primary"}`}><span className="relative flex h-3.5 w-3.5 items-center justify-center">{manualDictation.listening && manualDictation.activeField === "improvements" ? <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" /> : null}<Mic className="relative h-3 w-3" /></span></button></div>
                    <textarea value={manualTrade.improvements} onFocus={() => manualDictation.activate("improvements")} onChange={(event) => updateManualTradeField("improvements", event.target.value)} rows={6} placeholder="The specific behaviour, rule or preparation you will change next time." className="w-full resize-y rounded-xl border border-border bg-background p-3 text-[9px] leading-5 text-foreground outline-none focus:border-primary/45" />
                  </div>
                </div>
                <div className="mt-3"><label className="mb-2 block text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">Execution quality <span className="font-normal normal-case tracking-normal">· optional</span></label><div className="flex items-center gap-1.5">{[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" onClick={() => updateManualTradeField("rating", manualTrade.rating === rating ? null : rating)} className={`flex h-8 w-8 items-center justify-center rounded-lg border ${manualTrade.rating && rating <= manualTrade.rating ? "border-primary/35 bg-primary/10 text-primary" : "border-border bg-background text-muted hover:text-foreground"}`}><Star className={`h-3.5 w-3.5 ${manualTrade.rating && rating <= manualTrade.rating ? "fill-current" : ""}`} /></button>)}</div></div>
              </section>

              <section className="border-t border-border pt-5">
                <div className="mb-3"><h3 className="text-[10px] font-semibold text-foreground">Screenshot evidence <span className="font-normal text-muted">· optional</span></h3><p className="mt-0.5 text-[8px] leading-4 text-muted">Attach screenshots to this journal entry for future reference. Images are saved as evidence only and never analyzed or used to change your trade details.</p></div>
                <button
                  type="button"
                  onClick={() => manualEvidenceInputRef.current?.click()}
                  onDragEnter={(event) => { event.preventDefault(); setManualEvidenceDragging(true); }}
                  onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setManualEvidenceDragging(true); }}
                  onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setManualEvidenceDragging(false); }}
                  onDrop={(event) => { event.preventDefault(); setManualEvidenceDragging(false); addManualEvidence(Array.from(event.dataTransfer.files)); }}
                  className={`flex min-h-[128px] w-full flex-col items-center justify-center rounded-2xl border border-dashed px-5 text-center transition-colors ${manualEvidenceDragging ? "border-primary bg-primary/10" : "border-border bg-background/30 hover:border-primary/40 hover:bg-primary/[0.04]"}`}
                >
                  <Camera className="h-5 w-5 text-primary" />
                  <span className="mt-2 text-[9px] font-semibold text-foreground">Drop screenshots here or browse</span>
                  <span className="mt-1 text-[8px] text-muted">PNG · JPG · WEBP · GIF · up to 20 MB before private preparation</span>
                  <span className="mt-2 text-[8px] text-primary/80">Saved privately with this trade · no screenshot analysis</span>
                </button>
                <input ref={manualEvidenceInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="hidden" onChange={(event) => { if (event.target.files) addManualEvidence(Array.from(event.target.files)); event.currentTarget.value = ""; }} />
                {manualEvidenceFiles.length ? <div className="mt-2 grid gap-2 sm:grid-cols-2">{manualEvidenceFiles.map((file) => <div key={`${file.name}:${file.size}:${file.lastModified}`} className="flex items-center gap-2 rounded-xl border border-border bg-background/35 px-3 py-2 text-[8px]"><ImageIcon className="h-3.5 w-3.5 text-primary" /><span className="min-w-0 flex-1 truncate text-foreground">{file.name}</span><span className="font-mono text-muted">{Math.max(1, Math.round(file.size / 1024))} KB</span><button type="button" onClick={() => setManualEvidenceFiles((current) => current.filter((candidate) => candidate !== file))} className="text-muted hover:text-danger"><X className="h-3.5 w-3.5" /></button></div>)}</div> : null}
              </section>

              {manualTradeError ? <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/[0.07] px-3 py-2 text-[9px] leading-4 text-danger"><CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />{manualTradeError}</div> : null}
            </div>
            <div className="flex items-center gap-2 border-t border-border bg-background/20 px-5 py-4">
              <span className="mr-auto text-[8px] text-muted">Notes and evidence are optional.</span>
              <button type="button" disabled={manualTradeSaving} onClick={closeManualTrade} className="h-9 rounded-xl border border-border px-4 text-[9px] font-semibold text-muted hover:bg-surface hover:text-foreground disabled:opacity-40">Cancel</button>
              <button type="button" disabled={manualTradeSaving} onClick={() => void submitManualTrade()} className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[9px] font-semibold text-background disabled:opacity-50">{manualTradeSaving ? <span className="h-3 w-3 animate-spin rounded-full border border-background/30 border-t-background" /> : <Save className="h-3.5 w-3.5" />}{manualTradeSaving ? "Saving entry" : editingTrade ? "Save changes" : "Save trade"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTradeTarget ? (
        <div className="fixed inset-0 z-[1050] flex items-center justify-center bg-black/78 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteTradeTargetId(null); }}>
          <div className="w-full max-w-[460px] overflow-hidden rounded-3xl border border-danger/25 bg-panel shadow-2xl shadow-black/80">
            <div className="p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-danger/25 bg-danger/10 text-danger"><Trash2 className="h-5 w-5" /></span>
              <h2 className="mt-5 text-[16px] font-semibold text-foreground">Delete {deleteTradeTarget.symbol} trade?</h2>
              <p className="mt-2 text-[9px] leading-5 text-muted">This removes the Journal record. If you already posted this trade, its linked Socials post and activity are removed too, so the public record cannot drift away from the Journal.</p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border bg-background/20 px-5 py-4">
              <button type="button" onClick={() => setDeleteTradeTargetId(null)} className="h-9 rounded-xl border border-border px-4 text-[9px] font-semibold text-muted hover:bg-surface hover:text-foreground">Cancel</button>
              <button type="button" onClick={() => void deleteTrade(deleteTradeTarget)} className="flex h-9 items-center gap-2 rounded-xl bg-danger px-4 text-[9px] font-semibold text-white hover:brightness-110"><Trash2 className="h-3.5 w-3.5" />Delete trade</button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedTrade ? (
        <div className="fixed inset-0 z-[950] bg-black/55 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedTradeId(null); }}>
          <aside className="absolute bottom-0 right-0 top-0 flex w-full max-w-[520px] flex-col border-l border-border bg-panel shadow-2xl shadow-black/60">
            <div className="flex items-start gap-3 border-b border-border px-5 py-4">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selectedTrade.netPnl >= 0 ? "bg-[var(--journal-win)]/10 text-[var(--journal-win)]" : "bg-[var(--journal-loss)]/10 text-[var(--journal-loss)]"}`}>{selectedTrade.side === "LONG" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}</span>
              <div className="min-w-0"><div className="flex items-center gap-2"><h2 className="text-[14px] font-semibold text-foreground">{selectedTrade.symbol}</h2><span className={`rounded-md px-1.5 py-0.5 text-[8px] font-semibold ${selectedTrade.side === "LONG" ? "bg-[var(--journal-win)]/10 text-[var(--journal-win)]" : "bg-[var(--journal-loss)]/10 text-[var(--journal-loss)]"}`}>{selectedTrade.side}</span></div><p className="mt-1 truncate text-[9px] text-muted">{selectedTrade.account} · {formatDate(selectedTrade.openedAt, true)}</p></div>
              <button type="button" onClick={() => setSelectedTradeId(null)} className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              {selectedTradeIsZyon ? <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/[0.07] p-3 text-[8px] leading-4 text-muted"><Bot className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /><span><strong className="text-foreground">Verified ZYON outcome.</strong> This record mirrors its locked Gameplan review and stays read-only here so the Journal cannot diverge from the original outcome.</span></div> : null}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-border bg-background/35 p-3"><div className="text-[8px] uppercase tracking-[0.1em] text-muted">Net P&amp;L</div><div className={`mt-1 font-mono text-[16px] font-semibold ${selectedTrade.netPnl >= 0 ? "text-[var(--journal-win)]" : "text-[var(--journal-loss)]"}`}>{money(selectedTrade.netPnl)}</div></div>
                <div className="rounded-xl border border-border bg-background/35 p-3"><div className="text-[8px] uppercase tracking-[0.1em] text-muted">R multiple</div><div className="mt-1 font-mono text-[16px] font-semibold">{selectedTrade.rMultiple === null ? "—" : `${selectedTrade.rMultiple.toFixed(2)}R`}</div></div>
                <div className="rounded-xl border border-border bg-background/35 p-3"><div className="text-[8px] uppercase tracking-[0.1em] text-muted">Duration</div><div className="mt-1 font-mono text-[16px] font-semibold">{formatDuration(selectedTrade.durationMs)}</div></div>
              </div>
              <Card className="p-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-[9px]">
                  {[["Entry", selectedTrade.entryPrice?.toLocaleString("en-US", { maximumFractionDigits: 6 }) ?? "—"], ["Exit", selectedTrade.exitPrice?.toLocaleString("en-US", { maximumFractionDigits: 6 }) ?? "—"], ["Stop", selectedTrade.stopPrice?.toLocaleString("en-US", { maximumFractionDigits: 6 }) ?? "Not recorded"], ["Target", selectedTrade.targetPrice?.toLocaleString("en-US", { maximumFractionDigits: 6 }) ?? "Not recorded"], ["Planned R:R", selectedTrade.plannedRiskReward ? `1 : ${selectedTrade.plannedRiskReward.toFixed(2)}` : "Not recorded"], ["Quantity", selectedTrade.quantity.toLocaleString()], ["Contract", selectedTrade.contractClass ?? "—"], ["Fees", selectedTrade.feesKnown === false ? "Not recorded" : money(selectedTrade.fees, false)], ["Gross P&L", money(selectedTrade.grossPnl)], ["Source", `${selectedTrade.sourceFile}${selectedTrade.sourceSheet ? ` · ${selectedTrade.sourceSheet}` : ""} · rows ${selectedTrade.sourceRows.join(", ")}`]].map(([label, value]) => <div key={label}><div className="text-[8px] uppercase tracking-[0.1em] text-muted">{label}</div><div className="mt-1 break-words font-mono text-foreground">{value}</div></div>)}
                  <div><div className="text-[8px] uppercase tracking-[0.1em] text-muted">Trading account</div><div className="mt-1 break-words font-mono text-foreground">{selectedTrade.tradingAccountName ?? "Not recorded"}</div></div>
                  <div><div className="text-[8px] uppercase tracking-[0.1em] text-muted">Account type</div><div className="mt-1 break-words font-mono text-foreground">{tradingAccountTypeLabel(selectedTrade.tradingAccountType)}</div></div>
                  <div><div className="text-[8px] uppercase tracking-[0.1em] text-muted">Account size</div><div className="mt-1 break-words font-mono text-foreground">{selectedTrade.accountSize ? money(selectedTrade.accountSize, false) : "Not recorded"}</div></div>
                </div>
              </Card>
              <div>
                <label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">Setup</label>
                <input value={selectedTrade.setup} disabled={selectedTradeIsZyon} onChange={(event) => updateTrade(selectedTrade.id, { setup: event.target.value })} placeholder="Name the setup used" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] text-foreground outline-none focus:border-primary/45 disabled:cursor-not-allowed disabled:opacity-70" />
              </div>
              <div>
                <label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">Tags</label>
                <input value={selectedTrade.tags.join(", ")} disabled={selectedTradeIsZyon} onChange={(event) => updateTrade(selectedTrade.id, { tags: [...new Set(event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean))].slice(0, 24) })} placeholder="breakout, patient, news day" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] text-foreground outline-none focus:border-primary/45 disabled:cursor-not-allowed disabled:opacity-70" />
              </div>
              <div>
                <label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">Trade review</label>
                <textarea value={selectedTrade.notes} disabled={selectedTradeIsZyon} onChange={(event) => updateTrade(selectedTrade.id, { notes: event.target.value })} rows={6} placeholder="What was the thesis? What confirmed it? What invalidated it? What will you repeat or change?" className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[9px] leading-5 text-foreground outline-none focus:border-primary/45 disabled:cursor-not-allowed disabled:opacity-70" />
              </div>
              <div>
                <label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">How can I do better next time?</label>
                <textarea value={selectedTrade.improvements ?? ""} disabled={selectedTradeIsZyon} onChange={(event) => updateTrade(selectedTrade.id, { improvements: event.target.value })} rows={5} placeholder="Record one specific behaviour, rule or preparation change for the next trade." className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[9px] leading-5 text-foreground outline-none focus:border-primary/45 disabled:cursor-not-allowed disabled:opacity-70" />
              </div>
              <div>
                <label className="mb-2 block text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">Execution quality</label>
                <div className="flex items-center gap-1.5">{[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" disabled={selectedTradeIsZyon} onClick={() => updateTrade(selectedTrade.id, { rating })} className={`flex h-8 w-8 items-center justify-center rounded-lg border disabled:cursor-not-allowed ${selectedTrade.rating && rating <= selectedTrade.rating ? "border-primary/35 bg-primary/10 text-primary" : "border-border bg-background text-muted hover:text-foreground"}`}><Star className={`h-3.5 w-3.5 ${selectedTrade.rating && rating <= selectedTrade.rating ? "fill-current" : ""}`} /></button>)}</div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between"><label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">Evidence</label><button type="button" onClick={() => { setSelectedTradeId(null); setTab("evidence"); }} className="text-[8px] font-semibold text-primary">OPEN LIBRARY</button></div>
                <div className="grid grid-cols-3 gap-2">
                  {state.evidence.filter((item) => item.account === selectedTrade.account).map((item) => {
                    const attached = item.tradeId === selectedTrade.id;
                    return (
                      <button key={item.id} type="button" onClick={() => updateEvidence(item.id, { tradeId: attached ? null : selectedTrade.id })} className={`relative h-20 overflow-hidden rounded-xl border text-left ${attached ? "border-primary shadow-[0_0_0_1px_var(--primary)]" : "border-border opacity-65 hover:opacity-100"}`} title={attached ? `Detach ${item.name}` : `Attach ${item.name}`}>
                        {item.mimeType.startsWith("image/") ? <Image src={item.dataUrl} alt={item.name} width={180} height={100} unoptimized className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-background"><FileText className="h-5 w-5 text-muted" /></div>}
                        {attached ? <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-background"><Check className="h-3 w-3" /></span> : null}
                      </button>
                    );
                  })}
                  {!state.evidence.some((item) => item.account === selectedTrade.account) ? <div className="col-span-3 rounded-xl border border-dashed border-border px-3 py-8 text-center text-[8px] text-muted">Add screenshots or notes to this account to attach evidence.</div> : null}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-border bg-background/20 px-5 py-4">
              <div className="mr-auto text-[8px] text-muted">{selectedTrade.reviewedAt ? `Reviewed ${formatDate(selectedTrade.reviewedAt, true)}` : "Review remains open"}</div>
              <button
                type="button"
                disabled={selectedTrade.entryPrice === null || selectedTrade.exitPrice === null}
                onClick={() => { setSelectedTradeId(null); openTradePost(selectedTrade.id); }}
                title={selectedTrade.entryPrice === null || selectedTrade.exitPrice === null ? "Add entry and exit prices before posting this trade" : "Post this trade to your Socials feed"}
                className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[9px] font-semibold text-background hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Share2 className="h-3.5 w-3.5" />Post this trade
              </button>
              {selectedTradeIsZyon ? <span className="flex h-9 items-center gap-2 rounded-xl border border-primary/20 bg-primary/[0.07] px-4 text-[9px] font-semibold text-primary"><ShieldCheck className="h-3.5 w-3.5" />ZYON reviewed</span> : <button type="button" onClick={() => updateTrade(selectedTrade.id, { reviewedAt: selectedTrade.reviewedAt ? null : new Date().toISOString() })} className={`flex h-9 items-center gap-2 rounded-xl px-4 text-[9px] font-semibold ${selectedTrade.reviewedAt ? "border border-border bg-surface text-muted hover:text-foreground" : "bg-primary text-background"}`}>{selectedTrade.reviewedAt ? <CircleAlert className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}{selectedTrade.reviewedAt ? "Reopen review" : "Mark reviewed"}</button>}
            </div>
          </aside>
        </div>
      ) : null}

      {selectedEvidence ? (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/88 p-6 backdrop-blur-md" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedEvidenceId(null); }}>
          <div className="relative flex max-h-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3"><div className="min-w-0"><div className="truncate text-[10px] font-semibold text-white">{selectedEvidence.name}</div><div className="mt-0.5 text-[8px] text-white/45">{selectedEvidence.account} · {formatDate(selectedEvidence.importedAt, true)}</div></div><a href={selectedEvidence.dataUrl} download={selectedEvidence.name} className="ml-auto flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-[8px] font-semibold text-white/65 hover:text-white"><Download className="h-3.5 w-3.5" />Download</a><button type="button" onClick={() => setSelectedEvidenceId(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/55 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button></div>
            <div className="min-h-0 overflow-auto p-3">
              {selectedEvidence.mimeType.startsWith("image/") ? <Image src={selectedEvidence.dataUrl} alt={selectedEvidence.name} width={1800} height={1200} unoptimized className="max-h-[78vh] w-auto max-w-full object-contain" /> : <pre className="max-h-[78vh] max-w-4xl overflow-auto whitespace-pre-wrap p-5 font-mono text-[10px] leading-5 text-white/75">{selectedEvidence.textContent || "Preview unavailable. Download the source file to open it."}</pre>}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
