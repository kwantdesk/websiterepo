"use client";

import Image from "next/image";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
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
  ImageIcon,
  Import,
  Layers3,
  LineChart,
  NotebookPen,
  Paperclip,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Tags,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import {
  calculateJournalStats,
  EMPTY_JOURNAL_STATE,
  journalTradesToCsv,
  parseJournalTextFile,
  type JournalEvidence,
  type JournalImportBatch,
  type JournalState,
  type JournalTrade,
} from "@/lib/journal";
import { loadJournalState, saveJournalState } from "@/lib/journalStore";
import KwantSelect from "@/components/ui/KwantSelect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type JournalTab = "pulse" | "calendar" | "trades" | "edgebook" | "evidence" | "imports";
type OutcomeFilter = "all" | "wins" | "losses" | "breakeven" | "needs-review";
type SortKey = "closedAt" | "netPnl" | "rMultiple" | "quantity" | "symbol";

const JOURNAL_TABS: Array<{ id: JournalTab; label: string; icon: typeof Activity }> = [
  { id: "pulse", label: "Pulse", icon: Activity },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "trades", label: "Trade Log", icon: FileSpreadsheet },
  { id: "edgebook", label: "Edgebook", icon: Sparkles },
  { id: "evidence", label: "Evidence", icon: ImageIcon },
  { id: "imports", label: "Imports", icon: FolderArchive },
];

const ACCEPTED_FILES = ".csv,.tsv,.txt,.json,.md,.png,.jpg,.jpeg,.webp,.gif";
const MAX_EVIDENCE_BYTES = 8_000_000;

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

function compact(value: number) {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "−" : value > 0 ? "+" : "";
  if (absolute >= 1_000_000) return `${sign}$${(absolute / 1_000_000).toFixed(2)}M`;
  if (absolute >= 1_000) return `${sign}$${(absolute / 1_000).toFixed(1)}K`;
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

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
  tone?: "positive" | "negative" | "neutral";
}) {
  return (
    <Card className="min-w-0 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</span>
        <Icon className={`h-3.5 w-3.5 ${tone === "positive" ? "text-primary" : tone === "negative" ? "text-danger" : "text-muted"}`} />
      </div>
      <div className={`mt-3 truncate font-mono text-[22px] font-semibold ${tone === "positive" ? "text-primary" : tone === "negative" ? "text-danger" : "text-foreground"}`}>{value}</div>
      <div className="mt-1 truncate text-[9px] text-muted">{detail}</div>
    </Card>
  );
}

function EquityCurve({ trades }: { trades: JournalTrade[] }) {
  const geometry = useMemo(() => {
    const ordered = [...trades].sort((left, right) => Date.parse(left.closedAt ?? left.openedAt) - Date.parse(right.closedAt ?? right.openedAt));
    let equity = 0;
    const values = [0, ...ordered.map((trade) => {
      equity += trade.netPnl;
      return equity;
    })];
    const width = 860;
    const height = 230;
    const top = 18;
    const bottom = 24;
    const minimum = Math.min(0, ...values);
    const maximum = Math.max(0, ...values);
    const span = Math.max(1, maximum - minimum);
    const x = (index: number) => 8 + index / Math.max(1, values.length - 1) * (width - 16);
    const y = (value: number) => top + (maximum - value) / span * (height - top - bottom);
    return {
      width,
      height,
      path: values.map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" "),
      area: `${values.map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ")} L${width - 8},${height - bottom} L8,${height - bottom} Z`,
      zeroY: y(0),
      final: values.at(-1) ?? 0,
    };
  }, [trades]);

  if (!trades.length) return <div className="flex h-[230px] items-center justify-center text-[10px] text-muted">Import trades to build the equity curve.</div>;
  return (
    <div className="relative h-[230px]">
      <svg viewBox={`0 0 ${geometry.width} ${geometry.height}`} className="h-full w-full" preserveAspectRatio="none" role="img" aria-label="Cumulative imported net profit and loss">
        <defs>
          <linearGradient id="journal-equity-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity=".24" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((line) => <line key={line} x1="0" x2={geometry.width} y1={geometry.height * line} y2={geometry.height * line} stroke="var(--grid-color)" strokeWidth="1" />)}
        <line x1="0" x2={geometry.width} y1={geometry.zeroY} y2={geometry.zeroY} stroke="var(--muted)" strokeOpacity=".45" strokeDasharray="4 5" />
        <path d={geometry.area} fill="url(#journal-equity-fill)" />
        <path d={geometry.path} fill="none" stroke={geometry.final >= 0 ? "var(--primary)" : "var(--danger)"} strokeWidth="2.25" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className={`absolute right-2 top-2 rounded-lg border border-border bg-background/75 px-2 py-1 font-mono text-[10px] ${geometry.final >= 0 ? "text-primary" : "text-danger"}`}>{compact(geometry.final)}</span>
    </div>
  );
}

function DailyBars({ trades }: { trades: JournalTrade[] }) {
  const days = useMemo(() => {
    const grouped = new Map<string, number>();
    trades.forEach((trade) => {
      const key = localDateKey(trade.closedAt ?? trade.openedAt);
      if (key) grouped.set(key, (grouped.get(key) ?? 0) + trade.netPnl);
    });
    return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).slice(-18);
  }, [trades]);
  const maximum = Math.max(1, ...days.map(([, value]) => Math.abs(value)));
  if (!days.length) return <div className="flex h-[176px] items-center justify-center text-[10px] text-muted">Daily performance appears after import.</div>;
  return (
    <div className="flex h-[176px] items-center gap-1.5 pt-4">
      {days.map(([date, value]) => {
        const height = Math.max(5, Math.abs(value) / maximum * 68);
        return (
          <div key={date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-center" title={`${date}: ${money(value)}`}>
            <div className="flex h-[140px] w-full flex-col items-center justify-center">
              <span className={`w-[70%] max-w-5 rounded-sm ${value >= 0 ? "bg-primary/80" : "bg-danger/80"}`} style={{ height }} />
            </div>
            <span className="mt-1 -rotate-45 whitespace-nowrap font-mono text-[7px] text-muted">{date.slice(5)}</span>
          </div>
        );
      })}
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
              <div className={`h-full rounded-full ${row.netPnl >= 0 ? "bg-primary" : "bg-danger"}`} style={{ width: `${Math.max(3, Math.abs(row.netPnl) / maximum * 100)}%` }} />
            </div>
            <span className={`text-right font-mono font-semibold ${row.netPnl >= 0 ? "text-primary" : "text-danger"}`}>{compact(row.netPnl)}</span>
            <span className="text-right font-mono text-muted">{row.tradeCount} · {percent(row.winRate, 0)}</span>
          </div>
        ))}
        {!rows.length ? <div className="px-4 py-10 text-center text-[10px] text-muted">No qualifying trades.</div> : null}
      </div>
    </Card>
  );
}

export default function JournalWorkspace({ accountKey }: { accountKey: string }) {
  const [state, setState] = useState<JournalState>(EMPTY_JOURNAL_STATE);
  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"loading" | "saved" | "error">("loading");
  const [tab, setTab] = useState<JournalTab>("pulse");
  const [showImport, setShowImport] = useState(false);
  const [importAccount, setImportAccount] = useState("Imported account");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [importing, setImporting] = useState(false);
  const [importDragging, setImportDragging] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [query, setQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("closedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resolvedAccountKey = accountKey || "local";

  useEffect(() => {
    let active = true;
    setReady(false);
    setSaveStatus("loading");
    loadJournalState(resolvedAccountKey).then((stored) => {
      if (!active) return;
      setState(stored);
      setReady(true);
      setSaveStatus("saved");
    });
    return () => {
      active = false;
    };
  }, [resolvedAccountKey]);

  useEffect(() => {
    if (!ready) return;
    setSaveStatus("loading");
    const timer = window.setTimeout(() => {
      void saveJournalState(resolvedAccountKey, state).then((saved) => setSaveStatus(saved ? "saved" : "error"));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [ready, resolvedAccountKey, state]);

  const accounts = useMemo(() => [...new Set([
    ...state.trades.map((trade) => trade.account),
    ...state.evidence.map((item) => item.account),
    ...state.imports.map((item) => item.account),
  ].filter(Boolean))].sort(), [state]);

  const filteredTrades = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = state.trades.filter((trade) => {
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
  }, [accountFilter, outcomeFilter, query, sortDirection, sortKey, state.trades]);

  const filteredEvidence = useMemo(() => state.evidence.filter((item) => accountFilter === "all" || item.account === accountFilter), [accountFilter, state.evidence]);
  const stats = useMemo(() => calculateJournalStats(filteredTrades, filteredEvidence), [filteredEvidence, filteredTrades]);
  const selectedTrade = state.trades.find((trade) => trade.id === selectedTradeId) ?? null;
  const selectedEvidence = state.evidence.find((item) => item.id === selectedEvidenceId) ?? null;
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

  const addFiles = useCallback((files: FileList | File[]) => {
    const selected = [...files];
    setPendingFiles((current) => {
      const known = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
      return [...current, ...selected.filter((file) => !known.has(`${file.name}:${file.size}:${file.lastModified}`))].slice(0, 30);
    });
    setImportMessage("");
  }, []);

  const runImport = async () => {
    if (!pendingFiles.length || importing) return;
    setImporting(true);
    setImportMessage("");
    const account = importAccount.trim() || "Imported account";
    const existingFingerprints = new Set(state.trades.map((trade) => trade.fingerprint));
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

      const text = await file.text();
      const firstLine = text.split(/\r?\n/, 1)[0]?.toLowerCase() ?? "";
      const looksLikeTradeTable = /[,;\t]/.test(firstLine)
        && /(symbol|instrument|ticker|contract)/.test(firstLine)
        && /(pnl|profit|price|entry|exit|side|direction|action)/.test(firstLine);
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

      const parsed = parseJournalTextFile(file.name, text, account, importId);
      let fileDuplicates = 0;
      const accepted = parsed.trades.filter((trade) => {
        if (existingFingerprints.has(trade.fingerprint)) {
          fileDuplicates += 1;
          return false;
        }
        existingFingerprints.add(trade.fingerprint);
        return true;
      });
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
      trades: [...current.trades, ...newTrades].slice(-50_000),
      evidence: [...newEvidence, ...current.evidence].slice(0, 500),
      imports: [...newImports, ...current.imports].slice(0, 500),
    }));
    setPendingFiles([]);
    setImporting(false);
    setImportMessage(`${newTrades.length} trade${newTrades.length === 1 ? "" : "s"} and ${newEvidence.length} evidence file${newEvidence.length === 1 ? "" : "s"} imported${duplicates ? ` · ${duplicates} duplicate${duplicates === 1 ? "" : "s"} skipped` : ""}.`);
    if (newTrades.length) setTab("pulse");
  };

  const updateTrade = (tradeId: string, patch: Partial<JournalTrade>) => {
    setState((current) => ({
      ...current,
      trades: current.trades.map((trade) => trade.id === tradeId ? { ...trade, ...patch } : trade),
    }));
  };

  const updateEvidence = (evidenceId: string, patch: Partial<JournalEvidence>) => {
    setState((current) => ({
      ...current,
      evidence: current.evidence.map((item) => item.id === evidenceId ? { ...item, ...patch } : item),
    }));
  };

  const deleteImport = (batch: JournalImportBatch) => {
    if (!window.confirm(`Remove "${batch.fileName}" and every Journal record created by this import?`)) return;
    setState((current) => ({
      ...current,
      trades: current.trades.filter((trade) => trade.sourceImportId !== batch.id),
      evidence: current.evidence.filter((item) => item.sourceImportId !== batch.id),
      imports: current.imports.filter((item) => item.id !== batch.id),
    }));
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
  const bySide = useMemo(() => groupPerformance(filteredTrades, (trade) => trade.side), [filteredTrades]);
  const byWeekday = useMemo(() => groupPerformance(filteredTrades, (trade) => new Date(trade.openedAt).toLocaleDateString("en-AU", { weekday: "long" })), [filteredTrades]);
  const byHour = useMemo(() => groupPerformance(filteredTrades, (trade) => `${String(new Date(trade.openedAt).getHours()).padStart(2, "0")}:00`), [filteredTrades]);
  const bySetup = useMemo(() => groupPerformance(filteredTrades, (trade) => trade.setup || trade.tags[0] || "Unclassified"), [filteredTrades]);

  if (!ready) {
    return <div className="flex h-full items-center justify-center bg-background text-[11px] text-muted">Loading Journal memory…</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <header className="shrink-0 border-b border-border bg-panel">
        <div className="flex min-h-[64px] flex-wrap items-center gap-3 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><NotebookPen className="h-4 w-4" /></span>
          <div className="min-w-0">
            <h1 className="text-[14px] font-semibold tracking-[-0.01em] text-foreground">Journal</h1>
            <p className="mt-0.5 text-[9px] text-muted">Imported performance · review evidence · measurable edge</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className={`flex h-8 items-center gap-1.5 rounded-xl border border-border bg-surface px-2.5 text-[9px] ${saveStatus === "error" ? "text-danger" : "text-muted"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${saveStatus === "saved" ? "bg-primary" : saveStatus === "error" ? "bg-danger" : "animate-pulse bg-warning"}`} />
              {saveStatus === "saved" ? "Journal saved" : saveStatus === "error" ? "Local save limited" : "Saving"}
            </span>
            <KwantSelect value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)} className="h-8 rounded-xl border border-border bg-surface px-3 text-[9px] text-foreground outline-none">
              <option value="all">All accounts</option>
              {accounts.map((account) => <option key={account} value={account}>{account}</option>)}
            </KwantSelect>
            <button type="button" onClick={() => exportJournal("json")} disabled={!state.trades.length && !state.evidence.length} className="flex h-8 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-[9px] font-semibold text-muted hover:text-foreground disabled:opacity-35"><Download className="h-3.5 w-3.5" />Backup</button>
            <button type="button" onClick={() => setShowImport(true)} className="flex h-8 items-center gap-1.5 rounded-xl bg-primary px-3 text-[9px] font-semibold text-background hover:brightness-110"><Upload className="h-3.5 w-3.5" />Import</button>
          </div>
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto px-3" aria-label="Journal views">
          {JOURNAL_TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={`relative flex h-10 shrink-0 items-center gap-1.5 px-3 text-[10px] font-semibold transition-colors ${tab === id ? "text-primary" : "text-muted hover:text-foreground"}`}>
              <Icon className="h-3.5 w-3.5" />
              {label}
              {tab === id ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" /> : null}
            </button>
          ))}
        </nav>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!state.trades.length && tab !== "evidence" && tab !== "imports" ? (
          <div className="mx-auto flex min-h-full max-w-5xl items-center justify-center p-6">
            <div className="relative w-full overflow-hidden rounded-3xl border border-border bg-panel p-8 text-center shadow-2xl shadow-black/20">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,color-mix(in_srgb,var(--primary)_10%,transparent),transparent_42%)]" />
              <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary"><Import className="h-6 w-6" /></div>
              <h2 className="relative mt-5 text-[22px] font-semibold tracking-[-0.03em] text-foreground">Bring your trading history into focus.</h2>
              <p className="relative mx-auto mt-2 max-w-xl text-[11px] leading-5 text-muted">Import closed trades, executions, screenshots, or notes. Kwant Desk calculates performance only from the records you provide and keeps the source history visible.</p>
              <button type="button" onClick={() => setShowImport(true)} className="relative mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-[10px] font-semibold text-background"><Upload className="h-4 w-4" />Choose files</button>
              <div className="relative mx-auto mt-7 grid max-w-3xl gap-2 sm:grid-cols-3">
                {[
                  [FileSpreadsheet, "Trades", "CSV, TSV and JSON trade or execution files"],
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

        {state.trades.length && tab === "pulse" ? (
          <div className="space-y-3 p-3">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
              <MetricCard label="Net P&L" value={money(stats.netPnl)} detail={`${stats.tradeCount} imported trades`} icon={stats.netPnl >= 0 ? TrendingUp : TrendingDown} tone={stats.netPnl >= 0 ? "positive" : "negative"} />
              <MetricCard label="Win rate" value={percent(stats.winRate)} detail={`${filteredTrades.filter((trade) => trade.netPnl > 0).length} wins · ${filteredTrades.filter((trade) => trade.netPnl < 0).length} losses`} icon={Activity} />
              <MetricCard label="Profit factor" value={ratio(stats.profitFactor)} detail={`${money(stats.grossProfit, false)} / ${money(stats.grossLoss, false)}`} icon={BarChart3} />
              <MetricCard label="Expectancy" value={money(stats.expectancy)} detail="Average net result per trade" icon={Sparkles} tone={(stats.expectancy ?? 0) >= 0 ? "positive" : "negative"} />
              <MetricCard label="Average R" value={stats.averageR === null ? "—" : `${stats.averageR.toFixed(2)}R`} detail={`${filteredTrades.filter((trade) => trade.rMultiple !== null).length} risk-complete trades`} icon={Layers3} />
              <MetricCard label="Max drawdown" value={money(-stats.maxDrawdown)} detail="Peak-to-trough imported P&L" icon={TrendingDown} tone="negative" />
              <MetricCard label="Review integrity" value={`${reviewIntegrity}%`} detail="Source 45% · review 40% · evidence 15%" icon={ShieldCheck} tone={reviewIntegrity >= 80 ? "positive" : "neutral"} />
              <MetricCard label="Open reviews" value={String(unreviewed.length)} detail={`${stats.reviewedCount} marked reviewed`} icon={CircleAlert} tone={unreviewed.length ? "negative" : "positive"} />
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
                      <span className={`text-right font-mono font-semibold ${trade.netPnl >= 0 ? "text-primary" : "text-danger"}`}>{money(trade.netPnl)}</span>
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

        {state.trades.length && tab === "calendar" ? (
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
                  <button key={day.dateKey} type="button" onClick={() => setSelectedDay(day.dateKey)} className={`group min-h-[108px] border-b border-r border-border p-2 text-left transition-colors hover:bg-surface/60 ${selectedDay === day.dateKey ? "bg-primary/[0.07] shadow-[inset_0_0_0_1px_var(--primary)]" : day.trades.length ? day.pnl >= 0 ? "bg-primary/[0.035]" : "bg-danger/[0.035]" : "bg-background/20"}`}>
                    <div className="flex items-start justify-between gap-1"><span className="font-mono text-[9px] text-muted">{day.day}</span>{day.evidence ? <Paperclip className="h-3 w-3 text-accent" /> : null}</div>
                    {day.trades.length ? <><div className={`mt-4 font-mono text-[11px] font-semibold ${day.pnl >= 0 ? "text-primary" : "text-danger"}`}>{money(day.pnl)}</div><div className="mt-1 text-[8px] text-muted">{day.trades.length} trade{day.trades.length === 1 ? "" : "s"}</div><div className="mt-2 h-1 rounded-full bg-surface"><div className="h-full rounded-full bg-primary" style={{ width: `${day.trades.length ? day.reviewed / day.trades.length * 100 : 0}%` }} /></div></> : null}
                  </button>
                ) : <div key={`blank-${index}`} className="min-h-[108px] border-b border-r border-border bg-background/10" />)}
              </div>
            </Card>
            {selectedDay ? (
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-border px-4 py-3"><div><h3 className="text-[11px] font-semibold text-foreground">{formatDate(`${selectedDay}T12:00:00`)}</h3><p className="mt-0.5 text-[8px] text-muted">{selectedDayTrades.length} imported trades · {money(selectedDayTrades.reduce((sum, trade) => sum + trade.netPnl, 0))}</p></div><button type="button" onClick={() => setSelectedDay("")} className="text-muted hover:text-foreground"><X className="h-4 w-4" /></button></div>
                <div className="divide-y divide-border/60">{selectedDayTrades.map((trade) => <button key={trade.id} type="button" onClick={() => setSelectedTradeId(trade.id)} className="grid w-full grid-cols-[74px_70px_64px_minmax(80px,1fr)_90px] items-center gap-3 px-4 py-3 text-left text-[9px] hover:bg-surface/40"><span className="font-mono text-muted">{new Date(trade.openedAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}</span><span className="font-semibold">{trade.symbol}</span><span className={trade.side === "LONG" ? "text-primary" : "text-danger"}>{trade.side}</span><span className="truncate text-muted">{trade.setup || trade.tags.join(", ") || "Unclassified"}</span><span className={`text-right font-mono font-semibold ${trade.netPnl >= 0 ? "text-primary" : "text-danger"}`}>{money(trade.netPnl)}</span></button>)}</div>
              </Card>
            ) : null}
          </div>
        ) : null}

        {state.trades.length && tab === "trades" ? (
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
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] border-collapse text-[9px]">
                  <thead className="bg-surface/45 text-muted">
                    <tr>{["Date / time", "Account", "Symbol", "Side", "Qty", "Entry", "Exit", "Net P&L", "R", "Duration", "Setup / tags", "Review"].map((header) => <th key={header} className="border-b border-border px-3 py-2.5 text-left font-semibold uppercase tracking-[0.08em]">{header}</th>)}</tr>
                  </thead>
                  <tbody>
                    {filteredTrades.map((trade) => (
                      <tr key={trade.id} onClick={() => setSelectedTradeId(trade.id)} className="cursor-pointer border-b border-border/55 transition-colors hover:bg-surface/45">
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-muted">{formatDate(trade.closedAt ?? trade.openedAt, true)}</td>
                        <td className="max-w-[140px] truncate px-3 py-2.5 text-muted" title={trade.account}>{trade.account}</td>
                        <td className="px-3 py-2.5 font-semibold text-foreground">{trade.symbol}</td>
                        <td className={`px-3 py-2.5 font-semibold ${trade.side === "LONG" ? "text-primary" : trade.side === "SHORT" ? "text-danger" : "text-muted"}`}>{trade.side}</td>
                        <td className="px-3 py-2.5 font-mono">{trade.quantity.toLocaleString()}</td>
                        <td className="px-3 py-2.5 font-mono">{trade.entryPrice?.toLocaleString("en-US", { maximumFractionDigits: 6 }) ?? "—"}</td>
                        <td className="px-3 py-2.5 font-mono">{trade.exitPrice?.toLocaleString("en-US", { maximumFractionDigits: 6 }) ?? "—"}</td>
                        <td className={`px-3 py-2.5 font-mono font-semibold ${trade.netPnl >= 0 ? "text-primary" : "text-danger"}`}>{money(trade.netPnl)}</td>
                        <td className="px-3 py-2.5 font-mono">{trade.rMultiple === null ? "—" : `${trade.rMultiple.toFixed(2)}R`}</td>
                        <td className="px-3 py-2.5 text-muted">{formatDuration(trade.durationMs)}</td>
                        <td className="max-w-[220px] truncate px-3 py-2.5 text-muted">{trade.setup || trade.tags.join(", ") || "—"}</td>
                        <td className="px-3 py-2.5">{trade.reviewedAt ? <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-primary"><Check className="h-2.5 w-2.5" />Reviewed</span> : <span className="rounded-full bg-warning/10 px-2 py-1 text-warning">Pending</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filteredTrades.length ? <div className="px-6 py-16 text-center text-[10px] text-muted">No trades match these filters.</div> : null}
              </div>
            </Card>
          </div>
        ) : null}

        {state.trades.length && tab === "edgebook" ? (
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
                {bySide.map((row) => <div key={row.label} className="rounded-xl border border-border bg-background/35 p-3"><div className="text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">{row.label}</div><div className={`mt-2 font-mono text-[18px] font-semibold ${row.netPnl >= 0 ? "text-primary" : "text-danger"}`}>{money(row.netPnl)}</div><div className="mt-1 text-[8px] text-muted">{row.tradeCount} trades · {percent(row.winRate)} win · {ratio(row.profitFactor)} PF</div></div>)}
              </div>
              <p className="mt-3 text-[8px] leading-4 text-muted">Edgebook ranks only the selected imported population. Treat small samples as questions to investigate, not proof of a repeatable edge.</p>
            </Card>
          </div>
        ) : null}

        {tab === "evidence" ? (
          <div className="space-y-3 p-3">
            <Card className="flex flex-wrap items-center gap-3 p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><ImageIcon className="h-4 w-4" /></span>
              <div><h2 className="text-[11px] font-semibold text-foreground">Evidence library</h2><p className="mt-0.5 text-[8px] text-muted">{filteredEvidence.length} screenshots and notes · attach evidence inside any trade review</p></div>
              <button type="button" onClick={() => setShowImport(true)} className="ml-auto flex h-8 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-[9px] font-semibold text-muted hover:text-foreground"><Upload className="h-3.5 w-3.5" />Add evidence</button>
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
              <Card className="flex flex-col items-center justify-center border-dashed px-6 py-20 text-center"><ImageIcon className="h-8 w-8 text-muted" /><div className="mt-4 text-[11px] font-semibold text-foreground">No evidence imported</div><div className="mt-1 max-w-md text-[9px] leading-4 text-muted">Import chart screenshots, research images, Markdown, or text notes. Evidence can then be attached to a trade review.</div></Card>
            )}
          </div>
        ) : null}

        {tab === "imports" ? (
          <div className="space-y-3 p-3">
            <Card className="flex flex-wrap items-center gap-3 p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><FolderArchive className="h-4 w-4" /></span>
              <div><h2 className="text-[11px] font-semibold text-foreground">Import lineage</h2><p className="mt-0.5 text-[8px] text-muted">Every source stays visible, including rejected rows, duplicates, and parsing warnings</p></div>
              <button type="button" onClick={() => setShowImport(true)} className="ml-auto flex h-8 items-center gap-1.5 rounded-xl bg-primary px-3 text-[9px] font-semibold text-background"><Upload className="h-3.5 w-3.5" />New import</button>
            </Card>
            <div className="space-y-2">
              {state.imports.map((batch) => (
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
              {!state.imports.length ? <Card className="border-dashed px-6 py-20 text-center text-[10px] text-muted">No import history yet.</Card> : null}
            </div>
          </div>
        ) : null}
      </div>

      {showImport ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowImport(false); }}>
          <div className="w-full max-w-[650px] overflow-hidden rounded-3xl border border-border bg-panel shadow-2xl shadow-black/60">
            <div className="flex items-start gap-3 border-b border-border px-5 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Upload className="h-4 w-4" /></span>
              <div><h2 className="text-[14px] font-semibold text-foreground">Import journal data</h2><p className="mt-1 text-[9px] leading-4 text-muted">Closed trades, execution files, screenshots, JSON, Markdown, and text notes.</p></div>
              <button type="button" onClick={() => setShowImport(false)} className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">Account / import label</label>
                <input value={importAccount} onChange={(event) => setImportAccount(event.target.value)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[10px] text-foreground outline-none focus:border-primary/45" placeholder="e.g. Apex NQ Evaluation" />
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={(event) => { event.preventDefault(); setImportDragging(true); }}
                onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setImportDragging(true); }}
                onDragLeave={() => setImportDragging(false)}
                onDrop={(event) => { event.preventDefault(); setImportDragging(false); addFiles(event.dataTransfer.files); }}
                className={`flex min-h-[170px] w-full flex-col items-center justify-center rounded-2xl border border-dashed px-6 text-center transition-colors ${importDragging ? "border-primary bg-primary/10" : "border-border bg-background/35 hover:border-primary/45"}`}
              >
                <Import className="h-7 w-7 text-primary" />
                <span className="mt-3 text-[11px] font-semibold text-foreground">Drop files here or browse</span>
                <span className="mt-1 text-[8px] leading-4 text-muted">CSV · TSV · JSON · PNG · JPG · WEBP · GIF · MD · TXT</span>
                <span className="mt-2 text-[8px] text-muted">Images up to 8 MB · maximum 30 files per import</span>
              </button>
              <input ref={fileInputRef} type="file" accept={ACCEPTED_FILES} multiple className="hidden" onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.currentTarget.value = ""; }} />
              {pendingFiles.length ? (
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-border bg-background/25 p-2">
                  {pendingFiles.map((file) => <div key={`${file.name}:${file.size}:${file.lastModified}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[8px] hover:bg-surface"><FileText className="h-3.5 w-3.5 text-muted" /><span className="min-w-0 flex-1 truncate text-foreground">{file.name}</span><span className="font-mono text-muted">{Math.max(1, Math.round(file.size / 1024))} KB</span><button type="button" onClick={() => setPendingFiles((current) => current.filter((candidate) => candidate !== file))} className="text-muted hover:text-danger"><X className="h-3.5 w-3.5" /></button></div>)}
                </div>
              ) : null}
              {importMessage ? <div className="rounded-xl border border-primary/20 bg-primary/[0.07] px-3 py-2 text-[9px] text-primary">{importMessage}</div> : null}
              <div className="rounded-xl border border-border bg-surface/35 p-3 text-[8px] leading-4 text-muted"><strong className="text-foreground">Source-first import:</strong> duplicate trades are skipped, unmatched executions remain visible as warnings, and every accepted record keeps its source file and row numbers.</div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border bg-background/20 px-5 py-4">
              <button type="button" onClick={() => setShowImport(false)} className="h-9 rounded-xl border border-border px-4 text-[9px] font-semibold text-muted hover:bg-surface hover:text-foreground">Close</button>
              <button type="button" onClick={runImport} disabled={!pendingFiles.length || importing} className="flex h-9 items-center gap-2 rounded-xl bg-primary px-4 text-[9px] font-semibold text-background disabled:opacity-40">{importing ? <span className="h-3 w-3 animate-spin rounded-full border border-background/30 border-t-background" /> : <Upload className="h-3.5 w-3.5" />}{importing ? "Importing" : `Import ${pendingFiles.length || ""}`}</button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedTrade ? (
        <div className="fixed inset-0 z-[950] bg-black/55 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedTradeId(null); }}>
          <aside className="absolute bottom-0 right-0 top-0 flex w-full max-w-[520px] flex-col border-l border-border bg-panel shadow-2xl shadow-black/60">
            <div className="flex items-start gap-3 border-b border-border px-5 py-4">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selectedTrade.netPnl >= 0 ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger"}`}>{selectedTrade.side === "LONG" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}</span>
              <div className="min-w-0"><div className="flex items-center gap-2"><h2 className="text-[14px] font-semibold text-foreground">{selectedTrade.symbol}</h2><span className={`rounded-md px-1.5 py-0.5 text-[8px] font-semibold ${selectedTrade.side === "LONG" ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger"}`}>{selectedTrade.side}</span></div><p className="mt-1 truncate text-[9px] text-muted">{selectedTrade.account} · {formatDate(selectedTrade.openedAt, true)}</p></div>
              <button type="button" onClick={() => setSelectedTradeId(null)} className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-border bg-background/35 p-3"><div className="text-[8px] uppercase tracking-[0.1em] text-muted">Net P&amp;L</div><div className={`mt-1 font-mono text-[16px] font-semibold ${selectedTrade.netPnl >= 0 ? "text-primary" : "text-danger"}`}>{money(selectedTrade.netPnl)}</div></div>
                <div className="rounded-xl border border-border bg-background/35 p-3"><div className="text-[8px] uppercase tracking-[0.1em] text-muted">R multiple</div><div className="mt-1 font-mono text-[16px] font-semibold">{selectedTrade.rMultiple === null ? "—" : `${selectedTrade.rMultiple.toFixed(2)}R`}</div></div>
                <div className="rounded-xl border border-border bg-background/35 p-3"><div className="text-[8px] uppercase tracking-[0.1em] text-muted">Duration</div><div className="mt-1 font-mono text-[16px] font-semibold">{formatDuration(selectedTrade.durationMs)}</div></div>
              </div>
              <Card className="p-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-[9px]">
                  {[["Entry", selectedTrade.entryPrice?.toLocaleString("en-US", { maximumFractionDigits: 6 }) ?? "—"], ["Exit", selectedTrade.exitPrice?.toLocaleString("en-US", { maximumFractionDigits: 6 }) ?? "—"], ["Quantity", selectedTrade.quantity.toLocaleString()], ["Fees", money(selectedTrade.fees, false)], ["Gross P&L", money(selectedTrade.grossPnl)], ["Source", `${selectedTrade.sourceFile} · rows ${selectedTrade.sourceRows.join(", ")}`]].map(([label, value]) => <div key={label}><div className="text-[8px] uppercase tracking-[0.1em] text-muted">{label}</div><div className="mt-1 break-words font-mono text-foreground">{value}</div></div>)}
                </div>
              </Card>
              <div>
                <label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">Setup</label>
                <input value={selectedTrade.setup} onChange={(event) => updateTrade(selectedTrade.id, { setup: event.target.value })} placeholder="Name the setup used" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] text-foreground outline-none focus:border-primary/45" />
              </div>
              <div>
                <label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">Tags</label>
                <input value={selectedTrade.tags.join(", ")} onChange={(event) => updateTrade(selectedTrade.id, { tags: [...new Set(event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean))].slice(0, 24) })} placeholder="breakout, patient, news day" className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[9px] text-foreground outline-none focus:border-primary/45" />
              </div>
              <div>
                <label className="mb-1.5 block text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">Trade review</label>
                <textarea value={selectedTrade.notes} onChange={(event) => updateTrade(selectedTrade.id, { notes: event.target.value })} rows={6} placeholder="What was the thesis? What confirmed it? What invalidated it? What will you repeat or change?" className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[9px] leading-5 text-foreground outline-none focus:border-primary/45" />
              </div>
              <div>
                <label className="mb-2 block text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">Execution quality</label>
                <div className="flex items-center gap-1.5">{[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" onClick={() => updateTrade(selectedTrade.id, { rating })} className={`flex h-8 w-8 items-center justify-center rounded-lg border ${selectedTrade.rating && rating <= selectedTrade.rating ? "border-primary/35 bg-primary/10 text-primary" : "border-border bg-background text-muted hover:text-foreground"}`}><Star className={`h-3.5 w-3.5 ${selectedTrade.rating && rating <= selectedTrade.rating ? "fill-current" : ""}`} /></button>)}</div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between"><label className="text-[8px] font-semibold uppercase tracking-[0.12em] text-muted">Evidence</label><button type="button" onClick={() => { setSelectedTradeId(null); setTab("evidence"); }} className="text-[8px] font-semibold text-primary">OPEN LIBRARY</button></div>
                <div className="grid grid-cols-3 gap-2">
                  {state.evidence.map((item) => {
                    const attached = item.tradeId === selectedTrade.id;
                    return (
                      <button key={item.id} type="button" onClick={() => updateEvidence(item.id, { tradeId: attached ? null : selectedTrade.id })} className={`relative h-20 overflow-hidden rounded-xl border text-left ${attached ? "border-primary shadow-[0_0_0_1px_var(--primary)]" : "border-border opacity-65 hover:opacity-100"}`} title={attached ? `Detach ${item.name}` : `Attach ${item.name}`}>
                        {item.mimeType.startsWith("image/") ? <Image src={item.dataUrl} alt={item.name} width={180} height={100} unoptimized className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-background"><FileText className="h-5 w-5 text-muted" /></div>}
                        {attached ? <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-background"><Check className="h-3 w-3" /></span> : null}
                      </button>
                    );
                  })}
                  {!state.evidence.length ? <div className="col-span-3 rounded-xl border border-dashed border-border px-3 py-8 text-center text-[8px] text-muted">Import screenshots or notes to attach evidence.</div> : null}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-border bg-background/20 px-5 py-4">
              <div className="mr-auto text-[8px] text-muted">{selectedTrade.reviewedAt ? `Reviewed ${formatDate(selectedTrade.reviewedAt, true)}` : "Review remains open"}</div>
              <button type="button" onClick={() => updateTrade(selectedTrade.id, { reviewedAt: selectedTrade.reviewedAt ? null : new Date().toISOString() })} className={`flex h-9 items-center gap-2 rounded-xl px-4 text-[9px] font-semibold ${selectedTrade.reviewedAt ? "border border-border bg-surface text-muted hover:text-foreground" : "bg-primary text-background"}`}>{selectedTrade.reviewedAt ? <CircleAlert className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}{selectedTrade.reviewedAt ? "Reopen review" : "Mark reviewed"}</button>
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
