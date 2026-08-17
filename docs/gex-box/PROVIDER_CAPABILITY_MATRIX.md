# GEX BOX — Provider Capability Matrix

| Capability | Primary source | Current status | Fallback policy |
| --- | --- | --- | --- |
| Live profile by strike | GEXBot Classic/State | Connected | Explicit unavailable |
| Spot and provider levels | GEXBot frame/majors | Connected | Recalculate only when required inputs exist |
| 1/5/10/15/30 minute max change | GEXBot max-change | Connected | Canonical history calculation when sufficient snapshots exist |
| State GEX/Gamma/Delta/Vanna/Charm | GEXBot State categories | Connected subject to entitlement | Disable unsupported selection |
| Order-flow values | GEXBot Orderflow | Connected subject to entitlement | Explicit unavailable |
| Order-flow history | KwantDesk Supabase archive | Connected when configured and populated | No fabricated production history |
| Research chart definitions | GEX BOX validated grammar | Built by this change | Unsupported command rejected |
| Options OI/Greeks reconstruction | QuantData or normalized option contracts | Not wired in this scoped feature | Formula library is ready; UI reports unavailable |
| Underlying history | Existing KwantDesk Databento/VPS services | Existing platform capability | No new connection in GEX BOX |
| Alerts | GEX BOX local rule evaluation | Scoped crossing evaluation | No claim of durable server alerts until storage is configured |

## Source precedence

1. Provider-native value with a valid source stamp.
2. Verified calculation from normalized contracts or history with formula/version disclosure.
3. Explicit unavailable state.

The canonical GEX BOX API never substitutes generated preview frames for missing production history.
