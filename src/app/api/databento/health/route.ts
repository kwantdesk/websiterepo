import { createHash } from "node:crypto";
import { createConnection } from "node:net";
import { NextResponse } from "next/server";
import { getDatabentoBars } from "@/lib/databento";
import {
  vendorMarketDataConfigured,
  vendorMarketDataFetch,
  vendorMarketDataTransport,
} from "@/lib/vendorMarketData.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export const preferredRegion = "iad1";

type LiveHealth = {
  ok: boolean;
  authenticated: boolean;
  receivedMarketData: boolean;
  reason: string | null;
};

type DeepHealth = {
  actualHistory: {
    ok: boolean;
    candleCount: number;
    reason: string | null;
  };
  live: LiveHealth;
};

const globalHealthCache = globalThis as typeof globalThis & {
  __kwantdeskDatabentoHealth?: { value: DeepHealth; updatedAt: number };
};
const DEEP_HEALTH_CACHE_MS = 60_000;

function failureReason(status: number) {
  if (status === 401) return "invalid_api_key";
  if (status === 402) return "payment_required";
  if (status === 403) return "insufficient_permissions";
  if (status === 404) return "dataset_unavailable";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "upstream_unavailable";
  return "request_rejected";
}

function checkLiveFeed(apiKey: string): Promise<LiveHealth> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "glbx-mdp3.lsg.databento.com", port: 13000 });
    let buffer = "";
    let authenticated = false;
    let settled = false;

    const finish = (value: LiveHealth) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.destroy();
      resolve(value);
    };
    const timeout = setTimeout(() => {
      finish({
        ok: false,
        authenticated,
        receivedMarketData: false,
        reason: authenticated ? "no_market_data_received" : "live_connection_timeout",
      });
    }, 10_000);

    socket.setKeepAlive(true, 5_000);
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        if (!authenticated) {
          if (line.startsWith("cram=")) {
            const challenge = line.slice(5);
            const digest = createHash("sha256").update(`${challenge}|${apiKey}`).digest("hex");
            socket.write(`auth=${digest}-${apiKey.slice(-5)}|dataset=GLBX.MDP3|encoding=json|ts_out=1|heartbeat_interval_s=5\n`);
            continue;
          }
          if (line.startsWith("success=1")) {
            authenticated = true;
            socket.write("schema=mbp-1|stype_in=continuous|symbols=ES.v.0\n");
            socket.write("start_session=1\n");
            continue;
          }
          if (line.startsWith("success=0") || line.startsWith("error=")) {
            finish({
              ok: false,
              authenticated: false,
              receivedMarketData: false,
              reason: "live_authentication_rejected",
            });
          }
          continue;
        }

        try {
          const record = JSON.parse(line) as {
            err?: string;
            levels?: Array<{ bid_px?: string | number; ask_px?: string | number }>;
            bid_px_00?: string | number;
            ask_px_00?: string | number;
            price?: string | number;
          };
          if (record.err) {
            finish({
              ok: false,
              authenticated: true,
              receivedMarketData: false,
              reason: "live_subscription_rejected",
            });
            continue;
          }
          const hasMarketData = Boolean(
            record.price
            || record.bid_px_00
            || record.ask_px_00
            || record.levels?.[0]?.bid_px
            || record.levels?.[0]?.ask_px,
          );
          if (hasMarketData) {
            finish({
              ok: true,
              authenticated: true,
              receivedMarketData: true,
              reason: null,
            });
          }
        } catch {
          // Non-JSON control messages are expected before the market stream begins.
        }
      }
    });
    socket.on("error", () => {
      finish({
        ok: false,
        authenticated,
        receivedMarketData: false,
        reason: "live_connection_failed",
      });
    });
    socket.on("close", () => {
      if (!settled) {
        finish({
          ok: false,
          authenticated,
          receivedMarketData: false,
          reason: "live_connection_closed",
        });
      }
    });
  });
}

async function deepHealth(apiKey: string | null): Promise<DeepHealth> {
  const cached = globalHealthCache.__kwantdeskDatabentoHealth;
  if (cached && Date.now() - cached.updatedAt < DEEP_HEALTH_CACHE_MS) return cached.value;

  const now = Date.now();
  const [historyResult, live] = await Promise.all([
    getDatabentoBars(
      "ES.v.0",
      "5m",
      new Date(now - 6 * 60 * 60_000).toISOString(),
      new Date(now).toISOString(),
    )
      .then((candles) => ({
        ok: candles.length > 0,
        candleCount: candles.length,
        reason: candles.length > 0 ? null : "no_candles_returned",
      }))
      .catch(() => ({ ok: false, candleCount: 0, reason: "history_request_failed" })),
    apiKey
      ? checkLiveFeed(apiKey)
      : Promise.resolve({
          ok: true,
          authenticated: true,
          receivedMarketData: false,
          reason: "live_futures_are_served_by_the_vps_gateway",
        }),
  ]);
  const value = { actualHistory: historyResult, live };
  globalHealthCache.__kwantdeskDatabentoHealth = { value, updatedAt: Date.now() };
  return value;
}

export async function GET() {
  const transport = vendorMarketDataTransport("databento");
  const directKey = transport === "direct"
    ? process.env.DATABENTO_API_KEY?.trim() || null
    : null;
  if (!vendorMarketDataConfigured("databento")) {
    return NextResponse.json(
      {
        configured: false,
        keyFormatValid: false,
        historical: { ok: false, reason: "missing_api_key" },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const keyFormatValid = directKey ? /^db-[A-Za-z0-9_-]{20,}$/.test(directKey) : true;
  try {
    const response = await vendorMarketDataFetch(
      "databento",
      "/v0/metadata.get_dataset_range?dataset=GLBX.MDP3",
      {
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      },
    );

    const deep = response.ok
      ? await deepHealth(directKey)
      : {
          actualHistory: { ok: false, candleCount: 0, reason: "historical_authentication_failed" },
          live: {
            ok: false,
            authenticated: false,
            receivedMarketData: false,
            reason: "historical_authentication_failed",
          },
        };

    return NextResponse.json(
      {
        configured: true,
        transport,
        keyFormatValid,
        historical: {
          ok: response.ok,
          status: response.status,
          reason: response.ok ? null : failureReason(response.status),
        },
        ...deep,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        configured: true,
        keyFormatValid,
        historical: { ok: false, reason: "connection_failed" },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
