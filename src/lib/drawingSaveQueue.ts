// Serialize full-document saves, even across chart unmounts. A slower old PUT
// must finish before the clear/new document, rather than overwrite it afterward.
const pending = new Map<string, Promise<void>>();
export function queueDrawingSave(documentKey: string, url: string, payload: unknown): Promise<void> {
  let owner: string | null = null;
  try { owner = window.localStorage.getItem("kwantdesk:active-preferences-owner:v1"); } catch {}
  const key = `${owner ?? ""}:${documentKey}`;
  const body = JSON.stringify(payload);
  const next = (pending.get(key) ?? Promise.resolve()).then(async () => {
    try {
      if (typeof window !== "undefined" && window.localStorage.getItem("kwantdesk:active-preferences-owner:v1") !== owner) return;
      await fetch(url, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(8_000) });
    } catch { /* The account preference document remains the local source. */ }
  }).finally(() => { if (pending.get(key) === next) pending.delete(key); });
  pending.set(key, next);
  return next;
}
