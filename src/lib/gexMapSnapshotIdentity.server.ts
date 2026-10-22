import { createHash } from "node:crypto";
import type { GexMapPanelPayload } from "./gexMap";

/** Totals/counts/asOf cannot detect offsetting strike corrections. Hash every
 * delivered market-data field, excluding only the changing transport quota.
 * No extra provider request, polling, or history expansion is needed.
 */
export function gexMapSnapshotIdentity(query: string, payload: GexMapPanelPayload) {
  return createHash("sha256").update(query).update("\n")
    .update(JSON.stringify({ ...payload, rateLimitRemaining: null })).digest("base64url");
}
