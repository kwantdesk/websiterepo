import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const gate = readFileSync(new URL("vercel-should-build.sh", import.meta.url), "utf8");
const compareScript = fileURLToPath(new URL("github-compare-files.mjs", import.meta.url));

assert.match(gate, /github-compare-files\.mjs/);
assert.match(gate, /git fetch --depth=2 origin "\$VERCEL_GIT_COMMIT_REF"/);
assert.match(gate, /No comparable base in this shallow clone or GitHub/);

const files = execFileSync(
  process.execPath,
  [
    compareScript,
    "kwantdesk",
    "websiterepo",
    "14084ed2b2900c299f6899349c328f8b814d0057",
    "998ab1b84afeb3396026fd46db89215c97fca4e0",
  ],
  { encoding: "utf8", cwd: root },
).trim().split("\n");

assert.ok(files.includes("services/rithmic_gateway/deploy/bootstrap-vm.sh"));
assert.ok(files.every((file) => /^(services\/rithmic_gateway\/|docs\/|scripts\/|CLAUDE\.md$)/.test(file)));

const invalid = spawnSync(
  process.execPath,
  [compareScript, "bad/owner", "repo", "abc", "def"],
  { encoding: "utf8", cwd: root },
);
assert.notEqual(invalid.status, 0, "invalid or ambiguous comparisons must fail closed");

console.log("vercel build gate: shallow-clone fallback verified");
