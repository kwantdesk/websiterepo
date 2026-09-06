"use client";

import { useEffect, useRef, useState } from "react";
import type { Candle } from "@/lib/backtester";
import type { ChartIndicatorInstance } from "@/lib/chartIndicatorCatalog";
import { LIVE_CHART_CANDLE_EVENT, type LiveChartCandleDetail } from "@/lib/chartLiveEvents";
import { SuperTrendLiveCalculator } from "@/lib/superTrend";
import { SuperTrendAlertTracker } from "@/lib/superTrendAlerts";
import { normalizeSuperTrendSettings } from "@/lib/superTrendSettings";

type Entry = { calculator: SuperTrendLiveCalculator; tracker: SuperTrendAlertTracker;
  scope: string; settings: ReturnType<typeof normalizeSuperTrendSettings> };

/** No network/subscriptions to providers; consumes the existing chart's live event. */
export function useSuperTrendAlerts({ indicators, history, liveKey, instrument, timeframe, live }: {
  indicators: readonly ChartIndicatorInstance[]; history: readonly Candle[];
  liveKey?: string | null; instrument: string; timeframe?: string; live: boolean;
}) {
  const entries = useRef(new Map<string, Entry>());
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      void audio.current?.close(); audio.current = null;
    };
  }, []);
  const isLive = useRef(live);
  isLive.current = live;
  useEffect(() => {
    const keep = new Set<string>();
    for (const instance of indicators) {
      if (!instance.enabled || instance.indicatorId !== "super-trend") continue;
      const s = normalizeSuperTrendSettings(instance.settings ?? {});
      if (!s.alertSoundEnabled && !s.messagePopupEnabled) continue;
      keep.add(instance.instanceId);
      const scope = JSON.stringify([liveKey, instrument, timeframe, s.length, s.multiplier]);
      let entry = entries.current.get(instance.instanceId);
      if (!entry || entry.scope !== scope) {
        entry = { scope, settings: s, tracker: new SuperTrendAlertTracker(),
          calculator: new SuperTrendLiveCalculator({ length: Number(s.length), multiplier: Number(s.multiplier) }) };
        entries.current.set(instance.instanceId, entry);
      }
      entry.settings = s;
      entry.tracker.seed(scope, entry.calculator.reseed(history));
    }
    for (const key of entries.current.keys()) if (!keep.has(key)) entries.current.delete(key);
  }, [indicators, history, liveKey, instrument, timeframe]);

  useEffect(() => {
    if (!liveKey) return;
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<LiveChartCandleDetail>).detail;
      if (!detail || detail.key !== liveKey) return;
      for (const [instanceId, entry] of entries.current) {
        if (!isLive.current) {
          entry.tracker.update({ scopeKey: entry.scope, live: false, sourceTimestamp: NaN, now: Date.now() });
          continue;
        }
        const point = entry.calculator.update(detail.candle);
        const alert = entry.tracker.update({ scopeKey: entry.scope, live: true,
          sourceTimestamp: Number(detail.sourceTimestampMs), now: Date.now(), point: point ?? undefined });
        if (!alert) continue;
        const title = `${entry.settings.alertName}: ${alert.direction === "up" ? "Uptrend" : "Downtrend"}`;
        const showNotice = (message: string) => {
          if (!mounted.current) return;
          setNotice(message);
          if (noticeTimer.current) clearTimeout(noticeTimer.current);
          noticeTimer.current = setTimeout(() => setNotice(null), 6000);
        };
        if (entry.settings.messagePopupEnabled) showNotice(title);
        if (entry.settings.alertSoundEnabled) {
          try {
            audio.current ??= new AudioContext();
            const context = audio.current;
            void context.resume().then(() => {
              if (!mounted.current || !isLive.current || context.state !== "running"
                || Date.now() - Number(detail.sourceTimestampMs) > 15000) return;
              const tone = context.createOscillator(), gain = context.createGain();
              tone.type = "sine"; tone.frequency.value = alert.direction === "up" ? 880 : 440;
              gain.gain.setValueAtTime(0.08, context.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);
              tone.connect(gain); gain.connect(context.destination);
              tone.start(); tone.stop(context.currentTime + 0.2);
              tone.onended = () => { tone.disconnect(); gain.disconnect(); };
            }).catch(() => showNotice(`${title} — sound unavailable in this browser`));
          } catch { showNotice(`${title} — sound unavailable in this browser`); }
        }
        window.dispatchEvent(new CustomEvent("kwantdesk:chart-indicator-alert", { detail: {
          indicatorId: "super-trend", instanceId, instrument,
          title,
          sound: entry.settings.alertSoundEnabled ? "default" : null,
          popup: entry.settings.messagePopupEnabled === true, event: alert,
        } }));
      }
    };
    window.addEventListener(LIVE_CHART_CANDLE_EVENT, receive);
    return () => window.removeEventListener(LIVE_CHART_CANDLE_EVENT, receive);
  }, [liveKey, instrument]);
  return notice;
}
