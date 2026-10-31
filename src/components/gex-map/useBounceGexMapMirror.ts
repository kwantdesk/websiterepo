"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLinkedGexMapSettingsState } from "./useLinkedGexMapSettings";
import { effectiveLinkedGexMapModel, linkedGexMapPanel, normalizeLinkedGexMapSettings, readLocalGexMapStarSettings } from "@/lib/gexMapLinkedSettings";
import { isGexMapSurfaceFor, hasRenderableGexMapSurface, type GexMapPanelPayload } from "@/lib/gexMap";
import { compactGexMapLiveCacheKey, fetchWorkspaceData, gexMapCacheKey, readWorkspaceData } from "@/lib/workspaceDataCache";
import { subscribeGexMapSurface, publishGexMapSurface } from "@/lib/gexMapSurfaceBus";
import { GEX_MAP_PALETTE_CHANGE_EVENT, gexMapSignedScaleHex, loadGexMapPalette } from "@/lib/gexMapPalette";
import { prepareBounceGexMirror, selectBounceGexMirror } from "@/lib/bounceGexMapMirror";
import { mergeBounceGexMapHistory } from "@/lib/bounceGexMapHistory";
import { resolveBounceGexMapSource } from "@/lib/bounceGexMapSource";
import { useBounceMappingHistory } from "./useBounceMappingHistory";
import type { Candle } from "@/lib/backtester";
import type { GreekMode } from "@/lib/optionsFlow";

const nyDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
export function useBounceGexMapMirror(input: {
  enabled: boolean; instrument: string; timeframe?: string; settings: Record<string, string | number | boolean>;
  timestampMs: number | null; candles: { current: Candle[] };
}) {
  const { settings: shared, hydrated } = useLinkedGexMapSettingsState(input.enabled), cfg = input.settings;
  const linked = cfg.linkGexMapSettings !== false;
  const profile = useMemo(() => linked ? shared : normalizeLinkedGexMapSettings({
    ...shared, expiryScope: cfg.mapExpiryScope, representation: cfg.mapRepresentation, exposureModel: cfg.mapExposureModel,
    viewMode: cfg.mapViewMode ?? shared.viewMode, stepMinutes: cfg.mapStepMinutes ?? shared.stepMinutes,
    starSettings: readLocalGexMapStarSettings(cfg.mapStarSettings, shared.starSettings),
  }), [linked, shared, cfg.mapExpiryScope, cfg.mapRepresentation, cfg.mapExposureModel, cfg.mapViewMode, cfg.mapStepMinutes, cfg.mapStarSettings]);
  const { display, source } = resolveBounceGexMapSource(input.instrument, profile, cfg.sourceTicker);
  const panel = linkedGexMapPanel(profile, source, typeof cfg.mapColumnId === "string" ? cfg.mapColumnId : undefined);
  const symbol = linked ? panel?.symbol ?? source : source;
  const greek = (linked ? panel?.greekMode ?? cfg.greekMode ?? "GAMMA" : cfg.greekMode ?? "GAMMA") as GreekMode;
  const model = effectiveLinkedGexMapModel(profile, greek);
  const sessionDate = input.timestampMs === null ? "" : nyDay.format(input.timestampMs);
  const key = (sessionDate ? gexMapCacheKey(symbol, greek, sessionDate, profile.expiryScope, profile.representation)
    : compactGexMapLiveCacheKey(symbol, greek, profile.expiryScope, profile.representation)) + (model === "DEALER_INVENTORY" ? ":dealer-v3" : "");
  const [state, setState] = useState<{ key: string; payload: GexMapPanelPayload | null }>({ key: "", payload: null });
  const historyRef = useRef<{ key: string; payload: GexMapPanelPayload } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paletteRevision, setPaletteRevision] = useState(0);
  const stateRef = useRef(state); stateRef.current = state;
  useEffect(() => {
    if (!input.enabled || !hydrated) return;
    const palette = () => setPaletteRevision((v) => v + 1);
    window.addEventListener(GEX_MAP_PALETTE_CHANGE_EVENT, palette);
    window.addEventListener("kwantdesk:theme-change", palette);
    return () => { window.removeEventListener(GEX_MAP_PALETTE_CHANGE_EVENT, palette); window.removeEventListener("kwantdesk:theme-change", palette); };
  }, [input.enabled, hydrated]);
  useEffect(() => {
    if (!input.enabled || !hydrated) return;
    if (!source) { setError("Choose an options source for this instrument."); setLoading(false); return; }
    if (stateRef.current.key !== key) setError(null);
    let cancelled = false, timer: ReturnType<typeof setTimeout> | null = null;
    let bootstrappedDate = "", historyRetryAfter = 0, historyRequestInFlight = false;
    async function ensureHistory(head: GexMapPanelPayload) {
      const prior = historyRef.current?.key === key ? historyRef.current.payload : null;
      const gap = Boolean(prior && head.sessionDate === prior.sessionDate && (head.frames.at(-1)?.timestamp ?? 0) - (prior.frames.at(-1)?.timestamp ?? 0) > 2 * 60_000);
      if (sessionDate || cancelled || historyRequestInFlight || (bootstrappedDate === head.sessionDate && !gap) || Date.now() < historyRetryAfter) return;
      bootstrappedDate = head.sessionDate;
      historyRequestInFlight = true;
      const archiveKey = gexMapCacheKey(symbol, greek, head.sessionDate, profile.expiryScope, profile.representation) + (model === "DEALER_INVENTORY" ? ":dealer-v3" : "");
      const query = new URLSearchParams({ symbol, greekMode: greek, sessionDate: head.sessionDate, scope: profile.expiryScope, representation: profile.representation, model });
      try {
        // Coalesced once per mounted session. Subsequent live refreshes are
        // compact; many charts do not download full history every five seconds.
        const archive = await fetchWorkspaceData<GexMapPanelPayload>(archiveKey, "/api/gex-map?" + query, {
          maxAgeMs: gap ? 0 : 60_000, timeoutMs: 45_000,
          validate: (p) => isGexMapSurfaceFor(p as GexMapPanelPayload, { symbol, greekMode: greek, scope: profile.expiryScope, representation: profile.representation, model, sessionDate: head.sessionDate }),
        });
        if (cancelled || !hasRenderableGexMapSurface(archive)) return;
        const current = stateRef.current.key === key ? stateRef.current.payload : null;
        historyRef.current = { key, payload: mergeBounceGexMapHistory(archive, current ?? head) };
        setPaletteRevision((v) => v + 1);
      } catch { bootstrappedDate = ""; historyRetryAfter = Date.now() + 60_000; }
      finally { historyRequestInFlight = false; }
    }
    const accept = (p: GexMapPanelPayload) => {
      if (cancelled || !isGexMapSurfaceFor(p, { symbol, greekMode: greek, scope: profile.expiryScope, representation: profile.representation, model, sessionDate })) return;
      setState((current) => current.key === key && current.payload === p ? current : { key, payload: p });
      setError(null); setLoading(false);
      void ensureHistory(p);
    };
    const unsubscribe = subscribeGexMapSurface(key, accept);
    const cached = readWorkspaceData<GexMapPanelPayload>(key); if (cached) accept(cached);
    const load = async () => {
      if (cancelled) return;
      if (document.visibilityState === "hidden") { timer = setTimeout(load, 5000); return; }
      if (!stateRef.current.payload || stateRef.current.key !== key) setLoading(true);
      try {
        const query = new URLSearchParams({ symbol, greekMode: greek, scope: profile.expiryScope, representation: profile.representation,
          ...(model === "DEALER_INVENTORY" ? { model } : {}), ...(sessionDate ? { sessionDate } : { compact: "1" }) });
        const payload = await fetchWorkspaceData<GexMapPanelPayload>(key, "/api/gex-map?" + query, {
          maxAgeMs: sessionDate ? 6 * 60 * 60000 : 5000, timeoutMs: 45000,
          validate: (value) => {
            const p = value as GexMapPanelPayload;
            return isGexMapSurfaceFor(p, { symbol, greekMode: greek, scope: profile.expiryScope, representation: profile.representation, model, sessionDate });
          }, invalidMessage: "The selected GEX Map surface is unavailable.",
        });
        if (!cancelled) { accept(payload); publishGexMapSurface(key, payload); }
      } catch (e) { if (!cancelled) { setError(e instanceof Error ? e.message : "The selected GEX Map surface is unavailable."); setLoading(false); } }
      finally {
        if (!cancelled && !sessionDate) timer = setTimeout(load, Math.max(5000, Math.min(60000, stateRef.current.payload?.refreshAfterMs ?? 5000)));
      }
    };
    void load();
    return () => { cancelled = true; unsubscribe(); if (timer) clearTimeout(timer); };
  }, [input.enabled, hydrated, key, source, symbol, greek, profile.expiryScope, profile.representation, model, sessionDate]);
  const payload = state.key === key ? state.payload : null;
  const needsCanonicalMapping = /^(NQ|MNQ|ES|MES|RTY|M2K)$/.test(display);
  const mappingHistory = useBounceMappingHistory({
    enabled: input.enabled && needsCanonicalMapping, instrument: input.instrument,
    sessionDate: payload?.sessionDate ?? "", latestFrame: payload?.frames.at(-1)?.timestamp ?? 0, historical: input.timestampMs !== null,
  });
  const history = input.candles.current;
  const historyGrid = history.length + ":" + history[0]?.timestamp + ":" + history.at(-1)?.timestamp;
  const prepared = useMemo(() => {
    if (!input.enabled || !payload) return null;
    const candles = input.candles.current;
    const paired = needsCanonicalMapping ? mappingHistory.points : candles;
    const css = typeof window !== "undefined" ? getComputedStyle(document.documentElement) : null;
    const scale = gexMapSignedScaleHex(loadGexMapPalette(), { negative: css?.getPropertyValue("--danger").trim() || "#ef4444", positive: css?.getPropertyValue("--primary").trim() || "#22c55e" });
    let surface = payload;
    if (input.timestampMs === null && historyRef.current?.key === key) {
      surface = mergeBounceGexMapHistory(historyRef.current.payload, payload);
      historyRef.current = { key, payload: surface };
    }
    return prepareBounceGexMirror({ payload: surface, liveReference: payload, settings: profile, displayInstrument: display,
      historyKey: needsCanonicalMapping ? mappingHistory.key : historyGrid, mappingThrough: needsCanonicalMapping ? mappingHistory.through : Infinity,
      liveDisplayPrice: candles.at(-1)?.close ?? null, colorScale: scale,
      displayPriceAt: (timestamp) => {
        if (!needsCanonicalMapping && input.timeframe && input.timeframe !== "1m" && source !== display) return null;
        let lo = 0, hi = paired.length;
        while (lo < hi) { const mid = (lo + hi) >>> 1; if (paired[mid].timestamp <= timestamp) lo = mid + 1; else hi = mid; }
        const c = paired[lo - 1]; if (!c || (needsCanonicalMapping && timestamp >= c.timestamp + 60_000)) return null;
        // A containing candle's final close is not evidence of an earlier
        // intrabar price. Its known open is a causal mapping reference.
        return c.open;
      } });
    // The ref supplies the current real chart history when a new map surface
    // arrives; OHLC price ticks must not rebuild all exposure history.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.enabled, payload, profile, display, paletteRevision, historyGrid, key, needsCanonicalMapping, mappingHistory.key, mappingHistory.through, mappingHistory.points, input.timeframe, source]);
  const snapshot = useMemo(() => prepared ? selectBounceGexMirror(prepared, input.timestampMs) : null, [prepared, input.timestampMs]);
  return { snapshot, profile, loading, error, key };
}
