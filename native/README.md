# KwantDesk Workstation

This directory contains the native Windows migration of KwantDesk. It is a real
WPF/.NET desktop client with a Skia GPU chart; it is not an Electron shell and it
does not embed the website in a browser.

## Boundary

- Rithmic, Databento, QuantData and Massive remain server-side on the KwantDesk VPS.
- The workstation consumes normalized KwantDesk gateway streams.
- Vendor credentials must never be copied into this client or its package.
- One upstream stream is shared by all native views for an instrument/timeframe.
- Tick, candle and overlay collections are bounded. No live collection may grow forever.
- No fabricated or silently downgraded market data is permitted.

The current vertical slice implements the NQ one-minute execution stream, compact
VPS seed history, deterministic candle aggregation, a bounded 20,000-candle store,
and a hardware-accelerated chart. It is the foundation for the staged 1:1 migration;
the full KwantDesk surface has not yet been ported.

## Authentication

For engineering smoke tests only, the access token can be supplied in the process
environment as `KWANTDESK_DESKTOP_SESSION_TOKEN`. The legacy gateway token name is
accepted temporarily for compatibility. Tokens are read in memory and are never
written to disk.

The production installer must use the KwantDesk browser/PKCE login flow and exchange
the signed-in user session for a short-lived, scoped gateway ticket. Never embed the
static VPS gateway token or vendor API keys in a desktop build.

## Build and test

```powershell
$dotnet = "$env:LOCALAPPDATA\KwantDesk\dotnet-sdk\dotnet.exe"
& $dotnet build .\native\KwantDesk.Workstation.slnx --configuration Release
& $dotnet test .\native\KwantDesk.Workstation.slnx --configuration Release --no-build
```

## Portable Windows package

```powershell
& .\native\scripts\publish-windows.ps1
```

The script creates a self-contained `win-x64` folder and zip under
`native/artifacts`. The target computer does not need the .NET runtime installed.
Keep the whole folder together and launch `KwantDesk.Workstation.exe`.

It also writes a developer update manifest containing the version, byte length and
SHA-256 digest. That manifest is deliberately marked unsigned and not production
eligible. Production auto-update must reject unsigned manifests and packages; code
signing and a rollback channel are required before external distribution.

Single-file publishing is intentionally disabled because the GPU renderer uses
native Skia/OpenGL assets. The folder package is deterministic and avoids runtime
extraction and native-library discovery failures.

## Runtime invariants

- Rendering is compositor-paced and only repaints when data or the viewport changes.
- The chart reads snapshots from a fixed-capacity ring buffer.
- Seed history is folded from compact one-second VPS candles without double-counting
  the raw seed records.
- Exchange pauses remain time discontinuities; the client never invents filler bars.
- Reconnect uses bounded exponential backoff.
- Window closure cancels and awaits the stream before disposing GPU and HTTP resources.

## Migration sequence

1. Certify the NQ chart/session lifecycle and authenticated VPS ticket flow.
2. Add the shared instrument/timeframe subscription registry.
3. Port chart panels and bounded overlays one at a time with parity tests.
4. Port LIQ MAP using GPU buffers and one normalized Level 3 stream.
5. Port GEX VUE/GEX MAP from the native-gamma gateway with deterministic replay.
6. Add account-backed workspaces, drawings and paper-trading state.
7. Add signed MSIX packaging plus a signed update manifest and rollback channel.

The existing website remains live throughout this migration. Native artifacts are
not a production deployment until the authenticated canary and long-session memory
tests pass.
