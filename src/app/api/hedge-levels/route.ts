import { createServerClient } from "@supabase/ssr";
import { unstable_cache } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

import {
  convertHedgeLevels,
  deriveHedgeLevels,
  staleHedgeLevelsPayload,
  type HedgeLevelsPayload,
} from "@/lib/hedgeLevels";
import {
  buildChartGammaCalibration,
  resolveGammaConversion,
} from "@/lib/chartGammaConversion";
import {
  getHedgeLevelsExposureInput,
  getQuantDataHttpError,
} from "@/lib/quantData.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const getCachedHedgeExposure = unstable_cache(
  async () => getHedgeLevelsExposureInput(),
  ["hedge-levels-ndx-nq-v1"],
  { revalidate: 60 },
);

const lastGood = new Map<"NQ" | "MNQ", HedgeLevelsPayload>();

async function isAuthenticated(request: NextRequest) {
  const host = request.nextUrl.hostname;
  if (
    process.env.KWANTIFY_DEV_AUTH_BYPASS === "1"
    && (host === "localhost" || host === "127.0.0.1" || host === "::1")
  ) return true;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return process.env.NODE_ENV !== "production";
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: () => undefined,
    },
  });
  const { data } = await supabase.auth.getUser();
  return Boolean(data.user);
}

function normalizedInstrument(request: NextRequest): "NQ" | "MNQ" | null {
  const instrument = (request.nextUrl.searchParams.get("instrument") || "NQ").trim().toUpperCase();
  return instrument === "NQ" || instrument === "MNQ" ? instrument : null;
}

export async function GET(request: NextRequest) {
  const instrument = normalizedInstrument(request);
  if (!instrument) {
    return NextResponse.json(
      { error: "Hedge Levels is available on NQ and MNQ." },
      { status: 400 },
    );
  }
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const input = await getCachedHedgeExposure();
    const conversion = resolveGammaConversion(`NDX-${instrument}`, instrument);
    if (!conversion) throw new Error(`No NDX to ${instrument} conversion is configured.`);
    const asOfMs = Date.parse(input.checkedAt);
    const calibration = buildChartGammaCalibration({
      conversion,
      futuresContract: input.root,
      sessionDate: input.sessionDate,
      futuresPrice: input.futuresSpot,
      futuresAsOfMs: asOfMs,
      cashPrice: input.sourceSpot,
      cashAsOfMs: asOfMs,
      sourceLevels: input.surface.strikes.map((row) => row.strike),
      liveFuturesPrice: input.futuresSpot,
      nowMs: Date.now(),
    });
    if (!calibration) throw new Error(`The NDX to ${instrument} live calibration is outside its validated range.`);

    const surface = deriveHedgeLevels(input.surface, input.sourceSpot, input.sessionDate);
    const converted = convertHedgeLevels(surface, calibration.scale, 0.25);
    if (!converted) throw new Error("Hedge Levels could not convert the current gamma surface.");
    const generatedAt = input.checkedAt;
    const payload: HedgeLevelsPayload = {
      instrument,
      sourceSymbol: "NDX",
      sessionDate: input.sessionDate,
      marketOpen: input.marketOpen,
      levels: converted.levels,
      strikeInterval: converted.strikeInterval,
      regime: surface.regime,
      allCrossings: converted.allCrossings,
      flip: converted.flip,
      flipNote: surface.flipNote,
      contested: surface.contested,
      expiryScope: surface.expiryScope,
      signConvention: surface.signConvention,
      calibration: {
        mode: "LIVE_CALIBRATED",
        scale: calibration.scale,
        sourceSpot: input.sourceSpot,
        futuresSpot: input.futuresSpot,
      },
      generatedAt,
      dataAge: Math.max(0, Date.now() - Date.parse(generatedAt)),
      refreshAfterMs: input.marketOpen ? 60_000 : 5 * 60_000,
      stale: false,
      frozen: !input.marketOpen,
      frozenAt: input.marketOpen ? null : input.checkedAt,
    };
    lastGood.set(instrument, payload);
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const problem = getQuantDataHttpError(error);
    if (problem.status === 401 || problem.status === 403) {
      return NextResponse.json(
        { error: "Hedge Levels: data source needs re-authentication" },
        { status: problem.status, headers: { "Cache-Control": "private, no-store, max-age=0" } },
      );
    }
    const fallback = lastGood.get(instrument);
    if (fallback) {
      return NextResponse.json(staleHedgeLevelsPayload(fallback), {
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      });
    }
    return NextResponse.json(
      { error: problem.message || "Hedge Levels is temporarily unavailable." },
      { status: problem.status, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }
}
