import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function readPositioningMap(path) {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    return parsed?.schemaVersion === "kwantdesk-native-oi-v1" && Array.isArray(parsed.records)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export async function writePositioningMap(path, map) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(map)}\n`, "utf8");
  await rename(temporary, path);
}

export async function replacePositioningMapAfterBuild(path, previousMap, build) {
  try {
    const nextMap = await build();
    await writePositioningMap(path, nextMap);
    return { map: nextMap, error: null, replaced: true };
  } catch (error) {
    return {
      map: previousMap,
      error: error instanceof Error ? error : new Error(String(error)),
      replaced: false,
    };
  }
}
