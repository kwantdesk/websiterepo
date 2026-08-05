import { createHash } from "node:crypto";
import { createConnection } from "node:net";
import { isContinuousFuture } from "@/lib/databento";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type CachedLivePayload = {
  payload: {
    instrument: string;
    contractSymbol?: string;
    bid: number;
    ask: number;
    mid: number;
    isTrade: boolean;
    size?: number;
    trades?: number;
    delta?: number;
    timestamp: string | number;
    broker: "Databento";
  };
  updatedAt: number;
};

const globalLiveQuoteCache = globalThis as typeof globalThis & {
  __kwantdeskCmeLiveQuotes?: Map<string, CachedLivePayload>;
};
const liveQuoteCache = globalLiveQuoteCache.__kwantdeskCmeLiveQuotes
  ?? (globalLiveQuoteCache.__kwantdeskCmeLiveQuotes = new Map<string, CachedLivePayload>());
const LIVE_REPLAY_MAX_AGE_MS = 2 * 60_000;

function numericPrice(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.abs(parsed) >= 100_000_000 ? parsed / 1_000_000_000 : parsed;
}

export async function GET(request: Request) {
  const apiKey = process.env.DATABENTO_API_KEY;
  if (!apiKey) return new Response("CME market data is not configured.", { status: 503 });

  const url = new URL(request.url);
  const symbols = (url.searchParams.get("symbols") ?? "")
    .split(",")
    .map((symbol) => symbol.trim())
    .filter(Boolean)
    .slice(0, 40);
  if (!symbols.length) return new Response("Select at least one instrument.", { status: 400 });
  const symbolSet = new Set(symbols);
  const prioritySymbols = new Set(
    (url.searchParams.get("priority") ?? "")
      .split(",")
      .map((symbol) => symbol.trim())
      .filter((symbol) => symbolSet.has(symbol)),
  );

  const encoder = new TextEncoder();
  let socket: ReturnType<typeof createConnection> | null = null;
  let closed = false;
  let closeStream: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const instrumentSymbols = new Map<number, string>();
      const instrumentContracts = new Map<number, string>();
      let buffer = "";
      let authenticated = false;
      let authenticatedAt = 0;
      let lastUpstreamMessageAt = Date.now();
      let lastMarketPayloadAt = 0;
      let lastPriorityMarketPayloadAt = 0;
      let downstreamHeartbeat: ReturnType<typeof setInterval> | null = null;
      let downstreamFlush: ReturnType<typeof setInterval> | null = null;
      let upstreamHealthCheck: ReturnType<typeof setInterval> | null = null;
      const pendingPayloads = new Map<string, CachedLivePayload["payload"]>();
      const lastPublishedAtBySymbol = new Map<string, number>();

      const send = (value: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(value));
        } catch {
          close();
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        if (downstreamHeartbeat) clearInterval(downstreamHeartbeat);
        if (downstreamFlush) clearInterval(downstreamFlush);
        if (upstreamHealthCheck) clearInterval(upstreamHealthCheck);
        socket?.destroy();
        try { controller.close(); } catch {}
      };
      const flushPendingPayloads = () => {
        if (closed || pendingPayloads.size === 0) return;
        const now = Date.now();
        for (const [symbol, payload] of pendingPayloads) {
          // Active chart symbols retain the fluid 32 ms path. Watchlist-only
          // symbols update four times per second, which is visually live without
          // flooding every mounted chart with thousands of unused events.
          if (
            !prioritySymbols.has(symbol)
            && now - (lastPublishedAtBySymbol.get(symbol) ?? 0) < 250
          ) continue;
          pendingPayloads.delete(symbol);
          lastPublishedAtBySymbol.set(symbol, now);
          send(`data: ${JSON.stringify(payload)}\n\n`);
        }
      };
      const queuePayload = (payload: CachedLivePayload["payload"]) => {
        lastMarketPayloadAt = Date.now();
        if (prioritySymbols.has(payload.instrument)) {
          lastPriorityMarketPayloadAt = lastMarketPayloadAt;
        }
        const previous = pendingPayloads.get(payload.instrument);
        const previousTrades = previous?.isTrade ? Number(previous.trades ?? 1) : 0;
        const nextTrades = payload.isTrade ? Number(payload.trades ?? 1) : 0;
        const trades = previousTrades + nextTrades;
        pendingPayloads.set(payload.instrument, {
          ...payload,
          isTrade: trades > 0,
          size: trades > 0
            ? Number(previous?.size ?? 0) + Number(payload.size ?? 0)
            : undefined,
          trades: trades > 0 ? trades : undefined,
          delta: trades > 0
            ? Number(previous?.delta ?? 0) + Number(payload.delta ?? 0)
            : undefined,
        });
      };
      closeStream = close;

      send("retry: 1500\n\n");
      for (const symbol of symbols) {
        const cached = liveQuoteCache.get(symbol);
        if (cached && Date.now() - cached.updatedAt <= LIVE_REPLAY_MAX_AGE_MS) {
          send(`data: ${JSON.stringify({ ...cached.payload, cached: true })}\n\n`);
        }
      }
      downstreamHeartbeat = setInterval(
        () => send(`event: heartbeat\ndata: ${JSON.stringify({
          timestamp: Date.now(),
          lastMarketPayloadAt: lastMarketPayloadAt || null,
        })}\n\n`),
        8_000,
      );
      // Raw CME MBP can deliver thousands of updates per second. A 32 ms
      // per-symbol coalescing window preserves a fluid tape while preventing
      // the browser main thread from being flooded by redundant book changes.
      downstreamFlush = setInterval(flushPendingPayloads, 32);
      upstreamHealthCheck = setInterval(() => {
        const now = Date.now();
        const upstreamSilent = authenticated && now - lastUpstreamMessageAt > 22_000;
        const marketSilent = authenticated
          && prioritySymbols.size > 0
          && now - (lastPriorityMarketPayloadAt || authenticatedAt) > 30_000;
        if (upstreamSilent || marketSilent) {
          close();
        }
      }, 4_000);
      socket = createConnection({ host: "glbx-mdp3.lsg.databento.com", port: 13000 });
      socket.setKeepAlive(true, 10_000);

      socket.on("data", (chunk) => {
        lastUpstreamMessageAt = Date.now();
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
              const bucket = apiKey.slice(-5);
              socket?.write(`auth=${digest}-${bucket}|dataset=GLBX.MDP3|encoding=json|ts_out=1|heartbeat_interval_s=10\n`);
              continue;
            }
            if (line.startsWith("success=1")) {
              authenticated = true;
              authenticatedAt = Date.now();
              const continuous = symbols.filter(isContinuousFuture);
              const raw = symbols.filter((symbol) => !isContinuousFuture(symbol));
              if (continuous.length) {
                socket?.write(`schema=mbp-1|stype_in=continuous|symbols=${continuous.join(",")}\n`);
                socket?.write(`schema=trades|stype_in=continuous|symbols=${continuous.join(",")}\n`);
              }
              if (raw.length) {
                socket?.write(`schema=mbp-1|stype_in=raw_symbol|symbols=${raw.join(",")}\n`);
                socket?.write(`schema=trades|stype_in=raw_symbol|symbols=${raw.join(",")}\n`);
              }
              socket?.write("start_session=1\n");
              send(`event: status\ndata: ${JSON.stringify({ connected: true, source: "CME", dataset: "GLBX.MDP3" })}\n\n`);
              continue;
            }
            if (line.startsWith("success=0") || line.startsWith("error=")) {
              send(`event: feed-error\ndata: ${JSON.stringify({ error: line })}\n\n`);
              close();
            }
            continue;
          }

          try {
            const record = JSON.parse(line) as {
              hd?: { instrument_id?: number; ts_event?: string | number };
              instrument_id?: number;
              stype_in_symbol?: string;
              stype_out_symbol?: string;
              price?: string | number;
              size?: string | number;
              side?: string;
              bid_px_00?: string | number;
              ask_px_00?: string | number;
              levels?: Array<{ bid_px?: string | number; ask_px?: string | number }>;
              ts_recv?: string | number;
              ts_out?: string | number;
              err?: string;
            };
            const instrumentId = Number(record.hd?.instrument_id ?? record.instrument_id ?? 0);
            if (record.stype_in_symbol && instrumentId) {
              instrumentSymbols.set(instrumentId, record.stype_in_symbol.trim());
              if (record.stype_out_symbol) {
                instrumentContracts.set(instrumentId, record.stype_out_symbol.trim());
              }
              continue;
            }
            if (record.err) {
              send(`event: feed-error\ndata: ${JSON.stringify({ error: record.err })}\n\n`);
              continue;
            }

            const symbol = instrumentSymbols.get(instrumentId);
            const bid = numericPrice(record.levels?.[0]?.bid_px ?? record.bid_px_00);
            const ask = numericPrice(record.levels?.[0]?.ask_px ?? record.ask_px_00);
            const trade = numericPrice(record.price);
            const size = Math.max(0, Number(record.size ?? 0));
            const side = String(record.side ?? "").toUpperCase();
            const isTrade = Boolean(trade && size);
            const mid = bid && ask ? (bid + ask) / 2 : trade || bid || ask;
            if (!symbol || !mid) continue;
            const now = Date.now();
            const payload: CachedLivePayload["payload"] = {
              instrument: symbol,
              contractSymbol: instrumentContracts.get(instrumentId),
              bid: bid || mid,
              ask: ask || mid,
              mid,
              isTrade,
              size: isTrade ? size : undefined,
              trades: isTrade ? 1 : undefined,
              delta: isTrade ? (side === "A" || side === "ASK" ? size : side === "B" || side === "BID" ? -size : 0) : undefined,
              timestamp: record.hd?.ts_event ?? record.ts_recv ?? record.ts_out ?? now,
              broker: "Databento",
            };
            liveQuoteCache.set(symbol, { payload, updatedAt: now });
            queuePayload(payload);
          } catch {
            // Control and metadata records that are not JSON trade records are ignored.
          }
        }
      });

      socket.on("error", (error) => {
        send(`event: feed-error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
        close();
      });
      socket.on("close", close);
      request.signal.addEventListener("abort", close, { once: true });
    },
    cancel() {
      closeStream?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
