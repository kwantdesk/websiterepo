# Gexdesk — Product and Implementation Memory

Last updated: 30 July 2026

Status: Authoritative product brief for the Kwant Desk implementation

Source: Founder brief supplied in `NDX / QQQ Gamma Visualisation for Bookmap Product, Data, Calculation, and User-…/pasted-text.txt`

## Product definition

Gexdesk is a price-aligned options-positioning workspace for NQ. It converts NDX, NDXP, and QQQ options positioning, expiration structure, and live options activity into a small number of understandable behavioural zones, then compares those expectations with observed NQ futures activity.

It is not an options DOM and must never imply that calculated gamma is resting futures liquidity. The product exists to make a complex derivatives landscape readable without hiding the distinction between calculated positioning, changing options pressure, and observed futures confirmation.

The default view must answer five questions quickly:

1. Is the options environment stabilising, amplifying, or in transition?
2. Where are the nearest meaningful behavioural zones in NQ price?
3. What behaviour is expected at those zones?
4. Is the positioning or options pressure changing?
5. Is the NQ futures tape confirming that expectation?

## Non-negotiable model: MAP / PRESSURE / TAPE

Every visual and every explanation belongs to one of three clearly labelled layers.

### MAP — stored positioning

MAP describes the current options-positioning landscape:

- net and gross gamma exposure;
- mapped NDX, NDXP, and QQQ strike contributions;
- call-side and put-side concentration;
- expiration structure and 0DTE concentration;
- nearby behavioural zones;
- source agreement and source contribution.

MAP is a calculated model. It is not resting liquidity, exact dealer inventory, or guaranteed support/resistance.

### PRESSURE — changing options flow

PRESSURE describes the direction and confidence of recent options activity:

- confidence-weighted signed delta demand;
- call/put and bid/ask classification;
- short rolling impulse and persistence;
- source and expiration contribution;
- building, weakening, or stable positioning where successive snapshots support that conclusion.

Until exact executable units have been fully validated, pressure is a normalized relative index from -100 to +100 and is explicitly labelled as estimated.

### TAPE — observed NQ confirmation

TAPE is based on actual NQ futures prints:

- current price and tick direction;
- signed trade delta;
- short-horizon velocity;
- price response at or near a mapped zone;
- whether futures behaviour confirms, leads, diverges from, or remains neutral to the options expectation.

TAPE is not derived from options positioning and must not be presented as though it is.

## Data responsibilities

### QuantData

QuantData is the options-positioning and options-flow source:

- NDX and QQQ gamma exposure by strike;
- 0DTE gamma exposure;
- total net and gross exposure;
- expiration structure;
- consolidated options order flow;
- source spot values used in mapping.

Product-facing attribution is “Kwant Data proprietary model.” Do not display the external vendor name in the UI.

### Databento

Databento is the futures observation source:

- native NQ futures spot;
- shared live NQ ticks;
- trade size and signed delta;
- futures velocity and response;
- freshness and connection state.

The Gexdesk client reuses Kwant Desk’s existing shared CME stream. It must not open a second live Databento connection.

### Failure rules

- Missing data is unknown, never zero.
- A stale source is visibly faded and timestamped.
- A failed source can be excluded from a partial combined result, but the UI must disclose the partial state.
- Last good data may remain visible with a stale label; it must not masquerade as current.
- The page must show source freshness and the time of the most recent successful snapshot.

## Core calculations

### Regime

Use the bounded ratio:

`regimeRatio = totalNetGex / totalGrossGex`

Classification:

- greater than `+0.10`: stabilising;
- less than `-0.10`: amplifying;
- otherwise: transition.

The UI must show both the plain-language state and the ratio. Thresholds may later become instrument- and session-aware, but must remain versioned and explainable.

### 0DTE share

`zeroDteShare = grossZeroDteGex / grossAllExpiryGex`

Use gross exposure for both numerator and denominator so positive and negative contributions do not cancel.

### Mapping options strikes to NQ

For each source:

`mappedNqPrice = currentNqPrice × sourceStrike / sourceSpot`

This is the default relative mapping for NDX and QQQ. NDXP is grouped with NDX where the upstream endpoint does not separate it cleanly.

Every mapped contribution retains:

- original source;
- original strike;
- mapped NQ price;
- net, absolute, call, and put contribution;
- expiration bucket where available.

### Composite modes

Economic mode:

- sums exposure in compatible per-1% source units;
- visibly preserves NDX/NDXP and QQQ contribution;
- is used for primary zone strength.

Agreement mode:

- normalizes source profiles;
- compares sign, shape, and zone overlap;
- prevents one source’s scale from hiding disagreement.

The user can switch modes. The default combined view shows economic strength with a separate agreement score.

### Source agreement

Agreement combines:

- regime-sign agreement;
- mapped-profile correlation;
- overlap of the strongest nearby zones.

The result is displayed as high, mixed, or low agreement with an explainable percentage. It is not a confidence guarantee.

### Zone formation

Mapped strike contributions are aggregated into volatility-aware NQ price buckets. Nearby high-contribution buckets are clustered into zones.

Each zone has:

- low, centre, and high NQ price;
- stabilising, amplifying, or transition behaviour;
- absolute strength;
- current priority;
- call/put contribution;
- NDX/NDXP and QQQ source mix;
- 0DTE share;
- distance from current NQ price;
- building, weakening, or stable snapshot state;
- a concise expected-behaviour explanation;
- an observed-tape condition to watch;
- an invalidation condition.

Strength and priority are distinct. Strength describes the stored options concentration. Priority incorporates proximity, source agreement, expiration relevance, and live context.

### Options pressure

Recent options trades are signed using bid/ask classification and weighted by:

- option delta;
- trade size;
- classification confidence;
- reduced confidence for mid-market or complex activity.

The first implementation exposes a relative `-100…+100` pressure index, not unverified dollar flow. The UI identifies this as estimated pressure.

### NQ confirmation

The client evaluates the shared NQ tape against the selected zone:

- confirming: price response and signed delta agree with the expected zone behaviour;
- leading: the futures tape moves before options pressure changes;
- diverging: price or delta rejects the options expectation;
- neutral: insufficient evidence or price is not interacting with a relevant zone.

No mysterious composite “AI confidence” score is permitted in this layer.

## Information architecture

Gexdesk is a first-class top-navigation workspace.

### Default analyst surface

1. Regime strip
   - stabilising / transition / amplifying;
   - regime ratio;
   - 0DTE share;
   - NDX/QQQ agreement;
   - live NQ price and freshness.

2. Price-aligned gamma rail
   - current NQ price glows with the active theme;
   - mapped exposure bars are aligned to NQ price;
   - only the strongest three to five zones are emphasized;
   - stabilising and amplifying contributions use visually distinct theme-aware treatments;
   - the map itself must remain a behavioural positioning rail rather than imitating resting futures liquidity.

3. Zone focus
   - clicking a zone explains why it matters;
   - expected behaviour;
   - source and expiration contribution;
   - what the options pressure is doing;
   - what the NQ tape must do to confirm;
   - explicit invalidation.

4. Pressure ribbon
   - recent options impulse;
   - persistence and state;
   - NDX/QQQ contribution;
   - estimated-unit disclosure.

5. Tape confirmation
   - confirming, leading, diverging, or neutral;
   - current signed delta and short-horizon velocity;
   - live feed status.

### Options activity heatmap

The Heatmap tab sits directly beside Map and is a distinct tape surface rather than a restyling of the positioning rail.

- consolidated NDX and QQQ call/put prints are mapped onto NQ-equivalent price levels;
- the live MNQ price path is preferred, with NQ as a feed fallback;
- the plot uses a continuous white price line and never draws trade bubbles;
- horizontal heat cells represent actual options activity at a mapped price and minute;
- brightness may be scaled by premium or contract count;
- calls and puts use the active theme primary and accent colours;
- repeated or larger prints make the relevant level progressively brighter;
- the right-hand ladder replaces a futures DOM with call-versus-put activity at each level, including premium or contracts and print counts;
- the current price and the hottest mapped level are visually distinguishable;
- no synthetic heat is drawn when the options tape is unavailable.

Required disclosure:

> Brightness measures consolidated call/put activity mapped to NQ-equivalent levels. It is options activity, not resting futures liquidity.

### Controls

- source: Combined, NDX, QQQ;
- expiry: All expiries, 0DTE;
- composite: Economic, Agreement;
- view: Simple, Analyst.

Controls use the Kwant Desk custom dropdown component and must never fall back to native Windows-styled selects.

### Analyst view

Analyst view may add:

- expiration stack;
- source comparison;
- raw mapped strike contributions;
- recent snapshot changes;
- calculation and freshness details.

It must preserve the same visual hierarchy and not overwhelm the default view.

## Visual language

- Use the active Kwant Desk theme variables exclusively.
- Backgrounds remain black or near-black.
- Primary and accent colours communicate state without turning the page into a rainbow.
- White remains the neutral information colour.
- Current NQ price uses the existing slow theme-aware glow treatment.
- Borders are subtle; no heavy white outlines.
- Use dense, precise typography consistent with the charting workspace.
- Loaders use the shared `KwantLoader`.
- The workspace fits the viewport and uses controlled internal scrolling.
- Kwantify's heatmap may inform density, depth and price-path legibility. Gexdesk must keep the behavioural Map and the options-activity Heatmap as clearly separated products.

## Refresh and performance

- shared NQ tape: event-driven through the existing application connection;
- options pressure and heatmap tape: target 3–10 seconds;
- exposure map: target 15–30 seconds;
- expiration structure: target 30–60 seconds;
- API calls are cached and coalesced;
- previous successful snapshots remain available during refresh;
- navigation must not tear down the shared CME engine;
- no page-level polling loop may trigger a full application refresh.

## Required language and disclosures

Persistent page disclosure:

> Estimated options positioning and pressure. Not resting liquidity, exact dealer inventory, or a guaranteed trading signal.

Preferred product sentence:

> A price-aligned options-positioning layer for NQ that converts NDX and QQQ gamma, expiration structure, and live options activity into a small number of behavioural zones, then compares those expectations with observed NQ order flow.

Avoid:

- guaranteed support or resistance;
- exact dealer positioning unless a validated source explicitly provides it;
- exact futures contract demand inferred only from options flow;
- “liquidity” for calculated gamma zones;
- precise gamma flip claims without validated repricing;
- hiding stale or partial sources.

## Delivery phases

## Requirement coverage audit

This audit is maintained against the complete founder brief. A visually small default map is intentional progressive disclosure; the full desk is available through the Map, Evolution, Expiries, Flow & Tape, and Sources surfaces.

### Delivered end to end

- MAP / PRESSURE / TAPE remain visibly separate.
- NDX/NDXP and QQQ exposure is mapped to live NQ-equivalent price.
- Regime uses net divided by gross gamma and is labelled stabilising, amplifying, or transition.
- Gross 0DTE share is shown without netting away opposing exposure.
- Economic-strength and source-agreement composite views are distinct.
- The gamma rail, current NQ marker, and a maximum of five behavioural zones share one price axis.
- Zone strength and current priority are separate.
- Level Focus includes expected behaviour, tape evidence, invalidation, distance, source mix, call/put mix, 0DTE mix, original strikes, and observed build/weakening state.
- Options pressure is a confidence-weighted relative index with a time series and source decomposition.
- NQ confirmation comes from the shared application CME stream; Gexdesk does not open a second live connection.
- Expiry contribution is grouped into 0DTE, 1DTE, 2–5DTE, 6–30DTE, and 30+DTE before the full analyst matrix.
- NDX and QQQ profiles can be inspected separately with regime agreement and mapped-profile correlation.
- Source status, snapshot freshness, partial failures, mapping coverage, and the last valid payload remain visible.
- Raw mapped NQ buckets preserve their contributing NDX and QQQ strikes.
- Custom Kwant Desk controls are used throughout; there are no native browser/Windows dropdowns.

### Added after the completeness audit

- An Intraday Evolution surface backed by QuantData interval maps.
- Historical NQ-equivalent mapping uses source and NQ prices from the same minute, rather than applying the current mapping ratio to old exposure.
- Exposure and change modes show where gamma was stored and where it built or faded.
- The observed NQ path is overlaid on the evolution surface.
- Flow & Tape contains synchronized pressure and futures-delta series with a plain-language confirming, diverging, or leading/unconfirmed state.
- Sources contains source-specific profiles, a raw mapped-bucket inspector, original strikes, integrity states, and explicit model boundaries.
- Heavy historical work is fetched only when Evolution is opened, protecting navigation and the live chart engine.

### Deliberately gated until the data is methodologically valid

- A precise zero-gamma/gamma-flip level is not shown until spot-grid repricing is validated.
- Exact futures-contract hedging quantities are not shown until exposure units and conversion assumptions are verified.
- Gamma zones are not rendered as resting liquidity or as an options DOM.
- Open interest remains secondary and is not blended into live pressure because it is delayed and does not reveal position side.
- Full depth-based replenishment, pull/stack, absorption, and iceberg evidence awaits the validated futures depth layer; current TAPE uses observed prints, signed delta, velocity, and price response.
- Historical outcome statistics, replay research, calibrated alerts, charm/vanna overlays, and saved Gexdesk layouts remain later-phase product work rather than simulated features.

### Phase 1 — present implementation

- top-level Gexdesk route and navigation;
- combined NDX/QQQ mapped gamma rail;
- regime, 0DTE share, source agreement;
- three to five behavioural zones;
- selected zone explanation;
- shared live NQ tape confirmation;
- estimated pressure index;
- source freshness and partial-data handling;
- simple and analyst modes.

### Phase 2

- full expiration matrix;
- richer snapshot-change history;
- more rigorous pressure persistence;
- calibration by session and realized volatility;
- deeper source contribution and strike inspection.

### Phase 3

- validated historical outcome testing;
- reaction statistics by zone type, regime, session, and distance;
- versioned model calibration;
- alerts and saved Gexdesk layouts;
- additional supported futures mappings where the data model is defensible.

## Product decisions locked by this brief

- NQ is the primary futures instrument.
- NDX/NDXP and QQQ remain visibly separate sources even when combined.
- MAP, PRESSURE, and TAPE are never blended into an unexplained score.
- The default view emphasizes a few meaningful zones, not every strike.
- Live futures confirmation comes from the shared Databento engine.
- Options positioning and flow come through the existing QuantData server integration and are branded in-product as the Kwant Data proprietary model.
- All uncertainty, freshness, and partial-source states remain visible.

## Technical confirmations still required before claiming full model precision

- exact unit definitions returned by each exposure endpoint;
- whether NDXP is independently identified in every response;
- whether the upstream feed supplies dealer-side sign or only trade-side classification;
- the correct handling of complex/multi-leg trades;
- final expiry-bucket definitions and expiry timezone;
- historical calibration of clustering width, regime thresholds, and confirmation windows.

Until confirmed, the UI uses relative units and restrained language.
