/** An explicit load-shed response proves the gateway answered; it is not dead. */
export async function isGatewayBusyResponse(response: Response) {
  if (response.status !== 503 || !/application\/json/i.test(response.headers.get("content-type") ?? "")) return false;
  try {
    const payload = await response.clone().json() as { code?: unknown };
    return payload.code === "live_feed_priority";
  } catch { return false; }
}
