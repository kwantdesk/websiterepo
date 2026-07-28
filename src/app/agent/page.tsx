"use client";

import KwantSelect from "@/components/ui/KwantSelect";

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AppSidebar from "@/components/AppSidebar";
import {
  ArrowUp,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  BrainCircuit,
  CalendarDays,
  Check,
  FlaskConical,
  Minus,
  Plus,
  Repeat,
  Settings,
  Store,
  Trophy,
  User,
  Wallet,
} from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };
type EmotionId = "frustrated" | "anxious" | "neutral" | "focused" | "calm";
type Goal = { id: string; text: string; done: boolean };
type Trade = {
  id: string;
  instrument: string;
  direction: "Long" | "Short";
  entry: string;
  stopLoss: string;
  takeProfit: string;
  result: "Open" | "Win" | "Loss";
  pnl: string;
  notes: string;
  time: string;
};

const emotions: { id: EmotionId; label: string; emoji: string; className: string }[] = [
  { id: "frustrated", label: "Frustrated", emoji: "😤", className: "border-red-500/30 bg-red-500/10 text-red-300" },
  { id: "anxious", label: "Anxious", emoji: "😰", className: "border-orange-500/30 bg-orange-500/10 text-orange-300" },
  { id: "neutral", label: "Neutral", emoji: "😐", className: "border-border bg-surface text-muted" },
  { id: "focused", label: "Focused", emoji: "🎯", className: "border-blue-500/30 bg-blue-500/10 text-blue-300" },
  { id: "calm", label: "Calm", emoji: "😌", className: "border-primary/30 bg-primary/10 text-primary" },
];

const AGENT_STORAGE_PREFIX = "kwantify-agent";
const LOCAL_AGENT_ACCOUNT_ID = "local-default";

function Sidebar() {
  return <AppSidebar activeItem="agent" />;
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderMessage(content: string) {
  const parts = content.split(/```([\s\S]*?)```/g);
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <pre key={index} className="my-3 overflow-x-auto rounded-xl border border-border bg-background p-4 font-mono text-[12px] leading-6 text-primary/90">
        <code>{part.trim()}</code>
      </pre>
    ) : (
      <span key={index} className="whitespace-pre-wrap">{part}</span>
    )
  );
}

export default function AgentPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [selectedEmotion, setSelectedEmotion] = useState<EmotionId>("neutral");
  const [emotionHistory, setEmotionHistory] = useState<{ emotion: EmotionId; label: string; time: string }[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [newGoal, setNewGoal] = useState("");
  const [sessionStartedAt, setSessionStartedAt] = useState<Date | null>(null);
  const [now, setNow] = useState(new Date());
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradeForm, setTradeForm] = useState({
    instrument: "NAS100",
    direction: "Long" as "Long" | "Short",
    entry: "",
    stopLoss: "",
    takeProfit: "",
    result: "Open" as "Open" | "Win" | "Loss",
    pnl: "",
    notes: "",
  });
  const chatEndRef = useRef<HTMLDivElement>(null);

  function storageKey(suffix: string) {
    return `${AGENT_STORAGE_PREFIX}:${LOCAL_AGENT_ACCOUNT_ID}:${suffix}`;
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      const rawMessages = window.localStorage.getItem(storageKey("messages"));
      const rawEmotion = window.localStorage.getItem(storageKey("selectedEmotion"));
      const rawEmotionHistory = window.localStorage.getItem(storageKey("emotionHistory"));
      const rawGoals = window.localStorage.getItem(storageKey("goals"));
      const rawTrades = window.localStorage.getItem(storageKey("trades"));
      const rawSessionStartedAt = window.localStorage.getItem(storageKey("sessionStartedAt"));

      if (rawMessages) {
        const parsed = JSON.parse(rawMessages) as Message[];
        if (Array.isArray(parsed)) setMessages(parsed);
      }
      if (rawEmotion === "frustrated" || rawEmotion === "anxious" || rawEmotion === "neutral" || rawEmotion === "focused" || rawEmotion === "calm") {
        setSelectedEmotion(rawEmotion);
      }
      if (rawEmotionHistory) {
        const parsed = JSON.parse(rawEmotionHistory) as { emotion: EmotionId; label: string; time: string }[];
        if (Array.isArray(parsed)) setEmotionHistory(parsed);
      }
      if (rawGoals) {
        const parsed = JSON.parse(rawGoals) as Goal[];
        if (Array.isArray(parsed)) setGoals(parsed);
      }
      if (rawTrades) {
        const parsed = JSON.parse(rawTrades) as Trade[];
        if (Array.isArray(parsed)) setTrades(parsed);
      }
      if (rawSessionStartedAt) {
        const parsed = new Date(rawSessionStartedAt);
        if (!Number.isNaN(parsed.getTime())) setSessionStartedAt(parsed);
      }
    } catch {
      // Ignore local persistence issues and fall back to fresh state.
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    window.localStorage.setItem(storageKey("messages"), JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    window.localStorage.setItem(storageKey("selectedEmotion"), selectedEmotion);
  }, [selectedEmotion]);

  useEffect(() => {
    window.localStorage.setItem(storageKey("emotionHistory"), JSON.stringify(emotionHistory));
  }, [emotionHistory]);

  useEffect(() => {
    window.localStorage.setItem(storageKey("goals"), JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    window.localStorage.setItem(storageKey("trades"), JSON.stringify(trades));
  }, [trades]);

  useEffect(() => {
    if (sessionStartedAt) {
      window.localStorage.setItem(storageKey("sessionStartedAt"), sessionStartedAt.toISOString());
    } else {
      window.localStorage.removeItem(storageKey("sessionStartedAt"));
    }
  }, [sessionStartedAt]);

  const stats = useMemo(() => {
    const wins = trades.filter((trade) => trade.result === "Win").length;
    const losses = trades.filter((trade) => trade.result === "Loss").length;
    const pnl = trades.reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0);
    const openRisk = trades.filter((trade) => trade.result === "Open").length;
    const doneGoals = goals.filter((goal) => goal.done).length;
    const elapsedMs = sessionStartedAt ? now.getTime() - sessionStartedAt.getTime() : 0;
    const hours = Math.max(0, Math.floor(elapsedMs / 3600000));
    const minutes = Math.max(0, Math.floor((elapsedMs % 3600000) / 60000));
    return { wins, losses, pnl, openRisk, doneGoals, elapsed: `${hours}h ${minutes}m` };
  }, [goals, now, sessionStartedAt, trades]);

  const context = useMemo(() => {
    const latestEmotion = emotionHistory[0]?.label || "Neutral";
    return [
      `Trader memory scope: ${LOCAL_AGENT_ACCOUNT_ID}`,
      `Emotion: ${latestEmotion}`,
      `Emotion history: ${emotionHistory.map((item) => `${item.time} ${item.label}`).join(" | ") || "None yet"}`,
      `Goals: ${goals.map((goal) => `${goal.done ? "[done]" : "[open]"} ${goal.text}`).join("; ")}`,
      `Trades taken: ${trades.length}`,
      `Wins/Losses: ${stats.wins}/${stats.losses}`,
      `Session P&L: $${stats.pnl.toFixed(2)}`,
      `Open risk exposure: ${stats.openRisk}%`,
      `Session started at: ${sessionStartedAt ? sessionStartedAt.toISOString() : "Not started yet"}`,
      `Recent trades: ${trades.slice(0, 5).map((trade) => `${trade.time} ${trade.direction} ${trade.instrument} ${trade.result} P&L ${trade.pnl || "0"}`).join("; ") || "None yet"}`,
    ].join("\n");
  }, [emotionHistory, goals, sessionStartedAt, stats.losses, stats.openRisk, stats.pnl, stats.wins, trades]);

  async function sendAgentMessage(content: string) {
    if (!content.trim() || loading) return;
    const nextMessages: Message[] = [...messages, { role: "user", content: content.trim() }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: LOCAL_AGENT_ACCOUNT_ID, messages: nextMessages, context }),
      });
      const data = await response.json();
      setMessages([...nextMessages, { role: "assistant", content: data.response || data.error || "I couldn't respond just now. Take a breath and try again." }]);
    } catch {
      setMessages([...nextMessages, { role: "assistant", content: "Connection dropped. Pause for a moment, then send that again." }]);
    } finally {
      setLoading(false);
    }
  }

  function startTradingSession() {
    setSessionStartedAt(new Date());
    setPaused(false);
    setMinimized(false);
    setMessages([
      {
        role: "assistant",
        content: [
          "Let's start your pre-trade checklist.",
          "",
          "1. What instrument are you trading today?",
          "2. What's your maximum risk for today? (e.g. 2% of account)",
          "3. What's the market looking like? Trending, ranging, or volatile?",
          "4. What setups are you looking for today?",
          "5. Any high-impact news events to be aware of?",
          "6. How are you feeling? Rate 1-5, or use the emotion tracker.",
          "",
          "Once you answer those, you're set. I'll be here to keep you accountable. Let me know when you see a setup.",
        ].join("\n"),
      },
    ]);
  }

  function reviewPlan() {
    sendAgentMessage("Review my plan for today. Ask me what I need before I start trading.");
  }

  function quickEmotionalCheck() {
    setMessages((current) => [
      ...current,
      { role: "assistant", content: "Quick emotional check: choose how you're feeling on the right, then rate your discipline from 1-5. If you're below a 3, we slow down before any trade." },
    ]);
  }

  function selectEmotion(emotionId: EmotionId) {
    const emotion = emotions.find((item) => item.id === emotionId);
    if (!emotion) return;
    setSelectedEmotion(emotionId);
    setEmotionHistory((history) => [{ emotion: emotionId, label: emotion.label, time: formatTime() }, ...history].slice(0, 6));
  }

  function addGoal() {
    if (!newGoal.trim()) return;
    setGoals((current) => [...current, { id: crypto.randomUUID(), text: newGoal.trim(), done: false }]);
    setNewGoal("");
  }

  function logTrade() {
    if (!tradeForm.entry.trim()) return;
    setTrades((current) => [
      {
        id: crypto.randomUUID(),
        instrument: tradeForm.instrument,
        direction: tradeForm.direction,
        entry: tradeForm.entry,
        stopLoss: tradeForm.stopLoss,
        takeProfit: tradeForm.takeProfit,
        result: tradeForm.result,
        pnl: tradeForm.pnl,
        notes: tradeForm.notes,
        time: formatTime(),
      },
      ...current,
    ]);
    setTradeForm({ instrument: tradeForm.instrument, direction: tradeForm.direction, entry: "", stopLoss: "", takeProfit: "", result: "Open", pnl: "", notes: "" });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendAgentMessage(input);
    }
  }

  return (
    <main className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <section className="flex min-w-0 flex-1">
        <div className="flex w-[60%] min-w-[520px] flex-col border-r border-border bg-background">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-panel/80 px-6 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                <BrainCircuit className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-[15px] font-semibold">AI Trading Agent</h1>
                <div className="mt-1 flex items-center gap-2 text-[12px] text-muted">
                  <span className={`h-2 w-2 rounded-full ${paused ? "bg-muted" : "bg-primary shadow-[0_0_12px_rgba(0,245,160,0.6)]"}`} />
                  {paused ? "Paused" : "Active"}
                </div>
              </div>
            </div>
            <button onClick={() => { setMinimized((value) => !value); setPaused((value) => !value); }} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:text-foreground" title="Minimize">
              <Minus className="h-4 w-4" />
            </button>
          </header>

          {minimized ? (
            <div className="flex flex-1 items-center justify-center p-8">
              <button onClick={() => { setMinimized(false); setPaused(false); }} className="rounded-2xl border border-primary/20 bg-primary/10 px-6 py-4 text-sm font-semibold text-primary">
                Restore AI Trading Agent
              </button>
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto px-6">
                {messages.length === 0 ? (
                  <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center py-16 text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-[28px] border border-primary/20 bg-primary/10">
                      <BrainCircuit className="h-10 w-10 text-primary" />
                    </div>
                    <h2 className="mt-6 text-3xl font-semibold">Your AI Trading Coach</h2>
                    <p className="mt-3 max-w-xl text-[14px] leading-6 text-muted">
                      I&apos;ll help you stay disciplined, follow your plan, and make better decisions. Tell me what you&apos;re trading today.
                    </p>
                    <div className="mt-8 grid w-full grid-cols-1 gap-3 md:grid-cols-3">
                      <button onClick={startTradingSession} className="rounded-2xl border border-primary/20 bg-primary/10 p-4 text-left text-[13px] font-semibold text-primary transition hover:border-primary/40">Start Trading Session</button>
                      <button onClick={reviewPlan} className="rounded-2xl border border-border bg-surface p-4 text-left text-[13px] font-semibold text-foreground transition hover:border-primary/30">Review My Plan</button>
                      <button onClick={quickEmotionalCheck} className="rounded-2xl border border-border bg-surface p-4 text-left text-[13px] font-semibold text-foreground transition hover:border-primary/30">Quick Emotional Check</button>
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto max-w-4xl space-y-6 py-8">
                    {messages.map((message, index) =>
                      message.role === "user" ? (
                        <div key={index} className="flex justify-end">
                          <div className="max-w-[72%] rounded-2xl bg-surface px-4 py-3 text-[14px] leading-7">{renderMessage(message.content)}</div>
                        </div>
                      ) : (
                        <div key={index} className="flex justify-start gap-3">
                          <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10"><BrainCircuit className="h-4 w-4 text-primary" /></div>
                          <div className="max-w-[78%] rounded-2xl border border-border bg-panel px-4 py-3 text-[14px] leading-7 text-muted">{renderMessage(message.content)}</div>
                        </div>
                      )
                    )}
                    {loading && <div className="flex items-center gap-2 text-[13px] text-muted"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" />Coach is thinking...</div>}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>
              <div className="shrink-0 border-t border-border bg-panel/80 p-4">
                <div className="mx-auto flex max-w-4xl items-end gap-3 rounded-2xl border border-border bg-background p-3">
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Tell your coach what you're seeing, feeling, or planning..."
                    rows={1}
                    className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[14px] outline-none placeholder:text-muted"
                  />
                  <button onClick={() => sendAgentMessage(input)} disabled={!input.trim() || loading} className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-black transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40">
                    <ArrowUp className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <aside className="min-w-[380px] flex-1 overflow-y-auto bg-background p-5">
          <div className="space-y-5">
            <section className="rounded-2xl border border-border bg-panel p-5">
              <h2 className="text-[15px] font-semibold">How are you feeling?</h2>
              <div className="mt-4 grid grid-cols-5 gap-2">
                {emotions.map((emotion) => (
                  <button key={emotion.id} onClick={() => selectEmotion(emotion.id)} className={`rounded-xl border px-2 py-3 text-center text-[12px] transition ${emotion.className} ${selectedEmotion === emotion.id ? "ring-1 ring-primary/60" : "opacity-80 hover:opacity-100"}`}>
                    <div className="text-lg">{emotion.emoji}</div>
                    <div className="mt-1 truncate">{emotion.label}</div>
                  </button>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-border bg-background p-3 text-[12px] text-muted">
                {emotionHistory.length ? emotionHistory.map((item) => `${item.time} — ${item.label}`).join(" | ") : "No emotion logs yet"}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-panel p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold">Today&apos;s Goals</h2>
                <button onClick={addGoal} className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] text-muted hover:text-foreground"><Plus className="h-3.5 w-3.5" />Add Goal</button>
              </div>
              <div className="mt-4 space-y-3">
                {goals.map((goal) => (
                  <label key={goal.id} className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2">
                    <button type="button" onClick={() => setGoals((current) => current.map((item) => item.id === goal.id ? { ...item, done: !item.done } : item))} className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${goal.done ? "border-primary bg-primary text-black" : "border-border text-transparent"}`}>
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <input value={goal.text} onChange={(event) => setGoals((current) => current.map((item) => item.id === goal.id ? { ...item, text: event.target.value } : item))} className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
                  </label>
                ))}
                <input value={newGoal} onChange={(event) => setNewGoal(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addGoal(); }} placeholder="Add a new rule or goal..." className="w-full rounded-xl border border-dashed border-border bg-background px-3 py-2 text-[13px] outline-none placeholder:text-muted" />
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-panel p-5">
              <h2 className="text-[15px] font-semibold">Session Stats</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  ["Trades taken", trades.length],
                  ["Wins / Losses", `${stats.wins} / ${stats.losses}`],
                  ["Session P&L", `$${stats.pnl.toFixed(2)}`],
                  ["Time in session", stats.elapsed],
                  ["Current risk exposure", `${stats.openRisk}%`],
                  ["Rules followed", `${stats.doneGoals}/${goals.length}`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-border bg-background p-3">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted">{label}</div>
                    <div className="mt-2 font-mono text-[18px] text-foreground">{value}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-panel p-5">
              <h2 className="text-[15px] font-semibold">Log a Trade</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <KwantSelect value={tradeForm.instrument} onChange={(event) => setTradeForm({ ...tradeForm, instrument: event.target.value })} className="rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none">
                  {["NAS100", "XAUUSD", "EURUSD", "GBPUSD", "BTCUSD", "GER40"].map((item) => <option key={item}>{item}</option>)}
                </KwantSelect>
                <div className="flex rounded-xl border border-border bg-background p-1">
                  {(["Long", "Short"] as const).map((direction) => <button key={direction} onClick={() => setTradeForm({ ...tradeForm, direction })} className={`flex-1 rounded-lg py-1.5 text-[12px] font-semibold ${tradeForm.direction === direction ? "bg-primary/10 text-primary" : "text-muted"}`}>{direction}</button>)}
                </div>
                <input value={tradeForm.entry} onChange={(event) => setTradeForm({ ...tradeForm, entry: event.target.value })} placeholder="Entry price" className="rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none placeholder:text-muted" />
                <input value={tradeForm.stopLoss} onChange={(event) => setTradeForm({ ...tradeForm, stopLoss: event.target.value })} placeholder="Stop Loss" className="rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none placeholder:text-muted" />
                <input value={tradeForm.takeProfit} onChange={(event) => setTradeForm({ ...tradeForm, takeProfit: event.target.value })} placeholder="Take Profit" className="rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none placeholder:text-muted" />
                <KwantSelect value={tradeForm.result} onChange={(event) => setTradeForm({ ...tradeForm, result: event.target.value as "Open" | "Win" | "Loss" })} className="rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none">
                  {["Open", "Win", "Loss"].map((item) => <option key={item}>{item}</option>)}
                </KwantSelect>
                <input value={tradeForm.pnl} onChange={(event) => setTradeForm({ ...tradeForm, pnl: event.target.value })} placeholder="P&L $" className="col-span-2 rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none placeholder:text-muted" />
                <textarea value={tradeForm.notes} onChange={(event) => setTradeForm({ ...tradeForm, notes: event.target.value })} placeholder="Notes" rows={3} className="col-span-2 resize-none rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none placeholder:text-muted" />
              </div>
              <button onClick={logTrade} className="mt-3 w-full rounded-xl bg-primary py-2.5 text-[13px] font-semibold text-black transition hover:bg-primary/90">Log Trade</button>
              <div className="mt-4 space-y-2">
                {trades.length ? trades.map((trade) => (
                  <div key={trade.id} className="rounded-xl border border-border bg-background p-3 text-[12px]">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{trade.time} · {trade.direction} {trade.instrument}</span>
                      <span className={`font-mono ${Number(trade.pnl) >= 0 ? "text-primary" : "text-red-300"}`}>${Number(trade.pnl || 0).toFixed(2)}</span>
                    </div>
                    <div className="mt-1 text-muted">Entry {trade.entry} · SL {trade.stopLoss || "-"} · TP {trade.takeProfit || "-"} · {trade.result}</div>
                  </div>
                )) : <div className="rounded-xl border border-dashed border-border bg-background p-4 text-center text-[12px] text-muted">No trades logged yet</div>}
              </div>
            </section>
          </div>
        </aside>
      </section>
    </main>
  );
}
