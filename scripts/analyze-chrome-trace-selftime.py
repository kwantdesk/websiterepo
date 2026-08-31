#!/usr/bin/env python3
"""Unfiltered self-time leaderboard from a Chrome DevTools CPU profile.

The sampling profiler attributes each sample to one leaf frame, so summing
sample deltas per node gives the time actually spent inside each function
rather than the time spent underneath it. That is the number that names a hot
function; a call-path view can only name the caller that happened to be on the
stack.

Chunks arrive split across many `ProfileChunk` events keyed by the profile id
(not the thread id), and `timeDeltas` is parallel to `samples`, so both are
accumulated per profile before anything is reported.
"""

from __future__ import annotations

import argparse
import gzip
import json
from collections import defaultdict
from pathlib import Path


def open_trace(path: Path):
    if path.suffix == ".gz":
        return gzip.open(path, "rt", encoding="utf-8", errors="replace")
    return path.open("r", encoding="utf-8", errors="replace")


def short_url(url: str) -> str:
    if not url:
        return ""
    tail = url.split("/")[-1]
    return tail.split("?")[0]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("trace", type=Path)
    parser.add_argument("--top", type=int, default=40)
    args = parser.parse_args()

    # node id -> (name, url, line); shared across chunks of the same profile.
    nodes: dict[str, dict[int, tuple[str, str, int]]] = defaultdict(dict)
    parents: dict[str, dict[int, int]] = defaultdict(dict)
    self_us: dict[str, defaultdict[int, int]] = defaultdict(lambda: defaultdict(int))
    hits: dict[str, defaultdict[int, int]] = defaultdict(lambda: defaultdict(int))

    with open_trace(args.trace) as trace:
        for line in trace:
            if '"ProfileChunk"' not in line:
                continue
            try:
                event = json.loads(line.strip().rstrip(","))
            except json.JSONDecodeError:
                continue
            chunk = (event.get("args") or {}).get("data") or {}
            pid = str(event.get("id") or event.get("id2") or "")
            profile = chunk.get("cpuProfile") or {}

            for node in profile.get("nodes") or []:
                frame = node.get("callFrame") or {}
                nodes[pid][node["id"]] = (
                    frame.get("functionName") or "(anonymous)",
                    frame.get("url") or "",
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
            deltas = chunk.get("timeDeltas") or []
            for index, node_id in enumerate(samples):
                delta = deltas[index] if index < len(deltas) else 0
                if delta > 0:
                    self_us[pid][node_id] += delta
                hits[pid][node_id] += 1

    # Merge every profile: one browser tab can emit several.
    merged_us: defaultdict[tuple[str, str, int, int], int] = defaultdict(int)
    merged_hits: defaultdict[tuple[str, str, int, int], int] = defaultdict(int)
    merged_parent: dict[tuple[str, str, int, int], tuple[str, str, int, int]] = {}
    total_us = 0
    for pid, per_node in self_us.items():
        for node_id, micros in per_node.items():
            key = nodes[pid].get(node_id)
            if key is None:
                continue
            merged_us[key] += micros
            merged_hits[key] += hits[pid].get(node_id, 0)
            total_us += micros
            parent_id = parents[pid].get(node_id)
            if parent_id is not None and parent_id in nodes[pid]:
                merged_parent.setdefault(key, nodes[pid][parent_id])

    print(f"sampled CPU time: {total_us / 1e6:.1f}s across {len(merged_us)} functions\n")
    print(f"{'self ms':>10}  {'%':>5}  {'samples':>8}  function  (file:line)  <- caller")
    print("-" * 110)
    ranked = sorted(merged_us.items(), key=lambda item: item[1], reverse=True)
    for (name, url, line, column), micros in ranked[: args.top]:
        share = 100 * micros / total_us if total_us else 0
        caller = merged_parent.get((name, url, line, column))
        caller_text = f"  <- {caller[0]}" if caller else ""
        print(
            f"{micros / 1000:10.1f}  {share:5.1f}  {merged_hits[(name, url, line, column)]:8d}  "
            f"{name}  ({short_url(url)}:{line + 1}:{column}){caller_text}"
        )


if __name__ == "__main__":
    main()
