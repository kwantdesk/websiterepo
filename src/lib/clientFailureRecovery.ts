export type ClientRenderFailure = {
  code: string;
  label: string;
  message: string;
  stack: string;
  componentStack: string;
  path: string;
  occurredAt: string;
};

const DIAGNOSTIC_STORAGE_KEY = "kwantdesk:render-failures:v1";
const DEPLOYMENT_RECOVERY_KEY = "kwantdesk:deployment-recovery:v1";

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase();
}

export function renderFailureCode(error: Error, componentStack = "") {
  return `KD-${hashText(`${error.name}:${error.message}:${componentStack.slice(0, 400)}`).slice(0, 7)}`;
}

export function isDeploymentAssetFailure(error: Error) {
  const text = `${error.name} ${error.message} ${error.stack ?? ""}`.toLowerCase();
  return (
    text.includes("chunkloaderror")
    || text.includes("loading chunk")
    || text.includes("failed to fetch dynamically imported module")
    || text.includes("importing a module script failed")
    || text.includes("css_chunk_load_failed")
  );
}

export function recordClientRenderFailure(
  label: string,
  error: Error,
  componentStack = "",
) {
  const failure: ClientRenderFailure = {
    code: renderFailureCode(error, componentStack),
    label,
    message: error.message,
    stack: error.stack ?? "",
    componentStack,
    path: typeof window === "undefined" ? "" : window.location.pathname,
    occurredAt: new Date().toISOString(),
  };
  if (typeof window === "undefined") return failure;
  try {
    const previous = JSON.parse(window.sessionStorage.getItem(DIAGNOSTIC_STORAGE_KEY) ?? "[]") as unknown;
    const entries = Array.isArray(previous) ? previous : [];
    window.sessionStorage.setItem(
      DIAGNOSTIC_STORAGE_KEY,
      JSON.stringify([...entries.slice(-9), failure]),
    );
  } catch {
    // Recovery must not depend on browser storage being available.
  }
  window.dispatchEvent(new CustomEvent("kwantdesk:render-failure", { detail: failure }));
  return failure;
}

export function reloadForDeploymentAssetFailureOnce() {
  if (typeof window === "undefined") return false;
  const now = Date.now();
  try {
    const previous = Number(window.sessionStorage.getItem(DEPLOYMENT_RECOVERY_KEY));
    if (Number.isFinite(previous) && now - previous < 60_000) return false;
    window.sessionStorage.setItem(DEPLOYMENT_RECOVERY_KEY, String(now));
  } catch {
    return false;
  }
  window.setTimeout(() => window.location.reload(), 50);
  return true;
}
