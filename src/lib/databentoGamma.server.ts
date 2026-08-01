/**
 * Native futures-options gamma from Databento (GLBX.MDP3).
 *
 * Computes MenthorQ-grade gamma levels DIRECTLY from the NQ/ES option chain — open
 * interest + settlement -> Black-76 gamma -> GEX per strike — with no cash-index proxy
 * and no basis conversion (levels are already in futures price terms). This is the
 * accurate replacement for the KwantData cash path in getChartGammaLevels().
 *
 * Validated 2026-07-24 vs MenthorQ NQ: Call Resistance 30,000, Put Support 28,000,
 * HVL ~29,207 (theirs 29,250), 6/10 GEX walls on-strike.
 *
 * Requires env DATABENTO_API_KEY. Reference impl (Python, proven):
 * OPTIONS FLOW/MANUAL_TRADING/kwantify_gamma_service/lib/native_gamma.py
 */
import { unstable_cache } from "next/cache";
import type {
  ChartGammaSourceLevel,
  ChartGammaSourceLevelKind,
} from "@/lib/chartGammaLevels";

const DB_BASE = "https://hist.databento.com/v0/timeseries.get_range";
const CHAIN_BAND = 0.12; // options considered for the chain: +/-12% of spot
const NEAR_BAND = 0.045; // GEX walls ranked within +/-4.5%
const MIN_SETTLE = 3.0; // skip tiny deep-OTM prices (unstable IV)
const R = 0.045;

export type NativeGammaRoot = "NQ" | "ES";

const CFG: Record<NativeGammaRoot, { parent: string; mult: number; boxParents: string[]; contSymbol: string }> = {
  NQ: { parent: "NQ.OPT", mult: 20, boxParents: ["QNE.OPT", "E1A.OPT"], contSymbol: "NQ.c.0" },
  ES: { parent: "ES.OPT", mult: 50, boxParents: ["EW.OPT", "E1A.OPT"], contSymbol: "ES.c.0" },
};

export type NativeGammaSnapshot = {
  root: NativeGammaRoot;
  spot: number;
  sessionDate: string;
  callResistance: number | null;
  putSupport: number | null;
  hvl: number | null;
  zeroGamma: number | null;
  gammaFlipCurve: NativeGammaCurvePoint[];
  box: { max: number; min: number } | null;
  netGex: number;
  grossGex: number;
  levels: ChartGammaSourceLevel[];
  validationStrikes: number[];
  revision: string;
};

export type NativeGammaCurvePoint = {
  price: number;
  netGex: number;
};

// --------------------------------------------------------------------------- //
// Databento transport
// --------------------------------------------------------------------------- //
function dbAuth(): string {
  const key = (process.env.DATABENTO_API_KEY || "").trim();
  if (!key) throw new Error("DATABENTO_API_KEY is not configured.");
  return Buffer.from(`${key}:`).toString("base64");
}

async function dbPull(
  schema: string,
  start: string,
  end: string,
  symbols: string,
  stype: "parent" | "continuous" | "instrument_id" = "parent",
  limit = 120000,
): Promise<any[]> {
  const params: Record<string, string> = {
    dataset: "GLBX.MDP3", symbols, stype_in: stype, schema,
    start, limit: String(limit), encoding: "json",
  };
  // Clamp end to the recent past — hist rejects ranges beyond available data (422),
  // which otherwise breaks the first build after a session rolls (end = "tomorrow").
  const nowIso = new Date(Date.now() - 120_000).toISOString().slice(0, 16);
  const clampedEnd = end && end > nowIso ? nowIso : end;
  if (clampedEnd && clampedEnd > start) params.end = clampedEnd; // omit for open-ended
  const p = new URLSearchParams(params);
  const res = await fetch(`${DB_BASE}?${p.toString()}`, {
    headers: { Authorization: `Basic ${dbAuth()}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Databento ${schema} ${res.status}`);
  const text = await res.text();
  return text.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
}

// --------------------------------------------------------------------------- //
// Black-76
// --------------------------------------------------------------------------- //
function erf(x: number): number {
  // Abramowitz & Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
const cnd = (x: number) => 0.5 * (1 + erf(x / Math.SQRT2));
const npdf = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);

function price76(F: number, K: number, T: number, s: number, isCall: boolean): number {
  if (s <= 0 || T <= 0) return Math.max(0, (isCall ? F - K : K - F)) * Math.exp(-R * T);
  const d1 = (Math.log(F / K) + 0.5 * s * s * T) / (s * Math.sqrt(T));
  const d2 = d1 - s * Math.sqrt(T);
  return isCall
    ? Math.exp(-R * T) * (F * cnd(d1) - K * cnd(d2))
    : Math.exp(-R * T) * (K * cnd(-d2) - F * cnd(-d1));
}

function gamma76(F: number, K: number, T: number, s: number): number {
  if (s <= 0 || T <= 0) return 0;
  const d1 = (Math.log(F / K) + 0.5 * s * s * T) / (s * Math.sqrt(T));
  return Math.exp(-R * T) * npdf(d1) / (F * s * Math.sqrt(T));
}

function impliedVol(px: number, F: number, K: number, T: number, isCall: boolean): number | null {
  const intrinsic = Math.max(0, (isCall ? F - K : K - F)) * Math.exp(-R * T);
  if (px <= intrinsic + 1e-6 || T <= 0) return null;
  let lo = 1e-3, hi = 5.0;
  for (let i = 0; i < 60; i += 1) {
    const mid = 0.5 * (lo + hi);
    if (price76(F, K, T, mid, isCall) > px) hi = mid; else lo = mid;
  }
  const v = 0.5 * (lo + hi);
  return v <= 2.0 ? v : null;
}

// --------------------------------------------------------------------------- //
// Chain load + build + evaluate
// --------------------------------------------------------------------------- //
// `exp` (expiration, ns) lets evaluate() recompute time-to-expiry LIVE on every refresh
// — critical for 0DTE, whose gamma concentrates hard as the clock runs down. `T` is the
// build-time value, kept as fallback for chains cached before `exp` existed.
type Greek = { K: number; isCall: boolean; T: number; iv: number; oi: number; exp?: number };
type Chain = {
  greeks: Greek[];
  straddle: { price: number; dte: number } | null;
  zeroDte?: Greek[];
};

// CME weekly option roots are week-of-month + weekday specific: NQ Mondays are
// Q1A..Q5A (1st..5th Monday), Tuesdays Q1B.., Wed Q1C.., Thu Q1D..; Fridays QN1..QN5
// (+ QNE end-of-month). ES uses E{week}{letter} and EW{week}/EW. The main parents
// (NQ.OPT/ES.OPT) are quarterlies only — the 0DTE chain lives in these.
function zeroDteParentCandidates(root: NativeGammaRoot, liveDayIso: string): string[] {
  const [y, m, d] = liveDayIso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 1=Mon .. 5=Fri
  const week = Math.ceil(d / 7);
  const letter = ({ 1: "A", 2: "B", 3: "C", 4: "D" } as Record<number, string>)[dow];
  if (root === "NQ") {
    if (dow === 5) return [`QN${week}.OPT`, "QNE.OPT"];
    return letter ? [`Q${week}${letter}.OPT`] : [];
  }
  if (dow === 5) return [`EW${week}.OPT`, "EW.OPT"];
  return letter ? [`E${week}${letter}.OPT`] : [];
}

function nextTradingDayIso(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  do { dt.setUTCDate(dt.getUTCDate() + 1); } while (dt.getUTCDay() === 0 || dt.getUTCDay() === 6);
  return dt.toISOString().slice(0, 10);
}

async function zeroDteGreeks(
  root: NativeGammaRoot,
  tradeIso: string,
  spotRef: number,
): Promise<Greek[]> {
  const [zy, zm, zd] = tradeIso.split("-").map(Number);
  const asofSec = Date.UTC(zy, zm - 1, zd, 20) / 1000;
  const liveDay = nextTradingDayIso(tradeIso);
  const out: Greek[] = [];
  for (const parent of zeroDteParentCandidates(root, liveDay)) {
    try {
      const { OI, SETTLE, DEF } = await loadChain(parent, tradeIso);
      for (const [iid, oi] of OI) {
        const def = DEF.get(iid);
        const s = SETTLE.get(iid);
        if (!def || s === undefined) continue;
        const { K, cls, exp } = def;
        // Strike-scale band also guards against cross-product roots (ES strikes ~7.5k
        // can never sit within 4.5% of an NQ spot ~28k, and vice versa).
        if ((cls !== "C" && cls !== "P") || K <= 0 || Math.abs(K - spotRef) / spotRef > NEAR_BAND) continue;
        if (new Date(exp / 1e6).toISOString().slice(0, 10) !== liveDay) continue;
        if (s < 0.5) continue; // 0DTE premiums are small — keep a low floor
        const T = Math.max((exp / 1e9 - asofSec) / (365.25 * 86400), 0.5 / 365);
        const isCall = cls === "C";
        const iv = impliedVol(s, spotRef, K, T, isCall);
        if (!iv) continue;
        out.push({ K: Math.round(K), isCall, T, iv, oi, exp });
      }
    } catch { /* root may not exist for this product */ }
  }
  return out;
}

function nextDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10);
}

async function loadChain(parent: string, tradeIso: string) {
  const [oiRows, setRows, defRows] = await Promise.all([
    dbPull("statistics", `${tradeIso}T04:00`, `${tradeIso}T04:25`, parent),
    dbPull("statistics", `${tradeIso}T20:00`, `${tradeIso}T20:25`, parent),
    dbPull("definition", tradeIso, nextDay(tradeIso), parent),
  ]);
  const OI = new Map<number, number>();
  for (const r of oiRows) if (r.stat_type === 9 && r.quantity !== 2147483647) OI.set(r.hd.instrument_id, r.quantity);
  const SETTLE = new Map<number, number>();
  for (const r of setRows) if (r.stat_type === 3 && Math.abs(Number(r.price)) < 9e18) SETTLE.set(r.hd.instrument_id, Number(r.price) / 1e9);
  const DEF = new Map<number, { K: number; cls: string; exp: number }>();
  for (const d of defRows) DEF.set(d.hd.instrument_id, { K: Number(d.strike_price) / 1e9, cls: d.instrument_class, exp: Number(d.expiration) });
  return { OI, SETTLE, DEF };
}

async function nearTermStraddle(parents: string[], tradeIso: string, spotRef: number, asofSec: number) {
  const rows: Array<[number, number, boolean, number]> = [];
  for (const parent of parents) {
    try {
      const [setRows, defRows] = await Promise.all([
        dbPull("statistics", `${tradeIso}T20:00`, `${tradeIso}T20:25`, parent),
        dbPull("definition", tradeIso, nextDay(tradeIso), parent),
      ]);
      const SET = new Map<number, number>();
      for (const r of setRows) if (r.stat_type === 3 && Math.abs(Number(r.price)) < 9e18) SET.set(r.hd.instrument_id, Number(r.price) / 1e9);
      for (const d of defRows) {
        const iid = d.hd.instrument_id;
        const K = Number(d.strike_price) / 1e9;
        if (!SET.has(iid) || (d.instrument_class !== "C" && d.instrument_class !== "P") || K <= 0) continue;
        if (Math.abs(K - spotRef) / spotRef > 0.02) continue;
        const exp = Number(d.expiration);
        if ((exp / 1e9 - asofSec) / 86400 <= 0.2) continue;
        rows.push([exp, Math.round(K), d.instrument_class === "C", SET.get(iid)!]);
      }
    } catch { /* skip a missing weekly root */ }
  }
  return frontStraddle(rows, spotRef, asofSec);
}

function frontStraddle(rows: Array<[number, number, boolean, number]>, spotRef: number, asofSec: number) {
  if (!rows.length) return null;
  const front = Math.min(...rows.map((r) => r[0]));
  const fe = rows.filter((r) => r[0] === front);
  const strikes = [...new Set(fe.map((r) => r[1]))];
  const atm = strikes.reduce((a, b) => (Math.abs(b - spotRef) < Math.abs(a - spotRef) ? b : a));
  const c = fe.find((r) => r[1] === atm && r[2]);
  const p = fe.find((r) => r[1] === atm && !r[2]);
  if (!c || !p) return null;
  const dte = Math.max((front / 1e9 - asofSec) / 86400, 1.0);
  return { price: c[3] + p[3], dte };
}

async function buildChain(root: NativeGammaRoot, tradeIso: string, spotRef: number): Promise<Chain> {
  const cfg = CFG[root];
  const [yy, mm, dd] = tradeIso.split("-").map(Number);
  const asofSec = Date.UTC(yy, mm - 1, dd, 20) / 1000; // settlement anchor (20:00 UTC)
  const { OI, SETTLE, DEF } = await loadChain(cfg.parent, tradeIso);
  const greeks: Greek[] = [];
  for (const [iid, oi] of OI) {
    const def = DEF.get(iid);
    const s = SETTLE.get(iid);
    if (!def || s === undefined) continue;
    const { K, cls, exp } = def;
    if ((cls !== "C" && cls !== "P") || K <= 0 || Math.abs(K - spotRef) / spotRef > CHAIN_BAND) continue;
    if (s < MIN_SETTLE) continue;
    const T = (exp / 1e9 - asofSec) / (365.25 * 86400);
    if (T <= 1 / 365) continue;
    const isCall = cls === "C";
    const v = impliedVol(s, spotRef, K, T, isCall);
    if (!v) continue;
    greeks.push({ K: Math.round(K), isCall, T, iv: v, oi, exp });
  }
  if (!greeks.length) {
    // Throw (instead of returning empty) so a not-yet-available session is never
    // cached — the caller falls back to the prior session's chain.
    throw new Error(`no settled chain for ${root} ${tradeIso} yet`);
  }
  const straddle = await nearTermStraddle(cfg.boxParents, tradeIso, spotRef, asofSec);
  return { greeks, straddle };
}

function priorTradingDayIso(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  do { dt.setUTCDate(dt.getUTCDate() - 1); } while (dt.getUTCDay() === 0 || dt.getUTCDay() === 6);
  return dt.toISOString().slice(0, 10);
}

function zonedEpochMs(dateIso: string, hour: number, minute: number, timeZone: string) {
  const [year, month, day] = dateIso.split("-").map(Number);
  const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = wallClockUtc;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(new Date(candidate));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const representedAsUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour) % 24,
      Number(values.minute),
      Number(values.second),
    );
    candidate = wallClockUtc - (representedAsUtc - candidate);
  }
  return candidate;
}

export function newYorkCashCloseIso(tradeIso: string) {
  return new Date(zonedEpochMs(tradeIso, 16, 0, "America/New_York")).toISOString();
}

// Recompute time-to-expiry LIVE (floor ~15 min). For quarterlies this barely moves;
// for 0DTE it is the whole game — gamma concentrates into the close as T -> 0.
function liveT(g: Greek, nowSec: number): number {
  if (!g.exp) return g.T;
  return Math.max((g.exp / 1e9 - nowSec) / (365.25 * 86400), 15 / (365.25 * 1440));
}

function withLiveT(greeks: Greek[], nowSec: number): Greek[] {
  return greeks.map((g) => ({ ...g, T: liveT(g, nowSec) }));
}

function evaluate(chain: Chain, spot: number, mult: number) {
  const nowSec = Date.now() / 1000;
  const callG = new Map<number, number>();
  const putG = new Map<number, number>();
  const greeksLive = withLiveT(chain.greeks, nowSec);
  const zeroDteGreeksLive = withLiveT(chain.zeroDte ?? [], nowSec);
  for (const g of greeksLive) {
    const dg = g.oi * mult * gamma76(spot, g.K, g.T, g.iv) * spot * spot * 0.01;
    const m = g.isCall ? callG : putG;
    m.set(g.K, (m.get(g.K) || 0) + dg);
  }
  const strikes = [...new Set([...callG.keys(), ...putG.keys()])].sort((a, b) => a - b);
  const total = new Map(strikes.map((k) => [k, (callG.get(k) || 0) + (putG.get(k) || 0)]));
  const walls = strikes
    .filter((k) => Math.abs(k - spot) / spot <= NEAR_BAND)
    .map((k) => [k, total.get(k)!] as [number, number])
    .sort((a, b) => b[1] - a[1]);
  const callRes = argmax([...callG].filter(([k]) => k > spot));
  const putSup = argmax([...putG].filter(([k]) => k < spot));
  const gammaFlipCurve = gammaScenarioCurve(
    [...greeksLive, ...zeroDteGreeksLive],
    spot,
    mult,
  );
  const flip = zeroGamma(gammaFlipCurve, spot);
  const hvl = highVolLevel(gammaFlipCurve, spot, flip);
  let box: { max: number; min: number } | null = null;
  if (chain.straddle) {
    const half = chain.straddle.price * Math.sqrt(1 / Math.max(chain.straddle.dte, 1));
    box = { max: spot + half, min: spot - half };
  }
  let netGex = 0;
  let grossGex = 0;
  for (const v of callG.values()) { netGex += v; grossGex += Math.abs(v); }
  for (const v of putG.values()) { netGex -= v; grossGex += Math.abs(v); }

  // 0DTE profile: same math, only the current session's expiry (daily/weekly roots).
  const zCall = new Map<number, number>();
  const zPut = new Map<number, number>();
  for (const g of zeroDteGreeksLive) {
    const dg = g.oi * mult * gamma76(spot, g.K, g.T, g.iv) * spot * spot * 0.01;
    const m = g.isCall ? zCall : zPut;
    m.set(g.K, (m.get(g.K) || 0) + dg);
  }
  const zStrikes = [...new Set([...zCall.keys(), ...zPut.keys()])];
  const zTotal = zStrikes.map((k) => [k, (zCall.get(k) || 0) + (zPut.get(k) || 0)] as [number, number]);
  const zeroDteWall = argmax(zTotal);
  const zeroDteCallRes = argmax([...zCall].filter(([k]) => k > spot));
  const zeroDtePutSup = argmax([...zPut].filter(([k]) => k < spot));
  for (const value of zCall.values()) {
    netGex += value;
    grossGex += Math.abs(value);
  }
  for (const value of zPut.values()) {
    netGex -= value;
    grossGex += Math.abs(value);
  }

  return { walls, callRes, putSup, flip, hvl, gammaFlipCurve, box, netGex, grossGex, callG, putG,
           zeroDteWall, zeroDteCallRes, zeroDtePutSup };
}

function argmax(entries: Array<[number, number]>): number | null {
  if (!entries.length) return null;
  return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}

function gammaScenarioCurve(greeks: Greek[], spot: number, mult: number): NativeGammaCurvePoint[] {
  if (!greeks.length) return [];
  const lo = spot * 0.9, hi = spot * 1.1, steps = 240;
  const curve: NativeGammaCurvePoint[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const S = lo + ((hi - lo) * i) / steps;
    let g = 0;
    for (const o of greeks) {
      const gg = o.oi * mult * gamma76(S, o.K, o.T, o.iv) * S * S * 0.01;
      g += o.isCall ? gg : -gg;
    }
    curve.push({
      price: Math.round(S * 100) / 100,
      netGex: g,
    });
  }
  return curve;
}

function zeroGamma(curve: NativeGammaCurvePoint[], spot: number): number | null {
  if (!curve.length) return null;
  const crossings: number[] = [];
  for (let index = 1; index < curve.length; index += 1) {
    const left = curve[index - 1];
    const right = curve[index];
    if (left.netGex === 0) {
      crossings.push(left.price);
      continue;
    }
    if (right.netGex === 0) {
      crossings.push(right.price);
      continue;
    }
    if (Math.sign(left.netGex) === Math.sign(right.netGex)) continue;
    const weight = Math.abs(left.netGex) / (Math.abs(left.netGex) + Math.abs(right.netGex));
    crossings.push(left.price + (right.price - left.price) * weight);
  }
  if (!crossings.length) return null;
  const nearest = crossings.reduce((best, crossing) => (
    Math.abs(crossing - spot) < Math.abs(best - spot) ? crossing : best
  ));
  return Math.round(nearest * 100) / 100;
}

/**
 * High Volatility Level: the strongest local transition in the scenario-GEX
 * curve near the active zero-gamma regime boundary. A five-point moving
 * average suppresses strike-grid noise; a local maximum in |dGEX/dS| marks an
 * inflection/steepest-slope candidate. Zero Gamma remains a separate root.
 */
function highVolLevel(
  curve: NativeGammaCurvePoint[],
  spot: number,
  zeroGammaLevel: number | null,
): number | null {
  if (curve.length < 9 || !Number.isFinite(spot) || spot <= 0) return null;
  const smoothed = curve.map((point, index) => {
    const from = Math.max(0, index - 2);
    const to = Math.min(curve.length - 1, index + 2);
    let total = 0;
    for (let offset = from; offset <= to; offset += 1) total += curve[offset].netGex;
    return { price: point.price, netGex: total / (to - from + 1) };
  });
  const slopes = smoothed.slice(1, -1).map((point, index) => {
    const left = smoothed[index];
    const right = smoothed[index + 2];
    return {
      price: point.price,
      slope: (right.netGex - left.netGex) / Math.max(right.price - left.price, 1e-9),
    };
  });
  const band = spot * NEAR_BAND;
  const nearby = slopes.filter((row) => Math.abs(row.price - spot) <= band);
  if (!nearby.length) return null;
  const localTransitions = nearby.filter((row) => {
    const index = slopes.findIndex((candidate) => candidate.price === row.price);
    if (index <= 0 || index >= slopes.length - 1) return false;
    const magnitude = Math.abs(row.slope);
    return magnitude >= Math.abs(slopes[index - 1].slope)
      && magnitude >= Math.abs(slopes[index + 1].slope);
  });
  const candidates = localTransitions.length ? localTransitions : nearby;
  const maxSlope = Math.max(...candidates.map((row) => Math.abs(row.slope)));
  if (!Number.isFinite(maxSlope) || maxSlope <= 0) return null;
  const anchor = zeroGammaLevel ?? spot;
  const selected = candidates.reduce((best, row) => {
    const score = Math.abs(row.slope) / maxSlope * 0.8
      + Math.max(0, 1 - Math.abs(row.price - anchor) / band) * 0.2;
    return score > best.score ? { row, score } : best;
  }, { row: candidates[0], score: Number.NEGATIVE_INFINITY }).row;
  return Math.round(selected.price * 100) / 100;
}

// --------------------------------------------------------------------------- //
// Public: snapshot in the ChartGammaSourceLevel contract
// --------------------------------------------------------------------------- //
function level(kind: ChartGammaSourceLevelKind, label: string, price: number, value: number | null, rank: number): ChartGammaSourceLevel {
  return { id: `${kind}:${Math.round(price)}`, kind, label, price: Math.round(price), value, rank };
}

// Session cache, two layers. The chain (open interest + settlement + IV) is static all
// session, so the heavy build runs once per (root, sessionDate):
//  L1 — per-instance memory (promise-deduped, instant on a warm lambda)
//  L2 — Vercel data cache via unstable_cache (durable ACROSS serverless instances, so a
//       cold instance reuses a chain another instance already built instead of spending
//       ~25s rebuilding — this is what makes instrument switches fast in production)
const CHAIN_TTL_MS = 6 * 60 * 60 * 1000;
const ZERO_DTE_TTL_MS = 30 * 60 * 1000; // 0DTE re-pulls hourly (durable) / 30min (L1)
const chainCache = new Map<string, { promise: Promise<Chain>; builtAtMs: number }>();
const zeroDteCache = new Map<string, { promise: Promise<Greek[]>; builtAtMs: number }>();

function durableChain(root: NativeGammaRoot, tradeIso: string, spotRef: number): Promise<Chain> {
  return unstable_cache(
    async () => buildChain(root, tradeIso, spotRef),
    ["native-gamma-chain-v2", root, tradeIso],
    { revalidate: 6 * 60 * 60 },
  )();
}

// 0DTE is cached on a SHORTER clock than the main chain: CME publishes an intraday
// stat batch (~14:18 UTC), so re-pulling hourly picks up updated same-day OI/volume
// instead of holding the session-open snapshot all day.
function durableZeroDte(root: NativeGammaRoot, tradeIso: string, spotRef: number): Promise<Greek[]> {
  return unstable_cache(
    async () => zeroDteGreeks(root, tradeIso, spotRef),
    ["native-gamma-0dte-v2", root, tradeIso],
    { revalidate: 60 * 60 },
  )();
}

async function memo<T>(
  cache: Map<string, { promise: Promise<T>; builtAtMs: number }>,
  key: string,
  ttlMs: number,
  build: () => Promise<T>,
): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.builtAtMs < ttlMs) return hit.promise;
  const promise = build();
  cache.set(key, { promise, builtAtMs: Date.now() });
  try {
    return await promise;
  } catch (error) {
    cache.delete(key); // don't cache a failed build
    throw error;
  }
}

// unstable_cache needs the Next server runtime; outside it (scripts, odd runtimes)
// fall back to a direct build so the engine never hard-fails on cache plumbing.
async function durableOrDirect<T>(durable: () => Promise<T>, direct: () => Promise<T>): Promise<T> {
  try {
    return await durable();
  } catch (error) {
    if (error instanceof Error && error.message.includes("incrementalCache")) return direct();
    throw error;
  }
}

async function getCachedChain(root: NativeGammaRoot, tradeIso: string, spotRef: number): Promise<Chain> {
  return memo(chainCache, `${root}:${tradeIso}`, CHAIN_TTL_MS,
    () => durableOrDirect(() => durableChain(root, tradeIso, spotRef), () => buildChain(root, tradeIso, spotRef)));
}

async function getCachedZeroDte(root: NativeGammaRoot, tradeIso: string, spotRef: number): Promise<Greek[]> {
  return memo(zeroDteCache, `${root}:${tradeIso}`, ZERO_DTE_TTL_MS,
    () => durableOrDirect(() => durableZeroDte(root, tradeIso, spotRef), () => zeroDteGreeks(root, tradeIso, spotRef)));
}

export async function getNativeGammaSnapshot(root: NativeGammaRoot, tradeIso: string, liveSpot: number): Promise<NativeGammaSnapshot> {
  const cfg = CFG[root];
  // Right after a session rolls, the new settlement isn't queryable yet — walk back
  // to the most recent session whose chain exists so levels NEVER go dark.
  let chain: Chain | null = null;
  let usedIso = tradeIso;
  let lastError: unknown = null;
  for (let back = 0; back < 4 && !chain; back += 1) {
    try {
      chain = await getCachedChain(root, usedIso, liveSpot);
    } catch (error) {
      lastError = error;
      if (back < 3) usedIso = priorTradingDayIso(usedIso);
    }
  }
  if (!chain) throw lastError instanceof Error ? lastError : new Error("no native chain available");
  const zeroDte = await getCachedZeroDte(root, usedIso, liveSpot).catch(() => [] as Greek[]);
  const ev = evaluate({ ...chain, zeroDte }, liveSpot, cfg.mult);
  const maxWall = ev.walls.length ? ev.walls[0][1] : 1;
  const levels: ChartGammaSourceLevel[] = [];
  ev.walls.slice(0, 8).forEach(([k, v], i) => {
    const kind: ChartGammaSourceLevelKind = k > liveSpot ? "POSITIVE_GEX" : "NEGATIVE_GEX";
    levels.push(level(kind, `GEX ${i + 1}`, k, v, i + 1));
  });
  if (ev.callRes) levels.push(level("CALL_WALL", "Call Resistance", ev.callRes, ev.callG.get(ev.callRes) ?? null, 0));
  if (ev.putSup) levels.push(level("PUT_WALL", "Put Support", ev.putSup, ev.putG.get(ev.putSup) ?? null, 0));
  if (ev.flip) levels.push(level("ZERO_GAMMA", "Zero Gamma", ev.flip, null, 0));
  if (ev.hvl) levels.push(level("HIGH_VOL_LEVEL", "HVL", ev.hvl, null, 0));
  if (ev.box) {
    // 1D expected range from the front-expiry ATM straddle, anchored to the live spot.
    levels.push(level("EXPECTED_MOVE_MAX", "1D Max", ev.box.max, null, 0));
    levels.push(level("EXPECTED_MOVE_MIN", "1D Min", ev.box.min, null, 0));
  }
  // 0DTE set — today's expiry only (dealers' intraday battlefield).
  if (ev.zeroDteWall) levels.push(level("GAMMA_CENTRE", "Gamma Wall 0DTE", ev.zeroDteWall, null, 0));
  if (ev.zeroDteCallRes && ev.zeroDteCallRes !== ev.zeroDteWall) {
    levels.push(level("CALL_WALL", "Call Resistance 0DTE", ev.zeroDteCallRes, null, 2));
  }
  if (ev.zeroDtePutSup && ev.zeroDtePutSup !== ev.zeroDteWall) {
    levels.push(level("PUT_WALL", "Put Support 0DTE", ev.zeroDtePutSup, null, 2));
  }
  return {
    root, spot: liveSpot, sessionDate: usedIso,
    callResistance: ev.callRes, putSupport: ev.putSup, hvl: ev.hvl, zeroGamma: ev.flip,
    gammaFlipCurve: ev.gammaFlipCurve,
    box: ev.box,
    netGex: ev.netGex, grossGex: ev.grossGex, levels,
    validationStrikes: ev.walls.slice(0, 6).map(([k]) => k),
    revision: `native:${root}:${usedIso}:${Math.round(liveSpot)}`,
  };
}

function databentoTimestampMs(row: any): number | null {
  const value = row?.hd?.ts_event ?? row?.timestamp ?? row?.ts_event;
  if (typeof value === "string" && !/^\d+$/.test(value)) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric > 10_000_000_000_000_000) return Math.floor(numeric / 1_000_000);
  if (numeric > 10_000_000_000_000) return Math.floor(numeric / 1_000);
  return numeric < 10_000_000_000 ? numeric * 1_000 : numeric;
}

async function buildNativeFuturesSessionClose(root: NativeGammaRoot, tradeIso: string) {
  const closeMs = Date.parse(newYorkCashCloseIso(tradeIso));
  const start = new Date(closeMs - 20 * 60_000).toISOString();
  const end = new Date(closeMs + 60_000).toISOString();
  const rows = await dbPull("ohlcv-1m", start, end, CFG[root].contSymbol, "continuous", 60);
  const eligible = rows.filter((row) => {
    const timestamp = databentoTimestampMs(row);
    return timestamp === null || timestamp < closeMs;
  });
  const last = eligible.at(-1) ?? rows.at(-1);
  const close = Number(last?.close) / 1e9;
  return Number.isFinite(close) && close > 0 ? Math.round(close * 100) / 100 : null;
}

/** The completed 16:00 New York futures print used to freeze off-session levels. */
export async function getNativeFuturesSessionClose(root: NativeGammaRoot, tradeIso: string): Promise<number | null> {
  return durableOrDirect(
    () => unstable_cache(
      async () => buildNativeFuturesSessionClose(root, tradeIso),
      ["native-futures-new-york-close-v1", root, tradeIso],
      { revalidate: 24 * 60 * 60 },
    )(),
    () => buildNativeFuturesSessionClose(root, tradeIso),
  );
}

/** Live front-month futures price (spot for the gamma math), via Databento. */
export async function getNativeFuturesSpot(root: NativeGammaRoot): Promise<number | null> {
  const now = new Date();
  const start = new Date(now.getTime() - 30 * 60000).toISOString().slice(0, 16);
  let rows = await dbPull("ohlcv-1m", start, "", CFG[root].contSymbol, "continuous", 60);
  if (!rows.length) {
    const fallbackStart = new Date(now.getTime() - 7 * 24 * 60 * 60000).toISOString().slice(0, 16);
    rows = await dbPull("ohlcv-1m", fallbackStart, "", CFG[root].contSymbol, "continuous", 12_000);
  }
  if (!rows.length) return null;
  const last = rows[rows.length - 1];
  return last.close ? Math.round((Number(last.close) / 1e9) * 100) / 100 : null;
}
