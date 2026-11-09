type RetainedResponse = { text: string; status: number; headers: [string, string][] };

/** Revalidate an account-local retained body; never reuse another request's
 * validator or return an empty 304 to chart parsers. Callers own cache bounds,
 * account lifetime, cancellation, coalescing and refresh cadence. */
export async function revalidatePrivateTool(
  fetcher: typeof fetch, url: string, options: RequestInit,
  previous?: RetainedResponse,
): Promise<Response> {
  const headers = new Headers(options.headers);
  const etag = previous && previous.status === 200 ? new Headers(previous.headers).get("etag") : null;
  headers.delete("If-None-Match");
  if (etag) headers.set("If-None-Match", etag);
  const response = await fetcher(url, { ...options, cache: "no-store", headers });
  if (response.status !== 304) return response;
  if (!etag || !previous) throw new Error("No retained data for the response validator.");
  const merged = new Headers(previous.headers);
  response.headers.forEach((value, key) => merged.set(key, value));
  return new Response(previous.text, { status: 200, headers: merged });
}
