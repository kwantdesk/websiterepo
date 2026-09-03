import { statfs } from "node:fs/promises";

const GIB = 1024 ** 3;

/**
 * Capacity is part of recorder health. A connected feed with a full archive
 * filesystem is still losing irreplaceable L3 data.
 *
 * This deliberately does not make the container healthcheck fail: autoheal
 * cannot create disk space, and a restart loop would add feed gaps. Operators
 * get an explicit warning/critical state while the collector keeps writing.
 */
export async function archiveStorageHealth(
  path,
  { statfsImpl = statfs, warningFreeBytes = 15 * GIB, criticalFreeBytes = 8 * GIB } = {},
) {
  try {
    const stats = await statfsImpl(path);
    const blockSize = Number(stats.bsize || 0);
    const totalBytes = blockSize * Number(stats.blocks || 0);
    const freeBytes = blockSize * Number(stats.bavail || stats.bfree || 0);
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    const usedPercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1_000) / 10 : null;
    const state = freeBytes <= criticalFreeBytes
      ? "critical"
      : freeBytes <= warningFreeBytes
        ? "warning"
        : "ok";
    return {
      path,
      state,
      totalBytes,
      usedBytes,
      freeBytes,
      usedPercent,
      offBoxBackupRequired: true,
    };
  } catch (error) {
    return {
      path,
      state: "unknown",
      error: error instanceof Error ? error.message : String(error),
      offBoxBackupRequired: true,
    };
  }
}
