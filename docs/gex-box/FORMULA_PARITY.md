# GEX BOX — Formula Parity

## Published calculations

The canonical formula module uses normalized contract inputs and preserves raw precision until display formatting:

- DEX: `contracts × delta × spot × multiplier`
- GEX: `contracts × gamma × spot² × 0.01 × multiplier`
- Charm: `contracts × charm × spot × multiplier`
- Negative Vanna: `-(contracts × vanna × spot × multiplier)`

`contracts` is selected from open interest or volume according to the requested basis. Calls and puts retain the signs supplied by normalized Greeks; no display-normalized heat value enters a calculation.

## Levels

- Major positive is the row with the largest positive raw signed exposure.
- Major negative is the row with the smallest negative raw signed exposure.
- Zero gamma is the interpolated strike where cumulative signed exposure crosses zero.
- Provider-native levels take precedence when the provider explicitly supplies them; calculated values disclose `basis: calculated`.

## Time semantics

Max-change calculations only compare frames at or before the requested evaluation timestamp. Tests assert that a later frame cannot influence an earlier result.

## Current production boundary

GEXBot native values are the active production source. Full contract-level reconstruction is formula-ready but remains unavailable until normalized QuantData option contracts and Greeks are supplied to this feature. No approximate reconstruction is presented as native provider data.
