/** Familiar trader labels; do not change event identity, readings or dates. */
export function economicEventLabel(name: string, currency = ""): string {
  let label = name.trim();
  // Match the whole inflation-series name so PCE, expectations, HICP and
  // other distinct price measures cannot accidentally become CPI.
  label = label.replace(/^(Core\s+)?Inflation\s+Rate(?=\s*(?:\(|MoM\b|YoY\b|QoQ\b|m\/m\b|y\/y\b|q\/q\b|$))/i,
    (_, core: string | undefined) => core ? "Core CPI" : "CPI");
  label = label
    .replace(/\bConsumer Price Index\b/gi, "CPI")
    .replace(/\bProducer Price Index\b/gi, "PPI")
    .replace(/\bProducer Prices(?: Change)?\b/gi, "PPI")
    .replace(/\bGross Domestic Product\b/gi, "GDP")
    .replace(/\bFederal Open Market Committee\b/gi, "FOMC")
    .replace(/\bCore (CPI|PPI)\b/gi, (_, series: string) => `Core ${series.toUpperCase()}`)
    .replace(/\bMoM\b|\bMonth[- ]on[- ]Month\b/gi, "m/m")
    .replace(/\bYoY\b|\bYear[- ]on[- ]Year\b/gi, "y/y")
    .replace(/\bQoQ\b|\bQuarter[- ]on[- ]Quarter\b/gi, "q/q");
  if (currency === "USD") {
    label = label
      .replace(/^(?:Fed|Federal Reserve|FOMC) Interest Rate Decision\b/i, "FOMC Rate Decision")
      .replace(/^(?:Fed|Federal Reserve) Press Conference\b/i, "FOMC Press Conference")
      .replace(/^(?:Fed|Federal Reserve) (?:Meeting )?Minutes\b/i, "FOMC Meeting Minutes");
  }
  return label;
}
