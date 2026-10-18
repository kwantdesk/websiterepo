export const GEX_DATA_TOOLS: Record<string, { surface: "options" | "equities"; path?: string }> = Object.fromEntries([
  ...["contract-statistics", "contract-trade-side-statistics", "exposure-by-expiration", "exposure-by-strike", "gainers-losers", "heat-map", "interval-map", "iv-rank", "market-share", "max-pain", "max-pain-over-time", "net-drift", "option-price-over-time"].map(id => [id, { surface: "options" }]),
  ["order-flow-consolidated", { surface: "options", path: "order-flow/consolidated" }],
  ...["dark-flow", "dark-pool-levels", "equity-prints", "exchange-notifications", "market-map", "stock-price-over-time"].map(id => [id, { surface: "equities" }]),
]);

// Published NYSE calendar, verified 2026-10-18: https://www.nyse.com/trade/hours-calendars
const HOLIDAYS: Record<string, string[]> = {
  "2026": ["01-01", "01-19", "02-16", "04-03", "05-25", "06-19", "07-03", "09-07", "11-26", "12-25"],
  "2027": ["01-01", "01-18", "02-15", "03-26", "05-31", "06-18", "07-05", "09-06", "11-25", "12-24"],
  "2028": ["01-17", "02-21", "04-14", "05-29", "06-19", "07-04", "09-04", "11-23", "12-25"],
};
const EARLY_CLOSE = new Set(["2026-11-27", "2026-12-24", "2027-11-26", "2028-07-03", "2028-11-24"]);
export function gexDataClock(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now).map(part => [part.type, part.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`, minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const tradingDate = (date: string) => { const day = new Date(date + "T12:00:00Z").getUTCDay(); return day > 0 && day < 6 && !(HOLIDAYS[date.slice(0, 4)] ?? []).includes(date.slice(5)); };
  let sessionDate = date;
  if (!tradingDate(date) || minutes < 240) {
    const cursor = new Date(date + "T12:00:00Z");
    do { cursor.setUTCDate(cursor.getUTCDate() - 1); sessionDate = cursor.toISOString().slice(0, 10); } while (!tradingDate(sessionDate));
  }
  const known = Boolean(HOLIDAYS[parts.year]), day = known && tradingDate(date), early = EARLY_CLOSE.has(date);
  const optionsClose = early ? 795 : 975, equitiesClose = early ? 1020 : 1200;
  const optionsOpen = day && minutes >= 570 && minutes < optionsClose;
  const equitiesOpen = day && minutes >= 240 && minutes < equitiesClose;
  let optionsSessionDate=sessionDate;
  if(day&&minutes<570){const cursor=new Date(date+"T12:00:00Z");do{cursor.setUTCDate(cursor.getUTCDate()-1);optionsSessionDate=cursor.toISOString().slice(0,10);}while(!tradingDate(optionsSessionDate));}
  return { open: optionsOpen, optionsOpen, equitiesOpen, sessionDate, optionsSessionDate, date, calendarVerified: known,
    note: "Session schedule is not proof of live data; check the last successful source timestamp.",
    phase: optionsOpen ? "OPEN" : "CLOSED", easternTime: `${parts.hour}:${parts.minute}` };
}

export function validateGexDataRequest(tool: string, input: unknown) {
  if (!GEX_DATA_TOOLS[tool]) throw new Error("Unsupported GEX DATA tool.");
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid request body.");
  const visit = (value: unknown, depth = 0) => {
    if (depth > 12) throw new Error("The filter is too deeply nested.");
    if (value && typeof value === "object") {
      if (Array.isArray(value) && value.length > 500) throw new Error("Too many filter values.");
      for (const [key, child] of Object.entries(value)) {
        if (["__proto__", "prototype", "constructor"].includes(key)) throw new Error("Invalid filter field.");
        visit(child, depth + 1);
      }
    }
  }; visit(input);
  const body = structuredClone(input) as Record<string, unknown>;
  const validDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value + "T12:00:00Z").toISOString().startsWith(value);
  if (body.sessionDate !== undefined && !validDate(body.sessionDate)) throw new Error("Invalid session date.");
  if (body.aggregationPeriod !== undefined && !/^(?:[1-5]m|10m|15m|20m|30m|[124]h|1d)$/.test(String(body.aggregationPeriod))) throw new Error("Unsupported aggregation period.");
  if (body.size !== undefined && (!Number.isInteger(body.size) || Number(body.size) < 1 || Number(body.size) > 100)) throw new Error("Page size must be between 1 and 100.");
  if (body.snapshotTime !== undefined && !Number.isFinite(Date.parse(String(body.snapshotTime)))) throw new Error("Invalid snapshot time.");
  const range = body.sessionDateRange as Record<string, unknown> | undefined;
  if (range && (!validDate(range.startDate) || (range.endDate !== undefined && !validDate(range.endDate)))) throw new Error("Invalid date range.");
  if (range && Date.parse(String(range.endDate ?? range.startDate)) < Date.parse(String(range.startDate))) throw new Error("The end date must not precede the start date.");
  if (range && Date.parse(String(range.endDate ?? range.startDate)) - Date.parse(String(range.startDate)) > 93 * 86_400_000) throw new Error("Choose a range of at most three months.");
  const timeRange = body.timeRange as Record<string, unknown> | undefined;
  if(timeRange){const start=Date.parse(String(timeRange.startTime)),end=Date.parse(String(timeRange.endTime));if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>93*86_400_000)throw new Error("Invalid time range.");}
  const filter = body.filter as Record<string, unknown> | undefined;
  const tickers = [filter?.ticker, ...(Array.isArray(filter?.tickers) ? filter.tickers : [])].filter(Boolean);
  if (tickers.length > 50 || tickers.some(ticker => !/^[A-Z0-9./^_-]{1,16}$/i.test(String(ticker)))) throw new Error("Invalid ticker filter.");
  if (tool === "iv-rank" && (body.sessionDate || body.snapshotTime)) throw new Error("IV Rank supports its rolling series, not a historical session snapshot.");
  return body;
}
