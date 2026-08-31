#!/usr/bin/env python3
"""Preserve VPS-owned credentials and authorization config across releases."""

from __future__ import annotations

import os
import sys
from pathlib import Path


VPS_OWNED_KEYS = (
    "DATABENTO_API_KEY",
    "QUANTDATA_API_KEY",
    "MASSIVE_API_KEY",
    "KWANTDESK_DESKTOP_TICKET_ISSUER",
    "KWANTDESK_DESKTOP_TICKET_AUDIENCE",
    "KWANTDESK_DESKTOP_TICKET_PUBLIC_KEYS_JSON",
    "KWANTDESK_DESKTOP_REVOCATIONS_URL",
    "KWANTDESK_DESKTOP_REVOCATIONS_SYNC_TOKEN",
    "KWANTDESK_DESKTOP_REVOCATIONS_FILE",
    "KWANTDESK_DESKTOP_REVOCATIONS_POLL_MS",
    "KWANTDESK_NEWS_SERVICE_ORIGIN",
    "KWANTDESK_NEWS_SERVICE_TOKEN",
    "KWANTDESK_NEWS_SERVICE_TIMEOUT_MS",
    "KWANTDESK_SOCIALS_SERVICE_ORIGIN",
    "KWANTDESK_SOCIALS_SERVICE_TOKEN",
    "KWANTDESK_SOCIALS_SERVICE_TIMEOUT_MS",
    "KWANTDESK_JOURNAL_SERVICE_ORIGIN",
    "KWANTDESK_JOURNAL_SERVICE_TOKEN",
    "KWANTDESK_JOURNAL_SERVICE_TIMEOUT_MS",
)


def read_env(path: Path) -> tuple[list[str], dict[str, str]]:
    if not path.exists():
        return [], {}
    lines = path.read_text(encoding="utf-8").splitlines()
    values: dict[str, str] = {}
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        values[key.strip()] = value
    return lines, values


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: preserve-provider-env.py OLD_ENV NEW_ENV", file=sys.stderr)
        return 2

    old_path = Path(sys.argv[1])
    new_path = Path(sys.argv[2])
    lines, current = read_env(new_path)
    _, preserved = read_env(old_path)

    replacements = {
        key: preserved[key]
        for key in VPS_OWNED_KEYS
        if preserved.get(key, "").strip()
    }
    if not replacements:
        if new_path.exists():
            os.chmod(new_path, 0o600)
        return 0

    output: list[str] = []
    written: set[str] = set()
    for line in lines:
        stripped = line.strip()
        key = stripped.split("=", 1)[0].strip() if "=" in stripped else ""
        if key in replacements:
            output.append(f"{key}={replacements[key]}")
            written.add(key)
        else:
            output.append(line)

    for key in VPS_OWNED_KEYS:
        if key in replacements and key not in written:
            output.append(f"{key}={replacements[key]}")

    new_path.write_text("\n".join(output).rstrip() + "\n", encoding="utf-8")
    os.chmod(new_path, 0o600)

    # Report only key names. Credential values must never enter deploy logs.
    print("preserved VPS-owned configuration keys: " + ", ".join(replacements))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
