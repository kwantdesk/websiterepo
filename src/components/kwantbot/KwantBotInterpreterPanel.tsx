"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bot,
  Clock3,
  Download,
  MessageSquareText,
  NotebookTabs,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import type { UseKwantBotInterpreterResult } from "@/hooks/useKwantBotInterpreter";
import {
  formatKwantBotPrice,
  type KwantBotInterpreterMessage,
  type KwantBotMarketRoot,
  type KwantBotMemoryEvent,
} from "@/lib/kwantBotInterpreter";

function messageLabel(message: KwantBotInterpreterMessage) {
  switch (message.kind) {
    case "briefing": return "Market read";
    case "approach": return "Level approaching";
    case "touch": return "At level";
    case "rejection": return "Rejection";
    case "acceptance": return "Acceptance";
    case "outcome": return "Outcome";
    case "options": return "Options shift";
    default: return "System";
  }
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Now";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function relativeAge(value: number | string | null, now: number) {
  if (!value) return "waiting";
  const parsed = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(parsed)) return "waiting";
  const seconds = Math.max(0, Math.floor((now - parsed) / 1_000));
  if (seconds < 5) return "now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

function messageTone(message: KwantBotInterpreterMessage) {
  if (message.kind === "touch") return "border-primary/35 bg-primary/10";
  if (message.kind === "rejection") return "border-emerald-400/25 bg-emerald-400/[0.07]";
  if (message.kind === "acceptance") return "border-amber-400/25 bg-amber-400/[0.07]";
  if (message.kind === "options") return "border-violet-400/25 bg-violet-400/[0.07]";
  return "border-border/80 bg-surface";
}

function journalLabel(event: KwantBotMemoryEvent) {
  switch (event.type) {
    case "context": return "Market context";
    case "approach": return "Level approach";
    case "touch": return "Level touch";
    case "rejection": return "Rejection";
    case "acceptance": return "Acceptance";
    case "outcome": return "Outcome";
    default: return "Price sample";
  }
}

function journalTone(event: KwantBotMemoryEvent) {
  if (event.type === "touch") return "border-primary/35 text-primary";
  if (event.type === "rejection") return "border-emerald-400/30 text-emerald-400";
  if (event.type === "acceptance") return "border-amber-400/30 text-amber-400";
  if (event.type === "outcome") return "border-violet-400/30 text-violet-400";
  return "border-border text-muted";
}

function formatJournalDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function KwantBotAvatar({ speaking = false }: { speaking?: boolean }) {
  return (
    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-primary/30 bg-background shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_20%,transparent)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,color-mix(in_srgb,var(--primary)_24%,transparent),transparent_68%)]" />
      <div className={speaking ? "kwantbot-avatar-speaking" : ""}>
        <Image
          src="/images/kwantbot-avatar.png"
          alt=""
          width={82}
          height={82}
          className="absolute -top-px left-1/2 h-[82px] w-[82px] max-w-none -translate-x-1/2 object-contain grayscale"
        />
      </div>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background: "var(--primary)",
          WebkitMaskImage: "url('/images/kwantbot-avatar.png')",
          WebkitMaskPosition: "center",
          WebkitMaskRepeat: "no-repeat",
          WebkitMaskSize: "205%",
          maskImage: "url('/images/kwantbot-avatar.png')",
          maskPosition: "center",
          maskRepeat: "no-repeat",
          maskSize: "205%",
        }}
      />
      <span className="absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full border-2 border-panel bg-primary shadow-[0_0_8px_var(--primary)]" />
    </div>
  );
}

export default function KwantBotInterpreterPanel({
  interpreter,
}: {
  interpreter: UseKwantBotInterpreterResult;
}) {
  const {
    selectedRoot,
    selectRoot,
    messages,
    memory,
    archiveSyncState,
    contexts,
    contextStates,
    contextErrors,
    livePrices,
    lastTickAt,
    feedState,
    unread,
    requestBrief,
  } = interpreter;
  const [now, setNow] = useState(Date.now());
  const [view, setView] = useState<"feed" | "journal">("feed");
  const [archiveExporting, setArchiveExporting] = useState(false);
  const [feedPaused, setFeedPaused] = useState(false);
  const [pausedMessages, setPausedMessages] = useState<Record<KwantBotMarketRoot, KwantBotInterpreterMessage[]> | null>(null);
  const feedScrollRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const currentRootMessages = messages[selectedRoot];
  const rootMessages = feedPaused
    ? pausedMessages?.[selectedRoot] ?? []
    : currentRootMessages;
  const latestMessageId = rootMessages.at(-1)?.id ?? "";
  const queuedMessageCount = useMemo(() => {
    if (!feedPaused || !pausedMessages) return 0;
    const frozenIds = new Set(pausedMessages[selectedRoot].map((message) => message.id));
    return currentRootMessages.filter((message) => !frozenIds.has(message.id)).length;
  }, [currentRootMessages, feedPaused, pausedMessages, selectedRoot]);
  const context = contexts[selectedRoot];
  const price = livePrices[selectedRoot] ?? context?.currentPrice ?? null;
  const priceSamples = useMemo(
    () => memory[selectedRoot].filter((event) => event.type === "price").length,
    [memory, selectedRoot],
  );
  const journalEvents = useMemo(
    () => memory[selectedRoot]
      .filter((event) => event.type !== "price")
      .slice()
      .reverse(),
    [memory, selectedRoot],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useLayoutEffect(() => {
    if (view !== "feed" || feedPaused) return;

    const scrollToLatest = () => {
      const container = feedScrollRef.current;
      if (!container) return;
      container.scrollTop = container.scrollHeight;
    };

    scrollToLatest();
    const frame = window.requestAnimationFrame(scrollToLatest);
    return () => window.cancelAnimationFrame(frame);
  }, [feedPaused, latestMessageId, selectedRoot, view]);

  const toggleFeedPause = () => {
    if (feedPaused) {
      setFeedPaused(false);
      setPausedMessages(null);
      return;
    }
    setPausedMessages({
      NQ: [...messages.NQ],
      ES: [...messages.ES],
    });
    setFeedPaused(true);
    setView("feed");
  };

  const downloadArchive = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportJournal = async () => {
    setArchiveExporting(true);
    const filename = `kwantbot-${selectedRoot.toLowerCase()}-archive-${new Date().toISOString().slice(0, 10)}.json`;
    try {
      const response = await fetch(`/api/kwantbot/archive?root=${selectedRoot}&download=1`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("Cloud archive unavailable.");
      downloadArchive(await response.blob(), filename);
    } catch {
      const payload = {
        format: "kwantdesk-kwantbot-journal-v1",
        storage: "local-fallback",
        root: selectedRoot,
        exportedAt: new Date().toISOString(),
        livePrice: price,
        context,
        journal: journalEvents.slice().reverse(),
        messages: currentRootMessages,
      };
      downloadArchive(
        new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
        filename,
      );
    } finally {
      setArchiveExporting(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border bg-background/55">
        <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
          <div className="flex min-w-0 items-center gap-2">
            <KwantBotAvatar speaking={feedState === "live" && !feedPaused} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="truncate text-[13px] font-semibold text-foreground">Kwant Bot</h3>
                <span className="rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-primary">
                  Interpreter
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-[9px] text-muted">
                <span className={`h-1.5 w-1.5 rounded-full ${feedPaused ? "bg-amber-300" : feedState === "live" ? "animate-pulse bg-primary shadow-[0_0_7px_var(--primary)]" : "bg-amber-400"}`} />
                Kwant Bot {feedPaused ? "feed paused" : feedState === "live" ? "connected" : feedState}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={toggleFeedPause}
              className={`flex h-8 items-center gap-1.5 rounded-lg border px-2 text-[9px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                feedPaused
                  ? "border-amber-400/35 bg-amber-400/10 text-amber-300 hover:bg-amber-400/15"
                  : "border-border bg-surface text-muted hover:border-primary/25 hover:text-primary"
              }`}
              title={feedPaused ? "Resume incoming KwantBot messages" : "Pause the visible feed while analysis continues in the background"}
            >
              {feedPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              {feedPaused ? `Resume${queuedMessageCount ? ` ${queuedMessageCount}` : ""}` : "Pause"}
            </button>
            <button
              type="button"
              onClick={() => requestBrief()}
              disabled={!context || price === null}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/10 px-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-40"
              title="Generate an immediate deterministic market read"
            >
              <RefreshCw className="h-3 w-3" />
              Brief
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 px-3 pb-2">
          {(["NQ", "ES"] as KwantBotMarketRoot[]).map((root) => {
            const active = selectedRoot === root;
            const rootPrice = livePrices[root] ?? contexts[root]?.currentPrice ?? null;
            return (
              <button
                key={root}
                type="button"
                onClick={() => selectRoot(root)}
                className={`relative rounded-xl border px-2.5 py-2 text-left transition-all ${active ? "border-primary/40 bg-primary/12 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_12%,transparent)]" : "border-border bg-surface/55 hover:border-primary/20"}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-semibold ${active ? "text-primary" : "text-foreground"}`}>{root}</span>
                  {unread[root] > 0 ? (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[8px] font-semibold text-background">
                      {unread[root]}
                    </span>
                  ) : (
                    <span className={`h-1.5 w-1.5 rounded-full ${lastTickAt[root] ? "bg-primary" : "bg-muted/50"}`} />
                  )}
                </div>
                <div className="mt-1 font-mono text-[11px] text-foreground">
                  {rootPrice === null ? "—" : formatKwantBotPrice(root, rootPrice)}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 border-t border-border/70 px-3 py-2">
          <button
            type="button"
            onClick={() => setView("feed")}
            className={`flex h-7 flex-1 items-center justify-center gap-1.5 rounded-lg border text-[9px] font-semibold uppercase tracking-[0.08em] transition-colors ${view === "feed" ? "border-primary/35 bg-primary/10 text-primary" : "border-transparent text-muted hover:bg-surface hover:text-foreground"}`}
          >
            <MessageSquareText className="h-3 w-3" />
            Live feed
          </button>
          <button
            type="button"
            onClick={() => setView("journal")}
            className={`flex h-7 flex-1 items-center justify-center gap-1.5 rounded-lg border text-[9px] font-semibold uppercase tracking-[0.08em] transition-colors ${view === "journal" ? "border-primary/35 bg-primary/10 text-primary" : "border-transparent text-muted hover:bg-surface hover:text-foreground"}`}
          >
            <NotebookTabs className="h-3 w-3" />
            Journal
            {journalEvents.length ? <span className="rounded-full bg-surface px-1.5 py-0.5 text-[8px]">{journalEvents.length}</span> : null}
          </button>
        </div>

        {feedPaused && view === "feed" ? (
          <div className="flex items-center justify-between gap-2 border-t border-amber-400/20 bg-amber-400/[0.06] px-3 py-2">
            <div className="flex min-w-0 items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.1em] text-amber-300">
              <Pause className="h-3 w-3 shrink-0" />
              <span className="truncate">
                Feed paused{queuedMessageCount ? ` · ${queuedMessageCount} update${queuedMessageCount === 1 ? "" : "s"} queued` : " · reading mode"}
              </span>
            </div>
            <button
              type="button"
              onClick={toggleFeedPause}
              className="shrink-0 rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-amber-200 hover:bg-amber-400/15"
            >
              Resume
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-3 border-t border-border/70">
          <div className="border-r border-border/70 px-3 py-2">
            <div className="flex items-center gap-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">
              <Radio className="h-2.5 w-2.5" />
              Price
            </div>
            <div className="mt-1 truncate font-mono text-[11px] text-foreground">
              {price === null ? "Waiting" : formatKwantBotPrice(selectedRoot, price)}
            </div>
          </div>
          <div className="border-r border-border/70 px-3 py-2">
            <div className="flex items-center gap-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">
              <Activity className="h-2.5 w-2.5" />
              Context
            </div>
            <div className={`mt-1 truncate text-[9px] font-semibold uppercase ${contextStates[selectedRoot] === "live" ? "text-primary" : contextStates[selectedRoot] === "error" ? "text-danger" : "text-amber-400"}`}>
              {contextStates[selectedRoot]}
            </div>
          </div>
          <div className="px-3 py-2">
            <div className="flex items-center gap-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">
              <Clock3 className="h-2.5 w-2.5" />
              Memory
            </div>
            <div className="mt-1 truncate text-[9px] font-semibold text-foreground">{priceSamples} mins</div>
          </div>
        </div>
      </div>

      <div
        ref={feedScrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[linear-gradient(180deg,color-mix(in_srgb,var(--background)_68%,transparent),var(--panel))] px-3 py-4"
      >
        {view === "feed" ? (
          <div className="flex min-h-full flex-col justify-end">
            {contextErrors[selectedRoot] ? (
              <div className="mb-3 rounded-xl border border-danger/20 bg-danger/[0.06] px-3 py-2 text-[10px] leading-4 text-danger">
                {contextErrors[selectedRoot]} Existing levels and memory remain active while the context reconnects.
              </div>
            ) : null}

            <div className="mb-4 flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.12em] text-muted/70">
              <span className="h-px flex-1 bg-border" />
              {selectedRoot} live tape · tick {relativeAge(lastTickAt[selectedRoot], now)}
              <span className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-4">
              {!rootMessages.length ? (
                <div className="flex min-h-52 flex-col items-center justify-center px-4 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="text-[12px] font-semibold text-foreground">
                    Building the {selectedRoot} market read
                  </div>
                  <p className="mt-1 text-[10px] leading-4 text-muted">
                    Loading live CME price, Gameplan levels, options positioning, and the first memory samples.
                  </p>
                </div>
              ) : rootMessages.map((item, index) => (
                <div key={item.id} className="kwantbot-message-in flex items-end gap-2">
                  <KwantBotAvatar speaking={!feedPaused && index === rootMessages.length - 1} />
                  <div className="min-w-0 max-w-[calc(100%-44px)]">
                    <div className="mb-1 flex items-center gap-2 px-1">
                      <span className="text-[10px] font-semibold text-foreground">Kwant Bot · {selectedRoot}</span>
                      <span className="text-[9px] text-muted">{formatMessageTime(item.createdAt)}</span>
                    </div>
                    <div className={`relative rounded-[18px] rounded-bl-[6px] border px-3.5 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.16)] ${messageTone(item)}`}>
                      <span
                        aria-hidden="true"
                        className="absolute -left-[5px] bottom-0 h-3 w-3 bg-inherit [clip-path:polygon(100%_0,100%_100%,0_100%)]"
                      />
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <Sparkles className="h-2.5 w-2.5 text-primary" />
                        <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-primary">
                          {messageLabel(item)}
                        </span>
                        {typeof item.price === "number" ? (
                          <span className="ml-auto font-mono text-[8px] text-muted">
                            {formatKwantBotPrice(selectedRoot, item.price)}
                          </span>
                        ) : null}
                      </div>
                      <p className="relative whitespace-pre-wrap text-[11px] leading-[1.6] text-foreground">
                        {item.text}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground">{selectedRoot} memory journal</div>
                <div className="mt-0.5 text-[8px] text-muted">Messages, reasoning, level decisions, and outcomes are retained in your private cloud archive.</div>
              </div>
              <button
                type="button"
                onClick={exportJournal}
                disabled={archiveExporting || (!journalEvents.length && !currentRootMessages.length)}
                className="flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2 text-[8px] font-semibold uppercase tracking-[0.08em] text-muted transition-colors hover:border-primary/30 hover:text-primary disabled:opacity-35"
                title={`Download the ${selectedRoot} cloud archive`}
              >
                <Download className={`h-3 w-3 ${archiveExporting ? "animate-pulse" : ""}`} />
                {archiveExporting ? "Preparing" : "Export"}
              </button>
            </div>

            {!journalEvents.length ? (
              <div className="flex min-h-52 flex-col items-center justify-center px-4 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <NotebookTabs className="h-5 w-5" />
                </div>
                <div className="text-[12px] font-semibold text-foreground">Journal is listening</div>
                <p className="mt-1 text-[10px] leading-4 text-muted">
                  The first context change, level approach, touch, confirmed response, or outcome will appear here.
                </p>
              </div>
            ) : (
              <div className="relative space-y-2 pl-4 before:absolute before:bottom-3 before:left-[5px] before:top-3 before:w-px before:bg-border">
                {journalEvents.map((event) => (
                  <article key={event.id} className="relative rounded-xl border border-border bg-surface/70 p-3">
                    <span className="absolute -left-[15px] top-4 h-2.5 w-2.5 rounded-full border-2 border-panel bg-primary shadow-[0_0_7px_color-mix(in_srgb,var(--primary)_45%,transparent)]" />
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className={`inline-flex rounded-full border px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-[0.1em] ${journalTone(event)}`}>
                          {journalLabel(event)}
                        </div>
                        <div className="mt-1 truncate text-[10px] font-semibold text-foreground">
                          {event.levelName ?? `${selectedRoot} positioning snapshot`}
                        </div>
                      </div>
                      <time className="shrink-0 text-right text-[7px] leading-3 text-muted">
                        {formatJournalDate(event.createdAt)}
                      </time>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 font-mono text-[8px] text-muted">
                      {typeof event.price === "number" ? <span>PRICE {formatKwantBotPrice(selectedRoot, event.price)}</span> : null}
                      {event.zone ? <span>ZONE {formatKwantBotPrice(selectedRoot, event.zone[0])}–{formatKwantBotPrice(selectedRoot, event.zone[1])}</span> : null}
                    </div>
                    {event.detail ? <p className="mt-2 text-[9px] leading-4 text-foreground">{event.detail}</p> : null}
                    {event.reasoning ? (
                      <div className="mt-2 border-t border-border/70 pt-2">
                        <div className="mb-1 text-[7px] font-semibold uppercase tracking-[0.12em] text-primary">Recorded reasoning</div>
                        <p className="text-[9px] leading-4 text-muted">{event.reasoning}</p>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-border bg-panel px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Activity className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-[9px] font-semibold uppercase tracking-[0.1em] text-foreground">15-minute reads active</div>
              <div className="truncate text-[8px] text-muted">
                Options {relativeAge(context?.options.asOf ?? null, now)} · {archiveSyncState === "synced" ? "cloud archived" : archiveSyncState === "syncing" ? "archiving" : "local safety copy"}
              </div>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-border bg-background/50 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">
            AI chat next
          </span>
        </div>
      </div>
    </div>
  );
}
