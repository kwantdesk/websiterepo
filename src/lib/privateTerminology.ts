const PRIVATE_TERMINOLOGY_REPLACEMENTS = [
  ["menthroq", "Research"],
  ["trinity", "Signal"],
  ["bookmap", "Liquidity Map"],
  ["quantdata", "Options Data"],
  ["databento", "Market Data"],
  ["rithmic", "Futures Feed"],
  ["skylit", "Analytics"],
] as const;

const PRIVATE_TERMINOLOGY_PATTERN = new RegExp(
  `\\b(?:${PRIVATE_TERMINOLOGY_REPLACEMENTS.map(([term]) => term).join("|")})\\b|(?<![.\\w-])(?:kwantify|quantify)\\b(?!-\\w|:\\w)`,
  "gi",
);

const REPLACEMENT_BY_TERM = new Map<string, string>(PRIVATE_TERMINOLOGY_REPLACEMENTS);

/** Normalizes private provider names and legacy product branding in visible copy. */
export function publicFacingTerminology(value: string): string {
  return value.replace(PRIVATE_TERMINOLOGY_PATTERN, (match) => (
    REPLACEMENT_BY_TERM.get(match.toLowerCase()) ?? (match === "quantify" ? match : "Quant Desk")
  ));
}

export function containsPrivateTerminology(value: string): boolean {
  return publicFacingTerminology(value) !== value;
}
