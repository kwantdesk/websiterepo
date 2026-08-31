import { createServerClient } from "@supabase/ssr";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { getGexMapPanel, getQuantDataHttpError } from "@/lib/quantData.server";
import { buildOptionsDeltaSeries, optionsDeltaSourceForInstrument } from "@/lib/optionsDelta";
import { SITE_ACCESS_COOKIE, isSiteAccessConfigured, isValidSiteAccessToken } from "@/lib/siteAccess";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const MAXIMUM_POINTS = 4_000;
const cache = new Map<string, { expiresAt: number; payload: OptionsDeltaReceipt }>();

type OptionsDeltaReceipt = {
  schemaVersion: 1;
  id: "options-delta";
  displayInstrument: string;
  sourceSymbol: "NDX" | "QQQ" | "SPX" | "SPXW" | "SPY";
  sessionDate: string;
  expiration: string | null;
  scope: "FRONT_EXPIRY";
  model: "STRUCTURAL_OI";
  representation: "PER_ONE_DOLLAR_MOVE";
  source: "KwantData Interval Map";
  sourceTimeZone: "America/New_York";
  asOfMs: number;
  receivedAtMs: number;
  replayAsOfMs: number | null;
  revision: string;
  status: "LIVE" | "LAST_SESSION" | "DELAYED";
  refreshAfterMs: number;
  marketOpen: boolean;
  stale: boolean;
  points: Array<{ timestampMs: number; net: number }>;
};

async function isAuthenticated(request: NextRequest) {
  const expectedInternalToken = String(process.env.KWANTDESK_ANALYTICS_SERVICE_TOKEN || "").trim();
  const suppliedInternalToken = String(request.headers.get("x-kwantdesk-internal-analytics-token") || "").trim();
  if (expectedInternalToken.length >= 32 && suppliedInternalToken.length === expectedInternalToken.length) {
    const supplied = Buffer.from(suppliedInternalToken, "utf8");
    const expected = Buffer.from(expectedInternalToken, "utf8");
    if (supplied.length === expected.length && timingSafeEqual(supplied, expected)) return true;
  }
  const host = request.nextUrl.hostname;
  if (process.env.KWANTIFY_DEV_AUTH_BYPASS === "1" && ["localhost", "127.0.0.1", "::1"].includes(host)) return true;
  if (isSiteAccessConfigured() && await isValidSiteAccessToken(request.cookies.get(SITE_ACCESS_COOKIE)?.value)) return true;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return process.env.NODE_ENV !== "production";
  const supabase = createServerClient(url, key, {
    cookies: { getAll: () => request.cookies.getAll(), setAll: () => undefined },
  });
  return Boolean((await supabase.auth.getUser()).data.user);
}

function newYorkDate(timestampMs: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestampMs));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const displayInstrument = (request.nextUrl.searchParams.get("instrument") || "").trim().toUpperCase();
  const sourceSymbol = optionsDeltaSourceForInstrument(displayInstrument);
  if (!sourceSymbol) {
    return NextResponse.json(
      { error: "Options Delta requires a supported futures or options-underlying family." },
      { status: 400 },
    );
  }

  const asOfText = request.nextUrl.searchParams.get("asOf")?.trim() ?? "";
  const receivedAtMs = Date.now();
  const replayAsOfMs = asOfText ? Date.parse(asOfText) : null;
  if (asOfText && (!Number.isFinite(replayAsOfMs) || replayAsOfMs! <= 0 || replayAsOfMs! > receivedAtMs)) {
    return NextResponse.json({ error: "A valid non-future Options Delta replay cutoff is required." }, { status: 400 });
  }

  const sessionDate = replayAsOfMs === null ? undefined : newYorkDate(replayAsOfMs);
  const cacheKey = `${displayInstrument}:${sourceSymbol}:${replayAsOfMs ?? "LIVE"}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > receivedAtMs) {
    return NextResponse.json(cached.payload, { headers: { "Cache-Control": "private, no-store" } });
  }

  try {
    const surface = await getGexMapPanel(
      sourceSymbol,
      "DELTA",
      sessionDate,
      "FRONT_EXPIRY",
      "PER_ONE_DOLLAR_MOVE",
    );
    if (surface.greekMode !== "DELTA" || surface.scope !== "FRONT_EXPIRY" ||
        surface.model !== "STRUCTURAL_OI" || surface.representation !== "PER_ONE_DOLLAR_MOVE" ||
        surface.source !== "KwantData Interval Map" || surface.sourceTimeZone !== "America/New_York" ||
        sessionDate && surface.sessionDate !== sessionDate) {
      return NextResponse.json(
        { error: "The Options Delta surface does not match the requested method or session." },
        { status: 502, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    const frames = replayAsOfMs === null
      ? surface.frames
      : surface.frames.filter((frame) => frame.timestamp <= replayAsOfMs);
    const points = buildOptionsDeltaSeries({ frames })
      .filter((point) => Number.isFinite(point.timestampMs) && Number.isFinite(point.net))
      .slice(-MAXIMUM_POINTS);
    const surfaceAsOfMs = Date.parse(surface.asOf);
    const asOfMs = replayAsOfMs ?? surfaceAsOfMs;
    if (!Number.isFinite(asOfMs) || asOfMs <= 0 || asOfMs > receivedAtMs + 60_000 ||
        points.some((point) => point.timestampMs > asOfMs)) {
      return NextResponse.json(
        { error: "The Options Delta receipt is not point-in-time safe." },
        { status: 502, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    const marketOpen = replayAsOfMs === null && surface.status === "LIVE";
    const revision = createHash("sha256").update(JSON.stringify([
      displayInstrument,
      sourceSymbol,
      surface.sessionDate,
      surface.expiration,
      surface.status,
      asOfMs,
      points,
    ])).digest("hex");
    const payload: OptionsDeltaReceipt = {
      schemaVersion: 1,
      id: "options-delta",
      displayInstrument,
      sourceSymbol,
      sessionDate: surface.sessionDate,
      expiration: surface.expiration,
      scope: "FRONT_EXPIRY",
      model: "STRUCTURAL_OI",
      representation: "PER_ONE_DOLLAR_MOVE",
      source: "KwantData Interval Map",
      sourceTimeZone: "America/New_York",
      asOfMs,
      receivedAtMs,
      replayAsOfMs,
      revision,
      status: surface.status,
      refreshAfterMs: Math.max(15_000, Math.min(300_000, Number(surface.refreshAfterMs) || 60_000)),
      marketOpen,
      stale: replayAsOfMs !== null || !marketOpen,
      points,
    };
    if (cache.size >= 32) {
      for (const [key, entry] of cache) if (entry.expiresAt <= receivedAtMs) cache.delete(key);
      if (cache.size >= 32) cache.delete(cache.keys().next().value as string);
    }
    cache.set(cacheKey, {
      expiresAt: receivedAtMs + (replayAsOfMs === null ? 10_000 : 15 * 60_000),
      payload,
    });
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const problem = getQuantDataHttpError(error);
    return NextResponse.json(
      { error: problem.message },
      { status: problem.status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
