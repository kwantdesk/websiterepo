import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { containsPrivateTerminology, publicFacingTerminology } from "../src/lib/privateTerminology.ts";

const forbidden = ["MENTHROQ", "Trinity", "bookmap", "QuantData", "DATABENTO", "rithmic", "Skylit"];

test("private provider and research names are removed case-insensitively", () => {
  const result = publicFacingTerminology(forbidden.join(" · "));
  for (const term of forbidden) assert.doesNotMatch(result, new RegExp(`\\b${term}\\b`, "i"));
  assert.equal(containsPrivateTerminology(result), false);
});

test("ordinary words containing similar letters are not damaged", () => {
  assert.equal(publicFacingTerminology("Linear, logarithmic and algorithmic"), "Linear, logarithmic and algorithmic");
});

test("the privacy guard covers the root app and dynamic visible surfaces", () => {
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  const guard = readFileSync("src/components/PrivateTerminologyGuard.tsx", "utf8");
  assert.match(layout, /<PrivateTerminologyGuard\s*\/>/);
  assert.match(layout, /kwant-private-copy-pending/);
  assert.match(guard, /MutationObserver/);
  assert.match(guard, /characterData:\s*true/);
  for (const attribute of ["aria-label", "alt", "placeholder", "title"]) assert.match(guard, new RegExp(attribute));
  assert.match(guard, /HTMLIFrameElement/);
  assert.match(guard, /classList\.remove\("kwant-private-copy-pending"\)/);
});
