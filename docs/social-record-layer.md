# Social Record Layer

This document is the implementation memory for the Socials product. The public product name is unresolved, so user-facing terminology is centralised in `src/lib/socialRecordConfig.ts`.

## Product centre

Socials is not a prediction feed, signal room, copy-trading product, or P&L leaderboard. Its primary object is a complete Decision Record:

1. Take the existing Kwant Gameplan.
2. Lock a timestamped, immutable snapshot before the outcome.
3. Append the actual execution or a valid no-trigger/no-trade result.
4. Compare the locked plan with what happened.
5. Assess whether any adaptation was justified by the evidence available at the time.
6. Preserve the original reasoning score and add versioned post-execution scores.
7. Share the completed structured record with the selected audience.

The product promise is: **Trade independently. Improve together.**

## Integration map

| Existing capability | Extension used by Socials | Compatibility/risk |
| --- | --- | --- |
| `/api/gameplan` and `GameplanPayload` | Socials reads the current NQ/ES Gameplan and locks a compact source snapshot | The source Gameplan is generated platform-side and is not replaced by a second builder |
| `social_objects` JSONB store | `precord` remains the internal legacy type; its payload now stores source metadata, hash, lifecycle and score model version | User-facing copy says Decision Record; changing the database type would require a larger migration |
| Database immutability trigger | Locked records remain insert-only and cannot be deleted through the Socials API | Amendments must be appended as events/receipts |
| Receipt and private evidence rows | Receipt payload adds exact comparison, assessment metadata and score snapshots | Broker verification is not yet connected, so evidence must remain visibly self-reported |
| ZYON/Anthropic server infrastructure | Adaptation assessment reuses the same Anthropic key and ZYON identity | A deterministic rules fallback is labelled honestly when AI is unavailable |
| Existing comments/reactions | Review and evidence discussion remains attached to the source record | Helpful-response moderation is still basic |
| Calling Card catalogue | Reward thresholds are centralised; inactive rewards are shown as not yet verified | ON FIRE/FIVE STRAIGHT cannot activate until verified execution imports exist |

## Invariants

- A locked plan is never edited in place.
- The original reasoning score is never overwritten with outcome knowledge.
- An execution earlier than the lock is labelled retrospective.
- Self-reported evidence is never displayed as broker verified.
- A no-trigger/no-trade day can complete the process loop.
- Public surfaces do not expose live crowd direction.
- Rewards do not activate from unverified or invented data.

## Production slices after this page rebuild

1. Broker/imported execution verification.
2. Append-only lifecycle-event rows rather than payload-only lifecycle metadata.
3. Moderated replies, resolved reviews, blocking and muting.
4. Domain-event reward engine with idempotent grant history.
5. Friends/Desk-first multidimensional ranking periods.

