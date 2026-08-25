import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, stat, unlink } from "node:fs/promises";
import { basename, dirname, resolve, sep } from "node:path";

const SNAPSHOT_VERSION = "kwantdesk-august-v1-lab-v1";
const MAX_SNAPSHOT_BYTES = 5 * 1024 * 1024;
const ROOTS = new Set(["NQ", "ES"]);
const PHASES = new Set(["PREOPEN", "WAKE", "LIVE", "CLOSED"]);
const REQUIRED_OBJECTS = ["receipt", "mode", "summary", "film", "trade"];
const REQUIRED_ARRAYS = ["cogs", "gates", "levels", "noTrade", "scenarios", "updates"];
const FRAMEWORK = "AUGUST_V1_QUANT_DESK_FRAMEWORK";

function inside(root, candidate) {
  const normalizedRoot = resolve(root);
  const normalizedCandidate = resolve(candidate);
  if (normalizedCandidate !== normalizedRoot && !normalizedCandidate.startsWith(`${normalizedRoot}${sep}`)) {
    throw Object.assign(new Error("Lab snapshot path escaped the configured repository root."), { code: "LAB_PATH_ESCAPE" });
  }
  return normalizedCandidate;
}

function candidates(repositoryRoot, root) {
  const repository = resolve(repositoryRoot);
  const values = [
    ...(basename(repository) === FRAMEWORK
      ? [resolve(repository, "runtime", root, "current.json")]
      : []),
    resolve(repositoryRoot, "AUGUST_V1_QUANT_DESK_FRAMEWORK", "runtime", root, "current.json"),
    resolve(repositoryRoot, "runtime", root, "current.json"),
    resolve(repositoryRoot, root, "current.json"),
  ].map((candidate) => inside(repositoryRoot, candidate));
  return [...new Set(values)];
}

function fail(message, code = "LAB_SNAPSHOT_INVALID") {
  throw Object.assign(new Error(message), { code });
}

function iso(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validateSnapshot(value, requestedRoot = null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("The Lab snapshot is not a JSON object.");
  }
  const root = String(value.root || "").trim().toUpperCase();
  if (!ROOTS.has(root) || value.root !== root || (requestedRoot && root !== requestedRoot)) {
    fail("The Lab snapshot root must be exactly NQ or ES.", "LAB_ROOT_UNSUPPORTED");
  }
  if (value.version !== SNAPSHOT_VERSION || value.environment !== "LIVE") {
    fail("The Lab snapshot failed its version or LIVE-environment gate.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value.sessionDate || "")) || !PHASES.has(value.phase)) {
    fail("The Lab snapshot session date or phase is invalid.");
  }
  if (!iso(value.publishedAt) || !iso(value.updatedAt)) {
    fail("The Lab snapshot publication timestamps are invalid.");
  }
  if (!Number.isInteger(value.refreshAfterMs) || value.refreshAfterMs < 5_000 || value.refreshAfterMs > 60_000) {
    fail("The Lab snapshot refresh interval must be an integer from 5000 through 60000.");
  }
  for (const field of REQUIRED_OBJECTS) {
    if (!value[field] || typeof value[field] !== "object" || Array.isArray(value[field])) {
      fail(`The Lab snapshot ${field} field must be an object.`);
    }
  }
  for (const field of REQUIRED_ARRAYS) {
    if (!Array.isArray(value[field])) fail(`The Lab snapshot ${field} field must be an array.`);
  }
  for (const field of ["repository", "commit", "artifact"]) {
    if (typeof value.receipt[field] !== "string" || !value.receipt[field].trim()) {
      fail(`The Lab snapshot receipt.${field} field is required.`);
    }
  }
  if (!Array.isArray(value.film.deltas)) fail("The Lab snapshot film.deltas field must be an array.");
  return root;
}

async function exists(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function atomicWrite(path, content) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  let handle = null;
  try {
    handle = await open(temporary, "wx");
    await handle.writeFile(content);
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporary, path);
  } finally {
    if (handle) await handle.close().catch(() => undefined);
    await unlink(temporary).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
  }
}

export class LabRepositoryStore {
  constructor({ root = "" } = {}) {
    this.root = String(root || "").trim();
    this.lastReadAt = null;
    this.lastError = null;
    this.lastArtifactAt = null;
    this.lastPublishedAt = null;
    this.publishQueue = Promise.resolve();
  }

  health() {
    return {
      configured: Boolean(this.root),
      lastReadAt: this.lastReadAt,
      lastArtifactAt: this.lastArtifactAt,
      lastPublishedAt: this.lastPublishedAt,
      lastError: this.lastError,
    };
  }

  async readSnapshot(requestedRoot) {
    const root = String(requestedRoot || "").trim().toUpperCase();
    if (!ROOTS.has(root)) {
      throw Object.assign(new Error("THE LAB repository currently supports NQ and ES."), { code: "LAB_ROOT_UNSUPPORTED" });
    }
    if (!this.root) {
      throw Object.assign(new Error("KWANTDESK_LAB_REPOSITORY_ROOT is not configured."), { code: "LAB_REPOSITORY_NOT_CONFIGURED" });
    }

    let missing = null;
    for (const candidate of candidates(this.root, root)) {
      try {
        const metadata = await stat(candidate);
        if (!metadata.isFile()) continue;
        if (metadata.size <= 0 || metadata.size > MAX_SNAPSHOT_BYTES) {
          throw Object.assign(new Error("The Lab snapshot is empty or exceeds the 5 MB safety limit."), { code: "LAB_SNAPSHOT_SIZE" });
        }
        const value = JSON.parse(await readFile(candidate, "utf8"));
        validateSnapshot(value, root);
        this.lastReadAt = new Date().toISOString();
        this.lastArtifactAt = metadata.mtime.toISOString();
        this.lastError = null;
        return value;
      } catch (error) {
        if (error?.code === "ENOENT") {
          missing = error;
          continue;
        }
        this.lastError = error instanceof Error ? error.message : String(error);
        throw error;
      }
    }

    const error = Object.assign(new Error(`No ${root} August V1 Lab snapshot has been published.`), {
      code: missing?.code || "ENOENT",
    });
    this.lastError = error.message;
    throw error;
  }

  async publishSnapshot(value) {
    const publish = async () => {
      if (!this.root) {
        fail("KWANTDESK_LAB_REPOSITORY_ROOT is not configured.", "LAB_REPOSITORY_NOT_CONFIGURED");
      }
      const root = validateSnapshot(value);
      const content = `${JSON.stringify(value, null, 2)}\n`;
      if (Buffer.byteLength(content) <= 0 || Buffer.byteLength(content) > MAX_SNAPSHOT_BYTES) {
        fail("The Lab snapshot is empty or exceeds the 5 MB safety limit.", "LAB_SNAPSHOT_SIZE");
      }

      const paths = candidates(this.root, root);
      let current = paths[0];
      for (const candidate of paths) {
        if (await exists(dirname(dirname(candidate)))) {
          current = candidate;
          break;
        }
      }
      try {
        const previous = JSON.parse(await readFile(current, "utf8"));
        if (iso(previous?.updatedAt) && Date.parse(previous.updatedAt) > Date.parse(value.updatedAt)) {
          fail("A newer Lab frame is already current; the out-of-order publish was refused.", "LAB_SNAPSHOT_OUT_OF_ORDER");
        }
      } catch (error) {
        if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR" && !(error instanceof SyntaxError)) throw error;
      }

      const safeSession = value.sessionDate.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
      const timestamp = value.updatedAt.replace(/[^0-9]/g, "").slice(0, 17);
      const archive = inside(this.root, resolve(dirname(current), "archive", `${safeSession}_${timestamp}Z.json`));
      await atomicWrite(archive, content);
      await atomicWrite(current, content);
      this.lastPublishedAt = new Date().toISOString();
      this.lastArtifactAt = this.lastPublishedAt;
      this.lastError = null;
      return value;
    };

    const result = this.publishQueue.then(publish, publish);
    this.publishQueue = result.catch(() => undefined);
    return result;
  }
}
