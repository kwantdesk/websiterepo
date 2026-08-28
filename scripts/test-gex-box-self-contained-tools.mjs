import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * GEX BOX tools that fetch their own data must still render.
 *
 * The panel refuses to draw a tool whose catalogue entry has no endpoint,
 * reading that as "this saved panel no longer has a licensed source". For most
 * tools that is right. For a tool whose renderer is a whole workspace it is
 * exactly backwards - those have no endpoint BECAUSE the component fetches for
 * itself - and the guard sat above their branches, so GEX CAL and GEX Flow
 * both returned "Tool unavailable" and neither renderer was ever reached.
 *
 * Mounted directly at a panel's size, GEX CAL draws 3,619 cells from a healthy
 * 7,108-entry forward chain with no console errors. Nothing was wrong with the
 * tool; the panel simply never asked it to draw.
 */

const source = readFileSync(
  new URL("../src/components/gexbot/GexBoxDashboard.tsx", import.meta.url),
  "utf8",
);

let passed = 0;
const check = (name, fn) => { fn(); passed += 1; console.log(`  ok  ${name}`); };

/** Catalogue entries declared with no endpoint. */
const endpointless = [...source.matchAll(/\{ id: "([a-z0-9-]+)", label: "([^"]+)"[^}]*endpoint: null \}/g)]
  .map((match) => ({ id: match[1], label: match[2] }));

check("the tools without an endpoint are the ones we know about", () => {
  // A new endpointless tool is either self-contained and must be exempted, or
  // genuinely dead. Either way somebody has to decide, rather than it silently
  // reporting itself unavailable.
  assert.ok(endpointless.length > 0, "the catalogue no longer has endpointless tools to protect");
  const exempt = /SELF_CONTAINED_TOOL_IDS = new Set\(\[([^\]]*)\]\)/.exec(source)?.[1] ?? "";
  for (const tool of endpointless) {
    assert.ok(
      exempt.includes(`"${tool.id}"`),
      `${tool.id} (${tool.label}) has no endpoint and is not exempt, so its panel says "Tool unavailable"`,
    );
  }
});

check("every exempted tool actually has a renderer", () => {
  // An exemption without a branch would fall through to the generic table,
  // which is the "misleading flattened tool" this dashboard refuses to show.
  const exempt = [...(/SELF_CONTAINED_TOOL_IDS = new Set\(\[([^\]]*)\]\)/.exec(source)?.[1] ?? "")
    .matchAll(/"([a-z0-9-]+)"/g)].map((match) => match[1]);
  assert.ok(exempt.length > 0, "nothing is exempt");
  for (const id of exempt) {
    assert.ok(
      source.includes(`panel.toolId === "${id}"`),
      `${id} is exempt from the endpoint guard but has no renderer branch`,
    );
  }
});

check("the guard runs after the exemption, not before it", () => {
  /*
   * Order is the whole defect. The guard and the branches were both present and
   * correct; the guard simply came first.
   */
  const guardAt = source.indexOf("!selfContained && !tool?.endpoint");
  const exemptAt = source.indexOf("const selfContained = SELF_CONTAINED_TOOL_IDS.has");
  assert.ok(guardAt > 0, "the guard no longer consults the exemption");
  assert.ok(exemptAt > 0 && exemptAt < guardAt, "the exemption is resolved after the guard runs");
  for (const id of ["gex-flow", "gex-cal"]) {
    const branchAt = source.indexOf(`panel.toolId === "${id}"`);
    assert.ok(branchAt > guardAt, `${id} has no branch after the guard`);
  }
});

check("a tool with a real endpoint is still refused when it loses it", () => {
  // The guard has to keep doing its job: a saved panel pointing at a source
  // that no longer exists must say so rather than draw an empty shell.
  assert.match(source, /Tool unavailable/, "the unavailable state was deleted rather than bypassed");
  assert.match(source, /no longer has an authoritative licensed source/);
});

console.log(`\ngex box self-contained tools: ${passed}/${passed} checks passed`);
