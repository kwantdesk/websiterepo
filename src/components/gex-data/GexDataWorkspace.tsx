"use client";

import { useEffect, useRef, useState } from "react";
import { writeProtectedItem } from "@/lib/browserStorageQuota";
import { PREFERENCES_HYDRATED_EVENT } from "@/lib/userPreferences";
import { CHART_SETTINGS_CHANGE_EVENT, CHART_SETTINGS_STORAGE_KEY, defaultChartSettings, loadStoredChartSettings } from "@/lib/chartSettings";
import { MARKET_INDEX_DEFINITIONS } from "@/lib/marketIndices";
import TimeZoneSelect, { CHART_TIME_ZONE_TRIGGER_CLASS_NAME } from "@/components/ui/TimeZoneSelect";
import { normalizeTimeZone } from "@/lib/timeZones";
import GexPaletteSettings from "./GexPaletteSettings";
import { GEX_MAP_PALETTE_PRESETS } from "@/lib/gexMapPalette";
import { resolveGexBoxRoles } from "@/lib/gexBoxTheme";

const STORAGE_KEY = "kwantdesk:gex-data:workspace:v1";
const TIME_ZONE_KEY = "gex-data-timezone";
const PALETTE_KEY = "gex-data:palette:v1";
const validPalette = (id: string | null) => id === "site" || GEX_MAP_PALETTE_PRESETS.some(preset => preset.id === id);
type SiteHost = {
  active: boolean;
  read: (key: string) => string | null;
  write: (key: string, value: string | null) => void;
  theme: () => Record<string, string>;
  timezone: () => string;
  openPalette: () => void;
  instruments: () => Array<[string, string]>;
  request: (url: string, options?: RequestInit) => Promise<Response>;
  snapshot: () => Record<string, string>;
  restore: (values: Record<string, string>) => void;
};
declare global { interface Window { __kwantGexDataHost?: SiteHost } }

function broadcast(frame: Window | null, type: string, detail = {}) {
  if (!frame) return;
  try {
    frame.postMessage({ type, ...detail }, window.location.origin);
    for (let index = 0; index < frame.frames.length; index++) broadcast(frame.frames[index], type, detail);
  } catch { /* Closed popouts and navigating frames need no notification. */ }
}

export default function GexDataWorkspace({ accountKey, active = true }: { accountKey: string; active?: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [timeZone, setTimeZone] = useState(defaultChartSettings.timezone);
  const [showPalette, setShowPalette] = useState(false);
  const [paletteId, setPaletteId] = useState("site");
  const paletteRef = useRef("site");
  const timeZoneRef = useRef(timeZone);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    if (!accountKey) return;
    let disposed = false;
    const controllers = new Set<AbortController>();
    const pending = new Map<string, Promise<{ text: string; status: number; headers: [string, string][]; until: number }>>();
    const cache = new Map<string, { text: string; status: number; headers: [string, string][]; until: number }>();
    let running = 0;
    const waiting: Array<() => void> = [];
    const readValues = (): Record<string, string> => {
      try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); return saved?.accountKey === accountKey ? saved.values ?? {} : {}; }
      catch { return {}; }
    };
    const syncTimeZone = () => {
      const next = normalizeTimeZone(readValues()[TIME_ZONE_KEY] || loadStoredChartSettings().timezone);
      const changed = next !== timeZoneRef.current;
      timeZoneRef.current = next;
      setTimeZone(next);
      if (changed) broadcast(frame.current?.contentWindow ?? null, "gex-data-site-timezone");
    };
    const syncPalette = () => {
      const saved = readValues()[PALETTE_KEY];
      const next = validPalette(saved) ? saved : "site";
      const changed = next !== paletteRef.current;
      paletteRef.current = next;
      setPaletteId(paletteRef.current);
      if (changed) broadcast(frame.current?.contentWindow ?? null, "gex-data-site-theme");
    };
    syncTimeZone();
    syncPalette();
    const host: SiteHost = {
      active: activeRef.current,
      openPalette: () => setShowPalette(true),
      timezone: () => timeZoneRef.current,
      instruments: () => MARKET_INDEX_DEFINITIONS.filter(item => item.symbol === "VIX" || item.group === "Options Underlyings" && item.symbol !== "SPXW").map(item => [item.symbol, `${item.symbol} — ${item.displayName}`]),
      read: key => readValues()[key] ?? null,
      write: (key, value) => {
        if (disposed || !key.startsWith("gex-data") || key.length > 200) return;
        const values = readValues();
        if (value === null) delete values[key]; else values[key] = value;
        const serialized = JSON.stringify({ accountKey, values });
        if (serialized.length > 1_500_000 || Object.keys(values).length > 500 || !writeProtectedItem(STORAGE_KEY, serialized).ok) {
          throw new Error("The workspace could not be saved. Export a backup before continuing.");
        }
        if (key === TIME_ZONE_KEY) syncTimeZone();
        if (key === PALETTE_KEY) syncPalette();
      },
      theme: () => {
        const style = getComputedStyle(document.documentElement);
        const names = ["background", "panel", "surface", "foreground", "muted", "border", "primary", "accent", "danger", "warning"];
        const result = Object.fromEntries(names.map(name => [name, style.getPropertyValue(`--${name}`).trim()]));
        result.bullish = style.getPropertyValue("--candle-up").trim() || result.primary;
        result.bearish = style.getPropertyValue("--candle-down").trim() || result.danger;
        if (paletteRef.current !== "site") {
          const roles = resolveGexBoxRoles(paletteRef.current);
          Object.assign(result, { bullish: roles.call, bearish: roles.put, accent: roles.callSoft, warning: roles.net, chartPrimary: roles.net, chartHeader: roles.header, chartStrike: roles.strike });
        }
        return Object.fromEntries(Object.entries(result).filter(([, value]) => value));
      },
      snapshot: () => Object.fromEntries(Object.entries(readValues()).filter(([key]) => key !== "gex-data:saved-workspaces:v1")),
      restore: values => {
        if (!values || typeof values !== "object" || Array.isArray(values) || Object.keys(values).length > 500 || Object.entries(values).some(([key, value]) => !key.startsWith("gex-data") || key === "gex-data:saved-workspaces:v1" || typeof value !== "string")) throw new Error("Invalid GEX DATA workspace.");
        const presets = readValues()["gex-data:saved-workspaces:v1"];
        const serialized = JSON.stringify({ accountKey, values: { ...values, ...(presets ? { "gex-data:saved-workspaces:v1": presets } : {}) } });
        if (serialized.length > 1_500_000 || !writeProtectedItem(STORAGE_KEY, serialized).ok) throw new Error("The workspace could not be saved.");
        syncTimeZone();
        syncPalette();
      },
      request: async (url, options = {}) => {
        if (disposed || !activeRef.current) throw new Error("This workspace is paused.");
        if (!/^\/api\/gex-data\/[a-z-]+$/.test(url)) throw new Error("Unsupported data request.");
        const key = `${url}:${options.body ?? ""}`;
        let entry = cache.get(key);
        if (!entry || entry.until < Date.now()) {
          let job = pending.get(key);
          if (!job) {
            if (pending.size >= 32) throw new Error("Too many active requests. Try again shortly.");
            job = (async () => {
              if (running >= 4) await new Promise<void>(resolve => waiting.push(resolve));
              running++;
              const controller = new AbortController(); controllers.add(controller);
              const timeout = window.setTimeout(() => controller.abort(), 35_000);
              try {
                if (disposed || !activeRef.current) throw new Error("This workspace is paused.");
                const response = await fetch(url, { ...options, signal: controller.signal, credentials: "same-origin" });
                const text = await response.text();
                if (text.length > 12_000_000) throw new Error("The data response is too large. Narrow the selected range.");
                const maxAge = Number(response.headers.get("Cache-Control")?.match(/max-age=(\d+)/)?.[1] ?? 0) * 1000;
                const value = { text, status: response.status, headers: [...response.headers.entries()] as [string, string][], until: Date.now() + Math.min(maxAge, 300_000) };
                if (response.ok) {
                  cache.delete(key); cache.set(key, value);
                  let total = [...cache.values()].reduce((sum, item) => sum + item.text.length, 0);
                  while (cache.size > 48 || total > 24_000_000) { const oldest = cache.keys().next().value!; total -= cache.get(oldest)!.text.length; cache.delete(oldest); }
                }
                return value;
              } finally { clearTimeout(timeout); controllers.delete(controller); running--; waiting.shift()?.(); }
            })().finally(() => pending.delete(key));
            pending.set(key, job);
          }
          entry = await job;
        }
        return new Response(entry.text, { status: entry.status, headers: entry.headers });
      },
    };
    window.__kwantGexDataHost = host;
    setGeneration(value => value + 1); setReady(true);
    const themeChanged = () => broadcast(frame.current?.contentWindow ?? null, "gex-data-site-theme");
    const hydrated = (event: Event) => { const keys = (event as CustomEvent<{ keys?: string[] }>).detail?.keys; if (keys && !keys.some(key => key.startsWith("kwantdesk:gex-data:") || key === "olisa-theme" || key === CHART_SETTINGS_STORAGE_KEY)) return; syncTimeZone(); syncPalette(); cache.clear(); setGeneration(value => value + 1); };
    const storageChanged = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === CHART_SETTINGS_STORAGE_KEY || event.key === null) syncTimeZone();
      if (event.key === STORAGE_KEY || event.key === null) syncPalette();
    };
    window.addEventListener("kwantdesk:theme-change", themeChanged);
    window.addEventListener("olisa-theme-change", themeChanged);
    window.addEventListener(PREFERENCES_HYDRATED_EVENT, hydrated);
    window.addEventListener(CHART_SETTINGS_CHANGE_EVENT, syncTimeZone);
    window.addEventListener("storage", storageChanged);
    const observer = new MutationObserver(themeChanged);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class", "data-theme"] });
    return () => {
      disposed = true; setReady(false); controllers.forEach(controller => controller.abort());
      waiting.splice(0).forEach(resolve => resolve()); cache.clear(); pending.clear(); observer.disconnect();
      window.removeEventListener("kwantdesk:theme-change", themeChanged);
      window.removeEventListener("olisa-theme-change", themeChanged);
      window.removeEventListener(PREFERENCES_HYDRATED_EVENT, hydrated);
      window.removeEventListener(CHART_SETTINGS_CHANGE_EVENT, syncTimeZone);
      window.removeEventListener("storage", storageChanged);
      if (window.__kwantGexDataHost === host) delete window.__kwantGexDataHost;
    };
  }, [accountKey]);

  useEffect(() => {
    if (window.__kwantGexDataHost) window.__kwantGexDataHost.active = active;
    broadcast(frame.current?.contentWindow ?? null, "gex-data-site-activity", { active });
  }, [active]);

  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const requestedTool = params.get("gexTool"); params.delete("gexTool"); params.set("v", "20261027-stable-font"); params.set("hostTimezone", "1");
  const src = `/gex-data-app/index.html?${params}${requestedTool && /^[a-z-]+$/.test(requestedTool) ? `#tool=${requestedTool}` : ""}`;
  return <section className="relative h-full min-h-0 flex-1 overflow-hidden bg-background" aria-label="GEX DATA workspace">
    {showPalette && <GexPaletteSettings includeSiteTheme paletteId={paletteId}
      onPreview={id => { paletteRef.current = id; broadcast(frame.current?.contentWindow ?? null, "gex-data-site-theme"); }}
      onSave={id => { window.__kwantGexDataHost?.write(PALETTE_KEY, id); setShowPalette(false); }}
      onClose={() => setShowPalette(false)} />}
    {ready && <div className="absolute right-2 top-[5px] z-30 flex h-7 items-center bg-background">
      <TimeZoneSelect value={timeZone} onChange={next => window.__kwantGexDataHost?.write(TIME_ZONE_KEY, normalizeTimeZone(next))}
        menuLabel="Chart timezone" compact className={CHART_TIME_ZONE_TRIGGER_CLASS_NAME} />
    </div>}
    {ready ? <iframe key={`${accountKey}:${generation}`} ref={frame} src={src}
      title="GEX DATA tools and workspace" className="h-full w-full border-0" allow="fullscreen"
      onLoad={() => broadcast(frame.current?.contentWindow ?? null, "gex-data-site-activity", { active: activeRef.current })} />
      : null}
  </section>;
}
