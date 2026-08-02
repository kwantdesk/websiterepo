"use client";

import {
  Bot,
  Clock3,
  Loader2,
  Mic,
  Play,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import KwantSelect from "@/components/ui/KwantSelect";
import { useSpeechDictation } from "@/hooks/useSpeechDictation";
import type { HistoricalZyonReplayInput } from "@/lib/historicalZyon";
import { isZyonModelKey, ZYON_MODELS, type ZyonModelKey } from "@/lib/zyon";

type ReplayMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function replayClock(value: string, timeZone: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "--";
  return new Intl.DateTimeFormat("en-AU", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(timestamp));
}

function initialMessage(context: HistoricalZyonReplayInput): ReplayMessage {
  return {
    id: `historical-zyon-welcome-${context.replayId}`,
    role: "assistant",
    content: `Historical replay locked to ${context.instrument} at ${replayClock(context.asOf, context.replayTimeZone)}. I will use only candles, levels and options frames available at this replay clock. Ask me to build the pre-session Gameplan or analyse what has developed so far.`,
    createdAt: new Date().toISOString(),
  };
}

export default function HistoricalZyonPanel({
  context,
  paired,
  onClose,
}: {
  context: HistoricalZyonReplayInput;
  paired: boolean;
  onClose: () => void;
}) {
  const [model, setModel] = useState<ZyonModelKey>(() => {
    if (typeof window === "undefined") return "opus-5";
    const stored = window.localStorage.getItem("kwantdesk:zyon:model");
    return isZyonModelKey(stored) ? stored : "opus-5";
  });
  const [messages, setMessages] = useState<ReplayMessage[]>(() => [initialMessage(context)]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const currentContextRef = useRef(context);
  currentContextRef.current = context;
  const speech = useSpeechDictation({ value: draft, onChange: setDraft, disabled: sending });
  const replayLabel = useMemo(
    () => replayClock(context.asOf, context.replayTimeZone),
    [context.asOf, context.replayTimeZone],
  );

  useEffect(() => {
    window.localStorage.setItem("kwantdesk:zyon:model", model);
  }, [model]);

  useEffect(() => {
    setMessages([initialMessage(context)]);
    setDraft("");
    setError("");
  // A new replay session receives a clean, correctly scoped conversation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.replayId]);

  useLayoutEffect(() => {
    const target = scrollRef.current;
    if (target) target.scrollTop = target.scrollHeight;
  }, [messages, sending]);

  useLayoutEffect(() => {
    const textarea = composerRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(180, Math.max(42, textarea.scrollHeight))}px`;
  }, [draft]);

  const send = async (event?: FormEvent, override?: string) => {
    event?.preventDefault();
    const content = (override ?? draft).trim().slice(0, 6_000);
    if (!content || sending) return;
    const userMessage: ReplayMessage = {
      id: id("historical-zyon-user"),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    const conversation = [...messages.slice(-23), userMessage];
    const firstUserIndex = conversation.findIndex((message) => message.role === "user");
    const providerConversation = firstUserIndex >= 0
      ? conversation.slice(firstUserIndex)
      : [userMessage];
    setMessages((current) => [...current, userMessage]);
    if (!override) setDraft("");
    setSending(true);
    setError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 50_000);
    try {
      const replay = currentContextRef.current;
      const response = await fetch("/api/zyon", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          root: replay.root,
          chatId: `zyon-replay-${replay.replayId}`.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 150),
          localDate: replay.asOf.slice(0, 10),
          clientTimeZone: replay.replayTimeZone,
          historicalReplay: replay,
          // The local welcome card is UI copy, not a provider-authored turn.
          // Anthropic conversations must begin with the user's actual request.
          messages: providerConversation.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
          })),
        }),
      });
      const payload = await response.json().catch(() => null) as { text?: unknown; error?: unknown } | null;
      if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : "Historical ZYON could not reply.");
      const reply = typeof payload?.text === "string" ? payload.text.trim() : "";
      if (!reply) throw new Error("Historical ZYON returned an empty reply.");
      setMessages((current) => [...current, {
        id: id("historical-zyon-assistant"),
        role: "assistant",
        content: reply.slice(0, 12_000),
        createdAt: new Date().toISOString(),
      }]);
    } catch (problem) {
      const failure = problem instanceof DOMException && problem.name === "AbortError"
        ? "Historical ZYON did not complete within 50 seconds. Your replay is still intact; press the message again to retry."
        : problem instanceof Error ? problem.message : "Historical ZYON could not reply.";
      setError(failure);
      setMessages((current) => [...current, {
        id: id("historical-zyon-failure"),
        role: "assistant",
        content: `I could not complete that historical analysis request. ${failure}`,
        createdAt: new Date().toISOString(),
      }]);
    } finally {
      window.clearTimeout(timeout);
      setSending(false);
    }
  };

  const startGameplan = () => void send(undefined,
    `ZYON, build the historical ${context.instrument} Gameplan for the session approaching at the current replay cutoff. Use only the verified information available now. Give me the market condition, important Gamma and Kwant levels, long scenario, short scenario, no-trade condition, confirmation, invalidation, risk logic and targets. Do not use anything after the replay clock.`,
  );

  return (
    <aside
      className={`absolute inset-y-0 z-40 flex w-[min(430px,48vw)] flex-col border-l border-border bg-panel/98 shadow-[-20px_0_60px_rgba(0,0,0,0.38)] backdrop-blur-xl ${paired ? "" : "right-0"}`}
      style={paired ? { right: "min(430px, 48vw)" } : undefined}
    >
      <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-border px-3">
        <span className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
          <Bot className="h-4 w-4" />
          <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-panel bg-primary shadow-[0_0_8px_var(--primary)]" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground">Historical ZYON</span>
            <span className="rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[7px] font-semibold text-primary">SYNCED</span>
          </div>
          <div className="mt-0.5 truncate font-mono text-[7px] text-muted">{context.instrument} / {replayLabel}</div>
        </div>
        <button type="button" onClick={onClose} className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-foreground" aria-label="Close historical ZYON"><X className="h-4 w-4" /></button>
      </header>

      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-background/20 px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/[0.05] px-2 py-1.5 text-[7px] text-muted">
          <Clock3 className="h-3 w-3 shrink-0 text-primary" />
          <span className="truncate">Cutoff {replayLabel}</span>
        </div>
        <KwantSelect
          value={model}
          onChange={(event) => {
            if (isZyonModelKey(event.target.value)) setModel(event.target.value);
          }}
          menuLabel="Historical ZYON model"
          className="h-7 min-w-[110px] rounded-lg border border-border bg-background px-2 text-[8px] font-semibold text-foreground"
          aria-label="Historical ZYON model"
        >
          {Object.entries(ZYON_MODELS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
        </KwantSelect>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <button
          type="button"
          onClick={startGameplan}
          disabled={sending}
          className="flex w-full items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.07] px-3 py-2.5 text-left text-[9px] font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-40"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Build the historical Gameplan
          <Play className="ml-auto h-3 w-3" />
        </button>
        {messages.map((message) => (
          <div key={message.id} className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            {message.role === "assistant" ? <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary"><Bot className="h-3 w-3" /></span> : null}
            <div className={`max-w-[86%] rounded-2xl px-3 py-2.5 text-[9px] leading-[1.55] ${message.role === "user" ? "rounded-br-md bg-primary text-background" : "rounded-bl-md border border-border bg-surface/55 text-foreground"}`}>
              <div className="whitespace-pre-wrap">{message.content}</div>
            </div>
          </div>
        ))}
        {sending ? (
          <div className="flex items-center gap-2 text-[8px] text-muted"><span className="flex h-6 w-6 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary"><Loader2 className="h-3 w-3 animate-spin" /></span>Reconstructing only what was known then...</div>
        ) : null}
      </div>

      <form onSubmit={(event) => void send(event)} className="shrink-0 border-t border-border bg-panel/95 p-3">
        <div className="rounded-2xl border border-border bg-background/55 p-2 focus-within:border-primary/35">
          <textarea
            ref={composerRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value.slice(0, 6_000))}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            disabled={sending}
            rows={2}
            placeholder={`Ask ZYON about ${context.instrument} at this replay time...`}
            className="min-h-[42px] w-full resize-none overflow-y-auto bg-transparent px-2 py-1 text-[10px] leading-5 text-foreground outline-none placeholder:text-muted/45"
          />
          <div className="flex items-center gap-1 border-t border-border/70 pt-2">
            <button type="button" onClick={speech.toggle} disabled={!speech.supported || sending} className={`flex h-8 w-8 items-center justify-center rounded-xl transition disabled:opacity-30 ${speech.listening ? "bg-primary/15 text-primary" : "text-muted hover:bg-surface hover:text-primary"}`} aria-label={speech.listening ? "Stop dictation" : "Dictate message"}><Mic className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => { setMessages([initialMessage(context)]); setError(""); }} disabled={sending} className="flex h-8 w-8 items-center justify-center rounded-xl text-muted hover:bg-surface hover:text-foreground disabled:opacity-30" aria-label="Reset historical chat"><RotateCcw className="h-3.5 w-3.5" /></button>
            <span className="ml-1 flex items-center gap-1 text-[7px] text-muted"><ShieldCheck className="h-3 w-3 text-primary" />No lookahead</span>
            <button type="submit" disabled={sending || !draft.trim()} className="ml-auto flex h-8 items-center gap-1.5 rounded-xl bg-primary px-3 text-[8px] font-semibold text-background disabled:opacity-30">{sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}Send</button>
          </div>
        </div>
        {error || speech.error ? <div className="mt-2 text-[8px] leading-4 text-danger">{error || speech.error}</div> : null}
        <div className="mt-2 text-[7px] leading-3 text-muted">Historical decision support only. ZYON cannot see or use data after the displayed replay cutoff.</div>
      </form>
    </aside>
  );
}
