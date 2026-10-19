# Slow timeframe loading and bursty candles

Owner reported timeframes stuck loading, a40s 5m startup and ~5s candle updates.
Read-only checks, same live gateway/credentials, no restarts or paid resources:

- NQZ6 seven-day base history:1m local67ms/public976ms(6848 candles),5m
  local58ms/public540ms(1374),15m local58ms/public508ms(462),1h
  local58ms/public400ms(119). These samples are NOT every symbol/timeframe.
- Root NQ ten-day5m: public873ms,1388 candles,140811 bytes. With orderFlow=1:
  public674ms,1388 candles,50000 execution tuples,1884404 bytes.
- Gateway event-loop overloaded=false,lastLag10ms,maxLag110ms,no trips.
- Base chart loading already paints OHLC separately before supplemental flow;
  the observed40s signed-in startup is not reproduced by these API samples.
  Browser hydration/other pending requests/transport contention remain unisolated.
- Live pricing uses /api/databento/live -> gateway /quotes SSE; exact executions
  use /trades SSE. This is not an intentional five-second candle publication rate.
- Earlier same-session comparison showed local live trade batches while public
  quick tunnel stalled after its seed. Cloudflare's official documentation
  explicitly says quick tunnels do not support SSE and buffer text/event-stream.
  https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/
  https://developers.cloudflare.com/sandbox/sdk/api/tunnels/

Required: replace quick tunnel with a verified SSE-capable production origin
(proper named tunnel or new VPS). Existing Tailscale Funnel was previously
unreachable from production; its laptop-local success is not external proof.
No Cloudflare account/tunnel credentials are configured in the known local
.cloudflared location. Do not purchase infrastructure, weaken TLS/auth, invent
ticks or increase per-user Vercel polling to disguise an unsupported transport.

OPEN: stable origin and live stream verification; reproduce/trace40s signed-in
load; event-based timeframe coverage and all-instrument acceptance checks.
No source fix/deployment is claimed in this diagnostic turn.
