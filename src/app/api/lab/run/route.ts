import { NextRequest, NextResponse } from "next/server";

import {
  fetchInstitutionalMarketData,
  fetchInstitutionalMarketIndexSnapshots,
  isInstitutionalMarketDataConfigured,
} from "@/lib/institutionalMarketData.server";
import { buildSourceBackedGameplan } from "@/lib/gameplanSource.server";
import { LAB_ACCESS_COOKIE, isValidLabAccessToken } from "@/lib/labAccess";
import { buildLabSnapshotFromGameplan, type LabRunMarketSnapshot } from "@/lib/labRun";
import { parseLabSnapshot, type LabRoot, type LabSnapshot } from "@/lib/labSnapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function privateHeaders(extra?: HeadersInit) {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    ...Object.fromEntries(new Headers(extra).entries()),
  };
}

function rootFromBody(value: unknown): LabRoot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const root = String((value as Record<string, unknown>).root || "").trim().toUpperCase();
  return root === "NQ" || root === "ES" ? root : null;
}

async function readPrior(root: LabRoot): Promise<LabSnapshot | null> {
  const response = await fetchInstitutionalMarketData(
    `v1/lab/snapshot?root=${encodeURIComponent(root)}`,
    { method: "GET" },
    20_000,
  );
  if (response.status === 404) return null;
  const body = await response.json().catch(() => null) as unknown;
  if (!response.ok) return null;
  try {
    return parseLabSnapshot(body);
  } catch {
    // A malformed prior must not infect a fresh run. Rebuild a baseline and
    // leave Film closed instead of manufacturing a comparison.
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!(await isValidLabAccessToken(request.cookies.get(LAB_ACCESS_COOKIE)?.value))) {
    return NextResponse.json(
      { error: "THE LAB passcode is required.", code: "LAB_ACCESS_REQUIRED" },
      { status: 401, headers: privateHeaders() },
    );
  }
  if (!isInstitutionalMarketDataConfigured()) {
    return NextResponse.json(
      { error: "The VPS repository gateway is not configured.", code: "LAB_REPOSITORY_NOT_CONFIGURED" },
      { status: 503, headers: privateHeaders() },
    );
  }

  const body = await request.json().catch(() => null) as unknown;
  const root = rootFromBody(body);
  if (!root) {
    return NextResponse.json(
      { error: "THE LAB manual run currently supports NQ and ES." },
      { status: 400, headers: privateHeaders() },
    );
  }

  try {
    const [sourceBacked, prior, refereeResult] = await Promise.all([
      buildSourceBackedGameplan(root),
      readPrior(root),
      fetchInstitutionalMarketIndexSnapshots(["VIX", "NDX", "SPX"], 15_000)
        .then((value) => ({ value, error: null as string | null }))
        .catch((error) => ({ value: [], error: error instanceof Error ? error.message : String(error) })),
    ]);
    const referees: LabRunMarketSnapshot[] = refereeResult.value;
    const sources = refereeResult.error
      ? {
        ...sourceBacked.sources,
        errors: [...sourceBacked.sources.errors, `Referee pull: ${refereeResult.error}`].slice(0, 12),
      }
      : sourceBacked.sources;
    const commit = process.env.VERCEL_GIT_COMMIT_SHA?.trim()
      || process.env.GIT_COMMIT_SHA?.trim()
      || "manual-run-local";
    const snapshot = buildLabSnapshotFromGameplan(sourceBacked.payload, {
      prior,
      sources,
      referees,
      commit,
    });
    const upstream = await fetchInstitutionalMarketData(
      "v1/lab/snapshot",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      },
      30_000,
    );
    const publishedBody = await upstream.json().catch(() => null) as unknown;
    if (!upstream.ok) {
      const message = publishedBody && typeof publishedBody === "object" && "error" in publishedBody
        ? String((publishedBody as { error: unknown }).error)
        : `The VPS rejected the Lab publication (${upstream.status}).`;
      return NextResponse.json(
        { error: message, code: "LAB_PUBLICATION_REJECTED" },
        { status: upstream.status === 409 ? 409 : 502, headers: privateHeaders() },
      );
    }
    return NextResponse.json(parseLabSnapshot(publishedBody), {
      headers: privateHeaders({ "X-KwantDesk-Lab-Transport": "vps-repository-publish" }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "The August V1 run failed.",
        code: "LAB_RUN_FAILED",
      },
      { status: 502, headers: privateHeaders() },
    );
  }
}
