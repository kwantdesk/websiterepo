import { readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";

const SNAPSHOT_VERSION = "kwantdesk-august-v1-lab-v1";
const MAX_SNAPSHOT_BYTES = 5 * 1024 * 1024;
const ROOTS = new Set(["NQ", "ES"]);

function inside(root, candidate) {
  const normalizedRoot = resolve(root);
  const normalizedCandidate = resolve(candidate);
  if (normalizedCandidate !== normalizedRoot && !normalizedCandidate.startsWith(`${normalizedRoot}${sep}`)) {
    throw Object.assign(new Error("Lab snapshot path escaped the configured repository root."), { code: "LAB_PATH_ESCAPE" });
  }
  return normalizedCandidate;
}

function candidates(repositoryRoot, root) {
  return [
    resolve(repositoryRoot, "AUGUST_V1_QUANT_DESK_FRAMEWORK", "runtime", root, "current.json"),
    resolve(repositoryRoot, "runtime", root, "current.json"),
    resolve(repositoryRoot, root, "current.json"),
  ].map((candidate) => inside(repositoryRoot, candidate));
}

export class LabRepositoryStore {
  constructor({ root = "" } = {}) {
    this.root = String(root || "").trim();
    this.lastReadAt = null;
    this.lastError = null;
    this.lastArtifactAt = null;
  }

  health() {
    return {
      configured: Boolean(this.root),
      lastReadAt: this.lastReadAt,
      lastArtifactAt: this.lastArtifactAt,
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
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          throw Object.assign(new Error("The Lab snapshot is not a JSON object."), { code: "LAB_SNAPSHOT_INVALID" });
        }
        if (value.version !== SNAPSHOT_VERSION || value.root !== root || value.environment !== "LIVE") {
          throw Object.assign(new Error("The Lab snapshot failed its version, root, or LIVE-environment gate."), { code: "LAB_SNAPSHOT_INVALID" });
        }
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
}
