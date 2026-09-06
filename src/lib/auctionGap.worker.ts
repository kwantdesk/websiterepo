import { type AuctionGapStudyInput, type AuctionGapStudyResult } from "./auctionGapStudy.ts";
import { AuctionGapStudySession } from "./auctionGapStudySession.ts";

export type AuctionGapWorkerJob = { scope: string; revision: number; input: AuctionGapStudyInput }
  & ({ operation?: "history" } | { operation: "time-tail"; chartIndex: number });
export type AuctionGapWorkerReply = { scope: string; revision: number; result: AuctionGapStudyResult };

export function runAuctionGapWorkerJob(job: AuctionGapWorkerJob, session = new AuctionGapStudySession()): AuctionGapWorkerReply {
  let result: AuctionGapStudyResult;
  try { result = job.operation === "time-tail"
    ? session.updateTimeTail(job.scope, job.chartIndex, job.input) : session.reset(job.scope, job.input); }
  catch { result = { status: "unavailable", reason: "calculation-failed", zones: [] }; }
  return { scope: job.scope, revision: job.revision, result };
}

// Importable for deterministic handler tests; production entry runs in a Worker.
if (typeof self !== "undefined" && typeof document === "undefined") {
  const session = new AuctionGapStudySession();
  self.onmessage = (event: MessageEvent<AuctionGapWorkerJob>) => {
    self.postMessage(runAuctionGapWorkerJob(event.data, session));
  };
}
