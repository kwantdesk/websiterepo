# Big Blocks (Options) overhaul

Ninth in the chart indicator checklist. The study groups observed consolidated option executions on an underlying chart. Calls and puts retain separate totals. It can group by reported underlying price or strike, and size the right-edge bars by contracts or premium.

## Findings and changes

- Cancellation rows were being retained like executions. The ledger now removes the referenced original print, rejects stale session and snapshot updates, and prevents later repeats from restoring cancelled prints. The flow adapter passes through the upstream original trade ID when supplied.
- Reattaching the native primitive could briefly use the local clock for a rolling window. It now keeps the accepted provider observation time with the ledger.
- Bar widths were normalized to the strongest level currently on-screen, so panning alone could make an unchanged trade level look bigger. The denominator now uses the whole retained displayed set.
- An active colour scheme disabled manual pickers without reaching the renderer. Calls and puts now use the scheme endpoints. Theme mode resolves legible theme colours. In premium mode, zero-premium prints no longer consume display slots.

## Validation and coverage

- 36 focused Options Big Blocks and Options VWAP tests passed, covering duplicate and revised prints, cancellations, stale frames, strike and underlying grouping, size/premium filters, coalesced delivery, session rollover and stable width when larger levels are off-screen.
- The isolated browser routed the actual chart hook through a controlled QQQ consolidated feed. It verified separate calls and puts at 500, strike and premium modes, the applied palette, cancellation on refresh, settings restoration and replay detaching the live primitive without a live request.
- DeepChart documents Option Big Flows as SPX-only, with Cboe participant data for buy/sell and open/close markers. KwantDesk's right-edge histogram intentionally uses the observed call/put tape and does not infer open/close status. The installed DLL metadata inspected by REA exposed related generic trade description accessors, with no matching Option Big Flows implementation observed. Native validation is deferred. [DeepChart Option Big Flows](https://helpdesk.deepcharts.com/portal/en/kb/articles/option-big-flows)
- The live feed samples the latest 100 consolidated prints per refresh. Production provider cadence and coverage across all underlyings are unverified. Replay remains disabled for this indicator. The Options VWAP read API omits strike, premium and multi-leg metadata, and its folded output does not preserve every correction and cancellation as it arrived. Accurate Big Blocks replay requires reading those fields and revision timestamps from the raw owned snapshots before the cutoff.
