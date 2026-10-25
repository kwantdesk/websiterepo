"use client";

import { useCallback, useState, type SetStateAction } from "react";

export function replayFrameIsVisible(asOf: number | null, clock: number | null, sourceScope: string, scope: string) {
  return sourceScope === scope && (clock == null || asOf != null && asOf <= clock);
}

/** A delayed effect may finish after a rewind: label data with its SOURCE
 * render clock, not the clock at which the async setter happens to execute. */
export function useReplayFrameState<T>(clock: number | null, initialValue: T, scope: string) {
  const [stored, setStored] = useState({ value: initialValue, asOf: clock, scope });
  const setValue = useCallback((action: SetStateAction<T>) => {
    setStored(previous => {
      const value = typeof action === "function" ? (action as (value: T) => T)(previous.value) : action;
      return Object.is(value, previous.value) && previous.asOf === clock && previous.scope === scope
        ? previous : { value, asOf: clock, scope };
    });
  }, [clock, scope]);
  return [replayFrameIsVisible(stored.asOf, clock, stored.scope, scope) ? stored.value : initialValue, setValue] as const;
}
