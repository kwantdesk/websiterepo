export type FinancialHeadline = {
  id: string;
  title: string;
  publishedAt: string;
  url: string;
  categories: string[];
};
export type FinancialInfoPayload = {
  source: "FinancialJuice RSS";
  mode: "scheduled-rss";
  configured: boolean;
  status: "not_configured" | "waiting" | "connected" | "stale" | "unavailable";
  items: FinancialHeadline[];
  collectedAt: string | null;
  checkedAt: string | null;
  stale: boolean;
  refreshAfterMs: number;
  note: string;
};
export function financialInfoUnavailable(configured = false): FinancialInfoPayload {
  return { source: "FinancialJuice RSS", mode: "scheduled-rss", configured, status: configured ? "unavailable" : "not_configured", items: [], collectedAt: null, checkedAt: null, stale: true, refreshAfterMs: configured ? 60_000 : 900_000, note: configured ? "Financial Info cannot connect right now." : "Financial Info is not connected yet." };
}
export function parseFinancialInfo(value: unknown): FinancialInfoPayload {
  if (!value || typeof value !== "object") throw Error("Invalid news response");
  const v = value as FinancialInfoPayload;
  if (v.source !== "FinancialJuice RSS" || v.mode !== "scheduled-rss" || typeof v.configured !== "boolean" || typeof v.stale !== "boolean" || !["not_configured", "waiting", "connected", "stale", "unavailable"].includes(v.status) || !Array.isArray(v.items) || v.items.length > 500 || typeof v.note !== "string" || v.note.length > 1000) throw Error("Invalid news response");
  const validDate = (date: unknown) => date === null || (typeof date === "string" && Number.isFinite(Date.parse(date)));
  if (!validDate(v.collectedAt) || !validDate(v.checkedAt)) throw Error("Invalid news timestamps");
  const items = v.items.map(item => {
    if (!item || !/^[a-f0-9]{24}$/.test(item.id) || typeof item.title !== "string" || !item.title || item.title.length > 2000 || typeof item.publishedAt !== "string" || !validDate(item.publishedAt) || !Array.isArray(item.categories) || item.categories.length > 10 || item.categories.some(category => typeof category !== "string" || category.length > 60)) throw Error("Invalid headline");
    if (typeof item.url !== "string" || item.url.length > 2000) throw Error("Invalid source URL");
    const url = new URL(item.url);
    if (url.protocol !== "https:" || !["financialjuice.com", "www.financialjuice.com"].includes(url.hostname) || url.username || url.password || url.port) throw Error("Invalid source URL");
    return { id: item.id, title: item.title, publishedAt: item.publishedAt, url: url.href, categories: item.categories };
  });
  return { source: v.source, mode: v.mode, configured: v.configured, status: v.status, items, collectedAt: v.collectedAt, checkedAt: v.checkedAt, stale: v.stale, refreshAfterMs: v.configured ? 60_000 : 900_000, note: v.note };
}
