import type { JournalTrade } from "./journal";

/** Only confirmed server copies are returned. Retrying is safe: the server
 * uses deterministic destination/original-trade IDs and ignores duplicates. */
export async function copyJournalTrades(
  accountId: string,
  tradeIds: string[],
  fetcher: typeof fetch = fetch,
  timeoutMs = 20_000,
): Promise<{ trades: JournalTrade[]; skipped?: number }> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = () => new Error("Import confirmation took too long. Your source trades are safe. Try importing again; existing copies will not be duplicated.");
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(timedOut()); }, timeoutMs);
  });
  try {
    return await Promise.race([deadline, (async () => {
      const response = await fetcher("/api/journal", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ action: "copy-trades", accountId, tradeIds }),
      });
      const result = await response.json().catch(() => null) as {
        cloud?: boolean; trades?: JournalTrade[]; skipped?: number; error?: string;
      } | null;
      if (!response.ok || !result?.cloud || !Array.isArray(result.trades)) {
        throw new Error(result?.error || "The selected trades could not be imported. Please retry.");
      }
      return { trades: result.trades, skipped: result.skipped };
    })()]);
  } catch (error) {
    if (controller.signal.aborted) throw timedOut();
    throw error;
  } finally { clearTimeout(timer); }
}
