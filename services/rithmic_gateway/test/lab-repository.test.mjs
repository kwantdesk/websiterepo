import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { LabRepositoryStore } from "../src/lab-repository.mjs";

function snapshot(root = "NQ", environment = "LIVE") {
  return {
    version: "kwantdesk-august-v1-lab-v1",
    environment,
    root,
    updatedAt: "2026-08-25T13:00:00.000Z",
  };
}

test("reads only the current LIVE artifact for the requested root", async () => {
  const repository = await mkdtemp(join(tmpdir(), "kwantdesk-lab-repo-"));
  try {
    const folder = join(repository, "AUGUST_V1_QUANT_DESK_FRAMEWORK", "runtime", "NQ");
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, "current.json"), JSON.stringify(snapshot()), "utf8");
    const store = new LabRepositoryStore({ root: repository });
    assert.deepEqual(await store.readSnapshot("nq"), snapshot());
    assert.equal(store.health().configured, true);
    assert.ok(store.health().lastReadAt);
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

test("rejects test artifacts and missing repository configuration", async () => {
  const repository = await mkdtemp(join(tmpdir(), "kwantdesk-lab-repo-"));
  try {
    const folder = join(repository, "runtime", "ES");
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, "current.json"), JSON.stringify(snapshot("ES", "TEST")), "utf8");
    const store = new LabRepositoryStore({ root: repository });
    await assert.rejects(() => store.readSnapshot("ES"), /LIVE-environment gate/);
    await assert.rejects(() => new LabRepositoryStore().readSnapshot("NQ"), /not configured/);
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});
