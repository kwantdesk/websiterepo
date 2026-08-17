// Footprint rows are expensive to aggregate because each refresh folds a
// retained execution tape into every visible price row. Keep that work on a
// bounded data cadence. The user-facing FPS setting still controls canvas
// paint scheduling in FootprintPrimitive; it must not drive React state or
// rebuild the execution model at 30/60/120 times per second.
export const FOOTPRINT_DATA_REFRESH_INTERVAL_MS = 250;

export const ORDER_FLOW_DATA_REFRESH_INTERVAL_MS = 500;
