"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { GexMapDropdown } from "@/components/gex-map/GexMapWorkspace";
import { gexMapSignedScale, type GexMapPalette } from "@/lib/gexMapPalette";
import { OPTIONS_FLOW_INSTRUMENTS } from "@/lib/optionsFlow";

// GEX MAP · FUTURE view: the forward positioning matrix. Strikes run down the
// left, one column per upcoming EXPIRY inside the lookahead window, and every
// cell is that (strike, expiry)'s real signed exposure from the same
// QuantData surface GEX CAL reads — GEX (gamma) or VEX (vanna). Colouring
// follows the map's Star convention exactly: zero pinned to the scale middle,
// the Star cell alone reaching its end of the gradient, everything else
// placed by its share of the Star's magnitude, so noise sits quiet and the
// forward structure jumps out.

type FutureChain = {
  symbol: string;
  greekMode: string;
  sessionDate: string;
  asOf: string;
  status: "LIVE" | "LAST_SESSION";
  stockPrice: number | null;
  expiries: Array<{ expiration: string; net: number }>;
  expiryStrikes: Array<{ expiration: string; strike: number; call: number; put: number; net: number }>;
};

const FUTURE_SETTINGS_KEY = "kwantdesk:gex-map-future:v1";
const LOOKAHEAD_CHOICES = [7, 14, 21, 30, 60] as const;

type FutureGreek = "GAMMA" | "VANNA";
type FutureValueMode = "star-percent" | "signed";

type FutureSettings = {
  symbol: string;
  greek: FutureGreek;
  lookaheadDays: number;
  valueMode: FutureValueMode;
  highlightPercent: number;
};

const DEFAULT_FUTURE_SETTINGS: FutureSettings = {
  symbol: "SPX",
  greek: "GAMMA",
  lookaheadDays: 14,
  valueMode: "star-percent",
  highlightPercent: 0,
};

function loadFutureSettings(): FutureSettings {
  if (typeof window === "undefined") return DEFAULT_FUTURE_SETTINGS;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FUTURE_SETTINGS_KEY) || "{}") as Partial<FutureSettings>;
    return {
      symbol: OPTIONS_FLOW_INSTRUMENTS.some((item) => item.symbol === parsed.symbol) ? String(parsed.symbol) : "SPX",
      greek: parsed.greek === "VANNA" ? "VANNA" : "GAMMA",
      lookaheadDays: LOOKAHEAD_CHOICES.includes(Number(parsed.lookaheadDays) as typeof LOOKAHEAD_CHOICES[number])
        ? Number(parsed.lookaheadDays)
        : 14,
      valueMode: parsed.valueMode === "signed" ? "signed" : "star-percent",
      highlightPercent: Math.min(90, Math.max(0, Number(parsed.highlightPercent) || 0)),
    };
  } catch {
    return DEFAULT_FUTURE_SETTINGS;
  }
}

function formatCompactDollars(value: number) {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (absolute >= 1_000_000_000) return `${sign}$${(absolute / 1_000_000_000).toFixed(2)}B`;
  if (absolute >= 1_000_000) return `${sign}$${(absolute / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `${sign}$${(absolute / 1_000).toFixed(0)}K`;
  return `${sign}$${absolute.toFixed(0)}`;
}

function expirationHeading(expiration: string) {
  // "2026-09-04" → "09-04 Fri" — compact, still unambiguous across months.
  const parsed = new Date(`${expiration}T12:00:00Z`);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" }).format(parsed);
  return { date: expiration.slice(5), weekday };
}

export default function GexMapFutureMatrix({ palette, zoom = 1 }: { palette: GexMapPalette; zoom?: number }) {
  const [settings, setSettings] = useState<FutureSettings>(() => loadFutureSettings());
  const [chain, setChain] = useState<FutureChain | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSeqRef = useRef(0);

  const patchSettings = useCallback((patch: Partial<FutureSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      try {
        window.localStorage.setItem(FUTURE_SETTINGS_KEY, JSON.stringify(next));
        window.dispatchEvent(new CustomEvent("kwantdesk:preferences-changed"));
      } catch {
        // Preference persistence is a convenience, never a blocker.
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const sequence = ++requestSeqRef.current;
    const load = async () => {
      try {
        const query = new URLSearchParams({
          symbol: settings.symbol,
          greekMode: settings.greek,
        });
        const response = await fetch(`/api/gex-map/future?${query}`, { cache: "no-store", credentials: "include" });
        const payload = await response.json().catch(() => null) as (FutureChain & { error?: string }) | null;
        if (cancelled || requestSeqRef.current !== sequence) return;
        if (!response.ok || !payload || !Array.isArray(payload.expiryStrikes)) {
          setError(payload?.error || "The forward exposure chain is unavailable.");
          setLoading(false);
          return;
        }
        setChain(payload);
        setError(null);
        setLoading(false);
      } catch {
        if (!cancelled && requestSeqRef.current === sequence) {
          setError("The forward exposure surface could not refresh.");
          setLoading(false);
        }
      }
    };
    setLoading(true);
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [settings.greek, settings.symbol]);

  const signedScale = useMemo(() => gexMapSignedScale(palette), [palette]);

  const view = useMemo(() => {
    if (!chain) return null;
    const horizonMs = Date.now() + settings.lookaheadDays * 24 * 60 * 60_000;
    // Every listed expiration from the session forward, inside the window —
    // dailies, weeklies and monthlies alike, straight from the full chain.
    const expirations = [...new Set(chain.expiryStrikes.map((row) => row.expiration))]
      .filter((expiration) => expiration >= chain.sessionDate
        && Date.parse(`${expiration}T21:00:00Z`) <= horizonMs)
      .sort();
    if (!expirations.length) return { expirations: [], strikes: [], cells: new Map<string, number>(), starKey: "", starMagnitude: 1, columnStars: new Map<string, number>() };
    const included = new Set(expirations);
    const cells = new Map<string, number>();
    const strikeSet = new Set<number>();
    // Each expiry column gets its own star (largest absolute exposure in that
    // column) so the forward structure highlights per DAY, not one lone cell.
    const columnStars = new Map<string, number>();
    const columnStarMagnitudes = new Map<string, number>();
    let starMagnitude = 0;
    let starKey = "";
    for (const row of chain.expiryStrikes) {
      if (!included.has(row.expiration)) continue;
      // EVERY listed strike stays in the ladder — a continuous scroll with no
      // jumps. Zero cells render dim, they are never dropped as rows.
      strikeSet.add(row.strike);
      if (row.net === 0) continue;
      const key = `${row.expiration}:${row.strike}`;
      cells.set(key, row.net);
      const magnitude = Math.abs(row.net);
      if (magnitude > starMagnitude) {
        starMagnitude = magnitude;
        starKey = key;
      }
      if (magnitude > (columnStarMagnitudes.get(row.expiration) ?? 0)) {
        columnStarMagnitudes.set(row.expiration, magnitude);
        columnStars.set(row.expiration, row.strike);
      }
    }
    const strikes = [...strikeSet].sort((a, b) => b - a);
    return { expirations, strikes, cells, starKey, starMagnitude: Math.max(1, starMagnitude), columnStars };
  }, [chain, settings.lookaheadDays]);

  const spotStrike = useMemo(() => {
    if (!chain?.stockPrice || !view?.strikes.length) return null;
    return view.strikes.reduce((best, strike) =>
      Math.abs(strike - chain.stockPrice!) < Math.abs(best - chain.stockPrice!) ? strike : best);
  }, [chain, view]);

  // Every load, refresh, or window change: pin horizontal scroll back to zero
  // (a leftover offset detached the sticky strike column and left a gap on
  // its left) and centre the spot strike vertically, like the ladder panels.
  const scrollRef = useRef<HTMLDivElement>(null);
  const spotRowRef = useRef<HTMLTableRowElement>(null);
  const centeredKeyRef = useRef("");
  useEffect(() => {
    if (!view?.strikes.length || spotStrike === null) return;
    const key = `${chain?.symbol}:${chain?.greekMode}:${settings.lookaheadDays}`;
    if (centeredKeyRef.current === key) return;
    const container = scrollRef.current;
    const row = spotRowRef.current;
    if (!container || !row) return;
    centeredKeyRef.current = key;
    // scrollIntoView is CSS-zoom-aware; manual offsetTop math undershot by
    // the zoom factor. Horizontal scroll is pinned back to zero afterwards so
    // the sticky strike column never sits detached with a gap on its left.
    row.scrollIntoView({ block: "center" });
    container.scrollLeft = 0;
  }, [chain?.greekMode, chain?.symbol, settings.lookaheadDays, spotStrike, view]);

  const chip = "flex h-6 items-center rounded-[3px] border border-border/70 bg-background/35 px-2 text-[9px] font-semibold uppercase leading-none tracking-[0.075em]";

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border bg-panel px-2 py-1.5">
        <div className="w-[104px] shrink-0">
        <GexMapDropdown
          ariaLabel="Forward matrix underlying"
          value={settings.symbol}
          options={OPTIONS_FLOW_INSTRUMENTS.map((instrument) => ({
            value: instrument.symbol,
            label: instrument.symbol,
            detail: instrument.label,
          }))}
          menuLabel="Underlying"
          menuWidth={224}
          onChange={(symbol) => patchSettings({ symbol })}
        />
        </div>
        <div className="flex h-6 items-center rounded-[3px] border border-border/70 bg-background/35 p-0.5">
          {(["GAMMA", "VANNA"] as const).map((greek) => (
            <button
              key={greek}
              type="button"
              onClick={() => patchSettings({ greek })}
              aria-pressed={settings.greek === greek}
              className={`flex h-full items-center rounded-[2px] px-2 text-[9px] font-bold uppercase leading-none tracking-[0.075em] ${settings.greek === greek ? "bg-surface text-primary" : "text-muted hover:text-foreground"}`}
            >
              {greek === "GAMMA" ? "GEX" : "VEX"}
            </button>
          ))}
        </div>
        <div className="w-[76px] shrink-0">
        <GexMapDropdown
          ariaLabel="Forward window"
          value={String(settings.lookaheadDays)}
          options={LOOKAHEAD_CHOICES.map((days) => ({
            value: String(days),
            label: `${days}d`,
            detail: `Expiries within ${days} days`,
          }))}
          menuLabel="Forward window"
          menuWidth={190}
          onChange={(days) => patchSettings({ lookaheadDays: Number(days) })}
        />
        </div>
        <div className="flex h-6 items-center rounded-[3px] border border-border/70 bg-background/35 p-0.5">
          {([["star-percent", "% Star"], ["signed", "$"]] as const).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => patchSettings({ valueMode: mode })}
              aria-pressed={settings.valueMode === mode}
              className={`flex h-full items-center rounded-[2px] px-2 text-[9px] font-bold uppercase leading-none tracking-[0.075em] ${settings.valueMode === mode ? "bg-surface text-primary" : "text-muted hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className={`${chip} gap-1.5 text-muted`} title="Dim cells below this share of the Star cell's magnitude">
          Focus
          <input
            type="range"
            min={0}
            max={90}
            step={5}
            value={settings.highlightPercent}
            onChange={(event) => patchSettings({ highlightPercent: Number(event.target.value) })}
            className="w-20 accent-primary"
            aria-label="Highlight threshold as percent of the Star cell"
          />
          <span className="font-mono text-foreground">{settings.highlightPercent}%</span>
        </label>
        <div className="ml-auto flex items-center gap-2 text-[9px] text-muted">
          {chain?.stockPrice ? (
            <span className="font-mono text-foreground">Spot {chain.stockPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          ) : null}
          {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
        </div>
      </div>

      {error && !chain ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-[11px] text-muted">{error}</div>
      ) : !view || !view.expirations.length ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-[11px] text-muted">
          {loading ? "Loading the forward exposure surface…" : "No expirations publish inside the selected window."}
        </div>
      ) : (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-chart-background" style={zoom !== 1 ? ({ zoom } as React.CSSProperties) : undefined}>
          <table className="w-full min-w-max border-separate border-spacing-0 font-mono text-[10px]">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 border-b border-r border-border bg-panel px-2 py-1 text-left text-[8px] font-semibold uppercase tracking-[0.14em] text-muted">Strike</th>
                {view.expirations.map((expiration) => {
                  const heading = expirationHeading(expiration);
                  return (
                    <th key={expiration} className="sticky top-0 z-20 min-w-[76px] border-b border-border bg-panel px-1.5 py-1 text-center text-[8px] font-semibold tracking-[0.06em] text-muted">
                      <div>{heading.date}</div>
                      <div className="text-[7px] opacity-70">{heading.weekday}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {view.strikes.map((strike) => (
                <tr key={strike} ref={strike === spotStrike ? spotRowRef : undefined}>
                  <td className={`sticky left-0 z-10 whitespace-nowrap border-r border-border bg-panel px-2 py-0.5 text-right font-semibold ${strike === spotStrike ? "text-primary" : "text-foreground"}`}>
                    {strike === spotStrike ? "▸ " : ""}{strike.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  {view.expirations.map((expiration) => {
                    const key = `${expiration}:${strike}`;
                    const value = view.cells.get(key) ?? 0;
                    if (value === 0) {
                      return <td key={key} className="px-1.5 py-0.5 text-center text-[9px] text-muted/25">0%</td>;
                    }
                    const share = value / view.starMagnitude;
                    // The full chain spans orders of magnitude; a linear share
                    // crushed everything into the dim middle of the gradient
                    // ("three colours"). Per-side LOG scaling spreads the whole
                    // palette exactly like the Present ladder's slot picking:
                    // $11M and $5B land in clearly different bands, zero stays
                    // pinned to the scale middle, the Star alone reaches its end.
                    const logShare = Math.log1p(Math.abs(value)) / Math.log1p(view.starMagnitude);
                    const strength = 0.5 + 0.5 * Math.sign(value) * logShare;
                    const colour = signedScale[Math.max(0, Math.min(signedScale.length - 1, Math.round(strength * (signedScale.length - 1))))];
                    const magnitudeShare = Math.abs(share);
                    const focused = magnitudeShare * 100 >= settings.highlightPercent;
                    const isStar = key === view.starKey;
                    const isColumnStar = view.columnStars.get(expiration) === strike;
                    // Bright ends of the gradient need dark text for contrast,
                    // matching how the Present ladder prints over solid bands.
                    const brightCell = strength >= 0.72 || strength <= 0.28;
                    const text = settings.valueMode === "star-percent"
                      ? `${(share * 100).toFixed(share * 100 >= 10 || share * 100 <= -10 ? 0 : 1)}%`
                      : formatCompactDollars(value);
                    return (
                      <td
                        key={key}
                        title={`${settings.symbol} ${strike} · ${expiration} · ${formatCompactDollars(value)} (${(share * 100).toFixed(1)}% of Star)`}
                        className={`whitespace-nowrap px-1.5 py-0.5 text-center ${isStar || isColumnStar ? "font-bold" : ""}`}
                        style={{
                          backgroundColor: colour,
                          opacity: focused ? 1 : 0.1,
                          color: brightCell ? "#0A0D14" : "var(--foreground)",
                          outline: isStar
                            ? "2px solid var(--foreground)"
                            : isColumnStar
                              ? "1px solid color-mix(in srgb, var(--foreground) 65%, transparent)"
                              : undefined,
                          outlineOffset: isStar || isColumnStar ? "-1.5px" : undefined,
                        }}
                      >
                        {isStar ? "★ " : ""}{text}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {error && chain ? (
        <div className="shrink-0 border-t border-border bg-panel px-2 py-1 text-[9px] text-warning">Refresh delayed · showing the last good surface</div>
      ) : null}
    </div>
  );
}
