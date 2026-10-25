import { createHmac, randomBytes } from "node:crypto";

export const BROWSER_STREAM_PATHS = new Set([
  "/v1/market-data/quotes", "/v1/market-data/trades",
  "/v1/market-data/index-stream", "/v1/heatmap/stream",
  "/v1/heatmap/replay", "/v1/heatmap/replay/chunk",
]);
export const BROWSER_STREAM_ORIGINS = new Set([
  "https://www.kwantdesk.com", "https://kwantdesk.com",
]);

/** Read-only, exact-request lease. Never send the signing/gateway key to a client. */
export function signBrowserStreamTicket({ key, origin, path, search = "", now = Date.now() }: {
  key: string; origin: string; path: string; search?: string; now?: number;
}) {
  if (!key || !BROWSER_STREAM_ORIGINS.has(origin) || !BROWSER_STREAM_PATHS.has(path)
    || search.length > 4096 || (search && !search.startsWith("?"))) {
    throw new Error("Unsupported browser market stream.");
  }
  const payload = Buffer.from(JSON.stringify({
    v: 1, aud: "kwantdesk-browser-stream", origin, path, search,
    iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + 300,
    nonce: randomBytes(12).toString("base64url"),
  })).toString("base64url");
  const signature = createHmac("sha256", key)
    .update("kwantdesk-browser-stream-v1\n" + payload).digest("base64url");
  return payload + "." + signature;
}
