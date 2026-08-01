import type {
  SocialCommentPayload,
  SocialObject,
  SocialPrecordPayload,
  SocialProfilePayload,
  SocialProgressPayload,
  SocialReceiptPayload,
} from "@/lib/socials";

export const PROCESS_REPUTATION_VERSION = "process-reputation-v1";

export type ProcessReputationScores = SocialProfilePayload["scores"];

export type ProcessReputationResult = {
  index: number;
  scores: ProcessReputationScores;
  completedRecords: number;
  lockedPlans: number;
  helpfulReviews: number;
  evidenceUnits: number;
  confidence: number;
  seasonStart: string;
  seasonEnd: string;
};

const SCORE_WEIGHTS: Record<keyof ProcessReputationScores, number> = {
  preparation: 0.16,
  confirmation: 0.15,
  review: 0.14,
  calibration: 0.14,
  patience: 0.12,
  contribution: 0.09,
  consistency: 0.12,
  research: 0.08,
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
}

function average(values: number[]) {
  const valid = values.filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

function payload<T>(object: SocialObject | null | undefined) {
  return (object?.payload ?? null) as T | null;
}

export function processReputationSeason(date = new Date()) {
  const quarterStartMonth = Math.floor(date.getUTCMonth() / 3) * 3;
  const start = new Date(Date.UTC(date.getUTCFullYear(), quarterStartMonth, 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), quarterStartMonth + 3, 0, 23, 59, 59, 999));
  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

export function calculateProcessReputation(
  userId: string,
  objects: SocialObject[],
  profile: SocialProfilePayload,
  now = new Date(),
): ProcessReputationResult {
  const season = processReputationSeason(now);
  const inSeason = (object: SocialObject) => {
    const timestamp = Date.parse(object.createdAt || object.updatedAt);
    return Number.isFinite(timestamp) && timestamp >= season.start.getTime() && timestamp <= season.end.getTime();
  };
  const userObjects = objects.filter((object) => object.userId === userId && inSeason(object));
  const plans = userObjects
    .filter((object) => object.objectType === "precord")
    .map((object) => ({ object, value: payload<SocialPrecordPayload>(object) }))
    .filter((entry): entry is { object: SocialObject; value: SocialPrecordPayload } => Boolean(entry.value));
  const planIds = new Set(plans.map((entry) => entry.object.id));
  const receipts = objects
    .filter((object) => object.objectType === "receipt" && object.parentId && planIds.has(object.parentId) && inSeason(object))
    .map((object) => payload<SocialReceiptPayload>(object))
    .filter((value): value is SocialReceiptPayload => Boolean(value));
  const comments = userObjects
    .filter((object) => object.objectType === "comment")
    .map((object) => payload<SocialCommentPayload>(object))
    .filter((value): value is SocialCommentPayload => Boolean(value));
  const progress = userObjects
    .filter((object) => object.objectType === "progress")
    .map((object) => payload<SocialProgressPayload>(object))
    .filter((value): value is SocialProgressPayload => Boolean(value));

  const reasoningScores = plans.map((entry) => clampScore(entry.value.reasoningScore));
  const completionRate = plans.length ? receipts.length / plans.length * 100 : 0;
  const reviewComments = comments.filter((comment) => comment.kind === "REVIEW" || comment.kind === "LESSON");
  const helpfulReviews = reviewComments.filter((comment) => comment.helpful).length;
  const completedProgress = progress.map((item) => {
    const completed = [item.prepare, item.map, item.observe, item.review, item.improve].filter(Boolean).length;
    return completed / 5 * 100;
  });
  const disciplinedNoTriggers = receipts.filter((receipt) => receipt.noTrade && receipt.classification === "DISCIPLINED NO TRIGGER").length;

  const scores: ProcessReputationScores = {
    preparation: clampScore(average(reasoningScores)),
    confirmation: clampScore(average(receipts.map((receipt) => receipt.scores.confirmation))),
    review: clampScore(average(receipts.map((receipt) => receipt.scores.review))),
    calibration: clampScore(average(receipts.map((receipt) => {
      const assessmentConfidence = (receipt.assessment?.confidence ?? 0) * 100;
      return average([receipt.scores.final, receipt.scores.evidenceConfidence, assessmentConfidence]);
    }))),
    patience: clampScore(receipts.length
      ? average(receipts.map((receipt) => receipt.scores.discipline)) + Math.min(8, disciplinedNoTriggers * 2)
      : 0),
    contribution: clampScore(helpfulReviews * 18 + Math.max(0, reviewComments.length - helpfulReviews) * 4),
    consistency: clampScore(completionRate * 0.65 + average(completedProgress) * 0.15 + Math.min(20, profile.activityStreak * 2)),
    research: clampScore(average(plans.map(({ value }) => {
      const confluenceDepth = Math.min(12, value.confluences?.length ?? 0) / 12 * 100;
      return value.reasoningScore * 0.8 + confluenceDepth * 0.2;
    }))),
  };

  const evidenceUnits = plans.length * 2
    + receipts.length * 4
    + helpfulReviews * 2
    + Math.min(10, progress.length);
  const confidence = 1 - Math.exp(-evidenceUnits / 18);
  const weightedScore = (Object.keys(SCORE_WEIGHTS) as Array<keyof ProcessReputationScores>)
    .reduce((sum, key) => sum + scores[key] * SCORE_WEIGHTS[key], 0);
  // Evidence shrinkage prevents one perfect-looking record from outranking a durable sample.
  const index = evidenceUnits
    ? clampScore(weightedScore * (0.62 + confidence * 0.38))
    : 0;

  return {
    index,
    scores,
    completedRecords: receipts.length,
    lockedPlans: plans.length,
    helpfulReviews,
    evidenceUnits,
    confidence: Number(confidence.toFixed(4)),
    seasonStart: season.startIso,
    seasonEnd: season.endIso,
  };
}

export function compareProcessReputation(
  left: { userId: string; reputation: ProcessReputationResult; profile: SocialProfilePayload },
  right: { userId: string; reputation: ProcessReputationResult; profile: SocialProfilePayload },
) {
  return right.reputation.index - left.reputation.index
    || right.reputation.completedRecords - left.reputation.completedRecords
    || right.reputation.evidenceUnits - left.reputation.evidenceUnits
    || right.profile.activityStreak - left.profile.activityStreak
    || left.userId.localeCompare(right.userId);
}
