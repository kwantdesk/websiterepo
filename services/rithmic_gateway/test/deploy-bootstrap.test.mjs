import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const bootstrapUrl = new URL("../deploy/bootstrap-vm.sh", import.meta.url);
const preserveEnvUrl = new URL("../deploy/preserve-provider-env.py", import.meta.url);

test("VM bootstrap checks gateway health inside the private Docker network", async () => {
  const source = await readFile(bootstrapUrl, "utf8");

  assert.match(source, /docker compose exec -T gateway node -e/);
  assert.doesNotMatch(source, /curl[^\n]*127\.0\.0\.1:8793/);
});

test("VM bootstrap refuses to replace production without QuantData", async () => {
  const source = await readFile(bootstrapUrl, "utf8");

  const credentialCheck = source.indexOf("^QUANTDATA_API_KEY=.+$");
  const deployment = source.indexOf("docker compose up -d --build");
  assert.ok(credentialCheck >= 0, "QuantData credential preflight is missing");
  assert.ok(credentialCheck < deployment, "credential preflight must run before deployment");
  assert.match(source, /refusing to replace the live gateway/);
});

test("deploys preserve QuantData but cannot resurrect retired provider credentials", async () => {
  const source = await readFile(preserveEnvUrl, "utf8");

  assert.match(source, /"QUANTDATA_API_KEY"/);
  assert.match(source, /"QUANTDATA_MIN_SPACING_MS"/);
  assert.match(source, /"QUANTDATA_EDGE_CACHE_MS"/);
  assert.doesNotMatch(source, /"DATABENTO_API_KEY"/);
  assert.doesNotMatch(source, /"MASSIVE_API_KEY"/);
});
