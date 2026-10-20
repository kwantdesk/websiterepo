// Published dates, not third-Friday arithmetic: June 2026 is holiday-adjusted.
export const FUTURES_CALENDAR_SOURCE = "https://www.cmegroup.com/trading/equity-index/rolldates.html";
export const ALL_FUTURES_CALENDAR_SOURCE = "https://www.cmegroup.com/tools-information/calendars/expiration-calendar.html";
export const FUTURES_VERIFIED_ON = "2026-10-20";
export const FUTURES_PRODUCTS = ["All covered products", "ES", "MES", "NQ", "MNQ", "YM", "MYM", "RTY", "M2K", "Nikkei / TOPIX"] as const;
export type FuturesProduct = typeof FUTURES_PRODUCTS[number];
export type FuturesCalendarEvent = {
  date: string; kind: "expiration" | "roll"; family: "us" | "japan";
  contract: string; products: string[];
};
const published = [
  [2026,3,"3/20","3/16","3/13","3/9"],
  [2026,6,"6/18","6/15","6/12","6/8"],
  [2026,9,"9/18","9/14","9/11","9/7"],
  [2026,12,"12/18","12/14","12/11","12/7"],
  [2027,3,"3/19","3/15","3/12","3/8"],
  [2027,6,"6/18","6/14","6/11","6/7"],
  [2027,9,"9/17","9/13","9/10","9/6"],
  [2027,12,"12/17","12/13","12/10","12/6"],
  [2028,3,"3/17","3/13","3/10","3/6"],
  [2028,6,"6/16","6/12","6/9","6/5"],
  [2028,9,"9/15","9/11","9/8","9/4"],
  [2028,12,"12/15","12/11","12/8","12/4"],
] as const;
export const FUTURES_CALENDAR_YEARS = [...new Set(published.map(row => row[0]))];
export const FUTURES_EVENTS: FuturesCalendarEvent[] = published.flatMap(([year,month,usExpiry,usRoll,japanExpiry,japanRoll]) => {
  const iso = (date: string) => `${year}-${date.split("/").map(part => part.padStart(2,"0")).join("-")}`;
  const contract = `${({3:"H",6:"M",9:"U",12:"Z"} as const)[month]}${String(year).slice(-2)}`;
  return ([
    [usExpiry,"expiration","us"], [usRoll,"roll","us"],
    [japanExpiry,"expiration","japan"], [japanRoll,"roll","japan"],
  ] as const).map(([date,kind,family]) => ({ date: iso(date), kind, family, contract,
    products: family === "us" ? ["ES","MES","NQ","MNQ","YM","MYM","RTY","M2K"] : ["Nikkei / TOPIX"] }));
}).sort((a,b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));

export function futuresCalendarEvents(year: number, product: FuturesProduct, kind: "all" | FuturesCalendarEvent["kind"] = "all") {
  return FUTURES_EVENTS.filter(event => event.date.startsWith(`${year}-`) &&
    (product === "All covered products" || event.products.includes(product)) && (kind === "all" || event.kind === kind));
}
