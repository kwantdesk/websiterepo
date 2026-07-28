"use client";

import KwantSelect from "@/components/ui/KwantSelect";

import { MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AppSidebar from "@/components/AppSidebar";
import {
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  BrainCircuit,
  CalendarDays,
  Check,
  Copy,
  FlaskConical,
  Repeat,
  Settings,
  Store,
  Trophy,
  User,
  Wallet,
} from "lucide-react";

type Language = "Pine Script v6" | "Python" | "C#/NinjaScript" | "MQL5" | "Kwantify JavaScript";

const languages: Language[] = [
  "Pine Script v6",
  "Python",
  "C#/NinjaScript",
  "MQL5",
  "Kwantify JavaScript",
];

function Sidebar() {
  return <AppSidebar activeItem="converter" />;
}

function lineNumbers(code: string) {
  return Array.from({ length: Math.max(1, code.split("\n").length) }, (_, index) => index + 1);
}

function extractCodeBlock(value: string) {
  return value.match(/```[\w#/+.-]*\n?([\s\S]*?)```/)?.[1]?.trim() ?? value.trim();
}

export default function ConverterPage() {
  const [inputLanguage, setInputLanguage] = useState<Language>("Pine Script v6");
  const [outputLanguage, setOutputLanguage] = useState<Language>("Kwantify JavaScript");
  const [inputCode, setInputCode] = useState("");
  const [outputCode, setOutputCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [leftWidth, setLeftWidth] = useState(50);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const inputLines = useMemo(() => lineNumbers(inputCode), [inputCode]);
  const outputLines = useMemo(() => lineNumbers(outputCode || error), [outputCode, error]);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (event: globalThis.MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const next = ((event.clientX - rect.left) / rect.width) * 100;
      setLeftWidth(Math.min(72, Math.max(28, next)));
    };

    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  async function convert() {
    if (!inputCode.trim() || loading) return;
    setLoading(true);
    setError("");
    setOutputCode("");

    try {
      const prompt = `Convert the following ${inputLanguage} code to ${outputLanguage}. Output ONLY the converted code in a code block, nothing else. Preserve all logic exactly. Add appropriate comments.\n\n${inputCode}`;
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Conversion failed");
      setOutputCode(extractCodeBlock(data.response ?? ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed");
    } finally {
      setLoading(false);
    }
  }

  async function copyOutput() {
    if (!outputCode) return;
    await navigator.clipboard.writeText(outputCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  function swap() {
    setInputLanguage(outputLanguage);
    setOutputLanguage(inputLanguage);
    setInputCode(outputCode);
    setOutputCode("");
    setError("");
  }

  function startDrag(event: MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(true);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-panel px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Repeat className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-[16px] font-semibold">Code Converter</h1>
              <p className="text-[12px] text-muted">Convert trading strategies between any language</p>
            </div>
          </div>
          <button onClick={swap} className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-[13px] text-muted transition-colors hover:bg-card hover:text-foreground">
            <ArrowLeftRight className="h-4 w-4 text-primary" />
            Swap
          </button>
        </header>

        <section ref={containerRef} className="relative flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-w-[280px] flex-col border-r border-border" style={{ width: `${leftWidth}%` }}>
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-panel px-4">
              <span className="text-[13px] font-semibold">Input</span>
              <KwantSelect value={inputLanguage} onChange={(event) => setInputLanguage(event.target.value as Language)} className="rounded-lg border border-border bg-surface px-3 py-1 text-[12px] text-muted outline-none">
                {languages.map((language) => <option key={language}>{language}</option>)}
              </KwantSelect>
            </div>
            <div className="flex min-h-0 flex-1 overflow-hidden bg-background font-mono text-[14px] leading-7">
              <div className="select-none border-r border-border bg-panel px-3 py-4 text-right text-muted">
                {inputLines.map((line) => <div key={line}>{line}</div>)}
              </div>
              <textarea
                value={inputCode}
                onChange={(event) => setInputCode(event.target.value)}
                placeholder="Paste your code here"
                spellCheck={false}
                className="min-w-0 flex-1 resize-none bg-transparent p-4 font-mono text-[14px] leading-7 text-foreground outline-none placeholder:text-muted"
              />
            </div>
          </div>

          <div onMouseDown={startDrag} className="relative z-10 w-2 shrink-0 cursor-col-resize bg-panel hover:bg-surface">
            <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
              <button onClick={(event) => { event.stopPropagation(); convert(); }} disabled={loading || !inputCode.trim()} className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-background shadow-2xl shadow-primary/20 transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40">
                <ArrowRight className="h-5 w-5" />
              </button>
              <span className="w-24 text-center text-[11px] text-muted">Powered by Kwantify AI</span>
            </div>
          </div>

          <div className="flex min-w-[280px] flex-1 flex-col" style={{ width: `${100 - leftWidth}%` }}>
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-panel px-4">
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-semibold">Output</span>
                <KwantSelect value={outputLanguage} onChange={(event) => setOutputLanguage(event.target.value as Language)} className="rounded-lg border border-border bg-surface px-3 py-1 text-[12px] text-muted outline-none">
                  {languages.map((language) => <option key={language}>{language}</option>)}
                </KwantSelect>
              </div>
              <button onClick={copyOutput} disabled={!outputCode} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground disabled:opacity-30" title="Copy output">
                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex min-h-0 flex-1 overflow-hidden bg-background font-mono text-[14px] leading-7">
              <div className="select-none border-r border-border bg-panel px-3 py-4 text-right text-muted">
                {outputLines.map((line) => <div key={line}>{line}</div>)}
              </div>
              <div className="min-w-0 flex-1 overflow-auto p-4">
                {loading ? (
                  <div className="flex h-full items-center justify-center gap-2">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                    <div className="h-2 w-2 animate-pulse rounded-full bg-primary [animation-delay:0.2s]" />
                    <div className="h-2 w-2 animate-pulse rounded-full bg-primary [animation-delay:0.4s]" />
                  </div>
                ) : error ? (
                  <pre className="whitespace-pre-wrap font-mono text-[14px] leading-7 text-danger">{error}</pre>
                ) : outputCode ? (
                  <pre className="whitespace-pre-wrap font-mono text-[14px] leading-7 text-foreground">{outputCode}</pre>
                ) : (
                  <div className="text-[14px] text-muted">Converted code will appear here</div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
