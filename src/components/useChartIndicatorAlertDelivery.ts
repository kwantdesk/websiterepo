"use client";

import { useEffect, useRef, useState } from "react";
import type { ChartIndicatorInstance } from "@/lib/chartIndicatorCatalog";

type IndicatorAlert = {
  instanceId?: string;
  indicatorId?: string;
  instrument?: string;
  title?: string;
  message?: string;
  popup?: boolean;
  sound?: string | null;
};

/** Deliver only events belonging to this chart's enabled indicator instances. */
export function useChartIndicatorAlertDelivery(indicators: readonly ChartIndicatorInstance[], instrument: string, replay: boolean) {
  const current = useRef({ indicators, instrument, replay });
  current.current = { indicators, instrument, replay };
  const [notice, setNotice] = useState<string | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef({ key: "", at: 0 });
  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<IndicatorAlert>).detail;
      const state = current.current;
      if (!detail || state.replay || detail.instrument !== state.instrument || detail.indicatorId === "super-trend") return;
      const instance = state.indicators.find(item => item.enabled && item.instanceId === detail.instanceId && item.indicatorId === detail.indicatorId);
      if (!instance) return;
      const settings = instance.settings ?? {};
      const message = detail.message || detail.title || "Indicator alert";
      const popup = detail.popup ?? settings.messagePopupEnabled ?? settings.enablePopup ?? settings.enableMessage ?? true;
      const sound = detail.sound !== undefined ? Boolean(detail.sound)
        : settings.enableAlertSound === true || settings.alertSoundEnabled === true || settings.inAppSound === true;
      const key = instance.instanceId + ":" + message;
      const now = Date.now();
      if (key === last.current.key && now - last.current.at < 1000) return;
      last.current = { key, at: now };
      if (popup) {
        setNotice(message);
        if (timeout.current) clearTimeout(timeout.current);
        timeout.current = setTimeout(() => setNotice(null), 6000);
      }
      if (sound && instance.indicatorId !== "session-imbalance") {
        try {
          audio.current ??= new AudioContext();
          const context = audio.current;
          void context.resume().then(() => {
            if (current.current.replay || current.current.instrument !== state.instrument || !current.current.indicators.some(item => item.enabled && item.instanceId === instance.instanceId) || context.state !== "running") return;
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            const tone = detail.sound ?? settings.alertTone;
            oscillator.type = tone === "pulse" ? "triangle" : "sine";
            oscillator.frequency.value = tone === "bell" ? 1046 : tone === "pulse" ? 440 : 660;
            gain.gain.setValueAtTime(0.04, context.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.15);
            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start();
            oscillator.stop(context.currentTime + 0.16);
            oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
          }).catch(() => setNotice(message + " · Sound unavailable"));
        } catch { setNotice(message + " · Sound unavailable"); }
      }
    };
    window.addEventListener("kwantdesk:chart-indicator-alert", receive);
    return () => {
      window.removeEventListener("kwantdesk:chart-indicator-alert", receive);
      if (timeout.current) clearTimeout(timeout.current);
      void audio.current?.close();
      audio.current = null;
    };
  }, []);
  useEffect(() => { setNotice(null); }, [instrument, replay]);
  return notice;
}
