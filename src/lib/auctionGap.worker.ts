import { calculateAuctionGapStudy, type AuctionGapStudyInput, type AuctionGapStudyResult } from "./auctionGapStudy.ts";

export type AuctionGapWorkerJob = { scope: string; revision: number; input: AuctionGapStudyInput };
export type AuctionGapWorkerReply = { scope: string; revision: number; result: AuctionGapStudyResult };

export function runAuctionGapWorkerJob(job: AuctionGapWorkerJob): AuctionGapWorkerReply {
  let result: AuctionGapStudyResult;
  try { result = calculateAuctionGapStudy(job.input); }
  catch { result = { status: "unavailable", reason: "calculation-failed", zones: [] }; }
  return { scope: job.scope, revision: job.revision, result };
}

// Importable for deterministic handler tests; production entry runs in a Worker.
if (typeof self !== "undefined" && typeof document === "undefined") {
  self.onmessage = (event: MessageEvent<AuctionGapWorkerJob>) => {
    self.postMessage(runAuctionGapWorkerJob(event.data));
  };
}
