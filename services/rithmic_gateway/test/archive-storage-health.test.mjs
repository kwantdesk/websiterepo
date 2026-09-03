import assert from "node:assert/strict";
import test from "node:test";

import { archiveStorageHealth } from "../src/archive-storage-health.mjs";

const GIB = 1024 ** 3;
const filesystem = (freeGiB) => async () => ({
  bsize: 4096,
  blocks: (80 * GIB) / 4096,
  bavail: (freeGiB * GIB) / 4096,
});

test("archive capacity becomes critical before the recorder reaches zero bytes", async () => {
  const status = await archiveStorageHealth("/recordings", { statfsImpl: filesystem(5.8) });
  assert.equal(status.state, "critical");
  assert.equal(status.usedPercent, 92.8);
  assert.equal(status.offBoxBackupRequired, true);
});

test("healthy capacity remains observable", async () => {
  const status = await archiveStorageHealth("/recordings", { statfsImpl: filesystem(30) });
  assert.equal(status.state, "ok");
  assert.equal(status.freeBytes, 30 * GIB);
});

test("a capacity probe failure is explicit rather than healthy by default", async () => {
  const status = await archiveStorageHealth("/recordings", {
    statfsImpl: async () => { throw new Error("not mounted"); },
  });
  assert.equal(status.state, "unknown");
  assert.match(status.error, /not mounted/);
});
