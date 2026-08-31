#!/usr/bin/env python3
"""Produce a compact runtime diagnosis from a Chrome JSON trace.

Chrome's Performance panel can export traces large enough to exhaust the
machine that is trying to diagnose them.  This reader deliberately processes
one event at a time and keeps only bounded aggregates.
"""

from __future__ import annotations

import argparse
import gzip
import json
import math
from collections import Counter, defaultdict
from pathlib import Path
from statistics import median
from typing import Any, Iterable


def open_trace(path: Path):
    if path.suffix.casefold() == ".gz":
        return gzip.open(path, "rt", encoding="utf-8", errors="replace")
    return path.open("r", encoding="utf-8", errors="replace")


def iter_events(path: Path) -> Iterable[dict[str, Any]]:
    with open_trace(path) as trace:
        for line in trace:
            raw = line.strip().rstrip(",")
            if not raw or raw in {"[", "]", "{", "}"}:
                continue
            try:
                event = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if isinstance(event, dict) and "traceEvents" in event:
                for nested in event.get("traceEvents", []):
                    if isinstance(nested, dict):
                        yield nested
            elif isinstance(event, dict):
                yield event


def percentile(values: list[float], proportion: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, math.ceil(proportion * len(ordered)) - 1))
    return ordered[index]


def flatten_numeric(value: Any, prefix: str = "") -> Iterable[tuple[str, float]]:
    if isinstance(value, bool):
        return
    if isinstance(value, (int, float)) and math.isfinite(float(value)):
        yield prefix, float(value)
        return
    if isinstance(value, dict):
        for key, nested in value.items():
            child = f"{prefix}.{key}" if prefix else str(key)
            yield from flatten_numeric(nested, child)


def compact_url(url: str) -> str:
    if not url:
        return "<native>"
    return url.rsplit("/", 1)[-1].split("?", 1)[0]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("trace", type=Path)
    parser.add_argument("--top", type=int, default=30)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    names: Counter[str] = Counter()
    categories: Counter[str] = Counter()
    thread_names: dict[tuple[int, int], str] = {}
    process_names: dict[int, str] = {}
    bounds: dict[tuple[int, int], list[float]] = defaultdict(lambda: [math.inf, -math.inf])
    duration_by_name: dict[tuple[int, int], Counter[str]] = defaultdict(Counter)
    durations_by_name: dict[tuple[int, int], dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    counters: dict[tuple[int, int], dict[str, list[tuple[float, float]]]] = defaultdict(lambda: defaultdict(list))
    profiles: dict[tuple[int, int, str], dict[str, Any]] = defaultdict(
        lambda: {"nodes": {}, "self_us": defaultdict(int), "samples": defaultdict(int)}
    )

    for event in iter_events(args.trace):
        name = str(event.get("name", ""))
        cat = str(event.get("cat", ""))
        ph = str(event.get("ph", ""))
        pid = int(event.get("pid", 0) or 0)
        tid = int(event.get("tid", 0) or 0)
        ts = float(event.get("ts", 0) or 0)
        dur = float(event.get("dur", 0) or 0)
        key = (pid, tid)

        names[name] += 1
        categories[cat] += 1
        if ph != "M" and ts > 0:
            bounds[key][0] = min(bounds[key][0], ts)
            bounds[key][1] = max(bounds[key][1], ts + dur)

        if ph == "M" and name in {"thread_name", "process_name"}:
            label = str(event.get("args", {}).get("name", ""))
            if name == "thread_name":
                thread_names[key] = label
            else:
                process_names[pid] = label

        if dur > 0:
            duration_by_name[key][name] += int(dur)
            if name in {
                "RunTask",
                "ThreadControllerImpl::RunTask",
                "FunctionCall",
                "EventDispatch",
                "FireAnimationFrame",
                "TimerFire",
                "UpdateLayoutTree",
                "Layout",
                "Paint",
                "V8.GC_SCAVENGER",
                "V8.GC_MAJOR",
            }:
                durations_by_name[key][name].append(dur / 1000.0)
            if "GC" in name and name in {"MinorGC", "MajorGC"}:
                durations_by_name[key][name].append(dur / 1000.0)

        if ph == "C" or name in {"UpdateCounters", "periodic_interval"}:
            for metric, value in flatten_numeric(event.get("args", {})):
                metric_folded = metric.casefold()
                if any(token in metric_folded for token in (
                    "heap",
                    "node",
                    "listener",
                    "document",
                    "layoutobject",
                    "timer",
                    "context",
                    "frame",
                )):
                    counters[key][metric].append((ts, value))

        if name == "ProfileChunk":
            data = event.get("args", {}).get("data", {})
            cpu = data.get("cpuProfile", {})
            profile_key = (pid, tid, str(event.get("id", "")))
            profile = profiles[profile_key]
            for node in cpu.get("nodes", []):
                profile["nodes"][int(node["id"])] = node
            samples = cpu.get("samples", [])
            deltas = data.get("timeDeltas", [])
            for index, node_id in enumerate(samples):
                node_id = int(node_id)
                profile["samples"][node_id] += 1
                if index < len(deltas):
                    profile["self_us"][node_id] += int(deltas[index])

    renderer_threads = [
        key for key, label in thread_names.items()
        if label in {"CrRendererMain", "RendererMain"}
    ]
    cpu_threads = {
        (profile_key[0], profile_key[1])
        for profile_key in profiles
    }
    renderer_threads = list(dict.fromkeys(
        renderer_threads
        + sorted(cpu_threads)
        + sorted(
            bounds,
            key=lambda key: duration_by_name[key].get("RunTask", 0),
            reverse=True,
        )[:2]
    ))
    renderer_threads = [
        key for key in renderer_threads
        if duration_by_name[key].get("RunTask", 0) > 0 or key in cpu_threads
    ][:4]

    renderer_reports = []
    for key in renderer_threads:
        start, end = bounds[key]
        if not math.isfinite(start) or not math.isfinite(end):
            start = end = 0.0
        runtime_s = max(0.0, (end - start) / 1_000_000.0)
        selected_durations = {}
        for name, values in durations_by_name[key].items():
            selected_durations[name] = {
                "count": len(values),
                "total_ms": round(sum(values), 3),
                "median_ms": round(median(values), 3),
                "p95_ms": round(percentile(values, 0.95), 3),
                "p99_ms": round(percentile(values, 0.99), 3),
                "max_ms": round(max(values), 3),
                "over_16_7ms": sum(value > 16.7 for value in values),
                "over_50ms": sum(value > 50 for value in values),
            }

        counter_report = {}
        for metric, points in counters[key].items():
            if len(points) < 2:
                continue
            first_ts, first_value = points[0]
            last_ts, last_value = points[-1]
            elapsed_s = max((last_ts - first_ts) / 1_000_000.0, 1e-9)
            counter_report[metric] = {
                "first": first_value,
                "last": last_value,
                "delta": last_value - first_value,
                "per_second": (last_value - first_value) / elapsed_s,
                "min": min(value for _, value in points),
                "max": max(value for _, value in points),
                "samples": len(points),
            }

        renderer_reports.append({
            "pid": key[0],
            "tid": key[1],
            "thread": thread_names.get(key, ""),
            "process": process_names.get(key[0], ""),
            "runtime_seconds": round(runtime_s, 3),
            "durations": selected_durations,
            "counters": counter_report,
            "top_duration_events": [
                {"name": name, "total_ms": round(total_us / 1000.0, 3)}
                for name, total_us in duration_by_name[key].most_common(args.top)
            ],
        })

    cpu_rows = []
    for profile_key, profile in profiles.items():
        nodes = profile["nodes"]
        for node_id, self_us in profile["self_us"].items():
            if self_us <= 0:
                continue
            node = nodes.get(node_id, {})
            frame = node.get("callFrame", {})
            chain = []
            cursor = node
            seen: set[int] = set()
            while cursor and int(cursor.get("id", 0)) not in seen and len(chain) < 8:
                cursor_id = int(cursor.get("id", 0))
                seen.add(cursor_id)
                call = cursor.get("callFrame", {})
                chain.append({
                    "function": call.get("functionName") or "<anonymous>",
                    "bundle": compact_url(str(call.get("url", ""))),
                    "line": int(call.get("lineNumber", -1)) + 1,
                    "column": int(call.get("columnNumber", -1)) + 1,
                })
                cursor = nodes.get(int(cursor.get("parent", 0)))
            cpu_rows.append({
                "self_ms": round(self_us / 1000.0, 3),
                "samples": profile["samples"].get(node_id, 0),
                "pid": profile_key[0],
                "tid": profile_key[1],
                "chain": chain,
            })
    cpu_rows.sort(key=lambda row: row["self_ms"], reverse=True)

    result = {
        "trace": str(args.trace.resolve()),
        "top_event_counts": names.most_common(args.top),
        "top_categories": categories.most_common(min(args.top, 20)),
        "renderer_threads": renderer_reports,
        "top_cpu_self_time": cpu_rows[: args.top],
    }

    if args.json:
        print(json.dumps(result, indent=2))
        return

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
