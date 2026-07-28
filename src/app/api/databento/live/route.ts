import { createHash } from "node:crypto";
import { createConnection } from "node:net";
import { isContinuousFuture } from "@/lib/databento";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

function numericPrice(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.abs(parsed) >= 100_000_000 ? parsed / 1_000_000_000 : parsed;
}

export async function GET(request: Request) {
  const apiKey = process.env.DATABENTO_API_KEY;
  if (!apiKey) return new Response("Databento is not configured.", { status: 503 });

  const url = new URL(request.url);
  const symbols = (url.searchParams.get("symbols") ?? "")
    .split(",")
    .map((symbol) => symbol.trim())
    .filter(Boolean)
    .slice(0, 40);
  if (!symbols.length) return new Response("Select at least one instrument.", { status: 400 });

  const encoder = new TextEncoder();
  let socket: ReturnType<typeof createConnection> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const instrumentSymbols = new Map<number, string>();
      const lastEmit = new Map<string, number>();
      let buffer = "";
      let authenticated = false;

      const send = (value: string) => {
        if (!closed) controller.enqueue(encoder.encode(value));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        socket?.destroy();
        try { controller.close(); } catch {}
      };

      send("retry: 1500\n\n");
      socket = createConnection({ host: "glbx-mdp3.lsg.databento.com", port: 13000 });
      socket.setKeepAlive(true, 10_000);

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
              const bucket = apiKey.slice(-5);
              socket?.write(`auth=${digest}-${bucket}|dataset=GLBX.MDP3|encoding=json|ts_out=1|heartbeat_interval_s=10\n`);
              continue;
            }
            if (line.startsWith("success=1")) {
              authenticated = true;
              const continuous = symbols.filter(isContinuousFuture);
              const raw = symbols.filter((symbol) => !isContinuousFuture(symbol));
              if (continuous.length) socket?.write(`schema=mbp-1|stype_in=continuous|symbols=${continuous.join(",")}\n`);
              if (raw.length) socket?.write(`schema=mbp-1|stype_in=raw_symbol|symbols=${raw.join(",")}\n`);
              socket?.write("start_session=1\n");
              send(`event: status\ndata: ${JSON.stringify({ connected: true, source: "Databento", dataset: "GLBX.MDP3" })}\n\n`);
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
            const mid = bid && ask ? (bid + ask) / 2 : trade || bid || ask;
            if (!symbol || !mid) continue;
            const now = Date.now();
            if (now - (lastEmit.get(symbol) ?? 0) < 250) continue;
            lastEmit.set(symbol, now);
            send(`data: ${JSON.stringify({
              instrument: symbol,
              bid: bid || mid,
              ask: ask || mid,
              mid,
              timestamp: record.hd?.ts_event ?? record.ts_recv ?? record.ts_out ?? now,
              broker: "Databento",
            })}\n\n`);
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
      closed = true;
      socket?.destroy();
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
