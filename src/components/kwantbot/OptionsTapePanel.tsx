"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bot,
  Clock3,
  Layers3,
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
} from "@/lib/kwantBotInterpreter";

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Now";
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function relativeAge(value: number | string | null, now: number) {
  if (!value) return "waiting";
  const parsed = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(parsed)) return "waiting";
  const seconds = Math.max(0, Math.floor((now - parsed) / 1_000));
  if (seconds < 5) return "now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function formatPremium(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${sign}$${(absolute / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `${sign}$${(absolute / 1_000).toFixed(0)}K`;
  return `${sign}$${absolute.toFixed(0)}`;
}

function OptionsTapeAvatar({ speaking = false }: { speaking?: boolean }) {
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

export default function OptionsTapePanel({
  interpreter,
}: {
  interpreter: UseKwantBotInterpreterResult;
}) {
  const {
    selectedRoot,
    selectRoot,
    messages,
    contexts,
    contextStates,
    contextErrors,
    livePrices,
    lastTickAt,
    feedState,
    optionsUnread,
    refreshContext,
  } = interpreter;
  const [now, setNow] = useState(Date.now());
  const [feedPaused, setFeedPaused] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pausedMessages, setPausedMessages] = useState<Record<KwantBotMarketRoot, KwantBotInterpreterMessage[]> | null>(null);
  const feedScrollRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const optionsMessages = useMemo(
    () => ({
      NQ: messages.NQ.filter((message) => message.kind === "options"),
      ES: messages.ES.filter((message) => message.kind === "options"),
    }),
    [messages],
  );
  const currentRootMessages = optionsMessages[selectedRoot];
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
  const options = context?.options ?? null;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useLayoutEffect(() => {
    if (feedPaused) return;
    const scrollToLatest = () => {
      const container = feedScrollRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    };
    scrollToLatest();
    const frame = window.requestAnimationFrame(scrollToLatest);
    return () => window.cancelAnimationFrame(frame);
  }, [feedPaused, latestMessageId, selectedRoot]);

  const toggleFeedPause = () => {
    if (feedPaused) {
      setFeedPaused(false);
      setPausedMessages(null);
      return;
    }
    setPausedMessages({
      NQ: [...optionsMessages.NQ],
      ES: [...optionsMessages.ES],
    });
    setFeedPaused(true);
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshContext(selectedRoot);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border bg-background/55">
        <div className="flex h-14 items-center justify-between gap-2 border-b border-border px-3">
          <div className="flex min-w-0 items-center gap-2">
            <OptionsTapeAvatar speaking={feedState === "live" && !feedPaused} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="truncate text-[13px] font-semibold text-foreground">Options Tape</h3>
                <span className="rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-primary">
                  Positioning
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-[9px] text-muted">
                <span className={`h-1.5 w-1.5 rounded-full ${feedPaused ? "bg-amber-300" : feedState === "live" ? "animate-pulse bg-primary shadow-[0_0_7px_var(--primary)]" : "bg-amber-400"}`} />
                Options Tape {feedPaused ? "paused" : contextStates[selectedRoot] === "live" ? "connected" : contextStates[selectedRoot]}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={toggleFeedPause}
              className={`flex h-8 items-center gap-1.5 rounded-lg border px-2 text-[9px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                feedPaused
                  ? "border-amber-400/35 bg-amber-400/10 text-amber-300"
                  : "border-border bg-surface text-muted hover:border-primary/25 hover:text-primary"
              }`}
              title={feedPaused ? "Resume incoming Options Tape updates" : "Pause the visible tape while updates continue"}
            >
              {feedPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              {feedPaused ? `Resume${queuedMessageCount ? ` ${queuedMessageCount}` : ""}` : "Pause"}
            </button>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary transition-colors hover:bg-primary/15 disabled:opacity-40"
              title="Refresh options positioning now"
              aria-label="Refresh options positioning now"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
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
                onClick={() => selectRoot(root, "options")}
                className={`relative rounded-xl border px-2.5 py-2 text-left transition-all ${active ? "border-primary/40 bg-primary/12 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_12%,transparent)]" : "border-border bg-surface/55 hover:border-primary/20"}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-semibold ${active ? "text-primary" : "text-foreground"}`}>{root}</span>
                  {optionsUnread[root] > 0 ? (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[8px] font-semibold text-background">
                      {optionsUnread[root]}
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

        <div className="grid grid-cols-3 border-t border-border/70">
          <div className="border-r border-border/70 px-3 py-2">
            <div className="flex items-center gap-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">
              <Layers3 className="h-2.5 w-2.5" />
              Gamma
            </div>
            <div className="mt-1 truncate text-[9px] font-semibold text-foreground">
              {options?.gammaRegime ?? "Waiting"}
            </div>
          </div>
          <div className="border-r border-border/70 px-3 py-2">
            <div className="flex items-center gap-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">
              <Activity className="h-2.5 w-2.5" />
              Net premium
            </div>
            <div className={`mt-1 truncate font-mono text-[9px] font-semibold ${(options?.netPremium ?? 0) >= 0 ? "text-primary" : "text-danger"}`}>
              {options ? formatPremium(options.netPremium) : "Waiting"}
            </div>
          </div>
          <div className="px-3 py-2">
            <div className="flex items-center gap-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-muted">
              <Radio className="h-2.5 w-2.5" />
              Bullish
            </div>
            <div className="mt-1 truncate text-[9px] font-semibold text-foreground">
              {options?.bullishShare === null || options?.bullishShare === undefined
                ? "Waiting"
                : `${Math.round(options.bullishShare * 100)}%`}
            </div>
          </div>
        </div>
      </div>

      {feedPaused ? (
        <div className="flex items-center justify-between gap-2 border-b border-amber-400/20 bg-amber-400/[0.06] px-3 py-2">
          <div className="flex min-w-0 items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.1em] text-amber-300">
            <Pause className="h-3 w-3 shrink-0" />
            <span className="truncate">
              Tape paused{queuedMessageCount ? ` · ${queuedMessageCount} update${queuedMessageCount === 1 ? "" : "s"} queued` : " · reading mode"}
            </span>
          </div>
          <button
            type="button"
            onClick={toggleFeedPause}
            className="shrink-0 rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-amber-200"
          >
            Resume
          </button>
        </div>
      ) : null}

      <div
        ref={feedScrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[linear-gradient(180deg,color-mix(in_srgb,var(--background)_68%,transparent),var(--panel))] px-3 py-4"
      >
        <div className="flex min-h-full flex-col justify-end">
          {contextErrors[selectedRoot] ? (
            <div className="mb-3 rounded-xl border border-danger/20 bg-danger/[0.06] px-3 py-2 text-[10px] leading-4 text-danger">
              {contextErrors[selectedRoot]} The last good positioning snapshot remains visible while the tape reconnects.
            </div>
          ) : null}

          <div className="mb-4 flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.12em] text-muted/70">
            <span className="h-px flex-1 bg-border" />
            {selectedRoot} options · updated {relativeAge(options?.asOf ?? null, now)}
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-4">
            {!rootMessages.length ? (
              <div className="flex min-h-52 flex-col items-center justify-center px-4 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="text-[12px] font-semibold text-foreground">
                  Watching {selectedRoot} positioning
                </div>
                <p className="mt-1 max-w-56 text-[10px] leading-4 text-muted">
                  The current snapshot is live. Material gamma, premium, flow, and positioning shifts will arrive here automatically.
                </p>
              </div>
            ) : rootMessages.map((item, index) => (
              <div key={item.id} className="kwantbot-message-in flex items-end gap-2">
                <OptionsTapeAvatar speaking={!feedPaused && index === rootMessages.length - 1} />
                <div className="min-w-0 max-w-[calc(100%-44px)]">
                  <div className="mb-1 flex items-center gap-2 px-1">
                    <span className="text-[10px] font-semibold text-foreground">Options Tape · {selectedRoot}</span>
                    <span className="text-[9px] text-muted">{formatMessageTime(item.createdAt)}</span>
                  </div>
                  <div className="relative rounded-[18px] rounded-bl-[6px] border border-primary/25 bg-primary/[0.07] px-3.5 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.16)]">
                    <span
                      aria-hidden="true"
                      className="absolute -left-[5px] bottom-0 h-3 w-3 bg-inherit [clip-path:polygon(100%_0,100%_100%,0_100%)]"
                    />
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <Sparkles className="h-2.5 w-2.5 text-primary" />
                      <span className="text-[8px] font-semibold uppercase tracking-[0.12em] text-primary">
                        Positioning shift
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
      </div>

      <div className="shrink-0 border-t border-border bg-panel px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Clock3 className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-[9px] font-semibold uppercase tracking-[0.1em] text-foreground">Material shifts only</div>
              <div className="truncate text-[8px] text-muted">
                {options?.frontExpiration ? `Front expiry ${options.frontExpiration}` : "Waiting for front expiry"} · price tick {relativeAge(lastTickAt[selectedRoot], now)}
              </div>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.1em] text-primary">
            Live
          </span>
        </div>
      </div>
    </div>
  );
}
