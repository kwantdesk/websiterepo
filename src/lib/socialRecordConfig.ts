export const SOCIAL_RECORD_COPY = {
  section: "Socials",
  record: "Decision Record",
  records: "Decision Records",
  lockAction: "Lock today's Gameplan",
  lockedState: "Locked · awaiting outcome",
  receipt: "Actual Execution",
  community: "Community",
  tagline: "Trade independently. Improve together.",
  loop: "Plan it. Prove it. Review it. Repeat.",
} as const;

export const SOCIAL_RECORD_RULES = {
  scoreModelVersion: "kwant-process-v1",
  assessmentRubricVersion: "zyon-adaptation-v1",
  temporaryStatus: {
    code: "on-fire",
    name: "ON FIRE",
    verifiedSessionsRequired: 5,
  },
  permanentCollectible: {
    code: "five-straight",
    name: "FIVE STRAIGHT",
    verifiedSessionsRequired: 5,
  },
} as const;

