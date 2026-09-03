"use client";

import KwantSelect from "@/components/ui/KwantSelect";

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  BrainCircuit,
  CalendarDays,
  CheckCircle,
  FlaskConical,
  MoreHorizontal,
  Play,
  PlusCircle,
  Repeat,
  Settings,
  Store,
  Trophy,
  User,
  Wallet,
} from "lucide-react";
import { loadSavedStrategiesRaw, saveSavedStrategiesRaw } from "@/lib/automation";

type EditorStrategy = {
  id: string;
  name: string;
  code: string;
  language: string;
  addedToChart?: boolean;
  versions?: { code: string; timestamp: Date | string; version: number }[];
  currentVersion?: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

const emptyStrategy: EditorStrategy = {
  id: "new",
  name: "Untitled Strategy",
  language: "Python",
  code: "",
};

function normalizeEditorStrategy(strategy: EditorStrategy): EditorStrategy {
  const timestamp = strategy.updatedAt ?? new Date();
  const currentVersion = strategy.currentVersion ?? strategy.versions?.at(-1)?.version ?? 1;
  return {
    ...strategy,
    versions: strategy.versions?.length ? strategy.versions : [{ code: strategy.code, timestamp, version: currentVersion }],
    currentVersion,
    createdAt: strategy.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

function Sidebar() {
  const itemBase = "mx-2 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg transition-all duration-300 group-hover:w-[184px] group-hover:justify-start group-hover:gap-3 group-hover:px-[9px]";
  const inactive = `${itemBase} text-muted hover:text-foreground hover:bg-surface`;
  const label = "translate-x-[-6px] overflow-hidden whitespace-nowrap text-[13px] font-medium opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100";

  return (
    <div className="relative z-20 w-[52px] shrink-0 self-stretch">
    <aside className="group sticky top-0 z-20 flex h-screen w-[52px] flex-col items-start gap-1 overflow-hidden border-r border-border bg-panel py-5 transition-all duration-300 hover:w-[200px]">
      <button className={`${inactive} mb-4`} title="Account"><User className="w-[18px] h-[18px] shrink-0" /><span className={label}>Account</span></button>
      <Link href="/ai" className={inactive} title="AI Strategy Builder"><Bot className="w-[18px] h-[18px] shrink-0" /><span className={label}>AI Builder</span></Link>
      <Link href="/agent" className={inactive} title="AI Trading Agent"><BrainCircuit className="w-[18px] h-[18px] shrink-0" /><span className={label}>Trading Agent</span></Link>
      <Link href="/" className={inactive} title="Charts"><BarChart3 className="w-[18px] h-[18px] shrink-0" /><span className={label}>Charts</span></Link>
      <Link href="/journal" className={inactive} title="Journal"><BookOpen className="w-[18px] h-[18px] shrink-0" /><span className={label}>Journal</span></Link>
      <Link href="/converter" className={inactive} title="Code Converter"><Repeat className="w-[18px] h-[18px] shrink-0" /><span className={label}>Converter</span></Link>
      <Link href="/news" className={inactive} title="Market Intelligence"><CalendarDays className="w-[18px] h-[18px] shrink-0" /><span className={label}>News</span></Link>
      <Link href="/alerts" className={inactive} title="Alerts"><Bell className="w-[18px] h-[18px] shrink-0" /><span className={label}>Alerts</span></Link>
      <Link href="/vault" className={inactive} title="The Vault"><Store className="w-[18px] h-[18px] shrink-0" /><span className={label}>Vault</span></Link>
      <Link href="/leaderboard" className={inactive} title="Leaderboard"><Trophy className="w-[18px] h-[18px] shrink-0" /><span className={label}>Leaderboard</span></Link>
      <Link href="/lab" className={inactive} title="The Strategy Lab"><FlaskConical className="w-[18px] h-[18px] shrink-0" /><span className={label}>Lab</span></Link>
      <Link href="/accounts" className={inactive} title="Accounts"><Wallet className="w-[18px] h-[18px] shrink-0" /><span className={label}>Accounts</span></Link>
      <div className="flex-1" />
      <button onClick={() => { window.location.href = "/settings"; }} className={inactive} title="Settings"><Settings className="w-[18px] h-[18px] shrink-0" /><span className={label}>Settings</span></button>
    </aside>
    </div>
  );
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlight(code: string) {
  return escapeHtml(code)
    .split("\n")
    .map((line) => {
      if (line.trim().startsWith("#")) return `<span class="text-muted">${line || " "}</span>`;
      return (line || " ")
        .replace(/("[^"]*"|'[^']*')/g, '<span class="text-secondary">$1</span>')
        .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="text-primary">$1</span>')
        .replace(/\b(def|if|return|and|or|not|in|for|while|else|elif|None|True|False)\b/g, '<span class="text-accent">$1</span>');
    })
    .join("\n");
}

export default function EditorPage() {
  const [strategy, setStrategy] = useState<EditorStrategy>(emptyStrategy);
  const [savedCode, setSavedCode] = useState("");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"Saved" | "Saving..." | "Unsaved changes">("Saved");
  const [editingName, setEditingName] = useState(false);
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("strategy");
    const saved = JSON.parse(loadSavedStrategiesRaw() || "[]") as EditorStrategy[];
    const synced = id ? saved.find((item) => item.id === id) : null;
    const stored = synced ? JSON.stringify(synced) : (id && sessionStorage.getItem(`olisa-editor-strategy-${id}`)) || sessionStorage.getItem("olisa-editor-strategy");
    if (!stored) {
      setHasLoaded(true);
      return;
    }

    try {
      const parsed = normalizeEditorStrategy({ ...emptyStrategy, ...JSON.parse(stored) as EditorStrategy });
      setStrategy(parsed);
      setSavedCode(parsed.code ?? "");
    } catch {
      setStrategy(emptyStrategy);
    } finally {
      setHasLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (strategy.code === savedCode) {
      setSaveStatus("Saved");
      return;
    }

    setSaveStatus("Unsaved changes");
    const timer = window.setTimeout(() => {
      setSaveStatus("Saving...");
      window.setTimeout(() => {
        saveStrategy(strategy);
        setSavedCode(strategy.code);
        setSaveStatus("Saved");
      }, 400);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [savedCode, strategy]);

  const highlighted = useMemo(() => highlight(strategy.code), [strategy.code]);
  const lines = strategy.code.split("\n");

  function saveStrategy(next = strategy) {
    const normalized = normalizeEditorStrategy({ ...next, updatedAt: new Date() });
    sessionStorage.setItem("olisa-editor-strategy", JSON.stringify(normalized));
    sessionStorage.setItem(`olisa-editor-strategy-${normalized.id}`, JSON.stringify(normalized));

    const saved = JSON.parse(loadSavedStrategiesRaw() || "[]") as EditorStrategy[];
    const exists = saved.some((item) => item.id === normalized.id);
    const synced = exists ? saved.map((item) => item.id === normalized.id ? normalized : item) : [...saved, normalized];
    saveSavedStrategiesRaw(JSON.stringify(synced));
  }

  function saveNow() {
    saveStrategy();
    setSavedCode(strategy.code);
    setSaveStatus("Saved");
  }

  function updateCursor() {
    const el = textareaRef.current;
    if (!el) return;
    const before = strategy.code.slice(0, el.selectionStart);
    const split = before.split("\n");
    setCursor({ line: split.length, col: split[split.length - 1].length + 1 });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const nextCode = `${strategy.code.slice(0, start)}    ${strategy.code.slice(end)}`;
    setStrategy((current) => ({ ...current, code: nextCode }));
    requestAnimationFrame(() => {
      el.selectionStart = start + 4;
      el.selectionEnd = start + 4;
      updateCursor();
    });
  }

  function runBacktest() {
    saveStrategy();
    sessionStorage.setItem("backtest-code", strategy.code);
    sessionStorage.setItem("run-backtest", "true");
    sessionStorage.setItem("olisa-run-backtest", strategy.id);
    window.location.href = "/";
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#09090B] text-foreground">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="h-14 shrink-0 border-b border-border bg-panel flex items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            {editingName ? (
              <input
                value={strategy.name}
                onChange={(e) => setStrategy((current) => ({ ...current, name: e.target.value }))}
                onBlur={() => setEditingName(false)}
                autoFocus
                className="w-[280px] rounded-lg border border-border bg-surface px-3 py-1.5 text-[15px] font-semibold outline-none focus:border-primary/40"
              />
            ) : (
              <button onClick={() => setEditingName(true)} className="truncate text-[15px] font-semibold">{strategy.name}</button>
            )}
            <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-muted">{strategy.language}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={saveNow} className="rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-on-primary">Save</button>
            <button onClick={runBacktest} className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-[13px] hover:bg-card"><Play className="h-4 w-4 text-primary" />Run Backtest</button>
            <button
              onClick={() => setStrategy((current) => ({ ...current, addedToChart: !current.addedToChart }))}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-[13px] ${strategy.addedToChart ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-surface text-muted hover:text-foreground"}`}
            >
              {strategy.addedToChart ? <CheckCircle className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
              {strategy.addedToChart ? "On Chart" : "Add to Chart"}
            </button>
            <button className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted hover:bg-card hover:text-foreground">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </header>

        <section className="flex min-h-0 flex-1 overflow-hidden bg-[#09090B]">
          <div className="w-10 shrink-0 select-none border-r border-border bg-panel py-4 text-right font-mono text-[13px] leading-7 text-muted">
            {lines.map((_, index) => <div key={index} className="pr-2">{index + 1}</div>)}
          </div>
          <div className="relative min-w-0 flex-1 overflow-hidden">
            {hasLoaded && !strategy.code.trim() ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#09090B]/90">
                <p className="max-w-md px-6 text-center text-[15px] text-muted">Create or import your first strategy.</p>
              </div>
            ) : null}
            <pre className="pointer-events-none absolute inset-0 overflow-auto whitespace-pre-wrap p-4 font-mono text-[14px] leading-7" dangerouslySetInnerHTML={{ __html: highlighted }} />
            <textarea
              ref={textareaRef}
              value={strategy.code}
              onChange={(e) => {
                setStrategy((current) => ({ ...current, code: e.target.value }));
                updateCursor();
              }}
              onClick={updateCursor}
              onKeyUp={updateCursor}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              className="absolute inset-0 resize-none overflow-auto bg-transparent p-4 font-mono text-[14px] leading-7 text-transparent caret-primary outline-none selection:bg-primary/20"
            />
          </div>
        </section>

        <footer className="flex h-9 shrink-0 items-center justify-between border-t border-border bg-panel px-4 text-[12px] text-muted">
          <div className="flex items-center gap-4">
            <KwantSelect value={strategy.language} onChange={(e) => setStrategy((current) => ({ ...current, language: e.target.value }))} className="rounded-lg border border-border bg-surface px-2 py-1 text-[12px] text-muted outline-none">
              <option>Python</option>
              <option>Pine Script</option>
              <option>Kwantify</option>
              <option>MQL5</option>
            </KwantSelect>
            <span>Ln {cursor.line}, Col {cursor.col}</span>
          </div>
          <div className="flex items-center gap-4">
            <span>{saveStatus}</span>
            <span>{strategy.code.length.toLocaleString()} chars</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
