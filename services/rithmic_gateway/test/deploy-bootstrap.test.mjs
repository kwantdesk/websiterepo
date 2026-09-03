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

test("deploys preserve QuantData but cannot resurrect retired provider credentials", async () => {
  const source = await readFile(preserveEnvUrl, "utf8");

  assert.match(source, /"QUANTDATA_API_KEY"/);
  assert.doesNotMatch(source, /"DATABENTO_API_KEY"/);
  assert.doesNotMatch(source, /"MASSIVE_API_KEY"/);
});
