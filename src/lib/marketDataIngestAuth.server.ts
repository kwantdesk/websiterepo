import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

function getConfiguredToken() {
  return (
    process.env.KWANTIFY_MARKET_DATA_INGEST_TOKEN?.trim() ||
    process.env.MARKET_DATA_INGEST_TOKEN?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ""
  );
}

function getRequestToken(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return (
    req.headers.get("x-kwantify-market-data-token")?.trim() ||
    bearer ||
    req.nextUrl.searchParams.get("ingestToken")?.trim() ||
    ""
  );
}

function safeEquals(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

export function requireMarketDataIngestAuth(req: NextRequest) {
  const configured = getConfiguredToken();
  if (!configured) {
    return NextResponse.json(
      {
        error: "Market-data ingestion is not enabled. Set KWANTIFY_MARKET_DATA_INGEST_TOKEN on the server.",
      },
      { status: 503 },
    );
  }

  const supplied = getRequestToken(req);
  if (!supplied || !safeEquals(supplied, configured)) {
    return NextResponse.json({ error: "Unauthorised market-data ingestion request." }, { status: 401 });
  }

  return null;
}
