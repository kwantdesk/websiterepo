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
import {
  inferSourceLanguageFromFileName,
  prepareSourceIndicator,
  sourceIndicatorLanguageLabel,
  type SourceIndicatorLanguage,
} from "@/lib/indicatorSourceAdapters";

const SOURCE_INDICATOR_STORAGE_KEY = "kwantdesk-source-code-indicators:v1";
const SOURCE_INDICATOR_ID = "source-code-indicator";
const LANGUAGE_OPTIONS: Array<{ value: SourceIndicatorLanguage; label: string }> = [
  { value: "auto", label: "Auto detect" },
  { value: "pine", label: "Pine" },
  { value: "thinkscript", label: "thinkScript" },
  { value: "easylanguage", label: "EasyLanguage" },
];
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
  language: SourceIndicatorLanguage;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  instrument: string;
  timeframe: string;
  indicators: ChartIndicatorInstance[];
  onChange: (next: ChartIndicatorInstance[]) => void;
};

function newScript(
  source = STARTER_SOURCE,
  language: SourceIndicatorLanguage = "auto",
  importedName?: string,
): SavedSourceIndicator {
  const now = new Date().toISOString();
  const prepared = prepareSourceIndicator(source, language);
  return {
    id: crypto.randomUUID(),
    name: importedName || prepared.program.name || "Untitled indicator",
    source,
    language,
    createdAt: now,
    updatedAt: now,
  };
}

function readScripts() {
  if (typeof window === "undefined") return [] as SavedSourceIndicator[];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SOURCE_INDICATOR_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((value): SavedSourceIndicator[] => {
      if (!value || typeof value !== "object") return [];
      const record = value as Partial<SavedSourceIndicator>;
      if (typeof record.id !== "string" || typeof record.name !== "string" || typeof record.source !== "string") return [];
      return [{
        id: record.id,
        name: record.name,
        source: record.source,
        language: record.language === "pine" || record.language === "thinkscript" || record.language === "easylanguage" ? record.language : "auto",
        createdAt: typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString(),
        updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : new Date().toISOString(),
      }];
    });
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
  const prepared = useMemo(
    () => prepareSourceIndicator(draft?.source ?? "", draft?.language ?? "auto"),
    [draft?.language, draft?.source],
  );
  const program = prepared.program;
  const errors = prepared.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const selectedIsOnChart = draft
    ? indicators.some((instance) =>
        instance.settings?.scriptId === draft.id || instance.settings?.sourceScriptId === draft.id)
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
      instance.settings?.scriptId === script.id || instance.settings?.sourceScriptId === script.id);
    const nextInstance: ChartIndicatorInstance = prepared.nativeAdapter ? {
      instanceId: existing?.instanceId ?? `${prepared.nativeAdapter.indicatorId}-${crypto.randomUUID()}`,
      indicatorId: prepared.nativeAdapter.indicatorId,
      enabled: true,
      settings: {
        ...prepared.nativeAdapter.settings,
        sourceScriptId: script.id,
        sourceScriptName: script.name,
        sourceLanguage: prepared.language,
        sourceAdapter: prepared.nativeAdapter.id,
      },
    } : {
      instanceId: existing?.instanceId ?? `${SOURCE_INDICATOR_ID}-${crypto.randomUUID()}`,
      indicatorId: SOURCE_INDICATOR_ID,
      enabled: true,
      settings: {
        source: script.source,
        scriptId: script.id,
        scriptName: script.name,
        sourceLanguage: prepared.language,
        pineVersion: program.version,
        overlay: program.overlay,
      },
    };
    onChange([
      ...indicators.filter((instance) =>
        instance.settings?.scriptId !== script.id && instance.settings?.sourceScriptId !== script.id),
      nextInstance,
    ]);
  };

  const removeScript = () => {
    if (!draft) return;
    const nextScripts = scripts.filter((script) => script.id !== draft.id);
    const nextIndicators = indicators.filter((instance) =>
      instance.settings?.scriptId !== draft.id && instance.settings?.sourceScriptId !== draft.id);
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
    const language = inferSourceLanguageFromFileName(file.name);
    const fileName = file.name.replace(/\.[^.]+$/, "");
    const imported = newScript(source, language, fileName);
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
        className="kwant-chart-row-control flex h-7 items-center gap-1.5 rounded-[3px] border border-border bg-surface/50 px-2.5 text-[10px] font-semibold uppercase tracking-[0.075em] text-muted transition-colors hover:border-primary/25 hover:text-foreground"
        title="Create or import Pine, thinkScript and EasyLanguage indicators"
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
                <div className="mt-0.5 text-[9px] uppercase tracking-[0.14em] text-muted">Multi-language compatibility sandbox · {instrument} · {timeframe}</div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button type="button" onClick={createScript} className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[10px] text-foreground hover:border-primary/30">
                  <Plus className="h-3.5 w-3.5" /> New
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[10px] text-foreground hover:border-primary/30">
                  <Upload className="h-3.5 w-3.5" /> Import code
                </button>
                <input ref={fileInputRef} type="file" accept=".pine,.thinkscript,.think,.ts,.eld,.els,.el,.txt,text/plain" className="hidden" onChange={(event) => void importFile(event.target.files?.[0])} />
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
                    const onChart = indicators.some((instance) =>
                      instance.settings?.scriptId === script.id || instance.settings?.sourceScriptId === script.id);
                    return (
                      <button key={script.id} type="button" onClick={() => selectScript(script)} className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${active ? "border-primary/25 bg-primary/10" : "border-transparent hover:border-border hover:bg-surface/50"}`}>
                        <div className={`truncate text-[10px] font-semibold ${active ? "text-primary" : "text-foreground"}`}>{script.name}</div>
                        <div className="mt-1 flex items-center justify-between text-[8px] text-muted">
                          <span>{script.language === "auto" ? "AUTO" : script.language === "thinkscript" ? "THINK" : script.language === "easylanguage" ? "EASY" : "PINE"} · {new Date(script.updatedAt).toLocaleDateString()}</span>
                          {onChart ? <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-primary">ON CHART</span> : null}
                        </div>
                      </button>
                    );
                  }) : (
                    <div className="px-3 py-8 text-center text-[9px] leading-4 text-muted">Create or import a Pine, thinkScript or EasyLanguage indicator.</div>
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
                <div className="flex min-h-[54px] shrink-0 items-center gap-3 border-b border-border px-4">
                  <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-2">
                    {LANGUAGE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setDraft((current) => current ? { ...current, language: option.value } : current)}
                        className={`h-7 shrink-0 rounded-lg border px-2.5 text-[8px] font-semibold transition-colors ${draft?.language === option.value ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-surface/35 text-muted hover:text-foreground"}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-[8px] font-semibold ${errors.length ? "border-danger/20 bg-danger/10 text-danger" : "border-primary/20 bg-primary/10 text-primary"}`}>
                    {errors.length ? <AlertTriangle className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                    {errors.length
                      ? `${errors.length} error${errors.length === 1 ? "" : "s"}`
                      : prepared.nativeAdapter
                        ? "Native profile ready"
                        : `${sourceIndicatorLanguageLabel(prepared.language)} ready`}
                  </div>
                </div>
                <textarea
                  spellCheck={false}
                  value={draft?.source ?? ""}
                  onChange={(event) => setDraft((current) => current ? { ...current, source: event.target.value } : newScript(event.target.value))}
                  className="min-h-0 flex-1 resize-none bg-[#050606] px-5 py-4 font-mono text-[12px] leading-6 text-[#edf7ef] outline-none selection:bg-primary/25"
                  aria-label="Indicator source code editor"
                />
                {dragging ? (
                  <div className="pointer-events-none absolute inset-20 z-10 flex items-center justify-center rounded-3xl border border-dashed border-primary bg-background/85 text-[12px] font-semibold text-primary backdrop-blur-sm">Drop indicator source to import</div>
                ) : null}
              </main>

              <aside className="flex w-[300px] shrink-0 flex-col border-l border-border bg-background/20">
                <div className="border-b border-border px-4 py-3">
                  <div className="text-[10px] font-semibold text-foreground">Compile diagnostics</div>
                  <div className="mt-1 text-[8px] text-muted">Bar-by-bar · no lookahead · maximum 8 plots</div>
                </div>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                  {prepared.diagnostics.map((diagnostic, index) => (
                    <div key={`${diagnostic.line}-${index}`} className={`rounded-xl border p-3 ${diagnostic.severity === "error" ? "border-danger/20 bg-danger/[0.07]" : diagnostic.severity === "warning" ? "border-amber-400/20 bg-amber-400/[0.07]" : "border-primary/20 bg-primary/[0.06]"}`}>
                      <div className={`text-[8px] font-semibold uppercase tracking-[0.12em] ${diagnostic.severity === "error" ? "text-danger" : diagnostic.severity === "warning" ? "text-amber-300" : "text-primary"}`}>{diagnostic.severity} · line {diagnostic.line}</div>
                      <div className="mt-1.5 text-[9px] leading-4 text-foreground">{diagnostic.message}</div>
                    </div>
                  ))}
                  <div className="rounded-xl border border-border bg-surface/35 p-3 text-[8px] leading-4 text-muted">
                    Supported across adapters: OHLCV, history references, inputs, arithmetic, conditional expressions, plots, SMA, EMA, Wilder/RMA, WMA, RSI, ATR, highest/lowest, standard deviation, ROC and basic math. Orders, external data, platform libraries, arbitrary C#/JavaScript and complex drawing objects are never executed.
                  </div>
                </div>
                <div className="space-y-2 border-t border-border p-3">
                  <button type="button" disabled={!draft || errors.length > 0} onClick={persistDraft} className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface text-[10px] font-semibold text-foreground hover:border-primary/30 disabled:cursor-not-allowed disabled:opacity-40">
                    <Save className="h-3.5 w-3.5" /> Save script
                  </button>
                  <button type="button" disabled={!draft || errors.length > 0} onClick={addToChart} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[10px] font-semibold text-background disabled:cursor-not-allowed disabled:opacity-40">
                    {selectedIsOnChart ? <Copy className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    {selectedIsOnChart
                      ? "Update chart indicator"
                      : prepared.nativeAdapter
                        ? "Save & add native profile"
                        : "Save & add to chart"}
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
