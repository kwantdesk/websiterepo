// How often the footprint folds new executions into its rows.
//
// This used to be 250ms while the keyboard was driving and 500ms otherwise —
// the slower of the two being the case where somebody is simply watching price
// tick. The candle grows the moment a print lands, so the box climbed
// instantly while its numbers arrived up to half a second later.
//
// The refresh was costly when those numbers were chosen: it folded the whole
// retained tape into every visible row. Since 8ddbfb08 closed bars come back
// from cache and only the forming bar is rebuilt, from a binary-searched slice
// of the tape. The path is also fully imperative — refs and a primitive
// update, never React state — and the primitive's own FPS limit still governs
// painting, so data arriving faster than a frame is coalesced rather than
// drawn twice.
export const FOOTPRINT_DATA_REFRESH_INTERVAL_MS = 80;

export const ORDER_FLOW_DATA_REFRESH_INTERVAL_MS = 500;
