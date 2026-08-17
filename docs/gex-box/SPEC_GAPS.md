# GEX BOX — Specification Gaps Register

This document prevents unsupported capabilities from being presented as complete.

| Requirement | Gap at build start | Resolution in this build |
| --- | --- | --- |
| Four surfaces | Research absent | Add validated Research surface |
| Canonical contracts | Provider tuples used directly | Add canonical domain and adapter |
| Formula parity | No reusable audited formulas | Add formula module and tests |
| Eight Order Flow metrics | Six mismatched labels | Add exact canonical registry |
| Settings migrations | Unversioned local object | Add v1 schema and migration |
| Provider diagnostics | Minimal session label | Add source stamp/capability diagnostics |
| Deep link | `/gexbot` only | Add `/gex-box`, preserve alias |
| Durable server alerts | No server rule store/evaluator | Remains explicitly unavailable; no false production claim |
| Provider research endpoint | Separate vendor research capability not integrated | Use deterministic validated local grammar over verified GEX BOX data |
| Full QuantData contract reconstruction | Not part of existing GEX Bot path | Formula-ready but remains unavailable until normalized contracts are supplied |
| Streaming resume protocol | Existing provider is polled, not streamed | Retain one deduplicated poller; do not falsely label as provider stream |

Any unresolved row must remain visible in capability diagnostics and in the final validation ledger.
