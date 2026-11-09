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
