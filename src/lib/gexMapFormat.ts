export function formatGexMapExposure(value: number) {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (absolute >= 1_000_000_000) return `${sign}$${(absolute / 1_000_000_000).toFixed(2)}B`;
  if (absolute >= 1_000_000) return `${sign}$${(absolute / 1_000_000).toFixed(2)}M`;
  if (absolute >= 1_000) return `${sign}$${(absolute / 1_000).toFixed(1)}K`;
  return `${sign}$${absolute.toFixed(0)}`;
}

/** Signed legend endpoints must not round a real small-unit range to zero. */
export function formatGexMapExposureLegend(value: number) {
  if (value === 0) return "0";
  const absolute = Math.abs(value);
  const sign = value < 0 ? "−" : "+";
  if (absolute < 0.001) return `${sign}$${absolute.toExponential(2)}`;
  if (absolute < 1) return `${sign}$${absolute.toLocaleString("en-US", { maximumSignificantDigits: 3 })}`;
  return (value > 0 ? "+" : "") + formatGexMapExposure(value);
}
