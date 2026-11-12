/** Exact, bounded in-memory snapshot reuse. Never interpolate missing frames. */
export function sameSnapshotScope(previous, next) {
  try { const a=JSON.parse(previous),b=JSON.parse(next);return Array.isArray(a)&&Array.isArray(b)&&a.length===3&&b.length===3&&a[0]===b[0]&&JSON.stringify(a[1])===JSON.stringify(b[1]); } catch { return false; }
}
export function createSnapshotFrameCache({maxFrames=32,maxBytes=8*1024*1024}={}) {
  const frames=new Map();let bytes=0;
  return {
    get(key){const entry=frames.get(key);if(!entry)return null;frames.delete(key);frames.set(key,entry);return entry.payload;},
    put(key,payload){const size=JSON.stringify(payload).length*2;if(size>maxBytes)return;const old=frames.get(key);if(old){bytes-=old.size;frames.delete(key);}frames.set(key,{payload,size});bytes+=size;while(frames.size>maxFrames||bytes>maxBytes){const first=frames.keys().next().value;bytes-=frames.get(first).size;frames.delete(first);}},
  };
}

/** Sample a moving cursor without cancelling the frame already being fetched. */
export function createSnapshotScrubber({ intervalMs = 500, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let queued = null;
  let running = null;
  let timer = null;
  let lastRequestAt = -Infinity;

  function drain() {
    if (running || !queued) return;
    const wait = queued.cached() ? 0 : Math.max(0, lastRequestAt + intervalMs - now());
    if (wait > 0) {
      timer = setTimer(() => { timer = null; drain(); }, wait);
      return;
    }
    const next = queued;
    queued = null;
    running = next;
    if (!next.cached()) lastRequestAt = now();
    const finish = () => { running = null; drain(); };
    Promise.resolve().then(next.load).then(finish, finish);
  }

  return {
    seek(key, load, cached) {
      clearTimer(timer);
      timer = null;
      queued = running?.key === key ? null : { key, load, cached };
      drain();
    },
    busy: () => !!(running || queued),
  };
}
