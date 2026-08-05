"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Check,
  Code2,
  Copy,
  FileCode2,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { ChartIndicatorInstance } from "@/lib/chartIndicatorCatalog";
import { compilePineScript } from "@/lib/pineScriptRuntime";

const SOURCE_INDICATOR_STORAGE_KEY = "kwantdesk-source-code-indicators:v1";
const SOURCE_INDICATOR_ID = "source-code-indicator";
const STARTER_SOURCE = `//@version=6
indicator("EMA Ribbon", overlay=true)

fastLength = input.int(20, "Fast length", minval=1)
slowLength = input.int(50, "Slow length", minval=1)

fast = ta.ema(close, fastLength)
slow = ta.ema(close, slowLength)

plot(fast, title="Fast EMA", color=color.lime, linewidth=2)
plot(slow, title="Slow EMA", color=color.white, linewidth=2)`;

type SavedSourceIndicator = {
  id: string;
  name: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  instrument: string;
  timeframe: string;
  indicators: ChartIndicatorInstance[];
  onChange: (next: ChartIndicatorInstance[]) => void;
};

function newScript(source = STARTER_SOURCE): SavedSourceIndicator {
  const now = new Date().toISOString();
  const program = compilePineScript(source);
  return {
    id: crypto.randomUUID(),
    name: program.name || "Untitled indicator",
    source,
    createdAt: now,
    updatedAt: now,
  };
}

function readScripts() {
  if (typeof window === "undefined") return [] as SavedSourceIndicator[];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SOURCE_INDICATOR_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is SavedSourceIndicator => Boolean(
      value
      && typeof value === "object"
      && typeof value.id === "string"
      && typeof value.name === "string"
      && typeof value.source === "string",
    ));
  } catch {
    return [];
  }
}

function saveScripts(scripts: SavedSourceIndicator[]) {
  window.localStorage.setItem(SOURCE_INDICATOR_STORAGE_KEY, JSON.stringify(scripts));
  window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
}

export default function SourceCodeIndicatorsControl({
  instrument,
  timeframe,
  indicators,
  onChange,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [scripts, setScripts] = useState<SavedSourceIndicator[]>(readScripts);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SavedSourceIndicator | null>(null);
  const [dragging, setDragging] = useState(false);
  const program = useMemo(() => compilePineScript(draft?.source ?? ""), [draft?.source]);
  const errors = program.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const selectedIsOnChart = draft
    ? indicators.some((instance) => instance.indicatorId === SOURCE_INDICATOR_ID && instance.settings?.scriptId === draft.id)
    : false;

  useEffect(() => {
    if (!open || draft) return;
    const first = scripts[0] ?? newScript();
    setSelectedId(first.id);
    setDraft({ ...first });
  }, [draft, open, scripts]);

  const selectScript = (script: SavedSourceIndicator) => {
    setSelectedId(script.id);
    setDraft({ ...script });
  };

  const createScript = () => {
    const script = newScript();
    setSelectedId(script.id);
    setDraft(script);
  };

  const persistDraft = () => {
    if (!draft || errors.length) return null;
    const next = {
      ...draft,
      name: program.name || draft.name || "Untitled indicator",
      updatedAt: new Date().toISOString(),
    };
    const nextScripts = scripts.some((script) => script.id === next.id)
      ? scripts.map((script) => script.id === next.id ? next : script)
      : [next, ...scripts];
    setScripts(nextScripts);
    setDraft(next);
    setSelectedId(next.id);
    saveScripts(nextScripts);
    return next;
  };

  const addToChart = () => {
    const script = persistDraft();
    if (!script) return;
    const existing = indicators.find((instance) =>
      instance.indicatorId === SOURCE_INDICATOR_ID && instance.settings?.scriptId === script.id);
    const settings = {
      source: script.source,
      scriptId: script.id,
      scriptName: script.name,
      pineVersion: program.version,
      overlay: program.overlay,
    };
    if (existing) {
      onChange(indicators.map((instance) => instance.instanceId === existing.instanceId
        ? { ...instance, enabled: true, settings }
        : instance));
    } else {
      onChange([...indicators, {
        instanceId: `${SOURCE_INDICATOR_ID}-${crypto.randomUUID()}`,
        indicatorId: SOURCE_INDICATOR_ID,
        enabled: true,
        settings,
      }]);
    }
  };

  const removeScript = () => {
    if (!draft) return;
    const nextScripts = scripts.filter((script) => script.id !== draft.id);
    const nextIndicators = indicators.filter((instance) =>
      !(instance.indicatorId === SOURCE_INDICATOR_ID && instance.settings?.scriptId === draft.id));
    setScripts(nextScripts);
    saveScripts(nextScripts);
    onChange(nextIndicators);
    const next = nextScripts[0] ?? null;
    setSelectedId(next?.id ?? null);
    setDraft(next ? { ...next } : newScript());
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    const source = await file.text();
    const imported = newScript(source);
    setSelectedId(imported.id);
    setDraft(imported);
    setDragging(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-2 rounded-lg border border-border bg-surface/50 px-3 text-[11px] font-medium text-muted transition-colors hover:border-primary/25 hover:text-foreground"
        title="Create or import Pine source-code indicators"
      >
        <Code2 className="h-3.5 w-3.5" />
        <span className="hidden xl:inline">Source Code Indicators</span>
        <span className="xl:hidden">Source</span>
      </button>

      {open && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[285] flex items-center justify-center bg-black/75 p-4 backdrop-blur-[4px]" onClick={() => setOpen(false)}>
          <div
            className="flex h-[min(820px,92vh)] w-full max-w-[1180px] flex-col overflow-hidden rounded-3xl border border-border bg-panel shadow-[0_32px_110px_rgba(0,0,0,.72)]"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex h-[64px] shrink-0 items-center gap-3 border-b border-border px-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <FileCode2 className="h-[18px] w-[18px]" />
              </span>
              <div>
                <div className="text-[14px] font-semibold text-foreground">Source Code Indicators</div>
                <div className="mt-0.5 text-[9px] uppercase tracking-[0.14em] text-muted">Pine Script v5/v6 compatibility sandbox · {instrument} · {timeframe}</div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button type="button" onClick={createScript} className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[10px] text-foreground hover:border-primary/30">
                  <Plus className="h-3.5 w-3.5" /> New
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[10px] text-foreground hover:border-primary/30">
                  <Upload className="h-3.5 w-3.5" /> Import .pine
                </button>
                <input ref={fileInputRef} type="file" accept=".pine,.txt,text/plain" className="hidden" onChange={(event) => void importFile(event.target.files?.[0])} />
                <button type="button" onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground" aria-label="Close source indicators">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="flex min-h-0 flex-1">
              <aside className="flex w-[230px] shrink-0 flex-col border-r border-border bg-background/30">
                <div className="border-b border-border px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.15em] text-muted">My scripts · {scripts.length}</div>
                <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
                  {scripts.length ? scripts.map((script) => {
                    const active = selectedId === script.id;
                    const onChart = indicators.some((instance) => instance.indicatorId === SOURCE_INDICATOR_ID && instance.settings?.scriptId === script.id);
                    return (
                      <button key={script.id} type="button" onClick={() => selectScript(script)} className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${active ? "border-primary/25 bg-primary/10" : "border-transparent hover:border-border hover:bg-surface/50"}`}>
                        <div className={`truncate text-[10px] font-semibold ${active ? "text-primary" : "text-foreground"}`}>{script.name}</div>
                        <div className="mt-1 flex items-center justify-between text-[8px] text-muted">
                          <span>{new Date(script.updatedAt).toLocaleDateString()}</span>
                          {onChart ? <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-primary">ON CHART</span> : null}
                        </div>
                      </button>
                    );
                  }) : (
                    <div className="px-3 py-8 text-center text-[9px] leading-4 text-muted">Create or import your first Pine indicator.</div>
                  )}
                </div>
                <div className="border-t border-border p-3 text-[8px] leading-4 text-muted">
                  Scripts run locally against the chart&apos;s verified candles. They cannot access your account, network or browser APIs.
                </div>
              </aside>

              <main
                className={`relative flex min-w-0 flex-1 flex-col ${dragging ? "bg-primary/[0.035]" : ""}`}
                onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
                onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragging(true); }}
                onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
                onDrop={(event) => { event.preventDefault(); void importFile(event.dataTransfer.files?.[0]); }}
              >
                <div className="flex h-11 shrink-0 items-center border-b border-border px-4">
                  <div className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted">{draft?.name ?? "Untitled indicator"}.pine</div>
                  <div className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-[8px] font-semibold ${errors.length ? "border-danger/20 bg-danger/10 text-danger" : "border-primary/20 bg-primary/10 text-primary"}`}>
                    {errors.length ? <AlertTriangle className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                    {errors.length ? `${errors.length} error${errors.length === 1 ? "" : "s"}` : `Pine v${program.version} ready`}
                  </div>
                </div>
                <textarea
                  spellCheck={false}
                  value={draft?.source ?? ""}
                  onChange={(event) => setDraft((current) => current ? { ...current, source: event.target.value } : newScript(event.target.value))}
                  className="min-h-0 flex-1 resize-none bg-[#050606] px-5 py-4 font-mono text-[12px] leading-6 text-[#edf7ef] outline-none selection:bg-primary/25"
                  aria-label="Pine Script source editor"
                />
                {dragging ? (
                  <div className="pointer-events-none absolute inset-20 z-10 flex items-center justify-center rounded-3xl border border-dashed border-primary bg-background/85 text-[12px] font-semibold text-primary backdrop-blur-sm">Drop Pine source to import</div>
                ) : null}
              </main>

              <aside className="flex w-[300px] shrink-0 flex-col border-l border-border bg-background/20">
                <div className="border-b border-border px-4 py-3">
                  <div className="text-[10px] font-semibold text-foreground">Compile diagnostics</div>
                  <div className="mt-1 text-[8px] text-muted">Bar-by-bar · no lookahead · maximum 8 plots</div>
                </div>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                  {program.diagnostics.map((diagnostic, index) => (
                    <div key={`${diagnostic.line}-${index}`} className={`rounded-xl border p-3 ${diagnostic.severity === "error" ? "border-danger/20 bg-danger/[0.07]" : diagnostic.severity === "warning" ? "border-amber-400/20 bg-amber-400/[0.07]" : "border-primary/20 bg-primary/[0.06]"}`}>
                      <div className={`text-[8px] font-semibold uppercase tracking-[0.12em] ${diagnostic.severity === "error" ? "text-danger" : diagnostic.severity === "warning" ? "text-amber-300" : "text-primary"}`}>{diagnostic.severity} · line {diagnostic.line}</div>
                      <div className="mt-1.5 text-[9px] leading-4 text-foreground">{diagnostic.message}</div>
                    </div>
                  ))}
                  <div className="rounded-xl border border-border bg-surface/35 p-3 text-[8px] leading-4 text-muted">
                    Supported now: OHLCV, history references, arithmetic, ternaries, inputs, plot(), SMA, EMA, RMA, WMA, VWMA, RSI, ATR, highest/lowest, stdev, ROC, change, crossovers and basic math. TradingView libraries, request.security, strategies and drawing objects require manual migration.
                  </div>
                </div>
                <div className="space-y-2 border-t border-border p-3">
                  <button type="button" disabled={!draft || errors.length > 0} onClick={persistDraft} className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface text-[10px] font-semibold text-foreground hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-40">
                    <Save className="h-3.5 w-3.5" /> Save script
                  </button>
                  <button type="button" disabled={!draft || errors.length > 0} onClick={addToChart} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[10px] font-semibold text-background disabled:cursor-not-allowed disabled:opacity-40">
                    {selectedIsOnChart ? <Copy className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    {selectedIsOnChart ? "Update chart indicator" : "Save & add to chart"}
                  </button>
                  <button type="button" disabled={!draft} onClick={removeScript} className="flex h-8 w-full items-center justify-center gap-2 rounded-lg text-[9px] text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-40">
                    <Trash2 className="h-3.5 w-3.5" /> Delete script
                  </button>
                </div>
              </aside>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
