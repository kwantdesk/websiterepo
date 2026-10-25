"use client";

import { useEffect, useId, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MARKET_INDEX_DEFINITIONS } from "@/lib/marketIndices";
import { loadStoredChartSettings } from "@/lib/chartSettings";
import { acquireOptionsFlowRequests } from "@/lib/optionsFlowRequests";
import { normalizeOptionsFlowState, optionsFlowTool, optionsFlowInitialSymbol, type OptionsFlowPanelKind, type OptionsFlowState } from "@/lib/optionsFlowTools";
import KwantLoader from "@/components/KwantLoader";
import { acquireKwantyPrices, type KwantyPriceHost } from "@/lib/kwantyPriceBridge";
import type { StateDrawingApi, StateDrawingMount } from "@/lib/kwantyStateDrawingAdapter";
import { WORKSPACE_REPLAY_SNAPSHOT_TOOLS, type WorkspaceReplayClock } from "@/lib/workspaceReplay";

const BoxTool = dynamic(() => import("@/components/gexbot/GexBoxDashboard").then(module => module.GexBoxToolPanel), { ssr: false });
const Calendar = dynamic(() => import("@/components/news/OptionsExpirationCalendar"), { ssr: false, loading: () => null });
type ToolHost = Partial<KwantyPriceHost> & {
  mountStateDrawings?(element: HTMLElement, api: StateDrawingApi): Promise<StateDrawingMount>;
  active: boolean; read(key: string): string | null; write(key: string, value: string | null): void;
  theme(): Record<string, string>; timezone(): string; instruments(): Array<[string, string]>;
  request(url: string, options?: RequestInit): Promise<Response>;
  snapshot(): OptionsFlowState; restore(value: OptionsFlowState): void;
  replay(): WorkspaceReplayClock | null;
};
declare global { interface Window { __kwantOptionsToolHosts?: Record<string, ToolHost> } }

export default function OptionsFlowToolPanel({ kind, panelId, accountKey, instrument, state, onChange, onActivate, active = true, replay = null }: {
  kind: OptionsFlowPanelKind; panelId: string; accountKey: string; instrument: string;
  state?: OptionsFlowState; onChange(value: OptionsFlowState): void; onActivate?(): void; active?: boolean;
  replay?: WorkspaceReplayClock | null;
}) {
  const tool = optionsFlowTool(kind);
  if (!tool) return <div role="status">This options tool is unavailable.</div>;
  if (replay && (tool.source === "gex-box" || tool.toolId === "calendar" || tool.source === "gex-data" && !(WORKSPACE_REPLAY_SNAPSHOT_TOOLS as readonly string[]).includes(tool.toolId))) return <div role="status" className="flex h-full items-center justify-center bg-background p-6 text-center text-xs text-muted">{tool.label}: no timestamped replay adapter is available. Live data is paused in this panel.</div>;
  if (tool.source === "gex-box") return <BoxTool key={`${accountKey}:${kind}:${panelId}`} accountKey={accountKey} toolId={tool.toolId} panelId={panelId} state={state} onChange={onChange} active={active} />;
  if (tool.toolId === "calendar") return <Calendar accountKey={accountKey} active={active} />;
  return <ToolFrame key={`${accountKey}:${kind}:${panelId}`} tool={tool} panelId={panelId} accountKey={accountKey}
    instrument={instrument} state={state} onChange={onChange} onActivate={onActivate} active={active} replay={replay} />;
}

function ToolFrame({ tool, panelId, accountKey, instrument, state, onChange, onActivate, active, replay }: {
  tool: NonNullable<ReturnType<typeof optionsFlowTool>>; panelId: string; accountKey: string; instrument: string;
  state?: OptionsFlowState; onChange(value: OptionsFlowState): void; onActivate?(): void; active: boolean;
  replay: WorkspaceReplayClock | null;
}) {
  const hostId = useId();
  const frame = useRef<HTMLIFrameElement>(null);
  const values = useRef(normalizeOptionsFlowState(state));
  const change = useRef(onChange); change.current = onChange;
  const activate = useRef(onActivate); activate.current = onActivate;
  const activeRef = useRef(active); activeRef.current = active;
  const replayRef = useRef(replay); replayRef.current = replay;
  const [ready, setReady] = useState(false);
  const [generation, setGeneration] = useState(0);
  useEffect(() => { values.current = normalizeOptionsFlowState(state); }, [state]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const focus = () => { timer = setTimeout(() => { if (document.activeElement === frame.current) activate.current?.(); }, 0); };
    window.addEventListener("blur", focus);
    return () => { clearTimeout(timer); window.removeEventListener("blur", focus); };
  }, []);
  useEffect(() => {
    if (!accountKey) return;
    const requests = acquireOptionsFlowRequests(accountKey);
    const prices = tool.source === "kwanty" ? acquireKwantyPrices(accountKey) : null;
    const prefix = tool.source === "kwanty" ? "kwanty" : "gex-data";
    let closed = false;
    const save = (next: OptionsFlowState) => {
      if (closed) return;
      if (Object.keys(next).length > 500 || JSON.stringify(next).length > 1_500_000) throw new Error("Tool settings are too large. Export a backup.");
      values.current = next; change.current(next);
    };
    const host: ToolHost = {
      ...(tool.source === "kwanty" ? { mountStateDrawings: (element: HTMLElement, api: StateDrawingApi) => import("@/components/kwanty/StateChartTools").then(module => module.mountStateChartTools(element, api)) } : {}),
      ...(prices ? {
        priceHistory: (symbol, date) => prices.priceHistory(symbol, replayRef.current?.sessionDate ?? date),
        subscribePrice: (symbol, listener, onError) => replayRef.current ? () => {} : prices.subscribePrice(symbol, listener, onError),
      } satisfies Partial<KwantyPriceHost> : {}),
      active: activeRef.current,
      replay: () => replayRef.current,
      read: key => values.current[key] ?? null,
      write: (key, value) => {
        if (!key.startsWith(prefix) || key.length > 240) throw new Error("Invalid tool setting.");
        const next = { ...values.current };
        if (value === null) delete next[key]; else next[key] = value;
        save(next);
      },
      snapshot: () => ({ ...values.current }),
      restore: value => {
        const next = normalizeOptionsFlowState(value);
        if (Object.keys(next).some(key => !key.startsWith(prefix))) throw new Error("Invalid tool settings.");
        save(next);
      },
      timezone: () => loadStoredChartSettings().timezone,
      instruments: () => MARKET_INDEX_DEFINITIONS.filter(item => item.symbol === "VIX" || item.group === "Options Underlyings" && item.symbol !== "SPXW").map(item => [item.symbol, `${item.symbol} — ${item.displayName}`]),
      theme: () => {
        const style = getComputedStyle(document.documentElement);
        const theme = Object.fromEntries(["background", "panel", "surface", "foreground", "muted", "border", "primary", "accent", "danger", "warning"].map(name => [name, style.getPropertyValue(`--${name}`).trim()]));
        return { ...theme, bullish: style.getPropertyValue("--candle-up").trim() || theme.primary, bearish: style.getPropertyValue("--candle-down").trim() || theme.danger };
      },
      request: (url, options) => {
        if (closed || !activeRef.current) return Promise.reject(new Error("This panel is paused."));
        if (replayRef.current && url.startsWith("/api/kwanty/snapshot")) return Promise.reject(new Error("Live snapshots are disabled during workspace replay."));
        return requests.request(url, options);
      },
    };
    const registry = window.__kwantOptionsToolHosts ??= {};
    registry[hostId] = host; setGeneration(value => value + 1); setReady(true);
    const themeChanged = () => frame.current?.contentWindow?.postMessage({ type: `${prefix}-site-theme` }, location.origin);
    const observer = new MutationObserver(themeChanged);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class", "data-theme"] });
    window.addEventListener("olisa-theme-change", themeChanged);
    return () => {
      closed = true; host.active = false;
      frame.current?.contentWindow?.postMessage({ type: `${prefix}-site-activity`, active: false }, location.origin);
      delete registry[hostId]; requests.release(); prices?.release(); observer.disconnect(); window.removeEventListener("olisa-theme-change", themeChanged);
    };
  }, [accountKey, hostId, tool.source]);
  const sendActivity = () => {
    const host = window.__kwantOptionsToolHosts?.[hostId]; if (host) host.active = active;
    frame.current?.contentWindow?.postMessage({ type: `${tool.source}-site-activity`, active }, location.origin);
    frame.current?.contentWindow?.postMessage({ type: "kwantdesk-workspace-replay", replay: replayRef.current }, location.origin);
  };
  useEffect(sendActivity, [active, hostId, tool.source]);
  useEffect(() => { frame.current?.contentWindow?.postMessage({ type: "kwantdesk-workspace-replay", replay }, location.origin); }, [replay]);
  const source = tool.source;
  const symbol = optionsFlowInitialSymbol(instrument, MARKET_INDEX_DEFINITIONS.map(item => item.symbol));
  const params = new URLSearchParams({ hostId, instance: "panel", v: source === "kwanty" ? "14" : "5", ...(source === "gex-data" ? { embed: "1", c_ticker: symbol } : { ticker: symbol }) });
  const src = source === "gex-data" ? `/gex-data-app/index.html?${params}#tool=${tool.toolId}` : `/kwanty-app/index.html?${params}#${tool.toolId}`;
  return <div className="h-full min-h-0 w-full overflow-hidden bg-background" data-options-flow-panel={panelId}>
    {ready ? <iframe key={generation} ref={frame} src={src} title={`${tool.description.split(" · ")[0]} · ${tool.label}`} className="h-full w-full border-0" onLoad={sendActivity} allow="fullscreen" />
      : <KwantLoader compact className="h-full" title={`Opening ${tool.label}`} />}
  </div>;
}
