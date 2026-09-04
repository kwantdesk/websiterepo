const [symbol = "NQ.v.0", interval = "40r", daysValue = "10"] = process.argv.slice(2);
const days = Math.max(1, Number(daysValue) || 10);
const end = Date.now();
const start = end - days * 86_400_000;
const query = new URLSearchParams({
  symbol,
  interval,
  fromMs: String(start),
  toMs: String(end),
  limit: "250000",
  orderFlow: "1",
});
const started = Date.now();
const response = await fetch(`http://127.0.0.1:${process.env.RITHMIC_GATEWAY_PORT || 8793}/v1/market-data/history?${query}`, {
  headers: { Authorization: `Bearer ${process.env.KWANTIFY_MARKET_DATA_GATEWAY_TOKEN}` },
});
const payload = await response.json();
console.log(JSON.stringify({
  symbol,
  interval,
  status: response.status,
  elapsedMs: Date.now() - started,
  candles: payload.candles?.length ?? 0,
  executions: payload.executions?.length ?? 0,
  sourceRecords: payload.sourceRecordCount ?? 0,
  first: payload.candles?.[0]?.timestamp ?? null,
  last: payload.candles?.at(-1)?.timestamp ?? null,
  error: payload.error ?? null,
}));
