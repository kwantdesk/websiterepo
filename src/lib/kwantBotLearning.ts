import type {
  KwantBotInterpreterMessage,
  KwantBotMarketContext,
  KwantBotMarketRoot,
  KwantBotMemoryEvent,
} from "@/lib/kwantBotInterpreter";

export type KwantBotLearningVerdict = "CONFIRMED" | "PARTIAL" | "FAILED";
export type KwantBotLearningGrade = "EXCELLENT" | "GOOD" | "MIXED" | "POOR";
export type KwantBotLearningSyncState = "local" | "syncing" | "synced" | "error";

export type KwantBotLearningReview = {
  id: string;
  root: KwantBotMarketRoot;
  levelId: string | null;
  levelName: string;
  zone: [number, number] | null;
  reviewedAt: string;
  cycleStartedAt: string;
  cycleEndedAt: string;
  reactionType: "rejection" | "acceptance" | "unknown";
  direction: "up" | "down" | "unknown";
  score: number;
  grade: KwantBotLearningGrade;
  verdict: KwantBotLearningVerdict;
  originalExpectation: string;
  actualOutcome: string;
  whatWorked: string[];
  whatMissed: string[];
  improvements: string[];
  nextChecks: string[];
  blindSpotTags: string[];
  evidence: {
    approachEventId: string | null;
    touchEventId: string | null;
    reactionEventId: string | null;
    outcomeEventId: string;
    approachMessageId: string | null;
    outcomeMessageId: string | null;
    startPrice: number | null;
    outcomePrice: number | null;
    excursionPoints: number | null;
    timeToOutcomeMs: number | null;
    gammaRegime: KwantBotMarketContext["options"]["gammaRegime"] | null;
    bullishShare: number | null;
    optionsAsOf: string | null;
    contextGeneratedAt: string | null;
    priorTouchCount: number;
    priorConfirmedCount: number;
  };
  syncState?: KwantBotLearningSyncState;
};

function isSameLevel(event: KwantBotMemoryEvent, outcome: KwantBotMemoryEvent) {
  if (event.root !== outcome.root) return false;
  if (outcome.levelId && event.levelId === outcome.levelId) return true;
  if (!outcome.levelName || event.levelName !== outcome.levelName) return false;
  if (!outcome.zone || !event.zone) return true;
  const outcomeMid = (outcome.zone[0] + outcome.zone[1]) / 2;
  const eventMid = (event.zone[0] + event.zone[1]) / 2;
  const tolerance = outcome.root === "NQ" ? 40 : 10;
  return Math.abs(outcomeMid - eventMid) <= tolerance;
}

function isBeforeOrAt(candidate: { createdAt: string }, event: { createdAt: string }) {
  return Date.parse(candidate.createdAt) <= Date.parse(event.createdAt);
}

function latestBefore<T extends { createdAt: string }>(items: T[], before: KwantBotMemoryEvent) {
  return [...items]
    .filter((item) => isBeforeOrAt(item, before))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0] ?? null;
}

function messageForEvent(
  messages: KwantBotInterpreterMessage[],
  outcome: KwantBotMemoryEvent,
  kinds: KwantBotInterpreterMessage["kind"][],
) {
  return latestBefore(
    messages.filter((message) =>
      message.root === outcome.root
      && kinds.includes(message.kind)
      && (!outcome.levelId || message.levelId === outcome.levelId)),
    outcome,
  );
}

function gradeForScore(score: number): KwantBotLearningGrade {
  if (score >= 88) return "EXCELLENT";
  if (score >= 72) return "GOOD";
  if (score >= 52) return "MIXED";
  return "POOR";
}

function sentenceCase(value: string) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

export function buildKwantBotLearningReview(args: {
  outcome: KwantBotMemoryEvent;
  memory: KwantBotMemoryEvent[];
  messages: KwantBotInterpreterMessage[];
  context: KwantBotMarketContext | null;
}): KwantBotLearningReview | null {
  const { outcome, context } = args;
  if (outcome.type !== "outcome") return null;

  const relevant = args.memory
    .filter((event) => isSameLevel(event, outcome) && isBeforeOrAt(event, outcome))
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  const outcomeIndex = relevant.findIndex((event) => event.id === outcome.id);
  const beforeOutcome = outcomeIndex >= 0 ? relevant.slice(0, outcomeIndex) : relevant;
  const priorOutcomeIndex = beforeOutcome.map((event) => event.type).lastIndexOf("outcome");
  const cycleEvents = beforeOutcome.slice(priorOutcomeIndex + 1).reverse();
  const reaction = cycleEvents.find((event) => event.type === "rejection" || event.type === "acceptance") ?? null;
  const touch = cycleEvents.find((event) =>
    event.type === "touch"
    && (!reaction || Date.parse(event.createdAt) <= Date.parse(reaction.createdAt))) ?? null;
  const approach = cycleEvents.find((event) =>
    event.type === "approach"
    && (!touch || Date.parse(event.createdAt) <= Date.parse(touch.createdAt))) ?? null;

  const originalMessage = messageForEvent(
    args.messages,
    outcome,
    reaction?.type === "rejection" || reaction?.type === "acceptance"
      ? [reaction.type]
      : ["touch", "approach"],
  );
  const approachMessage = messageForEvent(args.messages, outcome, ["approach", "touch"]);
  const outcomeMessage = args.messages.find((message) =>
    message.root === outcome.root
    && message.kind === "outcome"
    && message.levelId === outcome.levelId
    && Math.abs(Date.parse(message.createdAt) - Date.parse(outcome.createdAt)) < 2_000) ?? null;

  const confirmed = outcome.detail?.includes("follow-through") ?? false;
  const returned = outcome.detail?.includes("returned to zone") ?? false;
  const verdict: KwantBotLearningVerdict = confirmed ? "CONFIRMED" : returned ? "FAILED" : "PARTIAL";
  const direction = reaction?.detail?.includes("up")
    ? "up"
    : reaction?.detail?.includes("down")
      ? "down"
      : "unknown";
  const startPrice = reaction?.price ?? touch?.price ?? null;
  const outcomePrice = outcome.price ?? null;
  const excursionPoints = startPrice !== null && outcomePrice !== null
    ? Math.abs(outcomePrice - startPrice)
    : null;
  const startedAt = reaction?.createdAt ?? touch?.createdAt ?? approach?.createdAt ?? outcome.createdAt;
  const elapsed = Date.parse(outcome.createdAt) - Date.parse(startedAt);
  const priorEvents = relevant.filter((event) => Date.parse(event.createdAt) < Date.parse(startedAt));
  const priorTouches = priorEvents.filter((event) => event.type === "touch").length;
  const priorConfirmed = priorEvents.filter((event) =>
    event.type === "outcome" && event.detail?.includes("follow-through")).length;
  const contextFreshnessMs = context
    ? Math.abs(Date.parse(outcome.createdAt) - Date.parse(context.generatedAt))
    : Number.POSITIVE_INFINITY;
  const hasFreshContext = contextFreshnessMs <= 5 * 60_000;
  const hasOptionsEvidence = Boolean(
    context
    && (context.options.recentFlow.length > 0 || context.options.gammaChange.length > 0),
  );

  let score = confirmed ? 76 : returned ? 38 : 52;
  if (approach) score += 5;
  if (touch) score += 4;
  if (reaction) score += 6;
  if (originalMessage) score += 3;
  if (hasFreshContext) score += 3;
  if (hasOptionsEvidence) score += 2;
  if (priorTouches > 0) score += 2;
  if (confirmed && elapsed >= 20_000) score += 2;
  if (returned && !approach) score -= 4;
  score = Math.max(18, Math.min(96, Math.round(score)));

  const whatWorked: string[] = [];
  const whatMissed: string[] = [];
  const improvements: string[] = [];
  const nextChecks: string[] = [];
  const blindSpotTags: string[] = [];

  if (approach) {
    whatWorked.push("The level was identified before contact, preserving a clean preparation-to-outcome audit trail.");
  } else {
    whatMissed.push("No preparation event was retained before price entered the decision area.");
    improvements.push("Require a pre-contact note before assigning full quality credit to a level read.");
    blindSpotTags.push("missing-preparation");
  }
  if (touch) {
    whatWorked.push("KwantBot withheld direction inside the zone and waited for price to leave before classifying the response.");
  } else {
    whatMissed.push("The completed cycle has no retained contact event.");
    improvements.push("Verify the touch detector and level identity before evaluating the next response.");
    blindSpotTags.push("missing-contact");
  }
  if (reaction) {
    whatWorked.push(`The first observable response was classified as ${reaction.type} ${direction}.`);
  } else {
    whatMissed.push("No distinct rejection or acceptance event exists before the outcome.");
    improvements.push("Do not score an outcome as high quality without a recorded reaction state.");
    blindSpotTags.push("missing-reaction");
  }
  if (confirmed) {
    whatWorked.push(`The response produced ${excursionPoints === null ? "the required" : `${excursionPoints.toFixed(2)} points of`} follow-through before invalidation.`);
    nextChecks.push("Compare the achieved distance with the next mapped level instead of treating confirmation as permission to chase.");
  } else {
    whatMissed.push("The initial response returned to the decision zone before producing the required distance.");
    improvements.push("Demand a stronger hold outside the zone or a successful retest before increasing conviction.");
    nextChecks.push("Track time outside the zone, retest quality, and whether acceptance survives the next liquidity test.");
    blindSpotTags.push("failed-follow-through");
  }
  if (!hasFreshContext) {
    whatMissed.push("The review could not verify a fresh Gameplan/options snapshot at the exact outcome time.");
    improvements.push("Capture the context version with every reaction so later reviews use the original evidence, not the latest snapshot.");
    blindSpotTags.push("stale-context");
  } else {
    whatWorked.push(`The review retained the ${context?.options.gammaRegime.toLowerCase()} gamma backdrop present around the outcome.`);
  }
  if (!hasOptionsEvidence) {
    improvements.push("Check options-flow participation before upgrading a price-only reaction.");
    nextChecks.push("Require a fresh gamma or options-tape observation when available.");
    blindSpotTags.push("thin-options-evidence");
  } else {
    nextChecks.push("Recheck whether options positioning strengthens or contradicts the price response.");
  }
  if (priorTouches > 0) {
    nextChecks.push(`Compare the next visit with ${priorTouches} earlier retained touch${priorTouches === 1 ? "" : "es"} at this area.`);
  } else {
    nextChecks.push("Treat the next visit as a second sample; one completed response is not a probability estimate.");
  }

  const reactionSummary = reaction
    ? `${sentenceCase(reaction.type)} ${direction} from ${outcome.levelName ?? "the mapped level"}`
    : `Response at ${outcome.levelName ?? "the mapped level"}`;
  const actualOutcome = outcomeMessage?.text
    ?? (confirmed
      ? `${reactionSummary} produced the required follow-through.`
      : `${reactionSummary} returned into the zone before producing clean distance.`);

  return {
    id: `review-${outcome.id}`,
    root: outcome.root,
    levelId: outcome.levelId ?? null,
    levelName: outcome.levelName ?? "Mapped decision area",
    zone: outcome.zone ?? touch?.zone ?? reaction?.zone ?? null,
    reviewedAt: outcome.createdAt,
    cycleStartedAt: startedAt,
    cycleEndedAt: outcome.createdAt,
    reactionType: reaction?.type === "rejection" || reaction?.type === "acceptance"
      ? reaction.type
      : "unknown",
    direction,
    score,
    grade: gradeForScore(score),
    verdict,
    originalExpectation: originalMessage?.text
      ?? reaction?.reasoning
      ?? touch?.reasoning
      ?? approach?.reasoning
      ?? "No retained expectation was available for this cycle.",
    actualOutcome,
    whatWorked,
    whatMissed,
    improvements,
    nextChecks,
    blindSpotTags: [...new Set(blindSpotTags)],
    evidence: {
      approachEventId: approach?.id ?? null,
      touchEventId: touch?.id ?? null,
      reactionEventId: reaction?.id ?? null,
      outcomeEventId: outcome.id,
      approachMessageId: approachMessage?.id ?? null,
      outcomeMessageId: outcomeMessage?.id ?? null,
      startPrice,
      outcomePrice,
      excursionPoints,
      timeToOutcomeMs: Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : null,
      gammaRegime: context?.options.gammaRegime ?? null,
      bullishShare: context?.options.bullishShare ?? null,
      optionsAsOf: context?.options.asOf ?? null,
      contextGeneratedAt: context?.generatedAt ?? null,
      priorTouchCount: priorTouches,
      priorConfirmedCount: priorConfirmed,
    },
    syncState: "local",
  };
}

export function mergeKwantBotLearningReviews(
  local: KwantBotLearningReview[],
  remote: KwantBotLearningReview[],
) {
  const merged = new Map<string, KwantBotLearningReview>();
  [...remote, ...local].forEach((review) => {
    const current = merged.get(review.id);
    const isNewer = !current || Date.parse(review.reviewedAt) > Date.parse(current.reviewedAt);
    const isSyncedCopy = current
      && Date.parse(review.reviewedAt) === Date.parse(current.reviewedAt)
      && review.syncState === "synced";
    if (!current || isNewer || isSyncedCopy) {
      merged.set(review.id, review);
    }
  });
  return [...merged.values()]
    .sort((left, right) => Date.parse(left.reviewedAt) - Date.parse(right.reviewedAt))
    .slice(-5_000);
}
