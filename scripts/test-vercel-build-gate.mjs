import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const gate = readFileSync(new URL("vercel-should-build.sh", import.meta.url), "utf8");
const gatePath = fileURLToPath(new URL("vercel-should-build.sh", import.meta.url));

assert.match(gate, /github-compare-diff\.mjs/);
assert.doesNotMatch(gate, /api\.github\.com/, "the gate must not depend on shared-IP REST quotas");

const shell = process.platform === "win32" ? "C:\\Program Files\\Git\\bin\\sh.exe" : "sh";
const shallow = mkdtempSync(join(tmpdir(), "kd-vercel-shallow-"));
try {
  mkdirSync(join(shallow, "scripts"));
  copyFileSync(gatePath, join(shallow, "scripts", "vercel-should-build.sh"));
  copyFileSync(
    fileURLToPath(new URL("github-compare-diff.mjs", import.meta.url)),
    join(shallow, "scripts", "github-compare-diff.mjs"),
  );
  const head = "998ab1b84afeb3396026fd46db89215c97fca4e0";
  const previous = "14084ed2b2900c299f6899349c328f8b814d0057";
  assert.equal(spawnSync("git", ["-C", shallow, "status"]).status, 128, "fixture must have no .git directory");

  const output = execFileSync(shell, [join(shallow, "scripts", "vercel-should-build.sh")], {
    cwd: shallow,
    encoding: "utf8",
    env: {
      ...process.env,
      VERCEL_GIT_PREVIOUS_SHA: previous,
      VERCEL_GIT_COMMIT_SHA: head,
    },
  });
  assert.match(output, /Only unshipped paths changed — skipping the build/);
} finally {
  rmSync(shallow, { recursive: true, force: true });
}

console.log("vercel build gate: shallow-clone fallback verified");
