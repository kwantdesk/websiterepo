import assert from "node:assert/strict";
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { LabRepositoryStore } from "../src/lab-repository.mjs";

function snapshot(root = "NQ", environment = "LIVE") {
  return {
    version: "kwantdesk-august-v1-lab-v1",
    environment,
    root,
    sessionDate: "2026-08-25",
    phase: "PREOPEN",
    publishedAt: "2026-08-25T13:00:00.000Z",
    updatedAt: "2026-08-25T13:00:00.000Z",
    refreshAfterMs: 15_000,
    receipt: { repository: "test", commit: "test", artifact: `runtime/${root}/current.json` },
    mode: {},
    summary: {},
    film: { deltas: [] },
    trade: {},
    cogs: [],
    gates: [],
    levels: [],
    noTrade: [],
    scenarios: [],
    updates: [],
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

test("atomically publishes current and archived LIVE frames", async () => {
  const repository = await mkdtemp(join(tmpdir(), "kwantdesk-lab-publish-"));
  try {
    const runtime = join(repository, "AUGUST_V1_QUANT_DESK_FRAMEWORK", "runtime");
    await mkdir(runtime, { recursive: true });
    const store = new LabRepositoryStore({ root: repository });
    const value = snapshot();
    assert.deepEqual(await store.publishSnapshot(value), value);
    assert.deepEqual(await store.readSnapshot("NQ"), value);
    const current = JSON.parse(await readFile(join(runtime, "NQ", "current.json"), "utf8"));
    assert.deepEqual(current, value);
    const archive = await readdir(join(runtime, "NQ", "archive"));
    assert.equal(archive.length, 1);
    assert.ok(store.health().lastPublishedAt);
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

test("refuses an out-of-order frame without replacing current", async () => {
  const repository = await mkdtemp(join(tmpdir(), "kwantdesk-lab-order-"));
  try {
    await mkdir(join(repository, "AUGUST_V1_QUANT_DESK_FRAMEWORK", "runtime"), { recursive: true });
    const store = new LabRepositoryStore({ root: repository });
    const current = { ...snapshot(), updatedAt: "2026-08-25T13:05:00.000Z" };
    await store.publishSnapshot(current);
    await assert.rejects(
      () => store.publishSnapshot({ ...snapshot(), updatedAt: "2026-08-25T13:04:00.000Z" }),
      /out-of-order/,
    );
    assert.deepEqual(await store.readSnapshot("NQ"), current);
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});
