#!/usr/bin/env python3
"""Ancestor chains for the hottest functions in a Chrome DevTools CPU profile.

A minified bundle names almost nothing, so a self-time leaderboard alone
reports `(anonymous)` and stops. The frames above it are usually named, though
- framework entry points, event handlers and library methods survive
minification - so walking each hot node's parents until a named frame appears
identifies which subsystem is burning the time.
"""

from __future__ import annotations

import argparse
import gzip
import json
from collections import defaultdict
from pathlib import Path

ANON = "(anonymous)"


def open_trace(path: Path):
    if path.suffix == ".gz":
        return gzip.open(path, "rt", encoding="utf-8", errors="replace")
    return path.open("r", encoding="utf-8", errors="replace")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("trace", type=Path)
    parser.add_argument("--top", type=int, default=12)
    parser.add_argument("--depth", type=int, default=14)
    args = parser.parse_args()

    nodes: dict[str, dict[int, tuple[str, str, int, int]]] = defaultdict(dict)
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
                nodes[pid][node["id"]] = (
                    frame.get("functionName") or ANON,
                    (frame.get("url") or "").split("/")[-1].split("?")[0],
                    frame.get("lineNumber", -1),
                    frame.get("columnNumber", -1),
                )
                # DevTools writes an upward `parent` link here, not a
                # `children` array; reading the wrong one silently yields no
                # ancestry at all.
                if node.get("parent") is not None:
                    parents[pid][node["id"]] = node["parent"]
                for child in node.get("children") or []:
                    parents[pid][child] = node["id"]
            samples = profile.get("samples") or []
            deltas = data.get("timeDeltas") or []
            for index, node_id in enumerate(samples):
                delta = deltas[index] if index < len(deltas) else 0
                if delta > 0:
                    self_us[pid][node_id] += delta

    ranked = sorted(
        ((pid, node_id, micros) for pid, per in self_us.items() for node_id, micros in per.items()),
        key=lambda row: row[2],
        reverse=True,
    )

    shown = 0
    for pid, node_id, micros in ranked:
        frame = nodes[pid].get(node_id)
        if frame is None or frame[0] in {"(idle)", "(program)", "(garbage collector)", "(root)"}:
            continue
        name, url, line, column = frame
        print(f"\n=== {micros / 1000:.0f} ms self  {name} ({url}:{line + 1}:{column})")
        current = node_id
        for _ in range(args.depth):
            parent_id = parents[pid].get(current)
            if parent_id is None:
                break
            parent = nodes[pid].get(parent_id)
            if parent is None:
                break
            marker = "   " if parent[0] == ANON else " * "
            print(f"  {marker}{parent[0]} ({parent[1]}:{parent[2] + 1}:{parent[3]})")
            current = parent_id
        shown += 1
        if shown >= args.top:
            break


if __name__ == "__main__":
    main()
