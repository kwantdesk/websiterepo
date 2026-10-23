# GEX opening delivery and intermittent freeze recovery

Owner reports opening GEX Vue/Map unavailability for about five minutes,
intermittent gateway-unreachable errors, and options charts stopping/recovering.

Read-only production observations: gateway health200, Rithmic connected and
authenticated; event-loop overload repeatedly tripped (observed maximum lag
3,396ms), archived cash-index work shed with503, QuantData snapshots intermittently
aborted then resumed. Container OOM false/restart count0; no service restarted.
Gateway CPU about129%, memory1.5GiB/5GiB; this is not evidence of exhausted VPS
RAM or a dead feed. The underlying gateway load issue remains an operational
acceptance gap, not declared fixed by a green website build.

Repairs: busy-archive503 no longer poisons whole-gateway reachability; provider
fetch cancellation and deadlines stay attached through the response body;
GEX panels publish independently; serial sibling retry waits removed; failed
cycles retry at5s; opening-aware refresh wakes at09:30 New York. A real opening
strike snapshot may display as DELAYED/historyPending before minute history
exists; explicit404/422 history-only responses are optional in that opening
window. Missing exposures, auth/quota/transport errors and replay stay strict.

Tests use mocks/local fixtures only. Six recovery tests plus deadline, provider
failure-isolation and loader checks pass. Legacy hydration assertions were
checked on unchanged HEAD (five already failing); serial retry expectation
updated intentionally, remaining four not changed. Build/typecheck passes.
No VPS mutation, restart, subscription, new always-on poller or paid resource.
