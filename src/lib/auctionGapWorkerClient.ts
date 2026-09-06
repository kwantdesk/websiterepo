import type { AuctionGapStudyInput } from "./auctionGapStudy.ts";
import type { AuctionGapWorkerJob, AuctionGapWorkerReply } from "./auctionGap.worker.ts";

type WorkerPort = {
  onmessage: ((event: MessageEvent<AuctionGapWorkerReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(job: AuctionGapWorkerJob): void;
  terminate(): void;
};

/** One active job plus one newest queued snapshot; never unbounded tick queues.
 * Scope MUST include instrument, timeframe, settings and replay/source epoch.
 * Scope changes terminate old computation. Same-scope completed snapshots can
 * paint while a newer one is queued, preventing starvation during active tape.
 * This is history scheduling, not the eventual incremental live-update path.
 */
export class AuctionGapWorkerClient {
  private worker: WorkerPort | null = null;
  private scope: string | null = null;
  private active: AuctionGapWorkerJob | null = null;
  private pending: AuctionGapWorkerJob | null = null;
  private revision = 0;
  private disposed = false;

  private readonly receive: (reply: AuctionGapWorkerReply) => void;
  private readonly create: () => WorkerPort;

  constructor(receive: (reply: AuctionGapWorkerReply) => void,
    create: () => WorkerPort = () => new Worker(new URL("./auctionGap.worker.ts", import.meta.url), { type: "module" })) {
    this.receive = receive;
    this.create = create;
  }

  request(scope: string, input: AuctionGapStudyInput): boolean {
    return this.enqueue({ scope, revision: ++this.revision, input });
  }

  /** Complete validated current-bar snapshot. If coalescing skips a closed bar,
   * worker returns requires-rebuild; caller must submit a new full history seed.
   */
  requestTimeTail(scope: string, chartIndex: number, input: AuctionGapStudyInput): boolean {
    return this.enqueue({ scope, revision: ++this.revision, input, operation: "time-tail", chartIndex });
  }

  private enqueue(job: AuctionGapWorkerJob): boolean {
    if (this.disposed) return false;
    if (job.scope !== this.scope) {
      this.stop(); this.scope = job.scope;
    }
    if (this.active) { this.pending = job; return true; }
    this.dispatch(job);
    return true;
  }

  private dispatch(job: AuctionGapWorkerJob) {
    try {
      if (!this.worker) {
        const worker = this.create();
        this.worker = worker;
        worker.onmessage = event => {
          const active = this.active, reply = event.data;
          if (this.disposed || this.worker !== worker || !active || reply.scope !== active.scope || reply.revision !== active.revision) return;
          this.active = null;
          const next = this.pending; this.pending = null;
          this.receive(reply);
          // Receiver may dispose or change scope; never resurrect stale work.
          if (!this.disposed && this.worker === worker && this.scope === job.scope && !this.active && next) this.dispatch(next);
        };
        worker.onerror = event => {
          event.preventDefault?.();
          if (this.worker !== worker || this.disposed) return;
          const active = this.active;
          this.stop();
          if (active) this.receive({ scope: active.scope, revision: active.revision,
            result: { status: "unavailable", reason: "worker-failed", zones: [] } });
        };
      }
      this.active = job;
      this.worker.postMessage(job);
    } catch {
      this.stop();
      if (!this.disposed) this.receive({ scope: job.scope, revision: job.revision,
        result: { status: "unavailable", reason: "worker-unavailable", zones: [] } });
    }
  }

  private stop() {
    if (this.worker) {
      this.worker.onmessage = null; this.worker.onerror = null; this.worker.terminate();
    }
    this.worker = null; this.active = null; this.pending = null;
  }

  dispose() { this.disposed = true; this.stop(); this.scope = null; }
}
