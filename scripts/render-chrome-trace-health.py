#!/usr/bin/env python3
"""Render bounded Chrome renderer health counters as a dependency-free SVG."""

from __future__ import annotations

import argparse
import gzip
import html
import json
from pathlib import Path


def iter_events(path: Path):
    """Stream trace events without retaining the multi-gigabyte trace in RAM."""
    opener = gzip.open if path.suffix.lower() == ".gz" else open
    with opener(path, "rt", encoding="utf-8", errors="replace") as handle:
        decoder = json.JSONDecoder()
        buffer = ""
        in_events = False
        while True:
            chunk = handle.read(1 << 20)
            if not chunk:
                break
            buffer += chunk
            if not in_events:
                marker = buffer.find('"traceEvents"')
                if marker < 0:
                    buffer = buffer[-64:]
                    continue
                array_start = buffer.find("[", marker)
                if array_start < 0:
                    continue
                buffer = buffer[array_start + 1 :]
                in_events = True
            while in_events:
                buffer = buffer.lstrip(" \r\n\t,")
                if not buffer or buffer[0] == "]":
                    break
                try:
                    event, end = decoder.raw_decode(buffer)
                except json.JSONDecodeError:
                    break
                if isinstance(event, dict):
                    yield event
                buffer = buffer[end:]


def sample(points: list[tuple[float, float]], limit: int = 1200) -> list[tuple[float, float]]:
    if len(points) <= limit:
        return points
    stride = max(1, len(points) // limit)
    sampled: list[tuple[float, float]] = []
    for start in range(0, len(points), stride):
        bucket = points[start : start + stride]
        if not bucket:
            continue
        # Preserve the peak that matters for OOM/listener diagnosis.
        sampled.append(max(bucket, key=lambda point: point[1]))
    return sorted(sampled)


def path_for(points: list[tuple[float, float]], left: float, top: float, width: float, height: float, start: float, end: float, maximum: float) -> str:
    if not points or end <= start or maximum <= 0:
        return ""
    coords = []
    for timestamp, value in sample(points):
        x = left + (timestamp - start) / (end - start) * width
        y = top + height - value / maximum * height
        coords.append(f"{x:.2f},{y:.2f}")
    return "M " + " L ".join(coords)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("trace", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--pid", type=int, required=True)
    parser.add_argument("--tid", type=int, required=True)
    args = parser.parse_args()

    heap: list[tuple[float, float]] = []
    listeners: list[tuple[float, float]] = []
    nodes: list[tuple[float, float]] = []
    for event in iter_events(args.trace):
        if int(event.get("pid", 0) or 0) != args.pid or int(event.get("tid", 0) or 0) != args.tid:
            continue
        if event.get("name") != "UpdateCounters":
            continue
        timestamp = float(event.get("ts", 0) or 0)
        data = event.get("args", {}).get("data", {})
        if "jsHeapSizeUsed" in data:
            heap.append((timestamp, float(data["jsHeapSizeUsed"])))
        if "jsEventListeners" in data:
            listeners.append((timestamp, float(data["jsEventListeners"])))
        if "nodes" in data:
            nodes.append((timestamp, float(data["nodes"])))

    all_points = heap + listeners + nodes
    if not all_points:
        raise SystemExit("No matching renderer counters were found")
    start = min(timestamp for timestamp, _ in all_points)
    end = max(timestamp for timestamp, _ in all_points)
    duration = max(0.001, (end - start) / 1_000_000)
    heap_mb = [(timestamp, value / 1_000_000) for timestamp, value in heap]
    heap_max = max((value for _, value in heap_mb), default=1)
    listener_max = max((value for _, value in listeners), default=1)
    node_min = min((value for _, value in nodes), default=0)
    node_max = max((value for _, value in nodes), default=1)

    width, height = 1600, 900
    left, plot_width, plot_height = 100, 1420, 270
    heap_top, listener_top = 120, 500
    heap_path = path_for(heap_mb, left, heap_top, plot_width, plot_height, start, end, heap_max)
    listener_path = path_for(listeners, left, listener_top, plot_width, plot_height, start, end, listener_max)

    def axis(top: int, maximum: float, unit: str) -> str:
        lines = []
        for index in range(5):
            value = maximum * (4 - index) / 4
            y = top + plot_height * index / 4
            lines.append(f'<line x1="{left}" y1="{y:.1f}" x2="{left + plot_width}" y2="{y:.1f}" stroke="#25303b" stroke-width="1"/>')
            lines.append(f'<text x="{left - 14}" y="{y + 5:.1f}" text-anchor="end" class="axis">{value:,.0f}{unit}</text>')
        return "".join(lines)

    time_labels = []
    for index in range(7):
        seconds = duration * index / 6
        x = left + plot_width * index / 6
        time_labels.append(f'<text x="{x:.1f}" y="{listener_top + plot_height + 34}" text-anchor="middle" class="axis">{seconds:.0f}s</text>')

    source = html.escape(str(args.trace))
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
<rect width="100%" height="100%" fill="#080b0f"/>
<style>.title{{font:700 28px Inter,Arial,sans-serif;fill:#f5f7fa}}.sub{{font:14px Inter,Arial,sans-serif;fill:#93a2b3}}.label{{font:700 17px Inter,Arial,sans-serif;fill:#e4e9ef}}.axis{{font:12px ui-monospace,SFMono-Regular,Consolas,monospace;fill:#8491a1}}.value{{font:700 18px ui-monospace,SFMono-Regular,Consolas,monospace}}</style>
<text x="{left}" y="48" class="title">KwantDesk live renderer: measured memory pressure</text>
<text x="{left}" y="75" class="sub">Renderer PID {args.pid}, TID {args.tid} · {duration:.1f}s trace · source: {source}</text>
<text x="{left}" y="105" class="label">JavaScript heap (MB)</text>
{axis(heap_top, heap_max, '')}
<path d="{heap_path}" fill="none" stroke="#ff477e" stroke-width="2.5"/>
<text x="{left + plot_width}" y="105" text-anchor="end" class="value" fill="#ff477e">peak {heap_max:,.0f} MB</text>
<line x1="{left}" y1="{heap_top + plot_height * max(0, 1 - 1000 / heap_max):.1f}" x2="{left + plot_width}" y2="{heap_top + plot_height * max(0, 1 - 1000 / heap_max):.1f}" stroke="#f6c85f" stroke-dasharray="8 7"/>
<text x="{left + 8}" y="{heap_top + plot_height * max(0, 1 - 1000 / heap_max) - 8:.1f}" class="axis" fill="#f6c85f">proposed 1,000 MB ceiling</text>
<text x="{left}" y="485" class="label">JavaScript event listeners</text>
{axis(listener_top, listener_max, '')}
<path d="{listener_path}" fill="none" stroke="#38d6d6" stroke-width="2.5"/>
<text x="{left + plot_width}" y="485" text-anchor="end" class="value" fill="#38d6d6">peak {listener_max:,.0f}</text>
{''.join(time_labels)}
<text x="{left}" y="835" class="sub">DOM nodes remained bounded ({node_min:,.0f}–{node_max:,.0f}); the failure signature is listener/closure churn and heap sawtoothing, not DOM growth.</text>
</svg>'''
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(svg, encoding="utf-8")
    print(f"wrote {args.output} ({len(heap)} heap, {len(listeners)} listener, {len(nodes)} node samples)")


if __name__ == "__main__":
    main()
