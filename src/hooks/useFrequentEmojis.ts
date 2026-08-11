"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DEFAULT_FREQUENT_EMOJIS, rankedEmojis, type EmojiUsage } from "@/lib/emojis";

const EMOJI_EVENT = "kwantdesk:emoji-usage-changed";

function storageKey(accountKey: string) {
  return `kwantdesk:emoji-usage:${accountKey || "local"}`;
}

function readUsage(accountKey: string): EmojiUsage {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(accountKey)) ?? "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>)
      .filter(([, count]) => Number.isFinite(Number(count)) && Number(count) > 0)
      .map(([emoji, count]) => [emoji, Math.min(100_000, Math.floor(Number(count)))]));
  } catch {
    return {};
  }
}

function writeUsage(accountKey: string, usage: EmojiUsage) {
  window.localStorage.setItem(storageKey(accountKey), JSON.stringify(usage));
  window.dispatchEvent(new CustomEvent(EMOJI_EVENT, { detail: { accountKey } }));
}

export function useFrequentEmojis(accountKey: string) {
  const resolvedKey = accountKey || "local";
  const [usage, setUsage] = useState<EmojiUsage>(() => readUsage(resolvedKey));

  useEffect(() => {
    setUsage(readUsage(resolvedKey));
    let cancelled = false;
    void fetch("/api/socials/emoji-preferences", { cache: "no-store" })
      .then(async (response) => ({ response, result: await response.json() as { usage?: EmojiUsage } }))
      .then(({ response, result }) => {
        if (cancelled || !response.ok || !result.usage) return;
        const local = readUsage(resolvedKey);
        const merged = { ...result.usage };
        for (const [emoji, count] of Object.entries(local)) merged[emoji] = Math.max(merged[emoji] ?? 0, count);
        setUsage(merged);
        writeUsage(resolvedKey, merged);
      })
      .catch(() => undefined);
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<{ accountKey?: string }>).detail;
      if (!detail?.accountKey || detail.accountKey === resolvedKey) setUsage(readUsage(resolvedKey));
    };
    window.addEventListener(EMOJI_EVENT, sync);
    return () => {
      cancelled = true;
      window.removeEventListener(EMOJI_EVENT, sync);
    };
  }, [resolvedKey]);

  const recordEmojiUse = useCallback((emoji: string) => {
    const clean = emoji.trim();
    if (!clean) return;
    const next = { ...readUsage(resolvedKey) };
    next[clean] = Math.min(100_000, (next[clean] ?? 0) + 1);
    writeUsage(resolvedKey, next);
    setUsage(next);
    void fetch("/api/socials/emoji-preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji: clean }),
    }).catch(() => undefined);
  }, [resolvedKey]);

  return {
    frequentEmojis: useMemo(() => rankedEmojis(usage, 8), [usage]),
    recordEmojiUse,
    ready: Boolean(Object.keys(usage).length) || DEFAULT_FREQUENT_EMOJIS.length > 0,
  };
}

