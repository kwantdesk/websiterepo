# KwantDesk Public Launch Engineering Charter

Status: owner-approved direction recorded 2026-09-03  
Target: public subscription launch in October 2026

This is the durable product, engineering, capacity, licensing, cost and quality
brief for the KwantDesk website launch. It supplements `CLAUDE.md`. Where old
handoff text describes retired production providers or a single-operator
prototype as the future architecture, this charter is the current launch
direction.

## 1. Product sequence

1. Build the browser product out fully and make the complete user experience as
   close to professional/institutional quality as practical.
2. Repair existing defects at their root and complete the associated adjacent
   workflows, not only the exact control named in a bug report.
3. Preserve one provider-neutral data contract while product work continues so
   production engineering does not require every chart to be rebuilt.
4. Before paid registration opens, engineer, load-test and prove the platform
   for at least 100 simultaneous customers.
5. Launch the paid website.
6. Continue the shared .NET/Avalonia/Skia desktop application after the website
   launch. The desktop application is not a prerequisite for the website
   launch and must reuse the same normalized data semantics.

Visual completion may lead the work, but capacity, authentication, licensing
and data-boundary decisions cannot be deferred until launch night.

## 2. Quality and delivery standard

- No shortcuts, fake controls, silent fallbacks, invented market data or
  cosmetic patches that conceal a broken data path.
- Diagnose the complete path: provider, gateway, normalization, cache/stream,
  state, calculation and renderer.
- When a change applies to a class of components, audit every applicable
  component individually. A request affecting all indicators is not complete
  after changing one indicator.
- Maintain readable contrast across every theme. A global theme change must
  apply immediately throughout the website unless a user deliberately saved a
  supported chart/indicator-specific colour override.
- Preserve panel-local settings while sharing data subscriptions and caches.
- Every completed change requires focused regression tests, appropriate static
  checks/build verification, and honest production or live-session caveats.
- Stage and commit only scoped files in the dirty repository. Never include
  `ALGO/`, credentials, recordings, generated evidence or another workstream.
- Push completed website changes to `origin/main`. Only the active
  `websiterepo-yfmi` Vercel project may remain Git-connected. The stale
  `websiterepo` project must never be reconnected.
- Avoid unnecessary Vercel builds. Live streams, per-tick traffic, replay
  generation, archive processing and vendor fan-out do not belong in Vercel
  Functions.

## 3. Provider and licensing boundaries

- **Rithmic:** at launch, customers connect their own entitled feed. KwantDesk
  must use the provider-approved web/cloud authentication and conformance model.
  The present single operator credential is not the public multi-user design.
- **QuantData:** current internal/interim source only. It is not licensed for
  redistribution to subscribers and must not be exposed or resold.
- **Licensed options source:** KwantDesk will introduce separately licensed
  options data that it is permitted to distribute and sell. Its adapter must be
  provider-neutral, centrally normalized, metered and contractually scoped.
- **Databento and Massive:** retired as active production providers. Do not add
  new runtime dependencies on them. Historical references in the repository do
  not make them current launch sources.
- Never treat a commercial-data assumption as permission. Record the exact
  licence, entitlements, permitted derived data, display rights, retention and
  redistribution rules before exposing a dataset to subscribers.

## 4. Capacity architecture

One hundred concurrent customers is the launch load, not the architecture
ceiling.

Required production shape:

```text
customer authentication
  -> short-lived, user-scoped stream ticket
  -> redundant WebSocket/SSE edge gateways
  -> private durable message layer
  -> sharded, isolated per-user Rithmic session workers
  -> normalized provider-neutral events

licensed options collector
  -> normalize once
  -> private message layer
  -> entitled subscriber fan-out

recorders/history workers
  -> object storage + indexed metadata
```

Design requirements:

- Feed sessions are isolated and shardable across worker processes/nodes.
- One customer, malformed payload, slow browser or provider reconnect cannot
  freeze other customers.
- Gateways are stateless enough to add/remove horizontally behind a load
  balancer.
- Credentials are encrypted or exchanged through provider-supported tokens;
  never stored in browser local storage, source, logs or recordings.
- Sequence numbers, heartbeat freshness, bounded queues, backpressure,
  slow-client eviction, snapshot-plus-delta recovery and reconnect/resume are
  explicit contracts.
- One licensed shared market-data ingestion is fanned out efficiently only
  where the licence permits it.
- Archive and replay computation runs outside the live-feed event loop.
- Recordings leave local gateway disks continuously for durable object storage.
  Disk capacity and backup freshness are monitored and alerted.
- Deployments are rolling and do not disconnect the entire customer base.
- Expanding from 100 to 300 users means adding workers/gateways and
  configuration, not rewriting the application.

## 5. Capacity and reliability acceptance gates

Before public paid launch:

- Support at least **100 simultaneous authenticated customers**.
- Prove **250 simultaneous customers for a sustained full-session test**.
- Prove a **500-customer short burst** without corrupting data or freezing the
  application.
- Run a representative eight-hour market-session soak using realistic message
  rates, instruments, MBO/depth payloads and chart subscriptions.
- Test process kill, node kill, packet loss, slow clients, provider logout,
  reconnect storms, rolling deploy, message-layer restart, disk pressure and
  object-storage outage.
- Demonstrate that failure of one node does not take the platform down and that
  clients resynchronize without silent gaps.
- Verify 24/7 Rithmic capture with explicit gap records and advancing off-box
  backups. QuantData request/response archival means preserving every response
  actually received; it does not justify quota-exhausting continuous polling.
- Define and monitor an initial availability SLO (at least 99.9%) and a recovery
  objective. “Nothing can ever crash” is not a truthful guarantee; seamless
  failure containment and recovery is the requirement.

Capacity targets:

| Measure | Launch requirement |
| --- | ---: |
| Admitted concurrent customers | 100 |
| Sustained tested capacity | 250 |
| Short-burst tested capacity | 500 |
| Expansion model | Add nodes, no rewrite |

The existing 30/30 concurrent health probe verifies only endpoint availability.
It is not evidence of 100 live provider sessions or customer workloads.

## 6. Latency targets

Do not advertise physically impossible universal single-digit latency.

- Gateway processing: target p95 below 5-10 ms under the proved launch load.
- Private message transit: target p95 below 2-5 ms inside one region.
- Same-region normalized tick-to-browser: target p95 around 30-50 ms where the
  provider and network permit it.
- Cross-continent latency is dominated by distance and routing and may be
  roughly 100-250 ms. Measure and publish actual regions instead of hiding it.
- Track p50/p95/p99 processing delay, provider-to-gateway age, queue depth,
  reconnects, dropped/coalesced messages, resyncs and bytes per user.

## 7. Launch operating budget

The working launch budget is **USD 500-800 per month**, excluding market-data
licensing/exchange fees, taxes and any provider certification charges.

| Component | Expected monthly range (USD) |
| --- | ---: |
| Two dedicated feed-session servers | $168-$250 |
| Two redundant stream gateways | $96-$168 |
| Database/private message layer | $40-$120 |
| Recording object storage and backups | $25-$100 |
| Load balancing, monitoring and security | $30-$100 |
| Vercel frontend and ordinary APIs | $20-$75 |
| Operating contingency | $75-$150 |

Cost controls:

- Initial infrastructure cap: **USD 800/month**.
- Budget alerts: **$400, $600 and $750**.
- Meter bytes, messages, CPU, memory and storage per active customer and per
  instrument before subscription pricing is finalized.
- Maintain a tested capacity margin; do not prepay for 1,000 users before they
  exist, but do not introduce a redesign boundary at 100.
- Indicative planning bands, subject to measured MBO volume and instruments:
  100 users $500-$800; 250 users $800-$1,500; 500 users $1,500-$3,000;
  1,000 users $3,000-$6,000+.
- Raw multi-instrument MBO and long recording retention can materially exceed
  those bands. Use measured traffic, not an assumed average, for the final bill.

## 8. Product acceptance register from owner reports

These are acceptance requirements. A prior code change is not final evidence;
each item must have deterministic tests and, where applicable, a production/RTH
visual or live-data verification recorded in the handoff.

### Live data and resilience

- Options tickers, GEX Map, dark-pool map and Rithmic data must not collectively
  hang when archive work or a provider quota fails.
- Live work retains priority over historical warming, compression and replay
  generation; those workloads remain isolated from the feed event loop.
- Health means advancing timestamps/sequences/record counts, not HTTP 200 or a
  socket marked connected.
- Provider quota exhaustion must be contained to the affected source and show
  an honest state rather than triggering repeated 5xx storms.
- Browser subscriptions are shared, reference-counted, bounded and cleanly
  restored after reconnect.

### Volume profiles and value-area levels

- Daily Volume Profile must receive a complete one-to-one calculation and
  settings audit against the locally available DeepChart implementation. Match
  session boundaries, input source, value-area algorithm, grouping, manual tick
  grouping and all supported semantics—not merely the visual style.
- Remove duplicate settings categories and dead/fake controls. A setting exists
  only if it is wired end to end and tested.
- Asia-only, London, New York, custom, split and triple modes must produce the
  selected sessions exactly. “Split” must create separate profiles, not filter
  one combined profile over a union of windows.
- Each profile calculates only its defined session/window. Later price movement
  must not stretch the historical profile's high/low or volume distribution.
- VAH/POC/VAL starts at its own profile. A historical level ends flush at the
  nearest newer profile in front; the newest profile reaches the pane's right
  edge. Lines never pass through a newer profile and never extend backward off
  the profile.
- The profile pinned to the left updates deterministically as the viewport
  advances and newer profiles move behind it.
- Enabled profile/session/value labels remain present and collision-managed;
  they do not randomly disappear.
- Profile geometry, labels and lines remain stable under pan, zoom, resize,
  theme change and vertical price movement.

### Indicators, settings and themes

- Every indicator settings dialog has an explicit Save action.
- Every indicator detects unsaved changes and asks to save/discard when the
  dialog is dismissed or focus moves away.
- After explicit Save, closing does not display the unsaved-change prompt.
- This behavior belongs to a shared indicator-settings contract so new
  indicators inherit it automatically.
- A global theme selection applies immediately across the entire website and
  every chart. Only an intentionally saved supported custom chart/indicator
  colour remains independent.
- All themes pass contrast and readability checks.

### Drawing tools

- Long/Short Position SL/TP handles stay welded to the four painted rectangle
  corners under pan, zoom, resize, narrow duration and dragging.
- Screen-space controls and price/time anchored drawings never use competing
  geometry calculations.

## 9. Launch order and definition of done

### Phase A - product completion

- Complete the visual and functional product backlog.
- Resolve the acceptance register above and every adjacent affected component.
- Remove dead controls and duplicated settings.
- Complete multi-panel, multi-theme, reconnect and persistence testing.

### Phase B - subscription and production platform

- Subscription plans, billing, entitlement enforcement and account lifecycle.
- Provider-approved bring-your-own-feed connection flow.
- Licensed options-data entitlements and metering.
- Multi-tenant session workers, stream gateways, private message layer,
  off-box storage, observability, alerts and runbooks.
- Security review covering credential storage, session tickets, tenant
  isolation, API authorization, logging and abuse/rate controls.

### Phase C - proof and launch

- Functional release candidate frozen.
- 250-user sustained and 500-user burst tests pass.
- Full-session soak and chaos/recovery tests pass.
- Cost per active subscriber is measured and fits the subscription model.
- Provider/licensing approvals are documented.
- Production monitoring, incident response, rollback and status communication
  are ready.
- Paid registration opens only after the launch gate is signed off.

### Phase D - native workstation

- Continue the cross-platform .NET/Avalonia/Skia workstation after the website
  launch.
- Reuse normalized feed contracts, indicator semantics and parity fixtures.
- Do not fork business logic into incompatible web and desktop definitions.

