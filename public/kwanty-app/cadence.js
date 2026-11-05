// The existing workspace coordinator owns each distinct visible selector.
// Keep the existing production polling budget until the VPS owns live delivery.
export const LIVE_SNAPSHOT_INTERVAL_MS=30000;
export const FAILED_SNAPSHOT_INTERVAL_MS=60000;
export const snapshotInterval=source=>source.error?Math.max(FAILED_SNAPSHOT_INTERVAL_MS,Math.min(3600,Math.max(0,Number(source.retryAfterSeconds)||0))*1000):LIVE_SNAPSHOT_INTERVAL_MS;
export function nextSnapshotDelay(sources,now){
 const rows=[...sources];if(!rows.length)return FAILED_SNAPSHOT_INTERVAL_MS;
 return Math.max(100,Math.min(...rows.map(source=>source.fetched===null?0:source.fetched+snapshotInterval(source)-now)));
}
