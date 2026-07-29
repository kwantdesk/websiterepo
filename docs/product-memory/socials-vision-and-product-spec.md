# Kwant Desk Socials — Vision, Decisions, and Product Specification

Updated: 2026-07-29

Source: the complete 1,265-line founder conversation archive supplied as `C:\Users\Karen\Downloads\message (6).txt`.

Source integrity: 41,422 bytes; SHA-256 `B7E75DEE00B6A2312F0CF6ED031D2548AF8A42EEF97B99C48D903ED8FE015EE3`.

This document is permanent product memory for the social layer of Kwant Desk. It consolidates the full conversation, resolves competing ideas, records what is included or deferred, and defines the standards future implementation must preserve.

## Executive decision

The working navigation name is **Socials** until the founders select a permanent name.

The social product is not a generic trading feed, Discord replacement, signal room, copy-trading product, or public P&L contest. It is a professional network built around timestamped preparation, immutable reasoning, verified execution, honest review, small-group belonging, and earned reputation.

The central product object is provisionally called a **Precord**:

> A plan placed on record before the outcome is known, later completed by an execution receipt without rewriting the original reasoning.

The name Socials can change without changing this product architecture.

## Emotional contract

The page must make a user feel:

1. **Belonging** — these are people who trade the same markets, sessions, and decision standards.
2. **Direction** — preparation, discipline, reasoning, and consistency have visible objectives.
3. **Recognition** — useful observations, questions, reviews, and research contributions matter.
4. **Earned reputation** — respect comes from reasoning that survives review, not a lucky screenshot.
5. **Daily relevance** — a Desk is active, preparation is underway, a mission is open, a review needs attention, or a record has progressed.

The desired emotional line is:

> This is my desk. These are my people. This is my record. I am becoming a better trader here.

Primary product line:

> Trade independently. Improve together.

Operating loop:

> Plan it. Prove it. Review it. Repeat.

## Non-negotiable community principle

The next decision remains individual. Preparation, evidence, and lessons can be shared.

The product must actively reduce groupthink and should never create pressure to copy another trader.

## Product safety rules

Socials must never reward:

- trade count;
- leverage;
- time spent staring at a chart;
- raw P&L;
- account size;
- constant posting;
- follower count;
- public bullish or bearish consensus before a user records their own view;
- urgency to enter a trade;
- punitive streak loss;
- humiliation through public risk diagnoses.

Socials should reward:

- both-sided preparation;
- confirmation discipline;
- correct no-trade decisions;
- completed reviews;
- calibration;
- evidence quality;
- repeatable process;
- helpful peer review;
- useful community research;
- patience and restraint.

The market already provides variable reward. Kwant Desk must use progression to reinforce protective professional behaviour, not gambling behaviour.

## Information architecture

The first full Socials page has six views.

### 1. Today

The daily operating surface.

It contains:

- the user’s five-step progress loop: Prepare, Map, Observe, Review, Improve;
- a progress ring that can complete without taking a trade;
- the current process status: Preparing, Mapping, Waiting, Observing, Reviewing, or Away;
- a daily mission;
- Desk presence and activity;
- relevant unfinished notifications;
- a weekly development narrative;
- recent structured activity;
- a Commit Before Reveal prompt where appropriate.

### 2. Precords

The structured feed and permanent record.

The feed supports:

- locked plans awaiting an outcome;
- live observations attached to a locked plan;
- execution receipts;
- proven, partially proven, adapted, invalidated, no-trigger, and expired records;
- review requests;
- questions attached to a chart, Gameplan, level, GEXMAP moment, Journal entry, or replay timestamp;
- lessons derived after review.

Open-ended lifestyle posting is deliberately excluded.

### 3. Desks

Small persistent groups of approximately 5–12 traders.

Matching dimensions:

- primary market;
- preferred session;
- timezone;
- experience level;
- trading approach;
- options awareness;
- preferred activity level;
- development objective.

A Desk shows:

- online members;
- member process statuses;
- preparation and review completion;
- current weekly objective;
- open questions;
- recent receipts and lessons;
- preparation streak;
- a private process leaderboard.

Public Long and Short statuses are prohibited.

### 4. Rankings

Rankings are multidimensional rather than a single “best trader” score.

Dimensions:

- Preparation;
- Confirmation Discipline;
- Review Integrity;
- Calibration;
- Patience;
- Community Value;
- Consistency;
- Research Contribution.

Primary scopes:

- Friends;
- My Desk.

Secondary scopes:

- NQ;
- ES;
- session;
- experience cohort;
- weekly improvement;
- monthly consistency;
- contribution;
- review integrity.

Rankings reset seasonally while permanent achievements remain in the user’s record.

### 5. Calling Cards

Calling Cards are visual records of origin, achievement, current form, contribution, mastery, and corrected weaknesses.

Families:

- **Legacy** — Founder, Founding Trader, Closed Alpha, Beta;
- **Mastery** — 0α Decay, Risk Architect, Scenario Master;
- **Momentum** — On Fire, White Hot, Locked In;
- **Contribution** — Mentor, Plan Reviewer, Countercase Specialist;
- **Hidden** — Daily Architect, Before the Bell, Quiet Consistency;
- **Corrective** — private diagnoses such as Glass Cannon or Plan Drifter;
- **Transformed** — permanent record of a completed correction, such as Tempered Steel.

Temporary states and permanent collectibles are distinct.

Example:

- active state: **On Fire — five consecutive verified winning sessions**;
- permanent collectible after it ends: **Five Straight — first five-session win streak**, dated and stored.

Hidden positive cards are secret before discovery but fully explained afterward.

Corrective cards:

- remain private by default;
- explain the evidence;
- provide a corrective challenge;
- can be appealed;
- may be displayed voluntarily;
- transform into a respected permanent card after correction.

### 6. Identity

The professional trader identity card.

It includes:

- display name and avatar;
- handle;
- primary markets;
- preferred session;
- timezone;
- experience level;
- trading style;
- favourite Kwant theme;
- current improvement objective;
- process streak;
- reasoning-quality trend;
- strongest discipline;
- current blind spot;
- community roles;
- Calling Cards;
- recent reviewed receipts;
- research contributions;
- Desks and friends;
- granular privacy controls.

Profile visibility can be:

- private;
- friends;
- Desk;
- authenticated community;
- included in a public share card.

## The Precord object

### Before execution

A user records:

- instrument;
- direction or explicitly neutral/both-sided stance;
- market context;
- session;
- planned entry or entry zone;
- planned stop;
- planned target;
- planned size;
- maximum risk;
- planned risk/reward;
- confirmation requirements;
- invalidation;
- plan expiry;
- visibility;
- optional Desk.

Publishing creates an immutable timestamp and preliminary Reasoning Score.

Initial state:

> PRECORDED · AWAITING OUTCOME

The plan cannot be edited after publication. Corrections must be new, timestamped amendments rather than silent edits.

### After execution

The user adds an Execution Receipt containing:

- actual entry and time;
- actual stop;
- actual exit and time;
- size;
- partial exits;
- fees;
- screenshot or broker evidence;
- confirmations that appeared;
- reason for any deviation;
- whether no trade was correctly taken.

The action is named **Add Actual Execution**, not Edit Plan.

### Deviation review

Kwant compares planned and actual:

- entry;
- stop;
- target or exit;
- size;
- risk;
- timing;
- confirmations;
- invalidation;
- expiry.

Accepted explanation categories:

- confirmation arrived later;
- entry used a defined zone;
- order-flow conditions improved;
- original price was missed;
- market structure changed;
- impulsive deviation;
- other.

Review classifications:

- Justified adaptation;
- Partially justified;
- Unjustified deviation;
- Insufficient evidence.

ZYON may later evaluate logical consistency against the locked plan, price path, market context, evidence, and confirmation rules.

### Scores

The original Reasoning Score never changes.

Later layers are added:

- Confirmation;
- Discipline;
- Execution;
- Review;
- Evidence Confidence;
- Final Precord Score.

This preserves what the trader thought before the outcome while allowing the completed record to become more informative.

### Lifecycle

- Precorded;
- Live;
- Entry Triggered;
- Execution Added;
- Under Review;
- Proven;
- Partially Proven;
- Adapted;
- Invalidated;
- No Trigger;
- Expired.

## Structured activity types

Every public claim must contain a reason, condition, timestamp, or explicit question.

Supported types:

### Map

- instrument;
- session;
- important level;
- why it matters;
- bull condition;
- bear condition;
- confirmation;
- invalidation;
- timestamp.

### Live Observation

- level observed;
- current behaviour;
- evidence present;
- evidence missing;
- what changes the interpretation.

### Receipt

- immutable original reasoning;
- outcome;
- what worked;
- what was missed;
- reasoning-quality score;
- next-time rule.

### Review Request

A focused question asking for evidence-based critique.

### Lesson

Linked to a level, condition, catalyst, blind spot, or improvement rule.

### Question

Attached to real platform context rather than posted as an ungrounded opinion.

The community rule is:

> No naked opinions.

## Commit Before Reveal

Before seeing community interpretation, a user records:

- what matters;
- bull confirmation;
- bear confirmation;
- invalidation;
- whether enough evidence exists.

Only then can the user unlock aggregated Desk comparison.

Consensus is shown as process conditions, not a buy/sell signal.

This provides curiosity and comparison while reducing anchoring and herd behaviour.

## Friends and matching

Users can:

- follow public work;
- send mutual friend requests;
- invite friends into a Desk;
- request a receipt review;
- save useful contributors;
- see friends who are preparing or reviewing;
- create private discussion circles;
- compare progress privately;
- share selected workspace configurations;
- invite friends to future replay sessions.

Suggested people are ranked by compatibility and shared objectives, not popularity.

## Progression

### Daily missions

Examples:

- map both sides before New York;
- define a no-trade condition;
- review yesterday’s most important decision;
- ask an evidence-based question;
- help a Desk member improve a confirmation rule;
- commit an interpretation before revealing Desk comparison.

### Weekly challenges

Examples:

- five preparation loops;
- three honest reviews of losses or invalidated ideas;
- one complete reasoning chain;
- compare reactions to the same level type;
- complete a replay without hindsight editing;
- convert a recurring blind spot into an explicit rule.

### Desk competitions

Reward:

- preparation completion;
- receipt completeness;
- calibration improvement;
- helpful peer review;
- disciplined no-trade decisions;
- community research.

Rewards are cosmetic, access-oriented, or social:

- profile accents;
- banners;
- chart themes;
- emblems;
- receipt designs;
- feature previews;
- hosting a community review.

### Streak rules

Supported streaks:

- preparation;
- review;
- full loop;
- learning;
- contribution;
- risk discipline;
- weekly consistency.

Rules:

- a verified no-trade session preserves a streak;
- weekends do not break market-session streaks;
- grace days exist;
- one missed day does not erase long-term identity;
- no streak depends on placing a trade.

## Calling Card catalogue

### Legacy

- Founder;
- Founding 100 / 500 / 1,000;
- Genesis Trader;
- Day Zero;
- First Desk;
- Closed Alpha;
- Alpha Architect;
- Beta Trader;
- Beta Validator;
- Bug Hunter;
- First Signal;
- Early Quant.

Legacy membership requires meaningful participation, not account creation alone.

### Hidden positive

- Daily Architect;
- Before the Bell;
- Quiet Consistency;
- Process Over Outcome;
- The Professional;
- No Trade, No Problem;
- First One In;
- The Historian;
- Mirror Work;
- Consistency Without Applause;
- Waited for Permission.

### Corrective and transformed

- Glass Cannon → Tempered Steel;
- One-Month Wonder → Proven Over Time;
- Borrowed Fire → Earned Fire;
- House Money → Risk Architect;
- Plan Drifter → Locked In;
- Outcome Merchant → Process Verified;
- Overclocked → Controlled Operator;
- Paper Armour → Evidence Backed;
- Single Environment → broader-regime validation;
- Lucky Streak → Repeatable Edge.

### Prestige

0α Decay represents a process whose apparent edge remains stable as evidence grows.

Potential validation:

- at least 90 days;
- 40–60 reviewed Gameplans;
- strong evidence verification;
- stable Reasoning and Discipline scores;
- no severe risk violations;
- performance across conditions;
- no dependency on one outlier period;
- risk-normalized credibility;
- recent quality close to long-term baseline.

Prestige is revalidated. Historical achievement remains collectible if current validation expires.

## Profile equipment

Profile slots:

- Primary Calling Card;
- Active State;
- Legacy Pin;
- Prestige Classification;
- Risk State;
- Banner Animation;
- Card Collection.

This produces a narrative identity rather than a generic badge count.

## Community Memory

With explicit permission and anonymisation, reviewed observations can contribute to shared research.

Research questions include:

- response rates at positioning walls;
- reliable confirmation during high volatility;
- blind spots around catalysts;
- repeated-touch behaviour;
- useful no-trade conditions.

Monthly missions should credit useful contributors and publish a collective report.

The user should feel:

> I am improving myself and contributing to a larger body of market evidence.

## Notifications

Good notifications represent unfinished social or learning value:

- Desk preparation progress;
- a requested review;
- completed reasoning analysis;
- shared development objectives;
- a Desk mission close to completion;
- a contribution accepted into Community Memory;
- an upcoming review session;
- a no-trade receipt that can preserve the full-loop streak.

Avoid:

- price-trigger spam;
- public profit alerts;
- FOMO;
- urgency to trade;
- community directional bias;
- punitive language.

## Discord boundary

Discord is the lobby, not the system of record.

Use it for:

- onboarding;
- voice rooms;
- education;
- weekly reviews;
- announcements;
- social conversation;
- feedback;
- Desk recruitment;
- events;
- support;
- limited Gameplan previews.

KwantBot for Discord may publish summaries, challenges, event reminders, review notifications, community recaps, and deep links.

Complete reasoning, receipts, evidence, and permanent memory remain inside Kwant Desk.

## Decisions: what stays

First-class:

- structured posts;
- immutable Precords;
- execution receipts;
- small Desks;
- friends and compatibility matching;
- process-based rankings;
- Today loop;
- Commit Before Reveal;
- temporary states plus permanent Calling Cards;
- private corrective development;
- granular privacy;
- source-linked evidence;
- Community Memory seams.

## Decisions: what changes

- The section is temporarily called Socials rather than prematurely committing to The Floor or Precord as the navigation name.
- Precord is the content object and verb, not necessarily the permanent network brand.
- “Cursed Cards” are presented in the interface as **Private Correction Tracks** unless the user voluntarily equips a transformed card.
- Momentum based on win streaks is permitted only when wins are verified and risk-normalized. It cannot outweigh discipline or encourage increased risk.
- A follower system exists, but follower count is not promoted as reputation.
- Global ranking is secondary to Friends and Desk ranking.
- Discord is an extension, not the permanent data layer.

## Decisions: what is excluded

- generic unstructured posting;
- public raw-P&L ranking;
- public leverage or account-size comparison;
- copy trading;
- signals;
- public directional status;
- editable hindsight predictions;
- engagement bait;
- humiliating public labels;
- pay-to-win profile status;
- rewards for overtrading;
- addictive infinite-scroll patterns without natural stopping points.

## Release sequence

### Release 1 — Social foundation

- Today;
- Precord feed;
- create and lock a Precord;
- add an execution receipt;
- profile identity;
- small Desks;
- process rankings;
- Calling Card framework;
- daily loop and missions;
- Commit Before Reveal;
- privacy controls;
- reactions and evidence-based comments;
- local resilience plus Supabase persistence.

### Release 2 — Platform links

- share directly from Gameplan, Charts, GEXMAP, Journal, KwantBot, and ZYON;
- broker-verified execution receipts;
- automated score inputs;
- screenshot and attachment storage;
- friend matching;
- Desk invitations;
- moderation and reporting;
- personal and Desk weekly recaps.

### Release 3 — Network intelligence

- Community Memory;
- research missions;
- mentorship;
- replay rooms;
- Discord roles and deep links;
- validated prestige;
- corrective challenge automation;
- community-generated education.

## Data integrity requirements

- Locked plan fields are immutable at the database layer.
- Amendments create a new timestamped record.
- Execution receipts cannot rewrite preliminary reasoning.
- Every score exposes its data completeness and sample size.
- Public visibility is opt-in and field-specific.
- Deletes must respect ownership and attachment cleanup.
- Desk membership and private content require membership checks.
- Feed queries must be bounded and paginated.
- No secrets or broker credentials are stored in social objects.
- Evidence is private by default until explicitly shared.

## Success measures

Success is not minutes spent or posts per user.

Measure:

- percentage completing the operating loop;
- no-trade sessions correctly recorded;
- review completion;
- evidence attachment rate;
- calibration improvement;
- helpful review acceptance;
- active small-Desk retention;
- weekly return driven by unfinished learning value;
- privacy and moderation incidents;
- percentage of public claims with complete structure;
- contribution to Community Memory;
- churn after long identity-building periods.

## Product promise

Instagram records appearance. LinkedIn records claims. Kwant Desk Socials records what a trader believed before the outcome, what they actually did, how honestly they reviewed it, and how their professional process developed over time.

That record—not a noisy feed—is the asset.
