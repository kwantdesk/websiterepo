"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gexMapExposureRange, gexMapHeatColorCss, gexMapHeatStrength, gexMapSignedScale, type GexMapPalette } from "@/lib/gexMapPalette";
import { parseResolvedColor, readableTextOn } from "@/lib/readableContrast";
import GexMapExposureLegend from "./GexMapExposureLegend";
import type { GexMapFutureSettings } from "@/lib/gexMapWorkspaces";

// GEX MAP · FUTURE view: the forward positioning matrix. Strikes run down the
// left, one column per upcoming EXPIRY inside the lookahead window, and every
// cell is that (strike, expiry)'s real signed exposure from the same
// QuantData surface GEX CAL reads — GEX (gamma) or VEX (vanna). Colouring
// uses the current matrix's independent negative and positive peaks. Star
// identity and displayed percentages still use absolute exposure.

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

export default function GexMapFutureMatrix({ palette, zoom = 1, settings }: {
  palette: GexMapPalette;
  zoom?: number;
  settings: GexMapFutureSettings;
}) {
  const [chain, setChain] = useState<FutureChain | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSeqRef = useRef(0);

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
    if (!expirations.length) return { expirations: [], strikes: [], cells: new Map<string, number>(), starKey: "", starMagnitude: 1, columnStars: new Map<string, number>(), exposureRange: gexMapExposureRange([]) };
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
    return { expirations, strikes, cells, starKey, starMagnitude: Math.max(1, starMagnitude), columnStars, exposureRange: gexMapExposureRange(cells.values()) };
  }, [chain, settings.lookaheadDays]);

  const spotStrike = useMemo(() => {
    const spot = chain?.stockPrice;
    if (spot == null || !Number.isFinite(spot) || spot <= 0 || !view?.strikes.length) return null;
    return view.strikes.reduce((best, strike) =>
      Math.abs(strike - spot) < Math.abs(best - spot) ? strike : best);
  }, [chain?.stockPrice, view]);
  const spotLabel = chain?.stockPrice?.toLocaleString(undefined, { maximumFractionDigits: 2 });

  const scrollRef = useRef<HTMLDivElement>(null);
  const spotRowRef = useRef<HTMLTableRowElement>(null);
  const centeredKeyRef = useRef("");
  const centerSpotStrike = useCallback(() => {
    const container = scrollRef.current;
    const row = spotRowRef.current;
    if (!container || !row) return false;

    // scrollIntoView accounts for CSS zoom. Keep the selected expiry columns
    // in view when recentering the strike axis.
    const expiryOffset = container.scrollLeft;
    row.scrollIntoView({ block: "center", inline: "nearest" });
    container.scrollLeft = expiryOffset;
    return true;
  }, []);

  useEffect(() => {
    if (spotStrike === null) return;
    const key = `${chain?.symbol}:${chain?.greekMode}:${settings.lookaheadDays}`;
    if (centeredKeyRef.current === key) return;
    const container = scrollRef.current;
    if (!container || !centerSpotStrike()) return;
    centeredKeyRef.current = key;
    container.scrollLeft = 0;
  }, [centerSpotStrike, chain?.greekMode, chain?.symbol, settings.lookaheadDays, spotStrike]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
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
                <th scope="col" className="sticky left-0 top-0 z-30 border-b border-r border-border bg-panel text-left text-[8px] font-semibold uppercase tracking-[0.14em] text-muted">
                  <button
                    type="button"
                    onClick={centerSpotStrike}
                    disabled={spotStrike === null}
                    title="Center on the current strike"
                    className="block w-full px-2 py-1 text-left uppercase tracking-[0.14em] enabled:hover:text-foreground"
                  >
                    Strike
                  </button>
                </th>
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
                  <td
                    onDoubleClick={spotStrike === null ? undefined : centerSpotStrike}
                    title={spotStrike === null ? undefined : strike === spotStrike
                      ? `Spot ${spotLabel} · Double-click to center`
                      : "Double-click to center on the current strike"}
                    className={`sticky left-0 z-10 select-none whitespace-nowrap border-r border-border bg-panel px-2 py-0.5 text-right font-semibold ${strike === spotStrike ? "text-primary" : "text-foreground"}`}
                  >
                    {strike === spotStrike ? "▸ " : ""}{strike.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  {view.expirations.map((expiration) => {
                    const key = `${expiration}:${strike}`;
                    const value = view.cells.get(key) ?? 0;
                    if (value === 0) {
                      return <td key={key} className="px-1.5 py-0.5 text-center text-[9px] text-muted/25">0%</td>;
                    }
                    const share = value / view.starMagnitude;
                    const strength = gexMapHeatStrength(value, view.exposureRange);
                    const colour = gexMapHeatColorCss(strength, signedScale);
                    const magnitudeShare = Math.abs(share);
                    const focused = magnitudeShare * 100 >= settings.highlightPercent;
                    const isStar = key === view.starKey;
                    const isColumnStar = view.columnStars.get(expiration) === strike;
                    // Bright ends of the gradient need dark text for contrast,
                    // matching how the Present ladder prints over solid bands.
                    const cellText = parseResolvedColor(colour) ? readableTextOn(colour)
                      : strength >= 0.72 || strength <= 0.28 ? "#0A0D14" : "var(--foreground)";
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
                          color: cellText,
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
      {view ? <GexMapExposureLegend range={view.exposureRange} scale={signedScale} hasData={view.cells.size > 0} /> : null}
      {error && chain ? (
        <div className="shrink-0 border-t border-border bg-panel px-2 py-1 text-[9px] text-warning">Refresh delayed · showing the last good surface</div>
      ) : null}
    </div>
  );
}
