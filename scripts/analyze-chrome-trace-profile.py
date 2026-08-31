#!/usr/bin/env python3
"""Summarise Chrome DevTools CPU profile call sites from a .json(.gz) trace.

The DevTools export writes one trace event per line, so this deliberately
streams the file instead of loading a multi-hundred-megabyte trace into RAM.
"""

from __future__ import annotations

import argparse
import gzip
import json
from collections import defaultdict
from pathlib import Path


def open_trace(path: Path):
    return gzip.open(path, "rt", encoding="utf-8", errors="replace") if path.suffix == ".gz" else path.open("r", encoding="utf-8", errors="replace")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("trace", type=Path)
    parser.add_argument("--match", default="addEventListener|setTimeout|subscribe|listener")
    parser.add_argument("--top", type=int, default=80)
    args = parser.parse_args()
    needles = tuple(part.casefold() for part in args.match.split("|") if part)

    profiles: dict[tuple[int, int, str], dict] = defaultdict(lambda: {
        "nodes": {},
        "self_us": defaultdict(int),
        "samples": defaultdict(int),
    })

    with open_trace(args.trace) as trace:
        for line in trace:
            if '"ProfileChunk"' not in line:
                continue
            raw = line.strip().rstrip(",")
            try:
                event = json.loads(raw)
            except json.JSONDecodeError:
                continue
            data = event.get("args", {}).get("data", {})
            cpu = data.get("cpuProfile", {})
            key = (int(event.get("pid", 0)), int(event.get("tid", 0)), str(event.get("id", "")))
            profile = profiles[key]
            for node in cpu.get("nodes", []):
                profile["nodes"][int(node["id"])] = node
            samples = cpu.get("samples", [])
            deltas = data.get("timeDeltas", [])
            for index, node_id in enumerate(samples):
                node_id = int(node_id)
                profile["samples"][node_id] += 1
                if index < len(deltas):
                    profile["self_us"][node_id] += int(deltas[index])

    results = []
    for key, profile in profiles.items():
        nodes = profile["nodes"]
        for node_id, node in nodes.items():
            frame = node.get("callFrame", {})
            haystack = " ".join(
                str(frame.get(field, ""))
                for field in ("functionName", "url", "scriptId")
            ).casefold()
            if not any(needle in haystack for needle in needles):
                continue
            chain = []
            cursor = node
            seen = set()
            while cursor and int(cursor.get("id", 0)) not in seen and len(chain) < 12:
                seen.add(int(cursor.get("id", 0)))
                call = cursor.get("callFrame", {})
                chain.append(
                    f"{call.get('functionName') or '<anonymous>'} "
                    f"{call.get('url', '')}:{int(call.get('lineNumber', -1)) + 1}:"
                    f"{int(call.get('columnNumber', -1)) + 1}"
                )
                cursor = nodes.get(int(cursor.get("parent", 0)))
            results.append((
                profile["self_us"].get(node_id, 0),
                profile["samples"].get(node_id, 0),
                key,
                " <- ".join(chain),
            ))

    for self_us, samples, key, chain in sorted(results, reverse=True)[: args.top]:
        print(f"{self_us / 1000:10.3f} ms  {samples:7d} samples  pid/tid/id={key}")
        print(f"  {chain}")


if __name__ == "__main__":
    main()
