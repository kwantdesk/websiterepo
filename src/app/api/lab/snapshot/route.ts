import { NextRequest, NextResponse } from "next/server";

import { fetchInstitutionalMarketData, isInstitutionalMarketDataConfigured } from "@/lib/institutionalMarketData.server";
import { LAB_ACCESS_COOKIE, isValidLabAccessToken } from "@/lib/labAccess";
import { parseLabSnapshot, type LabRoot } from "@/lib/labSnapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function requestedRoot(request: NextRequest): LabRoot | null {
  const value = (request.nextUrl.searchParams.get("root") || "NQ").trim().toUpperCase();
  return value === "NQ" || value === "ES" ? value : null;
}

function privateHeaders(extra?: HeadersInit) {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    ...Object.fromEntries(new Headers(extra).entries()),
  };
}

export async function GET(request: NextRequest) {
  if (!(await isValidLabAccessToken(request.cookies.get(LAB_ACCESS_COOKIE)?.value))) {
    return NextResponse.json(
      { error: "THE LAB passcode is required.", code: "LAB_ACCESS_REQUIRED" },
      { status: 401, headers: privateHeaders() },
    );
  }

  const root = requestedRoot(request);
  if (!root) {
    return NextResponse.json({ error: "THE LAB currently supports NQ and ES." }, { status: 400, headers: privateHeaders() });
  }

  try {
    if (!isInstitutionalMarketDataConfigured()) {
      return NextResponse.json(
        { error: "The VPS repository gateway is not configured.", code: "LAB_REPOSITORY_NOT_CONFIGURED" },
        { status: 503, headers: privateHeaders() },
      );
    }

    const upstream = await fetchInstitutionalMarketData(
      `v1/lab/snapshot?root=${encodeURIComponent(root)}`,
      { method: "GET" },
      20_000,
    );
    const body = await upstream.json().catch(() => null) as unknown;
    if (!upstream.ok) {
      const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : "The VPS repository has not published a Lab snapshot.";
      return NextResponse.json(
        { error: message, code: upstream.status === 404 ? "LAB_SNAPSHOT_NOT_PUBLISHED" : "LAB_REPOSITORY_UNAVAILABLE" },
        { status: upstream.status === 404 ? 404 : 502, headers: privateHeaders() },
      );
    }

    const snapshot = parseLabSnapshot(body);
    if (process.env.NODE_ENV === "production" && snapshot.environment !== "LIVE") {
      throw new Error("Test Lab snapshots are forbidden in production.");
    }
    return NextResponse.json(snapshot, {
      headers: privateHeaders({ "X-KwantDesk-Lab-Transport": "vps-repository" }),
    });
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException)?.code === "ENOENT";
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "The VPS repository snapshot is unavailable.",
        code: missing ? "LAB_SNAPSHOT_NOT_PUBLISHED" : "LAB_SNAPSHOT_INVALID",
      },
      { status: missing ? 404 : 502, headers: privateHeaders() },
    );
  }
}
