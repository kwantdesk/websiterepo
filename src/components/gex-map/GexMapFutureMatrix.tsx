"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { GexCalMatrix } from "@/lib/gexCalendar";
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

export default function GexMapFutureMatrix({ palette }: { palette: GexMapPalette }) {
  const [settings, setSettings] = useState<FutureSettings>(() => loadFutureSettings());
  const [matrix, setMatrix] = useState<GexCalMatrix | null>(null);
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
          source: settings.symbol,
          greek: settings.greek,
          side: "NET",
          representation: "PER_ONE_PERCENT_MOVE",
        });
        const response = await fetch(`/api/gex-cal?${query}`, { cache: "no-store", credentials: "include" });
        const payload = await response.json().catch(() => null) as (GexCalMatrix & { error?: string }) | null;
        if (cancelled || requestSeqRef.current !== sequence) return;
        if (!response.ok || !payload || !Array.isArray(payload.cells)) {
          setError(payload?.error || "The forward exposure surface is unavailable.");
          setLoading(false);
          return;
        }
        setMatrix(payload);
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
    if (!matrix) return null;
    const horizonMs = Date.now() + settings.lookaheadDays * 24 * 60 * 60_000;
    const expirations = matrix.expirations
      .filter((expiration) => Date.parse(`${expiration}T21:00:00Z`) <= horizonMs);
    if (!expirations.length) return { expirations: [], strikes: [], cells: new Map<string, number>(), starKey: "", starMagnitude: 1 };
    const included = new Set(expirations);
    const cells = new Map<string, number>();
    let starMagnitude = 0;
    let starKey = "";
    const strikeHasExposure = new Set<number>();
    for (const cell of matrix.cells) {
      if (!included.has(cell.expiration) || cell.value === 0) continue;
      const key = `${cell.expiration}:${cell.strike}`;
      cells.set(key, cell.value);
      strikeHasExposure.add(cell.strike);
      const magnitude = Math.abs(cell.value);
      if (magnitude > starMagnitude) {
        starMagnitude = magnitude;
        starKey = key;
      }
    }
    // Strikes carrying zero exposure at every included expiry are exchange
    // listings without positioning — noise rows, dropped like the ladder does.
    const strikes = matrix.strikes.filter((strike) => strikeHasExposure.has(strike));
    return { expirations, strikes, cells, starKey, starMagnitude: Math.max(1, starMagnitude) };
  }, [matrix, settings.lookaheadDays]);

  const spotStrike = useMemo(() => {
    if (!matrix?.spot || !view?.strikes.length) return null;
    return view.strikes.reduce((best, strike) =>
      Math.abs(strike - matrix.spot!) < Math.abs(best - matrix.spot!) ? strike : best);
  }, [matrix, view]);

  const chip = "flex h-6 items-center rounded-[3px] border border-border/70 bg-background/35 px-2 text-[9px] font-semibold uppercase leading-none tracking-[0.075em]";

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border bg-panel px-2 py-1.5">
        <select
          value={settings.symbol}
          onChange={(event) => patchSettings({ symbol: event.target.value })}
          aria-label="Forward matrix underlying"
          className="h-6 rounded-[3px] border border-border/70 bg-background/35 px-1.5 text-[10px] font-semibold text-foreground outline-none"
        >
          {OPTIONS_FLOW_INSTRUMENTS.map((instrument) => (
            <option key={instrument.symbol} value={instrument.symbol}>{instrument.symbol}</option>
          ))}
        </select>
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
        <select
          value={String(settings.lookaheadDays)}
          onChange={(event) => patchSettings({ lookaheadDays: Number(event.target.value) })}
          aria-label="Forward window"
          className="h-6 rounded-[3px] border border-border/70 bg-background/35 px-1.5 text-[10px] font-semibold text-foreground outline-none"
        >
          {LOOKAHEAD_CHOICES.map((days) => <option key={days} value={days}>{days}d</option>)}
        </select>
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
          {matrix?.spot ? (
            <span className="font-mono text-foreground">Spot {matrix.spot.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          ) : null}
          {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
        </div>
      </div>

      {error && !matrix ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-[11px] text-muted">{error}</div>
      ) : !view || !view.expirations.length ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-[11px] text-muted">
          {loading ? "Loading the forward exposure surface…" : "No expirations publish inside the selected window."}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto bg-chart-background">
          <table className="border-separate border-spacing-0 font-mono text-[10px]">
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
                <tr key={strike}>
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
                    const strength = 0.5 + 0.5 * Math.max(-1, Math.min(1, share));
                    const colour = signedScale[Math.max(0, Math.min(signedScale.length - 1, Math.round(strength * (signedScale.length - 1))))];
                    const magnitudeShare = Math.abs(share);
                    const focused = magnitudeShare * 100 >= settings.highlightPercent;
                    const isStar = key === view.starKey;
                    const text = settings.valueMode === "star-percent"
                      ? `${(share * 100).toFixed(share * 100 >= 10 || share * 100 <= -10 ? 0 : 1)}%`
                      : formatCompactDollars(value);
                    return (
                      <td
                        key={key}
                        title={`${settings.symbol} ${strike} · ${expiration} · ${formatCompactDollars(value)} (${(share * 100).toFixed(1)}% of Star)`}
                        className={`whitespace-nowrap px-1.5 py-0.5 text-center ${isStar ? "font-bold" : ""}`}
                        style={{
                          backgroundColor: colour,
                          opacity: focused ? Math.max(0.32, magnitudeShare) : 0.08,
                          color: "var(--foreground)",
                          outline: isStar ? "1.5px solid var(--foreground)" : undefined,
                          outlineOffset: isStar ? "-1.5px" : undefined,
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
      {error && matrix ? (
        <div className="shrink-0 border-t border-border bg-panel px-2 py-1 text-[9px] text-warning">Refresh delayed · showing the last good surface</div>
      ) : null}
    </div>
  );
}
