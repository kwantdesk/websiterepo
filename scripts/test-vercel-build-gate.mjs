import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const gate = readFileSync(new URL("vercel-should-build.sh", import.meta.url), "utf8");
const gatePath = fileURLToPath(new URL("vercel-should-build.sh", import.meta.url));

assert.match(gate, /git fetch --depth=2 origin "\$VERCEL_GIT_COMMIT_REF"/);
assert.match(gate, /https:\/\/github\.com\/\$\{VERCEL_GIT_REPO_OWNER\}\/\$\{VERCEL_GIT_REPO_SLUG\}\.git/);
assert.doesNotMatch(gate, /api\.github\.com/, "the gate must not depend on shared-IP REST quotas");

const shell = process.platform === "win32" ? "C:\\Program Files\\Git\\bin\\sh.exe" : "sh";
const shallow = mkdtempSync(join(tmpdir(), "kd-vercel-shallow-"));
try {
  const git = (...args) => execFileSync("git", ["-C", shallow, ...args], { encoding: "utf8" });
  git("init", "-q");
  git("fetch", "--depth=1", "https://github.com/kwantdesk/websiterepo.git", "main");
  git("checkout", "-q", "FETCH_HEAD");
  const head = git("rev-parse", "HEAD").trim();
  const previous = execFileSync("git", ["show", "-s", "--format=%P", head], {
    cwd: root,
    encoding: "utf8",
  }).trim().split(" ")[0];
  const missingParent = spawnSync("git", ["-C", shallow, "cat-file", "-e", `${previous}^{commit}`]);
  assert.notEqual(missingParent.status, 0, "fixture must begin without its parent");

  const output = execFileSync(shell, [gatePath], {
    cwd: shallow,
    encoding: "utf8",
    env: {
      ...process.env,
      VERCEL_GIT_PREVIOUS_SHA: previous,
      VERCEL_GIT_COMMIT_SHA: head,
      VERCEL_GIT_COMMIT_REF: "main",
      VERCEL_GIT_REPO_OWNER: "kwantdesk",
      VERCEL_GIT_REPO_SLUG: "websiterepo",
    },
  });
  assert.match(output, /Only unshipped paths changed — skipping the build/);
} finally {
  rmSync(shallow, { recursive: true, force: true });
}

console.log("vercel build gate: shallow-clone fallback verified");
