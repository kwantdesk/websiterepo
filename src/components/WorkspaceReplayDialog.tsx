"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import KwantDatePicker from "@/components/ui/KwantDatePicker";
import KwantSelect from "@/components/ui/KwantSelect";
import TimeZoneSelect from "@/components/ui/TimeZoneSelect";
import { latestCompletedNewYorkSession, newYorkSessionTimestamp, type GexVueReplayState } from "@/lib/gexVueReplay";
import { earliestGexVueReplaySessionDate } from "@/lib/replayHistoryRange";
import { selectWorkspaceReplaySession, workspaceReplayClockParts, workspaceReplaySessionBounds } from "@/lib/workspaceReplay";
import { normalizeTimeZone, timeZoneCity } from "@/lib/timeZones";

export default function WorkspaceReplayDialog({ state, scope, initialTimeZone = "America/New_York", onGo, onClose }: {
  state: GexVueReplayState; scope: "charts" | "gamma";
  initialTimeZone?: string;
  onGo(value: GexVueReplayState, timeZone: string): void; onClose(): void;
}) {
  const [timeZone, setTimeZone] = useState(() => normalizeTimeZone(initialTimeZone));
  const [date, setDate] = useState(state.sessionDate);
  const [initialClock] = useState(() => workspaceReplayClockParts(newYorkSessionTimestamp(state.sessionDate, 9 * 60 + 30), normalizeTimeZone(initialTimeZone)));
  const [hour, setHour] = useState(initialClock.hour);
  const [minute, setMinute] = useState(initialClock.minute);
  const [error, setError] = useState("");
  const bounds = useMemo(() => workspaceReplaySessionBounds(state, date, scope), [state, date, scope]);
  const selection = useMemo(() => {
    try { return selectWorkspaceReplaySession(state, date, scope, `${hour}:${minute}`, timeZone); }
    catch { return null; }
  }, [state, date, scope, hour, minute, timeZone]);
  const clockFormat = useMemo(() => new Intl.DateTimeFormat("en-AU", {
    timeZone, dateStyle: "medium", timeStyle: "short", hourCycle: "h23",
  }), [timeZone]);
  const changeTimeZone = (nextZone: string) => {
    // Switching the display zone preserves a valid selected instant, including
    // any local date rollover, rather than moving replay by the UTC offset.
    if (selection) {
      const clock = workspaceReplayClockParts(selection.timestampMs, nextZone);
      setHour(clock.hour); setMinute(clock.minute);
    }
    setTimeZone(nextZone); setError("");
  };
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const key = (event: KeyboardEvent) => {
      const popup = document.querySelector<HTMLElement>('[role="listbox"], [data-kwant-date-menu]');
      if (event.key === "Escape" && popup) return;
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !dialog.current) return;
      const focusRoot = popup ?? dialog.current;
      const nodes = [...focusRoot.querySelectorAll<HTMLElement>('button:not([disabled]),input,select,[tabindex="0"]')].filter(node => node.getClientRects().length);
      const first = nodes[0], last = nodes.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); previous?.focus(); };
  }, [onClose]);
  return createPortal(<div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/60 p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="workspace-replay-title" className="w-full max-w-md rounded-lg border border-border bg-panel p-5 text-foreground shadow-2xl outline-none">
      <div className="flex items-center justify-between"><h2 id="workspace-replay-title" className="text-sm font-semibold">Replay workspace</h2><button onClick={onClose} aria-label="Close replay picker" className="px-2 text-muted">×</button></div>
      <p className="my-4 text-xs text-muted">One historical clock for all panels. Choose the trading session and your time zone. Only recorded data is replayed; missing history is shown as unavailable.</p>
      <form onSubmit={event => { event.preventDefault(); try { onGo(selectWorkspaceReplaySession(state, date, scope, `${hour}:${minute}`, timeZone), timeZone); } catch (reason) { setError(reason instanceof Error ? reason.message : "Invalid replay selection."); } }}>
        <label className="mb-2 block text-xs">Trading date · exchange session</label>
        <KwantDatePicker value={date} onChange={setDate} min={earliestGexVueReplaySessionDate()} max={latestCompletedNewYorkSession()} label="Replay trading date" />
        <label className="mb-2 mt-4 block text-xs">Time zone</label>
        <TimeZoneSelect value={timeZone} onChange={changeTimeZone} menuLabel="Replay timezone" referenceTimestampMs={selection?.timestampMs ?? bounds.startMs} />
        <label className="mb-2 mt-4 block text-xs">Start time · {timeZoneCity(timeZone)}</label>
        <div className="flex items-center gap-2">
          <KwantSelect value={hour} onChange={event => setHour(event.target.value)} aria-label="Replay hour" className="h-8 w-20 border border-border bg-surface px-2 text-xs">{Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map(value => <option key={value}>{value}</option>)}</KwantSelect>:
          <KwantSelect value={minute} onChange={event => setMinute(event.target.value)} aria-label="Replay minute" className="h-8 w-20 border border-border bg-surface px-2 text-xs">{Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map(value => <option key={value}>{value}</option>)}</KwantSelect>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-muted">Session in {timeZoneCity(timeZone)}: {clockFormat.format(bounds.startMs)} – {clockFormat.format(bounds.endMs)}.</p>
        {selection ? <p className="mt-2 text-[11px] text-foreground" aria-live="polite">Replay starts: {clockFormat.format(selection.timestampMs)} · {timeZoneCity(timeZone)}</p> : null}
        {error ? <p role="alert" className="mt-3 text-xs text-danger">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded border border-border px-3 py-2 text-xs">Cancel</button><button type="submit" className="rounded bg-primary px-5 py-2 text-xs font-semibold text-background">Go</button></div>
      </form>
    </div>
  </div>, document.body);
}
