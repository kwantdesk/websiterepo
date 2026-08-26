import { createHash } from "node:crypto";

/**
 * Answer a repeat request with 304 instead of the payload again.
 *
 * The heavy market-data routes return multi-megabyte surfaces and were marked
 * `private, no-store`, so every poll from every pane dragged the whole body
 * out of origin even when the surface had not changed. One month measured 612
 * GB of origin transfer at $48.68, while 494 GB served from cache cost
 * nothing — the gamma heatmap alone is 3.46 MB every thirty seconds per pane,
 * for data that only changes once a minute.
 *
 * Two things fix that without altering who may read the data:
 *
 *  - an ETag, so an unchanged surface comes back as a header-only 304;
 *  - `private, max-age`, so several panes polling the same URL inside one
 *    window share the browser's copy and make no request at all.
 *
 * `private` is deliberate. These responses sit behind the session check in
 * their route, so they must never enter a SHARED cache — only the browser
 * that already authenticated for them. That keeps the auth boundary exactly
 * where it is; the saving comes from not resending bytes the client already
 * holds, not from widening access.
 */

export type ConditionalJsonOptions = {
  /**
   * A string that changes exactly when the payload does — normally the
   * request's own cache key plus the payload's `asOf`. Hashing the body would
   * cost more CPU on every request than the transfer it saves.
   */
  identity: string;
  /**
   * How long the browser may reuse its copy without asking. Should be at most
   * the data's own refresh interval, so a pane never shows a surface older
   * than the one the server would give it.
   */
  maxAgeMs?: number;
  /**
   * Verbatim Cache-Control, for a route that already has a policy worth
   * keeping. The ETag is added either way, so an existing policy gains free
   * revalidation without its freshness rules being rewritten underneath it.
   * Must not widen the response to a shared cache.
   */
  cacheControl?: string;
};

/** Weak, because a 304 promises equivalence, not a byte-identical body. */
export function payloadETag(identity: string): string {
  return `W/"${createHash("sha1").update(identity).digest("base64url").slice(0, 22)}"`;
}

/**
 * Returns a plain Response rather than NextResponse: route handlers accept
 * either, and staying on the web standard keeps this testable outside Next's
 * runtime, where `next/server` cannot be resolved.
 */
export function conditionalJson<T>(
  request: Request,
  payload: T,
  options: ConditionalJsonOptions,
): Response {
  const etag = payloadETag(options.identity);
  const maxAgeSeconds = Math.max(0, Math.floor((options.maxAgeMs ?? 0) / 1_000));
  // must-revalidate so a stale copy is never served once the window passes;
  // the ETag then makes that revalidation almost free.
  const cacheControl = options.cacheControl ?? `private, max-age=${maxAgeSeconds}, must-revalidate`;

  if (requestMatchesETag(request, etag)) {
    return new Response(null, {
      status: 304,
      headers: { ETag: etag, "Cache-Control": cacheControl },
    });
  }

  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json",
      ETag: etag,
      "Cache-Control": cacheControl,
    },
  });
}

/**
 * Whether the client already holds this exact payload.
 *
 * `If-None-Match` may carry several tags, and a cache is allowed to add the
 * `W/` weak prefix to one it stored, so compare on the opaque value rather
 * than the raw header.
 */
export function requestMatchesETag(request: Request, etag: string): boolean {
  const header = request.headers.get("if-none-match");
  if (!header) return false;
  if (header.trim() === "*") return true;
  const bare = (tag: string) => tag.trim().replace(/^W\//, "");
  const wanted = bare(etag);
  return header.split(",").some((tag) => bare(tag) === wanted);
}
