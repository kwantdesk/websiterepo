/** Quiet routine replay hydration without concealing a real failure or warning. */
export function chartProgressCopy(message: string | undefined, replayActive: boolean): string | undefined {
  if (replayActive && message && (
    /^Loading .+ of .+ data\.\.\. this may take a moment$/.test(message)
    || /^Loaded [\d,]+ candles$/.test(message)
    || message === "Connecting to CME history…"
  )) return undefined;
  return message;
}
