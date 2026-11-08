# Embedded workspace stylesheet recovery

The reported GEX Data screen exposes the original unstyled document while the parent shell remains styled. Public HTML and base/workspace/site CSS all returned HTTP 200 with the correct MIME type during investigation. The original incident's failed network responses are unavailable, so its exact transport cause is not proven.

GEX Data and Kwanty had no critical-styles readiness or recovery gate. An isolated browser reproduced the exposed native controls when their styles failed. Both now run an inline gate before external assets, verify nonempty parsed CSS, retry failed/invalid responses with bounded backoff (at most five retries per stylesheet), and retry missing styles again after connectivity returns or the page becomes visible. The existing theme bootstrap continues to paint the themed background. No raw controls are revealed while styles are missing. Persistent offline/asset failure can still leave the themed workspace empty; it cannot manufacture usable assets.

Liquidity Map already had a readiness/retry gate, but trusted load events and sheet existence even when an HTML response parsed as an empty CSS sheet. Its gate now also verifies nonempty parsed CSS before revealing the workspace.

## Verification

`node scripts/audits/embed-style-recovery-browser.cjs` passed ten isolated headless Chrome checks: each of GEX Data, Kwanty and Liquidity Map with delayed CSS, a failed network request and an HTML response in place of CSS; all recover without exposing unstyled controls. A negative control removes the new gate and reproduces the visible unstyled body. External app scripts/provider calls were blocked; this verifies asset recovery, not live-data parity.

Full isolated production webpack build (including TypeScript and page generation) and scoped whitespace validation passed. Only the three static HTML documents, the browser regression and this report belong to this release. No backend restart, trading/account changes or saved-workspace changes.
