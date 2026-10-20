"use client";

import { useEffect, useRef, useState } from "react";
import {usePathname,useRouter,useSearchParams} from "next/navigation";
import { writeProtectedItem } from "@/lib/browserStorageQuota";
import { PREFERENCES_HYDRATED_EVENT } from "@/lib/userPreferences";
import { loadStoredChartSettings } from "@/lib/chartSettings";
import { acquireKwantyPrices, type KwantyPriceHost } from "@/lib/kwantyPriceBridge";
import type { StateDrawingApi, StateDrawingMount } from "@/lib/kwantyStateDrawingAdapter";

const STORAGE_KEY = "kwantdesk:kwanty:workspace:v1";
type BotSiteHost = KwantyPriceHost & {
  mountStateDrawings(element: HTMLElement, api: StateDrawingApi): Promise<StateDrawingMount>;
  active: boolean;
  read: (key: string) => string | null;
  write: (key: string, value: string | null) => void;
  theme: () => Record<string, string>;
  timezone: () => string;
  request: (url: string, options?: RequestInit) => Promise<Response>;
  snapshot: () => Record<string, string>;
  restore: (values: Record<string, string>) => void;
};
declare global { interface Window { __kwantyHost?: BotSiteHost } }

function broadcast(frame: Window | null, type: string, detail = {}) {
  if (!frame) return;
  try {
    frame.postMessage({ type, ...detail }, window.location.origin);
    for (let index = 0; index < frame.frames.length; index++) broadcast(frame.frames[index], type, detail);
  } catch { /* Closed popouts and navigating frames need no notification. */ }
}

export default function KwantyWorkspace({ accountKey, active: sectionActive = true }: { accountKey: string; active?: boolean }) {
  const search=useSearchParams(),router=useRouter(),pathname=usePathname(),legacyCalendar=pathname==='/kwanty'&&search.get('view')==='calendar',active=sectionActive&&!legacyCalendar;
  useEffect(()=>{if(legacyCalendar)router.replace('/news?view=options-expirations');},[legacyCalendar,router]);
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [generation, setGeneration] = useState(0);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    if (!accountKey) return;
    let disposed = false;
    const prices = acquireKwantyPrices(accountKey);
    const controllers = new Set<AbortController>();
    const pending = new Map<string, Promise<{ text: string; status: number; headers: [string, string][]; until: number }>>();
    const cache = new Map<string, { text: string; status: number; headers: [string, string][]; until: number }>();
    let running = 0;
    const waiting: Array<() => void> = [];
    const readValues = (): Record<string, string> => {
      try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); return saved?.accountKey === accountKey ? saved.values ?? {} : {}; }
      catch { return {}; }
    };
    const host: BotSiteHost = {
      mountStateDrawings: (element, api) => import("./StateChartTools").then(module => module.mountStateChartTools(element, api)),
      priceHistory: prices.priceHistory,
      subscribePrice: prices.subscribePrice,
      active: activeRef.current,
      timezone: () => loadStoredChartSettings().timezone,
      read: key => readValues()[key] ?? null,
      write: (key, value) => {
        if (disposed || !key.startsWith("kwanty") || key.length > 200) return;
        const values = readValues();
        if (value === null) delete values[key]; else values[key] = value;
        const serialized = JSON.stringify({ accountKey, values });
        if (serialized.length > 1_500_000 || Object.keys(values).length > 500 || !writeProtectedItem(STORAGE_KEY, serialized).ok) {
          throw new Error("The workspace could not be saved. Export a backup before continuing.");
        }
      },
      theme: () => {
        const style = getComputedStyle(document.documentElement);
        const names = ["background", "panel", "surface", "foreground", "muted", "border", "primary", "accent", "danger", "warning"];
        const result = Object.fromEntries(names.map(name => [name, style.getPropertyValue(`--${name}`).trim()]));
        result.bullish = style.getPropertyValue("--candle-up").trim() || result.primary;
        result.bearish = style.getPropertyValue("--candle-down").trim() || result.danger;
        return Object.fromEntries(Object.entries(result).filter(([, value]) => value));
      },
      snapshot: () => Object.fromEntries(Object.entries(readValues()).filter(([key]) => key !== "kwanty:saved-workspaces:v1" && key !== "kwanty:select-preferences:v1")),
      restore: values => {
        if (!values || typeof values !== "object" || Array.isArray(values) || Object.keys(values).length > 500 || Object.entries(values).some(([key, value]) => !key.startsWith("kwanty") || key === "kwanty:saved-workspaces:v1" || typeof value !== "string")) throw new Error("Invalid KWANTY workspace.");
        const presets = readValues()["kwanty:saved-workspaces:v1"];
        const selectPreferences = readValues()["kwanty:select-preferences:v1"];
        const serialized = JSON.stringify({ accountKey, values: { ...values, ...(presets ? { "kwanty:saved-workspaces:v1": presets } : {}), ...(selectPreferences ? { "kwanty:select-preferences:v1": selectPreferences } : {}) } });
        if (serialized.length > 1_500_000 || !writeProtectedItem(STORAGE_KEY, serialized).ok) throw new Error("The workspace could not be saved.");
      },
      request: async (url, options = {}) => {
        if (disposed || !activeRef.current) throw new Error("This workspace is paused.");
        if (!/^\/api\/kwanty\/(?:status|catalog|snapshot|history)(?:\?[^#]*)?$/.test(url)) throw new Error("Unsupported data request.");
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
    window.__kwantyHost = host;
    setGeneration(value => value + 1); setReady(true);
    const themeChanged = () => broadcast(frame.current?.contentWindow ?? null, "kwanty-site-theme");
    const hydrated = () => { cache.clear(); setGeneration(value => value + 1); };
    window.addEventListener("kwantdesk:theme-change", themeChanged);
    window.addEventListener("olisa-theme-change", themeChanged);
    window.addEventListener(PREFERENCES_HYDRATED_EVENT, hydrated);
    const observer = new MutationObserver(themeChanged);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class", "data-theme"] });
    return () => {
      disposed = true; prices.release(); setReady(false); controllers.forEach(controller => controller.abort());
      waiting.splice(0).forEach(resolve => resolve()); cache.clear(); pending.clear(); observer.disconnect();
      window.removeEventListener("kwantdesk:theme-change", themeChanged);
      window.removeEventListener("olisa-theme-change", themeChanged);
      window.removeEventListener(PREFERENCES_HYDRATED_EVENT, hydrated);
      if (window.__kwantyHost === host) delete window.__kwantyHost;
    };
  }, [accountKey]);

  useEffect(() => {
    if (window.__kwantyHost) window.__kwantyHost.active = active;
    broadcast(frame.current?.contentWindow ?? null, "kwanty-site-activity", { active });
  }, [active]);

  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const requestedTool = params.get("botView"); params.delete("botView"); params.delete("view"); params.set("v", "8");
  const src = `/kwanty-app/index.html?${params}${requestedTool && /^[a-z-]+$/.test(requestedTool) ? `#${requestedTool}` : "#orderflow"}`;
  return <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background" aria-label="KWANTY workspace">
    <div className="flex min-h-0 flex-1">
    {ready && !legacyCalendar ? <iframe key={`${accountKey}:${generation}`} ref={frame} src={src}
      title="KWANTY tools and workspace" className="h-full w-full border-0" allow="fullscreen"
      onLoad={() => broadcast(frame.current?.contentWindow ?? null, "kwanty-site-activity", { active: activeRef.current })} />
      : null}
    </div>
  </section>;
}
