#!/usr/bin/env python3
"""Check milestone protocol readiness without mutating git history.

This script is intentionally lightweight and safe:
- it does not commit
- it does not push
- it only reports readiness or blocked states
"""

from __future__ import annotations

import argparse
import subprocess
import os
from pathlib import Path


ORDERED_STEPS = (
    "Update docs and project memory.",
    "Run the affected tests.",
    "Inspect `git status` and `git diff`.",
    "Commit with a clear, scoped, conventional message.",
    "Push only if `git remote get-url origin` succeeds.",
)

REQUIRED_PHRASES = (
    "update docs/memory → run tests → inspect git status/diff → commit → push only if remote configured",
    "git remote get-url origin",
    "REMOTE_URL_REQUIRED",
    "Never commit secrets, PHI, raw restricted resources, model weights, caches, `.agent-artifacts/evidence`, or unrelated files.",
)


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        raise SystemExit(f"PROTOCOL_DOC_MISSING: {path}")


def check_protocol_doc(path: Path) -> None:
    content = read_text(path)
    missing = [phrase for phrase in REQUIRED_PHRASES if phrase not in content]
    if missing:
        print("PROTOCOL_DOC_INVALID")
        for phrase in missing:
            print(f"- missing: {phrase}")
        raise SystemExit(1)

    cursor = 0
    for step in ORDERED_STEPS:
        next_index = content.find(step, cursor)
        if next_index == -1:
            print("PROTOCOL_ORDER_INVALID")
            print(f"- missing or out of order: {step}")
            raise SystemExit(1)
        cursor = next_index + len(step)


def run_tests_command(command: str | None) -> None:
    if not command:
        return

    result = subprocess.run(command, shell=True, text=True)
    if result.returncode != 0:
        print("TESTS_NOT_PASSED")
        raise SystemExit(result.returncode)


def remote_url(simulate_missing_remote: bool) -> str:
    if simulate_missing_remote:
        raise SystemExit("REMOTE_URL_REQUIRED: simulated missing origin remote")

    env = os.environ.copy()
    env["GIT_MASTER"] = "1"
    result = subprocess.run(
        ["git", "remote", "get-url", "origin"],
        check=False,
        capture_output=True,
        text=True,
        env=env,
    )
    if result.returncode != 0:
        raise SystemExit("REMOTE_URL_REQUIRED: git remote get-url origin failed")
    return result.stdout.strip()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--protocol-doc",
        default="docs/milestone-protocol.md",
        help="Path to the milestone protocol document.",
    )
    parser.add_argument(
        "--tests-cmd",
        default=None,
        help="Optional shell command that must succeed before readiness is reported.",
    )
    parser.add_argument(
        "--simulate-missing-remote",
        action="store_true",
        help="Report the missing-origin blocked state without touching git.",
    )
    args = parser.parse_args()

    check_protocol_doc(Path(args.protocol_doc))
    run_tests_command(args.tests_cmd)
    url = remote_url(args.simulate_missing_remote)

    print("READY")
    print(f"origin: {url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
