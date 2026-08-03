import { NextRequest, NextResponse } from "next/server";
import {
  configuredInstitutionalProvider,
  fetchInstitutionalMarketData,
  isInstitutionalMarketDataConfigured,
} from "@/lib/institutionalMarketData.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_PATHS = new Set(["health", "v1/instruments"]);

function allowedPath(path: string) {
  return ALLOWED_PATHS.has(path) || /^v1\/snapshot\/\d+$/.test(path);
}

export async function GET(request: NextRequest) {
  const path = String(request.nextUrl.searchParams.get("path") || "")
    .trim()
    .replace(/^\/+/, "");
  if (!allowedPath(path)) {
    return NextResponse.json({ error: "Unsupported market-data operation." }, { status: 400 });
  }
  if (!isInstitutionalMarketDataConfigured()) {
    return NextResponse.json({
      provider: configuredInstitutionalProvider(),
      configured: false,
      connected: false,
      error: "The private institutional market-data gateway is not configured.",
    }, { status: 503 });
  }

  try {
    const response = await fetchInstitutionalMarketData(path);
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({
      provider: configuredInstitutionalProvider(),
      configured: true,
      connected: false,
      error: error instanceof Error ? error.message : "Market-data gateway unavailable.",
    }, { status: 502 });
  }
}
