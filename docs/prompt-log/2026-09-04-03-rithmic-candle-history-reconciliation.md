# Rithmic candle-history reconciliation

## Prompt

> I think then this is important for us, is to make our candles history,
> somehow part of the candle history we get, so that we never have any gaps,
> any wicks that aren't accurate, any closures that aren't accurate. We need to
> avoid that. So maybe we can fill in historical with that, and fill in gaps
> that we get, somehow, so that the candles we get aren't just the recorded
> ones. Because I've noticed when they're just the recorded ones live, we get
> some little gaps every now and it's unneat. We can avoid this by making our
> candles, you know, the rhythmic ones.

## Diagnosis

The gateway had already imported Rithmic History Plant minute bars and also
maintained the desk's exact-contract bars from the live Rithmic trade stream.
The reader nevertheless selected one whole file per session: if even one local
exact-contract bar existed, it ignored the complete History Plant root file.
A reconnect gap or partial local minute therefore survived despite canonical
Rithmic history being present on the same disk.

## Fix

- Historical sessions are reconciled minute by minute.
- Rithmic History Plant is the authoritative closed-bar baseline.
- Recorded Rithmic bars fill minutes that the imported baseline does not yet
  contain and continue the live edge beyond its last closed bar.
- A local partial minute can no longer replace a canonical History Plant
  minute merely because its exact-contract file exists.
- Structurally impossible archived OHLC rows are rejected rather than being
  drawn or silently clipped into plausible-looking candles.
- The API now reports the combined source honestly as `Rithmic History Plant +
  recorded trade tape`.

## Outcome

Charts use Rithmic's historical bars and the desk's Rithmic capture as one
continuous hierarchy instead of mutually exclusive histories. This repairs
real locally missing minutes whenever History Plant has them while retaining
the recorded live edge, without inventing candles across exchange closures.
