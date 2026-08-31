#!/usr/bin/env python3
"""Where main-thread time enters the page, from a Chrome DevTools CPU profile.

Self-time names the hot function; in a minified bundle that is usually
`(anonymous)`. What can still be read is how the work was *entered* - a socket
message handler, an animation frame, a timer, the React scheduler - because
those top frames are named. Attributing every sample to the outermost frame
below `(root)` turns the profile into a budget: how many seconds each entry
path cost over the recording.

Run alongside analyze-chrome-trace-selftime.py: that one says what ran, this
one says who asked for it.
"""

from __future__ import annotations

import argparse
import gzip
import json
from collections import defaultdict
from pathlib import Path

IGNORED = {"(idle)", "(program)", "(root)"}


def open_trace(path: Path):
    if path.suffix == ".gz":
        return gzip.open(path, "rt", encoding="utf-8", errors="replace")
    return path.open("r", encoding="utf-8", errors="replace")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("trace", type=Path)
    parser.add_argument("--top", type=int, default=25)
    args = parser.parse_args()

    names: dict[str, dict[int, str]] = defaultdict(dict)
    parents: dict[str, dict[int, int]] = defaultdict(dict)
    self_us: dict[str, defaultdict[int, int]] = defaultdict(lambda: defaultdict(int))

    with open_trace(args.trace) as trace:
        for line in trace:
            if '"ProfileChunk"' not in line:
                continue
            try:
                event = json.loads(line.strip().rstrip(","))
            except json.JSONDecodeError:
                continue
            data = (event.get("args") or {}).get("data") or {}
            pid = str(event.get("id") or event.get("id2") or "")
            profile = data.get("cpuProfile") or {}
            for node in profile.get("nodes") or []:
                frame = node.get("callFrame") or {}
                names[pid][node["id"]] = frame.get("functionName") or "(anonymous)"
                if node.get("parent") is not None:
                    parents[pid][node["id"]] = node["parent"]
            samples = profile.get("samples") or []
            deltas = data.get("timeDeltas") or []
            for index, node_id in enumerate(samples):
                delta = deltas[index] if index < len(deltas) else 0
                if delta > 0:
                    self_us[pid][node_id] += delta

    # Outermost frame below (root): the reason this work ran at all.
    entry_us: defaultdict[str, int] = defaultdict(int)
    resolved: dict[tuple[str, int], str] = {}
    total_us = 0
    idle_us = 0

    def entry_for(pid: str, node_id: int) -> str:
        cached = resolved.get((pid, node_id))
        if cached is not None:
            return cached
        chain: list[int] = []
        current = node_id
        best = names[pid].get(node_id, "(anonymous)")
        seen: set[int] = set()
        while current is not None and current not in seen:
            seen.add(current)
            chain.append(current)
            name = names[pid].get(current, "(anonymous)")
            if name not in IGNORED and name != "(anonymous)":
                best = name
            current = parents[pid].get(current)
        for node in chain:
            resolved[(pid, node)] = best
        return best

    for pid, per_node in self_us.items():
        for node_id, micros in per_node.items():
            name = names[pid].get(node_id, "(anonymous)")
            total_us += micros
            if name == "(idle)":
                idle_us += micros
                continue
            entry_us[entry_for(pid, node_id)] += micros

    busy_us = total_us - idle_us
    print(f"recording: {total_us / 1e6:.1f}s sampled, {idle_us / 1e6:.1f}s idle, "
          f"{busy_us / 1e6:.1f}s busy on the main thread\n")
    print(f"{'busy ms':>10}  {'% busy':>7}  entry point")
    print("-" * 62)
    for name, micros in sorted(entry_us.items(), key=lambda item: item[1], reverse=True)[: args.top]:
        share = 100 * micros / busy_us if busy_us else 0
        print(f"{micros / 1000:10.1f}  {share:7.1f}  {name}")


if __name__ == "__main__":
    main()
