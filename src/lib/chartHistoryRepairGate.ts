/** Failed history repair is background recovery, never a two-second full-history loop. */
export class ChartHistoryRepairGate {
  private failures = 0;
  private busy = false;
  private nextAt = 0;

  delay(now = Date.now()) { return Math.max(0, this.nextAt - now); }
  begin(now = Date.now()) {
    if (this.busy || this.delay(now) > 0) return false;
    this.busy = true;
    return true;
  }
  finish(recovered: boolean, now = Date.now()) {
    this.busy = false;
    if (recovered) { this.failures = 0; this.nextAt = 0; return; }
    this.nextAt = now + Math.min(30_000, 2_000 * 2 ** Math.min(this.failures++, 4));
  }
}
