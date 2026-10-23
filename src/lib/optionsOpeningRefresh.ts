export function optionsOpeningClock(nowMs = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(nowMs);
  const read = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  const weekday = !["Sat", "Sun"].includes(read("weekday"));
  const seconds = Number(read("hour")) * 3600 + Number(read("minute")) * 60 + Number(read("second"));
  return { weekday, seconds, opening: weekday && seconds >= 34200 && seconds < 34500 };
}

/** Keep existing cadence/quota, but never sleep across the weekday cash open. */
export function optionsOpeningRefreshDelay(delayMs: number, failed = false, nowMs = Date.now()) {
  const clock = optionsOpeningClock(nowMs);
  let delay = Math.max(1000, delayMs);
  if (clock.weekday && clock.seconds < 34200) delay = Math.min(delay, (34200 - clock.seconds) * 1000 - nowMs % 1000 + 100);
  if (failed && clock.opening) delay = Math.min(delay, 5000);
  return Math.max(1000, delay);
}

/** Publish each independent success immediately; don't block it on other panels. */
export async function publishPanelResults<T>(jobs: Promise<T>[], publish: (value: T, index: number) => void) {
  return Promise.allSettled(jobs.map(async (job, index) => {
    const value = await job;
    publish(value, index);
    return value;
  }));
}
