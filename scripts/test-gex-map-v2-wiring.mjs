import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * v2 is offered on the standalone GEX MAP page and nowhere else.
 *
 * The two GEX Map surfaces look identical and share one component, which is
 * exactly why this needs a test rather than a convention. The panels embedded
 * in GEX VUE sit beside charts, overlays and a replay clock; a panel there that
 * could silently be showing a different MEASUREMENT than the one next to it is
 * worse than one that cannot show it at all.
 *
 * v1 is also untouched and tagged. Everything here is additive.
 */

const workspace = readFileSync(new URL("../src/components/gex-map/GexMapWorkspace.tsx", import.meta.url), "utf8");
const host = readFileSync(new URL("../src/components/KwantifyWorkspace.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../src/app/api/gex-map/route.ts", import.meta.url), "utf8");
const server = readFileSync(new URL("../src/lib/gexMapV2.server.ts", import.meta.url), "utf8");
const quantData = readFileSync(new URL("../src/lib/quantData.server.ts", import.meta.url), "utf8");

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

check("only the standalone page opts in", () => {
  // THE BOUNDARY. One mount site passes the flag; the GEX VUE pane must not.
  const mounts = host.match(/<GexMapWorkspace[^>]*/g) ?? [];
  assert.ok(mounts.length >= 2, `expected the standalone page and the GEX VUE pane, found ${mounts.length}`);
  const optedIn = mounts.filter((mount) => mount.includes("enableDealerModel"));
  assert.equal(optedIn.length, 1, "exactly one mount may offer the dealer model");
  // The GEX VUE pane is the one that carries a market and persisted pane state.
  const embedded = mounts.find((mount) => mount.includes("persistedState"));
  assert.ok(embedded, "the GEX VUE pane mount is missing");
  assert.ok(!embedded.includes("enableDealerModel"), "GEX VUE must stay on the structural model");
});

check("the control is hidden unless the host opts in", () => {
  assert.match(workspace, /enableDealerModel = false,/, "it must default off");
  assert.match(workspace, /\{enableDealerModel \? \(/, "the control is gated on the prop");
});

check("v1 is the default everywhere", () => {
  // A trader who has not chosen must be looking at the same numbers as before.
  assert.match(workspace, /useState<"STRUCTURAL_OI" \| "DEALER_INVENTORY">\("STRUCTURAL_OI"\)/);
  assert.match(route, /searchParams\.get\("model"\) \|\| "STRUCTURAL_OI"/);
});

check("the model is part of the cache key", () => {
  // Without this, switching models serves the other calculation's numbers from
  // cache under the new label - the worst failure available to a panel whose
  // entire purpose is which calculation you are looking at.
  assert.match(workspace, /exposureModel === "DEALER_INVENTORY" \? `\$\{base\}:dealer` : base/);
  // And switching must actually refetch.
  assert.match(workspace, /\}, \[exposureModel, expiryScope, panelCacheKey/);
});

check("v2 is gamma only, and says so rather than failing", () => {
  // A dealer book is a gamma position. The same carried contracts revalued
  // through a delta surface would be a different measurement wearing this
  // model's name.
  assert.match(route, /model === "DEALER_INVENTORY" && greekMode !== "GAMMA"/);
  assert.match(route, /dealer inventory model is gamma only/);
  // A DELTA panel stays structural instead of failing the whole load.
  assert.match(workspace, /exposureModel === "DEALER_INVENTORY" && panel\.greekMode === "GAMMA"/);
});

check("v1's own path is untouched", () => {
  // getGexMapPanel must still be reachable and still be what a request without
  // a model parameter gets.
  assert.match(route, /: await getGexMapPanel\(symbol, greekMode, sessionDate, scope, representation\)/);
  assert.doesNotMatch(quantData, /getGexMapPanel[\s\S]{0,4000}?DEALER_INVENTORY/,
    "the structural builder must not learn about the dealer model");
});

check("the tape read is bounded and reports what it missed", () => {
  // The provider caps this endpoint at 100 rows a request and every request
  // takes a slot in the 80ms scheduler. An unbounded read on a five-second
  // panel refresh is the August quota burn again.
  assert.match(quantData, /export async function readConsolidatedTape\(/);
  assert.match(quantData, /maxPages = 40/);
  assert.match(quantData, /truncated: boolean/);
  assert.match(server, /const TAPE_PAGE_LIMIT = 40;/);
  // And the built book is cached so refreshes do not re-read the tape.
  assert.match(server, /unstable_cache\(/);
});

check("the panel admits what the book was built from", () => {
  // A partial book presented as a full one is the dishonesty this prevents.
  assert.match(server, /absorbedPrints: number;/);
  assert.match(server, /tapeTruncated: boolean;/);
  assert.match(server, /tapeFromMs: number \| null;/);
  assert.match(server, /readiness: ReturnType<typeof v2Readiness>;/);
});

check("the two models cannot be confused in the payload", () => {
  const gexMap = readFileSync(new URL("../src/lib/gexMap.ts", import.meta.url), "utf8");
  assert.match(gexMap, /model: "STRUCTURAL_OI" \| "DEALER_INVENTORY";/);
  assert.match(server, /model: "DEALER_INVENTORY",/);
});

console.log(`\ngex map v2 wiring: ${passed}/${passed} checks passed`);
