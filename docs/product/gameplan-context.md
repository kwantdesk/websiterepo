# Kwant Desk Gameplan — Product Memory

This file is the durable product contract for the Gameplan workspace. It is
authoritative for future design, data, bot and content work.

## Product promise

Twice each trading day the desk publishes a pre-session plan:

- Globex edition, before futures reopen.
- New York edition, before the US cash open.

The page shows where the market is forced to react, why, and what to do when it
gets there — before the session starts.

The 30-second path is: tape type, one-liner, three important prices and the one
trade. The five-minute path adds level explanations, scenario roads, receipts
and glossary learning.

## Non-negotiable rules

- No naked numbers. Every price must carry its reason and expected behaviour.
- Plain-English identity is the headline; market jargon is secondary.
- Every level explains both the hold and accepted-break outcome.
- Stale, partial, beta and unavailable data are labelled honestly.
- Probability weights are desk leans, never promises.
- A no-trade day is a professional outcome.
- Receipts are prominent and only use verified results.
- New York editions explain what changed from the Globex edition.
- Beginner, Standard and Pro modes use progressive disclosure.
- The permanent conscience line is:
  “The plan earns nothing until a level prints its reaction — the map is the
  map, the print is the permission.”

## Page anatomy

1. Header: edition, date, countdown, plain-English regime, exact freshness and
   the New York-vs-Globex diff.
2. One-liner: screenshot-shaped session summary containing side, key levels and
   the trap to avoid.
3. Interactive ladder: current-price marker, 6–14 named levels, strength,
   source agreement, visit/hold/break scripts, order character, terrain,
   history and shaded no-trade bellies.
4. “What if we get there?” mode: approach, first touch and two-outcome
   walkthrough.
5. Scenario roads: 2–4 metro-map paths, each with a trigger, path, kill
   condition and honest probability lean.
6. The One Trade: one setup only, both directions where relevant, permission,
   stops, targets, print checklist and explicit no-trade conditions.
7. Environment: tape, fear, money-flow and expiry gauges with beginner
   explainers.
8. Receipts: yesterday’s levels graded held, broke or untested; one-trade result
   and an honest desk sentence.
9. Utility: platform downloads, future level alerts, glossary and display mode.

## Daily edition data contract

```json
{
  "edition": {
    "session": "globex|newyork",
    "date": "",
    "published_at": "",
    "data_basis": "settle YYYY-MM-DD",
    "freshness_note": ""
  },
  "environment": {
    "tape": {
      "state": "calm|snowball|mixed",
      "flip_price": null,
      "plain": ""
    },
    "fear": {"ratio": 0.0, "plain": ""},
    "flow": {"lean": -1.0, "plain": ""},
    "expiry": {"relevant": true, "plain": ""}
  },
  "one_liner": "",
  "ladder": [{
    "zone": [0, 0],
    "name": "",
    "role": "magnet|wall|accelerant|decision",
    "strength": 1,
    "sources": ["positioning", "dated", "tape-memory", "em-math"],
    "why": "",
    "if_visit": "",
    "if_hold": "",
    "if_break": "",
    "order_character": {"balance": -1.0, "plain": ""},
    "terrain": "sticky|air",
    "history": "",
    "career": []
  }],
  "belly_zones": [[0, 0]],
  "scenarios": [{
    "name": "",
    "trigger": "",
    "path": [0],
    "kill": "",
    "weight": 0.0
  }],
  "one_trade": {
    "zone": [0, 0],
    "long_side": {"permission": "", "stop": 0, "targets": []},
    "short_side": {"permission": "", "stop": 0, "targets": []},
    "not_a_trade_if": ""
  },
  "receipts": {
    "date": "",
    "levels": [{"zone": [0, 0], "verdict": "held|broke|untested", "note": ""}],
    "one_trade_outcome": "",
    "honest_note": ""
  },
  "downloads": {"deepchart_xml": "url", "sierra_csv": "url"}
}
```

Bots format and publish verified content into these slots. They do not invent
trading claims, receipts or freshness.
