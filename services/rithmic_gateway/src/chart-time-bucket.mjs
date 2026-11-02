import { chicagoTradingDate, cmeSessionBounds } from "./trading-session.mjs";

const calendarBuckets = new Map();

// Shared by recorded aggregation and browser live continuation. Calendar bars
// must not change to UTC-midnight or fixed 30-day buckets when a trade arrives.
export function chartTimeBucketStartMs(timestamp, interval) {
  const match = String(interval).match(/^(\d+)(s|m|h|D|W|M)$/);
  if (!match || !Number.isFinite(timestamp)) return timestamp;
  const count = Math.max(1, Number(match[1])), unit = match[2];
  if (unit === "s" || unit === "m" || unit === "h") {
    const duration = count * ({ s: 1000, m: 60000, h: 3600000 })[unit];
    return Math.floor(timestamp / duration) * duration;
  }
  const sessionDate = chicagoTradingDate(timestamp);
  const key = interval + ":" + sessionDate;
  if (calendarBuckets.has(key)) return calendarBuckets.get(key);
  const date = new Date(sessionDate + "T00:00:00Z");
  if (unit === "D") {
    date.setTime(Math.floor(date.getTime() / (count * 86400000)) * count * 86400000);
  } else if (unit === "W") {
    // A CME week opens Sunday evening; Monday's session must not be grouped
    // into the previous week just because its recording is dated Sunday.
    date.setUTCDate(date.getUTCDate() - date.getUTCDay());
    const epochSunday = Date.UTC(1970, 0, 4);
    date.setTime(epochSunday + Math.floor((date.getTime() - epochSunday) / (count * 604800000)) * count * 604800000);
  } else {
    // CME session labels name the closing day. The December 1 session opens
    // November 30 at 17:00 Chicago and belongs to December's candle.
    date.setUTCDate(date.getUTCDate() + 1);
    const month = Math.floor((date.getUTCFullYear() * 12 + date.getUTCMonth()) / count) * count;
    date.setTime(Date.UTC(Math.floor(month / 12), month % 12, 0));
  }
  const bucket = cmeSessionBounds(date.toISOString().slice(0, 10)).startMs;
  calendarBuckets.set(key, bucket);
  if (calendarBuckets.size > 1024) calendarBuckets.delete(calendarBuckets.keys().next().value);
  return bucket;
}
