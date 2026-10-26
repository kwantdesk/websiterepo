# Position drawing stop-loss break-even clamp

Request: long/short calculator SL should stop at entry, never invert into the profit side, and remain easy to grab and pull back into risk.

Both visible implementations now use clampPositionStopPrice: normal Chart corner drags snap to tick first and clamp to exact entry (removing the old mandatory one-tick gap); shared ChartDrawLayer corner and anchor drags clamp in price space. Other drawings/targets/time anchors are unchanged. Actual trading order stops are explicitly out of scope and may still lock in profit.

Normal hit testing chooses the nearest corner rather than an earlier target hitbox. Shared hit testing checks visible position corners before generic entry anchors/body and preserves the actual left/right corner drag path. Selected SL grab surfaces paint above TP surfaces when close/overlapping; existing generous invisible hit areas remain. Zero risk is reported as break-even with unavailable R:R, not an invented one-tick risk/infinite ratio.

44 drawing/geometry/timeframe/State regressions pass, including long/short overshoot clamps, fractional entry, saved break-even/re-grab, independent target/time preservation and handle selection at four projection scales. Existing position-behaviour script, six primitive, five default-size and seven colour checks pass. Production build/TypeScript and scoped helper/shared-layer lint pass (Chart monolith not lint-certified); logs are local position-break-even-* files. Authenticated browser pointer acceptance was not performed. No market-data, gateway or real SL/TP execution changes.
