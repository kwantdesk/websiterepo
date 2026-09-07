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
  `\\b(?:${PRIVATE_TERMINOLOGY_REPLACEMENTS.map(([term]) => term).join("|")})\\b`,
  "gi",
);

const REPLACEMENT_BY_TERM = new Map<string, string>(PRIVATE_TERMINOLOGY_REPLACEMENTS);

/** Removes private provider/research names from copy before it reaches users. */
export function publicFacingTerminology(value: string): string {
  return value.replace(PRIVATE_TERMINOLOGY_PATTERN, (match) => (
    REPLACEMENT_BY_TERM.get(match.toLowerCase()) ?? match
  ));
}

export function containsPrivateTerminology(value: string): boolean {
  PRIVATE_TERMINOLOGY_PATTERN.lastIndex = 0;
  return PRIVATE_TERMINOLOGY_PATTERN.test(value);
}
